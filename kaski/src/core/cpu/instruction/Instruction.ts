import type { Memory } from '../../memory';
import { BitUtils, hex } from '../../utils';

// Re-export BitUtils for backwards compatibility
export { BitUtils } from '../../utils';

/**
 * MIPS Instruction representation
 *
 * Provides accessors for all instruction fields according to MIPS encoding.
 * Supports both R-type, I-type, and J-type instruction formats.
 */
export class Instruction {
  constructor(
    /** Program counter where this instruction resides */
    public pc: number,
    /** Raw 32-bit instruction data */
    public data: number
  ) {}

  /**
   * Create instruction from memory at given PC
   */
  static fromMemory(memory: Memory, pc: number): Instruction {
    return new Instruction(pc, memory.lw(pc));
  }

  // ============================================
  // Bit extraction helpers
  // ============================================

  private extract(offset: number, length: number): number {
    return BitUtils.extract(this.data, offset, length);
  }

  private extractSigned(offset: number, length: number): number {
    return BitUtils.extractSigned(this.data, offset, length);
  }

  private insert(offset: number, length: number, value: number): void {
    this.data = BitUtils.insert(this.data, offset, length, value);
  }

  // ============================================
  // R-Type instruction fields
  // Encoding: | opcode(6) | rs(5) | rt(5) | rd(5) | sa(5) | func(6) |
  // ============================================

  /** Opcode field (bits 31-26) */
  get opcode(): number { return this.extract(26, 6); }
  set opcode(v: number) { this.insert(26, 6, v); }

  /** Source register (bits 25-21) */
  get rs(): number { return this.extract(21, 5); }
  set rs(v: number) { this.insert(21, 5, v); }

  /** Target register (bits 20-16) */
  get rt(): number { return this.extract(16, 5); }
  set rt(v: number) { this.insert(16, 5, v); }

  /** Destination register (bits 15-11) */
  get rd(): number { return this.extract(11, 5); }
  set rd(v: number) { this.insert(11, 5, v); }

  /** Shift amount (bits 10-6) */
  get sa(): number { return this.extract(6, 5); }
  set sa(v: number) { this.insert(6, 5, v); }

  /** Function field (bits 5-0) */
  get func(): number { return this.extract(0, 6); }
  set func(v: number) { this.insert(0, 6, v); }

  // ============================================
  // I-Type instruction fields
  // Encoding: | opcode(6) | rs(5) | rt(5) | immediate(16) |
  // ============================================

  /** 16-bit signed immediate */
  get imm16(): number { return this.extractSigned(0, 16); }
  set imm16(v: number) { this.insert(0, 16, v & 0xFFFF); }

  /** 16-bit unsigned immediate */
  get uimm16(): number { return this.extract(0, 16); }
  set uimm16(v: number) { this.insert(0, 16, v); }

  // ============================================
  // J-Type instruction fields
  // Encoding: | opcode(6) | target(26) |
  // ============================================

  /** 26-bit jump target */
  get target26(): number { return this.extract(0, 26); }
  set target26(v: number) { this.insert(0, 26, v); }

  // ============================================
  // FPU (Coprocessor 1) fields
  // ============================================

  /** FPU destination register (bits 10-6) */
  get fd(): number { return this.extract(6, 5); }
  set fd(v: number) { this.insert(6, 5, v); }

  /** FPU source register (bits 15-11) */
  get fs(): number { return this.extract(11, 5); }
  set fs(v: number) { this.insert(11, 5, v); }

  /** FPU target register (bits 20-16) */
  get ft(): number { return this.extract(16, 5); }
  set ft(v: number) { this.insert(16, 5, v); }

  // ============================================
  // VFPU fields (PSP specific)
  // ============================================

  /** VFPU destination register (bits 6-0) */
  get vd(): number { return this.extract(0, 7); }
  set vd(v: number) { this.insert(0, 7, v); }

  /** VFPU source register (bits 14-8) */
  get vs(): number { return this.extract(8, 7); }
  set vs(v: number) { this.insert(8, 7, v); }

  /** VFPU target register (bits 22-16) */
  get vt(): number { return this.extract(16, 7); }
  set vt(v: number) { this.insert(16, 7, v); }

  /** VFPU one bit */
  get one(): number { return this.extract(7, 1); }

  /** VFPU two bit */
  get two(): number { return this.extract(15, 1); }

  /** VFPU vector size (1, 2, 3, or 4) */
  get oneTwoSize(): number { return 1 + this.one + 2 * this.two; }

  // ============================================
  // Special fields
  // ============================================

  /** Syscall code (bits 25-6) */
  get syscall(): number { return this.extract(6, 20); }
  set syscall(v: number) { this.insert(6, 20, v); }

  /** Break code (bits 25-6) */
  get breakCode(): number { return this.extract(6, 20); }

  /** LSB for ext/ins instructions */
  get lsb(): number { return this.extract(6, 5); }
  set lsb(v: number) { this.insert(6, 5, v); }

  /** MSB for ext/ins instructions */
  get msb(): number { return this.extract(11, 5); }
  set msb(v: number) { this.insert(11, 5, v); }

  /** Position (alias for lsb) */
  get pos(): number { return this.lsb; }

  /** Size for ext instruction */
  get sizeExt(): number { return this.msb + 1; }

  /** Size for ins instruction */
  get sizeIns(): number { return this.msb - this.lsb + 1; }

  /** COP0 destination register (bits 15-11) */
  get c0dr(): number { return this.extract(11, 5); }
  set c0dr(v: number) { this.insert(11, 5, v); }

  // ============================================
  // Address calculations
  // ============================================

  /**
   * Branch target address (PC + offset * 4 + 4)
   */
  get branchTarget(): number {
    return (this.pc + (this.imm16 << 2) + 4) >>> 0;
  }

  /**
   * Jump target address (PC region | target * 4)
   */
  get jumpTarget(): number {
    return ((this.pc & 0xF0000000) | (this.target26 << 2)) >>> 0;
  }

  // ============================================
  // Utility methods
  // ============================================

  /**
   * Get hexadecimal representation
   */
  toHex(): string {
    return hex(this.data);
  }

  /**
   * Clone this instruction
   */
  clone(): Instruction {
    return new Instruction(this.pc, this.data);
  }
}
