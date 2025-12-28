/**
 * Syscall Manager
 *
 * Bridges CPU syscall instructions to HLE module functions.
 * Maps syscall stub addresses to NIDs for function lookup.
 */

import type { EmulatorContext } from '../EmulatorContext';
import type { ModuleManager, FunctionInfo } from './ModuleManager';
import type { Memory } from '../../core/memory/Memory';

// ============================================
// Constants
// ============================================

/** Standard PSP syscall instruction code */
export const SYSCALL_CODE_USER = 0x206E;

/** Import library entry flags */
export const enum ImportFlags
{
  KERNEL = 0x0001,
  STUB = 0x0002,
  DIRECT_JUMP = 0x0004,
  SYSCALL = 0x0008,
}

// ============================================
// Types
// ============================================

/**
 * Import library info
 */
export interface ImportLibrary
{
  /** Module name */
  name: string;
  /** Flags */
  flags: number;
  /** Size of each entry */
  entrySize: number;
  /** Variable count */
  variableCount: number;
  /** Function count */
  functionCount: number;
  /** Library NID */
  libraryNid: number;
  /** NID table address */
  nidTableAddress: number;
  /** Stub address */
  stubAddress: number;
}

/**
 * Import stub info
 */
export interface ImportStub
{
  /** Stub address (where syscall instruction is) */
  address: number;
  /** Function NID */
  nid: number;
  /** Library name */
  libraryName: string;
}

// ============================================
// Syscall Manager
// ============================================

/**
 * Syscall Manager
 */
export class SyscallManager
{
  /** Map of stub address -> NID */
  private addressToNid: Map<number, number> = new Map();

  /** Map of NID -> stub info */
  private nidToStub: Map<number, ImportStub> = new Map();

  /** Module manager reference */
  private moduleManager: ModuleManager | null = null;

  /** Emulator context */
  private context: EmulatorContext | null = null;

  /** All import libraries */
  private libraries: ImportLibrary[] = [];

  /** All import stubs */
  private stubs: ImportStub[] = [];

  constructor()
  {
  }

  /**
   * Set module manager
   */
  setModuleManager(mm: ModuleManager): void
  {
    this.moduleManager = mm;
  }

  /**
   * Set emulator context
   */
  setContext(ctx: EmulatorContext): void
  {
    this.context = ctx;
  }

  /**
   * Reset to initial state
   */
  reset(): void
  {
    this.addressToNid.clear();
    this.nidToStub.clear();
    this.libraries = [];
    this.stubs = [];
  }

  // ============================================
  // Import Table Parsing
  // ============================================

  /**
   * Parse import libraries from module info
   *
   * @param memory - PSP memory
   * @param importsStart - Start address of imports
   * @param importsEnd - End address of imports
   */
  parseImports(memory: Memory, importsStart: number, importsEnd: number): void
  {
    this.reset();

    let offset = importsStart;

    while (offset < importsEnd)
    {
      // Read import library header (size varies based on version)
      const nameAddress = memory.lw(offset + 0);
      const version = memory.lhu(offset + 4);
      const flags = memory.lhu(offset + 6);
      const entrySize = memory.lbu(offset + 8);
      const variableCount = memory.lbu(offset + 9);
      const functionCount = memory.lhu(offset + 10);
      const libraryNid = memory.lw(offset + 12);
      const nidTableAddress = memory.lw(offset + 16);
      const stubAddress = memory.lw(offset + 20);

      // Read module name
      const name = nameAddress ? memory.readString(nameAddress, 64) : '';

      const library: ImportLibrary = {
        name,
        flags,
        entrySize,
        variableCount,
        functionCount,
        libraryNid,
        nidTableAddress,
        stubAddress,
      };
      this.libraries.push(library);

      // Parse function stubs
      this.parseFunctionStubs(memory, library);

      // Move to next entry (minimum 24 bytes)
      const entryLength = entrySize ? entrySize * 4 : 24;
      offset += entryLength;
    }
  }

