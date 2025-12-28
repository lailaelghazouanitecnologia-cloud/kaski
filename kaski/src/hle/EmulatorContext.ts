/**
 * Emulator Context
 *
 * Central hub containing all managers and providing
 * cross-component communication.
 */

import type { Memory } from '../core/memory/Memory';
import type { CpuState } from '../core/cpu/CpuState';
import { MemoryManager } from './manager/MemoryManager';
import { ThreadManager, Thread } from './manager/ThreadManager';
import { CallbackManager } from './manager/CallbackManager';
import { ModuleManager } from './manager/ModuleManager';
import { FileManager } from './vfs/FileManager';

/**
 * Emulator Context
 *
 * Holds references to all managers and provides access to
 * CPU state, memory, and HLE functions.
 */
export class EmulatorContext
{
  /** Physical memory */
  readonly memory: Memory;

  /** Memory partition manager */
  readonly memoryManager: MemoryManager;

  /** Thread manager */
  readonly threadManager: ThreadManager;

  /** Callback manager */
  readonly callbackManager: CallbackManager;

  /** Module/syscall manager */
  readonly moduleManager: ModuleManager;

  /** File manager */
  readonly fileManager: FileManager;

  /** Is emulator running? */
  private _running: boolean = false;

  constructor(memory: Memory)
  {
    this.memory = memory;
    this.memoryManager = new MemoryManager();
    this.threadManager = new ThreadManager(this.memoryManager);
    this.callbackManager = new CallbackManager();
    this.moduleManager = new ModuleManager();
    this.fileManager = new FileManager();

    // Set context on module manager
    this.moduleManager.setContext(this);
  }

  /**
   * Reset all managers
   */
  reset(): void
  {
    this._running = false;
    this.memory.reset();
    this.memoryManager.reset();
    this.threadManager.reset();
    this.callbackManager.reset();
    this.moduleManager.reset();
    this.fileManager.reset();
  }

  /**
   * Is emulator running?
   */
  get running(): boolean
  {
    return this._running;
  }

  /**
   * Start emulator
   */
  start(): void
  {
    this._running = true;
  }

  /**
   * Stop emulator
   */
  stop(): void
  {
    this._running = false;
  }

  // ============================================
  // CPU State Access
  // ============================================

  /**
   * Get current thread's CPU state
   */
  get cpu(): CpuState | null
  {
    return this.threadManager.getCurrentThread()?.cpu ?? null;
  }

  /**
   * Get current thread
   */
  get thread(): Thread | null
  {
    return this.threadManager.getCurrentThread();
  }

  // ============================================
  // Quick Access to CPU Registers
  // ============================================

  /** Get GPR value */
  gpr(index: number): number
  {
    return this.cpu?.gpr[index] ?? 0;
  }

  /** Set GPR value */
  setGpr(index: number, value: number): void
  {
    if (this.cpu && index !== 0)
    {
      this.cpu.gpr[index] = value;
    }
  }

  /** Get argument register (a0-a3) */
  arg(index: number): number
  {
    return this.gpr(4 + index);
  }

  /** Set return value (v0) */
  setReturnValue(value: number): void
  {
    this.setGpr(2, value);
  }

  /** Set return values (v0, v1) */
  setReturnValue64(low: number, high: number): void
  {
    this.setGpr(2, low);
    this.setGpr(3, high);
  }

  // ============================================
  // Memory Access Helpers
  // ============================================

  /** Read pointer (address) from argument */
  argPtr(index: number): number
  {
    return this.arg(index) >>> 0;
  }

  /** Read null-terminated string from memory */
  readString(address: number, maxLength: number = 256): string
  {
    return this.memory.readString(address, maxLength);
  }

  /** Write null-terminated string to memory */
  writeString(address: number, str: string): void
  {
    this.memory.writeString(address, str);
  }

  /** Read 32-bit value from memory */
  read32(address: number): number
  {
    return this.memory.lw(address);
  }

  /** Write 32-bit value to memory */
  write32(address: number, value: number): void
  {
    this.memory.sw(address, value);
  }

  /** Read 16-bit value from memory */
  read16(address: number): number
  {
    return this.memory.lhu(address);
  }

  /** Write 16-bit value to memory */
  write16(address: number, value: number): void
  {
    this.memory.sh(address, value);
  }

  /** Read 8-bit value from memory */
  read8(address: number): number
  {
    return this.memory.lbu(address);
  }

  /** Write 8-bit value to memory */
  write8(address: number, value: number): void
  {
    this.memory.sb(address, value);
  }

  // ============================================
  // Logging
  // ============================================

  private logEnabled = true;

  /** Enable/disable logging */
  setLogging(enabled: boolean): void
  {
    this.logEnabled = enabled;
  }

  /** Log a message */
  log(message: string): void
  {
    if (this.logEnabled)
    {
      console.log(`[HLE] ${message}`);
    }
  }

  /** Log a warning */
  warn(message: string): void
  {
    console.warn(`[HLE] ${message}`);
  }

  /** Log an error */
  error(message: string): void
  {
    console.error(`[HLE] ${message}`);
  }
}
