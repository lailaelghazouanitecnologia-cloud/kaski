/**
 * Simple MIPS Assembler for Testing
 *
 * Assembles MIPS instructions to memory for CPU testing.
 */

import type { Memory } from '../../src/core/memory/Memory';

interface Labels {
  [name: string]: number;
}

export interface AssemblyResult {
  entryPoint: number;
  endAddress: number;
}

/**
 * MIPS register name to number
 */
function parseRegister(name: string): number {
  name = name.trim().toLowerCase();

  // Named registers (with or without $ prefix)
  const namedRegs: { [k: string]: number } = {
    zero: 0, at: 1,
    v0: 2, v1: 3,
    a0: 4, a1: 5, a2: 6, a3: 7,
    t0: 8, t1: 9, t2: 10, t3: 11, t4: 12, t5: 13, t6: 14, t7: 15,
    s0: 16, s1: 17, s2: 18, s3: 19, s4: 20, s5: 21, s6: 22, s7: 23,
    t8: 24, t9: 25,
    k0: 26, k1: 27,
    gp: 28, sp: 29, fp: 30, ra: 31,
  };

  // Remove $ or r prefix if present
  let regName = name;
  if (name.startsWith('$') || name.startsWith('r')) {
    regName = name.substring(1);
  }

  // Try named register first
  if (regName in namedRegs) {
    return namedRegs[regName];
  }

  // Try parsing as number
  const num = parseInt(regName, 10);
  if (!isNaN(num) && num >= 0 && num <= 31) {
    return num;
  }

  throw new Error(`Unknown register: ${name}`);
}

/**
 * Parse an immediate value (supports hex, binary, decimal)
 */
function parseImmediate(value: string): number {
  value = value.trim();

  if (value.startsWith('0x') || value.startsWith('0X')) {
    return parseInt(value, 16);
  }
  if (value.startsWith('0b') || value.startsWith('0B')) {
    return parseInt(value.substring(2), 2);
  }

  return parseInt(value, 10);
}

/**
 * Encode R-type instruction
 * Format: opcode(6) | rs(5) | rt(5) | rd(5) | sa(5) | func(6)
 */
function encodeRType(opcode: number, rs: number, rt: number, rd: number, sa: number, func: number): number {
  return ((opcode & 0x3F) << 26) |
         ((rs & 0x1F) << 21) |
         ((rt & 0x1F) << 16) |
         ((rd & 0x1F) << 11) |
         ((sa & 0x1F) << 6) |
         (func & 0x3F);
}

/**
 * Encode I-type instruction
 * Format: opcode(6) | rs(5) | rt(5) | imm16(16)
 */
function encodeIType(opcode: number, rs: number, rt: number, imm16: number): number {
  return ((opcode & 0x3F) << 26) |
         ((rs & 0x1F) << 21) |
         ((rt & 0x1F) << 16) |
         (imm16 & 0xFFFF);
}

/**
 * Encode J-type instruction
 * Format: opcode(6) | target(26)
 */
function encodeJType(opcode: number, target: number): number {
  return ((opcode & 0x3F) << 26) | ((target >> 2) & 0x03FFFFFF);
}

/**
 * Assemble a single instruction
 * Returns null for lines to skip, otherwise the 32-bit instruction word
 */
