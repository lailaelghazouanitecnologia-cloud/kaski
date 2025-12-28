/**
 * Kaski PSP Emulator - Browser Entry Point
 */

import { Memory } from '../src/core/memory/Memory';
import { Cpu, CpuMode, CpuStatus } from '../src/core/cpu';
import { ElfFile, Stream, PbpFile, PbpEntry } from '../src/format';
import { EmulatorContext } from '../src/hle';
import { Html5Platform } from '../src/psp/html5';
import * as modules from '../src/hle/module';

// ============================================
// Elements
// ============================================

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const fpsEl = document.getElementById('fps') as HTMLSpanElement;
const pcEl = document.getElementById('pc') as HTMLSpanElement;
const instructionsEl = document.getElementById('instructions') as HTMLSpanElement;
const logEl = document.getElementById('log') as HTMLDivElement;

const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const loadBtn = document.getElementById('loadBtn') as HTMLButtonElement;
const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
const stepBtn = document.getElementById('stepBtn') as HTMLButtonElement;
const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;

// ============================================
// State
// ============================================

let memory: Memory | null = null;
let cpu: Cpu | null = null;
let ctx: EmulatorContext | null = null;
let platform: Html5Platform | null = null;

let running = false;
let instructionCount = 0;
let syscallCount = 0;

// Debug: track last PCs for crash debugging
const pcHistory: number[] = [];
const PC_HISTORY_SIZE = 20;

// VRAM constants
const VRAM_BASE = 0x04000000;
const SCREEN_WIDTH = 480;
const SCREEN_HEIGHT = 272;
const BUFFER_WIDTH = 512;

/**
 * Write a test pattern to VRAM
 */
function writeTestPattern(memory: Memory): void
{
  log('Writing test pattern to VRAM...');

  for (let y = 0; y < SCREEN_HEIGHT; y++)
  {
    for (let x = 0; x < SCREEN_WIDTH; x++)
    {
      const offset = (y * BUFFER_WIDTH + x) * 4;
      const addr = VRAM_BASE + offset;

      // Create a colorful gradient pattern
      const r = (x * 255 / SCREEN_WIDTH) | 0;
      const g = (y * 255 / SCREEN_HEIGHT) | 0;
      const b = ((x + y) * 127 / (SCREEN_WIDTH + SCREEN_HEIGHT)) | 0;
      const a = 255;

      // RGBA8888 format (little endian: ABGR in memory)
      const pixel = (a << 24) | (b << 16) | (g << 8) | r;
      memory.sw(addr, pixel);
    }
  }

  log('Test pattern written');
}

// ============================================
// Logging
// ============================================

