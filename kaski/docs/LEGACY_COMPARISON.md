# Legacy vs Kaski Comparison Tracking

This document tracks the comparison between the legacy PSP emulator implementation and the new Kaski rewrite.

## Overview

| Component | Legacy Status | Kaski Status | Parity | Notes |
|-----------|--------------|--------------|--------|-------|
| CPU Core | Complete | Complete | 90% | JIT pipeline improved |
| CPU Interpreter | Complete | Complete | 95% | VFPU helpers added |
| CPU JIT | Basic | Advanced | 150% | Relooper, cache added |
| GPU Core | WebGL | WebGPU | New | Different backend |
| Memory | Abstract | Concrete | 100% | Better typed |
| KIRK Crypto | 3 files | 4 files | 100% | Keys extracted, index added |
| HLE Managers | 8 | 10+ | 125% | New managers added |
| HLE Modules | 50+ | 50+ | 95% | Some stubs |
| VFS | 8 files | 6 files | 95% | ISO VFS added |
| Format Parsers | 11 files | 9 files | 90% | CSO, ZLIB added |

## Detailed Component Status

### CPU Implementation

#### Interpreter (`src/core/cpu/interpreter/`)

| Feature | Legacy | Kaski | Status |
|---------|--------|-------|--------|
| ALU Instructions | Yes | Yes | OK |
| Branch Instructions | Yes | Yes | OK |
| Load/Store | Yes | Yes | OK |
| FPU Instructions | Yes | Yes | OK |
| VFPU Instructions | Inline | VfpuHelpers | Improved |
| COP0 Instructions | Yes | Yes | OK |
| Syscall Handling | Yes | Yes | OK |
| Break Handling | Yes | Yes | OK |

#### JIT Compiler (`src/core/cpu/jit/`)

| Feature | Legacy | Kaski | Status |
|---------|--------|-------|--------|
| Basic Codegen | Yes | Yes | OK |
| Function Compiler | Basic | FunctionCompiler | Improved |
| Code Cache | None | JitCache | New |
| Control Flow | None | Relooper | New |
| AST Generation | cpu_ast.ts | ast/ | Improved |

### GPU Implementation

| Feature | Legacy | Kaski | Status |
|---------|--------|-------|--------|
| Backend | WebGL | WebGPU | New |
| Shader Language | GLSL | WGSL | New |
| Vertex Buffer | gpu_vertex.ts | VertexBuffer.ts | Renamed |
| Texture Cache | Implicit | TextureCache.ts | Improved |
| GPU State | gpu_state.ts | GpuState.ts | Renamed |
| Display Lists | Yes | Yes | OK |
| Primitives | Yes | Yes | OK |

### KIRK Crypto Engine

| Feature | Legacy | Kaski | Status |
|---------|--------|-------|--------|
| CMD1 (Decrypt Private) | Yes | Yes | OK |
| CMD7 (Decrypt IV=0) | Yes | Yes | OK |
| CMD4 (Encrypt IV=0) | Yes | Stub | TODO |
| SHA1 Hash | Yes | Stub | TODO |
| PRNG | Yes | Stub | TODO |
| ECDSA Sign/Verify | Yes | Stub | TODO |
| Key Management | Inline | keys.ts | Improved |

### HLE Managers

| Manager | Legacy | Kaski | Status |
|---------|--------|-------|--------|
| ThreadManager | thread.ts | ThreadManager.ts | OK |
| MemoryManager | memory.ts | MemoryManager.ts | OK |
| CallbackManager | callback.ts | CallbackManager.ts | OK |
| ModuleManager | module.ts | ModuleManager.ts | OK |
| FileManager | file.ts | FileManager.ts | OK |
| DisplayManager | None | DisplayManager.ts | New |
| InputManager | None | InputManager.ts | New |
| GpuManager | None | GpuManager.ts | New |
| AudioManager | None | AudioManager.ts | New |
| SyncManager | None | SyncManager.ts | New |
| SyscallManager | None | SyscallManager.ts | New |

### HLE Modules

#### Core Modules (Complete)

- [x] SysMemUserForUser
- [x] ThreadManForUser
- [x] IoFileMgrForUser
- [x] sceDisplay
- [x] sceCtrl
- [x] sceGe_user
- [x] sceAudio
- [x] UtilsForUser
- [x] LoadExecForUser
- [x] Kernel_Library
- [x] sceUtility
- [x] ModuleMgrForUser
- [x] StdioForUser

#### Extended Modules

