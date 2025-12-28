/**
 * ZLIB Raw Inflate
 *
 * Decompression for DEFLATE compressed data.
 * Used by CSO (Compressed ISO) format.
 *
 * Based on zlib.js by imaya (MIT License)
 */

// ============================================
// Huffman Table
// ============================================

class Huffman
{
  constructor(
    public data: Uint32Array,
    public max: number,
    public min: number
  )
  {
  }

  static buildHuffmanTable(lengths: Uint8Array): Huffman
  {
    const listSize = lengths.length;
    let maxCodeLength = 0;
    let minCodeLength = Number.POSITIVE_INFINITY;

    for (let i = 0; i < listSize; ++i)
    {
      if (lengths[i] > maxCodeLength) maxCodeLength = lengths[i];
      if (lengths[i] < minCodeLength) minCodeLength = lengths[i];
    }

    const size = 1 << maxCodeLength;
    const table = new Uint32Array(size);

    for (let bitLength = 1, code = 0, skip = 2; bitLength <= maxCodeLength;)
    {
      for (let i = 0; i < listSize; ++i)
      {
        if (lengths[i] === bitLength)
        {
          let reversed = 0;
          for (let rtemp = code, j = 0; j < bitLength; ++j)
          {
            reversed = (reversed << 1) | (rtemp & 1);
            rtemp >>= 1;
          }
          const value = (bitLength << 16) | i;
          for (let j = reversed; j < size; j += skip)
          {
            table[j] = value;
          }
          ++code;
        }
      }
      ++bitLength;
      code <<= 1;
      skip <<= 1;
    }

    return new Huffman(table, maxCodeLength, minCodeLength);
  }
}

// ============================================
// Constants
// ============================================

const BUFFER_SIZE = 0x8000; // 32KB

const Order = new Uint16Array([
  16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15
]);

const LengthCodeTable = new Uint16Array([
  0x0003, 0x0004, 0x0005, 0x0006, 0x0007, 0x0008, 0x0009, 0x000a, 0x000b,
  0x000d, 0x000f, 0x0011, 0x0013, 0x0017, 0x001b, 0x001f, 0x0023, 0x002b,
  0x0033, 0x003b, 0x0043, 0x0053, 0x0063, 0x0073, 0x0083, 0x00a3, 0x00c3,
  0x00e3, 0x0102, 0x0102, 0x0102
]);

const LengthExtraTable = new Uint8Array([
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5,
  5, 5, 0, 0, 0
]);

const DistCodeTable = new Uint16Array([
  0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0007, 0x0009, 0x000d, 0x0011,
  0x0019, 0x0021, 0x0031, 0x0041, 0x0061, 0x0081, 0x00c1, 0x0101, 0x0181,
  0x0201, 0x0301, 0x0401, 0x0601, 0x0801, 0x0c01, 0x1001, 0x1801, 0x2001,
  0x3001, 0x4001, 0x6001
]);

const DistExtraTable = new Uint8Array([
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11,
  11, 12, 12, 13, 13
]);

// Fixed Huffman tables
const FixedLiteralLengthTable = (() =>
{
  const lengths = new Uint8Array(288);
  for (let i = 0; i < lengths.length; ++i)
  {
    lengths[i] = (i <= 143) ? 8 : (i <= 255) ? 9 : (i <= 279) ? 7 : 8;
  }
  return Huffman.buildHuffmanTable(lengths);
})();

const FixedDistanceTable = (() =>
{
  const lengths = new Uint8Array(30);
  for (let i = 0; i < lengths.length; ++i)
  {
    lengths[i] = 5;
  }
  return Huffman.buildHuffmanTable(lengths);
})();

// ============================================
// Raw Inflate
// ============================================

class RawInflate
{
  private input: Uint8Array;
  private output: Uint8Array;
  private ip = 0;
  private op = 0;
  private bitsbuf = 0;
  private bitsbuflen = 0;
  private bfinal = false;
  private currentLitlenTable?: Huffman;

  constructor(input: Uint8Array)
  {
    this.input = input;
    this.output = new Uint8Array(BUFFER_SIZE);
  }

  decompress(): Uint8Array
  {
    while (!this.bfinal)
    {
      this.parseBlock();
    }

    return this.output.subarray(0, this.op);
  }

  private readBits(length: number): number
  {
    const input = this.input;

    while (this.bitsbuflen < length)
    {
      if (this.ip >= input.length)
      {
        throw new Error('Input buffer is broken');
      }
      this.bitsbuf |= input[this.ip++] << this.bitsbuflen;
      this.bitsbuflen += 8;
    }

    const octet = this.bitsbuf & ((1 << length) - 1);
    this.bitsbuf >>>= length;
    this.bitsbuflen -= length;

    return octet;
  }

  private readCodeByTable(table: Huffman): number
  {
    const input = this.input;
    const codeTable = table.data;
    const maxCodeLength = table.max;

    while (this.bitsbuflen < maxCodeLength)
    {
      if (this.ip >= input.length) break;
      this.bitsbuf |= input[this.ip++] << this.bitsbuflen;
      this.bitsbuflen += 8;
    }

    const codeWithLength = codeTable[this.bitsbuf & ((1 << maxCodeLength) - 1)];
    const codeLength = codeWithLength >>> 16;

    if (codeLength > this.bitsbuflen)
    {
      throw new Error(`Invalid code length: ${codeLength}`);
    }

    this.bitsbuf = this.bitsbuf >> codeLength;
    this.bitsbuflen -= codeLength;

    return codeWithLength & 0xffff;
  }

