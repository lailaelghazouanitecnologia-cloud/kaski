/**
 * Pixel Format
 *
 * PSP pixel format conversion and manipulation utilities.
 */

// ============================================
// Pixel Format Enum
// ============================================

export enum PixelFormat
{
  NONE = -1,
  RGBA_5650 = 0,
  RGBA_5551 = 1,
  RGBA_4444 = 2,
  RGBA_8888 = 3,
  PALETTE_T4 = 4,
  PALETTE_T8 = 5,
  PALETTE_T16 = 6,
  PALETTE_T32 = 7,
  COMPRESSED_DXT1 = 8,
  COMPRESSED_DXT3 = 9,
  COMPRESSED_DXT5 = 10,
}

// ============================================
// Size Table
// ============================================

const PIXEL_SIZES: number[] = [];
PIXEL_SIZES[PixelFormat.COMPRESSED_DXT1] = 0.5;
PIXEL_SIZES[PixelFormat.COMPRESSED_DXT3] = 1;
PIXEL_SIZES[PixelFormat.COMPRESSED_DXT5] = 1;
PIXEL_SIZES[PixelFormat.PALETTE_T16] = 2;
PIXEL_SIZES[PixelFormat.PALETTE_T32] = 4;
PIXEL_SIZES[PixelFormat.PALETTE_T8] = 1;
PIXEL_SIZES[PixelFormat.PALETTE_T4] = 0.5;
PIXEL_SIZES[PixelFormat.RGBA_4444] = 2;
PIXEL_SIZES[PixelFormat.RGBA_5551] = 2;
PIXEL_SIZES[PixelFormat.RGBA_5650] = 2;
PIXEL_SIZES[PixelFormat.RGBA_8888] = 4;

// ============================================
// Pixel Format Utilities
// ============================================

export class PixelFormatUtils
{
  static hasClut(pixelFormat: PixelFormat): boolean
  {
    return pixelFormat >= PixelFormat.PALETTE_T4 && pixelFormat <= PixelFormat.PALETTE_T32;
  }
}

// ============================================
// Bit Extraction Helpers
// ============================================

function extractScalei(value: number, offset: number, bits: number, scale: number): number
{
  const mask = (1 << bits) - 1;
  const extracted = (value >>> offset) & mask;
  const maxValue = mask;
  return Math.floor((extracted * scale) / maxValue);
}

// ============================================
// Pixel Converter
// ============================================

export class PixelConverter
{
  /**
   * Get size in bits for a pixel format
   */
  static getSizeInBits(format: PixelFormat): number
  {
    return (PIXEL_SIZES[format] || 0) * 8;
  }

  /**
   * Get size in bytes for a number of pixels
   */
  static getSizeInBytes(format: PixelFormat, count: number): number
  {
    return (PIXEL_SIZES[format] || 0) * count;
  }

  /**
   * Unswizzle texture data in-place
   */
  static unswizzleInline(format: PixelFormat, from: Uint8Array, width: number, height: number): void
  {
    const rowWidth = PixelConverter.getSizeInBytes(format, width);
    const textureHeight = height;
    const size = rowWidth * textureHeight;
    const temp = new Uint8Array(size);

    PixelConverter.unswizzle(from, temp, rowWidth, textureHeight);

    // Copy back
    from.set(temp.subarray(0, size));
  }

  /**
   * Unswizzle texture data
   */
  private static unswizzle(
    input: Uint8Array,
    output: Uint8Array,
    rowWidth: number,
    textureHeight: number
  ): void
  {
    const pitch = Math.floor((rowWidth - 16) / 4);
    const bxc = Math.floor(rowWidth / 16);
    const byc = Math.floor(textureHeight / 8);
    const pitch4 = pitch * 4;

    let src = 0;
    let ydest = 0;

    for (let by = 0; by < byc; by++)
    {
      let xdest = ydest;
      for (let bx = 0; bx < bxc; bx++)
      {
        let dest = xdest;
        for (let n = 0; n < 8; n++, dest += pitch4)
        {
          for (let m = 0; m < 16; m++)
          {
            output[dest++] = input[src++];
          }
        }
        xdest += 16;
      }
      ydest += rowWidth * 8;
    }
  }

  /**
   * Decode pixel data to RGBA
   */
  static decode(
    format: PixelFormat,
    from: Uint8Array,
    to: Uint32Array,
    useAlpha: boolean = true,
    palette: Uint32Array | null = null,
    clutStart: number = 0,
    clutShift: number = 0,
    clutMask: number = 0xFF
  ): Uint32Array
  {
    switch (format)
    {
      case PixelFormat.RGBA_8888:
        return PixelConverter.decode8888(from, to, useAlpha);
      case PixelFormat.RGBA_5551:
        return PixelConverter.decode5551Array(from, to, useAlpha);
      case PixelFormat.RGBA_5650:
        return PixelConverter.decode5650Array(from, to, useAlpha);
      case PixelFormat.RGBA_4444:
        return PixelConverter.decode4444Array(from, to, useAlpha);
      case PixelFormat.PALETTE_T4:
        return PixelConverter.decodeT4(from, to, useAlpha, palette!, clutStart, clutShift, clutMask);
      case PixelFormat.PALETTE_T8:
        return PixelConverter.decodeT8(from, to, useAlpha, palette!, clutStart, clutShift, clutMask);
      default:
        throw new Error(`Unsupported pixel format ${format}`);
    }
  }

