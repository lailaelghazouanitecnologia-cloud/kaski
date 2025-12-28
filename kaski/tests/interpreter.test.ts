import { describe, it, expect, beforeEach } from 'bun:test';
import { CpuState, Instruction, Interpreter, ExecutionResult } from '../src/core/cpu';
import { Memory, MAIN_MEMORY_BASE } from '../src/core/memory';

describe('Interpreter', () => {
  let memory: Memory;
  let cpu: CpuState;
  let interpreter: Interpreter;

  beforeEach(() => {
    memory = new Memory();
    cpu = new CpuState(memory);
    interpreter = new Interpreter();
    cpu.pc = MAIN_MEMORY_BASE;
  });

  // Helper to execute a single instruction
  function exec(data: number): ExecutionResult {
    const instr = new Instruction(cpu.pc, data);
    return interpreter.execute(cpu, instr);
  }

  describe('Arithmetic Operations', () => {
    it('should execute ADD', () => {
      cpu.setGpr(8, 10);  // t0 = 10
      cpu.setGpr(9, 20);  // t1 = 20
      // ADD $t2, $t0, $t1 (rd=10, rs=8, rt=9)
      // 000000 01000 01001 01010 00000 100000
      exec(0x01095020);
      expect(cpu.getGpr(10)).toBe(30);
    });

    it('should execute ADDU', () => {
      cpu.setGpr(8, 0xFFFFFFFF);  // t0 = -1
      cpu.setGpr(9, 2);           // t1 = 2
      // ADDU $t2, $t0, $t1
      exec(0x01095021);
      expect(cpu.getGpr(10)).toBe(1);
    });

    it('should execute ADDI', () => {
      cpu.setGpr(8, 100);  // t0 = 100
      // ADDI $t1, $t0, -50
      // 001000 01000 01001 1111111111001110
      exec(0x2109FFCE);
      expect(cpu.getGpr(9)).toBe(50);
    });

    it('should execute ADDIU', () => {
      cpu.setGpr(8, 100);  // t0 = 100
      // ADDIU $t1, $t0, 50
      exec(0x25090032);
      expect(cpu.getGpr(9)).toBe(150);
    });

    it('should execute SUB', () => {
      cpu.setGpr(8, 50);   // t0 = 50
      cpu.setGpr(9, 20);   // t1 = 20
      // SUB $t2, $t0, $t1
      exec(0x01095022);
      expect(cpu.getGpr(10)).toBe(30);
    });

    it('should execute SUBU', () => {
      cpu.setGpr(8, 10);   // t0 = 10
      cpu.setGpr(9, 20);   // t1 = 20
      // SUBU $t2, $t0, $t1
      exec(0x01095023);
      expect(cpu.getGpr(10)).toBe(-10);
    });

    it('should execute LUI', () => {
      // LUI $t0, 0x1234
      // 001111 00000 01000 0001001000110100
      exec(0x3C081234);
      expect(cpu.getGprU(8)).toBe(0x12340000);
    });
  });

  describe('Logical Operations', () => {
    it('should execute AND', () => {
      cpu.setGpr(8, 0xFF00FF00);
      cpu.setGpr(9, 0x0F0F0F0F);
      // AND $t2, $t0, $t1
      exec(0x01095024);
      expect(cpu.getGprU(10)).toBe(0x0F000F00);
    });

    it('should execute ANDI', () => {
      cpu.setGpr(8, 0xFF00FF00);
      // ANDI $t1, $t0, 0x00FF
      exec(0x310900FF);
      expect(cpu.getGprU(9)).toBe(0x0000FF00 & 0x00FF);
    });

    it('should execute OR', () => {
      cpu.setGpr(8, 0xFF00FF00);
      cpu.setGpr(9, 0x00FF00FF);
      // OR $t2, $t0, $t1
      exec(0x01095025);
      expect(cpu.getGprU(10)).toBe(0xFFFFFFFF);
    });

    it('should execute ORI', () => {
      cpu.setGpr(8, 0xFF000000);
      // ORI $t1, $t0, 0x00FF
      exec(0x350900FF);
      expect(cpu.getGprU(9)).toBe(0xFF0000FF);
    });

    it('should execute XOR', () => {
      cpu.setGpr(8, 0xFF00FF00);
      cpu.setGpr(9, 0xFFFF0000);
      // XOR $t2, $t0, $t1
      exec(0x01095026);
      expect(cpu.getGprU(10)).toBe(0x00FFFF00);
    });

    it('should execute NOR', () => {
      cpu.setGpr(8, 0xFF000000);
      cpu.setGpr(9, 0x00FF0000);
      // NOR $t2, $t0, $t1
      exec(0x01095027);
      expect(cpu.getGprU(10)).toBe(0x0000FFFF);
    });
  });

  describe('Shift Operations', () => {
    it('should execute SLL', () => {
      cpu.setGpr(9, 1);  // t1 = 1
      // SLL $t2, $t1, 4
      // 000000 00000 01001 01010 00100 000000
      exec(0x00095100);
      expect(cpu.getGpr(10)).toBe(16);
    });

    it('should execute SRL', () => {
      cpu.setGpr(9, 256);  // t1 = 256
      // SRL $t2, $t1, 4
      exec(0x00095102);
      expect(cpu.getGpr(10)).toBe(16);
    });

    it('should execute SRA (positive)', () => {
      cpu.setGpr(9, 256);  // t1 = 256
      // SRA $t2, $t1, 4
      exec(0x00095103);
      expect(cpu.getGpr(10)).toBe(16);
    });

    it('should execute SRA (negative)', () => {
      cpu.setGpr(9, -256);  // t1 = -256
      // SRA $t2, $t1, 4
      exec(0x00095103);
      expect(cpu.getGpr(10)).toBe(-16);
    });

    it('should execute SLLV', () => {
      cpu.setGpr(8, 4);   // t0 = 4 (shift amount)
      cpu.setGpr(9, 1);   // t1 = 1
      // SLLV $t2, $t1, $t0
      exec(0x01095004);
      expect(cpu.getGpr(10)).toBe(16);
    });

    it('should execute SRLV', () => {
      cpu.setGpr(8, 4);    // t0 = 4 (shift amount)
      cpu.setGpr(9, 256);  // t1 = 256
      // SRLV $t2, $t1, $t0
      exec(0x01095006);
      expect(cpu.getGpr(10)).toBe(16);
    });
  });

  describe('Comparison Operations', () => {
    it('should execute SLT (less)', () => {
      cpu.setGpr(8, 5);
      cpu.setGpr(9, 10);
      // SLT $t2, $t0, $t1
      exec(0x0109502A);
      expect(cpu.getGpr(10)).toBe(1);
    });

    it('should execute SLT (not less)', () => {
      cpu.setGpr(8, 10);
      cpu.setGpr(9, 5);
      // SLT $t2, $t0, $t1
      exec(0x0109502A);
      expect(cpu.getGpr(10)).toBe(0);
    });

    it('should execute SLTU (unsigned)', () => {
      cpu.setGpr(8, -1);  // Large unsigned
      cpu.setGpr(9, 5);
      // SLTU $t2, $t0, $t1
      exec(0x0109502B);
      expect(cpu.getGpr(10)).toBe(0);  // -1 unsigned > 5
    });

    it('should execute SLTI', () => {
      cpu.setGpr(8, 5);
      // SLTI $t1, $t0, 10
      exec(0x2909000A);
      expect(cpu.getGpr(9)).toBe(1);
    });
  });

  describe('Multiply/Divide', () => {
    it('should execute MULT', () => {
      cpu.setGpr(8, 100);
      cpu.setGpr(9, 200);
      // MULT $t0, $t1
      exec(0x01090018);
      expect(cpu.lo).toBe(20000);
      expect(cpu.hi).toBe(0);
    });

    it('should execute MULT (64-bit result)', () => {
      cpu.setGpr(8, 0x10000);
      cpu.setGpr(9, 0x10000);
      // MULT $t0, $t1
      exec(0x01090018);
      expect(cpu.lo).toBe(0);
      expect(cpu.hi).toBe(1);
    });

    it('should execute MULTU', () => {
      cpu.setGpr(8, 100);
      cpu.setGpr(9, 200);
      // MULTU $t0, $t1
      exec(0x01090019);
      expect(cpu.lo).toBe(20000);
    });

    it('should execute DIV', () => {
      cpu.setGpr(8, 100);
      cpu.setGpr(9, 7);
      // DIV $t0, $t1
      exec(0x0109001A);
      expect(cpu.lo).toBe(14);  // Quotient
      expect(cpu.hi).toBe(2);   // Remainder
    });

    it('should execute DIVU', () => {
      cpu.setGpr(8, 100);
      cpu.setGpr(9, 7);
      // DIVU $t0, $t1
      exec(0x0109001B);
      expect(cpu.lo).toBe(14);
      expect(cpu.hi).toBe(2);
    });

    it('should execute MFHI/MFLO', () => {
      cpu.hi = 0x12345678;
      cpu.lo = 0xDEADBEEF;
      // MFHI $t0
      exec(0x00004010);
      expect(cpu.getGprU(8)).toBe(0x12345678);
      // MFLO $t1
      exec(0x00004812);
      expect(cpu.getGprU(9)).toBe(0xDEADBEEF);
    });

    it('should execute MTHI/MTLO', () => {
      cpu.setGpr(8, 0x12345678);
      cpu.setGpr(9, 0xDEADBEEF);
      // MTHI $t0
      exec(0x01000011);
      expect(cpu.hi).toBe(0x12345678);
      // MTLO $t1
      exec(0x01200013);
      expect(cpu.lo).toBe(0xDEADBEEF | 0);
    });
  });

  describe('Load/Store Operations', () => {
    it('should execute LW', () => {
      memory.sw(MAIN_MEMORY_BASE + 0x100, 0xDEADBEEF);
      cpu.setGpr(8, MAIN_MEMORY_BASE);
      // LW $t1, 0x100($t0)
      exec(0x8D090100);
      expect(cpu.getGprU(9)).toBe(0xDEADBEEF);
    });

    it('should execute SW', () => {
      cpu.setGpr(8, MAIN_MEMORY_BASE);
      cpu.setGpr(9, 0xCAFEBABE);
      // SW $t1, 0x100($t0)
      exec(0xAD090100);
      expect(memory.lw(MAIN_MEMORY_BASE + 0x100)).toBe(0xCAFEBABE | 0);
    });

    it('should execute LB (signed)', () => {
      memory.sb(MAIN_MEMORY_BASE + 0x100, 0xFF);  // -1 as signed byte
      cpu.setGpr(8, MAIN_MEMORY_BASE);
      // LB $t1, 0x100($t0)
      exec(0x81090100);
      expect(cpu.getGpr(9)).toBe(-1);
    });

    it('should execute LBU (unsigned)', () => {
      memory.sb(MAIN_MEMORY_BASE + 0x100, 0xFF);
      cpu.setGpr(8, MAIN_MEMORY_BASE);
      // LBU $t1, 0x100($t0)
      exec(0x91090100);
      expect(cpu.getGpr(9)).toBe(255);
    });

    it('should execute LH', () => {
      memory.sh(MAIN_MEMORY_BASE + 0x100, 0xFFFF);  // -1 as signed halfword
      cpu.setGpr(8, MAIN_MEMORY_BASE);
      // LH $t1, 0x100($t0)
      exec(0x85090100);
      expect(cpu.getGpr(9)).toBe(-1);
    });

    it('should execute LHU', () => {
      memory.sh(MAIN_MEMORY_BASE + 0x100, 0xFFFF);
      cpu.setGpr(8, MAIN_MEMORY_BASE);
      // LHU $t1, 0x100($t0)
      exec(0x95090100);
      expect(cpu.getGpr(9)).toBe(0xFFFF);
    });

    it('should execute SB', () => {
      cpu.setGpr(8, MAIN_MEMORY_BASE);
      cpu.setGpr(9, 0xABCD);
      // SB $t1, 0x100($t0)
      exec(0xA1090100);
      expect(memory.lbu(MAIN_MEMORY_BASE + 0x100)).toBe(0xCD);
    });

    it('should execute SH', () => {
      cpu.setGpr(8, MAIN_MEMORY_BASE);
      cpu.setGpr(9, 0xABCDEF12);
      // SH $t1, 0x100($t0)
      exec(0xA5090100);
      expect(memory.lhu(MAIN_MEMORY_BASE + 0x100)).toBe(0xEF12);
    });
  });

  describe('Branch Operations', () => {
    it('should execute BEQ (taken)', () => {
      cpu.setGpr(8, 10);
      cpu.setGpr(9, 10);
      cpu.pc = MAIN_MEMORY_BASE;
      // BEQ $t0, $t1, +4 (skip next instr)
      // Delay slot has NOP
      memory.sw(MAIN_MEMORY_BASE, 0x11090004);     // BEQ
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000); // NOP
      const result = interpreter.step(cpu);
      expect(result).toBe(ExecutionResult.BRANCH);
      expect(cpu.pc).toBe(MAIN_MEMORY_BASE + 0x14);  // PC + (4 << 2) + 4
    });

    it('should execute BEQ (not taken)', () => {
      cpu.setGpr(8, 10);
      cpu.setGpr(9, 20);
      cpu.pc = MAIN_MEMORY_BASE;
      memory.sw(MAIN_MEMORY_BASE, 0x11090004);
      const result = interpreter.step(cpu);
      expect(result).toBe(ExecutionResult.CONTINUE);
      expect(cpu.pc).toBe(MAIN_MEMORY_BASE + 4);
    });

    it('should execute BNE (taken)', () => {
      cpu.setGpr(8, 10);
      cpu.setGpr(9, 20);
      cpu.pc = MAIN_MEMORY_BASE;
      memory.sw(MAIN_MEMORY_BASE, 0x15090002);     // BNE +2
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000); // NOP
      const result = interpreter.step(cpu);
      expect(result).toBe(ExecutionResult.BRANCH);
      expect(cpu.pc).toBe(MAIN_MEMORY_BASE + 0x0C);
    });

    it('should execute BGTZ (taken)', () => {
      cpu.setGpr(8, 10);
      cpu.pc = MAIN_MEMORY_BASE;
      memory.sw(MAIN_MEMORY_BASE, 0x1D000002);     // BGTZ $t0, +2
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000); // NOP
      const result = interpreter.step(cpu);
      expect(result).toBe(ExecutionResult.BRANCH);
      expect(cpu.pc).toBe(MAIN_MEMORY_BASE + 0x0C);
    });

    it('should execute BLEZ (taken)', () => {
      cpu.setGpr(8, -10);
      cpu.pc = MAIN_MEMORY_BASE;
      memory.sw(MAIN_MEMORY_BASE, 0x19000002);     // BLEZ $t0, +2
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000); // NOP
      const result = interpreter.step(cpu);
      expect(result).toBe(ExecutionResult.BRANCH);
    });

    it('should execute BGEZ (taken)', () => {
      cpu.setGpr(8, 0);
      cpu.pc = MAIN_MEMORY_BASE;
      memory.sw(MAIN_MEMORY_BASE, 0x05010002);     // BGEZ $t0, +2
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000); // NOP
      const result = interpreter.step(cpu);
      expect(result).toBe(ExecutionResult.BRANCH);
    });

    it('should execute BLTZ (taken)', () => {
      cpu.setGpr(8, -10);
      cpu.pc = MAIN_MEMORY_BASE;
      memory.sw(MAIN_MEMORY_BASE, 0x05000002);     // BLTZ $t0, +2
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000); // NOP
      const result = interpreter.step(cpu);
      expect(result).toBe(ExecutionResult.BRANCH);
    });
  });

  describe('Jump Operations', () => {
    it('should execute J', () => {
      cpu.pc = MAIN_MEMORY_BASE;
      // J to address 0x08001000
      // target26 = 0x200400
      memory.sw(MAIN_MEMORY_BASE, 0x08200400);     // J
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000); // NOP (delay slot)
      const result = interpreter.step(cpu);
      expect(result).toBe(ExecutionResult.BRANCH);
      expect(cpu.pc).toBe(0x00801000);
    });

    it('should execute JAL', () => {
      cpu.pc = MAIN_MEMORY_BASE;
      memory.sw(MAIN_MEMORY_BASE, 0x0C200400);     // JAL
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000); // NOP
      const result = interpreter.step(cpu);
      expect(result).toBe(ExecutionResult.BRANCH);
      expect(cpu.ra).toBe(MAIN_MEMORY_BASE + 8);
    });

    it('should execute JR', () => {
      cpu.pc = MAIN_MEMORY_BASE;
      cpu.setGpr(8, MAIN_MEMORY_BASE + 0x100);
      memory.sw(MAIN_MEMORY_BASE, 0x01000008);     // JR $t0
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000); // NOP
      const result = interpreter.step(cpu);
      expect(result).toBe(ExecutionResult.BRANCH);
      expect(cpu.pc).toBe(MAIN_MEMORY_BASE + 0x100);
    });

    it('should execute JALR', () => {
      cpu.pc = MAIN_MEMORY_BASE;
      cpu.setGpr(8, MAIN_MEMORY_BASE + 0x100);
      // JALR $t1, $t0 (rd=9, rs=8)
      memory.sw(MAIN_MEMORY_BASE, 0x01004809);     // JALR $t1, $t0
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000); // NOP
      const result = interpreter.step(cpu);
      expect(result).toBe(ExecutionResult.BRANCH);
      expect(cpu.pc).toBe(MAIN_MEMORY_BASE + 0x100);
      expect(cpu.getGpr(9)).toBe(MAIN_MEMORY_BASE + 8);  // Return address
    });
  });

  describe('System Operations', () => {
    it('should execute SYSCALL', () => {
      const result = exec(0x0000000C);
      expect(result).toBe(ExecutionResult.SYSCALL);
    });

    it('should execute BREAK', () => {
      const result = exec(0x0000000D);
      expect(result).toBe(ExecutionResult.BREAK);
    });

    it('should execute NOP', () => {
      const result = exec(0x00000000);
      expect(result).toBe(ExecutionResult.CONTINUE);
    });

    it('should execute SYNC', () => {
      const result = exec(0x0000000F);
      expect(result).toBe(ExecutionResult.CONTINUE);
    });
  });

  describe('PSP-specific Operations', () => {
    it('should execute EXT', () => {
      cpu.setGpr(8, 0xABCDEF12);
      // EXT $t1, $t0, 4, 8  (extract 8 bits starting at bit 4)
      // lsb=4, msbd=7 (size-1)
      // 011111 01000 01001 00111 00100 000000
      exec(0x7D093900);
      expect(cpu.getGprU(9)).toBe(0xF1);
    });

    it('should execute SEB (sign extend byte)', () => {
      cpu.setGpr(9, 0x000000FF);  // -1 as unsigned byte
      // SEB $t0, $t1
      exec(0x7C094420);
      expect(cpu.getGpr(8)).toBe(-1);
    });

    it('should execute SEH (sign extend halfword)', () => {
      cpu.setGpr(9, 0x0000FFFF);  // -1 as unsigned halfword
      // SEH $t0, $t1
      exec(0x7C094620);
      expect(cpu.getGpr(8)).toBe(-1);
    });

    it('should execute CLZ', () => {
      cpu.setGpr(8, 0x00FF0000);
      // CLZ $t1, $t0
      // 000000 01000 00000 01001 00000 010110
      exec(0x01004816);
      expect(cpu.getGpr(9)).toBe(8);
    });

    it('should execute MAX', () => {
      cpu.setGpr(8, 10);
      cpu.setGpr(9, 20);
      // MAX $t2, $t0, $t1
      exec(0x0109502C);
      expect(cpu.getGpr(10)).toBe(20);
    });

    it('should execute MIN', () => {
      cpu.setGpr(8, 10);
      cpu.setGpr(9, 20);
      // MIN $t2, $t0, $t1
      exec(0x0109502D);
      expect(cpu.getGpr(10)).toBe(10);
    });

    it('should execute MOVZ (condition met)', () => {
      cpu.setGpr(8, 100);
      cpu.setGpr(9, 0);
      cpu.setGpr(10, 0);
      // MOVZ $t2, $t0, $t1 (if t1==0, t2=t0)
      exec(0x0109500A);
      expect(cpu.getGpr(10)).toBe(100);
    });

    it('should execute MOVZ (condition not met)', () => {
      cpu.setGpr(8, 100);
      cpu.setGpr(9, 1);
      cpu.setGpr(10, 50);
      // MOVZ $t2, $t0, $t1
      exec(0x0109500A);
      expect(cpu.getGpr(10)).toBe(50);  // Unchanged
    });

    it('should execute MOVN (condition met)', () => {
      cpu.setGpr(8, 100);
      cpu.setGpr(9, 1);
      cpu.setGpr(10, 0);
      // MOVN $t2, $t0, $t1 (if t1!=0, t2=t0)
      exec(0x0109500B);
      expect(cpu.getGpr(10)).toBe(100);
    });

    it('should execute WSBH', () => {
      cpu.setGpr(9, 0x12345678);
      // WSBH $t0, $t1 (swap bytes within halfwords)
      exec(0x7C0940A0);
      expect(cpu.getGprU(8)).toBe(0x34127856);
    });

    it('should execute WSBW (byte swap word)', () => {
      cpu.setGpr(9, 0x12345678);
      // WSBW $t0, $t1
      exec(0x7C0940E0);
      expect(cpu.getGprU(8)).toBe(0x78563412);
    });

    it('should execute ROTR', () => {
      cpu.setGpr(9, 0x80000001);
      // ROTR $t0, $t1, 1
      exec(0x00294042);
      expect(cpu.getGprU(8)).toBe(0xC0000000);
    });
  });

  describe('FPU Operations', () => {
    it('should execute MFC1/MTC1', () => {
      // MTC1 $t0, $f0 (move t0 to f0)
      cpu.setGpr(8, 0x3F800000);  // 1.0f in hex
      exec(0x44880000);
      expect(cpu.fprInt[0]).toBe(0x3F800000);

      // MFC1 $t1, $f0 (move f0 to t1)
      exec(0x44090000);
      expect(cpu.getGprU(9)).toBe(0x3F800000);
    });

    it('should execute ADD.S', () => {
      cpu.fpr[0] = 1.5;
      cpu.fpr[1] = 2.5;
      // ADD.S $f2, $f0, $f1
      exec(0x46010080);
      expect(cpu.fpr[2]).toBeCloseTo(4.0);
    });

    it('should execute SUB.S', () => {
      cpu.fpr[0] = 5.0;
      cpu.fpr[1] = 2.0;
      // SUB.S $f2, $f0, $f1
      exec(0x46010081);
      expect(cpu.fpr[2]).toBeCloseTo(3.0);
    });

    it('should execute MUL.S', () => {
      cpu.fpr[0] = 3.0;
      cpu.fpr[1] = 4.0;
      // MUL.S $f2, $f0, $f1
      exec(0x46010082);
      expect(cpu.fpr[2]).toBeCloseTo(12.0);
    });

    it('should execute DIV.S', () => {
      cpu.fpr[0] = 10.0;
      cpu.fpr[1] = 4.0;
      // DIV.S $f2, $f0, $f1
      exec(0x46010083);
      expect(cpu.fpr[2]).toBeCloseTo(2.5);
    });

    it('should execute SQRT.S', () => {
      cpu.fpr[0] = 16.0;
      // SQRT.S $f1, $f0
      exec(0x46000044);
      expect(cpu.fpr[1]).toBeCloseTo(4.0);
    });

    it('should execute ABS.S', () => {
      cpu.fpr[0] = -5.0;
      // ABS.S $f1, $f0
      exec(0x46000045);
      expect(cpu.fpr[1]).toBeCloseTo(5.0);
    });

    it('should execute NEG.S', () => {
      cpu.fpr[0] = 5.0;
      // NEG.S $f1, $f0
      exec(0x46000047);
      expect(cpu.fpr[1]).toBeCloseTo(-5.0);
    });

    it('should execute MOV.S', () => {
      cpu.fpr[0] = 3.14;
      // MOV.S $f1, $f0
      exec(0x46000046);
      expect(cpu.fpr[1]).toBeCloseTo(3.14);
    });

    it('should execute TRUNC.W.S', () => {
      cpu.fpr[0] = 3.7;
      // TRUNC.W.S $f1, $f0
      exec(0x4600004D);
      expect(cpu.fprInt[1]).toBe(3);
    });

    it('should execute CVT.S.W', () => {
      cpu.fprInt[0] = 42;
      // CVT.S.W $f1, $f0
      // 010001 10100 00000 00000 00001 100000
      exec(0x46800060);
      expect(cpu.fpr[1]).toBeCloseTo(42.0);
    });

    it('should execute C.EQ.S', () => {
      cpu.fpr[0] = 5.0;
      cpu.fpr[1] = 5.0;
      // C.EQ.S $f0, $f1
      exec(0x46010032);
      expect(cpu.fcr31 & 0x800000).not.toBe(0);
    });

    it('should execute C.LT.S', () => {
      cpu.fpr[0] = 3.0;
      cpu.fpr[1] = 5.0;
      // C.LT.S $f0, $f1
      exec(0x4601003C);
      expect(cpu.fcr31 & 0x800000).not.toBe(0);
    });

    it('should execute BC1T/BC1F', () => {
      cpu.fcr31 |= 0x800000;  // Set condition flag
      cpu.pc = MAIN_MEMORY_BASE;
      memory.sw(MAIN_MEMORY_BASE, 0x45010002);     // BC1T +2
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000); // NOP
      const result = interpreter.step(cpu);
      expect(result).toBe(ExecutionResult.BRANCH);

      cpu.fcr31 &= ~0x800000;  // Clear condition flag
      cpu.pc = MAIN_MEMORY_BASE;
      memory.sw(MAIN_MEMORY_BASE, 0x45000002);     // BC1F +2
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000); // NOP
      const result2 = interpreter.step(cpu);
      expect(result2).toBe(ExecutionResult.BRANCH);
    });

    it('should execute LWC1/SWC1', () => {
      cpu.setGpr(8, MAIN_MEMORY_BASE);
      memory.sw(MAIN_MEMORY_BASE + 0x100, 0x40400000);  // 3.0f in hex
      // LWC1 $f0, 0x100($t0)
      exec(0xC5000100);
      expect(cpu.fpr[0]).toBeCloseTo(3.0);

      cpu.fpr[1] = 5.0;
      // SWC1 $f1, 0x104($t0)
      exec(0xE5010104);
      expect(memory.lw(MAIN_MEMORY_BASE + 0x104)).toBe(0x40A00000);  // 5.0f
    });
  });

  describe('Delay Slot Execution', () => {
    it('should execute delay slot instruction', () => {
      cpu.pc = MAIN_MEMORY_BASE;
      cpu.setGpr(8, 5);
      // J somewhere
      memory.sw(MAIN_MEMORY_BASE, 0x08200400);
      // Delay slot: ADDIU $t0, $t0, 10
      memory.sw(MAIN_MEMORY_BASE + 4, 0x2508000A);
      interpreter.step(cpu);
      expect(cpu.getGpr(8)).toBe(15);  // Delay slot was executed
    });
  });

  describe('run() method', () => {
    it('should execute multiple instructions', () => {
      cpu.pc = MAIN_MEMORY_BASE;
      // Program: t0 = 1, loop: t0 = t0 + 1, if t0 < 10 goto loop
      memory.sw(MAIN_MEMORY_BASE, 0x24080001);      // ADDIU $t0, $zero, 1
      memory.sw(MAIN_MEMORY_BASE + 4, 0x25080001);  // ADDIU $t0, $t0, 1
      memory.sw(MAIN_MEMORY_BASE + 8, 0x0000000C);  // SYSCALL (stop)

      const result = interpreter.run(cpu, 100);
      expect(result).toBe(ExecutionResult.SYSCALL);
      expect(cpu.getGpr(8)).toBe(2);
    });
  });
});