function log(message: string): void
{
  const time = new Date().toLocaleTimeString();
  logEl.innerHTML += `[${time}] ${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
  console.log(message);
}

function logCrash(status: CpuStatus): void
{
  if (!cpu) return;

  const state = cpu.state;
  log(`=== CPU CRASH: ${CpuStatus[status]} ===`);
  log(`PC: 0x${state.pc.toString(16).padStart(8, '0')}`);
  log(`Instructions executed: ${instructionCount.toLocaleString()}`);

  // Check if PC is in invalid region
  if (state.pc >= 0x04000000 && state.pc < 0x04200000)
  {
    log(`ERROR: PC is in VRAM region! Program jumped to framebuffer.`);
  }
  else if (state.pc < 0x08000000)
  {
    log(`ERROR: PC is below user memory (0x08000000)`);
  }

  // Show key registers
  log(`Registers:`);
  log(`  $ra (r31): 0x${state.gpr[31].toString(16).padStart(8, '0')} (return address)`);
  log(`  $sp (r29): 0x${state.gpr[29].toString(16).padStart(8, '0')} (stack pointer)`);
  log(`  $v0 (r2):  0x${state.gpr[2].toString(16).padStart(8, '0')} (return value)`);
  log(`  $a0 (r4):  0x${state.gpr[4].toString(16).padStart(8, '0')} (arg0)`);

  // Show PC history
  log(`Last ${pcHistory.length} PCs (oldest first):`);
  const historyStr = pcHistory.map(pc => '0x' + pc.toString(16)).join(' -> ');
  log(`  ${historyStr}`);

  // Try to read instruction at crash PC
  if (memory)
  {
    try
    {
      const instr = memory.lwu(state.pc);
      log(`Instruction at PC: 0x${instr.toString(16).padStart(8, '0')}`);
    }
    catch (e)
    {
      log(`Could not read instruction at PC`);
    }
  }

  console.log('Full CPU state:', state);
}

// ============================================
// Module Registration
// ============================================

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

// ============================================
// ROM Loading
// ============================================

async function loadRom(data: ArrayBuffer, filename: string): Promise<void>
{
  log(`Loading: ${filename} (${data.byteLength} bytes)`);

  // Reset state
  memory = new Memory();
  cpu = new Cpu(memory, CpuMode.INTERPRETER);
  ctx = new EmulatorContext(memory);
  instructionCount = 0;
  syscallCount = 0;

  registerAllModules(ctx);

  // Wire up syscall handling
  cpu.setSyscallHandler((cpuRef, code) =>
  {
    const func = ctx!.moduleManager.getFunction(code);
    if (func)
    {
      syscallCount++;
      try
      {
        const result = func.handler(ctx!);
        if (result !== undefined && typeof result === 'number')
        {
          // Set return value in v0 directly on CPU state
          cpuRef.state.gpr[2] = result | 0;
        }
      }
      catch (e)
      {
        log(`Syscall error (${func.name}): ${e}`);
      }
    }
    else
    {
      log(`Unknown syscall: 0x${code.toString(16)}`);
    }
  });

  // Parse file
  let elf: ElfFile;
  let baseAddress: number;

  if (filename.toLowerCase().endsWith('.pbp'))
  {
    log('Parsing PBP file...');
    const pbp = PbpFile.fromBuffer(data);
    const elfStream = pbp.readEntry(PbpEntry.DATA_PSP);

    if (!elfStream)
    {
      throw new Error('PBP file does not contain executable');
    }

    elf = new ElfFile(elfStream);
  }
  else
  {
    log('Parsing ELF file...');
    const stream = new Stream(data);
    elf = new ElfFile(stream);
  }

  log(`Entry point: 0x${elf.entryPoint.toString(16)}`);
  log(`Is PRX: ${elf.isPrx}`);
  log(`Segments: ${elf.programHeaders.length}`);

  // Load into memory
  baseAddress = elf.isPrx ? 0x08800000 : 0;
  const { entryPoint, size } = elf.loadIntoMemory(memory, baseAddress);

  log(`Loaded at: 0x${entryPoint.toString(16)}`);
  log(`Size: ${size} bytes`);

  // Apply relocations if PRX
  if (elf.isPrx && elf.relocations.length > 0)
  {
    elf.applyRelocations(memory, baseAddress);
    log(`Applied ${elf.relocations.length} relocations`);
  }

  // Parse imports and patch stubs
  if (elf.moduleInfo)
  {
    log(`Module: ${elf.moduleInfo.name}`);
    log(`Imports: 0x${elf.moduleInfo.importsStart.toString(16)} - 0x${elf.moduleInfo.importsEnd.toString(16)}`);

    // Parse import table
    const imports = elf.parseImports(memory, baseAddress);
    log(`Found ${imports.length} import modules`);

    for (const imp of imports)
    {
      log(`  - ${imp.moduleName}: ${imp.funcCount} functions`);
    }

    // Patch import stubs with syscall instructions
    const patchCount = elf.patchImportStubs(
      memory,
      (nid, moduleName) =>
      {
        const syscall = ctx!.moduleManager.getSyscallForNid(nid, moduleName);
        if (syscall === undefined)
        {
          log(`  Missing: ${moduleName}::0x${nid.toString(16)}`);
        }
        return syscall;
      }
    );

    log(`Patched ${patchCount} import stubs`);
  }

  // Set up CPU
  cpu.setEntryPoint(entryPoint);
  cpu.state.gpr[29] = 0x09FFF000; // Stack pointer
  cpu.state.gpr[31] = 0; // Return address

  // Create a main thread so HLE modules can access CPU state
  const mainThread = {
    uid: 1,
    name: 'main',
    cpu: cpu.state,
    status: 1, // RUNNING
    callbackAccepting: false,
  };
  // @ts-expect-error - simplified thread for browser
  ctx.threadManager.setCurrentThread(mainThread);

  // Create platform
  platform = new Html5Platform(memory, { canvas, display: { scale: 2 } });
  await platform.init();

  // Write test pattern to VRAM (0x04000000)
  writeTestPattern(memory);

  // Set framebuffer to VRAM
  platform.display.setFrameBuf(0x04000000, 512, 0, 0); // RGBA8888, immediate sync

  // Debug: Check framebuffer setup
  const fb = platform.display.getFrameBuf();
  log(`Framebuffer: addr=0x${fb.address.toString(16)}, width=${fb.bufferWidth}, format=${fb.pixelFormat}`);

  // Debug: Check first pixel in VRAM
  const firstPixel = memory.lwu(VRAM_BASE);
  log(`First VRAM pixel: 0x${firstPixel.toString(16)}`);

  // Render immediately
  platform.html5Display.render();

  // Also render on next frame to ensure visibility
  requestAnimationFrame(() => {
    platform?.html5Display.render();
  });

  log('ROM loaded - gradient should be visible');

  // Enable buttons
  startBtn.disabled = false;
  stepBtn.disabled = false;
  resetBtn.disabled = false;

  updateStats();
}

// ============================================
// Emulation
// ============================================

function step(): void
{
  if (!cpu) return;

  const status = cpu.step();
  instructionCount++;

  if (status === CpuStatus.SYSCALL)
  {
    syscallCount++;
    cpu.state.pc = cpu.state.npc;
  }

  updateStats();
}

function runFrame(): void
{
  if (!cpu || !running) return;

  const instructionsPerFrame = 100000;

  for (let i = 0; i < instructionsPerFrame; i++)
  {
    // Track PC history
    pcHistory.push(cpu.state.pc);
    if (pcHistory.length > PC_HISTORY_SIZE) pcHistory.shift();

    const status = cpu.step();
    instructionCount++;

    if (status === CpuStatus.SYSCALL)
    {
      syscallCount++;
      // Log syscall info
      const code = cpu.state.gpr[2]; // v0 often has syscall code
      log(`Syscall at PC=0x${cpu.state.pc.toString(16)}, code=${code}`);
      cpu.state.pc = cpu.state.npc;
    }
    else if (status === CpuStatus.STOPPED || status === CpuStatus.ERROR)
    {
      running = false;
      logCrash(status);
      break;
    }
  }

  // Update display
  if (platform)
  {
    platform.html5Display.render();
  }

  updateStats();

  if (running)
  {
    requestAnimationFrame(runFrame);
  }
}

function start(): void
{
  if (!cpu) return;

  running = true;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  stepBtn.disabled = true;

  log('Started emulation');
  runFrame();
}

function pause(): void
{
  running = false;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  stepBtn.disabled = false;

  log('Paused emulation');
}

function reset(): void
{
  running = false;
  instructionCount = 0;
  syscallCount = 0;

  if (platform)
  {
    platform.reset();
    platform.html5Display.clear();
  }

  startBtn.disabled = false;
  pauseBtn.disabled = true;
  stepBtn.disabled = false;

  log('Reset');
  updateStats();
}

function updateStats(): void
{
  if (platform)
  {
    fpsEl.textContent = platform.fps.toString();
  }

  if (cpu)
  {
    pcEl.textContent = '0x' + cpu.state.pc.toString(16).padStart(8, '0');
  }

  instructionsEl.textContent = instructionCount.toLocaleString();
}

// ============================================
// Event Handlers
// ============================================

loadBtn.addEventListener('click', () =>
{
  fileInput.click();
});

fileInput.addEventListener('change', async () =>
{
  const file = fileInput.files?.[0];
  if (!file) return;

  try
  {
    const data = await file.arrayBuffer();
    await loadRom(data, file.name);
  }
  catch (error)
  {
    log(`Error: ${error}`);
  }
});

startBtn.addEventListener('click', start);
pauseBtn.addEventListener('click', pause);
stepBtn.addEventListener('click', step);
resetBtn.addEventListener('click', reset);

// Drag and drop
document.body.addEventListener('dragover', (e) =>
{
  e.preventDefault();
  e.stopPropagation();
});

document.body.addEventListener('drop', async (e) =>
{
  e.preventDefault();
  e.stopPropagation();

  const file = e.dataTransfer?.files[0];
  if (!file) return;

  try
  {
    const data = await file.arrayBuffer();
    await loadRom(data, file.name);
  }
  catch (error)
  {
    log(`Error: ${error}`);
  }
});

// ============================================
// Auto-load cube.elf
// ============================================

async function autoLoadCube(): Promise<void>
{
  try
  {
    log('Attempting to load cube.elf...');
    const response = await fetch('/data/samples/cube.elf');

    if (!response.ok)
    {
      log('cube.elf not found, drag and drop a ROM to load');
      return;
    }

    const data = await response.arrayBuffer();
    await loadRom(data, 'cube.elf');
  }
  catch (error)
  {
    log('cube.elf not available, use Load ROM button');
  }
}

// Initialize
log('Kaski PSP Emulator initialized');
autoLoadCube();
