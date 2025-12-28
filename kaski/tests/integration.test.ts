/**
 * Integration tests - Load and run real PSP programs
 */

import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { Memory } from '../src/core/memory/Memory';
import { Cpu, CpuMode } from '../src/core/cpu';
import { EmulatorContext } from '../src/hle';
import { PbpFile, PbpEntry, ElfFile, Stream } from '../src/format';

// Import all HLE modules
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
    modules.sceRtc,
    modules.scePower,
    modules.sceGe_user,
    modules.sceAudio,
    modules.UtilsForUser,
    modules.LoadExecForUser,
    modules.Kernel_Library,
    modules.sceUtility,
    modules.sceAtrac3plus,
    modules.ModuleMgrForUser,
    modules.StdioForUser,
    modules.sceUmdUser,
    modules.sceDmac,
    modules.sceHprm,
    modules.sceImpose,
    modules.sceSuspendForUser,
    modules.sceReg,
    modules.sceMpeg,
    modules.sceSasCore,
    modules.sceOpenPSID,
    modules.sceVaudio,
    modules.sceWlanDrv,
    modules.InterruptManager,
    modules.UtilsForKernel,
    modules.sceLibFont,
    modules.sceMp3,
    modules.sceNet,
    modules.sceNetInet,
    modules.sceNetAdhoc,
    modules.sceNetAdhocctl,
    modules.sceNetAdhocMatching,
    modules.sceNetApctl,
    modules.sceNetResolver,
    modules.sceHttp,
    modules.sceSsl,
    modules.sceParseHttp,
    modules.sceParseUri,
    modules.sceNp,
    modules.sceNpAuth,
    modules.sceNpService,
    modules.scePspNpDrm_user,
    modules.ExceptionManagerForKernel,
    modules.KDebugForKernel,
    modules.LoadCoreForKernel,
  ];

  for (const moduleClass of moduleClasses)
  {
    ctx.moduleManager.registerModule(moduleClass as new () => modules.SysMemUserForUser);
  }
}

