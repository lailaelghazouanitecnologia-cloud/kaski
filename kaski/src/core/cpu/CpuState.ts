import type { Memory } from '../memory';

/**
 * MIPS Register Names
 * Standard MIPS R4000 register naming convention
 */
export const enum Register {
  ZERO = 0,  // Always zero
  AT = 1,    // Assembler temporary
  V0 = 2,    // Function return values
  V1 = 3,
  A0 = 4,    // Function arguments
  A1 = 5,
  A2 = 6,
  A3 = 7,
  T0 = 8,    // Temporaries (caller-saved)
  T1 = 9,
  T2 = 10,
  T3 = 11,
  T4 = 12,
  T5 = 13,
  T6 = 14,
  T7 = 15,
  S0 = 16,   // Saved registers (callee-saved)
  S1 = 17,
  S2 = 18,
  S3 = 19,
  S4 = 20,
  S5 = 21,
  S6 = 22,
  S7 = 23,
  T8 = 24,   // More temporaries
  T9 = 25,
  K0 = 26,   // Kernel registers
  K1 = 27,
  GP = 28,   // Global pointer
  SP = 29,   // Stack pointer
  FP = 30,   // Frame pointer (S8)
  RA = 31,   // Return address
}

/**
 * VFPU Control Register Indices
 */
export const enum VfpuCtrl {
  SPREFIX = 0,
  TPREFIX = 1,
  DPREFIX = 2,
  CC = 3,
  INF4 = 4,
  RSV5 = 5,
  RSV6 = 6,
  REV = 7,
  RCX0 = 8,
  RCX1 = 9,
  RCX2 = 10,
  RCX3 = 11,
  RCX4 = 12,
  RCX5 = 13,
  RCX6 = 14,
  RCX7 = 15,
}

/**
 * Special addresses used by the emulator
 */
export const enum CpuSpecialAddress {
  EXIT_THREAD = 0x01337000,
  EXIT_INTERRUPT = 0x01337004,
}

/**
 * CPU State - Represents the complete state of the MIPS R4000 CPU
 *
 * The PSP uses a MIPS R4000 derivative with:
 * - 32 General Purpose Registers (GPR)
 * - 32 Floating Point Registers (FPR/COP1)
 * - 128 VFPU Registers (PSP specific vector unit)
 * - HI/LO registers for multiplication/division
 * - Program Counter (PC)
 */
export class CpuState {
  private static nextId = 0;

  /** Unique identifier for this CPU state */
  readonly id: number;

  /** Reference to memory */
  memory: Memory;

  // ============================================
  // General Purpose Registers (GPR)
  // ============================================

  /** Buffer for 32 general purpose registers */
  private readonly gprBuffer = new ArrayBuffer(32 * 4);
  /** GPR as signed 32-bit integers */
  readonly gpr = new Int32Array(this.gprBuffer);
  /** GPR as floats (for viewing register as float) */
  private readonly gprFloat = new Float32Array(this.gprBuffer);

  // ============================================
  // Floating Point Registers (FPR / COP1)
  // ============================================

  /** Buffer for 32 floating point registers */
  private readonly fprBuffer = new ArrayBuffer(32 * 4);
  /** FPR as floats */
  readonly fpr = new Float32Array(this.fprBuffer);
  /** FPR as integers (for bit manipulation) */
  readonly fprInt = new Int32Array(this.fprBuffer);

  /** FPU Control Register 0 (Implementation/Revision) */
  fcr0: number = 0x00003351;

  /** FPU Control Register 31 (Control/Status) */
  fcr31: number = 0x00000e00;

  // ============================================
  // VFPU Registers (PSP specific)
  // ============================================

  /** Buffer for 128 VFPU registers (8 matrices of 4x4) */
  private readonly vfprBuffer = new ArrayBuffer(128 * 4);
  /** VFPU registers as floats */
  readonly vfpr = new Float32Array(this.vfprBuffer);
  /** VFPU registers as integers */
  readonly vfprInt = new Int32Array(this.vfprBuffer);

