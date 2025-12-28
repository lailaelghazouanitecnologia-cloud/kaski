/**
 * PSP Emulator
 *
 * Main emulator class that orchestrates all PSP subsystems.
 * Handles initialization, file loading, and the main execution loop.
 *
 * Based on: legacy/src/emu/emulator.ts
 */

import { Cpu, CpuStatus } from '../core/cpu/Cpu';
import { Memory } from '../core/memory/Memory';
import { Gpu } from '../core/gpu/Gpu';
import { PspContext, PspDisplay, PspController, PspAudio, PspRtc, PspBattery } from './PspContext';
import { EmulatorContext } from '../hle/EmulatorContext';
import { ThreadManager } from '../hle/manager/ThreadManager';
import { ModuleManager } from '../hle/manager/ModuleManager';
import { CallbackManager } from '../hle/manager/CallbackManager';
import { MemoryManager } from '../hle/manager/MemoryManager';
import { FileManager } from '../hle/manager/FileManager';
import { SyscallManager } from '../hle/manager/SyscallManager';
import { MountableVfs } from '../hle/vfs/MountableVfs';
import { ProgramLoader } from '../hle/ProgramLoader';

// ============================================
// Types
// ============================================

export enum PspState
{
  Stopped,
  Running,
  Paused,
}

export interface PspConfig
{
  /** Use interpreter mode (slower but more accurate) */
  interpreted: boolean;
  /** Enable GPU rendering */
  enableGpu: boolean;
  /** Enable audio output */
  enableAudio: boolean;
  /** Target frame rate */
  targetFps: number;
  /** CPU cycles per frame (333MHz / 60fps) */
  cyclesPerFrame: number;
}

export interface PspStats
{
  fps: number;
  cpuCycles: number;
  gpuCommands: number;
  gpuPrimitives: number;
  gpuVertices: number;
  gpuBatches: number;
}

// ============================================
// Default Implementations
// ============================================

class DefaultDisplay implements PspDisplay
{
  frameBuffer = 0x04000000;
  pixelFormat = 3; // RGBA8888
  width = 480;
  height = 272;
  vcount = 0;

  private vblankResolvers: (() => void)[] = [];

  setFrameBuf(address: number, bufferWidth: number, pixelFormat: number, sync: number): void
  {
    this.frameBuffer = address;
    this.pixelFormat = pixelFormat;
  }

  async waitVblankStart(): Promise<void>
  {
    return new Promise(resolve =>
    {
      this.vblankResolvers.push(resolve);
    });
  }

  getVcount(): number
  {
    return this.vcount;
  }

  /** Called each frame to update vcount and trigger vblank */
  frame(): void
  {
    this.vcount++;
    const resolvers = this.vblankResolvers;
    this.vblankResolvers = [];
    for (const resolve of resolvers)
    {
      resolve();
    }
  }
}

class DefaultController implements PspController
{
  buttons = 0;
  lx = 128;
  ly = 128;

  sample(): void
  {
    // Override in browser implementation
  }

  peekBuffer(count: number): { timestamp: number; buttons: number; lx: number; ly: number }[]
  {
    return [{
      timestamp: Date.now(),
      buttons: this.buttons,
      lx: this.lx,
      ly: this.ly,
    }];
  }

  readBuffer(count: number): { timestamp: number; buttons: number; lx: number; ly: number }[]
  {
    return this.peekBuffer(count);
  }
}

class DefaultAudio implements PspAudio
{
  private channels: Map<number, { samples: number; format: number }> = new Map();
  private nextChannel = 0;

  reserveChannel(sampleCount: number, format: number): number
  {
    const channel = this.nextChannel++;
    this.channels.set(channel, { samples: sampleCount, format });
    return channel;
  }

  releaseChannel(channel: number): void
  {
    this.channels.delete(channel);
  }

  setChannelVolume(channel: number, left: number, right: number): void
  {
    // Override in browser implementation
  }

  async outputBlocking(channel: number, buffer: ArrayBuffer): Promise<number>
  {
    // Override in browser implementation
    return buffer.byteLength / 4; // Assume 16-bit stereo
  }

  async outputPanned(channel: number, left: number, right: number, buffer: ArrayBuffer): Promise<number>
  {
    return this.outputBlocking(channel, buffer);
  }
}

