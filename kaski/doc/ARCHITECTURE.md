# Kaski Architecture

## Overview

Kaski is a clean reimplementation of the jspspemu PSP emulator CPU core, designed for:
- Modularity and testability
- Clean TypeScript patterns
- Step-by-step development

## Current Implementation

### Core Components

```
kaski/src/core/
├── cpu/
│   ├── Cpu.ts              # Main CPU controller
│   ├── CpuState.ts         # Register state (GPR, FPR, VFPU)
│   ├── Instruction.ts      # Instruction decoding
│   ├── InstructionType.ts  # Type definitions
│   ├── InstructionTable.ts # 100+ instruction definitions
│   ├── Interpreter.ts      # Instruction execution
│   ├── Disassembler.ts     # Disassembly
│   └── index.ts
└── memory/
    ├── Memory.ts           # PSP memory map
    ├── constants.ts        # Memory constants
    └── index.ts
```

### Class Responsibilities

| Class | Responsibility |
|-------|---------------|
| `Cpu` | Execution control, breakpoints, events, debugging |
| `CpuState` | 32 GPR + 32 FPR + 128 VFPU + HI/LO/PC |
| `Interpreter` | ~100 instruction handlers |
| `InstructionTable` | Instruction lookup by opcode |
| `Instruction` | Field extraction (rs, rt, rd, imm, etc.) |
| `Memory` | PSP memory regions with masking |

## Legacy Comparison

### Execution Model

| Aspect | Legacy | Kaski |
|--------|--------|-------|
| Mode | JIT + Interpreter | Pure Interpreter |
| Caching | Function cache with invalidation | None |
| Code Gen | Dynamic JS function generation | Direct execution |
| Performance | Fast (cached functions) | Slower (handler dispatch) |

### Instruction Coverage

| Category | Legacy | Kaski | Notes |
|----------|--------|-------|-------|
| Arithmetic | ✅ Full | ✅ Full | add, sub, mul, div, madd, msub |
| Logical | ✅ Full | ✅ Full | and, or, xor, nor |
| Shift | ✅ Full | ✅ Full | sll, srl, sra, rot |
| Branch | ✅ Full | ✅ Full | All variants including likely |
| Jump | ✅ Full | ✅ Full | j, jal, jr, jalr |
| Load/Store | ✅ Full | ✅ Full | lb, lh, lw, sb, sh, sw |
| FPU Basic | ✅ Full | ✅ Full | add.s, mul.s, etc. |
| **VFPU** | ✅ 101 instr | ✅ ~40 ops | Vector arithmetic, scalar, trig |
| **COP0** | ✅ Full | ✅ Basic | mfc0, mtc0 |
| PSP-specific | ✅ Full | ✅ Partial | ext, ins, clz, etc. |

### Missing from Kaski

#### High Priority
1. **VFPU Instructions** (~60 remaining)
   - Matrix operations: vmmul, vmidt, vhtfm
   - Quaternion ops: vqmul
   - Conversions: vfpu↔gpr (mtv, mfv)
   - Prefix system: vpfx instructions

2. **JIT Code Generation**
   - Compile basic blocks to JS functions
   - Cache with invalidation
   - Significant performance improvement

#### Medium Priority
5. **Thread Support**
   - Context switching
   - Multiple CPU states

6. **Interrupt Handling**
   - Interrupt vectors
   - Special addresses

7. **Memory Breakpoints**
   - Write watch
   - Access tracking

#### Lower Priority
8. HLE Module System
9. GPU Integration
10. Audio/Display

## Roadmap

### Phase 1: Core CPU ✅
- [x] Memory subsystem
- [x] CPU state
- [x] Instruction decoding
- [x] Interpreter (~100 instructions)
- [x] Basic FPU
- [x] Tests (225 passing)

### Phase 2: Extended CPU ✅
- [x] VFPU instructions (~40 ops: vadd, vsub, vmul, vdiv, vmin, vmax, vabs, vneg, vsqrt, vsin, vcos, etc.)
- [x] COP0 registers (mfc0, mtc0)
- [x] Complete branch variants (likely branches: beql, bnel, bgtzl, blezl, bgezl, bltzl, etc.)
- [x] madd/msub instructions
- [x] Tests (251 passing)

### Phase 3: Performance (In Progress)
- [x] Basic JIT (CodeGenerator + JitCache)
- [ ] Advanced instruction coverage in JIT
- [ ] Branch prediction hints

### Phase 4: Integration
- [ ] Thread contexts
- [ ] Interrupt handling
- [ ] HLE syscalls

### Phase 5: Analysis
- [ ] Static disassembly
- [ ] CFG construction
- [ ] ASM output

## Design Decisions

### Why Pure Interpreter First?

1. **Correctness**: Easier to verify each instruction
2. **Debugging**: Step-by-step execution
3. **Testing**: Unit tests per instruction
4. **Foundation**: JIT builds on interpreter knowledge

### Why Clean Reimplementation?

1. **Legacy complexity**: 165K+ lines, tight coupling
2. **Modern TypeScript**: strict mode, proper typing
3. **Testability**: Unit tests from the start
4. **Documentation**: Self-documenting code

### Memory Model

```
PSP Memory Map:
0x00010000 - Scratchpad (16KB)
0x04000000 - VRAM (2MB)
0x08000000 - Main RAM (32MB)
0x1C000000 - Hardware I/O
```

All addresses are masked with `0x0FFFFFFF` for region mapping.

## Code Metrics

| Metric | Legacy | Kaski |
|--------|--------|-------|
| Total Lines | 165K+ | ~4K |
| CPU Core Lines | 1,844 | ~1,200 |
| Instruction Handlers | 623 | ~150 |
| Test Coverage | Limited | 282 tests |
| Dependencies | Many | Minimal (Bun) |

## File Reference

### Legacy Key Files
- `legacy/src/core/cpu/cpu_core.ts` - Main CPU
- `legacy/src/core/cpu/cpu_codegen.ts` - JIT
- `legacy/src/core/cpu/cpu_instructions.ts` - 623 definitions
- `legacy/src/core/cpu/cpu_ast.ts` - Code AST

### Kaski Key Files
- `kaski/src/core/cpu/Cpu.ts` - CPU controller with interpreter/JIT modes
- `kaski/src/core/cpu/Interpreter.ts` - Instruction execution
- `kaski/src/core/cpu/CodeGenerator.ts` - JIT code generation
- `kaski/src/core/cpu/JitCache.ts` - Compiled function cache
- `kaski/src/core/cpu/InstructionTable.ts` - Instruction definitions
- `kaski/tests/*.test.ts` - 282 tests
