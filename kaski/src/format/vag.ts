/**
 * VAG Audio Format Decoder
 *
 * PSP/PlayStation ADPCM audio format decoder.
 * VAG files contain Sony's proprietary ADPCM compressed audio.
 */

import { Stream } from './stream';

// ============================================
// Constants
// ============================================

/**
 * VAG ADPCM prediction coefficients
 * Each pair [predict1, predict2] is used for one prediction index
 */
const VAG_COEFFICIENTS = [
  0, 0,
  60, 0,
  115, -52,
  98, -55,
  122, -60,
];

/**
 * VAG block types
 */
export const enum VagBlockType
{
  Normal = 0,
  LoopEnd = 3,
  LoopStart = 6,
  End = 7,
}

/**
 * Bytes per VAG block
 */
const BLOCK_SIZE = 16;

/**
 * Compressed sample bytes per block (excluding 2 header bytes)
 */
const COMPRESSED_BYTES_PER_BLOCK = 14;

/**
 * Samples per block (2 samples per byte × 14 bytes)
 */
const SAMPLES_PER_BLOCK = 28;

/**
 * VAG header size
 */
const VAG_HEADER_SIZE = 16;

/**
 * VAG magic: "VAGp"
 */
const VAG_MAGIC = 0x70474156; // 'VAGp' in little-endian

// ============================================
// Types
// ============================================

/**
 * VAG file header
 */
export interface VagHeader
{
  magic: number;
  version: number;
  dataSize: number;
  sampleRate: number;
}

/**
 * Audio sample (stereo)
 */
export interface AudioSample
{
  left: number;
  right: number;
}

/**
 * Decoder state (for saving/restoring at loop points)
 */
