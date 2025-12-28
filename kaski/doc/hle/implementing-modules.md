# Implementing HLE Modules

This guide explains how to implement new HLE modules for PSP syscall emulation.

## Module Structure

Every HLE module follows this pattern:

```typescript
import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

@hleModule('ModuleName')
export class ModuleName {
  readonly name = 'ModuleName';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void {
    this.ctx = ctx;
  }

  reset(): void {
    // Called when emulator resets
  }

  @nativeFunction(0xNID_HERE, 150)
  functionName(): number | Promise<number> {
    // Implementation
  }
}
```

## Step-by-Step Implementation

### 1. Find the NID

NIDs can be found in:
- PSP SDK headers
- Legacy jspspemu code
- PSP documentation/wikis

Example: `sceDisplaySetMode` has NID `0x0E20F177`

### 2. Create the Module File

```typescript
// src/hle/module/sceDisplay.ts

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';

@hleModule('sceDisplay')
export class sceDisplay {
  readonly name = 'sceDisplay';

  private ctx!: EmulatorContext;

  // Display state
  private mode = 0;
  private width = 480;
  private height = 272;
  private frameBuffer = 0;
  private vcount = 0;

  init(ctx: EmulatorContext): void {
    this.ctx = ctx;
  }

  reset(): void {
    this.mode = 0;
    this.width = 480;
    this.height = 272;
    this.frameBuffer = 0;
    this.vcount = 0;
  }
}
```

### 3. Implement Functions

#### Synchronous Function
```typescript
@nativeFunction(0x0E20F177, 150)
sceDisplaySetMode(): number {
  const mode = this.ctx.arg(0);
  const width = this.ctx.arg(1);
  const height = this.ctx.arg(2);

  // Validate
  if (width !== 480 || height !== 272) {
    return SceKernelErrors.ERROR_ERRNO_INVALID_ARGUMENT;
  }

  this.mode = mode;
  this.width = width;
  this.height = height;

  this.ctx.log(`sceDisplaySetMode(${mode}, ${width}, ${height})`);
  return 0;
}
```

#### Asynchronous Function
```typescript
@nativeFunction(0x36CDFADE, 150)
sceDisplayWaitVblank(): number | Promise<number> {
  // VBlank occurs every ~16.67ms at 60fps
  return new Promise(resolve => {
    setTimeout(() => {
      this.vcount++;
      resolve(0);
    }, 16);
  });
}
```

#### Function with Output Pointer
```typescript
@nativeFunction(0xEEDA2E54, 150)
sceDisplayGetFrameBuf(): number {
  const topAddrPtr = this.ctx.argPtr(0);    // SceDisplay*
  const bufferWidthPtr = this.ctx.argPtr(1);
  const pixelFormatPtr = this.ctx.argPtr(2);
  const syncPtr = this.ctx.argPtr(3);

  if (topAddrPtr) this.ctx.write32(topAddrPtr, this.frameBuffer);
  if (bufferWidthPtr) this.ctx.write32(bufferWidthPtr, 512);
  if (pixelFormatPtr) this.ctx.write32(pixelFormatPtr, 3); // 8888
  if (syncPtr) this.ctx.write32(syncPtr, 0);

  return 0;
}
```

#### Function Reading Structure from Memory
```typescript
// Structure: SceCtrlData (16 bytes)
// 0x00: timeStamp (u32)
// 0x04: buttons (u32)
// 0x08: Lx (u8)
// 0x09: Ly (u8)
// 0x0A-0x0F: reserved

@nativeFunction(0x3A622550, 150)
sceCtrlPeekBufferPositive(): number {
  const padDataPtr = this.ctx.argPtr(0);
  const count = this.ctx.arg(1);

  for (let i = 0; i < count; i++) {
    const offset = padDataPtr + i * 16;
    this.ctx.write32(offset + 0, this.timeStamp);
    this.ctx.write32(offset + 4, this.buttons);
    this.ctx.write8(offset + 8, this.analogX);
    this.ctx.write8(offset + 9, this.analogY);
  }

  return count;
}
```

### 4. Export from Index

```typescript
// src/hle/module/index.ts
export * from './SysMemUserForUser';
export * from './ThreadManForUser';
export * from './IoFileMgrForUser';
export * from './sceDisplay';  // Add new module
```

### 5. Register the Module

```typescript
// When setting up emulator
ctx.moduleManager.registerModule(sceDisplay);
```

### 6. Write Tests

