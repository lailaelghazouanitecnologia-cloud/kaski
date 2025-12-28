# Static Analysis & Decompilation

## Overview

This document describes the planned static analysis capabilities for converting PSP binaries to readable assembly (.asm) files and potentially higher-level representations.

## Goals

1. **Binary to ASM**: Convert raw PSP executables (PRX/ELF) to annotated MIPS assembly
2. **Control Flow Analysis**: Identify functions, loops, and branches
3. **Data Flow Analysis**: Track register usage and memory access patterns
4. **HLE Annotation**: Identify and annotate PSP system calls
5. **Symbol Recovery**: Recover function names from debug info or patterns

## Architecture

```
┌─────────────────┐
│   PRX/ELF File  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Binary Loader  │  Parse headers, sections, relocations
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Linear Disasm   │  Decode all instructions
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  CFG Builder    │  Build control flow graph
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Function Finder │  Identify function boundaries
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Data Flow      │  Analyze register/memory usage
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ASM Generator  │  Output annotated assembly
└────────┴────────┘
```

## Components

### 1. Binary Loader (`src/analysis/loader/`)

Handles PSP executable formats:

```typescript
interface LoadedBinary {
  // File metadata
  format: 'prx' | 'elf' | 'raw';

  // Memory segments
  segments: Segment[];

  // Entry point
  entryPoint: number;

  // Exports (PRX)
  exports: Export[];

  // Imports (PRX)
  imports: Import[];

  // Relocations
  relocations: Relocation[];
}

interface Segment {
  name: string;
  address: number;
  size: number;
  data: Uint8Array;
  flags: SegmentFlags;  // R/W/X
}
```

### 2. Linear Disassembler (`src/analysis/disasm/`)

Uses existing `InstructionTable` and `Disassembler`:

```typescript
interface DisassembledInstruction {
  address: number;
  bytes: number;          // Raw instruction
  mnemonic: string;
  operands: string;

  // Analysis hints
  isCall: boolean;
  isBranch: boolean;
  isReturn: boolean;
  branchTarget?: number;
  callTarget?: number;

  // References
  references: Reference[];
}
```

### 3. Control Flow Graph (`src/analysis/cfg/`)

Build CFG from disassembly:

```typescript
interface BasicBlock {
  id: number;
  startAddress: number;
  endAddress: number;
  instructions: DisassembledInstruction[];

  // Edges
  successors: BasicBlock[];
  predecessors: BasicBlock[];

  // Block type
  type: 'normal' | 'entry' | 'exit' | 'call' | 'return';
}

interface ControlFlowGraph {
  entry: BasicBlock;
  blocks: Map<number, BasicBlock>;
  edges: Edge[];
}

interface Function {
  name: string;
  address: number;
  size: number;
  cfg: ControlFlowGraph;

  // Calling convention
  args: Register[];
  returns: Register[];

  // Stack frame
  stackSize: number;
  locals: LocalVariable[];
}
```

### 4. Function Finder (`src/analysis/functions/`)

Identify function boundaries using:

- **Direct references**: JAL/JALR targets
- **Prologue patterns**: `addiu $sp, $sp, -N`
- **Epilogue patterns**: `jr $ra`
- **Symbol tables**: From debug info
- **Import tables**: From PRX headers

```typescript
interface FunctionSignature {
  address: number;
  confidence: number;  // 0.0 - 1.0
  source: 'call' | 'prologue' | 'symbol' | 'import';
  name?: string;
}
```

### 5. Data Flow Analyzer (`src/analysis/dataflow/`)

Track register and memory usage:

```typescript
interface RegisterState {
  defined: boolean;
  value?: number;         // If constant
  source?: number;        // Address where defined
  type?: DataType;        // Inferred type
}

interface MemoryAccess {
  address: number;
  type: 'read' | 'write';
  size: 1 | 2 | 4;
  register: number;
  offset: number;
  base: number;
}
```

### 6. HLE Annotator (`src/analysis/hle/`)

Identify and annotate PSP system calls:

