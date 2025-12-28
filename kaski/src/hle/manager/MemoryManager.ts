/**
 * Memory Manager
 *
 * Manages PSP memory partitions and allocation.
 * Uses a tree-based partition system for efficient memory management.
 */

import { SceKernelErrors } from '../errors';

// ============================================
// Constants
// ============================================

/** Memory partition IDs */
export const enum PartitionId
{
  Kernel0 = 1,
  Kernel1 = 2,
  User = 3,
  Volatile = 5,
  UserStacks = 6,
}

/** Memory allocation anchors */
export const enum MemoryAnchor
{
  Low = 0,       // Allocate from bottom
  High = 1,      // Allocate from top
  Address = 2,   // Allocate at specific address
  LowestAligned = 3, // Allocate at lowest aligned address
  HighestAligned = 4, // Allocate at highest aligned address
}

// Memory layout
const KERNEL0_START = 0x88000000;
const KERNEL0_SIZE = 0x00300000;  // 3MB
const USER_START = 0x08800000;
const USER_SIZE = 0x01800000;     // 24MB
const VOLATILE_START = USER_START + USER_SIZE;
const VOLATILE_SIZE = 0x00400000; // 4MB
const STACK_START = 0x09F00000;
const STACK_SIZE = 0x00100000;    // 1MB

// ============================================
// Memory Partition
// ============================================

/**
 * A memory partition or block
 */
export class MemoryPartition
{
  /** Partition ID */
  id: number;

  /** Start address */
  address: number;

  /** Size in bytes */
  size: number;

  /** Is this block allocated? */
  allocated: boolean;

  /** Block name (for debugging) */
  name: string;

  /** Parent partition */
  parent: MemoryPartition | null;

  /** Child partitions (sub-allocations) */
  children: MemoryPartition[];

  constructor(
    id: number,
    address: number,
    size: number,
    allocated: boolean = false,
    name: string = '',
    parent: MemoryPartition | null = null
  )
  {
    this.id = id;
    this.address = address;
    this.size = size;
    this.allocated = allocated;
    this.name = name;
    this.parent = parent;
    this.children = [];
  }

  /** End address (exclusive) */
  get end(): number
  {
    return this.address + this.size;
  }

  /**
   * Total free memory in this partition
   */
  get freeMemory(): number
  {
    if (this.allocated) return 0;
    if (this.children.length === 0) return this.size;
    return this.children.reduce((sum, child) => sum + child.freeMemory, 0);
  }

  /**
   * Largest contiguous free block
   */
  get maxFreeBlock(): number
  {
    if (this.allocated) return 0;
    if (this.children.length === 0) return this.size;
    return Math.max(...this.children.map(c => c.maxFreeBlock));
  }

  /**
   * Allocate memory from this partition
   */
  allocate(
    size: number,
    anchor: MemoryAnchor = MemoryAnchor.Low,
    address: number = 0,
    alignment: number = 1,
    name: string = ''
  ): MemoryPartition | null
  {
    if (this.allocated) return null;
    if (size > this.size) return null;

    // Align size
    size = (size + alignment - 1) & ~(alignment - 1);

    // If no children, this is a free block
    if (this.children.length === 0)
    {
      return this.allocateFromFreeBlock(size, anchor, address, alignment, name);
    }

    // Try to allocate from children
    const allocators = anchor === MemoryAnchor.High || anchor === MemoryAnchor.HighestAligned
      ? [...this.children].reverse()
      : this.children;

    for (const child of allocators)
    {
      const result = child.allocate(size, anchor, address, alignment, name);
      if (result) return result;
    }

    return null;
  }

  private allocateFromFreeBlock(
    size: number,
    anchor: MemoryAnchor,
    targetAddress: number,
    alignment: number,
    name: string
  ): MemoryPartition | null
  {
    let allocAddress: number;

    switch (anchor)
    {
      case MemoryAnchor.Low:
      case MemoryAnchor.LowestAligned:
        allocAddress = (this.address + alignment - 1) & ~(alignment - 1);
        break;

      case MemoryAnchor.High:
      case MemoryAnchor.HighestAligned:
        allocAddress = (this.end - size) & ~(alignment - 1);
        break;

      case MemoryAnchor.Address:
        allocAddress = (targetAddress + alignment - 1) & ~(alignment - 1);
        if (allocAddress < this.address || allocAddress + size > this.end)
        {
          return null;
        }
        break;

      default:
        return null;
    }

    if (allocAddress < this.address || allocAddress + size > this.end)
    {
      return null;
    }

    // Split this block into [before][allocated][after]
    const before = allocAddress > this.address
      ? new MemoryPartition(0, this.address, allocAddress - this.address, false, '', this)
      : null;

    const allocated = new MemoryPartition(0, allocAddress, size, true, name, this);

    const afterAddr = allocAddress + size;
    const after = afterAddr < this.end
      ? new MemoryPartition(0, afterAddr, this.end - afterAddr, false, '', this)
      : null;

    this.children = [];
    if (before) this.children.push(before);
    this.children.push(allocated);
    if (after) this.children.push(after);

    return allocated;
  }

  /**
   * Free an allocated block
   */
  free(block: MemoryPartition): boolean
  {
    const index = this.children.indexOf(block);
    if (index === -1)
    {
      // Search in children
      for (const child of this.children)
      {
        if (child.free(block)) return true;
      }
      return false;
    }

    // Mark as free
    block.allocated = false;
    block.name = '';
    block.children = [];

    // Merge adjacent free blocks
    this.mergeChildren();

    return true;
  }

