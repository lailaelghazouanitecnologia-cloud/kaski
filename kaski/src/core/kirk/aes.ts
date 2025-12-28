/**
 * AES-128 CBC Encryption/Decryption
 *
 * Implementation for PSP KIRK crypto engine.
 * Based on CryptoJS implementation.
 */

// S-box and inverse S-box lookup tables
const SBOX = new Uint8Array(256);
const INV_SBOX = new Uint8Array(256);

// Sub-mix tables for encryption
const SUB_MIX_0 = new Uint32Array(256);
const SUB_MIX_1 = new Uint32Array(256);
const SUB_MIX_2 = new Uint32Array(256);
const SUB_MIX_3 = new Uint32Array(256);

// Inverse sub-mix tables for decryption
const INV_SUB_MIX_0 = new Uint32Array(256);
const INV_SUB_MIX_1 = new Uint32Array(256);
const INV_SUB_MIX_2 = new Uint32Array(256);
const INV_SUB_MIX_3 = new Uint32Array(256);

// Rcon lookup table
const RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

// Initialize lookup tables
(function initTables(): void
{
  // Compute double table for GF(2^8)
  const d: number[] = [];
  for (let i = 0; i < 256; i++)
  {
    d[i] = i < 128 ? (i << 1) : (i << 1) ^ 0x11b;
  }

  // Walk GF(2^8)
  let x = 0;
  let xi = 0;

  for (let i = 0; i < 256; i++)
  {
    // Compute S-box
    let sx = xi ^ (xi << 1) ^ (xi << 2) ^ (xi << 3) ^ (xi << 4);
    sx = (sx >>> 8) ^ (sx & 0xff) ^ 0x63;
    SBOX[x] = sx;
    INV_SBOX[sx] = x;

    // Compute multiplication tables
    const x2 = d[x];
    const x4 = d[x2];
    const x8 = d[x4];

    // Sub bytes, mix columns tables
    let t = (d[sx] * 0x101) ^ (sx * 0x1010100);
    SUB_MIX_0[x] = (t << 24) | (t >>> 8);
    SUB_MIX_1[x] = (t << 16) | (t >>> 16);
    SUB_MIX_2[x] = (t << 8) | (t >>> 24);
    SUB_MIX_3[x] = t;

    // Inverse sub bytes, inverse mix columns tables
    t = (x8 * 0x1010101) ^ (x4 * 0x10001) ^ (x2 * 0x101) ^ (x * 0x1010100);
    INV_SUB_MIX_0[sx] = (t << 24) | (t >>> 8);
    INV_SUB_MIX_1[sx] = (t << 16) | (t >>> 16);
    INV_SUB_MIX_2[sx] = (t << 8) | (t >>> 24);
    INV_SUB_MIX_3[sx] = t;

    // Compute next counter
    if (!x)
    {
      x = xi = 1;
    }
    else
    {
      x = x2 ^ d[d[d[x8 ^ x2]]];
      xi ^= d[d[xi]];
    }
  }
})();

/**
 * Swap byte order in 32-bit word (big-endian <-> little-endian)
 */
function swap32(v: number): number
{
  return ((v & 0xFF) << 24) | ((v & 0xFF00) << 8) | ((v >> 8) & 0xFF00) | ((v >> 24) & 0xFF);
}

/**
 * Convert Uint8Array to Uint32Array with byte swapping
 */
function bytesToWords(data: Uint8Array): Uint32Array
{
  const words = new Uint32Array(data.length / 4);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  for (let i = 0; i < words.length; i++)
  {
    words[i] = view.getUint32(i * 4, false); // Big-endian
  }

  return words;
}

/**
 * Convert Uint32Array to Uint8Array with byte swapping
 */
function wordsToBytes(words: Uint32Array): Uint8Array
{
  const data = new Uint8Array(words.length * 4);
  const view = new DataView(data.buffer);

  for (let i = 0; i < words.length; i++)
  {
    view.setUint32(i * 4, words[i], false); // Big-endian
  }

  return data;
}

