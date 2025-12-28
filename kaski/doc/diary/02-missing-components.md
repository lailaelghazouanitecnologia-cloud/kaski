# Missing Components Analysis

## Overview

This document analyzes what remains to be implemented by comparing the legacy codebase with the current kaski implementation.

---

## Core Layer Status

### Completed

| Component | Status | Notes |
|-----------|--------|-------|
| CPU Interpreter | **Complete** | 150+ MIPS instructions |
| CPU State | **Complete** | GPR, FPR, VFPU, COP0 |
| CPU JIT Framework | **Partial** | Structure ready, compilation pending |
| Memory | **Complete** | 32MB RAM, 2MB VRAM, 16KB Scratchpad |
| GPU State | **Complete** | 512 registers, all components |
| GPU Display Lists | **Complete** | 256 opcodes, flow control |
| GPU WebGPU Driver | **Complete** | Render pipeline, batching |
| Texture Cache | **Complete** | CLUT support, hash-based caching |
| Pixel Formats | **Complete** | All PSP formats |

### Missing from Core

| Component | Priority | Legacy Location | Notes |
|-----------|----------|-----------------|-------|
| Audio Output | High | core/audio/ | PCM output, ATRAC3 decoding |
| Controller Input | High | core/controller/ | Button state, analog sticks |
| DMA Controller | Medium | core/dma/ | Memory transfers |
| Display Controller | Medium | core/display/ | VSync, framebuffer |

---

## PSP Layer (New - psp/)

This layer orchestrates all components into a working emulator. Based on legacy `emu/`:

### Required Components

```
psp/
├── Psp.ts              # Main emulator class
├── PspContext.ts       # Central context/state
├── PspDisplay.ts       # Display timing, VSync
├── PspController.ts    # Input handling
├── PspAudio.ts         # Audio output
└── index.ts            # Exports
```

### Psp.ts (Main Emulator)

Maps to legacy `emulator.ts`:

```typescript
class Psp {
  cpu: Cpu;
  gpu: Gpu;
  memory: Memory;
  context: EmulatorContext;

  // Lifecycle
  async initialize(): Promise<void>;
  async loadFile(file: ArrayBuffer): Promise<void>;
  async loadUrl(url: string): Promise<void>;

  // Execution
  start(): void;
  stop(): void;
  pause(): void;
  step(): void;

  // Frame loop
  runFrame(): Promise<void>;
}
```

### PspContext.ts

Maps to legacy `context.ts`:

```typescript
class PspContext {
  // Hardware
  cpu: Cpu;
  gpu: Gpu;
  memory: Memory;
  display: PspDisplay;
  controller: PspController;
  audio: PspAudio;

  // HLE Managers
  threadManager: ThreadManager;
  moduleManager: ModuleManager;
  callbackManager: CallbackManager;
  fileManager: FileManager;

  // State
  gameTitle: string;
  gameId: string;
}
```

---

## HLE Layer Status

### Completed (49 Modules)

All modules in `hle/modules/` are implemented with function stubs:

- **sceAtrac3plus** - Audio decoding
- **sceAudio** - Audio output
- **sceCtrl** - Controller input
- **sceDisplay** - Display control
- **sceGe_user** - Graphics Engine user API
- **sceIo** - File I/O
- **sceKernelThreadMgr** - Thread management
- **sceKernelModule** - Module loading
- ... and 41 more

### Missing HLE Functionality

| Module | Missing | Priority |
|--------|---------|----------|
| sceGe_user | Full implementation (stub only) | High |
| sceDisplay | VSync callback implementation | High |
| sceAudio | PCM buffer submission | High |
| sceCtrl | Actual input polling | High |
| sceIo | Async I/O completion | Medium |
| sceMpeg | Video decoding | Low |

---

## Format Layer Status

### Completed

| Format | Status | Location |
|--------|--------|----------|
| ELF | **Complete** | format/elf/ElfReader.ts |
| PRX | **Complete** | format/elf/PrxReader.ts |
| PBP | **Complete** | format/pbp/PbpReader.ts |
| Pixel Formats | **Complete** | core/format/PixelFormat.ts |

### Missing

| Format | Priority | Notes |
|--------|----------|-------|
| ISO 9660 | High | CD filesystem |
| CSO | High | Compressed ISO |
| VAG | Medium | Audio samples |
| AT3 | Medium | ATRAC3 audio |
| PMF | Low | Video files |

---

## Integration Requirements

### Display Integration

```typescript
class PspDisplay {
  frameBuffer: number;      // VRAM address
  pixelFormat: PixelFormat;
  width: number;
  height: number;

  setFrameBuf(addr, format, sync): void;
  waitVblankStart(): Promise<void>;
  getVcount(): number;
}
```

### Controller Integration

```typescript
class PspController {
  buttons: number;          // Button bitmask
  lx: number;               // Left analog X
  ly: number;               // Left analog Y

  sampleButtons(): void;
  peekBuffer(): CtrlData;
  readBuffer(): CtrlData;
}
```

### Audio Integration

```typescript
class PspAudio {
  channels: AudioChannel[];

  reserveChannel(samples, format): number;
  releaseChannel(channel): void;
  outputBlocking(channel, data): Promise<void>;
}
```

---

## Execution Flow

### Current State (Tests)

```
1. Load ELF/PRX into memory
2. Apply relocations
3. Create main thread
4. Run instructions (interpreter)
5. Handle syscalls via HLE
```

### Target State (Full Emulator)

```
1. Initialize Psp instance
2. Mount filesystems (ISO, Memory Stick)
3. Load EBOOT.PBP or ISO
4. Parse ELF, load modules
5. Start frame loop:
   a. Run CPU for ~16ms worth of cycles
   b. Process display list commands
   c. Render frame via WebGPU
   d. Wait for VSync
   e. Sample controller input
   f. Mix audio output
6. Repeat until exit
```

---

## Priority Implementation Order

### Phase 1: Core Completion
1. ~~GPU WebGPU driver~~ (done)
2. Display controller (framebuffer, VSync)
3. Controller input abstraction

### Phase 2: PSP Orchestration
1. Psp.ts main class
2. PspContext integration
3. Frame loop implementation

### Phase 3: Format Support
1. ISO 9660 parser
2. CSO decompression
3. VFS integration

### Phase 4: HLE Completion
1. sceGe_user GPU calls
2. sceDisplay VSync
3. sceAudio output
4. sceCtrl polling

---

*Document: 02-missing-components.md*
*Created: Session 1*
