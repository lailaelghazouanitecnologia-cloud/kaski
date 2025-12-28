/**
 * PBP - PSP Package Format
 *
 * Container format for PSP games and applications.
 * Contains multiple files like PARAM.SFO, ICON, and the main executable/data.
 */

import { Stream, AsyncStream } from './stream';
import { PsfFile } from './psf';

// ============================================
// Constants
// ============================================

/** PBP magic bytes */
export const PBP_MAGIC = [0x00, 0x50, 0x42, 0x50]; // \0PBP

/** PBP entry indices */
export const enum PbpEntry
{
  PARAM_SFO = 0,    // param.sfo - Metadata
  ICON0_PNG = 1,    // icon0.png - Main icon (80x80)
  ICON1_PMF = 2,    // icon1.pmf - Animated icon
  PIC0_PNG = 3,     // pic0.png - Background
  PIC1_PNG = 4,     // pic1.png - Boot screen background
  SND0_AT3 = 5,     // snd0.at3 - Startup sound
  DATA_PSP = 6,     // data.psp - Main executable/data
  DATA_PSAR = 7,    // data.psar - Additional archive
}

/** PBP entry names */
export const PBP_ENTRY_NAMES: Record<PbpEntry, string> = {
  [PbpEntry.PARAM_SFO]: 'PARAM.SFO',
  [PbpEntry.ICON0_PNG]: 'ICON0.PNG',
  [PbpEntry.ICON1_PMF]: 'ICON1.PMF',
  [PbpEntry.PIC0_PNG]: 'PIC0.PNG',
  [PbpEntry.PIC1_PNG]: 'PIC1.PNG',
  [PbpEntry.SND0_AT3]: 'SND0.AT3',
  [PbpEntry.DATA_PSP]: 'DATA.PSP',
  [PbpEntry.DATA_PSAR]: 'DATA.PSAR',
};

// ============================================
// Structures
// ============================================

/**
 * PBP Header
 */
export interface PbpHeader
{
  /** Magic bytes */
  magic: number;
  /** Version (usually 0x00010000 or 0x00010001) */
  version: number;
  /** Offsets to each entry (8 entries) */
  offsets: number[];
}

/**
 * PBP Entry Info
 */
export interface PbpEntryInfo
{
  /** Entry index */
  index: PbpEntry;
  /** Entry name */
  name: string;
  /** Offset in file */
  offset: number;
  /** Size in bytes */
  size: number;
  /** Is this entry present? */
  present: boolean;
}

// ============================================
// PBP File
// ============================================

/**
 * PBP File Parser
 */
export class PbpFile
{
  readonly header: PbpHeader;
  readonly entries: PbpEntryInfo[];
  readonly fileSize: number;

  private stream: Stream;
  private _paramSfo?: PsfFile;

  private constructor(stream: Stream, header: PbpHeader, entries: PbpEntryInfo[], fileSize: number)
  {
    this.stream = stream;
    this.header = header;
    this.entries = entries;
    this.fileSize = fileSize;
  }

  /**
   * Load PBP from Stream
   */
  static fromStream(stream: Stream): PbpFile
  {
    stream.seek(0);

    // Read header
    const magic = stream.readUint32();
    if (magic !== 0x50425000) // "\0PBP" little-endian
    {
      throw new Error(`Invalid PBP magic: 0x${magic.toString(16)}`);
    }

    const version = stream.readUint32();

    // Read 8 offsets
    const offsets: number[] = [];
    for (let i = 0; i < 8; i++)
    {
      offsets.push(stream.readUint32());
    }

    const header: PbpHeader = { magic, version, offsets };

    // Calculate entry sizes
    const fileSize = stream.length;
    const entries: PbpEntryInfo[] = [];

    for (let i = 0; i < 8; i++)
    {
      const offset = offsets[i];
      const nextOffset = i < 7 ? offsets[i + 1] : fileSize;
      const size = nextOffset - offset;

      entries.push({
        index: i as PbpEntry,
        name: PBP_ENTRY_NAMES[i as PbpEntry],
        offset,
        size,
        present: size > 0,
      });
    }

    return new PbpFile(stream, header, entries, fileSize);
  }

  /**
   * Load PBP from buffer
   */
  static fromBuffer(buffer: ArrayBuffer): PbpFile
  {
    return PbpFile.fromStream(new Stream(buffer));
  }

  /**
   * Load PBP from Uint8Array
   */
  static fromUint8Array(data: Uint8Array): PbpFile
  {
    return PbpFile.fromStream(Stream.fromUint8Array(data));
  }

  // ============================================
  // Entry Access
  // ============================================

  /**
   * Get entry info by index
   */
  getEntryInfo(index: PbpEntry): PbpEntryInfo
  {
    return this.entries[index];
  }

  /**
   * Get entry info by name
   */
  getEntryInfoByName(name: string): PbpEntryInfo | undefined
  {
    name = name.toUpperCase();
    return this.entries.find(e => e.name === name);
  }

  /**
   * Check if entry is present
   */
  hasEntry(index: PbpEntry): boolean
  {
    return this.entries[index].present;
  }

  /**
   * Read entry data
   */
  readEntry(index: PbpEntry): Stream | undefined
  {
    const info = this.entries[index];
    if (!info.present) return undefined;
    return this.stream.sliceAt(info.offset, info.size);
  }

