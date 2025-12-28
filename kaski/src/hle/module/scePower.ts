/**
 * scePower
 *
 * Power management module.
 * Provides battery info, clock frequency control, and power callbacks.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * Power callback flags
 */
export const PowerFlags = {
  POWER_CB_POWER_SWITCH: 0x80000000,
  POWER_CB_HOLD_SWITCH: 0x40000000,
  POWER_CB_STANDBY: 0x00080000,
  POWER_CB_RESUME_COMPLETE: 0x00040000,
  POWER_CB_RESUMING: 0x00020000,
  POWER_CB_SUSPENDING: 0x00010000,
  POWER_CB_AC_POWER: 0x00001000,
  POWER_CB_BATTERY_LOW: 0x00000100,
  POWER_CB_BATTERY_EXIST: 0x00000080,
  POWER_CB_BATTPOWER: 0x0000007F,
} as const;

/**
 * Default clock frequencies (MHz)
 */
const DEFAULT_CPU_CLOCK = 222;
const DEFAULT_BUS_CLOCK = 111;
const MAX_CPU_CLOCK = 333;
const MAX_BUS_CLOCK = 166;

@hleModule('scePower')
export class scePower
{
  readonly name = 'scePower';

  private ctx!: EmulatorContext;

  // Clock frequencies
  private cpuClock: number = DEFAULT_CPU_CLOCK;
  private busClock: number = DEFAULT_BUS_CLOCK;

  // Power callbacks (slot -> callback ID)
  private callbacks: Map<number, number> = new Map();

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  // ============================================
  // Battery Status
  // ============================================

  /**
   * scePowerIsPowerOnline
   * Check if AC power is connected
   *
   * @returns 1 if AC power, 0 if battery only
   */
  @nativeFunction(0x87440F5E, 150)
  scePowerIsPowerOnline(): number
  {
    return 1; // Always on AC power (emulator)
  }

  /**
   * scePowerIsBatteryExist
   * Check if battery is present
   *
   * @returns 1 if battery exists, 0 otherwise
   */
  @nativeFunction(0x0AFD0D8B, 150)
  scePowerIsBatteryExist(): number
  {
    return 1; // Battery always present
  }

  /**
   * scePowerIsBatteryCharging
   * Check if battery is charging
   *
   * @returns 1 if charging, 0 otherwise
   */
  @nativeFunction(0x1E490401, 150)
  scePowerIsBatteryCharging(): number
  {
    return 1; // Always charging (on AC power)
  }

  /**
   * scePowerGetBatteryChargingStatus
   * Get battery charging status
   *
   * @returns Charging status flags
   */
  @nativeFunction(0xB4432BC8, 150)
  scePowerGetBatteryChargingStatus(): number
  {
    return 0x03; // PSP_POWER_CB_AC_POWER | PSP_POWER_CB_BATTERY_EXIST
  }

  /**
   * scePowerIsLowBattery
   * Check if battery is low
   *
   * @returns 1 if low battery, 0 otherwise
   */
  @nativeFunction(0xD3075926, 150)
  scePowerIsLowBattery(): number
  {
    return 0; // Never low (emulator)
  }

  /**
   * scePowerGetBatteryLifePercent
   * Get battery charge percentage
   *
   * @returns Battery percentage (0-100)
   */
  @nativeFunction(0x2085D15D, 150)
  scePowerGetBatteryLifePercent(): number
  {
    return 100; // Always full
  }

  /**
   * scePowerGetBatteryLifeTime
   * Get remaining battery time in minutes
   *
   * @returns Minutes remaining, or -1 if AC power
   */
  @nativeFunction(0x8EFB3FA2, 150)
  scePowerGetBatteryLifeTime(): number
  {
    return -1; // Infinite (on AC power)
  }

  /**
   * scePowerGetBatteryTemp
   * Get battery temperature in Celsius
   *
   * @returns Temperature
   */
  @nativeFunction(0x28E12023, 150)
  scePowerGetBatteryTemp(): number
  {
    return 25; // Room temperature
  }

  /**
   * scePowerGetBatteryVolt
   * Get battery voltage in mV
   *
   * @returns Voltage
   */
  @nativeFunction(0x483CE86B, 150)
  scePowerGetBatteryVolt(): number
  {
    return 4200; // Full charge voltage (4.2V)
  }

  /**
   * scePowerGetBatteryElec
   * Get battery current in mA
   *
   * @returns Current (negative = discharging)
   */
  @nativeFunction(0x23436A4A, 150)
  scePowerGetBatteryElec(): number
  {
    return 0; // No current (on AC power)
  }

