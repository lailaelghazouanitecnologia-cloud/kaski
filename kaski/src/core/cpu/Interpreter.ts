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
import {
  type Handler, type BranchContext,
  rType, iType, iTypeU, shiftImm, shiftReg,
  cmpR, cmpRU, cmpI, cmpIU,
  load, loadUnaligned, store, storeUnaligned,
  branchRR, branchR, branchLink, branchLikely, branchLinkLikely,
  jump, jumpLink, jumpReg, jumpLinkReg,
  fpuBinary, fpuUnary, fpuCmp, fpuConvert, fpuBranch, fpuBranchLikely,
  ops,
} from './HandlerFactories';
import { BitUtils } from '../utils';

/**
 * Execution result
 */
export const enum ExecutionResult {
  CONTINUE = 0,
  BRANCH = 1,
  SYSCALL = 2,
  BREAK = 3,
  UNKNOWN = 4,
}

/**
 * MIPS Interpreter
 */
export class Interpreter {
  private table: InstructionTable;
  private handlers: Map<string, Handler>;

  constructor()
  {
    this.table = InstructionTable.instance;
    this.handlers = new Map();

    const ctx: BranchContext = {
      execute: this.execute.bind(this),
      Instruction,
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

  execute(cpu: CpuState, instr: Instruction): ExecutionResult
  {
    const type = this.table.find(instr.data);
    if (!type)
    {
      console.warn(`Unknown instruction at 0x${instr.pc.toString(16)}: 0x${instr.data.toString(16)}`);
      return ExecutionResult.UNKNOWN;
    }

    const handler = this.handlers.get(type.name);
    if (!handler)
    {
      console.warn(`Unimplemented instruction: ${type.name}`);
      return ExecutionResult.UNKNOWN;
    }

    return handler(cpu, instr);
  }

  step(cpu: CpuState): ExecutionResult
  {
    const instr = Instruction.fromMemory(cpu.memory, cpu.pc);
    const result = this.execute(cpu, instr);

    if (result === ExecutionResult.CONTINUE)
    {
      cpu.pc = (cpu.pc + 4) >>> 0;
    }

    return result;
  }

  run(cpu: CpuState, maxInstructions: number = 1000): ExecutionResult
  {
    for (let i = 0; i < maxInstructions; i++)
    {
      const result = this.step(cpu);
      if (result !== ExecutionResult.CONTINUE && result !== ExecutionResult.BRANCH)
      {
        return result;
      }
    }
    return ExecutionResult.CONTINUE;
  }

  // ============================================
  // Registration using factories
  // ============================================

  private registerArithmetic(): void
  {
    // R-type: rd = rs OP rt
    this.handlers.set('add', rType(ops.add));
    this.handlers.set('addu', rType(ops.add));
    this.handlers.set('sub', rType(ops.sub));
    this.handlers.set('subu', rType(ops.sub));

    // I-type: rt = rs OP imm
    this.handlers.set('addi', iType(ops.add));
    this.handlers.set('addiu', iType(ops.add));

    // LUI: rt = imm << 16
    this.handlers.set('lui', (cpu, i) =>
    {
      cpu.setGpr(i.rt, i.uimm16 << 16);
      return ExecutionResult.CONTINUE;
    });
  }

  private registerLogical(): void
  {
    // R-type logical
    this.handlers.set('and', rType(ops.and));
    this.handlers.set('or', rType(ops.or));
    this.handlers.set('xor', rType(ops.xor));
    this.handlers.set('nor', rType(ops.nor));

    // I-type logical (unsigned immediate)
    this.handlers.set('andi', iTypeU(ops.and));
    this.handlers.set('ori', iTypeU(ops.or));
    this.handlers.set('xori', iTypeU(ops.xor));
  }

  private registerShifts(): void
  {
    // Shift by immediate
    this.handlers.set('sll', shiftImm(ops.sll));
    this.handlers.set('srl', shiftImm(ops.srl));
    this.handlers.set('sra', shiftImm(ops.sra));

    // Shift by register
    this.handlers.set('sllv', shiftReg(ops.sll));
    this.handlers.set('srlv', shiftReg(ops.srl));
    this.handlers.set('srav', shiftReg(ops.sra));

    // Rotate
    this.handlers.set('rotr', (cpu, i) =>
    {
      cpu.setGpr(i.rd, BitUtils.rotr(cpu.getGpr(i.rt), i.sa));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('rotrv', (cpu, i) =>
    {
      cpu.setGpr(i.rd, BitUtils.rotr(cpu.getGpr(i.rt), cpu.getGpr(i.rs)));
      return ExecutionResult.CONTINUE;
    });
  }

  private registerComparisons(): void
  {
    this.handlers.set('slt', cmpR(ops.lt));
    this.handlers.set('sltu', cmpRU(ops.lt));
    this.handlers.set('slti', cmpI(ops.lt));
    this.handlers.set('sltiu', cmpIU(ops.lt));
  }

  private registerMultDiv(): void
  {
    // Multiply signed
    this.handlers.set('mult', (cpu, i) =>
    {
      const result = BigInt(cpu.getGpr(i.rs)) * BigInt(cpu.getGpr(i.rt));
      cpu.lo = Number(result & 0xFFFFFFFFn) | 0;
      cpu.hi = Number((result >> 32n) & 0xFFFFFFFFn) | 0;
      return ExecutionResult.CONTINUE;
    });

    // Multiply unsigned
    this.handlers.set('multu', (cpu, i) =>
    {
      const result = BigInt(cpu.getGprU(i.rs)) * BigInt(cpu.getGprU(i.rt));
      cpu.lo = Number(result & 0xFFFFFFFFn) | 0;
      cpu.hi = Number((result >> 32n) & 0xFFFFFFFFn) | 0;
      return ExecutionResult.CONTINUE;
    });

    // Divide signed
    this.handlers.set('div', (cpu, i) =>
    {
      const rt = cpu.getGpr(i.rt);
      if (rt !== 0)
      {
        const rs = cpu.getGpr(i.rs);
        cpu.lo = (rs / rt) | 0;
        cpu.hi = (rs % rt) | 0;
      }
      return ExecutionResult.CONTINUE;
    });

    // Divide unsigned
    this.handlers.set('divu', (cpu, i) =>
    {
      const rt = cpu.getGprU(i.rt);
      if (rt !== 0)
      {
        const rs = cpu.getGprU(i.rs);
        cpu.lo = (rs / rt) >>> 0;
        cpu.hi = (rs % rt) >>> 0;
      }
      return ExecutionResult.CONTINUE;
    });

    // Move from/to HI/LO
    this.handlers.set('mfhi', (cpu, i) => { cpu.setGpr(i.rd, cpu.hi); return ExecutionResult.CONTINUE; });
    this.handlers.set('mflo', (cpu, i) => { cpu.setGpr(i.rd, cpu.lo); return ExecutionResult.CONTINUE; });
    this.handlers.set('mthi', (cpu, i) => { cpu.hi = cpu.getGpr(i.rs); return ExecutionResult.CONTINUE; });
    this.handlers.set('mtlo', (cpu, i) => { cpu.lo = cpu.getGpr(i.rs); return ExecutionResult.CONTINUE; });
  }

  private registerLoadStore(): void
  {
    // Loads
    this.handlers.set('lb', load('lb'));
    this.handlers.set('lbu', load('lbu'));
    this.handlers.set('lh', load('lh'));
    this.handlers.set('lhu', load('lhu'));
    this.handlers.set('lw', load('lw'));
    this.handlers.set('lwl', loadUnaligned('lwl'));
    this.handlers.set('lwr', loadUnaligned('lwr'));

    // Stores
    this.handlers.set('sb', store('sb'));
    this.handlers.set('sh', store('sh'));
    this.handlers.set('sw', store('sw'));
    this.handlers.set('swl', storeUnaligned('swl'));
    this.handlers.set('swr', storeUnaligned('swr'));
  }

  private registerBranches(ctx: BranchContext): void
  {
    // Conditional branches (rs, rt)
    this.handlers.set('beq', branchRR(ops.eq, ctx));
    this.handlers.set('bne', branchRR(ops.ne, ctx));

    // Conditional branches (rs only)
    this.handlers.set('bgez', branchR(rs => rs >= 0, ctx));
    this.handlers.set('bgtz', branchR(rs => rs > 0, ctx));
    this.handlers.set('blez', branchR(rs => rs <= 0, ctx));
    this.handlers.set('bltz', branchR(rs => rs < 0, ctx));

    // Branch and link
    this.handlers.set('bgezal', branchLink(rs => rs >= 0, ctx));
    this.handlers.set('bltzal', branchLink(rs => rs < 0, ctx));

    // Likely branches (skip delay slot if not taken)
    this.handlers.set('beql', branchLikely((rs, rt) => rs === rt, true, ctx));
    this.handlers.set('bnel', branchLikely((rs, rt) => rs !== rt, true, ctx));
    this.handlers.set('bgtzl', branchLikely(rs => rs > 0, false, ctx));
    this.handlers.set('blezl', branchLikely(rs => rs <= 0, false, ctx));
    this.handlers.set('bgezl', branchLikely(rs => rs >= 0, false, ctx));
    this.handlers.set('bltzl', branchLikely(rs => rs < 0, false, ctx));
    this.handlers.set('bgezall', branchLinkLikely(rs => rs >= 0, ctx));
    this.handlers.set('bltzall', branchLinkLikely(rs => rs < 0, ctx));
  }

  private registerJumps(ctx: BranchContext): void
  {
    this.handlers.set('j', jump(ctx));
    this.handlers.set('jal', jumpLink(ctx));
    this.handlers.set('jr', jumpReg(ctx));
    this.handlers.set('jalr', jumpLinkReg(ctx));
  }

  private registerSystem(): void
  {
    this.handlers.set('syscall', () => ExecutionResult.SYSCALL);
    this.handlers.set('break', () => ExecutionResult.BREAK);
    this.handlers.set('sync', () => ExecutionResult.CONTINUE);
    this.handlers.set('nop', () => ExecutionResult.CONTINUE);
  }

  private registerBitOps(): void
  {
    // Conditional moves
    this.handlers.set('movz', (cpu, i) =>
    {
      if (cpu.getGpr(i.rt) === 0) cpu.setGpr(i.rd, cpu.getGpr(i.rs));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('movn', (cpu, i) =>
    {
      if (cpu.getGpr(i.rt) !== 0) cpu.setGpr(i.rd, cpu.getGpr(i.rs));
      return ExecutionResult.CONTINUE;
    });

    // Sign extend
    this.handlers.set('seb', (cpu, i) => { cpu.setGpr(i.rd, BitUtils.seb(cpu.getGpr(i.rt))); return ExecutionResult.CONTINUE; });
    this.handlers.set('seh', (cpu, i) => { cpu.setGpr(i.rd, BitUtils.seh(cpu.getGpr(i.rt))); return ExecutionResult.CONTINUE; });

    // Bit field extract/insert
    this.handlers.set('ext', (cpu, i) =>
    {
      cpu.setGpr(i.rt, BitUtils.extract(cpu.getGprU(i.rs), i.lsb, i.msb + 1));
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('ins', (cpu, i) =>
    {
      const size = i.msb - i.lsb + 1;
      cpu.setGpr(i.rt, BitUtils.insert(cpu.getGprU(i.rt), i.lsb, size, cpu.getGprU(i.rs)));
      return ExecutionResult.CONTINUE;
    });

    // Count leading zeros/ones
    this.handlers.set('clz', (cpu, i) => { cpu.setGpr(i.rd, BitUtils.clz(cpu.getGprU(i.rs))); return ExecutionResult.CONTINUE; });
    this.handlers.set('clo', (cpu, i) => { cpu.setGpr(i.rd, BitUtils.clo(cpu.getGprU(i.rs))); return ExecutionResult.CONTINUE; });

    // Min/Max
    this.handlers.set('max', (cpu, i) => { cpu.setGpr(i.rd, Math.max(cpu.getGpr(i.rs), cpu.getGpr(i.rt))); return ExecutionResult.CONTINUE; });
    this.handlers.set('min', (cpu, i) => { cpu.setGpr(i.rd, Math.min(cpu.getGpr(i.rs), cpu.getGpr(i.rt))); return ExecutionResult.CONTINUE; });

    // Byte swap
    this.handlers.set('wsbh', (cpu, i) => { cpu.setGpr(i.rd, BitUtils.wsbh(cpu.getGprU(i.rt))); return ExecutionResult.CONTINUE; });
    this.handlers.set('wsbw', (cpu, i) => { cpu.setGpr(i.rd, BitUtils.wsbw(cpu.getGprU(i.rt))); return ExecutionResult.CONTINUE; });
    this.handlers.set('bitrev', (cpu, i) => { cpu.setGpr(i.rd, BitUtils.bitrev(cpu.getGprU(i.rt))); return ExecutionResult.CONTINUE; });
  }

  private registerFpu(ctx: BranchContext): void
  {
    // Move operations
    this.handlers.set('mfc1', (cpu, i) => { cpu.setGpr(i.rt, cpu.fprInt[i.fs]); return ExecutionResult.CONTINUE; });
    this.handlers.set('mtc1', (cpu, i) => { cpu.fprInt[i.fs] = cpu.getGpr(i.rt); return ExecutionResult.CONTINUE; });
    this.handlers.set('cfc1', (cpu, i) =>
    {
      cpu.setGpr(i.rt, i.fs === 0 ? cpu.fcr0 : i.fs === 31 ? cpu.fcr31 : 0);
      return ExecutionResult.CONTINUE;
    });
    this.handlers.set('ctc1', (cpu, i) =>
    {
      if (i.fs === 31) cpu.fcr31 = cpu.getGpr(i.rt);
      return ExecutionResult.CONTINUE;
    });

    // Arithmetic
    this.handlers.set('add.s', fpuBinary(ops.fadd));
    this.handlers.set('sub.s', fpuBinary(ops.fsub));
    this.handlers.set('mul.s', fpuBinary(ops.fmul));
    this.handlers.set('div.s', fpuBinary(ops.fdiv));
    this.handlers.set('sqrt.s', fpuUnary(ops.fsqrt));
    this.handlers.set('abs.s', fpuUnary(ops.fabs));
    this.handlers.set('neg.s', fpuUnary(ops.fneg));
    this.handlers.set('mov.s', fpuUnary(v => v));

    // Conversion
    this.handlers.set('trunc.w.s', fpuConvert(Math.trunc));
    this.handlers.set('round.w.s', fpuConvert(Math.round));
    this.handlers.set('ceil.w.s', fpuConvert(Math.ceil));
    this.handlers.set('floor.w.s', fpuConvert(Math.floor));
    this.handlers.set('cvt.w.s', fpuConvert(Math.trunc));
    this.handlers.set('cvt.s.w', fpuConvert(v => v, true));

    // Comparison
    this.handlers.set('c.eq.s', fpuCmp(ops.eq));
    this.handlers.set('c.lt.s', fpuCmp(ops.lt));
    this.handlers.set('c.le.s', fpuCmp(ops.le));

    // Branch
    this.handlers.set('bc1f', fpuBranch(false, ctx));
    this.handlers.set('bc1t', fpuBranch(true, ctx));
    this.handlers.set('bc1fl', fpuBranchLikely(false, ctx));
    this.handlers.set('bc1tl', fpuBranchLikely(true, ctx));

    // Load/Store
    this.handlers.set('lwc1', (cpu, i) =>
    {
      cpu.fprInt[i.ft] = cpu.memory.lw((cpu.getGpr(i.rs) + i.imm16) >>> 0);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('swc1', (cpu, i) =>
    {
      cpu.memory.sw((cpu.getGpr(i.rs) + i.imm16) >>> 0, cpu.fprInt[i.ft]);
      return ExecutionResult.CONTINUE;
    });
  }

  private registerVfpu(): void
  {
    // Binary operations
    this.handlers.set('vadd', (cpu, i) => vfpuBinary(cpu, i, vAdd));
    this.handlers.set('vsub', (cpu, i) => vfpuBinary(cpu, i, vSub));
    this.handlers.set('vmul', (cpu, i) => vfpuBinary(cpu, i, vMul));
    this.handlers.set('vdiv', (cpu, i) => vfpuBinary(cpu, i, vDiv));
    this.handlers.set('vmin', (cpu, i) => vfpuBinary(cpu, i, vMin));
    this.handlers.set('vmax', (cpu, i) => vfpuBinary(cpu, i, vMax));

    // Unary operations
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

    // Special
    this.handlers.set('vdot', (cpu, i) => vfpuDot(cpu, i));
    this.handlers.set('vscl', (cpu, i) => vfpuScale(cpu, i));

    // Move to/from GPR
    this.handlers.set('mfv', (cpu, i) =>
    {
      const regs = cpu.getVectorRegs(i.vs, 1);
      const buf = new Float32Array(1);
      buf[0] = cpu.vfpr[regs[0]];
      cpu.setGpr(i.rt, new Int32Array(buf.buffer)[0]);
      return ExecutionResult.CONTINUE;
    });

    this.handlers.set('mtv', (cpu, i) =>
    {
      const regs = cpu.getVectorRegs(i.vd, 1);
      const buf = new Int32Array(1);
      buf[0] = cpu.getGpr(i.rt);
      cpu.vfpr[regs[0]] = new Float32Array(buf.buffer)[0];
      return ExecutionResult.CONTINUE;
    });
  }

  private registerExtended(): void
  {
    // Multiply-accumulate helper
    const macc = (cpu: CpuState, i: Instruction, signed: boolean, add: boolean): ExecutionResult =>
    {
      const rs = signed ? BigInt(cpu.getGpr(i.rs)) : BigInt(cpu.getGprU(i.rs));
      const rt = signed ? BigInt(cpu.getGpr(i.rt)) : BigInt(cpu.getGprU(i.rt));
      const hilo = (BigInt(signed ? cpu.hi : cpu.hi >>> 0) << 32n) | BigInt(cpu.lo >>> 0);
      const result = add ? hilo + rs * rt : hilo - rs * rt;
      cpu.lo = Number(result & 0xFFFFFFFFn) | 0;
      cpu.hi = Number((result >> 32n) & 0xFFFFFFFFn) | 0;
      return ExecutionResult.CONTINUE;
    };

    this.handlers.set('madd', (cpu, i) => macc(cpu, i, true, true));
    this.handlers.set('maddu', (cpu, i) => macc(cpu, i, false, true));
    this.handlers.set('msub', (cpu, i) => macc(cpu, i, true, false));
    this.handlers.set('msubu', (cpu, i) => macc(cpu, i, false, false));

    // COP0
    this.handlers.set('mfc0', (cpu, i) => { cpu.setGpr(i.rt, cpu.cop0[i.c0dr]); return ExecutionResult.CONTINUE; });
    this.handlers.set('mtc0', (cpu, i) => { cpu.cop0[i.c0dr] = cpu.getGpr(i.rt); return ExecutionResult.CONTINUE; });
  }
}
