import { describe, it, expect, beforeEach } from 'bun:test';
import { CpuState, Register, VfpuCtrl } from '../src/core/cpu';
import { Memory } from '../src/core/memory';

describe('CpuState', () => {
  let memory: Memory;
  let cpu: CpuState;

  beforeEach(() => {
    memory = new Memory();
    cpu = new CpuState(memory);
  });

  describe('General Purpose Registers (GPR)', () => {
    describe('Basic operations', () => {
      it('should initialize all GPR to 0', () => {
        for (let i = 0; i < 32; i++) {
          expect(cpu.gpr[i]).toBe(0);
        }
      });

      it('should set and get GPR values', () => {
        cpu.setGpr(Register.T0, 0x12345678);
        expect(cpu.getGpr(Register.T0)).toBe(0x12345678);
      });

      it('should handle negative values (signed)', () => {
        cpu.setGpr(Register.T1, -100);
        expect(cpu.getGpr(Register.T1)).toBe(-100);
      });
    });

    describe('R0 (zero register)', () => {
      it('should always return 0 when reading R0', () => {
        expect(cpu.getGpr(Register.ZERO)).toBe(0);
      });

      it('should ignore writes to R0', () => {
        cpu.setGpr(Register.ZERO, 0xDEADBEEF);
        expect(cpu.getGpr(Register.ZERO)).toBe(0);
      });

      it('should keep R0 as 0 even after direct array access', () => {
        cpu.gpr[0] = 0xCAFEBABE;
        expect(cpu.getGpr(Register.ZERO)).toBe(0);
      });
    });

    describe('Unsigned access', () => {
      it('should return unsigned value with getGprU', () => {
        cpu.setGpr(Register.T2, -1);
        expect(cpu.getGprU(Register.T2)).toBe(0xFFFFFFFF);
      });

      it('should handle large unsigned values', () => {
        cpu.setGpr(Register.T3, 0x80000000);
        expect(cpu.getGprU(Register.T3)).toBe(0x80000000);
        expect(cpu.getGpr(Register.T3)).toBe(-2147483648); // Same bits, signed interpretation
      });
    });

    describe('Register aliases', () => {
      it('should access SP through alias', () => {
        cpu.sp = 0x09FFFFF0;
        expect(cpu.sp).toBe(0x09FFFFF0);
        expect(cpu.gpr[Register.SP]).toBe(0x09FFFFF0);
      });

      it('should access RA through alias', () => {
        cpu.ra = 0x08800000;
        expect(cpu.ra).toBe(0x08800000);
        expect(cpu.gpr[Register.RA]).toBe(0x08800000);
      });

      it('should access return value registers', () => {
        cpu.v0 = 42;
        cpu.v1 = 100;
        expect(cpu.v0).toBe(42);
        expect(cpu.v1).toBe(100);
      });

      it('should access argument registers', () => {
        cpu.a0 = 1;
        cpu.a1 = 2;
        cpu.a2 = 3;
        cpu.a3 = 4;
        expect(cpu.a0).toBe(1);
        expect(cpu.a1).toBe(2);
        expect(cpu.a2).toBe(3);
        expect(cpu.a3).toBe(4);
      });

      it('should access GP through alias', () => {
        cpu.gp = 0x08000000;
        expect(cpu.gp).toBe(0x08000000);
      });
    });
  });

  describe('Floating Point Registers (FPR)', () => {
    it('should initialize FPR to 0', () => {
      for (let i = 0; i < 32; i++) {
        expect(cpu.fpr[i]).toBe(0);
      }
    });

    it('should store and retrieve float values', () => {
      cpu.fpr[0] = 3.14159;
      expect(cpu.fpr[0]).toBeCloseTo(3.14159, 5);
    });

    it('should handle negative floats', () => {
      cpu.fpr[1] = -123.456;
      expect(cpu.fpr[1]).toBeCloseTo(-123.456, 3);
    });

    it('should access FPR as integers for bit manipulation', () => {
      cpu.fpr[2] = 1.0;
      // 1.0f in IEEE 754 is 0x3F800000
      expect(cpu.fprInt[2]).toBe(0x3F800000);
    });

    it('should initialize FCR0 correctly', () => {
      expect(cpu.fcr0).toBe(0x00003351);
    });

    it('should initialize FCR31 correctly', () => {
      expect(cpu.fcr31).toBe(0x00000e00);
    });
  });

  describe('VFPU Registers', () => {
    it('should initialize VFPU registers to NaN', () => {
      for (let i = 0; i < 128; i++) {
        expect(cpu.vfpr[i]).toBeNaN();
      }
    });

    it('should store and retrieve VFPU values', () => {
      cpu.vfpr[0] = 1.0;
      cpu.vfpr[1] = 2.0;
      cpu.vfpr[2] = 3.0;
      cpu.vfpr[3] = 4.0;
      expect(cpu.vfpr[0]).toBe(1.0);
      expect(cpu.vfpr[1]).toBe(2.0);
      expect(cpu.vfpr[2]).toBe(3.0);
      expect(cpu.vfpr[3]).toBe(4.0);
    });

    describe('VFPU Control Registers', () => {
      it('should initialize CC to 0xFF', () => {
        expect(cpu.vfprc[VfpuCtrl.CC]).toBe(0xFF);
      });

      it('should initialize RCX registers to 1.0f', () => {
        for (let i = VfpuCtrl.RCX0; i <= VfpuCtrl.RCX7; i++) {
          expect(cpu.vfprc[i]).toBe(0x3F800000); // 1.0f
        }
      });
    });

    describe('VFPU Condition Code', () => {
      it('should set condition code bit', () => {
        cpu.setVfpuCc(0, true);
        expect(cpu.getVfpuCc(0)).toBe(true);
      });

      it('should clear condition code bit', () => {
        cpu.setVfpuCc(1, true);
        cpu.setVfpuCc(1, false);
        expect(cpu.getVfpuCc(1)).toBe(false);
      });

      it('should handle multiple condition code bits', () => {
        cpu.vfprc[VfpuCtrl.CC] = 0; // Clear all
        cpu.setVfpuCc(0, true);
        cpu.setVfpuCc(2, true);
        cpu.setVfpuCc(4, true);

        expect(cpu.getVfpuCc(0)).toBe(true);
        expect(cpu.getVfpuCc(1)).toBe(false);
        expect(cpu.getVfpuCc(2)).toBe(true);
        expect(cpu.getVfpuCc(3)).toBe(false);
        expect(cpu.getVfpuCc(4)).toBe(true);
      });
    });
  });

  describe('Special Registers', () => {
    it('should initialize PC to 0', () => {
      expect(cpu.pc).toBe(0);
    });

    it('should initialize HI/LO to 0', () => {
      expect(cpu.hi).toBe(0);
      expect(cpu.lo).toBe(0);
    });

    it('should set and get PC', () => {
      cpu.pc = 0x08800000;
      expect(cpu.pc).toBe(0x08800000);
    });

    it('should set and get HI/LO', () => {
      cpu.hi = 0x11111111;
      cpu.lo = 0x22222222;
      expect(cpu.hi).toBe(0x11111111);
      expect(cpu.lo).toBe(0x22222222);
    });

    it('should initialize insideInterrupt to false', () => {
      expect(cpu.insideInterrupt).toBe(false);
    });
  });

  describe('State Management', () => {
    describe('reset()', () => {
      it('should reset all GPR to 0', () => {
        cpu.setGpr(Register.T0, 0x12345678);
        cpu.setGpr(Register.S0, 0xDEADBEEF);
        cpu.reset();

        for (let i = 0; i < 32; i++) {
          expect(cpu.gpr[i]).toBe(0);
        }
      });

      it('should reset PC, HI, LO', () => {
        cpu.pc = 0x08800000;
        cpu.hi = 0x11111111;
        cpu.lo = 0x22222222;
        cpu.reset();

        expect(cpu.pc).toBe(0);
        expect(cpu.hi).toBe(0);
        expect(cpu.lo).toBe(0);
      });

      it('should reset FPR to 0', () => {
        cpu.fpr[5] = 123.456;
        cpu.reset();
        expect(cpu.fpr[5]).toBe(0);
      });

      it('should reset VFPU to NaN', () => {
        cpu.vfpr[10] = 1.0;
        cpu.reset();
        expect(cpu.vfpr[10]).toBeNaN();
      });

      it('should reset FCR registers to defaults', () => {
        cpu.fcr0 = 0;
        cpu.fcr31 = 0;
        cpu.reset();
        expect(cpu.fcr0).toBe(0x00003351);
        expect(cpu.fcr31).toBe(0x00000e00);
      });
    });

    describe('copyFrom()', () => {
      it('should copy all GPR', () => {
        const other = new CpuState(memory);
        other.setGpr(Register.T0, 0x12345678);
        other.setGpr(Register.T1, -559038737); // 0xDEADBEEF as signed

        cpu.copyFrom(other);

        expect(cpu.getGpr(Register.T0)).toBe(0x12345678);
        expect(cpu.getGprU(Register.T1)).toBe(0xDEADBEEF);
      });

      it('should copy PC, HI, LO', () => {
        const other = new CpuState(memory);
        other.pc = 0x08800000;
        other.hi = 0x11111111;
        other.lo = 0x22222222;

        cpu.copyFrom(other);

        expect(cpu.pc).toBe(0x08800000);
        expect(cpu.hi).toBe(0x11111111);
        expect(cpu.lo).toBe(0x22222222);
      });

      it('should copy FPR', () => {
        const other = new CpuState(memory);
        other.fpr[0] = 3.14159;

        cpu.copyFrom(other);

        expect(cpu.fpr[0]).toBeCloseTo(3.14159, 5);
      });

      it('should copy VFPU registers', () => {
        const other = new CpuState(memory);
        other.vfpr[0] = 1.0;
        other.vfpr[1] = 2.0;

        cpu.copyFrom(other);

        expect(cpu.vfpr[0]).toBe(1.0);
        expect(cpu.vfpr[1]).toBe(2.0);
      });
    });

    describe('clone()', () => {
      it('should create an independent copy', () => {
        cpu.setGpr(Register.T0, 0x12345678);
        cpu.pc = 0x08800000;

        const cloned = cpu.clone();

        expect(cloned.getGpr(Register.T0)).toBe(0x12345678);
        expect(cloned.pc).toBe(0x08800000);

        // Modify original, cloned should be unchanged
        cpu.setGpr(Register.T0, 0);
        cpu.pc = 0;

        expect(cloned.getGpr(Register.T0)).toBe(0x12345678);
        expect(cloned.pc).toBe(0x08800000);
      });

      it('should have different ID', () => {
        const cloned = cpu.clone();
        expect(cloned.id).not.toBe(cpu.id);
      });

      it('should share same memory reference', () => {
        const cloned = cpu.clone();
        expect(cloned.memory).toBe(cpu.memory);
      });
    });
  });

  describe('Debugging Helpers', () => {
    describe('getRegisterName()', () => {
      it('should return correct name for zero register', () => {
        expect(CpuState.getRegisterName(0)).toBe('zero');
      });

      it('should return correct name for common registers', () => {
        expect(CpuState.getRegisterName(Register.SP)).toBe('sp');
        expect(CpuState.getRegisterName(Register.RA)).toBe('ra');
        expect(CpuState.getRegisterName(Register.V0)).toBe('v0');
        expect(CpuState.getRegisterName(Register.A0)).toBe('a0');
        expect(CpuState.getRegisterName(Register.T0)).toBe('t0');
        expect(CpuState.getRegisterName(Register.S0)).toBe('s0');
      });
    });

    describe('dumpGpr()', () => {
      it('should return a formatted string of all GPR', () => {
        cpu.setGpr(Register.V0, 0x12345678);
        cpu.pc = 0x08800000;

        const dump = cpu.dumpGpr();

        expect(dump).toContain('v0');
        expect(dump).toContain('12345678');
        expect(dump).toContain('PC');
        expect(dump).toContain('08800000');
      });
    });
  });

  describe('Unique ID', () => {
    it('should assign unique IDs to each CpuState', () => {
      const cpu1 = new CpuState(memory);
      const cpu2 = new CpuState(memory);
      const cpu3 = new CpuState(memory);

      expect(cpu1.id).not.toBe(cpu2.id);
      expect(cpu2.id).not.toBe(cpu3.id);
      expect(cpu1.id).not.toBe(cpu3.id);
    });
  });
});
