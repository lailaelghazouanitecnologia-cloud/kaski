# Virtual File System (VFS)

This document describes the PSP virtual file system abstraction.

## Overview

The VFS provides a unified interface for file operations across different storage backends:

```
┌─────────────────────────────────────────────────────────────┐
│                      FileManager                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Device Map  │  │ File Handles│  │ Current Directory   │  │
│  │ ms0: → VFS  │  │ uid → Entry │  │ ms0:/PSP/GAME/...   │  │
│  │ umd0: → VFS │  │             │  │                     │  │
│  │ emu0: → VFS │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │                   │
          ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   MemoryVfs     │  │    IsoVfs       │  │   HostVfs       │
│ (In-memory FS)  │  │ (UMD ISO/CSO)   │  │ (Host filesystem│
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## PSP Device Names

| Device   | Description                    | Typical Mount Point    |
|----------|--------------------------------|------------------------|
| `ms0:`   | Memory Stick                   | /memstick/             |
| `umd0:`  | UMD disc                       | game.iso               |
| `disc0:` | UMD disc (alias)               | game.iso               |
| `flash0:`| Flash storage (system)         | /flash0/               |
| `flash1:`| Flash storage (settings)       | /flash1/               |
| `emu0:`  | Emulator virtual device        | /host/                 |
| `host0:` | Host filesystem (devkit)       | /                      |

## Path Resolution

```
Input: "ms0:/PSP/GAME/GAME001/EBOOT.PBP"
        ↓
Split: device="ms0:", path="/PSP/GAME/GAME001/EBOOT.PBP"
        ↓
Lookup: devices.get("ms0:") → MemoryVfs
        ↓
Forward: vfs.open("/PSP/GAME/GAME001/EBOOT.PBP")
```

### Path Normalization

```typescript
// These are all equivalent:
"ms0:/PSP/GAME/../SAVEDATA/file.dat"
"ms0:/PSP/SAVEDATA/file.dat"
"ms0:PSP/SAVEDATA/file.dat"  // Leading slash optional

// Case handling (PSP is case-insensitive)
"MS0:/psp/game/test.prx" → "ms0:/PSP/GAME/test.prx"
```

## VFS Interface

```typescript
interface Vfs {
  readonly name: string;

  // File operations
  open(path: string, flags: OpenFlags, mode?: number): PromiseFast<VfsEntry | null>;
  openDir(path: string): PromiseFast<VfsEntry | null>;
  stat(path: string): PromiseFast<FileStat | null>;
  exists(path: string): PromiseFast<boolean>;

  // Modification operations
  mkdir(path: string): PromiseFast<boolean>;
  remove(path: string): PromiseFast<boolean>;
  rmdir(path: string): PromiseFast<boolean>;
  rename(oldPath: string, newPath: string): PromiseFast<boolean>;
}
```

## Open Flags

```typescript
enum OpenFlags {
  Read        = 0x0001,  // Read access
  Write       = 0x0002,  // Write access
  ReadWrite   = 0x0003,  // Read + Write
  NonBlocking = 0x0004,  // Non-blocking mode
  Append      = 0x0100,  // Append mode
  Create      = 0x0200,  // Create if not exists
  Truncate    = 0x0400,  // Truncate on open
  Exclusive   = 0x0800,  // Fail if exists
}

// PSP flag mapping:
// PSP 0x0001 → Read
// PSP 0x0002 → Write
// PSP 0x0100 → Append
// PSP 0x0200 → Create
// PSP 0x0400 → Truncate
// PSP 0x0800 → Exclusive
```

## VfsEntry Interface

```typescript
interface VfsEntry {
  readonly isFile: boolean;
  readonly isDirectory: boolean;
  readonly path: string;
  position: number;  // Current file position

  // File operations
  read(size: number): PromiseFast<Uint8Array>;
  write(data: Uint8Array): PromiseFast<number>;
  seek(offset: number, mode: SeekMode): PromiseFast<number>;
  getSize(): PromiseFast<number>;
  stat(): PromiseFast<FileStat>;
  close(): PromiseFast<void>;

  // Directory operations
  readDir(): PromiseFast<DirEntry[]>;
}
```

## File Statistics

```typescript
interface FileStat {
  mode: number;    // File type (file/directory/link)
  size: number;    // Size in bytes
  atime: Date;     // Access time
  mtime: Date;     // Modification time
  ctime: Date;     // Creation time
}

enum FileMode {
  Directory = 0x1000,  // d---------
  File      = 0x2000,  // ----------
  Link      = 0x4000,  // l---------
}
```

## MemoryVfs Implementation

In-memory filesystem for testing and embedded resources:

```typescript
class MemoryVfs implements Vfs {
  private root: MemoryDirectory;

  // Add files programmatically
  addFile(path: string, data: Uint8Array): void;
  addDirectory(path: string): void;
}
```

### Usage Example

```typescript
const vfs = new MemoryVfs();

// Add game files
vfs.addDirectory('/PSP');
vfs.addDirectory('/PSP/GAME');
vfs.addDirectory('/PSP/GAME/TEST');
vfs.addFile('/PSP/GAME/TEST/EBOOT.PBP', ebootData);

// Mount as memory stick
fileManager.mount('ms0:', vfs);
```

## FileManager

Central hub for file operations:

```typescript
class FileManager {
  // Device management
  mount(device: string, vfs: Vfs): void;
  unmount(device: string): void;