describe('Integration - PBP Loading', () =>
{
  it('should parse rtctest.pbp', () =>
  {
    const data = readFileSync('/home/user/kaski/legacy/data/samples/rtctest.pbp');
    const pbp = PbpFile.fromBuffer(data.buffer);

    expect(pbp.header.magic).toBe(0x50425000);
    expect(pbp.entries[PbpEntry.DATA_PSP].present).toBe(true);

    // Get the ELF data
    const elfStream = pbp.readEntry(PbpEntry.DATA_PSP);
    expect(elfStream).not.toBeUndefined();

    // Parse as ELF
    const elf = new ElfFile(elfStream!);
    expect(elf.header.machine).toBe(8); // MIPS

    console.log('rtctest.pbp:');
    console.log('  Entry point:', '0x' + elf.entryPoint.toString(16));
    console.log('  Is PRX:', elf.isPrx);
    console.log('  Segments:', elf.programHeaders.length);
    console.log('  Sections:', elf.sectionHeaders.length);
    console.log('  Relocations:', elf.relocations.length);

    if (elf.moduleInfo)
    {
      console.log('  Module:', elf.moduleInfo.name);
    }
  });

  it('should load ELF into memory', () =>
  {
    const data = readFileSync('/home/user/kaski/legacy/data/samples/rtctest.pbp');
    const pbp = PbpFile.fromBuffer(data.buffer);
    const elfStream = pbp.readEntry(PbpEntry.DATA_PSP)!;
    const elf = new ElfFile(elfStream);

    const memory = new Memory();

    // Load into memory at base address
    const baseAddress = 0x08800000;
    const { entryPoint, size } = elf.loadIntoMemory(memory, elf.isPrx ? baseAddress : 0);

    console.log('Loaded:');
    console.log('  Entry point:', '0x' + entryPoint.toString(16));
    console.log('  Size:', size, 'bytes');

    // Apply relocations if PRX
    if (elf.isPrx)
    {
      elf.applyRelocations(memory, baseAddress);
      console.log('  Applied', elf.relocations.length, 'relocations');
    }

    // Verify some code is loaded
    const firstInstr = memory.lw(entryPoint);
    expect(firstInstr).not.toBe(0);
    console.log('  First instruction:', '0x' + firstInstr.toString(16));
  });

  it('should create emulator context with modules', () =>
  {
    const memory = new Memory();
    const ctx = new EmulatorContext(memory);

    // Register all modules
    registerAllModules(ctx);

    // Check that modules are registered
    const func = ctx.moduleManager.getFunction(0xE7C27D1B); // sceRtcGetCurrentClockLocalTime
    console.log('sceRtcGetCurrentClockLocalTime:', func ? 'found' : 'not found');

    const displayFunc = ctx.moduleManager.getFunction(0xEEDA2E54); // sceDisplaySetFrameBuf
    console.log('sceDisplaySetFrameBuf:', displayFunc ? 'found' : 'not found');

    const threadFunc = ctx.moduleManager.getFunction(0x446D8DE6); // sceKernelCreateThread
    console.log('sceKernelCreateThread:', threadFunc ? 'found' : 'not found');

    // Should have at least these functions
    expect(func).not.toBeUndefined();
    expect(displayFunc).not.toBeUndefined();
    expect(threadFunc).not.toBeUndefined();
  });

  it('should run simple instructions from loaded ELF', () =>
  {
    const data = readFileSync('/home/user/kaski/legacy/data/samples/rtctest.pbp');
    const pbp = PbpFile.fromBuffer(data.buffer);
    const elfStream = pbp.readEntry(PbpEntry.DATA_PSP)!;
    const elf = new ElfFile(elfStream);

    const memory = new Memory();
    const cpu = new Cpu(memory, CpuMode.INTERPRETER);

    // Load ELF
    const baseAddress = elf.isPrx ? 0x08800000 : 0;
    const { entryPoint } = elf.loadIntoMemory(memory, baseAddress);

    if (elf.isPrx)
    {
      elf.applyRelocations(memory, baseAddress);
    }

    // Set up CPU state
    cpu.state.pc = entryPoint;

    // Run a few instructions (just to test it doesn't crash)
    // In a real emulator, we'd handle syscalls properly
    let instructionsRun = 0;
    const maxInstructions = 100;

    try
    {
      for (let i = 0; i < maxInstructions; i++)
      {
        // Check for syscall
        const instr = memory.lw(cpu.state.pc);
        if ((instr & 0xFC00003F) === 0x0000000C) // syscall
        {
          console.log('  Hit syscall at', '0x' + cpu.state.pc.toString(16));
          break;
        }

        cpu.step();
        instructionsRun++;
      }
    }
    catch (e)
    {
      console.log('  Stopped after', instructionsRun, 'instructions:', (e as Error).message);
    }

    console.log('  Ran', instructionsRun, 'instructions');
    console.log('  PC:', '0x' + cpu.state.pc.toString(16));
    expect(instructionsRun).toBeGreaterThan(0);
  });
});

describe('Integration - Multiple Samples', () =>
{
  const samples = [
    'rtctest.pbp',
    '3dstudio.pbp',
    'blend.pbp',
    'lights.pbp',
  ];

  for (const sample of samples)
  {
    it(`should load ${sample}`, () =>
    {
      const path = `/home/user/kaski/legacy/data/samples/${sample}`;

      try
      {
        const data = readFileSync(path);
        const pbp = PbpFile.fromBuffer(data.buffer);
        const elfStream = pbp.readEntry(PbpEntry.DATA_PSP);

        expect(elfStream).not.toBeUndefined();

        const elf = new ElfFile(elfStream!);
        expect(elf.header.machine).toBe(8);

        console.log(`${sample}: entry=0x${elf.entryPoint.toString(16)}, prx=${elf.isPrx}, relocs=${elf.relocations.length}`);
      }
      catch (e)
      {
        console.log(`${sample}: failed -`, (e as Error).message);
        throw e;
      }
    });
  }
});
