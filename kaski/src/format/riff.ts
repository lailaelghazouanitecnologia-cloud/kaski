/**
 * RIFF/WAV Audio Format Parser
 *
 * RIFF (Resource Interchange File Format) container parser.
 * Supports WAVE audio files with PCM and other formats.
 */

import { Stream } from './stream';

// ============================================
// Constants
// ============================================

/**
 * RIFF magic: "RIFF"
 */
export const RIFF_MAGIC = 0x46464952; // 'RIFF' little-endian

/**
 * WAVE form type: "WAVE"
 */
export const WAVE_TYPE = 0x45564157; // 'WAVE' little-endian

/**
 * Chunk IDs
 */
export const CHUNK_FMT = 0x20746D66;  // 'fmt '
export const CHUNK_DATA = 0x61746164; // 'data'
export const CHUNK_FACT = 0x74636166; // 'fact'
export const CHUNK_LIST = 0x5453494C; // 'LIST'

/**
 * Audio format codes
 */
export const enum WaveFormatTag
{
  PCM = 0x0001,
  ADPCM = 0x0002,
  IEEEFloat = 0x0003,
  ALAW = 0x0006,
  MULAW = 0x0007,
  DVIIMA = 0x0011,
  ATRAC3 = 0x0270,
  ATRAC3Plus = 0xFFFE,
}

// ============================================
// Types
// ============================================

/**
 * RIFF chunk header
 */
export interface RiffChunk
{
  id: number;
  size: number;
  data: Uint8Array;
}

/**
 * WAV format chunk (fmt)
 */
export interface WaveFormat
{
  formatTag: number;
  channels: number;
  sampleRate: number;
  avgBytesPerSec: number;
  blockAlign: number;
  bitsPerSample: number;
  extraData?: Uint8Array;
}

/**
 * WAV file structure
 */
export interface WaveFile
{
  format: WaveFormat;
  data: Uint8Array;
  factSampleCount?: number;
  chunks: Map<number, RiffChunk>;
}

/**
 * RIFF subchunk handler
 */
export type RiffSubchunkHandler = (stream: Stream) => void;

// ============================================
// Helper Functions
// ============================================

/**
 * Convert chunk ID to string
 */
export function chunkIdToString(id: number): string
{
  return String.fromCharCode(
    id & 0xFF,
    (id >> 8) & 0xFF,
    (id >> 16) & 0xFF,
    (id >> 24) & 0xFF
  );
}

/**
 * Convert string to chunk ID
 */
export function stringToChunkId(str: string): number
{
  if (str.length < 4) str = str.padEnd(4, ' ');
  return (
    str.charCodeAt(0) |
    (str.charCodeAt(1) << 8) |
    (str.charCodeAt(2) << 16) |
    (str.charCodeAt(3) << 24)
  );
}

// ============================================
// Detection
// ============================================

/**
 * Check if data is a RIFF file
 */
