# Threading System

## Overview

The PSP supports preemptive multithreading with up to 64 concurrent threads. Threads are scheduled based on priority, with lower numbers indicating higher priority.

## Thread Structure

```typescript
interface Thread {
  uid: number;              // Unique identifier
  name: string;             // Thread name (max 32 chars)
  entryPoint: number;       // Function address
  priority: number;         // 1-127 (lower = higher priority)
  initialPriority: number;  // Priority at creation
  stackSize: number;        // Stack size in bytes
  sp: number;               // Stack pointer
  gp: number;               // Global pointer
  status: ThreadStatus;     // Current state
  exitStatus: number;       // Exit code when terminated
  waitType: WaitType;       // Why thread is waiting
  waitId: number;           // Object being waited on
  waitTimeout: number;      // Timeout in microseconds
  wakeupCount: number;      // Pending wakeups
  callbackAccepting: boolean; // Accept callbacks while waiting
  cpu: CpuState;            // CPU register state
}
```

## Thread States

```
┌──────────┐
│ DORMANT  │ ← Created but not started
└────┬─────┘
     │ sceKernelStartThread()
     ▼
┌──────────┐      sceKernelSuspendThread()      ┌──────────┐
│  READY   │ ──────────────────────────────────>│ SUSPEND  │
└────┬─────┘<──────────────────────────────────┴──────────┘
     │           sceKernelResumeThread()
     │ Scheduler picks thread
     ▼
┌──────────┐
│ RUNNING  │ ← Only ONE thread at a time
└────┬─────┘
     │
     ├─── sceKernelDelayThread() ───────────────┐
     ├─── sceKernelWaitSema() ──────────────────┤
     ├─── sceKernelWaitEventFlag() ─────────────┤
     ├─── sceIoRead() (async) ──────────────────┤
     │                                          ▼
     │                                    ┌──────────┐
     │                                    │   WAIT   │
     │                                    └────┬─────┘
     │                                         │
     │                                         │ Event/timeout
     │                                         │
     │    ┌────────────────────────────────────┘
     │    │
     ├────┴── Returns to READY, then RUNNING
     │
     ├─── sceKernelExitThread() ─────────────> DORMANT
     │
     └─── sceKernelExitDeleteThread() ──────> DEAD (freed)
```

### State Flags

```typescript
enum ThreadStatus {
  RUNNING     = 0x01,  // Currently executing
  READY       = 0x02,  // Ready to run
  WAIT        = 0x04,  // Waiting for event
  SUSPEND     = 0x08,  // Explicitly suspended
  DORMANT     = 0x10,  // Not started or exited
  DEAD        = 0x20,  // Deleted
  WAIT_SUSPEND = WAIT | SUSPEND,  // Waiting + suspended
}
```

## Priority System

The PSP scheduler uses strict priority scheduling:
- Lower priority value = higher priority
- Range: 1 (highest) to 127 (lowest)
- Typical user thread: 32
- System threads: 1-16

**Scheduling Rules:**
1. Always run the highest-priority READY thread
2. Equal-priority threads share time via rotation
3. A thread can voluntarily yield via `sceKernelRotateThreadReadyQueue`

```typescript
// Scheduler pseudocode
function schedule(): Thread | null {
  const ready = threads.filter(t => t.status === READY);
  ready.sort((a, b) => a.priority - b.priority);
  return ready[0] ?? idleThread;
}
```

## Thread Creation

```typescript
// sceKernelCreateThread
@nativeFunction(0x446D8DE6, 150)
sceKernelCreateThread(): number {
  const name = ctx.readString(ctx.arg(0));
  const entry = ctx.arg(1);
  const priority = ctx.arg(2);
  const stackSize = ctx.arg(3);
  const attr = ctx.arg(4);

  // Validate
  if (priority < 1 || priority > 127) {
    return ERROR_KERNEL_ILLEGAL_THREAD_PRIORITY;
  }
  if (stackSize < 0x200) {
    return ERROR_KERNEL_ILLEGAL_STACK_SIZE;
  }

  // Allocate stack from UserStacks partition
  const stack = memoryManager.allocate(
    PartitionId.UserStacks,
    stackSize,
    MemoryAnchor.High
  );

  // Create thread in DORMANT state
  const thread = new Thread(name, entry, priority, stackSize, attr);
  thread.sp = stack.address + stack.size;
  thread.uid = threads.allocate(thread);

  return thread.uid;
}
```

## Thread Startup

```typescript
// sceKernelStartThread
@nativeFunction(0xF475845D, 150)
sceKernelStartThread(): number {
  const thid = ctx.arg(0);
  const arglen = ctx.arg(1);
  const argp = ctx.arg(2);

  const thread = threads.get(thid);
  if (!thread) return ERROR_KERNEL_NOT_FOUND_THREAD;
  if (!thread.isDormant) return ERROR_KERNEL_THREAD_IS_NOT_DORMANT;

  // Set up initial CPU state
  thread.cpu.pc = thread.entryPoint;
  thread.cpu.gpr[29] = thread.sp;   // $sp
  thread.cpu.gpr[28] = thread.gp;   // $gp
  thread.cpu.gpr[4] = arglen;       // $a0 = argument length
  thread.cpu.gpr[5] = argp;         // $a1 = argument pointer
  thread.cpu.gpr[31] = 0;           // $ra = 0 (exit on return)

  thread.status = ThreadStatus.READY;
  return 0;
}
```

