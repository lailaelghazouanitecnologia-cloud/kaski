import {
  InstructionType,
  createInstructionType,
  AddressType,
  InstructionFlags,
} from './InstructionType';

const { NONE, REGISTER, OFFSET16, TARGET26 } = AddressType;
const { PSP, SYSCALL, BRANCH, LIKELY, JAL, JUMP, BREAK } = InstructionFlags;

/**
 * MIPS Instruction Table
 *
 * Contains all MIPS R4000 and PSP-specific instruction definitions.
 */
export class InstructionTable {
  private static _instance: InstructionTable | null = null;

  /** All instruction types */
  readonly types: InstructionType[] = [];

  /** Instruction types by name */
  readonly byName: Map<string, InstructionType> = new Map();

  private constructor() {
    this.registerAll();
  }

  static get instance(): InstructionTable {
    if (!InstructionTable._instance) {
      InstructionTable._instance = new InstructionTable();
    }
    return InstructionTable._instance;
  }

  private add(
    name: string,
    format: string,
    disasm: string,
    addrType: AddressType = NONE,
    flags: InstructionFlags = InstructionFlags.NONE
  ): void {
    const type = createInstructionType(name, format, disasm, addrType, flags);
    this.types.push(type);
    this.byName.set(name, type);
  }

  /**
   * Find instruction type for given instruction data
   */
  find(data: number): InstructionType | null {
    for (const type of this.types) {
      if (type.match(data)) {
        return type;
      }
    }
    return null;
  }

  /**
   * Get instruction type by name
   */
  get(name: string): InstructionType | undefined {
    return this.byName.get(name);
  }

