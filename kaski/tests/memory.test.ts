import { describe, it, expect, beforeEach } from 'bun:test';
import { Memory, MAIN_MEMORY_BASE, VRAM_BASE, SCRATCHPAD_BASE } from '../src/core/memory';

describe('Memory', () => {
  let memory: Memory;

  beforeEach(() => {
    memory = new Memory();
  });

  describe('Basic Read/Write Operations', () => {
    describe('Byte operations (8-bit)', () => {
      it('should write and read unsigned byte', () => {
        const addr = MAIN_MEMORY_BASE;
        memory.sb(addr, 0xFF);
        expect(memory.lbu(addr)).toBe(0xFF);
      });

      it('should write and read signed byte', () => {
        const addr = MAIN_MEMORY_BASE;
        memory.sb(addr, 0xFF); // -1 as signed
        expect(memory.lb(addr)).toBe(-1);
      });

      it('should mask value to 8 bits on store', () => {
        const addr = MAIN_MEMORY_BASE;
        memory.sb(addr, 0x1FF); // Should only store 0xFF
        expect(memory.lbu(addr)).toBe(0xFF);
      });
    });

    describe('Halfword operations (16-bit)', () => {
      it('should write and read unsigned halfword', () => {
        const addr = MAIN_MEMORY_BASE;
        memory.sh(addr, 0xABCD);
        expect(memory.lhu(addr)).toBe(0xABCD);
      });

      it('should write and read signed halfword', () => {
        const addr = MAIN_MEMORY_BASE;
        memory.sh(addr, 0xFFFF); // -1 as signed
        expect(memory.lh(addr)).toBe(-1);
      });

      it('should handle positive signed halfword', () => {
        const addr = MAIN_MEMORY_BASE;
        memory.sh(addr, 0x7FFF);
        expect(memory.lh(addr)).toBe(32767);
      });
    });

    describe('Word operations (32-bit)', () => {
      it('should write and read word', () => {
        const addr = MAIN_MEMORY_BASE;
        memory.sw(addr, 0xDEADBEEF);
        expect(memory.lwu(addr)).toBe(0xDEADBEEF);
      });

      it('should write and read signed word', () => {
        const addr = MAIN_MEMORY_BASE;
        memory.sw(addr, 0xFFFFFFFF);
        expect(memory.lw(addr)).toBe(-1);
      });

      it('should handle multiple words', () => {
        memory.sw(MAIN_MEMORY_BASE, 0x11111111);
        memory.sw(MAIN_MEMORY_BASE + 4, 0x22222222);
        memory.sw(MAIN_MEMORY_BASE + 8, 0x33333333);

        expect(memory.lwu(MAIN_MEMORY_BASE)).toBe(0x11111111);
        expect(memory.lwu(MAIN_MEMORY_BASE + 4)).toBe(0x22222222);
        expect(memory.lwu(MAIN_MEMORY_BASE + 8)).toBe(0x33333333);
      });
    });

    describe('Float operations', () => {
      it('should write and read float', () => {
        const addr = MAIN_MEMORY_BASE;
        memory.swc1(addr, 3.14159);
        expect(memory.lwc1(addr)).toBeCloseTo(3.14159, 5);
      });

      it('should handle negative floats', () => {
        const addr = MAIN_MEMORY_BASE;
        memory.swc1(addr, -123.456);
        expect(memory.lwc1(addr)).toBeCloseTo(-123.456, 3);
      });

      it('should handle zero', () => {
        const addr = MAIN_MEMORY_BASE;
        memory.swc1(addr, 0);
        expect(memory.lwc1(addr)).toBe(0);
      });
    });
  });

  describe('Memory Regions', () => {
    describe('Main Memory (0x08000000)', () => {
      it('should read/write at start of main memory', () => {
        memory.sw(MAIN_MEMORY_BASE, 0x12345678);
        expect(memory.lwu(MAIN_MEMORY_BASE)).toBe(0x12345678);
      });

      it('should read/write near end of main memory', () => {
        const nearEnd = MAIN_MEMORY_BASE + 0x01FFFFF0;
        memory.sw(nearEnd, 0x87654321);
        expect(memory.lwu(nearEnd)).toBe(0x87654321);
      });
    });

    describe('VRAM (0x04000000)', () => {
      it('should read/write to VRAM', () => {
        memory.sw(VRAM_BASE, 0xAABBCCDD);
        expect(memory.lwu(VRAM_BASE)).toBe(0xAABBCCDD);
      });

      it('should read/write VRAM offset', () => {
        const addr = VRAM_BASE + 0x1000;
        memory.sw(addr, 0x11223344);
        expect(memory.lwu(addr)).toBe(0x11223344);
      });
    });

    describe('Scratchpad (0x00010000)', () => {
      it('should read/write to scratchpad', () => {
        memory.sw(SCRATCHPAD_BASE, 0x55667788);
        expect(memory.lwu(SCRATCHPAD_BASE)).toBe(0x55667788);
      });
    });

    describe('Invalid addresses', () => {
      it('should return 0 for invalid address read', () => {
        expect(memory.lw(0x00000000)).toBe(0);
        expect(memory.lw(0x20000000)).toBe(0);
      });
    });
  });

  describe('Unaligned Access (LWL/LWR/SWL/SWR)', () => {
    beforeEach(() => {
      // Setup: Write individual bytes
      memory.sb(MAIN_MEMORY_BASE + 0, 0x11);
      memory.sb(MAIN_MEMORY_BASE + 1, 0x22);
      memory.sb(MAIN_MEMORY_BASE + 2, 0x33);
      memory.sb(MAIN_MEMORY_BASE + 3, 0x44);
    });

    describe('LWL/LWR combined for unaligned load', () => {
      it('should load aligned word correctly using LWL+LWR', () => {
        // For aligned access, LWL at addr+3 and LWR at addr should give full word
        let value = memory.lwl(MAIN_MEMORY_BASE + 3, 0);
        value = memory.lwr(MAIN_MEMORY_BASE, value);
        // Result should be 0x44332211 (little-endian)
        expect((value >>> 0).toString(16)).toBe('44332211');
      });
    });

    describe('SWL/SWR combined for unaligned store', () => {
      it('should store unaligned word correctly using SWL+SWR', () => {
        const addr = MAIN_MEMORY_BASE + 0x100;
        const value = 0xDEADBEEF;

        // Clear destination
        memory.sw(addr & ~3, 0);
        memory.sw((addr & ~3) + 4, 0);

        // Store unaligned (addr = 0x101, not word-aligned)
        memory.swl(addr + 3, value);
        memory.swr(addr, value);

        // Read back and verify
        let result = memory.lwl(addr + 3, 0);
        result = memory.lwr(addr, result);
        expect((result >>> 0).toString(16)).toBe('deadbeef');
      });
    });
  });

  describe('Utility Methods', () => {
    describe('reset()', () => {
      it('should clear all memory', () => {
        memory.sw(MAIN_MEMORY_BASE, 0xDEADBEEF);
        memory.sw(VRAM_BASE, 0xCAFEBABE);
        memory.sw(SCRATCHPAD_BASE, 0x12345678);

        memory.reset();

        expect(memory.lwu(MAIN_MEMORY_BASE)).toBe(0);
        expect(memory.lwu(VRAM_BASE)).toBe(0);
        expect(memory.lwu(SCRATCHPAD_BASE)).toBe(0);
      });
    });

    describe('isValidAddress()', () => {
      it('should return true for main memory addresses', () => {
        expect(memory.isValidAddress(MAIN_MEMORY_BASE)).toBe(true);
        expect(memory.isValidAddress(MAIN_MEMORY_BASE + 0x1000000)).toBe(true);
      });

      it('should return true for VRAM addresses', () => {
        expect(memory.isValidAddress(VRAM_BASE)).toBe(true);
      });

      it('should return true for scratchpad addresses', () => {
        expect(memory.isValidAddress(SCRATCHPAD_BASE)).toBe(true);
      });

      it('should return false for invalid addresses', () => {
        expect(memory.isValidAddress(0x00000000)).toBe(false);
        expect(memory.isValidAddress(0x20000000)).toBe(false);
      });
    });

    describe('readString() / writeString()', () => {
      it('should write and read a string', () => {
        const addr = MAIN_MEMORY_BASE;
        memory.writeString(addr, 'Hello');
        expect(memory.readString(addr)).toBe('Hello');
      });

      it('should handle empty string', () => {
        const addr = MAIN_MEMORY_BASE;
        memory.writeString(addr, '');
        expect(memory.readString(addr)).toBe('');
      });

      it('should null-terminate strings', () => {
        const addr = MAIN_MEMORY_BASE;
        memory.writeString(addr, 'Test');
        expect(memory.lbu(addr + 4)).toBe(0); // Null terminator
      });
    });

    describe('writeBytes()', () => {
      it('should write byte array to memory', () => {
        const addr = MAIN_MEMORY_BASE;
        const data = new Uint8Array([0x11, 0x22, 0x33, 0x44]);
        memory.writeBytes(addr, data);

        expect(memory.lbu(addr)).toBe(0x11);
        expect(memory.lbu(addr + 1)).toBe(0x22);
        expect(memory.lbu(addr + 2)).toBe(0x33);
        expect(memory.lbu(addr + 3)).toBe(0x44);
      });
    });

    describe('getSlice()', () => {
      it('should return a slice of memory', () => {
        memory.sw(MAIN_MEMORY_BASE, 0x44332211);
        const slice = memory.getSlice(MAIN_MEMORY_BASE, 4);

        expect(slice[0]).toBe(0x11);
        expect(slice[1]).toBe(0x22);
        expect(slice[2]).toBe(0x33);
        expect(slice[3]).toBe(0x44);
      });
    });
  });

  describe('Address Masking', () => {
    it('should handle mirrored addresses (kseg0/kseg1)', () => {
      // PSP uses address masking to access the same physical memory
      // through different virtual address ranges
      memory.sw(0x08000000, 0xDEADBEEF);

      // Reading through masked address should work
      // 0x88000000 & 0x0FFFFFFF = 0x08000000
      expect(memory.lwu(0x88000000)).toBe(0xDEADBEEF);
    });
  });
});
