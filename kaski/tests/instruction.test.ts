import { describe, it, expect, beforeEach } from 'bun:test';
import {
  Instruction,
  BitUtils,
  InstructionType,
  InstructionTable,
  Disassembler,
  disassembler,
  parseFormat,
  AddressType,
  InstructionFlags,
} from '../src/core/cpu';
import { Memory, MAIN_MEMORY_BASE } from '../src/core/memory';

describe('BitUtils', () => {
  describe('extract()', () => {
    it('should extract bits from value', () => {
      // 0xDEADBEEF = 11011110101011011011111011101111
      expect(BitUtils.extract(0xDEADBEEF, 0, 4)).toBe(0xF);   // bits 3-0
      expect(BitUtils.extract(0xDEADBEEF, 4, 4)).toBe(0xE);   // bits 7-4
      expect(BitUtils.extract(0xDEADBEEF, 8, 8)).toBe(0xBE);  // bits 15-8
    });

    it('should handle edge cases', () => {
      // Note: 32-bit extraction is tricky in JS due to bit shift limits
      expect(BitUtils.extract(0xFFFFFFFF, 0, 16)).toBe(0xFFFF);
      expect(BitUtils.extract(0, 0, 8)).toBe(0);
    });
  });

  describe('extractSigned()', () => {
    it('should extract signed value', () => {
      // 0xFFFF as 16-bit signed = -1
      expect(BitUtils.extractSigned(0xFFFF, 0, 16)).toBe(-1);
      // 0x7FFF as 16-bit signed = 32767
      expect(BitUtils.extractSigned(0x7FFF, 0, 16)).toBe(32767);
      // 0x8000 as 16-bit signed = -32768
      expect(BitUtils.extractSigned(0x8000, 0, 16)).toBe(-32768);
    });
  });

  describe('insert()', () => {
    it('should insert bits into value', () => {
      expect(BitUtils.insert(0, 0, 4, 0xF)).toBe(0xF);
      expect(BitUtils.insert(0, 4, 4, 0xF)).toBe(0xF0);
      expect(BitUtils.insert(0xFF, 4, 4, 0xA)).toBe(0xAF);
    });
  });
});

describe('Instruction', () => {
  describe('Field extraction', () => {
    // Example: ADDU $t0, $t1, $t2
    // opcode=0, rs=9(t1), rt=10(t2), rd=8(t0), sa=0, func=0x21
    // Encoding: 000000 01001 01010 01000 00000 100001
    //         = 0x012A4021
    const adduInstr = new Instruction(0x08000000, 0x012A4021);

    it('should extract R-type fields', () => {
      expect(adduInstr.opcode).toBe(0);
      expect(adduInstr.rs).toBe(9);  // t1
      expect(adduInstr.rt).toBe(10); // t2
      expect(adduInstr.rd).toBe(8);  // t0
      expect(adduInstr.sa).toBe(0);
      expect(adduInstr.func).toBe(0x21);
    });

    // Example: ADDIU $t0, $t1, 100
    // opcode=9, rs=9(t1), rt=8(t0), imm=100
    // Encoding: 001001 01001 01000 0000000001100100
    //         = 0x25280064
    const addiuInstr = new Instruction(0x08000000, 0x25280064);

    it('should extract I-type fields', () => {
      expect(addiuInstr.opcode).toBe(9);
      expect(addiuInstr.rs).toBe(9);  // t1
      expect(addiuInstr.rt).toBe(8);  // t0
      expect(addiuInstr.imm16).toBe(100);
      expect(addiuInstr.uimm16).toBe(100);
    });

    it('should handle negative immediate', () => {
      // ADDIU $t0, $t1, -1
      // imm16 = 0xFFFF
      const instr = new Instruction(0, 0x2528FFFF);
      expect(instr.imm16).toBe(-1);
      expect(instr.uimm16).toBe(0xFFFF);
    });

    // Example: J 0x08001000
    // opcode=2, target=0x200400
    const jInstr = new Instruction(0x08000000, 0x08200400);

    it('should extract J-type fields', () => {
      expect(jInstr.opcode).toBe(2);
      expect(jInstr.target26).toBe(0x200400);
    });
  });

  describe('Address calculations', () => {
    it('should calculate branch target', () => {
      // BEQ at 0x08000100, offset = 10 (forward)
      // target = PC + offset*4 + 4 = 0x08000100 + 40 + 4 = 0x0800012C
      const beq = new Instruction(0x08000100, 0x1000000A);
      expect(beq.branchTarget).toBe(0x0800012C);
    });

    it('should calculate negative branch target', () => {
      // BEQ at 0x08000100, offset = -5
      // target = 0x08000100 + (-5)*4 + 4 = 0x08000100 - 20 + 4 = 0x080000F0
      const beq = new Instruction(0x08000100, 0x1000FFFB);
      expect(beq.branchTarget).toBe(0x080000F0);
    });

    it('should calculate jump target', () => {
      // J instruction: target address = (PC & 0xF0000000) | (target26 << 2)
      // 0x08200400 has target26 = 0x200400
      // With PC = 0x80000000: target = 0x80000000 | 0x801000 = 0x80801000
      const j = new Instruction(0x80000000, 0x08200400);
      expect(j.jumpTarget).toBe(0x80801000);
    });
  });

  describe('fromMemory()', () => {
    it('should create instruction from memory', () => {
      const memory = new Memory();
      memory.sw(MAIN_MEMORY_BASE, 0x012A4021);

      const instr = Instruction.fromMemory(memory, MAIN_MEMORY_BASE);
      expect(instr.pc).toBe(MAIN_MEMORY_BASE);
      expect(instr.data).toBe(0x012A4021);
    });
  });
});

