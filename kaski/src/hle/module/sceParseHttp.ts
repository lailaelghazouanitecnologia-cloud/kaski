/**
 * sceParseHttp
 *
 * HTTP parsing module.
 * Provides HTTP header parsing utilities.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

@hleModule('sceParseHttp')
export class sceParseHttp
{
  readonly name = 'sceParseHttp';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  /**
   * sceParseHttpStatusLine
   * Parse HTTP status line
   *
   * @returns 0 on success
   */
  @nativeFunction(0x8077A433, 150)
  sceParseHttpStatusLine(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceParseHttpResponseHeader
   * Parse HTTP response header
   *
   * @returns 0 on success
   */
  @nativeFunction(0xAD7BFDEF, 150)
  sceParseHttpResponseHeader(): number
  {
    return SceKernelErrors.ERROR_OK;
  }
}
