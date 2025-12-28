/**
 * CSO - Compressed ISO Format
 *
 * Parser for compressed ISO disc images commonly used by PSP games.
 * Provides transparent decompression when reading.
 */

import { Stream, AsyncStream } from './stream';
import { inflateRaw } from './zlib';

// ============================================
// Constants
// ============================================

/** CSO magic bytes */
const CSO_MAGIC = 'CISO';

/** Version 1 CSO (most common) */
const CSO_VERSION_1 = 1;

/** Version 2 CSO (supports LZ4) */
const CSO_VERSION_2 = 2;

// ============================================
// Types
// ============================================

/**
 * CSO file header
 */
export interface CsoHeader
{
  /** Magic (should be 'CISO') */
  magic: string;
  /** Header size */
  headerSize: number;
  /** Total uncompressed size */
  totalBytes: bigint;
  /** Block size (usually 2048) */
  blockSize: number;
  /** CSO version */
  version: number;
  /** Block alignment */
  alignment: number;
}

/**
 * Block information
 */
interface BlockInfo
{
  /** Block index */
  index: number;
  /** Offset in file */
  offset: number;
  /** Is block compressed? */
  compressed: boolean;
  /** Size of block data */
  size: number;
}

// ============================================
// CSO File
// ============================================

/**
 * CSO (Compressed ISO) File
 */
export class CsoFile
{
  readonly header: CsoHeader;

  private stream: Stream;
  private blockIndex: Uint32Array;
  private blockCache: Map<number, Uint8Array> = new Map();

  private constructor(stream: Stream, header: CsoHeader, blockIndex: Uint32Array)
  {
    this.stream = stream;
    this.header = header;
    this.blockIndex = blockIndex;
  }

  /**
   * Load CSO from Stream
   */
  static fromStream(stream: Stream): CsoFile
  {
    // Read header
    stream.seek(0);
    const header = CsoFile.parseHeader(stream);

    // Calculate number of blocks
    const numBlocks = Math.ceil(Number(header.totalBytes) / header.blockSize);

    // Read block index
    stream.seek(header.headerSize);
    const blockIndex = new Uint32Array(numBlocks + 1);
    for (let i = 0; i <= numBlocks; i++)
    {
      blockIndex[i] = stream.readUint32();
    }

    return new CsoFile(stream, header, blockIndex);
  }

  /**
   * Load CSO from buffer
   */
  static fromBuffer(buffer: ArrayBuffer): CsoFile
  {
    return CsoFile.fromStream(new Stream(buffer));
  }

  /**
   * Load CSO from Uint8Array
   */
  static fromUint8Array(data: Uint8Array): CsoFile
  {
    return CsoFile.fromStream(Stream.fromUint8Array(data));
  }

  /**
   * Check if data is a CSO file
   */
  static isCso(data: Uint8Array): boolean
  {
    if (data.length < 4) return false;
    const magic = String.fromCharCode(data[0], data[1], data[2], data[3]);
    return magic === CSO_MAGIC;
  }

  // ============================================
  // Properties
  // ============================================

  /**
   * Total uncompressed size
   */
  get size(): number
  {
    return Number(this.header.totalBytes);
  }

  /**
   * Number of blocks
   */
  get blockCount(): number
  {
    return this.blockIndex.length - 1;
  }

  // ============================================
  // Reading
  // ============================================

  /**
   * Read data at offset
   */
  read(offset: number, length: number): Uint8Array
  {
    const blockSize = this.header.blockSize;
    const startBlock = Math.floor(offset / blockSize);
    const endBlock = Math.floor((offset + length - 1) / blockSize);
    const startOffset = offset % blockSize;

    // Read and decompress all needed blocks
    const blocks: Uint8Array[] = [];
    for (let i = startBlock; i <= endBlock; i++)
    {
      blocks.push(this.readBlock(i));
    }

    // Combine blocks
    const combined = this.concatBlocks(blocks);

    // Extract requested portion
    return combined.slice(startOffset, startOffset + length);
  }

  /**
   * Read a single block
   */
  readBlock(index: number): Uint8Array
  {
    // Check cache
    const cached = this.blockCache.get(index);
    if (cached) return cached;

    const info = this.getBlockInfo(index);

    // Read compressed data
    this.stream.seek(info.offset);
    const compressedData = this.stream.readBytes(info.size);

    // Decompress if needed
    let blockData: Uint8Array;
    if (info.compressed)
    {
      blockData = inflateRaw(compressedData);
    }
    else
    {
      blockData = compressedData;
    }

    // Cache the block
    this.blockCache.set(index, blockData);

    return blockData;
  }

  /**
   * Clear the block cache
   */
  clearCache(): void
  {
    this.blockCache.clear();
  }

  // ============================================
  // Private Methods
  // ============================================

