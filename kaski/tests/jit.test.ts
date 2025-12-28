import { describe, it, expect, beforeEach } from 'bun:test';
import { CpuState, CodeGenerator, JitCache } from '../src/core/cpu';
import { Memory, MAIN_MEMORY_BASE } from '../src/core/memory';

describe('CodeGenerator', () =>
{
  let memory: Memory;
  let cpu: CpuState;
  let generator: CodeGenerator;

  beforeEach(() =>
  {
    memory = new Memory();
    cpu = new CpuState(memory);
    generator = new CodeGenerator();
    cpu.pc = MAIN_MEMORY_BASE;
  });

  describe('Basic Compilation', () =>
  {
    it('should compile a simple arithmetic block', () =>
    {
      // ADDIU $t0, $zero, 42
      memory.sw(MAIN_MEMORY_BASE, 0x2408002A);
      // ADDIU $t1, $zero, 10
      memory.sw(MAIN_MEMORY_BASE + 4, 0x2409000A);
      // ADD $t2, $t0, $t1
      memory.sw(MAIN_MEMORY_BASE + 8, 0x01095020);
      // SYSCALL
      memory.sw(MAIN_MEMORY_BASE + 12, 0x0000000C);

      const result = generator.generate(
        (addr) => memory.lw(addr),
        MAIN_MEMORY_BASE
      );

      expect(result).not.toBeNull();
      expect(result!.startPc).toBe(MAIN_MEMORY_BASE);
      expect(result!.instructionCount).toBe(4);
    });

    it('should execute compiled arithmetic correctly', () =>
    {
      // ADDIU $t0, $zero, 42
      memory.sw(MAIN_MEMORY_BASE, 0x2408002A);
      // ADDIU $t1, $zero, 10
      memory.sw(MAIN_MEMORY_BASE + 4, 0x2409000A);
      // ADD $t2, $t0, $t1
      memory.sw(MAIN_MEMORY_BASE + 8, 0x01095020);
      // SYSCALL
      memory.sw(MAIN_MEMORY_BASE + 12, 0x0000000C);

      const result = generator.generate(
        (addr) => memory.lw(addr),
        MAIN_MEMORY_BASE
      );

      expect(result).not.toBeNull();
      result!.func(cpu);

      expect(cpu.getGpr(8)).toBe(42);  // t0 = 42
      expect(cpu.getGpr(9)).toBe(10);  // t1 = 10
      expect(cpu.getGpr(10)).toBe(52); // t2 = 42 + 10 = 52
    });

    it('should compile load/store operations', () =>
    {
      // Store 100 in memory
      memory.sw(MAIN_MEMORY_BASE + 0x100, 100);

      // LW $t0, 0x100($zero)
      memory.sw(MAIN_MEMORY_BASE, 0x8C080100 | (MAIN_MEMORY_BASE >> 16));
      // Wait, that's wrong. Let me use a proper address calculation

      // First load address into register
      // LUI $t1, upper(MAIN_MEMORY_BASE)
      memory.sw(MAIN_MEMORY_BASE, 0x3C090800);
      // LW $t0, 0x100($t1)
      memory.sw(MAIN_MEMORY_BASE + 4, 0x8D280100);
      // SYSCALL
      memory.sw(MAIN_MEMORY_BASE + 8, 0x0000000C);

      const result = generator.generate(
        (addr) => memory.lw(addr),
        MAIN_MEMORY_BASE
      );

      expect(result).not.toBeNull();
      result!.func(cpu);

      expect(cpu.getGpr(8)).toBe(100);
    });

    it('should handle branch instructions', () =>
    {
      // ADDIU $t0, $zero, 5
      memory.sw(MAIN_MEMORY_BASE, 0x24080005);
      // ADDIU $t1, $zero, 5
      memory.sw(MAIN_MEMORY_BASE + 4, 0x24090005);
      // BEQ $t0, $t1, +2
      memory.sw(MAIN_MEMORY_BASE + 8, 0x11090002);
      // NOP (delay slot)
      memory.sw(MAIN_MEMORY_BASE + 12, 0x00000000);

      const result = generator.generate(
        (addr) => memory.lw(addr),
        MAIN_MEMORY_BASE
      );

      expect(result).not.toBeNull();
      const nextPc = result!.func(cpu);

      // Branch should be taken: PC + (2 << 2) + 4 = PC + 12
      expect(nextPc).toBe(MAIN_MEMORY_BASE + 8 + 12);
    });

    it('should handle jump instructions', () =>
    {
      // J to MAIN_MEMORY_BASE + 0x100
      // target26 = (MAIN_MEMORY_BASE + 0x100) >> 2
      const target = (MAIN_MEMORY_BASE + 0x100) >> 2;
      memory.sw(MAIN_MEMORY_BASE, 0x08000000 | target);
      // NOP (delay slot)
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000);

      const result = generator.generate(
        (addr) => memory.lw(addr),
        MAIN_MEMORY_BASE
      );

      expect(result).not.toBeNull();
      const nextPc = result!.func(cpu);

      expect(nextPc).toBe(MAIN_MEMORY_BASE + 0x100);
    });

    it('should handle JAL instruction', () =>
    {
      // JAL to MAIN_MEMORY_BASE + 0x100
      const target = (MAIN_MEMORY_BASE + 0x100) >> 2;
      memory.sw(MAIN_MEMORY_BASE, 0x0C000000 | target);
      // NOP (delay slot)
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000);

      const result = generator.generate(
        (addr) => memory.lw(addr),
        MAIN_MEMORY_BASE
      );

      expect(result).not.toBeNull();
      const nextPc = result!.func(cpu);

      expect(nextPc).toBe(MAIN_MEMORY_BASE + 0x100);
      expect(cpu.getGpr(31)).toBe(MAIN_MEMORY_BASE + 8); // Return address
    });

    it('should skip writes to R0', () =>
    {
      // Try to write to $zero (should be ignored)
      // ADDIU $zero, $zero, 100
      memory.sw(MAIN_MEMORY_BASE, 0x24000064);
      // SYSCALL
      memory.sw(MAIN_MEMORY_BASE + 4, 0x0000000C);

      const result = generator.generate(
        (addr) => memory.lw(addr),
        MAIN_MEMORY_BASE
      );

      expect(result).not.toBeNull();
      result!.func(cpu);

      expect(cpu.getGpr(0)).toBe(0); // $zero is always 0
    });
  });

  describe('Logical Operations', () =>
  {
    it('should compile AND/OR/XOR correctly', () =>
    {
      cpu.setGpr(8, 0xFF00FF00);
      cpu.setGpr(9, 0x0F0F0F0F);

      // AND $t2, $t0, $t1
      memory.sw(MAIN_MEMORY_BASE, 0x01095024);
      // OR $t3, $t0, $t1
      memory.sw(MAIN_MEMORY_BASE + 4, 0x01095825);
      // XOR $t4, $t0, $t1
      memory.sw(MAIN_MEMORY_BASE + 8, 0x01096026);
      // SYSCALL
      memory.sw(MAIN_MEMORY_BASE + 12, 0x0000000C);

      const result = generator.generate(
        (addr) => memory.lw(addr),
        MAIN_MEMORY_BASE
      );

      expect(result).not.toBeNull();
      result!.func(cpu);

      expect(cpu.getGprU(10)).toBe(0x0F000F00); // AND
      expect(cpu.getGprU(11)).toBe(0xFF0FFF0F); // OR
      expect(cpu.getGprU(12)).toBe(0xF00FF00F); // XOR
    });
  });

  describe('Multiply/Divide', () =>
  {
    it('should compile MULT correctly', () =>
    {
      cpu.setGpr(8, 1000);
      cpu.setGpr(9, 2000);

      // MULT $t0, $t1
      memory.sw(MAIN_MEMORY_BASE, 0x01090018);
      // MFLO $t2
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00005012);
      // SYSCALL
      memory.sw(MAIN_MEMORY_BASE + 8, 0x0000000C);

      const result = generator.generate(
        (addr) => memory.lw(addr),
        MAIN_MEMORY_BASE
      );

      expect(result).not.toBeNull();
      result!.func(cpu);

      expect(cpu.getGpr(10)).toBe(2000000);
    });

    it('should compile DIV correctly', () =>
    {
      cpu.setGpr(8, 100);
      cpu.setGpr(9, 7);

      // DIV $t0, $t1
      memory.sw(MAIN_MEMORY_BASE, 0x0109001A);
      // MFLO $t2 (quotient)
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00005012);
      // MFHI $t3 (remainder)
      memory.sw(MAIN_MEMORY_BASE + 8, 0x00005810);
      // SYSCALL
      memory.sw(MAIN_MEMORY_BASE + 12, 0x0000000C);

      const result = generator.generate(
        (addr) => memory.lw(addr),
        MAIN_MEMORY_BASE
      );

      expect(result).not.toBeNull();
      result!.func(cpu);

      expect(cpu.getGpr(10)).toBe(14); // 100 / 7 = 14
      expect(cpu.getGpr(11)).toBe(2);  // 100 % 7 = 2
    });
  });
});

