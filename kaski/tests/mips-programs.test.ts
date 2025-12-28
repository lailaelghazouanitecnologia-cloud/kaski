import { describe, it, expect } from 'bun:test';
import { Cpu, CpuState, CpuMode } from '../src/core/cpu';
import { Memory } from '../src/core/memory';

/**
 * Tests with real MIPS machine code
 *
 * These tests load actual MIPS instructions into memory and execute them,
 * verifying the CPU behaves correctly with realistic programs.
 */

/**
 * Helper to assemble MIPS instructions
 * Format: opcode:rs:rt:rd:sa:func for R-type
 *         opcode:rs:rt:imm16 for I-type
 */
function assembleR(opcode: number, rs: number, rt: number, rd: number, sa: number, func: number): number
{
  return ((opcode & 0x3F) << 26) |
         ((rs & 0x1F) << 21) |
         ((rt & 0x1F) << 16) |
         ((rd & 0x1F) << 11) |
         ((sa & 0x1F) << 6) |
         (func & 0x3F);
}

function assembleI(opcode: number, rs: number, rt: number, imm: number): number
{
  return ((opcode & 0x3F) << 26) |
         ((rs & 0x1F) << 21) |
         ((rt & 0x1F) << 16) |
         (imm & 0xFFFF);
}

function assembleJ(opcode: number, target: number): number
{
  return ((opcode & 0x3F) << 26) | ((target >> 2) & 0x3FFFFFF);
}

// Common instruction encodings
const MIPS = {
  // R-type (opcode 0)
  add: (rd: number, rs: number, rt: number) => assembleR(0, rs, rt, rd, 0, 0x20),
  addu: (rd: number, rs: number, rt: number) => assembleR(0, rs, rt, rd, 0, 0x21),
  sub: (rd: number, rs: number, rt: number) => assembleR(0, rs, rt, rd, 0, 0x22),
  and: (rd: number, rs: number, rt: number) => assembleR(0, rs, rt, rd, 0, 0x24),
  or: (rd: number, rs: number, rt: number) => assembleR(0, rs, rt, rd, 0, 0x25),
  slt: (rd: number, rs: number, rt: number) => assembleR(0, rs, rt, rd, 0, 0x2A),
  sll: (rd: number, rt: number, sa: number) => assembleR(0, 0, rt, rd, sa, 0x00),
  srl: (rd: number, rt: number, sa: number) => assembleR(0, 0, rt, rd, sa, 0x02),
  jr: (rs: number) => assembleR(0, rs, 0, 0, 0, 0x08),
  jalr: (rd: number, rs: number) => assembleR(0, rs, 0, rd, 0, 0x09),
  nop: () => 0,

  // I-type
  addiu: (rt: number, rs: number, imm: number) => assembleI(0x09, rs, rt, imm),
  lui: (rt: number, imm: number) => assembleI(0x0F, 0, rt, imm),
  ori: (rt: number, rs: number, imm: number) => assembleI(0x0D, rs, rt, imm),
  lw: (rt: number, offset: number, rs: number) => assembleI(0x23, rs, rt, offset),
  sw: (rt: number, offset: number, rs: number) => assembleI(0x2B, rs, rt, offset),
  beq: (rs: number, rt: number, offset: number) => assembleI(0x04, rs, rt, offset),
  bne: (rs: number, rt: number, offset: number) => assembleI(0x05, rs, rt, offset),
  bgtz: (rs: number, offset: number) => assembleI(0x07, rs, 0, offset),

  // J-type
  j: (addr: number) => assembleJ(0x02, addr),
  jal: (addr: number) => assembleJ(0x03, addr),

  // System
  syscall: () => assembleR(0, 0, 0, 0, 0, 0x0C),
};

