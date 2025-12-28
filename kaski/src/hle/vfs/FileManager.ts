/**
 * File Manager
 *
 * Manages mounted devices and file handles.
 * Provides the interface for PSP file I/O syscalls.
 */

import { UidCollection } from '../../util/UidCollection';
import { PromiseFast } from '../../util/PromiseFast';
import { Int64 } from '../../util/Int64';
import { SceKernelErrors } from '../errors';
import {
  Vfs, VfsEntry, FileStat, DirEntry,
  OpenFlags, SeekMode, FileMode,
} from './types';
import { MemoryVfs } from './MemoryVfs';

// ============================================
// Device/URI Parsing
// ============================================

/**
 * Parsed URI (device:path format)
 */
export interface ParsedUri
{
  /** Device name (e.g., "ms0", "umd0") */
  device: string;
  /** Path within device */
  path: string;
  /** Full original URI */
  full: string;
}

/**
 * Parse a PSP URI
 */
export function parseUri(uri: string): ParsedUri
{
  const colonIdx = uri.indexOf(':');
  if (colonIdx === -1)
  {
    return { device: '', path: uri, full: uri };
  }

  const device = uri.substring(0, colonIdx);
  let path = uri.substring(colonIdx + 1);

  // Normalize path
  if (path.startsWith('/'))
  {
    path = path.substring(1);
  }

  return { device, path, full: uri };
}

// ============================================
// File Handle
// ============================================

/**
 * An open file handle
 */
export class FileHandle
{
  /** Handle ID */
  uid: number = 0;

  /** VFS entry */
  entry: VfsEntry;

  /** Open flags */
  flags: OpenFlags;

  /** Device name */
  device: string;

  /** Path */
  path: string;

  /** Is async operation in progress? */
  asyncBusy: boolean = false;

  /** Async result */
  asyncResult: number = 0;

  constructor(entry: VfsEntry, flags: OpenFlags, device: string, path: string)
  {
    this.entry = entry;
    this.flags = flags;
    this.device = device;
    this.path = path;
  }

  /** Is this a directory handle? */
  get isDirectory(): boolean
  {
    return this.entry.isDirectory;
  }

  /** Current position */
  get position(): number
  {
    return this.entry.position;
  }
}

// ============================================
// File Manager
// ============================================

/**
 * File Manager
 */
export class FileManager
{
  /** Mounted devices */
  private devices: Map<string, Vfs> = new Map();

  /** Open file handles */
  private handles: UidCollection<FileHandle> = new UidCollection();

  /** Current working directory */
  private _cwd: string = 'ms0:/';

  constructor()
  {
    this.reset();
  }

  /**
   * Reset to initial state
   */
  reset(): void
  {
    this.devices.clear();
    this.handles.clear();
    this._cwd = 'ms0:/';

    // Mount default memory VFS for emulator-specific files
    this.mount('emu0', new MemoryVfs());
  }

  /**
   * Current working directory
   */
  get cwd(): string
  {
    return this._cwd;
  }

  /**
   * Set current working directory
   */
  set cwd(path: string)
  {
    this._cwd = path;
  }

  /**
   * Mount a VFS at a device
   */
  mount(device: string, vfs: Vfs): void
  {
    this.devices.set(device, vfs);
  }

  /**
   * Unmount a device
   */
  unmount(device: string): boolean
  {
    return this.devices.delete(device);
  }

  /**
   * Get VFS for device
   */
  getDevice(device: string): Vfs | undefined
  {
    return this.devices.get(device);
  }

  /**
   * Get all mounted devices
   */
  getMountedDevices(): string[]
  {
    return [...this.devices.keys()];
  }

  /**
   * Resolve path relative to CWD
   */
  resolvePath(path: string): ParsedUri
  {
    const parsed = parseUri(path);

    // If no device, use CWD
    if (!parsed.device)
    {
      const cwdParsed = parseUri(this._cwd);
      return {
        device: cwdParsed.device,
        path: this.joinPath(cwdParsed.path, parsed.path),
        full: `${cwdParsed.device}:/${this.joinPath(cwdParsed.path, parsed.path)}`,
      };
    }

    return parsed;
  }

