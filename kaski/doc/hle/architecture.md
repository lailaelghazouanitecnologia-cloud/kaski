# HLE Architecture

## System Overview

The PSP HLE system emulates the PSP's operating system by implementing syscalls directly rather than running actual firmware. This approach is faster but requires implementing each system function individually.

## Core Components

### 1. EmulatorContext

The central hub that holds references to all managers and provides a unified interface for HLE modules.

```typescript
class EmulatorContext {
  readonly memory: Memory;           // Physical RAM access
  readonly memoryManager: MemoryManager;
  readonly threadManager: ThreadManager;
  readonly callbackManager: CallbackManager;
  readonly moduleManager: ModuleManager;
  readonly fileManager: FileManager;

  // Quick access to CPU registers
  gpr(index: number): number;
  arg(index: number): number;
  setReturnValue(value: number): void;

  // Memory access
  read32(address: number): number;
  write32(address: number, value: number): void;
  readString(address: number): string;
}
```

### 2. MemoryManager

Manages PSP memory partitions using a tree-based allocation system.

**Partitions:**
| ID | Name | Address Range | Size | Purpose |
|----|------|---------------|------|---------|
| 1 | Kernel0 | 0x88000000-0x88300000 | 3MB | Kernel code/data |
| 2 | Kernel1 | - | - | Reserved |
| 3 | User | 0x08800000-0x0A000000 | 24MB | User code/data |
| 5 | Volatile | 0x0A000000-0x0A400000 | 4MB | Temporary allocations |
| 6 | UserStacks | 0x09F00000-0x0A000000 | 1MB | Thread stacks |

**Allocation Algorithm:**
```
MemoryPartition (tree structure)
├── Free block (0x08800000 - 0x08900000)
├── Allocated "game_code" (0x08900000 - 0x08A00000)
├── Free block (0x08A00000 - 0x09000000)
└── Allocated "heap" (0x09000000 - 0x09800000)

When freeing, adjacent free blocks are merged automatically.
```

### 3. ThreadManager

Manages PSP threads with priority-based scheduling.

**Thread States:**
```
DORMANT ──start()──> READY ──schedule()──> RUNNING
    ^                  ^                       │
    │                  │                       │
    └──exitThread()────┴──────wait/sleep───────┘
                              │
                              v
                            WAIT ──complete()──> READY
                              │
                              v
                        WAIT_SUSPEND
```

**Priority System:**
- Range: 1-127 (lower = higher priority)
- Scheduler always picks the highest-priority READY thread
- Same-priority threads can be rotated via `sceKernelRotateThreadReadyQueue`

**Wait Types:**
| Type | Description | Wakeup Trigger |
|------|-------------|----------------|
| SLEEP | Explicit sleep | sceKernelWakeupThread |
| DELAY | Timed delay | Timeout |
| SEMA | Semaphore wait | Signal |
| EVENTFLAG | Event flag wait | Set bits |
| IO | File I/O | Operation complete |
| VBLANK | VBlank wait | Display refresh |

### 4. CallbackManager

Manages PSP callbacks - functions that are called when specific events occur.

```typescript
interface Callback {
  uid: number;
  name: string;
  threadUid: number;      // Owner thread
  functionAddr: number;   // Function to call
  commonArg: number;      // First argument
  notifyCount: number;    // Pending notifications
  notifyArg: number;      // Notification argument
}
```

**Callback Flow:**
1. Create callback with `sceKernelCreateCallback`
2. Register with system (e.g., VBlank callback)
3. System calls `notifyCallback` when event occurs
4. If thread is callback-accepting, execute callback function
5. Resume thread execution

### 5. ModuleManager

Registry for HLE modules and syscall mapping.

**NID System:**
- Each PSP function has a unique 32-bit NID (Numeric ID)
- NIDs are determined by hashing the function name
- Example: `sceKernelCreateThread` → `0x446D8DE6`