  private mergeChildren(): void
  {
    if (this.children.length === 0) return;

    const merged: MemoryPartition[] = [];

    for (const child of this.children)
    {
      if (merged.length > 0)
      {
        const last = merged[merged.length - 1];
        if (!last.allocated && !child.allocated && last.children.length === 0 && child.children.length === 0)
        {
          // Merge
          last.size = child.end - last.address;
          continue;
        }
      }
      merged.push(child);
    }

    this.children = merged;

    // If all children are free and have no sub-children, collapse
    if (this.children.every(c => !c.allocated && c.children.length === 0))
    {
      this.children = [];
    }
  }

  /**
   * Find block by address
   */
  findByAddress(address: number): MemoryPartition | null
  {
    if (address >= this.address && address < this.end)
    {
      if (this.children.length === 0)
      {
        return this.allocated ? this : null;
      }
      for (const child of this.children)
      {
        const found = child.findByAddress(address);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Debug: list all blocks
   */
  listBlocks(depth: number = 0): string[]
  {
    const indent = '  '.repeat(depth);
    const status = this.allocated ? '[ALLOC]' : '[FREE]';
    const result = [
      `${indent}${status} 0x${this.address.toString(16).padStart(8, '0')}-0x${this.end.toString(16).padStart(8, '0')} (${this.size} bytes) ${this.name}`,
    ];
    for (const child of this.children)
    {
      result.push(...child.listBlocks(depth + 1));
    }
    return result;
  }
}

// ============================================
// Memory Manager
// ============================================

/**
 * Memory Manager
 */
export class MemoryManager
{
  private partitions: Map<PartitionId, MemoryPartition> = new Map();
  private nextBlockId: number = 1;

  constructor()
  {
    this.reset();
  }

  /**
   * Reset to initial state
   */
  reset(): void
  {
    this.partitions.clear();
    this.nextBlockId = 1;

    // Create standard partitions
    this.partitions.set(PartitionId.Kernel0, new MemoryPartition(
      PartitionId.Kernel0, KERNEL0_START, KERNEL0_SIZE, false, 'Kernel0'
    ));

    this.partitions.set(PartitionId.User, new MemoryPartition(
      PartitionId.User, USER_START, USER_SIZE, false, 'User'
    ));

    this.partitions.set(PartitionId.Volatile, new MemoryPartition(
      PartitionId.Volatile, VOLATILE_START, VOLATILE_SIZE, false, 'Volatile'
    ));

    this.partitions.set(PartitionId.UserStacks, new MemoryPartition(
      PartitionId.UserStacks, STACK_START, STACK_SIZE, false, 'UserStacks'
    ));
  }

  /**
   * Get partition by ID
   */
  getPartition(id: PartitionId): MemoryPartition | undefined
  {
    return this.partitions.get(id);
  }

  /**
   * Allocate memory block
   */
  allocate(
    partitionId: PartitionId,
    size: number,
    anchor: MemoryAnchor = MemoryAnchor.Low,
    address: number = 0,
    alignment: number = 1,
    name: string = ''
  ): { block: MemoryPartition | null; error: number }
  {
    const partition = this.partitions.get(partitionId);
    if (!partition)
    {
      return { block: null, error: SceKernelErrors.ERROR_KERNEL_ILLEGAL_PARTITION_ID };
    }

    if (size <= 0)
    {
      return { block: null, error: SceKernelErrors.ERROR_KERNEL_ILLEGAL_MEMBLOCK_ALLOC_TYPE };
    }

    const block = partition.allocate(size, anchor, address, alignment, name || `block_${this.nextBlockId}`);
    if (!block)
    {
      return { block: null, error: SceKernelErrors.ERROR_KERNEL_FAILED_ALLOC_MEMBLOCK };
    }

    block.id = this.nextBlockId++;
    return { block, error: SceKernelErrors.ERROR_OK };
  }

  /**
   * Free memory block
   */
  free(block: MemoryPartition): number
  {
    for (const partition of this.partitions.values())
    {
      if (partition.free(block))
      {
        return SceKernelErrors.ERROR_OK;
      }
    }
    return SceKernelErrors.ERROR_KERNEL_ILLEGAL_CHUNK_ID;
  }

  /**
   * Get free memory in partition
   */
  getFreeMemory(partitionId: PartitionId): number
  {
    const partition = this.partitions.get(partitionId);
    return partition?.freeMemory ?? 0;
  }

  /**
   * Get max free block in partition
   */
  getMaxFreeBlock(partitionId: PartitionId): number
  {
    const partition = this.partitions.get(partitionId);
    return partition?.maxFreeBlock ?? 0;
  }

  /**
   * Find block by address
   */
  findByAddress(address: number): MemoryPartition | null
  {
    for (const partition of this.partitions.values())
    {
      const found = partition.findByAddress(address);
      if (found) return found;
    }
    return null;
  }

  /**
   * Debug: dump memory map
   */
  dump(): string[]
  {
    const result: string[] = [];
    for (const partition of this.partitions.values())
    {
      result.push(`=== ${partition.name} ===`);
      result.push(...partition.listBlocks());
    }
    return result;
  }
}