  private joinPath(base: string, rel: string): string
  {
    if (rel.startsWith('/'))
    {
      return rel.substring(1);
    }
    if (!base)
    {
      return rel;
    }
    if (base.endsWith('/'))
    {
      return base + rel;
    }
    return base + '/' + rel;
  }

  // ============================================
  // File Operations
  // ============================================

  /**
   * Open a file
   */
  open(uri: string, flags: OpenFlags, mode: number = 0): PromiseFast<{ handle: FileHandle | null; error: number }>
  {
    const parsed = this.resolvePath(uri);
    const vfs = this.devices.get(parsed.device);

    if (!vfs)
    {
      return PromiseFast.resolve({
        handle: null,
        error: SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND,
      });
    }

    return vfs.open(parsed.path, flags, mode).then(entry =>
    {
      if (!entry)
      {
        return {
          handle: null,
          error: SceKernelErrors.ERROR_ERRNO_FILE_NOT_FOUND,
        };
      }

      const handle = new FileHandle(entry, flags, parsed.device, parsed.path);
      handle.uid = this.handles.allocate(handle);

      return { handle, error: SceKernelErrors.ERROR_OK };
    });
  }

  /**
   * Open a directory
   */
  openDir(uri: string): PromiseFast<{ handle: FileHandle | null; error: number }>
  {
    const parsed = this.resolvePath(uri);
    const vfs = this.devices.get(parsed.device);

    if (!vfs)
    {
      return PromiseFast.resolve({
        handle: null,
        error: SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND,
      });
    }

    return vfs.openDir(parsed.path).then(entry =>
    {
      if (!entry)
      {
        return {
          handle: null,
          error: SceKernelErrors.ERROR_ERRNO_FILE_NOT_FOUND,
        };
      }

      const handle = new FileHandle(entry, OpenFlags.Read, parsed.device, parsed.path);
      handle.uid = this.handles.allocate(handle);

      return { handle, error: SceKernelErrors.ERROR_OK };
    });
  }

  /**
   * Close a file handle
   */
  close(uid: number): PromiseFast<number>
  {
    const handle = this.handles.get(uid);
    if (!handle)
    {
      return PromiseFast.resolve(SceKernelErrors.ERROR_KERNEL_UNKNOWN_UID);
    }

    return handle.entry.close().then(() =>
    {
      this.handles.release(uid);
      return SceKernelErrors.ERROR_OK;
    });
  }

  /**
   * Get handle by UID
   */
  getHandle(uid: number): FileHandle | undefined
  {
    return this.handles.get(uid);
  }

  /**
   * Read from file
   */
  read(uid: number, size: number): PromiseFast<{ data: Uint8Array; error: number }>
  {
    const handle = this.handles.get(uid);
    if (!handle)
    {
      return PromiseFast.resolve({
        data: new Uint8Array(0),
        error: SceKernelErrors.ERROR_KERNEL_UNKNOWN_UID,
      });
    }

    if (!(handle.flags & OpenFlags.Read))
    {
      return PromiseFast.resolve({
        data: new Uint8Array(0),
        error: SceKernelErrors.ERROR_ERRNO_INVALID_ARGUMENT,
      });
    }

    return handle.entry.read(size).then(data => ({
      data,
      error: SceKernelErrors.ERROR_OK,
    }));
  }

  /**
   * Write to file
   */
  write(uid: number, data: Uint8Array): PromiseFast<{ written: number; error: number }>
  {
    const handle = this.handles.get(uid);
    if (!handle)
    {
      return PromiseFast.resolve({
        written: 0,
        error: SceKernelErrors.ERROR_KERNEL_UNKNOWN_UID,
      });
    }

    if (!(handle.flags & OpenFlags.Write))
    {
      return PromiseFast.resolve({
        written: 0,
        error: SceKernelErrors.ERROR_ERRNO_INVALID_ARGUMENT,
      });
    }

    return handle.entry.write(data).then(written => ({
      written,
      error: SceKernelErrors.ERROR_OK,
    }));
  }

