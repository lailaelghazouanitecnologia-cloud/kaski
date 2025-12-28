/**
 * ExceptionManagerForKernel
 *
 * Kernel exception handling module.
 * Manages CPU exception handlers.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

@hleModule('ExceptionManagerForKernel')
export class ExceptionManagerForKernel
{
  readonly name = 'ExceptionManagerForKernel';

  private ctx!: EmulatorContext;
  private defaultExceptionHandler: number = 0;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
    this.defaultExceptionHandler = 0;
  }

  /**
   * sceKernelRegisterDefaultExceptionHandler
   * Register default exception handler
   *
   * @param handler - Exception handler function pointer
   * @returns 0 on success
   */
  @nativeFunction(0x565C0B0E, 150)
  sceKernelRegisterDefaultExceptionHandler(): number
  {
    const handler = this.ctx.arg(0);
    this.defaultExceptionHandler = handler;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelRegisterPriorityExceptionHandler
   * Register priority exception handler
   *
   * @returns 0 on success
   */
  @nativeFunction(0x1AA6CFFA, 150)
  sceKernelRegisterPriorityExceptionHandler(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelReleaseExceptionHandler
   * Release exception handler
   *
   * @returns 0 on success
   */
  @nativeFunction(0xDF83875E, 150)
  sceKernelReleaseExceptionHandler(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelGetActiveDefaultExceptionHandler
   * Get active default exception handler
   *
   * @returns Handler address
   */
  @nativeFunction(0x0C5F0202, 150)
  sceKernelGetActiveDefaultExceptionHandler(): number
  {
    return this.defaultExceptionHandler;
  }
}
