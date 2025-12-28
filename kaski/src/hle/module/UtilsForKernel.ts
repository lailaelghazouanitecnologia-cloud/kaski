/**
 * UtilsForKernel
 *
 * Kernel utility functions.
 * Provides cache invalidation and other kernel utilities.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

@hleModule('UtilsForKernel')
export class UtilsForKernel
{
  readonly name = 'UtilsForKernel';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  /**
   * sceKernelIcacheInvalidateRange
   * Invalidate instruction cache range
   *
   * @param address - Start address
   * @param size - Size in bytes
   */
  @nativeFunction(0xC2DF770E, 150)
  sceKernelIcacheInvalidateRange(): void
  {
    // No-op in emulator - we don't cache instructions
  }

  /**
   * sceKernelDcacheInvalidateRange
   * Invalidate data cache range
   *
   * @param address - Start address
   * @param size - Size in bytes
   */
  @nativeFunction(0xBFA98062, 150)
  sceKernelDcacheInvalidateRange(): void
  {
    // No-op in emulator
  }

  /**
   * sceKernelIcacheInvalidateAll
   * Invalidate entire instruction cache
   */
  @nativeFunction(0x920F104A, 150)
  sceKernelIcacheInvalidateAll(): void
  {
    // No-op in emulator
  }

  /**
   * sceKernelDcacheWritebackAll
   * Write back entire data cache
   */
  @nativeFunction(0x79D1C3FA, 150)
  sceKernelDcacheWritebackAll(): void
  {
    // No-op in emulator
  }

  /**
   * sceKernelDcacheWritebackInvalidateAll
   * Write back and invalidate entire data cache
   */
  @nativeFunction(0xB435DEC5, 150)
  sceKernelDcacheWritebackInvalidateAll(): void
  {
    // No-op in emulator
  }

  /**
   * sceKernelDcacheWritebackRange
   * Write back data cache range
   *
   * @param address - Start address
   * @param size - Size in bytes
   */
  @nativeFunction(0x3EE30821, 150)
  sceKernelDcacheWritebackRange(): void
  {
    // No-op in emulator
  }

  /**
   * sceKernelDcacheWritebackInvalidateRange
   * Write back and invalidate data cache range
   *
   * @param address - Start address
   * @param size - Size in bytes
   */
  @nativeFunction(0x34B9FA9E, 150)
  sceKernelDcacheWritebackInvalidateRange(): void
  {
    // No-op in emulator
  }
}
