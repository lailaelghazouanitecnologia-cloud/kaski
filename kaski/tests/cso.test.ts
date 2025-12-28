/**
 * CSO Format Tests
 */

import { describe, it, expect } from 'vitest';
import { CsoFile, AsyncCsoFile } from '../src/format/cso';
import { inflateRaw, inflate } from '../src/format/zlib';

// ============================================
// ZLIB Tests
// ============================================

describe('ZLIB', () =>
{
  describe('inflateRaw', () =>
  {
    it('should decompress raw DEFLATE data', () =>
    {
      // Compressed "Hello" using DEFLATE (raw, no header)
      // This is a minimal DEFLATE stream
      const compressed = new Uint8Array([
        0xF3, 0x48, 0xCD, 0xC9, 0xC9, 0x07, 0x00
      ]);

      const decompressed = inflateRaw(compressed);
      const text = new TextDecoder().decode(decompressed);

      expect(text).toBe('Hello');
    });

    it('should decompress repeated data efficiently', () =>
    {
      // Compressed repeated 'A' characters
      const compressed = new Uint8Array([
        0x73, 0x74, 0x72, 0x76, 0x01, 0x00
      ]);

      const decompressed = inflateRaw(compressed);

      expect(decompressed.length).toBeGreaterThan(0);
    });

    it('should handle uncompressed blocks', () =>
    {
      // Raw DEFLATE with uncompressed block
      // BFINAL=1, BTYPE=00 (uncompressed), LEN=5, NLEN=~5, "Hello"
      const compressed = new Uint8Array([
        0x01, 0x05, 0x00, 0xFA, 0xFF,
        0x48, 0x65, 0x6C, 0x6C, 0x6F  // "Hello"
      ]);

      const decompressed = inflateRaw(compressed);
      const text = new TextDecoder().decode(decompressed);

      expect(text).toBe('Hello');
    });
  });

  describe('inflate', () =>
  {
    it('should decompress ZLIB-wrapped data', () =>
    {
      // ZLIB header (CMF=0x78, FLG=0x9C) + compressed "Hello" + Adler32
      const compressed = new Uint8Array([
        0x78, 0x9C,  // ZLIB header
        0xF3, 0x48, 0xCD, 0xC9, 0xC9, 0x07, 0x00,  // DEFLATE data
        0x05, 0x8C, 0x01, 0xF5  // Adler32 checksum
      ]);

      const decompressed = inflate(compressed);
      const text = new TextDecoder().decode(decompressed);

      expect(text).toBe('Hello');
    });

    it('should reject invalid ZLIB header', () =>
    {
      const invalid = new Uint8Array([0x00, 0x00, 0x00, 0x00]);

      expect(() => inflate(invalid)).toThrow();
    });
  });
});

// ============================================
// CSO Header Tests
// ============================================

