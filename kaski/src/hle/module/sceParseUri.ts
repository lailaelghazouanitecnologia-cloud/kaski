/**
 * sceParseUri
 *
 * URI parsing module.
 * Provides URI/URL parsing utilities.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

@hleModule('sceParseUri')
export class sceParseUri
{
  readonly name = 'sceParseUri';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  /**
   * sceUriEscape
   * Escape URI string
   *
   * @returns 0 on success
   */
  @nativeFunction(0x49E950EC, 150)
  sceUriEscape(): number
  {
    const outputPtr = this.ctx.argPtr(0);
    const outputSizePtr = this.ctx.argPtr(1);
    const inputPtr = this.ctx.argPtr(3);

    if (inputPtr && outputPtr)
    {
      const input = this.ctx.readStringZ(inputPtr);
      const escaped = encodeURIComponent(input);
      this.ctx.writeStringZ(outputPtr, escaped);

      if (outputSizePtr)
      {
        this.ctx.write32(outputSizePtr, escaped.length + 1);
      }
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUriUnescape
   * Unescape URI string
   *
   * @returns 0 on success
   */
  @nativeFunction(0x062BB07E, 150)
  sceUriUnescape(): number
  {
    const outputPtr = this.ctx.argPtr(0);
    const outputSizePtr = this.ctx.argPtr(1);
    const inputPtr = this.ctx.argPtr(3);

    if (inputPtr && outputPtr)
    {
      const input = this.ctx.readStringZ(inputPtr);
      try
      {
        const unescaped = decodeURIComponent(input);
        this.ctx.writeStringZ(outputPtr, unescaped);

        if (outputSizePtr)
        {
          this.ctx.write32(outputSizePtr, unescaped.length + 1);
        }
      }
      catch
      {
        // Invalid escape sequence, copy as-is
        this.ctx.writeStringZ(outputPtr, input);
        if (outputSizePtr)
        {
          this.ctx.write32(outputSizePtr, input.length + 1);
        }
      }
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUriParse
   * Parse URI
   *
   * @returns 0 on success
   */
  @nativeFunction(0x568518C9, 150)
  sceUriParse(): number
  {
    const resultPtr = this.ctx.argPtr(0);
    const uriPtr = this.ctx.argPtr(1);
    const workAreaPtr = this.ctx.argPtr(2);

    if (resultPtr)
    {
      // Clear result structure (64 bytes)
      for (let i = 0; i < 64; i++)
      {
        this.ctx.write8(resultPtr + i, 0);
      }
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceUriBuild
   * Build URI from components
   *
   * @returns 0 on success
   */
  @nativeFunction(0x7EE318AF, 150)
  sceUriBuild(): number
  {
    return SceKernelErrors.ERROR_OK;
  }
}
