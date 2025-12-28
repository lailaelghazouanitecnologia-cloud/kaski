/**
 * Kernel_Library
 *
 * Core kernel library functions.
 * Provides interrupt control and CPU locking.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

@hleModule('Kernel_Library')
export class Kernel_Library
{
  readonly name = 'Kernel_Library';

  private ctx!: EmulatorContext;

  // Interrupt state
  private interruptsEnabled: boolean = true;
  private interruptNestCount: number = 0;

  // CPU lock state
  private cpuLockCount: number = 0;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  // ============================================
  // Interrupt Control
  // ============================================

  /**
   * sceKernelCpuSuspendIntr
   * Disable interrupts and return previous state
   *
   * @returns Previous interrupt state
   */
  @nativeFunction(0x092968F4, 150)
  sceKernelCpuSuspendIntr(): number
  {
    const prevState = this.interruptsEnabled ? 1 : 0;
    this.interruptsEnabled = false;
    this.interruptNestCount++;
    return prevState;
  }

  /**
   * sceKernelCpuResumeIntr
   * Restore interrupt state
   *
   * @param state - State to restore
   * @returns void
   */
  @nativeFunction(0x5F10D406, 150)
  sceKernelCpuResumeIntr(): number
  {
    const state = this.ctx.arg(0);

    if (this.interruptNestCount > 0)
    {
      this.interruptNestCount--;
    }

    if (this.interruptNestCount === 0)
    {
      this.interruptsEnabled = state !== 0;
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelCpuResumeIntrWithSync
   * Restore interrupt state with sync
   *
   * @param state - State to restore
   * @returns void
   */
  @nativeFunction(0x3B84732D, 150)
  sceKernelCpuResumeIntrWithSync(): number
  {
    return this.sceKernelCpuResumeIntr();
  }

  /**
   * sceKernelIsCpuIntrEnable
   * Check if interrupts are enabled
   *
   * @returns 1 if enabled, 0 if disabled
   */
  @nativeFunction(0xB55249D2, 150)
  sceKernelIsCpuIntrEnable(): number
  {
    return this.interruptsEnabled ? 1 : 0;
  }

  /**
   * sceKernelIsCpuIntrSuspended
   * Check if interrupts are suspended
   *
   * @param state - State to check
   * @returns 1 if suspended, 0 otherwise
   */
  @nativeFunction(0xA089ECA4, 150)
  sceKernelIsCpuIntrSuspended(): number
  {
    const state = this.ctx.arg(0);
    return state === 0 ? 1 : 0;
  }

  // ============================================
  // CPU Lock
  // ============================================

  /**
   * sceKernelLockLwMutex
   * Lock a lightweight mutex
   *
   * @param mutexPtr - Mutex pointer
   * @param lockCount - Lock count
   * @param timeoutPtr - Timeout pointer
   * @returns 0 on success
   */
  @nativeFunction(0xBEA46419, 150)
  sceKernelLockLwMutex(): number
  {
    // Simplified: always succeed immediately
    // Real implementation would use proper mutex logic
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelLockLwMutexCB
   * Lock a lightweight mutex with callbacks
   */
  @nativeFunction(0x1FC64E09, 150)
  sceKernelLockLwMutexCB(): number
  {
    return this.sceKernelLockLwMutex();
  }

  /**
   * sceKernelTryLockLwMutex
   * Try to lock a lightweight mutex
   *
   * @param mutexPtr - Mutex pointer
   * @param lockCount - Lock count
   * @returns 0 on success, error if would block
   */
  @nativeFunction(0xDC692EE3, 150)
  sceKernelTryLockLwMutex(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelUnlockLwMutex
   * Unlock a lightweight mutex
   *
   * @param mutexPtr - Mutex pointer
   * @param unlockCount - Unlock count
   * @returns 0 on success
   */
  @nativeFunction(0x15B6446B, 150)
  sceKernelUnlockLwMutex(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelReferLwMutexStatus
   * Get lightweight mutex status
   *
   * @param mutexPtr - Mutex pointer
   * @param infoPtr - Output info structure
   * @returns 0 on success
   */
  @nativeFunction(0xC1734599, 150)
  sceKernelReferLwMutexStatus(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Memory Barriers
  // ============================================

  /**
   * sceKernelMemoryExtendSize
   * Extend memory size
   *
   * @returns 0 (stub)
   */
  @nativeFunction(0xD8B299AE, 150)
  sceKernelMemoryExtendSize(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelMemoryShrinkSize
   * Shrink memory size
   *
   * @returns 0 (stub)
   */
  @nativeFunction(0xEE7B8BD6, 150)
  sceKernelMemoryShrinkSize(): number
  {
    return SceKernelErrors.ERROR_OK;
  }
}
