/**
 * sceDmac
 *
 * DMA Controller module.
 * Provides hardware-accelerated memory copy.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

@hleModule('sceDmac')
export class sceDmac
{
  readonly name = 'sceDmac';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  /**
   * Internal memcpy implementation
   */
  private dmacMemcpy(destination: number, source: number, size: number): number | Promise<number>
  {
    if (size === 0)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }

    if (destination === 0 || source === 0)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ADDR;
    }

    // Perform the copy
    this.ctx.memory.copy(source, destination, size);

    // For large copies, simulate async behavior
    if (size >= 272)
    {
      return Promise.resolve(SceKernelErrors.ERROR_OK);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceDmacMemcpy
   * Copy memory using DMA (may block for large copies)
   *
   * @param destination - Destination address
   * @param source - Source address
   * @param size - Number of bytes
   * @returns 0 on success
   */
  @nativeFunction(0x617F3FE6, 150)
  sceDmacMemcpy(): number | Promise<number>
  {
    const destination = this.ctx.arg(0);
    const source = this.ctx.arg(1);
    const size = this.ctx.arg(2);

    return this.dmacMemcpy(destination, source, size);
  }

  /**
   * sceDmacTryMemcpy
   * Try to copy memory using DMA (non-blocking)
   *
   * @param destination - Destination address
   * @param source - Source address
   * @param size - Number of bytes
   * @returns 0 on success
   */
  @nativeFunction(0xD97F94D8, 150)
  sceDmacTryMemcpy(): number | Promise<number>
  {
    const destination = this.ctx.arg(0);
    const source = this.ctx.arg(1);
    const size = this.ctx.arg(2);

    return this.dmacMemcpy(destination, source, size);
  }
}
