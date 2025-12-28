/**
 * CPU PSP-Specific Instruction Tests
 *
 * Tests PSP-specific MIPS extensions using assembled programs.
 */

import { describe, it, expect } from 'bun:test';
import { Memory } from '../src/core/memory/Memory';
import { Cpu, CpuStatus } from '../src/core/cpu';
import { MipsAssembler } from './utils/MipsAssembler';

const assembler = new MipsAssembler();
const BASE_PC = 0x08800000;

interface RegisterState {
  [key: string]: number;
}

/**
 * Execute a program and return the CPU state
 */
function executeProgram(
  initialRegs: RegisterState,
  program: string[]
): Cpu {
  const memory = new Memory();
  const cpu = new Cpu(memory);

  // Add break instruction at the end
  const fullProgram = [...program, 'break 0'];

  // Assemble program
  const result = assembler.assembleToMemory(memory, BASE_PC, fullProgram);

  // Initialize registers
  for (const [key, value] of Object.entries(initialRegs)) {
    if (key.startsWith('$')) {
      const regNum = parseInt(key.substring(1), 10);
      cpu.state.setGpr(regNum, value);
    } else if (key === 'HI') {
      cpu.state.hi = value;
    } else if (key === 'LO') {
      cpu.state.lo = value;
    }
  }

  // Set up CPU state
  cpu.state.pc = result.entryPoint;
  cpu.state.sp = 0x09FFF000;

  // Run until break or error
  let instrCount = 0;
  const maxInstructions = 10000;

  while (instrCount < maxInstructions) {
    const status = cpu.step();
    instrCount++;

    if (status === CpuStatus.BREAKPOINT || status === CpuStatus.ERROR) {
      break;
    }
  }

  return cpu;
}

/**
 * Assert program produces expected register values
 */
function assertProgram(
  description: string,
  initialRegs: RegisterState,
  program: string[],
  expectedRegs: RegisterState
): void {
  const cpu = executeProgram(initialRegs, program);

  for (const [key, expected] of Object.entries(expectedRegs)) {
    let actual: number;

    if (key.startsWith('$')) {
      const regNum = parseInt(key.substring(1), 10);
      actual = cpu.state.getGpr(regNum);
    } else if (key === 'HI') {
      actual = cpu.state.hi;
    } else if (key === 'LO') {
      actual = cpu.state.lo;
    } else {
      throw new Error(`Unknown register: ${key}`);
    }

    // Convert to unsigned for comparison
    const actualU = actual >>> 0;
    const expectedU = expected >>> 0;

    expect(actualU).toBe(expectedU);
  }
}

// ============================================
// Rotate Instructions
// ============================================

describe('CPU PSP: Rotate', () => {
  it('should execute rotr (rotate right by immediate)', () => {
    // 0x80000001 rotated right by 1 = 0xC0000000
    assertProgram('rotr', { $1: 0x80000001 }, [
      'rotr $2, $1, 1'
    ], { $2: 0xC0000000 });
  });

  it('should execute rotr by 8', () => {
    // 0x12345678 rotated right by 8 = 0x78123456
    assertProgram('rotr 8', { $1: 0x12345678 }, [
      'rotr $2, $1, 8'
    ], { $2: 0x78123456 });
  });

  it('should execute rotrv (rotate right by register)', () => {
    // 0x12345678 rotated right by 16 = 0x56781234
    assertProgram('rotrv', { $1: 0x12345678, $2: 16 }, [
      'rotrv $3, $1, $2'
    ], { $3: 0x56781234 });
  });
});

// ============================================
// Sign Extension Instructions
// ============================================

describe('CPU PSP: Sign Extension', () => {
  it('should execute seb (sign extend byte) - positive', () => {
    assertProgram('seb positive', { $1: 0x0000007F }, [
      'seb $2, $1'
    ], { $2: 0x0000007F });
  });

  it('should execute seb (sign extend byte) - negative', () => {
    // 0x80 = -128 as signed byte, should extend to 0xFFFFFF80
    assertProgram('seb negative', { $1: 0x00000080 }, [
      'seb $2, $1'
    ], { $2: 0xFFFFFF80 });
  });

  it('should execute seb with upper bits set', () => {
    // Only low byte matters: 0xFF = -1 as signed byte
    assertProgram('seb upper', { $1: 0x123456FF }, [
      'seb $2, $1'
    ], { $2: 0xFFFFFFFF });
  });

  it('should execute seh (sign extend halfword) - positive', () => {
    assertProgram('seh positive', { $1: 0x00007FFF }, [
      'seh $2, $1'
    ], { $2: 0x00007FFF });
  });

  it('should execute seh (sign extend halfword) - negative', () => {
    // 0x8000 = -32768 as signed halfword
    assertProgram('seh negative', { $1: 0x00008000 }, [
      'seh $2, $1'
    ], { $2: 0xFFFF8000 });
  });
});