  /**
   * Seek in file
   */
  seek(uid: number, offset: number, mode: SeekMode): PromiseFast<{ position: Int64; error: number }>
  {
    const handle = this.handles.get(uid);
    if (!handle)
    {
      return PromiseFast.resolve({
        position: Int64.ZERO,
        error: SceKernelErrors.ERROR_KERNEL_UNKNOWN_UID,
      });
    }

    return handle.entry.seek(offset, mode).then(pos => ({
      position: Int64.fromNumber(pos),
      error: SceKernelErrors.ERROR_OK,
    }));
  }

  /**
   * Get file statistics by path
   */
  stat(uri: string): PromiseFast<{ stat: FileStat | null; error: number }>
  {
    const parsed = this.resolvePath(uri);
    const vfs = this.devices.get(parsed.device);

    if (!vfs)
    {
      return PromiseFast.resolve({
        stat: null,
        error: SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND,
      });
    }

    return vfs.stat(parsed.path).then(stat =>
    {
      if (!stat)
      {
        return {
          stat: null,
          error: SceKernelErrors.ERROR_ERRNO_FILE_NOT_FOUND,
        };
      }
      return { stat, error: SceKernelErrors.ERROR_OK };
    });
  }

  /**
   * Create directory
   */
  mkdir(uri: string): PromiseFast<number>
  {
    const parsed = this.resolvePath(uri);
    const vfs = this.devices.get(parsed.device);

    if (!vfs)
    {
      return PromiseFast.resolve(SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND);
    }

    return vfs.mkdir(parsed.path).then(success =>
      success ? SceKernelErrors.ERROR_OK : SceKernelErrors.ERROR_ERRNO_FILE_EXISTS
    );
  }

  /**
   * Remove file
   */
  remove(uri: string): PromiseFast<number>
  {
    const parsed = this.resolvePath(uri);
    const vfs = this.devices.get(parsed.device);

    if (!vfs)
    {
      return PromiseFast.resolve(SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND);
    }

    return vfs.remove(parsed.path).then(success =>
      success ? SceKernelErrors.ERROR_OK : SceKernelErrors.ERROR_ERRNO_FILE_NOT_FOUND
    );
  }

  /**
   * Remove directory
   */
  rmdir(uri: string): PromiseFast<number>
  {
    const parsed = this.resolvePath(uri);
    const vfs = this.devices.get(parsed.device);

    if (!vfs)
    {
      return PromiseFast.resolve(SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND);
    }

    return vfs.rmdir(parsed.path).then(success =>
      success ? SceKernelErrors.ERROR_OK : SceKernelErrors.ERROR_ERRNO_FILE_NOT_FOUND
    );
  }

  /**
   * Rename file
   */
  rename(oldUri: string, newUri: string): PromiseFast<number>
  {
    const oldParsed = this.resolvePath(oldUri);
    const newParsed = this.resolvePath(newUri);

    // Must be same device
    if (oldParsed.device !== newParsed.device)
    {
      return PromiseFast.resolve(SceKernelErrors.ERROR_ERRNO_INVALID_ARGUMENT);
    }

    const vfs = this.devices.get(oldParsed.device);
    if (!vfs)
    {
      return PromiseFast.resolve(SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND);
    }

    return vfs.rename(oldParsed.path, newParsed.path).then(success =>
      success ? SceKernelErrors.ERROR_OK : SceKernelErrors.ERROR_ERRNO_FILE_NOT_FOUND
    );
  }

  /**
   * Read directory entries
   */
  readDir(uid: number): PromiseFast<{ entries: DirEntry[]; error: number }>
  {
    const handle = this.handles.get(uid);
    if (!handle)
    {
      return PromiseFast.resolve({
        entries: [],
        error: SceKernelErrors.ERROR_KERNEL_UNKNOWN_UID,
      });
    }

    if (!handle.isDirectory)
    {
      return PromiseFast.resolve({
        entries: [],
        error: SceKernelErrors.ERROR_ERRNO_IS_DIRECTORY,
      });
    }

    return handle.entry.readDir().then(entries => ({
      entries,
      error: SceKernelErrors.ERROR_OK,
    }));
  }

  /**
   * Get handle count
   */
  get handleCount(): number
  {
    return this.handles.size;
  }
}
