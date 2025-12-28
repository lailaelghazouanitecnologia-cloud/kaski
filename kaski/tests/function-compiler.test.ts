import { describe, it, expect } from 'bun:test';
import { FunctionCompiler } from '../src/core/cpu/jit/FunctionCompiler';
import { MipsAstBuilder } from '../src/core/cpu/jit/ast';
import { Memory } from '../src/core/memory';
import { CpuState } from '../src/core/cpu';

/**
 * MIPS assembler helpers
 */
function assembleR(opcode: number, rs: number, rt: number, rd: number, sa: number, func: number): number
{
  return ((opcode & 0x3F) << 26) | ((rs & 0x1F) << 21) | ((rt & 0x1F) << 16) |
         ((rd & 0x1F) << 11) | ((sa & 0x1F) << 6) | (func & 0x3F);
}

function assembleI(opcode: number, rs: number, rt: number, imm: number): number
{
  return ((opcode & 0x3F) << 26) | ((rs & 0x1F) << 21) | ((rt & 0x1F) << 16) | (imm & 0xFFFF);
}

function assembleJ(opcode: number, target: number): number
{
  return ((opcode & 0x3F) << 26) | ((target >> 2) & 0x3FFFFFF);
}

const MIPS = {
  add: (rd: number, rs: number, rt: number) => assembleR(0, rs, rt, rd, 0, 0x20),
  addu: (rd: number, rs: number, rt: number) => assembleR(0, rs, rt, rd, 0, 0x21),
  addiu: (rt: number, rs: number, imm: number) => assembleI(0x09, rs, rt, imm),
  lui: (rt: number, imm: number) => assembleI(0x0F, 0, rt, imm),
  ori: (rt: number, rs: number, imm: number) => assembleI(0x0D, rs, rt, imm),
  slt: (rd: number, rs: number, rt: number) => assembleR(0, rs, rt, rd, 0, 0x2A),
  beq: (rs: number, rt: number, offset: number) => assembleI(0x04, rs, rt, offset),
  bne: (rs: number, rt: number, offset: number) => assembleI(0x05, rs, rt, offset),
  bgtz: (rs: number, offset: number) => assembleI(0x07, rs, 0, offset),
  blez: (rs: number, offset: number) => assembleI(0x06, rs, 0, offset),
  j: (addr: number) => assembleJ(0x02, addr),
  jal: (addr: number) => assembleJ(0x03, addr),
  jr: (rs: number) => assembleR(0, rs, 0, 0, 0, 0x08),
  nop: () => 0,
  syscall: () => assembleR(0, 0, 0, 0, 0, 0x0C),
};

describe('MipsAstBuilder', () =>
{
  it('should generate GPR access code', () =>
  {
    const ast = new MipsAstBuilder();

    expect(ast.gpr(8).toJs()).toBe('gpr[8]');
    expect(ast.gprS(8).toJs()).toBe('(gpr[8] | 0)');
    expect(ast.gprU(8).toJs()).toBe('(gpr[8] >>> 0)');
  });

  it('should generate arithmetic expressions', () =>
  {
    const ast = new MipsAstBuilder();

    const add = ast.add(ast.gpr(8), ast.gpr(9));
    expect(add.toJs()).toBe('(gpr[8] + gpr[9])');

    const sub = ast.sub(ast.gpr(8), ast.i32(5));
    expect(sub.toJs()).toBe('(gpr[8] - 5)');
  });

  it('should generate memory access code', () =>
  {
    const ast = new MipsAstBuilder();

    const addr = ast.memAddr(8, 16);
    expect(addr.toJs()).toBe('((gpr[8] + 16) >>> 0)');

    const load = ast.lw(addr);
    expect(load.toJs()).toBe('memory.lw(((gpr[8] + 16) >>> 0))');
  });

  it('should generate assignments', () =>
  {
    const ast = new MipsAstBuilder();

    const stmt = ast.assignGprS(10, ast.add(ast.gpr(8), ast.gpr(9)));
    expect(stmt.toJs()).toBe('gpr[10] = ((gpr[8] + gpr[9]) | 0);');
  });

  it('should skip R0 assignments', () =>
  {
    const ast = new MipsAstBuilder();

    const stmt = ast.assignGpr(0, ast.i32(42));
    expect(stmt.toJs()).toBe('');
  });
});