```typescript
interface SyscallInfo {
  nid: number;           // Unique ID
  module: string;        // e.g., 'sceDisplay'
  name: string;          // e.g., 'sceDisplaySetFrameBuf'
  args: ArgInfo[];
  returnType: string;
}

// Example annotation:
// 0x08800100: jal sceDisplaySetFrameBuf  ; void* topaddr, int bufferwidth, int pixelformat, int sync
```

### 7. ASM Generator (`src/analysis/output/`)

Generate readable assembly:

```asm
; =============================================================================
; Function: main
; Address: 0x08800000
; Size: 0x100 bytes
; =============================================================================
main:
    addiu   $sp, $sp, -0x20      ; Allocate 32 bytes
    sw      $ra, 0x1C($sp)       ; Save return address
    sw      $s0, 0x18($sp)       ; Save s0

    ; Initialize display
    li      $a0, 0x04000000      ; VRAM address
    li      $a1, 512             ; Buffer width
    li      $a2, 3               ; PSP_DISPLAY_PIXEL_FORMAT_8888
    li      $a3, 1               ; PSP_DISPLAY_SETBUF_NEXTFRAME
    jal     sceDisplaySetFrameBuf
    nop                          ; delay slot

.loop:
    ; Main loop body
    ...

    bnez    $v0, .loop
    nop                          ; delay slot

    ; Cleanup and return
    lw      $ra, 0x1C($sp)
    lw      $s0, 0x18($sp)
    jr      $ra
    addiu   $sp, $sp, 0x20       ; delay slot: deallocate
```

## Output Formats

### 1. Plain ASM (`.asm`)

Standard MIPS assembly with comments and labels.

### 2. Annotated ASM (`.asm.json`)

Machine-readable format for tooling:

```json
{
  "functions": [
    {
      "name": "main",
      "address": "0x08800000",
      "blocks": [...],
      "calls": ["sceDisplaySetFrameBuf", "sub_08800200"],
      "strings": ["Hello, PSP!"]
    }
  ],
  "data": [
    {
      "address": "0x08900000",
      "type": "string",
      "value": "Hello, PSP!"
    }
  ]
}
```

### 3. Pseudo-C (Future)

High-level decompilation:

```c
void main() {
    sceDisplaySetFrameBuf(0x04000000, 512, 3, 1);

    do {
        // loop body
    } while (result != 0);
}
```

## Implementation Phases

### Phase 1: Linear Disassembly
- [ ] PRX/ELF loader
- [ ] Linear disassembly of code sections
- [ ] Basic ASM output

### Phase 2: Control Flow
- [ ] Basic block identification
- [ ] CFG construction
- [ ] Function boundary detection

### Phase 3: Analysis
- [ ] Data flow analysis
- [ ] Stack frame reconstruction
- [ ] HLE syscall annotation

### Phase 4: Output
- [ ] Formatted ASM with labels
- [ ] Cross-references
- [ ] JSON export

### Phase 5: Advanced (Future)
- [ ] Pseudo-C decompilation
- [ ] Pattern matching for common idioms
- [ ] Interactive analysis UI

## API Design

```typescript
// Usage example
import { Analyzer } from './src/analysis';

const analyzer = new Analyzer();

// Load binary
const binary = await analyzer.loadPRX('game.prx');

// Analyze
const result = await analyzer.analyze(binary, {
  findFunctions: true,
  analyzeDataFlow: true,
  annotateHLE: true,
});

// Output
const asm = result.toASM();
await Bun.write('game.asm', asm);

// Or get structured data
const functions = result.getFunctions();
for (const fn of functions) {
  console.log(`${fn.name}: ${fn.address.toString(16)}`);
}
```

## Dependencies

- Existing CPU infrastructure:
  - `InstructionTable` - Instruction decoding
  - `Disassembler` - Instruction text generation
  - `Instruction` - Field extraction
  - `Memory` - Memory access

## References

- MIPS32 Architecture
- PSP PRX Format
- ELF Specification
- Ghidra decompiler (reference implementation)
- radare2/rizin (reference implementation)
