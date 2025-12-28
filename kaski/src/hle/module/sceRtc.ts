/**
 * sceRtc
 *
 * Real-time clock module.
 * Provides time/date functions and tick-based timing.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * PSP tick frequency (1MHz = 1,000,000 ticks per second)
 */
const TICK_FREQUENCY = 1000000n;

/**
 * Epoch offset: difference between Unix epoch (1970) and PSP epoch (1/1/0001)
 * PSP uses .NET-style ticks (100ns units from year 1)
 */
const PSP_EPOCH_OFFSET = 62135596800000n; // milliseconds from year 1 to 1970

/**
 * Convert JavaScript Date to PSP ticks
 */
function dateToTicks(date: Date): bigint
{
  const unixMs = BigInt(date.getTime());
  const totalMs = unixMs + PSP_EPOCH_OFFSET;
  return totalMs * 1000n; // Convert ms to microseconds (PSP ticks)
}

/**
 * Convert PSP ticks to JavaScript Date
 */
function ticksToDate(ticks: bigint): Date
{
  const totalMs = ticks / 1000n; // Convert ticks to ms
  const unixMs = totalMs - PSP_EPOCH_OFFSET;
  return new Date(Number(unixMs));
}

/**
 * Get current ticks (microseconds since PSP epoch)
 */
function getCurrentTicks(): bigint
{
  return dateToTicks(new Date());
}

/**
 * Days in each month (non-leap year)
 */
const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Check if year is leap year
 */
