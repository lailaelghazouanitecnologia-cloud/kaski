/**
 * Address type for branch/jump instructions
 */
export const enum AddressType {
  /** No address (arithmetic, logic, etc.) */
  NONE = 0,
  /** Register-based address (jr, jalr) */
  REGISTER = 1,
  /** 16-bit offset (branches) */
  OFFSET16 = 2,
  /** 26-bit target (j, jal) */
  TARGET26 = 3,
}

/**
 * Instruction type flags
 */
export const enum InstructionFlags {
  NONE = 0,
  /** PSP-specific instruction */
  PSP = 1 << 0,
  /** Syscall instruction */
  SYSCALL = 1 << 1,
  /** Branch instruction */
  BRANCH = 1 << 2,
  /** Likely branch (nullifies delay slot if not taken) */
  LIKELY = 1 << 3,
  /** Jump and link (function call) */
  JAL = 1 << 4,
  /** Jump (no link) */
  JUMP = 1 << 5,
  /** Break instruction */
  BREAK = 1 << 6,
}

/**
 * Value and mask for instruction matching
 */
export interface ValueMask {
  value: number;
  mask: number;
}

/**
 * Parse an instruction format string into value/mask
 *
 * Format: "bits:field:bits:field..."
 * - bits: 0, 1, or - (don't care)
 * - field: rs, rt, rd, imm16, etc.
 */
export function parseFormat(format: string): ValueMask {
  const fieldSizes: Record<string, number> = {
    // Standard MIPS fields
    rs: 5, rt: 5, rd: 5, sa: 5,
    fs: 5, fd: 5, ft: 5,
    lsb: 5, msb: 5,
    imm5: 5, imm7: 7, imm8: 8,
    imm14: 14, imm16: 16, imm20: 20, imm26: 26,
    // VFPU fields
    vs: 7, vt: 7, vd: 7,
    vt5: 5, vt1: 1, vt2: 2,
    one: 1, two: 1,
    imm3: 3, imm4: 4,
    // Coprocessor fields
    c0dr: 5, c0cr: 5, c1dr: 5, c1cr: 5,
    // Condition
    fcond: 4,
    // VFPU prefix
    cstw: 1, cstz: 1, csty: 1, cstx: 1,
    absw: 1, absz: 1, absy: 1, absx: 1,
    mskw: 1, mskz: 1, msky: 1, mskx: 1,
    negw: 1, negz: 1, negy: 1, negx: 1,
    satw: 2, satz: 2, saty: 2, satx: 2,
    swzw: 2, swzz: 2, swzy: 2, swzx: 2,
  };

  let value = 0;
  let mask = 0;

  for (const part of format.split(':')) {
    if (/^[01-]+$/.test(part)) {
      // Binary pattern
      for (const char of part) {
        value <<= 1;
        mask <<= 1;
        if (char === '0') {
          mask |= 1;
        } else if (char === '1') {
          value |= 1;
          mask |= 1;
        }
        // '-' leaves both as 0 (don't care)
      }
    } else {
      // Field name
      const size = fieldSizes[part];
      if (size === undefined) {
        throw new Error(`Unknown field: ${part}`);
      }
      value <<= size;
      mask <<= size;
    }
  }

  return { value, mask };
}

/**
 * Instruction type definition
 */
export class InstructionType {
  constructor(
    /** Instruction mnemonic */
    public readonly name: string,
    /** Value and mask for matching */
    public readonly vm: ValueMask,
    /** Disassembly format string */
    public readonly format: string,
    /** Address type for branches/jumps */
    public readonly addressType: AddressType,
    /** Instruction flags */
    public readonly flags: InstructionFlags
  ) {}

  /**
   * Check if instruction data matches this type
   */
  match(data: number): boolean {
    return (data & this.vm.mask) === (this.vm.value & this.vm.mask);
  }

  // Flag accessors
  get isPsp(): boolean { return (this.flags & InstructionFlags.PSP) !== 0; }
  get isSyscall(): boolean { return (this.flags & InstructionFlags.SYSCALL) !== 0; }
  get isBranch(): boolean { return (this.flags & InstructionFlags.BRANCH) !== 0; }
  get isLikely(): boolean { return (this.flags & InstructionFlags.LIKELY) !== 0; }
  get isJal(): boolean { return (this.flags & InstructionFlags.JAL) !== 0; }
  get isJump(): boolean { return (this.flags & (InstructionFlags.JAL | InstructionFlags.JUMP)) !== 0; }
  get isJumpNoLink(): boolean { return (this.flags & InstructionFlags.JUMP) !== 0; }
  get isBreak(): boolean { return (this.flags & InstructionFlags.BREAK) !== 0; }
  get isCall(): boolean { return this.isJal; }

  /** Is branch or jump instruction */
  get isJumpOrBranch(): boolean { return this.isBranch || this.isJump; }

  /** Uses register-based addressing */
  get isRegister(): boolean { return this.addressType === AddressType.REGISTER; }

  /** Has a fixed target address (not register) */
  get isFixedAddressJump(): boolean { return this.isJumpOrBranch && !this.isRegister; }

  /** Has a delay slot */
  get hasDelaySlot(): boolean { return this.isJumpOrBranch; }
}

/**
 * Create instruction type helper
 */
export function createInstructionType(
  name: string,
  formatStr: string,
  disasmFormat: string,
  addressType: AddressType = AddressType.NONE,
  flags: InstructionFlags = InstructionFlags.NONE
): InstructionType {
  return new InstructionType(name, parseFormat(formatStr), disasmFormat, addressType, flags);
}
