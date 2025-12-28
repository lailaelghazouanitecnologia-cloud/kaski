/**
 * RIFF/WAV Format Tests
 */

import { describe, it, expect } from 'vitest';
import {
  isRiff,
  isWav,
  parseWav,
  RiffParser,
  WavSoundSource,
  RIFF_MAGIC,
  WAVE_TYPE,
  CHUNK_FMT,
  CHUNK_DATA,
  WaveFormatTag,
  chunkIdToString,
  stringToChunkId,
} from '../src/format/riff';

// ============================================
// Helper Functions
// ============================================

/**
 * Build a minimal valid WAV file
 */
function buildWavFile(options: {
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;
  samples?: number[];
} = {}): Uint8Array
{
  const sampleRate = options.sampleRate ?? 44100;
  const channels = options.channels ?? 1;
  const bitsPerSample = options.bitsPerSample ?? 16;
  const samples = options.samples ?? [0, 1000, -1000, 0];

  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const fmtSize = 16;
  const fileSize = 4 + 8 + fmtSize + 8 + dataSize;

  const buffer = new ArrayBuffer(8 + fileSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let offset = 0;

  // RIFF header
  view.setUint32(offset, RIFF_MAGIC, true);
  offset += 4;
  view.setUint32(offset, fileSize, true);
  offset += 4;
  view.setUint32(offset, WAVE_TYPE, true);
  offset += 4;

  // fmt chunk
  view.setUint32(offset, CHUNK_FMT, true);
  offset += 4;
  view.setUint32(offset, fmtSize, true);
  offset += 4;
  view.setUint16(offset, WaveFormatTag.PCM, true);
  offset += 2;
  view.setUint16(offset, channels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, bitsPerSample, true);
  offset += 2;

  // data chunk
  view.setUint32(offset, CHUNK_DATA, true);
  offset += 4;
  view.setUint32(offset, dataSize, true);
  offset += 4;

  // Sample data
  for (const sample of samples)
  {
    if (bitsPerSample === 8)
    {
      view.setUint8(offset, (sample + 32768) >> 8);
      offset += 1;
    }
    else if (bitsPerSample === 16)
    {
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return bytes;
}

// ============================================
// Detection Tests
// ============================================

describe('RIFF Detection', () =>
{
  it('should detect RIFF by magic', () =>
  {
    const data = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // size
      0x41, 0x56, 0x49, 0x20, // AVI
    ]);
    expect(isRiff(data)).toBe(true);
  });

  it('should detect WAV by magic and form type', () =>
  {
    const data = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // size
      0x57, 0x41, 0x56, 0x45, // WAVE
    ]);
    expect(isWav(data)).toBe(true);
    expect(isRiff(data)).toBe(true);
  });

  it('should reject non-RIFF data', () =>
  {
    const elf = new Uint8Array([0x7F, 0x45, 0x4C, 0x46]);
    expect(isRiff(elf)).toBe(false);
    expect(isWav(elf)).toBe(false);
  });

  it('should reject data too small', () =>
  {
    const small = new Uint8Array([0x52, 0x49, 0x46]);
    expect(isRiff(small)).toBe(false);
    expect(isWav(small)).toBe(false);
  });

  it('should distinguish WAV from other RIFF types', () =>
  {
    const avi = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // size
      0x41, 0x56, 0x49, 0x20, // AVI
    ]);
    expect(isRiff(avi)).toBe(true);
    expect(isWav(avi)).toBe(false);
  });
});

// ============================================
// Chunk ID Tests
// ============================================

describe('Chunk IDs', () =>
{
  it('should have correct constants', () =>
  {
    expect(chunkIdToString(RIFF_MAGIC)).toBe('RIFF');
    expect(chunkIdToString(WAVE_TYPE)).toBe('WAVE');
    expect(chunkIdToString(CHUNK_FMT)).toBe('fmt ');
    expect(chunkIdToString(CHUNK_DATA)).toBe('data');
  });

  it('should convert string to chunk ID', () =>
  {
    expect(stringToChunkId('RIFF')).toBe(RIFF_MAGIC);
    expect(stringToChunkId('WAVE')).toBe(WAVE_TYPE);
    expect(stringToChunkId('fmt ')).toBe(CHUNK_FMT);
    expect(stringToChunkId('data')).toBe(CHUNK_DATA);
  });

  it('should pad short strings', () =>
  {
    expect(stringToChunkId('fmt')).toBe(CHUNK_FMT);
  });
});

// ============================================
// WAV Parsing Tests
// ============================================

describe('WAV Parsing', () =>
{
  it('should parse minimal WAV file', () =>
  {
    const wav = buildWavFile();
    const parsed = parseWav(wav);

    expect(parsed.format.formatTag).toBe(WaveFormatTag.PCM);
    expect(parsed.format.channels).toBe(1);
    expect(parsed.format.sampleRate).toBe(44100);
    expect(parsed.format.bitsPerSample).toBe(16);
    expect(parsed.data.length).toBeGreaterThan(0);
  });

  it('should parse stereo WAV file', () =>
  {
    const wav = buildWavFile({
      channels: 2,
      samples: [0, 0, 1000, 1000, -1000, -1000, 0, 0],
    });
    const parsed = parseWav(wav);

    expect(parsed.format.channels).toBe(2);
    expect(parsed.data.length).toBe(16); // 8 samples × 2 bytes
  });

  it('should parse 8-bit WAV file', () =>
  {
    const wav = buildWavFile({
      bitsPerSample: 8,
      samples: [0, 100, -100, 0],
    });
    const parsed = parseWav(wav);

    expect(parsed.format.bitsPerSample).toBe(8);
    expect(parsed.data.length).toBe(4); // 4 samples × 1 byte
  });

  it('should parse different sample rates', () =>
  {
    const rates = [8000, 22050, 44100, 48000, 96000];

    for (const rate of rates)
    {
      const wav = buildWavFile({ sampleRate: rate });
      const parsed = parseWav(wav);

      expect(parsed.format.sampleRate).toBe(rate);
    }
  });

  it('should throw on non-WAV data', () =>
  {
    const data = new Uint8Array([0x7F, 0x45, 0x4C, 0x46]);
    expect(() => parseWav(data)).toThrow('Not a WAV file');
  });
});

