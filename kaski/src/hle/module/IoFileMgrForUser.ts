/**
 * IoFileMgrForUser
 *
 * File I/O management module.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';
import { OpenFlags, SeekMode } from '../vfs/types';
import { BitFlags } from '../../util/BitFlags';

// PSP open flags
const enum PspOpenFlags
{
  Read = 0x0001,
  Write = 0x0002,
  Append = 0x0100,
  Create = 0x0200,
  Truncate = 0x0400,
  Exclusive = 0x0800,
}

// Flag mapping from PSP to internal
const OPEN_FLAGS_MAP = [
  [PspOpenFlags.Read, OpenFlags.Read],
  [PspOpenFlags.Write, OpenFlags.Write],
  [PspOpenFlags.Append, OpenFlags.Append],
  [PspOpenFlags.Create, OpenFlags.Create],
  [PspOpenFlags.Truncate, OpenFlags.Truncate],
  [PspOpenFlags.Exclusive, OpenFlags.Exclusive],
] as const;

// Seek mode mapping
const SEEK_MODE_MAP: Record<number, SeekMode | undefined> = {
  0: SeekMode.Set,
  1: SeekMode.Current,
  2: SeekMode.End,
};

@hleModule('IoFileMgrForUser')
export class IoFileMgrForUser
{
  readonly name = 'IoFileMgrForUser';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  // ============================================
  // File Operations
  // ============================================

  /**
   * sceIoOpen
   * Open a file
   *
   * @param file - File path
   * @param flags - Open flags
   * @param mode - File mode
   * @returns File descriptor or error
   */
  @nativeFunction(0x109F50BC, 150)
  sceIoOpen(): number | Promise<number>
  {
    const filePtr = this.ctx.argPtr(0);
    const pspFlags = this.ctx.arg(1);
    const mode = this.ctx.arg(2);

    const file = this.ctx.readString(filePtr);
    this.ctx.log(`sceIoOpen("${file}", 0x${pspFlags.toString(16)}, 0x${mode.toString(16)})`);

    // Convert PSP flags to internal flags
    const openFlags = BitFlags.map(pspFlags, OPEN_FLAGS_MAP).value as OpenFlags;

    return this.ctx.fileManager.open(file, openFlags, mode).then(result =>
    {
      if (!result.handle)
      {
        return result.error;
      }
      return result.handle.uid;
    }).toPromise();
  }

  /**
   * sceIoOpenAsync
   * Open a file asynchronously
   */
  @nativeFunction(0x89AA9906, 150)
  sceIoOpenAsync(): number | Promise<number>
  {
    return this.sceIoOpen();
  }

  /**
   * sceIoClose
   * Close a file
   *
   * @param fd - File descriptor
   * @returns 0 or error
   */
  @nativeFunction(0x810C4BC3, 150)
  sceIoClose(): number | Promise<number>
  {
    const fd = this.ctx.arg(0);
    return this.ctx.fileManager.close(fd).toPromise();
  }

  /**
   * sceIoCloseAsync
   * Close a file asynchronously
   */
  @nativeFunction(0xFF5940B6, 150)
  sceIoCloseAsync(): number | Promise<number>
  {
    return this.sceIoClose();
  }

  /**
   * sceIoRead
   * Read from a file
   *
   * @param fd - File descriptor
   * @param data - Buffer to read into
   * @param size - Number of bytes to read
   * @returns Bytes read or error
   */
  @nativeFunction(0x6A638D83, 150)
  sceIoRead(): number | Promise<number>
  {
    const fd = this.ctx.arg(0);
    const dataPtr = this.ctx.argPtr(1);
    const size = this.ctx.arg(2);

    return this.ctx.fileManager.read(fd, size).then(result =>
    {
      if (result.error !== SceKernelErrors.ERROR_OK)
      {
        return result.error;
      }

      // Copy data to memory
      for (let i = 0; i < result.data.length; i++)
      {
        this.ctx.write8(dataPtr + i, result.data[i]);
      }

      return result.data.length;
    }).toPromise();
  }

  /**
   * sceIoReadAsync
   * Read from a file asynchronously
   */
  @nativeFunction(0xA0B5A7C2, 150)
  sceIoReadAsync(): number | Promise<number>
  {
    return this.sceIoRead();
  }

  /**
   * sceIoWrite
   * Write to a file
   *
   * @param fd - File descriptor
   * @param data - Buffer to write
   * @param size - Number of bytes to write
   * @returns Bytes written or error
   */
  @nativeFunction(0x42EC03AC, 150)
  sceIoWrite(): number | Promise<number>
  {
    const fd = this.ctx.arg(0);
    const dataPtr = this.ctx.argPtr(1);
    const size = this.ctx.arg(2);

    // Copy data from memory
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++)
    {
      data[i] = this.ctx.read8(dataPtr + i);
    }

    // Handle stdout (fd=1) and stderr (fd=2)
    if (fd === 1 || fd === 2)
    {
      const text = new TextDecoder().decode(data);
      if (fd === 1)
      {
        console.log('[PSP stdout]', text);
      }
      else
      {
        console.error('[PSP stderr]', text);
      }
      return size;
    }

    return this.ctx.fileManager.write(fd, data).then(result =>
    {
      if (result.error !== SceKernelErrors.ERROR_OK)
      {
        return result.error;
      }
      return result.written;
    }).toPromise();
  }

  /**
   * sceIoWriteAsync
   * Write to a file asynchronously
   */
  @nativeFunction(0x0FACAB19, 150)
  sceIoWriteAsync(): number | Promise<number>
  {
    return this.sceIoWrite();
  }

  /**
   * sceIoLseek
   * Seek in a file (64-bit offset)
   *
   * @param fd - File descriptor
   * @param offset - Offset (64-bit)
   * @param whence - Seek mode
   * @returns New position (64-bit) or error
   */
  @nativeFunction(0x27EB27B8, 150)
  sceIoLseek(): number | Promise<number>
  {
    const fd = this.ctx.arg(0);
    // Offset is 64-bit, passed in a1:a2 (MIPS calling convention)
    const offsetLow = this.ctx.arg(2);
    const whence = this.ctx.arg(4);

    const offset = offsetLow; // For now, ignore high bits
    const mode = SEEK_MODE_MAP[whence];
    if (mode === undefined)
    {
      return SceKernelErrors.ERROR_ERRNO_INVALID_ARGUMENT;
    }

    return this.ctx.fileManager.seek(fd, offset, mode).then(result =>
    {
      if (result.error !== SceKernelErrors.ERROR_OK)
      {
        return result.error;
      }
      // Return 64-bit result in v0:v1
      this.ctx.setReturnValue64(result.position.low, result.position.high);
      return result.position.low;
    }).toPromise();
  }

  /**
   * sceIoLseek32
   * Seek in a file (32-bit offset)
   *
   * @param fd - File descriptor
   * @param offset - Offset
   * @param whence - Seek mode
   * @returns New position or error
   */
  @nativeFunction(0x68963324, 150)
  sceIoLseek32(): number | Promise<number>
  {
    const fd = this.ctx.arg(0);
    const offset = this.ctx.arg(1);
    const whence = this.ctx.arg(2);

    const mode = SEEK_MODE_MAP[whence];
    if (mode === undefined)
    {
      return SceKernelErrors.ERROR_ERRNO_INVALID_ARGUMENT;
    }

    return this.ctx.fileManager.seek(fd, offset, mode).then(result =>
    {
      if (result.error !== SceKernelErrors.ERROR_OK)
      {
        return result.error;
      }
      return result.position.low;
    }).toPromise();
  }

  // ============================================
  // Directory Operations
  // ============================================

  /**
   * sceIoDopen
   * Open a directory
   *
   * @param dirname - Directory path
   * @returns Directory descriptor or error
   */
  @nativeFunction(0xB29DDF9C, 150)
  sceIoDopen(): number | Promise<number>
  {
    const dirnamePtr = this.ctx.argPtr(0);
    const dirname = this.ctx.readString(dirnamePtr);

    return this.ctx.fileManager.openDir(dirname).then(result =>
    {
      if (!result.handle)
      {
        return result.error;
      }
      return result.handle.uid;
    }).toPromise();
  }

  /**
   * sceIoDclose
   * Close a directory
   *
   * @param fd - Directory descriptor
   * @returns 0 or error
   */
  @nativeFunction(0xEB092469, 150)
  sceIoDclose(): number | Promise<number>
  {
    const fd = this.ctx.arg(0);
    return this.ctx.fileManager.close(fd).toPromise();
  }

  /**
   * sceIoDread
   * Read a directory entry
   *
   * @param fd - Directory descriptor
   * @param dir - SceIoDirent structure
   * @returns 1 if entry read, 0 if end, or error
   */
  @nativeFunction(0xE3EB004C, 150)
  sceIoDread(): number | Promise<number>
  {
    const fd = this.ctx.arg(0);
    const dirPtr = this.ctx.argPtr(1);

    const handle = this.ctx.fileManager.getHandle(fd);
    if (!handle)
    {
      return SceKernelErrors.ERROR_KERNEL_UNKNOWN_UID;
    }

    return handle.entry.readDir().then(entries =>
    {
      if (entries.length === 0)
      {
        return 0; // No more entries
      }

      // Write first entry to SceIoDirent structure
      const entry = entries[0];
      const stat = entry.stat;

      // SceIoDirent structure:
      // 0x00: SceIoStat d_stat
      //   0x00: mode (4)
      //   0x04: attr (4)
      //   0x08: size (8)
      //   0x10: ctime (16)
      //   0x20: atime (16)
      //   0x30: mtime (16)
      //   0x40: private (24)
      // 0x58: char d_name[256]

      // Write mode and size
      this.ctx.write32(dirPtr + 0x00, stat.mode);
      this.ctx.write32(dirPtr + 0x04, 0); // attr
      this.ctx.write32(dirPtr + 0x08, stat.size);
      this.ctx.write32(dirPtr + 0x0C, 0); // size high

      // Write name
      const nameOffset = 0x58;
      const name = entry.name;
      for (let i = 0; i < name.length && i < 255; i++)
      {
        this.ctx.write8(dirPtr + nameOffset + i, name.charCodeAt(i));
      }
      this.ctx.write8(dirPtr + nameOffset + name.length, 0); // Null terminate

      return 1;
    }).toPromise();
  }

  // ============================================
  // Stat Operations
  // ============================================

  /**
   * sceIoGetstat
   * Get file statistics
   *
   * @param file - File path
   * @param stat - SceIoStat structure
   * @returns 0 or error
   */
  @nativeFunction(0xACE946E8, 150)
  sceIoGetstat(): number | Promise<number>
  {
    const filePtr = this.ctx.argPtr(0);
    const statPtr = this.ctx.argPtr(1);

    const file = this.ctx.readString(filePtr);

    return this.ctx.fileManager.stat(file).then(result =>
    {
      if (!result.stat)
      {
        return result.error;
      }

      const stat = result.stat;

      // Write SceIoStat structure
      this.ctx.write32(statPtr + 0x00, stat.mode);
      this.ctx.write32(statPtr + 0x04, 0); // attr
      this.ctx.write32(statPtr + 0x08, stat.size);
      this.ctx.write32(statPtr + 0x0C, 0); // size high

      return SceKernelErrors.ERROR_OK;
    }).toPromise();
  }

  // ============================================
  // File System Operations
  // ============================================

  /**
   * sceIoMkdir
   * Create a directory
   *
   * @param dir - Directory path
   * @param mode - Mode
   * @returns 0 or error
   */
  @nativeFunction(0x06A70004, 150)
  sceIoMkdir(): number | Promise<number>
  {
    const dirPtr = this.ctx.argPtr(0);
    const dir = this.ctx.readString(dirPtr);

    return this.ctx.fileManager.mkdir(dir).toPromise();
  }

  /**
   * sceIoRmdir
   * Remove a directory
   *
   * @param path - Directory path
   * @returns 0 or error
   */
  @nativeFunction(0x1117C65F, 150)
  sceIoRmdir(): number | Promise<number>
  {
    const pathPtr = this.ctx.argPtr(0);
    const path = this.ctx.readString(pathPtr);

    return this.ctx.fileManager.rmdir(path).toPromise();
  }

  /**
   * sceIoRemove
   * Remove a file
   *
   * @param file - File path
   * @returns 0 or error
   */
  @nativeFunction(0xF27A9C51, 150)
  sceIoRemove(): number | Promise<number>
  {
    const filePtr = this.ctx.argPtr(0);
    const file = this.ctx.readString(filePtr);

    return this.ctx.fileManager.remove(file).toPromise();
  }

  /**
   * sceIoRename
   * Rename a file
   *
   * @param oldname - Old path
   * @param newname - New path
   * @returns 0 or error
   */
  @nativeFunction(0x779103A0, 150)
  sceIoRename(): number | Promise<number>
  {
    const oldnamePtr = this.ctx.argPtr(0);
    const newnamePtr = this.ctx.argPtr(1);

    const oldname = this.ctx.readString(oldnamePtr);
    const newname = this.ctx.readString(newnamePtr);

    return this.ctx.fileManager.rename(oldname, newname).toPromise();
  }

  /**
   * sceIoChdir
   * Change current directory
   *
   * @param path - New directory
   * @returns 0 or error
   */
  @nativeFunction(0x55F4717D, 150)
  sceIoChdir(): number
  {
    const pathPtr = this.ctx.argPtr(0);
    const path = this.ctx.readString(pathPtr);

    this.ctx.fileManager.cwd = path;
    return 0;
  }
}