  /**
   * Parse function stubs for a library
   */
  private parseFunctionStubs(memory: Memory, library: ImportLibrary): void
  {
    const { name, functionCount, nidTableAddress, stubAddress } = library;

    for (let i = 0; i < functionCount; i++)
    {
      // NID is at nidTableAddress + i * 4
      const nid = memory.lw(nidTableAddress + i * 4);

      // Stub is at stubAddress + i * 8 (2 instructions per stub)
      const address = stubAddress + i * 8;

      const stub: ImportStub = {
        address,
        nid,
        libraryName: name,
      };

      this.stubs.push(stub);
      this.addressToNid.set(address, nid);
      this.nidToStub.set(nid, stub);
    }
  }

  // ============================================
  // Syscall Resolution
  // ============================================

  /**
   * Get NID for syscall address
   *
   * @param address - Address where syscall occurred
   * @returns NID or undefined if not found
   */
  getNid(address: number): number | undefined
  {
    // The syscall instruction is at address
    // The stub starts 4 bytes before (j ra; syscall)
    // So we check both the current address and the stub base
    return this.addressToNid.get(address) ??
           this.addressToNid.get(address - 4) ??
           this.addressToNid.get(address & ~7);  // Align to 8-byte stub
  }

  /**
   * Get stub info for NID
   */
  getStub(nid: number): ImportStub | undefined
  {
    return this.nidToStub.get(nid);
  }

  /**
   * Get function info for NID
   */
  getFunction(nid: number): FunctionInfo | undefined
  {
    return this.moduleManager?.getFunction(nid);
  }

  // ============================================
  // Syscall Execution
  // ============================================

  /**
   * Handle syscall from CPU
   *
   * @param syscallAddress - Address of syscall instruction
   * @param syscallCode - Syscall immediate value
   * @returns Return value for $v0
   */
  handleSyscall(syscallAddress: number, syscallCode: number): number
  {
    // Find NID for this syscall
    const nid = this.getNid(syscallAddress);

    if (nid === undefined)
    {
      console.warn(`[Syscall] Unknown syscall at 0x${syscallAddress.toString(16)} (code: 0x${syscallCode.toString(16)})`);
      return 0;
    }

    // Look up function
    const func = this.moduleManager?.getFunction(nid);

    if (!func)
    {
      const stub = this.nidToStub.get(nid);
      const name = stub ? `${stub.libraryName}` : 'unknown';
      console.warn(`[Syscall] Unimplemented NID 0x${nid.toString(16)} (${name})`);
      return 0;
    }

    // Call the function
    if (!this.context)
    {
      console.error('[Syscall] No context set');
      return 0;
    }

    try
    {
      const result = func.handler(this.context);

      // Handle async results (Promise)
      if (result instanceof Promise)
      {
        // For now, warn about async syscalls
        console.warn(`[Syscall] Async syscall ${func.name} - thread suspension not implemented`);
        return 0;
      }

      return result ?? 0;
    }
    catch (e)
    {
      console.error(`[Syscall] Error in ${func.name}:`, e);
      return 0;
    }
  }

  // ============================================
  // Debug
  // ============================================

  /**
   * Get all registered imports
   */
  getImports(): ImportStub[]
  {
    return [...this.stubs];
  }

  /**
   * Get all import libraries
   */
  getLibraries(): ImportLibrary[]
  {
    return [...this.libraries];
  }

  /**
   * Log import table info
   */
  logImports(): void
  {
    console.log('=== Import Libraries ===');
    for (const lib of this.libraries)
    {
      console.log(`  ${lib.name}: ${lib.functionCount} functions, ${lib.variableCount} variables`);
    }

    console.log('=== Import Stubs ===');
    for (const stub of this.stubs)
    {
      const func = this.moduleManager?.getFunction(stub.nid);
      const status = func ? '✓' : '✗';
      console.log(`  ${status} 0x${stub.address.toString(16)}: NID 0x${stub.nid.toString(16)} (${stub.libraryName})`);
    }
  }
}
