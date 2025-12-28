/**
 * ISO 9660 - CD/DVD Disc Image Format
 *
 * Parser for ISO disc images used by PSP games.
 */

import { Stream, AsyncStream } from './stream';

// ============================================
// Constants
// ============================================

/** Sector size in bytes */
export const SECTOR_SIZE = 0x800; // 2048 bytes

/** Magic string for Primary Volume Descriptor */
const ISO_MAGIC = 'CD001';

/** Volume Descriptor Types */
export const enum VolumeDescriptorType
{
  BOOT = 0,
  PRIMARY = 1,
  SUPPLEMENTARY = 2,
  PARTITION = 3,
  TERMINATOR = 255,
}

// ============================================
// Structures
// ============================================

/**
 * Primary Volume Descriptor
 */
export interface PrimaryVolumeDescriptor
{
  /** Type (should be PRIMARY) */
  type: VolumeDescriptorType;
  /** Standard identifier (should be "CD001") */
  standardId: string;
  /** Version */
  version: number;
  /** System identifier */
  systemId: string;
  /** Volume identifier */
  volumeId: string;
  /** Volume space size (in sectors) */
  volumeSpaceSize: number;
  /** Volume set size */
  volumeSetSize: number;
  /** Volume sequence number */
  volumeSequenceNumber: number;
  /** Logical block size */
  logicalBlockSize: number;
  /** Path table size */
  pathTableSize: number;
  /** Location of Type L path table */
  pathTableLba: number;
  /** Root directory record */
  rootDirectory: DirectoryRecord;
  /** Volume set identifier */
  volumeSetId: string;
  /** Publisher identifier */
  publisherId: string;
  /** Data preparer identifier */
  preparerId: string;
  /** Application identifier */
  applicationId: string;
  /** Copyright file identifier */
  copyrightFileId: string;
  /** Abstract file identifier */
  abstractFileId: string;
  /** Bibliographic file identifier */
  bibliographicFileId: string;
  /** Creation date/time */
  creationDate: string;
  /** Modification date/time */
  modificationDate: string;
  /** Expiration date/time */
  expirationDate: string;
  /** Effective date/time */
  effectiveDate: string;
  /** File structure version */
  fileStructureVersion: number;
}

/**
 * Directory Record (file or directory entry)
 */
export interface DirectoryRecord
{
  /** Length of this record */
  length: number;
  /** Extended attribute record length */
  extendedAttrLength: number;
  /** Location of extent (LBA) */
  lba: number;
  /** Data length (file size) */
  size: number;
  /** Recording date and time */
  date: Date;
  /** File flags */
  flags: number;
  /** File unit size (for interleaved files) */
  fileUnitSize: number;
  /** Interleave gap size */
  interleaveGap: number;
  /** Volume sequence number */
  volumeSequenceNumber: number;
  /** File identifier (name) */
  name: string;
}

/**
 * File/Directory entry in the filesystem tree
 */
export interface IsoEntry
{
  /** Entry name */
  name: string;
  /** Full path */
  path: string;
  /** Is this a directory? */
  isDirectory: boolean;
  /** Directory record */
  record: DirectoryRecord;
  /** Children (for directories) */
  children: Map<string, IsoEntry>;
  /** Parent entry */
  parent?: IsoEntry;
}

// ============================================
// ISO File
// ============================================

/**
 * ISO 9660 File System
 */
export class IsoFile
{
  readonly pvd: PrimaryVolumeDescriptor;
  readonly root: IsoEntry;

  private stream: Stream;
  private entriesByPath: Map<string, IsoEntry>;

  private constructor(stream: Stream, pvd: PrimaryVolumeDescriptor, root: IsoEntry)
  {
    this.stream = stream;
    this.pvd = pvd;
    this.root = root;
    this.entriesByPath = new Map();
    this.indexEntries(root, '');
  }

