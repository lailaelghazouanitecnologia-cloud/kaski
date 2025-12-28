/**
 * sceLibFont
 *
 * Font library module.
 * Provides font loading and rendering.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * Font library instance
 */
interface FontLib
{
  id: number;
  horizontalRes: number;
  verticalRes: number;
}

/**
 * Font instance
 */
interface Font
{
  id: number;
  libId: number;
}

@hleModule('sceLibFont')
export class sceLibFont
{
  readonly name = 'sceLibFont';

  private ctx!: EmulatorContext;

  // Font libraries and fonts
  private nextLibId = 1;
  private nextFontId = 1;
  private fontLibs: Map<number, FontLib> = new Map();
  private fonts: Map<number, Font> = new Map();

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
    this.fontLibs.clear();
    this.fonts.clear();
    this.nextLibId = 1;
    this.nextFontId = 1;
  }

  /**
   * sceFontNewLib
   * Create a new font library
   *
   * @param paramsPtr - Font library parameters
   * @param errorCodePtr - Output error code
   * @returns Font library handle
   */
  @nativeFunction(0x67F17ED7, 150)
  sceFontNewLib(): number
  {
    const paramsPtr = this.ctx.argPtr(0);
    const errorCodePtr = this.ctx.argPtr(1);

    const libId = this.nextLibId++;
    this.fontLibs.set(libId, {
      id: libId,
      horizontalRes: 128.0,
      verticalRes: 128.0,
    });

    if (errorCodePtr)
    {
      this.ctx.write32(errorCodePtr, 0);
    }

    return libId;
  }

  /**
   * sceFontDoneLib
   * Release a font library
   *
   * @param fontLibId - Font library handle
   * @returns 0 on success
   */
  @nativeFunction(0x574B6FBC, 150)
  sceFontDoneLib(): number
  {
    const fontLibId = this.ctx.arg(0);

    this.fontLibs.delete(fontLibId);

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceFontFindOptimumFont
   * Find optimum font
   *
   * @param fontLibId - Font library handle
   * @param fontStylePtr - Font style to match
   * @param errorCodePtr - Output error code
   * @returns Font index
   */
  @nativeFunction(0x099EF33C, 150)
  sceFontFindOptimumFont(): number
  {
    const fontLibId = this.ctx.arg(0);
    const fontStylePtr = this.ctx.argPtr(1);
    const errorCodePtr = this.ctx.argPtr(2);

    if (errorCodePtr)
    {
      this.ctx.write32(errorCodePtr, 0);
    }

    // Return font index 0
    return 0;
  }

  /**
   * sceFontFindFont
   * Find font by style
   *
   * @param fontLibId - Font library handle
   * @param fontStylePtr - Font style
   * @param errorCodePtr - Output error code
   * @returns Font index
   */
  @nativeFunction(0x681E61A7, 150)
  sceFontFindFont(): number
  {
    const fontLibId = this.ctx.arg(0);
    const fontStylePtr = this.ctx.argPtr(1);
    const errorCodePtr = this.ctx.argPtr(2);

    if (errorCodePtr)
    {
      this.ctx.write32(errorCodePtr, 0);
    }

    return 0;
  }

  /**
   * sceFontOpen
   * Open a font
   *
   * @param fontLibId - Font library handle
   * @param index - Font index
   * @param mode - Open mode
   * @param errorCodePtr - Output error code
   * @returns Font handle
   */
  @nativeFunction(0xA834319D, 150)
  sceFontOpen(): number
  {
    const fontLibId = this.ctx.arg(0);
    const index = this.ctx.arg(1);
    const mode = this.ctx.arg(2);
    const errorCodePtr = this.ctx.argPtr(3);

    const fontId = this.nextFontId++;
    this.fonts.set(fontId, {
      id: fontId,
      libId: fontLibId,
    });

    if (errorCodePtr)
    {
      this.ctx.write32(errorCodePtr, 0);
    }

    return fontId;
  }

  /**
   * sceFontOpenUserFile
   * Open a font from file
   */
  @nativeFunction(0x57FCB733, 150)
  sceFontOpenUserFile(): number
  {
    const fontLibId = this.ctx.arg(0);
    const fileNamePtr = this.ctx.argPtr(1);
    const mode = this.ctx.arg(2);
    const errorCodePtr = this.ctx.argPtr(3);

    const fontId = this.nextFontId++;
    this.fonts.set(fontId, {
      id: fontId,
      libId: fontLibId,
    });

    if (errorCodePtr)
    {
      this.ctx.write32(errorCodePtr, 0);
    }

    return fontId;
  }

  /**
   * sceFontOpenUserMemory
   * Open a font from memory
   */
  @nativeFunction(0xBB8E7FE6, 150)
  sceFontOpenUserMemory(): number
  {
    const fontLibId = this.ctx.arg(0);
    const memoryPtr = this.ctx.argPtr(1);
    const memorySize = this.ctx.arg(2);
    const errorCodePtr = this.ctx.argPtr(3);

    const fontId = this.nextFontId++;
    this.fonts.set(fontId, {
      id: fontId,
      libId: fontLibId,
    });

    if (errorCodePtr)
    {
      this.ctx.write32(errorCodePtr, 0);
    }

    return fontId;
  }

  /**
   * sceFontClose
   * Close a font
   *
   * @param fontId - Font handle
   * @returns 0 on success
   */
  @nativeFunction(0x3AEA8CB6, 150)
  sceFontClose(): number
  {
    const fontId = this.ctx.arg(0);

    this.fonts.delete(fontId);

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceFontGetFontInfo
   * Get font info
   *
   * @param fontId - Font handle
   * @param fontInfoPtr - Output font info
   * @returns 0 on success
   */
  @nativeFunction(0x0DA7535E, 150)
  sceFontGetFontInfo(): number
  {
    const fontId = this.ctx.arg(0);
    const fontInfoPtr = this.ctx.argPtr(1);

    // Write stub font info (all zeros for now)
    if (fontInfoPtr)
    {
      for (let i = 0; i < 264; i++) // FontInfo struct size
      {
        this.ctx.write8(fontInfoPtr + i, 0);
      }
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceFontSetResolution
   * Set font resolution
   *
   * @param fontLibId - Font library handle
   * @param hRes - Horizontal resolution
   * @param vRes - Vertical resolution
   * @returns 0 on success
   */
  @nativeFunction(0x48293280, 150)
  sceFontSetResolution(): number
  {
    const fontLibId = this.ctx.arg(0);
    // hRes and vRes are floats in registers

    const lib = this.fontLibs.get(fontLibId);
    if (lib)
    {
      // Would need to read float args properly
      lib.horizontalRes = 128.0;
      lib.verticalRes = 128.0;
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceFontGetNumFontList
   * Get number of fonts
   *
   * @param fontLibId - Font library handle
   * @param errorCodePtr - Output error code
   * @returns Number of fonts
   */
  @nativeFunction(0x27F6E642, 150)
  sceFontGetNumFontList(): number
  {
    const fontLibId = this.ctx.arg(0);
    const errorCodePtr = this.ctx.argPtr(1);

    if (errorCodePtr)
    {
      this.ctx.write32(errorCodePtr, 0);
    }

    // Return 1 font available
    return 1;
  }

  /**
   * sceFontGetFontList
   * Get font list
   *
   * @param fontLibId - Font library handle
   * @param fontStylePtr - Output font styles
   * @param numFonts - Number of fonts to get
   * @returns Number of fonts returned
   */
  @nativeFunction(0xBC75D85B, 150)
  sceFontGetFontList(): number
  {
    const fontLibId = this.ctx.arg(0);
    const fontStylePtr = this.ctx.argPtr(1);
    const numFonts = this.ctx.arg(2);

    // Return 0 fonts for now
    return 0;
  }

  /**
   * sceFontGetCharInfo
   * Get character info
   */
  @nativeFunction(0xDCC80C2F, 150)
  sceFontGetCharInfo(): number
  {
    const fontId = this.ctx.arg(0);
    const charCode = this.ctx.arg(1);
    const charInfoPtr = this.ctx.argPtr(2);

    // Zero out char info
    if (charInfoPtr)
    {
      for (let i = 0; i < 60; i++)
      {
        this.ctx.write8(charInfoPtr + i, 0);
      }
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceFontGetCharGlyphImage
   * Get character glyph image
   */
  @nativeFunction(0x980F4895, 150)
  sceFontGetCharGlyphImage(): number
  {
    // Stub - return success but don't draw anything
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceFontGetCharGlyphImage_Clip
   * Get character glyph image with clipping
   */
  @nativeFunction(0xCA1E6945, 150)
  sceFontGetCharGlyphImage_Clip(): number
  {
    return SceKernelErrors.ERROR_OK;
  }
}
