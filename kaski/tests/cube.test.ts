/**
 * Cube.elf Integration Test
 *
 * Tests loading and running the cube.elf sample.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Cpu, CpuMode, CpuStatus } from '../src/core/cpu';
import { Memory } from '../src/core/memory/Memory';
import { ElfFile, Stream, PbpFile, PbpEntry } from '../src/format';
import { EmulatorContext } from '../src/hle';

// Import HLE modules
import * as modules from '../src/hle/module';

/** Register all HLE modules with the context */
function registerAllModules(ctx: EmulatorContext): void
{
  const moduleClasses = [
    modules.SysMemUserForUser,
    modules.ThreadManForUser,
    modules.IoFileMgrForUser,
    modules.sceDisplay,
    modules.sceCtrl,
    modules.sceGe_user,
    modules.sceAudio,
    modules.UtilsForUser,
    modules.LoadExecForUser,
    modules.Kernel_Library,
    modules.sceUtility,
    modules.ModuleMgrForUser,
    modules.StdioForUser,
  ];

  for (const moduleClass of moduleClasses)
  {
    ctx.moduleManager.registerModule(moduleClass as new () => modules.SysMemUserForUser);
  }
}

describe('Cube.elf', () =>
{
  it('should load cube.elf into memory', () =>
  {
    const elfPath = join(__dirname, '../data/samples/cube.elf');
    const elfData = readFileSync(elfPath);

    const stream = new Stream(elfData.buffer);
    const elf = new ElfFile(stream);

    console.log('cube.elf:');
    console.log(`  Entry point: 0x${elf.entryPoint.toString(16)}`);
    console.log(`  Is PRX: ${elf.isPrx}`);
    console.log(`  Segments: ${elf.programHeaders.length}`);
    console.log(`  Sections: ${elf.sectionHeaders.length}`);

    const memory = new Memory();
    const baseAddress = elf.isPrx ? 0x08800000 : 0;
    const { entryPoint, size } = elf.loadIntoMemory(memory, baseAddress);

    console.log(`  Loaded at: 0x${entryPoint.toString(16)}`);
    console.log(`  Size: ${size} bytes`);

    if (elf.isPrx && elf.relocations.length > 0)
    {
      elf.applyRelocations(memory, baseAddress);
      console.log(`  Applied ${elf.relocations.length} relocations`);
    }

    // Verify some code is loaded
    const firstInstr = memory.lw(entryPoint);
    console.log(`  First instruction: 0x${firstInstr.toString(16)}`);

    expect(entryPoint).toBeGreaterThan(0);
    expect(size).toBeGreaterThan(0);
    expect(firstInstr).not.toBe(0);
  });

  it('should execute cube.elf instructions', () =>
  {
    const elfPath = join(__dirname, '../data/samples/cube.elf');
    const elfData = readFileSync(elfPath);

    const stream = new Stream(elfData.buffer);
    const elf = new ElfFile(stream);

    const memory = new Memory();
    const cpu = new Cpu(memory, CpuMode.INTERPRETER);
    const ctx = new EmulatorContext(memory);

    registerAllModules(ctx);

    // Wire up syscall handling
    cpu.setSyscallHandler((cpuState, code) =>
    {
      const func = ctx.moduleManager.getFunction(code);
      if (func)
      {
        // For now just skip syscalls
      }
    });

    // Load ELF
    const baseAddress = elf.isPrx ? 0x08800000 : 0;
    const { entryPoint } = elf.loadIntoMemory(memory, baseAddress);

    if (elf.isPrx && elf.relocations.length > 0)
    {
      elf.applyRelocations(memory, baseAddress);
    }

    // Set up CPU
    cpu.setEntryPoint(entryPoint);
    cpu.state.gpr[29] = 0x09FFF000; // Stack pointer
    cpu.state.gpr[31] = 0; // Return address

    // Run some instructions
    let instructionCount = 0;
    let syscallCount = 0;
    const maxInstructions = 10000;

    while (instructionCount < maxInstructions)
    {
      const status = cpu.step();
      instructionCount++;

      if (status === CpuStatus.SYSCALL)
      {
        syscallCount++;
        // Continue after syscall
        cpu.state.pc = cpu.state.npc;

        // Stop after a few syscalls
        if (syscallCount >= 5)
        {
          break;
        }
        continue;
      }

      if (status === CpuStatus.STOPPED || status === CpuStatus.ERROR)
      {
        break;
      }
    }

    console.log(`  Executed ${instructionCount} instructions`);
    console.log(`  Syscalls: ${syscallCount}`);
    console.log(`  Final PC: 0x${cpu.state.pc.toString(16)}`);

    expect(instructionCount).toBeGreaterThan(100);
  });

  it('should load blend.pbp', () =>
  {
    const pbpPath = join(__dirname, '../data/samples/blend.pbp');
    const pbpData = readFileSync(pbpPath);

    const pbp = PbpFile.fromBuffer(pbpData.buffer);
    console.log('blend.pbp:');
    console.log(`  Magic: 0x${pbp.header.magic.toString(16)}`);

    const elfStream = pbp.readEntry(PbpEntry.DATA_PSP);
    expect(elfStream).not.toBeUndefined();

    const elf = new ElfFile(elfStream!);
    console.log(`  Entry point: 0x${elf.entryPoint.toString(16)}`);
    console.log(`  Is PRX: ${elf.isPrx}`);
    console.log(`  Relocations: ${elf.relocations.length}`);

    const memory = new Memory();
    const baseAddress = elf.isPrx ? 0x08900000 : 0;
    const { entryPoint, size } = elf.loadIntoMemory(memory, baseAddress);

    if (elf.isPrx && elf.relocations.length > 0)
    {
      elf.applyRelocations(memory, baseAddress);
    }

    console.log(`  Loaded size: ${size} bytes`);

    expect(entryPoint).toBeGreaterThan(0);
    expect(size).toBeGreaterThan(0);
  });

  it('should load lights.pbp', () =>
  {
    const pbpPath = join(__dirname, '../data/samples/lights.pbp');
    const pbpData = readFileSync(pbpPath);

    const pbp = PbpFile.fromBuffer(pbpData.buffer);
    const elfStream = pbp.readEntry(PbpEntry.DATA_PSP);
    const elf = new ElfFile(elfStream!);

    console.log('lights.pbp:');
    console.log(`  Entry point: 0x${elf.entryPoint.toString(16)}`);

    const memory = new Memory();
    const baseAddress = elf.isPrx ? 0x08900000 : 0;
    const { entryPoint, size } = elf.loadIntoMemory(memory, baseAddress);

    if (elf.isPrx && elf.relocations.length > 0)
    {
      elf.applyRelocations(memory, baseAddress);
    }

    console.log(`  Loaded size: ${size} bytes`);

    expect(entryPoint).toBeGreaterThan(0);
    expect(size).toBeGreaterThan(0);
  });
});