  /** VFPU Control Registers */
  readonly vfprc = new Int32Array([
    0,           // SPREFIX
    0,           // TPREFIX
    0,           // DPREFIX
    0xFF,        // CC
    0,           // INF4
    0,           // RSV5
    0,           // RSV6
    0,           // REV
    0x3F800000,  // RCX0 (1.0f)
    0x3F800000,  // RCX1 (1.0f)
    0x3F800000,  // RCX2 (1.0f)
    0x3F800000,  // RCX3 (1.0f)
    0x3F800000,  // RCX4 (1.0f)
    0x3F800000,  // RCX5 (1.0f)
    0x3F800000,  // RCX6 (1.0f)
    0x3F800000,  // RCX7 (1.0f)
  ]);

  // ============================================
  // Special Registers
  // ============================================

  /** Program Counter */
  pc: number = 0;

  /** Next Program Counter (for branch delay slots) */
  npc: number = 0;

  /** HI register (for multiplication/division) */
  hi: number = 0;

  /** LO register (for multiplication/division) */
  lo: number = 0;

  /** Interrupt Controller 0 */
  ic0: number = 0;

  /** Inside interrupt flag */
  insideInterrupt: boolean = false;

  // ============================================
  // COP0 Registers (System Control)
  // ============================================

  /** COP0 registers (32 registers) */
  readonly cop0 = new Int32Array(32);

  constructor(memory: Memory) {
    this.id = CpuState.nextId++;
    this.memory = memory;

    // Initialize VFPU registers to NaN (undefined state)
    this.vfpr.fill(NaN);
  }

  // ============================================
  // GPR Access (ensuring R0 is always 0)
  // ============================================

  /**
   * Get GPR value (R0 always returns 0)
   */
  getGpr(index: number): number {
    if (index === 0) return 0;
    return this.gpr[index];
  }

  /**
   * Set GPR value (writes to R0 are ignored)
   */
  setGpr(index: number, value: number): void {
    if (index !== 0) {
      this.gpr[index] = value;
    }
  }

  /**
   * Get GPR as unsigned value
   */
  getGprU(index: number): number {
    return this.getGpr(index) >>> 0;
  }

  // ============================================
  // Common Register Aliases
  // ============================================

  get sp(): number { return this.gpr[Register.SP]; }
  set sp(value: number) { this.gpr[Register.SP] = value; }

  get ra(): number { return this.gpr[Register.RA]; }
  set ra(value: number) { this.gpr[Register.RA] = value; }

  get v0(): number { return this.gpr[Register.V0]; }
  set v0(value: number) { this.gpr[Register.V0] = value; }

  get v1(): number { return this.gpr[Register.V1]; }
  set v1(value: number) { this.gpr[Register.V1] = value; }

  get a0(): number { return this.gpr[Register.A0]; }
  set a0(value: number) { this.gpr[Register.A0] = value; }

  get a1(): number { return this.gpr[Register.A1]; }
  set a1(value: number) { this.gpr[Register.A1] = value; }

  get a2(): number { return this.gpr[Register.A2]; }
  set a2(value: number) { this.gpr[Register.A2] = value; }

  get a3(): number { return this.gpr[Register.A3]; }
  set a3(value: number) { this.gpr[Register.A3] = value; }

  get gp(): number { return this.gpr[Register.GP]; }
  set gp(value: number) { this.gpr[Register.GP] = value; }

  // ============================================
  // VFPU Condition Code Operations
  // ============================================

  /**
   * Set VFPU condition code bit
   */
  setVfpuCc(index: number, value: boolean): void {
    if (value) {
      this.vfprc[VfpuCtrl.CC] |= (1 << index);
    } else {
      this.vfprc[VfpuCtrl.CC] &= ~(1 << index);
    }
  }

  /**
   * Get VFPU condition code bit
   */
  getVfpuCc(index: number): boolean
  {
    return (this.vfprc[VfpuCtrl.CC] & (1 << index)) !== 0;
  }

  // ============================================
  // VFPU Vector Access
  // ============================================