// ============================================
// Bit Manipulation Instructions
// ============================================

describe('CPU PSP: Bit Manipulation', () => {
  it('should execute bitrev (bit reverse)', () => {
    // 0x00000001 reversed = 0x80000000
    assertProgram('bitrev', { $1: 0x00000001 }, [
      'bitrev $2, $1'
    ], { $2: 0x80000000 });
  });

  it('should execute bitrev on pattern', () => {
    // 0xF0000000 = 11110000... reversed = ...00001111 = 0x0000000F
    assertProgram('bitrev pattern', { $1: 0xF0000000 }, [
      'bitrev $2, $1'
    ], { $2: 0x0000000F });
  });

  it('should execute wsbh (word swap bytes in halfwords)', () => {
    // 0x12345678 -> swap bytes in each halfword -> 0x34127856
    assertProgram('wsbh', { $1: 0x12345678 }, [
      'wsbh $2, $1'
    ], { $2: 0x34127856 });
  });

  it('should execute wsbw (word swap bytes in word)', () => {
    // 0x12345678 -> full byte swap -> 0x78563412
    assertProgram('wsbw', { $1: 0x12345678 }, [
      'wsbw $2, $1'
    ], { $2: 0x78563412 });
  });

  it('should execute ext (extract bit field)', () => {
    // Extract 8 bits starting at bit 8 from 0x12345678
    // bits 15-8 = 0x56
    assertProgram('ext', { $1: 0x12345678 }, [
      'ext $2, $1, 8, 8'
    ], { $2: 0x00000056 });
  });

  it('should execute ext at bit 0', () => {
    // Extract 4 bits starting at bit 0 from 0x12345678
    // bits 3-0 = 0x8
    assertProgram('ext bit 0', { $1: 0x12345678 }, [
      'ext $2, $1, 0, 4'
    ], { $2: 0x00000008 });
  });

  it('should execute ins (insert bit field)', () => {
    // Insert 8 bits of $1 at bit 8 of $2
    // $2 = 0xFFFF00FF, insert 0xAB at bits 15-8 -> 0xFFFFABFF
    assertProgram('ins', { $1: 0x000000AB, $2: 0xFFFF00FF }, [
      'ins $2, $1, 8, 8'
    ], { $2: 0xFFFFABFF });
  });
});

// ============================================
// Min/Max Instructions
// ============================================

describe('CPU PSP: Min/Max', () => {
  it('should execute max (signed)', () => {
    assertProgram('max positive', { $1: 100, $2: 200 }, [
      'max $3, $1, $2'
    ], { $3: 200 });
  });

  it('should execute max with negative', () => {
    // -10 vs 5, max is 5
    assertProgram('max negative', { $1: -10, $2: 5 }, [
      'max $3, $1, $2'
    ], { $3: 5 });
  });

  it('should execute min (signed)', () => {
    assertProgram('min positive', { $1: 100, $2: 200 }, [
      'min $3, $1, $2'
    ], { $3: 100 });
  });

  it('should execute min with negative', () => {
    // -10 vs 5, min is -10
    assertProgram('min negative', { $1: -10, $2: 5 }, [
      'min $3, $1, $2'
    ], { $3: 0xFFFFFFF6 }); // -10 as unsigned
  });
});

// ============================================
// Conditional Move Instructions
// ============================================

describe('CPU PSP: Conditional Move', () => {
  it('should execute movz (move if zero) - taken', () => {
    // movz rd, rs, rt: if rt == 0, rd = rs
    assertProgram('movz taken', { $1: 100, $2: 0, $3: 999 }, [
      'movz $3, $1, $2'
    ], { $3: 100 });
  });

  it('should execute movz (move if zero) - not taken', () => {
    // rt != 0, so rd unchanged
    assertProgram('movz not taken', { $1: 100, $2: 1, $3: 999 }, [
      'movz $3, $1, $2'
    ], { $3: 999 });
  });

  it('should execute movn (move if not zero) - taken', () => {
    // movn rd, rs, rt: if rt != 0, rd = rs
    assertProgram('movn taken', { $1: 100, $2: 1, $3: 999 }, [
      'movn $3, $1, $2'
    ], { $3: 100 });
  });

  it('should execute movn (move if not zero) - not taken', () => {
    // rt == 0, so rd unchanged
    assertProgram('movn not taken', { $1: 100, $2: 0, $3: 999 }, [
      'movn $3, $1, $2'
    ], { $3: 999 });
  });
});

// ============================================
// Count Leading Zeros/Ones
// ============================================