interface DecoderState
{
  blockIndex: number;
  sampleIndex: number;
  history1: number;
  history2: number;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Sign-extend a 16-bit value
 */
function signExtend16(value: number): number
{
  return (value << 16) >> 16;
}

/**
 * Clamp value to signed 16-bit range
 */
function clamp16(value: number): number
{
  if (value < -32768) return -32768;
  if (value > 32767) return 32767;
  return value | 0;
}

// ============================================
// VAG Header Parsing
// ============================================

/**
 * Parse VAG header from data
 */
export function parseVagHeader(data: Uint8Array): VagHeader | null
{
  if (data.length < VAG_HEADER_SIZE)
  {
    return null;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const magic = view.getUint32(0, true);

  // VAG header uses big-endian for version, dataSize, sampleRate
  return {
    magic,
    version: view.getUint32(4, false),  // big-endian
    dataSize: view.getUint32(8, false), // big-endian
    sampleRate: view.getUint32(12, false), // big-endian
  };
}

/**
 * Check if data is a VAG file
 */
export function isVag(data: Uint8Array): boolean
{
  if (data.length < 4)
  {
    return false;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const magic = view.getUint32(0, true);

  return magic === VAG_MAGIC;
}

// ============================================
// VAG Decoder
// ============================================

/**
 * VAG ADPCM block decoder
 */
export class VagDecoder
{
  private data: Uint8Array;
  private totalBlocks: number;
  private blockIndex = 0;
  private sampleIndex = 0;
  private decodedSamples: Int16Array;
  private history1 = 0;
  private history2 = 0;
  private reachedEnd = false;

  // Loop support
  private loopStack: DecoderState[] = [];
  private loopCount: number;
  private currentLoopCount = 0;

  constructor(data: Uint8Array, loopCount = 0)
  {
    this.data = data;
    this.totalBlocks = Math.floor(data.length / BLOCK_SIZE);
    this.decodedSamples = new Int16Array(SAMPLES_PER_BLOCK);
    this.loopCount = loopCount;

    // Decode first block
    if (this.totalBlocks > 0)
    {
      this.decodeNextBlock();
    }
    else
    {
      this.reachedEnd = true;
    }
  }

  /**
   * Decode the next block (called during construction and when samples exhausted)
   */
  private decodeNextBlock(): void
  {
    if (this.blockIndex >= this.totalBlocks)
    {
      this.reachedEnd = true;
      return;
    }

    const blockOffset = this.blockIndex * BLOCK_SIZE;
    const block = this.data.slice(blockOffset, blockOffset + BLOCK_SIZE);

    this.blockIndex++;
    this.sampleIndex = 0;

    // Check block type (second byte)
    const blockType = block[1] as VagBlockType;

    switch (blockType)
    {
      case VagBlockType.LoopStart:
        // Save state for potential loop back
        this.loopStack.push({
          blockIndex: this.blockIndex - 1,
          sampleIndex: 0,
          history1: this.history1,
          history2: this.history2,
        });
        break;

      case VagBlockType.LoopEnd:
        if (this.currentLoopCount < this.loopCount)
        {
          this.currentLoopCount++;
          const savedState = this.loopStack.pop();
          if (savedState)
          {
            this.restoreState(savedState);
            this.decodeNextBlock();
            return;
          }
        }
        else
        {
          this.loopStack.pop();
        }
        break;

      case VagBlockType.End:
        this.reachedEnd = true;
        return;
    }

    this.decodeBlock(block);
  }

  /**
   * Check if more samples are available
   */
  get hasMore(): boolean
  {
    if (this.reachedEnd) return false;

    // Still have samples in current block
    if (this.sampleIndex < SAMPLES_PER_BLOCK)
    {
      return true;
    }

    // Current block exhausted - check if next block exists and is not an End block
    if (this.blockIndex >= this.totalBlocks)
    {
      return false;
    }

    // Peek at next block type
    const nextBlockOffset = this.blockIndex * BLOCK_SIZE;
    const nextBlockType = this.data[nextBlockOffset + 1] as VagBlockType;

    return nextBlockType !== VagBlockType.End;
  }

  /**
   * Get total sample count
   */
  get sampleCount(): number
  {
    return this.totalBlocks * SAMPLES_PER_BLOCK;
  }

  /**
   * Reset decoder to beginning
   */
  reset(): void
  {
    this.blockIndex = 0;
    this.sampleIndex = 0;
    this.history1 = 0;
    this.history2 = 0;
    this.reachedEnd = false;
    this.loopStack = [];
    this.currentLoopCount = 0;

    // Decode first block
    if (this.totalBlocks > 0)
    {
      this.decodeNextBlock();
    }
    else
    {
      this.reachedEnd = true;
    }
  }

  /**
   * Get next audio sample
   */
  getNextSample(): AudioSample
  {
    if (this.reachedEnd)
    {
      return { left: 0, right: 0 };
    }

    // Decode next block if needed
    if (this.sampleIndex >= SAMPLES_PER_BLOCK)
    {
      this.decodeNextBlock();
      if (this.reachedEnd)
      {
        return { left: 0, right: 0 };
      }
    }

    const sample = this.decodedSamples[this.sampleIndex++];

    // VAG is mono, duplicate for stereo
    return { left: sample, right: sample };
  }

  /**
   * Decode a single VAG block
   */
  private decodeBlock(block: Uint8Array): void
  {
    // Extract shift factor and prediction index from first byte
    const shiftFactor = block[0] & 0x0F;
    const predictIndex = ((block[0] >> 4) & 0x0F) % 5; // 5 coefficient pairs

    const predict1 = VAG_COEFFICIENTS[predictIndex * 2];
    const predict2 = VAG_COEFFICIENTS[predictIndex * 2 + 1];

    let sampleOffset = 0;

    // Decode 14 bytes of compressed data (28 samples)
    for (let i = 0; i < COMPRESSED_BYTES_PER_BLOCK; i++)
    {
      const dataByte = block[i + 2]; // Skip 2-byte header

      // Each byte contains two 4-bit samples
      const nibble1 = (dataByte & 0x0F);
      const nibble2 = (dataByte >> 4) & 0x0F;

      // Sign-extend and shift
      const v1 = signExtend16(nibble1 << 12) >> shiftFactor;
      const v2 = signExtend16(nibble2 << 12) >> shiftFactor;

      // Apply ADPCM prediction
      this.decodedSamples[sampleOffset++] = this.decodeSample(v1, predict1, predict2);
      this.decodedSamples[sampleOffset++] = this.decodeSample(v2, predict1, predict2);
    }
  }

  /**
   * Decode single sample with prediction
   */
  private decodeSample(unpackedSample: number, predict1: number, predict2: number): number
  {
    let sample = unpackedSample;
    sample += Math.floor((this.history1 * predict1) / 64);
    sample += Math.floor((this.history2 * predict2) / 64);

    sample = clamp16(sample);

    // Update history
    this.history2 = this.history1;
    this.history1 = sample;

    return sample;
  }

  /**
   * Restore decoder state
   */
  private restoreState(state: DecoderState): void
  {
    this.blockIndex = state.blockIndex;
    this.sampleIndex = state.sampleIndex;
    this.history1 = state.history1;
    this.history2 = state.history2;
  }
}

// ============================================
// VAG Sound Source
// ============================================

/**
 * VAG file sound source
 */
export class VagSoundSource
{
  private header: VagHeader | null;
  private decoder: VagDecoder;
  private _sampleRate: number;

  constructor(data: Uint8Array, loopCount = 0)
  {
    if (data.length < VAG_HEADER_SIZE)
    {
      // No header, treat all as data
      this.header = null;
      this._sampleRate = 44100;
      this.decoder = new VagDecoder(data, loopCount);
    }
    else
    {
      this.header = parseVagHeader(data);

      if (this.header && this.header.magic === VAG_MAGIC)
      {
        // Skip header
        const audioData = data.slice(VAG_HEADER_SIZE);
        this._sampleRate = this.header.sampleRate || 44100;
        this.decoder = new VagDecoder(audioData, loopCount);
      }
      else
      {
        // No valid header, treat all as data
        this.header = null;
        this._sampleRate = 44100;
        this.decoder = new VagDecoder(data, loopCount);
      }
    }
  }

  /**
   * Get sample rate
   */
  get sampleRate(): number
  {
    return this._sampleRate;
  }

  /**
   * Check if more samples available
   */
  get hasMore(): boolean
  {
    return this.decoder.hasMore;
  }

  /**
   * Get total sample count
   */
  get sampleCount(): number
  {
    return this.decoder.sampleCount;
  }

  /**
   * Reset to beginning
   */
  reset(): void
  {
    this.decoder.reset();
  }

  /**
   * Get next sample
   */
  getNextSample(): AudioSample
  {
    return this.decoder.getNextSample();
  }

  /**
   * Decode all samples to PCM buffer
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
}

// ============================================
// Raw ADPCM Decoding (for SAS voices)
// ============================================

/**
 * Decode raw ADPCM data without header
 * Used by sceSasCore for voice audio
 */
export function decodeVagAdpcm(data: Uint8Array, loopCount = 0): Int16Array
{
  const decoder = new VagDecoder(data, loopCount);
  const samples: number[] = [];

  while (decoder.hasMore)
  {
    const sample = decoder.getNextSample();
    samples.push(sample.left);
  }

  return new Int16Array(samples);
}
