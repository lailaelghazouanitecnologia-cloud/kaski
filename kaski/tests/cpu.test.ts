import { describe, it, expect, beforeEach } from 'bun:test';
import { Cpu, CpuStatus } from '../src/core/cpu';
import { MAIN_MEMORY_BASE } from '../src/core/memory';

describe('Cpu', () => {
  let cpu: Cpu;

  beforeEach(() => {
    cpu = new Cpu();
  });

  describe('Initialization', () => {
    it('should initialize with stopped status', () => {
      expect(cpu.status).toBe(CpuStatus.STOPPED);
    });

    it('should have zero instructions executed', () => {
      expect(cpu.instructionsExecuted).toBe(0);
    });

    it('should have memory and state', () => {
      expect(cpu.memory).toBeDefined();
      expect(cpu.state).toBeDefined();
    });
  });

  describe('Program Loading', () => {
    it('should load binary data', () => {
      const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      cpu.loadBinary(data, MAIN_MEMORY_BASE);

      expect(cpu.memory.lbu(MAIN_MEMORY_BASE)).toBe(0x01);
      expect(cpu.memory.lbu(MAIN_MEMORY_BASE + 1)).toBe(0x02);
      expect(cpu.memory.lbu(MAIN_MEMORY_BASE + 2)).toBe(0x03);
      expect(cpu.memory.lbu(MAIN_MEMORY_BASE + 3)).toBe(0x04);
    });

    it('should load words', () => {
      const words = [0xDEADBEEF, 0xCAFEBABE];
      cpu.loadWords(words, MAIN_MEMORY_BASE);

      expect(cpu.memory.lw(MAIN_MEMORY_BASE)).toBe(0xDEADBEEF | 0);
      expect(cpu.memory.lw(MAIN_MEMORY_BASE + 4)).toBe(0xCAFEBABE | 0);
    });

    it('should set entry point', () => {
      cpu.setEntryPoint(MAIN_MEMORY_BASE, 0x09FFFFF0);

      expect(cpu.pc).toBe(MAIN_MEMORY_BASE);
      expect(cpu.sp).toBe(0x09FFFFF0);
    });
  });

  describe('Execution', () => {
    it('should execute single instruction', () => {
      // ADDIU $t0, $zero, 42 (42 = 0x2A)
      cpu.loadWords([0x2408002A], MAIN_MEMORY_BASE);
      cpu.setEntryPoint(MAIN_MEMORY_BASE);

      const status = cpu.step();

      expect(status).toBe(CpuStatus.RUNNING);
      expect(cpu.getGpr(8)).toBe(42);
      expect(cpu.pc).toBe(MAIN_MEMORY_BASE + 4);
      expect(cpu.instructionsExecuted).toBe(1);
    });

    it('should execute simple program', () => {
      // Program: t0 = 10, t1 = 20, t2 = t0 + t1, syscall
      cpu.loadWords([
        0x2408000A,  // ADDIU $t0, $zero, 10
        0x24090014,  // ADDIU $t1, $zero, 20
        0x01095021,  // ADDU $t2, $t0, $t1
        0x0000000C,  // SYSCALL
      ], MAIN_MEMORY_BASE);
      cpu.setEntryPoint(MAIN_MEMORY_BASE);

      const status = cpu.run(100);

      expect(status).toBe(CpuStatus.SYSCALL);
      expect(cpu.getGpr(8)).toBe(10);   // t0
      expect(cpu.getGpr(9)).toBe(20);   // t1
      expect(cpu.getGpr(10)).toBe(30);  // t2
    });

    it('should handle syscall callback', () => {
      let syscallCode = -1;
      cpu.setSyscallHandler((c, code) => {
        syscallCode = code;
      });

      // SYSCALL with code 0x1234
      // 000000 00000100100011010000 001100
      cpu.loadWords([0x00048D0C], MAIN_MEMORY_BASE);
      cpu.setEntryPoint(MAIN_MEMORY_BASE);

      cpu.step();

      expect(syscallCode).toBe(0x1234);
    });

    it('should run until address', () => {
      cpu.loadWords([
        0x24080001,  // ADDIU $t0, $zero, 1
        0x25080001,  // ADDIU $t0, $t0, 1
        0x25080001,  // ADDIU $t0, $t0, 1
        0x00000000,  // NOP (target)
      ], MAIN_MEMORY_BASE);
      cpu.setEntryPoint(MAIN_MEMORY_BASE);

      const status = cpu.runUntil(MAIN_MEMORY_BASE + 12, 100);

      expect(status).toBe(CpuStatus.STOPPED);
      expect(cpu.getGpr(8)).toBe(3);
      expect(cpu.pc).toBe(MAIN_MEMORY_BASE + 12);
    });
  });

  describe('Breakpoints', () => {
    it('should add and check breakpoints', () => {
      cpu.addBreakpoint(MAIN_MEMORY_BASE + 8);

      expect(cpu.hasBreakpoint(MAIN_MEMORY_BASE + 8)).toBe(true);
      expect(cpu.hasBreakpoint(MAIN_MEMORY_BASE)).toBe(false);
    });

    it('should stop at breakpoint', () => {
      cpu.loadWords([
        0x24080001,  // ADDIU $t0, $zero, 1
        0x25080001,  // ADDIU $t0, $t0, 1  <- breakpoint here
        0x25080001,  // ADDIU $t0, $t0, 1
      ], MAIN_MEMORY_BASE);
      cpu.setEntryPoint(MAIN_MEMORY_BASE);
      cpu.addBreakpoint(MAIN_MEMORY_BASE + 4);

      cpu.step();  // Execute first instruction
      const status = cpu.step();  // Should hit breakpoint

      expect(status).toBe(CpuStatus.BREAKPOINT);
      expect(cpu.pc).toBe(MAIN_MEMORY_BASE + 4);
      expect(cpu.getGpr(8)).toBe(1);  // Only first instruction executed
    });

    it('should remove breakpoints', () => {
      cpu.addBreakpoint(MAIN_MEMORY_BASE);
      cpu.removeBreakpoint(MAIN_MEMORY_BASE);

      expect(cpu.hasBreakpoint(MAIN_MEMORY_BASE)).toBe(false);
    });

    it('should clear all breakpoints', () => {
      cpu.addBreakpoint(MAIN_MEMORY_BASE);
      cpu.addBreakpoint(MAIN_MEMORY_BASE + 4);
      cpu.addBreakpoint(MAIN_MEMORY_BASE + 8);
      cpu.clearBreakpoints();

      expect(cpu.getBreakpoints()).toHaveLength(0);
    });

    it('should allow breakpoint callback to continue', () => {
      cpu.loadWords([
        0x24080001,  // ADDIU $t0, $zero, 1
        0x0000000C,  // SYSCALL
      ], MAIN_MEMORY_BASE);
      cpu.setEntryPoint(MAIN_MEMORY_BASE);
      cpu.addBreakpoint(MAIN_MEMORY_BASE);

      cpu.on({
        onBreakpoint: () => true,  // Continue execution
      });

      const status = cpu.run(10);

      expect(status).toBe(CpuStatus.SYSCALL);
    });
  });

  describe('Disassembly', () => {
    it('should disassemble at address', () => {
      cpu.loadWords([0x012A4021], MAIN_MEMORY_BASE);  // ADDU $t0, $t1, $t2

      const result = cpu.disassembleAt(MAIN_MEMORY_BASE);

      expect(result.mnemonic).toBe('addu');
      expect(result.text).toBe('addu t0, t1, t2');
    });

    it('should disassemble range', () => {
      cpu.loadWords([
        0x24080001,  // ADDIU
        0x012A4021,  // ADDU
        0x0000000C,  // SYSCALL
      ], MAIN_MEMORY_BASE);

      const results = cpu.disassembleRange(MAIN_MEMORY_BASE, 3);

      expect(results).toHaveLength(3);
      expect(results[0].mnemonic).toBe('addiu');
      expect(results[1].mnemonic).toBe('addu');
      expect(results[2].mnemonic).toBe('syscall');
    });
  });

  describe('Reset', () => {
    it('should reset CPU state', () => {
      cpu.loadWords([0x24080001], MAIN_MEMORY_BASE);
      cpu.setEntryPoint(MAIN_MEMORY_BASE);
      cpu.step();

      cpu.reset();

      expect(cpu.status).toBe(CpuStatus.STOPPED);
      expect(cpu.pc).toBe(0);
      expect(cpu.instructionsExecuted).toBe(0);
      expect(cpu.getGpr(8)).toBe(0);
    });
  });

  describe('Register shortcuts', () => {
    it('should access registers via shortcuts', () => {
      cpu.v0 = 100;
      cpu.a0 = 200;
      cpu.sp = 0x09FFFFF0;

      expect(cpu.v0).toBe(100);
      expect(cpu.a0).toBe(200);
      expect(cpu.sp).toBe(0x09FFFFF0);
    });
  });

  describe('Debugging', () => {
    it('should dump CPU state', () => {
      cpu.loadWords([0x24080001], MAIN_MEMORY_BASE);
      cpu.setEntryPoint(MAIN_MEMORY_BASE);

      const dump = cpu.dump();

      expect(dump).toContain('CPU State');
      expect(dump).toContain('STOPPED');
    });

    it('should produce hex dump', () => {
      cpu.loadWords([0xDEADBEEF], MAIN_MEMORY_BASE);

      const hex = cpu.hexDump(MAIN_MEMORY_BASE, 4);

      expect(hex).toContain('ef be ad de');  // Little-endian
    });
  });

  describe('Branch and Jump', () => {
    it('should execute function call and return', () => {
      // Main: call function at MAIN_MEMORY_BASE + 24
      // Function: t0 = 42, return
      // JAL target26 = (0x08000018 >> 2) = 0x02000006
      // JAL encoding = 0x0C000000 | 0x02000006 = 0x0E000006
      cpu.loadWords([
        0x0E000006,  // JAL to 0x08000018 (function)
        0x00000000,  // NOP (delay slot)
        0x0000000C,  // SYSCALL (after return)
        0x00000000,  // padding
        0x00000000,  // padding
        0x00000000,  // padding
        0x2408002A,  // Function: ADDIU $t0, $zero, 42
        0x03E00008,  // JR $ra
        0x00000000,  // NOP (delay slot)
      ], MAIN_MEMORY_BASE);
      cpu.setEntryPoint(MAIN_MEMORY_BASE);

      const status = cpu.run(100);

      expect(status).toBe(CpuStatus.SYSCALL);
      expect(cpu.getGpr(8)).toBe(42);
    });

    it('should execute loop', () => {
      // t0 = 0, t1 = 5
      // loop: t0++, if t0 < t1 goto loop
      // syscall
      cpu.loadWords([
        0x24080000,  // ADDIU $t0, $zero, 0
        0x24090005,  // ADDIU $t1, $zero, 5
        0x25080001,  // loop: ADDIU $t0, $t0, 1
        0x0109082A,  // SLT $at, $t0, $t1
        0x1420FFFD,  // BNE $at, $zero, -3 (back to loop)
        0x00000000,  // NOP (delay slot)
        0x0000000C,  // SYSCALL
      ], MAIN_MEMORY_BASE);
      cpu.setEntryPoint(MAIN_MEMORY_BASE);

      const status = cpu.run(100);

      expect(status).toBe(CpuStatus.SYSCALL);
      expect(cpu.getGpr(8)).toBe(5);  // t0 = 5 after loop
    });
  });

  describe('JIT Execution', () => {
    it('should execute simple program with JIT', () => {
      cpu.loadWords([
        0x2408002A,  // ADDIU $t0, $zero, 42
        0x2409000A,  // ADDIU $t1, $zero, 10
        0x01095020,  // ADD $t2, $t0, $t1
        0x0000000C,  // SYSCALL
      ], MAIN_MEMORY_BASE);
      cpu.setEntryPoint(MAIN_MEMORY_BASE);

      const status = cpu.runJit(100);

      expect(status).toBe(CpuStatus.SYSCALL);
      expect(cpu.getGpr(8)).toBe(42);
      expect(cpu.getGpr(9)).toBe(10);
      expect(cpu.getGpr(10)).toBe(52);
    });

    it('should execute function call with JIT', () => {
      // JAL to function, function sets t0 = 42, returns
      cpu.loadWords([
        0x0E000006,  // JAL to 0x08000018 (function)
        0x00000000,  // NOP (delay slot)
        0x0000000C,  // SYSCALL (after return)
        0x00000000,  // padding
        0x00000000,  // padding
        0x00000000,  // padding
        0x2408002A,  // Function: ADDIU $t0, $zero, 42
        0x03E00008,  // JR $ra
        0x00000000,  // NOP (delay slot)
      ], MAIN_MEMORY_BASE);
      cpu.setEntryPoint(MAIN_MEMORY_BASE);

      const status = cpu.runJit(100);

      expect(status).toBe(CpuStatus.SYSCALL);
      expect(cpu.getGpr(8)).toBe(42);
    });

    it('should report JIT statistics', () => {
      cpu.loadWords([
        0x2408002A,  // ADDIU $t0, $zero, 42
        0x0000000C,  // SYSCALL
      ], MAIN_MEMORY_BASE);
      cpu.setEntryPoint(MAIN_MEMORY_BASE);

      cpu.runJit(100);

      const stats = cpu.getJitStats();
      expect(stats).toContain('Cache size:');
      expect(stats).toContain('Compilations:');
    });

    it('should invalidate JIT cache on reset', () => {
      cpu.loadWords([
        0x2408002A,  // ADDIU $t0, $zero, 42
        0x0000000C,  // SYSCALL
      ], MAIN_MEMORY_BASE);
      cpu.setEntryPoint(MAIN_MEMORY_BASE);

      cpu.runJit(100);
      const statsBeforeReset = cpu.getJitStats();
      expect(statsBeforeReset).toContain('Compilations: 1');

      cpu.reset();

      // After reset, cache should be cleared
      cpu.loadWords([
        0x2408002A,
        0x0000000C,
      ], MAIN_MEMORY_BASE);
      cpu.setEntryPoint(MAIN_MEMORY_BASE);

      cpu.runJit(100);
      const statsAfterReset = cpu.getJitStats();
      expect(statsAfterReset).toContain('Compilations: 1'); // New compilation
    });

    it('should handle breakpoints in JIT mode (at block start)', () => {
      // Breakpoint at start of second block (after jump)
      const funcAddr = MAIN_MEMORY_BASE + 0x100;
      // J encoding: 0x08000000 | (target >> 2)
      // target = 0x08000100, target >> 2 = 0x02000040
      const jInstr = 0x08000000 | ((funcAddr >> 2) & 0x03FFFFFF);

      cpu.loadWords([
        0x24080001,  // ADDIU $t0, $zero, 1
        jInstr,      // J to funcAddr
        0x00000000,  // NOP (delay slot)
        0x0000000C,  // SYSCALL (not reached)
      ], MAIN_MEMORY_BASE);

      cpu.loadWords([
        0x24080002,  // ADDIU $t0, $zero, 2
        0x0000000C,  // SYSCALL
      ], funcAddr);

      cpu.setEntryPoint(MAIN_MEMORY_BASE);

      // Add breakpoint at function entry (start of new block)
      cpu.addBreakpoint(funcAddr);

      const status = cpu.runJit(100);

      expect(status).toBe(CpuStatus.BREAKPOINT);
      expect(cpu.pc).toBe(funcAddr);
      expect(cpu.getGpr(8)).toBe(1);  // First instruction executed
    });

    it('should execute loop with JIT', () => {
      // t0 = 0, t1 = 10
      // loop: t0++, if t0 < t1 goto loop
      cpu.loadWords([
        0x24080000,  // ADDIU $t0, $zero, 0
        0x2409000A,  // ADDIU $t1, $zero, 10
        0x25080001,  // loop: ADDIU $t0, $t0, 1
        0x0109082A,  // SLT $at, $t0, $t1
        0x1420FFFD,  // BNE $at, $zero, -3 (back to loop)
        0x00000000,  // NOP (delay slot)
        0x0000000C,  // SYSCALL
      ], MAIN_MEMORY_BASE);
      cpu.setEntryPoint(MAIN_MEMORY_BASE);

      const status = cpu.runJit(100);

      expect(status).toBe(CpuStatus.SYSCALL);
      expect(cpu.getGpr(8)).toBe(10);  // t0 = 10 after loop
    });
  });
});