  private parseBlock(): void
  {
    const hdr = this.readBits(3);
    if (hdr & 0x1) this.bfinal = true;

    switch (hdr >>> 1)
    {
      case 0:
        this.parseUncompressedBlock();
        break;
      case 1:
        this.parseFixedHuffmanBlock();
        break;
      case 2:
        this.parseDynamicHuffmanBlock();
        break;
      default:
        throw new Error(`Unknown BTYPE: ${hdr >>> 1}`);
    }
  }

  private parseUncompressedBlock(): void
  {
    const input = this.input;

    this.bitsbuf = 0;
    this.bitsbuflen = 0;

    if (this.ip + 4 > input.length)
    {
      throw new Error('Invalid uncompressed block header');
    }

    const len = input[this.ip++] | (input[this.ip++] << 8);
    const nlen = input[this.ip++] | (input[this.ip++] << 8);

    if (len !== (~nlen & 0xFFFF))
    {
      throw new Error('Invalid uncompressed block header: length verify');
    }

    if (this.ip + len > input.length)
    {
      throw new Error('Input buffer is broken');
    }

    this.expandBuffer(len);
    this.output.set(input.subarray(this.ip, this.ip + len), this.op);
    this.op += len;
    this.ip += len;
  }

  private parseFixedHuffmanBlock(): void
  {
    this.decodeHuffman(FixedLiteralLengthTable, FixedDistanceTable);
  }

  private parseDynamicHuffmanBlock(): void
  {
    const hlit = this.readBits(5) + 257;
    const hdist = this.readBits(5) + 1;
    const hclen = this.readBits(4) + 4;

    const codeLengths = new Uint8Array(Order.length);
    for (let i = 0; i < hclen; ++i)
    {
      codeLengths[Order[i]] = this.readBits(3);
    }

    const codeLengthsTable = Huffman.buildHuffmanTable(codeLengths);
    const lengthTable = new Uint8Array(hlit + hdist);

    let prev = 0;
    for (let i = 0; i < hlit + hdist;)
    {
      const code = this.readCodeByTable(codeLengthsTable);

      switch (code)
      {
        case 16:
        {
          let repeat = 3 + this.readBits(2);
          while (repeat--) lengthTable[i++] = prev;
          break;
        }
        case 17:
        {
          let repeat = 3 + this.readBits(3);
          while (repeat--) lengthTable[i++] = 0;
          prev = 0;
          break;
        }
        case 18:
        {
          let repeat = 11 + this.readBits(7);
          while (repeat--) lengthTable[i++] = 0;
          prev = 0;
          break;
        }
        default:
          lengthTable[i++] = code;
          prev = code;
          break;
      }
    }

    const litlenTable = Huffman.buildHuffmanTable(lengthTable.subarray(0, hlit));
    const distTable = Huffman.buildHuffmanTable(lengthTable.subarray(hlit));

    this.decodeHuffman(litlenTable, distTable);
  }

  private decodeHuffman(litlen: Huffman, dist: Huffman): void
  {
    this.currentLitlenTable = litlen;
    let code: number;

    while ((code = this.readCodeByTable(litlen)) !== 256)
    {
      if (code < 256)
      {
        this.expandBuffer(1);
        this.output[this.op++] = code;
        continue;
      }

      const ti = code - 257;
      let codeLength = LengthCodeTable[ti];
      if (LengthExtraTable[ti] > 0)
      {
        codeLength += this.readBits(LengthExtraTable[ti]);
      }

      code = this.readCodeByTable(dist);
      let codeDist = DistCodeTable[code];
      if (DistExtraTable[code] > 0)
      {
        codeDist += this.readBits(DistExtraTable[code]);
      }

      this.expandBuffer(codeLength);

      while (codeLength--)
      {
        this.output[this.op] = this.output[this.op - codeDist];
        this.op++;
      }
    }

    // Return unused bits
    while (this.bitsbuflen >= 8)
    {
      this.bitsbuflen -= 8;
      this.ip--;
    }
  }

  private expandBuffer(needed: number): void
  {
    if (this.op + needed <= this.output.length)
    {
      return;
    }

    // Calculate new size
    let newSize = this.output.length;
    while (this.op + needed > newSize)
    {
      newSize *= 2;
    }

    const newBuffer = new Uint8Array(newSize);
    newBuffer.set(this.output);
    this.output = newBuffer;
  }
}

// ============================================
// Public API
// ============================================

/**
 * Decompress raw DEFLATE data
 */
export function inflateRaw(data: Uint8Array): Uint8Array
{
  return new RawInflate(data).decompress();
}

/**
 * Decompress ZLIB-wrapped data (with header)
 */
export function inflate(data: Uint8Array): Uint8Array
{
  // Skip 2-byte ZLIB header
  if (data.length < 2)
  {
    throw new Error('Invalid ZLIB data');
  }

  // Check ZLIB header
  const cmf = data[0];
  const flg = data[1];

  // Check FCHECK
  if ((cmf * 256 + flg) % 31 !== 0)
  {
    throw new Error('Invalid ZLIB header checksum');
  }

  // Check compression method (should be 8 = DEFLATE)
  if ((cmf & 0x0F) !== 8)
  {
    throw new Error('Unsupported compression method');
  }

  // Skip header (2 bytes) and possibly FDICT (4 bytes)
  const offset = (flg & 0x20) ? 6 : 2;

  // Decompress (ignore 4-byte ADLER32 checksum at end)
  return inflateRaw(data.subarray(offset, data.length - 4));
}