describe('parseFormat', () => {
  it('should parse binary patterns', () => {
    const result = parseFormat('000000');
    expect(result.value).toBe(0);
    expect(result.mask).toBe(0b111111);
  });

  it('should handle dont-care bits', () => {
    const result = parseFormat('0000--');
    expect(result.value).toBe(0);
    expect(result.mask).toBe(0b111100);
  });

  it('should handle mixed pattern', () => {
    const result = parseFormat('000010');
    expect(result.value).toBe(0b000010);
    expect(result.mask).toBe(0b111111);
  });

  it('should handle field placeholders', () => {
    // rs is 5 bits, so should shift by 5 and leave 5 bits unmasked
    const result = parseFormat('000000:rs');
    expect(result.value).toBe(0);
    expect(result.mask).toBe(0b11111100000);
  });
});

describe('InstructionTable', () => {
  const table = InstructionTable.instance;

  describe('find()', () => {
    it('should find ADDU instruction', () => {
      // ADDU $t0, $t1, $t2 = 0x012A4021
      const type = table.find(0x012A4021);
      expect(type).not.toBeNull();
      expect(type!.name).toBe('addu');
    });

    it('should find ADDIU instruction', () => {
      // ADDIU $t0, $t1, 100 = 0x25280064
      const type = table.find(0x25280064);
      expect(type).not.toBeNull();
      expect(type!.name).toBe('addiu');
    });

    it('should find J instruction', () => {
      const type = table.find(0x08200400);
      expect(type).not.toBeNull();
      expect(type!.name).toBe('j');
      expect(type!.isJump).toBe(true);
    });

    it('should find JAL instruction', () => {
      const type = table.find(0x0C200400);
      expect(type).not.toBeNull();
      expect(type!.name).toBe('jal');
      expect(type!.isJal).toBe(true);
    });

    it('should find BEQ instruction', () => {
      const type = table.find(0x11090005);
      expect(type).not.toBeNull();
      expect(type!.name).toBe('beq');
      expect(type!.isBranch).toBe(true);
    });

    it('should find LW instruction', () => {
      // LW $t0, 0($t1) = 0x8D280000
      const type = table.find(0x8D280000);
      expect(type).not.toBeNull();
      expect(type!.name).toBe('lw');
    });

    it('should find SW instruction', () => {
      // SW $t0, 0($t1) = 0xAD280000
      const type = table.find(0xAD280000);
      expect(type).not.toBeNull();
      expect(type!.name).toBe('sw');
    });

    it('should find SYSCALL instruction', () => {
      const type = table.find(0x0000000C);
      expect(type).not.toBeNull();
      expect(type!.name).toBe('syscall');
      expect(type!.isSyscall).toBe(true);
    });

    it('should find SLL instruction (NOP is SLL $zero,$zero,0)', () => {
      // NOP in MIPS is encoded as SLL $zero, $zero, 0 = 0x00000000
      const type = table.find(0x00000000);
      expect(type).not.toBeNull();
      // Since SLL is registered before NOP, it matches first
      expect(['nop', 'sll']).toContain(type!.name);
    });
  });

  describe('get()', () => {
    it('should get instruction by name', () => {
      const addu = table.get('addu');
      expect(addu).not.toBeUndefined();
      expect(addu!.name).toBe('addu');
    });

    it('should return undefined for unknown name', () => {
      expect(table.get('nonexistent')).toBeUndefined();
    });
  });
});

