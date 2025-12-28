/**
 * VFS Types
 *
 * Common types and interfaces for the Virtual File System.
 */

import { PromiseFast } from '../../util/PromiseFast';

// ============================================
// File Statistics
// ============================================

/** File mode/type flags */
export const enum FileMode
{
  /** Directory */
  Directory = 0x1000,
  /** Regular file */
  File = 0x2000,
  /** Symbolic link */
  Link = 0x4000,
}

/** File attributes */
export interface FileStat
{
  /** File mode (type) */
  mode: number;
  /** File size in bytes */
  size: number;
  /** Access time */
  atime: Date;
  /** Modification time */
  mtime: Date;
  /** Creation time */
  ctime: Date;
}

/** Directory entry */
export interface DirEntry
{
  /** Entry name */
  name: string;
  /** File statistics */
  stat: FileStat;
}

// ============================================
// Open Flags
// ============================================

/** File open flags (PSP compatible) */
export const enum OpenFlags
{
  /** Read access */
  Read = 0x0001,
  /** Write access */
  Write = 0x0002,
  /** Read/write access */
  ReadWrite = 0x0003,
  /** Non-blocking mode */
  NonBlocking = 0x0004,
  /** Create if not exists */
  Create = 0x0200,
  /** Truncate on open */
  Truncate = 0x0400,
  /** Append mode */
  Append = 0x0100,
  /** Exclusive create (fail if exists) */
  Exclusive = 0x0800,
}

/** File seek modes */
export const enum SeekMode
{
  /** Seek from beginning */
  Set = 0,
  /** Seek from current position */
  Current = 1,
  /** Seek from end */
  End = 2,
}

// ============================================
// VFS Entry Interface
// ============================================

/**
 * VFS Entry - A file or directory handle
 */
export interface VfsEntry
{
  /** Is this a file? */
  readonly isFile: boolean;

  /** Is this a directory? */
  readonly isDirectory: boolean;

  /** Current position (for files) */
  position: number;

  /** Entry path */
  readonly path: string;

  /**
   * Read bytes from file
   */
  read(size: number): PromiseFast<Uint8Array>;

  /**
   * Write bytes to file
   */
  write(data: Uint8Array): PromiseFast<number>;

  /**
   * Seek to position
   */
  seek(offset: number, mode: SeekMode): PromiseFast<number>;

  /**
   * Get file size
   */
  getSize(): PromiseFast<number>;

  /**
   * Get file statistics
   */
  stat(): PromiseFast<FileStat>;

  /**
   * Close the entry
   */
  close(): PromiseFast<void>;

  /**
   * Read directory entries (for directories)
   */
  readDir(): PromiseFast<DirEntry[]>;
}

// ============================================
// VFS Interface
// ============================================

/**
 * VFS Provider Interface
 */
export interface Vfs
{
  /** Provider name */
  readonly name: string;

  /**
   * Open a file
   */
  open(path: string, flags: OpenFlags, mode?: number): PromiseFast<VfsEntry | null>;

  /**
   * Open a directory
   */
  openDir(path: string): PromiseFast<VfsEntry | null>;

  /**
   * Get file statistics
   */
  stat(path: string): PromiseFast<FileStat | null>;

  /**
   * Check if path exists
   */
  exists(path: string): PromiseFast<boolean>;

  /**
   * Create directory
   */
  mkdir(path: string): PromiseFast<boolean>;

  /**
   * Remove file
   */
  remove(path: string): PromiseFast<boolean>;

  /**
   * Remove directory
   */
  rmdir(path: string): PromiseFast<boolean>;

  /**
   * Rename/move file
   */
  rename(oldPath: string, newPath: string): PromiseFast<boolean>;
}
