/**
 * Program Loader
 *
 * High-level program loading and initialization.
 * Handles ELF/PRX loading, import resolution, and execution setup.
 */

import { Memory } from '../core/memory/Memory';
import { Cpu, CpuMode } from '../core/cpu';
import { ElfFile, PbpFile, PbpEntry, Stream } from '../format';
import { EmulatorContext } from './EmulatorContext';
import { SyscallManager } from './manager/SyscallManager';
import { PartitionId, MemoryAnchor } from './manager/MemoryManager';
import { SceKernelErrors } from './errors';

// ============================================
// Constants
// ============================================

/** Default base address for PRX modules */
export const PRX_BASE_ADDRESS = 0x08800000;

/** Default stack size */
export const DEFAULT_STACK_SIZE = 0x10000; // 64KB

/** Stack base address (grows down from here) */
export const STACK_TOP = 0x09FFF000;

/** Default thread priority */
export const DEFAULT_PRIORITY = 32;

// ============================================
// Types
// ============================================

/**
 * Loaded module info
 */
export interface LoadedModule
{
  /** Module name */
  name: string;
  /** Base address */
  baseAddress: number;
  /** Entry point */
  entryPoint: number;
  /** Module size */
  size: number;
  /** GP value */
  gp: number;
  /** Is PRX (relocatable) */
  isPrx: boolean;
}

/**
 * Program loader options
 */
export interface LoadOptions
{
  /** Base address (only for PRX) */
  baseAddress?: number;
  /** Stack size */
  stackSize?: number;
  /** Main thread priority */
  priority?: number;
  /** Arguments to pass to main */
  args?: string[];
}

// ============================================
// Program Loader
// ============================================

/**
 * Program Loader
 */
export class ProgramLoader
{
  private ctx: EmulatorContext;
  private cpu: Cpu;
  private syscallManager: SyscallManager;
  private loadedModules: Map<string, LoadedModule> = new Map();

  constructor(ctx: EmulatorContext, cpu: Cpu, syscallManager: SyscallManager)
  {
    this.ctx = ctx;
    this.cpu = cpu;
    this.syscallManager = syscallManager;

    // Connect syscall handler
    this.cpu.setSyscallHandler((cpu, syscallCode) =>
    {
      const result = this.syscallManager.handleSyscall(cpu.state.pc - 4, syscallCode);
      this.ctx.setReturnValue(result);
    });
  }

  // ============================================
  // Loading
  // ============================================

  /**
   * Load program from PBP file data
   */
  loadPbp(data: ArrayBuffer, options: LoadOptions = {}): LoadedModule
  {
    const pbp = PbpFile.fromBuffer(data);
    const elfStream = pbp.readEntry(PbpEntry.DATA_PSP);

    if (!elfStream)
    {
      throw new Error('PBP does not contain DATA.PSP');
    }

    return this.loadElf(elfStream, options);
  }

  /**
   * Load program from ELF stream
   */
  loadElf(stream: Stream, options: LoadOptions = {}): LoadedModule
  {
    const elf = new ElfFile(stream);
    return this.loadElfFile(elf, options);
  }

  /**
   * Load program from parsed ELF file
   */
  loadElfFile(elf: ElfFile, options: LoadOptions = {}): LoadedModule
  {
    const {
      baseAddress = elf.isPrx ? PRX_BASE_ADDRESS : 0,
      stackSize = DEFAULT_STACK_SIZE,
      priority = DEFAULT_PRIORITY,
    } = options;

    // 1. Load ELF segments into memory
    const { entryPoint, size } = elf.loadIntoMemory(this.ctx.memory, baseAddress);

    // 2. Apply relocations for PRX
    if (elf.isPrx)
    {
      elf.applyRelocations(this.ctx.memory, baseAddress);
    }

    // 3. Parse module info
    const moduleInfo = elf.moduleInfo;
    const moduleName = moduleInfo?.name ?? 'unknown';
    const gp = moduleInfo ? moduleInfo.gp + baseAddress : 0;

    // 4. Parse import tables
    if (moduleInfo)
    {
      const importsStart = moduleInfo.importsStart + baseAddress;
      const importsEnd = moduleInfo.importsEnd + baseAddress;

      if (importsStart < importsEnd)
      {
        this.syscallManager.parseImports(this.ctx.memory, importsStart, importsEnd);
      }
    }

    // 5. Create loaded module info
    const module: LoadedModule = {
      name: moduleName,
      baseAddress,
      entryPoint,
      size,
      gp,
      isPrx: elf.isPrx,
    };

    this.loadedModules.set(moduleName, module);

    return module;
  }

  // ============================================
  // Execution Setup
  // ============================================

  /**
   * Setup main thread for execution
   */
  setupMainThread(module: LoadedModule, options: LoadOptions = {}): number
  {
    const {
      stackSize = DEFAULT_STACK_SIZE,
      priority = DEFAULT_PRIORITY,
      args = [],
    } = options;

    // Create main thread
    const { thread, error } = this.ctx.threadManager.createThread(
      'main',
      module.entryPoint,
      priority,
      stackSize
    );

    if (error !== SceKernelErrors.ERROR_OK || !thread)
    {
      throw new Error(`Failed to create main thread: 0x${error.toString(16)}`);
    }

    // Set GP register
    if (module.gp)
    {
      thread.cpu.gpr[28] = module.gp; // $gp
    }

    // Set up arguments
    // $a0 = argc, $a1 = argv
    thread.cpu.gpr[4] = args.length; // argc
    thread.cpu.gpr[5] = 0; // argv (TODO: allocate and populate)

    // Start the thread
    this.ctx.threadManager.startThread(thread.uid, 0, 0);

    // Set as current thread
    this.ctx.threadManager.setCurrentThread(thread);

    return thread.uid;
  }

  /**
   * Quick setup for running a program
   */
  setupProgram(module: LoadedModule, options: LoadOptions = {}): void
  {
    // Setup main thread
    this.setupMainThread(module, options);

    // Set CPU to entry point (for direct execution without threading)
    this.cpu.state.pc = module.entryPoint;

    // Set stack pointer
    this.cpu.state.gpr[29] = STACK_TOP; // $sp

    // Set GP if available
    if (module.gp)
    {
      this.cpu.state.gpr[28] = module.gp; // $gp
    }

    // Set return address to exit handler
    this.cpu.state.gpr[31] = 0; // $ra = 0 (will trigger exit)

    // Start context
    this.ctx.start();
  }

  // ============================================
  // Utilities
  // ============================================

  /**
   * Get loaded module by name
   */
  getModule(name: string): LoadedModule | undefined
  {
    return this.loadedModules.get(name);
  }

  /**
   * Get all loaded modules
   */
  getModules(): LoadedModule[]
  {
    return Array.from(this.loadedModules.values());
  }

  /**
   * Log program info
   */
  logProgramInfo(module: LoadedModule): void
  {
    console.log('=== Program Loaded ===');
    console.log(`  Name: ${module.name}`);
    console.log(`  Base: 0x${module.baseAddress.toString(16)}`);
    console.log(`  Entry: 0x${module.entryPoint.toString(16)}`);
    console.log(`  Size: ${module.size} bytes`);
    console.log(`  GP: 0x${module.gp.toString(16)}`);
    console.log(`  PRX: ${module.isPrx}`);

    // Log imports
    this.syscallManager.logImports();
  }
}
