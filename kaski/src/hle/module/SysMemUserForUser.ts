/**
 * SysMemUserForUser
 *
 * System memory allocation module.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { PartitionId, MemoryAnchor } from '../manager/MemoryManager';
import { SceKernelErrors } from '../errors';
import { fromNullable, match } from '../../util/Result';

// Allocation type mapping
const ALLOC_TYPE_MAP: Record<number, MemoryAnchor | undefined> = {
  0: MemoryAnchor.Low,
  1: MemoryAnchor.High,
  2: MemoryAnchor.Address,
};

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
    const anchor = ALLOC_TYPE_MAP[type];
    if (anchor === undefined)
    {
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

    return match(
      fromNullable(this.ctx.memoryManager.findByAddress(blockId), SceKernelErrors.ERROR_KERNEL_ILLEGAL_CHUNK_ID),
      block => this.ctx.memoryManager.free(block),
      error => error
    );
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

    return match(
      fromNullable(this.ctx.memoryManager.findByAddress(blockId), 0),
      block => block.address,
      () => 0
    );
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

  /**
   * sceKernelSetCompiledSdkVersion395
   * Set SDK version for 3.95 (no-op)
   */
  @nativeFunction(0xEBD5C3E6, 150)
  sceKernelSetCompiledSdkVersion395(): number
  {
    const version = this.ctx.arg(0);
    console.log(`sceKernelSetCompiledSdkVersion395: 0x${version.toString(16)}`);
    return 0;
  }

  // Memory block tracking for AllocMemoryBlock/FreeMemoryBlock
  private memoryBlocks = new Map<number, { address: number; size: number }>();
  private nextBlockId = 1;

  /**
   * AllocMemoryBlock
   * Allocate a memory block in user partition
   *
   * @param name - Block name
   * @param type - Allocation type (0=low, 1=high)
   * @param size - Size to allocate
   * @param paramsPtr - Optional params
   * @returns Block ID or error
   */
  @nativeFunction(0xFE707FDF, 150)
  sceKernelAllocMemoryBlock(): number
  {
    const namePtr = this.ctx.argPtr(0);
    const type = this.ctx.arg(1);
    const size = this.ctx.arg(2);
    // paramsPtr = this.ctx.argPtr(3);

    const name = namePtr ? this.ctx.readString(namePtr) : 'unknown';

    if (type !== 0 && type !== 1)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_MEMBLOCK_ALLOC_TYPE;
    }

    if (size === 0)
    {
      return SceKernelErrors.ERROR_KERNEL_FAILED_ALLOC_MEMBLOCK;
    }

    const anchor = type === 0 ? MemoryAnchor.Low : MemoryAnchor.High;
    const { block, error } = this.ctx.memoryManager.allocate(
      PartitionId.User,
      size,
      anchor,
      0,
      1,
      name
    );

    if (!block)
    {
      return error;
    }

    const blockId = this.nextBlockId++;
    this.memoryBlocks.set(blockId, { address: block.address, size });

    return blockId;
  }

  /**
   * GetMemoryBlockAddr
   * Get the address of a memory block
   *
   * @param blockId - Block ID
   * @returns Address or 0
   */
  @nativeFunction(0xDB83A952, 150)
  sceKernelGetMemoryBlockAddr(): number
  {
    const blockId = this.ctx.arg(0);

    const block = this.memoryBlocks.get(blockId);
    if (!block)
    {
      return 0;
    }

    return block.address;
  }

  /**
   * FreeMemoryBlock
   * Free a memory block
   *
   * @param blockId - Block ID
   * @returns 0 or error
   */
  @nativeFunction(0x50F61D8A, 150)
  sceKernelFreeMemoryBlock(): number
  {
    const blockId = this.ctx.arg(0);

    const block = this.memoryBlocks.get(blockId);
    if (!block)
    {
      return SceKernelErrors.ERROR_KERNEL_UNKNOWN_UID;
    }

    // Find and free the block by address
    const memBlock = this.ctx.memoryManager.findByAddress(block.address);
    if (memBlock)
    {
      this.ctx.memoryManager.free(memBlock);
    }

    this.memoryBlocks.delete(blockId);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelPrintf
   * Kernel printf (debug output)
   *
   * @param format - Format string
   * @param ... - Arguments
   * @returns void
   */
  @nativeFunction(0x13A5ABEF, 150)
  sceKernelPrintf(): void
  {
    const formatPtr = this.ctx.argPtr(0);
    if (!formatPtr)
    {
      return;
    }

    const format = this.ctx.readString(formatPtr);
    // For now, just log the format string
    // Full printf implementation would need to parse format specifiers
    console.log(`[PSP] ${format}`);
  }
}
