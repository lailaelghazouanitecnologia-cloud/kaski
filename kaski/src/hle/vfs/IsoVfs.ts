/**
 * ISO VFS - Virtual File System for ISO 9660 Images
 *
 * Provides read-only filesystem access to ISO disc images (PSP UMDs).
 */

import { PromiseFast } from '../../util/PromiseFast';
import { IsoFile, IsoEntry, SECTOR_SIZE } from '../../format/iso';
import { Stream } from '../../format/stream';
import { Vfs, VfsEntry, FileStat, DirEntry, FileMode, OpenFlags, SeekMode } from './types';

// ============================================
// ISO VFS Entry
// ============================================

/**
 * VFS entry for ISO files/directories
 */
export class IsoVfsEntry implements VfsEntry
{
  private _position = 0;
  private data: Uint8Array | null = null;

  constructor(
    private iso: IsoFile,
    private entry: IsoEntry
  )
  {
  }

  get isFile(): boolean
  {
    return !this.entry.isDirectory;
  }

  get isDirectory(): boolean
  {
    return this.entry.isDirectory;
  }

  get position(): number
  {
    return this._position;
  }

  set position(value: number)
  {
    this._position = Math.max(0, Math.min(value, this.entry.record.size));
  }

  get path(): string
  {
    return this.entry.path;
  }

  /**
   * Read bytes from file
   */
  read(size: number): PromiseFast<Uint8Array>
  {
    if (this.entry.isDirectory)
    {
      return PromiseFast.reject(new Error('Cannot read from directory'));
    }

    // Lazy load file data
    if (this.data === null)
    {
      const stream = this.iso.readEntry(this.entry);
      this.data = stream.readBytes(this.entry.record.size);
    }

    const start = this._position;
    const end = Math.min(start + size, this.entry.record.size);
    const result = this.data.slice(start, end);
    this._position = end;

    return PromiseFast.resolve(result);
  }

  /**
   * Write bytes to file (not supported - ISO is read-only)
   */
  write(data: Uint8Array): PromiseFast<number>
  {
    return PromiseFast.reject(new Error('ISO is read-only'));
  }

  /**
   * Seek to position
   */
  seek(offset: number, mode: SeekMode): PromiseFast<number>
  {
    const size = this.entry.record.size;

    switch (mode)
    {
      case SeekMode.Set:
        this._position = offset;
        break;
      case SeekMode.Current:
        this._position += offset;
        break;
      case SeekMode.End:
        this._position = size + offset;
        break;
    }

    // Clamp to valid range
    this._position = Math.max(0, Math.min(this._position, size));

    return PromiseFast.resolve(this._position);
  }

  /**
   * Get file size
   */
  getSize(): PromiseFast<number>
  {
    return PromiseFast.resolve(this.entry.record.size);
  }

  /**
   * Get file statistics
   */
  stat(): PromiseFast<FileStat>
  {
    const record = this.entry.record;
    const mode = this.entry.isDirectory ? FileMode.Directory : FileMode.File;

    return PromiseFast.resolve({
      mode,
      size: record.size,
      atime: record.date,
      mtime: record.date,
      ctime: record.date,
    });
  }

  /**
   * Close the entry
   */
  close(): PromiseFast<void>
  {
    this.data = null;
    return PromiseFast.resolve();
  }

  /**
   * Read directory entries
   */
  readDir(): PromiseFast<DirEntry[]>
  {
    if (!this.entry.isDirectory)
    {
      return PromiseFast.reject(new Error('Not a directory'));
    }

    const entries: DirEntry[] = [];

    for (const [name, child] of this.entry.children)
    {
      const record = child.record;
      entries.push({
        name,
        stat: {
          mode: child.isDirectory ? FileMode.Directory : FileMode.File,
          size: record.size,
          atime: record.date,
          mtime: record.date,
          ctime: record.date,
        },
      });
    }

    return PromiseFast.resolve(entries);
  }
}

// ============================================
// ISO VFS
// ============================================

/**
 * Virtual File System for ISO 9660 images
 */
export class IsoVfs implements Vfs
{
  readonly name = 'iso';

  constructor(private iso: IsoFile)
  {
  }

  /**
   * Create IsoVfs from buffer
   */
  static fromBuffer(buffer: ArrayBuffer): IsoVfs
  {
    const iso = IsoFile.fromBuffer(buffer);
    return new IsoVfs(iso);
  }

  /**
   * Create IsoVfs from Uint8Array
   */
  static fromUint8Array(data: Uint8Array): IsoVfs
  {
    const iso = IsoFile.fromUint8Array(data);
    return new IsoVfs(iso);
  }

  /**
   * Create IsoVfs from Stream
   */
  static fromStream(stream: Stream): IsoVfs
  {
    const iso = IsoFile.fromStream(stream);
    return new IsoVfs(iso);
  }

  /**
   * Get the underlying ISO file
   */
  getIsoFile(): IsoFile
  {
    return this.iso;
  }

  // ============================================
  // VFS Interface
  // ============================================

  /**
   * Open a file
   */
  open(path: string, flags: OpenFlags, mode?: number): PromiseFast<VfsEntry | null>
  {
    // ISO is read-only
    if (flags & OpenFlags.Write)
    {
      return PromiseFast.resolve(null);
    }

    if (flags & OpenFlags.Create)
    {
      return PromiseFast.resolve(null);
    }

    const entry = this.iso.get(path);
    if (!entry || entry.isDirectory)
    {
      return PromiseFast.resolve(null);
    }

    return PromiseFast.resolve(new IsoVfsEntry(this.iso, entry));
  }

  /**
   * Open a directory
   */
  openDir(path: string): PromiseFast<VfsEntry | null>
  {
    const entry = this.iso.get(path);
    if (!entry || !entry.isDirectory)
    {
      return PromiseFast.resolve(null);
    }

    return PromiseFast.resolve(new IsoVfsEntry(this.iso, entry));
  }

  /**
   * Get file statistics
   */
  stat(path: string): PromiseFast<FileStat | null>
  {
    const entry = this.iso.get(path);
    if (!entry)
    {
      return PromiseFast.resolve(null);
    }

    const record = entry.record;
    const mode = entry.isDirectory ? FileMode.Directory : FileMode.File;

    return PromiseFast.resolve({
      mode,
      size: record.size,
      atime: record.date,
      mtime: record.date,
      ctime: record.date,
    });
  }

  /**
   * Check if path exists
   */
  exists(path: string): PromiseFast<boolean>
  {
    return PromiseFast.resolve(this.iso.exists(path));
  }

  /**
   * Create directory (not supported)
   */
  mkdir(path: string): PromiseFast<boolean>
  {
    return PromiseFast.resolve(false);
  }

  /**
   * Remove file (not supported)
   */
  remove(path: string): PromiseFast<boolean>
  {
    return PromiseFast.resolve(false);
  }

  /**
   * Remove directory (not supported)
   */
  rmdir(path: string): PromiseFast<boolean>
  {
    return PromiseFast.resolve(false);
  }

  /**
   * Rename file (not supported)
   */
  rename(oldPath: string, newPath: string): PromiseFast<boolean>
  {
    return PromiseFast.resolve(false);
  }
}
