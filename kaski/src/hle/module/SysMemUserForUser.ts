/**
 * SysMemUserForUser
 *
 * System memory allocation module.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { PartitionId, MemoryAnchor } from '../manager/MemoryManager';
import { SceKernelErrors } from '../errors';

@hleModule('SysMemUserForUser')
export class SysMemUserForUser
{
  readonly name = 'SysMemUserForUser';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  /**
   * sceKernelAllocPartitionMemory
   * Allocate memory from a partition
   *
   * @param partition - Partition ID
   * @param name - Block name
   * @param type - Allocation type (0=low, 1=high, 2=addr)
   * @param size - Size to allocate
   * @param addr - Address (for type 2)
   * @returns Block UID or error
   */
  @nativeFunction(0x237DBD4F, 150)
  sceKernelAllocPartitionMemory(): number
  {
    const partition = this.ctx.arg(0) as PartitionId;
    const namePtr = this.ctx.argPtr(1);
    const type = this.ctx.arg(2);
    const size = this.ctx.arg(3);
    const addr = this.ctx.arg(4);

    const name = namePtr ? this.ctx.readString(namePtr) : 'unknown';

    let anchor: MemoryAnchor;
    switch (type)
    {
      case 0: anchor = MemoryAnchor.Low; break;
      case 1: anchor = MemoryAnchor.High; break;
      case 2: anchor = MemoryAnchor.Address; break;
      default:
        return SceKernelErrors.ERROR_KERNEL_ILLEGAL_MEMBLOCK_ALLOC_TYPE;
    }

    const { block, error } = this.ctx.memoryManager.allocate(
      partition,
      size,
      anchor,
      addr,
      1,
      name
    );

    if (!block)
    {
      return error;
    }

    return block.id;
  }

  /**
   * sceKernelFreePartitionMemory
   * Free allocated memory
   *
   * @param blockId - Block UID
   * @returns 0 on success or error
   */
  @nativeFunction(0xB6D61D02, 150)
  sceKernelFreePartitionMemory(): number
  {
    const blockId = this.ctx.arg(0);
    const block = this.ctx.memoryManager.findByAddress(blockId);

    if (!block)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_CHUNK_ID;
    }

    return this.ctx.memoryManager.free(block);
  }

  /**
   * sceKernelGetBlockHeadAddr
   * Get the address of an allocated block
   *
   * @param blockId - Block UID
   * @returns Address or 0
   */
  @nativeFunction(0x9D9A5BA1, 150)
  sceKernelGetBlockHeadAddr(): number
  {
    const blockId = this.ctx.arg(0);
    const block = this.ctx.memoryManager.findByAddress(blockId);

    if (!block)
    {
      return 0;
    }

    return block.address;
  }

  /**
   * sceKernelTotalFreeMemSize
   * Get total free memory in user partition
   *
   * @returns Free memory size
   */
  @nativeFunction(0xF919F628, 150)
  sceKernelTotalFreeMemSize(): number
  {
    return this.ctx.memoryManager.getFreeMemory(PartitionId.User);
  }

  /**
   * sceKernelMaxFreeMemSize
   * Get largest free block in user partition
   *
   * @returns Max free block size
   */
  @nativeFunction(0xA291F107, 150)
  sceKernelMaxFreeMemSize(): number
  {
    return this.ctx.memoryManager.getMaxFreeBlock(PartitionId.User);
  }

  /**
   * sceKernelDevkitVersion
   * Get PSP firmware version
   *
   * @returns Version (e.g., 0x06060010 for 6.60)
   */
  @nativeFunction(0x3FC9AE6A, 150)
  sceKernelDevkitVersion(): number
  {
    // Return 6.60
    return 0x06060010;
  }

  /**
   * sceKernelSetCompiledSdkVersion
   * Set SDK version (no-op)
   */
  @nativeFunction(0x7591C7DB, 150)
  sceKernelSetCompiledSdkVersion(): number
  {
    return 0;
  }

  /**
   * sceKernelSetCompilerVersion
   * Set compiler version (no-op)
   */
  @nativeFunction(0xF77D77CB, 150)
  sceKernelSetCompilerVersion(): number
  {
    return 0;
  }
}
