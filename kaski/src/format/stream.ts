/**
 * Stream - Binary data reading abstraction
 *
 * Provides convenient methods for reading binary data from ArrayBuffer.
 * Supports both synchronous and position-tracked reading.
 */

export class Stream
{
  private view: DataView;
  private u8: Uint8Array;
  private _position: number = 0;

  constructor(
    public readonly buffer: ArrayBuffer,
    public readonly offset: number = 0,
    public readonly length: number = buffer.byteLength
  )
  {
    this.view = new DataView(buffer, offset, length);
    this.u8 = new Uint8Array(buffer, offset, length);
  }

  /**
   * Create stream from Uint8Array
   */
  static fromUint8Array(data: Uint8Array): Stream
  {
    return new Stream(data.buffer, data.byteOffset, data.byteLength);
  }

  /**
   * Create stream from base64 string
   */
  static fromBase64(base64: string): Stream
  {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++)
    {
      bytes[i] = binary.charCodeAt(i);
    }
    return Stream.fromUint8Array(bytes);
  }

  // ============================================
  // Position management
  // ============================================

  get position(): number { return this._position; }
  set position(value: number) { this._position = value; }

  get remaining(): number { return this.length - this._position; }
  get eof(): boolean { return this._position >= this.length; }

  seek(position: number): this
  {
    this._position = position;
    return this;
  }

  skip(bytes: number): this
  {
    this._position += bytes;
    return this;
  }

  align(alignment: number): this
  {
    const mod = this._position % alignment;
    if (mod !== 0)
    {
      this._position += alignment - mod;
    }
    return this;
  }

  // ============================================
  // Slicing
  // ============================================

  /**
   * Create a sub-stream at current position
   */
  slice(length: number): Stream
  {
    const stream = new Stream(this.buffer, this.offset + this._position, length);
    this._position += length;
    return stream;
  }

  /**
   * Create a sub-stream at specific offset
   */
  sliceAt(offset: number, length: number): Stream
  {
    return new Stream(this.buffer, this.offset + offset, length);
  }

  /**
   * Get remaining data as new stream
   */
  sliceRemaining(): Stream
  {
    return this.slice(this.remaining);
  }

  // ============================================
  // Reading integers
  // ============================================

  readInt8(): number
  {
    const value = this.view.getInt8(this._position);
    this._position += 1;
    return value;
  }

  readUint8(): number
  {
    const value = this.view.getUint8(this._position);
    this._position += 1;
    return value;
  }

  readInt16(littleEndian: boolean = true): number
  {
    const value = this.view.getInt16(this._position, littleEndian);
    this._position += 2;
    return value;
  }

  readUint16(littleEndian: boolean = true): number
  {
    const value = this.view.getUint16(this._position, littleEndian);
    this._position += 2;
    return value;
  }

  readInt32(littleEndian: boolean = true): number
  {
    const value = this.view.getInt32(this._position, littleEndian);
    this._position += 4;
    return value;
  }

  readUint32(littleEndian: boolean = true): number
  {
    const value = this.view.getUint32(this._position, littleEndian);
    this._position += 4;
    return value;
  }

  readInt64(littleEndian: boolean = true): bigint
  {
    const value = this.view.getBigInt64(this._position, littleEndian);
    this._position += 8;
    return value;
  }

  readUint64(littleEndian: boolean = true): bigint
  {
    const value = this.view.getBigUint64(this._position, littleEndian);
    this._position += 8;
    return value;
  }

  // ============================================
  // Reading floats
  // ============================================

  readFloat32(littleEndian: boolean = true): number
  {
    const value = this.view.getFloat32(this._position, littleEndian);
    this._position += 4;
    return value;
  }

  readFloat64(littleEndian: boolean = true): number
  {
    const value = this.view.getFloat64(this._position, littleEndian);
    this._position += 8;
    return value;
  }

  // ============================================
  // Reading arrays
  // ============================================

  readBytes(length: number): Uint8Array
  {
    const data = this.u8.slice(this._position, this._position + length);
    this._position += length;
    return data;
  }

  readInt32Array(count: number, littleEndian: boolean = true): Int32Array
  {
    const result = new Int32Array(count);
    for (let i = 0; i < count; i++)
    {
      result[i] = this.readInt32(littleEndian);
    }
    return result;
  }

  readUint32Array(count: number, littleEndian: boolean = true): Uint32Array
  {
    const result = new Uint32Array(count);
    for (let i = 0; i < count; i++)
    {
      result[i] = this.readUint32(littleEndian);
    }
    return result;
  }

  // ============================================
  // Reading strings
  // ============================================

  /**
   * Read fixed-length string
   */
  readString(length: number, encoding: 'ascii' | 'utf8' = 'utf8'): string
  {
    const bytes = this.readBytes(length);
    return new TextDecoder(encoding).decode(bytes);
  }

  /**
   * Read null-terminated string
   */
  readStringZ(maxLength: number = 256): string
  {
    const start = this._position;
    let end = start;

    while (end < start + maxLength && end < this.length)
    {
      if (this.u8[end] === 0) break;
      end++;
    }

    const bytes = this.u8.slice(start, end);
    this._position = end + 1; // Skip null terminator
    return new TextDecoder('utf8').decode(bytes);
  }

  /**
   * Read string at specific offset (doesn't change position)
   */
  readStringAt(offset: number, maxLength: number = 256): string
  {
    const saved = this._position;
    this._position = offset;
    const result = this.readStringZ(maxLength);
    this._position = saved;
    return result;
  }

  // ============================================
  // Peeking (read without advancing position)
  // ============================================

  peekUint8(offset: number = 0): number
  {
    return this.view.getUint8(this._position + offset);
  }

  peekUint16(offset: number = 0, littleEndian: boolean = true): number
  {
    return this.view.getUint16(this._position + offset, littleEndian);
  }

  peekUint32(offset: number = 0, littleEndian: boolean = true): number
  {
    return this.view.getUint32(this._position + offset, littleEndian);
  }

  peekBytes(length: number, offset: number = 0): Uint8Array
  {
    return this.u8.slice(this._position + offset, this._position + offset + length);
  }

  // ============================================
  // Magic/signature checking
  // ============================================

  /**
   * Check if bytes at current position match expected values
   */
  checkMagic(expected: number[] | Uint8Array | string): boolean
  {
    if (typeof expected === 'string')
    {
      expected = new TextEncoder().encode(expected);
    }

    const bytes = Array.isArray(expected) ? expected : Array.from(expected);

    for (let i = 0; i < bytes.length; i++)
    {
      if (this.peekUint8(i) !== bytes[i]) return false;
    }
    return true;
  }

  /**
   * Read and verify magic, throw if mismatch
   */
  expectMagic(expected: number[] | Uint8Array | string, name: string = 'magic'): void
  {
    if (!this.checkMagic(expected))
    {
      const actual = this.peekBytes(
        typeof expected === 'string' ? expected.length :
        Array.isArray(expected) ? expected.length : expected.length
      );
      throw new Error(
        `Invalid ${name}: expected ${JSON.stringify(expected)}, ` +
        `got ${JSON.stringify(Array.from(actual))}`
      );
    }

    const len = typeof expected === 'string' ? expected.length :
                Array.isArray(expected) ? expected.length : expected.length;
    this._position += len;
  }

  // ============================================
  // Utilities
  // ============================================

  /**
   * Get all data as Uint8Array
   */
  toUint8Array(): Uint8Array
  {
    return new Uint8Array(this.buffer, this.offset, this.length);
  }

  /**
   * Clone this stream (independent position)
   */
  clone(): Stream
  {
    const stream = new Stream(this.buffer, this.offset, this.length);
    stream._position = this._position;
    return stream;
  }

  /**
   * Get hex dump for debugging
   */
  hexDump(length: number = 64, offset: number = 0): string
  {
    const bytes = this.peekBytes(Math.min(length, this.remaining - offset), offset);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
    return hex;
  }
}