  private registerAll(): void {
    // ============================================
    // Arithmetic Operations
    // ============================================
    this.add('add',   '000000:rs:rt:rd:00000:100000', '%d, %s, %t');
    this.add('addu',  '000000:rs:rt:rd:00000:100001', '%d, %s, %t');
    this.add('addi',  '001000:rs:rt:imm16',           '%t, %s, %i');
    this.add('addiu', '001001:rs:rt:imm16',           '%t, %s, %i');
    this.add('sub',   '000000:rs:rt:rd:00000:100010', '%d, %s, %t');
    this.add('subu',  '000000:rs:rt:rd:00000:100011', '%d, %s, %t');

    // ============================================
    // Logical Operations
    // ============================================
    this.add('and',  '000000:rs:rt:rd:00000:100100', '%d, %s, %t');
    this.add('andi', '001100:rs:rt:imm16',           '%t, %s, %I');
    this.add('nor',  '000000:rs:rt:rd:00000:100111', '%d, %s, %t');
    this.add('or',   '000000:rs:rt:rd:00000:100101', '%d, %s, %t');
    this.add('ori',  '001101:rs:rt:imm16',           '%t, %s, %I');
    this.add('xor',  '000000:rs:rt:rd:00000:100110', '%d, %s, %t');
    this.add('xori', '001110:rs:rt:imm16',           '%t, %s, %I');

    // ============================================
    // Shift Operations
    // ============================================
    this.add('sll',   '000000:00000:rt:rd:sa:000000', '%d, %t, %a');
    this.add('sllv',  '000000:rs:rt:rd:00000:000100', '%d, %t, %s');
    this.add('sra',   '000000:00000:rt:rd:sa:000011', '%d, %t, %a');
    this.add('srav',  '000000:rs:rt:rd:00000:000111', '%d, %t, %s');
    this.add('srl',   '000000:00000:rt:rd:sa:000010', '%d, %t, %a');
    this.add('srlv',  '000000:rs:rt:rd:00000:000110', '%d, %t, %s');
    this.add('rotr',  '000000:00001:rt:rd:sa:000010', '%d, %t, %a', NONE, PSP);
    this.add('rotrv', '000000:rs:rt:rd:00001:000110', '%d, %t, %s', NONE, PSP);

    // ============================================
    // Comparison Operations
    // ============================================
    this.add('slt',   '000000:rs:rt:rd:00000:101010', '%d, %s, %t');
    this.add('slti',  '001010:rs:rt:imm16',           '%t, %s, %i');
    this.add('sltu',  '000000:rs:rt:rd:00000:101011', '%d, %s, %t');
    this.add('sltiu', '001011:rs:rt:imm16',           '%t, %s, %i');

    // ============================================
    // Load Upper Immediate
    // ============================================
    this.add('lui', '001111:00000:rt:imm16', '%t, %I');

    // ============================================
    // Sign Extend (PSP)
    // ============================================
    this.add('seb', '011111:00000:rt:rd:10000:100000', '%d, %t', NONE, PSP);
    this.add('seh', '011111:00000:rt:rd:11000:100000', '%d, %t', NONE, PSP);

    // ============================================
    // Bit Operations (PSP)
    // ============================================
    this.add('bitrev', '011111:00000:rt:rd:10100:100000', '%d, %t', NONE, PSP);
    this.add('max',    '000000:rs:rt:rd:00000:101100',    '%d, %s, %t', NONE, PSP);
    this.add('min',    '000000:rs:rt:rd:00000:101101',    '%d, %s, %t', NONE, PSP);
    this.add('ext',    '011111:rs:rt:msb:lsb:000000',     '%t, %s, %a, %ne', NONE, PSP);
    this.add('ins',    '011111:rs:rt:msb:lsb:000100',     '%t, %s, %a, %ni', NONE, PSP);
    this.add('clz',    '000000:rs:00000:rd:00000:010110', '%d, %s', NONE, PSP);
    this.add('clo',    '000000:rs:00000:rd:00000:010111', '%d, %s', NONE, PSP);
    this.add('wsbh',   '011111:00000:rt:rd:00010:100000', '%d, %t', NONE, PSP);
    this.add('wsbw',   '011111:00000:rt:rd:00011:100000', '%d, %t', NONE, PSP);

    // ============================================
    // Multiply/Divide
    // ============================================
    this.add('div',   '000000:rs:rt:00000:00000:011010', '%s, %t');
    this.add('divu',  '000000:rs:rt:00000:00000:011011', '%s, %t');
    this.add('mult',  '000000:rs:rt:00000:00000:011000', '%s, %t');
    this.add('multu', '000000:rs:rt:00000:00000:011001', '%s, %t');
    this.add('madd',  '000000:rs:rt:00000:00000:011100', '%s, %t', NONE, PSP);
    this.add('maddu', '000000:rs:rt:00000:00000:011101', '%s, %t', NONE, PSP);
    this.add('msub',  '000000:rs:rt:00000:00000:101110', '%s, %t', NONE, PSP);
    this.add('msubu', '000000:rs:rt:00000:00000:101111', '%s, %t', NONE, PSP);

    // ============================================
    // Move HI/LO
    // ============================================
    this.add('mfhi', '000000:00000:00000:rd:00000:010000', '%d');
    this.add('mflo', '000000:00000:00000:rd:00000:010010', '%d');
    this.add('mthi', '000000:rs:00000:00000:00000:010001', '%s');
    this.add('mtlo', '000000:rs:00000:00000:00000:010011', '%s');

    // ============================================
    // Conditional Move (PSP)
    // ============================================
    this.add('movz', '000000:rs:rt:rd:00000:001010', '%d, %s, %t', NONE, PSP);
    this.add('movn', '000000:rs:rt:rd:00000:001011', '%d, %s, %t', NONE, PSP);

    // ============================================
    // Branch Instructions
    // ============================================
    this.add('beq',     '000100:rs:rt:imm16',       '%s, %t, %O', OFFSET16, BRANCH);
    this.add('beql',    '010100:rs:rt:imm16',       '%s, %t, %O', OFFSET16, BRANCH | LIKELY);
    this.add('bne',     '000101:rs:rt:imm16',       '%s, %t, %O', OFFSET16, BRANCH);
    this.add('bnel',    '010101:rs:rt:imm16',       '%s, %t, %O', OFFSET16, BRANCH | LIKELY);
    this.add('bgez',    '000001:rs:00001:imm16',    '%s, %O',     OFFSET16, BRANCH);
    this.add('bgezl',   '000001:rs:00011:imm16',    '%s, %O',     OFFSET16, BRANCH | LIKELY);
    this.add('bgezal',  '000001:rs:10001:imm16',    '%s, %O',     OFFSET16, JAL);
    this.add('bgezall', '000001:rs:10011:imm16',    '%s, %O',     OFFSET16, JAL | LIKELY);
    this.add('bgtz',    '000111:rs:00000:imm16',    '%s, %O',     OFFSET16, BRANCH);
    this.add('bgtzl',   '010111:rs:00000:imm16',    '%s, %O',     OFFSET16, BRANCH | LIKELY);
    this.add('blez',    '000110:rs:00000:imm16',    '%s, %O',     OFFSET16, BRANCH);
    this.add('blezl',   '010110:rs:00000:imm16',    '%s, %O',     OFFSET16, BRANCH | LIKELY);
    this.add('bltz',    '000001:rs:00000:imm16',    '%s, %O',     OFFSET16, BRANCH);
    this.add('bltzl',   '000001:rs:00010:imm16',    '%s, %O',     OFFSET16, BRANCH | LIKELY);
    this.add('bltzal',  '000001:rs:10000:imm16',    '%s, %O',     OFFSET16, JAL);
    this.add('bltzall', '000001:rs:10010:imm16',    '%s, %O',     OFFSET16, JAL | LIKELY);

    // ============================================
    // Jump Instructions
    // ============================================
    this.add('j',    '000010:imm26',                   '%J',     TARGET26, JUMP);
    this.add('jal',  '000011:imm26',                   '%J',     TARGET26, JAL);
    this.add('jr',   '000000:rs:00000:00000:00000:001000', '%s', REGISTER, JUMP);
    this.add('jalr', '000000:rs:00000:rd:00000:001001',    '%d, %s', REGISTER, JAL);

    // ============================================
    // Load Instructions
    // ============================================
    this.add('lb',  '100000:rs:rt:imm16', '%t, %o');
    this.add('lbu', '100100:rs:rt:imm16', '%t, %o');
    this.add('lh',  '100001:rs:rt:imm16', '%t, %o');
    this.add('lhu', '100101:rs:rt:imm16', '%t, %o');
    this.add('lw',  '100011:rs:rt:imm16', '%t, %o');
    this.add('lwl', '100010:rs:rt:imm16', '%t, %o');
    this.add('lwr', '100110:rs:rt:imm16', '%t, %o');

    // ============================================
    // Store Instructions
    // ============================================
    this.add('sb',  '101000:rs:rt:imm16', '%t, %o');
    this.add('sh',  '101001:rs:rt:imm16', '%t, %o');
    this.add('sw',  '101011:rs:rt:imm16', '%t, %o');
    this.add('swl', '101010:rs:rt:imm16', '%t, %o');
    this.add('swr', '101110:rs:rt:imm16', '%t, %o');

    // ============================================
    // Coprocessor Load/Store
    // ============================================
    this.add('lwc1', '110001:rs:ft:imm16', '%T, %o');
    this.add('swc1', '111001:rs:ft:imm16', '%T, %o');

    // ============================================
    // System Instructions
    // ============================================
    this.add('syscall', '000000:imm20:001100', '', NONE, SYSCALL);
    this.add('break',   '000000:imm20:001101', '', NONE, BREAK);

    // ============================================
    // Special
    // ============================================
    this.add('nop', '000000:00000:00000:00000:00000:000000', '');
    this.add('sync', '000000:00000:00000:00000:00000:001111', '');

    // ============================================
    // FPU Operations (basic)
    // ============================================
    this.add('mfc1', '010001:00000:rt:fs:00000:000000', '%t, %S');
    this.add('mtc1', '010001:00100:rt:fs:00000:000000', '%t, %S');
    this.add('cfc1', '010001:00010:rt:fs:00000:000000', '%t, %S');
    this.add('ctc1', '010001:00110:rt:fs:00000:000000', '%t, %S');

    this.add('add.s',  '010001:10000:ft:fs:fd:000000', '%D, %S, %T');
    this.add('sub.s',  '010001:10000:ft:fs:fd:000001', '%D, %S, %T');
    this.add('mul.s',  '010001:10000:ft:fs:fd:000010', '%D, %S, %T');
    this.add('div.s',  '010001:10000:ft:fs:fd:000011', '%D, %S, %T');
    this.add('sqrt.s', '010001:10000:00000:fs:fd:000100', '%D, %S');
    this.add('abs.s',  '010001:10000:00000:fs:fd:000101', '%D, %S');
    this.add('mov.s',  '010001:10000:00000:fs:fd:000110', '%D, %S');
    this.add('neg.s',  '010001:10000:00000:fs:fd:000111', '%D, %S');

    this.add('trunc.w.s',  '010001:10000:00000:fs:fd:001101', '%D, %S');
    this.add('round.w.s',  '010001:10000:00000:fs:fd:001100', '%D, %S');
    this.add('ceil.w.s',   '010001:10000:00000:fs:fd:001110', '%D, %S');
    this.add('floor.w.s',  '010001:10000:00000:fs:fd:001111', '%D, %S');
    this.add('cvt.s.w',    '010001:10100:00000:fs:fd:100000', '%D, %S');
    this.add('cvt.w.s',    '010001:10000:00000:fs:fd:100100', '%D, %S');

    // FPU comparison
    this.add('c.eq.s',  '010001:10000:ft:fs:00000:110010', '%S, %T');
    this.add('c.lt.s',  '010001:10000:ft:fs:00000:111100', '%S, %T');
    this.add('c.le.s',  '010001:10000:ft:fs:00000:111110', '%S, %T');

    // FPU branches
    this.add('bc1f',  '010001:01000:00000:imm16', '%O', OFFSET16, BRANCH);
    this.add('bc1t',  '010001:01000:00001:imm16', '%O', OFFSET16, BRANCH);
    this.add('bc1fl', '010001:01000:00010:imm16', '%O', OFFSET16, BRANCH | LIKELY);
    this.add('bc1tl', '010001:01000:00011:imm16', '%O', OFFSET16, BRANCH | LIKELY);
  }
}