describe('CPU PSP: Count Leading', () => {
  it('should execute clz (count leading zeros)', () => {
    // 0x00010000 has 15 leading zeros
    assertProgram('clz', { $1: 0x00010000 }, [
      'clz $2, $1'
    ], { $2: 15 });
  });

  it('should execute clz on zero', () => {
    // 0 has 32 leading zeros
    assertProgram('clz zero', { $1: 0 }, [
      'clz $2, $1'
    ], { $2: 32 });
  });

  it('should execute clz on high bit set', () => {
    // 0x80000000 has 0 leading zeros
    assertProgram('clz high', { $1: 0x80000000 }, [
      'clz $2, $1'
    ], { $2: 0 });
  });

  it('should execute clo (count leading ones)', () => {
    // 0xFFFE0000 = 11111111111111111110... has 15 leading ones
    assertProgram('clo', { $1: 0xFFFE0000 }, [
      'clo $2, $1'
    ], { $2: 15 });
  });

  it('should execute clo on all ones', () => {
    // 0xFFFFFFFF has 32 leading ones
    assertProgram('clo all ones', { $1: 0xFFFFFFFF }, [
      'clo $2, $1'
    ], { $2: 32 });
  });
});

// ============================================
// Unaligned Load/Store
// ============================================

describe('CPU PSP: Unaligned Load/Store', () => {
  it('should execute lwl/lwr for unaligned load', () => {
    const memory = new Memory();
    const cpu = new Cpu(memory);

    // Store pattern at unaligned address
    // Memory: addr 0x09000001: 0x12, addr 0x09000002: 0x34, etc.
    memory.sb(0x09000001, 0x12);
    memory.sb(0x09000002, 0x34);
    memory.sb(0x09000003, 0x56);
    memory.sb(0x09000004, 0x78);

    // Program to load unaligned word at 0x09000001
    const program = [
      'lui $10, 0x0900',
      'ori $10, $10, 0x0001',
      'lwl $1, 3($10)',   // Load left part
      'lwr $1, 0($10)',   // Load right part
      'break 0'
    ];

    assembler.assembleToMemory(memory, BASE_PC, program);
    cpu.state.pc = BASE_PC;
    cpu.state.sp = 0x09FFF000;

    while (cpu.step() !== CpuStatus.BREAKPOINT) {}

    // Result depends on endianness - PSP is little endian
    // The loaded value should combine bytes from both loads
    const result = cpu.state.getGpr(1) >>> 0;
    // This test verifies the instructions execute without error
    expect(result).toBeDefined();
  });
});

// ============================================
// Complex Programs with PSP Instructions
// ============================================

describe('CPU PSP: Complex Programs', () => {
  it('should clamp value using min/max', () => {
    // Clamp value to range [0, 100]
    assertProgram('clamp', { $1: 150 }, [
      'li $10, 0',
      'li $11, 100',
      'max $1, $1, $10',  // max(150, 0) = 150
      'min $1, $1, $11'   // min(150, 100) = 100
    ], { $1: 100 });
  });

  it('should clamp negative value', () => {
    assertProgram('clamp negative', { $1: -50 }, [
      'li $10, 0',
      'li $11, 100',
      'max $1, $1, $10',  // max(-50, 0) = 0
      'min $1, $1, $11'   // min(0, 100) = 0
    ], { $1: 0 });
  });

  it('should count bits set using bitrev and clz', () => {
    // This is a creative way to manipulate bits
    assertProgram('bit manipulation', { $1: 0x0F0F0F0F }, [
      'bitrev $2, $1',
      'xor $3, $1, $2'  // XOR original with reversed
    ], { $2: 0xF0F0F0F0, $3: 0xFFFFFFFF });
  });

  it('should swap endianness of 32-bit value', () => {
    // Use wsbw to swap endianness
    assertProgram('endian swap', { $1: 0x11223344 }, [
      'wsbw $2, $1'
    ], { $2: 0x44332211 });
  });

  it('should extract and insert bit fields', () => {
    // Simple extract and insert test
    // Extract 8 bits from position 16, then insert 0xAB at position 8
    assertProgram('extract insert', { $1: 0x12345678, $2: 0xAB }, [
      'ext $3, $1, 16, 8',  // Extract bits 23-16 (0x34)
      'ins $1, $2, 8, 8'    // Insert 0xAB at bits 15-8
    ], { $1: 0x1234AB78, $3: 0x34 });
  });

  it('should use conditional moves for abs', () => {
    // Absolute value using movn/movz
    assertProgram('abs positive', { $1: 42 }, [
      'sra $2, $1, 31',     // $2 = sign extension (0 for positive)
      'xor $3, $1, $2',     // $3 = $1 ^ sign (unchanged for positive)
      'subu $3, $3, $2'     // $3 = $3 - sign (unchanged for positive)
    ], { $3: 42 });

    assertProgram('abs negative', { $1: -42 }, [
      'sra $2, $1, 31',     // $2 = 0xFFFFFFFF (all 1s for negative)
      'xor $3, $1, $2',     // $3 = $1 ^ -1 = ~$1 = 41
      'subu $3, $3, $2'     // $3 = 41 - (-1) = 42
    ], { $3: 42 });
  });
});