/**
 * Async Stream - For loading large files on-demand
 */
export abstract class AsyncStream
{
  abstract readonly length: number;

  /**
   * Read a chunk of data
   */
  abstract readChunk(offset: number, length: number): Promise<Uint8Array>;

  /**
   * Read entire file into Stream
   */
  async readAll(): Promise<Stream>
  {
    const data = await this.readChunk(0, this.length);
    return Stream.fromUint8Array(data);
  }

  /**
   * Create a sub-stream
   */
  slice(offset: number, length: number): AsyncStreamSlice
  {
    return new AsyncStreamSlice(this, offset, length);
  }
}

/**
 * Slice of an async stream
 */
export class AsyncStreamSlice extends AsyncStream
{
  constructor(
    private readonly parent: AsyncStream,
    private readonly offset: number,
    public readonly length: number
  )
  {
    super();
  }

  async readChunk(offset: number, length: number): Promise<Uint8Array>
  {
    return this.parent.readChunk(this.offset + offset, length);
  }
}

/**
 * File-backed async stream
 */
export class FileAsyncStream extends AsyncStream
{
  private file: File;
  public readonly length: number;

  constructor(file: File)
  {
    super();
    this.file = file;
    this.length = file.size;
  }

  async readChunk(offset: number, length: number): Promise<Uint8Array>
  {
    const slice = this.file.slice(offset, offset + length);
    const buffer = await slice.arrayBuffer();
    return new Uint8Array(buffer);
  }
}

/**
 * Buffer-backed async stream (for testing)
 */
export class BufferAsyncStream extends AsyncStream
{
  public readonly length: number;

  constructor(private readonly data: Uint8Array)
  {
    super();
    this.length = data.length;
  }

  async readChunk(offset: number, length: number): Promise<Uint8Array>
  {
    return this.data.slice(offset, offset + length);
  }
}