  /**
   * Load ISO from Stream
   */
  static fromStream(stream: Stream): IsoFile
  {
    // Read Primary Volume Descriptor (at sector 16)
    stream.seek(16 * SECTOR_SIZE);
    const pvd = IsoFile.parsePrimaryVolumeDescriptor(stream);

    // Parse root directory
    const root: IsoEntry = {
      name: '',
      path: '/',
      isDirectory: true,
      record: pvd.rootDirectory,
      children: new Map(),
    };

    // Read root directory contents
    IsoFile.parseDirectory(stream, root, pvd.rootDirectory);

    return new IsoFile(stream, pvd, root);
  }

  /**
   * Load ISO from buffer
   */
  static fromBuffer(buffer: ArrayBuffer): IsoFile
  {
    return IsoFile.fromStream(new Stream(buffer));
  }

  /**
   * Load ISO from Uint8Array
   */
  static fromUint8Array(data: Uint8Array): IsoFile
  {
    return IsoFile.fromStream(Stream.fromUint8Array(data));
  }

  // ============================================
  // File Access
  // ============================================

  /**
   * Get entry by path
   */
  get(path: string): IsoEntry | undefined
  {
    // Normalize path
    path = path.replace(/\\/g, '/');
    if (!path.startsWith('/')) path = '/' + path;
    path = path.toUpperCase();

    return this.entriesByPath.get(path);
  }

  /**
   * Check if file/directory exists
   */
  exists(path: string): boolean
  {
    return this.get(path) !== undefined;
  }

  /**
   * Read file data
   */
  readFile(path: string): Stream | undefined
  {
    const entry = this.get(path);
    if (!entry || entry.isDirectory)
    {
      return undefined;
    }

    return this.readEntry(entry);
  }

  /**
   * Read entry data
   */
  readEntry(entry: IsoEntry): Stream
  {
    const offset = entry.record.lba * SECTOR_SIZE;
    return this.stream.sliceAt(offset, entry.record.size);
  }

  /**
   * List directory contents
   */
  listDirectory(path: string): string[]
  {
    const entry = this.get(path);
    if (!entry || !entry.isDirectory)
    {
      return [];
    }

    return Array.from(entry.children.keys());
  }

  /**
   * Get all file paths
   */
  getAllPaths(): string[]
  {
    return Array.from(this.entriesByPath.keys());
  }

  // ============================================
  // Parsing
  // ============================================

  private static parsePrimaryVolumeDescriptor(stream: Stream): PrimaryVolumeDescriptor
  {
    const startPos = stream.position;

    const type = stream.readUint8() as VolumeDescriptorType;
    const standardId = stream.readString(5);
    const version = stream.readUint8();

    if (standardId !== ISO_MAGIC)
    {
      throw new Error(`Invalid ISO magic: ${standardId}`);
    }

    if (type !== VolumeDescriptorType.PRIMARY)
    {
      throw new Error(`Expected Primary Volume Descriptor, got type ${type}`);
    }

    stream.skip(1); // Unused

    const systemId = stream.readString(32).trim();
    const volumeId = stream.readString(32).trim();

    stream.skip(8); // Unused

    const volumeSpaceSize = stream.readUint32(); // Little-endian
    stream.skip(4); // Big-endian copy

    stream.skip(32); // Unused

    const volumeSetSize = stream.readUint16();
    stream.skip(2); // Big-endian copy

    const volumeSequenceNumber = stream.readUint16();
    stream.skip(2); // Big-endian copy

    const logicalBlockSize = stream.readUint16();
    stream.skip(2); // Big-endian copy

    const pathTableSize = stream.readUint32();
    stream.skip(4); // Big-endian copy

    const pathTableLba = stream.readUint32();
    stream.skip(4); // Optional path table LBA
    stream.skip(8); // Big-endian copies

    const rootDirectory = IsoFile.parseDirectoryRecord(stream);

    const volumeSetId = stream.readString(128).trim();
    const publisherId = stream.readString(128).trim();
    const preparerId = stream.readString(128).trim();
    const applicationId = stream.readString(128).trim();
    const copyrightFileId = stream.readString(37).trim();
    const abstractFileId = stream.readString(37).trim();
    const bibliographicFileId = stream.readString(37).trim();

    const creationDate = stream.readString(17);
    const modificationDate = stream.readString(17);
    const expirationDate = stream.readString(17);
    const effectiveDate = stream.readString(17);

    const fileStructureVersion = stream.readUint8();

    return {
      type,
      standardId,
      version,
      systemId,
      volumeId,
      volumeSpaceSize,
      volumeSetSize,
      volumeSequenceNumber,
      logicalBlockSize,
      pathTableSize,
      pathTableLba,
      rootDirectory,
      volumeSetId,
      publisherId,
      preparerId,
      applicationId,
      copyrightFileId,
      abstractFileId,
      bibliographicFileId,
      creationDate,
      modificationDate,
      expirationDate,
      effectiveDate,
      fileStructureVersion,
    };
  }