  // File operations
  open(path: string, flags: OpenFlags, mode?: number): PromiseFast<OpenResult>;
  close(fd: number): PromiseFast<number>;
  read(fd: number, size: number): PromiseFast<ReadResult>;
  write(fd: number, data: Uint8Array): PromiseFast<WriteResult>;
  seek(fd: number, offset: number, mode: SeekMode): PromiseFast<SeekResult>;

  // Directory operations
  openDir(path: string): PromiseFast<OpenResult>;
  stat(path: string): PromiseFast<StatResult>;

  // File system operations
  mkdir(path: string): PromiseFast<number>;
  rmdir(path: string): PromiseFast<number>;
  remove(path: string): PromiseFast<number>;
  rename(oldPath: string, newPath: string): PromiseFast<number>;

  // Working directory
  cwd: string;  // Current working directory
}
```

## API Functions (IoFileMgrForUser)

### File Operations

| NID        | Function         | Description                    |
|------------|-----------------|--------------------------------|
| 0x109F50BC | sceIoOpen       | Open a file                    |
| 0x810C4BC3 | sceIoClose      | Close a file                   |
| 0x6A638D83 | sceIoRead       | Read from file                 |
| 0x42EC03AC | sceIoWrite      | Write to file                  |
| 0x27EB27B8 | sceIoLseek      | Seek (64-bit offset)           |
| 0x68963324 | sceIoLseek32    | Seek (32-bit offset)           |

### Directory Operations

| NID        | Function         | Description                    |
|------------|-----------------|--------------------------------|
| 0xB29DDF9C | sceIoDopen      | Open directory                 |
| 0xEB092469 | sceIoDclose     | Close directory                |
| 0xE3EB004C | sceIoDread      | Read directory entry           |

### Filesystem Operations

| NID        | Function         | Description                    |
|------------|-----------------|--------------------------------|
| 0xACE946E8 | sceIoGetstat    | Get file statistics            |
| 0x06A70004 | sceIoMkdir      | Create directory               |
| 0x1117C65F | sceIoRmdir      | Remove directory               |
| 0xF27A9C51 | sceIoRemove     | Remove file                    |
| 0x779103A0 | sceIoRename     | Rename file                    |
| 0x55F4717D | sceIoChdir      | Change directory               |

## Special File Descriptors

| FD | Description                                  |
|----|----------------------------------------------|
| 0  | stdin (not typically used)                   |
| 1  | stdout (console output)                      |
| 2  | stderr (error output)                        |

```typescript
// Writing to stdout/stderr is handled specially
if (fd === 1 || fd === 2) {
  const text = new TextDecoder().decode(data);
  console.log('[PSP stdout]', text);
  return size;
}
```

## SceIoDirent Structure

Directory entry structure returned by sceIoDread:

```
Offset  Size  Field
──────────────────────────────────────
0x00    96    SceIoStat d_stat
0x00    4       mode (file type)
0x04    4       attr (attributes)
0x08    8       size (file size)
0x10    16      ctime (creation time)
0x20    16      atime (access time)
0x30    16      mtime (modification time)
0x40    24      private (reserved)
0x58    256   char d_name[256]
0x158   4     void* d_private
0x15C   4     int d_dummy
──────────────────────────────────────
Total: 352 bytes
```

## Error Handling

| Error                          | Code       | Description                    |
|--------------------------------|------------|--------------------------------|
| ERROR_ERRNO_FILE_NOT_FOUND     | 0x80010002 | File doesn't exist             |
| ERROR_ERRNO_FILE_EXISTS        | 0x80010011 | File already exists            |
| ERROR_ERRNO_DEVICE_NOT_FOUND   | 0x80010013 | Device not mounted             |
| ERROR_ERRNO_IS_DIRECTORY       | 0x80010015 | Path is a directory            |
| ERROR_ERRNO_INVALID_ARGUMENT   | 0x80010016 | Invalid parameter              |
| ERROR_ERRNO_TOO_MANY_OPEN_FILES| 0x80010018 | Too many open file handles     |
| ERROR_KERNEL_UNKNOWN_UID       | 0x800200CB | Invalid file descriptor        |

## Async Operations

Many file operations have async variants (suffix `Async`):

```typescript
// Sync version - blocks until complete
fd = sceIoOpen("ms0:/file.dat", flags, 0);

// Async version - returns immediately
fd = sceIoOpenAsync("ms0:/file.dat", flags, 0);
// Poll for completion
sceIoPollAsync(fd, &result);
// Or wait for completion
sceIoWaitAsync(fd, &result);
```

Currently, async operations are implemented as synchronous.

## Implementation Status

### Implemented

- [x] Basic file open/close/read/write
- [x] Directory operations
- [x] Path parsing and device routing
- [x] MemoryVfs backend
- [x] stdout/stderr handling

### Not Implemented

- [ ] IsoVfs (UMD/ISO reading)
- [ ] CsoVfs (compressed ISO)
- [ ] HostVfs (host filesystem access)
- [ ] Async operation queuing
- [ ] File locking
- [ ] Devctl operations
- [ ] Ioctl operations

## Related Documentation

- [Architecture Overview](./architecture.md)
- [Implementing Modules](./implementing-modules.md)
- [Error Codes](./errors.md)