## Wait Operations

### Delay (timed wait)

```typescript
// sceKernelDelayThread
sceKernelDelayThread(): Promise<number> {
  const usec = ctx.arg(0);
  const thread = threadManager.getCurrentThread();

  // Start wait
  thread.status = ThreadStatus.WAIT;
  thread.waitType = WaitType.DELAY;

  // Schedule wakeup
  return new Promise(resolve => {
    setTimeout(() => {
      thread.status = ThreadStatus.READY;
      resolve(0);
    }, usec / 1000);
  });
}
```

### Sleep (explicit wake)

```typescript
// sceKernelSleepThread
sceKernelSleepThread(): Promise<number> {
  const thread = threadManager.getCurrentThread();

  // Check for pending wakeups
  if (thread.wakeupCount > 0) {
    thread.wakeupCount--;
    return Promise.resolve(0);
  }

  thread.status = ThreadStatus.WAIT;
  thread.waitType = WaitType.SLEEP;

  return thread.waitDeferred.promise.toPromise();
}

// sceKernelWakeupThread
sceKernelWakeupThread(): number {
  const thid = ctx.arg(0);
  const thread = threads.get(thid);

  if (thread.waitType === WaitType.SLEEP) {
    thread.status = ThreadStatus.READY;
    thread.waitDeferred.resolve(0);
  } else {
    thread.wakeupCount++;  // Queue for later
  }
  return 0;
}
```

## Thread Attributes

```typescript
enum ThreadAttributes {
  NONE           = 0x00000000,
  LOW_STACK      = 0x00000010,  // Use low stack address
  VFPU           = 0x00004000,  // Thread uses VFPU
  USER           = 0x80000000,  // User mode thread
  USBWLAN        = 0xA0000000,  // USB/WLAN thread
  VSH            = 0xC0000000,  // VSH (XMB) thread
  SCRATCH_SRAM   = 0x00008000,  // Use scratchpad for stack
  NO_FILLSTACK   = 0x00100000,  // Don't fill stack with 0xFF
  CLEAR_STACK    = 0x00200000,  // Clear stack on exit
}
```

## Missing: Synchronization Primitives

The following are NOT YET IMPLEMENTED but required for many games:

### Semaphores
```typescript
// NOT IMPLEMENTED
sceKernelCreateSema(name, attr, initVal, maxVal, option)
sceKernelDeleteSema(semaid)
sceKernelSignalSema(semaid, signal)
sceKernelWaitSema(semaid, signal, timeout)
sceKernelPollSema(semaid, signal)
```

### Event Flags
```typescript
// NOT IMPLEMENTED
sceKernelCreateEventFlag(name, attr, bits, option)
sceKernelDeleteEventFlag(evid)
sceKernelSetEventFlag(evid, bits)
sceKernelClearEventFlag(evid, bits)
sceKernelWaitEventFlag(evid, bits, wait, outBits, timeout)
sceKernelPollEventFlag(evid, bits, wait, outBits)
```

### Mutexes
```typescript
// NOT IMPLEMENTED
sceKernelCreateMutex(name, attr, initCount, option)
sceKernelDeleteMutex(mutexid)
sceKernelLockMutex(mutexid, lockCount, timeout)
sceKernelUnlockMutex(mutexid, unlockCount)
```

### Variable Pool (VPL)
```typescript
// NOT IMPLEMENTED
sceKernelCreateVpl(name, part, attr, size, option)
sceKernelDeleteVpl(uid)
sceKernelAllocateVpl(uid, size, data, timeout)
sceKernelFreeVpl(uid, data)
```

### Fixed Pool (FPL)
```typescript
// NOT IMPLEMENTED
sceKernelCreateFpl(name, part, attr, size, blocks, option)
sceKernelDeleteFpl(uid)
sceKernelAllocateFpl(uid, data, timeout)
sceKernelFreeFpl(uid, data)
```

## Common Patterns

### Thread-safe counter
```c
// PSP code
SceUID sema = sceKernelCreateSema("counter", 0, 0, 100, NULL);

// Increment
sceKernelSignalSema(sema, 1);

// Decrement (blocking)
sceKernelWaitSema(sema, 1, NULL);
```

### Producer-consumer
```c
// PSP code
SceUID dataReady = sceKernelCreateEventFlag("data", 0, 0, NULL);

// Producer
produce_data();
sceKernelSetEventFlag(dataReady, 1);

// Consumer
sceKernelWaitEventFlag(dataReady, 1, PSP_EVENT_WAITCLEAR, NULL, NULL);
consume_data();
```

### Mutex for exclusive access
```c
// PSP code
SceUID mutex = sceKernelCreateMutex("lock", 0, 0, NULL);

sceKernelLockMutex(mutex, 1, NULL);
// Critical section
sceKernelUnlockMutex(mutex, 1);
```