**Registration Flow:**
```typescript
@hleModule('ThreadManForUser')
class ThreadManForUser {
  @nativeFunction(0x446D8DE6, 150)
  sceKernelCreateThread() {
    // Implementation
  }
}

moduleManager.registerModule(ThreadManForUser);
// Now getFunction(0x446D8DE6) returns the handler
```

### 6. FileManager

Manages mounted devices and file handles.

**Device System:**
```
ms0:   → Memory Stick (save data, homebrew)
umd0:  → UMD disc (game data)
flash0: → Flash memory (firmware)
host0: → Host filesystem (development)
emu0:  → Emulator-specific files
```

**File Handle Lifecycle:**
```
open("ms0:/file.txt") → FileHandle(uid=1)
    │
    ├── read(size) → data
    ├── write(data) → bytesWritten
    ├── seek(offset, mode) → position
    │
    v
close(uid) → release handle
```

## Syscall Flow

When a PSP program makes a syscall:

```
1. PSP Code
   lui   $v1, 0x0880
   syscall 0x206E  ; syscall number

2. Interpreter detects syscall
   ↓
3. Look up NID from import table
   ↓
4. ModuleManager.call(nid)
   ↓
5. HLE function executes
   - Reads args from CPU registers ($a0-$a3, stack)
   - Performs operation
   - Sets return value in $v0 (and $v1 for 64-bit)
   ↓
6. For async operations:
   - Create PromiseFast
   - Suspend thread (status = WAIT)
   - When promise resolves, resume thread
   ↓
7. Continue execution
```

## Async Operation Pattern

Many PSP syscalls are blocking (file I/O, display sync, etc.). In the emulator, we handle this with promises:

```typescript
@nativeFunction(0x6A638D83, 150)
sceIoRead(): number | Promise<number> {
  const fd = this.ctx.arg(0);
  const dataPtr = this.ctx.argPtr(1);
  const size = this.ctx.arg(2);

  // Returns a Promise - thread will suspend until resolved
  return this.ctx.fileManager.read(fd, size).then(result => {
    // Copy data to memory
    for (let i = 0; i < result.data.length; i++) {
      this.ctx.write8(dataPtr + i, result.data[i]);
    }
    return result.data.length;
  }).toPromise();
}
```

**Thread Suspension:**
1. Syscall returns a Promise
2. Thread state changes to WAIT with appropriate WaitType
3. Scheduler picks another thread
4. When Promise resolves, thread becomes READY
5. Result value is placed in $v0

## Error Handling

All HLE functions return error codes on failure:

```typescript
// Success
return 0;  // SCE_OK

// Error
return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;  // 0x800200E5

// Check in caller
if (result & 0x80000000) {
  // It's an error
}
```

Common error categories:
- `0x800200XX` - Kernel errors
- `0x800100XX` - POSIX errno errors
- `0x802600XX` - Audio errors
- `0x801100XX` - Utility errors

## Memory Access Patterns

HLE functions often need to read/write PSP memory:

```typescript
// Read a structure from memory
const threadId = ctx.read32(addr + 0);
const priority = ctx.read32(addr + 4);
const name = ctx.readString(addr + 8);

// Write a structure to memory
ctx.write32(addr + 0, resultCode);
ctx.write32(addr + 4, threadId);
ctx.writeString(addr + 8, threadName);

// Copy buffer to/from memory
for (let i = 0; i < size; i++) {
  ctx.write8(dstAddr + i, srcBuffer[i]);
}
```

## Callback Execution Model

When a thread accepts callbacks (via `*CB` variants of functions):

```
Thread in WAIT state (callbackAccepting = true)
    │
    v
CallbackManager.hasPendingCallbacks(threadUid)
    │
    ├── No  → Continue waiting
    │
    └── Yes → Execute callback
              1. Save CPU state
              2. Set PC to callback function
              3. Set args: $a0=count, $a1=arg, $a2=common
              4. Execute callback
              5. Restore CPU state
              6. Decrement notifyCount
              7. Resume waiting
```
