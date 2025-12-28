/**
 * CPU Assembly Tests
 *
 * Tests CPU execution using assembled MIPS programs.
 * Similar to legacy testasm.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';
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
// Arithmetic Tests
// ============================================

describe('CPU Assembly: Arithmetic', () => {
  it('should execute li (load immediate)', () => {
    assertProgram('li', {}, ['li $1, 100'], { $1: 100 });
  });

  it('should execute addiu with negative', () => {
    assertProgram('addiu negative', {}, [
      'li $1, 100',
      'addiu $1, $1, -1'
    ], { $1: 99 });
  });

  it('should execute add', () => {
    assertProgram('add', { $11: 11, $12: 12 }, [
      'add $1, $0, $11',
      'add $2, $0, $12'
    ], { $1: 11, $2: 12 });
  });

  it('should execute sub', () => {
    assertProgram('sub', { $11: 100, $12: 30 }, [
      'sub $1, $11, $12'
    ], { $1: 70 });
  });

  it('should execute complex arithmetic', () => {
    assertProgram('complex arithmetic', { $11: 11, $12: 12 }, [
      'add $1, $0, $11',
      'add $2, $0, $12',
      'sub $3, $2, $1',
      'addi $4, $0, 1234'
    ], { $1: 11, $2: 12, $3: 1, $4: 1234 });
  });

  it('should handle overflow in addu', () => {
    assertProgram('addu overflow', { $1: 0xFFFFFFFF, $2: 1 }, [
      'addu $3, $1, $2'
    ], { $3: 0 });
  });
});

// ============================================
// Logical Tests
// ============================================

describe('CPU Assembly: Logical', () => {
  it('should execute xor', () => {
    assertProgram('xor', { $1: 0xFF00FF00, $2: 0x00FFFF00 }, [
      'xor $3, $1, $2'
    ], { $3: 0xFFFF0000 });
  });

  it('should execute and', () => {
    assertProgram('and', { $1: 0xFF00FF00, $2: 0x00FFFF00 }, [
      'and $3, $1, $2'
    ], { $3: 0x0000FF00 });
  });

  it('should execute or', () => {
    assertProgram('or', { $1: 0xFF00FF00, $2: 0x00FFFF00 }, [
      'or $3, $1, $2'
    ], { $3: 0xFFFFFF00 });
  });

  it('should execute nor', () => {
    assertProgram('nor', { $1: 0xFF00FF00, $2: 0x00FFFF00 }, [
      'nor $3, $1, $2'
    ], { $3: 0x000000FF });
  });

  it('should execute andi', () => {
    assertProgram('andi', { $1: 0x12345678 }, [
      'andi $2, $1, 0xFF00'
    ], { $2: 0x5600 });
  });

  it('should execute ori', () => {
    assertProgram('ori', { $1: 0x12340000 }, [
      'ori $2, $1, 0x5678'
    ], { $2: 0x12345678 });
  });

  it('should execute lui', () => {
    assertProgram('lui', {}, [
      'lui $1, 0x1234'
    ], { $1: 0x12340000 });
  });
});

// ============================================
// Shift Tests
// ============================================

describe('CPU Assembly: Shifts', () => {
  it('should execute sll', () => {
    assertProgram('sll', { $1: 0x00000001 }, [
      'sll $2, $1, 4'
    ], { $2: 0x00000010 });
  });

  it('should execute srl', () => {
    assertProgram('srl', { $1: 0x80000000 }, [
      'srl $2, $1, 4'
    ], { $2: 0x08000000 });
  });

  it('should execute sra (arithmetic)', () => {
    assertProgram('sra', { $1: 0x80000000 }, [
      'sra $2, $1, 4'
    ], { $2: 0xF8000000 });
  });

  it('should execute sllv', () => {
    assertProgram('sllv', { $1: 0x00000001, $2: 8 }, [
      'sllv $3, $1, $2'
    ], { $3: 0x00000100 });
  });

  it('should execute srlv', () => {
    assertProgram('srlv', { $1: 0x00001000, $2: 4 }, [
      'srlv $3, $1, $2'
    ], { $3: 0x00000100 });
  });
});

// ============================================
// Comparison Tests
// ============================================

describe('CPU Assembly: Comparison', () => {
  it('should execute slt (signed)', () => {
    assertProgram('slt positive', { $10: 5, $11: 10 }, [
      'slt $1, $10, $11'
    ], { $1: 1 });

    assertProgram('slt negative', { $10: -5, $11: -10 }, [
      'slt $1, $10, $11'
    ], { $1: 0 });

    assertProgram('slt mixed', { $10: -5, $11: 10 }, [
      'slt $1, $10, $11'
    ], { $1: 1 });
  });

  it('should execute sltu (unsigned)', () => {
    assertProgram('sltu', { $10: 0, $11: 7 }, [
      'sltu $1, $10, $11'
    ], { $1: 1 });

    // -100 as unsigned is very large
    assertProgram('sltu with negative', { $10: -100, $11: 100 }, [
      'sltu $1, $10, $11'
    ], { $1: 0 });
  });

  it('should execute slti', () => {
    assertProgram('slti', { $10: 5 }, [
      'slti $1, $10, 10'
    ], { $1: 1 });
  });

  it('should execute sltiu', () => {
    assertProgram('sltiu', { $10: 5 }, [
      'sltiu $1, $10, 10'
    ], { $1: 1 });
  });

  it('should handle set less than edge cases', () => {
    assertProgram('slt edge cases', {
      $10: 0, $11: -100, $12: 100, $20: 0, $21: 7, $22: -200
    }, [
      'sltu $1, $10, $20',
      'sltu $2, $10, $21',
      'sltu $3, $11, $22',
      'slt $4, $11, $22'
    ], { $1: 0, $2: 1, $3: 0, $4: 0 });
  });
});

// ============================================
// Multiply/Divide Tests
// ============================================

describe('CPU Assembly: Multiply/Divide', () => {
  it('should execute mult', () => {
    assertProgram('mult', { $10: 100, $11: 200 }, [
      'mult $10, $11',
      'mflo $1',
      'mfhi $2'
    ], { $1: 20000, $2: 0 });
  });

  it('should execute mult large numbers', () => {
    assertProgram('mult large', { $10: 0x10000, $11: 0x10000 }, [
      'mult $10, $11',
      'mflo $1',
      'mfhi $2'
    ], { $1: 0, $2: 1 });
  });

  it('should execute multu', () => {
    assertProgram('multu', { $10: 0xFFFFFFFF, $11: 2 }, [
      'multu $10, $11',
      'mflo $1',
      'mfhi $2'
    ], { $1: 0xFFFFFFFE, $2: 1 });
  });

  it('should execute div', () => {
    assertProgram('div', { $10: 100, $11: 12 }, [
      'div $10, $11',
      'mflo $1',
      'mfhi $2'
    ], { $1: 8, $2: 4 }); // 100 / 12 = 8 remainder 4
  });

  it('should execute divu', () => {
    assertProgram('divu', { $10: 100, $11: 7 }, [
      'divu $10, $11',
      'mflo $1',
      'mfhi $2'
    ], { $1: 14, $2: 2 }); // 100 / 7 = 14 remainder 2
  });

  it('should execute mthi/mtlo', () => {
    assertProgram('mthi/mtlo', { $10: 0x12345678, $11: 0xABCDEF00 }, [
      'mthi $10',
      'mtlo $11',
      'mfhi $1',
      'mflo $2'
    ], { $1: 0x12345678, $2: 0xABCDEF00 });
  });
});

// ============================================
// Branch Tests
// ============================================

describe('CPU Assembly: Branches', () => {
  it('should execute beq (taken)', () => {
    assertProgram('beq taken', { $1: 0, $2: 0 }, [
      ':loop',
      'addi $2, $2, 1',
      'beq $1, $0, loop',
      'addi $1, $1, 1'
    ], { $1: 2, $2: 2 });
  });

  it('should execute beq (not taken)', () => {
    assertProgram('beq not taken', { $1: 1, $2: 0 }, [
      'beq $1, $0, skip',
      'addi $2, $2, 100',
      ':skip',
      'addi $2, $2, 1'
    ], { $2: 101 });
  });

  it('should execute bne', () => {
    assertProgram('bne loop', { $1: 0, $2: 10 }, [
      ':loop',
      'bne $1, $2, loop',
      'addi $1, $1, 1'
    ], { $1: 11 });
  });

  it('should execute beql (likely, taken)', () => {
    assertProgram('beql taken', { $1: 0, $2: 0 }, [
      ':loop',
      'addi $2, $2, 1',
      'beql $1, $0, loop',
      'addi $1, $1, 1'
    ], { $1: 1, $2: 2 });
  });

  it('should execute beql (likely, not taken - skips delay slot)', () => {
    assertProgram('beql not taken', { $1: 1, $2: 0 }, [
      'beql $1, $0, skip',
      'addi $2, $2, 100',  // Should be skipped
      ':skip',
      'addi $2, $2, 1'
    ], { $2: 1 });
  });

  it('should execute bgez', () => {
    assertProgram('bgez positive', { $1: 5 }, [
      'bgez $1, taken',
      'li $2, 1',
      'li $2, 0',
      ':taken'
    ], { $2: 1 });

    assertProgram('bgez zero', { $1: 0 }, [
      'bgez $1, taken',
      'li $2, 1',
      'li $2, 0',
      ':taken'
    ], { $2: 1 });
  });

  it('should execute bltz', () => {
    assertProgram('bltz negative', { $1: -5 }, [
      'bltz $1, taken',
      'li $2, 0',
      'li $2, 1',
      ':taken'
    ], { $2: 0 });
  });

  it('should execute bgtz', () => {
    assertProgram('bgtz positive', { $1: 5 }, [
      'bgtz $1, taken',
      'li $2, 0',
      'li $2, 1',
      ':taken'
    ], { $2: 0 });
  });

  it('should execute blez', () => {
    assertProgram('blez zero', { $1: 0 }, [
      'blez $1, taken',
      'li $2, 0',
      'li $2, 1',
      ':taken'
    ], { $2: 0 });

    assertProgram('blez negative', { $1: -5 }, [
      'blez $1, taken',
      'li $2, 0',
      'li $2, 1',
      ':taken'
    ], { $2: 0 });
  });
});

// ============================================
// Jump Tests
// ============================================

describe('CPU Assembly: Jumps', () => {
  it('should execute j', () => {
    assertProgram('j', {}, [
      'j target',
      'li $1, 1',     // delay slot
      'li $2, 100',   // skipped
      ':target',
      'li $3, 200'
    ], { $1: 1, $2: 0, $3: 200 });
  });

  it('should execute jal', () => {
    assertProgram('jal', {}, [
      'jal subroutine',
      'nop',
      'li $1, 1',
      ':end',
      'break 0',
      ':subroutine',
      'li $2, 200',
      'jr $ra',
      'nop'
    ], { $1: 1, $2: 200 });
  });

  it('should execute jr', () => {
    const memory = new Memory();
    const cpu = new Cpu(memory);

    // Simple program that jumps to an address
    // Layout: lui(0x00) ori(0x04) jr(0x08) li(0x0C) li(0x10) li(0x14) break(0x18)
    const program = [
      'lui $1, 0x0880',
      'ori $1, $1, 0x0014',  // $1 = 0x08800014 (address of li $3, 300)
      'jr $1',
      'li $2, 100',          // delay slot
      'li $3, 200',          // skipped
      'li $3, 300',          // target at 0x14
      'break 0'
    ];

    assembler.assembleToMemory(memory, BASE_PC, program);
    cpu.state.pc = BASE_PC;
    cpu.state.sp = 0x09FFF000;

    let instrCount = 0;
    while (instrCount < 100) {
      const status = cpu.step();
      instrCount++;
      if (status === CpuStatus.BREAKPOINT) break;
    }

    expect(cpu.state.getGpr(2)).toBe(100);
    expect(cpu.state.getGpr(3)).toBe(300);
  });
});

// ============================================
// Load/Store Tests
// ============================================

describe('CPU Assembly: Load/Store', () => {
  it('should execute lw/sw', () => {
    const memory = new Memory();
    const cpu = new Cpu(memory);

    // Store and load a word
    const program = [
      'lui $10, 0x0900',     // $10 = 0x09000000 (data area)
      'li $1, 0x12345678',
      'sw $1, 0($10)',
      'lw $2, 0($10)',
      'break 0'
    ];

    assembler.assembleToMemory(memory, BASE_PC, program);
    cpu.state.pc = BASE_PC;

    while (cpu.step() !== CpuStatus.BREAKPOINT) {}

    expect(cpu.state.getGpr(2) >>> 0).toBe(0x12345678);
  });

  it('should execute lb/sb', () => {
    const memory = new Memory();
    const cpu = new Cpu(memory);

    const program = [
      'lui $10, 0x0900',
      'li $1, 0x12345678',
      'sw $1, 0($10)',
      'lbu $2, 0($10)',
      'lbu $3, 1($10)',
      'lbu $4, 2($10)',
      'lbu $5, 3($10)',
      'break 0'
    ];

    assembler.assembleToMemory(memory, BASE_PC, program);
    cpu.state.pc = BASE_PC;

    while (cpu.step() !== CpuStatus.BREAKPOINT) {}

    // Little-endian: 0x12345678 stored as 78 56 34 12
    expect(cpu.state.getGpr(2)).toBe(0x78);
    expect(cpu.state.getGpr(3)).toBe(0x56);
    expect(cpu.state.getGpr(4)).toBe(0x34);
    expect(cpu.state.getGpr(5)).toBe(0x12);
  });

  it('should execute lb sign extension', () => {
    const memory = new Memory();
    const cpu = new Cpu(memory);

    const program = [
      'lui $10, 0x0900',
      'li $1, 0x000000FF',  // 0xFF = -1 as signed byte
      'sb $1, 0($10)',
      'lb $2, 0($10)',      // Should sign-extend to 0xFFFFFFFF
      'lbu $3, 0($10)',     // Should zero-extend to 0x000000FF
      'break 0'
    ];

    assembler.assembleToMemory(memory, BASE_PC, program);
    cpu.state.pc = BASE_PC;

    while (cpu.step() !== CpuStatus.BREAKPOINT) {}

    expect(cpu.state.getGpr(2)).toBe(-1);  // Sign-extended
    expect(cpu.state.getGpr(3)).toBe(0xFF);  // Zero-extended
  });

  it('should execute lh/sh', () => {
    const memory = new Memory();
    const cpu = new Cpu(memory);

    const program = [
      'lui $10, 0x0900',
      'li $1, 0x1234',
      'sh $1, 0($10)',
      'lhu $2, 0($10)',
      'break 0'
    ];

    assembler.assembleToMemory(memory, BASE_PC, program);
    cpu.state.pc = BASE_PC;

    while (cpu.step() !== CpuStatus.BREAKPOINT) {}

    expect(cpu.state.getGpr(2)).toBe(0x1234);
  });
});

// ============================================
// Complex Programs
// ============================================

describe('CPU Assembly: Complex Programs', () => {
  it('should execute loop to sum 1 to 10', () => {
    assertProgram('sum 1-10', {}, [
      'li $1, 0',      // sum = 0
      'li $2, 1',      // i = 1
      'li $3, 11',     // limit = 11
      ':loop',
      'add $1, $1, $2',  // sum += i
      'addi $2, $2, 1',  // i++
      'bne $2, $3, loop',
      'nop'
    ], { $1: 55, $2: 11 });  // 1+2+...+10 = 55
  });

  it('should execute factorial of 5', () => {
    assertProgram('factorial 5', {}, [
      'li $1, 1',      // result = 1
      'li $2, 5',      // n = 5
      ':loop',
      'mult $1, $2',
      'mflo $1',       // result *= n
      'addi $2, $2, -1', // n--
      'bgtz $2, loop',
      'nop'
    ], { $1: 120 });  // 5! = 120
  });

  it('should execute fibonacci', () => {
    assertProgram('fibonacci 10', {}, [
      'li $1, 0',      // fib[0] = 0
      'li $2, 1',      // fib[1] = 1
      'li $4, 10',     // count
      ':loop',
      'add $3, $1, $2',  // next = fib[n-2] + fib[n-1]
      'move $1, $2',     // fib[n-2] = fib[n-1]
      'move $2, $3',     // fib[n-1] = next
      'addi $4, $4, -1', // count--
      'bgtz $4, loop',
      'nop'
    ], { $2: 89 });  // fib(10) = 89
  });

  it('should execute nested subroutine calls', () => {
    const memory = new Memory();
    const cpu = new Cpu(memory);

    const program = [
      // Main
      'addi $sp, $sp, -8',
      'sw $ra, 4($sp)',
      'jal func1',
      'nop',
      'lw $ra, 4($sp)',
      'addi $sp, $sp, 8',
      'break 0',

      // func1: sets $1 = 10, calls func2
      ':func1',
      'addi $sp, $sp, -8',
      'sw $ra, 4($sp)',
      'li $1, 10',
      'jal func2',
      'nop',
      'lw $ra, 4($sp)',
      'addi $sp, $sp, 8',
      'jr $ra',
      'nop',

      // func2: sets $2 = 20
      ':func2',
      'li $2, 20',
      'jr $ra',
      'nop'
    ];

    assembler.assembleToMemory(memory, BASE_PC, program);
    cpu.state.pc = BASE_PC;
    cpu.state.sp = 0x09FFF000;

    while (cpu.step() !== CpuStatus.BREAKPOINT) {}

    expect(cpu.state.getGpr(1)).toBe(10);
    expect(cpu.state.getGpr(2)).toBe(20);
  });
});
