# Core Implementation

## Overview

The `core/` directory contains the hardware emulation layer - the fundamental components that simulate PSP silicon: CPU, Memory, and GPU.

```
core/
├── cpu/                    # MIPS R4000 CPU
│   ├── Cpu.ts             # Main CPU class
│   ├── CpuState.ts        # Register state (GPR, FPR, VFPU)
│   ├── instruction/       # Instruction decoding
│   ├── interpreter/       # Instruction execution
│   └── jit/               # JIT compilation framework
├── memory/                 # Memory subsystem
│   ├── Memory.ts          # RAM, VRAM, Scratchpad
│   └── constants.ts       # Memory layout
├── gpu/                    # Graphics Engine
│   ├── Gpu.ts             # Display list processor
│   ├── GpuState.ts        # 512 GPU registers
│   ├── GpuOpCodes.ts      # 256 GE commands
│   ├── VertexInfo.ts      # Vertex format parsing
│   ├── VertexBuffer.ts    # Vertex batching
│   ├── WebGpuDriver.ts    # WebGPU rendering
│   ├── TextureCache.ts    # Texture management
│   └── shaders/psp.wgsl   # WGSL shaders
├── format/                 # Pixel formats
│   └── PixelFormat.ts     # Format conversion
└── utils/                  # Utilities
    ├── bits.ts            # Bit manipulation
    ├── registers.ts       # Register names
    └── format.ts          # Number formatting
```

---

## CPU Subsystem

### Why We Need It

The PSP uses a MIPS R4000-based CPU called "Allegrex" running at 333 MHz. It includes:
- Standard MIPS III instruction set
- Custom VFPU (Vector Floating Point Unit) for 3D math
- COP0 for system control

### CpuState (cpu/CpuState.ts)

The CPU state contains all registers:

```typescript
class CpuState {
  gpr: Int32Array;     // 32 General Purpose Registers (R0-R31)
  fpr: Float32Array;   // 32 Floating Point Registers
  vfpr: Float32Array;  // 128 VFPU Registers (8 x 4x4 matrices)

  pc: number;          // Program Counter
  npc: number;         // Next PC (for branch delay slots)
  hi: number;          // Multiply/divide high result
  lo: number;          // Multiply/divide low result

  cop0: Uint32Array;   // 32 System Control registers
  vfpuCtrl: Int32Array; // 16 VFPU control registers
}
```

**Design Decision**: We use typed arrays for performance. `Int32Array` for GPR ensures proper 32-bit signed overflow behavior. VFPU uses a flat array with matrix addressing.

### Cpu (cpu/Cpu.ts)

Main CPU class with two execution modes:

1. **Interpreter**: Execute one instruction at a time (accurate, slow)
2. **JIT**: Compile basic blocks to JavaScript (fast, complex)

```typescript
class Cpu {
  state: CpuState;
  memory: Memory;
  interpreter: Interpreter;
  jitCache: JitCache | null;

  step(): CpuStatus;              // Execute one instruction
  run(maxInstructions): CpuStatus; // Run until limit or event
  runJit(maxBlocks): CpuStatus;   // JIT execution mode
}
```

**Key Events**:
- `onSyscall`: HLE intercepts syscall instructions
- `onBreakpoint`: Debugger integration
- `onError`: Invalid instruction handling

### Interpreter (cpu/interpreter/)

Executes MIPS instructions using a handler table:

```typescript
const handlers: Map<number, InstructionHandler> = new Map([
  [Op.ADD,  (state, instr) => { state.rd = state.rs + state.rt; }],
  [Op.SUB,  (state, instr) => { state.rd = state.rs - state.rt; }],
  [Op.LW,   (state, mem, instr) => { state.rt = mem.lw(state.rs + instr.imm16); }],
  // ... 150+ handlers
]);
```

**Handler Categories**:
- Arithmetic: add, sub, addi, addiu, lui, mult, div
- Logical: and, or, xor, nor, andi, ori, xori
- Shifts: sll, srl, sra, sllv, srlv, srav
- Load/Store: lb, lbu, lh, lhu, lw, sb, sh, sw
- Branches: beq, bne, bgtz, blez, bltz, bgez
- Jumps: j, jal, jr, jalr
- System: syscall, break
- FPU: add.s, sub.s, mul.s, div.s, sqrt.s, c.eq.s
- VFPU: vadd, vsub, vmul, vdot, vmmul, vtfm

### VFPU Helpers (cpu/interpreter/VfpuHelpers.ts)

The VFPU is PSP-specific, providing fast vector/matrix math for 3D:

```typescript
// Vector operations
vAdd(state, vd, vs, vt);   // Vector add
vMul(state, vd, vs, vt);   // Vector multiply
vDot(state, sd, vs, vt);   // Dot product

// Matrix operations
vmmul(state, md, ms, mt);  // Matrix multiply

// Trigonometry
vSin(state, vd, vs);       // Sine
vCos(state, vd, vs);       // Cosine

// Transcendental
vExp2(state, vd, vs);      // 2^x
vLog2(state, vd, vs);      // log2(x)
```

