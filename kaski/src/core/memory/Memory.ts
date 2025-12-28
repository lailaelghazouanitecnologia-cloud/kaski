import {
  ADDRESS_MASK,
  MAIN_MEMORY_BASE,
  MAIN_MEMORY_SIZE,
  VRAM_BASE,
  VRAM_SIZE,
  SCRATCHPAD_BASE,
  SCRATCHPAD_SIZE,
  LWR_MASK,
  LWR_SHIFT,
  LWL_MASK,
  LWL_SHIFT,
  SWL_MASK,
  SWL_SHIFT,
  SWR_MASK,
  SWR_SHIFT,
} from './constants';

/**
 * PSP Memory Implementation
 *
 * Provides access to the PSP's memory space including:
 * - Main RAM (32MB)
 * - VRAM (2MB)
 * - Scratchpad (16KB)
 *
 * Uses typed arrays for efficient memory access.
 */
export class Memory {
  /** Main RAM buffer */
  private readonly mainBuffer: ArrayBuffer;
  private readonly mainU8: Uint8Array;
  private readonly mainU16: Uint16Array;
  private readonly mainU32: Uint32Array;
  private readonly mainI8: Int8Array;
  private readonly mainI16: Int16Array;
  private readonly mainI32: Int32Array;
  private readonly mainF32: Float32Array;

  /** VRAM buffer */
  private readonly vramBuffer: ArrayBuffer;
  private readonly vramU8: Uint8Array;
  private readonly vramU32: Uint32Array;

  /** Scratchpad buffer */
  private readonly scratchpadBuffer: ArrayBuffer;
  private readonly scratchpadU8: Uint8Array;
  private readonly scratchpadU32: Uint32Array;

  constructor() {
    // Initialize main memory (32MB)
    this.mainBuffer = new ArrayBuffer(MAIN_MEMORY_SIZE);
    this.mainU8 = new Uint8Array(this.mainBuffer);
    this.mainU16 = new Uint16Array(this.mainBuffer);
    this.mainU32 = new Uint32Array(this.mainBuffer);
    this.mainI8 = new Int8Array(this.mainBuffer);
    this.mainI16 = new Int16Array(this.mainBuffer);
    this.mainI32 = new Int32Array(this.mainBuffer);
    this.mainF32 = new Float32Array(this.mainBuffer);

    // Initialize VRAM (2MB)
    this.vramBuffer = new ArrayBuffer(VRAM_SIZE);
    this.vramU8 = new Uint8Array(this.vramBuffer);
    this.vramU32 = new Uint32Array(this.vramBuffer);

    // Initialize scratchpad (16KB)
    this.scratchpadBuffer = new ArrayBuffer(SCRATCHPAD_SIZE);
    this.scratchpadU8 = new Uint8Array(this.scratchpadBuffer);
    this.scratchpadU32 = new Uint32Array(this.scratchpadBuffer);
  }

  /**
   * Reset all memory to zero
   */
  reset(): void {
    this.mainU8.fill(0);
    this.vramU8.fill(0);
    this.scratchpadU8.fill(0);
  }

  /**
   * Convert virtual address to physical address
   */
  private mask(address: number): number {
    return address & ADDRESS_MASK;
  }

  /**
   * Check if address is in main memory range
   */
  private isMainMemory(address: number): boolean {
    const masked = this.mask(address);
    return masked >= MAIN_MEMORY_BASE && masked < MAIN_MEMORY_BASE + MAIN_MEMORY_SIZE;
  }

  /**
   * Check if address is in VRAM range
   */
  private isVram(address: number): boolean {
    const masked = this.mask(address);
    return masked >= VRAM_BASE && masked < VRAM_BASE + VRAM_SIZE;
  }

  /**
   * Check if address is in scratchpad range
   */
  private isScratchpad(address: number): boolean {
    const masked = this.mask(address);
    return masked >= SCRATCHPAD_BASE && masked < SCRATCHPAD_BASE + SCRATCHPAD_SIZE;
  }

  /**
   * Get offset within main memory
   */
  private mainOffset(address: number): number {
    return this.mask(address) - MAIN_MEMORY_BASE;
  }

  /**
   * Get offset within VRAM
   */
  private vramOffset(address: number): number {
    return this.mask(address) - VRAM_BASE;
  }

  /**
   * Get offset within scratchpad
   */
  private scratchpadOffset(address: number): number {
    return this.mask(address) - SCRATCHPAD_BASE;
  }

  // ============================================
  // Load operations (read from memory)
  // ============================================

  /**
   * Load byte (signed) - LB instruction
   */
  lb(address: number): number {
    if (this.isMainMemory(address)) {
      return this.mainI8[this.mainOffset(address)];
    }
    if (this.isVram(address)) {
      return (this.vramU8[this.vramOffset(address)] << 24) >> 24;
    }
    if (this.isScratchpad(address)) {
      return (this.scratchpadU8[this.scratchpadOffset(address)] << 24) >> 24;
    }
    return 0;
  }

