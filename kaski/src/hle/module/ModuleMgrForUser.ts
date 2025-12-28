/**
 * ModuleMgrForUser
 *
 * Module management for user mode.
 * Handles loading, starting, and stopping of PRX modules.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * Fake module ID base
 */
const FAKE_MODULE_ID_BASE = 0x08900000;

/**
 * Module info structure offsets
 */
const MODULE_INFO_SIZE = 96;

@hleModule('ModuleMgrForUser')
export class ModuleMgrForUser
{
  readonly name = 'ModuleMgrForUser';

  private ctx!: EmulatorContext;

  // Track loaded modules
  private nextModuleId = 1;
  private loadedModules: Map<number, { path: string; started: boolean }> = new Map();

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
    this.nextModuleId = 1;
    this.loadedModules.clear();
  }

  // ============================================
  // Module Loading
  // ============================================

  /**
   * sceKernelLoadModule
   * Load a module (PRX) from a file
   *
   * @param path - Path to module
   * @param flags - Load flags
   * @param optionPtr - Load options
   * @returns Module ID or error
   */
  @nativeFunction(0x977DE386, 150)
  sceKernelLoadModule(): number
  {
    const pathPtr = this.ctx.argPtr(0);
    const flags = this.ctx.arg(1);
    const optionPtr = this.ctx.argPtr(2);

    const path = this.ctx.readString(pathPtr);
    this.ctx.log(`sceKernelLoadModule("${path}", 0x${flags.toString(16)})`);

    // Create fake module ID
    const moduleId = FAKE_MODULE_ID_BASE + this.nextModuleId++;
    this.loadedModules.set(moduleId, { path, started: false });

    return moduleId;
  }

  /**
   * sceKernelLoadModuleByID
   * Load a module by file descriptor
   *
   * @param fileId - File descriptor
   * @param flags - Load flags
   * @param optionPtr - Load options
   * @returns Module ID or error
   */
  @nativeFunction(0xB7F46618, 150)
  sceKernelLoadModuleByID(): number
  {
    const fileId = this.ctx.arg(0);
    const flags = this.ctx.arg(1);
    const optionPtr = this.ctx.argPtr(2);

    this.ctx.log(`sceKernelLoadModuleByID(${fileId}, 0x${flags.toString(16)})`);

    // Create fake module ID
    const moduleId = FAKE_MODULE_ID_BASE + this.nextModuleId++;
    this.loadedModules.set(moduleId, { path: `fd:${fileId}`, started: false });

    return moduleId;
  }

  // ============================================
  // Module Control
  // ============================================

  /**
   * sceKernelStartModule
   * Start a loaded module
   *
   * @param moduleId - Module ID
   * @param argSize - Argument size
   * @param argPtr - Argument pointer
   * @param statusPtr - Status output
   * @param optionPtr - Start options
   * @returns 0 on success
   */
  @nativeFunction(0x50F0C1EC, 150)
  sceKernelStartModule(): number
  {
    const moduleId = this.ctx.arg(0);
    const argSize = this.ctx.arg(1);
    const argPtr = this.ctx.argPtr(2);
    const statusPtr = this.ctx.argPtr(3);
    const optionPtr = this.ctx.argPtr(4);

    this.ctx.log(`sceKernelStartModule(0x${moduleId.toString(16)}, ${argSize})`);

    const module = this.loadedModules.get(moduleId);
    if (module)
    {
      module.started = true;
    }

    // Write status (0 = success)
    if (statusPtr)
    {
      this.ctx.write32(statusPtr, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelStopModule
   * Stop a running module
   *
   * @param moduleId - Module ID
   * @param argSize - Argument size
   * @param argPtr - Argument pointer
   * @param statusPtr - Status output
   * @param optionPtr - Stop options
   * @returns 0 on success
   */
  @nativeFunction(0xD1FF982A, 150)
  sceKernelStopModule(): number
  {
    const moduleId = this.ctx.arg(0);

    this.ctx.log(`sceKernelStopModule(0x${moduleId.toString(16)})`);

    const module = this.loadedModules.get(moduleId);
    if (module)
    {
      module.started = false;
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelUnloadModule
   * Unload a module
   *
   * @param moduleId - Module ID
   * @returns 0 on success
   */
  @nativeFunction(0x2E0911AA, 150)
  sceKernelUnloadModule(): number
  {
    const moduleId = this.ctx.arg(0);

    this.ctx.log(`sceKernelUnloadModule(0x${moduleId.toString(16)})`);

    this.loadedModules.delete(moduleId);

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelSelfStopUnloadModule
   * Stop and unload the current module
   *
   * @param unknown - Unknown
   * @param argSize - Argument size
   * @param argPtr - Argument pointer
   * @returns Does not return (stops execution)
   */
  @nativeFunction(0xD675EBB8, 150)
  sceKernelSelfStopUnloadModule(): number
  {
    const unknown = this.ctx.arg(0);
    const argSize = this.ctx.arg(1);
    const argPtr = this.ctx.argPtr(2);

    this.ctx.log(`sceKernelSelfStopUnloadModule(${unknown}, ${argSize})`);

    // Stop the emulator
    this.ctx.stop();

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelStopUnloadSelfModule
   * Stop and unload self (alias)
   */
  @nativeFunction(0xCC1D3699, 150)
  sceKernelStopUnloadSelfModule(): number
  {
    this.ctx.log('sceKernelStopUnloadSelfModule()');
    this.ctx.stop();
    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Module Info
  // ============================================

  /**
   * sceKernelGetModuleId
   * Get current module ID
   *
   * @returns Module ID
   */
  @nativeFunction(0xF0A26395, 150)
  sceKernelGetModuleId(): number
  {
    // Return a fake module ID for the main module
    return FAKE_MODULE_ID_BASE;
  }

  /**
   * sceKernelGetModuleIdByAddress
   * Get module ID by code address
   *
   * @param address - Code address
   * @returns Module ID
   */
  @nativeFunction(0xD8B73127, 150)
  sceKernelGetModuleIdByAddress(): number
  {
    const address = this.ctx.arg(0);

    this.ctx.log(`sceKernelGetModuleIdByAddress(0x${address.toString(16)})`);

    // Return main module ID for any address
    return FAKE_MODULE_ID_BASE;
  }

  /**
   * sceKernelGetModuleIdList
   * Get list of loaded module IDs
   *
   * @param readBufPtr - Output buffer
   * @param readBufSize - Buffer size
   * @param idCountPtr - Output count
   * @returns 0 on success
   */
  @nativeFunction(0x644CF255, 150)
  sceKernelGetModuleIdList(): number
  {
    const readBufPtr = this.ctx.argPtr(0);
    const readBufSize = this.ctx.arg(1);
    const idCountPtr = this.ctx.argPtr(2);

    const maxCount = Math.floor(readBufSize / 4);
    let count = 0;

    // Write main module
    if (count < maxCount)
    {
      this.ctx.write32(readBufPtr + count * 4, FAKE_MODULE_ID_BASE);
      count++;
    }

    // Write loaded modules
    for (const moduleId of this.loadedModules.keys())
    {
      if (count >= maxCount) break;
      this.ctx.write32(readBufPtr + count * 4, moduleId);
      count++;
    }

    if (idCountPtr)
    {
      this.ctx.write32(idCountPtr, count);
    }

    return SceKernelErrors.ERROR_OK;
  }
}