export function isRiff(data: Uint8Array): boolean
{
  if (data.length < 12)
  {
    return false;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const magic = view.getUint32(0, true);

  return magic === RIFF_MAGIC;
}

/**
 * Check if data is a WAV file
 */
export function isWav(data: Uint8Array): boolean
{
  if (data.length < 12)
  {
    return false;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const magic = view.getUint32(0, true);
  const formType = view.getUint32(8, true);

  return magic === RIFF_MAGIC && formType === WAVE_TYPE;
}

// ============================================
// RIFF Parser
// ============================================

/**
 * Generic RIFF container parser
 */
export class RiffParser
{
  private handlers = new Map<number, RiffSubchunkHandler>();

  /**
   * Add a handler for a specific chunk type
   */
  addHandler(chunkId: number | string, handler: RiffSubchunkHandler): void
  {
    const id = typeof chunkId === 'string' ? stringToChunkId(chunkId) : chunkId;
    this.handlers.set(id, handler);
  }

  /**
   * Parse RIFF file and call handlers for each chunk
   */
  parse(data: Uint8Array): string
  {
    const stream = Stream.fromUint8Array(data);

    // Read RIFF header
    const magic = stream.readUint32();
    if (magic !== RIFF_MAGIC)
    {
      throw new Error('Not a RIFF file');
    }

    const fileSize = stream.readUint32();
    const formType = stream.readUint32();

    const formTypeStr = chunkIdToString(formType);

    // Parse chunks
    while (stream.position < Math.min(stream.length, fileSize + 8))
    {
      if (stream.remaining < 8) break;

      const chunkId = stream.readUint32();
      const chunkSize = stream.readUint32();

      if (stream.remaining < chunkSize)
      {
        break;
      }

      const chunkData = stream.readBytes(chunkSize);
      const handler = this.handlers.get(chunkId);

      if (handler)
      {
        const chunkStream = Stream.fromUint8Array(chunkData);
        handler(chunkStream);
      }

      // Chunks are word-aligned
      if (chunkSize % 2 !== 0 && stream.remaining > 0)
      {
        stream.skip(1);
      }
    }

    return formTypeStr;
  }

  /**
   * Create parser with handlers and parse
   */
  static parseWithHandlers(
    data: Uint8Array,
    handlers: Record<string, RiffSubchunkHandler>
  ): string
  {
    const parser = new RiffParser();

    for (const [name, handler] of Object.entries(handlers))
    {
      parser.addHandler(name, handler);
    }

    return parser.parse(data);
  }
}

// ============================================
// WAV Parser
// ============================================

/**
 * Parse WAV format chunk
 */
function parseFormatChunk(data: Uint8Array): WaveFormat
{
  if (data.length < 16)
  {
    throw new Error('Format chunk too small');
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const format: WaveFormat = {
    formatTag: view.getUint16(0, true),
    channels: view.getUint16(2, true),
    sampleRate: view.getUint32(4, true),
    avgBytesPerSec: view.getUint32(8, true),
    blockAlign: view.getUint16(12, true),
    bitsPerSample: view.getUint16(14, true),
  };

  // Extended format data
  if (data.length > 16)
  {
    const extraSize = view.getUint16(16, true);
    if (data.length >= 18 + extraSize)
    {
      format.extraData = data.slice(18, 18 + extraSize);
    }
  }

  return format;
}

/**
 * Parse WAV file
 */
export function parseWav(data: Uint8Array): WaveFile
{
  if (!isWav(data))
  {
    throw new Error('Not a WAV file');
  }

  const chunks = new Map<number, RiffChunk>();
  let format: WaveFormat | null = null;
  let audioData: Uint8Array | null = null;
  let factSampleCount: number | undefined;

  const parser = new RiffParser();

  parser.addHandler(CHUNK_FMT, (stream: Stream) =>
  {
    const chunkData = stream.readBytes(stream.remaining);
    format = parseFormatChunk(chunkData);
    chunks.set(CHUNK_FMT, { id: CHUNK_FMT, size: chunkData.length, data: chunkData });
  });

  parser.addHandler(CHUNK_DATA, (stream: Stream) =>
  {
    audioData = stream.readBytes(stream.remaining);
    chunks.set(CHUNK_DATA, { id: CHUNK_DATA, size: audioData.length, data: audioData });
  });

  parser.addHandler(CHUNK_FACT, (stream: Stream) =>
  {
    if (stream.remaining >= 4)
    {
      factSampleCount = stream.readUint32();
    }
    const chunkData = new Uint8Array(4);
    new DataView(chunkData.buffer).setUint32(0, factSampleCount || 0, true);
    chunks.set(CHUNK_FACT, { id: CHUNK_FACT, size: 4, data: chunkData });
  });

  parser.parse(data);

  if (!format)
  {
    throw new Error('Missing format chunk');
  }

  if (!audioData)
  {
    throw new Error('Missing data chunk');
  }

  return {
    format,
    data: audioData,
    factSampleCount,
    chunks,
  };
}

// ============================================
// WAV Sound Source
// ============================================

/**
 * Audio sample (stereo)
 */
export interface AudioSample
{
  left: number;
  right: number;
}

/**
 * WAV file sound source (PCM only)
 */
export class WavSoundSource
{
  private wav: WaveFile;
  private samplePosition = 0;
  private totalSamples: number;
  private bytesPerSample: number;

  constructor(data: Uint8Array)
  {
    this.wav = parseWav(data);

    if (this.wav.format.formatTag !== WaveFormatTag.PCM)
    {
      throw new Error(`Unsupported WAV format: 0x${this.wav.format.formatTag.toString(16)}`);
    }

    this.bytesPerSample = this.wav.format.bitsPerSample / 8;
    this.totalSamples = Math.floor(
      this.wav.data.length / (this.bytesPerSample * this.wav.format.channels)
    );
  }

  /**
   * Get sample rate
   */
  get sampleRate(): number
  {
    return this.wav.format.sampleRate;
  }

  /**
   * Get number of channels
   */
  get channels(): number
  {
    return this.wav.format.channels;
  }

  /**
   * Get bits per sample
   */
  get bitsPerSample(): number
  {
    return this.wav.format.bitsPerSample;
  }

  /**
   * Check if more samples available
   */
  get hasMore(): boolean
  {
    return this.samplePosition < this.totalSamples;
  }

  /**
   * Get total sample count
   */
  get sampleCount(): number
  {
    return this.totalSamples;
  }

  /**
   * Reset to beginning
   */
  reset(): void
  {
    this.samplePosition = 0;
  }

  /**
   * Get next sample
   */
  getNextSample(): AudioSample
  {
    if (!this.hasMore)
    {
      return { left: 0, right: 0 };
    }

    const offset = this.samplePosition * this.bytesPerSample * this.wav.format.channels;
    const view = new DataView(
      this.wav.data.buffer,
      this.wav.data.byteOffset + offset,
      this.bytesPerSample * this.wav.format.channels
    );

    let left: number;
    let right: number;

    // Read left channel
    if (this.bytesPerSample === 1)
    {
      // 8-bit unsigned
      left = (view.getUint8(0) - 128) * 256;
    }
    else if (this.bytesPerSample === 2)
    {
      // 16-bit signed
      left = view.getInt16(0, true);
    }
    else if (this.bytesPerSample === 3)
    {
      // 24-bit signed
      const b0 = view.getUint8(0);
      const b1 = view.getUint8(1);
      const b2 = view.getInt8(2);
      left = ((b2 << 16) | (b1 << 8) | b0) >> 8;
    }
    else if (this.bytesPerSample === 4)
    {
      // 32-bit signed (scale to 16-bit)
      left = view.getInt32(0, true) >> 16;
    }
    else
    {
      left = 0;
    }

    // Read right channel (or duplicate mono)
    if (this.wav.format.channels >= 2)
    {
      if (this.bytesPerSample === 1)
      {
        right = (view.getUint8(1) - 128) * 256;
      }
      else if (this.bytesPerSample === 2)
      {
        right = view.getInt16(2, true);
      }
      else if (this.bytesPerSample === 3)
      {
        const b0 = view.getUint8(3);
        const b1 = view.getUint8(4);
        const b2 = view.getInt8(5);
        right = ((b2 << 16) | (b1 << 8) | b0) >> 8;
      }
      else if (this.bytesPerSample === 4)
      {
        right = view.getInt32(4, true) >> 16;
      }
      else
      {
        right = 0;
      }
    }
    else
    {
      right = left;
    }

    this.samplePosition++;
    return { left, right };
  }

  /**
   * Decode all samples to interleaved PCM buffer
   */
  decodeAll(): Int16Array
  {
    this.reset();

    const samples: number[] = [];

    while (this.hasMore)
    {
      const sample = this.getNextSample();
      samples.push(sample.left);
      samples.push(sample.right);
    }

    return new Int16Array(samples);
  }

  /**
   * Get raw audio data
   */
  getRawData(): Uint8Array
  {
    return this.wav.data;
  }

  /**
   * Get wave format info
   */
  getFormat(): WaveFormat
  {
    return this.wav.format;
  }
}
