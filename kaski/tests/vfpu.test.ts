import { describe, it, expect, beforeEach } from 'bun:test';
import { CpuState, Instruction, Interpreter, ExecutionResult } from '../src/core/cpu';
import { Memory, MAIN_MEMORY_BASE } from '../src/core/memory';

describe('VFPU Instructions', () =>
{
  let memory: Memory;
  let cpu: CpuState;
  let interpreter: Interpreter;

  beforeEach(() =>
  {
    memory = new Memory();
    cpu = new CpuState(memory);
    interpreter = new Interpreter();
    cpu.pc = MAIN_MEMORY_BASE;
  });

  function exec(data: number): ExecutionResult
  {
    const instr = new Instruction(cpu.pc, data);
    return interpreter.execute(cpu, instr);
  }

  /**
   * Build VFPU arithmetic instruction encoding
   * Format: opcode:func:vt:two:vs:one:vd
   *
   * @param opcode - 6-bit opcode (0x18 for vadd/vsub/vdiv, 0x19 for vmul)
   * @param func - 3-bit function (0=add, 1=sub, 7=div for 0x18; 0=mul for 0x19)
   * @param vt - 7-bit target register
   * @param vs - 7-bit source register
   * @param vd - 7-bit destination register
   * @param size - Vector size (1, 2, 3, or 4)
   * @returns 32-bit instruction encoding
   */
  function buildVfpuArith(opcode: number, func: number, vt: number, vs: number, vd: number, size: number): number
  {
    // size = 1 + one + 2*two
    // one = (size - 1) & 1, two = (size - 1) >> 1
    const one = (size - 1) & 1;
    const two = (size - 1) >> 1;

    return (
      ((opcode & 0x3F) << 26) |
      ((func & 0x07) << 23) |
      ((vt & 0x7F) << 16) |
      ((two & 0x01) << 15) |
      ((vs & 0x7F) << 8) |
      ((one & 0x01) << 7) |
      (vd & 0x7F)
    );
  }

  /**
   * Build VFPU scalar/unary instruction encoding
   * Format: 110100:00:000:func(5):two:vs(7):one:vd(7)
   *
   * @param func - 5-bit function code
   * @param vs - 7-bit source register
   * @param vd - 7-bit destination register
   * @param size - Vector size (1, 2, 3, or 4)
   * @returns 32-bit instruction encoding
   */
  function buildVfpuScalar(func: number, vs: number, vd: number, size: number): number
  {
    const one = (size - 1) & 1;
    const two = (size - 1) >> 1;

    return (
      (0xD0 << 24) |           // opcode 110100:00
      ((func & 0x1F) << 16) |  // function (5 bits)
      ((two & 0x01) << 15) |   // two bit
      ((vs & 0x7F) << 8) |     // vs register
      ((one & 0x01) << 7) |    // one bit
      (vd & 0x7F)              // vd register
    );
  }

  describe('Vector Arithmetic', () =>
  {
    it('should execute vadd.s (scalar)', () =>
    {
      // Set VFPU registers
      cpu.vfpr[0] = 0;    // vd = V000
      cpu.vfpr[1] = 10.5; // vs = V001
      cpu.vfpr[2] = 5.25; // vt = V002

      // vadd.s V000, V001, V002 (size=1)
      // opcode=0x18, func=0, vd=0, vs=1, vt=2
      const instr = buildVfpuArith(0x18, 0, 2, 1, 0, 1);
      exec(instr);

      expect(cpu.vfpr[0]).toBeCloseTo(15.75);
    });

    it('should execute vadd.p (pair)', () =>
    {
      // Set VFPU registers for a pair (row 0, columns 0-1)
      cpu.vfpr[0] = 0;    // V000
      cpu.vfpr[1] = 0;    // V001
      cpu.vfpr[4] = 1.0;  // V010
      cpu.vfpr[5] = 2.0;  // V011
      cpu.vfpr[8] = 3.0;  // V020
      cpu.vfpr[9] = 4.0;  // V021

      // vadd.p V00, V01, V02 (size=2)
      // vd=0 (V000-V001), vs=4>>0=1 hmm...
      // Actually the register encoding is more complex
      // For row vectors: base = matrix*16 + row*4 + column
      // V000 = matrix 0, row 0, col 0 = 0*16 + 0*4 + 0 = 0
      // For V00 pair (cols 0-1): vreg encodes matrix + starting col
      // vreg = matrix*4 + row*8 + column = 0*4 + 0*8 + 0 = 0
      // Actually for pairs, vd points to first element

      // Let's use simple indices that are in same row
      cpu.vfpr[0] = 0;    // result[0]
      cpu.vfpr[1] = 0;    // result[1]
      cpu.vfpr[4] = 1.0;  // operand1[0] - row 1, col 0
      cpu.vfpr[5] = 2.0;  // operand1[1] - row 1, col 1

      // Actually let me reconsider - the getVectorRegs function uses:
      // matrix = (vreg >> 2) & 7
      // column = vreg & 3
      // row = (vreg >> 5) & 3
      // For vreg=0: matrix=0, column=0, row=0
      // For size=2 (pair): indices = [0, 1] (row 0, cols 0-1)

      // vreg=1: matrix=0, column=1, row=0 → [1, 2] (row 0, cols 1-2)
      // vreg=4: matrix=1, column=0, row=0 → [16, 17] (matrix 1, row 0, cols 0-1)

      // Let's test with vreg values that give sequential indices
      // vreg=0 gives indices [0, 1] for size=2
      // vreg=32 (0x20) has transpose bit set:
      //   matrix=0, column=0, row=1
      //   With transpose: indices = [0+row*4+col, 4+row*4+col]...

      // Simple test: use registers 0-3 for all operands
      cpu.vfpr[0] = 0;   // vd[0]
      cpu.vfpr[1] = 0;   // vd[1]
      cpu.vfpr[0] = 100; // vs[0] (will be overwritten)
      cpu.vfpr[1] = 200; // vs[1]

      // This is getting complex. Let me test with distinct matrices.
      // Matrix 0: indices 0-15
      // Matrix 1: indices 16-31
      // etc.

      // For vreg=0 (matrix 0, row 0, col 0), size=2: [0, 1]
      // For vreg=1 (matrix 0, row 0, col 1), size=2: [1, 2]
      // For vreg=4 (matrix 1, row 0, col 0), size=2: [16, 17]
      // For vreg=8 (matrix 2, row 0, col 0), size=2: [32, 33]

      // Let's use different matrices to avoid overlap
      cpu.vfpr[0] = 0;     // result in matrix 0, row 0
      cpu.vfpr[1] = 0;
      cpu.vfpr[16] = 1.0;  // operand 1 in matrix 1, row 0
      cpu.vfpr[17] = 2.0;
      cpu.vfpr[32] = 3.0;  // operand 2 in matrix 2, row 0
      cpu.vfpr[33] = 4.0;

      // vadd.p V00, V10, V20
      // vd=0 (matrix 0), vs=4 (matrix 1), vt=8 (matrix 2)
      const instr = buildVfpuArith(0x18, 0, 8, 4, 0, 2);
      exec(instr);

      expect(cpu.vfpr[0]).toBeCloseTo(4.0);  // 1.0 + 3.0
      expect(cpu.vfpr[1]).toBeCloseTo(6.0);  // 2.0 + 4.0
    });

    it('should execute vsub.s (scalar)', () =>
    {
      cpu.vfpr[0] = 0;
      cpu.vfpr[1] = 10.0;
      cpu.vfpr[2] = 3.0;

      // vsub.s V000, V001, V002 (func=1)
      const instr = buildVfpuArith(0x18, 1, 2, 1, 0, 1);
      exec(instr);

      expect(cpu.vfpr[0]).toBeCloseTo(7.0);
    });

    it('should execute vmul.s (scalar)', () =>
    {
      cpu.vfpr[0] = 0;
      cpu.vfpr[1] = 4.0;
      cpu.vfpr[2] = 2.5;

      // vmul.s V000, V001, V002 (opcode=0x19, func=0)
      const instr = buildVfpuArith(0x19, 0, 2, 1, 0, 1);
      exec(instr);

      expect(cpu.vfpr[0]).toBeCloseTo(10.0);
    });

    it('should execute vdiv.s (scalar)', () =>
    {
      cpu.vfpr[0] = 0;
      cpu.vfpr[1] = 10.0;
      cpu.vfpr[2] = 4.0;

      // vdiv.s V000, V001, V002 (func=7)
      const instr = buildVfpuArith(0x18, 7, 2, 1, 0, 1);
      exec(instr);

      expect(cpu.vfpr[0]).toBeCloseTo(2.5);
    });

    it('should execute vadd.q (quad)', () =>
    {
      // Use different matrices to avoid overlap
      // Matrix 0 for result, matrix 1 for src1, matrix 2 for src2
      cpu.vfpr[0] = 0;
      cpu.vfpr[1] = 0;
      cpu.vfpr[2] = 0;
      cpu.vfpr[3] = 0;

      cpu.vfpr[16] = 1.0;
      cpu.vfpr[17] = 2.0;
      cpu.vfpr[18] = 3.0;
      cpu.vfpr[19] = 4.0;

      cpu.vfpr[32] = 10.0;
      cpu.vfpr[33] = 20.0;
      cpu.vfpr[34] = 30.0;
      cpu.vfpr[35] = 40.0;

      // vadd.q V00, V10, V20
      const instr = buildVfpuArith(0x18, 0, 8, 4, 0, 4);
      exec(instr);

      expect(cpu.vfpr[0]).toBeCloseTo(11.0);
      expect(cpu.vfpr[1]).toBeCloseTo(22.0);
      expect(cpu.vfpr[2]).toBeCloseTo(33.0);
      expect(cpu.vfpr[3]).toBeCloseTo(44.0);
    });
  });

  describe('Scalar Operations', () =>
  {
    // Function codes from InstructionTable:
    // vabs=1, vneg=2, vsat0=4, vsat1=5, vrcp=16, vrsq=17, vsin=18, vcos=19, vexp2=20, vlog2=21, vsqrt=22

    it('should execute vabs.s', () =>
    {
      cpu.vfpr[0] = 0;
      cpu.vfpr[1] = -5.5;

      // vabs.s V000, V001 (func=1)
      const instr = buildVfpuScalar(1, 1, 0, 1);
      exec(instr);

      expect(cpu.vfpr[0]).toBeCloseTo(5.5);
    });

    it('should execute vneg.s', () =>
    {
      cpu.vfpr[0] = 0;
      cpu.vfpr[1] = 3.14;

      // vneg.s V000, V001 (func=2)
      const instr = buildVfpuScalar(2, 1, 0, 1);
      exec(instr);

      expect(cpu.vfpr[0]).toBeCloseTo(-3.14);
    });

    it('should execute vsat0.s (saturate 0-1)', () =>
    {
      cpu.vfpr[0] = 0;
      cpu.vfpr[1] = 1.5; // Should clamp to 1.0

      // vsat0.s V000, V001 (func=4)
      const instr = buildVfpuScalar(4, 1, 0, 1);
      exec(instr);

      expect(cpu.vfpr[0]).toBeCloseTo(1.0);

      // Test negative clamping
      cpu.vfpr[1] = -0.5;
      exec(instr);
      expect(cpu.vfpr[0]).toBeCloseTo(0.0);

      // Test value in range
      cpu.vfpr[1] = 0.5;
      exec(instr);
      expect(cpu.vfpr[0]).toBeCloseTo(0.5);
    });

    it('should execute vsat1.s (saturate -1 to 1)', () =>
    {
      cpu.vfpr[0] = 0;
      cpu.vfpr[1] = 2.0; // Should clamp to 1.0

      // vsat1.s V000, V001 (func=5)
      const instr = buildVfpuScalar(5, 1, 0, 1);
      exec(instr);

      expect(cpu.vfpr[0]).toBeCloseTo(1.0);

      // Test negative clamping
      cpu.vfpr[1] = -2.0;
      exec(instr);
      expect(cpu.vfpr[0]).toBeCloseTo(-1.0);

      // Test value in range
      cpu.vfpr[1] = 0.5;
      exec(instr);
      expect(cpu.vfpr[0]).toBeCloseTo(0.5);
    });

    it('should execute vsqrt.s', () =>
    {
      cpu.vfpr[0] = 0;
      cpu.vfpr[1] = 16.0;

      // vsqrt.s V000, V001 (func=22)
      const instr = buildVfpuScalar(22, 1, 0, 1);
      exec(instr);

      expect(cpu.vfpr[0]).toBeCloseTo(4.0);
    });

    it('should execute vrsq.s (reciprocal sqrt)', () =>
    {
      cpu.vfpr[0] = 0;
      cpu.vfpr[1] = 4.0;

      // vrsq.s V000, V001 (func=17)
      const instr = buildVfpuScalar(17, 1, 0, 1);
      exec(instr);

      expect(cpu.vfpr[0]).toBeCloseTo(0.5); // 1/sqrt(4) = 0.5
    });

    it('should execute vrcp.s (reciprocal)', () =>
    {
      cpu.vfpr[0] = 0;
      cpu.vfpr[1] = 4.0;

      // vrcp.s V000, V001 (func=16)
      const instr = buildVfpuScalar(16, 1, 0, 1);
      exec(instr);

      expect(cpu.vfpr[0]).toBeCloseTo(0.25);
    });
  });

  describe('Trigonometric Operations', () =>
  {
    it('should execute vsin.s', () =>
    {
      cpu.vfpr[0] = 0;
      // VFPU uses cycles: 1.0 = 360 degrees, so 0.25 = 90 degrees
      cpu.vfpr[1] = 0.25;

      // vsin.s V000, V001 (func=18)
      const instr = buildVfpuScalar(18, 1, 0, 1);
      exec(instr);

      expect(cpu.vfpr[0]).toBeCloseTo(1.0, 4);
    });

    it('should execute vcos.s', () =>
    {
      cpu.vfpr[0] = 0;
      cpu.vfpr[1] = 0; // 0 degrees

      // vcos.s V000, V001 (func=19)
      const instr = buildVfpuScalar(19, 1, 0, 1);
      exec(instr);

      expect(cpu.vfpr[0]).toBeCloseTo(1.0, 4);
    });

    it('should execute vexp2.s', () =>
    {
      cpu.vfpr[0] = 0;
      cpu.vfpr[1] = 3.0;

      // vexp2.s V000, V001 (func=20)
      const instr = buildVfpuScalar(20, 1, 0, 1);
      exec(instr);

      expect(cpu.vfpr[0]).toBeCloseTo(8.0); // 2^3 = 8
    });

    it('should execute vlog2.s', () =>
    {
      cpu.vfpr[0] = 0;
      cpu.vfpr[1] = 8.0;

      // vlog2.s V000, V001 (func=21)
      const instr = buildVfpuScalar(21, 1, 0, 1);
      exec(instr);

      expect(cpu.vfpr[0]).toBeCloseTo(3.0); // log2(8) = 3
    });
  });

  describe('Min/Max Operations', () =>
  {
    it('should execute vmin.s', () =>
    {
      cpu.vfpr[0] = 0;
      cpu.vfpr[1] = 5.0;
      cpu.vfpr[2] = 3.0;

      // vmin.s V000, V001, V002
      // vmin: '011011:010:vt:two:vs:one:vd'
      const instr = buildVfpuArith(0x1B, 2, 2, 1, 0, 1);
      exec(instr);

      expect(cpu.vfpr[0]).toBeCloseTo(3.0);
    });

    it('should execute vmax.s', () =>
    {
      cpu.vfpr[0] = 0;
      cpu.vfpr[1] = 5.0;
      cpu.vfpr[2] = 3.0;

      // vmax.s V000, V001, V002
      // vmax: '011011:011:vt:two:vs:one:vd'
      const instr = buildVfpuArith(0x1B, 3, 2, 1, 0, 1);
      exec(instr);

      expect(cpu.vfpr[0]).toBeCloseTo(5.0);
    });
  });
});

