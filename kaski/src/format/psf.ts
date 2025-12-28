/**
 * PSF - PlayStation Portable Settings File
 *
 * Used for storing metadata like game title, version, etc.
 * Found as PARAM.SFO inside PBP packages.
 */

import { Stream } from './stream';

// ============================================
// Constants
// ============================================

/** PSF magic bytes */
export const PSF_MAGIC = [0x00, 0x50, 0x53, 0x46]; // \0PSF

/** Data format types */
export const enum PsfDataFormat
{
  BINARY = 0,
  STRING = 2,  // UTF-8 string
  INT32 = 4,   // 32-bit integer
}

// ============================================
// Structures
// ============================================

/**
 * PSF Header
 */
export interface PsfHeader
{
  /** Magic bytes */
  magic: number;
  /** Version (usually 0x0101) */
  version: number;
  /** Offset to key table */
  keyTableOffset: number;
  /** Offset to data table */
  dataTableOffset: number;
  /** Number of entries */
  indexTableEntries: number;
}

/**
 * PSF Index Entry
 */
export interface PsfIndexEntry
{
  /** Offset in key table */
  keyOffset: number;
  /** Data format */
  dataFormat: PsfDataFormat;
  /** Data size used */
  dataSize: number;
  /** Data size allocated (padded) */
  dataSizeMax: number;
  /** Offset in data table */
  dataOffset: number;
}

/**
 * PSF Entry (key-value pair)
 */
export interface PsfEntry
{
  /** Key name */
  key: string;
  /** Data format */
  format: PsfDataFormat;
  /** Value (typed based on format) */
  value: string | number | Uint8Array;
}

// ============================================
// Common PSF Keys
// ============================================

export const PSF_KEYS = {
  /** Game category (UG=UMD Game, MG=Memory Stick Game) */
  CATEGORY: 'CATEGORY',
  /** Disc ID */
  DISC_ID: 'DISC_ID',
  /** Disc version */
  DISC_VERSION: 'DISC_VERSION',
  /** Parental level */
  PARENTAL_LEVEL: 'PARENTAL_LEVEL',
  /** Region */
  REGION: 'REGION',
  /** Title */
  TITLE: 'TITLE',
  /** PSP system version required */
  PSP_SYSTEM_VER: 'PSP_SYSTEM_VER',
  /** Application version */
  APP_VER: 'APP_VER',
  /** Boot file name */
  BOOTABLE: 'BOOTABLE',
  /** Memory stick size */
  MEMSIZE: 'MEMSIZE',
} as const;

// ============================================
// PSF File
// ============================================

/**
 * PSF File Parser
 */
export class PsfFile
{
  readonly header: PsfHeader;
  readonly entries: Map<string, PsfEntry>;

  private constructor(header: PsfHeader, entries: Map<string, PsfEntry>)
  {
    this.header = header;
    this.entries = entries;
  }

  /**
   * Load PSF from Stream
   */
  static fromStream(stream: Stream): PsfFile
  {
    stream.seek(0);

    // Read header
    const magic = stream.readUint32();
    if (magic !== 0x46535000) // "\0PSF" little-endian
    {
      throw new Error(`Invalid PSF magic: 0x${magic.toString(16)}`);
    }

    const header: PsfHeader = {
      magic,
      version: stream.readUint32(),
      keyTableOffset: stream.readUint32(),
      dataTableOffset: stream.readUint32(),
      indexTableEntries: stream.readUint32(),
    };

    // Read index entries
    const indexEntries: PsfIndexEntry[] = [];
    for (let i = 0; i < header.indexTableEntries; i++)
    {
      indexEntries.push({
        keyOffset: stream.readUint16(),
        dataFormat: stream.readUint8() as PsfDataFormat,
        ...(stream.skip(1), {}), // Padding
        dataSize: stream.readUint32(),
        dataSizeMax: stream.readUint32(),
        dataOffset: stream.readUint32(),
      });
    }

    // Read entries
    const entries = new Map<string, PsfEntry>();

    for (const idx of indexEntries)
    {
      // Read key
      stream.seek(header.keyTableOffset + idx.keyOffset);
      const key = stream.readStringZ();

      // Read value
      stream.seek(header.dataTableOffset + idx.dataOffset);
      let value: string | number | Uint8Array;

      switch (idx.dataFormat)
      {
        case PsfDataFormat.STRING:
          value = stream.readString(idx.dataSize).replace(/\0+$/, '');
          break;

        case PsfDataFormat.INT32:
          value = stream.readUint32();
          break;

        case PsfDataFormat.BINARY:
        default:
          value = stream.readBytes(idx.dataSize);
          break;
      }

      entries.set(key, {
        key,
        format: idx.dataFormat,
        value,
      });
    }

    return new PsfFile(header, entries);
  }

  /**
   * Load PSF from buffer
   */
  static fromBuffer(buffer: ArrayBuffer): PsfFile
  {
    return PsfFile.fromStream(new Stream(buffer));
  }

  /**
   * Load PSF from Uint8Array
   */
  static fromUint8Array(data: Uint8Array): PsfFile
  {
    return PsfFile.fromStream(Stream.fromUint8Array(data));
  }

  // ============================================
  // Accessors
  // ============================================

  /**
   * Get entry by key
   */
  get(key: string): PsfEntry | undefined
  {
    return this.entries.get(key);
  }

  /**
   * Get string value
   */
  getString(key: string): string | undefined
  {
    const entry = this.get(key);
    if (!entry || typeof entry.value !== 'string') return undefined;
    return entry.value;
  }

  /**
   * Get integer value
   */
  getInt(key: string): number | undefined
  {
    const entry = this.get(key);
    if (!entry || typeof entry.value !== 'number') return undefined;
    return entry.value;
  }

  /**
   * Get binary value
   */
  getBinary(key: string): Uint8Array | undefined
  {
    const entry = this.get(key);
    if (!entry || !(entry.value instanceof Uint8Array)) return undefined;
    return entry.value;
  }

  // ============================================
  // Common Properties
  // ============================================

  /** Game title */
  get title(): string | undefined
  {
    return this.getString(PSF_KEYS.TITLE);
  }

  /** Disc ID */
  get discId(): string | undefined
  {
    return this.getString(PSF_KEYS.DISC_ID);
  }

  /** Category (UG=UMD Game, MG=MS Game, etc.) */
  get category(): string | undefined
  {
    return this.getString(PSF_KEYS.CATEGORY);
  }

  /** Disc version */
  get discVersion(): string | undefined
  {
    return this.getString(PSF_KEYS.DISC_VERSION);
  }

  /** Application version */
  get appVersion(): string | undefined
  {
    return this.getString(PSF_KEYS.APP_VER);
  }

  /** Required PSP system version */
  get pspSystemVer(): string | undefined
  {
    return this.getString(PSF_KEYS.PSP_SYSTEM_VER);
  }

  /** Region code */
  get region(): number | undefined
  {
    return this.getInt(PSF_KEYS.REGION);
  }

  /** Parental level */
  get parentalLevel(): number | undefined
  {
    return this.getInt(PSF_KEYS.PARENTAL_LEVEL);
  }

  // ============================================
  // Utilities
  // ============================================

  /**
   * Get all entries as object
   */
  toObject(): Record<string, string | number | Uint8Array>
  {
    const result: Record<string, string | number | Uint8Array> = {};
    for (const [key, entry] of this.entries)
    {
      result[key] = entry.value;
    }
    return result;
  }

  /**
   * Get all keys
   */
  keys(): string[]
  {
    return Array.from(this.entries.keys());
  }
}