/**
 * AES block cipher
 */
export class AES
{
  private keySchedule: number[] = [];
  private invKeySchedule: number[] = [];
  private nRounds: number;

  constructor(key: Uint8Array)
  {
    const keyWords = bytesToWords(key);
    const keySize = keyWords.length;
    this.nRounds = keySize + 6;

    const ksRows = (this.nRounds + 1) * 4;
    this.keySchedule = [];

    // Compute key schedule
    for (let ksRow = 0; ksRow < ksRows; ksRow++)
    {
      if (ksRow < keySize)
      {
        this.keySchedule[ksRow] = keyWords[ksRow];
      }
      else
      {
        let t = this.keySchedule[ksRow - 1];

        if (!(ksRow % keySize))
        {
          // Rot word
          t = (t << 8) | (t >>> 24);
          // Sub word
          t = (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 0xff] << 16) |
              (SBOX[(t >>> 8) & 0xff] << 8) | SBOX[t & 0xff];
          // Mix Rcon
          t ^= RCON[(ksRow / keySize) | 0] << 24;
        }
        else if (keySize > 6 && ksRow % keySize === 4)
        {
          t = (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 0xff] << 16) |
              (SBOX[(t >>> 8) & 0xff] << 8) | SBOX[t & 0xff];
        }

        this.keySchedule[ksRow] = this.keySchedule[ksRow - keySize] ^ t;
      }
    }

    // Compute inverse key schedule
    this.invKeySchedule = [];
    for (let invKsRow = 0; invKsRow < ksRows; invKsRow++)
    {
      const ksRow = ksRows - invKsRow;
      let t: number;

      if (invKsRow % 4)
      {
        t = this.keySchedule[ksRow];
      }
      else
      {
        t = this.keySchedule[ksRow - 4];
      }

      if (invKsRow < 4 || ksRow <= 4)
      {
        this.invKeySchedule[invKsRow] = t;
      }
      else
      {
        this.invKeySchedule[invKsRow] =
          INV_SUB_MIX_0[SBOX[t >>> 24]] ^
          INV_SUB_MIX_1[SBOX[(t >>> 16) & 0xff]] ^
          INV_SUB_MIX_2[SBOX[(t >>> 8) & 0xff]] ^
          INV_SUB_MIX_3[SBOX[t & 0xff]];
      }
    }
  }

  /**
   * Decrypt a single block in place
   */
  decryptBlock(M: Uint32Array, offset: number): void
  {
    // Swap 2nd and 4th rows
    let t = M[offset + 1];
    M[offset + 1] = M[offset + 3];
    M[offset + 3] = t;

    this.doCryptBlock(
      M, offset,
      this.invKeySchedule,
      INV_SUB_MIX_0, INV_SUB_MIX_1, INV_SUB_MIX_2, INV_SUB_MIX_3,
      INV_SBOX
    );

    // Inverse swap 2nd and 4th rows
    t = M[offset + 1];
    M[offset + 1] = M[offset + 3];
    M[offset + 3] = t;
  }

  private doCryptBlock(
    M: Uint32Array,
    offset: number,
    keySchedule: number[],
    SM0: Uint32Array,
    SM1: Uint32Array,
    SM2: Uint32Array,
    SM3: Uint32Array,
    SB: Uint8Array
  ): void
  {
    let s0 = M[offset + 0] ^ keySchedule[0];
    let s1 = M[offset + 1] ^ keySchedule[1];
    let s2 = M[offset + 2] ^ keySchedule[2];
    let s3 = M[offset + 3] ^ keySchedule[3];

    let ksRow = 4;

    // Main rounds
    for (let round = 1; round < this.nRounds; round++)
    {
      const t0 = SM0[s0 >>> 24] ^ SM1[(s1 >>> 16) & 0xff] ^
                 SM2[(s2 >>> 8) & 0xff] ^ SM3[s3 & 0xff] ^ keySchedule[ksRow++];
      const t1 = SM0[s1 >>> 24] ^ SM1[(s2 >>> 16) & 0xff] ^
                 SM2[(s3 >>> 8) & 0xff] ^ SM3[s0 & 0xff] ^ keySchedule[ksRow++];
      const t2 = SM0[s2 >>> 24] ^ SM1[(s3 >>> 16) & 0xff] ^
                 SM2[(s0 >>> 8) & 0xff] ^ SM3[s1 & 0xff] ^ keySchedule[ksRow++];
      const t3 = SM0[s3 >>> 24] ^ SM1[(s0 >>> 16) & 0xff] ^
                 SM2[(s1 >>> 8) & 0xff] ^ SM3[s2 & 0xff] ^ keySchedule[ksRow++];

      s0 = t0;
      s1 = t1;
      s2 = t2;
      s3 = t3;
    }

    // Final round (no mix columns)
    const t0 = ((SB[s0 >>> 24] << 24) | (SB[(s1 >>> 16) & 0xff] << 16) |
               (SB[(s2 >>> 8) & 0xff] << 8) | SB[s3 & 0xff]) ^ keySchedule[ksRow++];
    const t1 = ((SB[s1 >>> 24] << 24) | (SB[(s2 >>> 16) & 0xff] << 16) |
               (SB[(s3 >>> 8) & 0xff] << 8) | SB[s0 & 0xff]) ^ keySchedule[ksRow++];
    const t2 = ((SB[s2 >>> 24] << 24) | (SB[(s3 >>> 16) & 0xff] << 16) |
               (SB[(s0 >>> 8) & 0xff] << 8) | SB[s1 & 0xff]) ^ keySchedule[ksRow++];
    const t3 = ((SB[s3 >>> 24] << 24) | (SB[(s0 >>> 16) & 0xff] << 16) |
               (SB[(s1 >>> 8) & 0xff] << 8) | SB[s2 & 0xff]) ^ keySchedule[ksRow++];

    M[offset + 0] = t0;
    M[offset + 1] = t1;
    M[offset + 2] = t2;
    M[offset + 3] = t3;
  }
}