describe('Disassembler', () => {
  describe('disassemble()', () => {
    it('should disassemble ADDU', () => {
      const instr = new Instruction(0x08000000, 0x012A4021);
      const result = disassembler.disassemble(instr);

      expect(result.mnemonic).toBe('addu');
      expect(result.operands).toBe('t0, t1, t2');
      expect(result.text).toBe('addu t0, t1, t2');
    });

    it('should disassemble ADDIU', () => {
      const instr = new Instruction(0x08000000, 0x25280064);
      const result = disassembler.disassemble(instr);

      expect(result.mnemonic).toBe('addiu');
      expect(result.operands).toContain('t0');
      expect(result.operands).toContain('t1');
      expect(result.operands).toContain('100');
    });

    it('should disassemble LW with offset', () => {
      // LW $t0, 16($sp) = 0x8FA80010
      const instr = new Instruction(0x08000000, 0x8FA80010);
      const result = disassembler.disassemble(instr);

      expect(result.mnemonic).toBe('lw');
      expect(result.operands).toBe('t0, 16(sp)');
    });

    it('should disassemble J with address', () => {
      const instr = new Instruction(0x08000000, 0x08200400);
      const result = disassembler.disassemble(instr);

      expect(result.mnemonic).toBe('j');
      expect(result.operands).toContain('0x');
    });

    it('should disassemble BEQ with target', () => {
      const instr = new Instruction(0x08000100, 0x1109000A);
      const result = disassembler.disassemble(instr);

      expect(result.mnemonic).toBe('beq');
      expect(result.operands).toContain('0x');
    });

    it('should handle unknown instruction', () => {
      const instr = new Instruction(0, 0xFFFFFFFF);
      const result = disassembler.disassemble(instr);

      expect(result.mnemonic).toBe('???');
      expect(result.type).toBeNull();
    });

    it('should disassemble NOP/SLL', () => {
      const instr = new Instruction(0, 0);
      const result = disassembler.disassemble(instr);

      // NOP is encoded as SLL $zero, $zero, 0
      expect(['nop', 'sll']).toContain(result.mnemonic);
    });
  });

  describe('disassembleRange()', () => {
    it('should disassemble multiple instructions', () => {
      const memory = new Memory();
      memory.sw(MAIN_MEMORY_BASE, 0x00000000);      // nop (sll $zero,$zero,0)
      memory.sw(MAIN_MEMORY_BASE + 4, 0x012A4021);  // addu
      memory.sw(MAIN_MEMORY_BASE + 8, 0x25280064);  // addiu

      const results = disassembler.disassembleRange(memory, MAIN_MEMORY_BASE, 3);

      expect(results).toHaveLength(3);
      expect(['nop', 'sll']).toContain(results[0].mnemonic);
      expect(results[1].mnemonic).toBe('addu');
      expect(results[2].mnemonic).toBe('addiu');
    });
  });
});

describe('InstructionType flags', () => {
  const table = InstructionTable.instance;

  it('should identify branch instructions', () => {
    const beq = table.get('beq')!;
    expect(beq.isBranch).toBe(true);
    expect(beq.hasDelaySlot).toBe(true);
  });

  it('should identify likely branch', () => {
    const beql = table.get('beql')!;
    expect(beql.isBranch).toBe(true);
    expect(beql.isLikely).toBe(true);
  });

  it('should identify jump instructions', () => {
    const j = table.get('j')!;
    expect(j.isJump).toBe(true);
    expect(j.isJumpNoLink).toBe(true);
    expect(j.isJal).toBe(false);
  });

  it('should identify JAL', () => {
    const jal = table.get('jal')!;
    expect(jal.isJal).toBe(true);
    expect(jal.isJump).toBe(true);
    expect(jal.isCall).toBe(true);
  });

  it('should identify register-based jump', () => {
    const jr = table.get('jr')!;
    expect(jr.isJump).toBe(true);
    expect(jr.isRegister).toBe(true);
  });

  it('should identify syscall', () => {
    const syscall = table.get('syscall')!;
    expect(syscall.isSyscall).toBe(true);
  });

  it('should identify PSP-specific instructions', () => {
    const ext = table.get('ext')!;
    expect(ext.isPsp).toBe(true);
  });
});
