/**
 * UtilsForUser
 *
 * Utility functions module.
 * Provides memory operations, time functions, and system utilities.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * CRC-32 lookup table
 */
const CRC32_TABLE = new Uint32Array(256);
(() =>
{
  for (let i = 0; i < 256; i++)
  {
    let c = i;
    for (let j = 0; j < 8; j++)
    {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    CRC32_TABLE[i] = c >>> 0;
  }
})();

/**
 * Calculate CRC-32
 */
function crc32(data: Uint8Array): number
{
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++)
  {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * MT19937 Mersenne Twister constants
 */
const MT_N = 624;
const MT_M = 397;
const MT_MATRIX_A = 0x9908B0DF;
const MT_UPPER_MASK = 0x80000000;
const MT_LOWER_MASK = 0x7FFFFFFF;

@hleModule('UtilsForUser')
export class UtilsForUser
{
  readonly name = 'UtilsForUser';

  private ctx!: EmulatorContext;

  // Mersenne Twister state
  private mt: Uint32Array = new Uint32Array(MT_N);
  private mti: number = MT_N + 1;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
    // Initialize with default seed
    this.initMT(Date.now() >>> 0);
  }

  /**
   * Initialize Mersenne Twister
   */
  private initMT(seed: number): void
  {
    this.mt[0] = seed >>> 0;
    for (this.mti = 1; this.mti < MT_N; this.mti++)
    {
      const s = this.mt[this.mti - 1] ^ (this.mt[this.mti - 1] >>> 30);
      this.mt[this.mti] = (((((s & 0xFFFF0000) >>> 16) * 1812433253) << 16) +
        (s & 0x0000FFFF) * 1812433253 + this.mti) >>> 0;
    }
  }

  /**
   * Generate random number using MT
   */
  private genrandMT(): number
  {
    let y: number;
    const mag01 = [0, MT_MATRIX_A];

    if (this.mti >= MT_N)
    {
      let kk: number;

      for (kk = 0; kk < MT_N - MT_M; kk++)
      {
        y = (this.mt[kk] & MT_UPPER_MASK) | (this.mt[kk + 1] & MT_LOWER_MASK);
        this.mt[kk] = this.mt[kk + MT_M] ^ (y >>> 1) ^ mag01[y & 1];
      }
      for (; kk < MT_N - 1; kk++)
      {
        y = (this.mt[kk] & MT_UPPER_MASK) | (this.mt[kk + 1] & MT_LOWER_MASK);
        this.mt[kk] = this.mt[kk + (MT_M - MT_N)] ^ (y >>> 1) ^ mag01[y & 1];
      }
      y = (this.mt[MT_N - 1] & MT_UPPER_MASK) | (this.mt[0] & MT_LOWER_MASK);
      this.mt[MT_N - 1] = this.mt[MT_M - 1] ^ (y >>> 1) ^ mag01[y & 1];

      this.mti = 0;
    }

    y = this.mt[this.mti++];

    // Tempering
    y ^= (y >>> 11);
    y ^= (y << 7) & 0x9D2C5680;
    y ^= (y << 15) & 0xEFC60000;
    y ^= (y >>> 18);

    return y >>> 0;
  }

  // ============================================
  // Time Functions
  // ============================================

  /**
   * sceKernelLibcTime
   * Get current Unix time
   *
   * @param timePtr - Output time_t value
   * @returns Current time
   */
  @nativeFunction(0x27CC57F0, 150)
  sceKernelLibcTime(): number
  {
    const timePtr = this.ctx.argPtr(0);
    const time = Math.floor(Date.now() / 1000);

    if (timePtr)
    {
      this.ctx.write32(timePtr, time);
    }

    return time;
  }

  /**
   * sceKernelLibcClock
   * Get processor time
   *
   * @returns Clock ticks
   */
  @nativeFunction(0x91E4F6A7, 150)
  sceKernelLibcClock(): number
  {
    // Return microseconds since start (approximate)
    return (Date.now() * 1000) >>> 0;
  }

  /**
   * sceKernelLibcGettimeofday
   * Get time of day
   *
   * @param tvPtr - Output timeval structure
   * @param tzPtr - Output timezone (ignored)
   * @returns 0 on success
   */
  @nativeFunction(0x71EC4271, 150)
  sceKernelLibcGettimeofday(): number
  {
    const tvPtr = this.ctx.argPtr(0);

    if (tvPtr)
    {
      const now = Date.now();
      const sec = Math.floor(now / 1000);
      const usec = (now % 1000) * 1000;

      this.ctx.write32(tvPtr, sec);      // tv_sec
      this.ctx.write32(tvPtr + 4, usec); // tv_usec
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelGetSystemTime
   * Get system time in microseconds
   *
   * @param timePtr - Output 64-bit time
   * @returns 0 on success
   */
  @nativeFunction(0xBA6B28B0, 150)
  sceKernelGetSystemTime(): number
  {
    const timePtr = this.ctx.argPtr(0);

    if (timePtr)
    {
      const time = BigInt(Date.now()) * 1000n;
      const low = Number(time & 0xFFFFFFFFn);
      const high = Number((time >> 32n) & 0xFFFFFFFFn);

      this.ctx.write32(timePtr, low);
      this.ctx.write32(timePtr + 4, high);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelGetSystemTimeLow
   * Get low 32 bits of system time
   *
   * @returns Low 32 bits of time in microseconds
   */
  @nativeFunction(0x369ED59D, 150)
  sceKernelGetSystemTimeLow(): number
  {
    return (Date.now() * 1000) >>> 0;
  }

  /**
   * sceKernelGetSystemTimeWide
   * Get system time as 64-bit value
   *
   * @returns Time in microseconds (returns in v0:v1)
   */
  @nativeFunction(0x82BC5777, 150)
  sceKernelGetSystemTimeWide(): number
  {
    const time = BigInt(Date.now()) * 1000n;
    const low = Number(time & 0xFFFFFFFFn);
    const high = Number((time >> 32n) & 0xFFFFFFFFn);

    this.ctx.setReturnValue64(low, high);
    return low;
  }

  // ============================================
  // Memory Functions
  // ============================================

  /**
   * sceKernelDcacheWritebackAll
   * Write back all data cache
   *
   * @returns void
   */
  @nativeFunction(0x79D1C3FA, 150)
  sceKernelDcacheWritebackAll(): number
  {
    // No-op in emulator
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelDcacheWritebackInvalidateAll
   * Write back and invalidate all data cache
   *
   * @returns void
   */
  @nativeFunction(0xB435DEC5, 150)
  sceKernelDcacheWritebackInvalidateAll(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelDcacheWritebackRange
   * Write back data cache range
   *
   * @param addr - Start address
   * @param size - Size
   * @returns void
   */
  @nativeFunction(0x3EE30821, 150)
  sceKernelDcacheWritebackRange(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelDcacheWritebackInvalidateRange
   * Write back and invalidate data cache range
   *
   * @param addr - Start address
   * @param size - Size
   * @returns void
   */
  @nativeFunction(0x34B9FA9E, 150)
  sceKernelDcacheWritebackInvalidateRange(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelDcacheInvalidateRange
   * Invalidate data cache range
   *
   * @param addr - Start address
   * @param size - Size
   * @returns void
   */
  @nativeFunction(0xBFA98062, 150)
  sceKernelDcacheInvalidateRange(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelIcacheInvalidateAll
   * Invalidate all instruction cache
   *
   * @returns void
   */
  @nativeFunction(0x920F104A, 150)
  sceKernelIcacheInvalidateAll(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelIcacheInvalidateRange
   * Invalidate instruction cache range
   *
   * @param addr - Start address
   * @param size - Size
   * @returns void
   */
  @nativeFunction(0xC2DF770E, 150)
  sceKernelIcacheInvalidateRange(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Checksum Functions
  // ============================================

  /**
   * sceKernelUtilsMt19937Init
   * Initialize Mersenne Twister
   *
   * @param ctxPtr - Context pointer
   * @param seed - Seed value
   * @returns 0 on success
   */
  @nativeFunction(0xE860E75E, 150)
  sceKernelUtilsMt19937Init(): number
  {
    const seed = this.ctx.arg(1);
    this.initMT(seed);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelUtilsMt19937UInt
   * Generate random number
   *
   * @param ctxPtr - Context pointer
   * @returns Random number
   */
  @nativeFunction(0x06FB8A63, 150)
  sceKernelUtilsMt19937UInt(): number
  {
    return this.genrandMT();
  }

  /**
   * sceKernelUtilsMd5Digest
   * Calculate MD5 hash
   *
   * @param data - Input data
   * @param size - Data size
   * @param digest - Output 16-byte digest
   * @returns 0 on success
   */
  @nativeFunction(0xC8186A58, 150)
  sceKernelUtilsMd5Digest(): number
  {
    // Simplified: just zero the digest for now
    // Real implementation would compute MD5
    const digestPtr = this.ctx.argPtr(2);

    for (let i = 0; i < 16; i++)
    {
      this.ctx.write8(digestPtr + i, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelUtilsMd5BlockInit
   * Initialize MD5 context
   *
   * @param ctxPtr - Context pointer
   * @returns 0 on success
   */
  @nativeFunction(0x9E5C5086, 150)
  sceKernelUtilsMd5BlockInit(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelUtilsMd5BlockUpdate
   * Update MD5 context
   *
   * @param ctxPtr - Context pointer
   * @param data - Input data
   * @param size - Data size
   * @returns 0 on success
   */
  @nativeFunction(0x61E1E525, 150)
  sceKernelUtilsMd5BlockUpdate(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelUtilsMd5BlockResult
   * Finalize MD5 and get result
   *
   * @param ctxPtr - Context pointer
   * @param digest - Output digest
   * @returns 0 on success
   */
  @nativeFunction(0xB8D24E78, 150)
  sceKernelUtilsMd5BlockResult(): number
  {
    const digestPtr = this.ctx.argPtr(1);

    for (let i = 0; i < 16; i++)
    {
      this.ctx.write8(digestPtr + i, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelUtilsSha1Digest
   * Calculate SHA-1 hash
   *
   * @param data - Input data
   * @param size - Data size
   * @param digest - Output 20-byte digest
   * @returns 0 on success
   */
  @nativeFunction(0x840259F1, 150)
  sceKernelUtilsSha1Digest(): number
  {
    const digestPtr = this.ctx.argPtr(2);

    for (let i = 0; i < 20; i++)
    {
      this.ctx.write8(digestPtr + i, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelUtilsSha1BlockInit
   * Initialize SHA-1 context
   */
  @nativeFunction(0xF8FCD5BA, 150)
  sceKernelUtilsSha1BlockInit(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelUtilsSha1BlockUpdate
   * Update SHA-1 context
   */
  @nativeFunction(0x346F6DA8, 150)
  sceKernelUtilsSha1BlockUpdate(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelUtilsSha1BlockResult
   * Finalize SHA-1 and get result
   */
  @nativeFunction(0x585F1C09, 150)
  sceKernelUtilsSha1BlockResult(): number
  {
    const digestPtr = this.ctx.argPtr(1);

    for (let i = 0; i < 20; i++)
    {
      this.ctx.write8(digestPtr + i, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Decompression
  // ============================================

  /**
   * sceKernelDeflateDecompress
   * Decompress deflate data
   *
   * @param dest - Destination buffer
   * @param destSize - Destination size
   * @param src - Source data
   * @param unknown - Unknown parameter
   * @returns Decompressed size or error
   */
  @nativeFunction(0x78934841, 150)
  sceKernelDeflateDecompress(): number
  {
    // Not implemented - return error
    return SceKernelErrors.ERROR_NOT_SUPPORTED;
  }

  /**
   * sceKernelGzipDecompress
   * Decompress gzip data
   *
   * @param dest - Destination buffer
   * @param destSize - Destination size
   * @param src - Source data
   * @param unknown - Unknown parameter
   * @returns Decompressed size or error
   */
  @nativeFunction(0xE8DB3CE6, 150)
  sceKernelGzipDecompress(): number
  {
    return SceKernelErrors.ERROR_NOT_SUPPORTED;
  }
}