// ============================================
// RiffParser Tests
// ============================================

describe('RiffParser', () =>
{
  it('should call handlers for each chunk', () =>
  {
    const chunks: string[] = [];
    const wav = buildWavFile();

    RiffParser.parseWithHandlers(wav, {
      'fmt ': () => chunks.push('fmt'),
      'data': () => chunks.push('data'),
    });

    expect(chunks).toContain('fmt');
    expect(chunks).toContain('data');
  });

  it('should return form type', () =>
  {
    const wav = buildWavFile();
    const parser = new RiffParser();
    parser.addHandler(CHUNK_FMT, () => {});
    parser.addHandler(CHUNK_DATA, () => {});

    const formType = parser.parse(wav);
    expect(formType).toBe('WAVE');
  });

  it('should throw on non-RIFF data', () =>
  {
    const data = new Uint8Array([0x7F, 0x45, 0x4C, 0x46]);
    const parser = new RiffParser();

    expect(() => parser.parse(data)).toThrow('Not a RIFF file');
  });
});

// ============================================
// WavSoundSource Tests
// ============================================

describe('WavSoundSource', () =>
{
  it('should read sample rate and channels', () =>
  {
    const wav = buildWavFile({
      sampleRate: 22050,
      channels: 2,
    });
    const source = new WavSoundSource(wav);

    expect(source.sampleRate).toBe(22050);
    expect(source.channels).toBe(2);
    expect(source.bitsPerSample).toBe(16);
  });

  it('should decode mono samples', () =>
  {
    const samples = [0, 1000, -1000, 0];
    const wav = buildWavFile({ samples });
    const source = new WavSoundSource(wav);

    expect(source.sampleCount).toBe(4);
    expect(source.hasMore).toBe(true);

    // Read samples
    const decoded: number[] = [];
    while (source.hasMore)
    {
      const sample = source.getNextSample();
      decoded.push(sample.left);
    }

    expect(decoded).toEqual(samples);
  });

  it('should duplicate mono to stereo', () =>
  {
    const wav = buildWavFile({ samples: [1000] });
    const source = new WavSoundSource(wav);
    const sample = source.getNextSample();

    expect(sample.left).toBe(1000);
    expect(sample.right).toBe(1000);
  });

  it('should decode all samples', () =>
  {
    const samples = [0, 500, 1000, 500, 0, -500, -1000, -500];
    const wav = buildWavFile({ samples });
    const source = new WavSoundSource(wav);

    const pcm = source.decodeAll();

    // Interleaved stereo output
    expect(pcm.length).toBe(16); // 8 samples × 2 channels
  });

  it('should reset properly', () =>
  {
    const wav = buildWavFile({ samples: [100, 200, 300] });
    const source = new WavSoundSource(wav);

    // Consume some samples
    source.getNextSample();
    source.getNextSample();

    // Reset
    source.reset();

    // Should start from beginning
    const sample = source.getNextSample();
    expect(sample.left).toBe(100);
  });

  it('should return zero samples when exhausted', () =>
  {
    const wav = buildWavFile({ samples: [100] });
    const source = new WavSoundSource(wav);

    source.getNextSample(); // Consume only sample

    const sample = source.getNextSample();
    expect(sample.left).toBe(0);
    expect(sample.right).toBe(0);
  });

  it('should get raw data', () =>
  {
    const wav = buildWavFile({ samples: [0, 0] });
    const source = new WavSoundSource(wav);

    const raw = source.getRawData();
    expect(raw.length).toBe(4); // 2 samples × 2 bytes
  });

  it('should get format info', () =>
  {
    const wav = buildWavFile({
      sampleRate: 48000,
      channels: 2,
      bitsPerSample: 16,
    });
    const source = new WavSoundSource(wav);
    const format = source.getFormat();

    expect(format.formatTag).toBe(WaveFormatTag.PCM);
    expect(format.sampleRate).toBe(48000);
    expect(format.channels).toBe(2);
    expect(format.bitsPerSample).toBe(16);
  });
});

// ============================================
// Audio Format Tests
// ============================================

describe('WaveFormatTag', () =>
{
  it('should have correct format values', () =>
  {
    expect(WaveFormatTag.PCM).toBe(0x0001);
    expect(WaveFormatTag.ADPCM).toBe(0x0002);
    expect(WaveFormatTag.IEEEFloat).toBe(0x0003);
    expect(WaveFormatTag.ALAW).toBe(0x0006);
    expect(WaveFormatTag.MULAW).toBe(0x0007);
  });
});

// ============================================
// Edge Cases
// ============================================

describe('Edge Cases', () =>
{
  it('should handle minimum size WAV', () =>
  {
    const wav = buildWavFile({ samples: [] });

    // Should parse without error even with no samples
    const source = new WavSoundSource(wav);
    expect(source.sampleCount).toBe(0);
    expect(source.hasMore).toBe(false);
  });

  it('should handle large sample values', () =>
  {
    const wav = buildWavFile({ samples: [32767, -32768] });
    const source = new WavSoundSource(wav);

    const sample1 = source.getNextSample();
    const sample2 = source.getNextSample();

    expect(sample1.left).toBe(32767);
    expect(sample2.left).toBe(-32768);
  });
});