function isLeapYear(year: number): boolean
{
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Get days in month
 */
function getDaysInMonth(year: number, month: number): number
{
  if (month === 2 && isLeapYear(year))
  {
    return 29;
  }
  return DAYS_IN_MONTH[month] || 0;
}

/**
 * Get day of week (0 = Sunday, 6 = Saturday)
 */
function getDayOfWeek(year: number, month: number, day: number): number
{
  const date = new Date(year, month - 1, day);
  return date.getDay();
}

@hleModule('sceRtc')
export class sceRtc
{
  readonly name = 'sceRtc';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  // ============================================
  // Tick Functions
  // ============================================

  /**
   * sceRtcGetTickResolution
   * Get tick resolution (ticks per second)
   *
   * @returns Ticks per second (1,000,000)
   */
  @nativeFunction(0xC41C2853, 150)
  sceRtcGetTickResolution(): number
  {
    return Number(TICK_FREQUENCY);
  }

  /**
   * sceRtcGetCurrentTick
   * Get current tick count
   *
   * @param tickPtr - Output 64-bit tick value
   * @returns 0 on success
   */
  @nativeFunction(0x3F7AD767, 150)
  sceRtcGetCurrentTick(): number
  {
    const tickPtr = this.ctx.argPtr(0);

    const ticks = getCurrentTicks();
    const low = Number(ticks & 0xFFFFFFFFn);
    const high = Number((ticks >> 32n) & 0xFFFFFFFFn);

    this.ctx.write32(tickPtr, low);
    this.ctx.write32(tickPtr + 4, high);

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceRtcGetCurrentClock
   * Get current time as ScePspDateTime
   *
   * @param timePtr - Output ScePspDateTime structure
   * @param tz - Timezone offset in minutes
   * @returns 0 on success
   */
  @nativeFunction(0x4CFA57B0, 150)
  sceRtcGetCurrentClock(): number
  {
    const timePtr = this.ctx.argPtr(0);
    const tz = this.ctx.arg(1);

    const now = new Date();
    // Apply timezone offset
    now.setMinutes(now.getMinutes() + tz);

    this.writeDateTime(timePtr, now);

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceRtcGetCurrentClockLocalTime
   * Get current local time as ScePspDateTime
   *
   * @param timePtr - Output ScePspDateTime structure
   * @returns 0 on success
   */
  @nativeFunction(0xE7C27D1B, 150)
  sceRtcGetCurrentClockLocalTime(): number
  {
    const timePtr = this.ctx.argPtr(0);

    this.writeDateTime(timePtr, new Date());

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Date/Time Conversion
  // ============================================

  /**
   * sceRtcSetTick
   * Convert ticks to ScePspDateTime
   *
   * @param timePtr - Output ScePspDateTime structure
   * @param tickPtr - Input 64-bit tick value
   * @returns 0 on success
   */
  @nativeFunction(0x7ED29E40, 150)
  sceRtcSetTick(): number
  {
    const timePtr = this.ctx.argPtr(0);
    const tickPtr = this.ctx.argPtr(1);

    const low = this.ctx.read32(tickPtr);
    const high = this.ctx.read32(tickPtr + 4);
    const ticks = (BigInt(high) << 32n) | BigInt(low >>> 0);

    const date = ticksToDate(ticks);
    this.writeDateTime(timePtr, date);

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceRtcGetTick
   * Convert ScePspDateTime to ticks
   *
   * @param timePtr - Input ScePspDateTime structure
   * @param tickPtr - Output 64-bit tick value
   * @returns 0 on success
   */
  @nativeFunction(0x6FF40ACC, 150)
  sceRtcGetTick(): number
  {
    const timePtr = this.ctx.argPtr(0);
    const tickPtr = this.ctx.argPtr(1);

    const date = this.readDateTime(timePtr);
    const ticks = dateToTicks(date);

    const low = Number(ticks & 0xFFFFFFFFn);
    const high = Number((ticks >> 32n) & 0xFFFFFFFFn);

    this.ctx.write32(tickPtr, low);
    this.ctx.write32(tickPtr + 4, high);

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Tick Arithmetic
  // ============================================

  /**
   * sceRtcTickAddTicks
   * Add ticks to a tick value
   *
   * @param destTickPtr - Output tick value
   * @param srcTickPtr - Input tick value
   * @param add - Ticks to add
   * @returns 0 on success
   */
  @nativeFunction(0x44F45E05, 150)
  sceRtcTickAddTicks(): number
  {
    const destTickPtr = this.ctx.argPtr(0);
    const srcTickPtr = this.ctx.argPtr(1);
    // add is 64-bit, passed in a2:a3
    const addLow = this.ctx.arg(2);
    const addHigh = this.ctx.arg(3);

    const srcLow = this.ctx.read32(srcTickPtr);
    const srcHigh = this.ctx.read32(srcTickPtr + 4);
    const srcTicks = (BigInt(srcHigh) << 32n) | BigInt(srcLow >>> 0);
    const addTicks = (BigInt(addHigh) << 32n) | BigInt(addLow >>> 0);

    const result = srcTicks + addTicks;

    this.ctx.write32(destTickPtr, Number(result & 0xFFFFFFFFn));
    this.ctx.write32(destTickPtr + 4, Number((result >> 32n) & 0xFFFFFFFFn));

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceRtcTickAddMicroseconds
   * Add microseconds to a tick value
   */
  @nativeFunction(0x26D25A5D, 150)
  sceRtcTickAddMicroseconds(): number
  {
    return this.sceRtcTickAddTicks(); // Same as adding ticks (1 tick = 1 microsecond)
  }

  /**
   * sceRtcTickAddSeconds
   * Add seconds to a tick value
   */
  @nativeFunction(0xF2A4AFE5, 150)
  sceRtcTickAddSeconds(): number
  {
    const destTickPtr = this.ctx.argPtr(0);
    const srcTickPtr = this.ctx.argPtr(1);
    const addLow = this.ctx.arg(2);
    const addHigh = this.ctx.arg(3);

    const srcLow = this.ctx.read32(srcTickPtr);
    const srcHigh = this.ctx.read32(srcTickPtr + 4);
    const srcTicks = (BigInt(srcHigh) << 32n) | BigInt(srcLow >>> 0);
    const addSeconds = (BigInt(addHigh) << 32n) | BigInt(addLow >>> 0);

    const result = srcTicks + addSeconds * TICK_FREQUENCY;

    this.ctx.write32(destTickPtr, Number(result & 0xFFFFFFFFn));
    this.ctx.write32(destTickPtr + 4, Number((result >> 32n) & 0xFFFFFFFFn));

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceRtcTickAddMinutes
   * Add minutes to a tick value
   */
  @nativeFunction(0xE6605BCA, 150)
  sceRtcTickAddMinutes(): number
  {
    const destTickPtr = this.ctx.argPtr(0);
    const srcTickPtr = this.ctx.argPtr(1);
    const addLow = this.ctx.arg(2);
    const addHigh = this.ctx.arg(3);

    const srcLow = this.ctx.read32(srcTickPtr);
    const srcHigh = this.ctx.read32(srcTickPtr + 4);
    const srcTicks = (BigInt(srcHigh) << 32n) | BigInt(srcLow >>> 0);
    const addMinutes = (BigInt(addHigh) << 32n) | BigInt(addLow >>> 0);

    const result = srcTicks + addMinutes * 60n * TICK_FREQUENCY;

    this.ctx.write32(destTickPtr, Number(result & 0xFFFFFFFFn));
    this.ctx.write32(destTickPtr + 4, Number((result >> 32n) & 0xFFFFFFFFn));

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceRtcTickAddHours
   * Add hours to a tick value
   */
  @nativeFunction(0x26D7A24A, 150)
  sceRtcTickAddHours(): number
  {
    const destTickPtr = this.ctx.argPtr(0);
    const srcTickPtr = this.ctx.argPtr(1);
    const hours = this.ctx.arg(2);

    const srcLow = this.ctx.read32(srcTickPtr);
    const srcHigh = this.ctx.read32(srcTickPtr + 4);
    const srcTicks = (BigInt(srcHigh) << 32n) | BigInt(srcLow >>> 0);

    const result = srcTicks + BigInt(hours) * 3600n * TICK_FREQUENCY;

    this.ctx.write32(destTickPtr, Number(result & 0xFFFFFFFFn));
    this.ctx.write32(destTickPtr + 4, Number((result >> 32n) & 0xFFFFFFFFn));

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceRtcTickAddDays
   * Add days to a tick value
   */
  @nativeFunction(0xE51B4B7A, 150)
  sceRtcTickAddDays(): number
  {
    const destTickPtr = this.ctx.argPtr(0);
    const srcTickPtr = this.ctx.argPtr(1);
    const days = this.ctx.arg(2);

    const srcLow = this.ctx.read32(srcTickPtr);
    const srcHigh = this.ctx.read32(srcTickPtr + 4);
    const srcTicks = (BigInt(srcHigh) << 32n) | BigInt(srcLow >>> 0);

    const result = srcTicks + BigInt(days) * 86400n * TICK_FREQUENCY;

    this.ctx.write32(destTickPtr, Number(result & 0xFFFFFFFFn));
    this.ctx.write32(destTickPtr + 4, Number((result >> 32n) & 0xFFFFFFFFn));

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceRtcTickAddWeeks
   * Add weeks to a tick value
   */
  @nativeFunction(0xCF3A2CA8, 150)
  sceRtcTickAddWeeks(): number
  {
    const destTickPtr = this.ctx.argPtr(0);
    const srcTickPtr = this.ctx.argPtr(1);
    const weeks = this.ctx.arg(2);

    const srcLow = this.ctx.read32(srcTickPtr);
    const srcHigh = this.ctx.read32(srcTickPtr + 4);
    const srcTicks = (BigInt(srcHigh) << 32n) | BigInt(srcLow >>> 0);

    const result = srcTicks + BigInt(weeks) * 604800n * TICK_FREQUENCY;

    this.ctx.write32(destTickPtr, Number(result & 0xFFFFFFFFn));
    this.ctx.write32(destTickPtr + 4, Number((result >> 32n) & 0xFFFFFFFFn));

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceRtcTickAddMonths
   * Add months to a tick value
   */
  @nativeFunction(0xDBF74F1B, 150)
  sceRtcTickAddMonths(): number
  {
    const destTickPtr = this.ctx.argPtr(0);
    const srcTickPtr = this.ctx.argPtr(1);
    const months = this.ctx.arg(2);

    const srcLow = this.ctx.read32(srcTickPtr);
    const srcHigh = this.ctx.read32(srcTickPtr + 4);
    const srcTicks = (BigInt(srcHigh) << 32n) | BigInt(srcLow >>> 0);

    // Convert to date, add months, convert back
    const date = ticksToDate(srcTicks);
    date.setMonth(date.getMonth() + months);
    const result = dateToTicks(date);

    this.ctx.write32(destTickPtr, Number(result & 0xFFFFFFFFn));
    this.ctx.write32(destTickPtr + 4, Number((result >> 32n) & 0xFFFFFFFFn));

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceRtcTickAddYears
   * Add years to a tick value
   */
  @nativeFunction(0x42842C77, 150)
  sceRtcTickAddYears(): number
  {
    const destTickPtr = this.ctx.argPtr(0);
    const srcTickPtr = this.ctx.argPtr(1);
    const years = this.ctx.arg(2);

    const srcLow = this.ctx.read32(srcTickPtr);
    const srcHigh = this.ctx.read32(srcTickPtr + 4);
    const srcTicks = (BigInt(srcHigh) << 32n) | BigInt(srcLow >>> 0);

    const date = ticksToDate(srcTicks);
    date.setFullYear(date.getFullYear() + years);
    const result = dateToTicks(date);

    this.ctx.write32(destTickPtr, Number(result & 0xFFFFFFFFn));
    this.ctx.write32(destTickPtr + 4, Number((result >> 32n) & 0xFFFFFFFFn));

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Tick Comparison
  // ============================================

  /**
   * sceRtcCompareTick
   * Compare two tick values
   *
   * @param tick1Ptr - First tick value
   * @param tick2Ptr - Second tick value
   * @returns -1 if tick1 < tick2, 0 if equal, 1 if tick1 > tick2
   */
  @nativeFunction(0x9ED0AE87, 150)
  sceRtcCompareTick(): number
  {
    const tick1Ptr = this.ctx.argPtr(0);
    const tick2Ptr = this.ctx.argPtr(1);

    const low1 = this.ctx.read32(tick1Ptr);
    const high1 = this.ctx.read32(tick1Ptr + 4);
    const tick1 = (BigInt(high1) << 32n) | BigInt(low1 >>> 0);

    const low2 = this.ctx.read32(tick2Ptr);
    const high2 = this.ctx.read32(tick2Ptr + 4);
    const tick2 = (BigInt(high2) << 32n) | BigInt(low2 >>> 0);

    if (tick1 < tick2) return -1;
    if (tick1 > tick2) return 1;
    return 0;
  }

  // ============================================
  // Date Utilities
  // ============================================

  /**
   * sceRtcGetDayOfWeek
   * Get day of week for a date
   *
   * @param year - Year
   * @param month - Month (1-12)
   * @param day - Day
   * @returns Day of week (0 = Sunday)
   */
  @nativeFunction(0x57726BC1, 150)
  sceRtcGetDayOfWeek(): number
  {
    const year = this.ctx.arg(0);
    const month = this.ctx.arg(1);
    const day = this.ctx.arg(2);

    return getDayOfWeek(year, month, day);
  }

  /**
   * sceRtcGetDaysInMonth
   * Get number of days in a month
   *
   * @param year - Year
   * @param month - Month (1-12)
   * @returns Days in month
   */
  @nativeFunction(0x05EF322C, 150)
  sceRtcGetDaysInMonth(): number
  {
    const year = this.ctx.arg(0);
    const month = this.ctx.arg(1);

    return getDaysInMonth(year, month);
  }

  /**
   * sceRtcIsLeapYear
   * Check if year is a leap year
   *
   * @param year - Year
   * @returns 1 if leap year, 0 otherwise
   */
  @nativeFunction(0x34885E0D, 150)
  sceRtcIsLeapYear(): number
  {
    const year = this.ctx.arg(0);
    return isLeapYear(year) ? 1 : 0;
  }

  /**
   * sceRtcCheckValid
   * Check if a ScePspDateTime is valid
   *
   * @param timePtr - ScePspDateTime structure
   * @returns 0 if valid, error code otherwise
   */
  @nativeFunction(0x4B1B5E82, 150)
  sceRtcCheckValid(): number
  {
    const timePtr = this.ctx.argPtr(0);

    const year = this.ctx.read16(timePtr);
    const month = this.ctx.read16(timePtr + 2);
    const day = this.ctx.read16(timePtr + 4);
    const hour = this.ctx.read16(timePtr + 6);
    const minute = this.ctx.read16(timePtr + 8);
    const second = this.ctx.read16(timePtr + 10);
    const microsecond = this.ctx.read32(timePtr + 12);

    if (year < 1 || year > 9999) return SceKernelErrors.ERROR_INVALID_VALUE;
    if (month < 1 || month > 12) return SceKernelErrors.ERROR_INVALID_VALUE;
    if (day < 1 || day > getDaysInMonth(year, month)) return SceKernelErrors.ERROR_INVALID_VALUE;
    if (hour < 0 || hour > 23) return SceKernelErrors.ERROR_INVALID_VALUE;
    if (minute < 0 || minute > 59) return SceKernelErrors.ERROR_INVALID_VALUE;
    if (second < 0 || second > 59) return SceKernelErrors.ERROR_INVALID_VALUE;
    if (microsecond < 0 || microsecond > 999999) return SceKernelErrors.ERROR_INVALID_VALUE;

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Time Format Conversion
  // ============================================

  /**
   * sceRtcGetTime_t
   * Convert ScePspDateTime to Unix time_t
   *
   * @param timePtr - ScePspDateTime structure
   * @param tPtr - Output time_t value
   * @returns 0 on success
   */
  @nativeFunction(0x27C4594C, 150)
  sceRtcGetTime_t(): number
  {
    const timePtr = this.ctx.argPtr(0);
    const tPtr = this.ctx.argPtr(1);

    const date = this.readDateTime(timePtr);
    const unixTime = Math.floor(date.getTime() / 1000);

    this.ctx.write32(tPtr, unixTime);

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceRtcSetTime_t
   * Convert Unix time_t to ScePspDateTime
   *
   * @param timePtr - Output ScePspDateTime structure
   * @param t - time_t value
   * @returns 0 on success
   */
  @nativeFunction(0x3A807CC8, 150)
  sceRtcSetTime_t(): number
  {
    const timePtr = this.ctx.argPtr(0);
    const t = this.ctx.arg(1);

    const date = new Date(t * 1000);
    this.writeDateTime(timePtr, date);

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Write ScePspDateTime structure to memory
   *
   * ScePspDateTime:
   *   u16 year
   *   u16 month
   *   u16 day
   *   u16 hour
   *   u16 minute
   *   u16 second
   *   u32 microsecond
   */
  private writeDateTime(ptr: number, date: Date): void
  {
    this.ctx.write16(ptr + 0, date.getFullYear());
    this.ctx.write16(ptr + 2, date.getMonth() + 1);
    this.ctx.write16(ptr + 4, date.getDate());
    this.ctx.write16(ptr + 6, date.getHours());
    this.ctx.write16(ptr + 8, date.getMinutes());
    this.ctx.write16(ptr + 10, date.getSeconds());
    this.ctx.write32(ptr + 12, date.getMilliseconds() * 1000);
  }

  /**
   * Read ScePspDateTime structure from memory
   */
  private readDateTime(ptr: number): Date
  {
    const year = this.ctx.read16(ptr + 0);
    const month = this.ctx.read16(ptr + 2) - 1; // JS months are 0-based
    const day = this.ctx.read16(ptr + 4);
    const hour = this.ctx.read16(ptr + 6);
    const minute = this.ctx.read16(ptr + 8);
    const second = this.ctx.read16(ptr + 10);
    const microsecond = this.ctx.read32(ptr + 12);

    const date = new Date(year, month, day, hour, minute, second, Math.floor(microsecond / 1000));
    return date;
  }
}