  private static parseHeader(stream: Stream): CsoHeader
  {
    const magic = stream.readString(4);
    if (magic !== CSO_MAGIC)
    {
      throw new Error(`Invalid CSO magic: ${magic}`);
    }

    const headerSize = stream.readUint32();
    const totalBytesLow = stream.readUint32();
    const totalBytesHigh = stream.readUint32();
    const totalBytes = BigInt(totalBytesLow) | (BigInt(totalBytesHigh) << 32n);
    const blockSize = stream.readUint32();
    const version = stream.readUint8();
    const alignment = stream.readUint8();
    stream.skip(2); // Reserved

    if (version !== CSO_VERSION_1 && version !== CSO_VERSION_2)
    {
      throw new Error(`Unsupported CSO version: ${version}`);
    }

    return {
      magic,
      headerSize,
      totalBytes,
      blockSize,
      version,
      alignment,
    };
  }

  private getBlockInfo(index: number): BlockInfo
  {
    const raw = this.blockIndex[index];
    const nextRaw = this.blockIndex[index + 1];

    const compressed = (raw & 0x80000000) === 0;
    const offset = raw & 0x7FFFFFFF;
    const nextOffset = nextRaw & 0x7FFFFFFF;
    const size = nextOffset - offset;

    return {
      index,
      offset,
      compressed,
      size,
    };
  }

  private concatBlocks(blocks: Uint8Array[]): Uint8Array
  {
    const totalLength = blocks.reduce((sum, b) => sum + b.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const block of blocks)
    {
      result.set(block, offset);
      offset += block.length;
    }

    return result;
  }
}

// ============================================
// Async CSO File
// ============================================

/**
 * Async CSO file for large files
 */
export class AsyncCsoFile
{
  readonly header: CsoHeader;

  private stream: AsyncStream;
  private blockIndex: Uint32Array;
  private blockCache: Map<number, Uint8Array> = new Map();

  private constructor(stream: AsyncStream, header: CsoHeader, blockIndex: Uint32Array)
  {
    this.stream = stream;
    this.header = header;
    this.blockIndex = blockIndex;
  }

  /**
   * Load CSO from async stream
   */
  static async fromStream(stream: AsyncStream): Promise<AsyncCsoFile>
  {
    // Read header
    const headerData = await stream.readChunk(0, 24);
    const headerStream = Stream.fromUint8Array(headerData);
    const header = CsoFile['parseHeader'](headerStream);

    // Calculate number of blocks
    const numBlocks = Math.ceil(Number(header.totalBytes) / header.blockSize);

    // Read block index
    const indexData = await stream.readChunk(header.headerSize, (numBlocks + 1) * 4);
    const blockIndex = new Uint32Array(indexData.buffer, indexData.byteOffset, numBlocks + 1);

    return new AsyncCsoFile(stream, header, blockIndex);
  }

  /**
   * Total uncompressed size
   */
  get size(): number
  {
    return Number(this.header.totalBytes);
  }

  /**
   * Number of blocks
   */
  get blockCount(): number
  {
    return this.blockIndex.length - 1;
  }

  /**
   * Read data at offset
   */
  async read(offset: number, length: number): Promise<Uint8Array>
  {
    const blockSize = this.header.blockSize;
    const startBlock = Math.floor(offset / blockSize);
    const endBlock = Math.floor((offset + length - 1) / blockSize);
    const startOffset = offset % blockSize;

    // Read all needed blocks
    const blocks: Uint8Array[] = [];
    for (let i = startBlock; i <= endBlock; i++)
    {
      blocks.push(await this.readBlock(i));
    }

    // Combine and extract
    const combined = this.concatBlocks(blocks);
    return combined.slice(startOffset, startOffset + length);
  }

  /**
   * Read a single block
   */
  async readBlock(index: number): Promise<Uint8Array>
  {
    // Check cache
    const cached = this.blockCache.get(index);
    if (cached) return cached;

    const info = this.getBlockInfo(index);

    // Read compressed data
    const compressedData = await this.stream.readChunk(info.offset, info.size);

    // Decompress if needed
    let blockData: Uint8Array;
    if (info.compressed)
    {
      blockData = inflateRaw(compressedData);
    }
    else
    {
      blockData = compressedData;
    }

    // Cache the block
    this.blockCache.set(index, blockData);

    return blockData;
  }

  /**
   * Clear the block cache
   */
  clearCache(): void
  {
    this.blockCache.clear();
  }

  private getBlockInfo(index: number): BlockInfo
  {
    const raw = this.blockIndex[index];
    const nextRaw = this.blockIndex[index + 1];

    const compressed = (raw & 0x80000000) === 0;
    const offset = raw & 0x7FFFFFFF;
    const nextOffset = nextRaw & 0x7FFFFFFF;
    const size = nextOffset - offset;

    return {
      index,
      offset,
      compressed,
      size,
    };
  }

  private concatBlocks(blocks: Uint8Array[]): Uint8Array
  {
    const totalLength = blocks.reduce((sum, b) => sum + b.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const block of blocks)
    {
      result.set(block, offset);
      offset += block.length;
    }

    return result;
  }
}