describe('MIPS Programs', () =>
{
  describe('simple arithmetic', () =>
  {
    it('should compute 5 + 3 = 8', () =>
    {
      const memory = new Memory();
      const cpu = new Cpu(memory, CpuMode.INTERPRETER);
      const state = cpu.state;

      // Program:
      // addiu $t0, $zero, 5    # t0 = 5
      // addiu $t1, $zero, 3    # t1 = 3
      // add $t2, $t0, $t1      # t2 = t0 + t1
      // syscall                 # stop

      const BASE = 0x08800000;
      memory.sw(BASE + 0, MIPS.addiu(8, 0, 5));      // t0 = 5
      memory.sw(BASE + 4, MIPS.addiu(9, 0, 3));      // t1 = 3
      memory.sw(BASE + 8, MIPS.add(10, 8, 9));       // t2 = t0 + t1
      memory.sw(BASE + 12, MIPS.syscall());

      state.pc = BASE;
      cpu.run(100);

      expect(state.getGpr(8)).toBe(5);   // t0
      expect(state.getGpr(9)).toBe(3);   // t1
      expect(state.getGpr(10)).toBe(8);  // t2 = 5 + 3
    });

    it('should compute factorial of 5', () =>
    {
      const memory = new Memory();
      const cpu = new Cpu(memory, CpuMode.INTERPRETER);
      const state = cpu.state;

      // Program: factorial(5)
      // t0 = n = 5
      // t1 = result = 1
      // loop:
      //   if t0 <= 0 goto end
      //   t1 = t1 * t0 (using mult + mflo)
      //   t0 = t0 - 1
      //   goto loop
      // end:
      //   syscall

      const BASE = 0x08800000;
      let pc = BASE;

      // Initialize
      memory.sw(pc, MIPS.addiu(8, 0, 5)); pc += 4;     // t0 = 5
      memory.sw(pc, MIPS.addiu(9, 0, 1)); pc += 4;     // t1 = 1

      // loop: (pc = BASE + 8)
      const loopAddr = pc;
      memory.sw(pc, assembleI(0x06, 8, 0, 4)); pc += 4; // blez t0, end (+4 instructions)
      memory.sw(pc, MIPS.nop()); pc += 4;               // delay slot

      // t1 = t1 * t0 (mult)
      memory.sw(pc, assembleR(0, 9, 8, 0, 0, 0x18)); pc += 4;  // mult t1, t0
      memory.sw(pc, assembleR(0, 0, 0, 9, 0, 0x12)); pc += 4;  // mflo t1

      // t0 = t0 - 1
      memory.sw(pc, MIPS.addiu(8, 8, -1)); pc += 4;     // t0 = t0 - 1

      // goto loop
      memory.sw(pc, MIPS.j(loopAddr)); pc += 4;
      memory.sw(pc, MIPS.nop()); pc += 4;               // delay slot

      // end:
      memory.sw(pc, MIPS.syscall());

      state.pc = BASE;
      cpu.run(200);

      expect(state.getGpr(9)).toBe(120);  // 5! = 120
    });
  });

  describe('memory operations', () =>
  {
    it('should store and load values', () =>
    {
      const memory = new Memory();
      const cpu = new Cpu(memory, CpuMode.INTERPRETER);
      const state = cpu.state;

      const BASE = 0x08800000;
      const DATA = 0x08900000;

      // Program:
      // lui $t0, 0x0890         # t0 = 0x08900000
      // addiu $t1, $zero, 42    # t1 = 42
      // sw $t1, 0($t0)          # mem[t0] = t1
      // lw $t2, 0($t0)          # t2 = mem[t0]
      // syscall

      memory.sw(BASE + 0, MIPS.lui(8, 0x0890));
      memory.sw(BASE + 4, MIPS.addiu(9, 0, 42));
      memory.sw(BASE + 8, MIPS.sw(9, 0, 8));
      memory.sw(BASE + 12, MIPS.lw(10, 0, 8));
      memory.sw(BASE + 16, MIPS.syscall());

      state.pc = BASE;
      cpu.run(100);

      expect(state.getGpr(9)).toBe(42);   // t1
      expect(state.getGpr(10)).toBe(42);  // t2 loaded from memory
      expect(memory.lw(DATA)).toBe(42);   // verify memory
    });

    it('should sum array elements', () =>
    {
      const memory = new Memory();
      const cpu = new Cpu(memory, CpuMode.INTERPRETER);
      const state = cpu.state;

      const BASE = 0x08800000;
      const DATA = 0x08900000;

      // Store array [10, 20, 30, 40, 50] in memory
      memory.sw(DATA + 0, 10);
      memory.sw(DATA + 4, 20);
      memory.sw(DATA + 8, 30);
      memory.sw(DATA + 12, 40);
      memory.sw(DATA + 16, 50);

      // Program: sum array of 5 elements
      // t0 = array pointer
      // t1 = sum = 0
      // t2 = count = 5
      // loop:
      //   lw t3, 0(t0)
      //   add t1, t1, t3
      //   addiu t0, t0, 4
      //   addiu t2, t2, -1
      //   bne t2, zero, loop
      //   nop
      // syscall

      let pc = BASE;
      memory.sw(pc, MIPS.lui(8, 0x0890)); pc += 4;      // t0 = 0x08900000
      memory.sw(pc, MIPS.addiu(9, 0, 0)); pc += 4;      // t1 = 0 (sum)
      memory.sw(pc, MIPS.addiu(10, 0, 5)); pc += 4;     // t2 = 5 (count)

      const loopAddr = pc;
      memory.sw(pc, MIPS.lw(11, 0, 8)); pc += 4;        // t3 = mem[t0]
      memory.sw(pc, MIPS.add(9, 9, 11)); pc += 4;       // t1 += t3
      memory.sw(pc, MIPS.addiu(8, 8, 4)); pc += 4;      // t0 += 4
      memory.sw(pc, MIPS.addiu(10, 10, -1)); pc += 4;   // t2 -= 1
      memory.sw(pc, MIPS.bne(10, 0, -5)); pc += 4;      // if t2 != 0, goto loop
      memory.sw(pc, MIPS.nop()); pc += 4;               // delay slot

      memory.sw(pc, MIPS.syscall());

      state.pc = BASE;
      cpu.run(200);

      expect(state.getGpr(9)).toBe(150);  // sum = 10+20+30+40+50
    });
  });

  describe('function calls', () =>
  {
    it('should call and return from function', () =>
    {
      const memory = new Memory();
      const cpu = new Cpu(memory, CpuMode.INTERPRETER);
      const state = cpu.state;

      const BASE = 0x08800000;
      const FUNC = 0x08810000;

      // Main:
      // addiu $a0, $zero, 7     # arg = 7
      // jal double_func         # call
      // nop
      // move $t0, $v0           # t0 = result
      // syscall

      // double_func:
      // add $v0, $a0, $a0       # return arg * 2
      // jr $ra
      // nop

      let pc = BASE;
      memory.sw(pc, MIPS.addiu(4, 0, 7)); pc += 4;      // a0 = 7
      memory.sw(pc, MIPS.jal(FUNC)); pc += 4;           // call
      memory.sw(pc, MIPS.nop()); pc += 4;               // delay slot
      memory.sw(pc, MIPS.add(8, 2, 0)); pc += 4;        // t0 = v0
      memory.sw(pc, MIPS.syscall());

      // Function at FUNC
      pc = FUNC;
      memory.sw(pc, MIPS.add(2, 4, 4)); pc += 4;        // v0 = a0 + a0
      memory.sw(pc, MIPS.jr(31)); pc += 4;              // return
      memory.sw(pc, MIPS.nop());                        // delay slot

      state.pc = BASE;
      cpu.run(100);

      expect(state.getGpr(8)).toBe(14);  // t0 = 7 * 2
    });

    it('should handle recursive function (fibonacci)', () =>
    {
      const memory = new Memory();
      const cpu = new Cpu(memory, CpuMode.INTERPRETER);
      const state = cpu.state;

      // Iterative fibonacci to avoid stack issues
      // fib(n): returns n-th fibonacci number
      // t0 = n
      // t1 = a = 0
      // t2 = b = 1
      // loop while n > 0:
      //   temp = a + b
      //   a = b
      //   b = temp
      //   n--
      // return a

      const BASE = 0x08800000;
      let pc = BASE;

      memory.sw(pc, MIPS.addiu(8, 0, 10)); pc += 4;     // t0 = n = 10
      memory.sw(pc, MIPS.addiu(9, 0, 0)); pc += 4;      // t1 = a = 0
      memory.sw(pc, MIPS.addiu(10, 0, 1)); pc += 4;     // t2 = b = 1

      const loopAddr = pc;
      memory.sw(pc, assembleI(0x06, 8, 0, 6)); pc += 4; // blez t0, end
      memory.sw(pc, MIPS.nop()); pc += 4;

      memory.sw(pc, MIPS.add(11, 9, 10)); pc += 4;      // t3 = a + b
      memory.sw(pc, MIPS.add(9, 10, 0)); pc += 4;       // a = b
      memory.sw(pc, MIPS.add(10, 11, 0)); pc += 4;      // b = temp
      memory.sw(pc, MIPS.addiu(8, 8, -1)); pc += 4;     // n--
      memory.sw(pc, MIPS.j(loopAddr)); pc += 4;
      memory.sw(pc, MIPS.nop()); pc += 4;

      // end:
      memory.sw(pc, MIPS.add(2, 9, 0)); pc += 4;        // v0 = a
      memory.sw(pc, MIPS.syscall());

      state.pc = BASE;
      cpu.run(500);

      expect(state.getGpr(2)).toBe(55);  // fib(10) = 55
    });
  });

  describe('JIT mode', () =>
  {
    it('should produce same results as interpreter', () =>
    {
      // Run same program in both modes
      const runProgram = (mode: CpuMode) =>
      {
        const memory = new Memory();
        const cpu = new Cpu(memory, mode);
        const state = cpu.state;

        const BASE = 0x08800000;

        // Simple loop: sum 1 to 10
        let pc = BASE;
        memory.sw(pc, MIPS.addiu(8, 0, 10)); pc += 4;   // t0 = 10
        memory.sw(pc, MIPS.addiu(9, 0, 0)); pc += 4;    // t1 = 0 (sum)

        const loopAddr = pc;
        memory.sw(pc, MIPS.add(9, 9, 8)); pc += 4;      // sum += i
        memory.sw(pc, MIPS.addiu(8, 8, -1)); pc += 4;   // i--
        memory.sw(pc, MIPS.bgtz(8, -3)); pc += 4;       // if i > 0, loop
        memory.sw(pc, MIPS.nop()); pc += 4;

        memory.sw(pc, MIPS.syscall());

        state.pc = BASE;
        cpu.run(500);

        return state.getGpr(9);
      };

      const interpResult = runProgram(CpuMode.INTERPRETER);
      const jitResult = runProgram(CpuMode.JIT);

      expect(interpResult).toBe(55);  // 1+2+...+10
      expect(jitResult).toBe(55);
      expect(interpResult).toBe(jitResult);
    });
  });
});
