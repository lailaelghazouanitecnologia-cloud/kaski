/**
 * Bit manipulation utilities
 */
export const BitUtils = {
  /**
   * Extract bits from a value
   *
   * @param value - Source value
   * @param offset - Bit offset (0 = LSB)
   * @param length - Number of bits to extract
   * @returns Extracted unsigned value
   */
  extract(value: number, offset: number, length: number): number
  {
    return (value >>> offset) & ((1 << length) - 1);
  },

  /**
   * Extract bits as signed value
   *
   * @param value - Source value
   * @param offset - Bit offset (0 = LSB)
   * @param length - Number of bits to extract
   * @returns Extracted signed value
   */
  extractSigned(value: number, offset: number, length: number): number
  {
    const extracted = this.extract(value, offset, length);
    const signBit = 1 << (length - 1);
    if (extracted & signBit)
    {
      return extracted - (1 << length);
    }
    return extracted;
  },

  /**
   * Insert bits into a value
   *
   * @param value - Original value
   * @param offset - Bit offset (0 = LSB)
   * @param length - Number of bits to insert
   * @param insert - Value to insert
   * @returns Modified value
   */
  insert(value: number, offset: number, length: number, insert: number): number
  {
    const mask = ((1 << length) - 1) << offset;
    return (value & ~mask) | ((insert << offset) & mask);
  },

  /**
   * Count leading zeros (wrapper for Math.clz32)
   */
  clz(value: number): number
  {
    return Math.clz32(value);
  },

  /**
   * Count leading ones
   */
  clo(value: number): number
  {
    return Math.clz32(~value);
  },

  /**
   * Rotate right
   */
  rotr(value: number, amount: number): number
  {
    const v = value >>> 0;
    const a = amount & 31;
    return ((v >>> a) | (v << (32 - a))) | 0;
  },

  /**
   * Bit reverse
   */
  bitrev(value: number): number
  {
    let v = value >>> 0;
    let result = 0;
    for (let i = 0; i < 32; i++)
    {
      result = (result << 1) | (v & 1);
      v >>>= 1;
    }
    return result;
  },

  /**
   * Byte swap within half-words
   * Swaps bytes 0<->1 and 2<->3
   */
  wsbh(value: number): number
  {
    const v = value >>> 0;
    return ((v & 0x00FF00FF) << 8) | ((v & 0xFF00FF00) >>> 8);
  },

  /**
   * Full word byte swap (reverse byte order)
   */
  wsbw(value: number): number
  {
    const v = value >>> 0;
    return ((v & 0x000000FF) << 24) |
           ((v & 0x0000FF00) << 8) |
           ((v & 0x00FF0000) >>> 8) |
           ((v & 0xFF000000) >>> 24);
  },

  /**
   * Sign extend byte to word
   */
  seb(value: number): number
  {
    return (value << 24) >> 24;
  },

  /**
   * Sign extend half-word to word
   */
  seh(value: number): number
  {
    return (value << 16) >> 16;
  },
};