describe('FunctionCompiler', () =>
{
  it('should compile single block function', () =>
  {
    const memory = new Memory();
    const compiler = new FunctionCompiler();

    const BASE = 0x08800000;
    memory.sw(BASE + 0, MIPS.addiu(8, 0, 5));      // t0 = 5
    memory.sw(BASE + 4, MIPS.addiu(9, 0, 3));      // t1 = 3
    memory.sw(BASE + 8, MIPS.add(10, 8, 9));       // t2 = t0 + t1
    memory.sw(BASE + 12, MIPS.syscall());

    const result = compiler.compile(addr => memory.lw(addr), BASE);

    expect(result).not.toBeNull();
    expect(result!.startPc).toBe(BASE);
    expect(result!.blockCount).toBe(1);

    // Execute
    const state = new CpuState(memory);
    state.pc = BASE;
    result!.func(state);

    expect(state.getGpr(8)).toBe(5);
    expect(state.getGpr(9)).toBe(3);
    expect(state.getGpr(10)).toBe(8);
  });

  it('should compile function with branch', () =>
  {
    const memory = new Memory();
    const compiler = new FunctionCompiler();

    // Simple if: if (t0 > 0) t1 = 1 else t1 = 0
    const BASE = 0x08800000;
    let pc = BASE;

    memory.sw(pc, MIPS.addiu(8, 0, 5)); pc += 4;       // t0 = 5
    memory.sw(pc, MIPS.bgtz(8, 2)); pc += 4;           // if t0 > 0, skip
    memory.sw(pc, MIPS.nop()); pc += 4;                // delay slot
    memory.sw(pc, MIPS.addiu(9, 0, 0)); pc += 4;       // t1 = 0 (else)
    memory.sw(pc, MIPS.j(BASE + 24)); pc += 4;         // j end
    memory.sw(pc, MIPS.nop()); pc += 4;                // delay slot
    memory.sw(pc, MIPS.addiu(9, 0, 1)); pc += 4;       // t1 = 1 (then) - pc=BASE+24
    memory.sw(pc, MIPS.syscall());                     // end

    const result = compiler.compile(addr => memory.lw(addr), BASE);

    expect(result).not.toBeNull();
    expect(result!.blockCount).toBeGreaterThan(1);

    // Execute
    const state = new CpuState(memory);
    state.pc = BASE;
    result!.func(state);

    expect(state.getGpr(8)).toBe(5);
    expect(state.getGpr(9)).toBe(1); // Should take then branch
  });

  it('should compile loop', () =>
  {
    const memory = new Memory();
    const compiler = new FunctionCompiler();

    // Sum 1 to 5
    const BASE = 0x08800000;
    let pc = BASE;

    memory.sw(pc, MIPS.addiu(8, 0, 5)); pc += 4;       // t0 = 5 (counter)
    memory.sw(pc, MIPS.addiu(9, 0, 0)); pc += 4;       // t1 = 0 (sum)

    const loopAddr = pc;
    memory.sw(pc, MIPS.add(9, 9, 8)); pc += 4;         // sum += counter
    memory.sw(pc, MIPS.addiu(8, 8, -1)); pc += 4;      // counter--
    memory.sw(pc, MIPS.bgtz(8, -3)); pc += 4;          // if counter > 0, loop
    memory.sw(pc, MIPS.nop()); pc += 4;                // delay slot

    memory.sw(pc, MIPS.syscall());

    const result = compiler.compile(addr => memory.lw(addr), BASE);

    expect(result).not.toBeNull();

    // Execute
    const state = new CpuState(memory);
    state.pc = BASE;
    result!.func(state);

    expect(state.getGpr(9)).toBe(15); // 5+4+3+2+1 = 15
  });

  it('should produce same results as interpreter', () =>
  {
    const memory = new Memory();
    const compiler = new FunctionCompiler();

    // Factorial-like: n * (n-1) * ... * 1
    const BASE = 0x08800000;
    let pc = BASE;

    memory.sw(pc, MIPS.addiu(8, 0, 5)); pc += 4;       // t0 = 5
    memory.sw(pc, MIPS.addiu(9, 0, 1)); pc += 4;       // t1 = 1 (result)

    memory.sw(pc, MIPS.blez(8, 5)); pc += 4;           // if t0 <= 0, end
    memory.sw(pc, MIPS.nop()); pc += 4;

    // Multiply using repeated addition (simple version)
    // result = result * t0 done via mult
    memory.sw(pc, assembleR(0, 9, 8, 0, 0, 0x18)); pc += 4;  // mult t1, t0
    memory.sw(pc, assembleR(0, 0, 0, 9, 0, 0x12)); pc += 4;  // mflo t1
    memory.sw(pc, MIPS.addiu(8, 8, -1)); pc += 4;            // t0--
    memory.sw(pc, MIPS.j(BASE + 8)); pc += 4;                // loop
    memory.sw(pc, MIPS.nop()); pc += 4;

    memory.sw(pc, MIPS.syscall());

    const result = compiler.compile(addr => memory.lw(addr), BASE);
    expect(result).not.toBeNull();

    const state = new CpuState(memory);
    state.pc = BASE;
    result!.func(state);

    expect(state.getGpr(9)).toBe(120); // 5! = 120
  });
});

describe('AST optimization', () =>
{
  it('should fold constants', () =>
  {
    const ast = new MipsAstBuilder();

    const expr = ast.add(ast.i32(5), ast.i32(3));
    const optimized = expr.optimize();

    expect(optimized.toJs()).toBe('8');
  });

  it('should eliminate identity operations', () =>
  {
    const ast = new MipsAstBuilder();

    const expr = ast.add(ast.gpr(8), ast.i32(0));
    const optimized = expr.optimize();

    expect(optimized.toJs()).toBe('gpr[8]');
  });
});
