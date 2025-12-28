# HLE - High Level Emulation

## Overview

HLE (High Level Emulation) provides emulation of PSP system calls (syscalls) without needing to run the actual PSP firmware. Instead of emulating the BIOS at the instruction level, HLE implements each syscall directly in TypeScript.

The PSP has ~60 system modules with 300+ functions that games can call. Each function is identified by a unique NID (Numeric ID).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EmulatorContext                          │
│  Central hub containing all managers and providing          │
│  cross-component communication                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │MemoryManager │  │ThreadManager │  │CallbackMgr   │      │
│  │              │  │              │  │              │      │
│  │- Partitions  │  │- Threads     │  │- Callbacks   │      │
│  │- Allocation  │  │- Scheduling  │  │- Notify      │      │
│  │- Free/Merge  │  │- Wait/Resume │  │- Queue       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ModuleManager │  │FileManager   │                        │
│  │              │  │              │                        │
│  │- NID Mapping │  │- VFS Devices │                        │
│  │- Syscalls    │  │- File Handles│                        │
│  │- Decorators  │  │- Directories │                        │
│  └──────────────┘  └──────────────┘                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                      HLE Modules                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │SysMemUser    │  │ThreadManFor  │  │IoFileMgrFor  │      │
│  │ForUser       │  │User          │  │User          │      │
│  │              │  │              │  │              │      │
│  │@0x237DBD4F   │  │@0x446D8DE6   │  │@0x109F50BC   │      │
│  │@0xB6D61D02   │  │@0x9FA03CD3   │  │@0x810C4BC3   │      │
│  │...           │  │...           │  │...           │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Status

| Category | Legacy | Kaski | Status |
|----------|--------|-------|--------|
| **Modules** | 55 | 3 | 5.5% |
| **Functions** | 361 | 49 | 13.6% |
| **Thread Core** | ✓ | ✓ | Partial |
| **Synchronization** | ✓ | ✗ | Missing |
| **File I/O** | ✓ | ✓ | Complete |
| **Display** | ✓ | ✗ | Missing |
| **Audio** | ✓ | ✗ | Missing |
| **Input** | ✓ | ✗ | Missing |

## Directory Structure

```
hle/
├── errors.ts          # PSP error codes (~200 codes)
├── EmulatorContext.ts # Central hub for all managers
├── manager/           # Core system managers
│   ├── MemoryManager.ts
│   ├── ThreadManager.ts
│   ├── CallbackManager.ts
│   └── ModuleManager.ts
├── vfs/               # Virtual File System
│   ├── types.ts
│   ├── MemoryVfs.ts
│   └── FileManager.ts
└── module/            # HLE module implementations
    ├── SysMemUserForUser.ts
    ├── ThreadManForUser.ts
    └── IoFileMgrForUser.ts
```

## Quick Start

```typescript
import { Memory } from 'kaski/core';
import { EmulatorContext, SysMemUserForUser, ThreadManForUser, IoFileMgrForUser } from 'kaski/hle';

// Create context
const memory = new Memory();
const ctx = new EmulatorContext(memory);

// Register HLE modules
ctx.moduleManager.registerModule(SysMemUserForUser);
ctx.moduleManager.registerModule(ThreadManForUser);
ctx.moduleManager.registerModule(IoFileMgrForUser);

// Now syscalls are available by NID
const func = ctx.moduleManager.getFunction(0x237DBD4F); // sceKernelAllocPartitionMemory
```

## Documentation Index

1. [Architecture](./architecture.md) - Detailed system design
2. [Modules](./modules.md) - Module system and NID mapping
3. [Threading](./threading.md) - Thread management and scheduling
4. [Memory](./memory.md) - Memory partitions and allocation
5. [VFS](./vfs.md) - Virtual file system
6. [Implementing Modules](./implementing-modules.md) - How to add new modules
7. [Missing Modules](./missing-modules.md) - What needs to be implemented
8. [Error Codes](./errors.md) - PSP error codes reference