  /**
   * Read entry data as Uint8Array
   */
  readEntryBytes(index: PbpEntry): Uint8Array | undefined
  {
    const stream = this.readEntry(index);
    if (!stream) return undefined;
    return stream.toUint8Array();
  }

  // ============================================
  // Typed Accessors
  // ============================================

  /**
   * Get PARAM.SFO as parsed PSF
   */
  get paramSfo(): PsfFile | undefined
  {
    if (!this._paramSfo)
    {
      const stream = this.readEntry(PbpEntry.PARAM_SFO);
      if (stream)
      {
        this._paramSfo = PsfFile.fromStream(stream);
      }
    }
    return this._paramSfo;
  }

  /**
   * Get main icon (ICON0.PNG) data
   */
  get icon(): Uint8Array | undefined
  {
    return this.readEntryBytes(PbpEntry.ICON0_PNG);
  }

  /**
   * Get background image (PIC0.PNG) data
   */
  get background(): Uint8Array | undefined
  {
    return this.readEntryBytes(PbpEntry.PIC0_PNG);
  }

  /**
   * Get boot screen background (PIC1.PNG) data
   */
  get bootScreen(): Uint8Array | undefined
  {
    return this.readEntryBytes(PbpEntry.PIC1_PNG);
  }

  /**
   * Get startup sound (SND0.AT3) data
   */
  get sound(): Uint8Array | undefined
  {
    return this.readEntryBytes(PbpEntry.SND0_AT3);
  }

  /**
   * Get main data/executable (DATA.PSP)
   */
  get data(): Stream | undefined
  {
    return this.readEntry(PbpEntry.DATA_PSP);
  }

  /**
   * Get additional archive (DATA.PSAR)
   */
  get archive(): Stream | undefined
  {
    return this.readEntry(PbpEntry.DATA_PSAR);
  }

  // ============================================
  // Metadata
  // ============================================

  /** Game/App title from PARAM.SFO */
  get title(): string | undefined
  {
    return this.paramSfo?.title;
  }

  /** Disc ID from PARAM.SFO */
  get discId(): string | undefined
  {
    return this.paramSfo?.discId;
  }

  /** Version from PARAM.SFO */
  get version(): string | undefined
  {
    return this.paramSfo?.discVersion;
  }

  /** Category from PARAM.SFO */
  get category(): string | undefined
  {
    return this.paramSfo?.category;
  }

  // ============================================
  // Utilities
  // ============================================

  /**
   * Get all present entries
   */
  getPresentEntries(): PbpEntryInfo[]
  {
    return this.entries.filter(e => e.present);
  }

  /**
   * Get total data size (excluding header)
   */
  get dataSize(): number
  {
    return this.entries.reduce((sum, e) => sum + e.size, 0);
  }
}

/**
 * Async PBP loader for large files
 */
export class AsyncPbpFile
{
  readonly header: PbpHeader;
  readonly entries: PbpEntryInfo[];
  readonly fileSize: number;

  private stream: AsyncStream;
  private _paramSfo?: PsfFile;

  private constructor(
    stream: AsyncStream,
    header: PbpHeader,
    entries: PbpEntryInfo[],
    fileSize: number
  )
  {
    this.stream = stream;
    this.header = header;
    this.entries = entries;
    this.fileSize = fileSize;
  }

  /**
   * Load PBP from async stream
   */
  static async fromStream(stream: AsyncStream): Promise<AsyncPbpFile>
  {
    // Read header (40 bytes)
    const headerData = await stream.readChunk(0, 40);
    const headerStream = Stream.fromUint8Array(headerData);

    const magic = headerStream.readUint32();
    if (magic !== 0x50425000)
    {
      throw new Error(`Invalid PBP magic: 0x${magic.toString(16)}`);
    }

    const version = headerStream.readUint32();
    const offsets: number[] = [];
    for (let i = 0; i < 8; i++)
    {
      offsets.push(headerStream.readUint32());
    }

    const header: PbpHeader = { magic, version, offsets };
    const fileSize = stream.length;

    const entries: PbpEntryInfo[] = [];
    for (let i = 0; i < 8; i++)
    {
      const offset = offsets[i];
      const nextOffset = i < 7 ? offsets[i + 1] : fileSize;
      const size = nextOffset - offset;

      entries.push({
        index: i as PbpEntry,
        name: PBP_ENTRY_NAMES[i as PbpEntry],
        offset,
        size,
        present: size > 0,
      });
    }

    return new AsyncPbpFile(stream, header, entries, fileSize);
  }

  /**
   * Read entry data
   */
  async readEntry(index: PbpEntry): Promise<Uint8Array | undefined>
  {
    const info = this.entries[index];
    if (!info.present) return undefined;
    return this.stream.readChunk(info.offset, info.size);
  }

  /**
   * Get PARAM.SFO
   */
  async getParamSfo(): Promise<PsfFile | undefined>
  {
    if (!this._paramSfo)
    {
      const data = await this.readEntry(PbpEntry.PARAM_SFO);
      if (data)
      {
        this._paramSfo = PsfFile.fromUint8Array(data);
      }
    }
    return this._paramSfo;
  }

  /**
   * Get DATA.PSP as async stream
   */
  getDataStream(): AsyncStream | undefined
  {
    const info = this.entries[PbpEntry.DATA_PSP];
    if (!info.present) return undefined;
    return this.stream.slice(info.offset, info.size);
  }
}
