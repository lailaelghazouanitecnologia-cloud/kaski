import { CpuState } from './CpuState';
import { Instruction } from './Instruction';
import { InstructionTable } from './InstructionTable';
import type { InstructionType } from './InstructionType';
import {
  vfpuUnary, vfpuBinary, vfpuConstant, vfpuDot, vfpuScale,
  vAdd, vSub, vMul, vDiv, vMin, vMax,
  vAbs, vNeg, vSqrt, vRcp, vRsq, vSin, vCos, vExp2, vLog2,
  vSat0, vSat1, vMov,
} from './VfpuHelpers';

/**
 * Execution result
 */
export const enum ExecutionResult {
  /** Continue to next instruction */
  CONTINUE = 0,
  /** Branch/jump taken */
  BRANCH = 1,
  /** Syscall executed */
  SYSCALL = 2,
  /** Break instruction */
  BREAK = 3,
  /** Unknown instruction */
  UNKNOWN = 4,
}

/**
 * MIPS Interpreter
 *
 * Executes MIPS instructions one at a time.
 * This is the fallback execution mode (vs JIT compilation).
 */
export class Interpreter {
  private table: InstructionTable;
  private handlers: Map<string, (cpu: CpuState, instr: Instruction) => ExecutionResult>;

  constructor()
  {
    this.table = InstructionTable.instance;
    this.handlers = new Map();
    this.registerHandlers();
    this.registerVfpuHandlers();
    this.registerExtendedHandlers();
  }

  /**
   * Execute a single instruction
   */
  execute(cpu: CpuState, instr: Instruction): ExecutionResult {
    const type = this.table.find(instr.data);

    if (!type) {
      console.warn(`Unknown instruction at 0x${instr.pc.toString(16)}: 0x${instr.data.toString(16)}`);
      return ExecutionResult.UNKNOWN;
    }

    const handler = this.handlers.get(type.name);
    if (!handler) {
      console.warn(`Unimplemented instruction: ${type.name}`);
      return ExecutionResult.UNKNOWN;
    }

    return handler(cpu, instr);
  }

  /**
   * Execute instruction at current PC and advance
   */
  step(cpu: CpuState): ExecutionResult {
    const instr = Instruction.fromMemory(cpu.memory, cpu.pc);
    const result = this.execute(cpu, instr);

    // Advance PC unless branch/jump handled it
    if (result === ExecutionResult.CONTINUE) {
      cpu.pc = (cpu.pc + 4) >>> 0;
    }

    return result;
  }

  /**
   * Execute multiple instructions
   */
  run(cpu: CpuState, maxInstructions: number = 1000): ExecutionResult {
    for (let i = 0; i < maxInstructions; i++) {
      const result = this.step(cpu);
      if (result !== ExecutionResult.CONTINUE && result !== ExecutionResult.BRANCH) {
        return result;
      }
    }
    return ExecutionResult.CONTINUE;
  }