  /**
   * Unpack a single color to RGBA
   */
  static unpackToRGBA(pixelFormat: PixelFormat, rawColor: number, useAlpha: boolean = true): number
  {
    switch (pixelFormat)
    {
      case PixelFormat.RGBA_8888:
        return rawColor | (useAlpha ? 0 : 0xFF000000);
      case PixelFormat.RGBA_5551:
        return PixelConverter.decode5551(rawColor, useAlpha);
      case PixelFormat.RGBA_5650:
        return PixelConverter.decode5650(rawColor, useAlpha);
      case PixelFormat.RGBA_4444:
        return PixelConverter.decode4444(rawColor, useAlpha);
      default:
        throw new Error(`Unsupported pixel format ${pixelFormat}`);
    }
  }

  // ============================================
  // Private Decoders
  // ============================================

  private static decode8888(from8: Uint8Array, to: Uint32Array, useAlpha: boolean): Uint32Array
  {
    const from = new Uint32Array(from8.buffer, from8.byteOffset, Math.floor(from8.length / 4));
    const orValue = useAlpha ? 0 : 0xFF000000;
    for (let n = 0; n < to.length; n++)
    {
      to[n] = from[n] | orValue;
    }
    return to;
  }

  private static decode5551Array(from8: Uint8Array, to: Uint32Array, useAlpha: boolean): Uint32Array
  {
    const from = new Uint16Array(from8.buffer, from8.byteOffset, Math.floor(from8.length / 2));
    for (let n = 0; n < to.length; n++)
    {
      to[n] = PixelConverter.decode5551(from[n], useAlpha);
    }
    return to;
  }

  private static decode5650Array(from8: Uint8Array, to: Uint32Array, useAlpha: boolean): Uint32Array
  {
    const from = new Uint16Array(from8.buffer, from8.byteOffset, Math.floor(from8.length / 2));
    for (let n = 0; n < to.length; n++)
    {
      to[n] = PixelConverter.decode5650(from[n], useAlpha);
    }
    return to;
  }

  private static decode4444Array(from8: Uint8Array, to: Uint32Array, useAlpha: boolean): Uint32Array
  {
    const from = new Uint16Array(from8.buffer, from8.byteOffset, Math.floor(from8.length / 2));
    for (let n = 0; n < to.length; n++)
    {
      to[n] = PixelConverter.decode4444(from[n], useAlpha);
    }
    return to;
  }

  private static decode5551(it: number, useAlpha: boolean): number
  {
    let value = 0;
    value |= extractScalei(it, 0, 5, 0xFF) << 0;
    value |= extractScalei(it, 5, 5, 0xFF) << 8;
    value |= extractScalei(it, 10, 5, 0xFF) << 16;
    value |= extractScalei(it, 15, 1, 0xFF) << 24;
    value |= useAlpha ? 0 : 0xFF000000;
    return value;
  }

  private static decode5650(it: number, useAlpha: boolean): number
  {
    let value = 0;
    value |= extractScalei(it, 0, 5, 0xFF) << 0;
    value |= extractScalei(it, 5, 6, 0xFF) << 8;
    value |= extractScalei(it, 11, 5, 0xFF) << 16;
    value |= 0xFF000000;
    return value;
  }

  private static decode4444(it: number, useAlpha: boolean): number
  {
    let value = 0;
    value |= extractScalei(it, 0, 4, 0xFF) << 0;
    value |= extractScalei(it, 4, 4, 0xFF) << 8;
    value |= extractScalei(it, 8, 4, 0xFF) << 16;
    value |= (useAlpha ? extractScalei(it, 12, 4, 0xFF) : 0xFF) << 24;
    return value;
  }

  private static updateTranslate = new Uint32Array(256);

  private static decodeT4(
    from: Uint8Array,
    to: Uint32Array,
    useAlpha: boolean,
    palette: Uint32Array,
    clutStart: number,
    clutShift: number,
    clutMask: number
  ): Uint32Array
  {
    const orValue = useAlpha ? 0 : 0xFF000000;
    clutMask &= 0xF;

    const translate = PixelConverter.updateTranslate;
    for (let m = 0; m < 16; m++)
    {
      translate[m] = palette[((clutStart + m) >>> clutShift) & clutMask];
    }

    for (let n = 0, m = 0; m < to.length; n++)
    {
      const char = from[n];
      to[m++] = translate[(char >>> 0) & 0xF] | orValue;
      to[m++] = translate[(char >>> 4) & 0xF] | orValue;
    }

    return to;
  }

  private static decodeT8(
    from: Uint8Array,
    to: Uint32Array,
    useAlpha: boolean,
    palette: Uint32Array,
    clutStart: number,
    clutShift: number,
    clutMask: number
  ): Uint32Array
  {
    const orValue = useAlpha ? 0 : 0xFF000000;
    clutMask &= 0xFF;

    const count = to.length;

    if (count > 1024)
    {
      const translate = PixelConverter.updateTranslate;
      for (let m = 0; m < 256; m++)
      {
        translate[m] = palette[((clutStart + m) >>> clutShift) & clutMask];
      }
      for (let m = 0; m < count; m++)
      {
        to[m] = translate[from[m]] | orValue;
      }
    }
    else
    {
      for (let m = 0; m < count; m++)
      {
        to[m] = palette[clutStart + ((from[m] & clutMask) << clutShift)] | orValue;
      }
    }

    return to;
  }
}