/**
 * Decrypt data using AES-128 in CBC mode
 *
 * @param data - Encrypted data (must be 16-byte aligned)
 * @param key - 16-byte encryption key
 * @param iv - Optional 16-byte initialization vector (defaults to zeros)
 * @returns Decrypted data
 */
export function aesDecryptCbc(data: Uint8Array, key: Uint8Array, iv?: Uint8Array): Uint8Array
{
  if (data.length % 16 !== 0)
  {
    throw new Error('Data length must be a multiple of 16 bytes');
  }

  if (key.length !== 16)
  {
    throw new Error('Key must be 16 bytes');
  }

  const aes = new AES(key);
  const words = bytesToWords(data);
  const wordsLength = words.length;

  // Previous ciphertext block (IV for first block)
  let p0 = 0, p1 = 0, p2 = 0, p3 = 0;

  if (iv)
  {
    const ivWords = bytesToWords(iv);
    p0 = ivWords[0];
    p1 = ivWords[1];
    p2 = ivWords[2];
    p3 = ivWords[3];
  }

  for (let n = 0; n < wordsLength; n += 4)
  {
    // Save current ciphertext before decryption
    const c0 = words[n + 0];
    const c1 = words[n + 1];
    const c2 = words[n + 2];
    const c3 = words[n + 3];

    // Decrypt block
    aes.decryptBlock(words, n);

    // XOR with previous ciphertext (CBC mode)
    words[n + 0] ^= p0;
    words[n + 1] ^= p1;
    words[n + 2] ^= p2;
    words[n + 3] ^= p3;

    // Current ciphertext becomes previous for next block
    p0 = c0;
    p1 = c1;
    p2 = c2;
    p3 = c3;
  }

  return wordsToBytes(words);
}
