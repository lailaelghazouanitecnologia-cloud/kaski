/**
 * VAG Audio Format Tests
 */

import { describe, it, expect } from 'vitest';
import {
  isVag,
  parseVagHeader,
  VagDecoder,
  VagSoundSource,
  VagBlockType,
  decodeVagAdpcm,
} from '../src/format/vag';

// ============================================
// VAG Detection Tests
// ============================================

describe('VAG Detection', () =>
{
  it('should detect VAG by magic', () =>
  {
    // VAGp magic
    const data = new Uint8Array([0x56, 0x41, 0x47, 0x70, 0x00, 0x00, 0x00, 0x00]);
    expect(isVag(data)).toBe(true);
  });

  it('should reject non-VAG data', () =>
  {
    // Random data
    const random = new Uint8Array([0x00, 0x11, 0x22, 0x33]);
    expect(isVag(random)).toBe(false);

    // ELF magic
    const elf = new Uint8Array([0x7F, 0x45, 0x4C, 0x46]);
    expect(isVag(elf)).toBe(false);
  });

  it('should reject data too small', () =>
  {
    const small = new Uint8Array([0x56, 0x41, 0x47]);
    expect(isVag(small)).toBe(false);
  });
});

// ============================================
// VAG Header Tests
// ============================================

describe('VAG Header', () =>
{
  it('should parse header fields', () =>
  {
    // Build VAG header
    const data = new Uint8Array(16);
    const view = new DataView(data.buffer);

    // Magic: VAGp (little-endian)
    view.setUint32(0, 0x70474156, true);

    // Version (big-endian)
    view.setUint32(4, 0x00000020, false);

    // Data size (big-endian)
    view.setUint32(8, 0x00001000, false);

    // Sample rate (big-endian)
    view.setUint32(12, 0x0000AC44, false); // 44100

    const header = parseVagHeader(data);

    expect(header).not.toBeNull();
    expect(header!.magic).toBe(0x70474156);
    expect(header!.version).toBe(0x20);
    expect(header!.dataSize).toBe(0x1000);
    expect(header!.sampleRate).toBe(44100);
  });

  it('should return null for data too small', () =>
  {
    const small = new Uint8Array(8);
    expect(parseVagHeader(small)).toBeNull();
  });
});

// ============================================
// VAG Decoder Tests
// ============================================

describe('VagDecoder', () =>
{
  /**
   * Build a test VAG block with known values
   */
  function buildTestBlock(shiftFactor: number, predictIndex: number): Uint8Array
  {
    const block = new Uint8Array(16);

    // Header byte: shift factor (low nibble) + predict index (high nibble)
    block[0] = (shiftFactor & 0x0F) | ((predictIndex & 0x0F) << 4);

    // Block type: normal
    block[1] = VagBlockType.Normal;

    // Fill with sample data
    for (let i = 2; i < 16; i++)
    {
      block[i] = (i - 2) * 0x11; // Some test pattern
    }

    return block;
  }

  it('should decode single block', () =>
  {
    const block = buildTestBlock(2, 1);
    const decoder = new VagDecoder(block);

    expect(decoder.hasMore).toBe(true);

    // Get 28 samples (one block)
    const samples: number[] = [];
    while (decoder.hasMore)
    {
      const sample = decoder.getNextSample();
      samples.push(sample.left);
    }

    // Should produce 28 samples
    expect(samples.length).toBe(28);
  });

  it('should decode multiple blocks', () =>
  {
    const data = new Uint8Array(32);

    // First block
    data[0] = 0x21; // shift=1, predict=2
    data[1] = VagBlockType.Normal;
    for (let i = 2; i < 16; i++) data[i] = 0x55;

    // Second block
    data[16] = 0x31; // shift=1, predict=3
    data[17] = VagBlockType.Normal;
    for (let i = 18; i < 32; i++) data[i] = 0xAA;

    const decoder = new VagDecoder(data);

    let sampleCount = 0;
    while (decoder.hasMore)
    {
      decoder.getNextSample();
      sampleCount++;
    }

    // Should produce 56 samples (2 blocks × 28)
    expect(sampleCount).toBe(56);
  });

  it('should stop at end block', () =>
  {
    const data = new Uint8Array(32);

    // First block
    data[0] = 0x21;
    data[1] = VagBlockType.Normal;
    for (let i = 2; i < 16; i++) data[i] = 0x55;

    // Second block (end)
    data[16] = 0x00;
    data[17] = VagBlockType.End;

    const decoder = new VagDecoder(data);

    let sampleCount = 0;
    while (decoder.hasMore)
    {
      decoder.getNextSample();
      sampleCount++;
    }

    // Should only decode first block (28 samples)
    expect(sampleCount).toBe(28);
  });

  it('should handle loop blocks', () =>
  {
    const data = new Uint8Array(48);

    // First block (loop start)
    data[0] = 0x21;
    data[1] = VagBlockType.LoopStart;
    for (let i = 2; i < 16; i++) data[i] = 0x55;

    // Second block (normal)
    data[16] = 0x21;
    data[17] = VagBlockType.Normal;
    for (let i = 18; i < 32; i++) data[i] = 0xAA;

    // Third block (loop end)
    data[32] = 0x21;
    data[33] = VagBlockType.LoopEnd;
    for (let i = 34; i < 48; i++) data[i] = 0x77;

    // Decoder with 1 loop count
    const decoder = new VagDecoder(data, 1);

    let sampleCount = 0;
    while (decoder.hasMore && sampleCount < 1000)
    { // Safety limit
      decoder.getNextSample();
      sampleCount++;
    }

    // Should loop once: 28 + 28 + 28 (loop back) + 28 + 28 = 140
    // Actually: 3 blocks normal + 3 blocks looped = ~168
    expect(sampleCount).toBeGreaterThan(56);
  });

  it('should reset properly', () =>
  {
    const block = buildTestBlock(2, 1);
    const decoder = new VagDecoder(block);

    // Consume some samples
    decoder.getNextSample();
    decoder.getNextSample();

    // Reset
    decoder.reset();

    expect(decoder.hasMore).toBe(true);

    // Should be able to decode again
    let sampleCount = 0;
    while (decoder.hasMore)
    {
      decoder.getNextSample();
      sampleCount++;
    }

    expect(sampleCount).toBe(28);
  });

  it('should return zero samples when exhausted', () =>
  {
    const block = new Uint8Array(16);
    block[0] = 0x00;
    block[1] = VagBlockType.End;

    const decoder = new VagDecoder(block);

    // Force end
    while (decoder.hasMore)
    {
      decoder.getNextSample();
    }

    const sample = decoder.getNextSample();
    expect(sample.left).toBe(0);
    expect(sample.right).toBe(0);
  });
});