  /**
   * Load byte unsigned - LBU instruction
   */
  lbu(address: number): number {
    if (this.isMainMemory(address)) {
      return this.mainU8[this.mainOffset(address)];
    }
    if (this.isVram(address)) {
      return this.vramU8[this.vramOffset(address)];
    }
    if (this.isScratchpad(address)) {
      return this.scratchpadU8[this.scratchpadOffset(address)];
    }
    return 0;
  }

  /**
   * Load halfword (signed) - LH instruction
   */
  lh(address: number): number {
    if (this.isMainMemory(address)) {
      return this.mainI16[this.mainOffset(address) >>> 1];
    }
    if (this.isVram(address)) {
      const offset = this.vramOffset(address);
      return ((this.vramU8[offset] | (this.vramU8[offset + 1] << 8)) << 16) >> 16;
    }
    if (this.isScratchpad(address)) {
      const offset = this.scratchpadOffset(address);
      return ((this.scratchpadU8[offset] | (this.scratchpadU8[offset + 1] << 8)) << 16) >> 16;
    }
    return 0;
  }

  /**
   * Load halfword unsigned - LHU instruction
   */
  lhu(address: number): number {
    if (this.isMainMemory(address)) {
      return this.mainU16[this.mainOffset(address) >>> 1];
    }
    if (this.isVram(address)) {
      const offset = this.vramOffset(address);
      return this.vramU8[offset] | (this.vramU8[offset + 1] << 8);
    }
    if (this.isScratchpad(address)) {
      const offset = this.scratchpadOffset(address);
      return this.scratchpadU8[offset] | (this.scratchpadU8[offset + 1] << 8);
    }
    return 0;
  }

  /**
   * Load word (signed) - LW instruction
   */
  lw(address: number): number {
    if (this.isMainMemory(address)) {
      return this.mainI32[this.mainOffset(address) >>> 2];
    }
    if (this.isVram(address)) {
      return this.vramU32[this.vramOffset(address) >>> 2] | 0;
    }
    if (this.isScratchpad(address)) {
      return this.scratchpadU32[this.scratchpadOffset(address) >>> 2] | 0;
    }
    return 0;
  }

  /**
   * Load word unsigned - LWU instruction
   */
  lwu(address: number): number {
    if (this.isMainMemory(address)) {
      return this.mainU32[this.mainOffset(address) >>> 2];
    }
    if (this.isVram(address)) {
      return this.vramU32[this.vramOffset(address) >>> 2];
    }
    if (this.isScratchpad(address)) {
      return this.scratchpadU32[this.scratchpadOffset(address) >>> 2];
    }
    return 0;
  }

  /**
   * Load word for coprocessor 1 (float) - LWC1 instruction
   */
  lwc1(address: number): number {
    if (this.isMainMemory(address)) {
      return this.mainF32[this.mainOffset(address) >>> 2];
    }
    // For VRAM/scratchpad, reinterpret as float
    const intVal = this.lwu(address);
    const tempBuffer = new ArrayBuffer(4);
    new Uint32Array(tempBuffer)[0] = intVal;
    return new Float32Array(tempBuffer)[0];
  }

  /**
   * Load word left - LWL instruction (for unaligned access)
   */
  lwl(address: number, currentValue: number): number {
    const align = address & 3;
    const aligned = address & ~3;
    const memValue = this.lwu(aligned);
    return (memValue << LWL_SHIFT[align]) | (currentValue & LWL_MASK[align]);
  }

  /**
   * Load word right - LWR instruction (for unaligned access)
   */
  lwr(address: number, currentValue: number): number {
    const align = address & 3;
    const aligned = address & ~3;
    const memValue = this.lwu(aligned);
    return (memValue >>> LWR_SHIFT[align]) | (currentValue & LWR_MASK[align]);
  }

  // ============================================
  // Store operations (write to memory)
  // ============================================

  /**
   * Store byte - SB instruction
   */
  sb(address: number, value: number): void {
    if (this.isMainMemory(address)) {
      this.mainU8[this.mainOffset(address)] = value & 0xFF;
    } else if (this.isVram(address)) {
      this.vramU8[this.vramOffset(address)] = value & 0xFF;
    } else if (this.isScratchpad(address)) {
      this.scratchpadU8[this.scratchpadOffset(address)] = value & 0xFF;
    }
  }

  /**
   * Store halfword - SH instruction
   */
  sh(address: number, value: number): void {
    if (this.isMainMemory(address)) {
      this.mainU16[this.mainOffset(address) >>> 1] = value & 0xFFFF;
    } else if (this.isVram(address)) {
      const offset = this.vramOffset(address);
      this.vramU8[offset] = value & 0xFF;
      this.vramU8[offset + 1] = (value >>> 8) & 0xFF;
    } else if (this.isScratchpad(address)) {
      const offset = this.scratchpadOffset(address);
      this.scratchpadU8[offset] = value & 0xFF;
      this.scratchpadU8[offset + 1] = (value >>> 8) & 0xFF;
    }
  }