class DefaultRtc implements PspRtc
{
  private baseTime = Date.now();

  getCurrentTick(): bigint
  {
    return BigInt(Date.now() - this.baseTime) * 1000n;
  }

  getTickResolution(): number
  {
    return 1000000; // 1MHz
  }

  getCurrentClock(): Date
  {
    return new Date();
  }
}

class DefaultBattery implements PspBattery
{
  present = true;
  charging = false;
  chargingStatus = 0;
  isLowBattery = false;
  percent = 100;
  lifetime = 300; // 5 hours in minutes
  temperature = 25;
  voltage = 4200; // mV
}

// ============================================
// Main Emulator Class
// ============================================

export class Psp
{
  // ---- State ----
  state: PspState = PspState.Stopped;
  context: PspContext;
  hleContext: EmulatorContext;

  // ---- Hardware ----
  memory: Memory;
  cpu: Cpu;
  gpu: Gpu;

  // ---- Peripherals ----
  display: PspDisplay;
  controller: PspController;
  audio: PspAudio;
  rtc: PspRtc;
  battery: PspBattery;

  // ---- HLE Managers ----
  threadManager: ThreadManager;
  moduleManager: ModuleManager;
  callbackManager: CallbackManager;
  memoryManager: MemoryManager;
  fileManager: FileManager;
  syscallManager: SyscallManager;

  // ---- VFS ----
  rootVfs: MountableVfs;

  // ---- Config ----
  config: PspConfig = {
    interpreted: true,
    enableGpu: true,
    enableAudio: true,
    targetFps: 60,
    cyclesPerFrame: 333333333 / 60, // ~5.5M cycles per frame
  };

  // ---- Stats ----
  stats: PspStats = {
    fps: 0,
    cpuCycles: 0,
    gpuCommands: 0,
    gpuPrimitives: 0,
    gpuVertices: 0,
    gpuBatches: 0,
  };

  // ---- Frame Loop ----
  private frameId: number | null = null;
  private lastFrameTime = 0;
  private frameCount = 0;
  private fpsUpdateTime = 0;

  constructor()
  {
    // Initialize memory
    this.memory = new Memory();

    // Initialize CPU
    this.cpu = new Cpu(this.memory);

    // Initialize GPU
    this.gpu = new Gpu(this.memory);

    // Initialize peripherals with defaults
    this.display = new DefaultDisplay();
    this.controller = new DefaultController();
    this.audio = new DefaultAudio();
    this.rtc = new DefaultRtc();
    this.battery = new DefaultBattery();

    // Initialize HLE managers
    this.memoryManager = new MemoryManager(this.memory);
    this.callbackManager = new CallbackManager();
    this.syscallManager = new SyscallManager(this.memory);
    this.threadManager = new ThreadManager(this.memory, this.callbackManager, this.syscallManager);
    this.moduleManager = new ModuleManager();
    this.fileManager = new FileManager();

    // Initialize VFS
    this.rootVfs = new MountableVfs();

    // Initialize contexts
    this.context = new PspContext();
    this.hleContext = new EmulatorContext(
      this.memory,
      this.syscallManager,
      this.threadManager,
      this.moduleManager,
      this.callbackManager,
      this.memoryManager,
      this.fileManager
    );

    // Wire up syscall handling
    this.cpu.onSyscall = (code) =>
    {
      this.syscallManager.call(code, this.cpu.state);
    };
  }

  /**
   * Initialize the emulator with WebGPU
   */
  async initialize(canvas?: HTMLCanvasElement): Promise<void>
  {
    if (canvas && this.config.enableGpu)
    {
      await this.gpu.initialize(canvas);
    }

    // Initialize context with all components
    this.context.init(
      this.cpu,
      this.gpu,
      this.memory,
      this.display,
      this.controller,
      this.audio,
      this.rtc,
      this.battery,
      this.threadManager,
      this.moduleManager,
      this.callbackManager,
      this.memoryManager,
      this.fileManager,
      this.syscallManager
    );
  }

  /**
   * Reset the emulator to initial state
   */
  reset(): void
  {
    this.stop();
    this.memory.reset();
    this.cpu.reset();
    this.gpu.reset();
    this.context.clearSymbols();
    this.context.setGameInfo('', '');
    this.stats = {
      fps: 0,
      cpuCycles: 0,
      gpuCommands: 0,
      gpuPrimitives: 0,
      gpuVertices: 0,
      gpuBatches: 0,
    };
  }