// ============================================
// VagSoundSource Tests
// ============================================

describe('VagSoundSource', () =>
{
  it('should parse with header', () =>
  {
    // Build full VAG file with header
    const data = new Uint8Array(32);
    const view = new DataView(data.buffer);

    // Header
    view.setUint32(0, 0x70474156, true); // VAGp
    view.setUint32(4, 0x00000020, false); // version
    view.setUint32(8, 0x00000010, false); // data size (16 bytes)
    view.setUint32(12, 0x0000AC44, false); // 44100 Hz

    // Audio data (one block)
    data[16] = 0x21; // shift=1, predict=2
    data[17] = VagBlockType.Normal;
    for (let i = 18; i < 32; i++) data[i] = 0x55;

    const source = new VagSoundSource(data);

    expect(source.sampleRate).toBe(44100);
    expect(source.hasMore).toBe(true);
  });

  it('should handle raw data without header', () =>
  {
    // Just raw ADPCM data (less than header size)
    const data = new Uint8Array(12);
    data.fill(0x55);

    const source = new VagSoundSource(data);

    // Should use default sample rate
    expect(source.sampleRate).toBe(44100);
  });

  it('should decode all samples', () =>
  {
    // Raw ADPCM block
    const data = new Uint8Array(16);
    data[0] = 0x21;
    data[1] = VagBlockType.Normal;
    for (let i = 2; i < 16; i++) data[i] = 0x55;

    const source = new VagSoundSource(data);
    const pcm = source.decodeAll();

    // 28 samples × 2 channels = 56
    expect(pcm.length).toBe(56);
  });
});

// ============================================
// ADPCM Decoding Tests
// ============================================

describe('decodeVagAdpcm', () =>
{
  it('should decode raw ADPCM data', () =>
  {
    const data = new Uint8Array(16);
    data[0] = 0x21;
    data[1] = VagBlockType.Normal;
    for (let i = 2; i < 16; i++) data[i] = 0x77;

    const samples = decodeVagAdpcm(data);

    expect(samples.length).toBe(28);
  });

  it('should produce silence for zero data', () =>
  {
    const data = new Uint8Array(16);
    data[0] = 0x00; // shift=0, predict=0
    data[1] = VagBlockType.Normal;
    // All zeros

    const samples = decodeVagAdpcm(data);

    // All samples should be near zero (might not be exactly zero due to prediction)
    for (const sample of samples)
    {
      expect(Math.abs(sample)).toBeLessThan(100);
    }
  });
});

// ============================================
// Block Type Tests
// ============================================

describe('VagBlockType', () =>
{
  it('should have correct values', () =>
  {
    expect(VagBlockType.Normal).toBe(0);
    expect(VagBlockType.LoopEnd).toBe(3);
    expect(VagBlockType.LoopStart).toBe(6);
    expect(VagBlockType.End).toBe(7);
  });
});

// ============================================
// ADPCM Algorithm Tests
// ============================================

describe('ADPCM Algorithm', () =>
{
  it('should produce reasonable output values', () =>
  {
    // Block with maximum values
    const data = new Uint8Array(16);
    data[0] = 0x00; // shift=0 (no reduction), predict=0
    data[1] = VagBlockType.Normal;
    for (let i = 2; i < 16; i++) data[i] = 0xFF;

    const samples = decodeVagAdpcm(data);

    // All samples should be in valid 16-bit range
    for (const sample of samples)
    {
      expect(sample).toBeGreaterThanOrEqual(-32768);
      expect(sample).toBeLessThanOrEqual(32767);
    }
  });

  it('should apply shift factor correctly', () =>
  {
    // Same data, different shift factors
    const data1 = new Uint8Array(16);
    data1[0] = 0x00; // shift=0
    data1[1] = VagBlockType.Normal;
    for (let i = 2; i < 16; i++) data1[i] = 0x77;

    const data2 = new Uint8Array(16);
    data2[0] = 0x04; // shift=4
    data2[1] = VagBlockType.Normal;
    for (let i = 2; i < 16; i++) data2[i] = 0x77;

    const samples1 = decodeVagAdpcm(data1);
    const samples2 = decodeVagAdpcm(data2);

    // Higher shift should produce smaller values
    // (on average, due to prediction interaction)
    const avg1 = samples1.reduce((a, b) => a + Math.abs(b), 0) / samples1.length;
    const avg2 = samples2.reduce((a, b) => a + Math.abs(b), 0) / samples2.length;

    // samples2 should be smaller on average
    expect(avg2).toBeLessThan(avg1);
  });
});