  /**
   * Get VFPU register indices for a vector
   *
   * The 128 VFPU registers are organized as 8 matrices of 4x4.
   * Vectors can be rows or columns within these matrices.
   *
   * @param vreg - Vector register number (7 bits)
   * @param size - Vector size (1, 2, 3, or 4)
   * @returns Array of scalar register indices
   */
  getVectorRegs(vreg: number, size: number): number[]
  {
    const matrix = (vreg >> 2) & 7;  // Bits 4-2: matrix number
    const column = vreg & 3;          // Bits 1-0: column
    const row = (vreg >> 5) & 3;      // Bits 6-5: row
    const transpose = (vreg & 0x20) !== 0;  // Bit 5: transposed

    const regs: number[] = [];
    const base = matrix * 16;

    for (let i = 0; i < size; i++)
    {
      if (transpose)
      {
        // Column vector
        regs.push(base + ((row + i) & 3) * 4 + column);
      }
      else
      {
        // Row vector
        regs.push(base + row * 4 + ((column + i) & 3));
      }
    }

    return regs;
  }

  /**
   * Read a VFPU vector as array of floats
   */
  readVector(vreg: number, size: number): Float32Array
  {
    const regs = this.getVectorRegs(vreg, size);
    const result = new Float32Array(size);

    for (let i = 0; i < size; i++)
    {
      result[i] = this.vfpr[regs[i]];
    }

    return result;
  }

  /**
   * Write a VFPU vector from array of floats
   */
  writeVector(vreg: number, size: number, values: Float32Array | number[]): void
  {
    const regs = this.getVectorRegs(vreg, size);

    for (let i = 0; i < size; i++)
    {
      this.vfpr[regs[i]] = values[i];
    }
  }

  // ============================================
  // State Management
  // ============================================

  /**
   * Reset CPU state to initial values
   */
  reset(): void
  {
    this.gpr.fill(0);
    this.fpr.fill(0);
    this.vfpr.fill(NaN);
    this.cop0.fill(0);

    this.pc = 0;
    this.npc = 0;
    this.hi = 0;
    this.lo = 0;
    this.ic0 = 0;
    this.insideInterrupt = false;

    this.fcr0 = 0x00003351;
    this.fcr31 = 0x00000e00;

    // Reset VFPU control registers
    this.vfprc[VfpuCtrl.SPREFIX] = 0;
    this.vfprc[VfpuCtrl.TPREFIX] = 0;
    this.vfprc[VfpuCtrl.DPREFIX] = 0;
    this.vfprc[VfpuCtrl.CC] = 0xFF;
  }

  /**
   * Copy all registers from another CpuState
   */
  copyFrom(other: CpuState): void
  {
    this.gpr.set(other.gpr);
    this.fpr.set(other.fpr);
    this.vfpr.set(other.vfpr);
    this.vfprc.set(other.vfprc);
    this.cop0.set(other.cop0);

    this.pc = other.pc;
    this.npc = other.npc;
    this.hi = other.hi;
    this.lo = other.lo;
    this.ic0 = other.ic0;
    this.fcr0 = other.fcr0;
    this.fcr31 = other.fcr31;
    this.insideInterrupt = other.insideInterrupt;
  }

  /**
   * Clone this CPU state
   */
  clone(): CpuState
  {
    const newState = new CpuState(this.memory);
    newState.copyFrom(this);
    return newState;
  }

  // ============================================
  // Debugging Helpers
  // ============================================

  /**
   * Get register name by index
   */
  static getRegisterName(index: number): string {
    const names = [
      'zero', 'at', 'v0', 'v1', 'a0', 'a1', 'a2', 'a3',
      't0', 't1', 't2', 't3', 't4', 't5', 't6', 't7',
      's0', 's1', 's2', 's3', 's4', 's5', 's6', 's7',
      't8', 't9', 'k0', 'k1', 'gp', 'sp', 'fp', 'ra'
    ];
    return names[index] ?? `r${index}`;
  }

  /**
   * Dump GPR state for debugging
   */
  dumpGpr(): string {
    const lines: string[] = [];
    for (let i = 0; i < 32; i += 4) {
      const regs = [];
      for (let j = 0; j < 4; j++) {
        const idx = i + j;
        const name = CpuState.getRegisterName(idx).padEnd(4);
        const value = (this.gpr[idx] >>> 0).toString(16).padStart(8, '0');
        regs.push(`${name}: 0x${value}`);
      }
      lines.push(regs.join('  '));
    }
    lines.push(`PC: 0x${(this.pc >>> 0).toString(16).padStart(8, '0')}  HI: 0x${(this.hi >>> 0).toString(16).padStart(8, '0')}  LO: 0x${(this.lo >>> 0).toString(16).padStart(8, '0')}`);
    return lines.join('\n');
  }
}
