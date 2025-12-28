/**
 * Int64 - 64-bit integer handling
 *
 * PSP uses 64-bit integers for file sizes, offsets, and timestamps.
 * This provides a lightweight wrapper that splits into low/high 32-bit parts.
 */

/**
 * 64-bit integer stored as two 32-bit parts
 */
export class Int64
{
  /** Low 32 bits */
  readonly low: number;

  /** High 32 bits */
  readonly high: number;

  constructor(low: number, high: number = 0)
  {
    // Store as unsigned 32-bit values
    this.low = low >>> 0;
    this.high = high >>> 0;
  }

  /** Create from a number (loses precision above 2^53) */
  static fromNumber(n: number): Int64
  {
    if (n >= 0)
    {
      return new Int64(n >>> 0, (n / 0x100000000) >>> 0);
    }
    else
    {
      // Negative: use two's complement
      const abs = -n;
      const low = (~(abs >>> 0) + 1) >>> 0;
      const high = (~((abs / 0x100000000) >>> 0) + (low === 0 ? 1 : 0)) >>> 0;
      return new Int64(low, high);
    }
  }

  /** Create from BigInt */
  static fromBigInt(n: bigint): Int64
  {
    return new Int64(
      Number(n & 0xFFFFFFFFn),
      Number((n >> 32n) & 0xFFFFFFFFn)
    );
  }

  /** Create from hex string */
  static fromHex(hex: string): Int64
  {
    return Int64.fromBigInt(BigInt(hex.startsWith('0x') ? hex : '0x' + hex));
  }

  /** Zero */
  static readonly ZERO = new Int64(0, 0);

  /** One */
  static readonly ONE = new Int64(1, 0);

  /** Max value (unsigned) */
  static readonly MAX = new Int64(0xFFFFFFFF, 0xFFFFFFFF);

  /** Convert to number (loses precision above 2^53) */
  toNumber(): number
  {
    return (this.high >>> 0) * 0x100000000 + (this.low >>> 0);
  }

  /** Convert to signed number (loses precision) */
  toSignedNumber(): number
  {
    if (this.high & 0x80000000)
    {
      // Negative
      return -new Int64(~this.low + 1, ~this.high + (this.low === 0 ? 1 : 0)).toNumber();
    }
    return this.toNumber();
  }

  /** Convert to BigInt */
  toBigInt(): bigint
  {
    return (BigInt(this.high >>> 0) << 32n) | BigInt(this.low >>> 0);
  }

  /** Convert to signed BigInt */
  toSignedBigInt(): bigint
  {
    const unsigned = this.toBigInt();
    if (this.high & 0x80000000)
    {
      return unsigned - (1n << 64n);
    }
    return unsigned;
  }

  /** Convert to hex string */
  toHex(): string
  {
    const highHex = (this.high >>> 0).toString(16).padStart(8, '0');
    const lowHex = (this.low >>> 0).toString(16).padStart(8, '0');
    return '0x' + highHex + lowHex;
  }

  /** Is zero */
  isZero(): boolean
  {
    return this.low === 0 && this.high === 0;
  }

  /** Is negative (signed interpretation) */
  isNegative(): boolean
  {
    return (this.high & 0x80000000) !== 0;
  }

  /** Add two Int64 values */
  add(other: Int64): Int64
  {
    const low = (this.low >>> 0) + (other.low >>> 0);
    const carry = low > 0xFFFFFFFF ? 1 : 0;
    const high = (this.high >>> 0) + (other.high >>> 0) + carry;
    return new Int64(low >>> 0, high >>> 0);
  }

  /** Subtract two Int64 values */
  sub(other: Int64): Int64
  {
    const low = (this.low >>> 0) - (other.low >>> 0);
    const borrow = low < 0 ? 1 : 0;
    const high = (this.high >>> 0) - (other.high >>> 0) - borrow;
    return new Int64(low >>> 0, high >>> 0);
  }

  /** Compare (returns -1, 0, or 1) */
  compare(other: Int64): number
  {
    const thisHigh = this.high >>> 0;
    const otherHigh = other.high >>> 0;
    if (thisHigh !== otherHigh)
    {
      return thisHigh > otherHigh ? 1 : -1;
    }
    const thisLow = this.low >>> 0;
    const otherLow = other.low >>> 0;
    if (thisLow !== otherLow)
    {
      return thisLow > otherLow ? 1 : -1;
    }
    return 0;
  }

  /** Signed compare */
  compareSigned(other: Int64): number
  {
    const thisNeg = this.isNegative();
    const otherNeg = other.isNegative();
    if (thisNeg !== otherNeg)
    {
      return thisNeg ? -1 : 1;
    }
    return this.compare(other);
  }

  /** Less than */
  lt(other: Int64): boolean
  {
    return this.compare(other) < 0;
  }

  /** Less than or equal */
  le(other: Int64): boolean
  {
    return this.compare(other) <= 0;
  }

  /** Greater than */
  gt(other: Int64): boolean
  {
    return this.compare(other) > 0;
  }

  /** Greater than or equal */
  ge(other: Int64): boolean
  {
    return this.compare(other) >= 0;
  }

  /** Equal */
  eq(other: Int64): boolean
  {
    return this.low === other.low && this.high === other.high;
  }

  /** Bitwise AND */
  and(other: Int64): Int64
  {
    return new Int64(this.low & other.low, this.high & other.high);
  }

  /** Bitwise OR */
  or(other: Int64): Int64
  {
    return new Int64(this.low | other.low, this.high | other.high);
  }

  /** Bitwise XOR */
  xor(other: Int64): Int64
  {
    return new Int64(this.low ^ other.low, this.high ^ other.high);
  }

  /** Bitwise NOT */
  not(): Int64
  {
    return new Int64(~this.low, ~this.high);
  }

  /** Left shift */
  shl(bits: number): Int64
  {
    bits = bits & 63;
    if (bits === 0) return this;
    if (bits >= 32)
    {
      return new Int64(0, this.low << (bits - 32));
    }
    return new Int64(
      this.low << bits,
      (this.high << bits) | (this.low >>> (32 - bits))
    );
  }

  /** Logical right shift */
  shr(bits: number): Int64
  {
    bits = bits & 63;
    if (bits === 0) return this;
    if (bits >= 32)
    {
      return new Int64(this.high >>> (bits - 32), 0);
    }
    return new Int64(
      (this.low >>> bits) | (this.high << (32 - bits)),
      this.high >>> bits
    );
  }

  /** Arithmetic right shift */
  sar(bits: number): Int64
  {
    bits = bits & 63;
    if (bits === 0) return this;
    if (bits >= 32)
    {
      return new Int64(this.high >> (bits - 32), this.high >> 31);
    }
    return new Int64(
      (this.low >>> bits) | (this.high << (32 - bits)),
      this.high >> bits
    );
  }

  toString(): string
  {
    return this.toBigInt().toString();
  }
}
