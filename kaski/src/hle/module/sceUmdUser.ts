/**
 * sceUmdUser
 *
 * UMD (Universal Media Disc) access.
 * Handles disc detection, activation, and callbacks.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * UMD check medium result
 */
export const enum UmdCheckMedium
{
  NoDisc = 0,
  Inserted = 1,
}

/**
 * UMD state flags
 */
export const enum PspUmdState
{
  Init = 0x00,
  NotPresent = 0x01,
  Present = 0x02,
  Changed = 0x04,
  NotReady = 0x08,
  Ready = 0x10,
  Readable = 0x20,
}

@hleModule('sceUmdUser')
export class sceUmdUser
{
  readonly name = 'sceUmdUser';

  private ctx!: EmulatorContext;

  // Registered callbacks
  private callbackIds: number[] = [];

  // Current UMD state (always ready in emulator)
  private umdState: number = PspUmdState.Present | PspUmdState.Ready | PspUmdState.Readable;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
    this.callbackIds = [];
  }

  // ============================================
  // Callbacks
  // ============================================

  /**
   * sceUmdRegisterUMDCallBack
   * Register a UMD callback
   *
   * @param callbackId - Callback ID
   * @returns 0 on success
   */
  @nativeFunction(0xAEE7404D, 150)
  sceUmdRegisterUMDCallBack(): number
  {
    const callbackId = this.ctx.arg(0);

    if (!this.callbackIds.includes(callbackId))
    {
      this.callbackIds.push(callbackId);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUmdUnRegisterUMDCallBack
   * Unregister a UMD callback
   *
   * @param callbackId - Callback ID
   * @returns 0 on success
   */
  @nativeFunction(0xBD2BDE07, 150)
  sceUmdUnRegisterUMDCallBack(): number
  {
    const callbackId = this.ctx.arg(0);

    const index = this.callbackIds.indexOf(callbackId);
    if (index < 0)
    {
      return SceKernelErrors.ERROR_ERRNO_INVALID_ARGUMENT;
    }

    this.callbackIds.splice(index, 1);

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Disc Detection
  // ============================================

  /**
   * sceUmdCheckMedium
   * Check if UMD is inserted
   *
   * @returns 1 if inserted, 0 if not
   */
  @nativeFunction(0x46EBB729, 150)
  sceUmdCheckMedium(): number
  {
    // Always inserted in emulator
    return UmdCheckMedium.Inserted;
  }

  /**
   * sceUmdGetDriveStat
   * Get current UMD drive state
   *
   * @returns State flags
   */
  @nativeFunction(0x6B4A146C, 150)
  sceUmdGetDriveStat(): number
  {
    return this.umdState;
  }

  // ============================================
  // Activation
  // ============================================

  /**
   * sceUmdActivate
   * Activate the UMD drive
   *
   * @param mode - Activation mode
   * @param drivePtr - Drive name (e.g., "disc0:")
   * @returns 0 on success
   */
  @nativeFunction(0xC6183D47, 150)
  sceUmdActivate(): number
  {
    const mode = this.ctx.arg(0);
    const drivePtr = this.ctx.argPtr(1);

    const drive = this.ctx.readString(drivePtr);
    this.ctx.log(`sceUmdActivate(${mode}, "${drive}")`);

    // Notify callbacks
    this.notifyCallbacks(this.umdState);

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUmdDeactivate
   * Deactivate the UMD drive
   *
   * @param mode - Deactivation mode
   * @param drivePtr - Drive name
   * @returns 0 on success
   */
  @nativeFunction(0xE83742BA, 150)
  sceUmdDeactivate(): number
  {
    const mode = this.ctx.arg(0);
    const drivePtr = this.ctx.argPtr(1);

    const drive = this.ctx.readString(drivePtr);
    this.ctx.log(`sceUmdDeactivate(${mode}, "${drive}")`);

    // Notify callbacks
    this.notifyCallbacks(this.umdState);

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Wait Functions
  // ============================================

  /**
   * sceUmdWaitDriveStat
   * Wait for drive state (non-callback)
   *
   * @param state - State to wait for
   * @returns 0 on success
   */
  @nativeFunction(0x8EF08FCE, 150)
  sceUmdWaitDriveStat(): number
  {
    const state = this.ctx.arg(0);

    // Already in the requested state
    if ((this.umdState & state) !== 0)
    {
      return SceKernelErrors.ERROR_OK;
    }

    // In emulator, we're always ready
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUmdWaitDriveStatCB
   * Wait for drive state (with callbacks)
   *
   * @param state - State to wait for
   * @param timeout - Timeout in microseconds
   * @returns 0 on success
   */
  @nativeFunction(0x4A9E5E29, 150)
  sceUmdWaitDriveStatCB(): number
  {
    const state = this.ctx.arg(0);
    const timeout = this.ctx.arg(1);

    // Execute pending callbacks
    this.ctx.callbackManager.executePending();

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUmdWaitDriveStatWithTimer
   * Wait for drive state with timeout
   *
   * @param state - State to wait for
   * @param timeout - Timeout in microseconds
   * @returns 0 on success
   */
  @nativeFunction(0x56202973, 150)
  sceUmdWaitDriveStatWithTimer(): number | Promise<number>
  {
    const state = this.ctx.arg(0);
    const timeout = this.ctx.arg(1);

    // Already ready
    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Error Handling
  // ============================================

  /**
   * sceUmdGetErrorStat
   * Get UMD error status
   *
   * @returns Error code (0 = no error)
   */
  @nativeFunction(0x20628E6F, 150)
  sceUmdGetErrorStat(): number
  {
    // No errors in emulator
    return 0;
  }

  // ============================================
  // Helper Methods
  // ============================================

  private notifyCallbacks(data: number): void
  {
    for (const callbackId of this.callbackIds)
    {
      this.ctx.callbackManager.notify(callbackId, data);
    }
  }
}
