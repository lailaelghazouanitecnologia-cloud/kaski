/**
 * sceSuspendForUser
 *
 * Suspend/resume and power tick functions.
 * Controls system sleep behavior.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

@hleModule('sceSuspendForUser')
export class sceSuspendForUser
{
  readonly name = 'sceSuspendForUser';

  private ctx!: EmulatorContext;

  // Power lock count
  private lockCount = 0;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
    this.lockCount = 0;
  }

  /**
   * sceKernelPowerLock
   * Lock power to prevent suspend
   *
   * @param lockType - Lock type (must be 0)
   * @returns 0 on success
   */
  @nativeFunction(0xEADB1BD7, 150)
  sceKernelPowerLock(): number
  {
    const lockType = this.ctx.arg(0);

    if (lockType !== 0)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }

    this.lockCount++;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelPowerUnlock
   * Unlock power to allow suspend
   *
   * @param lockType - Lock type (must be 0)
   * @returns 0 on success
   */
  @nativeFunction(0x3AEE7261, 150)
  sceKernelPowerUnlock(): number
  {
    const lockType = this.ctx.arg(0);

    if (lockType !== 0)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }

    if (this.lockCount > 0)
    {
      this.lockCount--;
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelPowerTick
   * Reset the idle timer to prevent auto-suspend
   *
   * @param type - Tick type (0=all, 1=suspend, 2=display)
   * @returns 0 on success
   */
  @nativeFunction(0x090CCB3F, 150)
  sceKernelPowerTick(): number
  {
    // Reset idle timer - no-op in emulator
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelVolatileMemLock
   * Lock volatile memory
   *
   * @param unk - Unknown
   * @param ptrPtr - Output pointer
   * @param sizePtr - Output size
   * @returns 0 on success
   */
  @nativeFunction(0x3E0271D3, 150)
  sceKernelVolatileMemLock(): number
  {
    const unk = this.ctx.arg(0);
    const ptrPtr = this.ctx.argPtr(1);
    const sizePtr = this.ctx.argPtr(2);

    // Return a fake volatile memory region
    if (ptrPtr)
    {
      this.ctx.write32(ptrPtr, 0x08400000); // Fake address
    }
    if (sizePtr)
    {
      this.ctx.write32(sizePtr, 0x400000); // 4MB
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelVolatileMemTryLock
   * Try to lock volatile memory (non-blocking)
   */
  @nativeFunction(0xA14F40B2, 150)
  sceKernelVolatileMemTryLock(): number
  {
    const unk = this.ctx.arg(0);
    const ptrPtr = this.ctx.argPtr(1);
    const sizePtr = this.ctx.argPtr(2);

    if (ptrPtr)
    {
      this.ctx.write32(ptrPtr, 0x08400000);
    }
    if (sizePtr)
    {
      this.ctx.write32(sizePtr, 0x400000);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelVolatileMemUnlock
   * Unlock volatile memory
   */
  @nativeFunction(0xA569E425, 150)
  sceKernelVolatileMemUnlock(): number
  {
    return SceKernelErrors.ERROR_OK;
  }
}
