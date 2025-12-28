/**
 * PSP Memory Map Constants
 *
 * PSP has a 32-bit address space with several memory regions:
 * - Scratchpad: 0x00010000 - 0x00013FFF (16KB)
 * - VRAM: 0x04000000 - 0x041FFFFF (2MB)
 * - Main RAM: 0x08000000 - 0x09FFFFFF (32MB on PSP-2000+, 24MB on PSP-1000)
 * - Hardware I/O: 0x1C000000 - 0x1FFFFFFF
 */

/** Mask to convert virtual addresses to physical */
export const ADDRESS_MASK = 0x0FFFFFFF;

/** Main RAM base address */
export const MAIN_MEMORY_BASE = 0x08000000;

/** Main RAM size (32MB for PSP-2000+) */
export const MAIN_MEMORY_SIZE = 0x02000000; // 32MB

/** VRAM base address */
export const VRAM_BASE = 0x04000000;

/** VRAM size (2MB) */
export const VRAM_SIZE = 0x00200000; // 2MB

/** Scratchpad base address */
export const SCRATCHPAD_BASE = 0x00010000;

/** Scratchpad size (16KB) */
export const SCRATCHPAD_SIZE = 0x00004000; // 16KB

/** Default frame buffer address */
export const DEFAULT_FRAME_ADDRESS = VRAM_BASE;

/**
 * Masks for unaligned memory access (LWL/LWR/SWL/SWR instructions)
 */
export const LWR_MASK = new Uint32Array([0x00000000, 0xFF000000, 0xFFFF0000, 0xFFFFFF00]);
export const LWR_SHIFT = new Uint32Array([0, 8, 16, 24]);

export const LWL_MASK = new Uint32Array([0x00FFFFFF, 0x0000FFFF, 0x000000FF, 0x00000000]);
export const LWL_SHIFT = new Uint32Array([24, 16, 8, 0]);

export const SWL_MASK = new Uint32Array([0xFFFFFF00, 0xFFFF0000, 0xFF000000, 0x00000000]);
export const SWL_SHIFT = new Uint32Array([24, 16, 8, 0]);

export const SWR_MASK = new Uint32Array([0x00000000, 0x000000FF, 0x0000FFFF, 0x00FFFFFF]);
export const SWR_SHIFT = new Uint32Array([0, 8, 16, 24]);