  /**
   * Store word - SW instruction
   */
  sw(address: number, value: number): void {
    if (this.isMainMemory(address)) {
      this.mainU32[this.mainOffset(address) >>> 2] = value >>> 0;
    } else if (this.isVram(address)) {
      this.vramU32[this.vramOffset(address) >>> 2] = value >>> 0;
    } else if (this.isScratchpad(address)) {
      this.scratchpadU32[this.scratchpadOffset(address) >>> 2] = value >>> 0;
    }
  }

  /**
   * Store word from coprocessor 1 (float) - SWC1 instruction
   */
  swc1(address: number, value: number): void {
    if (this.isMainMemory(address)) {
      this.mainF32[this.mainOffset(address) >>> 2] = value;
    } else {
      // Convert float to int and store
      const tempBuffer = new ArrayBuffer(4);
      new Float32Array(tempBuffer)[0] = value;
      const intVal = new Uint32Array(tempBuffer)[0];
      this.sw(address, intVal);
    }
  }

  /**
   * Store word left - SWL instruction (for unaligned access)
   */
  swl(address: number, value: number): void {
    const align = address & 3;
    const aligned = address & ~3;
    const memValue = this.lwu(aligned);
    const newValue = (value >>> SWL_SHIFT[align]) | (memValue & SWL_MASK[align]);
    this.sw(aligned, newValue);
  }

  /**
   * Store word right - SWR instruction (for unaligned access)
   */
  swr(address: number, value: number): void {
    const align = address & 3;
    const aligned = address & ~3;
    const memValue = this.lwu(aligned);
    const newValue = (value << SWR_SHIFT[align]) | (memValue & SWR_MASK[align]);
    this.sw(aligned, newValue);
  }

  // ============================================
  // Utility methods
  // ============================================

  /**
   * Check if address is valid
   */
  isValidAddress(address: number): boolean {
    return this.isMainMemory(address) || this.isVram(address) || this.isScratchpad(address);
  }

  /**
   * Get a slice of memory as Uint8Array
   */
  getSlice(address: number, size: number): Uint8Array {
    if (this.isMainMemory(address)) {
      const offset = this.mainOffset(address);
      return new Uint8Array(this.mainBuffer, offset, size);
    }
    if (this.isVram(address)) {
      const offset = this.vramOffset(address);
      return new Uint8Array(this.vramBuffer, offset, size);
    }
    if (this.isScratchpad(address)) {
      const offset = this.scratchpadOffset(address);
      return new Uint8Array(this.scratchpadBuffer, offset, size);
    }
    return new Uint8Array(0);
  }

  /**
   * Copy data into memory
   */
  writeBytes(address: number, data: Uint8Array): void {
    for (let i = 0; i < data.length; i++) {
      this.sb(address + i, data[i]);
    }
  }

  /**
   * Read a null-terminated string
   */
  readString(address: number, maxLength: number = 256): string {
    const chars: number[] = [];
    for (let i = 0; i < maxLength; i++) {
      const byte = this.lbu(address + i);
      if (byte === 0) break;
      chars.push(byte);
    }
    return String.fromCharCode(...chars);
  }

  /**
   * Write a null-terminated string
   */
  writeString(address: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      this.sb(address + i, str.charCodeAt(i));
    }
    this.sb(address + str.length, 0);
  }

  /**
   * Load word as float (alias for lwc1)
   */
  lwFloat(address: number): number {
    return this.lwc1(address);
  }

  /**
   * Store float as word (alias for swc1)
   */
  swFloat(address: number, value: number): void {
    this.swc1(address, value);
  }

  /**
   * Load double (64-bit float)
   */
  ldFloat(address: number): number {
    const low = this.lwu(address);
    const high = this.lwu(address + 4);
    const tempBuffer = new ArrayBuffer(8);
    const u32 = new Uint32Array(tempBuffer);
    u32[0] = low;
    u32[1] = high;
    return new Float64Array(tempBuffer)[0];
  }

  /**
   * Store double (64-bit float)
   */
  sdFloat(address: number, value: number): void {
    const tempBuffer = new ArrayBuffer(8);
    new Float64Array(tempBuffer)[0] = value;
    const u32 = new Uint32Array(tempBuffer);
    this.sw(address, u32[0]);
    this.sw(address + 4, u32[1]);
  }

  /**
   * Get direct access to main memory buffer
   */
  getMainBuffer(): ArrayBuffer {
    return this.mainBuffer;
  }

  /**
   * Get direct access to VRAM buffer
   */
  getVramBuffer(): ArrayBuffer {
    return this.vramBuffer;
  }
}