describe('JitCache', () =>
{
  let memory: Memory;
  let cpu: CpuState;
  let cache: JitCache;

  beforeEach(() =>
  {
    memory = new Memory();
    cpu = new CpuState(memory);
    cache = new JitCache(memory);
    cpu.pc = MAIN_MEMORY_BASE;
  });

  describe('Caching', () =>
  {
    it('should cache compiled functions', () =>
    {
      // Simple program
      memory.sw(MAIN_MEMORY_BASE, 0x2408002A); // ADDIU $t0, $zero, 42
      memory.sw(MAIN_MEMORY_BASE + 4, 0x0000000C); // SYSCALL

      // First execution - should compile
      cache.execute(cpu, MAIN_MEMORY_BASE);
      expect(cache.stats.compilations).toBe(1);
      expect(cache.stats.misses).toBe(1);

      // Second execution - should use cache
      cpu.setGpr(8, 0);
      cache.execute(cpu, MAIN_MEMORY_BASE);
      expect(cache.stats.compilations).toBe(1);
      expect(cache.stats.hits).toBe(1);
    });

    it('should invalidate on range', () =>
    {
      memory.sw(MAIN_MEMORY_BASE, 0x2408002A);
      memory.sw(MAIN_MEMORY_BASE + 4, 0x0000000C);

      cache.execute(cpu, MAIN_MEMORY_BASE);
      expect(cache.compiledCount).toBe(1);

      cache.invalidateRange(MAIN_MEMORY_BASE, MAIN_MEMORY_BASE + 8);
      expect(cache.size).toBe(0);
    });

    it('should invalidate all', () =>
    {
      memory.sw(MAIN_MEMORY_BASE, 0x2408002A);
      memory.sw(MAIN_MEMORY_BASE + 4, 0x0000000C);
      memory.sw(MAIN_MEMORY_BASE + 0x100, 0x2409000A);
      memory.sw(MAIN_MEMORY_BASE + 0x104, 0x0000000C);

      cache.execute(cpu, MAIN_MEMORY_BASE);
      cache.execute(cpu, MAIN_MEMORY_BASE + 0x100);
      expect(cache.size).toBe(2);

      cache.invalidateAll();
      expect(cache.size).toBe(0);
    });
  });

  describe('Execution', () =>
  {
    it('should execute simple program', () =>
    {
      memory.sw(MAIN_MEMORY_BASE, 0x2408002A);     // ADDIU $t0, $zero, 42
      memory.sw(MAIN_MEMORY_BASE + 4, 0x2409000A); // ADDIU $t1, $zero, 10
      memory.sw(MAIN_MEMORY_BASE + 8, 0x01095020); // ADD $t2, $t0, $t1
      memory.sw(MAIN_MEMORY_BASE + 12, 0x0000000C); // SYSCALL

      const nextPc = cache.execute(cpu, MAIN_MEMORY_BASE);

      expect(cpu.getGpr(8)).toBe(42);
      expect(cpu.getGpr(9)).toBe(10);
      expect(cpu.getGpr(10)).toBe(52);
      expect(nextPc).toBe(-1); // Syscall
    });

    it('should chain compiled blocks', () =>
    {
      // Block 1: setup and jump
      memory.sw(MAIN_MEMORY_BASE, 0x24080005);     // ADDIU $t0, $zero, 5
      const target = (MAIN_MEMORY_BASE + 0x100) >> 2;
      memory.sw(MAIN_MEMORY_BASE + 4, 0x08000000 | target); // J to +0x100
      memory.sw(MAIN_MEMORY_BASE + 8, 0x00000000); // NOP (delay slot)

      // Block 2: continue and syscall
      memory.sw(MAIN_MEMORY_BASE + 0x100, 0x2409000A); // ADDIU $t1, $zero, 10
      memory.sw(MAIN_MEMORY_BASE + 0x104, 0x0000000C); // SYSCALL

      // Execute block 1
      let nextPc = cache.execute(cpu, MAIN_MEMORY_BASE);
      expect(nextPc).toBe(MAIN_MEMORY_BASE + 0x100);
      expect(cpu.getGpr(8)).toBe(5);

      // Execute block 2
      nextPc = cache.execute(cpu, nextPc);
      expect(cpu.getGpr(9)).toBe(10);
      expect(nextPc).toBe(-1); // Syscall
    });
  });

  describe('Statistics', () =>
  {
    it('should track hit rate', () =>
    {
      memory.sw(MAIN_MEMORY_BASE, 0x2408002A);
      memory.sw(MAIN_MEMORY_BASE + 4, 0x0000000C);

      // First execution - miss
      cache.execute(cpu, MAIN_MEMORY_BASE);
      // Next 4 executions - hits
      for (let i = 0; i < 4; i++)
      {
        cache.execute(cpu, MAIN_MEMORY_BASE);
      }

      expect(cache.stats.hits).toBe(4);
      expect(cache.stats.misses).toBe(1);

      const stats = cache.getStats();
      expect(stats).toContain('Hit rate: 80.0%');
    });
  });
});