  private static parseDirectoryRecord(stream: Stream): DirectoryRecord
  {
    const startPos = stream.position;

    const length = stream.readUint8();
    if (length === 0)
    {
      // Null record (padding)
      return {
        length: 0,
        extendedAttrLength: 0,
        lba: 0,
        size: 0,
        date: new Date(0),
        flags: 0,
        fileUnitSize: 0,
        interleaveGap: 0,
        volumeSequenceNumber: 0,
        name: '',
      };
    }

    const extendedAttrLength = stream.readUint8();

    const lba = stream.readUint32(); // Little-endian
    stream.skip(4); // Big-endian copy

    const size = stream.readUint32(); // Little-endian
    stream.skip(4); // Big-endian copy

    // Recording date (7 bytes)
    const year = stream.readUint8() + 1900;
    const month = stream.readUint8();
    const day = stream.readUint8();
    const hour = stream.readUint8();
    const minute = stream.readUint8();
    const second = stream.readUint8();
    const timezone = stream.readInt8(); // 15-minute intervals from GMT
    const date = new Date(year, month - 1, day, hour, minute, second);

    const flags = stream.readUint8();
    const fileUnitSize = stream.readUint8();
    const interleaveGap = stream.readUint8();

    const volumeSequenceNumber = stream.readUint16();
    stream.skip(2); // Big-endian copy

    const nameLength = stream.readUint8();
    let name = stream.readString(nameLength);

    // Clean up name
    if (name === '\x00') name = '.';
    else if (name === '\x01') name = '..';
    else
    {
      // Remove version number (;1)
      const semicolon = name.indexOf(';');
      if (semicolon !== -1)
      {
        name = name.substring(0, semicolon);
      }
      // Remove trailing dot for directories
      if (name.endsWith('.') && (flags & 2))
      {
        name = name.substring(0, name.length - 1);
      }
    }

    // Skip to end of record
    const bytesRead = stream.position - startPos;
    if (bytesRead < length)
    {
      stream.skip(length - bytesRead);
    }

    return {
      length,
      extendedAttrLength,
      lba,
      size,
      date,
      flags,
      fileUnitSize,
      interleaveGap,
      volumeSequenceNumber,
      name,
    };
  }

  private static parseDirectory(
    stream: Stream,
    parent: IsoEntry,
    record: DirectoryRecord
  ): void
  {
    const offset = record.lba * SECTOR_SIZE;
    const dirStream = stream.sliceAt(offset, record.size);

    while (!dirStream.eof)
    {
      // Check for sector boundary padding
      const remaining = SECTOR_SIZE - (dirStream.position % SECTOR_SIZE);
      if (remaining < 34 && dirStream.peekUint8() === 0)
      {
        dirStream.skip(remaining);
        if (dirStream.eof) break;
      }

      const childRecord = IsoFile.parseDirectoryRecord(dirStream);
      if (childRecord.length === 0) continue;

      // Skip . and .. entries
      if (childRecord.name === '.' || childRecord.name === '..') continue;

      const isDirectory = (childRecord.flags & 2) !== 0;
      const childPath = parent.path === '/'
        ? '/' + childRecord.name
        : parent.path + '/' + childRecord.name;

      const child: IsoEntry = {
        name: childRecord.name,
        path: childPath.toUpperCase(),
        isDirectory,
        record: childRecord,
        children: new Map(),
        parent,
      };

      parent.children.set(childRecord.name.toUpperCase(), child);

      // Recursively parse subdirectories
      if (isDirectory)
      {
        IsoFile.parseDirectory(stream, child, childRecord);
      }
    }
  }

