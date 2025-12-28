/**
 * KDebugForKernel
 *
 * Kernel debug module.
 * Provides kernel-level debugging functions.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

@hleModule('KDebugForKernel')
export class KDebugForKernel
{
  readonly name = 'KDebugForKernel';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  /**
   * Kprintf
   * Kernel printf
   *
   * @param format - Format string
   */
  @nativeFunction(0x84F370BC, 150)
  Kprintf(): number
  {
    const formatPtr = this.ctx.argPtr(0);
    if (formatPtr)
    {
      const format = this.ctx.readStringZ(formatPtr);
      console.log(`[Kprintf] ${format}`);
    }
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelDprintf
   * Kernel debug printf
   *
   * @param format - Format string
   */
  @nativeFunction(0x5CE9838B, 150)
  sceKernelDprintf(): number
  {
    const formatPtr = this.ctx.argPtr(0);
    if (formatPtr)
    {
      const format = this.ctx.readStringZ(formatPtr);
      console.log(`[Dprintf] ${format}`);
    }
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelGetDebugPutchar
   * Get debug putchar function
   *
   * @returns Function pointer
   */
  @nativeFunction(0xE146606D, 150)
  sceKernelGetDebugPutchar(): number
  {
    return 0;
  }

  /**
   * sceKernelRegisterDebugPutchar
   * Register debug putchar function
   *
   * @returns 0 on success
   */
  @nativeFunction(0x7CEB2C09, 150)
  sceKernelRegisterDebugPutchar(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelRegisterKprintfHandler
   * Register kprintf handler
   *
   * @returns 0 on success
   */
  @nativeFunction(0x5BA33B4C, 150)
  sceKernelRegisterKprintfHandler(): number
  {
    return SceKernelErrors.ERROR_OK;
  }
}