- [x] sceRtc
- [x] scePower
- [x] sceDmac
- [x] sceHprm
- [x] sceImpose
- [x] sceSuspendForUser
- [x] sceReg
- [x] sceMpeg
- [x] sceSasCore
- [x] sceOpenPSID
- [x] sceVaudio
- [x] sceWlanDrv
- [x] InterruptManager
- [x] UtilsForKernel
- [x] sceLibFont
- [x] sceMp3
- [x] sceAtrac3plus
- [x] sceUmdUser

#### Network Modules

- [x] sceNet
- [x] sceNetInet
- [x] sceNetAdhoc
- [x] sceNetAdhocctl
- [x] sceNetAdhocMatching
- [x] sceNetApctl
- [x] sceNetResolver
- [x] sceHttp
- [x] sceSsl
- [x] sceParseHttp
- [x] sceParseUri
- [x] sceNp
- [x] sceNpAuth
- [x] sceNpService
- [x] scePspNpDrm_user

#### Kernel Modules

- [x] ExceptionManagerForKernel
- [x] KDebugForKernel
- [x] LoadCoreForKernel

### VFS Implementation

| VFS Type | Legacy | Kaski | Status |
|----------|--------|-------|--------|
| Base VFS | vfs.ts | types.ts | OK |
| Mountable | vfs_mountable.ts | MountableVfs.ts | OK |
| Memory | vfs_memory.ts | MemoryVfs.ts | OK |
| ISO | vfs_iso.ts | IsoVfs.ts | OK |
| Dropbox | vfs_dropbox.ts | Removed | N/A |
| URI | vfs_uri.ts | Removed | TODO |
| ZIP | vfs_zip.ts | Removed | TODO |
| Storage | vfs_storage.ts | Removed | TODO |

### Format Parsers

| Format | Legacy | Kaski | Status |
|--------|--------|-------|--------|
| ELF | elf.ts | elf.ts | OK |
| PBP | pbp.ts | pbp.ts | OK |
| PSF | psf.ts | psf.ts | OK |
| ISO | iso.ts | iso.ts | OK |
| CSO | cso.ts | cso.ts | OK |
| ZLIB | zlib.ts | zlib.ts | OK |
| RIFF | riff.ts | Removed | N/A |
| VAG | vag.ts | Removed | N/A |
| ZIP | zip.ts | Removed | TODO |
| DWARF | elf_dwarf.ts | Removed | N/A |

## Missing Features in Kaski

### High Priority

1. ~~**CSO Support**~~ - Implemented
2. ~~**ZLIB**~~ - Implemented
3. ~~**ISO VFS**~~ - Implemented
4. **Encrypted PRX Loading** - elf_crypted_prx.ts functionality

### Medium Priority

1. **Additional KIRK Commands** - SHA1, PRNG, ECDSA
2. **VAG Audio** - PSP audio format
3. **RIFF Audio** - Standard audio format

### Low Priority

1. **Dropbox VFS** - Cloud storage (not essential)
2. **DWARF Debug** - Debug info parsing
3. **URI VFS** - Remote file access

## New Features in Kaski

1. **WebGPU Rendering** - Modern GPU API
2. **Advanced JIT** - Better code generation with Relooper
3. **EmulatorContext** - Central coordination hub
4. **Analysis Module** - Static code analysis (CFG, functions)
5. **Display/Input/Audio Managers** - Better peripheral management
6. **SyncManager** - Synchronization primitives
7. **TextureCache** - Explicit GPU texture management

## Test Coverage Comparison

| Component | Legacy Tests | Kaski Tests | Notes |
|-----------|--------------|-------------|-------|
| CPU | Unknown | 200+ | Comprehensive |
| GPU | Unknown | 50+ | Basic |
| Memory | Unknown | 50+ | Good |
| HLE Modules | Unknown | 53+ | Growing |
| KIRK | Unknown | 37 | Complete for impl |
| Format | Unknown | 20+ | Basic |

## Action Items

### Immediate

- [ ] Fix cube-integration test issues
- [ ] Add ISO VFS back
- [ ] Implement CSO support
- [ ] Complete KIRK commands

### Short Term

- [x] Add ZLIB support
- [ ] Implement encrypted PRX loading
- [ ] Add VAG audio decoder
- [ ] Complete remaining VFS implementations

### Long Term

- [ ] Performance comparison WebGL vs WebGPU
- [ ] JIT optimization benchmarks
- [ ] Full game compatibility testing

## Changelog

### 2025-12-28

- Initial comparison document created
- KIRK crypto engine implemented (CMD1, CMD7)
- 37 KIRK tests passing
- Cube integration test pipeline created
- ISO VFS implemented for mounting disc images
- 27 ISO VFS tests passing
- CSO compressed ISO support added
- ZLIB raw DEFLATE decompression added
- 16 CSO/ZLIB tests passing
- Total: 758 tests across 26 files