function assembleInstruction(pc: number, line: string, labels: Labels): number | null {
  line = line.trim();
  if (!line || line.startsWith('#') || line.startsWith('//')) {
    return null; // Skip empty/comment lines
  }

  // Parse instruction and operands
  const match = line.match(/^(\w+(?:\.\w+)?)\s*(.*)$/);
  if (!match) {
    throw new Error(`Invalid instruction: ${line}`);
  }

  const mnemonic = match[1].toLowerCase();
  const operands = match[2].split(',').map(s => s.trim()).filter(s => s);

  switch (mnemonic) {
    // Pseudo-instructions
    case 'nop':
      return encodeRType(0, 0, 0, 0, 0, 0); // sll $0, $0, 0

    case 'li': {
      const rd = parseRegister(operands[0]);
      const imm = parseImmediate(operands[1]);
      return encodeIType(0x09, 0, rd, imm); // addiu rd, $0, imm
    }

    case 'move': {
      const rd = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      return encodeRType(0, rs, 0, rd, 0, 0x21); // addu rd, rs, $0
    }

    // Arithmetic R-type
    case 'add': {
      const rd = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const rt = parseRegister(operands[2]);
      return encodeRType(0, rs, rt, rd, 0, 0x20);
    }

    case 'addu': {
      const rd = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const rt = parseRegister(operands[2]);
      return encodeRType(0, rs, rt, rd, 0, 0x21);
    }

    case 'sub': {
      const rd = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const rt = parseRegister(operands[2]);
      return encodeRType(0, rs, rt, rd, 0, 0x22);
    }

    case 'subu': {
      const rd = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const rt = parseRegister(operands[2]);
      return encodeRType(0, rs, rt, rd, 0, 0x23);
    }

    // Arithmetic I-type
    case 'addi': {
      const rt = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const imm = parseImmediate(operands[2]);
      return encodeIType(0x08, rs, rt, imm);
    }

    case 'addiu': {
      const rt = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const imm = parseImmediate(operands[2]);
      return encodeIType(0x09, rs, rt, imm);
    }

    // Logical R-type
    case 'and': {
      const rd = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const rt = parseRegister(operands[2]);
      return encodeRType(0, rs, rt, rd, 0, 0x24);
    }

    case 'or': {
      const rd = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const rt = parseRegister(operands[2]);
      return encodeRType(0, rs, rt, rd, 0, 0x25);
    }

    case 'xor': {
      const rd = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const rt = parseRegister(operands[2]);
      return encodeRType(0, rs, rt, rd, 0, 0x26);
    }

    case 'nor': {
      const rd = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const rt = parseRegister(operands[2]);
      return encodeRType(0, rs, rt, rd, 0, 0x27);
    }

    // Logical I-type
    case 'andi': {
      const rt = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const imm = parseImmediate(operands[2]);
      return encodeIType(0x0C, rs, rt, imm);
    }

    case 'ori': {
      const rt = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const imm = parseImmediate(operands[2]);
      return encodeIType(0x0D, rs, rt, imm);
    }

    case 'xori': {
      const rt = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const imm = parseImmediate(operands[2]);
      return encodeIType(0x0E, rs, rt, imm);
    }

    case 'lui': {
      const rt = parseRegister(operands[0]);
      const imm = parseImmediate(operands[1]);
      return encodeIType(0x0F, 0, rt, imm);
    }

    // Shifts
    case 'sll': {
      const rd = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      const sa = parseImmediate(operands[2]);
      return encodeRType(0, 0, rt, rd, sa, 0x00);
    }

    case 'srl': {
      const rd = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      const sa = parseImmediate(operands[2]);
      return encodeRType(0, 0, rt, rd, sa, 0x02);
    }

    case 'sra': {
      const rd = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      const sa = parseImmediate(operands[2]);
      return encodeRType(0, 0, rt, rd, sa, 0x03);
    }

    case 'sllv': {
      const rd = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      const rs = parseRegister(operands[2]);
      return encodeRType(0, rs, rt, rd, 0, 0x04);
    }

    case 'srlv': {
      const rd = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      const rs = parseRegister(operands[2]);
      return encodeRType(0, rs, rt, rd, 0, 0x06);
    }

    case 'srav': {
      const rd = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      const rs = parseRegister(operands[2]);
      return encodeRType(0, rs, rt, rd, 0, 0x07);
    }

    // Comparison
    case 'slt': {
      const rd = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const rt = parseRegister(operands[2]);
      return encodeRType(0, rs, rt, rd, 0, 0x2A);
    }

    case 'sltu': {
      const rd = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const rt = parseRegister(operands[2]);
      return encodeRType(0, rs, rt, rd, 0, 0x2B);
    }

    case 'slti': {
      const rt = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const imm = parseImmediate(operands[2]);
      return encodeIType(0x0A, rs, rt, imm);
    }

    case 'sltiu': {
      const rt = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const imm = parseImmediate(operands[2]);
      return encodeIType(0x0B, rs, rt, imm);
    }

    // Multiply/Divide
    case 'mult': {
      const rs = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      return encodeRType(0, rs, rt, 0, 0, 0x18);
    }

    case 'multu': {
      const rs = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      return encodeRType(0, rs, rt, 0, 0, 0x19);
    }

    case 'div': {
      const rs = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      return encodeRType(0, rs, rt, 0, 0, 0x1A);
    }

    case 'divu': {
      const rs = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      return encodeRType(0, rs, rt, 0, 0, 0x1B);
    }

    case 'mfhi': {
      const rd = parseRegister(operands[0]);
      return encodeRType(0, 0, 0, rd, 0, 0x10);
    }

    case 'mflo': {
      const rd = parseRegister(operands[0]);
      return encodeRType(0, 0, 0, rd, 0, 0x12);
    }

    case 'mthi': {
      const rs = parseRegister(operands[0]);
      return encodeRType(0, rs, 0, 0, 0, 0x11);
    }

    case 'mtlo': {
      const rs = parseRegister(operands[0]);
      return encodeRType(0, rs, 0, 0, 0, 0x13);
    }

    // Load/Store
    case 'lb': {
      const rt = parseRegister(operands[0]);
      const memMatch = operands[1].match(/(-?\d+)\((\$?\w+)\)/);
      if (!memMatch) throw new Error(`Invalid memory operand: ${operands[1]}`);
      const offset = parseImmediate(memMatch[1]);
      const rs = parseRegister(memMatch[2]);
      return encodeIType(0x20, rs, rt, offset);
    }

    case 'lbu': {
      const rt = parseRegister(operands[0]);
      const memMatch = operands[1].match(/(-?\d+)\((\$?\w+)\)/);
      if (!memMatch) throw new Error(`Invalid memory operand: ${operands[1]}`);
      const offset = parseImmediate(memMatch[1]);
      const rs = parseRegister(memMatch[2]);
      return encodeIType(0x24, rs, rt, offset);
    }

    case 'lh': {
      const rt = parseRegister(operands[0]);
      const memMatch = operands[1].match(/(-?\d+)\((\$?\w+)\)/);
      if (!memMatch) throw new Error(`Invalid memory operand: ${operands[1]}`);
      const offset = parseImmediate(memMatch[1]);
      const rs = parseRegister(memMatch[2]);
      return encodeIType(0x21, rs, rt, offset);
    }

    case 'lhu': {
      const rt = parseRegister(operands[0]);
      const memMatch = operands[1].match(/(-?\d+)\((\$?\w+)\)/);
      if (!memMatch) throw new Error(`Invalid memory operand: ${operands[1]}`);
      const offset = parseImmediate(memMatch[1]);
      const rs = parseRegister(memMatch[2]);
      return encodeIType(0x25, rs, rt, offset);
    }

    case 'lw': {
      const rt = parseRegister(operands[0]);
      const memMatch = operands[1].match(/(-?\d+)\((\$?\w+)\)/);
      if (!memMatch) throw new Error(`Invalid memory operand: ${operands[1]}`);
      const offset = parseImmediate(memMatch[1]);
      const rs = parseRegister(memMatch[2]);
      return encodeIType(0x23, rs, rt, offset);
    }

    case 'sb': {
      const rt = parseRegister(operands[0]);
      const memMatch = operands[1].match(/(-?\d+)\((\$?\w+)\)/);
      if (!memMatch) throw new Error(`Invalid memory operand: ${operands[1]}`);
      const offset = parseImmediate(memMatch[1]);
      const rs = parseRegister(memMatch[2]);
      return encodeIType(0x28, rs, rt, offset);
    }

    case 'sh': {
      const rt = parseRegister(operands[0]);
      const memMatch = operands[1].match(/(-?\d+)\((\$?\w+)\)/);
      if (!memMatch) throw new Error(`Invalid memory operand: ${operands[1]}`);
      const offset = parseImmediate(memMatch[1]);
      const rs = parseRegister(memMatch[2]);
      return encodeIType(0x29, rs, rt, offset);
    }

    case 'sw': {
      const rt = parseRegister(operands[0]);
      const memMatch = operands[1].match(/(-?\d+)\((\$?\w+)\)/);
      if (!memMatch) throw new Error(`Invalid memory operand: ${operands[1]}`);
      const offset = parseImmediate(memMatch[1]);
      const rs = parseRegister(memMatch[2]);
      return encodeIType(0x2B, rs, rt, offset);
    }

    // Branches
    case 'beq': {
      const rs = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      const target = labels[operands[2]];
      if (target === undefined) return 0; // First pass
      const offset = ((target - pc - 4) >> 2) & 0xFFFF;
      return encodeIType(0x04, rs, rt, offset);
    }

    case 'bne': {
      const rs = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      const target = labels[operands[2]];
      if (target === undefined) return 0;
      const offset = ((target - pc - 4) >> 2) & 0xFFFF;
      return encodeIType(0x05, rs, rt, offset);
    }

    case 'beql': {
      const rs = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      const target = labels[operands[2]];
      if (target === undefined) return 0;
      const offset = ((target - pc - 4) >> 2) & 0xFFFF;
      return encodeIType(0x14, rs, rt, offset);
    }

    case 'bnel': {
      const rs = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      const target = labels[operands[2]];
      if (target === undefined) return 0;
      const offset = ((target - pc - 4) >> 2) & 0xFFFF;
      return encodeIType(0x15, rs, rt, offset);
    }

    case 'bgez': {
      const rs = parseRegister(operands[0]);
      const target = labels[operands[1]];
      if (target === undefined) return 0;
      const offset = ((target - pc - 4) >> 2) & 0xFFFF;
      return encodeIType(0x01, rs, 0x01, offset);
    }

    case 'bgtz': {
      const rs = parseRegister(operands[0]);
      const target = labels[operands[1]];
      if (target === undefined) return 0;
      const offset = ((target - pc - 4) >> 2) & 0xFFFF;
      return encodeIType(0x07, rs, 0, offset);
    }

    case 'blez': {
      const rs = parseRegister(operands[0]);
      const target = labels[operands[1]];
      if (target === undefined) return 0;
      const offset = ((target - pc - 4) >> 2) & 0xFFFF;
      return encodeIType(0x06, rs, 0, offset);
    }

    case 'bltz': {
      const rs = parseRegister(operands[0]);
      const target = labels[operands[1]];
      if (target === undefined) return 0;
      const offset = ((target - pc - 4) >> 2) & 0xFFFF;
      return encodeIType(0x01, rs, 0x00, offset);
    }

    // Jumps
    case 'j': {
      const target = labels[operands[0]];
      if (target === undefined) return 0;
      return encodeJType(0x02, target);
    }

    case 'jal': {
      const target = labels[operands[0]];
      if (target === undefined) return 0;
      return encodeJType(0x03, target);
    }

    case 'jr': {
      const rs = parseRegister(operands[0]);
      return encodeRType(0, rs, 0, 0, 0, 0x08);
    }

    case 'jalr': {
      const rd = operands.length > 1 ? parseRegister(operands[0]) : 31;
      const rs = parseRegister(operands.length > 1 ? operands[1] : operands[0]);
      return encodeRType(0, rs, 0, rd, 0, 0x09);
    }

    // System
    case 'syscall': {
      const code = operands.length > 0 ? parseImmediate(operands[0]) : 0;
      return encodeRType(0, 0, 0, 0, 0, 0x0C) | ((code & 0xFFFFF) << 6);
    }

    case 'break': {
      const code = operands.length > 0 ? parseImmediate(operands[0]) : 0;
      return encodeRType(0, 0, 0, 0, 0, 0x0D) | ((code & 0xFFFFF) << 6);
    }

    // PSP-specific instructions
    case 'rotr': {
      const rd = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      const sa = parseImmediate(operands[2]);
      // opcode=0, rs=1, rt, rd, sa, func=0x02
      return encodeRType(0, 1, rt, rd, sa, 0x02);
    }

    case 'rotrv': {
      const rd = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      const rs = parseRegister(operands[2]);
      // opcode=0, rs, rt, rd, sa=1, func=0x06
      return encodeRType(0, rs, rt, rd, 1, 0x06);
    }

    case 'seb': {
      const rd = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      // SPECIAL3 opcode=0x1F, rs=0, rt, rd, sa=0x10, func=0x20
      return (0x1F << 26) | (rt << 16) | (rd << 11) | (0x10 << 6) | 0x20;
    }

    case 'seh': {
      const rd = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      // SPECIAL3 opcode=0x1F, rs=0, rt, rd, sa=0x18, func=0x20
      return (0x1F << 26) | (rt << 16) | (rd << 11) | (0x18 << 6) | 0x20;
    }

    case 'bitrev': {
      const rd = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      // SPECIAL3 opcode=0x1F, rs=0, rt, rd, sa=0x14, func=0x20
      return (0x1F << 26) | (rt << 16) | (rd << 11) | (0x14 << 6) | 0x20;
    }

    case 'wsbh': {
      const rd = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      // SPECIAL3 opcode=0x1F, rs=0, rt, rd, sa=0x02, func=0x20
      return (0x1F << 26) | (rt << 16) | (rd << 11) | (0x02 << 6) | 0x20;
    }

    case 'wsbw': {
      const rd = parseRegister(operands[0]);
      const rt = parseRegister(operands[1]);
      // SPECIAL3 opcode=0x1F, rs=0, rt, rd, sa=0x03, func=0x20
      return (0x1F << 26) | (rt << 16) | (rd << 11) | (0x03 << 6) | 0x20;
    }

    case 'max': {
      const rd = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const rt = parseRegister(operands[2]);
      return encodeRType(0, rs, rt, rd, 0, 0x2C);
    }

    case 'min': {
      const rd = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const rt = parseRegister(operands[2]);
      return encodeRType(0, rs, rt, rd, 0, 0x2D);
    }

    case 'movz': {
      const rd = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const rt = parseRegister(operands[2]);
      return encodeRType(0, rs, rt, rd, 0, 0x0A);
    }

    case 'movn': {
      const rd = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const rt = parseRegister(operands[2]);
      return encodeRType(0, rs, rt, rd, 0, 0x0B);
    }

    case 'clz': {
      const rd = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      return encodeRType(0, rs, 0, rd, 0, 0x16);
    }

    case 'clo': {
      const rd = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      return encodeRType(0, rs, 0, rd, 0, 0x17);
    }

    case 'ext': {
      const rt = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const lsb = parseImmediate(operands[2]);
      const size = parseImmediate(operands[3]);
      const msbd = size - 1;  // msbd field is size-1, not lsb+size-1
      // SPECIAL3 opcode=0x1F, rs, rt, msbd, lsb, func=0x00
      return (0x1F << 26) | (rs << 21) | (rt << 16) | (msbd << 11) | (lsb << 6) | 0x00;
    }

    case 'ins': {
      const rt = parseRegister(operands[0]);
      const rs = parseRegister(operands[1]);
      const lsb = parseImmediate(operands[2]);
      const size = parseImmediate(operands[3]);
      const msb = lsb + size - 1;
      // SPECIAL3 opcode=0x1F, rs, rt, msb, lsb, func=0x04
      return (0x1F << 26) | (rs << 21) | (rt << 16) | (msb << 11) | (lsb << 6) | 0x04;
    }

    case 'lwl': {
      const rt = parseRegister(operands[0]);
      const memMatch = operands[1].match(/(-?\d+)\((\$?\w+)\)/);
      if (!memMatch) throw new Error(`Invalid memory operand: ${operands[1]}`);
      const offset = parseImmediate(memMatch[1]);
      const rs = parseRegister(memMatch[2]);
      return encodeIType(0x22, rs, rt, offset);
    }

    case 'lwr': {
      const rt = parseRegister(operands[0]);
      const memMatch = operands[1].match(/(-?\d+)\((\$?\w+)\)/);
      if (!memMatch) throw new Error(`Invalid memory operand: ${operands[1]}`);
      const offset = parseImmediate(memMatch[1]);
      const rs = parseRegister(memMatch[2]);
      return encodeIType(0x26, rs, rt, offset);
    }

    case 'swl': {
      const rt = parseRegister(operands[0]);
      const memMatch = operands[1].match(/(-?\d+)\((\$?\w+)\)/);
      if (!memMatch) throw new Error(`Invalid memory operand: ${operands[1]}`);
      const offset = parseImmediate(memMatch[1]);
      const rs = parseRegister(memMatch[2]);
      return encodeIType(0x2A, rs, rt, offset);
    }

    case 'swr': {
      const rt = parseRegister(operands[0]);
      const memMatch = operands[1].match(/(-?\d+)\((\$?\w+)\)/);
      if (!memMatch) throw new Error(`Invalid memory operand: ${operands[1]}`);
      const offset = parseImmediate(memMatch[1]);
      const rs = parseRegister(memMatch[2]);
      return encodeIType(0x2E, rs, rt, offset);
    }

    default:
      throw new Error(`Unknown instruction: ${mnemonic}`);
  }
}