```typescript
// tests/sceDisplay.test.ts
import { describe, it, expect } from 'bun:test';
import { Memory } from '../src/core/memory/Memory';
import { EmulatorContext, sceDisplay } from '../src/hle';

describe('sceDisplay', () => {
  function createContext(): EmulatorContext {
    const memory = new Memory();
    const ctx = new EmulatorContext(memory);
    ctx.moduleManager.registerModule(sceDisplay);
    return ctx;
  }

  it('should set display mode', () => {
    const ctx = createContext();
    // Simulate args
    // Note: Need to set up CPU state for real tests
    const func = ctx.moduleManager.getFunction(0x0E20F177);
    expect(func).toBeDefined();
  });

  it('should wait for vblank', async () => {
    const ctx = createContext();
    const func = ctx.moduleManager.getFunction(0x36CDFADE);
    // This is async
    const result = await func!.handler(ctx);
    expect(result).toBe(0);
  });
});
```

## Common Patterns

### Callback-Accepting Functions

Functions ending in `CB` accept callbacks while waiting:

```typescript
@nativeFunction(0x8EB9EC49, 150)
sceDisplayWaitVblankCB(): number | Promise<number> {
  const thread = this.ctx.threadManager.getCurrentThread();
  if (thread) {
    thread.callbackAccepting = true;
  }

  return new Promise(resolve => {
    setTimeout(() => {
      this.vcount++;
      // Check for pending callbacks here
      if (thread) {
        thread.callbackAccepting = false;
      }
      resolve(0);
    }, 16);
  });
}
```

### Thread Waiting Pattern

For operations that block the thread:

```typescript
@nativeFunction(0x4E3A1105, 150)
sceKernelWaitSema(): number | Promise<number> {
  const semaid = this.ctx.arg(0);
  const signal = this.ctx.arg(1);
  const timeoutPtr = this.ctx.argPtr(2);

  const sema = this.semaphores.get(semaid);
  if (!sema) {
    return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE;
  }

  // Can acquire immediately?
  if (sema.count >= signal) {
    sema.count -= signal;
    return 0;
  }

  // Must wait
  const thread = this.ctx.threadManager.getCurrentThread();
  if (!thread) {
    return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
  }

  // Start waiting
  return thread.startWait(WaitType.SEMA, semaid).then(() => {
    sema.count -= signal;
    return 0;
  }).toPromise();
}
```

### 64-bit Arguments

MIPS passes 64-bit arguments in register pairs:

```typescript
@nativeFunction(0x27EB27B8, 150)
sceIoLseek(): number | Promise<number> {
  const fd = this.ctx.arg(0);
  // Skip $a1 for alignment
  const offsetLow = this.ctx.arg(2);   // $a2
  const offsetHigh = this.ctx.arg(3);  // $a3
  const whence = this.ctx.gpr(8);      // $t0 (stack or next reg)

  const offset = Int64.fromParts(offsetLow, offsetHigh);
  // ...
}
```

### 64-bit Return

Set both $v0 and $v1:

```typescript
@nativeFunction(0x27EB27B8, 150)
sceIoLseek(): number | Promise<number> {
  // ...
  return fileManager.seek(fd, offset, mode).then(result => {
    this.ctx.setReturnValue64(result.low, result.high);
    return result.low;  // Also return low part
  }).toPromise();
}
```

## Debugging Tips

### Log Function Calls
```typescript
@nativeFunction(0x0E20F177, 150)
sceDisplaySetMode(): number {
  const mode = this.ctx.arg(0);
  const width = this.ctx.arg(1);
  const height = this.ctx.arg(2);

  this.ctx.log(`sceDisplaySetMode(${mode}, ${width}, ${height})`);
  // ...
}
```

### Validate Arguments
```typescript
if (priority < 1 || priority > 127) {
  this.ctx.warn(`Invalid priority: ${priority}`);
  return SceKernelErrors.ERROR_KERNEL_ILLEGAL_THREAD_PRIORITY;
}
```

### Check for Null Pointers
```typescript
const ptr = this.ctx.argPtr(0);
if (ptr === 0) {
  return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ADDR;
}
```

## Module Checklist

- [ ] Create module file with @hleModule decorator
- [ ] Implement init() and reset() methods
- [ ] Add @nativeFunction for each syscall
- [ ] Export from module/index.ts
- [ ] Handle both sync and async operations
- [ ] Validate all arguments
- [ ] Return appropriate error codes
- [ ] Log important operations
- [ ] Write unit tests
- [ ] Document NID mappings