  /**
   * scePowerGetBatteryRemainCapacity
   * Get remaining battery capacity in mAh
   *
   * @returns Capacity
   */
  @nativeFunction(0x0CD21B1F, 150)
  scePowerGetBatteryRemainCapacity(): number
  {
    return 1800; // Full capacity
  }

  /**
   * scePowerGetBatteryFullCapacity
   * Get full battery capacity in mAh
   *
   * @returns Capacity
   */
  @nativeFunction(0x94F5A53F, 150)
  scePowerGetBatteryFullCapacity(): number
  {
    return 1800; // PSP-2000 battery
  }

  // ============================================
  // Clock Frequency Control
  // ============================================

  /**
   * scePowerSetClockFrequency
   * Set CPU and bus clock frequencies
   *
   * @param pllFreq - PLL frequency (usually same as CPU)
   * @param cpuFreq - CPU frequency
   * @param busFreq - Bus frequency
   * @returns 0 on success
   */
  @nativeFunction(0x737486F2, 150)
  scePowerSetClockFrequency(): number
  {
    const pllFreq = this.ctx.arg(0);
    const cpuFreq = this.ctx.arg(1);
    const busFreq = this.ctx.arg(2);

    if (cpuFreq < 1 || cpuFreq > MAX_CPU_CLOCK)
    {
      return SceKernelErrors.ERROR_INVALID_VALUE;
    }
    if (busFreq < 1 || busFreq > MAX_BUS_CLOCK)
    {
      return SceKernelErrors.ERROR_INVALID_VALUE;
    }

    this.cpuClock = cpuFreq;
    this.busClock = busFreq;

    this.ctx.log(`scePowerSetClockFrequency(${pllFreq}, ${cpuFreq}, ${busFreq})`);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * scePowerSetCpuClockFrequency
   * Set CPU clock frequency
   *
   * @param freq - Frequency in MHz
   * @returns 0 on success
   */
  @nativeFunction(0x843FBF43, 150)
  scePowerSetCpuClockFrequency(): number
  {
    const freq = this.ctx.arg(0);

    if (freq < 1 || freq > MAX_CPU_CLOCK)
    {
      return SceKernelErrors.ERROR_INVALID_VALUE;
    }

    this.cpuClock = freq;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * scePowerSetBusClockFrequency
   * Set bus clock frequency
   *
   * @param freq - Frequency in MHz
   * @returns 0 on success
   */
  @nativeFunction(0xB8D7B3FB, 150)
  scePowerSetBusClockFrequency(): number
  {
    const freq = this.ctx.arg(0);

    if (freq < 1 || freq > MAX_BUS_CLOCK)
    {
      return SceKernelErrors.ERROR_INVALID_VALUE;
    }

    this.busClock = freq;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * scePowerGetCpuClockFrequency
   * Get current CPU clock frequency
   *
   * @returns CPU frequency in MHz
   */
  @nativeFunction(0xFEE03A2F, 150)
  scePowerGetCpuClockFrequency(): number
  {
    return this.cpuClock;
  }

  /**
   * scePowerGetCpuClockFrequencyInt
   * Get current CPU clock frequency (int version)
   *
   * @returns CPU frequency in MHz
   */
  @nativeFunction(0xFDB5BFE9, 150)
  scePowerGetCpuClockFrequencyInt(): number
  {
    return this.cpuClock;
  }

  /**
   * scePowerGetCpuClockFrequencyFloat
   * Get current CPU clock frequency (float version)
   *
   * @returns CPU frequency in MHz
   */
  @nativeFunction(0xB1A52C83, 150)
  scePowerGetCpuClockFrequencyFloat(): number
  {
    // Return as IEEE 754 float bits
    const buf = new ArrayBuffer(4);
    new Float32Array(buf)[0] = this.cpuClock;
    return new Uint32Array(buf)[0];
  }

  /**
   * scePowerGetBusClockFrequency
   * Get current bus clock frequency
   *
   * @returns Bus frequency in MHz
   */
  @nativeFunction(0x478FE6F5, 150)
  scePowerGetBusClockFrequency(): number
  {
    return this.busClock;
  }

  /**
   * scePowerGetBusClockFrequencyInt
   * Get current bus clock frequency (int version)
   *
   * @returns Bus frequency in MHz
   */
  @nativeFunction(0xBD681969, 150)
  scePowerGetBusClockFrequencyInt(): number
  {
    return this.busClock;
  }

  /**
   * scePowerGetBusClockFrequencyFloat
   * Get current bus clock frequency (float version)
   *
   * @returns Bus frequency in MHz
   */
  @nativeFunction(0x9BADB3EB, 150)
  scePowerGetBusClockFrequencyFloat(): number
  {
    const buf = new ArrayBuffer(4);
    new Float32Array(buf)[0] = this.busClock;
    return new Uint32Array(buf)[0];
  }

  /**
   * scePowerGetPllClockFrequencyInt
   * Get PLL clock frequency
   *
   * @returns PLL frequency (same as CPU)
   */
  @nativeFunction(0x34F9C463, 150)
  scePowerGetPllClockFrequencyInt(): number
  {
    return this.cpuClock;
  }

  /**
   * scePowerGetPllClockFrequencyFloat
   * Get PLL clock frequency (float)
   *
   * @returns PLL frequency
   */
  @nativeFunction(0xEA382A27, 150)
  scePowerGetPllClockFrequencyFloat(): number
  {
    const buf = new ArrayBuffer(4);
    new Float32Array(buf)[0] = this.cpuClock;
    return new Uint32Array(buf)[0];
  }

  // ============================================
  // Power Callbacks
  // ============================================

  /**
   * scePowerRegisterCallback
   * Register a power callback
   *
   * @param slot - Callback slot (0-15)
   * @param cbid - Callback ID
   * @returns 0 on success
   */
  @nativeFunction(0x04B7766E, 150)
  scePowerRegisterCallback(): number
  {
    const slot = this.ctx.arg(0);
    const cbid = this.ctx.arg(1);

    if (slot < 0 || slot > 15)
    {
      return SceKernelErrors.ERROR_INVALID_INDEX;
    }

    this.callbacks.set(slot, cbid);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * scePowerUnregisterCallback
   * Unregister a power callback
   *
   * @param slot - Callback slot
   * @returns 0 on success
   */
  @nativeFunction(0xDFA8BAF8, 150)
  scePowerUnregisterCallback(): number
  {
    const slot = this.ctx.arg(0);

    if (!this.callbacks.has(slot))
    {
      return SceKernelErrors.ERROR_INVALID_INDEX;
    }

    this.callbacks.delete(slot);
    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Power State Control
  // ============================================

  /**
   * scePowerLock
   * Lock power switch
   *
   * @param unknown - Unknown parameter
   * @returns 0 on success
   */
  @nativeFunction(0xD6D016EF, 150)
  scePowerLock(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * scePowerUnlock
   * Unlock power switch
   *
   * @param unknown - Unknown parameter
   * @returns 0 on success
   */
  @nativeFunction(0xCA3D34C1, 150)
  scePowerUnlock(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * scePowerTick
   * Prevent auto-suspend
   *
   * @param type - Tick type
   * @returns 0 on success
   */
  @nativeFunction(0xEFD3C963, 150)
  scePowerTick(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * scePowerGetIdleTimer
   * Get idle timer value
   *
   * @returns Idle timer
   */
  @nativeFunction(0xDB62C9CF, 150)
  scePowerGetIdleTimer(): number
  {
    return 0;
  }

  /**
   * scePowerIdleTimerEnable
   * Enable idle timer
   *
   * @param unknown - Unknown
   * @returns 0 on success
   */
  @nativeFunction(0x7F30B3B1, 150)
  scePowerIdleTimerEnable(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * scePowerIdleTimerDisable
   * Disable idle timer
   *
   * @param unknown - Unknown
   * @returns 0 on success
   */
  @nativeFunction(0x972CE941, 150)
  scePowerIdleTimerDisable(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * scePowerIsLowBattery
   * Check if suspend is required
   *
   * @returns 0 (never required in emulator)
   */
  @nativeFunction(0x27F3292C, 150)
  scePowerIsSuspendRequired(): number
  {
    return 0;
  }

  /**
   * scePowerRequestStandby
   * Request standby mode
   *
   * @returns 0 on success (no-op in emulator)
   */
  @nativeFunction(0x2B7C7CF4, 150)
  scePowerRequestStandby(): number
  {
    this.ctx.log('scePowerRequestStandby - ignored');
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * scePowerRequestSuspend
   * Request suspend mode
   *
   * @returns 0 on success (no-op in emulator)
   */
  @nativeFunction(0xAC32C9CC, 150)
  scePowerRequestSuspend(): number
  {
    this.ctx.log('scePowerRequestSuspend - ignored');
    return SceKernelErrors.ERROR_OK;
  }
}