/**
 * Expand pseudo-instructions that need multiple real instructions
 */
function expandPseudoInstructions(lines: string[]): string[] {
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty, comments, directives, labels
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//') ||
        trimmed.startsWith('.') || trimmed.startsWith(':')) {
      result.push(line);
      continue;
    }

    // Parse instruction
    const match = trimmed.match(/^(\w+)\s*(.*)$/);
    if (!match) {
      result.push(line);
      continue;
    }

    const mnemonic = match[1].toLowerCase();
    const operands = match[2].split(',').map(s => s.trim()).filter(s => s);

    // Expand li with large values
    if (mnemonic === 'li' && operands.length === 2) {
      const rd = operands[0];
      let imm = 0;
      const immStr = operands[1].trim();

      if (immStr.startsWith('0x') || immStr.startsWith('0X')) {
        imm = parseInt(immStr, 16);
      } else if (immStr.startsWith('0b') || immStr.startsWith('0B')) {
        imm = parseInt(immStr.substring(2), 2);
      } else {
        imm = parseInt(immStr, 10);
      }

      // Handle signed values
      imm = imm >>> 0;  // Convert to unsigned 32-bit

      const high = (imm >>> 16) & 0xFFFF;
      const low = imm & 0xFFFF;

      if (high === 0 && (low & 0x8000) === 0) {
        // Small positive value - single addiu
        result.push(`addiu ${rd}, $0, ${low}`);
      } else if (high === 0xFFFF && (low & 0x8000) !== 0) {
        // Small negative value - single addiu with sign extension
        const signed = (low << 16 >> 16);  // Sign extend
        result.push(`addiu ${rd}, $0, ${signed}`);
      } else {
        // Large value - lui + ori
        result.push(`lui ${rd}, ${high}`);
        if (low !== 0) {
          result.push(`ori ${rd}, ${rd}, ${low}`);
        }
      }
    } else {
      result.push(line);
    }
  }

  return result;
}