  /**
   * Load a program from ArrayBuffer
   */
  async loadProgram(data: ArrayBuffer, filename: string = 'program.elf'): Promise<void>
  {
    this.reset();

    const loader = new ProgramLoader(this.hleContext);
    const result = await loader.load(new Uint8Array(data), filename);

    // Register symbols
    for (const [name, address] of result.symbols)
    {
      this.context.registerSymbol(address, name);
    }

    // Set entry point
    this.cpu.setEntryPoint(result.entryPoint);

    // Create main thread
    this.threadManager.createThread('main', result.entryPoint, 32, 0x4000);
  }

  /**
   * Load a program from URL
   */
  async loadUrl(url: string): Promise<void>
  {
    const response = await fetch(url);
    const data = await response.arrayBuffer();
    const filename = url.split('/').pop() || 'program.elf';
    await this.loadProgram(data, filename);
  }

  /**
   * Start emulation
   */
  start(): void
  {
    if (this.state === PspState.Running) return;

    this.state = PspState.Running;
    this.lastFrameTime = performance.now();
    this.fpsUpdateTime = this.lastFrameTime;
    this.frameCount = 0;
    this.scheduleFrame();
  }

  /**
   * Stop emulation
   */
  stop(): void
  {
    if (this.frameId !== null)
    {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.state = PspState.Stopped;
  }

  /**
   * Pause emulation
   */
  pause(): void
  {
    if (this.state !== PspState.Running) return;

    if (this.frameId !== null)
    {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.state = PspState.Paused;
  }

  /**
   * Resume emulation
   */
  resume(): void
  {
    if (this.state !== PspState.Paused) return;

    this.state = PspState.Running;
    this.lastFrameTime = performance.now();
    this.scheduleFrame();
  }

  /**
   * Execute a single step
   */
  step(): CpuStatus
  {
    return this.cpu.step();
  }

  /**
   * Schedule the next frame
   */
  private scheduleFrame(): void
  {
    this.frameId = requestAnimationFrame(() => this.runFrame());
  }

  /**
   * Run a single frame
   */
  private runFrame(): void
  {
    if (this.state !== PspState.Running) return;

    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Sample controller input
    this.controller.sample();

    // Run CPU for this frame's worth of cycles
    const cyclesToRun = Math.floor(this.config.cyclesPerFrame);
    let cyclesRemaining = cyclesToRun;

    while (cyclesRemaining > 0 && this.state === PspState.Running)
    {
      const status = this.cpu.run(Math.min(cyclesRemaining, 10000));

      if (status === CpuStatus.STOPPED || status === CpuStatus.ERROR)
      {
        this.stop();
        return;
      }

      cyclesRemaining -= 10000;
    }

    // Update display
    if (this.display instanceof DefaultDisplay)
    {
      this.display.frame();
    }

    // Render GPU batches
    if (this.config.enableGpu)
    {
      this.gpu.drawSync();
    }

    // Update stats
    this.frameCount++;
    if (now - this.fpsUpdateTime >= 1000)
    {
      this.stats.fps = this.frameCount;
      this.stats.cpuCycles = this.cpu.instructionsExecuted;
      this.stats.gpuCommands = this.gpu.stats.commands;
      this.stats.gpuPrimitives = this.gpu.stats.primitives;
      this.stats.gpuVertices = this.gpu.stats.vertices;
      this.stats.gpuBatches = this.gpu.stats.batches;

      this.frameCount = 0;
      this.fpsUpdateTime = now;
      this.gpu.stats.reset();
    }

    // Schedule next frame
    this.scheduleFrame();
  }

  /**
   * Mount a filesystem
   */
  mount(device: string, vfs: MountableVfs): void
  {
    this.fileManager.mount(device, vfs);
  }

  /**
   * Set custom display implementation
   */
  setDisplay(display: PspDisplay): void
  {
    this.display = display;
  }

  /**
   * Set custom controller implementation
   */
  setController(controller: PspController): void
  {
    this.controller = controller;
  }

  /**
   * Set custom audio implementation
   */
  setAudio(audio: PspAudio): void
  {
    this.audio = audio;
  }
}
