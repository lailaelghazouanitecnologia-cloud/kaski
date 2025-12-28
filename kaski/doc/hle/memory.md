# Memory Management

This document describes the PSP memory layout and allocation system.

## PSP Memory Map

```
Address Range         Size    Description
─────────────────────────────────────────────────────────────
0x00000000-0x00000FFF   4KB   Scratchpad (VFPU fast memory)
0x04000000-0x041FFFFF   2MB   VRAM (Video RAM)
0x08000000-0x087FFFFF   8MB   Kernel Memory
0x08800000-0x09FFFFFF  24MB   User Memory
0x0A000000-0x0BFFFFFF  32MB   Extended User (PSP Slim only)
─────────────────────────────────────────────────────────────
0x88000000-0x882FFFFF   3MB   Kernel0 (cached mirror)
0x88300000-0x88FFFFFF  13MB   Kernel1 (cached mirror)
```

## Memory Partitions

The PSP divides memory into partitions for different purposes:

### Partition IDs

| ID | Name         | Address      | Size   | Description                    |
|----|--------------|--------------|--------|--------------------------------|
| 1  | Kernel0      | 0x88000000   | 3MB    | Kernel module space            |
| 2  | Kernel1      | 0x88300000   | 13MB   | Kernel data/heap               |
| 3  | User         | 0x08800000   | 24MB   | User program space             |
| 5  | Volatile     | 0x0A000000   | 4MB    | Volatile partition (reclaimable) |
| 6  | UserStacks   | 0x09F00000   | 1MB    | Thread stack space             |

### Partition Usage

```
User Partition (24MB):
┌──────────────────────────────────────────────┐
│  ELF Program Segments (.text, .data, .bss)   │
├──────────────────────────────────────────────┤
│  Dynamic Allocations (sceKernelAllocMem)     │
├──────────────────────────────────────────────┤
│  Free Space                                  │
└──────────────────────────────────────────────┘

UserStacks Partition (1MB):
┌──────────────────────────────────────────────┐
│  Main Thread Stack                           │
├──────────────────────────────────────────────┤
│  Thread 2 Stack                              │
├──────────────────────────────────────────────┤
│  Thread 3 Stack                              │
├──────────────────────────────────────────────┤
│  ...                                         │
└──────────────────────────────────────────────┘
```

## Memory Allocation

### Allocation Types

```typescript
enum MemoryAnchor {
  Low = 0,           // Allocate from bottom of partition
  High = 1,          // Allocate from top of partition
  Address = 2,       // Allocate at specific address
  LowestAligned = 3, // Allocate at lowest aligned address
  HighestAligned = 4 // Allocate at highest aligned address
}
```

### Tree-Based Allocation

The memory manager uses a tree structure for efficient allocation:

```
Partition (24MB)
├── [FREE] 0x08800000-0x08900000 (1MB)
├── [ALLOC] 0x08900000-0x08940000 (256KB) "elf_text"
├── [FREE] 0x08940000-0x08A00000 (768KB)
├── [ALLOC] 0x08A00000-0x08B00000 (1MB) "game_heap"
└── [FREE] 0x08B00000-0x0A000000 (21MB)
```

### Allocation Process

1. **Find partition**: Look up partition by ID
2. **Search tree**: Find free block of sufficient size
3. **Split block**: Divide into [before][allocated][after]
4. **Merge on free**: Combine adjacent free blocks

```typescript
// Low allocation
partition.allocate(size: 0x10000, anchor: Low)
→ Returns block at lowest available address

// High allocation
partition.allocate(size: 0x10000, anchor: High)
→ Returns block at highest available address

// Address allocation
partition.allocate(size: 0x10000, anchor: Address, addr: 0x08900000)
→ Returns block at exactly 0x08900000 (or null if unavailable)
```

## API Functions

### SysMemUserForUser Module

| NID        | Function                        | Description                    |
|------------|--------------------------------|--------------------------------|
| 0x237DBD4F | sceKernelAllocPartitionMemory  | Allocate from partition        |
| 0xB6D61D02 | sceKernelFreePartitionMemory   | Free allocated block           |
| 0x9D9A5BA1 | sceKernelGetBlockHeadAddr      | Get block address              |
| 0xF919F628 | sceKernelTotalFreeMemSize      | Get total free memory          |
| 0xA291F107 | sceKernelMaxFreeMemSize        | Get largest free block         |

### Usage Example

```typescript
// Allocate 1MB from user partition at low address
const blockId = sceKernelAllocPartitionMemory(
  PartitionId.User,  // partition
  "my_buffer",       // name
  MemoryAnchor.Low,  // type
  0x100000,          // size (1MB)
  0                  // addr (ignored for Low/High)
);

// Get the actual address
const address = sceKernelGetBlockHeadAddr(blockId);

// Use the memory...

// Free when done
sceKernelFreePartitionMemory(blockId);
```

## Memory Block Structure

```typescript
class MemoryPartition {
  id: number;              // Block unique ID
  address: number;         // Start address
  size: number;            // Size in bytes
  allocated: boolean;      // Is this block in use?
  name: string;            // Debug name
  parent: MemoryPartition; // Parent partition
  children: MemoryPartition[]; // Sub-allocations
}
```

## Alignment

Memory allocations should respect alignment requirements:

| Type          | Alignment | Notes                          |
|---------------|-----------|--------------------------------|
| General       | 4 bytes   | MIPS word alignment            |
| DMA buffers   | 64 bytes  | Cache line alignment           |
| VRAM          | 16 bytes  | GPU texture alignment          |
| Stack         | 16 bytes  | ABI requirement                |

## Error Codes

| Error                                  | Code       | Description                    |
|----------------------------------------|------------|--------------------------------|
| ERROR_KERNEL_ILLEGAL_PARTITION_ID      | 0x800200D6 | Invalid partition ID           |
| ERROR_KERNEL_ILLEGAL_MEMBLOCK_ALLOC_TYPE | 0x800200D8 | Invalid allocation type        |
| ERROR_KERNEL_FAILED_ALLOC_MEMBLOCK     | 0x800200D9 | Allocation failed (no space)   |
| ERROR_KERNEL_ILLEGAL_CHUNK_ID          | 0x800200DE | Invalid block ID               |

## Implementation Notes

### Current Implementation

```typescript
class MemoryManager {
  private partitions: Map<PartitionId, MemoryPartition>;
  private nextBlockId: number;

  allocate(partition, size, anchor, address, alignment, name): Result;
  free(block): number;
  getFreeMemory(partition): number;
  getMaxFreeBlock(partition): number;
  findByAddress(address): MemoryPartition | null;
}
```

### Missing Features

- [ ] Memory protection (read/write/execute)
- [ ] Cached vs uncached access (address bit 29)
- [ ] VRAM allocation
- [ ] Scratchpad access
- [ ] Memory info structures (SceKernelSysmemMemoryPartitionInfo)

## Debug Commands

```typescript
// Dump memory map
const map = memoryManager.dump();
console.log(map.join('\n'));

// Output:
// === User ===
// [ALLOC] 0x08800000-0x08840000 (262144 bytes) elf_text
// [FREE] 0x08840000-0x0A000000 (24903680 bytes)
```

## Related Documentation

- [Architecture Overview](./architecture.md)
- [Threading](./threading.md) - Stack allocation
- [Implementing Modules](./implementing-modules.md)