/**
 * MIPS Assembler
 */
export class MipsAssembler {
  /**
   * Assemble program to memory
   */
  assembleToMemory(memory: Memory, startPC: number, lines: string[]): AssemblyResult {
    const labels: Labels = {};
    let entryPoint = startPC;

    // Expand pseudo-instructions first
    const expandedLines = expandPseudoInstructions(lines);

    // Two-pass assembly for label resolution
    for (let pass = 0; pass < 2; pass++) {
      let pc = startPC;

      for (const line of expandedLines) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
          continue;
        }

        // Handle directives
        if (trimmed.startsWith('.')) {
          if (trimmed === '.entrypoint') {
            entryPoint = pc;
          }
          continue;
        }

        // Handle labels
        if (trimmed.startsWith(':')) {
          labels[trimmed.substring(1)] = pc;
          continue;
        }

        // Assemble instruction
        const instr = assembleInstruction(pc, trimmed, labels);
        if (instr !== null) {
          if (pass === 1) {
            memory.sw(pc, instr >>> 0);  // >>> 0 ensures unsigned write
          }
          pc += 4;
        }
      }
    }

    // Find end address
    let pc = startPC;
    for (const line of expandedLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//') ||
          trimmed.startsWith('.') || trimmed.startsWith(':')) {
        continue;
      }
      pc += 4;
    }

    return { entryPoint, endAddress: pc };
  }
}
