/**
 * sceUtility
 *
 * System utility dialogs and services.
 * Provides save data, message dialogs, OSK, and module loading.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * Dialog status
 */
export const enum DialogStatus
{
  None = 0,
  Init = 1,
  Running = 2,
  Finished = 3,
  Shutdown = 4,
}

/**
 * Dialog result
 */
export const enum DialogResult
{
  None = 0,
  OK = 1,
  Cancel = 2,
  Abort = 3,
}

/**
 * System parameter IDs
 */
export const enum SystemParamId
{
  StringNickname = 1,
  AdhocChannel = 2,
  WlanPowerSave = 3,
  DateFormat = 4,
  TimeFormat = 5,
  Timezone = 6,
  DaylightSavings = 7,
  Language = 8,
  Unknown = 9,
}

/**
 * Languages
 */
export const enum Language
{
  Japanese = 0,
  English = 1,
  French = 2,
  Spanish = 3,
  German = 4,
  Italian = 5,
  Dutch = 6,
  Portuguese = 7,
  Russian = 8,
  Korean = 9,
  ChineseTraditional = 10,
  ChineseSimplified = 11,
}

@hleModule('sceUtility')
export class sceUtility
{
  readonly name = 'sceUtility';

  private ctx!: EmulatorContext;

  // Dialog states
  private savedataStatus: DialogStatus = DialogStatus.None;
  private msgDialogStatus: DialogStatus = DialogStatus.None;
  private oskStatus: DialogStatus = DialogStatus.None;
  private netconfStatus: DialogStatus = DialogStatus.None;

  // Dialog results
  private msgDialogResult: DialogResult = DialogResult.None;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  // ============================================
  // System Parameters
  // ============================================