  private indexEntries(entry: IsoEntry, path: string): void
  {
    const fullPath = path + (path === '/' ? '' : '/') + entry.name;
    this.entriesByPath.set(fullPath.toUpperCase() || '/', entry);

    for (const child of entry.children.values())
    {
      this.indexEntries(child, fullPath);
    }
  }
}

/**
 * Async ISO loader for large files
 */
export class AsyncIsoFile
{
  readonly pvd: PrimaryVolumeDescriptor;
  readonly root: IsoEntry;

  private stream: AsyncStream;
  private entriesByPath: Map<string, IsoEntry>;

  private constructor(
    stream: AsyncStream,
    pvd: PrimaryVolumeDescriptor,
    root: IsoEntry,
    entriesByPath: Map<string, IsoEntry>
  )
  {
    this.stream = stream;
    this.pvd = pvd;
    this.root = root;
    this.entriesByPath = entriesByPath;
  }

  /**
   * Load ISO from async stream
   */
  static async fromStream(stream: AsyncStream): Promise<AsyncIsoFile>
  {
    // Read PVD sector
    const pvdData = await stream.readChunk(16 * SECTOR_SIZE, SECTOR_SIZE);
    const pvd = IsoFile['parsePrimaryVolumeDescriptor'](Stream.fromUint8Array(pvdData));

    // Parse directory tree
    const root: IsoEntry = {
      name: '',
      path: '/',
      isDirectory: true,
      record: pvd.rootDirectory,
      children: new Map(),
    };

    await AsyncIsoFile.parseDirectoryAsync(stream, root, pvd.rootDirectory);

    const entriesByPath = new Map<string, IsoEntry>();
    AsyncIsoFile.indexEntries(root, '', entriesByPath);

    return new AsyncIsoFile(stream, pvd, root, entriesByPath);
  }

  private static async parseDirectoryAsync(
    stream: AsyncStream,
    parent: IsoEntry,
    record: DirectoryRecord
  ): Promise<void>
  {
    const offset = record.lba * SECTOR_SIZE;
    const data = await stream.readChunk(offset, record.size);
    const dirStream = Stream.fromUint8Array(data);

    while (!dirStream.eof)
    {
      const remaining = SECTOR_SIZE - (dirStream.position % SECTOR_SIZE);
      if (remaining < 34 && dirStream.peekUint8() === 0)
      {
        dirStream.skip(remaining);
        if (dirStream.eof) break;
      }

      const childRecord = IsoFile['parseDirectoryRecord'](dirStream);
      if (childRecord.length === 0) continue;
      if (childRecord.name === '.' || childRecord.name === '..') continue;

      const isDirectory = (childRecord.flags & 2) !== 0;
      const childPath = parent.path === '/'
        ? '/' + childRecord.name
        : parent.path + '/' + childRecord.name;

      const child: IsoEntry = {
        name: childRecord.name,
        path: childPath.toUpperCase(),
        isDirectory,
        record: childRecord,
        children: new Map(),
        parent,
      };

      parent.children.set(childRecord.name.toUpperCase(), child);

      if (isDirectory)
      {
        await AsyncIsoFile.parseDirectoryAsync(stream, child, childRecord);
      }
    }
  }

  private static indexEntries(
    entry: IsoEntry,
    path: string,
    map: Map<string, IsoEntry>
  ): void
  {
    const fullPath = path + (path === '/' ? '' : '/') + entry.name;
    map.set(fullPath.toUpperCase() || '/', entry);

    for (const child of entry.children.values())
    {
      AsyncIsoFile.indexEntries(child, fullPath, map);
    }
  }

  get(path: string): IsoEntry | undefined
  {
    path = path.replace(/\\/g, '/');
    if (!path.startsWith('/')) path = '/' + path;
    return this.entriesByPath.get(path.toUpperCase());
  }

  async readFile(path: string): Promise<Uint8Array | undefined>
  {
    const entry = this.get(path);
    if (!entry || entry.isDirectory) return undefined;

    const offset = entry.record.lba * SECTOR_SIZE;
    return this.stream.readChunk(offset, entry.record.size);
  }
}
