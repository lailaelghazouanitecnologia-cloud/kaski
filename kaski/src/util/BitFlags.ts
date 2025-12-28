/**
 * BitFlags - Type-safe bitfield manipulation
 *
 * Provides utilities for working with PSP flag values.
 */

/**
 * BitFlags class for type-safe flag operations
 */
export class BitFlags<T extends number = number>
{
  constructor(public value: number = 0) {}

  /**
   * Check if flag is set
   */
  has(flag: T): boolean
  {
    return (this.value & flag) !== 0;
  }

  /**
   * Check if all flags are set
   */
  hasAll(...flags: T[]): boolean
  {
    for (const flag of flags)
    {
      if ((this.value & flag) === 0) return false;
    }
    return true;
  }

  /**
   * Check if any flag is set
   */
  hasAny(...flags: T[]): boolean
  {
    for (const flag of flags)
    {
      if ((this.value & flag) !== 0) return true;
    }
    return false;
  }

  /**
   * Set a flag
   */
  set(flag: T): this
  {
    this.value |= flag;
    return this;
  }

  /**
   * Set multiple flags
   */
  setAll(...flags: T[]): this
  {
    for (const flag of flags)
    {
      this.value |= flag;
    }
    return this;
  }

  /**
   * Clear a flag
   */
  clear(flag: T): this
  {
    this.value &= ~flag;
    return this;
  }

  /**
   * Clear multiple flags
   */
  clearAll(...flags: T[]): this
  {
    for (const flag of flags)
    {
      this.value &= ~flag;
    }
    return this;
  }

  /**
   * Toggle a flag
   */
  toggle(flag: T): this
  {
    this.value ^= flag;
    return this;
  }

  /**
   * Set flag to specific state
   */
  setTo(flag: T, state: boolean): this
  {
    if (state)
    {
      this.value |= flag;
    }
    else
    {
      this.value &= ~flag;
    }
    return this;
  }

  /**
   * Get raw value
   */
  toNumber(): number
  {
    return this.value;
  }

  /**
   * Create from raw value
   */
  static from<T extends number>(value: number): BitFlags<T>
  {
    return new BitFlags<T>(value);
  }

  /**
   * Map flags from one format to another
   */
  static map<S extends number, D extends number>(
    sourceValue: number,
    mapping: ReadonlyArray<readonly [S, D]>
  ): BitFlags<D>
  {
    const result = new BitFlags<D>();
    for (const [src, dst] of mapping)
    {
      if ((sourceValue & src) !== 0)
      {
        result.set(dst);
      }
    }
    return result;
  }

  /**
   * Map flags with transformation function
   */
  static mapWith<S extends number, D extends number>(
    sourceValue: number,
    mapping: ReadonlyArray<readonly [S, D]>,
    transform?: (src: S, dst: D) => D
  ): BitFlags<D>
  {
    const result = new BitFlags<D>();
    for (const [src, dst] of mapping)
    {
      if ((sourceValue & src) !== 0)
      {
        result.set(transform ? transform(src, dst) : dst);
      }
    }
    return result;
  }

  /**
   * Extract a range of bits
   */
  static extract(value: number, offset: number, width: number): number
  {
    const mask = (1 << width) - 1;
    return (value >>> offset) & mask;
  }

  /**
   * Insert bits into a value
   */
  static insert(value: number, bits: number, offset: number, width: number): number
  {
    const mask = (1 << width) - 1;
    const cleared = value & ~(mask << offset);
    return cleared | ((bits & mask) << offset);
  }

  /**
   * Count set bits
   */
  static popcount(value: number): number
  {
    let count = 0;
    while (value)
    {
      count += value & 1;
      value >>>= 1;
    }
    return count;
  }

  /**
   * Find first set bit (1-indexed, 0 if none)
   */
  static ffs(value: number): number
  {
    if (value === 0) return 0;
    let pos = 1;
    while ((value & 1) === 0)
    {
      value >>>= 1;
      pos++;
    }
    return pos;
  }

  /**
   * Find last set bit (1-indexed, 0 if none)
   */
  static fls(value: number): number
  {
    if (value === 0) return 0;
    let pos = 32;
    while ((value & 0x80000000) === 0)
    {
      value <<= 1;
      pos--;
    }
    return pos;
  }
}

/**
 * Helper to define flag mappings
 */
export function flagMapping<S extends number, D extends number>(
  ...pairs: Array<readonly [S, D]>
): ReadonlyArray<readonly [S, D]>
{
  return pairs;
}