  /**
   * sceUtilityGetSystemParamInt
   * Get integer system parameter
   *
   * @param id - Parameter ID
   * @param valuePtr - Output value
   * @returns 0 on success
   */
  @nativeFunction(0xA5DA2406, 150)
  sceUtilityGetSystemParamInt(): number
  {
    const id = this.ctx.arg(0) as SystemParamId;
    const valuePtr = this.ctx.argPtr(1);

    let value = 0;

    switch (id)
    {
      case SystemParamId.AdhocChannel:
        value = 0; // Auto
        break;
      case SystemParamId.WlanPowerSave:
        value = 1; // On
        break;
      case SystemParamId.DateFormat:
        value = 1; // MM/DD/YYYY
        break;
      case SystemParamId.TimeFormat:
        value = 0; // 12-hour
        break;
      case SystemParamId.Timezone:
        value = 0; // UTC
        break;
      case SystemParamId.DaylightSavings:
        value = 0; // Off
        break;
      case SystemParamId.Language:
        value = Language.English;
        break;
      default:
        return SceKernelErrors.ERROR_UTILITY_INVALID_SYSTEM_PARAM_ID;
    }

    this.ctx.write32(valuePtr, value);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUtilityGetSystemParamString
   * Get string system parameter
   *
   * @param id - Parameter ID
   * @param strPtr - Output string buffer
   * @param len - Buffer length
   * @returns 0 on success
   */
  @nativeFunction(0x34B78343, 150)
  sceUtilityGetSystemParamString(): number
  {
    const id = this.ctx.arg(0) as SystemParamId;
    const strPtr = this.ctx.argPtr(1);
    const len = this.ctx.arg(2);

    let str = '';

    switch (id)
    {
      case SystemParamId.StringNickname:
        str = 'Player';
        break;
      default:
        return SceKernelErrors.ERROR_UTILITY_INVALID_SYSTEM_PARAM_ID;
    }

    // Write string to buffer
    for (let i = 0; i < Math.min(str.length, len - 1); i++)
    {
      this.ctx.write8(strPtr + i, str.charCodeAt(i));
    }
    this.ctx.write8(strPtr + Math.min(str.length, len - 1), 0);

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Save Data Dialog
  // ============================================

  /**
   * sceUtilitySavedataInitStart
   * Initialize save data dialog
   *
   * @param paramsPtr - Parameters structure
   * @returns 0 on success
   */
  @nativeFunction(0x50C4CD57, 150)
  sceUtilitySavedataInitStart(): number
  {
    this.savedataStatus = DialogStatus.Init;
    // Immediately transition to finished (auto-accept)
    setTimeout(() =>
    {
      this.savedataStatus = DialogStatus.Finished;
    }, 100);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUtilitySavedataGetStatus
   * Get save data dialog status
   *
   * @returns Dialog status
   */
  @nativeFunction(0x8874DBE0, 150)
  sceUtilitySavedataGetStatus(): number
  {
    return this.savedataStatus;
  }

  /**
   * sceUtilitySavedataShutdownStart
   * Shutdown save data dialog
   *
   * @returns 0 on success
   */
  @nativeFunction(0x9790B33C, 150)
  sceUtilitySavedataShutdownStart(): number
  {
    this.savedataStatus = DialogStatus.Shutdown;
    setTimeout(() =>
    {
      this.savedataStatus = DialogStatus.None;
    }, 50);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUtilitySavedataUpdate
   * Update save data dialog
   *
   * @param unknown - Unknown parameter
   * @returns 0 on success
   */
  @nativeFunction(0xD4B95FFB, 150)
  sceUtilitySavedataUpdate(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Message Dialog
  // ============================================

  /**
   * sceUtilityMsgDialogInitStart
   * Initialize message dialog
   *
   * @param paramsPtr - Parameters structure
   * @returns 0 on success
   */
  @nativeFunction(0x2AD8E239, 150)
  sceUtilityMsgDialogInitStart(): number
  {
    this.msgDialogStatus = DialogStatus.Init;
    this.msgDialogResult = DialogResult.OK;
    // Auto-accept after short delay
    setTimeout(() =>
    {
      this.msgDialogStatus = DialogStatus.Finished;
    }, 100);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUtilityMsgDialogGetStatus
   * Get message dialog status
   *
   * @returns Dialog status
   */
  @nativeFunction(0x9A1C91D7, 150)
  sceUtilityMsgDialogGetStatus(): number
  {
    return this.msgDialogStatus;
  }

  /**
   * sceUtilityMsgDialogShutdownStart
   * Shutdown message dialog
   *
   * @returns 0 on success
   */
  @nativeFunction(0x67AF3428, 150)
  sceUtilityMsgDialogShutdownStart(): number
  {
    this.msgDialogStatus = DialogStatus.Shutdown;
    setTimeout(() =>
    {
      this.msgDialogStatus = DialogStatus.None;
    }, 50);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUtilityMsgDialogUpdate
   * Update message dialog
   *
   * @param n - Unknown
   * @returns 0 on success
   */
  @nativeFunction(0x95FC253B, 150)
  sceUtilityMsgDialogUpdate(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUtilityMsgDialogAbort
   * Abort message dialog
   *
   * @returns 0 on success
   */
  @nativeFunction(0x4928BD96, 150)
  sceUtilityMsgDialogAbort(): number
  {
    this.msgDialogResult = DialogResult.Abort;
    this.msgDialogStatus = DialogStatus.Finished;
    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // On-Screen Keyboard
  // ============================================

  /**
   * sceUtilityOskInitStart
   * Initialize OSK
   *
   * @param paramsPtr - Parameters
   * @returns 0 on success
   */
  @nativeFunction(0xF6269B82, 150)
  sceUtilityOskInitStart(): number
  {
    this.oskStatus = DialogStatus.Init;
    setTimeout(() =>
    {
      this.oskStatus = DialogStatus.Finished;
    }, 100);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUtilityOskGetStatus
   * Get OSK status
   *
   * @returns Dialog status
   */
  @nativeFunction(0x00D1B60A, 150)
  sceUtilityOskGetStatus(): number
  {
    return this.oskStatus;
  }

  /**
   * sceUtilityOskShutdownStart
   * Shutdown OSK
   *
   * @returns 0 on success
   */
  @nativeFunction(0x3DFAEBA9, 150)
  sceUtilityOskShutdownStart(): number
  {
    this.oskStatus = DialogStatus.Shutdown;
    setTimeout(() =>
    {
      this.oskStatus = DialogStatus.None;
    }, 50);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUtilityOskUpdate
   * Update OSK
   *
   * @param n - Unknown
   * @returns 0 on success
   */
  @nativeFunction(0x4B85C861, 150)
  sceUtilityOskUpdate(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Network Configuration
  // ============================================

  /**
   * sceUtilityNetconfInitStart
   * Initialize network configuration dialog
   *
   * @param paramsPtr - Parameters
   * @returns 0 on success
   */
  @nativeFunction(0x4DB1E739, 150)
  sceUtilityNetconfInitStart(): number
  {
    this.netconfStatus = DialogStatus.Init;
    setTimeout(() =>
    {
      this.netconfStatus = DialogStatus.Finished;
    }, 100);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUtilityNetconfGetStatus
   * Get network configuration dialog status
   *
   * @returns Dialog status
   */
  @nativeFunction(0x6332AA39, 150)
  sceUtilityNetconfGetStatus(): number
  {
    return this.netconfStatus;
  }

  /**
   * sceUtilityNetconfShutdownStart
   * Shutdown network configuration dialog
   *
   * @returns 0 on success
   */
  @nativeFunction(0xF88155F6, 150)
  sceUtilityNetconfShutdownStart(): number
  {
    this.netconfStatus = DialogStatus.Shutdown;
    setTimeout(() =>
    {
      this.netconfStatus = DialogStatus.None;
    }, 50);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUtilityNetconfUpdate
   * Update network configuration dialog
   *
   * @param n - Unknown
   * @returns 0 on success
   */
  @nativeFunction(0x91E70E35, 150)
  sceUtilityNetconfUpdate(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Module Loading
  // ============================================

  /**
   * sceUtilityLoadModule
   * Load a utility module
   *
   * @param module - Module ID
   * @returns 0 on success
   */
  @nativeFunction(0x2A2B3DE0, 150)
  sceUtilityLoadModule(): number
  {
    const module = this.ctx.arg(0);
    this.ctx.log(`sceUtilityLoadModule(${module})`);
    // Always succeed - modules are "built-in"
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUtilityUnloadModule
   * Unload a utility module
   *
   * @param module - Module ID
   * @returns 0 on success
   */
  @nativeFunction(0xE49BFE92, 150)
  sceUtilityUnloadModule(): number
  {
    const module = this.ctx.arg(0);
    this.ctx.log(`sceUtilityUnloadModule(${module})`);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUtilityLoadNetModule
   * Load a network module
   *
   * @param module - Module ID
   * @returns 0 on success
   */
  @nativeFunction(0x1579A159, 150)
  sceUtilityLoadNetModule(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUtilityUnloadNetModule
   * Unload a network module
   *
   * @param module - Module ID
   * @returns 0 on success
   */
  @nativeFunction(0x64D50C56, 150)
  sceUtilityUnloadNetModule(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUtilityLoadAvModule
   * Load an AV module
   *
   * @param module - Module ID
   * @returns 0 on success
   */
  @nativeFunction(0xC629AF26, 150)
  sceUtilityLoadAvModule(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUtilityUnloadAvModule
   * Unload an AV module
   *
   * @param module - Module ID
   * @returns 0 on success
   */
  @nativeFunction(0xF7D8D092, 150)
  sceUtilityUnloadAvModule(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUtilityLoadUsbModule
   * Load a USB module
   *
   * @param module - Module ID
   * @returns 0 on success
   */
  @nativeFunction(0x0D5BC6D2, 150)
  sceUtilityLoadUsbModule(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUtilityUnloadUsbModule
   * Unload a USB module
   *
   * @param module - Module ID
   * @returns 0 on success
   */
  @nativeFunction(0xF64910F0, 150)
  sceUtilityUnloadUsbModule(): number
  {
    return SceKernelErrors.ERROR_OK;
  }
}