describe('Extended Instructions', () =>
{
  let memory: Memory;
  let cpu: CpuState;
  let interpreter: Interpreter;

  beforeEach(() =>
  {
    memory = new Memory();
    cpu = new CpuState(memory);
    interpreter = new Interpreter();
    cpu.pc = MAIN_MEMORY_BASE;
  });

  function exec(data: number): ExecutionResult
  {
    const instr = new Instruction(cpu.pc, data);
    return interpreter.execute(cpu, instr);
  }

  describe('Multiply-Accumulate', () =>
  {
    it('should execute madd', () =>
    {
      cpu.setGpr(8, 10);  // t0
      cpu.setGpr(9, 20);  // t1
      cpu.hi = 0;
      cpu.lo = 50;  // Initial accumulator value

      // madd $t0, $t1
      // 011100:rs:rt:00000:00000:000000
      // = 0x70000000 | (8 << 21) | (9 << 16)
      const maddInstr = 0x70000000 | (8 << 21) | (9 << 16);
      exec(maddInstr);

      // Result: HI:LO = 50 + (10 * 20) = 250
      expect(cpu.lo).toBe(250);
      expect(cpu.hi).toBe(0);
    });

    it('should execute maddu', () =>
    {
      cpu.setGpr(8, 0xFFFFFFFF);  // -1 as signed, large as unsigned
      cpu.setGpr(9, 2);
      cpu.hi = 0;
      cpu.lo = 10;

      // maddu $t0, $t1
      // 011100:rs:rt:00000:00000:000001
      const madduInstr = 0x70000001 | (8 << 21) | (9 << 16);
      exec(madduInstr);

      // 0xFFFFFFFF * 2 = 0x1FFFFFFFE
      // + 10 = 0x1FFFFFFFE + 10 = 0x200000008
      // Actually let me recalculate:
      // 0xFFFFFFFF * 2 = 4294967295 * 2 = 8589934590 = 0x1FFFFFFFE
      // 8589934590 + 10 = 8589934600 = 0x200000008
      // hi = 1, lo = 0x00000008
      // Wait that's wrong. Let me think again.
      // Initial: hi=0, lo=10 → acc = 10
      // Product: 0xFFFFFFFF * 2 = 0x1_FFFFFFFE (64-bit)
      // Sum: 10 + 0x1_FFFFFFFE = 0x2_00000008
      // hi = 2, lo = 8
      expect(cpu.lo).toBe(8);
      expect(cpu.hi).toBe(2);
    });

    it('should execute msub', () =>
    {
      cpu.setGpr(8, 10);
      cpu.setGpr(9, 5);
      cpu.hi = 0;
      cpu.lo = 100;

      // msub $t0, $t1
      // 011100:rs:rt:00000:00000:000100
      const msubInstr = 0x70000004 | (8 << 21) | (9 << 16);
      exec(msubInstr);

      // 100 - (10 * 5) = 50
      expect(cpu.lo).toBe(50);
      expect(cpu.hi).toBe(0);
    });

    it('should execute msubu', () =>
    {
      cpu.setGpr(8, 10);
      cpu.setGpr(9, 5);
      cpu.hi = 0;
      cpu.lo = 200;

      // msubu $t0, $t1
      // 011100:rs:rt:00000:00000:000101
      const msubuInstr = 0x70000005 | (8 << 21) | (9 << 16);
      exec(msubuInstr);

      // 200 - 50 = 150
      expect(cpu.lo).toBe(150);
      expect(cpu.hi).toBe(0);
    });
  });

  describe('COP0 (System Control)', () =>
  {
    it('should execute mfc0 (move from COP0)', () =>
    {
      cpu.cop0[12] = 0x12345678;  // COP0 register 12 (Status)

      // mfc0 $t0, $12
      // 010000:00000:rt:c0dr:00000:000000
      // = 0x40000000 | (8 << 16) | (12 << 11)
      const mfc0Instr = 0x40000000 | (8 << 16) | (12 << 11);
      exec(mfc0Instr);

      expect(cpu.getGprU(8)).toBe(0x12345678);
    });

    it('should execute mtc0 (move to COP0)', () =>
    {
      cpu.setGpr(8, 0xABCDEF00);
      cpu.cop0[12] = 0;

      // mtc0 $t0, $12
      // 010000:00100:rt:c0dr:00000:000000
      // = 0x40800000 | (8 << 16) | (12 << 11)
      const mtc0Instr = 0x40800000 | (8 << 16) | (12 << 11);
      exec(mtc0Instr);

      expect(cpu.cop0[12]).toBe(0xABCDEF00 | 0); // Signed to unsigned
    });

    it('should read and write different COP0 registers', () =>
    {
      // Write to EPC (register 14)
      cpu.setGpr(8, 0x08800000);
      const mtc0Epc = 0x40800000 | (8 << 16) | (14 << 11);
      exec(mtc0Epc);
      expect(cpu.cop0[14]).toBe(0x08800000);

      // Read back
      cpu.setGpr(9, 0);
      const mfc0Epc = 0x40000000 | (9 << 16) | (14 << 11);
      exec(mfc0Epc);
      expect(cpu.getGprU(9)).toBe(0x08800000);
    });
  });
});
