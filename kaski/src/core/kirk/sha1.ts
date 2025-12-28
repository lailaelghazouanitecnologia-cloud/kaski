/**
 * SHA1 Implementation for KIRK Crypto Engine
 *
 * Standard SHA-1 hash algorithm producing 160-bit (20-byte) digests.
 * Used by KIRK CMD11 and PRNG (CMD14).
 */

// ============================================
// Constants
// ============================================

/**
 * SHA1 initial hash values (H0-H4)
 */
const H0 = 0x67452301;
const H1 = 0xEFCDAB89;
const H2 = 0x98BADCFE;
const H3 = 0x10325476;
const H4 = 0xC3D2E1F0;

/**
 * SHA1 round constants
 */
const K = [
  0x5A827999, // rounds 0-19
  0x6ED9EBA1, // rounds 20-39
  0x8F1BBCDC, // rounds 40-59
  0xCA62C1D6, // rounds 60-79
];

// ============================================
// Helper Functions
// ============================================

/**
 * Left rotate a 32-bit integer
 */
function rotl(x: number, n: number): number
{
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

/**
 * SHA1 round function f
 */
function f(t: number, b: number, c: number, d: number): number
{
  if (t < 20)
  {
    // Ch(b, c, d) = (b & c) ^ (~b & d)
    return ((b & c) | ((~b >>> 0) & d)) >>> 0;
  }
  else if (t < 40)
  {
    // Parity(b, c, d) = b ^ c ^ d
    return (b ^ c ^ d) >>> 0;
  }
  else if (t < 60)
  {
    // Maj(b, c, d) = (b & c) ^ (b & d) ^ (c & d)
    return ((b & c) | (b & d) | (c & d)) >>> 0;
  }
  else
  {
    // Parity(b, c, d) = b ^ c ^ d
    return (b ^ c ^ d) >>> 0;
  }
}

/**
 * Get round constant K
 */
function getK(t: number): number
{
  if (t < 20) return K[0];
  if (t < 40) return K[1];
  if (t < 60) return K[2];
  return K[3];
}

// ============================================
// SHA1 Context
// ============================================

/**
 * SHA1 computation context
 */
export class Sha1Context
{
  private h: Uint32Array;
  private buffer: Uint8Array;
  private bufferLength: number;
  private totalLength: number;

  constructor()
  {
    this.h = new Uint32Array([H0, H1, H2, H3, H4]);
    this.buffer = new Uint8Array(64);
    this.bufferLength = 0;
    this.totalLength = 0;
  }

  /**
   * Process a 512-bit (64-byte) block
   */
  private processBlock(block: Uint8Array): void
  {
    // Prepare message schedule W
    const w = new Uint32Array(80);

    // First 16 words from block (big-endian)
    for (let i = 0; i < 16; i++)
    {
      const offset = i * 4;
      w[i] = (
        (block[offset] << 24) |
        (block[offset + 1] << 16) |
        (block[offset + 2] << 8) |
        block[offset + 3]
      ) >>> 0;
    }

    // Extend to 80 words
    for (let i = 16; i < 80; i++)
    {
      w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }

    // Initialize working variables
    let a = this.h[0];
    let b = this.h[1];
    let c = this.h[2];
    let d = this.h[3];
    let e = this.h[4];

    // 80 rounds
    for (let t = 0; t < 80; t++)
    {
      const temp = (rotl(a, 5) + f(t, b, c, d) + e + w[t] + getK(t)) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }

    // Update hash values
    this.h[0] = (this.h[0] + a) >>> 0;
    this.h[1] = (this.h[1] + b) >>> 0;
    this.h[2] = (this.h[2] + c) >>> 0;
    this.h[3] = (this.h[3] + d) >>> 0;
    this.h[4] = (this.h[4] + e) >>> 0;
  }

  /**
   * Update hash with data
   */
  update(data: Uint8Array): void
  {
    let offset = 0;
    this.totalLength += data.length;

    // Process any buffered data
    if (this.bufferLength > 0)
    {
      const needed = 64 - this.bufferLength;
      const toCopy = Math.min(needed, data.length);

      this.buffer.set(data.subarray(0, toCopy), this.bufferLength);
      this.bufferLength += toCopy;
      offset = toCopy;

      if (this.bufferLength === 64)
      {
        this.processBlock(this.buffer);
        this.bufferLength = 0;
      }
    }

    // Process complete blocks
    while (offset + 64 <= data.length)
    {
      this.processBlock(data.subarray(offset, offset + 64));
      offset += 64;
    }

    // Buffer remaining data
    if (offset < data.length)
    {
      this.buffer.set(data.subarray(offset), 0);
      this.bufferLength = data.length - offset;
    }
  }

  /**
   * Finalize and get hash
   */
  final(): Uint8Array
  {
    // Pad message
    const totalBits = this.totalLength * 8;

    // Append 0x80
    this.buffer[this.bufferLength++] = 0x80;

    // If not enough room for length, process current block and start new one
    if (this.bufferLength > 56)
    {
      this.buffer.fill(0, this.bufferLength);
      this.processBlock(this.buffer);
      this.bufferLength = 0;
    }

    // Pad with zeros
    this.buffer.fill(0, this.bufferLength, 56);

    // Append length in bits (big-endian, 64-bit)
    // JavaScript numbers can handle up to 2^53, so we only use lower 32 bits for high part
    const highBits = Math.floor(totalBits / 0x100000000);
    const lowBits = totalBits >>> 0;

    this.buffer[56] = (highBits >>> 24) & 0xFF;
    this.buffer[57] = (highBits >>> 16) & 0xFF;
    this.buffer[58] = (highBits >>> 8) & 0xFF;
    this.buffer[59] = highBits & 0xFF;
    this.buffer[60] = (lowBits >>> 24) & 0xFF;
    this.buffer[61] = (lowBits >>> 16) & 0xFF;
    this.buffer[62] = (lowBits >>> 8) & 0xFF;
    this.buffer[63] = lowBits & 0xFF;

    this.processBlock(this.buffer);

    // Convert hash to bytes (big-endian)
    const result = new Uint8Array(20);
    for (let i = 0; i < 5; i++)
    {
      result[i * 4] = (this.h[i] >>> 24) & 0xFF;
      result[i * 4 + 1] = (this.h[i] >>> 16) & 0xFF;
      result[i * 4 + 2] = (this.h[i] >>> 8) & 0xFF;
      result[i * 4 + 3] = this.h[i] & 0xFF;
    }

    return result;
  }

  /**
   * Reset context for reuse
   */
  reset(): void
  {
    this.h[0] = H0;
    this.h[1] = H1;
    this.h[2] = H2;
    this.h[3] = H3;
    this.h[4] = H4;
    this.buffer.fill(0);
    this.bufferLength = 0;
    this.totalLength = 0;
  }
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Compute SHA1 hash of data
 */
export function sha1(data: Uint8Array): Uint8Array
{
  const ctx = new Sha1Context();
  ctx.update(data);
  return ctx.final();
}

/**
 * Compute SHA1 hash and return as hex string
 */
export function sha1Hex(data: Uint8Array): string
{
  const hash = sha1(data);
  return Array.from(hash)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
