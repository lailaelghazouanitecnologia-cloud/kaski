/**
 * PSP Context
 *
 * Central context container that holds references to all PSP subsystems.
 * Passed between components for cross-system communication.
 *
 * Based on: legacy/src/emu/context.ts
 */

import type { Cpu } from '../core/cpu/Cpu';
import type { CpuState } from '../core/cpu/CpuState';
import type { Memory } from '../core/memory/Memory';
import type { Gpu } from '../core/gpu/Gpu';
import type { ThreadManager } from '../hle/manager/ThreadManager';
import type { ModuleManager } from '../hle/manager/ModuleManager';
import type { CallbackManager } from '../hle/manager/CallbackManager';
import type { MemoryManager } from '../hle/manager/MemoryManager';
import type { FileManager } from '../hle/manager/FileManager';
import type { SyscallManager } from '../hle/manager/SyscallManager';

// ============================================
// Types
// ============================================

export interface PspDisplay
{
  frameBuffer: number;
  pixelFormat: number;
  width: number;
  height: number;
  vcount: number;

  setFrameBuf(address: number, bufferWidth: number, pixelFormat: number, sync: number): void;
  waitVblankStart(): Promise<void>;
  getVcount(): number;
}

export interface PspController
{
  buttons: number;
  lx: number;
  ly: number;

  sample(): void;
  peekBuffer(count: number): ControllerData[];
  readBuffer(count: number): ControllerData[];
}

export interface ControllerData
{
  timestamp: number;
  buttons: number;
  lx: number;
  ly: number;
}

export interface PspAudio
{
  reserveChannel(sampleCount: number, format: number): number;
  releaseChannel(channel: number): void;
  setChannelVolume(channel: number, left: number, right: number): void;
  outputBlocking(channel: number, buffer: ArrayBuffer): Promise<number>;
  outputPanned(channel: number, left: number, right: number, buffer: ArrayBuffer): Promise<number>;
}

export interface PspRtc
{
  getCurrentTick(): bigint;
  getTickResolution(): number;
  getCurrentClock(): Date;
}

export interface PspBattery
{
  present: boolean;
  charging: boolean;
  chargingStatus: number;
  isLowBattery: boolean;
  percent: number;
  lifetime: number;
  temperature: number;
  voltage: number;
}

// ============================================
// Context
// ============================================

export class PspContext
{
  // ---- Hardware ----
  cpu!: Cpu;
  gpu!: Gpu;
  memory!: Memory;

  // ---- Peripherals ----
  display!: PspDisplay;
  controller!: PspController;
  audio!: PspAudio;
  rtc!: PspRtc;
  battery!: PspBattery;

  // ---- HLE Managers ----
  threadManager!: ThreadManager;
  moduleManager!: ModuleManager;
  callbackManager!: CallbackManager;
  memoryManager!: MemoryManager;
  fileManager!: FileManager;
  syscallManager!: SyscallManager;

  // ---- Game Info ----
  gameTitle: string = '';
  gameId: string = '';
  gameVersion: string = '';
  gameRegion: string = '';

  // ---- Symbols (for debugging) ----
  private symbols: Map<number, string> = new Map();

  /**
   * Initialize context with all subsystems
   */
  init(
    cpu: Cpu,
    gpu: Gpu,
    memory: Memory,
    display: PspDisplay,
    controller: PspController,
    audio: PspAudio,
    rtc: PspRtc,
    battery: PspBattery,
    threadManager: ThreadManager,
    moduleManager: ModuleManager,
    callbackManager: CallbackManager,
    memoryManager: MemoryManager,
    fileManager: FileManager,
    syscallManager: SyscallManager
  ): void
  {
    this.cpu = cpu;
    this.gpu = gpu;
    this.memory = memory;
    this.display = display;
    this.controller = controller;
    this.audio = audio;
    this.rtc = rtc;
    this.battery = battery;
    this.threadManager = threadManager;
    this.moduleManager = moduleManager;
    this.callbackManager = callbackManager;
    this.memoryManager = memoryManager;
    this.fileManager = fileManager;
    this.syscallManager = syscallManager;
  }

  /**
   * Get current thread's CPU state
   */
  get currentState(): CpuState
  {
    return this.cpu.state;
  }

  /**
   * Set game metadata from PSF
   */
  setGameInfo(title: string, id: string, version: string = '', region: string = ''): void
  {
    this.gameTitle = title;
    this.gameId = id;
    this.gameVersion = version;
    this.gameRegion = region;
  }

  /**
   * Register a symbol for debugging
   */
  registerSymbol(address: number, name: string): void
  {
    this.symbols.set(address, name);
  }

  /**
   * Get symbol name for address
   */
  getSymbol(address: number): string | undefined
  {
    return this.symbols.get(address);
  }

  /**
   * Find symbol by name
   */
  findSymbol(name: string): number | undefined
  {
    for (const [addr, sym] of this.symbols)
    {
      if (sym === name) return addr;
    }
    return undefined;
  }

  /**
   * Clear all symbols
   */
  clearSymbols(): void
  {
    this.symbols.clear();
  }
}
