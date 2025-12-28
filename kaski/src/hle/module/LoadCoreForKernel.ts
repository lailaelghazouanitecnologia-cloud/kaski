/**
 * LoadCoreForKernel
 *
 * Kernel module loading core.
 * Provides low-level module management functions.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

@hleModule('LoadCoreForKernel')
export class LoadCoreForKernel
{
  readonly name = 'LoadCoreForKernel';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  /**
   * sceKernelIcacheClearAll
   * Clear all instruction cache
   */
  @nativeFunction(0xD8779AC6, 150)
  sceKernelIcacheClearAll(): number
  {
    // In a real emulator, this would invalidate the JIT cache
    // For now, it's a no-op since we recompile as needed
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelFindModuleByUID
   * Find module by UID
   *
   * @param moduleId - Module UID
   * @returns Module info pointer or 0
   */
  @nativeFunction(0xCCE4A157, 150)
  sceKernelFindModuleByUID(): number
  {
    const moduleId = this.ctx.arg(0);
    // Stub - would return module info struct pointer
    console.log(`[LoadCoreForKernel] sceKernelFindModuleByUID(${moduleId})`);
    return 0;
  }

  /**
   * sceKernelFindModuleByName
   * Find module by name
   *
   * @param name - Module name
   * @returns Module info pointer or 0
   */
  @nativeFunction(0xF6B1BF0F, 150)
  sceKernelFindModuleByName(): number
  {
    const namePtr = this.ctx.argPtr(0);
    if (namePtr)
    {
      const name = this.ctx.readStringZ(namePtr);
      console.log(`[LoadCoreForKernel] sceKernelFindModuleByName("${name}")`);
    }
    return 0;
  }

  /**
   * sceKernelFindModuleByAddress
   * Find module by address
   *
   * @param address - Address within module
   * @returns Module info pointer or 0
   */
  @nativeFunction(0xBC99C625, 150)
  sceKernelFindModuleByAddress(): number
  {
    const address = this.ctx.arg(0);
    console.log(`[LoadCoreForKernel] sceKernelFindModuleByAddress(0x${address.toString(16)})`);
    return 0;
  }

  /**
   * sceKernelGetModuleIdList
   * Get list of loaded module IDs
   *
   * @returns 0 on success
   */
  @nativeFunction(0x929B5C69, 150)
  sceKernelGetModuleIdList(): number
  {
    const listPtr = this.ctx.argPtr(0);
    const sizePtr = this.ctx.argPtr(1);
    const countPtr = this.ctx.argPtr(2);

    // No modules loaded
    if (countPtr)
    {
      this.ctx.write32(countPtr, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelDcacheWritebackAll
   * Write back all data cache
   */
  @nativeFunction(0x79D1C3FA, 150)
  sceKernelDcacheWritebackAll(): number
  {
    // No-op in emulator
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelDcacheWritebackInvalidateAll
   * Write back and invalidate all data cache
   */
  @nativeFunction(0xB435DEC5, 150)
  sceKernelDcacheWritebackInvalidateAll(): number
  {
    // No-op in emulator
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelDcacheWritebackRange
   * Write back data cache range
   */
  @nativeFunction(0x3EE30E76, 150)
  sceKernelDcacheWritebackRange(): number
  {
    // No-op in emulator
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelDcacheWritebackInvalidateRange
   * Write back and invalidate data cache range
   */
  @nativeFunction(0x34B9FA9E, 150)
  sceKernelDcacheWritebackInvalidateRange(): number
  {
    // No-op in emulator
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelDcacheInvalidateRange
   * Invalidate data cache range
   */
  @nativeFunction(0xBFA98062, 150)
  sceKernelDcacheInvalidateRange(): number
  {
    // No-op in emulator
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelIcacheInvalidateAll
   * Invalidate all instruction cache
   */
  @nativeFunction(0x920F104A, 150)
  sceKernelIcacheInvalidateAll(): number
  {
    // Would invalidate JIT cache
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelIcacheInvalidateRange
   * Invalidate instruction cache range
   */
  @nativeFunction(0xC2DF770E, 150)
  sceKernelIcacheInvalidateRange(): number
  {
    // Would invalidate JIT cache for range
    return SceKernelErrors.ERROR_OK;
  }
}