### JIT Framework (cpu/jit/)

Prepared for future optimization:

```typescript
class JitCache {
  blocks: Map<number, CompiledBlock>;

  execute(state, pc): CpuStatus;
  invalidateRange(from, to): void;
}
```

The JIT compiles basic blocks (sequences without branches) into callable JavaScript functions. Currently stubbed but architecture is ready.

---

## Memory Subsystem

### Why We Need It

The PSP has three memory regions:

| Region | Base | Size | Purpose |
|--------|------|------|---------|
| Main RAM | 0x08000000 | 32 MB | Program code and data |
| VRAM | 0x04000000 | 2 MB | Framebuffer and textures |
| Scratchpad | 0x00010000 | 16 KB | Fast CPU cache |

### Memory (memory/Memory.ts)

```typescript
class Memory {
  // Backing buffers
  mainBuffer: ArrayBuffer;    // 32 MB
  vramBuffer: ArrayBuffer;    // 2 MB
  scratchpadBuffer: ArrayBuffer; // 16 KB

  // Typed views for efficient access
  mainU8: Uint8Array;
  mainU16: Uint16Array;
  mainU32: Uint32Array;
  mainI32: Int32Array;
  mainF32: Float32Array;
  // ... similar for VRAM and scratchpad
}
```

**Design Decision**: Multiple typed array views over the same buffer allow efficient access for different data types without conversion overhead.

### Load Operations

```typescript
lb(addr): number;   // Load byte (signed)
lbu(addr): number;  // Load byte (unsigned)
lh(addr): number;   // Load halfword (signed)
lhu(addr): number;  // Load halfword (unsigned)
lw(addr): number;   // Load word
lwFloat(addr): number; // Load float

// Unaligned access (legacy MIPS)
lwl(addr, rt): number; // Load word left
lwr(addr, rt): number; // Load word right
```

### Store Operations

```typescript
sb(addr, val): void;  // Store byte
sh(addr, val): void;  // Store halfword
sw(addr, val): void;  // Store word
swFloat(addr, val): void; // Store float

// Unaligned access
swl(addr, val): void; // Store word left
swr(addr, val): void; // Store word right
```

### GPU Pointer Access

Added for GPU vertex/texture access:

```typescript
getPointerU8Array(addr, size?): Uint8Array;
getPointerU16Array(addr, size?): Uint16Array;
getPointerU32Array(addr, size?): Uint32Array;
```

These return direct views into memory, avoiding copies for GPU operations.

---

## GPU Subsystem

### Why We Need It

The PSP has a Graphics Engine (GE) that processes display lists - sequences of GPU commands stored in memory. Games submit display lists; the GE renders frames.

### GpuOpCodes (gpu/GpuOpCodes.ts)

256 GE commands organized by function:

```typescript
enum Op {
  // Flow control
  NOP = 0x00,
  PRIM = 0x04,      // Draw primitives
  END = 0x0C,       // End list
  JUMP = 0x08,      // Jump to address
  CALL = 0x0A,      // Call subroutine
  RET = 0x0B,       // Return

  // Vertex setup
  VERTEXTYPE = 0x12,
  VADDR = 0x01,     // Vertex address
  IADDR = 0x02,     // Index address

  // Matrices
  MAT_PROJ = 288,   // Projection matrix (16 floats)
  MAT_VIEW = 304,   // View matrix (12 floats)
  MAT_WORLD = 320,  // World matrix (12 floats)
  MAT_BONES = 336,  // Bone matrices (8 x 12 floats)
  MAT_TEXTURE = 336 + 96, // Texture matrix

  // Texturing
  TEXADDR0 = 0xA0,  // Texture address
  TPSM = 0xC3,      // Texture pixel format
  TFUNC = 0xC8,     // Texture function
  // ... many more
}
```

### GpuState (gpu/GpuState.ts)

512 registers holding all GPU state:

```typescript
class GpuState {
  data: Uint32Array;      // 512 registers
  dataf: Float32Array;    // Float view

  // Component state objects
  vertex: VertexState;     // Vertex format
  texture: TextureState;   // Texture settings
  blending: Blending;      // Alpha blending
  culling: CullingState;   // Face culling
  depthTest: DepthTestState;
  stencil: StencilState;
  skinning: SkinningState; // Bone matrices
  // ... many more
}
```

**Design Decision**: Component classes provide typed access to register bit fields. For example:

```typescript
class VertexState {
  get transform2D(): boolean { return bool1(data[Op.VERTEXTYPE], 23); }
  get position(): NumericEnum { return param2(data[Op.VERTEXTYPE], 7); }
  get color(): ColorEnum { return param3(data[Op.VERTEXTYPE], 2); }
}
```

### Gpu (gpu/Gpu.ts)