describe('CsoFile', () =>
{
  /**
   * Build a minimal CSO file for testing
   */
  function buildTestCso(): Uint8Array
  {
    const blockSize = 2048;
    const numBlocks = 2;
    const headerSize = 24;
    const indexSize = (numBlocks + 1) * 4;
    const dataOffset = headerSize + indexSize;

    // Create test data (uncompressed for simplicity)
    const block1Data = new Uint8Array(blockSize);
    block1Data.fill(0x41); // 'A'

    const block2Data = new Uint8Array(blockSize);
    block2Data.fill(0x42); // 'B'

    // Calculate total size
    const totalSize = headerSize + indexSize + block1Data.length + block2Data.length;
    const cso = new Uint8Array(totalSize);
    const view = new DataView(cso.buffer);

    // Header
    cso.set(new TextEncoder().encode('CISO'), 0);
    view.setUint32(4, headerSize, true);  // Header size
    view.setUint32(8, numBlocks * blockSize, true);  // Total bytes (low)
    view.setUint32(12, 0, true);  // Total bytes (high)
    view.setUint32(16, blockSize, true);  // Block size
    cso[20] = 1;  // Version
    cso[21] = 0;  // Alignment
    cso[22] = 0;  // Reserved
    cso[23] = 0;  // Reserved

    // Block index (with MSB set = uncompressed)
    const block1Offset = dataOffset;
    const block2Offset = dataOffset + block1Data.length;
    const endOffset = dataOffset + block1Data.length + block2Data.length;

    view.setUint32(headerSize + 0, block1Offset | 0x80000000, true);  // Block 0 (uncompressed)
    view.setUint32(headerSize + 4, block2Offset | 0x80000000, true);  // Block 1 (uncompressed)
    view.setUint32(headerSize + 8, endOffset | 0x80000000, true);     // End marker

    // Data
    cso.set(block1Data, block1Offset);
    cso.set(block2Data, block2Offset);

    return cso;
  }

  describe('Parsing', () =>
  {
    it('should parse CSO header', () =>
    {
      const csoData = buildTestCso();
      const cso = CsoFile.fromUint8Array(csoData);

      expect(cso.header.magic).toBe('CISO');
      expect(cso.header.version).toBe(1);
      expect(cso.header.blockSize).toBe(2048);
      expect(cso.size).toBe(4096);
      expect(cso.blockCount).toBe(2);
    });

    it('should detect CSO files', () =>
    {
      const csoData = buildTestCso();
      expect(CsoFile.isCso(csoData)).toBe(true);

      const notCso = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      expect(CsoFile.isCso(notCso)).toBe(false);

      const tooShort = new Uint8Array([0x43]);
      expect(CsoFile.isCso(tooShort)).toBe(false);
    });

    it('should reject non-CSO files', () =>
    {
      const notCso = new Uint8Array(100);
      notCso.set(new TextEncoder().encode('NOTC'), 0);

      expect(() => CsoFile.fromUint8Array(notCso)).toThrow('Invalid CSO magic');
    });
  });

  describe('Reading', () =>
  {
    it('should read uncompressed blocks', () =>
    {
      const csoData = buildTestCso();
      const cso = CsoFile.fromUint8Array(csoData);

      const block0 = cso.readBlock(0);
      expect(block0.length).toBe(2048);
      expect(block0[0]).toBe(0x41); // 'A'

      const block1 = cso.readBlock(1);
      expect(block1.length).toBe(2048);
      expect(block1[0]).toBe(0x42); // 'B'
    });

    it('should read data at offset', () =>
    {
      const csoData = buildTestCso();
      const cso = CsoFile.fromUint8Array(csoData);

      // Read from first block
      const data1 = cso.read(0, 10);
      expect(data1.length).toBe(10);
      expect(data1[0]).toBe(0x41);

      // Read from second block
      const data2 = cso.read(2048, 10);
      expect(data2.length).toBe(10);
      expect(data2[0]).toBe(0x42);
    });

    it('should read across block boundaries', () =>
    {
      const csoData = buildTestCso();
      const cso = CsoFile.fromUint8Array(csoData);

      // Read from end of block 0 into block 1
      const data = cso.read(2040, 20);

      expect(data.length).toBe(20);
      expect(data[0]).toBe(0x41);  // From block 0
      expect(data[8]).toBe(0x42);  // From block 1
    });

    it('should cache blocks', () =>
    {
      const csoData = buildTestCso();
      const cso = CsoFile.fromUint8Array(csoData);

      // Read same block twice
      const block1 = cso.readBlock(0);
      const block2 = cso.readBlock(0);

      // Should be same cached reference
      expect(block1).toBe(block2);
    });

    it('should clear cache', () =>
    {
      const csoData = buildTestCso();
      const cso = CsoFile.fromUint8Array(csoData);

      const block1 = cso.readBlock(0);
      cso.clearCache();
      const block2 = cso.readBlock(0);

      // Different references after cache clear
      expect(block1).not.toBe(block2);
      // But same content
      expect(block1[0]).toBe(block2[0]);
    });
  });

  describe('Properties', () =>
  {
    it('should report correct size', () =>
    {
      const csoData = buildTestCso();
      const cso = CsoFile.fromUint8Array(csoData);

      expect(cso.size).toBe(4096);
    });

    it('should report correct block count', () =>
    {
      const csoData = buildTestCso();
      const cso = CsoFile.fromUint8Array(csoData);

      expect(cso.blockCount).toBe(2);
    });
  });
});

// ============================================
// Compressed CSO Tests
// ============================================

describe('CsoFile with compression', () =>
{
  /**
   * Build a CSO with a compressed block
   */
  function buildCompressedCso(): Uint8Array
  {
    const blockSize = 2048;
    const headerSize = 24;

    // Create compressed block data
    // This is "Hello" compressed with raw DEFLATE
    const compressedBlock = new Uint8Array([
      0xF3, 0x48, 0xCD, 0xC9, 0xC9, 0x07, 0x00
    ]);

    const indexSize = 2 * 4; // 2 entries (1 block + end)
    const dataOffset = headerSize + indexSize;
    const totalSize = dataOffset + compressedBlock.length;

    const cso = new Uint8Array(totalSize);
    const view = new DataView(cso.buffer);

    // Header
    cso.set(new TextEncoder().encode('CISO'), 0);
    view.setUint32(4, headerSize, true);
    view.setUint32(8, blockSize, true);  // Uncompressed size = 1 block
    view.setUint32(12, 0, true);
    view.setUint32(16, blockSize, true);
    cso[20] = 1;
    cso[21] = 0;

    // Block index (no MSB = compressed)
    view.setUint32(headerSize + 0, dataOffset, true);  // Block 0 (compressed)
    view.setUint32(headerSize + 4, dataOffset + compressedBlock.length, true);

    // Data
    cso.set(compressedBlock, dataOffset);

    return cso;
  }

  it('should decompress blocks', () =>
  {
    const csoData = buildCompressedCso();
    const cso = CsoFile.fromUint8Array(csoData);

    const block = cso.readBlock(0);
    const text = new TextDecoder().decode(block.slice(0, 5));

    expect(text).toBe('Hello');
  });
});
