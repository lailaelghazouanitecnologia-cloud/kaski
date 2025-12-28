var __legacyDecorateClassTS = function(decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
    r = Reflect.decorate(decorators, target, key, desc);
  else
    for (var i = decorators.length - 1;i >= 0; i--)
      if (d = decorators[i])
        r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
};

// src/core/memory/constants.ts
var ADDRESS_MASK = 268435455;
var MAIN_MEMORY_BASE = 134217728;
var MAIN_MEMORY_SIZE = 33554432;
var VRAM_BASE = 67108864;
var VRAM_SIZE = 2097152;
var SCRATCHPAD_BASE = 65536;
var SCRATCHPAD_SIZE = 16384;
var LWR_MASK = new Uint32Array([0, 4278190080, 4294901760, 4294967040]);
var LWR_SHIFT = new Uint32Array([0, 8, 16, 24]);
var LWL_MASK = new Uint32Array([16777215, 65535, 255, 0]);
var LWL_SHIFT = new Uint32Array([24, 16, 8, 0]);
var SWL_MASK = new Uint32Array([4294967040, 4294901760, 4278190080, 0]);
var SWL_SHIFT = new Uint32Array([24, 16, 8, 0]);
var SWR_MASK = new Uint32Array([0, 255, 65535, 16777215]);
var SWR_SHIFT = new Uint32Array([0, 8, 16, 24]);

// src/core/memory/Memory.ts
class Memory {
  mainBuffer;
  mainU8;
  mainU16;
  mainU32;
  mainI8;
  mainI16;
  mainI32;
  mainF32;
  vramBuffer;
  vramU8;
  vramU32;
  scratchpadBuffer;
  scratchpadU8;
  scratchpadU32;
  constructor() {
    this.mainBuffer = new ArrayBuffer(MAIN_MEMORY_SIZE);
    this.mainU8 = new Uint8Array(this.mainBuffer);
    this.mainU16 = new Uint16Array(this.mainBuffer);
    this.mainU32 = new Uint32Array(this.mainBuffer);
    this.mainI8 = new Int8Array(this.mainBuffer);
    this.mainI16 = new Int16Array(this.mainBuffer);
    this.mainI32 = new Int32Array(this.mainBuffer);
    this.mainF32 = new Float32Array(this.mainBuffer);
    this.vramBuffer = new ArrayBuffer(VRAM_SIZE);
    this.vramU8 = new Uint8Array(this.vramBuffer);
    this.vramU32 = new Uint32Array(this.vramBuffer);
    this.scratchpadBuffer = new ArrayBuffer(SCRATCHPAD_SIZE);
    this.scratchpadU8 = new Uint8Array(this.scratchpadBuffer);
    this.scratchpadU32 = new Uint32Array(this.scratchpadBuffer);
  }
  reset() {
    this.mainU8.fill(0);
    this.vramU8.fill(0);
    this.scratchpadU8.fill(0);
  }
  mask(address) {
    return address & ADDRESS_MASK;
  }
  isMainMemory(address) {
    const masked = this.mask(address);
    return masked >= MAIN_MEMORY_BASE && masked < MAIN_MEMORY_BASE + MAIN_MEMORY_SIZE;
  }
  isVram(address) {
    const masked = this.mask(address);
    return masked >= VRAM_BASE && masked < VRAM_BASE + VRAM_SIZE;
  }
  isScratchpad(address) {
    const masked = this.mask(address);
    return masked >= SCRATCHPAD_BASE && masked < SCRATCHPAD_BASE + SCRATCHPAD_SIZE;
  }
  mainOffset(address) {
    return this.mask(address) - MAIN_MEMORY_BASE;
  }
  vramOffset(address) {
    return this.mask(address) - VRAM_BASE;
  }
  scratchpadOffset(address) {
    return this.mask(address) - SCRATCHPAD_BASE;
  }
  lb(address) {
    if (this.isMainMemory(address)) {
      return this.mainI8[this.mainOffset(address)];
    }
    if (this.isVram(address)) {
      return this.vramU8[this.vramOffset(address)] << 24 >> 24;
    }
    if (this.isScratchpad(address)) {
      return this.scratchpadU8[this.scratchpadOffset(address)] << 24 >> 24;
    }
    return 0;
  }
  lbu(address) {
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
  lh(address) {
    if (this.isMainMemory(address)) {
      return this.mainI16[this.mainOffset(address) >>> 1];
    }
    if (this.isVram(address)) {
      const offset = this.vramOffset(address);
      return (this.vramU8[offset] | this.vramU8[offset + 1] << 8) << 16 >> 16;
    }
    if (this.isScratchpad(address)) {
      const offset = this.scratchpadOffset(address);
      return (this.scratchpadU8[offset] | this.scratchpadU8[offset + 1] << 8) << 16 >> 16;
    }
    return 0;
  }
  lhu(address) {
    if (this.isMainMemory(address)) {
      return this.mainU16[this.mainOffset(address) >>> 1];
    }
    if (this.isVram(address)) {
      const offset = this.vramOffset(address);
      return this.vramU8[offset] | this.vramU8[offset + 1] << 8;
    }
    if (this.isScratchpad(address)) {
      const offset = this.scratchpadOffset(address);
      return this.scratchpadU8[offset] | this.scratchpadU8[offset + 1] << 8;
    }
    return 0;
  }
  lw(address) {
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
  lwu(address) {
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
  lwc1(address) {
    if (this.isMainMemory(address)) {
      return this.mainF32[this.mainOffset(address) >>> 2];
    }
    const intVal = this.lwu(address);
    const tempBuffer = new ArrayBuffer(4);
    new Uint32Array(tempBuffer)[0] = intVal;
    return new Float32Array(tempBuffer)[0];
  }
  lwl(address, currentValue) {
    const align = address & 3;
    const aligned = address & ~3;
    const memValue = this.lwu(aligned);
    return memValue << LWL_SHIFT[align] | currentValue & LWL_MASK[align];
  }
  lwr(address, currentValue) {
    const align = address & 3;
    const aligned = address & ~3;
    const memValue = this.lwu(aligned);
    return memValue >>> LWR_SHIFT[align] | currentValue & LWR_MASK[align];
  }
  sb(address, value) {
    if (this.isMainMemory(address)) {
      this.mainU8[this.mainOffset(address)] = value & 255;
    } else if (this.isVram(address)) {
      this.vramU8[this.vramOffset(address)] = value & 255;
    } else if (this.isScratchpad(address)) {
      this.scratchpadU8[this.scratchpadOffset(address)] = value & 255;
    }
  }
  sh(address, value) {
    if (this.isMainMemory(address)) {
      this.mainU16[this.mainOffset(address) >>> 1] = value & 65535;
    } else if (this.isVram(address)) {
      const offset = this.vramOffset(address);
      this.vramU8[offset] = value & 255;
      this.vramU8[offset + 1] = value >>> 8 & 255;
    } else if (this.isScratchpad(address)) {
      const offset = this.scratchpadOffset(address);
      this.scratchpadU8[offset] = value & 255;
      this.scratchpadU8[offset + 1] = value >>> 8 & 255;
    }
  }
  sw(address, value) {
    if (this.isMainMemory(address)) {
      this.mainU32[this.mainOffset(address) >>> 2] = value >>> 0;
    } else if (this.isVram(address)) {
      this.vramU32[this.vramOffset(address) >>> 2] = value >>> 0;
    } else if (this.isScratchpad(address)) {
      this.scratchpadU32[this.scratchpadOffset(address) >>> 2] = value >>> 0;
    }
  }
  swc1(address, value) {
    if (this.isMainMemory(address)) {
      this.mainF32[this.mainOffset(address) >>> 2] = value;
    } else {
      const tempBuffer = new ArrayBuffer(4);
      new Float32Array(tempBuffer)[0] = value;
      const intVal = new Uint32Array(tempBuffer)[0];
      this.sw(address, intVal);
    }
  }
  swl(address, value) {
    const align = address & 3;
    const aligned = address & ~3;
    const memValue = this.lwu(aligned);
    const newValue = value >>> SWL_SHIFT[align] | memValue & SWL_MASK[align];
    this.sw(aligned, newValue);
  }
  swr(address, value) {
    const align = address & 3;
    const aligned = address & ~3;
    const memValue = this.lwu(aligned);
    const newValue = value << SWR_SHIFT[align] | memValue & SWR_MASK[align];
    this.sw(aligned, newValue);
  }
  isValidAddress(address) {
    return this.isMainMemory(address) || this.isVram(address) || this.isScratchpad(address);
  }
  getSlice(address, size) {
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
  writeBytes(address, data) {
    for (let i = 0;i < data.length; i++) {
      this.sb(address + i, data[i]);
    }
  }
  readString(address, maxLength = 256) {
    const chars = [];
    for (let i = 0;i < maxLength; i++) {
      const byte = this.lbu(address + i);
      if (byte === 0)
        break;
      chars.push(byte);
    }
    return String.fromCharCode(...chars);
  }
  writeString(address, str) {
    for (let i = 0;i < str.length; i++) {
      this.sb(address + i, str.charCodeAt(i));
    }
    this.sb(address + str.length, 0);
  }
  lwFloat(address) {
    return this.lwc1(address);
  }
  swFloat(address, value) {
    this.swc1(address, value);
  }
  ldFloat(address) {
    const low = this.lwu(address);
    const high = this.lwu(address + 4);
    const tempBuffer = new ArrayBuffer(8);
    const u32 = new Uint32Array(tempBuffer);
    u32[0] = low;
    u32[1] = high;
    return new Float64Array(tempBuffer)[0];
  }
  sdFloat(address, value) {
    const tempBuffer = new ArrayBuffer(8);
    new Float64Array(tempBuffer)[0] = value;
    const u32 = new Uint32Array(tempBuffer);
    this.sw(address, u32[0]);
    this.sw(address + 4, u32[1]);
  }
  getMainBuffer() {
    return this.mainBuffer;
  }
  getVramBuffer() {
    return this.vramBuffer;
  }
  getPointerU8Array(address, size) {
    if (this.isMainMemory(address)) {
      const offset = this.mainOffset(address);
      const actualSize = size ?? this.mainU8.length - offset;
      return this.mainU8.subarray(offset, offset + actualSize);
    }
    if (this.isVram(address)) {
      const offset = this.vramOffset(address);
      const actualSize = size ?? this.vramU8.length - offset;
      return this.vramU8.subarray(offset, offset + actualSize);
    }
    if (this.isScratchpad(address)) {
      const offset = this.scratchpadOffset(address);
      const actualSize = size ?? this.scratchpadU8.length - offset;
      return this.scratchpadU8.subarray(offset, offset + actualSize);
    }
    return new Uint8Array(size ?? 0);
  }
  getPointerU16Array(address, size) {
    if (this.isMainMemory(address)) {
      const offset = this.mainOffset(address);
      const actualSize = size ? Math.floor(size / 2) : Math.floor((this.mainU16.length * 2 - offset) / 2);
      return this.mainU16.subarray(offset >>> 1, (offset >>> 1) + actualSize);
    }
    const u8 = this.getPointerU8Array(address, size);
    if (u8.length === 0)
      return new Uint16Array(0);
    return new Uint16Array(u8.buffer, u8.byteOffset, Math.floor(u8.length / 2));
  }
  getPointerU32Array(address, size) {
    if (this.isMainMemory(address)) {
      const offset = this.mainOffset(address);
      const actualSize = size ? Math.floor(size / 4) : Math.floor((this.mainU32.length * 4 - offset) / 4);
      return this.mainU32.subarray(offset >>> 2, (offset >>> 2) + actualSize);
    }
    const u8 = this.getPointerU8Array(address, size);
    if (u8.length === 0)
      return new Uint32Array(0);
    return new Uint32Array(u8.buffer, u8.byteOffset, Math.floor(u8.length / 4));
  }
}

// src/core/utils/bits.ts
var BitUtils = {
  extract(value, offset, length) {
    return value >>> offset & (1 << length) - 1;
  },
  extractSigned(value, offset, length) {
    const extracted = this.extract(value, offset, length);
    const signBit = 1 << length - 1;
    if (extracted & signBit) {
      return extracted - (1 << length);
    }
    return extracted;
  },
  insert(value, offset, length, insert) {
    const mask = (1 << length) - 1 << offset;
    return value & ~mask | insert << offset & mask;
  },
  clz(value) {
    return Math.clz32(value);
  },
  clo(value) {
    return Math.clz32(~value);
  },
  rotr(value, amount) {
    const v = value >>> 0;
    const a = amount & 31;
    return v >>> a | v << 32 - a | 0;
  },
  bitrev(value) {
    let v = value >>> 0;
    let result = 0;
    for (let i = 0;i < 32; i++) {
      result = result << 1 | v & 1;
      v >>>= 1;
    }
    return result;
  },
  wsbh(value) {
    const v = value >>> 0;
    return (v & 16711935) << 8 | (v & 4278255360) >>> 8;
  },
  wsbw(value) {
    const v = value >>> 0;
    return (v & 255) << 24 | (v & 65280) << 8 | (v & 16711680) >>> 8 | (v & 4278190080) >>> 24;
  },
  seb(value) {
    return value << 24 >> 24;
  },
  seh(value) {
    return value << 16 >> 16;
  }
};
// src/core/utils/format.ts
function hex(value, digits = 8) {
  return (value >>> 0).toString(16).padStart(digits, "0");
}
// src/core/utils/registers.ts
var GPR_NAMES = [
  "zero",
  "at",
  "v0",
  "v1",
  "a0",
  "a1",
  "a2",
  "a3",
  "t0",
  "t1",
  "t2",
  "t3",
  "t4",
  "t5",
  "t6",
  "t7",
  "s0",
  "s1",
  "s2",
  "s3",
  "s4",
  "s5",
  "s6",
  "s7",
  "t8",
  "t9",
  "k0",
  "k1",
  "gp",
  "sp",
  "fp",
  "ra"
];
var FPR_NAMES = Array.from({ length: 32 }, (_, i) => `f${i}`);
function getGprName(index) {
  return GPR_NAMES[index] ?? `r${index}`;
}
// src/core/cpu/CpuState.ts
class CpuState {
  static nextId = 0;
  id;
  memory;
  gprBuffer = new ArrayBuffer(32 * 4);
  gpr = new Int32Array(this.gprBuffer);
  gprFloat = new Float32Array(this.gprBuffer);
  fprBuffer = new ArrayBuffer(32 * 4);
  fpr = new Float32Array(this.fprBuffer);
  fprInt = new Int32Array(this.fprBuffer);
  fcr0 = 13137;
  fcr31 = 3584;
  vfprBuffer = new ArrayBuffer(128 * 4);
  vfpr = new Float32Array(this.vfprBuffer);
  vfprInt = new Int32Array(this.vfprBuffer);
  vfprc = new Int32Array([
    0,
    0,
    0,
    255,
    0,
    0,
    0,
    0,
    1065353216,
    1065353216,
    1065353216,
    1065353216,
    1065353216,
    1065353216,
    1065353216,
    1065353216
  ]);
  pc = 0;
  npc = 0;
  hi = 0;
  lo = 0;
  ic0 = 0;
  insideInterrupt = false;
  cop0 = new Int32Array(32);
  constructor(memory) {
    this.id = CpuState.nextId++;
    this.memory = memory;
    this.vfpr.fill(NaN);
  }
  getGpr(index) {
    if (index === 0)
      return 0;
    return this.gpr[index];
  }
  setGpr(index, value) {
    if (index !== 0) {
      this.gpr[index] = value;
    }
  }
  getGprU(index) {
    return this.getGpr(index) >>> 0;
  }
  get sp() {
    return this.gpr[29 /* SP */];
  }
  set sp(value) {
    this.gpr[29 /* SP */] = value;
  }
  get ra() {
    return this.gpr[31 /* RA */];
  }
  set ra(value) {
    this.gpr[31 /* RA */] = value;
  }
  get v0() {
    return this.gpr[2 /* V0 */];
  }
  set v0(value) {
    this.gpr[2 /* V0 */] = value;
  }
  get v1() {
    return this.gpr[3 /* V1 */];
  }
  set v1(value) {
    this.gpr[3 /* V1 */] = value;
  }
  get a0() {
    return this.gpr[4 /* A0 */];
  }
  set a0(value) {
    this.gpr[4 /* A0 */] = value;
  }
  get a1() {
    return this.gpr[5 /* A1 */];
  }
  set a1(value) {
    this.gpr[5 /* A1 */] = value;
  }
  get a2() {
    return this.gpr[6 /* A2 */];
  }
  set a2(value) {
    this.gpr[6 /* A2 */] = value;
  }
  get a3() {
    return this.gpr[7 /* A3 */];
  }
  set a3(value) {
    this.gpr[7 /* A3 */] = value;
  }
  get gp() {
    return this.gpr[28 /* GP */];
  }
  set gp(value) {
    this.gpr[28 /* GP */] = value;
  }
  setVfpuCc(index, value) {
    if (value) {
      this.vfprc[3 /* CC */] |= 1 << index;
    } else {
      this.vfprc[3 /* CC */] &= ~(1 << index);
    }
  }
  getVfpuCc(index) {
    return (this.vfprc[3 /* CC */] & 1 << index) !== 0;
  }
  getVectorRegs(vreg, size) {
    const matrix = vreg >> 2 & 7;
    const column = vreg & 3;
    const row = vreg >> 5 & 3;
    const transpose = (vreg & 32) !== 0;
    const regs = [];
    const base = matrix * 16;
    for (let i = 0;i < size; i++) {
      if (transpose) {
        regs.push(base + (row + i & 3) * 4 + column);
      } else {
        regs.push(base + row * 4 + (column + i & 3));
      }
    }
    return regs;
  }
  readVector(vreg, size) {
    const regs = this.getVectorRegs(vreg, size);
    const result = new Float32Array(size);
    for (let i = 0;i < size; i++) {
      result[i] = this.vfpr[regs[i]];
    }
    return result;
  }
  writeVector(vreg, size, values) {
    const regs = this.getVectorRegs(vreg, size);
    for (let i = 0;i < size; i++) {
      this.vfpr[regs[i]] = values[i];
    }
  }
  reset() {
    this.gpr.fill(0);
    this.fpr.fill(0);
    this.vfpr.fill(NaN);
    this.cop0.fill(0);
    this.pc = 0;
    this.npc = 0;
    this.hi = 0;
    this.lo = 0;
    this.ic0 = 0;
    this.insideInterrupt = false;
    this.fcr0 = 13137;
    this.fcr31 = 3584;
    this.vfprc[0 /* SPREFIX */] = 0;
    this.vfprc[1 /* TPREFIX */] = 0;
    this.vfprc[2 /* DPREFIX */] = 0;
    this.vfprc[3 /* CC */] = 255;
  }
  copyFrom(other) {
    this.gpr.set(other.gpr);
    this.fpr.set(other.fpr);
    this.vfpr.set(other.vfpr);
    this.vfprc.set(other.vfprc);
    this.cop0.set(other.cop0);
    this.pc = other.pc;
    this.npc = other.npc;
    this.hi = other.hi;
    this.lo = other.lo;
    this.ic0 = other.ic0;
    this.fcr0 = other.fcr0;
    this.fcr31 = other.fcr31;
    this.insideInterrupt = other.insideInterrupt;
  }
  clone() {
    const newState = new CpuState(this.memory);
    newState.copyFrom(this);
    return newState;
  }
  static getRegisterName(index) {
    return getGprName(index);
  }
  dumpGpr() {
    const lines = [];
    for (let i = 0;i < 32; i += 4) {
      const regs = [];
      for (let j = 0;j < 4; j++) {
        const idx = i + j;
        const name = getGprName(idx).padEnd(4);
        const value = hex(this.gpr[idx]);
        regs.push(`${name}: 0x${value}`);
      }
      lines.push(regs.join("  "));
    }
    lines.push(`PC: 0x${hex(this.pc)}  HI: 0x${hex(this.hi)}  LO: 0x${hex(this.lo)}`);
    return lines.join(`
`);
  }
}
// src/core/cpu/instruction/Instruction.ts
class Instruction {
  pc;
  data;
  constructor(pc, data) {
    this.pc = pc;
    this.data = data;
  }
  static fromMemory(memory, pc) {
    return new Instruction(pc, memory.lw(pc));
  }
  extract(offset, length) {
    return BitUtils.extract(this.data, offset, length);
  }
  extractSigned(offset, length) {
    return BitUtils.extractSigned(this.data, offset, length);
  }
  insert(offset, length, value) {
    this.data = BitUtils.insert(this.data, offset, length, value);
  }
  get opcode() {
    return this.extract(26, 6);
  }
  set opcode(v) {
    this.insert(26, 6, v);
  }
  get rs() {
    return this.extract(21, 5);
  }
  set rs(v) {
    this.insert(21, 5, v);
  }
  get rt() {
    return this.extract(16, 5);
  }
  set rt(v) {
    this.insert(16, 5, v);
  }
  get rd() {
    return this.extract(11, 5);
  }
  set rd(v) {
    this.insert(11, 5, v);
  }
  get sa() {
    return this.extract(6, 5);
  }
  set sa(v) {
    this.insert(6, 5, v);
  }
  get func() {
    return this.extract(0, 6);
  }
  set func(v) {
    this.insert(0, 6, v);
  }
  get imm16() {
    return this.extractSigned(0, 16);
  }
  set imm16(v) {
    this.insert(0, 16, v & 65535);
  }
  get uimm16() {
    return this.extract(0, 16);
  }
  set uimm16(v) {
    this.insert(0, 16, v);
  }
  get target26() {
    return this.extract(0, 26);
  }
  set target26(v) {
    this.insert(0, 26, v);
  }
  get fd() {
    return this.extract(6, 5);
  }
  set fd(v) {
    this.insert(6, 5, v);
  }
  get fs() {
    return this.extract(11, 5);
  }
  set fs(v) {
    this.insert(11, 5, v);
  }
  get ft() {
    return this.extract(16, 5);
  }
  set ft(v) {
    this.insert(16, 5, v);
  }
  get vd() {
    return this.extract(0, 7);
  }
  set vd(v) {
    this.insert(0, 7, v);
  }
  get vs() {
    return this.extract(8, 7);
  }
  set vs(v) {
    this.insert(8, 7, v);
  }
  get vt() {
    return this.extract(16, 7);
  }
  set vt(v) {
    this.insert(16, 7, v);
  }
  get one() {
    return this.extract(7, 1);
  }
  get two() {
    return this.extract(15, 1);
  }
  get oneTwoSize() {
    return 1 + this.one + 2 * this.two;
  }
  get syscall() {
    return this.extract(6, 20);
  }
  set syscall(v) {
    this.insert(6, 20, v);
  }
  get breakCode() {
    return this.extract(6, 20);
  }
  get lsb() {
    return this.extract(6, 5);
  }
  set lsb(v) {
    this.insert(6, 5, v);
  }
  get msb() {
    return this.extract(11, 5);
  }
  set msb(v) {
    this.insert(11, 5, v);
  }
  get pos() {
    return this.lsb;
  }
  get sizeExt() {
    return this.msb + 1;
  }
  get sizeIns() {
    return this.msb - this.lsb + 1;
  }
  get c0dr() {
    return this.extract(11, 5);
  }
  set c0dr(v) {
    this.insert(11, 5, v);
  }
  get branchTarget() {
    return this.pc + (this.imm16 << 2) + 4 >>> 0;
  }
  get jumpTarget() {
    return (this.pc & 4026531840 | this.target26 << 2) >>> 0;
  }
  toHex() {
    return hex(this.data);
  }
  clone() {
    return new Instruction(this.pc, this.data);
  }
}
// src/core/cpu/instruction/InstructionType.ts
var AddressType;
((AddressType2) => {
  AddressType2[AddressType2["NONE"] = 0] = "NONE";
  AddressType2[AddressType2["REGISTER"] = 1] = "REGISTER";
  AddressType2[AddressType2["OFFSET16"] = 2] = "OFFSET16";
  AddressType2[AddressType2["TARGET26"] = 3] = "TARGET26";
})(AddressType ||= {});
var InstructionFlags;
((InstructionFlags2) => {
  InstructionFlags2[InstructionFlags2["NONE"] = 0] = "NONE";
  InstructionFlags2[InstructionFlags2["PSP"] = 1] = "PSP";
  InstructionFlags2[InstructionFlags2["SYSCALL"] = 2] = "SYSCALL";
  InstructionFlags2[InstructionFlags2["BRANCH"] = 4] = "BRANCH";
  InstructionFlags2[InstructionFlags2["LIKELY"] = 8] = "LIKELY";
  InstructionFlags2[InstructionFlags2["JAL"] = 16] = "JAL";
  InstructionFlags2[InstructionFlags2["JUMP"] = 32] = "JUMP";
  InstructionFlags2[InstructionFlags2["BREAK"] = 64] = "BREAK";
})(InstructionFlags ||= {});
function parseFormat(format2) {
  const fieldSizes = {
    rs: 5,
    rt: 5,
    rd: 5,
    sa: 5,
    fs: 5,
    fd: 5,
    ft: 5,
    lsb: 5,
    msb: 5,
    imm5: 5,
    imm7: 7,
    imm8: 8,
    imm14: 14,
    imm16: 16,
    imm20: 20,
    imm26: 26,
    vs: 7,
    vt: 7,
    vd: 7,
    vt5: 5,
    vt1: 1,
    vt2: 2,
    one: 1,
    two: 1,
    imm3: 3,
    imm4: 4,
    c0dr: 5,
    c0cr: 5,
    c1dr: 5,
    c1cr: 5,
    fcond: 4,
    cstw: 1,
    cstz: 1,
    csty: 1,
    cstx: 1,
    absw: 1,
    absz: 1,
    absy: 1,
    absx: 1,
    mskw: 1,
    mskz: 1,
    msky: 1,
    mskx: 1,
    negw: 1,
    negz: 1,
    negy: 1,
    negx: 1,
    satw: 2,
    satz: 2,
    saty: 2,
    satx: 2,
    swzw: 2,
    swzz: 2,
    swzy: 2,
    swzx: 2
  };
  let value = 0;
  let mask = 0;
  for (const part of format2.split(":")) {
    if (/^[01-]+$/.test(part)) {
      for (const char of part) {
        value <<= 1;
        mask <<= 1;
        if (char === "0") {
          mask |= 1;
        } else if (char === "1") {
          value |= 1;
          mask |= 1;
        }
      }
    } else {
      const size = fieldSizes[part];
      if (size === undefined) {
        throw new Error(`Unknown field: ${part}`);
      }
      value <<= size;
      mask <<= size;
    }
  }
  return { value, mask };
}

class InstructionType {
  name;
  vm;
  format;
  addressType;
  flags;
  constructor(name, vm, format2, addressType, flags) {
    this.name = name;
    this.vm = vm;
    this.format = format2;
    this.addressType = addressType;
    this.flags = flags;
  }
  match(data) {
    return (data & this.vm.mask) === (this.vm.value & this.vm.mask);
  }
  get isPsp() {
    return (this.flags & 1 /* PSP */) !== 0;
  }
  get isSyscall() {
    return (this.flags & 2 /* SYSCALL */) !== 0;
  }
  get isBranch() {
    return (this.flags & 4 /* BRANCH */) !== 0;
  }
  get isLikely() {
    return (this.flags & 8 /* LIKELY */) !== 0;
  }
  get isJal() {
    return (this.flags & 16 /* JAL */) !== 0;
  }
  get isJump() {
    return (this.flags & (16 /* JAL */ | 32 /* JUMP */)) !== 0;
  }
  get isJumpNoLink() {
    return (this.flags & 32 /* JUMP */) !== 0;
  }
  get isBreak() {
    return (this.flags & 64 /* BREAK */) !== 0;
  }
  get isCall() {
    return this.isJal;
  }
  get isJumpOrBranch() {
    return this.isBranch || this.isJump;
  }
  get isRegister() {
    return this.addressType === 1 /* REGISTER */;
  }
  get isFixedAddressJump() {
    return this.isJumpOrBranch && !this.isRegister;
  }
  get hasDelaySlot() {
    return this.isJumpOrBranch;
  }
}
function createInstructionType(name, formatStr, disasmFormat, addressType = 0 /* NONE */, flags = 0 /* NONE */) {
  return new InstructionType(name, parseFormat(formatStr), disasmFormat, addressType, flags);
}
// src/core/cpu/instruction/InstructionTable.ts
var { NONE, REGISTER, OFFSET16, TARGET26 } = AddressType;
var { PSP, SYSCALL, BRANCH, LIKELY, JAL, JUMP, BREAK } = InstructionFlags;

class InstructionTable {
  static _instance = null;
  types = [];
  byName = new Map;
  constructor() {
    this.registerAll();
  }
  static get instance() {
    if (!InstructionTable._instance) {
      InstructionTable._instance = new InstructionTable;
    }
    return InstructionTable._instance;
  }
  add(name, format2, disasm, addrType = NONE, flags = 0 /* NONE */) {
    const type = createInstructionType(name, format2, disasm, addrType, flags);
    this.types.push(type);
    this.byName.set(name, type);
  }
  find(data) {
    for (const type of this.types) {
      if (type.match(data)) {
        return type;
      }
    }
    return null;
  }
  get(name) {
    return this.byName.get(name);
  }
  registerAll() {
    this.add("add", "000000:rs:rt:rd:00000:100000", "%d, %s, %t");
    this.add("addu", "000000:rs:rt:rd:00000:100001", "%d, %s, %t");
    this.add("addi", "001000:rs:rt:imm16", "%t, %s, %i");
    this.add("addiu", "001001:rs:rt:imm16", "%t, %s, %i");
    this.add("sub", "000000:rs:rt:rd:00000:100010", "%d, %s, %t");
    this.add("subu", "000000:rs:rt:rd:00000:100011", "%d, %s, %t");
    this.add("and", "000000:rs:rt:rd:00000:100100", "%d, %s, %t");
    this.add("andi", "001100:rs:rt:imm16", "%t, %s, %I");
    this.add("nor", "000000:rs:rt:rd:00000:100111", "%d, %s, %t");
    this.add("or", "000000:rs:rt:rd:00000:100101", "%d, %s, %t");
    this.add("ori", "001101:rs:rt:imm16", "%t, %s, %I");
    this.add("xor", "000000:rs:rt:rd:00000:100110", "%d, %s, %t");
    this.add("xori", "001110:rs:rt:imm16", "%t, %s, %I");
    this.add("sll", "000000:00000:rt:rd:sa:000000", "%d, %t, %a");
    this.add("sllv", "000000:rs:rt:rd:00000:000100", "%d, %t, %s");
    this.add("sra", "000000:00000:rt:rd:sa:000011", "%d, %t, %a");
    this.add("srav", "000000:rs:rt:rd:00000:000111", "%d, %t, %s");
    this.add("srl", "000000:00000:rt:rd:sa:000010", "%d, %t, %a");
    this.add("srlv", "000000:rs:rt:rd:00000:000110", "%d, %t, %s");
    this.add("rotr", "000000:00001:rt:rd:sa:000010", "%d, %t, %a", NONE, PSP);
    this.add("rotrv", "000000:rs:rt:rd:00001:000110", "%d, %t, %s", NONE, PSP);
    this.add("slt", "000000:rs:rt:rd:00000:101010", "%d, %s, %t");
    this.add("slti", "001010:rs:rt:imm16", "%t, %s, %i");
    this.add("sltu", "000000:rs:rt:rd:00000:101011", "%d, %s, %t");
    this.add("sltiu", "001011:rs:rt:imm16", "%t, %s, %i");
    this.add("lui", "001111:00000:rt:imm16", "%t, %I");
    this.add("seb", "011111:00000:rt:rd:10000:100000", "%d, %t", NONE, PSP);
    this.add("seh", "011111:00000:rt:rd:11000:100000", "%d, %t", NONE, PSP);
    this.add("bitrev", "011111:00000:rt:rd:10100:100000", "%d, %t", NONE, PSP);
    this.add("max", "000000:rs:rt:rd:00000:101100", "%d, %s, %t", NONE, PSP);
    this.add("min", "000000:rs:rt:rd:00000:101101", "%d, %s, %t", NONE, PSP);
    this.add("ext", "011111:rs:rt:msb:lsb:000000", "%t, %s, %a, %ne", NONE, PSP);
    this.add("ins", "011111:rs:rt:msb:lsb:000100", "%t, %s, %a, %ni", NONE, PSP);
    this.add("clz", "000000:rs:00000:rd:00000:010110", "%d, %s", NONE, PSP);
    this.add("clo", "000000:rs:00000:rd:00000:010111", "%d, %s", NONE, PSP);
    this.add("wsbh", "011111:00000:rt:rd:00010:100000", "%d, %t", NONE, PSP);
    this.add("wsbw", "011111:00000:rt:rd:00011:100000", "%d, %t", NONE, PSP);
    this.add("div", "000000:rs:rt:00000:00000:011010", "%s, %t");
    this.add("divu", "000000:rs:rt:00000:00000:011011", "%s, %t");
    this.add("mult", "000000:rs:rt:00000:00000:011000", "%s, %t");
    this.add("multu", "000000:rs:rt:00000:00000:011001", "%s, %t");
    this.add("madd", "000000:rs:rt:00000:00000:011100", "%s, %t", NONE, PSP);
    this.add("maddu", "000000:rs:rt:00000:00000:011101", "%s, %t", NONE, PSP);
    this.add("msub", "000000:rs:rt:00000:00000:101110", "%s, %t", NONE, PSP);
    this.add("msubu", "000000:rs:rt:00000:00000:101111", "%s, %t", NONE, PSP);
    this.add("mfhi", "000000:00000:00000:rd:00000:010000", "%d");
    this.add("mflo", "000000:00000:00000:rd:00000:010010", "%d");
    this.add("mthi", "000000:rs:00000:00000:00000:010001", "%s");
    this.add("mtlo", "000000:rs:00000:00000:00000:010011", "%s");
    this.add("movz", "000000:rs:rt:rd:00000:001010", "%d, %s, %t", NONE, PSP);
    this.add("movn", "000000:rs:rt:rd:00000:001011", "%d, %s, %t", NONE, PSP);
    this.add("beq", "000100:rs:rt:imm16", "%s, %t, %O", OFFSET16, BRANCH);
    this.add("beql", "010100:rs:rt:imm16", "%s, %t, %O", OFFSET16, BRANCH | LIKELY);
    this.add("bne", "000101:rs:rt:imm16", "%s, %t, %O", OFFSET16, BRANCH);
    this.add("bnel", "010101:rs:rt:imm16", "%s, %t, %O", OFFSET16, BRANCH | LIKELY);
    this.add("bgez", "000001:rs:00001:imm16", "%s, %O", OFFSET16, BRANCH);
    this.add("bgezl", "000001:rs:00011:imm16", "%s, %O", OFFSET16, BRANCH | LIKELY);
    this.add("bgezal", "000001:rs:10001:imm16", "%s, %O", OFFSET16, JAL);
    this.add("bgezall", "000001:rs:10011:imm16", "%s, %O", OFFSET16, JAL | LIKELY);
    this.add("bgtz", "000111:rs:00000:imm16", "%s, %O", OFFSET16, BRANCH);
    this.add("bgtzl", "010111:rs:00000:imm16", "%s, %O", OFFSET16, BRANCH | LIKELY);
    this.add("blez", "000110:rs:00000:imm16", "%s, %O", OFFSET16, BRANCH);
    this.add("blezl", "010110:rs:00000:imm16", "%s, %O", OFFSET16, BRANCH | LIKELY);
    this.add("bltz", "000001:rs:00000:imm16", "%s, %O", OFFSET16, BRANCH);
    this.add("bltzl", "000001:rs:00010:imm16", "%s, %O", OFFSET16, BRANCH | LIKELY);
    this.add("bltzal", "000001:rs:10000:imm16", "%s, %O", OFFSET16, JAL);
    this.add("bltzall", "000001:rs:10010:imm16", "%s, %O", OFFSET16, JAL | LIKELY);
    this.add("j", "000010:imm26", "%J", TARGET26, JUMP);
    this.add("jal", "000011:imm26", "%J", TARGET26, JAL);
    this.add("jr", "000000:rs:00000:00000:00000:001000", "%s", REGISTER, JUMP);
    this.add("jalr", "000000:rs:00000:rd:00000:001001", "%d, %s", REGISTER, JAL);
    this.add("lb", "100000:rs:rt:imm16", "%t, %o");
    this.add("lbu", "100100:rs:rt:imm16", "%t, %o");
    this.add("lh", "100001:rs:rt:imm16", "%t, %o");
    this.add("lhu", "100101:rs:rt:imm16", "%t, %o");
    this.add("lw", "100011:rs:rt:imm16", "%t, %o");
    this.add("lwl", "100010:rs:rt:imm16", "%t, %o");
    this.add("lwr", "100110:rs:rt:imm16", "%t, %o");
    this.add("sb", "101000:rs:rt:imm16", "%t, %o");
    this.add("sh", "101001:rs:rt:imm16", "%t, %o");
    this.add("sw", "101011:rs:rt:imm16", "%t, %o");
    this.add("swl", "101010:rs:rt:imm16", "%t, %o");
    this.add("swr", "101110:rs:rt:imm16", "%t, %o");
    this.add("lwc1", "110001:rs:ft:imm16", "%T, %o");
    this.add("swc1", "111001:rs:ft:imm16", "%T, %o");
    this.add("syscall", "000000:imm20:001100", "", NONE, SYSCALL);
    this.add("break", "000000:imm20:001101", "", NONE, BREAK);
    this.add("nop", "000000:00000:00000:00000:00000:000000", "");
    this.add("sync", "000000:00000:00000:00000:00000:001111", "");
    this.add("mfc1", "010001:00000:rt:fs:00000:000000", "%t, %S");
    this.add("mtc1", "010001:00100:rt:fs:00000:000000", "%t, %S");
    this.add("cfc1", "010001:00010:rt:fs:00000:000000", "%t, %S");
    this.add("ctc1", "010001:00110:rt:fs:00000:000000", "%t, %S");
    this.add("add.s", "010001:10000:ft:fs:fd:000000", "%D, %S, %T");
    this.add("sub.s", "010001:10000:ft:fs:fd:000001", "%D, %S, %T");
    this.add("mul.s", "010001:10000:ft:fs:fd:000010", "%D, %S, %T");
    this.add("div.s", "010001:10000:ft:fs:fd:000011", "%D, %S, %T");
    this.add("sqrt.s", "010001:10000:00000:fs:fd:000100", "%D, %S");
    this.add("abs.s", "010001:10000:00000:fs:fd:000101", "%D, %S");
    this.add("mov.s", "010001:10000:00000:fs:fd:000110", "%D, %S");
    this.add("neg.s", "010001:10000:00000:fs:fd:000111", "%D, %S");
    this.add("trunc.w.s", "010001:10000:00000:fs:fd:001101", "%D, %S");
    this.add("round.w.s", "010001:10000:00000:fs:fd:001100", "%D, %S");
    this.add("ceil.w.s", "010001:10000:00000:fs:fd:001110", "%D, %S");
    this.add("floor.w.s", "010001:10000:00000:fs:fd:001111", "%D, %S");
    this.add("cvt.s.w", "010001:10100:00000:fs:fd:100000", "%D, %S");
    this.add("cvt.w.s", "010001:10000:00000:fs:fd:100100", "%D, %S");
    this.add("c.eq.s", "010001:10000:ft:fs:00000:110010", "%S, %T");
    this.add("c.lt.s", "010001:10000:ft:fs:00000:111100", "%S, %T");
    this.add("c.le.s", "010001:10000:ft:fs:00000:111110", "%S, %T");
    this.add("bc1f", "010001:01000:00000:imm16", "%O", OFFSET16, BRANCH);
    this.add("bc1t", "010001:01000:00001:imm16", "%O", OFFSET16, BRANCH);
    this.add("bc1fl", "010001:01000:00010:imm16", "%O", OFFSET16, BRANCH | LIKELY);
    this.add("bc1tl", "010001:01000:00011:imm16", "%O", OFFSET16, BRANCH | LIKELY);
    this.add("vadd", "011000:000:vt:two:vs:one:vd", "%Zp, %Yp, %Xp", NONE, PSP);
    this.add("vsub", "011000:001:vt:two:vs:one:vd", "%Zp, %Yp, %Xp", NONE, PSP);
    this.add("vdiv", "011000:111:vt:two:vs:one:vd", "%Zp, %Yp, %Xp", NONE, PSP);
    this.add("vmul", "011001:000:vt:two:vs:one:vd", "%Zp, %Yp, %Xp", NONE, PSP);
    this.add("vabs", "110100:00:000:00001:two:vs:one:vd", "%Zp, %Yp", NONE, PSP);
    this.add("vneg", "110100:00:000:00010:two:vs:one:vd", "%Zp, %Yp", NONE, PSP);
    this.add("vsat0", "110100:00:000:00100:two:vs:one:vd", "%Zp, %Yp", NONE, PSP);
    this.add("vsat1", "110100:00:000:00101:two:vs:one:vd", "%Zp, %Yp", NONE, PSP);
    this.add("vrcp", "110100:00:000:10000:two:vs:one:vd", "%Zp, %Yp", NONE, PSP);
    this.add("vrsq", "110100:00:000:10001:two:vs:one:vd", "%Zp, %Yp", NONE, PSP);
    this.add("vsin", "110100:00:000:10010:two:vs:one:vd", "%Zp, %Yp", NONE, PSP);
    this.add("vcos", "110100:00:000:10011:two:vs:one:vd", "%Zp, %Yp", NONE, PSP);
    this.add("vexp2", "110100:00:000:10100:two:vs:one:vd", "%Zp, %Yp", NONE, PSP);
    this.add("vlog2", "110100:00:000:10101:two:vs:one:vd", "%Zp, %Yp", NONE, PSP);
    this.add("vsqrt", "110100:00:000:10110:two:vs:one:vd", "%Zp, %Yp", NONE, PSP);
    this.add("vmov", "110100:00:000:00000:two:vs:one:vd", "%Zp, %Yp", NONE, PSP);
    this.add("vzero", "110100:00:000:00110:two:00000:one:vd", "%Zp", NONE, PSP);
    this.add("vone", "110100:00:000:00111:two:00000:one:vd", "%Zp", NONE, PSP);
    this.add("vcmp", "011011:000:vt:two:vs:one:0:imm4", "%Zp, %Yp, %Xp", NONE, PSP);
    this.add("vmin", "011011:010:vt:two:vs:one:vd", "%Zp, %Yp, %Xp", NONE, PSP);
    this.add("vmax", "011011:011:vt:two:vs:one:vd", "%Zp, %Yp, %Xp", NONE, PSP);
    this.add("vdot", "011001:001:vt:two:vs:one:vd", "%Zp, %Yp, %Xp", NONE, PSP);
    this.add("vscl", "011001:010:vt:two:vs:one:vd", "%Zp, %Yp, %Xs", NONE, PSP);
    this.add("vcrs", "011001:011:vt:two:vs:one:vd", "%Zt, %Yt, %Xt", NONE, PSP);
    this.add("vhdp", "011001:100:vt:two:vs:one:vd", "%Zp, %Yp, %Xp", NONE, PSP);
    this.add("lv.s", "110010:rs:vt5:imm14:vt2", "%Xs, %o", NONE, PSP);
    this.add("sv.s", "111010:rs:vt5:imm14:vt2", "%Xs, %o", NONE, PSP);
    this.add("mfv", "010010:00:011:rt:0:vs:0000000", "%t, %Xs", NONE, PSP);
    this.add("mtv", "010010:00:111:rt:0:vd:0000000", "%t, %Xs", NONE, PSP);
    this.add("mfvc", "010010:00:011:rt:0:imm8:0000000", "%t, %Xc", NONE, PSP);
    this.add("mtvc", "010010:00:111:rt:0:imm8:0000000", "%t, %Xc", NONE, PSP);
    this.add("bvf", "010010:01:000:imm3:00:imm16", "%O", OFFSET16, BRANCH | PSP);
    this.add("bvt", "010010:01:000:imm3:01:imm16", "%O", OFFSET16, BRANCH | PSP);
    this.add("bvfl", "010010:01:000:imm3:10:imm16", "%O", OFFSET16, BRANCH | LIKELY | PSP);
    this.add("bvtl", "010010:01:000:imm3:11:imm16", "%O", OFFSET16, BRANCH | LIKELY | PSP);
    this.add("madd", "011100:rs:rt:00000:00000:000000", "%s, %t", NONE, PSP);
    this.add("maddu", "011100:rs:rt:00000:00000:000001", "%s, %t", NONE, PSP);
    this.add("msub", "011100:rs:rt:00000:00000:000100", "%s, %t", NONE, PSP);
    this.add("msubu", "011100:rs:rt:00000:00000:000101", "%s, %t", NONE, PSP);
    this.add("mfc0", "010000:00000:rt:c0dr:00000:000000", "%t, %Cd", NONE, PSP);
    this.add("mtc0", "010000:00100:rt:c0dr:00000:000000", "%t, %Cd", NONE, PSP);
  }
}
// src/core/cpu/instruction/Disassembler.ts
class Disassembler {
  table;
  constructor() {
    this.table = InstructionTable.instance;
  }
  disassemble(instr) {
    const type = this.table.find(instr.data);
    if (!type) {
      return {
        pc: instr.pc,
        data: instr.data,
        mnemonic: "???",
        operands: hex(instr.data),
        text: `??? 0x${hex(instr.data)}`,
        type: null
      };
    }
    const operands = this.formatOperands(instr, type);
    return {
      pc: instr.pc,
      data: instr.data,
      mnemonic: type.name,
      operands,
      text: operands ? `${type.name} ${operands}` : type.name,
      type
    };
  }
  disassembleData(pc, data) {
    return this.disassemble(new Instruction(pc, data));
  }
  formatOperands(instr, type) {
    let result = "";
    for (let i = 0;i < type.format.length; i++) {
      const char = type.format[i];
      if (char === "%") {
        i++;
        const next = type.format[i];
        result += this.formatOperand(instr, next);
      } else {
        result += char;
      }
    }
    return result.trim();
  }
  formatOperand(instr, format2) {
    switch (format2) {
      case "d":
        return GPR_NAMES[instr.rd];
      case "s":
        return GPR_NAMES[instr.rs];
      case "t":
        return GPR_NAMES[instr.rt];
      case "D":
        return FPR_NAMES[instr.fd];
      case "S":
        return FPR_NAMES[instr.fs];
      case "T":
        return FPR_NAMES[instr.ft];
      case "a":
        return instr.sa.toString();
      case "i":
        return instr.imm16.toString();
      case "I":
        return `0x${hex(instr.uimm16, 4)}`;
      case "o":
        return `${instr.imm16}(${GPR_NAMES[instr.rs]})`;
      case "O":
        return `0x${hex(instr.branchTarget)}`;
      case "J":
        return `0x${hex(instr.jumpTarget)}`;
      case "n":
        if (format2 === "ne")
          return (instr.msb + 1).toString();
        if (format2 === "ni")
          return (instr.msb - instr.lsb + 1).toString();
        return "";
      default:
        return `%${format2}`;
    }
  }
  disassembleRange(memory, start, count) {
    const results = [];
    for (let i = 0;i < count; i++) {
      const pc = start + i * 4;
      const data = memory.lw(pc);
      results.push(this.disassembleData(pc, data));
    }
    return results;
  }
  formatDisassembly(results) {
    return results.map((r) => `0x${hex(r.pc)}: ${hex(r.data)}  ${r.text}`).join(`
`);
  }
}
var disassembler = new Disassembler;
// src/core/cpu/interpreter/VfpuHelpers.ts
function vfpuUnary(cpu, instr, op) {
  const size = instr.oneTwoSize;
  const vs = cpu.readVector(instr.vs, size);
  const result = new Float32Array(size);
  for (let i = 0;i < size; i++) {
    result[i] = op(vs[i]);
  }
  cpu.writeVector(instr.vd, size, result);
  return 0 /* CONTINUE */;
}
function vfpuBinary(cpu, instr, op) {
  const size = instr.oneTwoSize;
  const vs = cpu.readVector(instr.vs, size);
  const vt = cpu.readVector(instr.vt, size);
  const result = new Float32Array(size);
  for (let i = 0;i < size; i++) {
    result[i] = op(vs[i], vt[i]);
  }
  cpu.writeVector(instr.vd, size, result);
  return 0 /* CONTINUE */;
}
function vfpuConstant(cpu, instr, value) {
  const size = instr.oneTwoSize;
  const result = new Float32Array(size);
  result.fill(value);
  cpu.writeVector(instr.vd, size, result);
  return 0 /* CONTINUE */;
}
function vfpuDot(cpu, instr) {
  const size = instr.oneTwoSize;
  const vs = cpu.readVector(instr.vs, size);
  const vt = cpu.readVector(instr.vt, size);
  let dot = 0;
  for (let i = 0;i < size; i++) {
    dot += vs[i] * vt[i];
  }
  cpu.writeVector(instr.vd, 1, [dot]);
  return 0 /* CONTINUE */;
}
function vfpuScale(cpu, instr) {
  const size = instr.oneTwoSize;
  const vs = cpu.readVector(instr.vs, size);
  const scale = cpu.readVector(instr.vt, 1)[0];
  const result = new Float32Array(size);
  for (let i = 0;i < size; i++) {
    result[i] = vs[i] * scale;
  }
  cpu.writeVector(instr.vd, size, result);
  return 0 /* CONTINUE */;
}
var vAdd = (a, b) => a + b;
var vSub = (a, b) => a - b;
var vMul = (a, b) => a * b;
var vDiv = (a, b) => a / b;
var vMin = (a, b) => Math.min(a, b);
var vMax = (a, b) => Math.max(a, b);
var vAbs = (a) => Math.abs(a);
var vNeg = (a) => -a;
var vSqrt = (a) => Math.sqrt(a);
var vRcp = (a) => 1 / a;
var vRsq = (a) => 1 / Math.sqrt(a);
var vSin = (a) => Math.sin(a * Math.PI * 2);
var vCos = (a) => Math.cos(a * Math.PI * 2);
var vExp2 = (a) => Math.pow(2, a);
var vLog2 = (a) => Math.log2(a);
var vSat0 = (a) => Math.max(0, Math.min(1, a));
var vSat1 = (a) => Math.max(-1, Math.min(1, a));
var vMov = (a) => a;

// src/core/cpu/interpreter/HandlerFactories.ts
function rType(op) {
  return (cpu, i) => {
    cpu.setGpr(i.rd, op(cpu.getGpr(i.rs), cpu.getGpr(i.rt)) | 0);
    return 0 /* CONTINUE */;
  };
}
function iType(op) {
  return (cpu, i) => {
    cpu.setGpr(i.rt, op(cpu.getGpr(i.rs), i.imm16) | 0);
    return 0 /* CONTINUE */;
  };
}
function iTypeU(op) {
  return (cpu, i) => {
    cpu.setGpr(i.rt, op(cpu.getGpr(i.rs), i.uimm16));
    return 0 /* CONTINUE */;
  };
}
function shiftImm(op) {
  return (cpu, i) => {
    cpu.setGpr(i.rd, op(cpu.getGpr(i.rt), i.sa));
    return 0 /* CONTINUE */;
  };
}
function shiftReg(op) {
  return (cpu, i) => {
    cpu.setGpr(i.rd, op(cpu.getGpr(i.rt), cpu.getGpr(i.rs) & 31));
    return 0 /* CONTINUE */;
  };
}
function cmpR(pred) {
  return (cpu, i) => {
    cpu.setGpr(i.rd, pred(cpu.getGpr(i.rs), cpu.getGpr(i.rt)) ? 1 : 0);
    return 0 /* CONTINUE */;
  };
}
function cmpRU(pred) {
  return (cpu, i) => {
    cpu.setGpr(i.rd, pred(cpu.getGprU(i.rs), cpu.getGprU(i.rt)) ? 1 : 0);
    return 0 /* CONTINUE */;
  };
}
function cmpI(pred) {
  return (cpu, i) => {
    cpu.setGpr(i.rt, pred(cpu.getGpr(i.rs), i.imm16) ? 1 : 0);
    return 0 /* CONTINUE */;
  };
}
function cmpIU(pred) {
  return (cpu, i) => {
    cpu.setGpr(i.rt, pred(cpu.getGprU(i.rs), i.imm16 >>> 0) ? 1 : 0);
    return 0 /* CONTINUE */;
  };
}
function load(method) {
  return (cpu, i) => {
    const addr = cpu.getGpr(i.rs) + i.imm16 >>> 0;
    cpu.setGpr(i.rt, cpu.memory[method](addr));
    return 0 /* CONTINUE */;
  };
}
function loadUnaligned(method) {
  return (cpu, i) => {
    const addr = cpu.getGpr(i.rs) + i.imm16 >>> 0;
    cpu.setGpr(i.rt, cpu.memory[method](addr, cpu.getGpr(i.rt)));
    return 0 /* CONTINUE */;
  };
}
function store(method) {
  return (cpu, i) => {
    const addr = cpu.getGpr(i.rs) + i.imm16 >>> 0;
    cpu.memory[method](addr, cpu.getGpr(i.rt));
    return 0 /* CONTINUE */;
  };
}
function storeUnaligned(method) {
  return (cpu, i) => {
    const addr = cpu.getGpr(i.rs) + i.imm16 >>> 0;
    cpu.memory[method](addr, cpu.getGpr(i.rt));
    return 0 /* CONTINUE */;
  };
}
function executeBranch(cpu, target, execute, Instruction3) {
  const delaySlotPc = cpu.pc + 4 >>> 0;
  const delayInstr = new Instruction3(delaySlotPc, cpu.memory.lw(delaySlotPc));
  execute(cpu, delayInstr);
  cpu.pc = target;
  return 1 /* BRANCH */;
}
function branchRR(pred, ctx) {
  return (cpu, i) => {
    if (pred(cpu.getGpr(i.rs), cpu.getGpr(i.rt))) {
      return executeBranch(cpu, i.branchTarget, ctx.execute, ctx.Instruction);
    }
    return 0 /* CONTINUE */;
  };
}
function branchR(pred, ctx) {
  return (cpu, i) => {
    if (pred(cpu.getGpr(i.rs))) {
      return executeBranch(cpu, i.branchTarget, ctx.execute, ctx.Instruction);
    }
    return 0 /* CONTINUE */;
  };
}
function branchLink(pred, ctx) {
  return (cpu, i) => {
    cpu.ra = cpu.pc + 8 >>> 0;
    if (pred(cpu.getGpr(i.rs))) {
      return executeBranch(cpu, i.branchTarget, ctx.execute, ctx.Instruction);
    }
    return 0 /* CONTINUE */;
  };
}
function branchLikely(pred, useRt, ctx) {
  return (cpu, i) => {
    const rs = cpu.getGpr(i.rs);
    const rt = useRt ? cpu.getGpr(i.rt) : undefined;
    if (pred(rs, rt)) {
      return executeBranch(cpu, i.branchTarget, ctx.execute, ctx.Instruction);
    }
    cpu.pc = cpu.pc + 8 >>> 0;
    return 1 /* BRANCH */;
  };
}
function branchLinkLikely(pred, ctx) {
  return (cpu, i) => {
    cpu.ra = cpu.pc + 8 >>> 0;
    if (pred(cpu.getGpr(i.rs))) {
      return executeBranch(cpu, i.branchTarget, ctx.execute, ctx.Instruction);
    }
    cpu.pc = cpu.pc + 8 >>> 0;
    return 1 /* BRANCH */;
  };
}
function jump(ctx) {
  return (cpu, i) => {
    return executeBranch(cpu, i.jumpTarget, ctx.execute, ctx.Instruction);
  };
}
function jumpLink(ctx) {
  return (cpu, i) => {
    cpu.ra = cpu.pc + 8 >>> 0;
    return executeBranch(cpu, i.jumpTarget, ctx.execute, ctx.Instruction);
  };
}
function jumpReg(ctx) {
  return (cpu, i) => {
    return executeBranch(cpu, cpu.getGprU(i.rs), ctx.execute, ctx.Instruction);
  };
}
function jumpLinkReg(ctx) {
  return (cpu, i) => {
    const target = cpu.getGprU(i.rs);
    cpu.setGpr(i.rd, cpu.pc + 8 >>> 0);
    return executeBranch(cpu, target, ctx.execute, ctx.Instruction);
  };
}
function fpuBinary(op) {
  return (cpu, i) => {
    cpu.fpr[i.fd] = op(cpu.fpr[i.fs], cpu.fpr[i.ft]);
    return 0 /* CONTINUE */;
  };
}
function fpuUnary(op) {
  return (cpu, i) => {
    cpu.fpr[i.fd] = op(cpu.fpr[i.fs]);
    return 0 /* CONTINUE */;
  };
}
function fpuCmp(pred) {
  return (cpu, i) => {
    const result = pred(cpu.fpr[i.fs], cpu.fpr[i.ft]);
    cpu.fcr31 = result ? cpu.fcr31 | 8388608 : cpu.fcr31 & ~8388608;
    return 0 /* CONTINUE */;
  };
}
function fpuConvert(op, fromInt = false) {
  return (cpu, i) => {
    if (fromInt) {
      cpu.fpr[i.fd] = op(cpu.fprInt[i.fs]);
    } else {
      cpu.fprInt[i.fd] = op(cpu.fpr[i.fs]);
    }
    return 0 /* CONTINUE */;
  };
}
function fpuBranch(expected, ctx) {
  return (cpu, i) => {
    const cc = (cpu.fcr31 & 8388608) !== 0;
    if (cc === expected) {
      return executeBranch(cpu, i.branchTarget, ctx.execute, ctx.Instruction);
    }
    cpu.pc = cpu.pc + 4 >>> 0;
    return 0 /* CONTINUE */;
  };
}
function fpuBranchLikely(expected, ctx) {
  return (cpu, i) => {
    const cc = (cpu.fcr31 & 8388608) !== 0;
    if (cc === expected) {
      return executeBranch(cpu, i.branchTarget, ctx.execute, ctx.Instruction);
    }
    cpu.pc = cpu.pc + 8 >>> 0;
    return 1 /* BRANCH */;
  };
}
var ops = {
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  and: (a, b) => a & b,
  or: (a, b) => a | b,
  xor: (a, b) => a ^ b,
  nor: (a, b) => ~(a | b),
  sll: (a, b) => a << b,
  srl: (a, b) => a >>> b,
  sra: (a, b) => a >> b,
  lt: (a, b) => a < (b ?? 0),
  le: (a, b) => a <= (b ?? 0),
  gt: (a, b) => a > (b ?? 0),
  ge: (a, b) => a >= (b ?? 0),
  eq: (a, b) => a === (b ?? 0),
  ne: (a, b) => a !== (b ?? 0),
  fadd: (a, b) => a + b,
  fsub: (a, b) => a - b,
  fmul: (a, b) => a * b,
  fdiv: (a, b) => a / b,
  fsqrt: (a) => Math.sqrt(a),
  fabs: (a) => Math.abs(a),
  fneg: (a) => -a
};

// src/core/cpu/interpreter/Interpreter.ts
class Interpreter {
  table;
  handlers;
  constructor() {
    this.table = InstructionTable.instance;
    this.handlers = new Map;
    const ctx = {
      execute: this.execute.bind(this),
      Instruction
    };
    this.registerArithmetic();
    this.registerLogical();
    this.registerShifts();
    this.registerComparisons();
    this.registerMultDiv();
    this.registerLoadStore();
    this.registerBranches(ctx);
    this.registerJumps(ctx);
    this.registerSystem();
    this.registerBitOps();
    this.registerFpu(ctx);
    this.registerVfpu();
    this.registerExtended();
  }
  execute(cpu, instr) {
    const type = this.table.find(instr.data);
    if (!type) {
      console.warn(`Unknown instruction at 0x${instr.pc.toString(16)}: 0x${instr.data.toString(16)}`);
      return 4 /* UNKNOWN */;
    }
    const handler = this.handlers.get(type.name);
    if (!handler) {
      console.warn(`Unimplemented instruction: ${type.name}`);
      return 4 /* UNKNOWN */;
    }
    return handler(cpu, instr);
  }
  step(cpu) {
    const instr = Instruction.fromMemory(cpu.memory, cpu.pc);
    const result = this.execute(cpu, instr);
    if (result === 0 /* CONTINUE */) {
      cpu.pc = cpu.pc + 4 >>> 0;
    }
    return result;
  }
  run(cpu, maxInstructions = 1000) {
    for (let i = 0;i < maxInstructions; i++) {
      const result = this.step(cpu);
      if (result !== 0 /* CONTINUE */ && result !== 1 /* BRANCH */) {
        return result;
      }
    }
    return 0 /* CONTINUE */;
  }
  registerArithmetic() {
    this.handlers.set("add", rType(ops.add));
    this.handlers.set("addu", rType(ops.add));
    this.handlers.set("sub", rType(ops.sub));
    this.handlers.set("subu", rType(ops.sub));
    this.handlers.set("addi", iType(ops.add));
    this.handlers.set("addiu", iType(ops.add));
    this.handlers.set("lui", (cpu, i) => {
      cpu.setGpr(i.rt, i.uimm16 << 16);
      return 0 /* CONTINUE */;
    });
  }
  registerLogical() {
    this.handlers.set("and", rType(ops.and));
    this.handlers.set("or", rType(ops.or));
    this.handlers.set("xor", rType(ops.xor));
    this.handlers.set("nor", rType(ops.nor));
    this.handlers.set("andi", iTypeU(ops.and));
    this.handlers.set("ori", iTypeU(ops.or));
    this.handlers.set("xori", iTypeU(ops.xor));
  }
  registerShifts() {
    this.handlers.set("sll", shiftImm(ops.sll));
    this.handlers.set("srl", shiftImm(ops.srl));
    this.handlers.set("sra", shiftImm(ops.sra));
    this.handlers.set("sllv", shiftReg(ops.sll));
    this.handlers.set("srlv", shiftReg(ops.srl));
    this.handlers.set("srav", shiftReg(ops.sra));
    this.handlers.set("rotr", (cpu, i) => {
      cpu.setGpr(i.rd, BitUtils.rotr(cpu.getGpr(i.rt), i.sa));
      return 0 /* CONTINUE */;
    });
    this.handlers.set("rotrv", (cpu, i) => {
      cpu.setGpr(i.rd, BitUtils.rotr(cpu.getGpr(i.rt), cpu.getGpr(i.rs)));
      return 0 /* CONTINUE */;
    });
  }
  registerComparisons() {
    this.handlers.set("slt", cmpR(ops.lt));
    this.handlers.set("sltu", cmpRU(ops.lt));
    this.handlers.set("slti", cmpI(ops.lt));
    this.handlers.set("sltiu", cmpIU(ops.lt));
  }
  registerMultDiv() {
    this.handlers.set("mult", (cpu, i) => {
      const result = BigInt(cpu.getGpr(i.rs)) * BigInt(cpu.getGpr(i.rt));
      cpu.lo = Number(result & 0xFFFFFFFFn) | 0;
      cpu.hi = Number(result >> 32n & 0xFFFFFFFFn) | 0;
      return 0 /* CONTINUE */;
    });
    this.handlers.set("multu", (cpu, i) => {
      const result = BigInt(cpu.getGprU(i.rs)) * BigInt(cpu.getGprU(i.rt));
      cpu.lo = Number(result & 0xFFFFFFFFn) | 0;
      cpu.hi = Number(result >> 32n & 0xFFFFFFFFn) | 0;
      return 0 /* CONTINUE */;
    });
    this.handlers.set("div", (cpu, i) => {
      const rt = cpu.getGpr(i.rt);
      if (rt !== 0) {
        const rs = cpu.getGpr(i.rs);
        cpu.lo = rs / rt | 0;
        cpu.hi = rs % rt | 0;
      }
      return 0 /* CONTINUE */;
    });
    this.handlers.set("divu", (cpu, i) => {
      const rt = cpu.getGprU(i.rt);
      if (rt !== 0) {
        const rs = cpu.getGprU(i.rs);
        cpu.lo = rs / rt >>> 0;
        cpu.hi = rs % rt >>> 0;
      }
      return 0 /* CONTINUE */;
    });
    this.handlers.set("mfhi", (cpu, i) => {
      cpu.setGpr(i.rd, cpu.hi);
      return 0 /* CONTINUE */;
    });
    this.handlers.set("mflo", (cpu, i) => {
      cpu.setGpr(i.rd, cpu.lo);
      return 0 /* CONTINUE */;
    });
    this.handlers.set("mthi", (cpu, i) => {
      cpu.hi = cpu.getGpr(i.rs);
      return 0 /* CONTINUE */;
    });
    this.handlers.set("mtlo", (cpu, i) => {
      cpu.lo = cpu.getGpr(i.rs);
      return 0 /* CONTINUE */;
    });
  }
  registerLoadStore() {
    this.handlers.set("lb", load("lb"));
    this.handlers.set("lbu", load("lbu"));
    this.handlers.set("lh", load("lh"));
    this.handlers.set("lhu", load("lhu"));
    this.handlers.set("lw", load("lw"));
    this.handlers.set("lwl", loadUnaligned("lwl"));
    this.handlers.set("lwr", loadUnaligned("lwr"));
    this.handlers.set("sb", store("sb"));
    this.handlers.set("sh", store("sh"));
    this.handlers.set("sw", store("sw"));
    this.handlers.set("swl", storeUnaligned("swl"));
    this.handlers.set("swr", storeUnaligned("swr"));
  }
  registerBranches(ctx) {
    this.handlers.set("beq", branchRR(ops.eq, ctx));
    this.handlers.set("bne", branchRR(ops.ne, ctx));
    this.handlers.set("bgez", branchR((rs) => rs >= 0, ctx));
    this.handlers.set("bgtz", branchR((rs) => rs > 0, ctx));
    this.handlers.set("blez", branchR((rs) => rs <= 0, ctx));
    this.handlers.set("bltz", branchR((rs) => rs < 0, ctx));
    this.handlers.set("bgezal", branchLink((rs) => rs >= 0, ctx));
    this.handlers.set("bltzal", branchLink((rs) => rs < 0, ctx));
    this.handlers.set("beql", branchLikely((rs, rt) => rs === rt, true, ctx));
    this.handlers.set("bnel", branchLikely((rs, rt) => rs !== rt, true, ctx));
    this.handlers.set("bgtzl", branchLikely((rs) => rs > 0, false, ctx));
    this.handlers.set("blezl", branchLikely((rs) => rs <= 0, false, ctx));
    this.handlers.set("bgezl", branchLikely((rs) => rs >= 0, false, ctx));
    this.handlers.set("bltzl", branchLikely((rs) => rs < 0, false, ctx));
    this.handlers.set("bgezall", branchLinkLikely((rs) => rs >= 0, ctx));
    this.handlers.set("bltzall", branchLinkLikely((rs) => rs < 0, ctx));
  }
  registerJumps(ctx) {
    this.handlers.set("j", jump(ctx));
    this.handlers.set("jal", jumpLink(ctx));
    this.handlers.set("jr", jumpReg(ctx));
    this.handlers.set("jalr", jumpLinkReg(ctx));
  }
  registerSystem() {
    this.handlers.set("syscall", () => 2 /* SYSCALL */);
    this.handlers.set("break", () => 3 /* BREAK */);
    this.handlers.set("sync", () => 0 /* CONTINUE */);
    this.handlers.set("nop", () => 0 /* CONTINUE */);
  }
  registerBitOps() {
    this.handlers.set("movz", (cpu, i) => {
      if (cpu.getGpr(i.rt) === 0)
        cpu.setGpr(i.rd, cpu.getGpr(i.rs));
      return 0 /* CONTINUE */;
    });
    this.handlers.set("movn", (cpu, i) => {
      if (cpu.getGpr(i.rt) !== 0)
        cpu.setGpr(i.rd, cpu.getGpr(i.rs));
      return 0 /* CONTINUE */;
    });
    this.handlers.set("seb", (cpu, i) => {
      cpu.setGpr(i.rd, BitUtils.seb(cpu.getGpr(i.rt)));
      return 0 /* CONTINUE */;
    });
    this.handlers.set("seh", (cpu, i) => {
      cpu.setGpr(i.rd, BitUtils.seh(cpu.getGpr(i.rt)));
      return 0 /* CONTINUE */;
    });
    this.handlers.set("ext", (cpu, i) => {
      cpu.setGpr(i.rt, BitUtils.extract(cpu.getGprU(i.rs), i.lsb, i.msb + 1));
      return 0 /* CONTINUE */;
    });
    this.handlers.set("ins", (cpu, i) => {
      const size = i.msb - i.lsb + 1;
      cpu.setGpr(i.rt, BitUtils.insert(cpu.getGprU(i.rt), i.lsb, size, cpu.getGprU(i.rs)));
      return 0 /* CONTINUE */;
    });
    this.handlers.set("clz", (cpu, i) => {
      cpu.setGpr(i.rd, BitUtils.clz(cpu.getGprU(i.rs)));
      return 0 /* CONTINUE */;
    });
    this.handlers.set("clo", (cpu, i) => {
      cpu.setGpr(i.rd, BitUtils.clo(cpu.getGprU(i.rs)));
      return 0 /* CONTINUE */;
    });
    this.handlers.set("max", (cpu, i) => {
      cpu.setGpr(i.rd, Math.max(cpu.getGpr(i.rs), cpu.getGpr(i.rt)));
      return 0 /* CONTINUE */;
    });
    this.handlers.set("min", (cpu, i) => {
      cpu.setGpr(i.rd, Math.min(cpu.getGpr(i.rs), cpu.getGpr(i.rt)));
      return 0 /* CONTINUE */;
    });
    this.handlers.set("wsbh", (cpu, i) => {
      cpu.setGpr(i.rd, BitUtils.wsbh(cpu.getGprU(i.rt)));
      return 0 /* CONTINUE */;
    });
    this.handlers.set("wsbw", (cpu, i) => {
      cpu.setGpr(i.rd, BitUtils.wsbw(cpu.getGprU(i.rt)));
      return 0 /* CONTINUE */;
    });
    this.handlers.set("bitrev", (cpu, i) => {
      cpu.setGpr(i.rd, BitUtils.bitrev(cpu.getGprU(i.rt)));
      return 0 /* CONTINUE */;
    });
  }
  registerFpu(ctx) {
    this.handlers.set("mfc1", (cpu, i) => {
      cpu.setGpr(i.rt, cpu.fprInt[i.fs]);
      return 0 /* CONTINUE */;
    });
    this.handlers.set("mtc1", (cpu, i) => {
      cpu.fprInt[i.fs] = cpu.getGpr(i.rt);
      return 0 /* CONTINUE */;
    });
    this.handlers.set("cfc1", (cpu, i) => {
      cpu.setGpr(i.rt, i.fs === 0 ? cpu.fcr0 : i.fs === 31 ? cpu.fcr31 : 0);
      return 0 /* CONTINUE */;
    });
    this.handlers.set("ctc1", (cpu, i) => {
      if (i.fs === 31)
        cpu.fcr31 = cpu.getGpr(i.rt);
      return 0 /* CONTINUE */;
    });
    this.handlers.set("add.s", fpuBinary(ops.fadd));
    this.handlers.set("sub.s", fpuBinary(ops.fsub));
    this.handlers.set("mul.s", fpuBinary(ops.fmul));
    this.handlers.set("div.s", fpuBinary(ops.fdiv));
    this.handlers.set("sqrt.s", fpuUnary(ops.fsqrt));
    this.handlers.set("abs.s", fpuUnary(ops.fabs));
    this.handlers.set("neg.s", fpuUnary(ops.fneg));
    this.handlers.set("mov.s", fpuUnary((v) => v));
    this.handlers.set("trunc.w.s", fpuConvert(Math.trunc));
    this.handlers.set("round.w.s", fpuConvert(Math.round));
    this.handlers.set("ceil.w.s", fpuConvert(Math.ceil));
    this.handlers.set("floor.w.s", fpuConvert(Math.floor));
    this.handlers.set("cvt.w.s", fpuConvert(Math.trunc));
    this.handlers.set("cvt.s.w", fpuConvert((v) => v, true));
    this.handlers.set("c.eq.s", fpuCmp(ops.eq));
    this.handlers.set("c.lt.s", fpuCmp(ops.lt));
    this.handlers.set("c.le.s", fpuCmp(ops.le));
    this.handlers.set("bc1f", fpuBranch(false, ctx));
    this.handlers.set("bc1t", fpuBranch(true, ctx));
    this.handlers.set("bc1fl", fpuBranchLikely(false, ctx));
    this.handlers.set("bc1tl", fpuBranchLikely(true, ctx));
    this.handlers.set("lwc1", (cpu, i) => {
      cpu.fprInt[i.ft] = cpu.memory.lw(cpu.getGpr(i.rs) + i.imm16 >>> 0);
      return 0 /* CONTINUE */;
    });
    this.handlers.set("swc1", (cpu, i) => {
      cpu.memory.sw(cpu.getGpr(i.rs) + i.imm16 >>> 0, cpu.fprInt[i.ft]);
      return 0 /* CONTINUE */;
    });
  }
  registerVfpu() {
    this.handlers.set("vadd", (cpu, i) => vfpuBinary(cpu, i, vAdd));
    this.handlers.set("vsub", (cpu, i) => vfpuBinary(cpu, i, vSub));
    this.handlers.set("vmul", (cpu, i) => vfpuBinary(cpu, i, vMul));
    this.handlers.set("vdiv", (cpu, i) => vfpuBinary(cpu, i, vDiv));
    this.handlers.set("vmin", (cpu, i) => vfpuBinary(cpu, i, vMin));
    this.handlers.set("vmax", (cpu, i) => vfpuBinary(cpu, i, vMax));
    this.handlers.set("vmov", (cpu, i) => vfpuUnary(cpu, i, vMov));
    this.handlers.set("vabs", (cpu, i) => vfpuUnary(cpu, i, vAbs));
    this.handlers.set("vneg", (cpu, i) => vfpuUnary(cpu, i, vNeg));
    this.handlers.set("vsqrt", (cpu, i) => vfpuUnary(cpu, i, vSqrt));
    this.handlers.set("vrcp", (cpu, i) => vfpuUnary(cpu, i, vRcp));
    this.handlers.set("vrsq", (cpu, i) => vfpuUnary(cpu, i, vRsq));
    this.handlers.set("vsin", (cpu, i) => vfpuUnary(cpu, i, vSin));
    this.handlers.set("vcos", (cpu, i) => vfpuUnary(cpu, i, vCos));
    this.handlers.set("vexp2", (cpu, i) => vfpuUnary(cpu, i, vExp2));
    this.handlers.set("vlog2", (cpu, i) => vfpuUnary(cpu, i, vLog2));
    this.handlers.set("vsat0", (cpu, i) => vfpuUnary(cpu, i, vSat0));
    this.handlers.set("vsat1", (cpu, i) => vfpuUnary(cpu, i, vSat1));
    this.handlers.set("vzero", (cpu, i) => vfpuConstant(cpu, i, 0));
    this.handlers.set("vone", (cpu, i) => vfpuConstant(cpu, i, 1));
    this.handlers.set("vdot", (cpu, i) => vfpuDot(cpu, i));
    this.handlers.set("vscl", (cpu, i) => vfpuScale(cpu, i));
    this.handlers.set("mfv", (cpu, i) => {
      const regs = cpu.getVectorRegs(i.vs, 1);
      const buf = new Float32Array(1);
      buf[0] = cpu.vfpr[regs[0]];
      cpu.setGpr(i.rt, new Int32Array(buf.buffer)[0]);
      return 0 /* CONTINUE */;
    });
    this.handlers.set("mtv", (cpu, i) => {
      const regs = cpu.getVectorRegs(i.vd, 1);
      const buf = new Int32Array(1);
      buf[0] = cpu.getGpr(i.rt);
      cpu.vfpr[regs[0]] = new Float32Array(buf.buffer)[0];
      return 0 /* CONTINUE */;
    });
  }
  registerExtended() {
    const macc = (cpu, i, signed, add) => {
      const rs = signed ? BigInt(cpu.getGpr(i.rs)) : BigInt(cpu.getGprU(i.rs));
      const rt = signed ? BigInt(cpu.getGpr(i.rt)) : BigInt(cpu.getGprU(i.rt));
      const hilo = BigInt(signed ? cpu.hi : cpu.hi >>> 0) << 32n | BigInt(cpu.lo >>> 0);
      const result = add ? hilo + rs * rt : hilo - rs * rt;
      cpu.lo = Number(result & 0xFFFFFFFFn) | 0;
      cpu.hi = Number(result >> 32n & 0xFFFFFFFFn) | 0;
      return 0 /* CONTINUE */;
    };
    this.handlers.set("madd", (cpu, i) => macc(cpu, i, true, true));
    this.handlers.set("maddu", (cpu, i) => macc(cpu, i, false, true));
    this.handlers.set("msub", (cpu, i) => macc(cpu, i, true, false));
    this.handlers.set("msubu", (cpu, i) => macc(cpu, i, false, false));
    this.handlers.set("mfc0", (cpu, i) => {
      cpu.setGpr(i.rt, cpu.cop0[i.c0dr]);
      return 0 /* CONTINUE */;
    });
    this.handlers.set("mtc0", (cpu, i) => {
      cpu.cop0[i.c0dr] = cpu.getGpr(i.rt);
      return 0 /* CONTINUE */;
    });
  }
}
// src/core/cpu/jit/CodeGenerator.ts
class CodeGenerator {
  table;
  constructor() {
    this.table = InstructionTable.instance;
  }
  generate(readWord, startPc, maxInstructions = 100) {
    const instructions = [];
    let pc = startPc;
    let blockEnd = 0 /* CONTINUE */;
    for (let i = 0;i < maxInstructions; i++) {
      const data = readWord(pc);
      const type = this.table.find(data);
      if (!type) {
        break;
      }
      instructions.push({ pc, data, type });
      if (type.isSyscall || type.isBreak) {
        blockEnd = 3 /* SYSTEM */;
        break;
      }
      if (type.isJumpNoLink && !type.isRegister) {
        const delayData = readWord(pc + 4);
        const delayType = this.table.find(delayData);
        if (delayType) {
          instructions.push({ pc: pc + 4, data: delayData, type: delayType });
        }
        blockEnd = 1 /* JUMP */;
        break;
      }
      if (type.isJump || type.isBranch) {
        const delayData = readWord(pc + 4);
        const delayType = this.table.find(delayData);
        if (delayType) {
          instructions.push({ pc: pc + 4, data: delayData, type: delayType });
        }
        blockEnd = 2 /* BRANCH */;
        break;
      }
      pc += 4;
    }
    if (instructions.length === 0) {
      return null;
    }
    const code = this.generateCode(instructions, blockEnd);
    const endPc = instructions[instructions.length - 1].pc + 4;
    try {
      const func = new Function("state", code);
      return {
        func,
        startPc,
        endPc,
        instructionCount: instructions.length
      };
    } catch (e) {
      console.error("JIT compilation failed:", e);
      console.error("Generated code:", code);
      return null;
    }
  }
  generateCode(instructions, blockEnd) {
    const lines = [];
    lines.push(`"use strict";`);
    lines.push(`const gpr = state.gpr;`);
    lines.push(`const fpr = state.fpr;`);
    lines.push(`const memory = state.memory;`);
    lines.push(`let branchTarget = 0;`);
    lines.push(`let takeBranch = false;`);
    lines.push(``);
    for (let i = 0;i < instructions.length; i++) {
      const { pc, data, type } = instructions[i];
      const instr = new Instruction(pc, data);
      const isDelaySlot = i === instructions.length - 1 && blockEnd !== 0 /* CONTINUE */;
      lines.push(`// 0x${pc.toString(16).padStart(8, "0")}: ${type.name}`);
      const instrCode = this.generateInstruction(instr, type, isDelaySlot);
      if (instrCode) {
        lines.push(instrCode);
      }
      lines.push(``);
    }
    const lastInstr = instructions[instructions.length - 1];
    if (blockEnd === 3 /* SYSTEM */) {
      lines.push(`state.pc = 0x${lastInstr.pc.toString(16)};`);
      lines.push(`return -1; // System call`);
    } else if (blockEnd === 1 /* JUMP */ || blockEnd === 2 /* BRANCH */) {
      lines.push(`if (takeBranch) {`);
      lines.push(`  state.pc = branchTarget >>> 0;`);
      lines.push(`  return branchTarget >>> 0;`);
      lines.push(`} else {`);
      lines.push(`  state.pc = 0x${(lastInstr.pc + 4).toString(16)};`);
      lines.push(`  return 0x${(lastInstr.pc + 4).toString(16)};`);
      lines.push(`}`);
    } else {
      lines.push(`state.pc = 0x${(lastInstr.pc + 4).toString(16)};`);
      lines.push(`return 0x${(lastInstr.pc + 4).toString(16)};`);
    }
    return lines.join(`
`);
  }
  generateInstruction(instr, type, isDelaySlot) {
    const name = type.name;
    switch (name) {
      case "add":
      case "addu":
        return this.genR(`gpr[${instr.rd}] = (gpr[${instr.rs}] + gpr[${instr.rt}]) | 0;`, instr.rd);
      case "addi":
      case "addiu":
        return this.genR(`gpr[${instr.rt}] = (gpr[${instr.rs}] + ${instr.imm16}) | 0;`, instr.rt);
      case "sub":
      case "subu":
        return this.genR(`gpr[${instr.rd}] = (gpr[${instr.rs}] - gpr[${instr.rt}]) | 0;`, instr.rd);
      case "lui":
        return this.genR(`gpr[${instr.rt}] = ${instr.uimm16 << 16};`, instr.rt);
      case "and":
        return this.genR(`gpr[${instr.rd}] = gpr[${instr.rs}] & gpr[${instr.rt}];`, instr.rd);
      case "andi":
        return this.genR(`gpr[${instr.rt}] = gpr[${instr.rs}] & ${instr.uimm16};`, instr.rt);
      case "or":
        return this.genR(`gpr[${instr.rd}] = gpr[${instr.rs}] | gpr[${instr.rt}];`, instr.rd);
      case "ori":
        return this.genR(`gpr[${instr.rt}] = gpr[${instr.rs}] | ${instr.uimm16};`, instr.rt);
      case "xor":
        return this.genR(`gpr[${instr.rd}] = gpr[${instr.rs}] ^ gpr[${instr.rt}];`, instr.rd);
      case "xori":
        return this.genR(`gpr[${instr.rt}] = gpr[${instr.rs}] ^ ${instr.uimm16};`, instr.rt);
      case "nor":
        return this.genR(`gpr[${instr.rd}] = ~(gpr[${instr.rs}] | gpr[${instr.rt}]);`, instr.rd);
      case "sll":
        if (instr.data === 0)
          return "";
        return this.genR(`gpr[${instr.rd}] = gpr[${instr.rt}] << ${instr.sa};`, instr.rd);
      case "srl":
        return this.genR(`gpr[${instr.rd}] = gpr[${instr.rt}] >>> ${instr.sa};`, instr.rd);
      case "sra":
        return this.genR(`gpr[${instr.rd}] = gpr[${instr.rt}] >> ${instr.sa};`, instr.rd);
      case "sllv":
        return this.genR(`gpr[${instr.rd}] = gpr[${instr.rt}] << (gpr[${instr.rs}] & 31);`, instr.rd);
      case "srlv":
        return this.genR(`gpr[${instr.rd}] = gpr[${instr.rt}] >>> (gpr[${instr.rs}] & 31);`, instr.rd);
      case "srav":
        return this.genR(`gpr[${instr.rd}] = gpr[${instr.rt}] >> (gpr[${instr.rs}] & 31);`, instr.rd);
      case "slt":
        return this.genR(`gpr[${instr.rd}] = (gpr[${instr.rs}] < gpr[${instr.rt}]) ? 1 : 0;`, instr.rd);
      case "sltu":
        return this.genR(`gpr[${instr.rd}] = ((gpr[${instr.rs}] >>> 0) < (gpr[${instr.rt}] >>> 0)) ? 1 : 0;`, instr.rd);
      case "slti":
        return this.genR(`gpr[${instr.rt}] = (gpr[${instr.rs}] < ${instr.imm16}) ? 1 : 0;`, instr.rt);
      case "sltiu":
        return this.genR(`gpr[${instr.rt}] = ((gpr[${instr.rs}] >>> 0) < ${instr.imm16 << 16 >> 16 >>> 0}) ? 1 : 0;`, instr.rt);
      case "mult":
        return `{ const r = BigInt(gpr[${instr.rs}]) * BigInt(gpr[${instr.rt}]); state.lo = Number(r & 0xFFFFFFFFn); state.hi = Number(r >> 32n); }`;
      case "multu":
        return `{ const r = BigInt(gpr[${instr.rs}] >>> 0) * BigInt(gpr[${instr.rt}] >>> 0); state.lo = Number(r & 0xFFFFFFFFn); state.hi = Number(r >> 32n); }`;
      case "div":
        return `if (gpr[${instr.rt}] !== 0) { state.lo = (gpr[${instr.rs}] / gpr[${instr.rt}]) | 0; state.hi = (gpr[${instr.rs}] % gpr[${instr.rt}]) | 0; }`;
      case "divu":
        return `if (gpr[${instr.rt}] !== 0) { state.lo = ((gpr[${instr.rs}] >>> 0) / (gpr[${instr.rt}] >>> 0)) >>> 0; state.hi = ((gpr[${instr.rs}] >>> 0) % (gpr[${instr.rt}] >>> 0)) >>> 0; }`;
      case "mfhi":
        return this.genR(`gpr[${instr.rd}] = state.hi;`, instr.rd);
      case "mflo":
        return this.genR(`gpr[${instr.rd}] = state.lo;`, instr.rd);
      case "mthi":
        return `state.hi = gpr[${instr.rs}];`;
      case "mtlo":
        return `state.lo = gpr[${instr.rs}];`;
      case "lw":
        return this.genR(`gpr[${instr.rt}] = memory.lw((gpr[${instr.rs}] + ${instr.imm16}) >>> 0);`, instr.rt);
      case "lh":
        return this.genR(`gpr[${instr.rt}] = memory.lh((gpr[${instr.rs}] + ${instr.imm16}) >>> 0);`, instr.rt);
      case "lhu":
        return this.genR(`gpr[${instr.rt}] = memory.lhu((gpr[${instr.rs}] + ${instr.imm16}) >>> 0);`, instr.rt);
      case "lb":
        return this.genR(`gpr[${instr.rt}] = memory.lb((gpr[${instr.rs}] + ${instr.imm16}) >>> 0);`, instr.rt);
      case "lbu":
        return this.genR(`gpr[${instr.rt}] = memory.lbu((gpr[${instr.rs}] + ${instr.imm16}) >>> 0);`, instr.rt);
      case "sw":
        return `memory.sw((gpr[${instr.rs}] + ${instr.imm16}) >>> 0, gpr[${instr.rt}]);`;
      case "sh":
        return `memory.sh((gpr[${instr.rs}] + ${instr.imm16}) >>> 0, gpr[${instr.rt}]);`;
      case "sb":
        return `memory.sb((gpr[${instr.rs}] + ${instr.imm16}) >>> 0, gpr[${instr.rt}]);`;
      case "beq":
        return `if (gpr[${instr.rs}] === gpr[${instr.rt}]) { takeBranch = true; branchTarget = 0x${instr.branchTarget.toString(16)}; }`;
      case "bne":
        return `if (gpr[${instr.rs}] !== gpr[${instr.rt}]) { takeBranch = true; branchTarget = 0x${instr.branchTarget.toString(16)}; }`;
      case "bgtz":
        return `if (gpr[${instr.rs}] > 0) { takeBranch = true; branchTarget = 0x${instr.branchTarget.toString(16)}; }`;
      case "blez":
        return `if (gpr[${instr.rs}] <= 0) { takeBranch = true; branchTarget = 0x${instr.branchTarget.toString(16)}; }`;
      case "bgez":
        return `if (gpr[${instr.rs}] >= 0) { takeBranch = true; branchTarget = 0x${instr.branchTarget.toString(16)}; }`;
      case "bltz":
        return `if (gpr[${instr.rs}] < 0) { takeBranch = true; branchTarget = 0x${instr.branchTarget.toString(16)}; }`;
      case "bgezal":
        return `gpr[31] = 0x${(instr.pc + 8).toString(16)}; if (gpr[${instr.rs}] >= 0) { takeBranch = true; branchTarget = 0x${instr.branchTarget.toString(16)}; }`;
      case "bltzal":
        return `gpr[31] = 0x${(instr.pc + 8).toString(16)}; if (gpr[${instr.rs}] < 0) { takeBranch = true; branchTarget = 0x${instr.branchTarget.toString(16)}; }`;
      case "j":
        return `takeBranch = true; branchTarget = 0x${instr.jumpTarget.toString(16)};`;
      case "jal":
        return `gpr[31] = 0x${(instr.pc + 8).toString(16)}; takeBranch = true; branchTarget = 0x${instr.jumpTarget.toString(16)};`;
      case "jr":
        return `takeBranch = true; branchTarget = gpr[${instr.rs}] >>> 0;`;
      case "jalr":
        return `{ const target = gpr[${instr.rs}] >>> 0; gpr[${instr.rd !== 0 ? instr.rd : 31}] = 0x${(instr.pc + 8).toString(16)}; takeBranch = true; branchTarget = target; }`;
      case "syscall":
        return `return -1; // SYSCALL`;
      case "break":
        return `return -2; // BREAK`;
      case "nop":
      case "sync":
        return "";
      default:
        return `state.pc = 0x${instr.pc.toString(16)}; throw new Error('JIT: unimplemented ${name}');`;
    }
  }
  genR(code, rd) {
    if (rd === 0)
      return "";
    return code;
  }
}
// src/core/cpu/jit/JitCache.ts
class CachedFunction {
  startPc;
  compiled = null;
  generator;
  memory;
  constructor(startPc, generator, memory) {
    this.startPc = startPc;
    this.generator = generator;
    this.memory = memory;
  }
  execute(state) {
    if (this.compiled === null) {
      this.compiled = this.generator.generate((addr) => this.memory.lw(addr), this.startPc);
      if (this.compiled === null) {
        return -1;
      }
    }
    return this.compiled.func(state);
  }
  invalidate() {
    this.compiled = null;
  }
  get isCompiled() {
    return this.compiled !== null;
  }
  get info() {
    return this.compiled;
  }
}

class JitCache {
  cache = new Map;
  generator;
  memory;
  stats = {
    hits: 0,
    misses: 0,
    compilations: 0,
    invalidations: 0
  };
  constructor(memory) {
    this.generator = new CodeGenerator;
    this.memory = memory;
  }
  get(pc) {
    let cached = this.cache.get(pc);
    if (cached) {
      this.stats.hits++;
      return cached;
    }
    this.stats.misses++;
    cached = new CachedFunction(pc, this.generator, this.memory);
    this.cache.set(pc, cached);
    return cached;
  }
  execute(state, pc) {
    const cached = this.get(pc);
    if (!cached.isCompiled) {
      this.stats.compilations++;
    }
    return cached.execute(state);
  }
  invalidateAll() {
    for (const cached of this.cache.values()) {
      cached.invalidate();
    }
    this.cache.clear();
    this.stats.invalidations++;
  }
  invalidateRange(from, to) {
    for (const [pc, cached] of this.cache) {
      if (pc >= from && pc < to) {
        cached.invalidate();
        this.cache.delete(pc);
      } else if (cached.isCompiled && cached.info) {
        const info = cached.info;
        if (info.startPc < to && info.endPc > from) {
          cached.invalidate();
          this.cache.delete(pc);
        }
      }
    }
    this.stats.invalidations++;
  }
  get size() {
    return this.cache.size;
  }
  get compiledCount() {
    let count = 0;
    for (const cached of this.cache.values()) {
      if (cached.isCompiled)
        count++;
    }
    return count;
  }
  clear() {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      compilations: 0,
      invalidations: 0
    };
  }
  getStats() {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    return [
      `Cache size: ${this.size}`,
      `Compiled: ${this.compiledCount}`,
      `Hits: ${this.stats.hits}`,
      `Misses: ${this.stats.misses}`,
      `Hit rate: ${(hitRate * 100).toFixed(1)}%`,
      `Compilations: ${this.stats.compilations}`,
      `Invalidations: ${this.stats.invalidations}`
    ].join(`
`);
  }
}
// src/core/cpu/Cpu.ts
var CpuStatus;
((CpuStatus2) => {
  CpuStatus2[CpuStatus2["STOPPED"] = 0] = "STOPPED";
  CpuStatus2[CpuStatus2["RUNNING"] = 1] = "RUNNING";
  CpuStatus2[CpuStatus2["BREAKPOINT"] = 2] = "BREAKPOINT";
  CpuStatus2[CpuStatus2["SYSCALL"] = 3] = "SYSCALL";
  CpuStatus2[CpuStatus2["ERROR"] = 4] = "ERROR";
})(CpuStatus ||= {});

class Cpu {
  memory;
  state;
  interpreter;
  table;
  mode = 0 /* INTERPRETER */;
  _status = 0 /* STOPPED */;
  breakpoints = new Map;
  events = {};
  _instructionsExecuted = 0;
  _cycles = 0;
  _jitCache = null;
  constructor(memory) {
    this.memory = memory ?? new Memory;
    this.state = new CpuState(this.memory);
    this.interpreter = new Interpreter;
    this.table = InstructionTable.instance;
  }
  get jitCache() {
    if (this._jitCache === null) {
      this._jitCache = new JitCache(this.memory);
    }
    return this._jitCache;
  }
  get status() {
    return this._status;
  }
  get pc() {
    return this.state.pc;
  }
  set pc(value) {
    this.state.pc = value >>> 0;
  }
  get instructionsExecuted() {
    return this._instructionsExecuted;
  }
  get cycles() {
    return this._cycles;
  }
  get isRunning() {
    return this._status === 1 /* RUNNING */;
  }
  on(events) {
    this.events = { ...this.events, ...events };
  }
  setSyscallHandler(handler) {
    this.events.onSyscall = handler;
  }
  addBreakpoint(address) {
    this.breakpoints.set(address >>> 0, true);
  }
  removeBreakpoint(address) {
    this.breakpoints.delete(address >>> 0);
  }
  hasBreakpoint(address) {
    return this.breakpoints.get(address >>> 0) === true;
  }
  toggleBreakpoint(address, enabled) {
    if (this.breakpoints.has(address >>> 0)) {
      this.breakpoints.set(address >>> 0, enabled);
    }
  }
  clearBreakpoints() {
    this.breakpoints.clear();
  }
  getBreakpoints() {
    return Array.from(this.breakpoints.keys());
  }
  step() {
    if (this._status === 4 /* ERROR */) {
      return this._status;
    }
    try {
      if (this.hasBreakpoint(this.state.pc)) {
        if (this.events.onBreakpoint) {
          const shouldContinue = this.events.onBreakpoint(this, this.state.pc);
          if (!shouldContinue) {
            this._status = 2 /* BREAKPOINT */;
            return this._status;
          }
        } else {
          this._status = 2 /* BREAKPOINT */;
          return this._status;
        }
      }
      const instr = Instruction.fromMemory(this.memory, this.state.pc);
      if (this.events.onStep) {
        this.events.onStep(this, instr);
      }
      const result = this.interpreter.execute(this.state, instr);
      this._instructionsExecuted++;
      this._cycles++;
      switch (result) {
        case 0 /* CONTINUE */:
          this.state.pc = this.state.pc + 4 >>> 0;
          this._status = 1 /* RUNNING */;
          break;
        case 1 /* BRANCH */:
          this._status = 1 /* RUNNING */;
          break;
        case 2 /* SYSCALL */:
          if (this.events.onSyscall) {
            const syscallCode = instr.syscall;
            this.events.onSyscall(this, syscallCode);
          }
          this.state.pc = this.state.pc + 4 >>> 0;
          this._status = 3 /* SYSCALL */;
          break;
        case 3 /* BREAK */:
          this._status = 2 /* BREAKPOINT */;
          break;
        case 4 /* UNKNOWN */:
          this._status = 4 /* ERROR */;
          break;
      }
      return this._status;
    } catch (error) {
      this._status = 4 /* ERROR */;
      if (this.events.onError) {
        this.events.onError(this, error);
      }
      return this._status;
    }
  }
  run(maxInstructions = 1e6) {
    this._status = 1 /* RUNNING */;
    for (let i = 0;i < maxInstructions; i++) {
      const status = this.step();
      if (status !== 1 /* RUNNING */) {
        return status;
      }
    }
    return this._status;
  }
  runUntil(address, maxInstructions = 1e6) {
    const targetAddress = address >>> 0;
    this._status = 1 /* RUNNING */;
    for (let i = 0;i < maxInstructions; i++) {
      if (this.state.pc === targetAddress) {
        this._status = 0 /* STOPPED */;
        return this._status;
      }
      const status = this.step();
      if (status !== 1 /* RUNNING */) {
        return status;
      }
    }
    return this._status;
  }
  runJit(maxBlocks = 1e5) {
    this._status = 1 /* RUNNING */;
    for (let i = 0;i < maxBlocks; i++) {
      if (this.hasBreakpoint(this.state.pc)) {
        if (this.events.onBreakpoint) {
          const shouldContinue = this.events.onBreakpoint(this, this.state.pc);
          if (!shouldContinue) {
            this._status = 2 /* BREAKPOINT */;
            return this._status;
          }
        } else {
          this._status = 2 /* BREAKPOINT */;
          return this._status;
        }
      }
      try {
        const nextPc = this.jitCache.execute(this.state, this.state.pc);
        const cached = this.jitCache.get(this.state.pc);
        if (cached.info) {
          this._instructionsExecuted += cached.info.instructionCount;
          this._cycles += cached.info.instructionCount;
        } else {
          this._instructionsExecuted++;
          this._cycles++;
        }
        if (nextPc === -1) {
          if (this.events.onSyscall) {
            const instr = Instruction.fromMemory(this.memory, this.state.pc);
            this.events.onSyscall(this, instr.syscall);
          }
          this._status = 3 /* SYSCALL */;
          return this._status;
        } else if (nextPc === -2) {
          this._status = 2 /* BREAKPOINT */;
          return this._status;
        }
      } catch (error) {
        this._status = 4 /* ERROR */;
        if (this.events.onError) {
          this.events.onError(this, error);
        }
        return this._status;
      }
    }
    return this._status;
  }
  setMode(mode) {
    this.mode = mode;
  }
  getMode() {
    return this.mode;
  }
  getJitStats() {
    return this.jitCache.getStats();
  }
  invalidateJitRange(from, to) {
    if (this._jitCache) {
      this._jitCache.invalidateRange(from, to);
    }
  }
  stop() {
    this._status = 0 /* STOPPED */;
  }
  reset() {
    this.state.reset();
    this._status = 0 /* STOPPED */;
    this._instructionsExecuted = 0;
    this._cycles = 0;
    if (this._jitCache) {
      this._jitCache.clear();
    }
  }
  loadBinary(data, address) {
    const baseAddress = address >>> 0;
    for (let i = 0;i < data.length; i++) {
      this.memory.sb(baseAddress + i, data[i]);
    }
  }
  loadWords(words, address) {
    const baseAddress = address >>> 0;
    for (let i = 0;i < words.length; i++) {
      this.memory.sw(baseAddress + i * 4, words[i]);
    }
  }
  setEntryPoint(address, stackPointer) {
    this.state.pc = address >>> 0;
    if (stackPointer !== undefined) {
      this.state.sp = stackPointer >>> 0;
    }
  }
  disassembleAt(address) {
    const instr = Instruction.fromMemory(this.memory, address >>> 0);
    return disassembler.disassemble(instr);
  }
  disassembleRange(address, count) {
    return disassembler.disassembleRange(this.memory, address >>> 0, count);
  }
  getInstruction(address) {
    return Instruction.fromMemory(this.memory, address >>> 0);
  }
  dump() {
    const lines = [];
    lines.push("=== CPU State ===");
    lines.push(`Status: ${CpuStatus[this._status]}`);
    lines.push(`Instructions: ${this._instructionsExecuted}`);
    lines.push(`Cycles: ${this._cycles}`);
    lines.push("");
    lines.push(this.state.dumpGpr());
    lines.push("");
    lines.push("=== Current Instruction ===");
    const disasm = this.disassembleAt(this.state.pc);
    lines.push(`0x${this.state.pc.toString(16).padStart(8, "0")}: ${disasm.text}`);
    return lines.join(`
`);
  }
  hexDump(address, length) {
    const lines = [];
    const baseAddr = address >>> 0;
    for (let offset = 0;offset < length; offset += 16) {
      const addr = baseAddr + offset;
      let hex2 = "";
      let ascii = "";
      for (let i = 0;i < 16 && offset + i < length; i++) {
        const byte = this.memory.lbu(addr + i);
        hex2 += byte.toString(16).padStart(2, "0") + " ";
        ascii += byte >= 32 && byte < 127 ? String.fromCharCode(byte) : ".";
      }
      lines.push(`${addr.toString(16).padStart(8, "0")}: ${hex2.padEnd(48)} ${ascii}`);
    }
    return lines.join(`
`);
  }
  getGpr(index) {
    return this.state.getGpr(index);
  }
  setGpr(index, value) {
    this.state.setGpr(index, value);
  }
  get v0() {
    return this.state.v0;
  }
  set v0(value) {
    this.state.v0 = value;
  }
  get v1() {
    return this.state.v1;
  }
  set v1(value) {
    this.state.v1 = value;
  }
  get a0() {
    return this.state.a0;
  }
  set a0(value) {
    this.state.a0 = value;
  }
  get a1() {
    return this.state.a1;
  }
  set a1(value) {
    this.state.a1 = value;
  }
  get a2() {
    return this.state.a2;
  }
  set a2(value) {
    this.state.a2 = value;
  }
  get a3() {
    return this.state.a3;
  }
  set a3(value) {
    this.state.a3 = value;
  }
  get sp() {
    return this.state.sp;
  }
  set sp(value) {
    this.state.sp = value;
  }
  get ra() {
    return this.state.ra;
  }
  set ra(value) {
    this.state.ra = value;
  }
}
// src/format/stream.ts
class Stream {
  buffer;
  offset;
  length;
  view;
  u8;
  _position = 0;
  constructor(buffer, offset = 0, length = buffer.byteLength) {
    this.buffer = buffer;
    this.offset = offset;
    this.length = length;
    this.view = new DataView(buffer, offset, length);
    this.u8 = new Uint8Array(buffer, offset, length);
  }
  static fromUint8Array(data) {
    return new Stream(data.buffer, data.byteOffset, data.byteLength);
  }
  static fromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0;i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return Stream.fromUint8Array(bytes);
  }
  get position() {
    return this._position;
  }
  set position(value) {
    this._position = value;
  }
  get remaining() {
    return this.length - this._position;
  }
  get eof() {
    return this._position >= this.length;
  }
  seek(position) {
    this._position = position;
    return this;
  }
  skip(bytes) {
    this._position += bytes;
    return this;
  }
  align(alignment) {
    const mod = this._position % alignment;
    if (mod !== 0) {
      this._position += alignment - mod;
    }
    return this;
  }
  slice(length) {
    const stream = new Stream(this.buffer, this.offset + this._position, length);
    this._position += length;
    return stream;
  }
  sliceAt(offset, length) {
    return new Stream(this.buffer, this.offset + offset, length);
  }
  sliceRemaining() {
    return this.slice(this.remaining);
  }
  readInt8() {
    const value = this.view.getInt8(this._position);
    this._position += 1;
    return value;
  }
  readUint8() {
    const value = this.view.getUint8(this._position);
    this._position += 1;
    return value;
  }
  readInt16(littleEndian = true) {
    const value = this.view.getInt16(this._position, littleEndian);
    this._position += 2;
    return value;
  }
  readUint16(littleEndian = true) {
    const value = this.view.getUint16(this._position, littleEndian);
    this._position += 2;
    return value;
  }
  readInt32(littleEndian = true) {
    const value = this.view.getInt32(this._position, littleEndian);
    this._position += 4;
    return value;
  }
  readUint32(littleEndian = true) {
    const value = this.view.getUint32(this._position, littleEndian);
    this._position += 4;
    return value;
  }
  readInt64(littleEndian = true) {
    const value = this.view.getBigInt64(this._position, littleEndian);
    this._position += 8;
    return value;
  }
  readUint64(littleEndian = true) {
    const value = this.view.getBigUint64(this._position, littleEndian);
    this._position += 8;
    return value;
  }
  readFloat32(littleEndian = true) {
    const value = this.view.getFloat32(this._position, littleEndian);
    this._position += 4;
    return value;
  }
  readFloat64(littleEndian = true) {
    const value = this.view.getFloat64(this._position, littleEndian);
    this._position += 8;
    return value;
  }
  readBytes(length) {
    const data = this.u8.slice(this._position, this._position + length);
    this._position += length;
    return data;
  }
  readInt32Array(count, littleEndian = true) {
    const result = new Int32Array(count);
    for (let i = 0;i < count; i++) {
      result[i] = this.readInt32(littleEndian);
    }
    return result;
  }
  readUint32Array(count, littleEndian = true) {
    const result = new Uint32Array(count);
    for (let i = 0;i < count; i++) {
      result[i] = this.readUint32(littleEndian);
    }
    return result;
  }
  readString(length, encoding = "utf8") {
    const bytes = this.readBytes(length);
    return new TextDecoder(encoding).decode(bytes);
  }
  readStringZ(maxLength = 256) {
    const start = this._position;
    let end = start;
    while (end < start + maxLength && end < this.length) {
      if (this.u8[end] === 0)
        break;
      end++;
    }
    const bytes = this.u8.slice(start, end);
    this._position = end + 1;
    return new TextDecoder("utf8").decode(bytes);
  }
  readStringAt(offset, maxLength = 256) {
    const saved = this._position;
    this._position = offset;
    const result = this.readStringZ(maxLength);
    this._position = saved;
    return result;
  }
  peekUint8(offset = 0) {
    return this.view.getUint8(this._position + offset);
  }
  peekUint16(offset = 0, littleEndian = true) {
    return this.view.getUint16(this._position + offset, littleEndian);
  }
  peekUint32(offset = 0, littleEndian = true) {
    return this.view.getUint32(this._position + offset, littleEndian);
  }
  peekBytes(length, offset = 0) {
    return this.u8.slice(this._position + offset, this._position + offset + length);
  }
  checkMagic(expected) {
    if (typeof expected === "string") {
      expected = new TextEncoder().encode(expected);
    }
    const bytes = Array.isArray(expected) ? expected : Array.from(expected);
    for (let i = 0;i < bytes.length; i++) {
      if (this.peekUint8(i) !== bytes[i])
        return false;
    }
    return true;
  }
  expectMagic(expected, name = "magic") {
    if (!this.checkMagic(expected)) {
      const actual = this.peekBytes(typeof expected === "string" ? expected.length : Array.isArray(expected) ? expected.length : expected.length);
      throw new Error(`Invalid ${name}: expected ${JSON.stringify(expected)}, ` + `got ${JSON.stringify(Array.from(actual))}`);
    }
    const len = typeof expected === "string" ? expected.length : Array.isArray(expected) ? expected.length : expected.length;
    this._position += len;
  }
  toUint8Array() {
    return new Uint8Array(this.buffer, this.offset, this.length);
  }
  clone() {
    const stream = new Stream(this.buffer, this.offset, this.length);
    stream._position = this._position;
    return stream;
  }
  hexDump(length = 64, offset = 0) {
    const bytes = this.peekBytes(Math.min(length, this.remaining - offset), offset);
    const hex2 = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(" ");
    return hex2;
  }
}
// src/format/elf.ts
class ElfFile {
  header;
  programHeaders;
  sectionHeaders;
  symbols;
  relocations;
  moduleInfo;
  stream;
  sectionsByName;
  constructor(stream) {
    this.stream = stream;
    this.sectionsByName = new Map;
    this.header = this.parseHeader();
    this.validateHeader();
    this.programHeaders = this.parseProgramHeaders();
    this.sectionHeaders = this.parseSectionHeaders();
    this.resolveSectionNames();
    for (const section of this.sectionHeaders) {
      if (section.name) {
        this.sectionsByName.set(section.name, section);
      }
    }
    this.symbols = this.parseSymbols();
    this.relocations = this.parseRelocations();
    if (this.isPrx) {
      this.moduleInfo = this.parseModuleInfo();
    }
  }
  static fromBuffer(buffer) {
    return new ElfFile(new Stream(buffer));
  }
  static fromUint8Array(data) {
    return new ElfFile(Stream.fromUint8Array(data));
  }
  get isPrx() {
    return this.header.type === 65440 /* PRX */;
  }
  get needsRelocation() {
    return this.isPrx || this.relocations.length > 0;
  }
  get entryPoint() {
    return this.header.entry;
  }
  getSection(name) {
    return this.sectionsByName.get(name);
  }
  getSectionData(section) {
    return this.stream.sliceAt(section.offset, section.size);
  }
  getSectionDataByName(name) {
    const section = this.getSection(name);
    if (!section)
      return;
    return this.getSectionData(section);
  }
  getLoadableSegments() {
    return this.programHeaders.filter((ph) => ph.type === 1 /* LOAD */);
  }
  getSegmentData(segment) {
    return this.stream.sliceAt(segment.offset, segment.filesz);
  }
  parseHeader() {
    const s = this.stream;
    s.seek(0);
    const magic = s.readBytes(4);
    if (magic[0] !== 127 || magic[1] !== 69 || magic[2] !== 76 || magic[3] !== 70) {
      throw new Error("Invalid ELF magic");
    }
    return {
      magic,
      class: s.readUint8(),
      data: s.readUint8(),
      version: s.readUint8(),
      osabi: s.readUint8(),
      abiVersion: s.readUint8(),
      ...(s.skip(7), {}),
      type: s.readUint16(),
      machine: s.readUint16(),
      elfVersion: s.readUint32(),
      entry: s.readUint32(),
      phOffset: s.readUint32(),
      shOffset: s.readUint32(),
      flags: s.readUint32(),
      ehSize: s.readUint16(),
      phEntSize: s.readUint16(),
      phNum: s.readUint16(),
      shEntSize: s.readUint16(),
      shNum: s.readUint16(),
      shStrNdx: s.readUint16()
    };
  }
  validateHeader() {
    const h = this.header;
    if (h.class !== 1 /* ELF32 */) {
      throw new Error(`Unsupported ELF class: ${h.class}`);
    }
    if (h.data !== 1 /* LSB */) {
      throw new Error(`Unsupported ELF data encoding: ${h.data}`);
    }
    if (h.machine !== 8 /* MIPS */ && h.machine !== 8 /* ALLEGREX */) {
      throw new Error(`Unsupported machine type: ${h.machine}`);
    }
  }
  parseProgramHeaders() {
    const headers = [];
    const { phOffset, phNum, phEntSize } = this.header;
    for (let i = 0;i < phNum; i++) {
      this.stream.seek(phOffset + i * phEntSize);
      headers.push({
        type: this.stream.readUint32(),
        offset: this.stream.readUint32(),
        vaddr: this.stream.readUint32(),
        paddr: this.stream.readUint32(),
        filesz: this.stream.readUint32(),
        memsz: this.stream.readUint32(),
        flags: this.stream.readUint32(),
        align: this.stream.readUint32()
      });
    }
    return headers;
  }
  parseSectionHeaders() {
    const headers = [];
    const { shOffset, shNum, shEntSize } = this.header;
    for (let i = 0;i < shNum; i++) {
      this.stream.seek(shOffset + i * shEntSize);
      headers.push({
        nameIndex: this.stream.readUint32(),
        name: "",
        type: this.stream.readUint32(),
        flags: this.stream.readUint32(),
        addr: this.stream.readUint32(),
        offset: this.stream.readUint32(),
        size: this.stream.readUint32(),
        link: this.stream.readUint32(),
        info: this.stream.readUint32(),
        addralign: this.stream.readUint32(),
        entsize: this.stream.readUint32()
      });
    }
    return headers;
  }
  resolveSectionNames() {
    const { shStrNdx } = this.header;
    if (shStrNdx === 0 || shStrNdx >= this.sectionHeaders.length) {
      return;
    }
    const strTab = this.sectionHeaders[shStrNdx];
    const strData = this.stream.sliceAt(strTab.offset, strTab.size);
    for (const section of this.sectionHeaders) {
      section.name = strData.readStringAt(section.nameIndex);
    }
  }
  parseSymbols() {
    const symbols = [];
    const symtab = this.getSection(".symtab");
    const strtab = this.getSection(".strtab");
    if (!symtab || !strtab)
      return symbols;
    const symData = this.getSectionData(symtab);
    const strData = this.getSectionData(strtab);
    const count = symtab.size / 16;
    for (let i = 0;i < count; i++) {
      const nameIndex = symData.readUint32();
      const value = symData.readUint32();
      const size = symData.readUint32();
      const info = symData.readUint8();
      const other = symData.readUint8();
      const shndx = symData.readUint16();
      symbols.push({
        nameIndex,
        name: strData.readStringAt(nameIndex),
        value,
        size,
        info,
        type: info & 15,
        binding: info >> 4,
        other,
        shndx
      });
    }
    return symbols;
  }
  parseRelocations() {
    const relocations = [];
    for (const section of this.sectionHeaders) {
      if (section.type !== 9 /* REL */ && section.type !== 4 /* RELA */ && section.type !== 1879048352 /* PRX_RELOC */) {
        continue;
      }
      const data = this.getSectionData(section);
      const isRela = section.type === 4 /* RELA */;
      const entrySize = isRela ? 12 : 8;
      const count = section.size / entrySize;
      for (let i = 0;i < count; i++) {
        const offset = data.readUint32();
        const info = data.readUint32();
        const addend = isRela ? data.readInt32() : undefined;
        relocations.push({
          offset,
          info,
          type: info & 255,
          symbolIndex: info >> 8,
          addend
        });
      }
    }
    return relocations;
  }
  parseModuleInfo() {
    const section = this.getSection(".rodata.sceModuleInfo");
    if (!section)
      return;
    const data = this.getSectionData(section);
    return {
      attributes: data.readUint16(),
      version: [data.readUint8(), data.readUint8()],
      name: data.readString(28).replace(/\0+$/, ""),
      gp: data.readUint32(),
      exportsStart: data.readUint32(),
      exportsEnd: data.readUint32(),
      importsStart: data.readUint32(),
      importsEnd: data.readUint32()
    };
  }
  loadIntoMemory(memory, baseAddress = 0) {
    let maxAddr = 0;
    for (const segment of this.getLoadableSegments()) {
      const data = this.getSegmentData(segment);
      const vaddr = segment.vaddr + baseAddress;
      for (let i = 0;i < segment.filesz; i += 4) {
        const word = i + 3 < segment.filesz ? data.readUint32() : data.readBytes(Math.min(4, segment.filesz - i))[0] || 0;
        memory.sw(vaddr + i, word);
      }
      for (let i = segment.filesz;i < segment.memsz; i += 4) {
        memory.sw(vaddr + i, 0);
      }
      maxAddr = Math.max(maxAddr, vaddr + segment.memsz);
    }
    return {
      entryPoint: this.header.entry + baseAddress,
      size: maxAddr - baseAddress
    };
  }
  applyRelocations(memory, baseAddress) {
    for (const rel of this.relocations) {
      const addr = rel.offset + baseAddress;
      const value = memory.lw(addr);
      switch (rel.type) {
        case 2 /* R_MIPS_32 */:
          memory.sw(addr, value + baseAddress);
          break;
        case 4 /* R_MIPS_26 */:
          {
            const target = ((value & 67108863) << 2) + baseAddress;
            memory.sw(addr, value & 4227858432 | target >> 2 & 67108863);
          }
          break;
        case 5 /* R_MIPS_HI16 */:
          {
            const hi = ((value & 65535) << 16) + baseAddress;
            memory.sw(addr, value & 4294901760 | hi >> 16 & 65535);
          }
          break;
        case 6 /* R_MIPS_LO16 */:
          {
            const lo = (value & 65535) + (baseAddress & 65535);
            memory.sw(addr, value & 4294901760 | lo & 65535);
          }
          break;
      }
    }
  }
}
// src/format/psf.ts
var PSF_KEYS = {
  CATEGORY: "CATEGORY",
  DISC_ID: "DISC_ID",
  DISC_VERSION: "DISC_VERSION",
  PARENTAL_LEVEL: "PARENTAL_LEVEL",
  REGION: "REGION",
  TITLE: "TITLE",
  PSP_SYSTEM_VER: "PSP_SYSTEM_VER",
  APP_VER: "APP_VER",
  BOOTABLE: "BOOTABLE",
  MEMSIZE: "MEMSIZE"
};

class PsfFile {
  header;
  entries;
  constructor(header, entries) {
    this.header = header;
    this.entries = entries;
  }
  static fromStream(stream) {
    stream.seek(0);
    const magic = stream.readUint32();
    if (magic !== 1179865088) {
      throw new Error(`Invalid PSF magic: 0x${magic.toString(16)}`);
    }
    const header = {
      magic,
      version: stream.readUint32(),
      keyTableOffset: stream.readUint32(),
      dataTableOffset: stream.readUint32(),
      indexTableEntries: stream.readUint32()
    };
    const indexEntries = [];
    for (let i = 0;i < header.indexTableEntries; i++) {
      indexEntries.push({
        keyOffset: stream.readUint16(),
        dataFormat: stream.readUint8(),
        ...(stream.skip(1), {}),
        dataSize: stream.readUint32(),
        dataSizeMax: stream.readUint32(),
        dataOffset: stream.readUint32()
      });
    }
    const entries = new Map;
    for (const idx of indexEntries) {
      stream.seek(header.keyTableOffset + idx.keyOffset);
      const key = stream.readStringZ();
      stream.seek(header.dataTableOffset + idx.dataOffset);
      let value;
      switch (idx.dataFormat) {
        case 2 /* STRING */:
          value = stream.readString(idx.dataSize).replace(/\0+$/, "");
          break;
        case 4 /* INT32 */:
          value = stream.readUint32();
          break;
        case 0 /* BINARY */:
        default:
          value = stream.readBytes(idx.dataSize);
          break;
      }
      entries.set(key, {
        key,
        format: idx.dataFormat,
        value
      });
    }
    return new PsfFile(header, entries);
  }
  static fromBuffer(buffer) {
    return PsfFile.fromStream(new Stream(buffer));
  }
  static fromUint8Array(data) {
    return PsfFile.fromStream(Stream.fromUint8Array(data));
  }
  get(key) {
    return this.entries.get(key);
  }
  getString(key) {
    const entry = this.get(key);
    if (!entry || typeof entry.value !== "string")
      return;
    return entry.value;
  }
  getInt(key) {
    const entry = this.get(key);
    if (!entry || typeof entry.value !== "number")
      return;
    return entry.value;
  }
  getBinary(key) {
    const entry = this.get(key);
    if (!entry || !(entry.value instanceof Uint8Array))
      return;
    return entry.value;
  }
  get title() {
    return this.getString(PSF_KEYS.TITLE);
  }
  get discId() {
    return this.getString(PSF_KEYS.DISC_ID);
  }
  get category() {
    return this.getString(PSF_KEYS.CATEGORY);
  }
  get discVersion() {
    return this.getString(PSF_KEYS.DISC_VERSION);
  }
  get appVersion() {
    return this.getString(PSF_KEYS.APP_VER);
  }
  get pspSystemVer() {
    return this.getString(PSF_KEYS.PSP_SYSTEM_VER);
  }
  get region() {
    return this.getInt(PSF_KEYS.REGION);
  }
  get parentalLevel() {
    return this.getInt(PSF_KEYS.PARENTAL_LEVEL);
  }
  toObject() {
    const result = {};
    for (const [key, entry] of this.entries) {
      result[key] = entry.value;
    }
    return result;
  }
  keys() {
    return Array.from(this.entries.keys());
  }
}
// src/format/pbp.ts
var PBP_ENTRY_NAMES = {
  [0 /* PARAM_SFO */]: "PARAM.SFO",
  [1 /* ICON0_PNG */]: "ICON0.PNG",
  [2 /* ICON1_PMF */]: "ICON1.PMF",
  [3 /* PIC0_PNG */]: "PIC0.PNG",
  [4 /* PIC1_PNG */]: "PIC1.PNG",
  [5 /* SND0_AT3 */]: "SND0.AT3",
  [6 /* DATA_PSP */]: "DATA.PSP",
  [7 /* DATA_PSAR */]: "DATA.PSAR"
};

class PbpFile {
  header;
  entries;
  fileSize;
  stream;
  _paramSfo;
  constructor(stream, header, entries, fileSize) {
    this.stream = stream;
    this.header = header;
    this.entries = entries;
    this.fileSize = fileSize;
  }
  static fromStream(stream) {
    stream.seek(0);
    const magic = stream.readUint32();
    if (magic !== 1346523136) {
      throw new Error(`Invalid PBP magic: 0x${magic.toString(16)}`);
    }
    const version = stream.readUint32();
    const offsets = [];
    for (let i = 0;i < 8; i++) {
      offsets.push(stream.readUint32());
    }
    const header = { magic, version, offsets };
    const fileSize = stream.length;
    const entries = [];
    for (let i = 0;i < 8; i++) {
      const offset = offsets[i];
      const nextOffset = i < 7 ? offsets[i + 1] : fileSize;
      const size = nextOffset - offset;
      entries.push({
        index: i,
        name: PBP_ENTRY_NAMES[i],
        offset,
        size,
        present: size > 0
      });
    }
    return new PbpFile(stream, header, entries, fileSize);
  }
  static fromBuffer(buffer) {
    return PbpFile.fromStream(new Stream(buffer));
  }
  static fromUint8Array(data) {
    return PbpFile.fromStream(Stream.fromUint8Array(data));
  }
  getEntryInfo(index) {
    return this.entries[index];
  }
  getEntryInfoByName(name) {
    name = name.toUpperCase();
    return this.entries.find((e) => e.name === name);
  }
  hasEntry(index) {
    return this.entries[index].present;
  }
  readEntry(index) {
    const info = this.entries[index];
    if (!info.present)
      return;
    return this.stream.sliceAt(info.offset, info.size);
  }
  readEntryBytes(index) {
    const stream = this.readEntry(index);
    if (!stream)
      return;
    return stream.toUint8Array();
  }
  get paramSfo() {
    if (!this._paramSfo) {
      const stream = this.readEntry(0 /* PARAM_SFO */);
      if (stream) {
        this._paramSfo = PsfFile.fromStream(stream);
      }
    }
    return this._paramSfo;
  }
  get icon() {
    return this.readEntryBytes(1 /* ICON0_PNG */);
  }
  get background() {
    return this.readEntryBytes(3 /* PIC0_PNG */);
  }
  get bootScreen() {
    return this.readEntryBytes(4 /* PIC1_PNG */);
  }
  get sound() {
    return this.readEntryBytes(5 /* SND0_AT3 */);
  }
  get data() {
    return this.readEntry(6 /* DATA_PSP */);
  }
  get archive() {
    return this.readEntry(7 /* DATA_PSAR */);
  }
  get title() {
    return this.paramSfo?.title;
  }
  get discId() {
    return this.paramSfo?.discId;
  }
  get version() {
    return this.paramSfo?.discVersion;
  }
  get category() {
    return this.paramSfo?.category;
  }
  getPresentEntries() {
    return this.entries.filter((e) => e.present);
  }
  get dataSize() {
    return this.entries.reduce((sum, e) => sum + e.size, 0);
  }
}
// src/hle/errors.ts
var SceKernelErrors = {
  ERROR_OK: 0,
  ERROR_ALREADY: 2147483680,
  ERROR_BUSY: 2147483681,
  ERROR_OUT_OF_MEMORY: 2147483682,
  ERROR_ERRNO_FILE_NOT_FOUND: 2147549186,
  ERROR_ERRNO_FILE_EXISTS: 2147549201,
  ERROR_ERRNO_DEVICE_NOT_FOUND: 2147549203,
  ERROR_ERRNO_IS_DIRECTORY: 2147549205,
  ERROR_ERRNO_INVALID_ARGUMENT: 2147549206,
  ERROR_ERRNO_INVALID_FILE_SIZE: 2147549207,
  ERROR_ERRNO_TOO_MANY_OPEN_FILES: 2147549208,
  ERROR_ERRNO_NO_MEMORY: 2147549216,
  ERROR_ERRNO_CLOSED: 2147549236,
  ERROR_ERRNO_ADDRESS_IN_USE: 2147549282,
  ERROR_ERRNO_CONNECTION_ABORTED: 2147549287,
  ERROR_ERRNO_CONNECTION_RESET: 2147549288,
  ERROR_ERRNO_NO_FREE_BUF_SPACE: 2147549289,
  ERROR_ERRNO_NOT_CONNECTED: 2147549294,
  ERROR_ERRNO_TIMEDOUT: 2147549295,
  ERROR_ERRNO_CONNECTION_REFUSED: 2147549296,
  ERROR_ERRNO_FUNCTION_NOT_SUPPORTED: 2147549345,
  ERROR_ERRNO_IN_PROGRESS: 2147549303,
  ERROR_ERRNO_NAME_TOO_LONG: 2147549366,
  ERROR_KERNEL_CANNOT_BE_CALLED_FROM_INTERRUPT: 2147614820,
  ERROR_KERNEL_INTERRUPTS_ALREADY_DISABLED: 2147614822,
  ERROR_KERNEL_UNKNOWN_UID: 2147614923,
  ERROR_KERNEL_UNMATCH_TYPE_UID: 2147614924,
  ERROR_KERNEL_NOT_EXIST_ID: 2147614925,
  ERROR_KERNEL_NOT_FOUND_FUNCTION_UID: 2147614926,
  ERROR_KERNEL_ALREADY_HOLDER_UID: 2147614927,
  ERROR_KERNEL_NOT_HOLDER_UID: 2147614928,
  ERROR_KERNEL_ILLEGAL_PERMISSION: 2147614929,
  ERROR_KERNEL_ILLEGAL_ARGUMENT: 2147614930,
  ERROR_KERNEL_ILLEGAL_ADDR: 2147614931,
  ERROR_KERNEL_MEMORY_AREA_OUT_OF_RANGE: 2147614932,
  ERROR_KERNEL_MEMORY_AREA_IS_OVERLAP: 2147614933,
  ERROR_KERNEL_ILLEGAL_PARTITION_ID: 2147614934,
  ERROR_KERNEL_PARTITION_IN_USE: 2147614935,
  ERROR_KERNEL_ILLEGAL_MEMBLOCK_ALLOC_TYPE: 2147614936,
  ERROR_KERNEL_FAILED_ALLOC_MEMBLOCK: 2147614937,
  ERROR_KERNEL_INHIBITED_RESIZE_MEMBLOCK: 2147614938,
  ERROR_KERNEL_FAILED_RESIZE_MEMBLOCK: 2147614939,
  ERROR_KERNEL_FAILED_ALLOC_HEAPBLOCK: 2147614940,
  ERROR_KERNEL_FAILED_ALLOC_HEAP: 2147614941,
  ERROR_KERNEL_ILLEGAL_CHUNK_ID: 2147614942,
  ERROR_KERNEL_CANNOT_FIND_CHUNK: 2147614943,
  ERROR_KERNEL_ILLEGAL_THREAD_PRIORITY: 2147614944,
  ERROR_KERNEL_ILLEGAL_STACK_SIZE: 2147614945,
  ERROR_KERNEL_ILLEGAL_THREAD_MODE: 2147614946,
  ERROR_KERNEL_ILLEGAL_MASK: 2147614947,
  ERROR_KERNEL_ILLEGAL_THREAD: 2147614948,
  ERROR_KERNEL_NOT_FOUND_THREAD: 2147614949,
  ERROR_KERNEL_NOT_FOUND_SEMAPHORE: 2147614950,
  ERROR_KERNEL_NOT_FOUND_EVENT_FLAG: 2147614951,
  ERROR_KERNEL_NOT_FOUND_MESSAGE_BOX: 2147614952,
  ERROR_KERNEL_NOT_FOUND_VPOOL: 2147614953,
  ERROR_KERNEL_NOT_FOUND_FPOOL: 2147614954,
  ERROR_KERNEL_NOT_FOUND_MESSAGE_PIPE: 2147614955,
  ERROR_KERNEL_NOT_FOUND_ALARM: 2147614956,
  ERROR_KERNEL_NOT_FOUND_VTIMER: 2147614957,
  ERROR_KERNEL_NOT_FOUND_CALLBACK: 2147614958,
  ERROR_KERNEL_THREAD_ALREADY_DORMANT: 2147614959,
  ERROR_KERNEL_THREAD_ALREADY_SUSPEND: 2147614960,
  ERROR_KERNEL_THREAD_IS_NOT_DORMANT: 2147614961,
  ERROR_KERNEL_THREAD_IS_NOT_SUSPEND: 2147614962,
  ERROR_KERNEL_THREAD_IS_NOT_WAIT: 2147614963,
  ERROR_KERNEL_WAIT_CAN_NOT_WAIT: 2147614964,
  ERROR_KERNEL_WAIT_TIMEOUT: 2147614965,
  ERROR_KERNEL_WAIT_CANCELLED: 2147614966,
  ERROR_KERNEL_WAIT_STATUS_RELEASED: 2147614967,
  ERROR_KERNEL_WAIT_DELETE: 2147614968,
  ERROR_KERNEL_SEMA_ZERO: 2147614969,
  ERROR_KERNEL_SEMA_OVERFLOW: 2147614970,
  ERROR_KERNEL_EVENT_FLAG_POLL_FAILED: 2147614971,
  ERROR_KERNEL_EVENT_FLAG_NO_MULTI_PERM: 2147614972,
  ERROR_KERNEL_EVENT_FLAG_ILLEGAL_WAIT_PATTERN: 2147614973,
  ERROR_KERNEL_MESSAGEBOX_NO_MESSAGE: 2147614974,
  ERROR_KERNEL_MESSAGEBOX_FULL: 2147614975,
  ERROR_KERNEL_WAIT_RELEASED: 2147614977,
  ERROR_KERNEL_ASYNC_BUSY: 2147614979,
  ERROR_KERNEL_NOASYNC: 2147614980,
  ERROR_KERNEL_NOT_CACHE_ALIGNED: 2147615820,
  ERROR_KERNEL_MAX_ERROR: 2147615821,
  ERROR_AUDIO_CHANNEL_NOT_INIT: 2149974017,
  ERROR_AUDIO_CHANNEL_BUSY: 2149974018,
  ERROR_AUDIO_INVALID_CHANNEL: 2149974019,
  ERROR_AUDIO_PRIV_REQUIRED: 2149974020,
  ERROR_AUDIO_NO_CHANNELS_AVAILABLE: 2149974021,
  ERROR_AUDIO_OUTPUT_SAMPLE_DATA_SIZE_NOT_ALIGNED: 2149974022,
  ERROR_AUDIO_INVALID_FORMAT: 2149974023,
  ERROR_AUDIO_CHANNEL_NOT_RESERVED: 2149974024,
  ERROR_AUDIO_NOT_OUTPUT: 2149974025,
  ERROR_MEMSTICK_DEVCTL_BAD_PARAMS: 2149712001,
  ERROR_MODULE_BAD_ID: 2149597694,
  ERROR_MODULE_ALREADY_LOADED: 2150105139,
  ERROR_MODULE_NOT_FOUND: 2147615036,
  ERROR_UTILITY_WRONG_TYPE: 2148599297,
  ERROR_UTILITY_INVALID_STATUS: 2148599298,
  ERROR_UTILITY_INVALID_PARAM_ADDR: 2148599299,
  ERROR_UTILITY_INVALID_PARAM_SIZE: 2148599300,
  ERROR_UTILITY_INVALID_PARAM_VALUE: 2148599301,
  ERROR_UTILITY_SLOT_NOT_EXIST: 2148599314,
  ERROR_SAVEDATA_LOAD_NO_DATA: 2148598533,
  ERROR_SAVEDATA_LOAD_ACCESS_ERROR: 2148598534,
  ERROR_SAVEDATA_LOAD_DATA_BROKEN: 2148598535,
  ERROR_SAVEDATA_LOAD_PARAM: 2148598536,
  ERROR_SAVEDATA_SAVE_ACCESS_ERROR: 2148598537,
  ERROR_SAVEDATA_SAVE_PARAM: 2148598539,
  ERROR_SAVEDATA_SAVE_NO_SPACE: 2148598547,
  ERROR_NET_RESOLVER_BAD_ID: 2151744520,
  ERROR_NET_RESOLVER_ALREADY_STOPPED: 2151744522,
  ERROR_NET_RESOLVER_INVALID_HOST: 2151744532,
  ERROR_UMD_NOT_READY: 2149646337,
  ERROR_ATRAC_NO_ID: 2153971715,
  ERROR_ATRAC_INVALID_CODECTYPE: 2153971716,
  ERROR_ATRAC_BAD_ID: 2153971717,
  ERROR_ATRAC_UNKNOWN_FORMAT: 2153971718,
  ERROR_ATRAC_INVALID_SIZE: 2153971729,
  ERROR_ATRAC_SECOND_BUFFER_NEEDED: 2153971730,
  ERROR_ATRAC_SECOND_BUFFER_NOT_NEEDED: 2153971746,
  ERROR_ATRAC_BUFFER_IS_EMPTY: 2153971747,
  ERROR_ATRAC_ALL_DATA_DECODED: 2153971748,
  ERROR_MPEG_NO_MEMORY: 2153873409,
  ERROR_MPEG_INVALID_VALUE: 2153841150,
  ERROR_SAS_INVALID_VOICE: 2151809040,
  ERROR_SAS_INVALID_ADPCM_SIZE: 2151809044,
  ERROR_SAS_INVALID_PITCH: 2151809048,
  ERROR_SAS_INVALID_NOISE_FREQ: 2151809052,
  ERROR_SAS_INVALID_VOLUME_VAL: 2151809056,
  ERROR_SAS_INVALID_LOOP_POS: 2151809060,
  ERROR_SAS_INVALID_SAMPLE_RATE: 2151809088,
  ERROR_SAS_INVALID_MAX_VOICES: 2151809092,
  ERROR_SAS_INVALID_OUTPUT_MODE: 2151809096
};
// src/hle/manager/MemoryManager.ts
var KERNEL0_START = 2281701376;
var KERNEL0_SIZE = 3145728;
var USER_START = 142606336;
var USER_SIZE = 25165824;
var VOLATILE_START = USER_START + USER_SIZE;
var VOLATILE_SIZE = 4194304;
var STACK_START = 166723584;
var STACK_SIZE = 1048576;

class MemoryPartition {
  id;
  address;
  size;
  allocated;
  name;
  parent;
  children;
  constructor(id, address, size, allocated = false, name = "", parent = null) {
    this.id = id;
    this.address = address;
    this.size = size;
    this.allocated = allocated;
    this.name = name;
    this.parent = parent;
    this.children = [];
  }
  get end() {
    return this.address + this.size;
  }
  get freeMemory() {
    if (this.allocated)
      return 0;
    if (this.children.length === 0)
      return this.size;
    return this.children.reduce((sum, child) => sum + child.freeMemory, 0);
  }
  get maxFreeBlock() {
    if (this.allocated)
      return 0;
    if (this.children.length === 0)
      return this.size;
    return Math.max(...this.children.map((c) => c.maxFreeBlock));
  }
  allocate(size, anchor = 0 /* Low */, address = 0, alignment = 1, name = "") {
    if (this.allocated)
      return null;
    if (size > this.size)
      return null;
    size = size + alignment - 1 & ~(alignment - 1);
    if (this.children.length === 0) {
      return this.allocateFromFreeBlock(size, anchor, address, alignment, name);
    }
    const allocators = anchor === 1 /* High */ || anchor === 4 /* HighestAligned */ ? [...this.children].reverse() : this.children;
    for (const child of allocators) {
      const result = child.allocate(size, anchor, address, alignment, name);
      if (result)
        return result;
    }
    return null;
  }
  allocateFromFreeBlock(size, anchor, targetAddress, alignment, name) {
    let allocAddress;
    switch (anchor) {
      case 0 /* Low */:
      case 3 /* LowestAligned */:
        allocAddress = this.address + alignment - 1 & ~(alignment - 1);
        break;
      case 1 /* High */:
      case 4 /* HighestAligned */:
        allocAddress = this.end - size & ~(alignment - 1);
        break;
      case 2 /* Address */:
        allocAddress = targetAddress + alignment - 1 & ~(alignment - 1);
        if (allocAddress < this.address || allocAddress + size > this.end) {
          return null;
        }
        break;
      default:
        return null;
    }
    if (allocAddress < this.address || allocAddress + size > this.end) {
      return null;
    }
    const before = allocAddress > this.address ? new MemoryPartition(0, this.address, allocAddress - this.address, false, "", this) : null;
    const allocated = new MemoryPartition(0, allocAddress, size, true, name, this);
    const afterAddr = allocAddress + size;
    const after = afterAddr < this.end ? new MemoryPartition(0, afterAddr, this.end - afterAddr, false, "", this) : null;
    this.children = [];
    if (before)
      this.children.push(before);
    this.children.push(allocated);
    if (after)
      this.children.push(after);
    return allocated;
  }
  free(block) {
    const index = this.children.indexOf(block);
    if (index === -1) {
      for (const child of this.children) {
        if (child.free(block))
          return true;
      }
      return false;
    }
    block.allocated = false;
    block.name = "";
    block.children = [];
    this.mergeChildren();
    return true;
  }
  mergeChildren() {
    if (this.children.length === 0)
      return;
    const merged = [];
    for (const child of this.children) {
      if (merged.length > 0) {
        const last = merged[merged.length - 1];
        if (!last.allocated && !child.allocated && last.children.length === 0 && child.children.length === 0) {
          last.size = child.end - last.address;
          continue;
        }
      }
      merged.push(child);
    }
    this.children = merged;
    if (this.children.every((c) => !c.allocated && c.children.length === 0)) {
      this.children = [];
    }
  }
  findByAddress(address) {
    if (address >= this.address && address < this.end) {
      if (this.children.length === 0) {
        return this.allocated ? this : null;
      }
      for (const child of this.children) {
        const found = child.findByAddress(address);
        if (found)
          return found;
      }
    }
    return null;
  }
  listBlocks(depth = 0) {
    const indent = "  ".repeat(depth);
    const status = this.allocated ? "[ALLOC]" : "[FREE]";
    const result = [
      `${indent}${status} 0x${this.address.toString(16).padStart(8, "0")}-0x${this.end.toString(16).padStart(8, "0")} (${this.size} bytes) ${this.name}`
    ];
    for (const child of this.children) {
      result.push(...child.listBlocks(depth + 1));
    }
    return result;
  }
}

class MemoryManager {
  partitions = new Map;
  nextBlockId = 1;
  constructor() {
    this.reset();
  }
  reset() {
    this.partitions.clear();
    this.nextBlockId = 1;
    this.partitions.set(1 /* Kernel0 */, new MemoryPartition(1 /* Kernel0 */, KERNEL0_START, KERNEL0_SIZE, false, "Kernel0"));
    this.partitions.set(3 /* User */, new MemoryPartition(3 /* User */, USER_START, USER_SIZE, false, "User"));
    this.partitions.set(5 /* Volatile */, new MemoryPartition(5 /* Volatile */, VOLATILE_START, VOLATILE_SIZE, false, "Volatile"));
    this.partitions.set(6 /* UserStacks */, new MemoryPartition(6 /* UserStacks */, STACK_START, STACK_SIZE, false, "UserStacks"));
  }
  getPartition(id) {
    return this.partitions.get(id);
  }
  allocate(partitionId, size, anchor = 0 /* Low */, address = 0, alignment = 1, name = "") {
    const partition = this.partitions.get(partitionId);
    if (!partition) {
      return { block: null, error: SceKernelErrors.ERROR_KERNEL_ILLEGAL_PARTITION_ID };
    }
    if (size <= 0) {
      return { block: null, error: SceKernelErrors.ERROR_KERNEL_ILLEGAL_MEMBLOCK_ALLOC_TYPE };
    }
    const block = partition.allocate(size, anchor, address, alignment, name || `block_${this.nextBlockId}`);
    if (!block) {
      return { block: null, error: SceKernelErrors.ERROR_KERNEL_FAILED_ALLOC_MEMBLOCK };
    }
    block.id = this.nextBlockId++;
    return { block, error: SceKernelErrors.ERROR_OK };
  }
  free(block) {
    for (const partition of this.partitions.values()) {
      if (partition.free(block)) {
        return SceKernelErrors.ERROR_OK;
      }
    }
    return SceKernelErrors.ERROR_KERNEL_ILLEGAL_CHUNK_ID;
  }
  getFreeMemory(partitionId) {
    const partition = this.partitions.get(partitionId);
    return partition?.freeMemory ?? 0;
  }
  getMaxFreeBlock(partitionId) {
    const partition = this.partitions.get(partitionId);
    return partition?.maxFreeBlock ?? 0;
  }
  findByAddress(address) {
    for (const partition of this.partitions.values()) {
      const found = partition.findByAddress(address);
      if (found)
        return found;
    }
    return null;
  }
  dump() {
    const result = [];
    for (const partition of this.partitions.values()) {
      result.push(`=== ${partition.name} ===`);
      result.push(...partition.listBlocks());
    }
    return result;
  }
}
// src/util/UidCollection.ts
class UidCollection {
  startUid;
  items = new Map;
  nextUid;
  freeUids = [];
  constructor(startUid = 1) {
    this.startUid = startUid;
    this.nextUid = startUid;
  }
  allocate(item) {
    const uid = this.freeUids.length > 0 ? this.freeUids.pop() : this.nextUid++;
    this.items.set(uid, item);
    return uid;
  }
  allocateAt(uid, item) {
    if (this.items.has(uid)) {
      throw new Error(`UID ${uid} already allocated`);
    }
    this.items.set(uid, item);
    if (uid >= this.nextUid) {
      this.nextUid = uid + 1;
    }
  }
  get(uid) {
    return this.items.get(uid);
  }
  getOrThrow(uid, errorMsg) {
    const item = this.items.get(uid);
    if (item === undefined) {
      throw new Error(errorMsg ?? `Invalid UID: ${uid}`);
    }
    return item;
  }
  has(uid) {
    return this.items.has(uid);
  }
  release(uid) {
    if (!this.items.delete(uid)) {
      return false;
    }
    this.freeUids.push(uid);
    return true;
  }
  remove(uid) {
    const item = this.items.get(uid);
    if (item !== undefined) {
      this.release(uid);
    }
    return item;
  }
  findUid(item) {
    for (const [uid, stored] of this.items) {
      if (stored === item) {
        return uid;
      }
    }
    return;
  }
  find(predicate) {
    for (const item of this.items.values()) {
      if (predicate(item)) {
        return item;
      }
    }
    return;
  }
  filter(predicate) {
    const result = [];
    for (const item of this.items.values()) {
      if (predicate(item)) {
        result.push(item);
      }
    }
    return result;
  }
  values() {
    return this.items.values();
  }
  entries() {
    return this.items.entries();
  }
  forEach(callback) {
    this.items.forEach((item, uid) => callback(item, uid));
  }
  get size() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
    this.freeUids = [];
    this.nextUid = this.startUid;
  }
}

// src/util/Signal.ts
class Signal0 {
  handlers = new Set;
  add(handler) {
    this.handlers.add(handler);
  }
  remove(handler) {
    this.handlers.delete(handler);
  }
  once(handler) {
    const wrapper = () => {
      this.remove(wrapper);
      handler();
    };
    this.add(wrapper);
  }
  dispatch() {
    for (const handler of this.handlers) {
      handler();
    }
  }
  clear() {
    this.handlers.clear();
  }
  get count() {
    return this.handlers.size;
  }
}

class Signal1 {
  handlers = new Set;
  add(handler) {
    this.handlers.add(handler);
  }
  remove(handler) {
    this.handlers.delete(handler);
  }
  once(handler) {
    const wrapper = (arg) => {
      this.remove(wrapper);
      handler(arg);
    };
    this.add(wrapper);
  }
  dispatch(arg) {
    for (const handler of this.handlers) {
      handler(arg);
    }
  }
  clear() {
    this.handlers.clear();
  }
  get count() {
    return this.handlers.size;
  }
}

class Signal2 {
  handlers = new Set;
  add(handler) {
    this.handlers.add(handler);
  }
  remove(handler) {
    this.handlers.delete(handler);
  }
  once(handler) {
    const wrapper = (arg1, arg2) => {
      this.remove(wrapper);
      handler(arg1, arg2);
    };
    this.add(wrapper);
  }
  dispatch(arg1, arg2) {
    for (const handler of this.handlers) {
      handler(arg1, arg2);
    }
  }
  clear() {
    this.handlers.clear();
  }
  get count() {
    return this.handlers.size;
  }
}

class Signal3 {
  handlers = new Set;
  add(handler) {
    this.handlers.add(handler);
  }
  remove(handler) {
    this.handlers.delete(handler);
  }
  dispatch(arg1, arg2, arg3) {
    for (const handler of this.handlers) {
      handler(arg1, arg2, arg3);
    }
  }
  clear() {
    this.handlers.clear();
  }
  get count() {
    return this.handlers.size;
  }
}

// src/util/PromiseFast.ts
class PromiseFast {
  _state = "pending";
  _value;
  _error;
  _callbacks = [];
  constructor() {}
  get state() {
    return this._state;
  }
  get isResolved() {
    return this._state === "resolved";
  }
  get isRejected() {
    return this._state === "rejected";
  }
  get isPending() {
    return this._state === "pending";
  }
  get value() {
    if (this._state !== "resolved") {
      throw new Error("Promise not resolved");
    }
    return this._value;
  }
  get error() {
    if (this._state !== "rejected") {
      throw new Error("Promise not rejected");
    }
    return this._error;
  }
  static resolve(value) {
    const p = new PromiseFast;
    p._state = "resolved";
    p._value = value;
    return p;
  }
  static reject(error) {
    const p = new PromiseFast;
    p._state = "rejected";
    p._error = error;
    return p;
  }
  static create() {
    const p = new PromiseFast;
    return {
      promise: p,
      resolve: (value) => p._resolve(value),
      reject: (error) => p._reject(error)
    };
  }
  static fromPromise(promise) {
    const { promise: p, resolve, reject } = PromiseFast.create();
    promise.then(resolve, reject);
    return p;
  }
  static ensure(value) {
    if (value instanceof PromiseFast) {
      return value;
    }
    if (value instanceof Promise) {
      return PromiseFast.fromPromise(value);
    }
    return PromiseFast.resolve(value);
  }
  static all(promises) {
    if (promises.length === 0) {
      return PromiseFast.resolve([]);
    }
    if (promises.every((p) => p.isResolved)) {
      return PromiseFast.resolve(promises.map((p) => p.value));
    }
    const rejected = promises.find((p) => p.isRejected);
    if (rejected) {
      return PromiseFast.reject(rejected.error);
    }
    const { promise, resolve, reject } = PromiseFast.create();
    const results = new Array(promises.length);
    let remaining = promises.length;
    promises.forEach((p, i) => {
      p.then((value) => {
        results[i] = value;
        remaining--;
        if (remaining === 0) {
          resolve(results);
        }
      }, reject);
    });
    return promise;
  }
  static race(promises) {
    if (promises.length === 0) {
      return PromiseFast.reject(new Error("Empty race"));
    }
    for (const p of promises) {
      if (p.isResolved) {
        return PromiseFast.resolve(p.value);
      }
      if (p.isRejected) {
        return PromiseFast.reject(p.error);
      }
    }
    const { promise, resolve, reject } = PromiseFast.create();
    let settled = false;
    for (const p of promises) {
      p.then((value) => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      }, (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
    }
    return promise;
  }
  static delay(ms) {
    const { promise, resolve } = PromiseFast.create();
    setTimeout(() => resolve(), ms);
    return promise;
  }
  _resolve(value) {
    if (this._state !== "pending")
      return;
    this._state = "resolved";
    this._value = value;
    this._notify();
  }
  _reject(error) {
    if (this._state !== "pending")
      return;
    this._state = "rejected";
    this._error = error;
    this._notify();
  }
  _notify() {
    const callbacks = this._callbacks;
    this._callbacks = [];
    for (const { onResolve, onReject } of callbacks) {
      if (this._state === "resolved") {
        onResolve(this._value);
      } else {
        onReject(this._error);
      }
    }
  }
  then(onResolve, onReject) {
    if (this._state === "resolved" && onResolve) {
      try {
        const result = onResolve(this._value);
        return PromiseFast.ensure(result);
      } catch (e) {
        return PromiseFast.reject(e);
      }
    }
    if (this._state === "rejected") {
      if (onReject) {
        try {
          const result = onReject(this._error);
          return PromiseFast.ensure(result);
        } catch (e) {
          return PromiseFast.reject(e);
        }
      }
      return PromiseFast.reject(this._error);
    }
    const { promise, resolve, reject } = PromiseFast.create();
    this._callbacks.push({
      onResolve: (value) => {
        if (onResolve) {
          try {
            const result = onResolve(value);
            if (result instanceof PromiseFast) {
              result.then(resolve, reject);
            } else {
              resolve(result);
            }
          } catch (e) {
            reject(e);
          }
        } else {
          resolve(value);
        }
      },
      onReject: (error) => {
        if (onReject) {
          try {
            const result = onReject(error);
            if (result instanceof PromiseFast) {
              result.then(resolve, reject);
            } else {
              resolve(result);
            }
          } catch (e) {
            reject(e);
          }
        } else {
          reject(error);
        }
      }
    });
    return promise;
  }
  catch(onReject) {
    return this.then(undefined, onReject);
  }
  finally(handler) {
    return this.then((value) => {
      handler();
      return value;
    }, (error) => {
      handler();
      throw error;
    });
  }
  toPromise() {
    return new Promise((resolve, reject) => {
      this.then(resolve, reject);
    });
  }
}

class Deferred {
  promise;
  resolve;
  reject;
  constructor() {
    const { promise, resolve, reject } = PromiseFast.create();
    this.promise = promise;
    this.resolve = resolve;
    this.reject = reject;
  }
}

// src/hle/manager/ThreadManager.ts
var DEFAULT_STACK_SIZE = 16384;
var MIN_PRIORITY = 1;
var MAX_PRIORITY = 127;

class Thread {
  uid = 0;
  name;
  entryPoint;
  sp = 0;
  stackSize;
  stackBlock = null;
  priority;
  initialPriority;
  attributes;
  status = 16 /* DORMANT */;
  exitStatus = 0;
  waitType = 0 /* NONE */;
  waitId = 0;
  waitTimeout = 0;
  wakeupCount = 0;
  callbackAccepting = false;
  cpu = null;
  waitDeferred = null;
  gp = 0;
  constructor(name, entryPoint, priority, stackSize = DEFAULT_STACK_SIZE, attributes = 2147483648 /* USER */) {
    this.name = name;
    this.entryPoint = entryPoint;
    this.priority = Math.max(MIN_PRIORITY, Math.min(MAX_PRIORITY, priority));
    this.initialPriority = this.priority;
    this.stackSize = stackSize;
    this.attributes = attributes;
  }
  get isRunning() {
    return this.status === 1 /* RUNNING */;
  }
  get isReady() {
    return this.status === 2 /* READY */;
  }
  get isWaiting() {
    return (this.status & 4 /* WAIT */) !== 0;
  }
  get isSuspended() {
    return (this.status & 8 /* SUSPEND */) !== 0;
  }
  get isDormant() {
    return this.status === 16 /* DORMANT */;
  }
  get isDead() {
    return this.status === 32 /* DEAD */;
  }
  get canSchedule() {
    return this.status === 2 /* READY */;
  }
  startWait(type, id = 0, timeout = 0) {
    this.waitType = type;
    this.waitId = id;
    this.waitTimeout = timeout;
    this.status = 4 /* WAIT */;
    this.waitDeferred = new Deferred;
    return this.waitDeferred.promise;
  }
  completeWait(result) {
    if (this.waitDeferred) {
      this.waitDeferred.resolve(result);
      this.waitDeferred = null;
    }
    this.waitType = 0 /* NONE */;
    this.waitId = 0;
    this.waitTimeout = 0;
    if (this.status === 4 /* WAIT */) {
      this.status = 2 /* READY */;
    } else if (this.status === 12 /* WAIT_SUSPEND */) {
      this.status = 8 /* SUSPEND */;
    }
  }
  cancelWait(error = SceKernelErrors.ERROR_KERNEL_WAIT_CANCELLED) {
    this.completeWait(error);
  }
}

class ThreadManager {
  threads = new UidCollection;
  currentThread = null;
  idleThread = null;
  onThreadChange = new Signal1;
  memoryManager;
  constructor(memoryManager) {
    this.memoryManager = memoryManager;
  }
  reset() {
    this.threads.clear();
    this.currentThread = null;
    this.idleThread = null;
  }
  createThread(name, entryPoint, priority, stackSize = DEFAULT_STACK_SIZE, attributes = 2147483648 /* USER */, optionAddr = 0) {
    if (priority < MIN_PRIORITY || priority > MAX_PRIORITY) {
      return { thread: null, error: SceKernelErrors.ERROR_KERNEL_ILLEGAL_THREAD_PRIORITY };
    }
    if (stackSize < 512) {
      return { thread: null, error: SceKernelErrors.ERROR_KERNEL_ILLEGAL_STACK_SIZE };
    }
    stackSize = stackSize + 255 & ~255;
    const { block: stackBlock, error: allocError } = this.memoryManager.allocate(6 /* UserStacks */, stackSize, 1 /* High */, 0, 256, `${name}_stack`);
    if (!stackBlock) {
      return { thread: null, error: allocError };
    }
    const thread = new Thread(name, entryPoint, priority, stackSize, attributes);
    thread.stackBlock = stackBlock;
    thread.sp = stackBlock.address + stackBlock.size;
    thread.uid = this.threads.allocate(thread);
    this.onThreadChange.dispatch(thread);
    return { thread, error: SceKernelErrors.ERROR_OK };
  }
  deleteThread(uid) {
    const thread = this.threads.get(uid);
    if (!thread) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }
    if (!thread.isDormant && !thread.isDead) {
      return SceKernelErrors.ERROR_KERNEL_THREAD_IS_NOT_DORMANT;
    }
    if (thread.stackBlock) {
      this.memoryManager.free(thread.stackBlock);
      thread.stackBlock = null;
    }
    this.threads.release(uid);
    this.onThreadChange.dispatch(thread);
    return SceKernelErrors.ERROR_OK;
  }
  startThread(uid, argSize = 0, argAddr = 0) {
    const thread = this.threads.get(uid);
    if (!thread) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }
    if (!thread.isDormant) {
      return SceKernelErrors.ERROR_KERNEL_THREAD_IS_NOT_DORMANT;
    }
    if (thread.cpu) {
      thread.cpu.pc = thread.entryPoint;
      thread.cpu.gpr[29] = thread.sp;
      thread.cpu.gpr[28] = thread.gp;
      thread.cpu.gpr[4] = argSize;
      thread.cpu.gpr[5] = argAddr;
      thread.cpu.gpr[31] = 0;
    }
    thread.status = 2 /* READY */;
    this.onThreadChange.dispatch(thread);
    return SceKernelErrors.ERROR_OK;
  }
  exitThread(status) {
    if (!this.currentThread) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }
    this.currentThread.exitStatus = status;
    this.currentThread.status = 16 /* DORMANT */;
    this.onThreadChange.dispatch(this.currentThread);
    return SceKernelErrors.ERROR_OK;
  }
  exitDeleteThread(status) {
    if (!this.currentThread) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }
    const uid = this.currentThread.uid;
    this.currentThread.exitStatus = status;
    this.currentThread.status = 32 /* DEAD */;
    if (this.currentThread.stackBlock) {
      this.memoryManager.free(this.currentThread.stackBlock);
      this.currentThread.stackBlock = null;
    }
    this.threads.release(uid);
    this.onThreadChange.dispatch(this.currentThread);
    this.currentThread = null;
    return SceKernelErrors.ERROR_OK;
  }
  suspendThread(uid) {
    const thread = this.threads.get(uid);
    if (!thread) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }
    if (thread.isSuspended) {
      return SceKernelErrors.ERROR_KERNEL_THREAD_ALREADY_SUSPEND;
    }
    if (thread.isDormant || thread.isDead) {
      return SceKernelErrors.ERROR_KERNEL_THREAD_ALREADY_DORMANT;
    }
    if (thread.isWaiting) {
      thread.status = 12 /* WAIT_SUSPEND */;
    } else {
      thread.status = 8 /* SUSPEND */;
    }
    this.onThreadChange.dispatch(thread);
    return SceKernelErrors.ERROR_OK;
  }
  resumeThread(uid) {
    const thread = this.threads.get(uid);
    if (!thread) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }
    if (!thread.isSuspended) {
      return SceKernelErrors.ERROR_KERNEL_THREAD_IS_NOT_SUSPEND;
    }
    if (thread.status === 12 /* WAIT_SUSPEND */) {
      thread.status = 4 /* WAIT */;
    } else {
      thread.status = 2 /* READY */;
    }
    this.onThreadChange.dispatch(thread);
    return SceKernelErrors.ERROR_OK;
  }
  changeThreadPriority(uid, priority) {
    const thread = uid === 0 ? this.currentThread : this.threads.get(uid);
    if (!thread) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }
    if (priority < MIN_PRIORITY || priority > MAX_PRIORITY) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_THREAD_PRIORITY;
    }
    thread.priority = priority;
    this.onThreadChange.dispatch(thread);
    return SceKernelErrors.ERROR_OK;
  }
  getThread(uid) {
    if (uid === 0)
      return this.currentThread ?? undefined;
    return this.threads.get(uid);
  }
  getCurrentThread() {
    return this.currentThread;
  }
  setCurrentThread(thread) {
    if (this.currentThread && this.currentThread !== thread) {
      if (this.currentThread.isRunning) {
        this.currentThread.status = 2 /* READY */;
      }
    }
    this.currentThread = thread;
    if (thread) {
      thread.status = 1 /* RUNNING */;
    }
  }
  getAllThreads() {
    return [...this.threads.values()];
  }
  getReadyThreads() {
    return this.getAllThreads().filter((t) => t.canSchedule).sort((a, b) => a.priority - b.priority);
  }
  getNextThread() {
    const ready = this.getReadyThreads();
    return ready.length > 0 ? ready[0] : this.idleThread;
  }
  schedule() {
    const next = this.getNextThread();
    this.setCurrentThread(next);
    return next;
  }
  sleepThread() {
    if (!this.currentThread) {
      return PromiseFast.resolve(SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD);
    }
    if (this.currentThread.wakeupCount > 0) {
      this.currentThread.wakeupCount--;
      return PromiseFast.resolve(SceKernelErrors.ERROR_OK);
    }
    return this.currentThread.startWait(1 /* SLEEP */);
  }
  wakeupThread(uid) {
    const thread = this.threads.get(uid);
    if (!thread) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }
    if (thread.waitType === 1 /* SLEEP */) {
      thread.completeWait(SceKernelErrors.ERROR_OK);
    } else {
      thread.wakeupCount++;
    }
    return SceKernelErrors.ERROR_OK;
  }
  delayThread(microseconds) {
    if (!this.currentThread) {
      return PromiseFast.resolve(SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD);
    }
    const thread = this.currentThread;
    const promise = thread.startWait(2 /* DELAY */, 0, microseconds);
    setTimeout(() => {
      if (thread.waitType === 2 /* DELAY */) {
        thread.completeWait(SceKernelErrors.ERROR_OK);
      }
    }, microseconds / 1000);
    return promise;
  }
  rotateThreadReadyQueue(priority) {
    const threads = this.getAllThreads().filter((t) => t.canSchedule && t.priority === priority);
    if (threads.length < 2) {
      return SceKernelErrors.ERROR_OK;
    }
    if (this.currentThread?.priority === priority) {
      this.schedule();
    }
    return SceKernelErrors.ERROR_OK;
  }
  get threadCount() {
    return this.threads.size;
  }
}
// src/hle/manager/CallbackManager.ts
class Callback {
  uid = 0;
  name;
  threadUid;
  functionAddr;
  commonArg;
  notifyCount = 0;
  notifyArg = 0;
  constructor(name, threadUid, functionAddr, commonArg = 0) {
    this.name = name;
    this.threadUid = threadUid;
    this.functionAddr = functionAddr;
    this.commonArg = commonArg;
  }
  notify(arg) {
    this.notifyCount++;
    this.notifyArg = arg;
  }
  get isPending() {
    return this.notifyCount > 0;
  }
  clearNotify() {
    if (this.notifyCount > 0) {
      this.notifyCount--;
    }
  }
}

class CallbackManager {
  callbacks = new UidCollection;
  onCallbackAdded = new Signal1;
  onCallbackNotified = new Signal1;
  constructor() {}
  reset() {
    this.callbacks.clear();
  }
  createCallback(name, threadUid, functionAddr, commonArg = 0) {
    const callback = new Callback(name, threadUid, functionAddr, commonArg);
    callback.uid = this.callbacks.allocate(callback);
    this.onCallbackAdded.dispatch(callback);
    return { callback, error: SceKernelErrors.ERROR_OK };
  }
  deleteCallback(uid) {
    if (!this.callbacks.has(uid)) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_CALLBACK;
    }
    this.callbacks.release(uid);
    return SceKernelErrors.ERROR_OK;
  }
  getCallback(uid) {
    return this.callbacks.get(uid);
  }
  notifyCallback(uid, arg) {
    const callback = this.callbacks.get(uid);
    if (!callback) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_CALLBACK;
    }
    callback.notify(arg);
    this.onCallbackNotified.dispatch(callback);
    return SceKernelErrors.ERROR_OK;
  }
  cancelCallback(uid) {
    const callback = this.callbacks.get(uid);
    if (!callback) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_CALLBACK;
    }
    callback.notifyCount = 0;
    callback.notifyArg = 0;
    return SceKernelErrors.ERROR_OK;
  }
  getCallbacksForThread(threadUid) {
    return this.callbacks.filter((cb) => cb.threadUid === threadUid);
  }
  getPendingCallbacks(threadUid) {
    return this.callbacks.filter((cb) => cb.threadUid === threadUid && cb.isPending);
  }
  getAllCallbacks() {
    return [...this.callbacks.values()];
  }
  hasPendingCallbacks(threadUid) {
    return this.callbacks.find((cb) => cb.threadUid === threadUid && cb.isPending) !== undefined;
  }
  getNextPendingCallback(threadUid) {
    return this.callbacks.find((cb) => cb.threadUid === threadUid && cb.isPending);
  }
  get callbackCount() {
    return this.callbacks.size;
  }
}
// src/hle/manager/ModuleManager.ts
var MODULE_FUNCTIONS = Symbol("module_functions");
var MODULE_NAME = Symbol("module_name");
function hleModule(name) {
  return (target) => {
    target[MODULE_NAME] = name;
    return target;
  };
}
function nativeFunction(nid, firmwareVersion = 150) {
  return (target, propertyKey, _descriptor) => {
    const constructor = target.constructor;
    let functions = constructor[MODULE_FUNCTIONS];
    if (!functions) {
      functions = [];
      constructor[MODULE_FUNCTIONS] = functions;
    }
    functions.push({
      nid,
      name: propertyKey,
      firmwareVersion
    });
  };
}

class ModuleManager {
  functionsByNid = new Map;
  functionsByName = new Map;
  modules = new Map;
  context = null;
  constructor() {}
  setContext(ctx) {
    this.context = ctx;
  }
  reset() {
    for (const module of this.modules.values()) {
      module.reset?.();
    }
  }
  registerModule(moduleClass) {
    const moduleName = moduleClass[MODULE_NAME];
    if (!moduleName) {
      throw new Error(`Module class ${moduleClass.name} is not decorated with @hleModule`);
    }
    const instance = new moduleClass;
    this.modules.set(moduleName, instance);
    if (this.context) {
      instance.init?.(this.context);
    }
    const functions = moduleClass[MODULE_FUNCTIONS];
    if (functions) {
      for (const func of functions) {
        const handler = instance[func.name];
        if (typeof handler === "function") {
          const info = {
            nid: func.nid,
            name: `${moduleName}::${func.name}`,
            handler: handler.bind(instance),
            firmwareVersion: func.firmwareVersion,
            moduleName
          };
          this.functionsByNid.set(func.nid, info);
          this.functionsByName.set(info.name, info);
        }
      }
    }
  }
  registerFunction(nid, name, handler, moduleName = "standalone", firmwareVersion = 150) {
    const info = {
      nid,
      name,
      handler,
      firmwareVersion,
      moduleName
    };
    this.functionsByNid.set(nid, info);
    this.functionsByName.set(name, info);
  }
  getFunction(nid) {
    return this.functionsByNid.get(nid);
  }
  getFunctionByName(name) {
    return this.functionsByName.get(name);
  }
  call(nid) {
    const func = this.functionsByNid.get(nid);
    if (!func) {
      console.warn(`Unknown syscall NID: 0x${nid.toString(16)}`);
      return 0;
    }
    if (!this.context) {
      throw new Error("Context not set");
    }
    const result = func.handler(this.context);
    if (result === undefined) {
      return 0;
    }
    return result;
  }
  getModule(name) {
    return this.modules.get(name);
  }
  initAll() {
    if (!this.context)
      return;
    for (const module of this.modules.values()) {
      module.init?.(this.context);
    }
  }
  getFunctionNames() {
    return [...this.functionsByName.keys()];
  }
  get functionCount() {
    return this.functionsByNid.size;
  }
  get moduleCount() {
    return this.modules.size;
  }
}
// src/util/WaitQueue.ts
var WaitStatus = {
  READY: 1,
  WAIT: 4
};

class WaitQueue {
  waiters = [];
  get length() {
    return this.waiters.length;
  }
  get isEmpty() {
    return this.waiters.length === 0;
  }
  acquire(resource, condition, onAcquire, waitable, timeout = 0, priority = 32) {
    if (condition(resource)) {
      return onAcquire(resource);
    }
    const { promise, resolve, reject } = PromiseFast.create();
    const entry = {
      waitable,
      condition,
      onAcquire,
      resolve,
      reject,
      priority
    };
    if (timeout > 0) {
      const timeoutMs = timeout / 1000;
      entry.timeoutId = setTimeout(() => {
        this.removeWaiter(entry);
        waitable.status = WaitStatus.READY;
        reject(SceKernelErrors.ERROR_KERNEL_WAIT_TIMEOUT);
      }, timeoutMs);
    }
    this.insertWaiter(entry);
    waitable.status = WaitStatus.WAIT;
    return promise;
  }
  tryAcquire(resource, condition, onAcquire) {
    if (condition(resource)) {
      return { success: true, result: onAcquire(resource) };
    }
    return { success: false };
  }
  signal(resource, wakeAll = false) {
    let woken = 0;
    for (let i = 0;i < this.waiters.length; ) {
      const entry = this.waiters[i];
      if (entry.condition(resource)) {
        this.waiters.splice(i, 1);
        if (entry.timeoutId) {
          clearTimeout(entry.timeoutId);
        }
        entry.waitable.status = WaitStatus.READY;
        try {
          const result = entry.onAcquire(resource);
          entry.resolve(result);
        } catch (e) {
          entry.reject(SceKernelErrors.ERROR_KERNEL_WAIT_CANCELLED);
        }
        woken++;
        if (!wakeAll) {
          break;
        }
      } else {
        i++;
      }
    }
    return woken;
  }
  cancelAll(error = SceKernelErrors.ERROR_KERNEL_WAIT_DELETE) {
    const count = this.waiters.length;
    for (const entry of this.waiters) {
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
      }
      entry.waitable.status = WaitStatus.READY;
      entry.reject(error);
    }
    this.waiters = [];
    return count;
  }
  cancel(waitable, error = SceKernelErrors.ERROR_KERNEL_WAIT_CANCELLED) {
    const index = this.waiters.findIndex((e) => e.waitable.uid === waitable.uid);
    if (index === -1)
      return false;
    const entry = this.waiters[index];
    this.waiters.splice(index, 1);
    if (entry.timeoutId) {
      clearTimeout(entry.timeoutId);
    }
    entry.waitable.status = WaitStatus.READY;
    entry.reject(error);
    return true;
  }
  has(waitable) {
    return this.waiters.some((e) => e.waitable.uid === waitable.uid);
  }
  getWaiters() {
    return this.waiters.map((e) => e.waitable.uid);
  }
  insertWaiter(entry) {
    let i = 0;
    while (i < this.waiters.length && this.waiters[i].priority <= entry.priority) {
      i++;
    }
    this.waiters.splice(i, 0, entry);
  }
  removeWaiter(entry) {
    const index = this.waiters.indexOf(entry);
    if (index !== -1) {
      this.waiters.splice(index, 1);
    }
  }
}

class Semaphore {
  uid;
  name;
  maxCount;
  count;
  waitQueue = new WaitQueue;
  constructor(uid, name, initialCount, maxCount) {
    this.uid = uid;
    this.name = name;
    this.maxCount = maxCount;
    this.count = initialCount;
  }
  get currentCount() {
    return this.count;
  }
  get waitingThreads() {
    return this.waitQueue.length;
  }
  wait(signal, thread, timeout = 0) {
    return this.waitQueue.acquire(this, (s) => s.count >= signal, (s) => {
      s.count -= signal;
      return 0;
    }, thread, timeout, 32);
  }
  poll(signal) {
    const result = this.waitQueue.tryAcquire(this, (s) => s.count >= signal, (s) => {
      s.count -= signal;
      return 0;
    });
    return result.success ? result.result : SceKernelErrors.ERROR_KERNEL_SEMA_ZERO;
  }
  signal(count) {
    if (this.count + count > this.maxCount) {
      return SceKernelErrors.ERROR_KERNEL_SEMA_OVERFLOW;
    }
    this.count += count;
    this.waitQueue.signal(this, false);
    return 0;
  }
  cancelAll() {
    return this.waitQueue.cancelAll();
  }
}

class Mutex {
  uid;
  name;
  recursive;
  owner = 0;
  lockCount = 0;
  waitQueue = new WaitQueue;
  constructor(uid, name, recursive = false) {
    this.uid = uid;
    this.name = name;
    this.recursive = recursive;
  }
  get isLocked() {
    return this.owner !== 0;
  }
  get waitingThreads() {
    return this.waitQueue.length;
  }
  lock(thread, timeout = 0) {
    if (this.owner === thread.uid) {
      if (this.recursive) {
        this.lockCount++;
        return 0;
      }
      return SceKernelErrors.ERROR_KERNEL_WAIT_STATUS_RELEASED;
    }
    return this.waitQueue.acquire(this, (m) => m.owner === 0, (m) => {
      m.owner = thread.uid;
      m.lockCount = 1;
      return 0;
    }, thread, timeout, 32);
  }
  tryLock(thread) {
    if (this.owner === thread.uid && this.recursive) {
      this.lockCount++;
      return 0;
    }
    const result = this.waitQueue.tryAcquire(this, (m) => m.owner === 0, (m) => {
      m.owner = thread.uid;
      m.lockCount = 1;
      return 0;
    });
    return result.success ? 0 : SceKernelErrors.ERROR_KERNEL_WAIT_TIMEOUT;
  }
  unlock(thread) {
    if (this.owner !== thread.uid) {
      return SceKernelErrors.ERROR_KERNEL_NOT_HOLDER_UID;
    }
    this.lockCount--;
    if (this.lockCount === 0) {
      this.owner = 0;
      this.waitQueue.signal(this, false);
    }
    return 0;
  }
  cancelAll() {
    return this.waitQueue.cancelAll();
  }
}

// src/hle/manager/SyncManager.ts
class EventFlag {
  uid;
  name;
  attr;
  pattern;
  waitQueue = new WaitQueue;
  constructor(uid, name, attr, initialPattern) {
    this.uid = uid;
    this.name = name;
    this.attr = attr;
    this.pattern = initialPattern >>> 0;
  }
  get currentPattern() {
    return this.pattern;
  }
  get waitingThreads() {
    return this.waitQueue.length;
  }
  set(bits2) {
    this.pattern = (this.pattern | bits2) >>> 0;
    this.waitQueue.signal(this, true);
  }
  clear(bits2) {
    this.pattern = (this.pattern & ~bits2) >>> 0;
  }
  wait(bits2, mode, thread, timeout = 0) {
    const isOr = (mode & 1 /* Or */) !== 0;
    const clearBits = (mode & 16 /* Clear */) !== 0;
    const clearAll = (mode & 32 /* ClearAll */) !== 0;
    const condition = (ef) => {
      if (isOr) {
        return (ef.pattern & bits2) !== 0;
      }
      return (ef.pattern & bits2) === bits2;
    };
    const onAcquire = (ef) => {
      const matched = ef.pattern;
      if (clearAll) {
        ef.pattern = 0;
      } else if (clearBits) {
        ef.pattern = (ef.pattern & ~bits2) >>> 0;
      }
      return matched;
    };
    return this.waitQueue.acquire(this, condition, onAcquire, thread, timeout);
  }
  poll(bits2, mode) {
    const isOr = (mode & 1 /* Or */) !== 0;
    const clearBits = (mode & 16 /* Clear */) !== 0;
    const clearAll = (mode & 32 /* ClearAll */) !== 0;
    const matches = isOr ? (this.pattern & bits2) !== 0 : (this.pattern & bits2) === bits2;
    if (!matches) {
      return { success: false, pattern: this.pattern };
    }
    const matched = this.pattern;
    if (clearAll) {
      this.pattern = 0;
    } else if (clearBits) {
      this.pattern = (this.pattern & ~bits2) >>> 0;
    }
    return { success: true, pattern: matched };
  }
  cancelAll() {
    return this.waitQueue.cancelAll();
  }
}

class SyncManager {
  semaphores = new UidCollection;
  mutexes = new UidCollection;
  eventFlags = new UidCollection;
  reset() {
    for (const sema of this.semaphores.values()) {
      sema.cancelAll();
    }
    for (const mutex of this.mutexes.values()) {
      mutex.cancelAll();
    }
    for (const ef of this.eventFlags.values()) {
      ef.cancelAll();
    }
    this.semaphores.clear();
    this.mutexes.clear();
    this.eventFlags.clear();
  }
  createSemaphore(name, attr, initCount, maxCount) {
    if (initCount < 0 || initCount > maxCount) {
      return { semaphore: null, error: SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT };
    }
    if (maxCount <= 0) {
      return { semaphore: null, error: SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT };
    }
    const uid = this.semaphores.nextId();
    const semaphore = new Semaphore(uid, name, initCount, maxCount);
    this.semaphores.set(uid, semaphore);
    return { semaphore, error: SceKernelErrors.ERROR_OK };
  }
  deleteSemaphore(uid) {
    const sema = this.semaphores.get(uid);
    if (!sema) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE;
    }
    sema.cancelAll();
    this.semaphores.release(uid);
    return SceKernelErrors.ERROR_OK;
  }
  getSemaphore(uid) {
    return this.semaphores.get(uid);
  }
  getSemaphoreInfo(uid) {
    const sema = this.semaphores.get(uid);
    if (!sema) {
      return null;
    }
    return {
      size: 56,
      name: sema.name,
      attr: 0,
      initCount: sema.maxCount,
      currentCount: sema.currentCount,
      maxCount: sema.maxCount,
      numWaitThreads: sema.waitingThreads
    };
  }
  createMutex(name, attr, initCount) {
    const recursive = (attr & 512) !== 0;
    const uid = this.mutexes.nextId();
    const mutex = new Mutex(uid, name, recursive);
    this.mutexes.set(uid, mutex);
    return { mutex, error: SceKernelErrors.ERROR_OK };
  }
  deleteMutex(uid) {
    const mutex = this.mutexes.get(uid);
    if (!mutex) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE;
    }
    mutex.cancelAll();
    this.mutexes.release(uid);
    return SceKernelErrors.ERROR_OK;
  }
  getMutex(uid) {
    return this.mutexes.get(uid);
  }
  createEventFlag(name, attr, initPattern) {
    const uid = this.eventFlags.nextId();
    const eventFlag = new EventFlag(uid, name, attr, initPattern);
    this.eventFlags.set(uid, eventFlag);
    return { eventFlag, error: SceKernelErrors.ERROR_OK };
  }
  deleteEventFlag(uid) {
    const ef = this.eventFlags.get(uid);
    if (!ef) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_EVENT_FLAG;
    }
    ef.cancelAll();
    this.eventFlags.release(uid);
    return SceKernelErrors.ERROR_OK;
  }
  getEventFlag(uid) {
    return this.eventFlags.get(uid);
  }
}
// src/hle/manager/DisplayManager.ts
var PSP_DISPLAY_WIDTH = 480;
var PSP_DISPLAY_HEIGHT = 272;
var PSP_DISPLAY_LINE_SIZE = 512;
class DisplayManager {
  mode = 0;
  width = PSP_DISPLAY_WIDTH;
  height = PSP_DISPLAY_HEIGHT;
  frontBuffer = {
    topAddr: 67108864,
    bufferWidth: PSP_DISPLAY_LINE_SIZE,
    pixelFormat: 3 /* RGBA8888 */,
    syncMode: 0 /* Immediate */
  };
  backBuffer = null;
  vcount = 0;
  hcount = 0;
  accumulatedHcount = 0;
  lastVblankTime = 0;
  vblankInterval = 1000 / 60;
  vblankWaiters = [];
  vblankTimerId;
  isForeground = true;
  start() {
    if (this.vblankTimerId)
      return;
    this.lastVblankTime = Date.now();
    this.vblankTimerId = setInterval(() => this.onVblank(), this.vblankInterval);
  }
  stop() {
    if (this.vblankTimerId) {
      clearInterval(this.vblankTimerId);
      this.vblankTimerId = undefined;
    }
  }
  reset() {
    this.stop();
    this.mode = 0;
    this.width = PSP_DISPLAY_WIDTH;
    this.height = PSP_DISPLAY_HEIGHT;
    this.vcount = 0;
    this.hcount = 0;
    this.accumulatedHcount = 0;
    this.frontBuffer = {
      topAddr: 67108864,
      bufferWidth: PSP_DISPLAY_LINE_SIZE,
      pixelFormat: 3 /* RGBA8888 */,
      syncMode: 0 /* Immediate */
    };
    this.backBuffer = null;
    this.cancelAllWaiters();
  }
  onVblank() {
    this.vcount++;
    this.hcount = 0;
    this.accumulatedHcount += PSP_DISPLAY_HEIGHT;
    this.lastVblankTime = Date.now();
    if (this.backBuffer && this.frontBuffer.syncMode === 1 /* NextFrame */) {
      this.frontBuffer = this.backBuffer;
      this.backBuffer = null;
    }
    this.wakeVblankWaiters();
  }
  wakeVblankWaiters() {
    const waiters = this.vblankWaiters;
    this.vblankWaiters = [];
    for (const entry of waiters) {
      entry.waitable.status = WaitStatus.READY;
      entry.resolve(0);
    }
  }
  cancelAllWaiters() {
    const waiters = this.vblankWaiters;
    this.vblankWaiters = [];
    for (const entry of waiters) {
      entry.waitable.status = WaitStatus.READY;
      entry.resolve(SceKernelErrors.ERROR_KERNEL_WAIT_CANCELLED);
    }
  }
  setMode(mode, width, height) {
    if (width !== PSP_DISPLAY_WIDTH || height !== PSP_DISPLAY_HEIGHT) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_SIZE;
    }
    this.mode = mode;
    this.width = width;
    this.height = height;
    return SceKernelErrors.ERROR_OK;
  }
  getMode() {
    return {
      mode: this.mode,
      width: this.width,
      height: this.height
    };
  }
  setFrameBuf(topAddr, bufferWidth, pixelFormat, syncMode) {
    if (bufferWidth < 0 || bufferWidth > 2048) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_SIZE;
    }
    if (pixelFormat < 0 || pixelFormat > 3) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }
    const buffer = {
      topAddr,
      bufferWidth,
      pixelFormat,
      syncMode
    };
    if (syncMode === 0 /* Immediate */) {
      this.frontBuffer = buffer;
    } else {
      this.backBuffer = buffer;
    }
    return SceKernelErrors.ERROR_OK;
  }
  getFrameBuf() {
    return this.frontBuffer;
  }
  getVcount() {
    return this.vcount;
  }
  getCurrentHcount() {
    const elapsed = Date.now() - this.lastVblankTime;
    const progress = elapsed / this.vblankInterval;
    return Math.floor(progress * PSP_DISPLAY_HEIGHT) % PSP_DISPLAY_HEIGHT;
  }
  getAccumulatedHcount() {
    return this.accumulatedHcount + this.getCurrentHcount();
  }
  isVblank() {
    const elapsed = Date.now() - this.lastVblankTime;
    const progress = elapsed / this.vblankInterval;
    return progress > 0.9;
  }
  getIsForeground() {
    return this.isForeground;
  }
  waitVblank(thread, waitStart = false) {
    if (this.isVblank() && !waitStart) {
      return 0;
    }
    const { promise, resolve } = PromiseFast.create();
    this.vblankWaiters.push({
      waitable: thread,
      resolve,
      isStart: waitStart
    });
    thread.status = WaitStatus.WAIT;
    return promise;
  }
  getBytesPerPixel(format2) {
    switch (format2) {
      case 0 /* RGB565 */:
      case 1 /* RGBA5551 */:
      case 2 /* RGBA4444 */:
        return 2;
      case 3 /* RGBA8888 */:
        return 4;
      default:
        return 4;
    }
  }
  getFrameBufferSize() {
    const bpp = this.getBytesPerPixel(this.frontBuffer.pixelFormat);
    return this.frontBuffer.bufferWidth * PSP_DISPLAY_HEIGHT * bpp;
  }
}
// src/hle/manager/InputManager.ts
class InputManager {
  buttonState = 0;
  analogX = 128;
  analogY = 128;
  samplingCycle = 0;
  samplingMode = 1 /* Analog */;
  static BUFFER_SIZE = 64;
  buffer = [];
  bufferIndex = 0;
  latchData = null;
  startTime = Date.now();
  constructor() {
    this.reset();
  }
  reset() {
    this.buttonState = 0;
    this.analogX = 128;
    this.analogY = 128;
    this.samplingCycle = 0;
    this.samplingMode = 1 /* Analog */;
    this.buffer = [];
    this.bufferIndex = 0;
    this.latchData = null;
    this.startTime = Date.now();
  }
  setButton(button) {
    this.buttonState |= button;
    this.updateBuffer();
  }
  clearButton(button) {
    this.buttonState &= ~button;
    this.updateBuffer();
  }
  setButtons(buttons) {
    this.buttonState = buttons;
    this.updateBuffer();
  }
  setAnalog(x, y) {
    this.analogX = Math.max(0, Math.min(255, x));
    this.analogY = Math.max(0, Math.min(255, y));
    this.updateBuffer();
  }
  getTimestamp() {
    return Date.now() - this.startTime;
  }
  updateBuffer() {
    const data = {
      timeStamp: this.getTimestamp(),
      buttons: this.buttonState,
      lx: this.samplingMode === 1 /* Analog */ ? this.analogX : 128,
      ly: this.samplingMode === 1 /* Analog */ ? this.analogY : 128,
      rsrv: new Uint8Array(6)
    };
    if (this.buffer.length < InputManager.BUFFER_SIZE) {
      this.buffer.push(data);
    } else {
      this.buffer[this.bufferIndex] = data;
      this.bufferIndex = (this.bufferIndex + 1) % InputManager.BUFFER_SIZE;
    }
    this.latchData = data;
  }
  setSamplingCycle(cycle) {
    this.samplingCycle = cycle;
    return SceKernelErrors.ERROR_OK;
  }
  getSamplingCycle() {
    return this.samplingCycle;
  }
  setSamplingMode(mode) {
    const prevMode = this.samplingMode;
    this.samplingMode = mode;
    return prevMode;
  }
  getSamplingMode() {
    return this.samplingMode;
  }
  getCurrentData() {
    return {
      timeStamp: this.getTimestamp(),
      buttons: this.buttonState,
      lx: this.samplingMode === 1 /* Analog */ ? this.analogX : 128,
      ly: this.samplingMode === 1 /* Analog */ ? this.analogY : 128,
      rsrv: new Uint8Array(6)
    };
  }
  peekBuffer(count) {
    const result = [];
    if (this.buffer.length === 0 || count <= 0) {
      if (count > 0) {
        result.push(this.getCurrentData());
      }
      return result;
    }
    const available = Math.min(count, this.buffer.length);
    for (let i = 0;i < available; i++) {
      const idx = (this.bufferIndex - available + i + this.buffer.length) % this.buffer.length;
      result.push(this.buffer[idx]);
    }
    return result;
  }
  readBuffer(count) {
    const result = this.peekBuffer(count);
    this.latchData = null;
    return result;
  }
  isButtonPressed(button) {
    return (this.buttonState & button) !== 0;
  }
  getButtons() {
    return this.buttonState;
  }
}
// src/hle/manager/GpuManager.ts
var EDRAM_BASE = 67108864;
var EDRAM_SIZE = 2097152;
class GpuManager {
  lists = new Map;
  nextListId = 1;
  queue = [];
  callbacks = new Map;
  nextCallbackId = 1;
  listWaiters = new Map;
  drawSyncWaiters = [];
  reset() {
    this.lists.clear();
    this.queue = [];
    this.callbacks.clear();
    this.listWaiters.clear();
    this.drawSyncWaiters = [];
    this.nextListId = 1;
    this.nextCallbackId = 1;
  }
  getEdramAddress() {
    return EDRAM_BASE;
  }
  getEdramSize() {
    return EDRAM_SIZE;
  }
  enqueueList(list, stall, callbackId, arg) {
    const id = this.nextListId++;
    const displayList = {
      id,
      state: 1 /* Queued */,
      startAddress: list,
      stallAddress: stall,
      callbackId,
      arg,
      ctx: 0,
      stackAddress: 0,
      stackPointer: 0
    };
    this.lists.set(id, displayList);
    this.queue.push(id);
    this.executeList(id);
    return id;
  }
  enqueueListHead(list, stall, callbackId, arg) {
    const id = this.nextListId++;
    const displayList = {
      id,
      state: 1 /* Queued */,
      startAddress: list,
      stallAddress: stall,
      callbackId,
      arg,
      ctx: 0,
      stackAddress: 0,
      stackPointer: 0
    };
    this.lists.set(id, displayList);
    this.queue.unshift(id);
    this.executeList(id);
    return id;
  }
  dequeueList(listId) {
    const list = this.lists.get(listId);
    if (!list) {
      return SceKernelErrors.ERROR_INVALID_ID;
    }
    const index = this.queue.indexOf(listId);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
    list.state = 4 /* CancelDone */;
    this.wakeListWaiters(listId);
    return SceKernelErrors.ERROR_OK;
  }
  updateStallAddress(listId, stall) {
    const list = this.lists.get(listId);
    if (!list) {
      return SceKernelErrors.ERROR_INVALID_ID;
    }
    list.stallAddress = stall;
    if (list.state === 3 /* StallReached */) {
      this.executeList(listId);
    }
    return SceKernelErrors.ERROR_OK;
  }
  executeList(listId) {
    const list = this.lists.get(listId);
    if (!list)
      return;
    list.state = 0 /* Done */;
    const index = this.queue.indexOf(listId);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
    this.wakeListWaiters(listId);
    if (this.queue.length === 0) {
      this.wakeDrawSyncWaiters();
    }
  }
  getListState(listId) {
    const list = this.lists.get(listId);
    return list?.state ?? 0 /* Done */;
  }
  listSync(listId, syncType, thread) {
    const list = this.lists.get(listId);
    if (!list) {
      return 0 /* Done */;
    }
    if (list.state === 0 /* Done */ || list.state === 4 /* CancelDone */) {
      return list.state;
    }
    if (syncType === 1 /* Peek */) {
      return list.state;
    }
    const { promise, resolve } = PromiseFast.create();
    if (!this.listWaiters.has(listId)) {
      this.listWaiters.set(listId, []);
    }
    this.listWaiters.get(listId).push({
      waitable: thread,
      resolve
    });
    thread.status = WaitStatus.WAIT;
    return promise;
  }
  drawSync(syncType, thread) {
    if (this.queue.length === 0) {
      return 0 /* Done */;
    }
    if (syncType === 1 /* Peek */) {
      return 1 /* Queued */;
    }
    const { promise, resolve } = PromiseFast.create();
    this.drawSyncWaiters.push({
      waitable: thread,
      resolve
    });
    thread.status = WaitStatus.WAIT;
    return promise;
  }
  wakeListWaiters(listId) {
    const waiters = this.listWaiters.get(listId);
    if (!waiters)
      return;
    const list = this.lists.get(listId);
    const state = list?.state ?? 0 /* Done */;
    for (const entry of waiters) {
      entry.waitable.status = WaitStatus.READY;
      entry.resolve(state);
    }
    this.listWaiters.delete(listId);
  }
  wakeDrawSyncWaiters() {
    const waiters = this.drawSyncWaiters;
    this.drawSyncWaiters = [];
    for (const entry of waiters) {
      entry.waitable.status = WaitStatus.READY;
      entry.resolve(0 /* Done */);
    }
  }
  setCallback(signal, finish, arg) {
    const id = this.nextCallbackId++;
    this.callbacks.set(id, { signal, finish, arg });
    return id;
  }
  unsetCallback(cbid) {
    if (!this.callbacks.has(cbid)) {
      return SceKernelErrors.ERROR_INVALID_ID;
    }
    this.callbacks.delete(cbid);
    return SceKernelErrors.ERROR_OK;
  }
  continue() {
    for (const list of this.lists.values()) {
      if (list.state === 3 /* StallReached */) {
        this.executeList(list.id);
      }
    }
    return SceKernelErrors.ERROR_OK;
  }
  break(mode) {
    for (const listId of this.queue) {
      const list = this.lists.get(listId);
      if (list) {
        list.state = 3 /* StallReached */;
      }
    }
    return SceKernelErrors.ERROR_OK;
  }
}
// src/hle/manager/AudioManager.ts
var MAX_CHANNELS = 8;
var SRC_CHANNEL_ID = 8;

class AudioManager {
  channels = new Map;
  srcChannel = null;
  outputWaiters = new Map;
  reset() {
    this.channels.clear();
    this.srcChannel = null;
    this.outputWaiters.clear();
  }
  reserveChannel(channelId, sampleCount, format2) {
    if (sampleCount <= 0 || sampleCount > 65536) {
      return SceKernelErrors.ERROR_AUDIO_INVALID_SIZE;
    }
    if ((sampleCount & 63) !== 0) {
      return SceKernelErrors.ERROR_AUDIO_INVALID_SIZE;
    }
    if (channelId < 0) {
      for (let i = 0;i < MAX_CHANNELS; i++) {
        if (!this.channels.has(i)) {
          channelId = i;
          break;
        }
      }
      if (channelId < 0) {
        return SceKernelErrors.ERROR_AUDIO_CHANNEL_BUSY;
      }
    }
    if (channelId >= MAX_CHANNELS) {
      return SceKernelErrors.ERROR_AUDIO_INVALID_CHANNEL;
    }
    if (this.channels.has(channelId)) {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_BUSY;
    }
    const channel = {
      id: channelId,
      reserved: true,
      sampleCount,
      format: format2,
      volumeLeft: 32768,
      volumeRight: 32768,
      restLength: 0
    };
    this.channels.set(channelId, channel);
    return channelId;
  }
  releaseChannel(channelId) {
    if (!this.channels.has(channelId)) {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }
    this.channels.delete(channelId);
    return SceKernelErrors.ERROR_OK;
  }
  getChannel(channelId) {
    return this.channels.get(channelId);
  }
  setChannelVolume(channelId, volumeLeft, volumeRight) {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }
    channel.volumeLeft = Math.max(0, Math.min(65535, volumeLeft));
    channel.volumeRight = Math.max(0, Math.min(65535, volumeRight));
    return SceKernelErrors.ERROR_OK;
  }
  setChannelDataLen(channelId, sampleCount) {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }
    if ((sampleCount & 63) !== 0 || sampleCount <= 0) {
      return SceKernelErrors.ERROR_AUDIO_INVALID_SIZE;
    }
    channel.sampleCount = sampleCount;
    return SceKernelErrors.ERROR_OK;
  }
  changeChannelConfig(channelId, format2) {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }
    channel.format = format2;
    return SceKernelErrors.ERROR_OK;
  }
  getChannelRestLen(channelId) {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }
    return channel.restLength;
  }
  output(channelId, vol, bufPtr) {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }
    return channel.sampleCount;
  }
  outputBlocking(channelId, vol, bufPtr, thread) {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }
    const { promise, resolve } = PromiseFast.create();
    setTimeout(() => {
      resolve(channel.sampleCount);
    }, Math.floor(channel.sampleCount / 44.1));
    return promise;
  }
  outputPanned(channelId, volLeft, volRight, bufPtr) {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }
    channel.volumeLeft = volLeft;
    channel.volumeRight = volRight;
    return channel.sampleCount;
  }
  outputPannedBlocking(channelId, volLeft, volRight, bufPtr, thread) {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }
    channel.volumeLeft = volLeft;
    channel.volumeRight = volRight;
    return this.outputBlocking(channelId, 0, bufPtr, thread);
  }
  reserveOutput2(sampleCount) {
    if (this.srcChannel) {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_BUSY;
    }
    if ((sampleCount & 63) !== 0 || sampleCount <= 0) {
      return SceKernelErrors.ERROR_AUDIO_INVALID_SIZE;
    }
    this.srcChannel = {
      id: SRC_CHANNEL_ID,
      reserved: true,
      sampleCount,
      format: 0 /* Stereo */,
      volumeLeft: 32768,
      volumeRight: 32768,
      restLength: 0
    };
    return SceKernelErrors.ERROR_OK;
  }
  releaseOutput2() {
    if (!this.srcChannel) {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }
    this.srcChannel = null;
    return SceKernelErrors.ERROR_OK;
  }
  output2Blocking(vol, bufPtr, thread) {
    if (!this.srcChannel) {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }
    const { promise, resolve } = PromiseFast.create();
    setTimeout(() => {
      resolve(this.srcChannel?.sampleCount ?? 0);
    }, Math.floor(this.srcChannel.sampleCount / 44.1));
    return promise;
  }
  getOutput2RestLen() {
    return this.srcChannel?.restLength ?? 0;
  }
  setOutput2Frequency(frequency) {
    return SceKernelErrors.ERROR_OK;
  }
  getOutput2Frequency() {
    return 48000;
  }
}
// src/hle/manager/SyscallManager.ts
class SyscallManager {
  addressToNid = new Map;
  nidToStub = new Map;
  moduleManager = null;
  context = null;
  libraries = [];
  stubs = [];
  constructor() {}
  setModuleManager(mm) {
    this.moduleManager = mm;
  }
  setContext(ctx) {
    this.context = ctx;
  }
  reset() {
    this.addressToNid.clear();
    this.nidToStub.clear();
    this.libraries = [];
    this.stubs = [];
  }
  parseImports(memory, importsStart, importsEnd) {
    this.reset();
    let offset = importsStart;
    while (offset < importsEnd) {
      const nameAddress = memory.lw(offset + 0);
      const version = memory.lhu(offset + 4);
      const flags = memory.lhu(offset + 6);
      const entrySize = memory.lbu(offset + 8);
      const variableCount = memory.lbu(offset + 9);
      const functionCount = memory.lhu(offset + 10);
      const libraryNid = memory.lw(offset + 12);
      const nidTableAddress = memory.lw(offset + 16);
      const stubAddress = memory.lw(offset + 20);
      const name = nameAddress ? memory.readString(nameAddress, 64) : "";
      const library = {
        name,
        flags,
        entrySize,
        variableCount,
        functionCount,
        libraryNid,
        nidTableAddress,
        stubAddress
      };
      this.libraries.push(library);
      this.parseFunctionStubs(memory, library);
      const entryLength = entrySize ? entrySize * 4 : 24;
      offset += entryLength;
    }
  }
  parseFunctionStubs(memory, library) {
    const { name, functionCount, nidTableAddress, stubAddress } = library;
    for (let i = 0;i < functionCount; i++) {
      const nid = memory.lw(nidTableAddress + i * 4);
      const address = stubAddress + i * 8;
      const stub = {
        address,
        nid,
        libraryName: name
      };
      this.stubs.push(stub);
      this.addressToNid.set(address, nid);
      this.nidToStub.set(nid, stub);
    }
  }
  getNid(address) {
    return this.addressToNid.get(address) ?? this.addressToNid.get(address - 4) ?? this.addressToNid.get(address & ~7);
  }
  getStub(nid) {
    return this.nidToStub.get(nid);
  }
  getFunction(nid) {
    return this.moduleManager?.getFunction(nid);
  }
  handleSyscall(syscallAddress, syscallCode) {
    const nid = this.getNid(syscallAddress);
    if (nid === undefined) {
      console.warn(`[Syscall] Unknown syscall at 0x${syscallAddress.toString(16)} (code: 0x${syscallCode.toString(16)})`);
      return 0;
    }
    const func = this.moduleManager?.getFunction(nid);
    if (!func) {
      const stub = this.nidToStub.get(nid);
      const name = stub ? `${stub.libraryName}` : "unknown";
      console.warn(`[Syscall] Unimplemented NID 0x${nid.toString(16)} (${name})`);
      return 0;
    }
    if (!this.context) {
      console.error("[Syscall] No context set");
      return 0;
    }
    try {
      const result = func.handler(this.context);
      if (result instanceof Promise) {
        console.warn(`[Syscall] Async syscall ${func.name} - thread suspension not implemented`);
        return 0;
      }
      return result ?? 0;
    } catch (e) {
      console.error(`[Syscall] Error in ${func.name}:`, e);
      return 0;
    }
  }
  getImports() {
    return [...this.stubs];
  }
  getLibraries() {
    return [...this.libraries];
  }
  logImports() {
    console.log("=== Import Libraries ===");
    for (const lib of this.libraries) {
      console.log(`  ${lib.name}: ${lib.functionCount} functions, ${lib.variableCount} variables`);
    }
    console.log("=== Import Stubs ===");
    for (const stub of this.stubs) {
      const func = this.moduleManager?.getFunction(stub.nid);
      const status = func ? "✓" : "✗";
      console.log(`  ${status} 0x${stub.address.toString(16)}: NID 0x${stub.nid.toString(16)} (${stub.libraryName})`);
    }
  }
}
// src/hle/vfs/MemoryVfs.ts
class MemoryVfsEntry {
  isFile;
  isDirectory;
  path;
  position = 0;
  node;
  flags;
  constructor(path, node, flags) {
    this.path = path;
    this.node = node;
    this.flags = flags;
    this.isFile = node.type === "file";
    this.isDirectory = node.type === "directory";
    if (flags & 256 /* Append */ && node.data) {
      this.position = node.data.length;
    }
  }
  read(size) {
    if (!this.isFile || !this.node.data) {
      return PromiseFast.resolve(new Uint8Array(0));
    }
    const available = this.node.data.length - this.position;
    const toRead = Math.min(size, available);
    const data = this.node.data.slice(this.position, this.position + toRead);
    this.position += toRead;
    this.node.atime = new Date;
    return PromiseFast.resolve(data);
  }
  write(data) {
    if (!this.isFile) {
      return PromiseFast.resolve(0);
    }
    if (!(this.flags & 2 /* Write */)) {
      return PromiseFast.resolve(0);
    }
    const current = this.node.data ?? new Uint8Array(0);
    const endPosition = this.position + data.length;
    if (endPosition > current.length) {
      const newData = new Uint8Array(endPosition);
      newData.set(current);
      newData.set(data, this.position);
      this.node.data = newData;
    } else {
      current.set(data, this.position);
    }
    this.position = endPosition;
    this.node.mtime = new Date;
    return PromiseFast.resolve(data.length);
  }
  seek(offset, mode) {
    if (!this.isFile) {
      return PromiseFast.resolve(0);
    }
    const size = this.node.data?.length ?? 0;
    switch (mode) {
      case 0 /* Set */:
        this.position = offset;
        break;
      case 1 /* Current */:
        this.position += offset;
        break;
      case 2 /* End */:
        this.position = size + offset;
        break;
    }
    this.position = Math.max(0, this.position);
    return PromiseFast.resolve(this.position);
  }
  getSize() {
    return PromiseFast.resolve(this.node.data?.length ?? 0);
  }
  stat() {
    return PromiseFast.resolve({
      mode: this.isDirectory ? 4096 /* Directory */ : 8192 /* File */,
      size: this.node.data?.length ?? 0,
      atime: this.node.atime,
      mtime: this.node.mtime,
      ctime: this.node.ctime
    });
  }
  close() {
    return PromiseFast.resolve();
  }
  readDir() {
    if (!this.isDirectory || !this.node.children) {
      return PromiseFast.resolve([]);
    }
    const entries = [];
    for (const [name, child] of this.node.children) {
      entries.push({
        name,
        stat: {
          mode: child.type === "directory" ? 4096 /* Directory */ : 8192 /* File */,
          size: child.data?.length ?? 0,
          atime: child.atime,
          mtime: child.mtime,
          ctime: child.ctime
        }
      });
    }
    return PromiseFast.resolve(entries);
  }
}

class MemoryVfs {
  name = "memory";
  root;
  constructor() {
    const now = new Date;
    this.root = {
      type: "directory",
      children: new Map,
      ctime: now,
      mtime: now,
      atime: now
    };
  }
  reset() {
    const now = new Date;
    this.root = {
      type: "directory",
      children: new Map,
      ctime: now,
      mtime: now,
      atime: now
    };
  }
  addFile(path, data) {
    const content = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const parts = this.parsePath(path);
    const fileName = parts.pop();
    if (!fileName)
      return;
    const parent = this.ensureDirectory(parts);
    const now = new Date;
    parent.children.set(fileName, {
      type: "file",
      data: content,
      ctime: now,
      mtime: now,
      atime: now
    });
  }
  getFile(path) {
    const node = this.getNode(path);
    if (!node || node.type !== "file") {
      return null;
    }
    return node.data ?? null;
  }
  parsePath(path) {
    return path.split("/").filter((p) => p.length > 0);
  }
  getNode(path) {
    const parts = this.parsePath(path);
    let current = this.root;
    for (const part of parts) {
      if (current.type !== "directory" || !current.children) {
        return null;
      }
      const next = current.children.get(part);
      if (!next) {
        return null;
      }
      current = next;
    }
    return current;
  }
  ensureDirectory(parts) {
    let current = this.root;
    for (const part of parts) {
      if (!current.children) {
        current.children = new Map;
      }
      let next = current.children.get(part);
      if (!next) {
        const now = new Date;
        next = {
          type: "directory",
          children: new Map,
          ctime: now,
          mtime: now,
          atime: now
        };
        current.children.set(part, next);
      }
      current = next;
    }
    return current;
  }
  open(path, flags) {
    const parts = this.parsePath(path);
    const fileName = parts.pop();
    if (!fileName) {
      return PromiseFast.resolve(null);
    }
    const parent = this.getNode(parts.join("/"));
    if (!parent || parent.type !== "directory") {
      return PromiseFast.resolve(null);
    }
    let node = parent.children?.get(fileName);
    if (!node) {
      if (!(flags & 512 /* Create */)) {
        return PromiseFast.resolve(null);
      }
      const now = new Date;
      node = {
        type: "file",
        data: new Uint8Array(0),
        ctime: now,
        mtime: now,
        atime: now
      };
      parent.children.set(fileName, node);
    }
    if (node.type !== "file") {
      return PromiseFast.resolve(null);
    }
    if (flags & 1024 /* Truncate */ && node.data) {
      node.data = new Uint8Array(0);
      node.mtime = new Date;
    }
    return PromiseFast.resolve(new MemoryVfsEntry(path, node, flags));
  }
  openDir(path) {
    const node = path === "" || path === "/" ? this.root : this.getNode(path);
    if (!node || node.type !== "directory") {
      return PromiseFast.resolve(null);
    }
    return PromiseFast.resolve(new MemoryVfsEntry(path, node, 1 /* Read */));
  }
  stat(path) {
    const node = this.getNode(path);
    if (!node) {
      return PromiseFast.resolve(null);
    }
    return PromiseFast.resolve({
      mode: node.type === "directory" ? 4096 /* Directory */ : 8192 /* File */,
      size: node.data?.length ?? 0,
      atime: node.atime,
      mtime: node.mtime,
      ctime: node.ctime
    });
  }
  exists(path) {
    return PromiseFast.resolve(this.getNode(path) !== null);
  }
  mkdir(path) {
    const parts = this.parsePath(path);
    const dirName = parts.pop();
    if (!dirName) {
      return PromiseFast.resolve(false);
    }
    const parent = this.getNode(parts.join("/")) ?? this.root;
    if (parent.type !== "directory") {
      return PromiseFast.resolve(false);
    }
    if (parent.children?.has(dirName)) {
      return PromiseFast.resolve(false);
    }
    const now = new Date;
    if (!parent.children) {
      parent.children = new Map;
    }
    parent.children.set(dirName, {
      type: "directory",
      children: new Map,
      ctime: now,
      mtime: now,
      atime: now
    });
    return PromiseFast.resolve(true);
  }
  remove(path) {
    const parts = this.parsePath(path);
    const fileName = parts.pop();
    if (!fileName) {
      return PromiseFast.resolve(false);
    }
    const parent = parts.length > 0 ? this.getNode(parts.join("/")) : this.root;
    if (!parent || parent.type !== "directory") {
      return PromiseFast.resolve(false);
    }
    const node = parent.children?.get(fileName);
    if (!node || node.type !== "file") {
      return PromiseFast.resolve(false);
    }
    parent.children.delete(fileName);
    return PromiseFast.resolve(true);
  }
  rmdir(path) {
    const parts = this.parsePath(path);
    const dirName = parts.pop();
    if (!dirName) {
      return PromiseFast.resolve(false);
    }
    const parent = parts.length > 0 ? this.getNode(parts.join("/")) : this.root;
    if (!parent || parent.type !== "directory") {
      return PromiseFast.resolve(false);
    }
    const node = parent.children?.get(dirName);
    if (!node || node.type !== "directory") {
      return PromiseFast.resolve(false);
    }
    if (node.children && node.children.size > 0) {
      return PromiseFast.resolve(false);
    }
    parent.children.delete(dirName);
    return PromiseFast.resolve(true);
  }
  rename(oldPath, newPath) {
    const oldParts = this.parsePath(oldPath);
    const oldName = oldParts.pop();
    if (!oldName) {
      return PromiseFast.resolve(false);
    }
    const newParts = this.parsePath(newPath);
    const newName = newParts.pop();
    if (!newName) {
      return PromiseFast.resolve(false);
    }
    const oldParent = oldParts.length > 0 ? this.getNode(oldParts.join("/")) : this.root;
    const newParent = newParts.length > 0 ? this.getNode(newParts.join("/")) : this.root;
    if (!oldParent || !newParent) {
      return PromiseFast.resolve(false);
    }
    const node = oldParent.children?.get(oldName);
    if (!node) {
      return PromiseFast.resolve(false);
    }
    oldParent.children.delete(oldName);
    if (!newParent.children) {
      newParent.children = new Map;
    }
    newParent.children.set(newName, node);
    return PromiseFast.resolve(true);
  }
}
// src/util/Int64.ts
class Int64 {
  low;
  high;
  constructor(low, high = 0) {
    this.low = low >>> 0;
    this.high = high >>> 0;
  }
  static fromNumber(n) {
    if (n >= 0) {
      return new Int64(n >>> 0, n / 4294967296 >>> 0);
    } else {
      const abs = -n;
      const low = ~(abs >>> 0) + 1 >>> 0;
      const high = ~(abs / 4294967296 >>> 0) + (low === 0 ? 1 : 0) >>> 0;
      return new Int64(low, high);
    }
  }
  static fromBigInt(n) {
    return new Int64(Number(n & 0xFFFFFFFFn), Number(n >> 32n & 0xFFFFFFFFn));
  }
  static fromHex(hex2) {
    return Int64.fromBigInt(BigInt(hex2.startsWith("0x") ? hex2 : "0x" + hex2));
  }
  static ZERO = new Int64(0, 0);
  static ONE = new Int64(1, 0);
  static MAX = new Int64(4294967295, 4294967295);
  toNumber() {
    return (this.high >>> 0) * 4294967296 + (this.low >>> 0);
  }
  toSignedNumber() {
    if (this.high & 2147483648) {
      return -new Int64(~this.low + 1, ~this.high + (this.low === 0 ? 1 : 0)).toNumber();
    }
    return this.toNumber();
  }
  toBigInt() {
    return BigInt(this.high >>> 0) << 32n | BigInt(this.low >>> 0);
  }
  toSignedBigInt() {
    const unsigned = this.toBigInt();
    if (this.high & 2147483648) {
      return unsigned - (1n << 64n);
    }
    return unsigned;
  }
  toHex() {
    const highHex = (this.high >>> 0).toString(16).padStart(8, "0");
    const lowHex = (this.low >>> 0).toString(16).padStart(8, "0");
    return "0x" + highHex + lowHex;
  }
  isZero() {
    return this.low === 0 && this.high === 0;
  }
  isNegative() {
    return (this.high & 2147483648) !== 0;
  }
  add(other) {
    const low = (this.low >>> 0) + (other.low >>> 0);
    const carry = low > 4294967295 ? 1 : 0;
    const high = (this.high >>> 0) + (other.high >>> 0) + carry;
    return new Int64(low >>> 0, high >>> 0);
  }
  sub(other) {
    const low = (this.low >>> 0) - (other.low >>> 0);
    const borrow = low < 0 ? 1 : 0;
    const high = (this.high >>> 0) - (other.high >>> 0) - borrow;
    return new Int64(low >>> 0, high >>> 0);
  }
  compare(other) {
    const thisHigh = this.high >>> 0;
    const otherHigh = other.high >>> 0;
    if (thisHigh !== otherHigh) {
      return thisHigh > otherHigh ? 1 : -1;
    }
    const thisLow = this.low >>> 0;
    const otherLow = other.low >>> 0;
    if (thisLow !== otherLow) {
      return thisLow > otherLow ? 1 : -1;
    }
    return 0;
  }
  compareSigned(other) {
    const thisNeg = this.isNegative();
    const otherNeg = other.isNegative();
    if (thisNeg !== otherNeg) {
      return thisNeg ? -1 : 1;
    }
    return this.compare(other);
  }
  lt(other) {
    return this.compare(other) < 0;
  }
  le(other) {
    return this.compare(other) <= 0;
  }
  gt(other) {
    return this.compare(other) > 0;
  }
  ge(other) {
    return this.compare(other) >= 0;
  }
  eq(other) {
    return this.low === other.low && this.high === other.high;
  }
  and(other) {
    return new Int64(this.low & other.low, this.high & other.high);
  }
  or(other) {
    return new Int64(this.low | other.low, this.high | other.high);
  }
  xor(other) {
    return new Int64(this.low ^ other.low, this.high ^ other.high);
  }
  not() {
    return new Int64(~this.low, ~this.high);
  }
  shl(bits2) {
    bits2 = bits2 & 63;
    if (bits2 === 0)
      return this;
    if (bits2 >= 32) {
      return new Int64(0, this.low << bits2 - 32);
    }
    return new Int64(this.low << bits2, this.high << bits2 | this.low >>> 32 - bits2);
  }
  shr(bits2) {
    bits2 = bits2 & 63;
    if (bits2 === 0)
      return this;
    if (bits2 >= 32) {
      return new Int64(this.high >>> bits2 - 32, 0);
    }
    return new Int64(this.low >>> bits2 | this.high << 32 - bits2, this.high >>> bits2);
  }
  sar(bits2) {
    bits2 = bits2 & 63;
    if (bits2 === 0)
      return this;
    if (bits2 >= 32) {
      return new Int64(this.high >> bits2 - 32, this.high >> 31);
    }
    return new Int64(this.low >>> bits2 | this.high << 32 - bits2, this.high >> bits2);
  }
  toString() {
    return this.toBigInt().toString();
  }
}

// src/hle/vfs/FileManager.ts
function parseUri(uri) {
  const colonIdx = uri.indexOf(":");
  if (colonIdx === -1) {
    return { device: "", path: uri, full: uri };
  }
  const device = uri.substring(0, colonIdx);
  let path = uri.substring(colonIdx + 1);
  if (path.startsWith("/")) {
    path = path.substring(1);
  }
  return { device, path, full: uri };
}

class FileHandle {
  uid = 0;
  entry;
  flags;
  device;
  path;
  asyncBusy = false;
  asyncResult = 0;
  constructor(entry, flags, device, path) {
    this.entry = entry;
    this.flags = flags;
    this.device = device;
    this.path = path;
  }
  get isDirectory() {
    return this.entry.isDirectory;
  }
  get position() {
    return this.entry.position;
  }
}

class FileManager {
  devices = new Map;
  handles = new UidCollection;
  _cwd = "ms0:/";
  constructor() {
    this.reset();
  }
  reset() {
    this.devices.clear();
    this.handles.clear();
    this._cwd = "ms0:/";
    this.mount("emu0", new MemoryVfs);
  }
  get cwd() {
    return this._cwd;
  }
  set cwd(path) {
    this._cwd = path;
  }
  mount(device, vfs) {
    this.devices.set(device, vfs);
  }
  unmount(device) {
    return this.devices.delete(device);
  }
  getDevice(device) {
    return this.devices.get(device);
  }
  getMountedDevices() {
    return [...this.devices.keys()];
  }
  resolvePath(path) {
    const parsed = parseUri(path);
    if (!parsed.device) {
      const cwdParsed = parseUri(this._cwd);
      return {
        device: cwdParsed.device,
        path: this.joinPath(cwdParsed.path, parsed.path),
        full: `${cwdParsed.device}:/${this.joinPath(cwdParsed.path, parsed.path)}`
      };
    }
    return parsed;
  }
  joinPath(base, rel) {
    if (rel.startsWith("/")) {
      return rel.substring(1);
    }
    if (!base) {
      return rel;
    }
    if (base.endsWith("/")) {
      return base + rel;
    }
    return base + "/" + rel;
  }
  open(uri, flags, mode = 0) {
    const parsed = this.resolvePath(uri);
    const vfs = this.devices.get(parsed.device);
    if (!vfs) {
      return PromiseFast.resolve({
        handle: null,
        error: SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND
      });
    }
    return vfs.open(parsed.path, flags, mode).then((entry) => {
      if (!entry) {
        return {
          handle: null,
          error: SceKernelErrors.ERROR_ERRNO_FILE_NOT_FOUND
        };
      }
      const handle = new FileHandle(entry, flags, parsed.device, parsed.path);
      handle.uid = this.handles.allocate(handle);
      return { handle, error: SceKernelErrors.ERROR_OK };
    });
  }
  openDir(uri) {
    const parsed = this.resolvePath(uri);
    const vfs = this.devices.get(parsed.device);
    if (!vfs) {
      return PromiseFast.resolve({
        handle: null,
        error: SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND
      });
    }
    return vfs.openDir(parsed.path).then((entry) => {
      if (!entry) {
        return {
          handle: null,
          error: SceKernelErrors.ERROR_ERRNO_FILE_NOT_FOUND
        };
      }
      const handle = new FileHandle(entry, 1 /* Read */, parsed.device, parsed.path);
      handle.uid = this.handles.allocate(handle);
      return { handle, error: SceKernelErrors.ERROR_OK };
    });
  }
  close(uid) {
    const handle = this.handles.get(uid);
    if (!handle) {
      return PromiseFast.resolve(SceKernelErrors.ERROR_KERNEL_UNKNOWN_UID);
    }
    return handle.entry.close().then(() => {
      this.handles.release(uid);
      return SceKernelErrors.ERROR_OK;
    });
  }
  getHandle(uid) {
    return this.handles.get(uid);
  }
  read(uid, size) {
    const handle = this.handles.get(uid);
    if (!handle) {
      return PromiseFast.resolve({
        data: new Uint8Array(0),
        error: SceKernelErrors.ERROR_KERNEL_UNKNOWN_UID
      });
    }
    if (!(handle.flags & 1 /* Read */)) {
      return PromiseFast.resolve({
        data: new Uint8Array(0),
        error: SceKernelErrors.ERROR_ERRNO_INVALID_ARGUMENT
      });
    }
    return handle.entry.read(size).then((data) => ({
      data,
      error: SceKernelErrors.ERROR_OK
    }));
  }
  write(uid, data) {
    const handle = this.handles.get(uid);
    if (!handle) {
      return PromiseFast.resolve({
        written: 0,
        error: SceKernelErrors.ERROR_KERNEL_UNKNOWN_UID
      });
    }
    if (!(handle.flags & 2 /* Write */)) {
      return PromiseFast.resolve({
        written: 0,
        error: SceKernelErrors.ERROR_ERRNO_INVALID_ARGUMENT
      });
    }
    return handle.entry.write(data).then((written) => ({
      written,
      error: SceKernelErrors.ERROR_OK
    }));
  }
  seek(uid, offset, mode) {
    const handle = this.handles.get(uid);
    if (!handle) {
      return PromiseFast.resolve({
        position: Int64.ZERO,
        error: SceKernelErrors.ERROR_KERNEL_UNKNOWN_UID
      });
    }
    return handle.entry.seek(offset, mode).then((pos) => ({
      position: Int64.fromNumber(pos),
      error: SceKernelErrors.ERROR_OK
    }));
  }
  stat(uri) {
    const parsed = this.resolvePath(uri);
    const vfs = this.devices.get(parsed.device);
    if (!vfs) {
      return PromiseFast.resolve({
        stat: null,
        error: SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND
      });
    }
    return vfs.stat(parsed.path).then((stat) => {
      if (!stat) {
        return {
          stat: null,
          error: SceKernelErrors.ERROR_ERRNO_FILE_NOT_FOUND
        };
      }
      return { stat, error: SceKernelErrors.ERROR_OK };
    });
  }
  mkdir(uri) {
    const parsed = this.resolvePath(uri);
    const vfs = this.devices.get(parsed.device);
    if (!vfs) {
      return PromiseFast.resolve(SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND);
    }
    return vfs.mkdir(parsed.path).then((success) => success ? SceKernelErrors.ERROR_OK : SceKernelErrors.ERROR_ERRNO_FILE_EXISTS);
  }
  remove(uri) {
    const parsed = this.resolvePath(uri);
    const vfs = this.devices.get(parsed.device);
    if (!vfs) {
      return PromiseFast.resolve(SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND);
    }
    return vfs.remove(parsed.path).then((success) => success ? SceKernelErrors.ERROR_OK : SceKernelErrors.ERROR_ERRNO_FILE_NOT_FOUND);
  }
  rmdir(uri) {
    const parsed = this.resolvePath(uri);
    const vfs = this.devices.get(parsed.device);
    if (!vfs) {
      return PromiseFast.resolve(SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND);
    }
    return vfs.rmdir(parsed.path).then((success) => success ? SceKernelErrors.ERROR_OK : SceKernelErrors.ERROR_ERRNO_FILE_NOT_FOUND);
  }
  rename(oldUri, newUri) {
    const oldParsed = this.resolvePath(oldUri);
    const newParsed = this.resolvePath(newUri);
    if (oldParsed.device !== newParsed.device) {
      return PromiseFast.resolve(SceKernelErrors.ERROR_ERRNO_INVALID_ARGUMENT);
    }
    const vfs = this.devices.get(oldParsed.device);
    if (!vfs) {
      return PromiseFast.resolve(SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND);
    }
    return vfs.rename(oldParsed.path, newParsed.path).then((success) => success ? SceKernelErrors.ERROR_OK : SceKernelErrors.ERROR_ERRNO_FILE_NOT_FOUND);
  }
  readDir(uid) {
    const handle = this.handles.get(uid);
    if (!handle) {
      return PromiseFast.resolve({
        entries: [],
        error: SceKernelErrors.ERROR_KERNEL_UNKNOWN_UID
      });
    }
    if (!handle.isDirectory) {
      return PromiseFast.resolve({
        entries: [],
        error: SceKernelErrors.ERROR_ERRNO_IS_DIRECTORY
      });
    }
    return handle.entry.readDir().then((entries) => ({
      entries,
      error: SceKernelErrors.ERROR_OK
    }));
  }
  get handleCount() {
    return this.handles.size;
  }
}
// src/util/Result.ts
function Ok(value) {
  return { ok: true, value };
}
function Err(error) {
  return { ok: false, error };
}
function match(result, onOk, onErr) {
  return result.ok ? onOk(result.value) : onErr(result.error);
}
function fromNullable(value, error) {
  return value != null ? Ok(value) : Err(error);
}

// src/hle/module/SysMemUserForUser.ts
var ALLOC_TYPE_MAP = {
  0: 0 /* Low */,
  1: 1 /* High */,
  2: 2 /* Address */
};

class SysMemUserForUser {
  name = "SysMemUserForUser";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceKernelAllocPartitionMemory() {
    const partition = this.ctx.arg(0);
    const namePtr = this.ctx.argPtr(1);
    const type = this.ctx.arg(2);
    const size = this.ctx.arg(3);
    const addr = this.ctx.arg(4);
    const name = namePtr ? this.ctx.readString(namePtr) : "unknown";
    const anchor = ALLOC_TYPE_MAP[type];
    if (anchor === undefined) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_MEMBLOCK_ALLOC_TYPE;
    }
    const { block, error } = this.ctx.memoryManager.allocate(partition, size, anchor, addr, 1, name);
    if (!block) {
      return error;
    }
    return block.id;
  }
  sceKernelFreePartitionMemory() {
    const blockId = this.ctx.arg(0);
    return match(fromNullable(this.ctx.memoryManager.findByAddress(blockId), SceKernelErrors.ERROR_KERNEL_ILLEGAL_CHUNK_ID), (block) => this.ctx.memoryManager.free(block), (error) => error);
  }
  sceKernelGetBlockHeadAddr() {
    const blockId = this.ctx.arg(0);
    return match(fromNullable(this.ctx.memoryManager.findByAddress(blockId), 0), (block) => block.address, () => 0);
  }
  sceKernelTotalFreeMemSize() {
    return this.ctx.memoryManager.getFreeMemory(3 /* User */);
  }
  sceKernelMaxFreeMemSize() {
    return this.ctx.memoryManager.getMaxFreeBlock(3 /* User */);
  }
  sceKernelDevkitVersion() {
    return 101056528;
  }
  sceKernelSetCompiledSdkVersion() {
    return 0;
  }
  sceKernelSetCompilerVersion() {
    return 0;
  }
}
__legacyDecorateClassTS([
  nativeFunction(595443023, 150)
], SysMemUserForUser.prototype, "sceKernelAllocPartitionMemory", null);
__legacyDecorateClassTS([
  nativeFunction(3067485442, 150)
], SysMemUserForUser.prototype, "sceKernelFreePartitionMemory", null);
__legacyDecorateClassTS([
  nativeFunction(2644138913, 150)
], SysMemUserForUser.prototype, "sceKernelGetBlockHeadAddr", null);
__legacyDecorateClassTS([
  nativeFunction(4179228200, 150)
], SysMemUserForUser.prototype, "sceKernelTotalFreeMemSize", null);
__legacyDecorateClassTS([
  nativeFunction(2727473415, 150)
], SysMemUserForUser.prototype, "sceKernelMaxFreeMemSize", null);
__legacyDecorateClassTS([
  nativeFunction(1070181994, 150)
], SysMemUserForUser.prototype, "sceKernelDevkitVersion", null);
__legacyDecorateClassTS([
  nativeFunction(1972488155, 150)
], SysMemUserForUser.prototype, "sceKernelSetCompiledSdkVersion", null);
__legacyDecorateClassTS([
  nativeFunction(4152195019, 150)
], SysMemUserForUser.prototype, "sceKernelSetCompilerVersion", null);
SysMemUserForUser = __legacyDecorateClassTS([
  hleModule("SysMemUserForUser")
], SysMemUserForUser);
// src/hle/module/ThreadManForUser.ts
class ThreadManForUser {
  name = "ThreadManForUser";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceKernelCreateThread() {
    const namePtr = this.ctx.argPtr(0);
    const entry = this.ctx.arg(1);
    const priority = this.ctx.arg(2);
    const stackSize = this.ctx.arg(3);
    const attr = this.ctx.arg(4);
    const name = this.ctx.readString(namePtr);
    const { thread, error } = this.ctx.threadManager.createThread(name, entry, priority, stackSize, attr);
    if (!thread) {
      return error;
    }
    this.ctx.log(`Created thread "${name}" uid=${thread.uid} entry=0x${entry.toString(16)}`);
    return thread.uid;
  }
  sceKernelDeleteThread() {
    const thid = this.ctx.arg(0);
    return this.ctx.threadManager.deleteThread(thid);
  }
  sceKernelStartThread() {
    const thid = this.ctx.arg(0);
    const arglen = this.ctx.arg(1);
    const argp = this.ctx.arg(2);
    return this.ctx.threadManager.startThread(thid, arglen, argp);
  }
  sceKernelExitThread() {
    const status = this.ctx.arg(0);
    return this.ctx.threadManager.exitThread(status);
  }
  sceKernelExitDeleteThread() {
    const status = this.ctx.arg(0);
    return this.ctx.threadManager.exitDeleteThread(status);
  }
  sceKernelTerminateThread() {
    const thid = this.ctx.arg(0);
    return match(fromNullable(this.ctx.threadManager.getThread(thid), SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD), (thread) => {
      thread.status = 16 /* DORMANT */;
      thread.exitStatus = 2147615140;
      return 0;
    }, (error) => error);
  }
  sceKernelSuspendThread() {
    const thid = this.ctx.arg(0);
    return this.ctx.threadManager.suspendThread(thid);
  }
  sceKernelResumeThread() {
    const thid = this.ctx.arg(0);
    return this.ctx.threadManager.resumeThread(thid);
  }
  sceKernelGetThreadId() {
    return match(fromNullable(this.ctx.threadManager.getCurrentThread(), SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD), (thread) => thread.uid, (error) => error);
  }
  sceKernelGetThreadCurrentPriority() {
    const thread = this.ctx.threadManager.getCurrentThread();
    return thread?.priority ?? 0;
  }
  sceKernelChangeThreadPriority() {
    const thid = this.ctx.arg(0);
    const priority = this.ctx.arg(1);
    return this.ctx.threadManager.changeThreadPriority(thid, priority);
  }
  sceKernelRotateThreadReadyQueue() {
    const priority = this.ctx.arg(0);
    return this.ctx.threadManager.rotateThreadReadyQueue(priority);
  }
  sceKernelDelayThread() {
    const delay = this.ctx.arg(0);
    return this.ctx.threadManager.delayThread(delay).toPromise();
  }
  sceKernelDelayThreadCB() {
    const delay = this.ctx.arg(0);
    const thread = this.ctx.threadManager.getCurrentThread();
    if (thread) {
      thread.callbackAccepting = true;
    }
    return this.ctx.threadManager.delayThread(delay).toPromise();
  }
  sceKernelSleepThread() {
    return this.ctx.threadManager.sleepThread().toPromise();
  }
  sceKernelSleepThreadCB() {
    const thread = this.ctx.threadManager.getCurrentThread();
    if (thread) {
      thread.callbackAccepting = true;
    }
    return this.ctx.threadManager.sleepThread().toPromise();
  }
  sceKernelWakeupThread() {
    const thid = this.ctx.arg(0);
    return this.ctx.threadManager.wakeupThread(thid);
  }
  sceKernelCreateCallback() {
    const namePtr = this.ctx.argPtr(0);
    const func = this.ctx.arg(1);
    const arg = this.ctx.arg(2);
    const name = this.ctx.readString(namePtr);
    const threadUid = this.ctx.threadManager.getCurrentThread()?.uid ?? 0;
    const { callback, error } = this.ctx.callbackManager.createCallback(name, threadUid, func, arg);
    if (!callback) {
      return error;
    }
    return callback.uid;
  }
  sceKernelDeleteCallback() {
    const cbid = this.ctx.arg(0);
    return this.ctx.callbackManager.deleteCallback(cbid);
  }
  sceKernelNotifyCallback() {
    const cbid = this.ctx.arg(0);
    const arg = this.ctx.arg(1);
    return this.ctx.callbackManager.notifyCallback(cbid, arg);
  }
  sceKernelCancelCallback() {
    const cbid = this.ctx.arg(0);
    return this.ctx.callbackManager.cancelCallback(cbid);
  }
  sceKernelCheckCallback() {
    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread) {
      return 0;
    }
    return this.ctx.callbackManager.getPendingCallbacks(thread.uid).length;
  }
  sceKernelCreateSema() {
    const namePtr = this.ctx.argPtr(0);
    const attr = this.ctx.arg(1);
    const initCount = this.ctx.arg(2);
    const maxCount = this.ctx.arg(3);
    const name = this.ctx.readString(namePtr);
    const { semaphore, error } = this.ctx.syncManager.createSemaphore(name, attr, initCount, maxCount);
    if (!semaphore) {
      return error;
    }
    this.ctx.log(`Created semaphore "${name}" uid=${semaphore.uid} init=${initCount} max=${maxCount}`);
    return semaphore.uid;
  }
  sceKernelDeleteSema() {
    const semaId = this.ctx.arg(0);
    return this.ctx.syncManager.deleteSemaphore(semaId);
  }
  sceKernelSignalSema() {
    const semaId = this.ctx.arg(0);
    const signal = this.ctx.arg(1);
    return match(fromNullable(this.ctx.syncManager.getSemaphore(semaId), SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE), (sema) => sema.signal(signal), (error) => error);
  }
  sceKernelWaitSema() {
    const semaId = this.ctx.arg(0);
    const signal = this.ctx.arg(1);
    const timeoutPtr = this.ctx.argPtr(2);
    const sema = this.ctx.syncManager.getSemaphore(semaId);
    if (!sema) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE;
    }
    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }
    const timeout = timeoutPtr ? this.ctx.read32(timeoutPtr) : 0;
    const result = sema.wait(signal, thread, timeout);
    if (typeof result === "number") {
      return result;
    }
    return result.toPromise();
  }
  sceKernelWaitSemaCB() {
    const thread = this.ctx.threadManager.getCurrentThread();
    if (thread) {
      thread.callbackAccepting = true;
    }
    return this.sceKernelWaitSema();
  }
  sceKernelPollSema() {
    const semaId = this.ctx.arg(0);
    const signal = this.ctx.arg(1);
    return match(fromNullable(this.ctx.syncManager.getSemaphore(semaId), SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE), (sema) => sema.poll(signal), (error) => error);
  }
  sceKernelReferSemaStatus() {
    const semaId = this.ctx.arg(0);
    const infoPtr = this.ctx.argPtr(1);
    const info = this.ctx.syncManager.getSemaphoreInfo(semaId);
    if (!info) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE;
    }
    this.ctx.write32(infoPtr + 0, info.size);
    this.ctx.writeString(infoPtr + 4, info.name);
    this.ctx.write32(infoPtr + 36, info.attr);
    this.ctx.write32(infoPtr + 40, info.initCount);
    this.ctx.write32(infoPtr + 44, info.currentCount);
    this.ctx.write32(infoPtr + 48, info.maxCount);
    this.ctx.write32(infoPtr + 52, info.numWaitThreads);
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelCreateMutex() {
    const namePtr = this.ctx.argPtr(0);
    const attr = this.ctx.arg(1);
    const initCount = this.ctx.arg(2);
    const name = this.ctx.readString(namePtr);
    const { mutex, error } = this.ctx.syncManager.createMutex(name, attr, initCount);
    if (!mutex) {
      return error;
    }
    this.ctx.log(`Created mutex "${name}" uid=${mutex.uid} attr=0x${attr.toString(16)}`);
    return mutex.uid;
  }
  sceKernelDeleteMutex() {
    const mutexId = this.ctx.arg(0);
    return this.ctx.syncManager.deleteMutex(mutexId);
  }
  sceKernelLockMutex() {
    const mutexId = this.ctx.arg(0);
    const lockCount = this.ctx.arg(1);
    const timeoutPtr = this.ctx.argPtr(2);
    const mutex = this.ctx.syncManager.getMutex(mutexId);
    if (!mutex) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE;
    }
    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }
    const timeout = timeoutPtr ? this.ctx.read32(timeoutPtr) : 0;
    const result = mutex.lock(thread, timeout);
    if (typeof result === "number") {
      return result;
    }
    return result.toPromise();
  }
  sceKernelLockMutexCB() {
    const thread = this.ctx.threadManager.getCurrentThread();
    if (thread) {
      thread.callbackAccepting = true;
    }
    return this.sceKernelLockMutex();
  }
  sceKernelTryLockMutex() {
    const mutexId = this.ctx.arg(0);
    const mutex = this.ctx.syncManager.getMutex(mutexId);
    if (!mutex) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE;
    }
    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }
    return mutex.tryLock(thread);
  }
  sceKernelUnlockMutex() {
    const mutexId = this.ctx.arg(0);
    const mutex = this.ctx.syncManager.getMutex(mutexId);
    if (!mutex) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE;
    }
    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }
    return mutex.unlock(thread);
  }
  sceKernelCreateEventFlag() {
    const namePtr = this.ctx.argPtr(0);
    const attr = this.ctx.arg(1);
    const initPattern = this.ctx.arg(2);
    const name = this.ctx.readString(namePtr);
    const { eventFlag, error } = this.ctx.syncManager.createEventFlag(name, attr, initPattern);
    if (!eventFlag) {
      return error;
    }
    this.ctx.log(`Created event flag "${name}" uid=${eventFlag.uid} pattern=0x${initPattern.toString(16)}`);
    return eventFlag.uid;
  }
  sceKernelDeleteEventFlag() {
    const evid = this.ctx.arg(0);
    return this.ctx.syncManager.deleteEventFlag(evid);
  }
  sceKernelSetEventFlag() {
    const evid = this.ctx.arg(0);
    const bits2 = this.ctx.arg(1);
    return match(fromNullable(this.ctx.syncManager.getEventFlag(evid), SceKernelErrors.ERROR_KERNEL_NOT_FOUND_EVENT_FLAG), (ef) => {
      ef.set(bits2);
      return SceKernelErrors.ERROR_OK;
    }, (error) => error);
  }
  sceKernelClearEventFlag() {
    const evid = this.ctx.arg(0);
    const bits2 = this.ctx.arg(1);
    return match(fromNullable(this.ctx.syncManager.getEventFlag(evid), SceKernelErrors.ERROR_KERNEL_NOT_FOUND_EVENT_FLAG), (ef) => {
      ef.clear(~bits2 >>> 0);
      return SceKernelErrors.ERROR_OK;
    }, (error) => error);
  }
  sceKernelWaitEventFlag() {
    const evid = this.ctx.arg(0);
    const bits2 = this.ctx.arg(1);
    const wait = this.ctx.arg(2);
    const outBitsPtr = this.ctx.argPtr(3);
    const timeoutPtr = this.ctx.argPtr(4);
    const ef = this.ctx.syncManager.getEventFlag(evid);
    if (!ef) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_EVENT_FLAG;
    }
    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }
    const timeout = timeoutPtr ? this.ctx.read32(timeoutPtr) : 0;
    const result = ef.wait(bits2, wait, thread, timeout);
    const handleResult = (matched) => {
      if (outBitsPtr) {
        this.ctx.write32(outBitsPtr, matched);
      }
      return SceKernelErrors.ERROR_OK;
    };
    if (typeof result === "number") {
      return handleResult(result);
    }
    return result.then(handleResult).toPromise();
  }
  sceKernelWaitEventFlagCB() {
    const thread = this.ctx.threadManager.getCurrentThread();
    if (thread) {
      thread.callbackAccepting = true;
    }
    return this.sceKernelWaitEventFlag();
  }
  sceKernelPollEventFlag() {
    const evid = this.ctx.arg(0);
    const bits2 = this.ctx.arg(1);
    const wait = this.ctx.arg(2);
    const outBitsPtr = this.ctx.argPtr(3);
    const ef = this.ctx.syncManager.getEventFlag(evid);
    if (!ef) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_EVENT_FLAG;
    }
    const { success, pattern } = ef.poll(bits2, wait);
    if (outBitsPtr) {
      this.ctx.write32(outBitsPtr, pattern);
    }
    if (!success) {
      return SceKernelErrors.ERROR_KERNEL_EVENT_FLAG_POLL_FAILED;
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelCancelEventFlag() {
    const evid = this.ctx.arg(0);
    const newPattern = this.ctx.arg(1);
    const numWaitPtr = this.ctx.argPtr(2);
    return match(fromNullable(this.ctx.syncManager.getEventFlag(evid), SceKernelErrors.ERROR_KERNEL_NOT_FOUND_EVENT_FLAG), (ef) => {
      const numCancelled = ef.cancelAll();
      if (numWaitPtr) {
        this.ctx.write32(numWaitPtr, numCancelled);
      }
      ef.clear(4294967295);
      ef.set(newPattern);
      return SceKernelErrors.ERROR_OK;
    }, (error) => error);
  }
}
__legacyDecorateClassTS([
  nativeFunction(1148030438, 150)
], ThreadManForUser.prototype, "sceKernelCreateThread", null);
__legacyDecorateClassTS([
  nativeFunction(2678078675, 150)
], ThreadManForUser.prototype, "sceKernelDeleteThread", null);
__legacyDecorateClassTS([
  nativeFunction(4101342301, 150)
], ThreadManForUser.prototype, "sceKernelStartThread", null);
__legacyDecorateClassTS([
  nativeFunction(2859714869, 150)
], ThreadManForUser.prototype, "sceKernelExitThread", null);
__legacyDecorateClassTS([
  nativeFunction(2157765275, 150)
], ThreadManForUser.prototype, "sceKernelExitDeleteThread", null);
__legacyDecorateClassTS([
  nativeFunction(1633944506, 150)
], ThreadManForUser.prototype, "sceKernelTerminateThread", null);
__legacyDecorateClassTS([
  nativeFunction(2571432735, 150)
], ThreadManForUser.prototype, "sceKernelSuspendThread", null);
__legacyDecorateClassTS([
  nativeFunction(1964338831, 150)
], ThreadManForUser.prototype, "sceKernelResumeThread", null);
__legacyDecorateClassTS([
  nativeFunction(691750328, 150)
], ThreadManForUser.prototype, "sceKernelGetThreadId", null);
__legacyDecorateClassTS([
  nativeFunction(2494194158, 150)
], ThreadManForUser.prototype, "sceKernelGetThreadCurrentPriority", null);
__legacyDecorateClassTS([
  nativeFunction(1908185201, 150)
], ThreadManForUser.prototype, "sceKernelChangeThreadPriority", null);
__legacyDecorateClassTS([
  nativeFunction(2435011751, 150)
], ThreadManForUser.prototype, "sceKernelRotateThreadReadyQueue", null);
__legacyDecorateClassTS([
  nativeFunction(3467504455, 150)
], ThreadManForUser.prototype, "sceKernelDelayThread", null);
__legacyDecorateClassTS([
  nativeFunction(1759157814, 150)
], ThreadManForUser.prototype, "sceKernelDelayThreadCB", null);
__legacyDecorateClassTS([
  nativeFunction(2597196574, 150)
], ThreadManForUser.prototype, "sceKernelSleepThread", null);
__legacyDecorateClassTS([
  nativeFunction(2189586288, 150)
], ThreadManForUser.prototype, "sceKernelSleepThreadCB", null);
__legacyDecorateClassTS([
  nativeFunction(3583946031, 150)
], ThreadManForUser.prototype, "sceKernelWakeupThread", null);
__legacyDecorateClassTS([
  nativeFunction(3894194063, 150)
], ThreadManForUser.prototype, "sceKernelCreateCallback", null);
__legacyDecorateClassTS([
  nativeFunction(3988412484, 150)
], ThreadManForUser.prototype, "sceKernelDeleteCallback", null);
__legacyDecorateClassTS([
  nativeFunction(3239815364, 150)
], ThreadManForUser.prototype, "sceKernelNotifyCallback", null);
__legacyDecorateClassTS([
  nativeFunction(3124777430, 150)
], ThreadManForUser.prototype, "sceKernelCancelCallback", null);
__legacyDecorateClassTS([
  nativeFunction(882732396, 150)
], ThreadManForUser.prototype, "sceKernelCheckCallback", null);
__legacyDecorateClassTS([
  nativeFunction(3604630433, 150)
], ThreadManForUser.prototype, "sceKernelCreateSema", null);
__legacyDecorateClassTS([
  nativeFunction(683034780, 150)
], ThreadManForUser.prototype, "sceKernelDeleteSema", null);
__legacyDecorateClassTS([
  nativeFunction(1062463040, 150)
], ThreadManForUser.prototype, "sceKernelSignalSema", null);
__legacyDecorateClassTS([
  nativeFunction(1312428293, 150)
], ThreadManForUser.prototype, "sceKernelWaitSema", null);
__legacyDecorateClassTS([
  nativeFunction(1830890412, 150)
], ThreadManForUser.prototype, "sceKernelWaitSemaCB", null);
__legacyDecorateClassTS([
  nativeFunction(1488058679, 150)
], ThreadManForUser.prototype, "sceKernelPollSema", null);
__legacyDecorateClassTS([
  nativeFunction(3161451461, 150)
], ThreadManForUser.prototype, "sceKernelReferSemaStatus", null);
__legacyDecorateClassTS([
  nativeFunction(3083901126, 150)
], ThreadManForUser.prototype, "sceKernelCreateMutex", null);
__legacyDecorateClassTS([
  nativeFunction(4162260926, 150)
], ThreadManForUser.prototype, "sceKernelDeleteMutex", null);
__legacyDecorateClassTS([
  nativeFunction(2953949471, 150)
], ThreadManForUser.prototype, "sceKernelLockMutex", null);
__legacyDecorateClassTS([
  nativeFunction(1542774055, 150)
], ThreadManForUser.prototype, "sceKernelLockMutexCB", null);
__legacyDecorateClassTS([
  nativeFunction(232575689, 150)
], ThreadManForUser.prototype, "sceKernelTryLockMutex", null);
__legacyDecorateClassTS([
  nativeFunction(1798311951, 150)
], ThreadManForUser.prototype, "sceKernelUnlockMutex", null);
__legacyDecorateClassTS([
  nativeFunction(1438779904, 150)
], ThreadManForUser.prototype, "sceKernelCreateEventFlag", null);
__legacyDecorateClassTS([
  nativeFunction(4020128880, 150)
], ThreadManForUser.prototype, "sceKernelDeleteEventFlag", null);
__legacyDecorateClassTS([
  nativeFunction(531716658, 150)
], ThreadManForUser.prototype, "sceKernelSetEventFlag", null);
__legacyDecorateClassTS([
  nativeFunction(2166572772, 150)
], ThreadManForUser.prototype, "sceKernelClearEventFlag", null);
__legacyDecorateClassTS([
  nativeFunction(1076875042, 150)
], ThreadManForUser.prototype, "sceKernelWaitEventFlag", null);
__legacyDecorateClassTS([
  nativeFunction(848057450, 150)
], ThreadManForUser.prototype, "sceKernelWaitEventFlagCB", null);
__legacyDecorateClassTS([
  nativeFunction(821905648, 150)
], ThreadManForUser.prototype, "sceKernelPollEventFlag", null);
__legacyDecorateClassTS([
  nativeFunction(3441439378, 150)
], ThreadManForUser.prototype, "sceKernelCancelEventFlag", null);
ThreadManForUser = __legacyDecorateClassTS([
  hleModule("ThreadManForUser")
], ThreadManForUser);
// src/util/BitFlags.ts
class BitFlags {
  value;
  constructor(value = 0) {
    this.value = value;
  }
  has(flag) {
    return (this.value & flag) !== 0;
  }
  hasAll(...flags) {
    for (const flag of flags) {
      if ((this.value & flag) === 0)
        return false;
    }
    return true;
  }
  hasAny(...flags) {
    for (const flag of flags) {
      if ((this.value & flag) !== 0)
        return true;
    }
    return false;
  }
  set(flag) {
    this.value |= flag;
    return this;
  }
  setAll(...flags) {
    for (const flag of flags) {
      this.value |= flag;
    }
    return this;
  }
  clear(flag) {
    this.value &= ~flag;
    return this;
  }
  clearAll(...flags) {
    for (const flag of flags) {
      this.value &= ~flag;
    }
    return this;
  }
  toggle(flag) {
    this.value ^= flag;
    return this;
  }
  setTo(flag, state) {
    if (state) {
      this.value |= flag;
    } else {
      this.value &= ~flag;
    }
    return this;
  }
  toNumber() {
    return this.value;
  }
  static from(value) {
    return new BitFlags(value);
  }
  static map(sourceValue, mapping) {
    const result = new BitFlags;
    for (const [src, dst] of mapping) {
      if ((sourceValue & src) !== 0) {
        result.set(dst);
      }
    }
    return result;
  }
  static mapWith(sourceValue, mapping, transform) {
    const result = new BitFlags;
    for (const [src, dst] of mapping) {
      if ((sourceValue & src) !== 0) {
        result.set(transform ? transform(src, dst) : dst);
      }
    }
    return result;
  }
  static extract(value, offset, width) {
    const mask = (1 << width) - 1;
    return value >>> offset & mask;
  }
  static insert(value, bits2, offset, width) {
    const mask = (1 << width) - 1;
    const cleared = value & ~(mask << offset);
    return cleared | (bits2 & mask) << offset;
  }
  static popcount(value) {
    let count = 0;
    while (value) {
      count += value & 1;
      value >>>= 1;
    }
    return count;
  }
  static ffs(value) {
    if (value === 0)
      return 0;
    let pos = 1;
    while ((value & 1) === 0) {
      value >>>= 1;
      pos++;
    }
    return pos;
  }
  static fls(value) {
    if (value === 0)
      return 0;
    let pos = 32;
    while ((value & 2147483648) === 0) {
      value <<= 1;
      pos--;
    }
    return pos;
  }
}

// src/hle/module/IoFileMgrForUser.ts
var OPEN_FLAGS_MAP = [
  [1 /* Read */, 1 /* Read */],
  [2 /* Write */, 2 /* Write */],
  [256 /* Append */, 256 /* Append */],
  [512 /* Create */, 512 /* Create */],
  [1024 /* Truncate */, 1024 /* Truncate */],
  [2048 /* Exclusive */, 2048 /* Exclusive */]
];
var SEEK_MODE_MAP = {
  0: 0 /* Set */,
  1: 1 /* Current */,
  2: 2 /* End */
};

class IoFileMgrForUser {
  name = "IoFileMgrForUser";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceIoOpen() {
    const filePtr = this.ctx.argPtr(0);
    const pspFlags = this.ctx.arg(1);
    const mode = this.ctx.arg(2);
    const file = this.ctx.readString(filePtr);
    this.ctx.log(`sceIoOpen("${file}", 0x${pspFlags.toString(16)}, 0x${mode.toString(16)})`);
    const openFlags = BitFlags.map(pspFlags, OPEN_FLAGS_MAP).value;
    return this.ctx.fileManager.open(file, openFlags, mode).then((result) => {
      if (!result.handle) {
        return result.error;
      }
      return result.handle.uid;
    }).toPromise();
  }
  sceIoOpenAsync() {
    return this.sceIoOpen();
  }
  sceIoClose() {
    const fd = this.ctx.arg(0);
    return this.ctx.fileManager.close(fd).toPromise();
  }
  sceIoCloseAsync() {
    return this.sceIoClose();
  }
  sceIoRead() {
    const fd = this.ctx.arg(0);
    const dataPtr = this.ctx.argPtr(1);
    const size = this.ctx.arg(2);
    return this.ctx.fileManager.read(fd, size).then((result) => {
      if (result.error !== SceKernelErrors.ERROR_OK) {
        return result.error;
      }
      for (let i = 0;i < result.data.length; i++) {
        this.ctx.write8(dataPtr + i, result.data[i]);
      }
      return result.data.length;
    }).toPromise();
  }
  sceIoReadAsync() {
    return this.sceIoRead();
  }
  sceIoWrite() {
    const fd = this.ctx.arg(0);
    const dataPtr = this.ctx.argPtr(1);
    const size = this.ctx.arg(2);
    const data = new Uint8Array(size);
    for (let i = 0;i < size; i++) {
      data[i] = this.ctx.read8(dataPtr + i);
    }
    if (fd === 1 || fd === 2) {
      const text = new TextDecoder().decode(data);
      if (fd === 1) {
        console.log("[PSP stdout]", text);
      } else {
        console.error("[PSP stderr]", text);
      }
      return size;
    }
    return this.ctx.fileManager.write(fd, data).then((result) => {
      if (result.error !== SceKernelErrors.ERROR_OK) {
        return result.error;
      }
      return result.written;
    }).toPromise();
  }
  sceIoWriteAsync() {
    return this.sceIoWrite();
  }
  sceIoLseek() {
    const fd = this.ctx.arg(0);
    const offsetLow = this.ctx.arg(2);
    const whence = this.ctx.arg(4);
    const offset = offsetLow;
    const mode = SEEK_MODE_MAP[whence];
    if (mode === undefined) {
      return SceKernelErrors.ERROR_ERRNO_INVALID_ARGUMENT;
    }
    return this.ctx.fileManager.seek(fd, offset, mode).then((result) => {
      if (result.error !== SceKernelErrors.ERROR_OK) {
        return result.error;
      }
      this.ctx.setReturnValue64(result.position.low, result.position.high);
      return result.position.low;
    }).toPromise();
  }
  sceIoLseek32() {
    const fd = this.ctx.arg(0);
    const offset = this.ctx.arg(1);
    const whence = this.ctx.arg(2);
    const mode = SEEK_MODE_MAP[whence];
    if (mode === undefined) {
      return SceKernelErrors.ERROR_ERRNO_INVALID_ARGUMENT;
    }
    return this.ctx.fileManager.seek(fd, offset, mode).then((result) => {
      if (result.error !== SceKernelErrors.ERROR_OK) {
        return result.error;
      }
      return result.position.low;
    }).toPromise();
  }
  sceIoDopen() {
    const dirnamePtr = this.ctx.argPtr(0);
    const dirname = this.ctx.readString(dirnamePtr);
    return this.ctx.fileManager.openDir(dirname).then((result) => {
      if (!result.handle) {
        return result.error;
      }
      return result.handle.uid;
    }).toPromise();
  }
  sceIoDclose() {
    const fd = this.ctx.arg(0);
    return this.ctx.fileManager.close(fd).toPromise();
  }
  sceIoDread() {
    const fd = this.ctx.arg(0);
    const dirPtr = this.ctx.argPtr(1);
    const handle = this.ctx.fileManager.getHandle(fd);
    if (!handle) {
      return SceKernelErrors.ERROR_KERNEL_UNKNOWN_UID;
    }
    return handle.entry.readDir().then((entries) => {
      if (entries.length === 0) {
        return 0;
      }
      const entry = entries[0];
      const stat = entry.stat;
      this.ctx.write32(dirPtr + 0, stat.mode);
      this.ctx.write32(dirPtr + 4, 0);
      this.ctx.write32(dirPtr + 8, stat.size);
      this.ctx.write32(dirPtr + 12, 0);
      const nameOffset = 88;
      const name = entry.name;
      for (let i = 0;i < name.length && i < 255; i++) {
        this.ctx.write8(dirPtr + nameOffset + i, name.charCodeAt(i));
      }
      this.ctx.write8(dirPtr + nameOffset + name.length, 0);
      return 1;
    }).toPromise();
  }
  sceIoGetstat() {
    const filePtr = this.ctx.argPtr(0);
    const statPtr = this.ctx.argPtr(1);
    const file = this.ctx.readString(filePtr);
    return this.ctx.fileManager.stat(file).then((result) => {
      if (!result.stat) {
        return result.error;
      }
      const stat = result.stat;
      this.ctx.write32(statPtr + 0, stat.mode);
      this.ctx.write32(statPtr + 4, 0);
      this.ctx.write32(statPtr + 8, stat.size);
      this.ctx.write32(statPtr + 12, 0);
      return SceKernelErrors.ERROR_OK;
    }).toPromise();
  }
  sceIoMkdir() {
    const dirPtr = this.ctx.argPtr(0);
    const dir = this.ctx.readString(dirPtr);
    return this.ctx.fileManager.mkdir(dir).toPromise();
  }
  sceIoRmdir() {
    const pathPtr = this.ctx.argPtr(0);
    const path = this.ctx.readString(pathPtr);
    return this.ctx.fileManager.rmdir(path).toPromise();
  }
  sceIoRemove() {
    const filePtr = this.ctx.argPtr(0);
    const file = this.ctx.readString(filePtr);
    return this.ctx.fileManager.remove(file).toPromise();
  }
  sceIoRename() {
    const oldnamePtr = this.ctx.argPtr(0);
    const newnamePtr = this.ctx.argPtr(1);
    const oldname = this.ctx.readString(oldnamePtr);
    const newname = this.ctx.readString(newnamePtr);
    return this.ctx.fileManager.rename(oldname, newname).toPromise();
  }
  sceIoChdir() {
    const pathPtr = this.ctx.argPtr(0);
    const path = this.ctx.readString(pathPtr);
    this.ctx.fileManager.cwd = path;
    return 0;
  }
}
__legacyDecorateClassTS([
  nativeFunction(278876348, 150)
], IoFileMgrForUser.prototype, "sceIoOpen", null);
__legacyDecorateClassTS([
  nativeFunction(2309658886, 150)
], IoFileMgrForUser.prototype, "sceIoOpenAsync", null);
__legacyDecorateClassTS([
  nativeFunction(2165066691, 150)
], IoFileMgrForUser.prototype, "sceIoClose", null);
__legacyDecorateClassTS([
  nativeFunction(4284039350, 150)
], IoFileMgrForUser.prototype, "sceIoCloseAsync", null);
__legacyDecorateClassTS([
  nativeFunction(1784909187, 150)
], IoFileMgrForUser.prototype, "sceIoRead", null);
__legacyDecorateClassTS([
  nativeFunction(2696259522, 150)
], IoFileMgrForUser.prototype, "sceIoReadAsync", null);
__legacyDecorateClassTS([
  nativeFunction(1122763692, 150)
], IoFileMgrForUser.prototype, "sceIoWrite", null);
__legacyDecorateClassTS([
  nativeFunction(262974233, 150)
], IoFileMgrForUser.prototype, "sceIoWriteAsync", null);
__legacyDecorateClassTS([
  nativeFunction(669722552, 150)
], IoFileMgrForUser.prototype, "sceIoLseek", null);
__legacyDecorateClassTS([
  nativeFunction(1754673956, 150)
], IoFileMgrForUser.prototype, "sceIoLseek32", null);
__legacyDecorateClassTS([
  nativeFunction(2996690844, 150)
], IoFileMgrForUser.prototype, "sceIoDopen", null);
__legacyDecorateClassTS([
  nativeFunction(3943244905, 150)
], IoFileMgrForUser.prototype, "sceIoDclose", null);
__legacyDecorateClassTS([
  nativeFunction(3823829068, 150)
], IoFileMgrForUser.prototype, "sceIoDread", null);
__legacyDecorateClassTS([
  nativeFunction(2900969192, 150)
], IoFileMgrForUser.prototype, "sceIoGetstat", null);
__legacyDecorateClassTS([
  nativeFunction(111607812, 150)
], IoFileMgrForUser.prototype, "sceIoMkdir", null);
__legacyDecorateClassTS([
  nativeFunction(286770783, 150)
], IoFileMgrForUser.prototype, "sceIoRmdir", null);
__legacyDecorateClassTS([
  nativeFunction(4068121681, 150)
], IoFileMgrForUser.prototype, "sceIoRemove", null);
__legacyDecorateClassTS([
  nativeFunction(2005992352, 150)
], IoFileMgrForUser.prototype, "sceIoRename", null);
__legacyDecorateClassTS([
  nativeFunction(1442083197, 150)
], IoFileMgrForUser.prototype, "sceIoChdir", null);
IoFileMgrForUser = __legacyDecorateClassTS([
  hleModule("IoFileMgrForUser")
], IoFileMgrForUser);
// src/hle/module/sceDisplay.ts
class sceDisplay {
  name = "sceDisplay";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceDisplaySetMode() {
    const mode = this.ctx.arg(0);
    const width = this.ctx.arg(1);
    const height = this.ctx.arg(2);
    this.ctx.log(`sceDisplaySetMode(${mode}, ${width}, ${height})`);
    return this.ctx.displayManager.setMode(mode, width, height);
  }
  sceDisplayGetMode() {
    const modePtr = this.ctx.argPtr(0);
    const widthPtr = this.ctx.argPtr(1);
    const heightPtr = this.ctx.argPtr(2);
    const { mode, width, height } = this.ctx.displayManager.getMode();
    if (modePtr) {
      this.ctx.write32(modePtr, mode);
    }
    if (widthPtr) {
      this.ctx.write32(widthPtr, width);
    }
    if (heightPtr) {
      this.ctx.write32(heightPtr, height);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceDisplaySetFrameBuf() {
    const topAddr = this.ctx.arg(0);
    const bufferWidth = this.ctx.arg(1);
    const pixelFormat = this.ctx.arg(2);
    const syncMode = this.ctx.arg(3);
    this.ctx.log(`sceDisplaySetFrameBuf(0x${topAddr.toString(16)}, ${bufferWidth}, ${pixelFormat}, ${syncMode})`);
    return this.ctx.displayManager.setFrameBuf(topAddr, bufferWidth, pixelFormat, syncMode);
  }
  sceDisplayGetFrameBuf() {
    const topAddrPtr = this.ctx.argPtr(0);
    const bufferWidthPtr = this.ctx.argPtr(1);
    const pixelFormatPtr = this.ctx.argPtr(2);
    const syncModePtr = this.ctx.argPtr(3);
    const fb = this.ctx.displayManager.getFrameBuf();
    if (topAddrPtr) {
      this.ctx.write32(topAddrPtr, fb.topAddr);
    }
    if (bufferWidthPtr) {
      this.ctx.write32(bufferWidthPtr, fb.bufferWidth);
    }
    if (pixelFormatPtr) {
      this.ctx.write32(pixelFormatPtr, fb.pixelFormat);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceDisplayWaitVblank() {
    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }
    const result = this.ctx.displayManager.waitVblank(thread, false);
    if (typeof result === "number") {
      return result;
    }
    return result.toPromise();
  }
  sceDisplayWaitVblankStart() {
    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }
    const result = this.ctx.displayManager.waitVblank(thread, true);
    if (typeof result === "number") {
      return result;
    }
    return result.toPromise();
  }
  sceDisplayWaitVblankCB() {
    const thread = this.ctx.threadManager.getCurrentThread();
    if (thread) {
      thread.callbackAccepting = true;
    }
    return this.sceDisplayWaitVblank();
  }
  sceDisplayWaitVblankStartCB() {
    const thread = this.ctx.threadManager.getCurrentThread();
    if (thread) {
      thread.callbackAccepting = true;
    }
    return this.sceDisplayWaitVblankStart();
  }
  sceDisplayGetVcount() {
    return this.ctx.displayManager.getVcount();
  }
  sceDisplayGetCurrentHcount() {
    return this.ctx.displayManager.getCurrentHcount();
  }
  sceDisplayGetAccumulatedHcount() {
    return this.ctx.displayManager.getAccumulatedHcount();
  }
  sceDisplayIsVblank() {
    return this.ctx.displayManager.isVblank() ? 1 : 0;
  }
  sceDisplayIsForeground() {
    return this.ctx.displayManager.getIsForeground() ? 1 : 0;
  }
}
__legacyDecorateClassTS([
  nativeFunction(237039991, 150)
], sceDisplay.prototype, "sceDisplaySetMode", null);
__legacyDecorateClassTS([
  nativeFunction(3735132116, 150)
], sceDisplay.prototype, "sceDisplayGetMode", null);
__legacyDecorateClassTS([
  nativeFunction(681411326, 150)
], sceDisplay.prototype, "sceDisplaySetFrameBuf", null);
__legacyDecorateClassTS([
  nativeFunction(4007276116, 150)
], sceDisplay.prototype, "sceDisplayGetFrameBuf", null);
__legacyDecorateClassTS([
  nativeFunction(919468766, 150)
], sceDisplay.prototype, "sceDisplayWaitVblank", null);
__legacyDecorateClassTS([
  nativeFunction(2555127783, 150)
], sceDisplay.prototype, "sceDisplayWaitVblankStart", null);
__legacyDecorateClassTS([
  nativeFunction(2394549321, 150)
], sceDisplay.prototype, "sceDisplayWaitVblankCB", null);
__legacyDecorateClassTS([
  nativeFunction(1190233795, 150)
], sceDisplay.prototype, "sceDisplayWaitVblankStartCB", null);
__legacyDecorateClassTS([
  nativeFunction(2624498391, 150)
], sceDisplay.prototype, "sceDisplayGetVcount", null);
__legacyDecorateClassTS([
  nativeFunction(2000540579, 150)
], sceDisplay.prototype, "sceDisplayGetCurrentHcount", null);
__legacyDecorateClassTS([
  nativeFunction(554609466, 150)
], sceDisplay.prototype, "sceDisplayGetAccumulatedHcount", null);
__legacyDecorateClassTS([
  nativeFunction(1296961772, 150)
], sceDisplay.prototype, "sceDisplayIsVblank", null);
__legacyDecorateClassTS([
  nativeFunction(3035855098, 150)
], sceDisplay.prototype, "sceDisplayIsForeground", null);
sceDisplay = __legacyDecorateClassTS([
  hleModule("sceDisplay")
], sceDisplay);
// src/hle/module/sceCtrl.ts
var CTRL_DATA_SIZE = 16;

class sceCtrl {
  name = "sceCtrl";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceCtrlSetSamplingCycle() {
    const cycle = this.ctx.arg(0);
    return this.ctx.inputManager.setSamplingCycle(cycle);
  }
  sceCtrlGetSamplingCycle() {
    const cyclePtr = this.ctx.argPtr(0);
    if (cyclePtr) {
      this.ctx.write32(cyclePtr, this.ctx.inputManager.getSamplingCycle());
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceCtrlSetSamplingMode() {
    const mode = this.ctx.arg(0);
    return this.ctx.inputManager.setSamplingMode(mode);
  }
  sceCtrlGetSamplingMode() {
    const modePtr = this.ctx.argPtr(0);
    if (modePtr) {
      this.ctx.write32(modePtr, this.ctx.inputManager.getSamplingMode());
    }
    return SceKernelErrors.ERROR_OK;
  }
  writeCtrlData(address, data) {
    this.ctx.write32(address + 0, data.timeStamp);
    this.ctx.write32(address + 4, data.buttons);
    this.ctx.write8(address + 8, data.lx);
    this.ctx.write8(address + 9, data.ly);
    for (let i = 0;i < 6; i++) {
      this.ctx.write8(address + 10 + i, 0);
    }
  }
  sceCtrlPeekBufferPositive() {
    const padDataPtr = this.ctx.argPtr(0);
    const count = this.ctx.arg(1);
    const samples = this.ctx.inputManager.peekBuffer(count);
    for (let i = 0;i < samples.length; i++) {
      this.writeCtrlData(padDataPtr + i * CTRL_DATA_SIZE, samples[i]);
    }
    if (samples.length === 0 && count > 0) {
      this.writeCtrlData(padDataPtr, this.ctx.inputManager.getCurrentData());
      return 1;
    }
    return samples.length;
  }
  sceCtrlPeekBufferNegative() {
    const padDataPtr = this.ctx.argPtr(0);
    const count = this.ctx.arg(1);
    const samples = this.ctx.inputManager.peekBuffer(count);
    for (let i = 0;i < samples.length; i++) {
      const sample = { ...samples[i], buttons: ~samples[i].buttons & 4294967295 };
      this.writeCtrlData(padDataPtr + i * CTRL_DATA_SIZE, sample);
    }
    if (samples.length === 0 && count > 0) {
      const current = this.ctx.inputManager.getCurrentData();
      current.buttons = ~current.buttons & 4294967295;
      this.writeCtrlData(padDataPtr, current);
      return 1;
    }
    return samples.length;
  }
  sceCtrlReadBufferPositive() {
    const padDataPtr = this.ctx.argPtr(0);
    const count = this.ctx.arg(1);
    const samples = this.ctx.inputManager.readBuffer(count);
    for (let i = 0;i < samples.length; i++) {
      this.writeCtrlData(padDataPtr + i * CTRL_DATA_SIZE, samples[i]);
    }
    if (samples.length === 0 && count > 0) {
      this.writeCtrlData(padDataPtr, this.ctx.inputManager.getCurrentData());
      return 1;
    }
    return samples.length;
  }
  sceCtrlReadBufferNegative() {
    const padDataPtr = this.ctx.argPtr(0);
    const count = this.ctx.arg(1);
    const samples = this.ctx.inputManager.readBuffer(count);
    for (let i = 0;i < samples.length; i++) {
      const sample = { ...samples[i], buttons: ~samples[i].buttons & 4294967295 };
      this.writeCtrlData(padDataPtr + i * CTRL_DATA_SIZE, sample);
    }
    if (samples.length === 0 && count > 0) {
      const current = this.ctx.inputManager.getCurrentData();
      current.buttons = ~current.buttons & 4294967295;
      this.writeCtrlData(padDataPtr, current);
      return 1;
    }
    return samples.length;
  }
  sceCtrlPeekLatch() {
    const latchDataPtr = this.ctx.argPtr(0);
    const current = this.ctx.inputManager.getCurrentData();
    this.ctx.write32(latchDataPtr + 0, current.buttons);
    this.ctx.write32(latchDataPtr + 4, 0);
    this.ctx.write32(latchDataPtr + 8, current.buttons);
    this.ctx.write32(latchDataPtr + 12, ~current.buttons);
    return 1;
  }
  sceCtrlReadLatch() {
    return this.sceCtrlPeekLatch();
  }
  sceCtrlGetIdleCancelThreshold() {
    const idleResetPtr = this.ctx.argPtr(0);
    const idleBackPtr = this.ctx.argPtr(1);
    if (idleResetPtr) {
      this.ctx.write32(idleResetPtr, -1);
    }
    if (idleBackPtr) {
      this.ctx.write32(idleBackPtr, -1);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceCtrlSetIdleCancelThreshold() {
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(1780970739, 150)
], sceCtrl.prototype, "sceCtrlSetSamplingCycle", null);
__legacyDecorateClassTS([
  nativeFunction(45788561, 150)
], sceCtrl.prototype, "sceCtrlGetSamplingCycle", null);
__legacyDecorateClassTS([
  nativeFunction(524292582, 150)
], sceCtrl.prototype, "sceCtrlSetSamplingMode", null);
__legacyDecorateClassTS([
  nativeFunction(3664475809, 150)
], sceCtrl.prototype, "sceCtrlGetSamplingMode", null);
__legacyDecorateClassTS([
  nativeFunction(979510608, 150)
], sceCtrl.prototype, "sceCtrlPeekBufferPositive", null);
__legacyDecorateClassTS([
  nativeFunction(3243378698, 150)
], sceCtrl.prototype, "sceCtrlPeekBufferNegative", null);
__legacyDecorateClassTS([
  nativeFunction(528496952, 150)
], sceCtrl.prototype, "sceCtrlReadBufferPositive", null);
__legacyDecorateClassTS([
  nativeFunction(1622679430, 150)
], sceCtrl.prototype, "sceCtrlReadBufferNegative", null);
__legacyDecorateClassTS([
  nativeFunction(2983257549, 150)
], sceCtrl.prototype, "sceCtrlPeekLatch", null);
__legacyDecorateClassTS([
  nativeFunction(190350593, 150)
], sceCtrl.prototype, "sceCtrlReadLatch", null);
__legacyDecorateClassTS([
  nativeFunction(2803124224, 150)
], sceCtrl.prototype, "sceCtrlGetIdleCancelThreshold", null);
__legacyDecorateClassTS([
  nativeFunction(2794443360, 150)
], sceCtrl.prototype, "sceCtrlSetIdleCancelThreshold", null);
sceCtrl = __legacyDecorateClassTS([
  hleModule("sceCtrl")
], sceCtrl);
// src/hle/module/sceRtc.ts
var TICK_FREQUENCY = 1000000n;
var PSP_EPOCH_OFFSET = 62135596800000n;
function dateToTicks(date) {
  const unixMs = BigInt(date.getTime());
  const totalMs = unixMs + PSP_EPOCH_OFFSET;
  return totalMs * 1000n;
}
function ticksToDate(ticks) {
  const totalMs = ticks / 1000n;
  const unixMs = totalMs - PSP_EPOCH_OFFSET;
  return new Date(Number(unixMs));
}
function getCurrentTicks() {
  return dateToTicks(new Date);
}
var DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function isLeapYear(year) {
  return year % 4 === 0 && year % 100 !== 0 || year % 400 === 0;
}
function getDaysInMonth(year, month) {
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  return DAYS_IN_MONTH[month] || 0;
}
function getDayOfWeek(year, month, day) {
  const date = new Date(year, month - 1, day);
  return date.getDay();
}

class sceRtc {
  name = "sceRtc";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceRtcGetTickResolution() {
    return Number(TICK_FREQUENCY);
  }
  sceRtcGetCurrentTick() {
    const tickPtr = this.ctx.argPtr(0);
    const ticks = getCurrentTicks();
    const low = Number(ticks & 0xFFFFFFFFn);
    const high = Number(ticks >> 32n & 0xFFFFFFFFn);
    this.ctx.write32(tickPtr, low);
    this.ctx.write32(tickPtr + 4, high);
    return SceKernelErrors.ERROR_OK;
  }
  sceRtcGetCurrentClock() {
    const timePtr = this.ctx.argPtr(0);
    const tz = this.ctx.arg(1);
    const now = new Date;
    now.setMinutes(now.getMinutes() + tz);
    this.writeDateTime(timePtr, now);
    return SceKernelErrors.ERROR_OK;
  }
  sceRtcGetCurrentClockLocalTime() {
    const timePtr = this.ctx.argPtr(0);
    this.writeDateTime(timePtr, new Date);
    return SceKernelErrors.ERROR_OK;
  }
  sceRtcSetTick() {
    const timePtr = this.ctx.argPtr(0);
    const tickPtr = this.ctx.argPtr(1);
    const low = this.ctx.read32(tickPtr);
    const high = this.ctx.read32(tickPtr + 4);
    const ticks = BigInt(high) << 32n | BigInt(low >>> 0);
    const date = ticksToDate(ticks);
    this.writeDateTime(timePtr, date);
    return SceKernelErrors.ERROR_OK;
  }
  sceRtcGetTick() {
    const timePtr = this.ctx.argPtr(0);
    const tickPtr = this.ctx.argPtr(1);
    const date = this.readDateTime(timePtr);
    const ticks = dateToTicks(date);
    const low = Number(ticks & 0xFFFFFFFFn);
    const high = Number(ticks >> 32n & 0xFFFFFFFFn);
    this.ctx.write32(tickPtr, low);
    this.ctx.write32(tickPtr + 4, high);
    return SceKernelErrors.ERROR_OK;
  }
  sceRtcTickAddTicks() {
    const destTickPtr = this.ctx.argPtr(0);
    const srcTickPtr = this.ctx.argPtr(1);
    const addLow = this.ctx.arg(2);
    const addHigh = this.ctx.arg(3);
    const srcLow = this.ctx.read32(srcTickPtr);
    const srcHigh = this.ctx.read32(srcTickPtr + 4);
    const srcTicks = BigInt(srcHigh) << 32n | BigInt(srcLow >>> 0);
    const addTicks = BigInt(addHigh) << 32n | BigInt(addLow >>> 0);
    const result = srcTicks + addTicks;
    this.ctx.write32(destTickPtr, Number(result & 0xFFFFFFFFn));
    this.ctx.write32(destTickPtr + 4, Number(result >> 32n & 0xFFFFFFFFn));
    return SceKernelErrors.ERROR_OK;
  }
  sceRtcTickAddMicroseconds() {
    return this.sceRtcTickAddTicks();
  }
  sceRtcTickAddSeconds() {
    const destTickPtr = this.ctx.argPtr(0);
    const srcTickPtr = this.ctx.argPtr(1);
    const addLow = this.ctx.arg(2);
    const addHigh = this.ctx.arg(3);
    const srcLow = this.ctx.read32(srcTickPtr);
    const srcHigh = this.ctx.read32(srcTickPtr + 4);
    const srcTicks = BigInt(srcHigh) << 32n | BigInt(srcLow >>> 0);
    const addSeconds = BigInt(addHigh) << 32n | BigInt(addLow >>> 0);
    const result = srcTicks + addSeconds * TICK_FREQUENCY;
    this.ctx.write32(destTickPtr, Number(result & 0xFFFFFFFFn));
    this.ctx.write32(destTickPtr + 4, Number(result >> 32n & 0xFFFFFFFFn));
    return SceKernelErrors.ERROR_OK;
  }
  sceRtcTickAddMinutes() {
    const destTickPtr = this.ctx.argPtr(0);
    const srcTickPtr = this.ctx.argPtr(1);
    const addLow = this.ctx.arg(2);
    const addHigh = this.ctx.arg(3);
    const srcLow = this.ctx.read32(srcTickPtr);
    const srcHigh = this.ctx.read32(srcTickPtr + 4);
    const srcTicks = BigInt(srcHigh) << 32n | BigInt(srcLow >>> 0);
    const addMinutes = BigInt(addHigh) << 32n | BigInt(addLow >>> 0);
    const result = srcTicks + addMinutes * 60n * TICK_FREQUENCY;
    this.ctx.write32(destTickPtr, Number(result & 0xFFFFFFFFn));
    this.ctx.write32(destTickPtr + 4, Number(result >> 32n & 0xFFFFFFFFn));
    return SceKernelErrors.ERROR_OK;
  }
  sceRtcTickAddHours() {
    const destTickPtr = this.ctx.argPtr(0);
    const srcTickPtr = this.ctx.argPtr(1);
    const hours = this.ctx.arg(2);
    const srcLow = this.ctx.read32(srcTickPtr);
    const srcHigh = this.ctx.read32(srcTickPtr + 4);
    const srcTicks = BigInt(srcHigh) << 32n | BigInt(srcLow >>> 0);
    const result = srcTicks + BigInt(hours) * 3600n * TICK_FREQUENCY;
    this.ctx.write32(destTickPtr, Number(result & 0xFFFFFFFFn));
    this.ctx.write32(destTickPtr + 4, Number(result >> 32n & 0xFFFFFFFFn));
    return SceKernelErrors.ERROR_OK;
  }
  sceRtcTickAddDays() {
    const destTickPtr = this.ctx.argPtr(0);
    const srcTickPtr = this.ctx.argPtr(1);
    const days = this.ctx.arg(2);
    const srcLow = this.ctx.read32(srcTickPtr);
    const srcHigh = this.ctx.read32(srcTickPtr + 4);
    const srcTicks = BigInt(srcHigh) << 32n | BigInt(srcLow >>> 0);
    const result = srcTicks + BigInt(days) * 86400n * TICK_FREQUENCY;
    this.ctx.write32(destTickPtr, Number(result & 0xFFFFFFFFn));
    this.ctx.write32(destTickPtr + 4, Number(result >> 32n & 0xFFFFFFFFn));
    return SceKernelErrors.ERROR_OK;
  }
  sceRtcTickAddWeeks() {
    const destTickPtr = this.ctx.argPtr(0);
    const srcTickPtr = this.ctx.argPtr(1);
    const weeks = this.ctx.arg(2);
    const srcLow = this.ctx.read32(srcTickPtr);
    const srcHigh = this.ctx.read32(srcTickPtr + 4);
    const srcTicks = BigInt(srcHigh) << 32n | BigInt(srcLow >>> 0);
    const result = srcTicks + BigInt(weeks) * 604800n * TICK_FREQUENCY;
    this.ctx.write32(destTickPtr, Number(result & 0xFFFFFFFFn));
    this.ctx.write32(destTickPtr + 4, Number(result >> 32n & 0xFFFFFFFFn));
    return SceKernelErrors.ERROR_OK;
  }
  sceRtcTickAddMonths() {
    const destTickPtr = this.ctx.argPtr(0);
    const srcTickPtr = this.ctx.argPtr(1);
    const months = this.ctx.arg(2);
    const srcLow = this.ctx.read32(srcTickPtr);
    const srcHigh = this.ctx.read32(srcTickPtr + 4);
    const srcTicks = BigInt(srcHigh) << 32n | BigInt(srcLow >>> 0);
    const date = ticksToDate(srcTicks);
    date.setMonth(date.getMonth() + months);
    const result = dateToTicks(date);
    this.ctx.write32(destTickPtr, Number(result & 0xFFFFFFFFn));
    this.ctx.write32(destTickPtr + 4, Number(result >> 32n & 0xFFFFFFFFn));
    return SceKernelErrors.ERROR_OK;
  }
  sceRtcTickAddYears() {
    const destTickPtr = this.ctx.argPtr(0);
    const srcTickPtr = this.ctx.argPtr(1);
    const years = this.ctx.arg(2);
    const srcLow = this.ctx.read32(srcTickPtr);
    const srcHigh = this.ctx.read32(srcTickPtr + 4);
    const srcTicks = BigInt(srcHigh) << 32n | BigInt(srcLow >>> 0);
    const date = ticksToDate(srcTicks);
    date.setFullYear(date.getFullYear() + years);
    const result = dateToTicks(date);
    this.ctx.write32(destTickPtr, Number(result & 0xFFFFFFFFn));
    this.ctx.write32(destTickPtr + 4, Number(result >> 32n & 0xFFFFFFFFn));
    return SceKernelErrors.ERROR_OK;
  }
  sceRtcCompareTick() {
    const tick1Ptr = this.ctx.argPtr(0);
    const tick2Ptr = this.ctx.argPtr(1);
    const low1 = this.ctx.read32(tick1Ptr);
    const high1 = this.ctx.read32(tick1Ptr + 4);
    const tick1 = BigInt(high1) << 32n | BigInt(low1 >>> 0);
    const low2 = this.ctx.read32(tick2Ptr);
    const high2 = this.ctx.read32(tick2Ptr + 4);
    const tick2 = BigInt(high2) << 32n | BigInt(low2 >>> 0);
    if (tick1 < tick2)
      return -1;
    if (tick1 > tick2)
      return 1;
    return 0;
  }
  sceRtcGetDayOfWeek() {
    const year = this.ctx.arg(0);
    const month = this.ctx.arg(1);
    const day = this.ctx.arg(2);
    return getDayOfWeek(year, month, day);
  }
  sceRtcGetDaysInMonth() {
    const year = this.ctx.arg(0);
    const month = this.ctx.arg(1);
    return getDaysInMonth(year, month);
  }
  sceRtcIsLeapYear() {
    const year = this.ctx.arg(0);
    return isLeapYear(year) ? 1 : 0;
  }
  sceRtcCheckValid() {
    const timePtr = this.ctx.argPtr(0);
    const year = this.ctx.read16(timePtr);
    const month = this.ctx.read16(timePtr + 2);
    const day = this.ctx.read16(timePtr + 4);
    const hour = this.ctx.read16(timePtr + 6);
    const minute = this.ctx.read16(timePtr + 8);
    const second = this.ctx.read16(timePtr + 10);
    const microsecond = this.ctx.read32(timePtr + 12);
    if (year < 1 || year > 9999)
      return SceKernelErrors.ERROR_INVALID_VALUE;
    if (month < 1 || month > 12)
      return SceKernelErrors.ERROR_INVALID_VALUE;
    if (day < 1 || day > getDaysInMonth(year, month))
      return SceKernelErrors.ERROR_INVALID_VALUE;
    if (hour < 0 || hour > 23)
      return SceKernelErrors.ERROR_INVALID_VALUE;
    if (minute < 0 || minute > 59)
      return SceKernelErrors.ERROR_INVALID_VALUE;
    if (second < 0 || second > 59)
      return SceKernelErrors.ERROR_INVALID_VALUE;
    if (microsecond < 0 || microsecond > 999999)
      return SceKernelErrors.ERROR_INVALID_VALUE;
    return SceKernelErrors.ERROR_OK;
  }
  sceRtcGetTime_t() {
    const timePtr = this.ctx.argPtr(0);
    const tPtr = this.ctx.argPtr(1);
    const date = this.readDateTime(timePtr);
    const unixTime = Math.floor(date.getTime() / 1000);
    this.ctx.write32(tPtr, unixTime);
    return SceKernelErrors.ERROR_OK;
  }
  sceRtcSetTime_t() {
    const timePtr = this.ctx.argPtr(0);
    const t = this.ctx.arg(1);
    const date = new Date(t * 1000);
    this.writeDateTime(timePtr, date);
    return SceKernelErrors.ERROR_OK;
  }
  writeDateTime(ptr, date) {
    this.ctx.write16(ptr + 0, date.getFullYear());
    this.ctx.write16(ptr + 2, date.getMonth() + 1);
    this.ctx.write16(ptr + 4, date.getDate());
    this.ctx.write16(ptr + 6, date.getHours());
    this.ctx.write16(ptr + 8, date.getMinutes());
    this.ctx.write16(ptr + 10, date.getSeconds());
    this.ctx.write32(ptr + 12, date.getMilliseconds() * 1000);
  }
  readDateTime(ptr) {
    const year = this.ctx.read16(ptr + 0);
    const month = this.ctx.read16(ptr + 2) - 1;
    const day = this.ctx.read16(ptr + 4);
    const hour = this.ctx.read16(ptr + 6);
    const minute = this.ctx.read16(ptr + 8);
    const second = this.ctx.read16(ptr + 10);
    const microsecond = this.ctx.read32(ptr + 12);
    const date = new Date(year, month, day, hour, minute, second, Math.floor(microsecond / 1000));
    return date;
  }
}
__legacyDecorateClassTS([
  nativeFunction(3290179667, 150)
], sceRtc.prototype, "sceRtcGetTickResolution", null);
__legacyDecorateClassTS([
  nativeFunction(1065015143, 150)
], sceRtc.prototype, "sceRtcGetCurrentTick", null);
__legacyDecorateClassTS([
  nativeFunction(1291474864, 150)
], sceRtc.prototype, "sceRtcGetCurrentClock", null);
__legacyDecorateClassTS([
  nativeFunction(3888282907, 150)
], sceRtc.prototype, "sceRtcGetCurrentClockLocalTime", null);
__legacyDecorateClassTS([
  nativeFunction(2127732288, 150)
], sceRtc.prototype, "sceRtcSetTick", null);
__legacyDecorateClassTS([
  nativeFunction(1878264524, 150)
], sceRtc.prototype, "sceRtcGetTick", null);
__legacyDecorateClassTS([
  nativeFunction(1156865541, 150)
], sceRtc.prototype, "sceRtcTickAddTicks", null);
__legacyDecorateClassTS([
  nativeFunction(651319901, 150)
], sceRtc.prototype, "sceRtcTickAddMicroseconds", null);
__legacyDecorateClassTS([
  nativeFunction(4070879205, 150)
], sceRtc.prototype, "sceRtcTickAddSeconds", null);
__legacyDecorateClassTS([
  nativeFunction(3865074634, 150)
], sceRtc.prototype, "sceRtcTickAddMinutes", null);
__legacyDecorateClassTS([
  nativeFunction(651665994, 150)
], sceRtc.prototype, "sceRtcTickAddHours", null);
__legacyDecorateClassTS([
  nativeFunction(3843771258, 150)
], sceRtc.prototype, "sceRtcTickAddDays", null);
__legacyDecorateClassTS([
  nativeFunction(3476696232, 150)
], sceRtc.prototype, "sceRtcTickAddWeeks", null);
__legacyDecorateClassTS([
  nativeFunction(3690417947, 150)
], sceRtc.prototype, "sceRtcTickAddMonths", null);
__legacyDecorateClassTS([
  nativeFunction(1115958391, 150)
], sceRtc.prototype, "sceRtcTickAddYears", null);
__legacyDecorateClassTS([
  nativeFunction(2664476295, 150)
], sceRtc.prototype, "sceRtcCompareTick", null);
__legacyDecorateClassTS([
  nativeFunction(1467116481, 150)
], sceRtc.prototype, "sceRtcGetDayOfWeek", null);
__legacyDecorateClassTS([
  nativeFunction(99562028, 150)
], sceRtc.prototype, "sceRtcGetDaysInMonth", null);
__legacyDecorateClassTS([
  nativeFunction(881352205, 150)
], sceRtc.prototype, "sceRtcIsLeapYear", null);
__legacyDecorateClassTS([
  nativeFunction(1260084866, 150)
], sceRtc.prototype, "sceRtcCheckValid", null);
__legacyDecorateClassTS([
  nativeFunction(667179340, 150)
], sceRtc.prototype, "sceRtcGetTime_t", null);
__legacyDecorateClassTS([
  nativeFunction(981499080, 150)
], sceRtc.prototype, "sceRtcSetTime_t", null);
sceRtc = __legacyDecorateClassTS([
  hleModule("sceRtc")
], sceRtc);
// src/hle/module/scePower.ts
var DEFAULT_CPU_CLOCK = 222;
var DEFAULT_BUS_CLOCK = 111;
var MAX_CPU_CLOCK = 333;
var MAX_BUS_CLOCK = 166;

class scePower {
  name = "scePower";
  ctx;
  cpuClock = DEFAULT_CPU_CLOCK;
  busClock = DEFAULT_BUS_CLOCK;
  callbacks = new Map;
  init(ctx) {
    this.ctx = ctx;
  }
  scePowerIsPowerOnline() {
    return 1;
  }
  scePowerIsBatteryExist() {
    return 1;
  }
  scePowerIsBatteryCharging() {
    return 1;
  }
  scePowerGetBatteryChargingStatus() {
    return 3;
  }
  scePowerIsLowBattery() {
    return 0;
  }
  scePowerGetBatteryLifePercent() {
    return 100;
  }
  scePowerGetBatteryLifeTime() {
    return -1;
  }
  scePowerGetBatteryTemp() {
    return 25;
  }
  scePowerGetBatteryVolt() {
    return 4200;
  }
  scePowerGetBatteryElec() {
    return 0;
  }
  scePowerGetBatteryRemainCapacity() {
    return 1800;
  }
  scePowerGetBatteryFullCapacity() {
    return 1800;
  }
  scePowerSetClockFrequency() {
    const pllFreq = this.ctx.arg(0);
    const cpuFreq = this.ctx.arg(1);
    const busFreq = this.ctx.arg(2);
    if (cpuFreq < 1 || cpuFreq > MAX_CPU_CLOCK) {
      return SceKernelErrors.ERROR_INVALID_VALUE;
    }
    if (busFreq < 1 || busFreq > MAX_BUS_CLOCK) {
      return SceKernelErrors.ERROR_INVALID_VALUE;
    }
    this.cpuClock = cpuFreq;
    this.busClock = busFreq;
    this.ctx.log(`scePowerSetClockFrequency(${pllFreq}, ${cpuFreq}, ${busFreq})`);
    return SceKernelErrors.ERROR_OK;
  }
  scePowerSetCpuClockFrequency() {
    const freq = this.ctx.arg(0);
    if (freq < 1 || freq > MAX_CPU_CLOCK) {
      return SceKernelErrors.ERROR_INVALID_VALUE;
    }
    this.cpuClock = freq;
    return SceKernelErrors.ERROR_OK;
  }
  scePowerSetBusClockFrequency() {
    const freq = this.ctx.arg(0);
    if (freq < 1 || freq > MAX_BUS_CLOCK) {
      return SceKernelErrors.ERROR_INVALID_VALUE;
    }
    this.busClock = freq;
    return SceKernelErrors.ERROR_OK;
  }
  scePowerGetCpuClockFrequency() {
    return this.cpuClock;
  }
  scePowerGetCpuClockFrequencyInt() {
    return this.cpuClock;
  }
  scePowerGetCpuClockFrequencyFloat() {
    const buf = new ArrayBuffer(4);
    new Float32Array(buf)[0] = this.cpuClock;
    return new Uint32Array(buf)[0];
  }
  scePowerGetBusClockFrequency() {
    return this.busClock;
  }
  scePowerGetBusClockFrequencyInt() {
    return this.busClock;
  }
  scePowerGetBusClockFrequencyFloat() {
    const buf = new ArrayBuffer(4);
    new Float32Array(buf)[0] = this.busClock;
    return new Uint32Array(buf)[0];
  }
  scePowerGetPllClockFrequencyInt() {
    return this.cpuClock;
  }
  scePowerGetPllClockFrequencyFloat() {
    const buf = new ArrayBuffer(4);
    new Float32Array(buf)[0] = this.cpuClock;
    return new Uint32Array(buf)[0];
  }
  scePowerRegisterCallback() {
    const slot = this.ctx.arg(0);
    const cbid = this.ctx.arg(1);
    if (slot < 0 || slot > 15) {
      return SceKernelErrors.ERROR_INVALID_INDEX;
    }
    this.callbacks.set(slot, cbid);
    return SceKernelErrors.ERROR_OK;
  }
  scePowerUnregisterCallback() {
    const slot = this.ctx.arg(0);
    if (!this.callbacks.has(slot)) {
      return SceKernelErrors.ERROR_INVALID_INDEX;
    }
    this.callbacks.delete(slot);
    return SceKernelErrors.ERROR_OK;
  }
  scePowerLock() {
    return SceKernelErrors.ERROR_OK;
  }
  scePowerUnlock() {
    return SceKernelErrors.ERROR_OK;
  }
  scePowerTick() {
    return SceKernelErrors.ERROR_OK;
  }
  scePowerGetIdleTimer() {
    return 0;
  }
  scePowerIdleTimerEnable() {
    return SceKernelErrors.ERROR_OK;
  }
  scePowerIdleTimerDisable() {
    return SceKernelErrors.ERROR_OK;
  }
  scePowerIsSuspendRequired() {
    return 0;
  }
  scePowerRequestStandby() {
    this.ctx.log("scePowerRequestStandby - ignored");
    return SceKernelErrors.ERROR_OK;
  }
  scePowerRequestSuspend() {
    this.ctx.log("scePowerRequestSuspend - ignored");
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(2269384542, 150)
], scePower.prototype, "scePowerIsPowerOnline", null);
__legacyDecorateClassTS([
  nativeFunction(184356235, 150)
], scePower.prototype, "scePowerIsBatteryExist", null);
__legacyDecorateClassTS([
  nativeFunction(508101633, 150)
], scePower.prototype, "scePowerIsBatteryCharging", null);
__legacyDecorateClassTS([
  nativeFunction(3024301000, 150)
], scePower.prototype, "scePowerGetBatteryChargingStatus", null);
__legacyDecorateClassTS([
  nativeFunction(3540474150, 150)
], scePower.prototype, "scePowerIsLowBattery", null);
__legacyDecorateClassTS([
  nativeFunction(545640797, 150)
], scePower.prototype, "scePowerGetBatteryLifePercent", null);
__legacyDecorateClassTS([
  nativeFunction(2398830498, 150)
], scePower.prototype, "scePowerGetBatteryLifeTime", null);
__legacyDecorateClassTS([
  nativeFunction(685842467, 150)
], scePower.prototype, "scePowerGetBatteryTemp", null);
__legacyDecorateClassTS([
  nativeFunction(1211951211, 150)
], scePower.prototype, "scePowerGetBatteryVolt", null);
__legacyDecorateClassTS([
  nativeFunction(591620682, 150)
], scePower.prototype, "scePowerGetBatteryElec", null);
__legacyDecorateClassTS([
  nativeFunction(215096095, 150)
], scePower.prototype, "scePowerGetBatteryRemainCapacity", null);
__legacyDecorateClassTS([
  nativeFunction(2499126591, 150)
], scePower.prototype, "scePowerGetBatteryFullCapacity", null);
__legacyDecorateClassTS([
  nativeFunction(1937016562, 150)
], scePower.prototype, "scePowerSetClockFrequency", null);
__legacyDecorateClassTS([
  nativeFunction(2218770243, 150)
], scePower.prototype, "scePowerSetCpuClockFrequency", null);
__legacyDecorateClassTS([
  nativeFunction(3101144059, 150)
], scePower.prototype, "scePowerSetBusClockFrequency", null);
__legacyDecorateClassTS([
  nativeFunction(4276107823, 150)
], scePower.prototype, "scePowerGetCpuClockFrequency", null);
__legacyDecorateClassTS([
  nativeFunction(4256546793, 150)
], scePower.prototype, "scePowerGetCpuClockFrequencyInt", null);
__legacyDecorateClassTS([
  nativeFunction(2980392067, 150)
], scePower.prototype, "scePowerGetCpuClockFrequencyFloat", null);
__legacyDecorateClassTS([
  nativeFunction(1200613109, 150)
], scePower.prototype, "scePowerGetBusClockFrequency", null);
__legacyDecorateClassTS([
  nativeFunction(3177716073, 150)
], scePower.prototype, "scePowerGetBusClockFrequencyInt", null);
__legacyDecorateClassTS([
  nativeFunction(2611852267, 150)
], scePower.prototype, "scePowerGetBusClockFrequencyFloat", null);
__legacyDecorateClassTS([
  nativeFunction(888783971, 150)
], scePower.prototype, "scePowerGetPllClockFrequencyInt", null);
__legacyDecorateClassTS([
  nativeFunction(3929549351, 150)
], scePower.prototype, "scePowerGetPllClockFrequencyFloat", null);
__legacyDecorateClassTS([
  nativeFunction(79132270, 150)
], scePower.prototype, "scePowerRegisterCallback", null);
__legacyDecorateClassTS([
  nativeFunction(3752377080, 150)
], scePower.prototype, "scePowerUnregisterCallback", null);
__legacyDecorateClassTS([
  nativeFunction(3603961583, 150)
], scePower.prototype, "scePowerLock", null);
__legacyDecorateClassTS([
  nativeFunction(3393008833, 150)
], scePower.prototype, "scePowerUnlock", null);
__legacyDecorateClassTS([
  nativeFunction(4023634275, 150)
], scePower.prototype, "scePowerTick", null);
__legacyDecorateClassTS([
  nativeFunction(3680684495, 150)
], scePower.prototype, "scePowerGetIdleTimer", null);
__legacyDecorateClassTS([
  nativeFunction(2133898161, 150)
], scePower.prototype, "scePowerIdleTimerEnable", null);
__legacyDecorateClassTS([
  nativeFunction(2536302913, 150)
], scePower.prototype, "scePowerIdleTimerDisable", null);
__legacyDecorateClassTS([
  nativeFunction(670247212, 150)
], scePower.prototype, "scePowerIsSuspendRequired", null);
__legacyDecorateClassTS([
  nativeFunction(729578740, 150)
], scePower.prototype, "scePowerRequestStandby", null);
__legacyDecorateClassTS([
  nativeFunction(2889009612, 150)
], scePower.prototype, "scePowerRequestSuspend", null);
scePower = __legacyDecorateClassTS([
  hleModule("scePower")
], scePower);
// src/hle/module/sceGe_user.ts
class sceGe_user {
  name = "sceGe_user";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceGeEdramGetSize() {
    return this.ctx.gpuManager.getEdramSize();
  }
  sceGeEdramGetAddr() {
    return this.ctx.gpuManager.getEdramAddress();
  }
  sceGeEdramSetAddrTranslation() {
    const size = this.ctx.arg(0);
    return size;
  }
  sceGeListEnQueue() {
    const list = this.ctx.arg(0);
    const stall = this.ctx.arg(1);
    const cbid = this.ctx.arg(2);
    const argPtr = this.ctx.argPtr(3);
    this.ctx.log(`sceGeListEnQueue(0x${list.toString(16)}, 0x${stall.toString(16)}, ${cbid})`);
    const id = this.ctx.gpuManager.enqueueList(list, stall, cbid, argPtr);
    return id;
  }
  sceGeListEnQueueHead() {
    const list = this.ctx.arg(0);
    const stall = this.ctx.arg(1);
    const cbid = this.ctx.arg(2);
    const argPtr = this.ctx.argPtr(3);
    const id = this.ctx.gpuManager.enqueueListHead(list, stall, cbid, argPtr);
    return id;
  }
  sceGeListDeQueue() {
    const qid = this.ctx.arg(0);
    return this.ctx.gpuManager.dequeueList(qid);
  }
  sceGeListUpdateStallAddr() {
    const qid = this.ctx.arg(0);
    const stall = this.ctx.arg(1);
    return this.ctx.gpuManager.updateStallAddress(qid, stall);
  }
  sceGeListSync() {
    const qid = this.ctx.arg(0);
    const syncType = this.ctx.arg(1);
    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }
    const result = this.ctx.gpuManager.listSync(qid, syncType, thread);
    if (typeof result === "number") {
      return result;
    }
    return result.toPromise();
  }
  sceGeDrawSync() {
    const syncType = this.ctx.arg(0);
    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }
    const result = this.ctx.gpuManager.drawSync(syncType, thread);
    if (typeof result === "number") {
      return result;
    }
    return result.toPromise();
  }
  sceGeContinue() {
    return this.ctx.gpuManager.continue();
  }
  sceGeBreak() {
    const mode = this.ctx.arg(0);
    return this.ctx.gpuManager.break(mode);
  }
  sceGeSetCallback() {
    const cbPtr = this.ctx.argPtr(0);
    const signalFunc = this.ctx.read32(cbPtr + 0);
    const signalArg = this.ctx.read32(cbPtr + 4);
    const finishFunc = this.ctx.read32(cbPtr + 8);
    const finishArg = this.ctx.read32(cbPtr + 12);
    return this.ctx.gpuManager.setCallback(signalFunc, finishFunc, signalArg);
  }
  sceGeUnsetCallback() {
    const cbid = this.ctx.arg(0);
    return this.ctx.gpuManager.unsetCallback(cbid);
  }
  sceGeSaveContext() {
    return SceKernelErrors.ERROR_OK;
  }
  sceGeRestoreContext() {
    return SceKernelErrors.ERROR_OK;
  }
  sceGeGetMtx() {
    return SceKernelErrors.ERROR_OK;
  }
  sceGeGetCmd() {
    return 0;
  }
  sceGeGetStack() {
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(526865069, 150)
], sceGe_user.prototype, "sceGeEdramGetSize", null);
__legacyDecorateClassTS([
  nativeFunction(3833479396, 150)
], sceGe_user.prototype, "sceGeEdramGetAddr", null);
__legacyDecorateClassTS([
  nativeFunction(3078161898, 150)
], sceGe_user.prototype, "sceGeEdramSetAddrTranslation", null);
__legacyDecorateClassTS([
  nativeFunction(2873747306, 150)
], sceGe_user.prototype, "sceGeListEnQueue", null);
__legacyDecorateClassTS([
  nativeFunction(470652326, 150)
], sceGe_user.prototype, "sceGeListEnQueueHead", null);
__legacyDecorateClassTS([
  nativeFunction(1605921456, 150)
], sceGe_user.prototype, "sceGeListDeQueue", null);
__legacyDecorateClassTS([
  nativeFunction(3772154184, 150)
], sceGe_user.prototype, "sceGeListUpdateStallAddr", null);
__legacyDecorateClassTS([
  nativeFunction(54808244, 150)
], sceGe_user.prototype, "sceGeListSync", null);
__legacyDecorateClassTS([
  nativeFunction(2995240289, 150)
], sceGe_user.prototype, "sceGeDrawSync", null);
__legacyDecorateClassTS([
  nativeFunction(1275520114, 150)
], sceGe_user.prototype, "sceGeContinue", null);
__legacyDecorateClassTS([
  nativeFunction(3024677901, 150)
], sceGe_user.prototype, "sceGeBreak", null);
__legacyDecorateClassTS([
  nativeFunction(2767980196, 150)
], sceGe_user.prototype, "sceGeSetCallback", null);
__legacyDecorateClassTS([
  nativeFunction(98247374, 150)
], sceGe_user.prototype, "sceGeUnsetCallback", null);
__legacyDecorateClassTS([
  nativeFunction(1133131866, 150)
], sceGe_user.prototype, "sceGeSaveContext", null);
__legacyDecorateClassTS([
  nativeFunction(200673531, 150)
], sceGe_user.prototype, "sceGeRestoreContext", null);
__legacyDecorateClassTS([
  nativeFunction(1472762971, 150)
], sceGe_user.prototype, "sceGeGetMtx", null);
__legacyDecorateClassTS([
  nativeFunction(3700674543, 150)
], sceGe_user.prototype, "sceGeGetCmd", null);
__legacyDecorateClassTS([
  nativeFunction(3865884974, 150)
], sceGe_user.prototype, "sceGeGetStack", null);
sceGe_user = __legacyDecorateClassTS([
  hleModule("sceGe_user")
], sceGe_user);
// src/hle/module/sceAudio.ts
class sceAudio {
  name = "sceAudio";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceAudioChReserve() {
    const channel = this.ctx.arg(0);
    const sampleCount = this.ctx.arg(1);
    const format2 = this.ctx.arg(2);
    return this.ctx.audioManager.reserveChannel(channel, sampleCount, format2);
  }
  sceAudioChRelease() {
    const channel = this.ctx.arg(0);
    return this.ctx.audioManager.releaseChannel(channel);
  }
  sceAudioOutput() {
    const channel = this.ctx.arg(0);
    const vol = this.ctx.arg(1);
    const buf = this.ctx.argPtr(2);
    return this.ctx.audioManager.output(channel, vol, buf);
  }
  sceAudioOutputBlocking() {
    const channel = this.ctx.arg(0);
    const vol = this.ctx.arg(1);
    const buf = this.ctx.argPtr(2);
    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }
    const result = this.ctx.audioManager.outputBlocking(channel, vol, buf, thread);
    if (typeof result === "number") {
      return result;
    }
    return result.toPromise();
  }
  sceAudioOutputPanned() {
    const channel = this.ctx.arg(0);
    const leftVol = this.ctx.arg(1);
    const rightVol = this.ctx.arg(2);
    const buf = this.ctx.argPtr(3);
    return this.ctx.audioManager.outputPanned(channel, leftVol, rightVol, buf);
  }
  sceAudioOutputPannedBlocking() {
    const channel = this.ctx.arg(0);
    const leftVol = this.ctx.arg(1);
    const rightVol = this.ctx.arg(2);
    const buf = this.ctx.argPtr(3);
    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }
    const result = this.ctx.audioManager.outputPannedBlocking(channel, leftVol, rightVol, buf, thread);
    if (typeof result === "number") {
      return result;
    }
    return result.toPromise();
  }
  sceAudioGetChannelRestLen() {
    const channel = this.ctx.arg(0);
    return this.ctx.audioManager.getChannelRestLen(channel);
  }
  sceAudioGetChannelRestLength() {
    return this.sceAudioGetChannelRestLen();
  }
  sceAudioSetChannelDataLen() {
    const channel = this.ctx.arg(0);
    const sampleCount = this.ctx.arg(1);
    return this.ctx.audioManager.setChannelDataLen(channel, sampleCount);
  }
  sceAudioChangeChannelConfig() {
    const channel = this.ctx.arg(0);
    const format2 = this.ctx.arg(1);
    return this.ctx.audioManager.changeChannelConfig(channel, format2);
  }
  sceAudioChangeChannelVolume() {
    const channel = this.ctx.arg(0);
    const leftVol = this.ctx.arg(1);
    const rightVol = this.ctx.arg(2);
    return this.ctx.audioManager.setChannelVolume(channel, leftVol, rightVol);
  }
  sceAudioOutput2Reserve() {
    const sampleCount = this.ctx.arg(0);
    return this.ctx.audioManager.reserveOutput2(sampleCount);
  }
  sceAudioOutput2Release() {
    return this.ctx.audioManager.releaseOutput2();
  }
  sceAudioOutput2OutputBlocking() {
    const vol = this.ctx.arg(0);
    const buf = this.ctx.argPtr(1);
    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread) {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }
    const result = this.ctx.audioManager.output2Blocking(vol, buf, thread);
    if (typeof result === "number") {
      return result;
    }
    return result.toPromise();
  }
  sceAudioOutput2GetRestSample() {
    return this.ctx.audioManager.getOutput2RestLen();
  }
  sceAudioOutput2ChangeLength() {
    return SceKernelErrors.ERROR_OK;
  }
  sceAudioSRCChReserve() {
    const sampleCount = this.ctx.arg(0);
    return this.ctx.audioManager.reserveOutput2(sampleCount);
  }
  sceAudioSRCChRelease() {
    return this.ctx.audioManager.releaseOutput2();
  }
  sceAudioSRCOutputBlocking() {
    return this.sceAudioOutput2OutputBlocking();
  }
  sceAudioInputInit() {
    return SceKernelErrors.ERROR_OK;
  }
  sceAudioInputBlocking() {
    return SceKernelErrors.ERROR_OK;
  }
  sceAudioInput() {
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(1590172757, 150)
], sceAudio.prototype, "sceAudioChReserve", null);
__legacyDecorateClassTS([
  nativeFunction(1875142739, 150)
], sceAudio.prototype, "sceAudioChRelease", null);
__legacyDecorateClassTS([
  nativeFunction(2349861298, 150)
], sceAudio.prototype, "sceAudioOutput", null);
__legacyDecorateClassTS([
  nativeFunction(325889873, 150)
], sceAudio.prototype, "sceAudioOutputBlocking", null);
__legacyDecorateClassTS([
  nativeFunction(3805637421, 150)
], sceAudio.prototype, "sceAudioOutputPanned", null);
__legacyDecorateClassTS([
  nativeFunction(334860988, 150)
], sceAudio.prototype, "sceAudioOutputPannedBlocking", null);
__legacyDecorateClassTS([
  nativeFunction(3085031655, 150)
], sceAudio.prototype, "sceAudioGetChannelRestLen", null);
__legacyDecorateClassTS([
  nativeFunction(3923343617, 150)
], sceAudio.prototype, "sceAudioGetChannelRestLength", null);
__legacyDecorateClassTS([
  nativeFunction(3408806814, 150)
], sceAudio.prototype, "sceAudioSetChannelDataLen", null);
__legacyDecorateClassTS([
  nativeFunction(2516388909, 150)
], sceAudio.prototype, "sceAudioChangeChannelConfig", null);
__legacyDecorateClassTS([
  nativeFunction(3085031655, 150)
], sceAudio.prototype, "sceAudioChangeChannelVolume", null);
__legacyDecorateClassTS([
  nativeFunction(22424483, 150)
], sceAudio.prototype, "sceAudioOutput2Reserve", null);
__legacyDecorateClassTS([
  nativeFunction(1125738565, 150)
], sceAudio.prototype, "sceAudioOutput2Release", null);
__legacyDecorateClassTS([
  nativeFunction(760476526, 150)
], sceAudio.prototype, "sceAudioOutput2OutputBlocking", null);
__legacyDecorateClassTS([
  nativeFunction(1685909299, 150)
], sceAudio.prototype, "sceAudioOutput2GetRestSample", null);
__legacyDecorateClassTS([
  nativeFunction(1676839068, 150)
], sceAudio.prototype, "sceAudioOutput2ChangeLength", null);
__legacyDecorateClassTS([
  nativeFunction(945107217, 150)
], sceAudio.prototype, "sceAudioSRCChReserve", null);
__legacyDecorateClassTS([
  nativeFunction(1547157678, 150)
], sceAudio.prototype, "sceAudioSRCChRelease", null);
__legacyDecorateClassTS([
  nativeFunction(3765596246, 150)
], sceAudio.prototype, "sceAudioSRCOutputBlocking", null);
__legacyDecorateClassTS([
  nativeFunction(2112231048, 150)
], sceAudio.prototype, "sceAudioInputInit", null);
__legacyDecorateClassTS([
  nativeFunction(141449365, 150)
], sceAudio.prototype, "sceAudioInputBlocking", null);
__legacyDecorateClassTS([
  nativeFunction(1833692264, 150)
], sceAudio.prototype, "sceAudioInput", null);
sceAudio = __legacyDecorateClassTS([
  hleModule("sceAudio")
], sceAudio);
// src/hle/module/UtilsForUser.ts
var CRC32_TABLE = new Uint32Array(256);
(() => {
  for (let i = 0;i < 256; i++) {
    let c = i;
    for (let j = 0;j < 8; j++) {
      c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    }
    CRC32_TABLE[i] = c >>> 0;
  }
})();
var MT_N = 624;
var MT_M = 397;
var MT_MATRIX_A = 2567483615;
var MT_UPPER_MASK = 2147483648;
var MT_LOWER_MASK = 2147483647;

class UtilsForUser {
  name = "UtilsForUser";
  ctx;
  mt = new Uint32Array(MT_N);
  mti = MT_N + 1;
  init(ctx) {
    this.ctx = ctx;
    this.initMT(Date.now() >>> 0);
  }
  initMT(seed) {
    this.mt[0] = seed >>> 0;
    for (this.mti = 1;this.mti < MT_N; this.mti++) {
      const s = this.mt[this.mti - 1] ^ this.mt[this.mti - 1] >>> 30;
      this.mt[this.mti] = (((s & 4294901760) >>> 16) * 1812433253 << 16) + (s & 65535) * 1812433253 + this.mti >>> 0;
    }
  }
  genrandMT() {
    let y;
    const mag01 = [0, MT_MATRIX_A];
    if (this.mti >= MT_N) {
      let kk;
      for (kk = 0;kk < MT_N - MT_M; kk++) {
        y = this.mt[kk] & MT_UPPER_MASK | this.mt[kk + 1] & MT_LOWER_MASK;
        this.mt[kk] = this.mt[kk + MT_M] ^ y >>> 1 ^ mag01[y & 1];
      }
      for (;kk < MT_N - 1; kk++) {
        y = this.mt[kk] & MT_UPPER_MASK | this.mt[kk + 1] & MT_LOWER_MASK;
        this.mt[kk] = this.mt[kk + (MT_M - MT_N)] ^ y >>> 1 ^ mag01[y & 1];
      }
      y = this.mt[MT_N - 1] & MT_UPPER_MASK | this.mt[0] & MT_LOWER_MASK;
      this.mt[MT_N - 1] = this.mt[MT_M - 1] ^ y >>> 1 ^ mag01[y & 1];
      this.mti = 0;
    }
    y = this.mt[this.mti++];
    y ^= y >>> 11;
    y ^= y << 7 & 2636928640;
    y ^= y << 15 & 4022730752;
    y ^= y >>> 18;
    return y >>> 0;
  }
  sceKernelLibcTime() {
    const timePtr = this.ctx.argPtr(0);
    const time = Math.floor(Date.now() / 1000);
    if (timePtr) {
      this.ctx.write32(timePtr, time);
    }
    return time;
  }
  sceKernelLibcClock() {
    return Date.now() * 1000 >>> 0;
  }
  sceKernelLibcGettimeofday() {
    const tvPtr = this.ctx.argPtr(0);
    if (tvPtr) {
      const now = Date.now();
      const sec = Math.floor(now / 1000);
      const usec = now % 1000 * 1000;
      this.ctx.write32(tvPtr, sec);
      this.ctx.write32(tvPtr + 4, usec);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelGetSystemTime() {
    const timePtr = this.ctx.argPtr(0);
    if (timePtr) {
      const time = BigInt(Date.now()) * 1000n;
      const low = Number(time & 0xFFFFFFFFn);
      const high = Number(time >> 32n & 0xFFFFFFFFn);
      this.ctx.write32(timePtr, low);
      this.ctx.write32(timePtr + 4, high);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelGetSystemTimeLow() {
    return Date.now() * 1000 >>> 0;
  }
  sceKernelGetSystemTimeWide() {
    const time = BigInt(Date.now()) * 1000n;
    const low = Number(time & 0xFFFFFFFFn);
    const high = Number(time >> 32n & 0xFFFFFFFFn);
    this.ctx.setReturnValue64(low, high);
    return low;
  }
  sceKernelDcacheWritebackAll() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelDcacheWritebackInvalidateAll() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelDcacheWritebackRange() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelDcacheWritebackInvalidateRange() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelDcacheInvalidateRange() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelIcacheInvalidateAll() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelIcacheInvalidateRange() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelUtilsMt19937Init() {
    const seed = this.ctx.arg(1);
    this.initMT(seed);
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelUtilsMt19937UInt() {
    return this.genrandMT();
  }
  sceKernelUtilsMd5Digest() {
    const digestPtr = this.ctx.argPtr(2);
    for (let i = 0;i < 16; i++) {
      this.ctx.write8(digestPtr + i, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelUtilsMd5BlockInit() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelUtilsMd5BlockUpdate() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelUtilsMd5BlockResult() {
    const digestPtr = this.ctx.argPtr(1);
    for (let i = 0;i < 16; i++) {
      this.ctx.write8(digestPtr + i, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelUtilsSha1Digest() {
    const digestPtr = this.ctx.argPtr(2);
    for (let i = 0;i < 20; i++) {
      this.ctx.write8(digestPtr + i, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelUtilsSha1BlockInit() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelUtilsSha1BlockUpdate() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelUtilsSha1BlockResult() {
    const digestPtr = this.ctx.argPtr(1);
    for (let i = 0;i < 20; i++) {
      this.ctx.write8(digestPtr + i, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelDeflateDecompress() {
    return SceKernelErrors.ERROR_NOT_SUPPORTED;
  }
  sceKernelGzipDecompress() {
    return SceKernelErrors.ERROR_NOT_SUPPORTED;
  }
}
__legacyDecorateClassTS([
  nativeFunction(667703280, 150)
], UtilsForUser.prototype, "sceKernelLibcTime", null);
__legacyDecorateClassTS([
  nativeFunction(2447701671, 150)
], UtilsForUser.prototype, "sceKernelLibcClock", null);
__legacyDecorateClassTS([
  nativeFunction(1911308913, 150)
], UtilsForUser.prototype, "sceKernelLibcGettimeofday", null);
__legacyDecorateClassTS([
  nativeFunction(3127584944, 150)
], UtilsForUser.prototype, "sceKernelGetSystemTime", null);
__legacyDecorateClassTS([
  nativeFunction(916379037, 150)
], UtilsForUser.prototype, "sceKernelGetSystemTimeLow", null);
__legacyDecorateClassTS([
  nativeFunction(2193381239, 150)
], UtilsForUser.prototype, "sceKernelGetSystemTimeWide", null);
__legacyDecorateClassTS([
  nativeFunction(2043790330, 150)
], UtilsForUser.prototype, "sceKernelDcacheWritebackAll", null);
__legacyDecorateClassTS([
  nativeFunction(3023429317, 150)
], UtilsForUser.prototype, "sceKernelDcacheWritebackInvalidateAll", null);
__legacyDecorateClassTS([
  nativeFunction(1055066145, 150)
], UtilsForUser.prototype, "sceKernelDcacheWritebackRange", null);
__legacyDecorateClassTS([
  nativeFunction(884603550, 150)
], UtilsForUser.prototype, "sceKernelDcacheWritebackInvalidateRange", null);
__legacyDecorateClassTS([
  nativeFunction(3215556706, 150)
], UtilsForUser.prototype, "sceKernelDcacheInvalidateRange", null);
__legacyDecorateClassTS([
  nativeFunction(2450460746, 150)
], UtilsForUser.prototype, "sceKernelIcacheInvalidateAll", null);
__legacyDecorateClassTS([
  nativeFunction(3269424910, 150)
], UtilsForUser.prototype, "sceKernelIcacheInvalidateRange", null);
__legacyDecorateClassTS([
  nativeFunction(3898664798, 150)
], UtilsForUser.prototype, "sceKernelUtilsMt19937Init", null);
__legacyDecorateClassTS([
  nativeFunction(117148259, 150)
], UtilsForUser.prototype, "sceKernelUtilsMt19937UInt", null);
__legacyDecorateClassTS([
  nativeFunction(3357043288, 150)
], UtilsForUser.prototype, "sceKernelUtilsMd5Digest", null);
__legacyDecorateClassTS([
  nativeFunction(2656850054, 150)
], UtilsForUser.prototype, "sceKernelUtilsMd5BlockInit", null);
__legacyDecorateClassTS([
  nativeFunction(1642194213, 150)
], UtilsForUser.prototype, "sceKernelUtilsMd5BlockUpdate", null);
__legacyDecorateClassTS([
  nativeFunction(3100790392, 150)
], UtilsForUser.prototype, "sceKernelUtilsMd5BlockResult", null);
__legacyDecorateClassTS([
  nativeFunction(2214746609, 150)
], UtilsForUser.prototype, "sceKernelUtilsSha1Digest", null);
__legacyDecorateClassTS([
  nativeFunction(4177319354, 150)
], UtilsForUser.prototype, "sceKernelUtilsSha1BlockInit", null);
__legacyDecorateClassTS([
  nativeFunction(879717800, 150)
], UtilsForUser.prototype, "sceKernelUtilsSha1BlockUpdate", null);
__legacyDecorateClassTS([
  nativeFunction(1482628105, 150)
], UtilsForUser.prototype, "sceKernelUtilsSha1BlockResult", null);
__legacyDecorateClassTS([
  nativeFunction(2022918209, 150)
], UtilsForUser.prototype, "sceKernelDeflateDecompress", null);
__legacyDecorateClassTS([
  nativeFunction(3906682086, 150)
], UtilsForUser.prototype, "sceKernelGzipDecompress", null);
UtilsForUser = __legacyDecorateClassTS([
  hleModule("UtilsForUser")
], UtilsForUser);
// src/hle/module/LoadExecForUser.ts
class LoadExecForUser {
  name = "LoadExecForUser";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceKernelExitGame() {
    this.ctx.log("sceKernelExitGame called - stopping emulator");
    this.ctx.stop();
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelExitGameWithStatus() {
    const status = this.ctx.arg(0);
    this.ctx.log(`sceKernelExitGameWithStatus(${status}) - stopping emulator`);
    this.ctx.stop();
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelRegisterExitCallback() {
    const cbid = this.ctx.arg(0);
    this.ctx.log(`sceKernelRegisterExitCallback(${cbid})`);
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelLoadExec() {
    const filePtr = this.ctx.argPtr(0);
    const file = this.ctx.readString(filePtr);
    this.ctx.log(`sceKernelLoadExec("${file}") - not implemented`);
    return SceKernelErrors.ERROR_NOT_SUPPORTED;
  }
  sceKernelLoadExecVSHMs2() {
    return this.sceKernelLoadExec();
  }
  sceKernelLoadExecVSHDisc() {
    return this.sceKernelLoadExec();
  }
}
__legacyDecorateClassTS([
  nativeFunction(89598559, 150)
], LoadExecForUser.prototype, "sceKernelExitGame", null);
__legacyDecorateClassTS([
  nativeFunction(717854027, 150)
], LoadExecForUser.prototype, "sceKernelExitGameWithStatus", null);
__legacyDecorateClassTS([
  nativeFunction(1254455619, 150)
], LoadExecForUser.prototype, "sceKernelRegisterExitCallback", null);
__legacyDecorateClassTS([
  nativeFunction(3173978260, 150)
], LoadExecForUser.prototype, "sceKernelLoadExec", null);
__legacyDecorateClassTS([
  nativeFunction(3522908380, 150)
], LoadExecForUser.prototype, "sceKernelLoadExecVSHMs2", null);
__legacyDecorateClassTS([
  nativeFunction(3627158056, 150)
], LoadExecForUser.prototype, "sceKernelLoadExecVSHDisc", null);
LoadExecForUser = __legacyDecorateClassTS([
  hleModule("LoadExecForUser")
], LoadExecForUser);
// src/hle/module/Kernel_Library.ts
class Kernel_Library {
  name = "Kernel_Library";
  ctx;
  interruptsEnabled = true;
  interruptNestCount = 0;
  cpuLockCount = 0;
  init(ctx) {
    this.ctx = ctx;
  }
  sceKernelCpuSuspendIntr() {
    const prevState = this.interruptsEnabled ? 1 : 0;
    this.interruptsEnabled = false;
    this.interruptNestCount++;
    return prevState;
  }
  sceKernelCpuResumeIntr() {
    const state = this.ctx.arg(0);
    if (this.interruptNestCount > 0) {
      this.interruptNestCount--;
    }
    if (this.interruptNestCount === 0) {
      this.interruptsEnabled = state !== 0;
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelCpuResumeIntrWithSync() {
    return this.sceKernelCpuResumeIntr();
  }
  sceKernelIsCpuIntrEnable() {
    return this.interruptsEnabled ? 1 : 0;
  }
  sceKernelIsCpuIntrSuspended() {
    const state = this.ctx.arg(0);
    return state === 0 ? 1 : 0;
  }
  sceKernelLockLwMutex() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelLockLwMutexCB() {
    return this.sceKernelLockLwMutex();
  }
  sceKernelTryLockLwMutex() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelUnlockLwMutex() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelReferLwMutexStatus() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelMemoryExtendSize() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelMemoryShrinkSize() {
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(153708788, 150)
], Kernel_Library.prototype, "sceKernelCpuSuspendIntr", null);
__legacyDecorateClassTS([
  nativeFunction(1594938374, 150)
], Kernel_Library.prototype, "sceKernelCpuResumeIntr", null);
__legacyDecorateClassTS([
  nativeFunction(998535981, 150)
], Kernel_Library.prototype, "sceKernelCpuResumeIntrWithSync", null);
__legacyDecorateClassTS([
  nativeFunction(3042068946, 150)
], Kernel_Library.prototype, "sceKernelIsCpuIntrEnable", null);
__legacyDecorateClassTS([
  nativeFunction(2693393572, 150)
], Kernel_Library.prototype, "sceKernelIsCpuIntrSuspended", null);
__legacyDecorateClassTS([
  nativeFunction(3198444569, 150)
], Kernel_Library.prototype, "sceKernelLockLwMutex", null);
__legacyDecorateClassTS([
  nativeFunction(533089801, 150)
], Kernel_Library.prototype, "sceKernelLockLwMutexCB", null);
__legacyDecorateClassTS([
  nativeFunction(3697880803, 150)
], Kernel_Library.prototype, "sceKernelTryLockLwMutex", null);
__legacyDecorateClassTS([
  nativeFunction(364266603, 150)
], Kernel_Library.prototype, "sceKernelUnlockLwMutex", null);
__legacyDecorateClassTS([
  nativeFunction(3245557145, 150)
], Kernel_Library.prototype, "sceKernelReferLwMutexStatus", null);
__legacyDecorateClassTS([
  nativeFunction(3635583406, 150)
], Kernel_Library.prototype, "sceKernelMemoryExtendSize", null);
__legacyDecorateClassTS([
  nativeFunction(4001074134, 150)
], Kernel_Library.prototype, "sceKernelMemoryShrinkSize", null);
Kernel_Library = __legacyDecorateClassTS([
  hleModule("Kernel_Library")
], Kernel_Library);
// src/hle/module/sceUtility.ts
class sceUtility {
  name = "sceUtility";
  ctx;
  savedataStatus = 0 /* None */;
  msgDialogStatus = 0 /* None */;
  oskStatus = 0 /* None */;
  netconfStatus = 0 /* None */;
  msgDialogResult = 0 /* None */;
  init(ctx) {
    this.ctx = ctx;
  }
  sceUtilityGetSystemParamInt() {
    const id = this.ctx.arg(0);
    const valuePtr = this.ctx.argPtr(1);
    let value = 0;
    switch (id) {
      case 2 /* AdhocChannel */:
        value = 0;
        break;
      case 3 /* WlanPowerSave */:
        value = 1;
        break;
      case 4 /* DateFormat */:
        value = 1;
        break;
      case 5 /* TimeFormat */:
        value = 0;
        break;
      case 6 /* Timezone */:
        value = 0;
        break;
      case 7 /* DaylightSavings */:
        value = 0;
        break;
      case 8 /* Language */:
        value = 1 /* English */;
        break;
      default:
        return SceKernelErrors.ERROR_UTILITY_INVALID_SYSTEM_PARAM_ID;
    }
    this.ctx.write32(valuePtr, value);
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilityGetSystemParamString() {
    const id = this.ctx.arg(0);
    const strPtr = this.ctx.argPtr(1);
    const len = this.ctx.arg(2);
    let str = "";
    switch (id) {
      case 1 /* StringNickname */:
        str = "Player";
        break;
      default:
        return SceKernelErrors.ERROR_UTILITY_INVALID_SYSTEM_PARAM_ID;
    }
    for (let i = 0;i < Math.min(str.length, len - 1); i++) {
      this.ctx.write8(strPtr + i, str.charCodeAt(i));
    }
    this.ctx.write8(strPtr + Math.min(str.length, len - 1), 0);
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilitySavedataInitStart() {
    this.savedataStatus = 1 /* Init */;
    setTimeout(() => {
      this.savedataStatus = 3 /* Finished */;
    }, 100);
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilitySavedataGetStatus() {
    return this.savedataStatus;
  }
  sceUtilitySavedataShutdownStart() {
    this.savedataStatus = 4 /* Shutdown */;
    setTimeout(() => {
      this.savedataStatus = 0 /* None */;
    }, 50);
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilitySavedataUpdate() {
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilityMsgDialogInitStart() {
    this.msgDialogStatus = 1 /* Init */;
    this.msgDialogResult = 1 /* OK */;
    setTimeout(() => {
      this.msgDialogStatus = 3 /* Finished */;
    }, 100);
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilityMsgDialogGetStatus() {
    return this.msgDialogStatus;
  }
  sceUtilityMsgDialogShutdownStart() {
    this.msgDialogStatus = 4 /* Shutdown */;
    setTimeout(() => {
      this.msgDialogStatus = 0 /* None */;
    }, 50);
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilityMsgDialogUpdate() {
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilityMsgDialogAbort() {
    this.msgDialogResult = 3 /* Abort */;
    this.msgDialogStatus = 3 /* Finished */;
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilityOskInitStart() {
    this.oskStatus = 1 /* Init */;
    setTimeout(() => {
      this.oskStatus = 3 /* Finished */;
    }, 100);
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilityOskGetStatus() {
    return this.oskStatus;
  }
  sceUtilityOskShutdownStart() {
    this.oskStatus = 4 /* Shutdown */;
    setTimeout(() => {
      this.oskStatus = 0 /* None */;
    }, 50);
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilityOskUpdate() {
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilityNetconfInitStart() {
    this.netconfStatus = 1 /* Init */;
    setTimeout(() => {
      this.netconfStatus = 3 /* Finished */;
    }, 100);
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilityNetconfGetStatus() {
    return this.netconfStatus;
  }
  sceUtilityNetconfShutdownStart() {
    this.netconfStatus = 4 /* Shutdown */;
    setTimeout(() => {
      this.netconfStatus = 0 /* None */;
    }, 50);
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilityNetconfUpdate() {
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilityLoadModule() {
    const module = this.ctx.arg(0);
    this.ctx.log(`sceUtilityLoadModule(${module})`);
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilityUnloadModule() {
    const module = this.ctx.arg(0);
    this.ctx.log(`sceUtilityUnloadModule(${module})`);
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilityLoadNetModule() {
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilityUnloadNetModule() {
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilityLoadAvModule() {
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilityUnloadAvModule() {
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilityLoadUsbModule() {
    return SceKernelErrors.ERROR_OK;
  }
  sceUtilityUnloadUsbModule() {
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(2782536710, 150)
], sceUtility.prototype, "sceUtilityGetSystemParamInt", null);
__legacyDecorateClassTS([
  nativeFunction(884441923, 150)
], sceUtility.prototype, "sceUtilityGetSystemParamString", null);
__legacyDecorateClassTS([
  nativeFunction(1355074903, 150)
], sceUtility.prototype, "sceUtilitySavedataInitStart", null);
__legacyDecorateClassTS([
  nativeFunction(2289359840, 150)
], sceUtility.prototype, "sceUtilitySavedataGetStatus", null);
__legacyDecorateClassTS([
  nativeFunction(2542842684, 150)
], sceUtility.prototype, "sceUtilitySavedataShutdownStart", null);
__legacyDecorateClassTS([
  nativeFunction(3568918523, 150)
], sceUtility.prototype, "sceUtilitySavedataUpdate", null);
__legacyDecorateClassTS([
  nativeFunction(718856761, 150)
], sceUtility.prototype, "sceUtilityMsgDialogInitStart", null);
__legacyDecorateClassTS([
  nativeFunction(2585563607, 150)
], sceUtility.prototype, "sceUtilityMsgDialogGetStatus", null);
__legacyDecorateClassTS([
  nativeFunction(1739535400, 150)
], sceUtility.prototype, "sceUtilityMsgDialogShutdownStart", null);
__legacyDecorateClassTS([
  nativeFunction(2516329787, 150)
], sceUtility.prototype, "sceUtilityMsgDialogUpdate", null);
__legacyDecorateClassTS([
  nativeFunction(1227406742, 150)
], sceUtility.prototype, "sceUtilityMsgDialogAbort", null);
__legacyDecorateClassTS([
  nativeFunction(4129725314, 150)
], sceUtility.prototype, "sceUtilityOskInitStart", null);
__legacyDecorateClassTS([
  nativeFunction(13743626, 150)
], sceUtility.prototype, "sceUtilityOskGetStatus", null);
__legacyDecorateClassTS([
  nativeFunction(1039854505, 150)
], sceUtility.prototype, "sceUtilityOskShutdownStart", null);
__legacyDecorateClassTS([
  nativeFunction(1267058785, 150)
], sceUtility.prototype, "sceUtilityOskUpdate", null);
__legacyDecorateClassTS([
  nativeFunction(1303504697, 150)
], sceUtility.prototype, "sceUtilityNetconfInitStart", null);
__legacyDecorateClassTS([
  nativeFunction(1664264761, 150)
], sceUtility.prototype, "sceUtilityNetconfGetStatus", null);
__legacyDecorateClassTS([
  nativeFunction(4169225718, 150)
], sceUtility.prototype, "sceUtilityNetconfShutdownStart", null);
__legacyDecorateClassTS([
  nativeFunction(2447838773, 150)
], sceUtility.prototype, "sceUtilityNetconfUpdate", null);
__legacyDecorateClassTS([
  nativeFunction(707476960, 150)
], sceUtility.prototype, "sceUtilityLoadModule", null);
__legacyDecorateClassTS([
  nativeFunction(3835428498, 150)
], sceUtility.prototype, "sceUtilityUnloadModule", null);
__legacyDecorateClassTS([
  nativeFunction(360292697, 150)
], sceUtility.prototype, "sceUtilityLoadNetModule", null);
__legacyDecorateClassTS([
  nativeFunction(1691683926, 150)
], sceUtility.prototype, "sceUtilityUnloadNetModule", null);
__legacyDecorateClassTS([
  nativeFunction(3324620582, 150)
], sceUtility.prototype, "sceUtilityLoadAvModule", null);
__legacyDecorateClassTS([
  nativeFunction(4158181522, 150)
], sceUtility.prototype, "sceUtilityUnloadAvModule", null);
__legacyDecorateClassTS([
  nativeFunction(224118482, 150)
], sceUtility.prototype, "sceUtilityLoadUsbModule", null);
__legacyDecorateClassTS([
  nativeFunction(4131983600, 150)
], sceUtility.prototype, "sceUtilityUnloadUsbModule", null);
sceUtility = __legacyDecorateClassTS([
  hleModule("sceUtility")
], sceUtility);
// src/hle/module/sceAtrac3plus.ts
var MAX_ATRAC_IDS = 6;
var ATRAC3P_FRAME_SAMPLES = 2048;
var ATRAC3_FRAME_SAMPLES = 1024;
function createAtracInstance(id) {
  return {
    id,
    inUse: false,
    codecType: 4096 /* AT3Plus */,
    dataPtr: 0,
    bufferSize: 0,
    channels: 2,
    sampleRate: 44100,
    bitrate: 128,
    bytesPerFrame: 2048,
    currentSample: 0,
    endSample: 0,
    loopStartSample: -1,
    loopEndSample: -1,
    numLoops: 0,
    readOffset: 0,
    dataSize: 0,
    secondBufferNeeded: false,
    secondBufferSet: false,
    secondBufferPtr: 0,
    secondBufferSize: 0
  };
}

class sceAtrac3plus {
  name = "sceAtrac3plus";
  ctx;
  instances = [];
  init(ctx) {
    this.ctx = ctx;
    this.instances = [];
    for (let i = 0;i < MAX_ATRAC_IDS; i++) {
      this.instances.push(createAtracInstance(i));
    }
  }
  getMaxSamples(codecType) {
    switch (codecType) {
      case 4097 /* AT3 */:
        return ATRAC3_FRAME_SAMPLES;
      case 4096 /* AT3Plus */:
        return ATRAC3P_FRAME_SAMPLES;
      default:
        return 0;
    }
  }
  getInstance(id) {
    if (id < 0 || id >= MAX_ATRAC_IDS) {
      return null;
    }
    return this.instances[id];
  }
  findFreeInstance() {
    for (const inst of this.instances) {
      if (!inst.inUse) {
        return inst;
      }
    }
    return null;
  }
  parseRiffHeader(dataPtr, bufferSize, inst) {
    const riff = this.ctx.read32(dataPtr);
    if (riff !== 1179011410) {
      return SceKernelErrors.ERROR_ATRAC_UNKNOWN_FORMAT;
    }
    const wave = this.ctx.read32(dataPtr + 8);
    if (wave !== 1163280727) {
      return SceKernelErrors.ERROR_ATRAC_UNKNOWN_FORMAT;
    }
    let offset = 12;
    while (offset < bufferSize - 8) {
      const chunkId = this.ctx.read32(dataPtr + offset);
      const chunkSize = this.ctx.read32(dataPtr + offset + 4);
      if (chunkId === 544501094) {
        const format2 = this.ctx.read16(dataPtr + offset + 8);
        inst.channels = this.ctx.read16(dataPtr + offset + 10);
        inst.sampleRate = this.ctx.read32(dataPtr + offset + 12);
        inst.bitrate = Math.floor(this.ctx.read32(dataPtr + offset + 16) * 8 / 1000);
        if (format2 === 65534) {
          inst.codecType = 4096 /* AT3Plus */;
        } else if (format2 === 624) {
          inst.codecType = 4097 /* AT3 */;
        }
      } else if (chunkId === 1635017060) {
        inst.dataSize = chunkSize;
        inst.readOffset = offset + 8;
        break;
      }
      offset += 8 + chunkSize;
      if (chunkSize & 1) {
        offset++;
      }
    }
    if (inst.bytesPerFrame > 0) {
      const frameCount = Math.floor(inst.dataSize / inst.bytesPerFrame);
      inst.endSample = frameCount * this.getMaxSamples(inst.codecType);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceAtracGetAtracID() {
    const codecType = this.ctx.arg(0);
    if (codecType !== 4097 /* AT3 */ && codecType !== 4096 /* AT3Plus */) {
      return SceKernelErrors.ERROR_ATRAC_INVALID_CODECTYPE;
    }
    const inst = this.findFreeInstance();
    if (!inst) {
      return SceKernelErrors.ERROR_ATRAC_NO_ID;
    }
    inst.inUse = true;
    inst.codecType = codecType;
    return inst.id;
  }
  sceAtracReleaseAtracID() {
    const atID = this.ctx.arg(0);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    Object.assign(inst, createAtracInstance(atID));
    return SceKernelErrors.ERROR_OK;
  }
  sceAtracSetDataAndGetID() {
    const dataPtr = this.ctx.argPtr(0);
    const bufferSize = this.ctx.arg(1);
    const inst = this.findFreeInstance();
    if (!inst) {
      return SceKernelErrors.ERROR_ATRAC_NO_ID;
    }
    inst.inUse = true;
    inst.dataPtr = dataPtr;
    inst.bufferSize = bufferSize;
    const result = this.parseRiffHeader(dataPtr, bufferSize, inst);
    if (result < 0) {
      inst.inUse = false;
      return result;
    }
    this.ctx.log(`sceAtracSetDataAndGetID: id=${inst.id}, channels=${inst.channels}, rate=${inst.sampleRate}`);
    return inst.id;
  }
  sceAtracSetData() {
    const atID = this.ctx.arg(0);
    const dataPtr = this.ctx.argPtr(1);
    const bufferSize = this.ctx.arg(2);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    inst.dataPtr = dataPtr;
    inst.bufferSize = bufferSize;
    return this.parseRiffHeader(dataPtr, bufferSize, inst);
  }
  sceAtracSetHalfwayBuffer() {
    const atID = this.ctx.arg(0);
    const dataPtr = this.ctx.argPtr(1);
    const readSize = this.ctx.arg(2);
    const bufferSize = this.ctx.arg(3);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    inst.dataPtr = dataPtr;
    inst.bufferSize = bufferSize;
    return this.parseRiffHeader(dataPtr, readSize, inst);
  }
  sceAtracSetHalfwayBufferAndGetID() {
    const dataPtr = this.ctx.argPtr(0);
    const readSize = this.ctx.arg(1);
    const bufferSize = this.ctx.arg(2);
    const inst = this.findFreeInstance();
    if (!inst) {
      return SceKernelErrors.ERROR_ATRAC_NO_ID;
    }
    inst.inUse = true;
    inst.dataPtr = dataPtr;
    inst.bufferSize = bufferSize;
    const result = this.parseRiffHeader(dataPtr, readSize, inst);
    if (result < 0) {
      inst.inUse = false;
      return result;
    }
    return inst.id;
  }
  sceAtracDecodeData() {
    const atID = this.ctx.arg(0);
    const samplesPtr = this.ctx.argPtr(1);
    const samplesNbrPtr = this.ctx.argPtr(2);
    const outEndPtr = this.ctx.argPtr(3);
    const remainFramesPtr = this.ctx.argPtr(4);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    if (inst.secondBufferNeeded && !inst.secondBufferSet) {
      return SceKernelErrors.ERROR_ATRAC_SECOND_BUFFER_NEEDED;
    }
    const maxSamples = this.getMaxSamples(inst.codecType);
    const remainingSamples = inst.endSample - inst.currentSample;
    const samplesToOutput = Math.min(maxSamples, remainingSamples);
    for (let i = 0;i < samplesToOutput * inst.channels; i++) {
      this.ctx.write16(samplesPtr + i * 2, 0);
    }
    inst.currentSample += samplesToOutput;
    const remainFrames = inst.bytesPerFrame > 0 ? Math.floor((inst.dataSize - inst.readOffset) / inst.bytesPerFrame) : 0;
    if (samplesNbrPtr) {
      this.ctx.write32(samplesNbrPtr, samplesToOutput);
    }
    if (outEndPtr) {
      this.ctx.write32(outEndPtr, inst.currentSample >= inst.endSample ? 1 : 0);
    }
    if (remainFramesPtr) {
      this.ctx.write32(remainFramesPtr, remainFrames);
    }
    return new Promise((resolve) => {
      setTimeout(() => resolve(SceKernelErrors.ERROR_OK), 2);
    });
  }
  sceAtracGetRemainFrame() {
    const atID = this.ctx.arg(0);
    const remainFramePtr = this.ctx.argPtr(1);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    const remainFrames = inst.bytesPerFrame > 0 ? Math.floor((inst.dataSize - inst.readOffset) / inst.bytesPerFrame) : -1;
    if (remainFramePtr) {
      this.ctx.write32(remainFramePtr, remainFrames);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceAtracGetStreamDataInfo() {
    const atID = this.ctx.arg(0);
    const writePointerPtr = this.ctx.argPtr(1);
    const availableBytesPtr = this.ctx.argPtr(2);
    const readOffsetPtr = this.ctx.argPtr(3);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    if (writePointerPtr) {
      this.ctx.write32(writePointerPtr, inst.dataPtr + inst.readOffset);
    }
    if (availableBytesPtr) {
      this.ctx.write32(availableBytesPtr, 0);
    }
    if (readOffsetPtr) {
      this.ctx.write32(readOffsetPtr, inst.readOffset);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceAtracAddStreamData() {
    const atID = this.ctx.arg(0);
    const bytesToAdd = this.ctx.arg(1);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceAtracGetNextDecodePosition() {
    const atID = this.ctx.arg(0);
    const samplePositionPtr = this.ctx.argPtr(1);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    if (inst.currentSample >= inst.endSample) {
      return SceKernelErrors.ERROR_ATRAC_ALL_DATA_DECODED;
    }
    if (samplePositionPtr) {
      this.ctx.write32(samplePositionPtr, inst.currentSample);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceAtracGetSoundSample() {
    const atID = this.ctx.arg(0);
    const endSamplePtr = this.ctx.argPtr(1);
    const loopStartSamplePtr = this.ctx.argPtr(2);
    const loopEndSamplePtr = this.ctx.argPtr(3);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    if (endSamplePtr) {
      this.ctx.write32(endSamplePtr, inst.endSample);
    }
    if (loopStartSamplePtr) {
      this.ctx.write32(loopStartSamplePtr, inst.loopStartSample);
    }
    if (loopEndSamplePtr) {
      this.ctx.write32(loopEndSamplePtr, inst.loopEndSample);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceAtracGetBitrate() {
    const atID = this.ctx.arg(0);
    const bitratePtr = this.ctx.argPtr(1);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    if (bitratePtr) {
      this.ctx.write32(bitratePtr, inst.bitrate);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceAtracGetChannel() {
    const atID = this.ctx.arg(0);
    const channelsPtr = this.ctx.argPtr(1);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    if (channelsPtr) {
      this.ctx.write32(channelsPtr, inst.channels);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceAtracGetMaxSample() {
    const atID = this.ctx.arg(0);
    const maxSamplesPtr = this.ctx.argPtr(1);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    if (maxSamplesPtr) {
      this.ctx.write32(maxSamplesPtr, this.getMaxSamples(inst.codecType));
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceAtracGetNextSample() {
    const atID = this.ctx.arg(0);
    const nextSamplesPtr = this.ctx.argPtr(1);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    const maxSamples = this.getMaxSamples(inst.codecType);
    const remaining = inst.endSample - inst.currentSample;
    const nextSamples = Math.min(maxSamples, remaining);
    if (nextSamplesPtr) {
      this.ctx.write32(nextSamplesPtr, nextSamples);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceAtracSetLoopNum() {
    const atID = this.ctx.arg(0);
    const numLoops = this.ctx.arg(1);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    inst.numLoops = numLoops;
    return SceKernelErrors.ERROR_OK;
  }
  sceAtracGetLoopStatus() {
    const atID = this.ctx.arg(0);
    const loopNumPtr = this.ctx.argPtr(1);
    const statusPtr = this.ctx.argPtr(2);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    if (loopNumPtr) {
      this.ctx.write32(loopNumPtr, inst.numLoops);
    }
    if (statusPtr) {
      this.ctx.write32(statusPtr, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceAtracGetSecondBufferInfo() {
    const atID = this.ctx.arg(0);
    const positionPtr = this.ctx.argPtr(1);
    const dataBytesPtr = this.ctx.argPtr(2);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    if (!inst.secondBufferNeeded) {
      if (positionPtr) {
        this.ctx.write32(positionPtr, 0);
      }
      if (dataBytesPtr) {
        this.ctx.write32(dataBytesPtr, 0);
      }
      return SceKernelErrors.ERROR_ATRAC_SECOND_BUFFER_NOT_NEEDED;
    }
    if (positionPtr) {
      this.ctx.write32(positionPtr, inst.secondBufferPtr);
    }
    if (dataBytesPtr) {
      this.ctx.write32(dataBytesPtr, inst.secondBufferSize);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceAtracSetSecondBuffer() {
    const atID = this.ctx.arg(0);
    const bufferPtr = this.ctx.argPtr(1);
    const bufferSize = this.ctx.arg(2);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    inst.secondBufferPtr = bufferPtr;
    inst.secondBufferSize = bufferSize;
    inst.secondBufferSet = true;
    return SceKernelErrors.ERROR_OK;
  }
  sceAtracGetBufferInfoForReseting() {
    const atID = this.ctx.arg(0);
    const sample = this.ctx.arg(1);
    const bufferInfoPtr = this.ctx.argPtr(2);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    if (bufferInfoPtr) {
      for (let i = 0;i < 8; i++) {
        this.ctx.write32(bufferInfoPtr + i * 4, 0);
      }
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceAtracResetPlayPosition() {
    const atID = this.ctx.arg(0);
    const sample = this.ctx.arg(1);
    const writeByteFirstBuf = this.ctx.arg(2);
    const writeByteSecondBuf = this.ctx.arg(3);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    inst.currentSample = sample;
    return SceKernelErrors.ERROR_OK;
  }
  sceAtracGetOutputChannel() {
    const atID = this.ctx.arg(0);
    const outputChannelPtr = this.ctx.argPtr(1);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    const channel = this.ctx.audioManager.reserveChannel(-1, this.getMaxSamples(inst.codecType), 0);
    if (outputChannelPtr) {
      this.ctx.write32(outputChannelPtr, channel);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceAtracGetInternalErrorInfo() {
    const atID = this.ctx.arg(0);
    const errorResultPtr = this.ctx.argPtr(1);
    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse) {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }
    if (errorResultPtr) {
      this.ctx.write32(errorResultPtr, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(2014283985, 150)
], sceAtrac3plus.prototype, "sceAtracGetAtracID", null);
__legacyDecorateClassTS([
  nativeFunction(1642804213, 150)
], sceAtrac3plus.prototype, "sceAtracReleaseAtracID", null);
__legacyDecorateClassTS([
  nativeFunction(2048976815, 150)
], sceAtrac3plus.prototype, "sceAtracSetDataAndGetID", null);
__legacyDecorateClassTS([
  nativeFunction(237663147, 150)
], sceAtrac3plus.prototype, "sceAtracSetData", null);
__legacyDecorateClassTS([
  nativeFunction(1064183477, 150)
], sceAtrac3plus.prototype, "sceAtracSetHalfwayBuffer", null);
__legacyDecorateClassTS([
  nativeFunction(263075598, 150)
], sceAtrac3plus.prototype, "sceAtracSetHalfwayBufferAndGetID", null);
__legacyDecorateClassTS([
  nativeFunction(1787575509, 150)
], sceAtrac3plus.prototype, "sceAtracDecodeData", null);
__legacyDecorateClassTS([
  nativeFunction(2598914471, 150)
], sceAtrac3plus.prototype, "sceAtracGetRemainFrame", null);
__legacyDecorateClassTS([
  nativeFunction(1562806023, 150)
], sceAtrac3plus.prototype, "sceAtracGetStreamDataInfo", null);
__legacyDecorateClassTS([
  nativeFunction(2108887633, 150)
], sceAtrac3plus.prototype, "sceAtracAddStreamData", null);
__legacyDecorateClassTS([
  nativeFunction(3795728949, 150)
], sceAtrac3plus.prototype, "sceAtracGetNextDecodePosition", null);
__legacyDecorateClassTS([
  nativeFunction(2730207422, 150)
], sceAtrac3plus.prototype, "sceAtracGetSoundSample", null);
__legacyDecorateClassTS([
  nativeFunction(2773786968, 150)
], sceAtrac3plus.prototype, "sceAtracGetBitrate", null);
__legacyDecorateClassTS([
  nativeFunction(828804010, 150)
], sceAtrac3plus.prototype, "sceAtracGetChannel", null);
__legacyDecorateClassTS([
  nativeFunction(3601199863, 150)
], sceAtrac3plus.prototype, "sceAtracGetMaxSample", null);
__legacyDecorateClassTS([
  nativeFunction(922397691, 150)
], sceAtrac3plus.prototype, "sceAtracGetNextSample", null);
__legacyDecorateClassTS([
  nativeFunction(2256609461, 150)
], sceAtrac3plus.prototype, "sceAtracSetLoopNum", null);
__legacyDecorateClassTS([
  nativeFunction(4205115547, 150)
], sceAtrac3plus.prototype, "sceAtracGetLoopStatus", null);
__legacyDecorateClassTS([
  nativeFunction(2213043872, 150)
], sceAtrac3plus.prototype, "sceAtracGetSecondBufferInfo", null);
__legacyDecorateClassTS([
  nativeFunction(2210364157, 150)
], sceAtrac3plus.prototype, "sceAtracSetSecondBuffer", null);
__legacyDecorateClassTS([
  nativeFunction(3392971730, 150)
], sceAtrac3plus.prototype, "sceAtracGetBufferInfoForReseting", null);
__legacyDecorateClassTS([
  nativeFunction(1682855431, 150)
], sceAtrac3plus.prototype, "sceAtracResetPlayPosition", null);
__legacyDecorateClassTS([
  nativeFunction(3015036994, 150)
], sceAtrac3plus.prototype, "sceAtracGetOutputChannel", null);
__legacyDecorateClassTS([
  nativeFunction(3901715867, 150)
], sceAtrac3plus.prototype, "sceAtracGetInternalErrorInfo", null);
sceAtrac3plus = __legacyDecorateClassTS([
  hleModule("sceAtrac3plus")
], sceAtrac3plus);
// src/hle/module/ModuleMgrForUser.ts
var FAKE_MODULE_ID_BASE = 143654912;
class ModuleMgrForUser {
  name = "ModuleMgrForUser";
  ctx;
  nextModuleId = 1;
  loadedModules = new Map;
  init(ctx) {
    this.ctx = ctx;
    this.nextModuleId = 1;
    this.loadedModules.clear();
  }
  sceKernelLoadModule() {
    const pathPtr = this.ctx.argPtr(0);
    const flags = this.ctx.arg(1);
    const optionPtr = this.ctx.argPtr(2);
    const path = this.ctx.readString(pathPtr);
    this.ctx.log(`sceKernelLoadModule("${path}", 0x${flags.toString(16)})`);
    const moduleId = FAKE_MODULE_ID_BASE + this.nextModuleId++;
    this.loadedModules.set(moduleId, { path, started: false });
    return moduleId;
  }
  sceKernelLoadModuleByID() {
    const fileId = this.ctx.arg(0);
    const flags = this.ctx.arg(1);
    const optionPtr = this.ctx.argPtr(2);
    this.ctx.log(`sceKernelLoadModuleByID(${fileId}, 0x${flags.toString(16)})`);
    const moduleId = FAKE_MODULE_ID_BASE + this.nextModuleId++;
    this.loadedModules.set(moduleId, { path: `fd:${fileId}`, started: false });
    return moduleId;
  }
  sceKernelStartModule() {
    const moduleId = this.ctx.arg(0);
    const argSize = this.ctx.arg(1);
    const argPtr = this.ctx.argPtr(2);
    const statusPtr = this.ctx.argPtr(3);
    const optionPtr = this.ctx.argPtr(4);
    this.ctx.log(`sceKernelStartModule(0x${moduleId.toString(16)}, ${argSize})`);
    const module = this.loadedModules.get(moduleId);
    if (module) {
      module.started = true;
    }
    if (statusPtr) {
      this.ctx.write32(statusPtr, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelStopModule() {
    const moduleId = this.ctx.arg(0);
    this.ctx.log(`sceKernelStopModule(0x${moduleId.toString(16)})`);
    const module = this.loadedModules.get(moduleId);
    if (module) {
      module.started = false;
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelUnloadModule() {
    const moduleId = this.ctx.arg(0);
    this.ctx.log(`sceKernelUnloadModule(0x${moduleId.toString(16)})`);
    this.loadedModules.delete(moduleId);
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelSelfStopUnloadModule() {
    const unknown = this.ctx.arg(0);
    const argSize = this.ctx.arg(1);
    const argPtr = this.ctx.argPtr(2);
    this.ctx.log(`sceKernelSelfStopUnloadModule(${unknown}, ${argSize})`);
    this.ctx.stop();
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelStopUnloadSelfModule() {
    this.ctx.log("sceKernelStopUnloadSelfModule()");
    this.ctx.stop();
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelGetModuleId() {
    return FAKE_MODULE_ID_BASE;
  }
  sceKernelGetModuleIdByAddress() {
    const address = this.ctx.arg(0);
    this.ctx.log(`sceKernelGetModuleIdByAddress(0x${address.toString(16)})`);
    return FAKE_MODULE_ID_BASE;
  }
  sceKernelGetModuleIdList() {
    const readBufPtr = this.ctx.argPtr(0);
    const readBufSize = this.ctx.arg(1);
    const idCountPtr = this.ctx.argPtr(2);
    const maxCount = Math.floor(readBufSize / 4);
    let count = 0;
    if (count < maxCount) {
      this.ctx.write32(readBufPtr + count * 4, FAKE_MODULE_ID_BASE);
      count++;
    }
    for (const moduleId of this.loadedModules.keys()) {
      if (count >= maxCount)
        break;
      this.ctx.write32(readBufPtr + count * 4, moduleId);
      count++;
    }
    if (idCountPtr) {
      this.ctx.write32(idCountPtr, count);
    }
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(2541609862, 150)
], ModuleMgrForUser.prototype, "sceKernelLoadModule", null);
__legacyDecorateClassTS([
  nativeFunction(3086247448, 150)
], ModuleMgrForUser.prototype, "sceKernelLoadModuleByID", null);
__legacyDecorateClassTS([
  nativeFunction(1357955564, 150)
], ModuleMgrForUser.prototype, "sceKernelStartModule", null);
__legacyDecorateClassTS([
  nativeFunction(3523188778, 150)
], ModuleMgrForUser.prototype, "sceKernelStopModule", null);
__legacyDecorateClassTS([
  nativeFunction(772346282, 150)
], ModuleMgrForUser.prototype, "sceKernelUnloadModule", null);
__legacyDecorateClassTS([
  nativeFunction(3598052280, 150)
], ModuleMgrForUser.prototype, "sceKernelSelfStopUnloadModule", null);
__legacyDecorateClassTS([
  nativeFunction(3424466585, 150)
], ModuleMgrForUser.prototype, "sceKernelStopUnloadSelfModule", null);
__legacyDecorateClassTS([
  nativeFunction(4037174165, 150)
], ModuleMgrForUser.prototype, "sceKernelGetModuleId", null);
__legacyDecorateClassTS([
  nativeFunction(3635884327, 150)
], ModuleMgrForUser.prototype, "sceKernelGetModuleIdByAddress", null);
__legacyDecorateClassTS([
  nativeFunction(1682764373, 150)
], ModuleMgrForUser.prototype, "sceKernelGetModuleIdList", null);
ModuleMgrForUser = __legacyDecorateClassTS([
  hleModule("ModuleMgrForUser")
], ModuleMgrForUser);
// src/hle/module/StdioForUser.ts
var STDIN_FD = 0;
var STDOUT_FD = 1;
var STDERR_FD = 2;

class StdioForUser {
  name = "StdioForUser";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceKernelStdin() {
    return STDIN_FD;
  }
  sceKernelStdout() {
    return STDOUT_FD;
  }
  sceKernelStderr() {
    return STDERR_FD;
  }
}
__legacyDecorateClassTS([
  nativeFunction(388837742, 150)
], StdioForUser.prototype, "sceKernelStdin", null);
__legacyDecorateClassTS([
  nativeFunction(2797253353, 150)
], StdioForUser.prototype, "sceKernelStdout", null);
__legacyDecorateClassTS([
  nativeFunction(4153125130, 150)
], StdioForUser.prototype, "sceKernelStderr", null);
StdioForUser = __legacyDecorateClassTS([
  hleModule("StdioForUser")
], StdioForUser);
// src/hle/module/sceUmdUser.ts
class sceUmdUser {
  name = "sceUmdUser";
  ctx;
  callbackIds = [];
  umdState = 2 /* Present */ | 16 /* Ready */ | 32 /* Readable */;
  init(ctx) {
    this.ctx = ctx;
    this.callbackIds = [];
  }
  sceUmdRegisterUMDCallBack() {
    const callbackId = this.ctx.arg(0);
    if (!this.callbackIds.includes(callbackId)) {
      this.callbackIds.push(callbackId);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceUmdUnRegisterUMDCallBack() {
    const callbackId = this.ctx.arg(0);
    const index = this.callbackIds.indexOf(callbackId);
    if (index < 0) {
      return SceKernelErrors.ERROR_ERRNO_INVALID_ARGUMENT;
    }
    this.callbackIds.splice(index, 1);
    return SceKernelErrors.ERROR_OK;
  }
  sceUmdCheckMedium() {
    return 1 /* Inserted */;
  }
  sceUmdGetDriveStat() {
    return this.umdState;
  }
  sceUmdActivate() {
    const mode = this.ctx.arg(0);
    const drivePtr = this.ctx.argPtr(1);
    const drive = this.ctx.readString(drivePtr);
    this.ctx.log(`sceUmdActivate(${mode}, "${drive}")`);
    this.notifyCallbacks(this.umdState);
    return SceKernelErrors.ERROR_OK;
  }
  sceUmdDeactivate() {
    const mode = this.ctx.arg(0);
    const drivePtr = this.ctx.argPtr(1);
    const drive = this.ctx.readString(drivePtr);
    this.ctx.log(`sceUmdDeactivate(${mode}, "${drive}")`);
    this.notifyCallbacks(this.umdState);
    return SceKernelErrors.ERROR_OK;
  }
  sceUmdWaitDriveStat() {
    const state = this.ctx.arg(0);
    if ((this.umdState & state) !== 0) {
      return SceKernelErrors.ERROR_OK;
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceUmdWaitDriveStatCB() {
    const state = this.ctx.arg(0);
    const timeout = this.ctx.arg(1);
    this.ctx.callbackManager.executePending();
    return SceKernelErrors.ERROR_OK;
  }
  sceUmdWaitDriveStatWithTimer() {
    const state = this.ctx.arg(0);
    const timeout = this.ctx.arg(1);
    return SceKernelErrors.ERROR_OK;
  }
  sceUmdGetErrorStat() {
    return 0;
  }
  notifyCallbacks(data) {
    for (const callbackId of this.callbackIds) {
      this.ctx.callbackManager.notify(callbackId, data);
    }
  }
}
__legacyDecorateClassTS([
  nativeFunction(2934390861, 150)
], sceUmdUser.prototype, "sceUmdRegisterUMDCallBack", null);
__legacyDecorateClassTS([
  nativeFunction(3173768711, 150)
], sceUmdUser.prototype, "sceUmdUnRegisterUMDCallBack", null);
__legacyDecorateClassTS([
  nativeFunction(1189852969, 150)
], sceUmdUser.prototype, "sceUmdCheckMedium", null);
__legacyDecorateClassTS([
  nativeFunction(1800017004, 150)
], sceUmdUser.prototype, "sceUmdGetDriveStat", null);
__legacyDecorateClassTS([
  nativeFunction(3323477319, 150)
], sceUmdUser.prototype, "sceUmdActivate", null);
__legacyDecorateClassTS([
  nativeFunction(3895935674, 150)
], sceUmdUser.prototype, "sceUmdDeactivate", null);
__legacyDecorateClassTS([
  nativeFunction(2398130126, 150)
], sceUmdUser.prototype, "sceUmdWaitDriveStat", null);
__legacyDecorateClassTS([
  nativeFunction(1251892777, 150)
], sceUmdUser.prototype, "sceUmdWaitDriveStatCB", null);
__legacyDecorateClassTS([
  nativeFunction(1444948339, 150)
], sceUmdUser.prototype, "sceUmdWaitDriveStatWithTimer", null);
__legacyDecorateClassTS([
  nativeFunction(543329903, 150)
], sceUmdUser.prototype, "sceUmdGetErrorStat", null);
sceUmdUser = __legacyDecorateClassTS([
  hleModule("sceUmdUser")
], sceUmdUser);
// src/hle/module/sceDmac.ts
class sceDmac {
  name = "sceDmac";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  dmacMemcpy(destination, source, size) {
    if (size === 0) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }
    if (destination === 0 || source === 0) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ADDR;
    }
    this.ctx.memory.copy(source, destination, size);
    if (size >= 272) {
      return Promise.resolve(SceKernelErrors.ERROR_OK);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceDmacMemcpy() {
    const destination = this.ctx.arg(0);
    const source = this.ctx.arg(1);
    const size = this.ctx.arg(2);
    return this.dmacMemcpy(destination, source, size);
  }
  sceDmacTryMemcpy() {
    const destination = this.ctx.arg(0);
    const source = this.ctx.arg(1);
    const size = this.ctx.arg(2);
    return this.dmacMemcpy(destination, source, size);
  }
}
__legacyDecorateClassTS([
  nativeFunction(1635729382, 150)
], sceDmac.prototype, "sceDmacMemcpy", null);
__legacyDecorateClassTS([
  nativeFunction(3649017048, 150)
], sceDmac.prototype, "sceDmacTryMemcpy", null);
sceDmac = __legacyDecorateClassTS([
  hleModule("sceDmac")
], sceDmac);
// src/hle/module/sceHprm.ts
class sceHprm {
  name = "sceHprm";
  ctx;
  currentKeys = 0 /* None */;
  init(ctx) {
    this.ctx = ctx;
    this.currentKeys = 0 /* None */;
  }
  sceHprmPeekCurrentKey() {
    const keyPtr = this.ctx.argPtr(0);
    if (keyPtr) {
      this.ctx.write32(keyPtr, this.currentKeys);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceHprmPeekLatch() {
    const latchPtr = this.ctx.argPtr(0);
    if (latchPtr) {
      this.ctx.write32(latchPtr + 0, 0);
      this.ctx.write32(latchPtr + 4, 0);
      this.ctx.write32(latchPtr + 8, 0);
      this.ctx.write32(latchPtr + 12, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceHprmReadLatch() {
    const latchPtr = this.ctx.argPtr(0);
    if (latchPtr) {
      this.ctx.write32(latchPtr + 0, 0);
      this.ctx.write32(latchPtr + 4, 0);
      this.ctx.write32(latchPtr + 8, 0);
      this.ctx.write32(latchPtr + 12, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceHprmIsHeadphoneExist() {
    return 0;
  }
  sceHprmIsRemoteExist() {
    return 0;
  }
  sceHprmIsMicrophoneExist() {
    return 0;
  }
}
__legacyDecorateClassTS([
  nativeFunction(420524839, 150)
], sceHprm.prototype, "sceHprmPeekCurrentKey", null);
__legacyDecorateClassTS([
  nativeFunction(734971966, 150)
], sceHprm.prototype, "sceHprmPeekLatch", null);
__legacyDecorateClassTS([
  nativeFunction(1087568368, 150)
], sceHprm.prototype, "sceHprmReadLatch", null);
__legacyDecorateClassTS([
  nativeFunction(2120871332, 150)
], sceHprm.prototype, "sceHprmIsHeadphoneExist", null);
__legacyDecorateClassTS([
  nativeFunction(546156989, 150)
], sceHprm.prototype, "sceHprmIsRemoteExist", null);
__legacyDecorateClassTS([
  nativeFunction(563894513, 150)
], sceHprm.prototype, "sceHprmIsMicrophoneExist", null);
sceHprm = __legacyDecorateClassTS([
  hleModule("sceHprm")
], sceHprm);
// src/hle/module/sceImpose.ts
class sceImpose {
  name = "sceImpose";
  ctx;
  language = 1 /* English */;
  buttonPreference = 1 /* Cross */;
  chargingType = 1 /* Charging */;
  iconStatus = 4 /* Full */;
  init(ctx) {
    this.ctx = ctx;
  }
  sceImposeGetBatteryIconStatus() {
    const isChargingPtr = this.ctx.argPtr(0);
    const iconStatusPtr = this.ctx.argPtr(1);
    if (isChargingPtr) {
      this.ctx.write32(isChargingPtr, this.chargingType);
    }
    if (iconStatusPtr) {
      this.ctx.write32(iconStatusPtr, this.iconStatus);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceImposeSetLanguageMode() {
    const language = this.ctx.arg(0);
    const buttonPref = this.ctx.arg(1);
    this.language = language;
    this.buttonPreference = buttonPref;
    return SceKernelErrors.ERROR_OK;
  }
  sceImposeGetLanguageMode() {
    const languagePtr = this.ctx.argPtr(0);
    const buttonPrefPtr = this.ctx.argPtr(1);
    if (languagePtr) {
      this.ctx.write32(languagePtr, this.language);
    }
    if (buttonPrefPtr) {
      this.ctx.write32(buttonPrefPtr, this.buttonPreference);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceImposeGetUMDPopup() {
    return 0;
  }
  sceImposeSetUMDPopup() {
    return SceKernelErrors.ERROR_OK;
  }
  sceImposeGetHomePopup() {
    return 1;
  }
  sceImposeSetHomePopup() {
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(2358522257, 150)
], sceImpose.prototype, "sceImposeGetBatteryIconStatus", null);
__legacyDecorateClassTS([
  nativeFunction(917139089, 150)
], sceImpose.prototype, "sceImposeSetLanguageMode", null);
__legacyDecorateClassTS([
  nativeFunction(620592079, 150)
], sceImpose.prototype, "sceImposeGetLanguageMode", null);
__legacyDecorateClassTS([
  nativeFunction(3767040968, 150)
], sceImpose.prototype, "sceImposeGetUMDPopup", null);
__legacyDecorateClassTS([
  nativeFunction(1435871002, 150)
], sceImpose.prototype, "sceImposeSetUMDPopup", null);
__legacyDecorateClassTS([
  nativeFunction(255073252, 150)
], sceImpose.prototype, "sceImposeGetHomePopup", null);
__legacyDecorateClassTS([
  nativeFunction(292355940, 150)
], sceImpose.prototype, "sceImposeSetHomePopup", null);
sceImpose = __legacyDecorateClassTS([
  hleModule("sceImpose")
], sceImpose);
// src/hle/module/sceSuspendForUser.ts
class sceSuspendForUser {
  name = "sceSuspendForUser";
  ctx;
  lockCount = 0;
  init(ctx) {
    this.ctx = ctx;
    this.lockCount = 0;
  }
  sceKernelPowerLock() {
    const lockType = this.ctx.arg(0);
    if (lockType !== 0) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }
    this.lockCount++;
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelPowerUnlock() {
    const lockType = this.ctx.arg(0);
    if (lockType !== 0) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }
    if (this.lockCount > 0) {
      this.lockCount--;
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelPowerTick() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelVolatileMemLock() {
    const unk = this.ctx.arg(0);
    const ptrPtr = this.ctx.argPtr(1);
    const sizePtr = this.ctx.argPtr(2);
    if (ptrPtr) {
      this.ctx.write32(ptrPtr, 138412032);
    }
    if (sizePtr) {
      this.ctx.write32(sizePtr, 4194304);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelVolatileMemTryLock() {
    const unk = this.ctx.arg(0);
    const ptrPtr = this.ctx.argPtr(1);
    const sizePtr = this.ctx.argPtr(2);
    if (ptrPtr) {
      this.ctx.write32(ptrPtr, 138412032);
    }
    if (sizePtr) {
      this.ctx.write32(sizePtr, 4194304);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelVolatileMemUnlock() {
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(3940228055, 150)
], sceSuspendForUser.prototype, "sceKernelPowerLock", null);
__legacyDecorateClassTS([
  nativeFunction(988705377, 150)
], sceSuspendForUser.prototype, "sceKernelPowerUnlock", null);
__legacyDecorateClassTS([
  nativeFunction(151833407, 150)
], sceSuspendForUser.prototype, "sceKernelPowerTick", null);
__legacyDecorateClassTS([
  nativeFunction(1040347603, 150)
], sceSuspendForUser.prototype, "sceKernelVolatileMemLock", null);
__legacyDecorateClassTS([
  nativeFunction(2706325682, 150)
], sceSuspendForUser.prototype, "sceKernelVolatileMemTryLock", null);
__legacyDecorateClassTS([
  nativeFunction(2775180325, 150)
], sceSuspendForUser.prototype, "sceKernelVolatileMemUnlock", null);
sceSuspendForUser = __legacyDecorateClassTS([
  hleModule("sceSuspendForUser")
], sceSuspendForUser);
// src/hle/module/sceReg.ts
var nextRegHandle = 1;
var nextCategoryHandle = 100;
var nextKeyHandle = 1000;

class sceReg {
  name = "sceReg";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceRegOpenRegistry() {
    const regParamPtr = this.ctx.argPtr(0);
    const mode = this.ctx.arg(1);
    const regHandlePtr = this.ctx.argPtr(2);
    const regType = this.ctx.read32(regParamPtr);
    const namePtr = regParamPtr + 4;
    const name = this.ctx.readString(namePtr, 256);
    this.ctx.log(`sceRegOpenRegistry("${name}", mode=${mode})`);
    if (regHandlePtr) {
      this.ctx.write32(regHandlePtr, nextRegHandle++);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceRegCloseRegistry() {
    const regHandle = this.ctx.arg(0);
    return SceKernelErrors.ERROR_OK;
  }
  sceRegFlushRegistry() {
    const regHandle = this.ctx.arg(0);
    return SceKernelErrors.ERROR_OK;
  }
  sceRegOpenCategory() {
    const regHandle = this.ctx.arg(0);
    const namePtr = this.ctx.argPtr(1);
    const mode = this.ctx.arg(2);
    const categoryHandlePtr = this.ctx.argPtr(3);
    const name = this.ctx.readString(namePtr);
    this.ctx.log(`sceRegOpenCategory("${name}")`);
    if (categoryHandlePtr) {
      this.ctx.write32(categoryHandlePtr, nextCategoryHandle++);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceRegCloseCategory() {
    const categoryHandle = this.ctx.arg(0);
    return SceKernelErrors.ERROR_OK;
  }
  sceRegFlushCategory() {
    const categoryHandle = this.ctx.arg(0);
    return SceKernelErrors.ERROR_OK;
  }
  sceRegGetKeyInfo() {
    const categoryHandle = this.ctx.arg(0);
    const namePtr = this.ctx.argPtr(1);
    const keyHandlePtr = this.ctx.argPtr(2);
    const keyTypePtr = this.ctx.argPtr(3);
    const sizePtr = this.ctx.argPtr(4);
    const name = this.ctx.readString(namePtr);
    this.ctx.log(`sceRegGetKeyInfo("${name}")`);
    if (keyHandlePtr) {
      this.ctx.write32(keyHandlePtr, nextKeyHandle++);
    }
    if (keyTypePtr) {
      this.ctx.write32(keyTypePtr, 2 /* Integer */);
    }
    if (sizePtr) {
      this.ctx.write32(sizePtr, 4);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceRegGetKeyValue() {
    const categoryHandle = this.ctx.arg(0);
    const keyHandle = this.ctx.arg(1);
    const bufferPtr = this.ctx.argPtr(2);
    const size = this.ctx.arg(3);
    if (bufferPtr && size >= 4) {
      this.ctx.write32(bufferPtr, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceRegGetKeyInfoByName() {
    const categoryHandle = this.ctx.arg(0);
    const namePtr = this.ctx.argPtr(1);
    const keyTypePtr = this.ctx.argPtr(2);
    const sizePtr = this.ctx.argPtr(3);
    if (keyTypePtr) {
      this.ctx.write32(keyTypePtr, 2 /* Integer */);
    }
    if (sizePtr) {
      this.ctx.write32(sizePtr, 4);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceRegGetKeyValueByName() {
    const categoryHandle = this.ctx.arg(0);
    const namePtr = this.ctx.argPtr(1);
    const bufferPtr = this.ctx.argPtr(2);
    const size = this.ctx.arg(3);
    if (bufferPtr && size >= 4) {
      this.ctx.write32(bufferPtr, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(2464420480, 150)
], sceReg.prototype, "sceRegOpenRegistry", null);
__legacyDecorateClassTS([
  nativeFunction(4203370297, 150)
], sceReg.prototype, "sceRegCloseRegistry", null);
__legacyDecorateClassTS([
  nativeFunction(960895821, 150)
], sceReg.prototype, "sceRegFlushRegistry", null);
__legacyDecorateClassTS([
  nativeFunction(495613486, 150)
], sceReg.prototype, "sceRegOpenCategory", null);
__legacyDecorateClassTS([
  nativeFunction(212763435, 150)
], sceReg.prototype, "sceRegCloseCategory", null);
__legacyDecorateClassTS([
  nativeFunction(225034048, 150)
], sceReg.prototype, "sceRegFlushCategory", null);
__legacyDecorateClassTS([
  nativeFunction(3561446056, 150)
], sceReg.prototype, "sceRegGetKeyInfo", null);
__legacyDecorateClassTS([
  nativeFunction(682158474, 150)
], sceReg.prototype, "sceRegGetKeyValue", null);
__legacyDecorateClassTS([
  nativeFunction(1285646483, 150)
], sceReg.prototype, "sceRegGetKeyInfoByName", null);
__legacyDecorateClassTS([
  nativeFunction(817758809, 150)
], sceReg.prototype, "sceRegGetKeyValueByName", null);
sceReg = __legacyDecorateClassTS([
  hleModule("sceReg")
], sceReg);
// src/hle/module/sceMpeg.ts
var MPEG_MEMSIZE = 64 * 1024;
var RING_BUFFER_PACKET_SIZE = 2048;
class sceMpeg {
  name = "sceMpeg";
  ctx;
  mpegInstances = new Set;
  nextStreamId = 1;
  nextEsBuf = 1;
  init(ctx) {
    this.ctx = ctx;
    this.mpegInstances.clear();
    this.nextStreamId = 1;
    this.nextEsBuf = 1;
  }
  sceMpegInit() {
    return -1;
  }
  sceMpegFinish() {
    this.mpegInstances.clear();
    return SceKernelErrors.ERROR_OK;
  }
  sceMpegQueryMemSize() {
    return MPEG_MEMSIZE;
  }
  sceMpegCreate() {
    const mpegAddr = this.ctx.arg(0);
    const dataPtr = this.ctx.arg(1);
    const size = this.ctx.arg(2);
    if (size < MPEG_MEMSIZE) {
      return SceKernelErrors.ERROR_MPEG_NO_MEMORY;
    }
    this.ctx.write32(mpegAddr, dataPtr + 48);
    const handleAddr = dataPtr + 48;
    const magic = "LIBMPEG\x001\x00";
    for (let i = 0;i < magic.length; i++) {
      this.ctx.write8(handleAddr + i, magic.charCodeAt(i));
    }
    this.ctx.write32(handleAddr + 12, -1);
    this.mpegInstances.add(mpegAddr);
    return SceKernelErrors.ERROR_OK;
  }
  sceMpegDelete() {
    const mpegAddr = this.ctx.arg(0);
    this.mpegInstances.delete(mpegAddr);
    return SceKernelErrors.ERROR_OK;
  }
  sceMpegQueryStreamOffset() {
    const mpegAddr = this.ctx.arg(0);
    const bufferAddr = this.ctx.arg(1);
    const outputPtr = this.ctx.argPtr(2);
    const magic = this.ctx.read32(bufferAddr);
    if (magic !== 1179472720) {
      return SceKernelErrors.ERROR_MPEG_INVALID_VALUE;
    }
    const offset = this.ctx.read32(bufferAddr + 8);
    if (outputPtr) {
      this.ctx.write32(outputPtr, offset);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceMpegQueryStreamSize() {
    const bufferAddr = this.ctx.arg(0);
    const outputPtr = this.ctx.argPtr(1);
    const size = this.ctx.read32(bufferAddr + 12);
    if (outputPtr) {
      this.ctx.write32(outputPtr, size);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceMpegRingbufferQueryMemSize() {
    const numPackets = this.ctx.arg(0);
    return (RING_BUFFER_PACKET_SIZE + 104) * numPackets;
  }
  sceMpegRingbufferConstruct() {
    const ringbufferAddr = this.ctx.argPtr(0);
    const numPackets = this.ctx.arg(1);
    const data = this.ctx.arg(2);
    const size = this.ctx.arg(3);
    const callbackAddr = this.ctx.arg(4);
    const callbackArg = this.ctx.arg(5);
    if (ringbufferAddr === 0) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ADDR;
    }
    this.ctx.write32(ringbufferAddr + 0, numPackets);
    this.ctx.write32(ringbufferAddr + 4, 0);
    this.ctx.write32(ringbufferAddr + 8, 0);
    this.ctx.write32(ringbufferAddr + 12, 0);
    this.ctx.write32(ringbufferAddr + 16, 2048);
    this.ctx.write32(ringbufferAddr + 20, data);
    this.ctx.write32(ringbufferAddr + 24, callbackAddr);
    this.ctx.write32(ringbufferAddr + 28, callbackArg);
    this.ctx.write32(ringbufferAddr + 32, data + numPackets * 2048);
    this.ctx.write32(ringbufferAddr + 36, 0);
    this.ctx.write32(ringbufferAddr + 40, 0);
    return SceKernelErrors.ERROR_OK;
  }
  sceMpegRingbufferDestruct() {
    return SceKernelErrors.ERROR_OK;
  }
  sceMpegRingbufferAvailableSize() {
    const ringbufferAddr = this.ctx.argPtr(0);
    const packets = this.ctx.read32(ringbufferAddr + 0);
    const packetsAvail = this.ctx.read32(ringbufferAddr + 12);
    return packets - packetsAvail;
  }
  sceMpegRingbufferPut() {
    return 0;
  }
  sceMpegRegistStream() {
    const mpegAddr = this.ctx.arg(0);
    const streamType = this.ctx.arg(1);
    const streamNum = this.ctx.arg(2);
    return this.nextStreamId++;
  }
  sceMpegUnRegistStream() {
    return SceKernelErrors.ERROR_OK;
  }
  sceMpegInitAu() {
    const mpegAddr = this.ctx.arg(0);
    const bufferAddr = this.ctx.arg(1);
    const auPtr = this.ctx.argPtr(2);
    this.ctx.write32(auPtr + 0, 0);
    this.ctx.write32(auPtr + 4, 0);
    this.ctx.write32(auPtr + 8, 0);
    this.ctx.write32(auPtr + 12, 0);
    this.ctx.write32(auPtr + 16, bufferAddr);
    this.ctx.write32(auPtr + 20, 2112);
    return SceKernelErrors.ERROR_OK;
  }
  sceMpegQueryAtracEsSize() {
    const mpegAddr = this.ctx.arg(0);
    const esSizePtr = this.ctx.argPtr(1);
    const outSizePtr = this.ctx.argPtr(2);
    if (esSizePtr) {
      this.ctx.write32(esSizePtr, 2112);
    }
    if (outSizePtr) {
      this.ctx.write32(outSizePtr, 8192);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceMpegMallocAvcEsBuf() {
    return this.nextEsBuf++;
  }
  sceMpegFreeAvcEsBuf() {
    return SceKernelErrors.ERROR_OK;
  }
  sceMpegAvcDecodeMode() {
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(1747607963, 150)
], sceMpeg.prototype, "sceMpegInit", null);
__legacyDecorateClassTS([
  nativeFunction(2269521110, 150)
], sceMpeg.prototype, "sceMpegFinish", null);
__legacyDecorateClassTS([
  nativeFunction(3241337391, 150)
], sceMpeg.prototype, "sceMpegQueryMemSize", null);
__legacyDecorateClassTS([
  nativeFunction(3636850977, 150)
], sceMpeg.prototype, "sceMpegCreate", null);
__legacyDecorateClassTS([
  nativeFunction(1617577545, 150)
], sceMpeg.prototype, "sceMpegDelete", null);
__legacyDecorateClassTS([
  nativeFunction(570392804, 150)
], sceMpeg.prototype, "sceMpegQueryStreamOffset", null);
__legacyDecorateClassTS([
  nativeFunction(1629396497, 150)
], sceMpeg.prototype, "sceMpegQueryStreamSize", null);
__legacyDecorateClassTS([
  nativeFunction(3617759046, 150)
], sceMpeg.prototype, "sceMpegRingbufferQueryMemSize", null);
__legacyDecorateClassTS([
  nativeFunction(925458136, 150)
], sceMpeg.prototype, "sceMpegRingbufferConstruct", null);
__legacyDecorateClassTS([
  nativeFunction(322993939, 150)
], sceMpeg.prototype, "sceMpegRingbufferDestruct", null);
__legacyDecorateClassTS([
  nativeFunction(3052854407, 150)
], sceMpeg.prototype, "sceMpegRingbufferAvailableSize", null);
__legacyDecorateClassTS([
  nativeFunction(2990581150, 150)
], sceMpeg.prototype, "sceMpegRingbufferPut", null);
__legacyDecorateClassTS([
  nativeFunction(1112936227, 150)
], sceMpeg.prototype, "sceMpegRegistStream", null);
__legacyDecorateClassTS([
  nativeFunction(1494895266, 150)
], sceMpeg.prototype, "sceMpegUnRegistStream", null);
__legacyDecorateClassTS([
  nativeFunction(377159070, 150)
], sceMpeg.prototype, "sceMpegInitAu", null);
__legacyDecorateClassTS([
  nativeFunction(4175214201, 150)
], sceMpeg.prototype, "sceMpegQueryAtracEsSize", null);
__legacyDecorateClassTS([
  nativeFunction(2810236798, 150)
], sceMpeg.prototype, "sceMpegMallocAvcEsBuf", null);
__legacyDecorateClassTS([
  nativeFunction(3468193969, 150)
], sceMpeg.prototype, "sceMpegFreeAvcEsBuf", null);
__legacyDecorateClassTS([
  nativeFunction(2702995494, 150)
], sceMpeg.prototype, "sceMpegAvcDecodeMode", null);
sceMpeg = __legacyDecorateClassTS([
  hleModule("sceMpeg")
], sceMpeg);
// src/hle/module/sceSasCore.ts
var PSP_SAS_VOICES_MAX = 32;
var PSP_SAS_VOL_MAX = 4096;
var PSP_SAS_PITCH_MIN = 1;
var PSP_SAS_PITCH_BASE = 4096;
var PSP_SAS_PITCH_MAX = 16384;
function createVoice() {
  return {
    on: false,
    paused: false,
    pitch: PSP_SAS_PITCH_BASE,
    leftVolume: PSP_SAS_VOL_MAX,
    rightVolume: PSP_SAS_VOL_MAX,
    effectLeftVolume: PSP_SAS_VOL_MAX,
    effectRightVolume: PSP_SAS_VOL_MAX,
    sustainLevel: 0,
    envelope: {
      attackRate: 0,
      decayRate: 0,
      sustainRate: 0,
      releaseRate: 0,
      height: 0
    }
  };
}

class sceSasCore {
  name = "sceSasCore";
  ctx;
  initialized = false;
  grainSamples = 256;
  maxVoices = 32;
  outputMode = 0 /* Stereo */;
  sampleRate = 44100;
  effectType = -1 /* Off */;
  effectIsDry = false;
  effectIsWet = false;
  effectLeftVolume = PSP_SAS_VOL_MAX;
  effectRightVolume = PSP_SAS_VOL_MAX;
  delay = 0;
  feedback = 0;
  voices = [];
  init(ctx) {
    this.ctx = ctx;
    this.voices = [];
    for (let i = 0;i < PSP_SAS_VOICES_MAX; i++) {
      this.voices.push(createVoice());
    }
  }
  __sceSasInit() {
    const sasCorePtr = this.ctx.arg(0);
    const grainSamples = this.ctx.arg(1);
    const maxVoices = this.ctx.arg(2);
    const outputMode = this.ctx.arg(3);
    const sampleRate = this.ctx.arg(4);
    if (sampleRate !== 44100) {
      return SceKernelErrors.ERROR_SAS_INVALID_SAMPLE_RATE;
    }
    if (maxVoices < 1 || maxVoices > PSP_SAS_VOICES_MAX) {
      return SceKernelErrors.ERROR_SAS_INVALID_MAX_VOICES;
    }
    if (outputMode !== 0 /* Stereo */ && outputMode !== 1 /* Multichannel */) {
      return SceKernelErrors.ERROR_SAS_INVALID_OUTPUT_MODE;
    }
    this.grainSamples = grainSamples;
    this.maxVoices = maxVoices;
    this.outputMode = outputMode;
    this.sampleRate = sampleRate;
    this.initialized = true;
    return SceKernelErrors.ERROR_OK;
  }
  __sceSasSetGrain() {
    const sasCorePtr = this.ctx.arg(0);
    const grainSamples = this.ctx.arg(1);
    this.grainSamples = grainSamples;
    return SceKernelErrors.ERROR_OK;
  }
  __sceSasSetOutputmode() {
    const sasCorePtr = this.ctx.arg(0);
    const outputMode = this.ctx.arg(1);
    this.outputMode = outputMode;
    return SceKernelErrors.ERROR_OK;
  }
  __sceSasCore() {
    const sasCorePtr = this.ctx.arg(0);
    const sasOutPtr = this.ctx.argPtr(1);
    return this.mixAudio(sasOutPtr, PSP_SAS_VOL_MAX, PSP_SAS_VOL_MAX);
  }
  __sceSasCoreWithMix() {
    const sasCorePtr = this.ctx.arg(0);
    const sasOutPtr = this.ctx.argPtr(1);
    const leftVol = this.ctx.arg(2);
    const rightVol = this.ctx.arg(3);
    return this.mixAudio(sasOutPtr, leftVol, rightVol);
  }
  mixAudio(outPtr, leftVol, rightVol) {
    const samples = this.grainSamples;
    const channels = this.outputMode === 0 /* Stereo */ ? 2 : 1;
    for (let i = 0;i < samples * channels; i++) {
      this.ctx.write16(outPtr + i * 2, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  __sceSasGetEndFlag() {
    let flags = 0;
    for (let i = 0;i < this.voices.length; i++) {
      if (!this.voices[i].on) {
        flags |= 1 << i;
      }
    }
    return flags;
  }
  __sceSasSetVoice() {
    const sasCorePtr = this.ctx.arg(0);
    const voiceId = this.ctx.arg(1);
    const dataPtr = this.ctx.argPtr(2);
    const loop = this.ctx.arg(3);
    if (voiceId < 0 || voiceId >= PSP_SAS_VOICES_MAX) {
      return SceKernelErrors.ERROR_SAS_INVALID_VOICE;
    }
    return SceKernelErrors.ERROR_OK;
  }
  __sceSasSetVoicePCM() {
    const sasCorePtr = this.ctx.arg(0);
    const voiceId = this.ctx.arg(1);
    const dataPtr = this.ctx.argPtr(2);
    const loop = this.ctx.arg(3);
    if (voiceId < 0 || voiceId >= PSP_SAS_VOICES_MAX) {
      return SceKernelErrors.ERROR_SAS_INVALID_VOICE;
    }
    return SceKernelErrors.ERROR_OK;
  }
  __sceSasSetKeyOn() {
    const sasCorePtr = this.ctx.arg(0);
    const voiceId = this.ctx.arg(1);
    if (voiceId < 0 || voiceId >= PSP_SAS_VOICES_MAX) {
      return SceKernelErrors.ERROR_SAS_INVALID_VOICE;
    }
    this.voices[voiceId].on = true;
    return SceKernelErrors.ERROR_OK;
  }
  __sceSasSetKeyOff() {
    const sasCorePtr = this.ctx.arg(0);
    const voiceId = this.ctx.arg(1);
    if (voiceId < 0 || voiceId >= PSP_SAS_VOICES_MAX) {
      return SceKernelErrors.ERROR_SAS_INVALID_VOICE;
    }
    this.voices[voiceId].on = false;
    return SceKernelErrors.ERROR_OK;
  }
  __sceSasSetPause() {
    const sasCorePtr = this.ctx.arg(0);
    const voiceBits = this.ctx.arg(1);
    const pause = this.ctx.arg(2) !== 0;
    for (let i = 0;i < PSP_SAS_VOICES_MAX; i++) {
      if (voiceBits & 1 << i) {
        this.voices[i].paused = pause;
      }
    }
    return SceKernelErrors.ERROR_OK;
  }
  __sceSasGetPauseFlag() {
    let flags = 0;
    for (let i = 0;i < this.voices.length; i++) {
      if (this.voices[i].paused) {
        flags |= 1 << i;
      }
    }
    return flags;
  }
  __sceSasSetVolume() {
    const sasCorePtr = this.ctx.arg(0);
    const voiceId = this.ctx.arg(1);
    const leftVol = this.ctx.arg(2);
    const rightVol = this.ctx.arg(3);
    const effectLeftVol = this.ctx.arg(4);
    const effectRightVol = this.ctx.arg(5);
    if (voiceId < 0 || voiceId >= PSP_SAS_VOICES_MAX) {
      return SceKernelErrors.ERROR_SAS_INVALID_VOICE;
    }
    const voice = this.voices[voiceId];
    voice.leftVolume = Math.abs(leftVol);
    voice.rightVolume = Math.abs(rightVol);
    voice.effectLeftVolume = Math.abs(effectLeftVol);
    voice.effectRightVolume = Math.abs(effectRightVol);
    return SceKernelErrors.ERROR_OK;
  }
  __sceSasSetPitch() {
    const sasCorePtr = this.ctx.arg(0);
    const voiceId = this.ctx.arg(1);
    const pitch = this.ctx.arg(2);
    if (voiceId < 0 || voiceId >= PSP_SAS_VOICES_MAX) {
      return SceKernelErrors.ERROR_SAS_INVALID_VOICE;
    }
    if (pitch < PSP_SAS_PITCH_MIN || pitch > PSP_SAS_PITCH_MAX) {
      return SceKernelErrors.ERROR_SAS_INVALID_PITCH;
    }
    this.voices[voiceId].pitch = pitch;
    return SceKernelErrors.ERROR_OK;
  }
  __sceSasSetADSR() {
    const sasCorePtr = this.ctx.arg(0);
    const voiceId = this.ctx.arg(1);
    const flags = this.ctx.arg(2);
    const attackRate = this.ctx.arg(3);
    const decayRate = this.ctx.arg(4);
    const sustainRate = this.ctx.arg(5);
    const releaseRate = this.ctx.arg(6);
    if (voiceId < 0 || voiceId >= PSP_SAS_VOICES_MAX) {
      return SceKernelErrors.ERROR_SAS_INVALID_VOICE;
    }
    const voice = this.voices[voiceId];
    if (flags & 1)
      voice.envelope.attackRate = attackRate;
    if (flags & 2)
      voice.envelope.decayRate = decayRate;
    if (flags & 4)
      voice.envelope.sustainRate = sustainRate;
    if (flags & 8)
      voice.envelope.releaseRate = releaseRate;
    return SceKernelErrors.ERROR_OK;
  }
  __sceSasSetADSRmode() {
    return SceKernelErrors.ERROR_OK;
  }
  __sceSasSetSL() {
    const sasCorePtr = this.ctx.arg(0);
    const voiceId = this.ctx.arg(1);
    const sustainLevel = this.ctx.arg(2);
    if (voiceId < 0 || voiceId >= PSP_SAS_VOICES_MAX) {
      return SceKernelErrors.ERROR_SAS_INVALID_VOICE;
    }
    this.voices[voiceId].sustainLevel = sustainLevel;
    return SceKernelErrors.ERROR_OK;
  }
  __sceSasSetSimpleADSR() {
    return SceKernelErrors.ERROR_OK;
  }
  __sceSasGetEnvelopeHeight() {
    const sasCorePtr = this.ctx.arg(0);
    const voiceId = this.ctx.arg(1);
    if (voiceId < 0 || voiceId >= PSP_SAS_VOICES_MAX) {
      return SceKernelErrors.ERROR_SAS_INVALID_VOICE;
    }
    return this.voices[voiceId].envelope.height;
  }
  __sceSasGetAllEnvelopeHeights() {
    const sasCorePtr = this.ctx.arg(0);
    const heightPtr = this.ctx.argPtr(1);
    for (let i = 0;i < this.voices.length; i++) {
      this.ctx.write32(heightPtr + i * 4, this.voices[i].envelope.height);
    }
    return SceKernelErrors.ERROR_OK;
  }
  __sceSasRevType() {
    const sasCorePtr = this.ctx.arg(0);
    const effectType = this.ctx.arg(1);
    this.effectType = effectType;
    return SceKernelErrors.ERROR_OK;
  }
  __sceSasRevVON() {
    const sasCorePtr = this.ctx.arg(0);
    const isDry = this.ctx.arg(1) !== 0;
    const isWet = this.ctx.arg(2) !== 0;
    this.effectIsDry = isDry;
    this.effectIsWet = isWet;
    return SceKernelErrors.ERROR_OK;
  }
  __sceSasRevEVOL() {
    const sasCorePtr = this.ctx.arg(0);
    const leftVol = this.ctx.arg(1);
    const rightVol = this.ctx.arg(2);
    this.effectLeftVolume = leftVol;
    this.effectRightVolume = rightVol;
    return SceKernelErrors.ERROR_OK;
  }
  __sceSasRevParam() {
    const sasCorePtr = this.ctx.arg(0);
    const delay = this.ctx.arg(1);
    const feedback = this.ctx.arg(2);
    this.delay = delay;
    this.feedback = feedback;
    return SceKernelErrors.ERROR_OK;
  }
  __sceSasSetNoise() {
    const sasCorePtr = this.ctx.arg(0);
    const voiceId = this.ctx.arg(1);
    const noiseFreq = this.ctx.arg(2);
    if (noiseFreq < 0 || noiseFreq >= 64) {
      return SceKernelErrors.ERROR_SAS_INVALID_NOISE_FREQ;
    }
    if (voiceId < 0 || voiceId >= PSP_SAS_VOICES_MAX) {
      return SceKernelErrors.ERROR_SAS_INVALID_VOICE;
    }
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(1115130527, 150)
], sceSasCore.prototype, "__sceSasInit", null);
__legacyDecorateClassTS([
  nativeFunction(3521159198, 150)
], sceSasCore.prototype, "__sceSasSetGrain", null);
__legacyDecorateClassTS([
  nativeFunction(3897933686, 150)
], sceSasCore.prototype, "__sceSasSetOutputmode", null);
__legacyDecorateClassTS([
  nativeFunction(2740493697, 150)
], sceSasCore.prototype, "__sceSasCore", null);
__legacyDecorateClassTS([
  nativeFunction(1352748540, 150)
], sceSasCore.prototype, "__sceSasCoreWithMix", null);
__legacyDecorateClassTS([
  nativeFunction(1755605909, 150)
], sceSasCore.prototype, "__sceSasGetEndFlag", null);
__legacyDecorateClassTS([
  nativeFunction(2576629897, 150)
], sceSasCore.prototype, "__sceSasSetVoice", null);
__legacyDecorateClassTS([
  nativeFunction(3788346721, 150)
], sceSasCore.prototype, "__sceSasSetVoicePCM", null);
__legacyDecorateClassTS([
  nativeFunction(1995446986, 150)
], sceSasCore.prototype, "__sceSasSetKeyOn", null);
__legacyDecorateClassTS([
  nativeFunction(2697932708, 150)
], sceSasCore.prototype, "__sceSasSetKeyOff", null);
__legacyDecorateClassTS([
  nativeFunction(2021459157, 150)
], sceSasCore.prototype, "__sceSasSetPause", null);
__legacyDecorateClassTS([
  nativeFunction(747530931, 150)
], sceSasCore.prototype, "__sceSasGetPauseFlag", null);
__legacyDecorateClassTS([
  nativeFunction(1141680088, 150)
], sceSasCore.prototype, "__sceSasSetVolume", null);
__legacyDecorateClassTS([
  nativeFunction(2911163263, 150)
], sceSasCore.prototype, "__sceSasSetPitch", null);
__legacyDecorateClassTS([
  nativeFunction(26945003, 150)
], sceSasCore.prototype, "__sceSasSetADSR", null);
__legacyDecorateClassTS([
  nativeFunction(2663606122, 150)
], sceSasCore.prototype, "__sceSasSetADSRmode", null);
__legacyDecorateClassTS([
  nativeFunction(1603611126, 150)
], sceSasCore.prototype, "__sceSasSetSL", null);
__legacyDecorateClassTS([
  nativeFunction(3419230073, 150)
], sceSasCore.prototype, "__sceSasSetSimpleADSR", null);
__legacyDecorateClassTS([
  nativeFunction(1957582890, 150)
], sceSasCore.prototype, "__sceSasGetEnvelopeHeight", null);
__legacyDecorateClassTS([
  nativeFunction(133532708, 150)
], sceSasCore.prototype, "__sceSasGetAllEnvelopeHeights", null);
__legacyDecorateClassTS([
  nativeFunction(869575479, 150)
], sceSasCore.prototype, "__sceSasRevType", null);
__legacyDecorateClassTS([
  nativeFunction(4186157446, 150)
], sceSasCore.prototype, "__sceSasRevVON", null);
__legacyDecorateClassTS([
  nativeFunction(3584174537, 150)
], sceSasCore.prototype, "__sceSasRevEVOL", null);
__legacyDecorateClassTS([
  nativeFunction(645557714, 150)
], sceSasCore.prototype, "__sceSasRevParam", null);
__legacyDecorateClassTS([
  nativeFunction(3076917795, 150)
], sceSasCore.prototype, "__sceSasSetNoise", null);
sceSasCore = __legacyDecorateClassTS([
  hleModule("sceSasCore")
], sceSasCore);
// src/hle/module/sceOpenPSID.ts
var FAKE_PSID = new Uint8Array([
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15
]);

class sceOpenPSID {
  name = "sceOpenPSID";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceOpenPSIDGetOpenPSID() {
    const openPSIDPtr = this.ctx.argPtr(0);
    if (openPSIDPtr) {
      for (let i = 0;i < 16; i++) {
        this.ctx.write8(openPSIDPtr + i, FAKE_PSID[i]);
      }
    }
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(3332107214, 150)
], sceOpenPSID.prototype, "sceOpenPSIDGetOpenPSID", null);
sceOpenPSID = __legacyDecorateClassTS([
  hleModule("sceOpenPSID")
], sceOpenPSID);
// src/hle/module/sceVaudio.ts
class sceVaudio {
  name = "sceVaudio";
  ctx;
  channel = {
    reserved: false,
    sampleCount: 0,
    frequency: 48000,
    format: 0
  };
  init(ctx) {
    this.ctx = ctx;
    this.channel = {
      reserved: false,
      sampleCount: 0,
      frequency: 48000,
      format: 0
    };
  }
  sceVaudioChReserve() {
    const sampleCount = this.ctx.arg(0);
    const frequency = this.ctx.arg(1);
    const format2 = this.ctx.arg(2);
    if (this.channel.reserved) {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_BUSY;
    }
    this.channel.reserved = true;
    this.channel.sampleCount = sampleCount;
    this.channel.frequency = frequency;
    this.channel.format = format2;
    return SceKernelErrors.ERROR_OK;
  }
  sceVaudioChRelease() {
    if (!this.channel.reserved) {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }
    this.channel.reserved = false;
    return SceKernelErrors.ERROR_OK;
  }
  sceVaudioOutputBlocking() {
    const vol = this.ctx.arg(0);
    const bufPtr = this.ctx.argPtr(1);
    if (!this.channel.reserved) {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.channel.sampleCount);
      }, Math.floor(this.channel.sampleCount / 48));
    });
  }
  sceVaudioSetEffectType() {
    return SceKernelErrors.ERROR_OK;
  }
  sceVaudioSetAlcMode() {
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(1733844477, 150)
], sceVaudio.prototype, "sceVaudioChReserve", null);
__legacyDecorateClassTS([
  nativeFunction(2307271006, 150)
], sceVaudio.prototype, "sceVaudioChRelease", null);
__legacyDecorateClassTS([
  nativeFunction(62292093, 150)
], sceVaudio.prototype, "sceVaudioOutputBlocking", null);
__legacyDecorateClassTS([
  nativeFunction(879738516, 150)
], sceVaudio.prototype, "sceVaudioSetEffectType", null);
__legacyDecorateClassTS([
  nativeFunction(3419712593, 150)
], sceVaudio.prototype, "sceVaudioSetAlcMode", null);
sceVaudio = __legacyDecorateClassTS([
  hleModule("sceVaudio")
], sceVaudio);
// src/hle/module/sceWlanDrv.ts
class sceWlanDrv {
  name = "sceWlanDrv";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceWlanGetSwitchState() {
    return 1;
  }
  sceWlanGetEtherAddr() {
    const etherAddrPtr = this.ctx.argPtr(0);
    const mac = [0, 17, 34, 51, 68, 85];
    if (etherAddrPtr) {
      for (let i = 0;i < 6; i++) {
        this.ctx.write8(etherAddrPtr + i, mac[i]);
      }
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceWlanDevIsPowerOn() {
    return 1;
  }
  sceWlanDevAttach() {
    return SceKernelErrors.ERROR_OK;
  }
  sceWlanDevDetach() {
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(3614848665, 150)
], sceWlanDrv.prototype, "sceWlanGetSwitchState", null);
__legacyDecorateClassTS([
  nativeFunction(207757441, 150)
], sceWlanDrv.prototype, "sceWlanGetEtherAddr", null);
__legacyDecorateClassTS([
  nativeFunction(2470710033, 150)
], sceWlanDrv.prototype, "sceWlanDevIsPowerOn", null);
__legacyDecorateClassTS([
  nativeFunction(1210887834, 150)
], sceWlanDrv.prototype, "sceWlanDevAttach", null);
__legacyDecorateClassTS([
  nativeFunction(3383282359, 150)
], sceWlanDrv.prototype, "sceWlanDevDetach", null);
sceWlanDrv = __legacyDecorateClassTS([
  hleModule("sceWlanDrv")
], sceWlanDrv);
// src/hle/module/InterruptManager.ts
var PspInterrupts;
((PspInterrupts2) => {
  PspInterrupts2[PspInterrupts2["GPIO"] = 4] = "GPIO";
  PspInterrupts2[PspInterrupts2["ATA"] = 5] = "ATA";
  PspInterrupts2[PspInterrupts2["UMD"] = 6] = "UMD";
  PspInterrupts2[PspInterrupts2["MSCM0"] = 7] = "MSCM0";
  PspInterrupts2[PspInterrupts2["WLAN"] = 8] = "WLAN";
  PspInterrupts2[PspInterrupts2["AUDIO"] = 10] = "AUDIO";
  PspInterrupts2[PspInterrupts2["I2C"] = 12] = "I2C";
  PspInterrupts2[PspInterrupts2["SIRS"] = 14] = "SIRS";
  PspInterrupts2[PspInterrupts2["SYSTIMER0"] = 15] = "SYSTIMER0";
  PspInterrupts2[PspInterrupts2["SYSTIMER1"] = 16] = "SYSTIMER1";
  PspInterrupts2[PspInterrupts2["SYSTIMER2"] = 17] = "SYSTIMER2";
  PspInterrupts2[PspInterrupts2["SYSTIMER3"] = 18] = "SYSTIMER3";
  PspInterrupts2[PspInterrupts2["THREAD0"] = 19] = "THREAD0";
  PspInterrupts2[PspInterrupts2["NAND"] = 20] = "NAND";
  PspInterrupts2[PspInterrupts2["DMACPLUS"] = 21] = "DMACPLUS";
  PspInterrupts2[PspInterrupts2["DMA0"] = 22] = "DMA0";
  PspInterrupts2[PspInterrupts2["DMA1"] = 23] = "DMA1";
  PspInterrupts2[PspInterrupts2["MEMLMD"] = 24] = "MEMLMD";
  PspInterrupts2[PspInterrupts2["GE"] = 25] = "GE";
  PspInterrupts2[PspInterrupts2["VBLANK"] = 30] = "VBLANK";
  PspInterrupts2[PspInterrupts2["MECODEC"] = 31] = "MECODEC";
  PspInterrupts2[PspInterrupts2["HPRM"] = 36] = "HPRM";
  PspInterrupts2[PspInterrupts2["MSCM1"] = 60] = "MSCM1";
  PspInterrupts2[PspInterrupts2["MSCM2"] = 61] = "MSCM2";
  PspInterrupts2[PspInterrupts2["NUMBER_INTERRUPTS"] = 67] = "NUMBER_INTERRUPTS";
})(PspInterrupts ||= {});

class InterruptManager {
  name = "InterruptManager";
  ctx;
  handlers = new Map;
  init(ctx) {
    this.ctx = ctx;
    this.handlers.clear();
  }
  getHandler(interrupt, index) {
    if (!this.handlers.has(interrupt)) {
      this.handlers.set(interrupt, new Map);
    }
    const interruptHandlers = this.handlers.get(interrupt);
    if (!interruptHandlers.has(index)) {
      interruptHandlers.set(index, {
        enabled: false,
        address: 0,
        argument: 0
      });
    }
    return interruptHandlers.get(index);
  }
  sceKernelRegisterSubIntrHandler() {
    const interrupt = this.ctx.arg(0);
    const handlerIndex = this.ctx.arg(1);
    const callbackAddress = this.ctx.arg(2);
    const callbackArgument = this.ctx.arg(3);
    this.ctx.log(`sceKernelRegisterSubIntrHandler(${PspInterrupts[interrupt] || interrupt}, ${handlerIndex}, 0x${callbackAddress.toString(16)})`);
    const handler = this.getHandler(interrupt, handlerIndex);
    handler.address = callbackAddress;
    handler.argument = callbackArgument;
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelEnableSubIntr() {
    const interrupt = this.ctx.arg(0);
    const handlerIndex = this.ctx.arg(1);
    if (interrupt >= 67 /* NUMBER_INTERRUPTS */) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }
    const handler = this.getHandler(interrupt, handlerIndex);
    handler.enabled = true;
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelDisableSubIntr() {
    const interrupt = this.ctx.arg(0);
    const handlerIndex = this.ctx.arg(1);
    if (interrupt >= 67 /* NUMBER_INTERRUPTS */) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }
    const handler = this.getHandler(interrupt, handlerIndex);
    handler.enabled = false;
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelReleaseSubIntrHandler() {
    const interrupt = this.ctx.arg(0);
    const handlerIndex = this.ctx.arg(1);
    if (interrupt >= 67 /* NUMBER_INTERRUPTS */) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }
    const interruptHandlers = this.handlers.get(interrupt);
    if (interruptHandlers) {
      interruptHandlers.delete(handlerIndex);
    }
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(3389301433, 150)
], InterruptManager.prototype, "sceKernelRegisterSubIntrHandler", null);
__legacyDecorateClassTS([
  nativeFunction(4220396268, 150)
], InterruptManager.prototype, "sceKernelEnableSubIntr", null);
__legacyDecorateClassTS([
  nativeFunction(2382092167, 150)
], InterruptManager.prototype, "sceKernelDisableSubIntr", null);
__legacyDecorateClassTS([
  nativeFunction(3592317281, 150)
], InterruptManager.prototype, "sceKernelReleaseSubIntrHandler", null);
InterruptManager = __legacyDecorateClassTS([
  hleModule("InterruptManager")
], InterruptManager);
// src/hle/module/UtilsForKernel.ts
class UtilsForKernel {
  name = "UtilsForKernel";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceKernelIcacheInvalidateRange() {}
  sceKernelDcacheInvalidateRange() {}
  sceKernelIcacheInvalidateAll() {}
  sceKernelDcacheWritebackAll() {}
  sceKernelDcacheWritebackInvalidateAll() {}
  sceKernelDcacheWritebackRange() {}
  sceKernelDcacheWritebackInvalidateRange() {}
}
__legacyDecorateClassTS([
  nativeFunction(3269424910, 150)
], UtilsForKernel.prototype, "sceKernelIcacheInvalidateRange", null);
__legacyDecorateClassTS([
  nativeFunction(3215556706, 150)
], UtilsForKernel.prototype, "sceKernelDcacheInvalidateRange", null);
__legacyDecorateClassTS([
  nativeFunction(2450460746, 150)
], UtilsForKernel.prototype, "sceKernelIcacheInvalidateAll", null);
__legacyDecorateClassTS([
  nativeFunction(2043790330, 150)
], UtilsForKernel.prototype, "sceKernelDcacheWritebackAll", null);
__legacyDecorateClassTS([
  nativeFunction(3023429317, 150)
], UtilsForKernel.prototype, "sceKernelDcacheWritebackInvalidateAll", null);
__legacyDecorateClassTS([
  nativeFunction(1055066145, 150)
], UtilsForKernel.prototype, "sceKernelDcacheWritebackRange", null);
__legacyDecorateClassTS([
  nativeFunction(884603550, 150)
], UtilsForKernel.prototype, "sceKernelDcacheWritebackInvalidateRange", null);
UtilsForKernel = __legacyDecorateClassTS([
  hleModule("UtilsForKernel")
], UtilsForKernel);
// src/hle/module/sceLibFont.ts
class sceLibFont {
  name = "sceLibFont";
  ctx;
  nextLibId = 1;
  nextFontId = 1;
  fontLibs = new Map;
  fonts = new Map;
  init(ctx) {
    this.ctx = ctx;
    this.fontLibs.clear();
    this.fonts.clear();
    this.nextLibId = 1;
    this.nextFontId = 1;
  }
  sceFontNewLib() {
    const paramsPtr = this.ctx.argPtr(0);
    const errorCodePtr = this.ctx.argPtr(1);
    const libId = this.nextLibId++;
    this.fontLibs.set(libId, {
      id: libId,
      horizontalRes: 128,
      verticalRes: 128
    });
    if (errorCodePtr) {
      this.ctx.write32(errorCodePtr, 0);
    }
    return libId;
  }
  sceFontDoneLib() {
    const fontLibId = this.ctx.arg(0);
    this.fontLibs.delete(fontLibId);
    return SceKernelErrors.ERROR_OK;
  }
  sceFontFindOptimumFont() {
    const fontLibId = this.ctx.arg(0);
    const fontStylePtr = this.ctx.argPtr(1);
    const errorCodePtr = this.ctx.argPtr(2);
    if (errorCodePtr) {
      this.ctx.write32(errorCodePtr, 0);
    }
    return 0;
  }
  sceFontFindFont() {
    const fontLibId = this.ctx.arg(0);
    const fontStylePtr = this.ctx.argPtr(1);
    const errorCodePtr = this.ctx.argPtr(2);
    if (errorCodePtr) {
      this.ctx.write32(errorCodePtr, 0);
    }
    return 0;
  }
  sceFontOpen() {
    const fontLibId = this.ctx.arg(0);
    const index = this.ctx.arg(1);
    const mode = this.ctx.arg(2);
    const errorCodePtr = this.ctx.argPtr(3);
    const fontId = this.nextFontId++;
    this.fonts.set(fontId, {
      id: fontId,
      libId: fontLibId
    });
    if (errorCodePtr) {
      this.ctx.write32(errorCodePtr, 0);
    }
    return fontId;
  }
  sceFontOpenUserFile() {
    const fontLibId = this.ctx.arg(0);
    const fileNamePtr = this.ctx.argPtr(1);
    const mode = this.ctx.arg(2);
    const errorCodePtr = this.ctx.argPtr(3);
    const fontId = this.nextFontId++;
    this.fonts.set(fontId, {
      id: fontId,
      libId: fontLibId
    });
    if (errorCodePtr) {
      this.ctx.write32(errorCodePtr, 0);
    }
    return fontId;
  }
  sceFontOpenUserMemory() {
    const fontLibId = this.ctx.arg(0);
    const memoryPtr = this.ctx.argPtr(1);
    const memorySize = this.ctx.arg(2);
    const errorCodePtr = this.ctx.argPtr(3);
    const fontId = this.nextFontId++;
    this.fonts.set(fontId, {
      id: fontId,
      libId: fontLibId
    });
    if (errorCodePtr) {
      this.ctx.write32(errorCodePtr, 0);
    }
    return fontId;
  }
  sceFontClose() {
    const fontId = this.ctx.arg(0);
    this.fonts.delete(fontId);
    return SceKernelErrors.ERROR_OK;
  }
  sceFontGetFontInfo() {
    const fontId = this.ctx.arg(0);
    const fontInfoPtr = this.ctx.argPtr(1);
    if (fontInfoPtr) {
      for (let i = 0;i < 264; i++) {
        this.ctx.write8(fontInfoPtr + i, 0);
      }
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceFontSetResolution() {
    const fontLibId = this.ctx.arg(0);
    const lib = this.fontLibs.get(fontLibId);
    if (lib) {
      lib.horizontalRes = 128;
      lib.verticalRes = 128;
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceFontGetNumFontList() {
    const fontLibId = this.ctx.arg(0);
    const errorCodePtr = this.ctx.argPtr(1);
    if (errorCodePtr) {
      this.ctx.write32(errorCodePtr, 0);
    }
    return 1;
  }
  sceFontGetFontList() {
    const fontLibId = this.ctx.arg(0);
    const fontStylePtr = this.ctx.argPtr(1);
    const numFonts = this.ctx.arg(2);
    return 0;
  }
  sceFontGetCharInfo() {
    const fontId = this.ctx.arg(0);
    const charCode = this.ctx.arg(1);
    const charInfoPtr = this.ctx.argPtr(2);
    if (charInfoPtr) {
      for (let i = 0;i < 60; i++) {
        this.ctx.write8(charInfoPtr + i, 0);
      }
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceFontGetCharGlyphImage() {
    return SceKernelErrors.ERROR_OK;
  }
  sceFontGetCharGlyphImage_Clip() {
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(1743879895, 150)
], sceLibFont.prototype, "sceFontNewLib", null);
__legacyDecorateClassTS([
  nativeFunction(1464561596, 150)
], sceLibFont.prototype, "sceFontDoneLib", null);
__legacyDecorateClassTS([
  nativeFunction(161411900, 150)
], sceLibFont.prototype, "sceFontFindOptimumFont", null);
__legacyDecorateClassTS([
  nativeFunction(1746821543, 150)
], sceLibFont.prototype, "sceFontFindFont", null);
__legacyDecorateClassTS([
  nativeFunction(2821992861, 150)
], sceLibFont.prototype, "sceFontOpen", null);
__legacyDecorateClassTS([
  nativeFunction(1476179763, 150)
], sceLibFont.prototype, "sceFontOpenUserFile", null);
__legacyDecorateClassTS([
  nativeFunction(3146678246, 150)
], sceLibFont.prototype, "sceFontOpenUserMemory", null);
__legacyDecorateClassTS([
  nativeFunction(988449974, 150)
], sceLibFont.prototype, "sceFontClose", null);
__legacyDecorateClassTS([
  nativeFunction(229069662, 150)
], sceLibFont.prototype, "sceFontGetFontInfo", null);
__legacyDecorateClassTS([
  nativeFunction(1210659456, 150)
], sceLibFont.prototype, "sceFontSetResolution", null);
__legacyDecorateClassTS([
  nativeFunction(670492226, 150)
], sceLibFont.prototype, "sceFontGetNumFontList", null);
__legacyDecorateClassTS([
  nativeFunction(3161839707, 150)
], sceLibFont.prototype, "sceFontGetFontList", null);
__legacyDecorateClassTS([
  nativeFunction(3704097839, 150)
], sceLibFont.prototype, "sceFontGetCharInfo", null);
__legacyDecorateClassTS([
  nativeFunction(2551138453, 150)
], sceLibFont.prototype, "sceFontGetCharGlyphImage", null);
__legacyDecorateClassTS([
  nativeFunction(3390990661, 150)
], sceLibFont.prototype, "sceFontGetCharGlyphImage_Clip", null);
sceLibFont = __legacyDecorateClassTS([
  hleModule("sceLibFont")
], sceLibFont);
// src/hle/module/sceMp3.ts
var MAX_MP3_HANDLES = 2;
function createMp3Handle(id) {
  return {
    id,
    inUse: false,
    mp3Buf: 0,
    mp3BufSize: 0,
    pcmBuf: 0,
    pcmBufSize: 0,
    sampleRate: 44100,
    channels: 2,
    sumDecodedSamples: 0,
    loopNum: 0
  };
}

class sceMp3 {
  name = "sceMp3";
  ctx;
  handles = [];
  init(ctx) {
    this.ctx = ctx;
    this.handles = [];
    for (let i = 0;i < MAX_MP3_HANDLES; i++) {
      this.handles.push(createMp3Handle(i));
    }
  }
  getHandle(id) {
    if (id < 0 || id >= MAX_MP3_HANDLES) {
      return null;
    }
    return this.handles[id];
  }
  sceMp3InitResource() {
    return SceKernelErrors.ERROR_OK;
  }
  sceMp3TermResource() {
    return SceKernelErrors.ERROR_OK;
  }
  sceMp3ReserveMp3Handle() {
    const mp3InitPtr = this.ctx.argPtr(0);
    for (const handle of this.handles) {
      if (!handle.inUse) {
        handle.inUse = true;
        if (mp3InitPtr) {
          handle.mp3Buf = this.ctx.read32(mp3InitPtr + 0);
          handle.mp3BufSize = this.ctx.read32(mp3InitPtr + 4);
          handle.pcmBuf = this.ctx.read32(mp3InitPtr + 8);
          handle.pcmBufSize = this.ctx.read32(mp3InitPtr + 12);
        }
        return handle.id;
      }
    }
    return SceKernelErrors.ERROR_BUSY;
  }
  sceMp3ReleaseMp3Handle() {
    const handleId = this.ctx.arg(0);
    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }
    Object.assign(handle, createMp3Handle(handleId));
    return SceKernelErrors.ERROR_OK;
  }
  sceMp3Init() {
    const handleId = this.ctx.arg(0);
    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }
    handle.sumDecodedSamples = 0;
    return SceKernelErrors.ERROR_OK;
  }
  sceMp3Decode() {
    const handleId = this.ctx.arg(0);
    const outPcmPtr = this.ctx.argPtr(1);
    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }
    if (outPcmPtr) {
      this.ctx.write32(outPcmPtr, handle.pcmBuf);
    }
    return 0;
  }
  sceMp3GetInfoToAddStreamData() {
    const handleId = this.ctx.arg(0);
    const dstPtr = this.ctx.argPtr(1);
    const toWritePtr = this.ctx.argPtr(2);
    const srcPosPtr = this.ctx.argPtr(3);
    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }
    if (dstPtr) {
      this.ctx.write32(dstPtr, handle.mp3Buf);
    }
    if (toWritePtr) {
      this.ctx.write32(toWritePtr, 0);
    }
    if (srcPosPtr) {
      this.ctx.write32(srcPosPtr, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceMp3NotifyAddStreamData() {
    const handleId = this.ctx.arg(0);
    const size = this.ctx.arg(1);
    return SceKernelErrors.ERROR_OK;
  }
  sceMp3CheckStreamDataNeeded() {
    const handleId = this.ctx.arg(0);
    return 0;
  }
  sceMp3SetLoopNum() {
    const handleId = this.ctx.arg(0);
    const loopNum = this.ctx.arg(1);
    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }
    handle.loopNum = loopNum;
    return SceKernelErrors.ERROR_OK;
  }
  sceMp3GetLoopNum() {
    const handleId = this.ctx.arg(0);
    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }
    return handle.loopNum;
  }
  sceMp3GetSamplingRate() {
    const handleId = this.ctx.arg(0);
    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }
    return handle.sampleRate;
  }
  sceMp3GetBitRate() {
    const handleId = this.ctx.arg(0);
    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }
    return 128;
  }
  sceMp3GetMp3ChannelNum() {
    const handleId = this.ctx.arg(0);
    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }
    return handle.channels;
  }
  sceMp3GetSumDecodedSample() {
    const handleId = this.ctx.arg(0);
    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }
    return handle.sumDecodedSamples;
  }
  sceMp3GetMaxOutputSample() {
    const handleId = this.ctx.arg(0);
    return 1152;
  }
  sceMp3ResetPlayPosition() {
    const handleId = this.ctx.arg(0);
    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }
    handle.sumDecodedSamples = 0;
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(896860272, 150)
], sceMp3.prototype, "sceMp3InitResource", null);
__legacyDecorateClassTS([
  nativeFunction(1009754200, 150)
], sceMp3.prototype, "sceMp3TermResource", null);
__legacyDecorateClassTS([
  nativeFunction(132919834, 150)
], sceMp3.prototype, "sceMp3ReserveMp3Handle", null);
__legacyDecorateClassTS([
  nativeFunction(4115104307, 150)
], sceMp3.prototype, "sceMp3ReleaseMp3Handle", null);
__legacyDecorateClassTS([
  nativeFunction(1155559721, 150)
], sceMp3.prototype, "sceMp3Init", null);
__legacyDecorateClassTS([
  nativeFunction(3491873019, 150)
], sceMp3.prototype, "sceMp3Decode", null);
__legacyDecorateClassTS([
  nativeFunction(1932198954, 150)
], sceMp3.prototype, "sceMp3GetInfoToAddStreamData", null);
__legacyDecorateClassTS([
  nativeFunction(2271706688, 150)
], sceMp3.prototype, "sceMp3NotifyAddStreamData", null);
__legacyDecorateClassTS([
  nativeFunction(2802056719, 150)
], sceMp3.prototype, "sceMp3CheckStreamDataNeeded", null);
__legacyDecorateClassTS([
  nativeFunction(3639954001, 150)
], sceMp3.prototype, "sceMp3SetLoopNum", null);
__legacyDecorateClassTS([
  nativeFunction(893955784, 150)
], sceMp3.prototype, "sceMp3GetLoopNum", null);
__legacyDecorateClassTS([
  nativeFunction(2403666328, 150)
], sceMp3.prototype, "sceMp3GetSamplingRate", null);
__legacyDecorateClassTS([
  nativeFunction(2137614210, 150)
], sceMp3.prototype, "sceMp3GetBitRate", null);
__legacyDecorateClassTS([
  nativeFunction(2277663697, 150)
], sceMp3.prototype, "sceMp3GetMp3ChannelNum", null);
__legacyDecorateClassTS([
  nativeFunction(2327319896, 150)
], sceMp3.prototype, "sceMp3GetSumDecodedSample", null);
__legacyDecorateClassTS([
  nativeFunction(1022314575, 150)
], sceMp3.prototype, "sceMp3GetMaxOutputSample", null);
__legacyDecorateClassTS([
  nativeFunction(708216417, 150)
], sceMp3.prototype, "sceMp3ResetPlayPosition", null);
sceMp3 = __legacyDecorateClassTS([
  hleModule("sceMp3")
], sceMp3);
// src/hle/module/sceNet.ts
class sceNet {
  name = "sceNet";
  ctx;
  mac = new Uint8Array([1, 2, 3, 4, 5, 6]);
  init(ctx) {
    this.ctx = ctx;
    for (let i = 0;i < 6; i++) {
      this.mac[i] = Math.floor(Math.random() * 256);
    }
  }
  sceNetInit() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetTerm() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetFreeThreadinfo() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetThreadAbort() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetEtherStrton() {
    const stringPtr = this.ctx.argPtr(0);
    const macPtr = this.ctx.argPtr(1);
    if (stringPtr && macPtr) {
      const str = this.ctx.readStringZ(stringPtr);
      const parts = str.split(":");
      for (let i = 0;i < 6 && i < parts.length; i++) {
        this.ctx.write8(macPtr + i, parseInt(parts[i], 16) || 0);
      }
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetEtherNtostr() {
    const macPtr = this.ctx.argPtr(0);
    const stringPtr = this.ctx.argPtr(1);
    if (macPtr && stringPtr) {
      const parts = [];
      for (let i = 0;i < 6; i++) {
        parts.push(this.ctx.read8(macPtr + i).toString(16).padStart(2, "0"));
      }
      const str = parts.join(":");
      this.ctx.writeStringZ(stringPtr, str);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetGetLocalEtherAddr() {
    const macOut = this.ctx.argPtr(0);
    if (macOut) {
      for (let i = 0;i < 6; i++) {
        this.ctx.write8(macOut + i, this.mac[i]);
      }
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetGetMallocStat() {
    const statPtr = this.ctx.argPtr(0);
    if (statPtr) {
      this.ctx.write32(statPtr + 0, 65536);
      this.ctx.write32(statPtr + 4, 65536);
      this.ctx.write32(statPtr + 8, 65536);
    }
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(967784870, 150)
], sceNet.prototype, "sceNetInit", null);
__legacyDecorateClassTS([
  nativeFunction(672737449, 150)
], sceNet.prototype, "sceNetTerm", null);
__legacyDecorateClassTS([
  nativeFunction(1348760880, 150)
], sceNet.prototype, "sceNetFreeThreadinfo", null);
__legacyDecorateClassTS([
  nativeFunction(2909291718, 150)
], sceNet.prototype, "sceNetThreadAbort", null);
__legacyDecorateClassTS([
  nativeFunction(3531170249, 150)
], sceNet.prototype, "sceNetEtherStrton", null);
__legacyDecorateClassTS([
  nativeFunction(2302019920, 150)
], sceNet.prototype, "sceNetEtherNtostr", null);
__legacyDecorateClassTS([
  nativeFunction(200319918, 150)
], sceNet.prototype, "sceNetGetLocalEtherAddr", null);
__legacyDecorateClassTS([
  nativeFunction(3426303560, 150)
], sceNet.prototype, "sceNetGetMallocStat", null);
sceNet = __legacyDecorateClassTS([
  hleModule("sceNet")
], sceNet);
// src/hle/module/sceNetInet.ts
class sceNetInet {
  name = "sceNetInet";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceNetInetInit() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetInetTerm() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetInetSocket() {
    return -1;
  }
  sceNetInetClose() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetInetConnect() {
    return -1;
  }
  sceNetInetBind() {
    return -1;
  }
  sceNetInetListen() {
    return -1;
  }
  sceNetInetAccept() {
    return -1;
  }
  sceNetInetSend() {
    return -1;
  }
  sceNetInetSendto() {
    return -1;
  }
  sceNetInetRecv() {
    return -1;
  }
  sceNetInetRecvfrom() {
    return -1;
  }
  sceNetInetSelect() {
    return 0;
  }
  sceNetInetPoll() {
    return 0;
  }
  sceNetInetSetsockopt() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetInetGetsockopt() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetInetGetpeername() {
    return -1;
  }
  sceNetInetGetsockname() {
    return -1;
  }
  sceNetInetShutdown() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetInetGetErrno() {
    return 0;
  }
  sceNetInetInetAddr() {
    return 0;
  }
  sceNetInetInetAton() {
    return 1;
  }
  sceNetInetInetNtop() {
    return 0;
  }
  sceNetInetInetPton() {
    return 1;
  }
}
__legacyDecorateClassTS([
  nativeFunction(395588505, 150)
], sceNetInet.prototype, "sceNetInetInit", null);
__legacyDecorateClassTS([
  nativeFunction(2850907833, 150)
], sceNetInet.prototype, "sceNetInetTerm", null);
__legacyDecorateClassTS([
  nativeFunction(2340102671, 150)
], sceNetInet.prototype, "sceNetInetSocket", null);
__legacyDecorateClassTS([
  nativeFunction(2373092586, 150)
], sceNetInet.prototype, "sceNetInetClose", null);
__legacyDecorateClassTS([
  nativeFunction(1091253418, 150)
], sceNetInet.prototype, "sceNetInetConnect", null);
__legacyDecorateClassTS([
  nativeFunction(439613870, 150)
], sceNetInet.prototype, "sceNetInetBind", null);
__legacyDecorateClassTS([
  nativeFunction(3507100282, 150)
], sceNetInet.prototype, "sceNetInetListen", null);
__legacyDecorateClassTS([
  nativeFunction(3674820123, 150)
], sceNetInet.prototype, "sceNetInetAccept", null);
__legacyDecorateClassTS([
  nativeFunction(2057728444, 150)
], sceNetInet.prototype, "sceNetInetSend", null);
__legacyDecorateClassTS([
  nativeFunction(84119495, 150)
], sceNetInet.prototype, "sceNetInetSendto", null);
__legacyDecorateClassTS([
  nativeFunction(3450363033, 150)
], sceNetInet.prototype, "sceNetInetRecv", null);
__legacyDecorateClassTS([
  nativeFunction(3373351652, 150)
], sceNetInet.prototype, "sceNetInetRecvfrom", null);
__legacyDecorateClassTS([
  nativeFunction(1541985685, 150)
], sceNetInet.prototype, "sceNetInetSelect", null);
__legacyDecorateClassTS([
  nativeFunction(4205556189, 150)
], sceNetInet.prototype, "sceNetInetPoll", null);
__legacyDecorateClassTS([
  nativeFunction(803676135, 150)
], sceNetInet.prototype, "sceNetInetSetsockopt", null);
__legacyDecorateClassTS([
  nativeFunction(1242647676, 150)
], sceNetInet.prototype, "sceNetInetGetsockopt", null);
__legacyDecorateClassTS([
  nativeFunction(3012070100, 150)
], sceNetInet.prototype, "sceNetInetGetpeername", null);
__legacyDecorateClassTS([
  nativeFunction(372142037, 150)
], sceNetInet.prototype, "sceNetInetGetsockname", null);
__legacyDecorateClassTS([
  nativeFunction(1291734614, 150)
], sceNetInet.prototype, "sceNetInetShutdown", null);
__legacyDecorateClassTS([
  nativeFunction(3076348682, 150)
], sceNetInet.prototype, "sceNetInetGetErrno", null);
__legacyDecorateClassTS([
  nativeFunction(3087699959, 150)
], sceNetInet.prototype, "sceNetInetInetAddr", null);
__legacyDecorateClassTS([
  nativeFunction(3497600614, 150)
], sceNetInet.prototype, "sceNetInetInetAton", null);
__legacyDecorateClassTS([
  nativeFunction(3809184793, 150)
], sceNetInet.prototype, "sceNetInetInetNtop", null);
__legacyDecorateClassTS([
  nativeFunction(3796350678, 150)
], sceNetInet.prototype, "sceNetInetInetPton", null);
sceNetInet = __legacyDecorateClassTS([
  hleModule("sceNetInet")
], sceNetInet);
// src/hle/module/sceNetAdhoc.ts
class sceNetAdhoc {
  name = "sceNetAdhoc";
  ctx;
  pdpSockets = [];
  ptpSockets = [];
  nextPdpId = 1;
  nextPtpId = 1;
  init(ctx) {
    this.ctx = ctx;
    this.pdpSockets = [];
    this.ptpSockets = [];
    this.nextPdpId = 1;
    this.nextPtpId = 1;
  }
  sceNetAdhocInit() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocTerm() {
    this.pdpSockets = [];
    this.ptpSockets = [];
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocPdpCreate() {
    const macPtr = this.ctx.argPtr(0);
    const port = this.ctx.arg(1);
    const bufsize = this.ctx.arg(2);
    const socket = {
      id: this.nextPdpId++,
      inUse: true,
      port,
      bufSize: bufsize
    };
    this.pdpSockets.push(socket);
    return socket.id;
  }
  sceNetAdhocPdpDelete() {
    const pdpId = this.ctx.arg(0);
    const index = this.pdpSockets.findIndex((s) => s.id === pdpId);
    if (index >= 0) {
      this.pdpSockets.splice(index, 1);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocPdpSend() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocPdpRecv() {
    return 2151745289;
  }
  sceNetAdhocGetPdpStat() {
    const sizePtr = this.ctx.argPtr(0);
    const statPtr = this.ctx.argPtr(1);
    if (sizePtr) {
      this.ctx.write32(sizePtr, this.pdpSockets.length * 20);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocPollSocket() {
    return 0;
  }
  sceNetAdhocGameModeCreateMaster() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocGameModeCreateReplica() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocGameModeUpdateMaster() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocGameModeUpdateReplica() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocGameModeDeleteMaster() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocGameModeDeleteReplica() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocPtpOpen() {
    const socket = {
      id: this.nextPtpId++,
      inUse: true,
      srcPort: this.ctx.arg(1),
      destPort: this.ctx.arg(3),
      bufSize: this.ctx.arg(4)
    };
    this.ptpSockets.push(socket);
    return socket.id;
  }
  sceNetAdhocPtpListen() {
    const socket = {
      id: this.nextPtpId++,
      inUse: true,
      srcPort: this.ctx.arg(1),
      destPort: 0,
      bufSize: this.ctx.arg(2)
    };
    this.ptpSockets.push(socket);
    return socket.id;
  }
  sceNetAdhocPtpConnect() {
    return 2151745289;
  }
  sceNetAdhocPtpAccept() {
    return 2151745289;
  }
  sceNetAdhocPtpSend() {
    return 0;
  }
  sceNetAdhocPtpRecv() {
    return 0;
  }
  sceNetAdhocPtpFlush() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocPtpClose() {
    const ptpId = this.ctx.arg(0);
    const index = this.ptpSockets.findIndex((s) => s.id === ptpId);
    if (index >= 0) {
      this.ptpSockets.splice(index, 1);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocGetPtpStat() {
    const sizePtr = this.ctx.argPtr(0);
    if (sizePtr) {
      this.ctx.write32(sizePtr, this.ptpSockets.length * 28);
    }
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(3788906967, 150)
], sceNetAdhoc.prototype, "sceNetAdhocInit", null);
__legacyDecorateClassTS([
  nativeFunction(2787929943, 150)
], sceNetAdhoc.prototype, "sceNetAdhocTerm", null);
__legacyDecorateClassTS([
  nativeFunction(1871868955, 150)
], sceNetAdhoc.prototype, "sceNetAdhocPdpCreate", null);
__legacyDecorateClassTS([
  nativeFunction(2133310302, 150)
], sceNetAdhoc.prototype, "sceNetAdhocPdpDelete", null);
__legacyDecorateClassTS([
  nativeFunction(2884450192, 150)
], sceNetAdhoc.prototype, "sceNetAdhocPdpSend", null);
__legacyDecorateClassTS([
  nativeFunction(3756342787, 150)
], sceNetAdhoc.prototype, "sceNetAdhocPdpRecv", null);
__legacyDecorateClassTS([
  nativeFunction(3351379031, 150)
], sceNetAdhoc.prototype, "sceNetAdhocGetPdpStat", null);
__legacyDecorateClassTS([
  nativeFunction(2053516651, 150)
], sceNetAdhoc.prototype, "sceNetAdhocPollSocket", null);
__legacyDecorateClassTS([
  nativeFunction(2138424120, 150)
], sceNetAdhoc.prototype, "sceNetAdhocGameModeCreateMaster", null);
__legacyDecorateClassTS([
  nativeFunction(846768908, 150)
], sceNetAdhoc.prototype, "sceNetAdhocGameModeCreateReplica", null);
__legacyDecorateClassTS([
  nativeFunction(2562852040, 150)
], sceNetAdhoc.prototype, "sceNetAdhocGameModeUpdateMaster", null);
__legacyDecorateClassTS([
  nativeFunction(4197600078, 150)
], sceNetAdhoc.prototype, "sceNetAdhocGameModeUpdateReplica", null);
__legacyDecorateClassTS([
  nativeFunction(2686620514, 150)
], sceNetAdhoc.prototype, "sceNetAdhocGameModeDeleteMaster", null);
__legacyDecorateClassTS([
  nativeFunction(186788073, 150)
], sceNetAdhoc.prototype, "sceNetAdhocGameModeDeleteReplica", null);
__legacyDecorateClassTS([
  nativeFunction(2273275238, 150)
], sceNetAdhoc.prototype, "sceNetAdhocPtpOpen", null);
__legacyDecorateClassTS([
  nativeFunction(3767261889, 150)
], sceNetAdhoc.prototype, "sceNetAdhocPtpListen", null);
__legacyDecorateClassTS([
  nativeFunction(4235182203, 150)
], sceNetAdhoc.prototype, "sceNetAdhocPtpConnect", null);
__legacyDecorateClassTS([
  nativeFunction(2650280344, 150)
], sceNetAdhoc.prototype, "sceNetAdhocPtpAccept", null);
__legacyDecorateClassTS([
  nativeFunction(1302644616, 150)
], sceNetAdhoc.prototype, "sceNetAdhocPtpSend", null);
__legacyDecorateClassTS([
  nativeFunction(2347379518, 150)
], sceNetAdhoc.prototype, "sceNetAdhocPtpRecv", null);
__legacyDecorateClassTS([
  nativeFunction(2596466348, 150)
], sceNetAdhoc.prototype, "sceNetAdhocPtpFlush", null);
__legacyDecorateClassTS([
  nativeFunction(360604197, 150)
], sceNetAdhoc.prototype, "sceNetAdhocPtpClose", null);
__legacyDecorateClassTS([
  nativeFunction(3110621464, 150)
], sceNetAdhoc.prototype, "sceNetAdhocGetPtpStat", null);
sceNetAdhoc = __legacyDecorateClassTS([
  hleModule("sceNetAdhoc")
], sceNetAdhoc);
// src/hle/module/sceNetAdhocctl.ts
class sceNetAdhocctl {
  name = "sceNetAdhocctl";
  ctx;
  currentState = 0 /* Disconnected */;
  handlers = [];
  nextHandlerId = 1;
  init(ctx) {
    this.ctx = ctx;
    this.currentState = 0 /* Disconnected */;
    this.handlers = [];
    this.nextHandlerId = 1;
  }
  sceNetAdhocctlInit() {
    this.currentState = 0 /* Disconnected */;
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocctlTerm() {
    this.handlers = [];
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocctlConnect() {
    this.currentState = 1 /* Connected */;
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocctlDisconnect() {
    this.currentState = 0 /* Disconnected */;
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocctlGetState() {
    const stateOut = this.ctx.argPtr(0);
    if (stateOut) {
      this.ctx.write32(stateOut, this.currentState);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocctlAddHandler() {
    const callback = this.ctx.arg(0);
    const parameter = this.ctx.arg(1);
    const handler = {
      id: this.nextHandlerId++,
      callback,
      argument: parameter
    };
    this.handlers.push(handler);
    return handler.id;
  }
  sceNetAdhocctlDelHandler() {
    const handlerId = this.ctx.arg(0);
    const index = this.handlers.findIndex((h) => h.id === handlerId);
    if (index >= 0) {
      this.handlers.splice(index, 1);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocctlScan() {
    this.currentState = 2 /* Scan */;
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocctlGetScanInfo() {
    const lengthPtr = this.ctx.argPtr(0);
    if (lengthPtr) {
      this.ctx.write32(lengthPtr, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocctlCreate() {
    this.currentState = 1 /* Connected */;
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocctlJoin() {
    this.currentState = 1 /* Connected */;
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocctlGetPeerList() {
    const lengthPtr = this.ctx.argPtr(0);
    if (lengthPtr) {
      this.ctx.write32(lengthPtr, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocctlGetPeerInfo() {
    return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_DEVICE;
  }
  sceNetAdhocctlGetAdhocId() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocctlGetNameByAddr() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocctlGetAddrByName() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocctlGetParameter() {
    const paramPtr = this.ctx.argPtr(0);
    if (paramPtr) {
      for (let i = 0;i < 146; i++) {
        this.ctx.write8(paramPtr + i, 0);
      }
      this.ctx.write32(paramPtr, 1);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocctlCreateEnterGameMode() {
    this.currentState = 3 /* Game */;
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocctlJoinEnterGameMode() {
    this.currentState = 3 /* Game */;
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocctlExitGameMode() {
    this.currentState = 0 /* Disconnected */;
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocctlGetGameModeInfo() {
    const infoPtr = this.ctx.argPtr(0);
    if (infoPtr) {
      this.ctx.write32(infoPtr, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(3798934126, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlInit", null);
__legacyDecorateClassTS([
  nativeFunction(2640879123, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlTerm", null);
__legacyDecorateClassTS([
  nativeFunction(181421037, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlConnect", null);
__legacyDecorateClassTS([
  nativeFunction(876617061, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlDisconnect", null);
__legacyDecorateClassTS([
  nativeFunction(1978454918, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlGetState", null);
__legacyDecorateClassTS([
  nativeFunction(548607904, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlAddHandler", null);
__legacyDecorateClassTS([
  nativeFunction(1677871371, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlDelHandler", null);
__legacyDecorateClassTS([
  nativeFunction(150992800, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlScan", null);
__legacyDecorateClassTS([
  nativeFunction(2175721918, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlGetScanInfo", null);
__legacyDecorateClassTS([
  nativeFunction(3896856709, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlCreate", null);
__legacyDecorateClassTS([
  nativeFunction(1585412553, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlJoin", null);
__legacyDecorateClassTS([
  nativeFunction(3781348116, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlGetPeerList", null);
__legacyDecorateClassTS([
  nativeFunction(2377662428, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlGetPeerInfo", null);
__legacyDecorateClassTS([
  nativeFunction(908902031, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlGetAdhocId", null);
__legacyDecorateClassTS([
  nativeFunction(2572552894, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlGetNameByAddr", null);
__legacyDecorateClassTS([
  nativeFunction(2299969539, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlGetAddrByName", null);
__legacyDecorateClassTS([
  nativeFunction(3738817166, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlGetParameter", null);
__legacyDecorateClassTS([
  nativeFunction(2780845518, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlCreateEnterGameMode", null);
__legacyDecorateClassTS([
  nativeFunction(536385349, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlJoinEnterGameMode", null);
__legacyDecorateClassTS([
  nativeFunction(3482191949, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlExitGameMode", null);
__legacyDecorateClassTS([
  nativeFunction(1510034656, 150)
], sceNetAdhocctl.prototype, "sceNetAdhocctlGetGameModeInfo", null);
sceNetAdhocctl = __legacyDecorateClassTS([
  hleModule("sceNetAdhocctl")
], sceNetAdhocctl);
// src/hle/module/sceNetAdhocMatching.ts
class sceNetAdhocMatching {
  name = "sceNetAdhocMatching";
  ctx;
  contexts = [];
  nextContextId = 1;
  poolSize = 0;
  init(ctx) {
    this.ctx = ctx;
    this.contexts = [];
    this.nextContextId = 1;
    this.poolSize = 0;
  }
  sceNetAdhocMatchingInit() {
    const memSize = this.ctx.arg(0);
    this.poolSize = memSize;
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocMatchingTerm() {
    this.contexts = [];
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocMatchingCreate() {
    const mode = this.ctx.arg(0);
    const maxPeers = this.ctx.arg(1);
    const port = this.ctx.arg(2);
    const bufSize = this.ctx.arg(3);
    const callback = this.ctx.arg(8);
    const context = {
      id: this.nextContextId++,
      mode,
      maxPeers,
      port,
      bufSize,
      callback,
      started: false
    };
    this.contexts.push(context);
    return context.id;
  }
  sceNetAdhocMatchingDelete() {
    const matchingId = this.ctx.arg(0);
    const index = this.contexts.findIndex((c) => c.id === matchingId);
    if (index >= 0) {
      this.contexts.splice(index, 1);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocMatchingStart() {
    const matchingId = this.ctx.arg(0);
    const context = this.contexts.find((c) => c.id === matchingId);
    if (context) {
      context.started = true;
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocMatchingStop() {
    const matchingId = this.ctx.arg(0);
    const context = this.contexts.find((c) => c.id === matchingId);
    if (context) {
      context.started = false;
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocMatchingSelectTarget() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocMatchingCancelTarget() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocMatchingCancelTargetWithOpt() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocMatchingSendData() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocMatchingAbortSendData() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocMatchingSetHelloOpt() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocMatchingGetHelloOpt() {
    const matchingId = this.ctx.arg(0);
    const lengthPtr = this.ctx.argPtr(1);
    if (lengthPtr) {
      this.ctx.write32(lengthPtr, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocMatchingGetMembers() {
    const matchingId = this.ctx.arg(0);
    const lengthPtr = this.ctx.argPtr(1);
    if (lengthPtr) {
      this.ctx.write32(lengthPtr, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetAdhocMatchingGetPoolMaxAlloc() {
    return this.poolSize;
  }
  sceNetAdhocMatchingGetPoolStat() {
    const statPtr = this.ctx.argPtr(0);
    if (statPtr) {
      this.ctx.write32(statPtr + 0, this.poolSize);
      this.ctx.write32(statPtr + 4, this.poolSize);
      this.ctx.write32(statPtr + 8, this.poolSize);
    }
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(707403271, 150)
], sceNetAdhocMatching.prototype, "sceNetAdhocMatchingInit", null);
__legacyDecorateClassTS([
  nativeFunction(2034625754, 150)
], sceNetAdhocMatching.prototype, "sceNetAdhocMatchingTerm", null);
__legacyDecorateClassTS([
  nativeFunction(3395213935, 150)
], sceNetAdhocMatching.prototype, "sceNetAdhocMatchingCreate", null);
__legacyDecorateClassTS([
  nativeFunction(4050562895, 150)
], sceNetAdhocMatching.prototype, "sceNetAdhocMatchingDelete", null);
__legacyDecorateClassTS([
  nativeFunction(2481928259, 150)
], sceNetAdhocMatching.prototype, "sceNetAdhocMatchingStart", null);
__legacyDecorateClassTS([
  nativeFunction(850482867, 150)
], sceNetAdhocMatching.prototype, "sceNetAdhocMatchingStop", null);
__legacyDecorateClassTS([
  nativeFunction(1581075321, 150)
], sceNetAdhocMatching.prototype, "sceNetAdhocMatchingSelectTarget", null);
__legacyDecorateClassTS([
  nativeFunction(3929825544, 150)
], sceNetAdhocMatching.prototype, "sceNetAdhocMatchingCancelTarget", null);
__legacyDecorateClassTS([
  nativeFunction(2404957919, 150)
], sceNetAdhocMatching.prototype, "sceNetAdhocMatchingCancelTargetWithOpt", null);
__legacyDecorateClassTS([
  nativeFunction(4153701079, 150)
], sceNetAdhocMatching.prototype, "sceNetAdhocMatchingSendData", null);
__legacyDecorateClassTS([
  nativeFunction(3961074557, 150)
], sceNetAdhocMatching.prototype, "sceNetAdhocMatchingAbortSendData", null);
__legacyDecorateClassTS([
  nativeFunction(3046007223, 150)
], sceNetAdhocMatching.prototype, "sceNetAdhocMatchingSetHelloOpt", null);
__legacyDecorateClassTS([
  nativeFunction(3050925098, 150)
], sceNetAdhocMatching.prototype, "sceNetAdhocMatchingGetHelloOpt", null);
__legacyDecorateClassTS([
  nativeFunction(3314273694, 150)
], sceNetAdhocMatching.prototype, "sceNetAdhocMatchingGetMembers", null);
__legacyDecorateClassTS([
  nativeFunction(1090057269, 150)
], sceNetAdhocMatching.prototype, "sceNetAdhocMatchingGetPoolMaxAlloc", null);
__legacyDecorateClassTS([
  nativeFunction(2623339389, 150)
], sceNetAdhocMatching.prototype, "sceNetAdhocMatchingGetPoolStat", null);
sceNetAdhocMatching = __legacyDecorateClassTS([
  hleModule("sceNetAdhocMatching")
], sceNetAdhocMatching);
// src/hle/module/sceNetApctl.ts
class sceNetApctl {
  name = "sceNetApctl";
  ctx;
  currentState = 0 /* Disconnected */;
  handlers = [];
  nextHandlerId = 1;
  init(ctx) {
    this.ctx = ctx;
    this.currentState = 0 /* Disconnected */;
    this.handlers = [];
    this.nextHandlerId = 1;
  }
  sceNetApctlInit() {
    this.currentState = 0 /* Disconnected */;
    return SceKernelErrors.ERROR_OK;
  }
  sceNetApctlTerm() {
    this.handlers = [];
    return SceKernelErrors.ERROR_OK;
  }
  sceNetApctlConnect() {
    this.currentState = 4 /* GotIP */;
    return SceKernelErrors.ERROR_OK;
  }
  sceNetApctlDisconnect() {
    this.currentState = 0 /* Disconnected */;
    return SceKernelErrors.ERROR_OK;
  }
  sceNetApctlGetState() {
    const statePtr = this.ctx.argPtr(0);
    if (statePtr) {
      this.ctx.write32(statePtr, this.currentState);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetApctlAddHandler() {
    const callback = this.ctx.arg(0);
    const argument = this.ctx.arg(1);
    const handler = {
      id: this.nextHandlerId++,
      callback,
      argument
    };
    this.handlers.push(handler);
    return handler.id;
  }
  sceNetApctlDelHandler() {
    const handlerId = this.ctx.arg(0);
    const index = this.handlers.findIndex((h) => h.id === handlerId);
    if (index >= 0) {
      this.handlers.splice(index, 1);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetApctlGetInfo() {
    const infoType = this.ctx.arg(0);
    const infoPtr = this.ctx.argPtr(1);
    if (!infoPtr) {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }
    switch (infoType) {
      case 8 /* IP */:
      case 9 /* SubnetMask */:
      case 10 /* Gateway */:
      case 11 /* PrimaryDNS */:
      case 12 /* SecondaryDNS */:
        this.ctx.writeStringZ(infoPtr, "192.168.1.1");
        break;
      case 2 /* SSID */:
      case 0 /* ProfileName */:
        this.ctx.writeStringZ(infoPtr, "PSP_Emulator");
        break;
      case 3 /* SSIDLength */:
        this.ctx.write32(infoPtr, 12);
        break;
      case 5 /* Strength */:
        this.ctx.write32(infoPtr, 100);
        break;
      case 6 /* Channel */:
        this.ctx.write32(infoPtr, 1);
        break;
      case 13 /* UseProxy */:
        this.ctx.write32(infoPtr, 0);
        break;
      default:
        this.ctx.write32(infoPtr, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetApctlScan() {
    this.currentState = 1 /* Scanning */;
    return SceKernelErrors.ERROR_OK;
  }
  sceNetApctlGetBSSDescIDList() {
    const entryCountPtr = this.ctx.argPtr(0);
    if (entryCountPtr) {
      this.ctx.write32(entryCountPtr, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetApctlGetBSSDescEntry() {
    return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_DEVICE;
  }
  sceNetApctlGetBSSDescEntry2() {
    return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_DEVICE;
  }
}
__legacyDecorateClassTS([
  nativeFunction(3807977371, 150)
], sceNetApctl.prototype, "sceNetApctlInit", null);
__legacyDecorateClassTS([
  nativeFunction(3018707180, 150)
], sceNetApctl.prototype, "sceNetApctlTerm", null);
__legacyDecorateClassTS([
  nativeFunction(3485030342, 150)
], sceNetApctl.prototype, "sceNetApctlConnect", null);
__legacyDecorateClassTS([
  nativeFunction(620663201, 150)
], sceNetApctl.prototype, "sceNetApctlDisconnect", null);
__legacyDecorateClassTS([
  nativeFunction(1575667739, 150)
], sceNetApctl.prototype, "sceNetApctlGetState", null);
__legacyDecorateClassTS([
  nativeFunction(2327502161, 150)
], sceNetApctl.prototype, "sceNetApctlAddHandler", null);
__legacyDecorateClassTS([
  nativeFunction(1499699483, 150)
], sceNetApctl.prototype, "sceNetApctlDelHandler", null);
__legacyDecorateClassTS([
  nativeFunction(737140515, 150)
], sceNetApctl.prototype, "sceNetApctlGetInfo", null);
__legacyDecorateClassTS([
  nativeFunction(4066004998, 150)
], sceNetApctl.prototype, "sceNetApctlScan", null);
__legacyDecorateClassTS([
  nativeFunction(691389531, 150)
], sceNetApctl.prototype, "sceNetApctlGetBSSDescIDList", null);
__legacyDecorateClassTS([
  nativeFunction(74934676, 150)
], sceNetApctl.prototype, "sceNetApctlGetBSSDescEntry", null);
__legacyDecorateClassTS([
  nativeFunction(1809697676, 150)
], sceNetApctl.prototype, "sceNetApctlGetBSSDescEntry2", null);
sceNetApctl = __legacyDecorateClassTS([
  hleModule("sceNetApctl")
], sceNetApctl);
// src/hle/module/sceNetResolver.ts
class sceNetResolver {
  name = "sceNetResolver";
  ctx;
  resolvers = [];
  nextResolverId = 1;
  init(ctx) {
    this.ctx = ctx;
    this.resolvers = [];
    this.nextResolverId = 1;
  }
  sceNetResolverInit() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetResolverTerm() {
    this.resolvers = [];
    return SceKernelErrors.ERROR_OK;
  }
  sceNetResolverCreate() {
    const resolverIdPtr = this.ctx.argPtr(0);
    const resolver = {
      id: this.nextResolverId++,
      inUse: true
    };
    this.resolvers.push(resolver);
    if (resolverIdPtr) {
      this.ctx.write32(resolverIdPtr, resolver.id);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetResolverDelete() {
    const resolverId = this.ctx.arg(0);
    const index = this.resolvers.findIndex((r) => r.id === resolverId);
    if (index >= 0) {
      this.resolvers.splice(index, 1);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetResolverStartNtoA() {
    const addrPtr = this.ctx.argPtr(2);
    if (addrPtr) {
      this.ctx.write32(addrPtr, 16777343);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetResolverStartAtoN() {
    const hostnamePtr = this.ctx.argPtr(2);
    if (hostnamePtr) {
      this.ctx.writeStringZ(hostnamePtr, "localhost");
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNetResolverStop() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetResolverStartNtoAAsync() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetResolverStartAtoNAsync() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNetResolverPollAsync() {
    return 0;
  }
  sceNetResolverWaitAsync() {
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(4080471649, 150)
], sceNetResolver.prototype, "sceNetResolverInit", null);
__legacyDecorateClassTS([
  nativeFunction(1631066442, 150)
], sceNetResolver.prototype, "sceNetResolverTerm", null);
__legacyDecorateClassTS([
  nativeFunction(608268975, 150)
], sceNetResolver.prototype, "sceNetResolverCreate", null);
__legacyDecorateClassTS([
  nativeFunction(2488417801, 150)
], sceNetResolver.prototype, "sceNetResolverDelete", null);
__legacyDecorateClassTS([
  nativeFunction(575430468, 150)
], sceNetResolver.prototype, "sceNetResolverStartNtoA", null);
__legacyDecorateClassTS([
  nativeFunction(1654534071, 150)
], sceNetResolver.prototype, "sceNetResolverStartAtoN", null);
__legacyDecorateClassTS([
  nativeFunction(2156879971, 150)
], sceNetResolver.prototype, "sceNetResolverStop", null);
__legacyDecorateClassTS([
  nativeFunction(309628601, 150)
], sceNetResolver.prototype, "sceNetResolverStartNtoAAsync", null);
__legacyDecorateClassTS([
  nativeFunction(1323930456, 150)
], sceNetResolver.prototype, "sceNetResolverStartAtoNAsync", null);
__legacyDecorateClassTS([
  nativeFunction(348225273, 150)
], sceNetResolver.prototype, "sceNetResolverPollAsync", null);
__legacyDecorateClassTS([
  nativeFunction(975934220, 150)
], sceNetResolver.prototype, "sceNetResolverWaitAsync", null);
sceNetResolver = __legacyDecorateClassTS([
  hleModule("sceNetResolver")
], sceNetResolver);
// src/hle/module/sceHttp.ts
class sceHttp {
  name = "sceHttp";
  ctx;
  templates = [];
  connections = [];
  requests = [];
  nextTemplateId = 1;
  nextConnectionId = 1;
  nextRequestId = 1;
  init(ctx) {
    this.ctx = ctx;
    this.templates = [];
    this.connections = [];
    this.requests = [];
    this.nextTemplateId = 1;
    this.nextConnectionId = 1;
    this.nextRequestId = 1;
  }
  sceHttpInit() {
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpEnd() {
    this.templates = [];
    this.connections = [];
    this.requests = [];
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpCreateTemplate() {
    const template = {
      id: this.nextTemplateId++,
      inUse: true,
      userAgent: "PSP"
    };
    this.templates.push(template);
    return template.id;
  }
  sceHttpDeleteTemplate() {
    const templateId = this.ctx.arg(0);
    const index = this.templates.findIndex((t) => t.id === templateId);
    if (index >= 0) {
      this.templates.splice(index, 1);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpCreateConnection() {
    const templateId = this.ctx.arg(0);
    const hostPtr = this.ctx.argPtr(1);
    const port = this.ctx.arg(3);
    const host = hostPtr ? this.ctx.readStringZ(hostPtr) : "localhost";
    const connection = {
      id: this.nextConnectionId++,
      templateId,
      host,
      port
    };
    this.connections.push(connection);
    return connection.id;
  }
  sceHttpCreateConnectionWithURL() {
    const templateId = this.ctx.arg(0);
    const connection = {
      id: this.nextConnectionId++,
      templateId,
      host: "localhost",
      port: 80
    };
    this.connections.push(connection);
    return connection.id;
  }
  sceHttpDeleteConnection() {
    const connectionId = this.ctx.arg(0);
    const index = this.connections.findIndex((c) => c.id === connectionId);
    if (index >= 0) {
      this.connections.splice(index, 1);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpCreateRequest() {
    const connectionId = this.ctx.arg(0);
    const method = this.ctx.arg(1);
    const urlPtr = this.ctx.argPtr(2);
    const contentLength = this.ctx.arg(3);
    const url = urlPtr ? this.ctx.readStringZ(urlPtr) : "/";
    const request = {
      id: this.nextRequestId++,
      connectionId,
      method,
      url,
      contentLength
    };
    this.requests.push(request);
    return request.id;
  }
  sceHttpCreateRequestWithURL() {
    const connectionId = this.ctx.arg(0);
    const method = this.ctx.arg(1);
    const request = {
      id: this.nextRequestId++,
      connectionId,
      method,
      url: "/",
      contentLength: 0
    };
    this.requests.push(request);
    return request.id;
  }
  sceHttpDeleteRequest() {
    const requestId = this.ctx.arg(0);
    const index = this.requests.findIndex((r) => r.id === requestId);
    if (index >= 0) {
      this.requests.splice(index, 1);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpSendRequest() {
    return 2151878786;
  }
  sceHttpAbortRequest() {
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpReadData() {
    return 0;
  }
  sceHttpGetContentLength() {
    const lengthPtr = this.ctx.argPtr(1);
    if (lengthPtr) {
      this.ctx.write64(lengthPtr, 0n);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpGetStatusCode() {
    const statusPtr = this.ctx.argPtr(1);
    if (statusPtr) {
      this.ctx.write32(statusPtr, 200);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpSetResolveRetry() {
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpSetResolveTimeOut() {
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpSetConnectTimeOut() {
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpSetSendTimeOut() {
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpSetRecvTimeOut() {
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpEnableKeepAlive() {
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpDisableKeepAlive() {
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpEnableRedirect() {
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpDisableRedirect() {
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpEnableCookie() {
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpDisableCookie() {
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpAddExtraHeader() {
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpDeleteHeader() {
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpGetAllHeader() {
    const headerSizePtr = this.ctx.argPtr(2);
    if (headerSizePtr) {
      this.ctx.write32(headerSizePtr, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpSetAuthInfoCB() {
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpSetMallocFunction() {
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpLoadSystemCookie() {
    return SceKernelErrors.ERROR_OK;
  }
  sceHttpSaveSystemCookie() {
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(2870656519, 150)
], sceHttp.prototype, "sceHttpInit", null);
__legacyDecorateClassTS([
  nativeFunction(3519583326, 150)
], sceHttp.prototype, "sceHttpEnd", null);
__legacyDecorateClassTS([
  nativeFunction(2602508086, 150)
], sceHttp.prototype, "sceHttpCreateTemplate", null);
__legacyDecorateClassTS([
  nativeFunction(4244160597, 150)
], sceHttp.prototype, "sceHttpDeleteTemplate", null);
__legacyDecorateClassTS([
  nativeFunction(3455642809, 150)
], sceHttp.prototype, "sceHttpCreateConnection", null);
__legacyDecorateClassTS([
  nativeFunction(3498175631, 150)
], sceHttp.prototype, "sceHttpCreateConnectionWithURL", null);
__legacyDecorateClassTS([
  nativeFunction(1364358971, 150)
], sceHttp.prototype, "sceHttpDeleteConnection", null);
__legacyDecorateClassTS([
  nativeFunction(3037311134, 150)
], sceHttp.prototype, "sceHttpCreateRequest", null);
__legacyDecorateClassTS([
  nativeFunction(3019569201, 150)
], sceHttp.prototype, "sceHttpCreateRequestWithURL", null);
__legacyDecorateClassTS([
  nativeFunction(2773560833, 150)
], sceHttp.prototype, "sceHttpDeleteRequest", null);
__legacyDecorateClassTS([
  nativeFunction(3144708207, 150)
], sceHttp.prototype, "sceHttpSendRequest", null);
__legacyDecorateClassTS([
  nativeFunction(3238751094, 150)
], sceHttp.prototype, "sceHttpAbortRequest", null);
__legacyDecorateClassTS([
  nativeFunction(3991845273, 150)
], sceHttp.prototype, "sceHttpReadData", null);
__legacyDecorateClassTS([
  nativeFunction(42116029, 150)
], sceHttp.prototype, "sceHttpGetContentLength", null);
__legacyDecorateClassTS([
  nativeFunction(1288165263, 150)
], sceHttp.prototype, "sceHttpGetStatusCode", null);
__legacyDecorateClassTS([
  nativeFunction(1194621776, 150)
], sceHttp.prototype, "sceHttpSetResolveRetry", null);
__legacyDecorateClassTS([
  nativeFunction(64574063, 150)
], sceHttp.prototype, "sceHttpSetResolveTimeOut", null);
__legacyDecorateClassTS([
  nativeFunction(2328698739, 150)
], sceHttp.prototype, "sceHttpSetConnectTimeOut", null);
__legacyDecorateClassTS([
  nativeFunction(2575832877, 150)
], sceHttp.prototype, "sceHttpSetSendTimeOut", null);
__legacyDecorateClassTS([
  nativeFunction(521126883, 150)
], sceHttp.prototype, "sceHttpSetRecvTimeOut", null);
__legacyDecorateClassTS([
  nativeFunction(2023805932, 150)
], sceHttp.prototype, "sceHttpEnableKeepAlive", null);
__legacyDecorateClassTS([
  nativeFunction(3354338649, 150)
], sceHttp.prototype, "sceHttpDisableKeepAlive", null);
__legacyDecorateClassTS([
  nativeFunction(185773051, 150)
], sceHttp.prototype, "sceHttpEnableRedirect", null);
__legacyDecorateClassTS([
  nativeFunction(437173097, 150)
], sceHttp.prototype, "sceHttpDisableRedirect", null);
__legacyDecorateClassTS([
  nativeFunction(229614991, 150)
], sceHttp.prototype, "sceHttpEnableCookie", null);
__legacyDecorateClassTS([
  nativeFunction(185773052, 150)
], sceHttp.prototype, "sceHttpDisableCookie", null);
__legacyDecorateClassTS([
  nativeFunction(357826948, 150)
], sceHttp.prototype, "sceHttpAddExtraHeader", null);
__legacyDecorateClassTS([
  nativeFunction(1993422395, 150)
], sceHttp.prototype, "sceHttpDeleteHeader", null);
__legacyDecorateClassTS([
  nativeFunction(3676728527, 150)
], sceHttp.prototype, "sceHttpGetAllHeader", null);
__legacyDecorateClassTS([
  nativeFunction(4103681270, 150)
], sceHttp.prototype, "sceHttpSetAuthInfoCB", null);
__legacyDecorateClassTS([
  nativeFunction(3430890357, 150)
], sceHttp.prototype, "sceHttpSetMallocFunction", null);
__legacyDecorateClassTS([
  nativeFunction(2523432524, 150)
], sceHttp.prototype, "sceHttpLoadSystemCookie", null);
__legacyDecorateClassTS([
  nativeFunction(1993422396, 150)
], sceHttp.prototype, "sceHttpSaveSystemCookie", null);
sceHttp = __legacyDecorateClassTS([
  hleModule("sceHttp")
], sceHttp);
// src/hle/module/sceSsl.ts
class sceSsl {
  name = "sceSsl";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceSslInit() {
    return SceKernelErrors.ERROR_OK;
  }
  sceSslEnd() {
    return SceKernelErrors.ERROR_OK;
  }
  sceSslGetUsedMemoryMax() {
    const sizePtr = this.ctx.argPtr(0);
    if (sizePtr) {
      this.ctx.write32(sizePtr, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceSslGetUsedMemoryCurrent() {
    const sizePtr = this.ctx.argPtr(0);
    if (sizePtr) {
      this.ctx.write32(sizePtr, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceSslGetKeyUsage() {
    return SceKernelErrors.ERROR_OK;
  }
  sceSslGetNameEntryCount() {
    return 0;
  }
  sceSslGetNameEntryInfo() {
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(2508114914, 150)
], sceSsl.prototype, "sceSslInit", null);
__legacyDecorateClassTS([
  nativeFunction(421322495, 150)
], sceSsl.prototype, "sceSslEnd", null);
__legacyDecorateClassTS([
  nativeFunction(1543203681, 150)
], sceSsl.prototype, "sceSslGetUsedMemoryMax", null);
__legacyDecorateClassTS([
  nativeFunction(3603994548, 150)
], sceSsl.prototype, "sceSslGetUsedMemoryCurrent", null);
__legacyDecorateClassTS([
  nativeFunction(396430796, 150)
], sceSsl.prototype, "sceSslGetKeyUsage", null);
__legacyDecorateClassTS([
  nativeFunction(1037426723, 150)
], sceSsl.prototype, "sceSslGetNameEntryCount", null);
__legacyDecorateClassTS([
  nativeFunction(1516038253, 150)
], sceSsl.prototype, "sceSslGetNameEntryInfo", null);
sceSsl = __legacyDecorateClassTS([
  hleModule("sceSsl")
], sceSsl);
// src/hle/module/sceParseHttp.ts
class sceParseHttp {
  name = "sceParseHttp";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceParseHttpStatusLine() {
    return SceKernelErrors.ERROR_OK;
  }
  sceParseHttpResponseHeader() {
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(2155324467, 150)
], sceParseHttp.prototype, "sceParseHttpStatusLine", null);
__legacyDecorateClassTS([
  nativeFunction(2910584303, 150)
], sceParseHttp.prototype, "sceParseHttpResponseHeader", null);
sceParseHttp = __legacyDecorateClassTS([
  hleModule("sceParseHttp")
], sceParseHttp);
// src/hle/module/sceParseUri.ts
class sceParseUri {
  name = "sceParseUri";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceUriEscape() {
    const outputPtr = this.ctx.argPtr(0);
    const outputSizePtr = this.ctx.argPtr(1);
    const inputPtr = this.ctx.argPtr(3);
    if (inputPtr && outputPtr) {
      const input = this.ctx.readStringZ(inputPtr);
      const escaped = encodeURIComponent(input);
      this.ctx.writeStringZ(outputPtr, escaped);
      if (outputSizePtr) {
        this.ctx.write32(outputSizePtr, escaped.length + 1);
      }
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceUriUnescape() {
    const outputPtr = this.ctx.argPtr(0);
    const outputSizePtr = this.ctx.argPtr(1);
    const inputPtr = this.ctx.argPtr(3);
    if (inputPtr && outputPtr) {
      const input = this.ctx.readStringZ(inputPtr);
      try {
        const unescaped = decodeURIComponent(input);
        this.ctx.writeStringZ(outputPtr, unescaped);
        if (outputSizePtr) {
          this.ctx.write32(outputSizePtr, unescaped.length + 1);
        }
      } catch {
        this.ctx.writeStringZ(outputPtr, input);
        if (outputSizePtr) {
          this.ctx.write32(outputSizePtr, input.length + 1);
        }
      }
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceUriParse() {
    const resultPtr = this.ctx.argPtr(0);
    const uriPtr = this.ctx.argPtr(1);
    const workAreaPtr = this.ctx.argPtr(2);
    if (resultPtr) {
      for (let i = 0;i < 64; i++) {
        this.ctx.write8(resultPtr + i, 0);
      }
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceUriBuild() {
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(1240027372, 150)
], sceParseUri.prototype, "sceUriEscape", null);
__legacyDecorateClassTS([
  nativeFunction(103526526, 150)
], sceParseUri.prototype, "sceUriUnescape", null);
__legacyDecorateClassTS([
  nativeFunction(1451563209, 150)
], sceParseUri.prototype, "sceUriParse", null);
__legacyDecorateClassTS([
  nativeFunction(2128812207, 150)
], sceParseUri.prototype, "sceUriBuild", null);
sceParseUri = __legacyDecorateClassTS([
  hleModule("sceParseUri")
], sceParseUri);
// src/hle/module/sceNp.ts
class sceNp {
  name = "sceNp";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceNpInit() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNpTerm() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNpGetContentRatingFlag() {
    const flagPtr = this.ctx.argPtr(0);
    const agePtr = this.ctx.argPtr(1);
    if (flagPtr) {
      this.ctx.write32(flagPtr, 0);
    }
    if (agePtr) {
      this.ctx.write32(agePtr, 18);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNpGetChatRestrictionFlag() {
    const flagPtr = this.ctx.argPtr(0);
    if (flagPtr) {
      this.ctx.write32(flagPtr, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNpGetOnlineId() {
    const onlineIdPtr = this.ctx.argPtr(0);
    if (onlineIdPtr) {
      this.ctx.writeStringZ(onlineIdPtr, "PSP_User");
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNpGetNpId() {
    const npIdPtr = this.ctx.argPtr(0);
    if (npIdPtr) {
      for (let i = 0;i < 36; i++) {
        this.ctx.write8(npIdPtr + i, 0);
      }
      this.ctx.writeStringZ(npIdPtr, "PSP_User");
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNpGetUserProfile() {
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(2239449043, 150)
], sceNp.prototype, "sceNpInit", null);
__legacyDecorateClassTS([
  nativeFunction(1664835441, 150)
], sceNp.prototype, "sceNpTerm", null);
__legacyDecorateClassTS([
  nativeFunction(2904656730, 150)
], sceNp.prototype, "sceNpGetContentRatingFlag", null);
__legacyDecorateClassTS([
  nativeFunction(779050814, 150)
], sceNp.prototype, "sceNpGetChatRestrictionFlag", null);
__legacyDecorateClassTS([
  nativeFunction(1321328565, 150)
], sceNp.prototype, "sceNpGetOnlineId", null);
__legacyDecorateClassTS([
  nativeFunction(2696821835, 150)
], sceNp.prototype, "sceNpGetNpId", null);
__legacyDecorateClassTS([
  nativeFunction(3948311826, 150)
], sceNp.prototype, "sceNpGetUserProfile", null);
sceNp = __legacyDecorateClassTS([
  hleModule("sceNp")
], sceNp);
// src/hle/module/sceNpAuth.ts
class sceNpAuth {
  name = "sceNpAuth";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceNpAuthInit() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNpAuthTerm() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNpAuthCreateStartRequest() {
    return 2153054210;
  }
  sceNpAuthDestroyRequest() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNpAuthAbortRequest() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNpAuthGetTicket() {
    return 2153054210;
  }
  sceNpAuthGetTicketParam() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNpAuthGetEntitlementIdList() {
    const countPtr = this.ctx.argPtr(1);
    if (countPtr) {
      this.ctx.write32(countPtr, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceNpAuthGetEntitlementById() {
    return 2153054721;
  }
}
__legacyDecorateClassTS([
  nativeFunction(1321328566, 150)
], sceNpAuth.prototype, "sceNpAuthInit", null);
__legacyDecorateClassTS([
  nativeFunction(3448153686, 150)
], sceNpAuth.prototype, "sceNpAuthTerm", null);
__legacyDecorateClassTS([
  nativeFunction(4099087068, 150)
], sceNpAuth.prototype, "sceNpAuthCreateStartRequest", null);
__legacyDecorateClassTS([
  nativeFunction(1058807664, 150)
], sceNpAuth.prototype, "sceNpAuthDestroyRequest", null);
__legacyDecorateClassTS([
  nativeFunction(1761669252, 150)
], sceNpAuth.prototype, "sceNpAuthAbortRequest", null);
__legacyDecorateClassTS([
  nativeFunction(3650377181, 150)
], sceNpAuth.prototype, "sceNpAuthGetTicket", null);
__legacyDecorateClassTS([
  nativeFunction(1979386595, 150)
], sceNpAuth.prototype, "sceNpAuthGetTicketParam", null);
__legacyDecorateClassTS([
  nativeFunction(1800459271, 150)
], sceNpAuth.prototype, "sceNpAuthGetEntitlementIdList", null);
__legacyDecorateClassTS([
  nativeFunction(3636228296, 150)
], sceNpAuth.prototype, "sceNpAuthGetEntitlementById", null);
sceNpAuth = __legacyDecorateClassTS([
  hleModule("sceNpAuth")
], sceNpAuth);
// src/hle/module/sceNpService.ts
class sceNpService {
  name = "sceNpService";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceNpServiceInit() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNpServiceTerm() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNpServiceGetMemoryStat() {
    const statPtr = this.ctx.argPtr(0);
    if (statPtr) {
      this.ctx.write32(statPtr + 0, 65536);
      this.ctx.write32(statPtr + 4, 65536);
    }
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(261052449, 150)
], sceNpService.prototype, "sceNpServiceInit", null);
__legacyDecorateClassTS([
  nativeFunction(11336387, 150)
], sceNpService.prototype, "sceNpServiceTerm", null);
__legacyDecorateClassTS([
  nativeFunction(1418995531, 150)
], sceNpService.prototype, "sceNpServiceGetMemoryStat", null);
sceNpService = __legacyDecorateClassTS([
  hleModule("sceNpService")
], sceNpService);
// src/hle/module/scePspNpDrm_user.ts
class scePspNpDrm_user {
  name = "scePspNpDrm_user";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceNpDrmSetLicenseeKey() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNpDrmClearLicenseeKey() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNpDrmRenameCheck() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNpDrmEdataSetupKey() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNpDrmEdataGetDataSize() {
    return 0;
  }
  sceNpDrmOpen() {
    return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_DEVICE;
  }
  sceNpDrmGetVersionKey() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNpDrmActivation() {
    return SceKernelErrors.ERROR_OK;
  }
  sceNpDrmVerifyAct() {
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(2704498833, 150)
], scePspNpDrm_user.prototype, "sceNpDrmSetLicenseeKey", null);
__legacyDecorateClassTS([
  nativeFunction(2608092482, 150)
], scePspNpDrm_user.prototype, "sceNpDrmClearLicenseeKey", null);
__legacyDecorateClassTS([
  nativeFunction(660178897, 150)
], scePspNpDrm_user.prototype, "sceNpDrmRenameCheck", null);
__legacyDecorateClassTS([
  nativeFunction(148474004, 150)
], scePspNpDrm_user.prototype, "sceNpDrmEdataSetupKey", null);
__legacyDecorateClassTS([
  nativeFunction(564065740, 150)
], scePspNpDrm_user.prototype, "sceNpDrmEdataGetDataSize", null);
__legacyDecorateClassTS([
  nativeFunction(732578452, 150)
], scePspNpDrm_user.prototype, "sceNpDrmOpen", null);
__legacyDecorateClassTS([
  nativeFunction(4076510816, 150)
], scePspNpDrm_user.prototype, "sceNpDrmGetVersionKey", null);
__legacyDecorateClassTS([
  nativeFunction(4245499060, 150)
], scePspNpDrm_user.prototype, "sceNpDrmActivation", null);
__legacyDecorateClassTS([
  nativeFunction(3323608025, 150)
], scePspNpDrm_user.prototype, "sceNpDrmVerifyAct", null);
scePspNpDrm_user = __legacyDecorateClassTS([
  hleModule("scePspNpDrm_user")
], scePspNpDrm_user);
// src/hle/module/ExceptionManagerForKernel.ts
class ExceptionManagerForKernel {
  name = "ExceptionManagerForKernel";
  ctx;
  defaultExceptionHandler = 0;
  init(ctx) {
    this.ctx = ctx;
    this.defaultExceptionHandler = 0;
  }
  sceKernelRegisterDefaultExceptionHandler() {
    const handler = this.ctx.arg(0);
    this.defaultExceptionHandler = handler;
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelRegisterPriorityExceptionHandler() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelReleaseExceptionHandler() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelGetActiveDefaultExceptionHandler() {
    return this.defaultExceptionHandler;
  }
}
__legacyDecorateClassTS([
  nativeFunction(1448872718, 150)
], ExceptionManagerForKernel.prototype, "sceKernelRegisterDefaultExceptionHandler", null);
__legacyDecorateClassTS([
  nativeFunction(447139834, 150)
], ExceptionManagerForKernel.prototype, "sceKernelRegisterPriorityExceptionHandler", null);
__legacyDecorateClassTS([
  nativeFunction(3749939038, 150)
], ExceptionManagerForKernel.prototype, "sceKernelReleaseExceptionHandler", null);
__legacyDecorateClassTS([
  nativeFunction(207553026, 150)
], ExceptionManagerForKernel.prototype, "sceKernelGetActiveDefaultExceptionHandler", null);
ExceptionManagerForKernel = __legacyDecorateClassTS([
  hleModule("ExceptionManagerForKernel")
], ExceptionManagerForKernel);
// src/hle/module/KDebugForKernel.ts
class KDebugForKernel {
  name = "KDebugForKernel";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  Kprintf() {
    const formatPtr = this.ctx.argPtr(0);
    if (formatPtr) {
      const format2 = this.ctx.readStringZ(formatPtr);
      console.log(`[Kprintf] ${format2}`);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelDprintf() {
    const formatPtr = this.ctx.argPtr(0);
    if (formatPtr) {
      const format2 = this.ctx.readStringZ(formatPtr);
      console.log(`[Dprintf] ${format2}`);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelGetDebugPutchar() {
    return 0;
  }
  sceKernelRegisterDebugPutchar() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelRegisterKprintfHandler() {
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(2230546620, 150)
], KDebugForKernel.prototype, "Kprintf", null);
__legacyDecorateClassTS([
  nativeFunction(1558807435, 150)
], KDebugForKernel.prototype, "sceKernelDprintf", null);
__legacyDecorateClassTS([
  nativeFunction(3779485805, 150)
], KDebugForKernel.prototype, "sceKernelGetDebugPutchar", null);
__legacyDecorateClassTS([
  nativeFunction(2095787017, 150)
], KDebugForKernel.prototype, "sceKernelRegisterDebugPutchar", null);
__legacyDecorateClassTS([
  nativeFunction(1537424204, 150)
], KDebugForKernel.prototype, "sceKernelRegisterKprintfHandler", null);
KDebugForKernel = __legacyDecorateClassTS([
  hleModule("KDebugForKernel")
], KDebugForKernel);
// src/hle/module/LoadCoreForKernel.ts
class LoadCoreForKernel {
  name = "LoadCoreForKernel";
  ctx;
  init(ctx) {
    this.ctx = ctx;
  }
  sceKernelIcacheClearAll() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelFindModuleByUID() {
    const moduleId = this.ctx.arg(0);
    console.log(`[LoadCoreForKernel] sceKernelFindModuleByUID(${moduleId})`);
    return 0;
  }
  sceKernelFindModuleByName() {
    const namePtr = this.ctx.argPtr(0);
    if (namePtr) {
      const name = this.ctx.readStringZ(namePtr);
      console.log(`[LoadCoreForKernel] sceKernelFindModuleByName("${name}")`);
    }
    return 0;
  }
  sceKernelFindModuleByAddress() {
    const address = this.ctx.arg(0);
    console.log(`[LoadCoreForKernel] sceKernelFindModuleByAddress(0x${address.toString(16)})`);
    return 0;
  }
  sceKernelGetModuleIdList() {
    const listPtr = this.ctx.argPtr(0);
    const sizePtr = this.ctx.argPtr(1);
    const countPtr = this.ctx.argPtr(2);
    if (countPtr) {
      this.ctx.write32(countPtr, 0);
    }
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelDcacheWritebackAll() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelDcacheWritebackInvalidateAll() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelDcacheWritebackRange() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelDcacheWritebackInvalidateRange() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelDcacheInvalidateRange() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelIcacheInvalidateAll() {
    return SceKernelErrors.ERROR_OK;
  }
  sceKernelIcacheInvalidateRange() {
    return SceKernelErrors.ERROR_OK;
  }
}
__legacyDecorateClassTS([
  nativeFunction(3631717062, 150)
], LoadCoreForKernel.prototype, "sceKernelIcacheClearAll", null);
__legacyDecorateClassTS([
  nativeFunction(3437535575, 150)
], LoadCoreForKernel.prototype, "sceKernelFindModuleByUID", null);
__legacyDecorateClassTS([
  nativeFunction(4138843919, 150)
], LoadCoreForKernel.prototype, "sceKernelFindModuleByName", null);
__legacyDecorateClassTS([
  nativeFunction(3164194341, 150)
], LoadCoreForKernel.prototype, "sceKernelFindModuleByAddress", null);
__legacyDecorateClassTS([
  nativeFunction(2459655273, 150)
], LoadCoreForKernel.prototype, "sceKernelGetModuleIdList", null);
__legacyDecorateClassTS([
  nativeFunction(2043790330, 150)
], LoadCoreForKernel.prototype, "sceKernelDcacheWritebackAll", null);
__legacyDecorateClassTS([
  nativeFunction(3023429317, 150)
], LoadCoreForKernel.prototype, "sceKernelDcacheWritebackInvalidateAll", null);
__legacyDecorateClassTS([
  nativeFunction(1055067766, 150)
], LoadCoreForKernel.prototype, "sceKernelDcacheWritebackRange", null);
__legacyDecorateClassTS([
  nativeFunction(884603550, 150)
], LoadCoreForKernel.prototype, "sceKernelDcacheWritebackInvalidateRange", null);
__legacyDecorateClassTS([
  nativeFunction(3215556706, 150)
], LoadCoreForKernel.prototype, "sceKernelDcacheInvalidateRange", null);
__legacyDecorateClassTS([
  nativeFunction(2450460746, 150)
], LoadCoreForKernel.prototype, "sceKernelIcacheInvalidateAll", null);
__legacyDecorateClassTS([
  nativeFunction(3269424910, 150)
], LoadCoreForKernel.prototype, "sceKernelIcacheInvalidateRange", null);
LoadCoreForKernel = __legacyDecorateClassTS([
  hleModule("LoadCoreForKernel")
], LoadCoreForKernel);
// src/hle/EmulatorContext.ts
class EmulatorContext {
  memory;
  memoryManager;
  threadManager;
  callbackManager;
  moduleManager;
  syncManager;
  displayManager;
  inputManager;
  gpuManager;
  audioManager;
  fileManager;
  _running = false;
  constructor(memory) {
    this.memory = memory;
    this.memoryManager = new MemoryManager;
    this.threadManager = new ThreadManager(this.memoryManager);
    this.callbackManager = new CallbackManager;
    this.moduleManager = new ModuleManager;
    this.syncManager = new SyncManager;
    this.displayManager = new DisplayManager;
    this.inputManager = new InputManager;
    this.gpuManager = new GpuManager;
    this.audioManager = new AudioManager;
    this.fileManager = new FileManager;
    this.moduleManager.setContext(this);
  }
  reset() {
    this._running = false;
    this.memory.reset();
    this.memoryManager.reset();
    this.threadManager.reset();
    this.callbackManager.reset();
    this.moduleManager.reset();
    this.syncManager.reset();
    this.displayManager.reset();
    this.inputManager.reset();
    this.gpuManager.reset();
    this.audioManager.reset();
    this.fileManager.reset();
  }
  get running() {
    return this._running;
  }
  start() {
    this._running = true;
  }
  stop() {
    this._running = false;
  }
  get cpu() {
    return this.threadManager.getCurrentThread()?.cpu ?? null;
  }
  get thread() {
    return this.threadManager.getCurrentThread();
  }
  gpr(index) {
    return this.cpu?.gpr[index] ?? 0;
  }
  setGpr(index, value) {
    if (this.cpu && index !== 0) {
      this.cpu.gpr[index] = value;
    }
  }
  arg(index) {
    return this.gpr(4 + index);
  }
  setReturnValue(value) {
    this.setGpr(2, value);
  }
  setReturnValue64(low, high) {
    this.setGpr(2, low);
    this.setGpr(3, high);
  }
  argPtr(index) {
    return this.arg(index) >>> 0;
  }
  readString(address, maxLength = 256) {
    return this.memory.readString(address, maxLength);
  }
  readStringZ(address, maxLength = 256) {
    return this.memory.readString(address, maxLength);
  }
  writeString(address, str) {
    this.memory.writeString(address, str);
  }
  writeStringZ(address, str) {
    this.memory.writeString(address, str);
  }
  read32(address) {
    return this.memory.lw(address);
  }
  write32(address, value) {
    this.memory.sw(address, value);
  }
  read16(address) {
    return this.memory.lhu(address);
  }
  write16(address, value) {
    this.memory.sh(address, value);
  }
  read8(address) {
    return this.memory.lbu(address);
  }
  write8(address, value) {
    this.memory.sb(address, value);
  }
  read64(address) {
    const low = this.memory.lw(address) >>> 0;
    const high = this.memory.lw(address + 4) >>> 0;
    return BigInt(low) | BigInt(high) << 32n;
  }
  write64(address, value) {
    this.memory.sw(address, Number(value & 0xFFFFFFFFn));
    this.memory.sw(address + 4, Number(value >> 32n & 0xFFFFFFFFn));
  }
  logEnabled = true;
  setLogging(enabled) {
    this.logEnabled = enabled;
  }
  log(message) {
    if (this.logEnabled) {
      console.log(`[HLE] ${message}`);
    }
  }
  warn(message) {
    console.warn(`[HLE] ${message}`);
  }
  error(message) {
    console.error(`[HLE] ${message}`);
  }
}
// src/hle/ProgramLoader.ts
var PRX_BASE_ADDRESS = 142606336;
var DEFAULT_STACK_SIZE2 = 65536;
var STACK_TOP = 167768064;
var DEFAULT_PRIORITY = 32;

class ProgramLoader {
  ctx;
  cpu;
  syscallManager;
  loadedModules = new Map;
  constructor(ctx, cpu, syscallManager) {
    this.ctx = ctx;
    this.cpu = cpu;
    this.syscallManager = syscallManager;
    this.cpu.setSyscallHandler((cpu2, syscallCode) => {
      const result = this.syscallManager.handleSyscall(cpu2.state.pc - 4, syscallCode);
      this.ctx.setReturnValue(result);
    });
  }
  loadPbp(data, options = {}) {
    const pbp2 = PbpFile.fromBuffer(data);
    const elfStream = pbp2.readEntry(6 /* DATA_PSP */);
    if (!elfStream) {
      throw new Error("PBP does not contain DATA.PSP");
    }
    return this.loadElf(elfStream, options);
  }
  loadElf(stream2, options = {}) {
    const elf2 = new ElfFile(stream2);
    return this.loadElfFile(elf2, options);
  }
  loadElfFile(elf2, options = {}) {
    const {
      baseAddress = elf2.isPrx ? PRX_BASE_ADDRESS : 0,
      stackSize = DEFAULT_STACK_SIZE2,
      priority = DEFAULT_PRIORITY
    } = options;
    const { entryPoint, size } = elf2.loadIntoMemory(this.ctx.memory, baseAddress);
    if (elf2.isPrx) {
      elf2.applyRelocations(this.ctx.memory, baseAddress);
    }
    const moduleInfo = elf2.moduleInfo;
    const moduleName = moduleInfo?.name ?? "unknown";
    const gp = moduleInfo ? moduleInfo.gp + baseAddress : 0;
    if (moduleInfo) {
      const importsStart = moduleInfo.importsStart + baseAddress;
      const importsEnd = moduleInfo.importsEnd + baseAddress;
      if (importsStart < importsEnd) {
        this.syscallManager.parseImports(this.ctx.memory, importsStart, importsEnd);
      }
    }
    const module = {
      name: moduleName,
      baseAddress,
      entryPoint,
      size,
      gp,
      isPrx: elf2.isPrx
    };
    this.loadedModules.set(moduleName, module);
    return module;
  }
  setupMainThread(module, options = {}) {
    const {
      stackSize = DEFAULT_STACK_SIZE2,
      priority = DEFAULT_PRIORITY,
      args = []
    } = options;
    const { thread, error } = this.ctx.threadManager.createThread("main", module.entryPoint, priority, stackSize);
    if (error !== SceKernelErrors.ERROR_OK || !thread) {
      throw new Error(`Failed to create main thread: 0x${error.toString(16)}`);
    }
    if (module.gp) {
      thread.cpu.gpr[28] = module.gp;
    }
    thread.cpu.gpr[4] = args.length;
    thread.cpu.gpr[5] = 0;
    this.ctx.threadManager.startThread(thread.uid, 0, 0);
    this.ctx.threadManager.setCurrentThread(thread);
    return thread.uid;
  }
  setupProgram(module, options = {}) {
    this.setupMainThread(module, options);
    this.cpu.state.pc = module.entryPoint;
    this.cpu.state.gpr[29] = STACK_TOP;
    if (module.gp) {
      this.cpu.state.gpr[28] = module.gp;
    }
    this.cpu.state.gpr[31] = 0;
    this.ctx.start();
  }
  getModule(name) {
    return this.loadedModules.get(name);
  }
  getModules() {
    return Array.from(this.loadedModules.values());
  }
  logProgramInfo(module) {
    console.log("=== Program Loaded ===");
    console.log(`  Name: ${module.name}`);
    console.log(`  Base: 0x${module.baseAddress.toString(16)}`);
    console.log(`  Entry: 0x${module.entryPoint.toString(16)}`);
    console.log(`  Size: ${module.size} bytes`);
    console.log(`  GP: 0x${module.gp.toString(16)}`);
    console.log(`  PRX: ${module.isPrx}`);
    this.syscallManager.logImports();
  }
}
// src/core/format/PixelFormat.ts
var PixelFormat;
((PixelFormat2) => {
  PixelFormat2[PixelFormat2["NONE"] = -1] = "NONE";
  PixelFormat2[PixelFormat2["RGBA_5650"] = 0] = "RGBA_5650";
  PixelFormat2[PixelFormat2["RGBA_5551"] = 1] = "RGBA_5551";
  PixelFormat2[PixelFormat2["RGBA_4444"] = 2] = "RGBA_4444";
  PixelFormat2[PixelFormat2["RGBA_8888"] = 3] = "RGBA_8888";
  PixelFormat2[PixelFormat2["PALETTE_T4"] = 4] = "PALETTE_T4";
  PixelFormat2[PixelFormat2["PALETTE_T8"] = 5] = "PALETTE_T8";
  PixelFormat2[PixelFormat2["PALETTE_T16"] = 6] = "PALETTE_T16";
  PixelFormat2[PixelFormat2["PALETTE_T32"] = 7] = "PALETTE_T32";
  PixelFormat2[PixelFormat2["COMPRESSED_DXT1"] = 8] = "COMPRESSED_DXT1";
  PixelFormat2[PixelFormat2["COMPRESSED_DXT3"] = 9] = "COMPRESSED_DXT3";
  PixelFormat2[PixelFormat2["COMPRESSED_DXT5"] = 10] = "COMPRESSED_DXT5";
})(PixelFormat ||= {});
var PIXEL_SIZES = [];
PIXEL_SIZES[8 /* COMPRESSED_DXT1 */] = 0.5;
PIXEL_SIZES[9 /* COMPRESSED_DXT3 */] = 1;
PIXEL_SIZES[10 /* COMPRESSED_DXT5 */] = 1;
PIXEL_SIZES[6 /* PALETTE_T16 */] = 2;
PIXEL_SIZES[7 /* PALETTE_T32 */] = 4;
PIXEL_SIZES[5 /* PALETTE_T8 */] = 1;
PIXEL_SIZES[4 /* PALETTE_T4 */] = 0.5;
PIXEL_SIZES[2 /* RGBA_4444 */] = 2;
PIXEL_SIZES[1 /* RGBA_5551 */] = 2;
PIXEL_SIZES[0 /* RGBA_5650 */] = 2;
PIXEL_SIZES[3 /* RGBA_8888 */] = 4;
function extractScalei(value, offset, bits2, scale) {
  const mask = (1 << bits2) - 1;
  const extracted = value >>> offset & mask;
  const maxValue = mask;
  return Math.floor(extracted * scale / maxValue);
}

class PixelConverter {
  static getSizeInBits(format2) {
    return (PIXEL_SIZES[format2] || 0) * 8;
  }
  static getSizeInBytes(format2, count) {
    return (PIXEL_SIZES[format2] || 0) * count;
  }
  static unswizzleInline(format2, from, width, height) {
    const rowWidth = PixelConverter.getSizeInBytes(format2, width);
    const textureHeight = height;
    const size = rowWidth * textureHeight;
    const temp = new Uint8Array(size);
    PixelConverter.unswizzle(from, temp, rowWidth, textureHeight);
    from.set(temp.subarray(0, size));
  }
  static unswizzle(input, output, rowWidth, textureHeight) {
    const pitch = Math.floor((rowWidth - 16) / 4);
    const bxc = Math.floor(rowWidth / 16);
    const byc = Math.floor(textureHeight / 8);
    const pitch4 = pitch * 4;
    let src = 0;
    let ydest = 0;
    for (let by = 0;by < byc; by++) {
      let xdest = ydest;
      for (let bx = 0;bx < bxc; bx++) {
        let dest = xdest;
        for (let n = 0;n < 8; n++, dest += pitch4) {
          for (let m = 0;m < 16; m++) {
            output[dest++] = input[src++];
          }
        }
        xdest += 16;
      }
      ydest += rowWidth * 8;
    }
  }
  static decode(format2, from, to, useAlpha = true, palette = null, clutStart = 0, clutShift = 0, clutMask = 255) {
    switch (format2) {
      case 3 /* RGBA_8888 */:
        return PixelConverter.decode8888(from, to, useAlpha);
      case 1 /* RGBA_5551 */:
        return PixelConverter.decode5551Array(from, to, useAlpha);
      case 0 /* RGBA_5650 */:
        return PixelConverter.decode5650Array(from, to, useAlpha);
      case 2 /* RGBA_4444 */:
        return PixelConverter.decode4444Array(from, to, useAlpha);
      case 4 /* PALETTE_T4 */:
        return PixelConverter.decodeT4(from, to, useAlpha, palette, clutStart, clutShift, clutMask);
      case 5 /* PALETTE_T8 */:
        return PixelConverter.decodeT8(from, to, useAlpha, palette, clutStart, clutShift, clutMask);
      default:
        throw new Error(`Unsupported pixel format ${format2}`);
    }
  }
  static unpackToRGBA(pixelFormat, rawColor, useAlpha = true) {
    switch (pixelFormat) {
      case 3 /* RGBA_8888 */:
        return rawColor | (useAlpha ? 0 : 4278190080);
      case 1 /* RGBA_5551 */:
        return PixelConverter.decode5551(rawColor, useAlpha);
      case 0 /* RGBA_5650 */:
        return PixelConverter.decode5650(rawColor, useAlpha);
      case 2 /* RGBA_4444 */:
        return PixelConverter.decode4444(rawColor, useAlpha);
      default:
        throw new Error(`Unsupported pixel format ${pixelFormat}`);
    }
  }
  static decode8888(from8, to, useAlpha) {
    const from = new Uint32Array(from8.buffer, from8.byteOffset, Math.floor(from8.length / 4));
    const orValue = useAlpha ? 0 : 4278190080;
    for (let n = 0;n < to.length; n++) {
      to[n] = from[n] | orValue;
    }
    return to;
  }
  static decode5551Array(from8, to, useAlpha) {
    const from = new Uint16Array(from8.buffer, from8.byteOffset, Math.floor(from8.length / 2));
    for (let n = 0;n < to.length; n++) {
      to[n] = PixelConverter.decode5551(from[n], useAlpha);
    }
    return to;
  }
  static decode5650Array(from8, to, useAlpha) {
    const from = new Uint16Array(from8.buffer, from8.byteOffset, Math.floor(from8.length / 2));
    for (let n = 0;n < to.length; n++) {
      to[n] = PixelConverter.decode5650(from[n], useAlpha);
    }
    return to;
  }
  static decode4444Array(from8, to, useAlpha) {
    const from = new Uint16Array(from8.buffer, from8.byteOffset, Math.floor(from8.length / 2));
    for (let n = 0;n < to.length; n++) {
      to[n] = PixelConverter.decode4444(from[n], useAlpha);
    }
    return to;
  }
  static decode5551(it, useAlpha) {
    let value = 0;
    value |= extractScalei(it, 0, 5, 255) << 0;
    value |= extractScalei(it, 5, 5, 255) << 8;
    value |= extractScalei(it, 10, 5, 255) << 16;
    value |= extractScalei(it, 15, 1, 255) << 24;
    value |= useAlpha ? 0 : 4278190080;
    return value;
  }
  static decode5650(it, useAlpha) {
    let value = 0;
    value |= extractScalei(it, 0, 5, 255) << 0;
    value |= extractScalei(it, 5, 6, 255) << 8;
    value |= extractScalei(it, 11, 5, 255) << 16;
    value |= 4278190080;
    return value;
  }
  static decode4444(it, useAlpha) {
    let value = 0;
    value |= extractScalei(it, 0, 4, 255) << 0;
    value |= extractScalei(it, 4, 4, 255) << 8;
    value |= extractScalei(it, 8, 4, 255) << 16;
    value |= (useAlpha ? extractScalei(it, 12, 4, 255) : 255) << 24;
    return value;
  }
  static updateTranslate = new Uint32Array(256);
  static decodeT4(from, to, useAlpha, palette, clutStart, clutShift, clutMask) {
    const orValue = useAlpha ? 0 : 4278190080;
    clutMask &= 15;
    const translate = PixelConverter.updateTranslate;
    for (let m = 0;m < 16; m++) {
      translate[m] = palette[clutStart + m >>> clutShift & clutMask];
    }
    for (let n = 0, m = 0;m < to.length; n++) {
      const char = from[n];
      to[m++] = translate[char >>> 0 & 15] | orValue;
      to[m++] = translate[char >>> 4 & 15] | orValue;
    }
    return to;
  }
  static decodeT8(from, to, useAlpha, palette, clutStart, clutShift, clutMask) {
    const orValue = useAlpha ? 0 : 4278190080;
    clutMask &= 255;
    const count = to.length;
    if (count > 1024) {
      const translate = PixelConverter.updateTranslate;
      for (let m = 0;m < 256; m++) {
        translate[m] = palette[clutStart + m >>> clutShift & clutMask];
      }
      for (let m = 0;m < count; m++) {
        to[m] = translate[from[m]] | orValue;
      }
    } else {
      for (let m = 0;m < count; m++) {
        to[m] = palette[clutStart + ((from[m] & clutMask) << clutShift)] | orValue;
      }
    }
    return to;
  }
}

// src/core/display/Display.ts
var SCREEN_WIDTH = 480;
var SCREEN_HEIGHT = 272;
var HSYNC_HZ = 17142.8571428571;
var VSYNC_HZ = 59.94;
var VBLANK_MS = 1000 / VSYNC_HZ;
var CYCLES_PER_SCANLINE = 333333333 / HSYNC_HZ;
var SCANLINES_PER_FRAME = 286;
var VISIBLE_SCANLINES = 272;
class Display {
  state = {
    frameBufferAddress: 67108864,
    frameBufferWidth: 512,
    pixelFormat: 3 /* RGBA_8888 */,
    sync: 0 /* Immediate */,
    enabled: true,
    vcount: 0,
    vblankCount: 0
  };
  vblankWaiters = [];
  vblankCallbacks = [];
  lastUpdateTime = 0;
  accumulatedTime = 0;
  get frameBufferAddress() {
    return this.state.frameBufferAddress;
  }
  get frameBufferWidth() {
    return this.state.frameBufferWidth;
  }
  get pixelFormat() {
    return this.state.pixelFormat;
  }
  get sync() {
    return this.state.sync;
  }
  get enabled() {
    return this.state.enabled;
  }
  get vcount() {
    return this.state.vcount;
  }
  get vblankCount() {
    return this.state.vblankCount;
  }
  get isVblank() {
    return this.state.vcount >= VISIBLE_SCANLINES;
  }
  get secondsToVblank() {
    if (this.isVblank)
      return 0;
    const remainingScanlines = VISIBLE_SCANLINES - this.state.vcount;
    return remainingScanlines / HSYNC_HZ;
  }
  get secondsToVblankStart() {
    const remainingScanlines = this.isVblank ? SCANLINES_PER_FRAME - this.state.vcount + VISIBLE_SCANLINES : VISIBLE_SCANLINES - this.state.vcount;
    return remainingScanlines / HSYNC_HZ;
  }
  setMode(mode, width, height) {
    if (mode !== 0 /* Lcd */ || width !== SCREEN_WIDTH || height !== SCREEN_HEIGHT) {
      return -1;
    }
    return 0;
  }
  setFrameBuf(address, bufferWidth, pixelFormat, sync) {
    this.state.frameBufferAddress = address;
    this.state.frameBufferWidth = bufferWidth;
    this.state.pixelFormat = pixelFormat;
    this.state.sync = sync;
    return 0;
  }
  getFrameBuf() {
    return {
      address: this.state.frameBufferAddress,
      bufferWidth: this.state.frameBufferWidth,
      pixelFormat: this.state.pixelFormat,
      sync: this.state.sync
    };
  }
  setEnabled(enabled) {
    this.state.enabled = enabled;
  }
  getVcount() {
    return this.state.vcount;
  }
  waitVblank() {
    return new Promise((resolve) => {
      this.vblankWaiters.push({
        resolve,
        targetCount: this.state.vblankCount + 1
      });
    });
  }
  waitVblankStart() {
    if (this.isVblank) {
      return this.waitVblank();
    }
    return this.waitVblank();
  }
  onVblank(callback) {
    this.vblankCallbacks.push(callback);
    return () => {
      const index = this.vblankCallbacks.indexOf(callback);
      if (index >= 0)
        this.vblankCallbacks.splice(index, 1);
    };
  }
  update(currentTime) {
    if (this.lastUpdateTime === 0) {
      this.lastUpdateTime = currentTime;
      return;
    }
    const deltaTime = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;
    this.accumulatedTime += deltaTime;
    while (this.accumulatedTime >= VBLANK_MS) {
      this.accumulatedTime -= VBLANK_MS;
      this.triggerVblank();
    }
    const scanlineProgress = this.accumulatedTime / VBLANK_MS * SCANLINES_PER_FRAME;
    this.state.vcount = Math.floor(scanlineProgress) % SCANLINES_PER_FRAME;
  }
  triggerVblank() {
    this.state.vblankCount++;
    for (const callback of this.vblankCallbacks) {
      callback(this.state.vblankCount);
    }
    const resolvedWaiters = [];
    for (let i = 0;i < this.vblankWaiters.length; i++) {
      const waiter = this.vblankWaiters[i];
      if (this.state.vblankCount >= waiter.targetCount) {
        waiter.resolve();
        resolvedWaiters.push(i);
      }
    }
    for (let i = resolvedWaiters.length - 1;i >= 0; i--) {
      this.vblankWaiters.splice(resolvedWaiters[i], 1);
    }
  }
  reset() {
    this.state = {
      frameBufferAddress: 67108864,
      frameBufferWidth: 512,
      pixelFormat: 3 /* RGBA_8888 */,
      sync: 0 /* Immediate */,
      enabled: true,
      vcount: 0,
      vblankCount: 0
    };
    this.vblankWaiters = [];
    this.lastUpdateTime = 0;
    this.accumulatedTime = 0;
  }
}
// src/psp/html5/Html5Display.ts
class Html5Display {
  canvas;
  ctx = null;
  imageData = null;
  scale;
  smoothing;
  display;
  memory;
  frameCount = 0;
  lastFpsTime = 0;
  fps = 0;
  constructor(options, display, memory) {
    this.canvas = options.canvas;
    this.scale = options.scale ?? 2;
    this.smoothing = options.smoothing ?? false;
    this.display = display;
    this.memory = memory;
    this.initCanvas();
  }
  get currentFps() {
    return this.fps;
  }
  get width() {
    return SCREEN_WIDTH;
  }
  get height() {
    return SCREEN_HEIGHT;
  }
  initCanvas() {
    this.canvas.width = SCREEN_WIDTH * this.scale;
    this.canvas.height = SCREEN_HEIGHT * this.scale;
    this.ctx = this.canvas.getContext("2d", { alpha: false });
    if (!this.ctx) {
      throw new Error("Failed to get 2D canvas context");
    }
    this.ctx.imageSmoothingEnabled = this.smoothing;
    this.imageData = this.ctx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
  }
  render() {
    if (!this.ctx || !this.imageData)
      return;
    const fb = this.display.getFrameBuf();
    this.renderFramebuffer(fb.address, fb.bufferWidth, fb.pixelFormat);
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = SCREEN_WIDTH;
    tempCanvas.height = SCREEN_HEIGHT;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.putImageData(this.imageData, 0, 0);
    this.ctx.drawImage(tempCanvas, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 0, 0, this.canvas.width, this.canvas.height);
    this.updateFps();
  }
  renderFramebuffer(address, stride, format2) {
    if (!this.imageData)
      return;
    const pixels = this.imageData.data;
    const bytesPerPixel = this.getBytesPerPixel(format2);
    for (let y = 0;y < SCREEN_HEIGHT; y++) {
      for (let x = 0;x < SCREEN_WIDTH; x++) {
        const srcOffset = address + (y * stride + x) * bytesPerPixel;
        const dstOffset = (y * SCREEN_WIDTH + x) * 4;
        const { r, g, b, a } = this.readPixel(srcOffset, format2);
        pixels[dstOffset] = r;
        pixels[dstOffset + 1] = g;
        pixels[dstOffset + 2] = b;
        pixels[dstOffset + 3] = a;
      }
    }
  }
  readPixel(address, format2) {
    switch (format2) {
      case 3 /* RGBA_8888 */: {
        const value = this.memory.lwu(address);
        return {
          r: value & 255,
          g: value >>> 8 & 255,
          b: value >>> 16 & 255,
          a: value >>> 24 & 255
        };
      }
      case PixelFormat.RGB_565: {
        const value = this.memory.lhu(address);
        return {
          r: (value & 31) << 3 | (value & 31) >> 2,
          g: (value >>> 5 & 63) << 2 | (value >>> 5 & 63) >> 4,
          b: (value >>> 11 & 31) << 3 | (value >>> 11 & 31) >> 2,
          a: 255
        };
      }
      case 1 /* RGBA_5551 */: {
        const value = this.memory.lhu(address);
        return {
          r: (value & 31) << 3 | (value & 31) >> 2,
          g: (value >>> 5 & 31) << 3 | (value >>> 5 & 31) >> 2,
          b: (value >>> 10 & 31) << 3 | (value >>> 10 & 31) >> 2,
          a: value & 32768 ? 255 : 0
        };
      }
      case 2 /* RGBA_4444 */: {
        const value = this.memory.lhu(address);
        return {
          r: (value & 15) << 4 | value & 15,
          g: (value >>> 4 & 15) << 4 | value >>> 4 & 15,
          b: (value >>> 8 & 15) << 4 | value >>> 8 & 15,
          a: (value >>> 12 & 15) << 4 | value >>> 12 & 15
        };
      }
      default:
        return { r: 0, g: 0, b: 0, a: 255 };
    }
  }
  getBytesPerPixel(format2) {
    switch (format2) {
      case 3 /* RGBA_8888 */:
        return 4;
      case PixelFormat.RGB_565:
        return 2;
      case 1 /* RGBA_5551 */:
        return 2;
      case 2 /* RGBA_4444 */:
        return 2;
      default:
        return 4;
    }
  }
  updateFps() {
    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastFpsTime;
    if (elapsed >= 1000) {
      this.fps = Math.round(this.frameCount * 1000 / elapsed);
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
  }
  setScale(scale) {
    this.scale = scale;
    this.canvas.width = SCREEN_WIDTH * scale;
    this.canvas.height = SCREEN_HEIGHT * scale;
  }
  setSmoothing(enabled) {
    this.smoothing = enabled;
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = enabled;
    }
  }
  clear(color = "#000000") {
    if (!this.ctx)
      return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
// src/core/audio/Audio.ts
var AUDIO_CHANNELS = 8;
var DEFAULT_SAMPLE_RATE = 44100;
var MAX_VOLUME = 32768;
var DEFAULT_VOLUME = 32768;
var SAMPLES_PER_BUFFER = 1024;
class Audio {
  state;
  callbacks = [];
  pendingData = new Map;
  constructor() {
    this.state = this.createInitialState();
  }
  createInitialState() {
    const channels = [];
    for (let i = 0;i < AUDIO_CHANNELS; i++) {
      channels.push({
        id: i,
        reserved: false,
        sampleCount: SAMPLES_PER_BUFFER,
        format: 0 /* Stereo */,
        leftVolume: DEFAULT_VOLUME,
        rightVolume: DEFAULT_VOLUME,
        sampleRate: DEFAULT_SAMPLE_RATE
      });
    }
    return {
      channels,
      masterVolume: MAX_VOLUME,
      enabled: true,
      sampleRate: DEFAULT_SAMPLE_RATE
    };
  }
  get channels() {
    return this.state.channels;
  }
  get masterVolume() {
    return this.state.masterVolume;
  }
  get enabled() {
    return this.state.enabled;
  }
  get sampleRate() {
    return this.state.sampleRate;
  }
  getChannel(id) {
    if (id < 0 || id >= AUDIO_CHANNELS)
      return;
    return this.state.channels[id];
  }
  reserveChannel(sampleCount, format2) {
    for (let i = 0;i < AUDIO_CHANNELS; i++) {
      if (!this.state.channels[i].reserved) {
        const channel = this.state.channels[i];
        channel.reserved = true;
        channel.sampleCount = sampleCount;
        channel.format = format2;
        this.pendingData.set(i, []);
        return i;
      }
    }
    return -1;
  }
  reserveChannelById(id, sampleCount, format2) {
    if (id < 0 || id >= AUDIO_CHANNELS)
      return -1;
    const channel = this.state.channels[id];
    if (channel.reserved)
      return -1;
    channel.reserved = true;
    channel.sampleCount = sampleCount;
    channel.format = format2;
    this.pendingData.set(id, []);
    return id;
  }
  releaseChannel(id) {
    if (id < 0 || id >= AUDIO_CHANNELS)
      return false;
    const channel = this.state.channels[id];
    if (!channel.reserved)
      return false;
    channel.reserved = false;
    channel.leftVolume = DEFAULT_VOLUME;
    channel.rightVolume = DEFAULT_VOLUME;
    this.pendingData.delete(id);
    return true;
  }
  setChannelVolume(id, left, right) {
    if (id < 0 || id >= AUDIO_CHANNELS)
      return false;
    const channel = this.state.channels[id];
    channel.leftVolume = Math.max(0, Math.min(MAX_VOLUME, left));
    channel.rightVolume = Math.max(0, Math.min(MAX_VOLUME, right));
    return true;
  }
  changeChannel(id, sampleCount, format2) {
    if (id < 0 || id >= AUDIO_CHANNELS)
      return false;
    const channel = this.state.channels[id];
    if (!channel.reserved)
      return false;
    channel.sampleCount = sampleCount;
    channel.format = format2;
    return true;
  }
  output(id, data) {
    if (id < 0 || id >= AUDIO_CHANNELS)
      return;
    const pending = this.pendingData.get(id);
    if (pending) {
      pending.push(data);
    }
    const floatData = this.convertToFloat(data);
    for (const callback of this.callbacks) {
      callback(id, floatData);
    }
  }
  outputWithVolume(id, leftVol, rightVol, data) {
    this.setChannelVolume(id, leftVol, rightVol);
    this.output(id, data);
  }
  getPendingSamples(id) {
    const pending = this.pendingData.get(id);
    if (!pending)
      return 0;
    let total = 0;
    for (const data of pending) {
      total += data.length;
    }
    return total;
  }
  onOutput(callback) {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index >= 0)
        this.callbacks.splice(index, 1);
    };
  }
  setMasterVolume(volume) {
    this.state.masterVolume = Math.max(0, Math.min(MAX_VOLUME, volume));
  }
  setEnabled(enabled) {
    this.state.enabled = enabled;
  }
  convertToFloat(data) {
    const result = new Float32Array(data.length);
    for (let i = 0;i < data.length; i++) {
      result[i] = data[i] / 32768;
    }
    return result;
  }
  reset() {
    this.state = this.createInitialState();
    this.pendingData.clear();
  }
}
// src/psp/html5/Html5Audio.ts
class Html5Audio {
  audio;
  audioContext = null;
  gainNode = null;
  sampleRate;
  bufferSize;
  channelBuffers = new Map;
  workletNode = null;
  scriptNode = null;
  constructor(audio, options = {}) {
    this.audio = audio;
    this.sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
    this.bufferSize = options.bufferSize ?? 4096;
    for (let i = 0;i < AUDIO_CHANNELS; i++) {
      this.channelBuffers.set(i, []);
    }
    this.audio.onOutput((channel, samples) => {
      this.queueSamples(channel, samples);
    });
  }
  get isInitialized() {
    return this.audioContext !== null;
  }
  get isRunning() {
    return this.audioContext?.state === "running";
  }
  get currentSampleRate() {
    return this.sampleRate;
  }
  async init() {
    if (this.audioContext)
      return;
    this.audioContext = new AudioContext({
      sampleRate: this.sampleRate,
      latencyHint: "interactive"
    });
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
    await this.initScriptProcessor();
  }
  async initScriptProcessor() {
    if (!this.audioContext || !this.gainNode)
      return;
    this.scriptNode = this.audioContext.createScriptProcessor(this.bufferSize, 0, 2);
    this.scriptNode.onaudioprocess = (event) => {
      this.processAudio(event);
    };
    this.scriptNode.connect(this.gainNode);
  }
  queueSamples(channel, samples) {
    const buffer = this.channelBuffers.get(channel);
    if (buffer) {
      buffer.push(samples);
    }
  }
  processAudio(event) {
    const left = event.outputBuffer.getChannelData(0);
    const right = event.outputBuffer.getChannelData(1);
    left.fill(0);
    right.fill(0);
    for (let ch = 0;ch < AUDIO_CHANNELS; ch++) {
      const channel = this.audio.getChannel(ch);
      if (!channel || !channel.reserved)
        continue;
      const buffers = this.channelBuffers.get(ch);
      if (!buffers || buffers.length === 0)
        continue;
      const samples = buffers.shift();
      const isStereo = channel.format === 0 /* Stereo */;
      const leftVol = channel.leftVolume / 32768;
      const rightVol = channel.rightVolume / 32768;
      if (isStereo) {
        for (let i = 0;i < left.length && i * 2 + 1 < samples.length; i++) {
          left[i] += samples[i * 2] * leftVol;
          right[i] += samples[i * 2 + 1] * rightVol;
        }
      } else {
        for (let i = 0;i < left.length && i < samples.length; i++) {
          const sample = samples[i];
          left[i] += sample * leftVol;
          right[i] += sample * rightVol;
        }
      }
    }
    const masterVol = this.audio.masterVolume / 32768;
    for (let i = 0;i < left.length; i++) {
      left[i] = Math.max(-1, Math.min(1, left[i] * masterVol));
      right[i] = Math.max(-1, Math.min(1, right[i] * masterVol));
    }
  }
  async resume() {
    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }
  }
  async suspend() {
    if (this.audioContext?.state === "running") {
      await this.audioContext.suspend();
    }
  }
  setVolume(volume) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }
  clearBuffers() {
    for (const buffer of this.channelBuffers.values()) {
      buffer.length = 0;
    }
  }
  destroy() {
    if (this.scriptNode) {
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.gainNode = null;
    this.clearBuffers();
  }
}
// src/core/controller/Controller.ts
var MAX_SAMPLES = 64;
var ANALOG_CENTER = 128;
class Controller {
  state = {
    buttons: 0,
    analogX: ANALOG_CENTER,
    analogY: ANALOG_CENTER,
    mode: 1 /* Analog */,
    cycle: 0,
    samples: [],
    latchData: {
      make: 0,
      break: 0,
      press: 0,
      release: 0
    }
  };
  timestamp = 0;
  get buttons() {
    return this.state.buttons;
  }
  get analogX() {
    return this.state.analogX;
  }
  get analogY() {
    return this.state.analogY;
  }
  get mode() {
    return this.state.mode;
  }
  get latchData() {
    return { ...this.state.latchData };
  }
  setMode(mode) {
    this.state.mode = mode;
  }
  setCycle(cycle) {
    this.state.cycle = cycle;
  }
  pressButton(button) {
    const prevButtons = this.state.buttons;
    this.state.buttons |= button;
    const newPress = this.state.buttons & ~prevButtons;
    this.state.latchData.make |= newPress;
    this.state.latchData.press |= newPress;
  }
  releaseButton(button) {
    const prevButtons = this.state.buttons;
    this.state.buttons &= ~button;
    const newRelease = prevButtons & ~this.state.buttons;
    this.state.latchData.break |= newRelease;
    this.state.latchData.release |= newRelease;
  }
  setButtons(buttons) {
    const prevButtons = this.state.buttons;
    this.state.buttons = buttons;
    const newPress = buttons & ~prevButtons;
    const newRelease = prevButtons & ~buttons;
    this.state.latchData.make |= newPress;
    this.state.latchData.press |= newPress;
    this.state.latchData.break |= newRelease;
    this.state.latchData.release |= newRelease;
  }
  setAnalog(x, y) {
    this.state.analogX = Math.max(0, Math.min(255, x));
    this.state.analogY = Math.max(0, Math.min(255, y));
  }
  setAnalogNormalized(x, y) {
    this.state.analogX = Math.floor((x + 1) * 127.5);
    this.state.analogY = Math.floor((y + 1) * 127.5);
  }
  peekData() {
    return {
      timestamp: this.timestamp,
      buttons: this.state.buttons,
      analogX: this.state.mode === 1 /* Analog */ ? this.state.analogX : ANALOG_CENTER,
      analogY: this.state.mode === 1 /* Analog */ ? this.state.analogY : ANALOG_CENTER
    };
  }
  readBuffers(count) {
    const result = [];
    const available = Math.min(count, this.state.samples.length);
    for (let i = 0;i < available; i++) {
      result.push(this.state.samples.shift());
    }
    while (result.length < count) {
      result.push(this.peekData());
    }
    return result;
  }
  readLatch() {
    const latch = { ...this.state.latchData };
    this.state.latchData = {
      make: 0,
      break: 0,
      press: this.state.buttons,
      release: 0
    };
    return latch;
  }
  update() {
    this.timestamp++;
    if (this.state.samples.length >= MAX_SAMPLES) {
      this.state.samples.shift();
    }
    this.state.samples.push(this.peekData());
  }
  reset() {
    this.state = {
      buttons: 0,
      analogX: ANALOG_CENTER,
      analogY: ANALOG_CENTER,
      mode: 1 /* Analog */,
      cycle: 0,
      samples: [],
      latchData: {
        make: 0,
        break: 0,
        press: 0,
        release: 0
      }
    };
    this.timestamp = 0;
  }
}
// src/psp/html5/Html5Input.ts
var DEFAULT_KEY_MAPPING = {
  ArrowUp: 16 /* Up */,
  ArrowDown: 64 /* Down */,
  ArrowLeft: 128 /* Left */,
  ArrowRight: 32 /* Right */,
  w: 4096 /* Triangle */,
  s: 16384 /* Cross */,
  a: 32768 /* Square */,
  d: 8192 /* Circle */,
  i: 4096 /* Triangle */,
  k: 16384 /* Cross */,
  j: 32768 /* Square */,
  l: 8192 /* Circle */,
  q: 256 /* LTrigger */,
  e: 512 /* RTrigger */,
  Enter: 8 /* Start */,
  Shift: 1 /* Select */,
  Escape: 65536 /* Home */
};
var DEFAULT_GAMEPAD_MAPPING = {
  buttons: {
    0: 16384 /* Cross */,
    1: 8192 /* Circle */,
    2: 32768 /* Square */,
    3: 4096 /* Triangle */,
    4: 256 /* LTrigger */,
    5: 512 /* RTrigger */,
    8: 1 /* Select */,
    9: 8 /* Start */,
    12: 16 /* Up */,
    13: 64 /* Down */,
    14: 128 /* Left */,
    15: 32 /* Right */,
    16: 65536 /* Home */
  },
  axes: {
    leftX: 0,
    leftY: 1,
    deadzone: 0.15
  }
};

class Html5Input {
  controller;
  keyMapping;
  gamepadMapping;
  pressedKeys = new Set;
  gamepadIndex = -1;
  keydownHandler;
  keyupHandler;
  gamepadPollInterval = null;
  constructor(controller, keyMapping = DEFAULT_KEY_MAPPING, gamepadMapping = DEFAULT_GAMEPAD_MAPPING) {
    this.controller = controller;
    this.keyMapping = keyMapping;
    this.gamepadMapping = gamepadMapping;
    this.keydownHandler = this.onKeyDown.bind(this);
    this.keyupHandler = this.onKeyUp.bind(this);
  }
  start() {
    window.addEventListener("keydown", this.keydownHandler);
    window.addEventListener("keyup", this.keyupHandler);
    window.addEventListener("gamepadconnected", this.onGamepadConnected.bind(this));
    window.addEventListener("gamepaddisconnected", this.onGamepadDisconnected.bind(this));
    this.startGamepadPolling();
  }
  stop() {
    window.removeEventListener("keydown", this.keydownHandler);
    window.removeEventListener("keyup", this.keyupHandler);
    this.stopGamepadPolling();
    this.pressedKeys.clear();
    this.controller.reset();
  }
  onKeyDown(event) {
    const button = this.keyMapping[event.key];
    if (button !== undefined) {
      event.preventDefault();
      if (!this.pressedKeys.has(event.key)) {
        this.pressedKeys.add(event.key);
        this.controller.pressButton(button);
      }
    }
  }
  onKeyUp(event) {
    const button = this.keyMapping[event.key];
    if (button !== undefined) {
      event.preventDefault();
      this.pressedKeys.delete(event.key);
      this.controller.releaseButton(button);
    }
  }
  onGamepadConnected(event) {
    console.log(`Gamepad connected: ${event.gamepad.id}`);
    if (this.gamepadIndex < 0) {
      this.gamepadIndex = event.gamepad.index;
    }
  }
  onGamepadDisconnected(event) {
    console.log(`Gamepad disconnected: ${event.gamepad.id}`);
    if (event.gamepad.index === this.gamepadIndex) {
      this.gamepadIndex = -1;
      this.findNextGamepad();
    }
  }
  findNextGamepad() {
    const gamepads = navigator.getGamepads();
    for (let i = 0;i < gamepads.length; i++) {
      if (gamepads[i]) {
        this.gamepadIndex = i;
        return;
      }
    }
  }
  startGamepadPolling() {
    if (this.gamepadPollInterval !== null)
      return;
    this.gamepadPollInterval = window.setInterval(() => {
      this.pollGamepad();
    }, 16);
  }
  stopGamepadPolling() {
    if (this.gamepadPollInterval !== null) {
      clearInterval(this.gamepadPollInterval);
      this.gamepadPollInterval = null;
    }
  }
  pollGamepad() {
    if (this.gamepadIndex < 0)
      return;
    const gamepads = navigator.getGamepads();
    const gamepad = gamepads[this.gamepadIndex];
    if (!gamepad)
      return;
    let buttons = 0;
    for (const [index, button] of Object.entries(this.gamepadMapping.buttons)) {
      const btnIndex = parseInt(index);
      if (gamepad.buttons[btnIndex]?.pressed) {
        buttons |= button;
      }
    }
    this.controller.setButtons(buttons | this.getKeyboardButtons());
    const { leftX, leftY, deadzone } = this.gamepadMapping.axes;
    let ax = gamepad.axes[leftX] ?? 0;
    let ay = gamepad.axes[leftY] ?? 0;
    if (Math.abs(ax) < deadzone)
      ax = 0;
    if (Math.abs(ay) < deadzone)
      ay = 0;
    const analogX = Math.floor((ax + 1) * 127.5);
    const analogY = Math.floor((ay + 1) * 127.5);
    this.controller.setAnalog(analogX, analogY);
  }
  getKeyboardButtons() {
    let buttons = 0;
    for (const key of this.pressedKeys) {
      const button = this.keyMapping[key];
      if (button !== undefined) {
        buttons |= button;
      }
    }
    return buttons;
  }
  setKeyMapping(mapping) {
    this.keyMapping = mapping;
  }
  setGamepadMapping(mapping) {
    this.gamepadMapping = mapping;
  }
  getKeyMapping() {
    return { ...this.keyMapping };
  }
  getConnectedGamepads() {
    const gamepads = navigator.getGamepads();
    return Array.from(gamepads).filter((g) => g !== null);
  }
}
// src/core/battery/Battery.ts
var MAX_CAPACITY = 1800;
var FULL_VOLTAGE = 4200;
var CRITICAL_VOLTAGE = 3400;
var DEFAULT_TEMP = 2500;
class Battery {
  state = {
    present: true,
    charging: false,
    externalPower: true,
    lowBattery: false,
    percentage: 100,
    lifetimeMinutes: 300,
    voltage: FULL_VOLTAGE,
    temperature: DEFAULT_TEMP,
    capacity: MAX_CAPACITY
  };
  get present() {
    return this.state.present;
  }
  get charging() {
    return this.state.charging;
  }
  get externalPower() {
    return this.state.externalPower;
  }
  get lowBattery() {
    return this.state.lowBattery;
  }
  get percentage() {
    return this.state.percentage;
  }
  get lifetimeMinutes() {
    return this.state.lifetimeMinutes;
  }
  get voltage() {
    return this.state.voltage;
  }
  get temperature() {
    return this.state.temperature;
  }
  get capacity() {
    return this.state.capacity;
  }
  get powerSource() {
    return this.state.externalPower ? 1 /* External */ : 0 /* Battery */;
  }
  get chargingStatus() {
    return this.state.charging ? 1 /* Charging */ : 0 /* NotCharging */;
  }
  get batteryPresence() {
    return this.state.present ? 1 /* Present */ : 0 /* NotPresent */;
  }
  setPercentage(percentage) {
    this.state.percentage = Math.max(0, Math.min(100, percentage));
    this.state.capacity = Math.floor(this.state.percentage / 100 * MAX_CAPACITY);
    this.state.voltage = this.calculateVoltage(this.state.percentage);
    this.state.lowBattery = this.state.percentage <= 20;
    this.state.lifetimeMinutes = Math.floor(this.state.percentage * 3);
  }
  setCharging(charging) {
    this.state.charging = charging;
    if (charging) {
      this.state.externalPower = true;
    }
  }
  setExternalPower(external) {
    this.state.externalPower = external;
    if (!external) {
      this.state.charging = false;
    }
  }
  setPresent(present) {
    this.state.present = present;
    if (!present) {
      this.state.charging = false;
    }
  }
  setTemperature(temp) {
    this.state.temperature = temp;
  }
  update(deltaMs) {
    if (this.state.charging && this.state.percentage < 100) {
      const chargeRate = 2 / 60000;
      this.setPercentage(this.state.percentage + deltaMs * chargeRate);
    } else if (!this.state.externalPower && this.state.percentage > 0) {
      const drainRate = 0.33 / 60000;
      this.setPercentage(this.state.percentage - deltaMs * drainRate);
    }
  }
  calculateVoltage(percentage) {
    const voltageRange = FULL_VOLTAGE - CRITICAL_VOLTAGE;
    return CRITICAL_VOLTAGE + Math.floor(percentage / 100 * voltageRange);
  }
  reset() {
    this.state = {
      present: true,
      charging: false,
      externalPower: true,
      lowBattery: false,
      percentage: 100,
      lifetimeMinutes: 300,
      voltage: FULL_VOLTAGE,
      temperature: DEFAULT_TEMP,
      capacity: MAX_CAPACITY
    };
  }
}
// src/psp/html5/Html5Platform.ts
class Html5Platform {
  display;
  audio;
  controller;
  battery;
  memory;
  html5Display;
  html5Audio;
  html5Input;
  running = false;
  animationFrameId = 0;
  lastFrameTime = 0;
  frameCallback = null;
  frameCount = 0;
  totalTime = 0;
  constructor(memory, options) {
    this.memory = memory;
    this.display = new Display;
    this.audio = new Audio;
    this.controller = new Controller;
    this.battery = new Battery;
    this.html5Display = new Html5Display({ canvas: options.canvas, ...options.display }, this.display, memory);
    this.html5Audio = new Html5Audio(this.audio, options.audio);
    this.html5Input = new Html5Input(this.controller, options.keyMapping, options.gamepadMapping);
  }
  get isRunning() {
    return this.running;
  }
  get fps() {
    return this.html5Display.currentFps;
  }
  get averageFrameTime() {
    return this.frameCount > 0 ? this.totalTime / this.frameCount : 0;
  }
  async init() {
    await this.html5Audio.init();
  }
  start(frameCallback) {
    if (this.running)
      return;
    this.running = true;
    this.frameCallback = frameCallback ?? null;
    this.lastFrameTime = performance.now();
    this.html5Input.start();
    this.scheduleFrame();
  }
  stop() {
    if (!this.running)
      return;
    this.running = false;
    this.html5Input.stop();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }
  async pause() {
    await this.html5Audio.suspend();
  }
  async resume() {
    await this.html5Audio.resume();
  }
  scheduleFrame() {
    this.animationFrameId = requestAnimationFrame((time) => this.onFrame(time));
  }
  onFrame(currentTime) {
    if (!this.running)
      return;
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;
    this.frameCount++;
    this.totalTime += deltaTime;
    this.display.update(currentTime);
    this.controller.update();
    this.battery.update(deltaTime);
    if (this.frameCallback) {
      this.frameCallback(deltaTime);
    }
    this.html5Display.render();
    this.scheduleFrame();
  }
  step() {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;
    this.display.update(currentTime);
    this.controller.update();
    if (this.frameCallback) {
      this.frameCallback(deltaTime);
    }
    this.html5Display.render();
  }
  takeScreenshot() {
    const canvas = document.querySelector("canvas");
    return canvas?.toDataURL("image/png") ?? "";
  }
  reset() {
    this.display.reset();
    this.audio.reset();
    this.controller.reset();
    this.battery.reset();
    this.html5Audio.clearBuffers();
    this.frameCount = 0;
    this.totalTime = 0;
  }
  destroy() {
    this.stop();
    this.html5Audio.destroy();
  }
}
// public/main.ts
var canvas = document.getElementById("screen");
var fpsEl = document.getElementById("fps");
var pcEl = document.getElementById("pc");
var instructionsEl = document.getElementById("instructions");
var logEl = document.getElementById("log");
var fileInput = document.getElementById("fileInput");
var loadBtn = document.getElementById("loadBtn");
var startBtn = document.getElementById("startBtn");
var pauseBtn = document.getElementById("pauseBtn");
var stepBtn = document.getElementById("stepBtn");
var resetBtn = document.getElementById("resetBtn");
var memory = null;
var cpu = null;
var ctx = null;
var platform = null;
var running = false;
var instructionCount = 0;
var syscallCount = 0;
var pcHistory = [];
var PC_HISTORY_SIZE = 20;
var VRAM_BASE2 = 67108864;
var SCREEN_WIDTH2 = 480;
var SCREEN_HEIGHT2 = 272;
var BUFFER_WIDTH = 512;
function writeTestPattern(memory2) {
  log("Writing test pattern to VRAM...");
  for (let y = 0;y < SCREEN_HEIGHT2; y++) {
    for (let x = 0;x < SCREEN_WIDTH2; x++) {
      const offset = (y * BUFFER_WIDTH + x) * 4;
      const addr = VRAM_BASE2 + offset;
      const r = x * 255 / SCREEN_WIDTH2 | 0;
      const g = y * 255 / SCREEN_HEIGHT2 | 0;
      const b = (x + y) * 127 / (SCREEN_WIDTH2 + SCREEN_HEIGHT2) | 0;
      const a = 255;
      const pixel = a << 24 | b << 16 | g << 8 | r;
      memory2.sw(addr, pixel);
    }
  }
  log("Test pattern written");
}
function log(message) {
  const time = new Date().toLocaleTimeString();
  logEl.innerHTML += `[${time}] ${message}
`;
  logEl.scrollTop = logEl.scrollHeight;
  console.log(message);
}
function logCrash(status) {
  if (!cpu)
    return;
  const state = cpu.state;
  log(`=== CPU CRASH: ${CpuStatus[status]} ===`);
  log(`PC: 0x${state.pc.toString(16).padStart(8, "0")}`);
  log(`Instructions executed: ${instructionCount.toLocaleString()}`);
  if (state.pc >= 67108864 && state.pc < 69206016) {
    log(`ERROR: PC is in VRAM region! Program jumped to framebuffer.`);
  } else if (state.pc < 134217728) {
    log(`ERROR: PC is below user memory (0x08000000)`);
  }
  log(`Registers:`);
  log(`  $ra (r31): 0x${state.gpr[31].toString(16).padStart(8, "0")} (return address)`);
  log(`  $sp (r29): 0x${state.gpr[29].toString(16).padStart(8, "0")} (stack pointer)`);
  log(`  $v0 (r2):  0x${state.gpr[2].toString(16).padStart(8, "0")} (return value)`);
  log(`  $a0 (r4):  0x${state.gpr[4].toString(16).padStart(8, "0")} (arg0)`);
  log(`Last ${pcHistory.length} PCs (oldest first):`);
  const historyStr = pcHistory.map((pc) => "0x" + pc.toString(16)).join(" -> ");
  log(`  ${historyStr}`);
  if (memory) {
    try {
      const instr = memory.lwu(state.pc);
      log(`Instruction at PC: 0x${instr.toString(16).padStart(8, "0")}`);
    } catch (e) {
      log(`Could not read instruction at PC`);
    }
  }
  console.log("Full CPU state:", state);
}
function registerAllModules(ctx2) {
  const moduleClasses = [
    SysMemUserForUser,
    ThreadManForUser,
    IoFileMgrForUser,
    sceDisplay,
    sceCtrl,
    sceGe_user,
    sceAudio,
    UtilsForUser,
    LoadExecForUser,
    Kernel_Library,
    sceUtility,
    ModuleMgrForUser,
    StdioForUser
  ];
  for (const moduleClass of moduleClasses) {
    ctx2.moduleManager.registerModule(moduleClass);
  }
}
async function loadRom(data, filename) {
  log(`Loading: ${filename} (${data.byteLength} bytes)`);
  memory = new Memory;
  cpu = new Cpu(memory, 0 /* INTERPRETER */);
  ctx = new EmulatorContext(memory);
  instructionCount = 0;
  syscallCount = 0;
  registerAllModules(ctx);
  cpu.setSyscallHandler((cpuState, code) => {
    const func = ctx.moduleManager.getFunction(code);
    if (func) {
      syscallCount++;
    }
  });
  let elf2;
  let baseAddress;
  if (filename.toLowerCase().endsWith(".pbp")) {
    log("Parsing PBP file...");
    const pbp2 = PbpFile.fromBuffer(data);
    const elfStream = pbp2.readEntry(6 /* DATA_PSP */);
    if (!elfStream) {
      throw new Error("PBP file does not contain executable");
    }
    elf2 = new ElfFile(elfStream);
  } else {
    log("Parsing ELF file...");
    const stream2 = new Stream(data);
    elf2 = new ElfFile(stream2);
  }
  log(`Entry point: 0x${elf2.entryPoint.toString(16)}`);
  log(`Is PRX: ${elf2.isPrx}`);
  log(`Segments: ${elf2.programHeaders.length}`);
  baseAddress = elf2.isPrx ? 142606336 : 0;
  const { entryPoint, size } = elf2.loadIntoMemory(memory, baseAddress);
  log(`Loaded at: 0x${entryPoint.toString(16)}`);
  log(`Size: ${size} bytes`);
  if (elf2.isPrx && elf2.relocations.length > 0) {
    elf2.applyRelocations(memory, baseAddress);
    log(`Applied ${elf2.relocations.length} relocations`);
  }
  cpu.setEntryPoint(entryPoint);
  cpu.state.gpr[29] = 167768064;
  cpu.state.gpr[31] = 0;
  platform = new Html5Platform(memory, { canvas, display: { scale: 2 } });
  await platform.init();
  writeTestPattern(memory);
  platform.display.setFrameBuf(67108864, 512, 0, 0);
  const fb = platform.display.getFrameBuf();
  log(`Framebuffer: addr=0x${fb.address.toString(16)}, width=${fb.bufferWidth}, format=${fb.pixelFormat}`);
  const firstPixel = memory.lwu(VRAM_BASE2);
  log(`First VRAM pixel: 0x${firstPixel.toString(16)}`);
  platform.html5Display.render();
  requestAnimationFrame(() => {
    platform?.html5Display.render();
  });
  log("ROM loaded - gradient should be visible");
  startBtn.disabled = false;
  stepBtn.disabled = false;
  resetBtn.disabled = false;
  updateStats();
}
function step() {
  if (!cpu)
    return;
  const status = cpu.step();
  instructionCount++;
  if (status === 3 /* SYSCALL */) {
    syscallCount++;
    cpu.state.pc = cpu.state.npc;
  }
  updateStats();
}
function runFrame() {
  if (!cpu || !running)
    return;
  const instructionsPerFrame = 1e5;
  for (let i = 0;i < instructionsPerFrame; i++) {
    pcHistory.push(cpu.state.pc);
    if (pcHistory.length > PC_HISTORY_SIZE)
      pcHistory.shift();
    const status = cpu.step();
    instructionCount++;
    if (status === 3 /* SYSCALL */) {
      syscallCount++;
      const code = cpu.state.gpr[2];
      log(`Syscall at PC=0x${cpu.state.pc.toString(16)}, code=${code}`);
      cpu.state.pc = cpu.state.npc;
    } else if (status === 0 /* STOPPED */ || status === 4 /* ERROR */) {
      running = false;
      logCrash(status);
      break;
    }
  }
  if (platform) {
    platform.html5Display.render();
  }
  updateStats();
  if (running) {
    requestAnimationFrame(runFrame);
  }
}
function start() {
  if (!cpu)
    return;
  running = true;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  stepBtn.disabled = true;
  log("Started emulation");
  runFrame();
}
function pause() {
  running = false;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  stepBtn.disabled = false;
  log("Paused emulation");
}
function reset() {
  running = false;
  instructionCount = 0;
  syscallCount = 0;
  if (platform) {
    platform.reset();
    platform.html5Display.clear();
  }
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  stepBtn.disabled = false;
  log("Reset");
  updateStats();
}
function updateStats() {
  if (platform) {
    fpsEl.textContent = platform.fps.toString();
  }
  if (cpu) {
    pcEl.textContent = "0x" + cpu.state.pc.toString(16).padStart(8, "0");
  }
  instructionsEl.textContent = instructionCount.toLocaleString();
}
loadBtn.addEventListener("click", () => {
  fileInput.click();
});
fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file)
    return;
  try {
    const data = await file.arrayBuffer();
    await loadRom(data, file.name);
  } catch (error) {
    log(`Error: ${error}`);
  }
});
startBtn.addEventListener("click", start);
pauseBtn.addEventListener("click", pause);
stepBtn.addEventListener("click", step);
resetBtn.addEventListener("click", reset);
document.body.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
});
document.body.addEventListener("drop", async (e) => {
  e.preventDefault();
  e.stopPropagation();
  const file = e.dataTransfer?.files[0];
  if (!file)
    return;
  try {
    const data = await file.arrayBuffer();
    await loadRom(data, file.name);
  } catch (error) {
    log(`Error: ${error}`);
  }
});
async function autoLoadCube() {
  try {
    log("Attempting to load cube.elf...");
    const response = await fetch("/data/samples/cube.elf");
    if (!response.ok) {
      log("cube.elf not found, drag and drop a ROM to load");
      return;
    }
    const data = await response.arrayBuffer();
    await loadRom(data, "cube.elf");
  } catch (error) {
    log("cube.elf not available, use Load ROM button");
  }
}
log("Kaski PSP Emulator initialized");
autoLoadCube();
