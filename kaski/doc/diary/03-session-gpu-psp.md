# Session: GPU Implementation & PSP Orchestration

## Date: Session 1 (continued)

## Summary

This session completed the GPU subsystem rewrite from WebGL to WebGPU and created the `psp/` orchestration layer.

---

## Changes Made

### 1. GPU WebGPU Implementation

Rewrote the entire GPU system using WebGPU instead of WebGL:

**Files Created:**
- `src/core/gpu/GpuOpCodes.ts` - 256 GE opcodes
- `src/core/gpu/GpuState.ts` - 512 GPU registers with typed accessors
- `src/core/gpu/VertexInfo.ts` - Vertex format parsing
- `src/core/gpu/VertexBuffer.ts` - Vertex/index batching
- `src/core/gpu/Gpu.ts` - Display list processor
- `src/core/gpu/WebGpuDriver.ts` - WebGPU rendering backend
- `src/core/gpu/TextureCache.ts` - Texture caching with CLUT
- `src/core/gpu/shaders/psp.wgsl` - WGSL vertex/fragment shaders
- `src/core/gpu/index.ts` - Module exports

**Files Modified:**
- `src/core/memory/Memory.ts` - Added `getPointerU8Array`, `getPointerU16Array`, `getPointerU32Array`

### 2. Pixel Format Support

Created format conversion utilities:

**Files Created:**
- `src/core/format/PixelFormat.ts` - PSP pixel formats and converter
- `src/core/format/index.ts` - Module exports

### 3. PSP Orchestration Layer

Created the main emulator orchestration layer:

**Files Created:**
- `src/psp/PspContext.ts` - Central context container
- `src/psp/Psp.ts` - Main emulator class
- `src/psp/index.ts` - Module exports

### 4. Documentation

Created implementation diary:

**Files Created:**
- `doc/diary/00-project-overview.md` - Project architecture
- `doc/diary/01-core-implementation.md` - Core layer documentation
- `doc/diary/02-missing-components.md` - Gap analysis

---

## Technical Decisions

### Why WebGPU over WebGL?

1. **Modern API**: WebGPU is the next-generation graphics API for the web
2. **Better Performance**: More efficient batching and less CPU overhead
3. **Compute Shaders**: Future support for GPU compute (JIT, audio)
4. **Cleaner Code**: Less state management, explicit pipelines

### GpuState Field Initializers

**Problem**: TypeScript class field initializers run before constructor parameters are assigned.

```typescript
// BROKEN
class SkinningState {
  constructor(private data: Uint32Array) {}
  dataf = new Float32Array(this.data.buffer); // Error!
}
```

**Solution**: Move initialization into constructor body:

```typescript
// FIXED
class SkinningState {
  dataf: Float32Array;
  constructor(private data: Uint32Array) {
    this.dataf = new Float32Array(this.data.buffer);
  }
}
```

### Psp Class Structure

Based on legacy `Emulator` class but with cleaner separation:

- Default implementations for peripherals (can be overridden)
- Frame loop using `requestAnimationFrame`
- Stats tracking for debugging
- Modular VFS mounting

---

## Tests

- 26 GPU-specific tests added
- All 521 tests passing

---

## Next Steps

1. **Audio**: Implement `PspAudio` with Web Audio API
2. **Controller**: Implement browser input (gamepad, keyboard)
3. **Display**: Implement WebGPU framebuffer display
4. **ISO/CSO**: Add filesystem format support
5. **Integration**: Wire up `sceGe_user` to actual GPU

---

## Files Changed This Session

```
kaski/
├── src/
│   ├── core/
│   │   ├── gpu/           # NEW - 10 files
│   │   ├── format/        # NEW - 2 files
│   │   └── memory/Memory.ts  # MODIFIED
│   ├── psp/               # NEW - 3 files
│   └── index.ts           # MODIFIED
├── tests/
│   └── gpu.test.ts        # NEW
└── doc/
    └── diary/             # NEW - 4 files
```

**Total Lines Added**: ~5000+

---

*Document: 03-session-gpu-psp.md*
*Session: 1*