  private registerHandlers(): void {
    // ============================================
    // Arithmetic Operations
    // ============================================

    this.handlers.set('add', (cpu, i) => {
      cpu.setGpr(i.rd, (cpu.getGpr(i.rs) + cpu.getGpr(i.rt)) | 0);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('addu', (cpu, i) => {
      cpu.setGpr(i.rd, (cpu.getGpr(i.rs) + cpu.getGpr(i.rt)) | 0);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('addi', (cpu, i) => {
      cpu.setGpr(i.rt, (cpu.getGpr(i.rs) + i.imm16) | 0);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('addiu', (cpu, i) => {
      cpu.setGpr(i.rt, (cpu.getGpr(i.rs) + i.imm16) | 0);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('sub', (cpu, i) => {
      cpu.setGpr(i.rd, (cpu.getGpr(i.rs) - cpu.getGpr(i.rt)) | 0);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('subu', (cpu, i) => {
      cpu.setGpr(i.rd, (cpu.getGpr(i.rs) - cpu.getGpr(i.rt)) | 0);
      return ExecutionResult.CONTINUE;
    });

    // ============================================
    // Logical Operations
    // ============================================

    this.handlers.set('and', (cpu, i) => {
      cpu.setGpr(i.rd, cpu.getGpr(i.rs) & cpu.getGpr(i.rt));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('andi', (cpu, i) => {
      cpu.setGpr(i.rt, cpu.getGpr(i.rs) & i.uimm16);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('or', (cpu, i) => {
      cpu.setGpr(i.rd, cpu.getGpr(i.rs) | cpu.getGpr(i.rt));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('ori', (cpu, i) => {
      cpu.setGpr(i.rt, cpu.getGpr(i.rs) | i.uimm16);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('xor', (cpu, i) => {
      cpu.setGpr(i.rd, cpu.getGpr(i.rs) ^ cpu.getGpr(i.rt));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('xori', (cpu, i) => {
      cpu.setGpr(i.rt, cpu.getGpr(i.rs) ^ i.uimm16);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('nor', (cpu, i) => {
      cpu.setGpr(i.rd, ~(cpu.getGpr(i.rs) | cpu.getGpr(i.rt)));
      return ExecutionResult.CONTINUE;
    });

    // ============================================
    // Shift Operations
    // ============================================

    this.handlers.set('sll', (cpu, i) => {
      cpu.setGpr(i.rd, cpu.getGpr(i.rt) << i.sa);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('sllv', (cpu, i) => {
      cpu.setGpr(i.rd, cpu.getGpr(i.rt) << (cpu.getGpr(i.rs) & 0x1F));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('srl', (cpu, i) => {
      cpu.setGpr(i.rd, cpu.getGpr(i.rt) >>> i.sa);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('srlv', (cpu, i) => {
      cpu.setGpr(i.rd, cpu.getGpr(i.rt) >>> (cpu.getGpr(i.rs) & 0x1F));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('sra', (cpu, i) => {
      cpu.setGpr(i.rd, cpu.getGpr(i.rt) >> i.sa);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('srav', (cpu, i) => {
      cpu.setGpr(i.rd, cpu.getGpr(i.rt) >> (cpu.getGpr(i.rs) & 0x1F));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('rotr', (cpu, i) => {
      const value = cpu.getGprU(i.rt);
      const amount = i.sa;
      cpu.setGpr(i.rd, ((value >>> amount) | (value << (32 - amount))) | 0);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('rotrv', (cpu, i) => {
      const value = cpu.getGprU(i.rt);
      const amount = cpu.getGpr(i.rs) & 0x1F;
      cpu.setGpr(i.rd, ((value >>> amount) | (value << (32 - amount))) | 0);
      return ExecutionResult.CONTINUE;
    });

    // ============================================
    // Comparison Operations
    // ============================================

    this.handlers.set('slt', (cpu, i) => {
      cpu.setGpr(i.rd, cpu.getGpr(i.rs) < cpu.getGpr(i.rt) ? 1 : 0);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('slti', (cpu, i) => {
      cpu.setGpr(i.rt, cpu.getGpr(i.rs) < i.imm16 ? 1 : 0);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('sltu', (cpu, i) => {
      cpu.setGpr(i.rd, cpu.getGprU(i.rs) < cpu.getGprU(i.rt) ? 1 : 0);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('sltiu', (cpu, i) => {
      // Note: immediate is sign-extended then treated as unsigned
      cpu.setGpr(i.rt, cpu.getGprU(i.rs) < (i.imm16 >>> 0) ? 1 : 0);
      return ExecutionResult.CONTINUE;
    });

    // ============================================
    // Load Upper Immediate
    // ============================================

    this.handlers.set('lui', (cpu, i) => {
      cpu.setGpr(i.rt, i.uimm16 << 16);
      return ExecutionResult.CONTINUE;
    });

    // ============================================
    // Multiply/Divide
    // ============================================

    this.handlers.set('mult', (cpu, i) => {
      const a = BigInt(cpu.getGpr(i.rs));
      const b = BigInt(cpu.getGpr(i.rt));
      const result = a * b;
      cpu.lo = Number(result & 0xFFFFFFFFn) | 0;
      cpu.hi = Number((result >> 32n) & 0xFFFFFFFFn) | 0;
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('multu', (cpu, i) => {
      const a = BigInt(cpu.getGprU(i.rs));
      const b = BigInt(cpu.getGprU(i.rt));
      const result = a * b;
      cpu.lo = Number(result & 0xFFFFFFFFn) | 0;
      cpu.hi = Number((result >> 32n) & 0xFFFFFFFFn) | 0;
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('div', (cpu, i) => {
      const rs = cpu.getGpr(i.rs);
      const rt = cpu.getGpr(i.rt);
      if (rt !== 0) {
        cpu.lo = (rs / rt) | 0;
        cpu.hi = (rs % rt) | 0;
      }
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('divu', (cpu, i) => {
      const rs = cpu.getGprU(i.rs);
      const rt = cpu.getGprU(i.rt);
      if (rt !== 0) {
        cpu.lo = (rs / rt) >>> 0;
        cpu.hi = (rs % rt) >>> 0;
      }
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('mfhi', (cpu, i) => {
      cpu.setGpr(i.rd, cpu.hi);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('mflo', (cpu, i) => {
      cpu.setGpr(i.rd, cpu.lo);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('mthi', (cpu, i) => {
      cpu.hi = cpu.getGpr(i.rs);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('mtlo', (cpu, i) => {
      cpu.lo = cpu.getGpr(i.rs);
      return ExecutionResult.CONTINUE;
    });

    // ============================================
    // Conditional Move (PSP)
    // ============================================

    this.handlers.set('movz', (cpu, i) => {
      if (cpu.getGpr(i.rt) === 0) {
        cpu.setGpr(i.rd, cpu.getGpr(i.rs));
      }
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('movn', (cpu, i) => {
      if (cpu.getGpr(i.rt) !== 0) {
        cpu.setGpr(i.rd, cpu.getGpr(i.rs));
      }
      return ExecutionResult.CONTINUE;
    });

    // ============================================
    // Sign Extend (PSP)
    // ============================================

    this.handlers.set('seb', (cpu, i) => {
      cpu.setGpr(i.rd, (cpu.getGpr(i.rt) << 24) >> 24);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('seh', (cpu, i) => {
      cpu.setGpr(i.rd, (cpu.getGpr(i.rt) << 16) >> 16);
      return ExecutionResult.CONTINUE;
    });

    // ============================================
    // Bit Operations (PSP)
    // ============================================

    this.handlers.set('ext', (cpu, i) => {
      const value = cpu.getGprU(i.rs);
      const pos = i.lsb;
      const size = i.msb + 1;
      const mask = (1 << size) - 1;
      cpu.setGpr(i.rt, (value >>> pos) & mask);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('ins', (cpu, i) => {
      const rs = cpu.getGprU(i.rs);
      const rt = cpu.getGprU(i.rt);
      const pos = i.lsb;
      const size = i.msb - i.lsb + 1;
      const mask = ((1 << size) - 1) << pos;
      cpu.setGpr(i.rt, (rt & ~mask) | ((rs << pos) & mask));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('clz', (cpu, i) => {
      const value = cpu.getGprU(i.rs);
      cpu.setGpr(i.rd, Math.clz32(value));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('clo', (cpu, i) => {
      const value = cpu.getGprU(i.rs);
      cpu.setGpr(i.rd, Math.clz32(~value));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('max', (cpu, i) => {
      cpu.setGpr(i.rd, Math.max(cpu.getGpr(i.rs), cpu.getGpr(i.rt)));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('min', (cpu, i) => {
      cpu.setGpr(i.rd, Math.min(cpu.getGpr(i.rs), cpu.getGpr(i.rt)));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('wsbh', (cpu, i) => {
      const value = cpu.getGprU(i.rt);
      const result = ((value & 0x00FF00FF) << 8) | ((value & 0xFF00FF00) >>> 8);
      cpu.setGpr(i.rd, result);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('wsbw', (cpu, i) => {
      const value = cpu.getGprU(i.rt);
      const result = ((value & 0x000000FF) << 24) |
                     ((value & 0x0000FF00) << 8) |
                     ((value & 0x00FF0000) >>> 8) |
                     ((value & 0xFF000000) >>> 24);
      cpu.setGpr(i.rd, result);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('bitrev', (cpu, i) => {
      let value = cpu.getGprU(i.rt);
      let result = 0;
      for (let j = 0; j < 32; j++) {
        result = (result << 1) | (value & 1);
        value >>>= 1;
      }
      cpu.setGpr(i.rd, result);
      return ExecutionResult.CONTINUE;
    });

    // ============================================
    // Load Instructions
    // ============================================

    this.handlers.set('lb', (cpu, i) => {
      const addr = (cpu.getGpr(i.rs) + i.imm16) >>> 0;
      cpu.setGpr(i.rt, cpu.memory.lb(addr));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('lbu', (cpu, i) => {
      const addr = (cpu.getGpr(i.rs) + i.imm16) >>> 0;
      cpu.setGpr(i.rt, cpu.memory.lbu(addr));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('lh', (cpu, i) => {
      const addr = (cpu.getGpr(i.rs) + i.imm16) >>> 0;
      cpu.setGpr(i.rt, cpu.memory.lh(addr));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('lhu', (cpu, i) => {
      const addr = (cpu.getGpr(i.rs) + i.imm16) >>> 0;
      cpu.setGpr(i.rt, cpu.memory.lhu(addr));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('lw', (cpu, i) => {
      const addr = (cpu.getGpr(i.rs) + i.imm16) >>> 0;
      cpu.setGpr(i.rt, cpu.memory.lw(addr));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('lwl', (cpu, i) => {
      const addr = (cpu.getGpr(i.rs) + i.imm16) >>> 0;
      cpu.setGpr(i.rt, cpu.memory.lwl(addr, cpu.getGpr(i.rt)));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('lwr', (cpu, i) => {
      const addr = (cpu.getGpr(i.rs) + i.imm16) >>> 0;
      cpu.setGpr(i.rt, cpu.memory.lwr(addr, cpu.getGpr(i.rt)));
      return ExecutionResult.CONTINUE;
    });

    // ============================================
    // Store Instructions
    // ============================================

    this.handlers.set('sb', (cpu, i) => {
      const addr = (cpu.getGpr(i.rs) + i.imm16) >>> 0;
      cpu.memory.sb(addr, cpu.getGpr(i.rt));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('sh', (cpu, i) => {
      const addr = (cpu.getGpr(i.rs) + i.imm16) >>> 0;
      cpu.memory.sh(addr, cpu.getGpr(i.rt));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('sw', (cpu, i) => {
      const addr = (cpu.getGpr(i.rs) + i.imm16) >>> 0;
      cpu.memory.sw(addr, cpu.getGpr(i.rt));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('swl', (cpu, i) => {
      const addr = (cpu.getGpr(i.rs) + i.imm16) >>> 0;
      cpu.memory.swl(addr, cpu.getGpr(i.rt));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('swr', (cpu, i) => {
      const addr = (cpu.getGpr(i.rs) + i.imm16) >>> 0;
      cpu.memory.swr(addr, cpu.getGpr(i.rt));
      return ExecutionResult.CONTINUE;
    });

    // ============================================
    // Branch Instructions
    // ============================================

    this.handlers.set('beq', (cpu, i) => {
      if (cpu.getGpr(i.rs) === cpu.getGpr(i.rt)) {
        return this.executeBranch(cpu, i.branchTarget);
      }
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('bne', (cpu, i) => {
      if (cpu.getGpr(i.rs) !== cpu.getGpr(i.rt)) {
        return this.executeBranch(cpu, i.branchTarget);
      }
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('bgez', (cpu, i) => {
      if (cpu.getGpr(i.rs) >= 0) {
        return this.executeBranch(cpu, i.branchTarget);
      }
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('bgtz', (cpu, i) => {
      if (cpu.getGpr(i.rs) > 0) {
        return this.executeBranch(cpu, i.branchTarget);
      }
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('blez', (cpu, i) => {
      if (cpu.getGpr(i.rs) <= 0) {
        return this.executeBranch(cpu, i.branchTarget);
      }
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('bltz', (cpu, i) => {
      if (cpu.getGpr(i.rs) < 0) {
        return this.executeBranch(cpu, i.branchTarget);
      }
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('bgezal', (cpu, i) => {
      cpu.ra = (cpu.pc + 8) >>> 0;
      if (cpu.getGpr(i.rs) >= 0) {
        return this.executeBranch(cpu, i.branchTarget);
      }
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('bltzal', (cpu, i) => {
      cpu.ra = (cpu.pc + 8) >>> 0;
      if (cpu.getGpr(i.rs) < 0) {
        return this.executeBranch(cpu, i.branchTarget);
      }
      return ExecutionResult.CONTINUE;
    });

    // Likely branches (skip delay slot if not taken)
    this.handlers.set('beql', (cpu, i) => {
      if (cpu.getGpr(i.rs) === cpu.getGpr(i.rt)) {
        return this.executeBranch(cpu, i.branchTarget);
      }
      cpu.pc = (cpu.pc + 8) >>> 0; // Skip delay slot
      return ExecutionResult.BRANCH;
    });

    this.handlers.set('bnel', (cpu, i) => {
      if (cpu.getGpr(i.rs) !== cpu.getGpr(i.rt)) {
        return this.executeBranch(cpu, i.branchTarget);
      }
      cpu.pc = (cpu.pc + 8) >>> 0;
      return ExecutionResult.BRANCH;
    });

    this.handlers.set('bgtzl', (cpu, i) => {
      if (cpu.getGpr(i.rs) > 0) {
        return this.executeBranch(cpu, i.branchTarget);
      }
      cpu.pc = (cpu.pc + 8) >>> 0;
      return ExecutionResult.BRANCH;
    });

    this.handlers.set('blezl', (cpu, i) => {
      if (cpu.getGpr(i.rs) <= 0) {
        return this.executeBranch(cpu, i.branchTarget);
      }
      cpu.pc = (cpu.pc + 8) >>> 0;
      return ExecutionResult.BRANCH;
    });

    this.handlers.set('bgezl', (cpu, i) => {
      if (cpu.getGpr(i.rs) >= 0) {
        return this.executeBranch(cpu, i.branchTarget);
      }
      cpu.pc = (cpu.pc + 8) >>> 0;
      return ExecutionResult.BRANCH;
    });

    this.handlers.set('bltzl', (cpu, i) => {
      if (cpu.getGpr(i.rs) < 0) {
        return this.executeBranch(cpu, i.branchTarget);
      }
      cpu.pc = (cpu.pc + 8) >>> 0;
      return ExecutionResult.BRANCH;
    });

    this.handlers.set('bgezall', (cpu, i) => {
      cpu.ra = (cpu.pc + 8) >>> 0;
      if (cpu.getGpr(i.rs) >= 0) {
        return this.executeBranch(cpu, i.branchTarget);
      }
      cpu.pc = (cpu.pc + 8) >>> 0;
      return ExecutionResult.BRANCH;
    });

    this.handlers.set('bltzall', (cpu, i) => {
      cpu.ra = (cpu.pc + 8) >>> 0;
      if (cpu.getGpr(i.rs) < 0) {
        return this.executeBranch(cpu, i.branchTarget);
      }
      cpu.pc = (cpu.pc + 8) >>> 0;
      return ExecutionResult.BRANCH;
    });

    // FPU likely branches
    this.handlers.set('bc1fl', (cpu, i) => {
      if ((cpu.fcr31 & 0x800000) === 0) {
        return this.executeBranch(cpu, i.branchTarget);
      }
      cpu.pc = (cpu.pc + 8) >>> 0;
      return ExecutionResult.BRANCH;
    });

    this.handlers.set('bc1tl', (cpu, i) => {
      if ((cpu.fcr31 & 0x800000) !== 0) {
        return this.executeBranch(cpu, i.branchTarget);
      }
      cpu.pc = (cpu.pc + 8) >>> 0;
      return ExecutionResult.BRANCH;
    });

    // ============================================
    // Jump Instructions
    // ============================================

    this.handlers.set('j', (cpu, i) => {
      return this.executeBranch(cpu, i.jumpTarget);
    });

    this.handlers.set('jal', (cpu, i) => {
      cpu.ra = (cpu.pc + 8) >>> 0;
      return this.executeBranch(cpu, i.jumpTarget);
    });

    this.handlers.set('jr', (cpu, i) => {
      return this.executeBranch(cpu, cpu.getGprU(i.rs));
    });

    this.handlers.set('jalr', (cpu, i) => {
      const target = cpu.getGprU(i.rs);
      cpu.setGpr(i.rd, (cpu.pc + 8) >>> 0);
      return this.executeBranch(cpu, target);
    });

    // ============================================
    // System Instructions
    // ============================================

    this.handlers.set('syscall', (cpu, i) => {
      return ExecutionResult.SYSCALL;
    });

    this.handlers.set('break', (cpu, i) => {
      return ExecutionResult.BREAK;
    });

    this.handlers.set('sync', (cpu, i) => {
      // Memory barrier - no-op in our emulator
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('nop', (cpu, i) => {
      return ExecutionResult.CONTINUE;
    });

    // ============================================
    // FPU - Move operations
    // ============================================

    this.handlers.set('mfc1', (cpu, i) => {
      cpu.setGpr(i.rt, cpu.fprInt[i.fs]);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('mtc1', (cpu, i) => {
      cpu.fprInt[i.fs] = cpu.getGpr(i.rt);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('cfc1', (cpu, i) => {
      if (i.fs === 0) {
        cpu.setGpr(i.rt, cpu.fcr0);
      } else if (i.fs === 31) {
        cpu.setGpr(i.rt, cpu.fcr31);
      }
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('ctc1', (cpu, i) => {
      if (i.fs === 31) {
        cpu.fcr31 = cpu.getGpr(i.rt);
      }
      return ExecutionResult.CONTINUE;
    });

    // ============================================
    // FPU - Arithmetic
    // ============================================

    this.handlers.set('add.s', (cpu, i) => {
      cpu.fpr[i.fd] = cpu.fpr[i.fs] + cpu.fpr[i.ft];
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('sub.s', (cpu, i) => {
      cpu.fpr[i.fd] = cpu.fpr[i.fs] - cpu.fpr[i.ft];
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('mul.s', (cpu, i) => {
      cpu.fpr[i.fd] = cpu.fpr[i.fs] * cpu.fpr[i.ft];
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('div.s', (cpu, i) => {
      cpu.fpr[i.fd] = cpu.fpr[i.fs] / cpu.fpr[i.ft];
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('sqrt.s', (cpu, i) => {
      cpu.fpr[i.fd] = Math.sqrt(cpu.fpr[i.fs]);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('abs.s', (cpu, i) => {
      cpu.fpr[i.fd] = Math.abs(cpu.fpr[i.fs]);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('mov.s', (cpu, i) => {
      cpu.fpr[i.fd] = cpu.fpr[i.fs];
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('neg.s', (cpu, i) => {
      cpu.fpr[i.fd] = -cpu.fpr[i.fs];
      return ExecutionResult.CONTINUE;
    });

    // ============================================
    // FPU - Conversion
    // ============================================

    this.handlers.set('trunc.w.s', (cpu, i) => {
      cpu.fprInt[i.fd] = Math.trunc(cpu.fpr[i.fs]);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('round.w.s', (cpu, i) => {
      cpu.fprInt[i.fd] = Math.round(cpu.fpr[i.fs]);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('ceil.w.s', (cpu, i) => {
      cpu.fprInt[i.fd] = Math.ceil(cpu.fpr[i.fs]);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('floor.w.s', (cpu, i) => {
      cpu.fprInt[i.fd] = Math.floor(cpu.fpr[i.fs]);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('cvt.s.w', (cpu, i) => {
      cpu.fpr[i.fd] = cpu.fprInt[i.fs];
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('cvt.w.s', (cpu, i) => {
      // Use rounding mode from FCR31 (simplified: truncate)
      cpu.fprInt[i.fd] = Math.trunc(cpu.fpr[i.fs]);
      return ExecutionResult.CONTINUE;
    });

    // ============================================
    // FPU - Comparison
    // ============================================

    this.handlers.set('c.eq.s', (cpu, i) => {
      const result = cpu.fpr[i.fs] === cpu.fpr[i.ft];
      cpu.fcr31 = result ? (cpu.fcr31 | 0x800000) : (cpu.fcr31 & ~0x800000);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('c.lt.s', (cpu, i) => {
      const result = cpu.fpr[i.fs] < cpu.fpr[i.ft];
      cpu.fcr31 = result ? (cpu.fcr31 | 0x800000) : (cpu.fcr31 & ~0x800000);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('c.le.s', (cpu, i) => {
      const result = cpu.fpr[i.fs] <= cpu.fpr[i.ft];
      cpu.fcr31 = result ? (cpu.fcr31 | 0x800000) : (cpu.fcr31 & ~0x800000);
      return ExecutionResult.CONTINUE;
    });

    // ============================================
    // FPU - Branch
    // ============================================

    this.handlers.set('bc1f', (cpu, i) => {
      if ((cpu.fcr31 & 0x800000) === 0) {
        return this.executeBranch(cpu, i.branchTarget);
      }
      cpu.pc = (cpu.pc + 4) >>> 0;
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('bc1t', (cpu, i) => {
      if ((cpu.fcr31 & 0x800000) !== 0) {
        return this.executeBranch(cpu, i.branchTarget);
      }
      cpu.pc = (cpu.pc + 4) >>> 0;
      return ExecutionResult.CONTINUE;
    });

    // ============================================
    // FPU - Load/Store
    // ============================================

    this.handlers.set('lwc1', (cpu, i) => {
      const addr = (cpu.getGpr(i.rs) + i.imm16) >>> 0;
      cpu.fprInt[i.ft] = cpu.memory.lw(addr);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('swc1', (cpu, i) => {
      const addr = (cpu.getGpr(i.rs) + i.imm16) >>> 0;
      cpu.memory.sw(addr, cpu.fprInt[i.ft]);
      return ExecutionResult.CONTINUE;
    });
  }

  /**
   * Execute branch with delay slot
   */
  private executeBranch(cpu: CpuState, target: number): ExecutionResult
  {
    // Execute delay slot
    const delaySlotPc = (cpu.pc + 4) >>> 0;
    const delayInstr = Instruction.fromMemory(cpu.memory, delaySlotPc);
    this.execute(cpu, delayInstr);

    // Jump to target
    cpu.pc = target;
    return ExecutionResult.BRANCH;
  }

  /**
   * Register VFPU instruction handlers
   */
  private registerVfpuHandlers(): void
  {
    // Binary operations (vs, vt -> vd)
    this.handlers.set('vadd', (cpu, i) => vfpuBinary(cpu, i, vAdd));
    this.handlers.set('vsub', (cpu, i) => vfpuBinary(cpu, i, vSub));
    this.handlers.set('vmul', (cpu, i) => vfpuBinary(cpu, i, vMul));
    this.handlers.set('vdiv', (cpu, i) => vfpuBinary(cpu, i, vDiv));
    this.handlers.set('vmin', (cpu, i) => vfpuBinary(cpu, i, vMin));
    this.handlers.set('vmax', (cpu, i) => vfpuBinary(cpu, i, vMax));

    // Unary operations (vs -> vd)
    this.handlers.set('vmov', (cpu, i) => vfpuUnary(cpu, i, vMov));
    this.handlers.set('vabs', (cpu, i) => vfpuUnary(cpu, i, vAbs));
    this.handlers.set('vneg', (cpu, i) => vfpuUnary(cpu, i, vNeg));
    this.handlers.set('vsqrt', (cpu, i) => vfpuUnary(cpu, i, vSqrt));
    this.handlers.set('vrcp', (cpu, i) => vfpuUnary(cpu, i, vRcp));
    this.handlers.set('vrsq', (cpu, i) => vfpuUnary(cpu, i, vRsq));
    this.handlers.set('vsin', (cpu, i) => vfpuUnary(cpu, i, vSin));
    this.handlers.set('vcos', (cpu, i) => vfpuUnary(cpu, i, vCos));
    this.handlers.set('vexp2', (cpu, i) => vfpuUnary(cpu, i, vExp2));
    this.handlers.set('vlog2', (cpu, i) => vfpuUnary(cpu, i, vLog2));
    this.handlers.set('vsat0', (cpu, i) => vfpuUnary(cpu, i, vSat0));
    this.handlers.set('vsat1', (cpu, i) => vfpuUnary(cpu, i, vSat1));

    // Constants
    this.handlers.set('vzero', (cpu, i) => vfpuConstant(cpu, i, 0));
    this.handlers.set('vone', (cpu, i) => vfpuConstant(cpu, i, 1));

    // Special operations
    this.handlers.set('vdot', (cpu, i) => vfpuDot(cpu, i));
    this.handlers.set('vscl', (cpu, i) => vfpuScale(cpu, i));

    // ============================================
    // VFPU Move to/from GPR
    // ============================================

    this.handlers.set('mfv', (cpu, i) =>
    {
      const regs = cpu.getVectorRegs(i.vs, 1);
      const floatView = new Float32Array(1);
      const intView = new Int32Array(floatView.buffer);

      floatView[0] = cpu.vfpr[regs[0]];
      cpu.setGpr(i.rt, intView[0]);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('mtv', (cpu, i) =>
    {
      const regs = cpu.getVectorRegs(i.vd, 1);
      const intView = new Int32Array(1);
      const floatView = new Float32Array(intView.buffer);

      intView[0] = cpu.getGpr(i.rt);
      cpu.vfpr[regs[0]] = floatView[0];
      return ExecutionResult.CONTINUE;
    });
  }

  /**
   * Register multiply-accumulate and COP0 handlers
   */
  private registerExtendedHandlers(): void
  {
    // ============================================
    // Multiply-Accumulate
    // ============================================

    this.handlers.set('madd', (cpu, i) =>
    {
      const rs = cpu.getGpr(i.rs);
      const rt = cpu.getGpr(i.rt);
      const hilo = (BigInt(cpu.hi) << 32n) | BigInt(cpu.lo >>> 0);
      const result = hilo + BigInt(rs) * BigInt(rt);

      cpu.lo = Number(result & 0xFFFFFFFFn) | 0;
      cpu.hi = Number((result >> 32n) & 0xFFFFFFFFn) | 0;
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('maddu', (cpu, i) =>
    {
      const rs = BigInt(cpu.getGprU(i.rs));
      const rt = BigInt(cpu.getGprU(i.rt));
      const hilo = (BigInt(cpu.hi >>> 0) << 32n) | BigInt(cpu.lo >>> 0);
      const result = hilo + rs * rt;

      cpu.lo = Number(result & 0xFFFFFFFFn) | 0;
      cpu.hi = Number((result >> 32n) & 0xFFFFFFFFn) | 0;
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('msub', (cpu, i) =>
    {
      const rs = cpu.getGpr(i.rs);
      const rt = cpu.getGpr(i.rt);
      const hilo = (BigInt(cpu.hi) << 32n) | BigInt(cpu.lo >>> 0);
      const result = hilo - BigInt(rs) * BigInt(rt);

      cpu.lo = Number(result & 0xFFFFFFFFn) | 0;
      cpu.hi = Number((result >> 32n) & 0xFFFFFFFFn) | 0;
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('msubu', (cpu, i) =>
    {
      const rs = BigInt(cpu.getGprU(i.rs));
      const rt = BigInt(cpu.getGprU(i.rt));
      const hilo = (BigInt(cpu.hi >>> 0) << 32n) | BigInt(cpu.lo >>> 0);
      const result = hilo - rs * rt;

      cpu.lo = Number(result & 0xFFFFFFFFn) | 0;
      cpu.hi = Number((result >> 32n) & 0xFFFFFFFFn) | 0;
      return ExecutionResult.CONTINUE;
    });

    // ============================================
    // COP0 Instructions
    // ============================================

    this.handlers.set('mfc0', (cpu, i) =>
    {
      cpu.setGpr(i.rt, cpu.cop0[i.c0dr]);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('mtc0', (cpu, i) =>
    {
      cpu.cop0[i.c0dr] = cpu.getGpr(i.rt);
      return ExecutionResult.CONTINUE;
    });
  }
}
