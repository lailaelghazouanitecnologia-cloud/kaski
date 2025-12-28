# Kaski - PSP Emulator Rewrite

## Project Overview

**Kaski** is a clean-room reimplementation of a PSP (PlayStation Portable) emulator, based on the architecture and learnings from the legacy codebase. The goal is to create a modern, modular, well-documented emulator using TypeScript and WebGPU.

### Why Rewrite?

1. **Modularity**: The legacy codebase is monolithic and tightly coupled. Kaski separates concerns into distinct modules.
2. **Modern APIs**: Replace WebGL with WebGPU for better performance and modern graphics API.
3. **Maintainability**: Clear interfaces, proper documentation, and testable code.
4. **Performance**: JIT compilation framework ready for future optimization.
5. **TypeScript Best Practices**: Proper types, no `any`, strict mode.

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                        Application                           │
│                  (Future: Web UI, CLI)                       │
├─────────────────────────────────────────────────────────────┤
│                           psp/                               │
│        Emulator orchestration (like legacy emu/)             │
│   - PSP system integration                                   │
│   - Format loading (ELF, PBP, ISO, CSO)                     │
│   - VFS mounting                                             │
│   - Display/Audio/Controller integration                     │
├─────────────────────────────────────────────────────────────┤
│                           hle/                               │
│              High Level Emulation                            │
│   - 49 PSP modules (~650+ functions)                        │
│   - Syscall bridge                                           │
│   - Thread/Callback/Interrupt managers                       │
│   - Virtual File System                                      │
├─────────────────────────────────────────────────────────────┤
│                          core/                               │
│              Hardware Emulation                              │
│   - CPU: MIPS R4000 (Allegrex)                              │
│   - GPU: GE (Graphics Engine) with WebGPU                   │
│   - Memory: 32MB RAM + 2MB VRAM + 16KB Scratchpad           │
├─────────────────────────────────────────────────────────────┤
│                         format/                              │
│              File Format Parsers                             │
│   - ELF/PRX loader                                          │
│   - PBP container                                           │
│   - ISO/CSO filesystem                                      │
│   - Pixel formats                                            │
└─────────────────────────────────────────────────────────────┘
```

### PSP Hardware Specs (Emulated)

| Component | Specification |
|-----------|---------------|
| CPU | MIPS R4000 (Allegrex) @ 333 MHz |
| VFPU | 128 vector registers (8 x 4x4 matrices) |
| RAM | 32 MB main memory |
| VRAM | 2 MB video memory |
| Scratchpad | 16 KB fast cache |
| GPU | Graphics Engine (GE) with display lists |
| Display | 480x272 pixels |

### Current Status

- **core/cpu**: Complete interpreter with 150+ instructions, JIT framework ready
- **core/memory**: Complete 32MB memory model with all access patterns
- **core/gpu**: WebGPU-based GE with display lists, vertex batching, texture cache
- **hle/**: 49 modules implemented (~650+ syscall stubs)
- **format/**: ELF/PRX loader, PBP parser, basic pixel formats

### Next Steps

1. Create `psp/` orchestration layer
2. Implement remaining core components (audio, controller)
3. Add file format parsers (ISO, CSO)
4. Build web UI for testing

---

*Document: 00-project-overview.md*
*Created: Session 1*
