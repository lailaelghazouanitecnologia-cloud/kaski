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
  cpu.setSyscallHandler((cpuState, code) =>
  {
    const func = ctx!.moduleManager.getFunction(code);
    if (func)
    {
      syscallCount++;
      // For now just skip syscalls
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

  // Set up CPU
  cpu.setEntryPoint(entryPoint);
  cpu.state.gpr[29] = 0x09FFF000; // Stack pointer
  cpu.state.gpr[31] = 0; // Return address

  // Create platform
  platform = new Html5Platform(memory, { canvas, display: { scale: 2 } });
  await platform.init();

  log('ROM loaded successfully');

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
    const status = cpu.step();
    instructionCount++;

    if (status === CpuStatus.SYSCALL)
    {
      syscallCount++;
      cpu.state.pc = cpu.state.npc;
    }
    else if (status === CpuStatus.STOPPED || status === CpuStatus.ERROR)
    {
      running = false;
      log(`CPU stopped: ${CpuStatus[status]}`);
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
