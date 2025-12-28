import { Instruction } from './Instruction';
import { InstructionType } from './InstructionType';
import { InstructionTable } from './InstructionTable';
import { CpuState } from './CpuState';

/**
 * MIPS register names
 */
const GPR_NAMES = [
  'zero', 'at', 'v0', 'v1', 'a0', 'a1', 'a2', 'a3',
  't0', 't1', 't2', 't3', 't4', 't5', 't6', 't7',
  's0', 's1', 's2', 's3', 's4', 's5', 's6', 's7',
  't8', 't9', 'k0', 'k1', 'gp', 'sp', 'fp', 'ra',
];

/**
 * FPU register names
 */
const FPR_NAMES = Array.from({ length: 32 }, (_, i) => `f${i}`);

/**
 * Format a number as hexadecimal
 */
function hex(value: number, digits: number = 8): string {
  return (value >>> 0).toString(16).padStart(digits, '0');
}

/**
 * Disassembled instruction result
 */
export interface DisassemblyResult {
  /** Program counter */
  pc: number;
  /** Raw instruction data */
  data: number;
  /** Instruction mnemonic */
  mnemonic: string;
  /** Operands string */
  operands: string;
  /** Full disassembly string */
  text: string;
  /** Instruction type (null if unknown) */
  type: InstructionType | null;
}

/**
 * MIPS Disassembler
 */
export class Disassembler {
  private table: InstructionTable;

  constructor() {
    this.table = InstructionTable.instance;
  }

  /**
   * Disassemble a single instruction
   */
  disassemble(instr: Instruction): DisassemblyResult {
    const type = this.table.find(instr.data);

    if (!type) {
      return {
        pc: instr.pc,
        data: instr.data,
        mnemonic: '???',
        operands: hex(instr.data),
        text: `??? 0x${hex(instr.data)}`,
        type: null,
      };
    }

    const operands = this.formatOperands(instr, type);

    return {
      pc: instr.pc,
      data: instr.data,
      mnemonic: type.name,
      operands,
      text: operands ? `${type.name} ${operands}` : type.name,
      type,
    };
  }

  /**
   * Disassemble from raw data
   */
  disassembleData(pc: number, data: number): DisassemblyResult {
    return this.disassemble(new Instruction(pc, data));
  }

  /**
   * Format operands according to format string
   */
  private formatOperands(instr: Instruction, type: InstructionType): string {
    let result = '';

    for (let i = 0; i < type.format.length; i++) {
      const char = type.format[i];

      if (char === '%') {
        i++;
        const next = type.format[i];
        result += this.formatOperand(instr, next);
      } else {
        result += char;
      }
    }

    return result.trim();
  }

  /**
   * Format a single operand
   */
  private formatOperand(instr: Instruction, format: string): string {
    switch (format) {
      // GPR registers
      case 'd': return GPR_NAMES[instr.rd];
      case 's': return GPR_NAMES[instr.rs];
      case 't': return GPR_NAMES[instr.rt];

      // FPR registers
      case 'D': return FPR_NAMES[instr.fd];
      case 'S': return FPR_NAMES[instr.fs];
      case 'T': return FPR_NAMES[instr.ft];

      // Shift amount
      case 'a': return instr.sa.toString();

      // Signed immediate
      case 'i': return instr.imm16.toString();

      // Unsigned immediate
      case 'I': return `0x${hex(instr.uimm16, 4)}`;

      // Memory offset: imm16(rs)
      case 'o': return `${instr.imm16}(${GPR_NAMES[instr.rs]})`;

      // Branch offset (show target address)
      case 'O': return `0x${hex(instr.branchTarget)}`;

      // Jump target
      case 'J': return `0x${hex(instr.jumpTarget)}`;

      // Size for ext (msb+1)
      case 'n':
        if (format === 'ne') return (instr.msb + 1).toString();
        if (format === 'ni') return (instr.msb - instr.lsb + 1).toString();
        return '';

      default:
        return `%${format}`;
    }
  }

  /**
   * Disassemble a range of memory
   */
  disassembleRange(
    memory: { lw(addr: number): number },
    start: number,
    count: number
  ): DisassemblyResult[] {
    const results: DisassemblyResult[] = [];

    for (let i = 0; i < count; i++) {
      const pc = start + i * 4;
      const data = memory.lw(pc);
      results.push(this.disassembleData(pc, data));
    }

    return results;
  }

  /**
   * Format disassembly as string with addresses
   */
  formatDisassembly(results: DisassemblyResult[]): string {
    return results
      .map(r => `0x${hex(r.pc)}: ${hex(r.data)}  ${r.text}`)
      .join('\n');
  }
}

/**
 * Global disassembler instance
 */
export const disassembler = new Disassembler();