Main GPU class managing display lists:

```typescript
class Gpu {
  state: GpuState;
  memory: Memory;
  runner: GpuDisplayListRunner; // Manages 32 lists
  driver: WebGpuDriver | null;

  listEnqueue(start, stall, callbackId): number;
  listSync(id): void;
  updateStallAddr(id, stall): void;
  drawSync(): Promise<void>;
}
```

### Display List Processing

Each display list is a sequence of 32-bit commands:

```
[opcode:8][params:24]
```

The `GpuDisplayList` processes commands:

```typescript
class GpuDisplayList {
  execute(maxCommands): DisplayListStatus {
    while (pc < stall && commands < max) {
      const cmd = memory.lw(pc);
      const op = cmd >>> 24;
      const params = cmd & 0xFFFFFF;

      switch (op) {
        case Op.PRIM:
          this.processPrim(params);
          break;
        case Op.JUMP:
          pc = baseAddress | params;
          break;
        case Op.END:
          return DisplayListStatus.COMPLETED;
        // ... handle all 256 opcodes
      }
      pc += 4;
    }
  }
}
```

### WebGpuDriver (gpu/WebGpuDriver.ts)

Renders batched primitives using WebGPU:

```typescript
class WebGpuDriver {
  device: GPUDevice;
  pipeline: GPURenderPipeline;

  async drawBatches(batches: OptimizedBatch[]): Promise<void> {
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(/* ... */);

    for (const batch of batches) {
      pass.setVertexBuffer(0, batch.vertexBuffer);
      pass.setIndexBuffer(batch.indexBuffer, 'uint16');
      pass.drawIndexed(batch.indexCount);
    }

    pass.end();
    device.queue.submit([encoder.finish()]);
  }
}
```

### Vertex Batching (gpu/VertexBuffer.ts)

Collects vertices for efficient GPU submission:

```typescript
class OptimizedDrawBuffer {
  data: Uint8Array;        // Vertex data
  indices: Uint16Array;    // Index data

  addVerticesData(vertices, count): void;
  addVerticesIndices(count): void;
  addVerticesIndicesSprite(count): void; // 2 verts -> 4 verts

  createBatch(state, primType, vertexInfo): OptimizedBatch;
}
```

**Sprite Expansion**: PSP sprites are 2 vertices (corners); we expand to 4 vertices for GPU quads.

### TextureCache (gpu/TextureCache.ts)

Caches textures in GPU memory:

```typescript
class TextureCache {
  texturesByHash: Map<string, CachedTexture>;
  texturesByAddress: Map<number, CachedTexture>;

  getTexture(state, textureData, clutData): CachedTexture;
  invalidateRange(low, high): void;
}
```

**CLUT Support**: Paletted textures (4/8/16/32-bit indices) use Color Lookup Tables.

### WGSL Shaders (gpu/shaders/psp.wgsl)

Vertex and fragment shaders:

```wgsl
@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uniforms.modelViewProjMatrix * input.position;
  output.texcoord = uniforms.texMatrix * input.texcoord;
  output.color = input.color;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  var fragColor = input.color;

  if (uniforms.enableTextures != 0u) {
    let texColor = textureSample(tex, texSampler, input.texcoord.xy);

    // Apply texture effect (modulate, decal, blend, replace, add)
    switch (uniforms.tfx) {
      case TFX_MODULATE: { fragColor = texColor * fragColor; }
      case TFX_REPLACE: { fragColor = texColor; }
      // ...
    }
  }

  return fragColor;
}
```

---

## Format Subsystem

### PixelFormat (format/PixelFormat.ts)

PSP texture formats:

```typescript
enum PixelFormat {
  RGBA_5650 = 0,   // 16-bit RGB (5-6-5)
  RGBA_5551 = 1,   // 16-bit RGBA (5-5-5-1)
  RGBA_4444 = 2,   // 16-bit RGBA (4-4-4-4)
  RGBA_8888 = 3,   // 32-bit RGBA
  PALETTE_T4 = 4,  // 4-bit palette
  PALETTE_T8 = 5,  // 8-bit palette
  PALETTE_T16 = 6, // 16-bit palette
  PALETTE_T32 = 7, // 32-bit palette
}
```

Conversion utilities:

```typescript
class PixelConverter {
  static decode(format, src, dst, hasAlpha?, clut?): Uint32Array;
  static unswizzleInline(format, data, width, height): void;
  static getSizeInBytes(format, pixelCount): number;
}
```

---

## Testing

All core components have unit tests in `tests/`:

```
tests/
├── cpu.test.ts        # CPU instruction tests
├── memory.test.ts     # Memory access tests
├── gpu.test.ts        # GPU state/batching tests
├── interpreter.test.ts # Instruction execution tests
└── integration.test.ts # ELF loading tests
```

Run tests: `npm test`

---

*Document: 01-core-implementation.md*
*Created: Session 1*
