import type { CpuState } from '../CpuState';
import type { Instruction } from '../instruction/Instruction';
import { ExecutionResult } from './Interpreter';

/**
 * Handler function type
 */
export type Handler = (cpu: CpuState, i: Instruction) => ExecutionResult;

/**
 * Binary operation on two values
 */
type BinaryOp = (a: number, b: number) => number;

/**
 * Unary operation on a value
 */
type UnaryOp = (a: number) => number;

/**
 * Comparison predicate
 */
type Predicate = (a: number, b?: number) => boolean;

// ============================================
// R-Type Arithmetic Factories (rd = rs OP rt)
// ============================================

/**
 * Create R-type handler: rd = op(rs, rt)
 */
export function rType(op: BinaryOp): Handler
{
  return (cpu, i) =>
  {
    cpu.setGpr(i.rd, op(cpu.getGpr(i.rs), cpu.getGpr(i.rt)) | 0);
    return ExecutionResult.CONTINUE;
  };
}

/**
 * Create R-type unsigned handler: rd = op(rs, rt) >>> 0
 */
export function rTypeU(op: BinaryOp): Handler
{
  return (cpu, i) =>
  {
    cpu.setGpr(i.rd, op(cpu.getGprU(i.rs), cpu.getGprU(i.rt)));
    return ExecutionResult.CONTINUE;
  };
}

// ============================================
// I-Type Arithmetic Factories (rt = rs OP imm)
// ============================================

/**
 * Create I-type signed handler: rt = op(rs, imm16)
 */
export function iType(op: BinaryOp): Handler
{
  return (cpu, i) =>
  {
    cpu.setGpr(i.rt, op(cpu.getGpr(i.rs), i.imm16) | 0);
    return ExecutionResult.CONTINUE;
  };
}

/**
 * Create I-type unsigned handler: rt = op(rs, uimm16)
 */
export function iTypeU(op: BinaryOp): Handler
{
  return (cpu, i) =>
  {
    cpu.setGpr(i.rt, op(cpu.getGpr(i.rs), i.uimm16));
    return ExecutionResult.CONTINUE;
  };
}

// ============================================
// Shift Factories
// ============================================

/**
 * Create shift by immediate handler: rd = rt SHIFT sa
 */
export function shiftImm(op: BinaryOp): Handler
{
  return (cpu, i) =>
  {
    cpu.setGpr(i.rd, op(cpu.getGpr(i.rt), i.sa));
    return ExecutionResult.CONTINUE;
  };
}

/**
 * Create shift by register handler: rd = rt SHIFT (rs & 0x1F)
 */
export function shiftReg(op: BinaryOp): Handler
{
  return (cpu, i) =>
  {
    cpu.setGpr(i.rd, op(cpu.getGpr(i.rt), cpu.getGpr(i.rs) & 0x1F));
    return ExecutionResult.CONTINUE;
  };
}

// ============================================
// Comparison Factories
// ============================================

/**
 * Create R-type comparison: rd = (rs CMP rt) ? 1 : 0
 */
export function cmpR(pred: Predicate): Handler
{
  return (cpu, i) =>
  {
    cpu.setGpr(i.rd, pred(cpu.getGpr(i.rs), cpu.getGpr(i.rt)) ? 1 : 0);
    return ExecutionResult.CONTINUE;
  };
}

/**
 * Create R-type unsigned comparison
 */
export function cmpRU(pred: Predicate): Handler
{
  return (cpu, i) =>
  {
    cpu.setGpr(i.rd, pred(cpu.getGprU(i.rs), cpu.getGprU(i.rt)) ? 1 : 0);
    return ExecutionResult.CONTINUE;
  };
}

/**
 * Create I-type comparison: rt = (rs CMP imm) ? 1 : 0
 */
export function cmpI(pred: Predicate): Handler
{
  return (cpu, i) =>
  {
    cpu.setGpr(i.rt, pred(cpu.getGpr(i.rs), i.imm16) ? 1 : 0);
    return ExecutionResult.CONTINUE;
  };
}

/**
 * Create I-type unsigned comparison
 */
export function cmpIU(pred: Predicate): Handler
{
  return (cpu, i) =>
  {
    cpu.setGpr(i.rt, pred(cpu.getGprU(i.rs), (i.imm16 >>> 0)) ? 1 : 0);
    return ExecutionResult.CONTINUE;
  };
}

// ============================================
// Load Factories
// ============================================

type LoadMethod = 'lb' | 'lbu' | 'lh' | 'lhu' | 'lw';

/**
 * Create load handler: rt = memory.method(rs + imm16)
 */
export function load(method: LoadMethod): Handler
{
  return (cpu, i) =>
  {
    const addr = (cpu.getGpr(i.rs) + i.imm16) >>> 0;
    cpu.setGpr(i.rt, cpu.memory[method](addr));
    return ExecutionResult.CONTINUE;
  };
}

/**
 * Create unaligned load handler
 */
export function loadUnaligned(method: 'lwl' | 'lwr'): Handler
{
  return (cpu, i) =>
  {
    const addr = (cpu.getGpr(i.rs) + i.imm16) >>> 0;
    cpu.setGpr(i.rt, cpu.memory[method](addr, cpu.getGpr(i.rt)));
    return ExecutionResult.CONTINUE;
  };
}

// ============================================
// Store Factories
// ============================================

type StoreMethod = 'sb' | 'sh' | 'sw';

/**
 * Create store handler: memory.method(rs + imm16, rt)
 */
export function store(method: StoreMethod): Handler
{
  return (cpu, i) =>
  {
    const addr = (cpu.getGpr(i.rs) + i.imm16) >>> 0;
    cpu.memory[method](addr, cpu.getGpr(i.rt));
    return ExecutionResult.CONTINUE;
  };
}

/**
 * Create unaligned store handler
 */
export function storeUnaligned(method: 'swl' | 'swr'): Handler
{
  return (cpu, i) =>
  {
    const addr = (cpu.getGpr(i.rs) + i.imm16) >>> 0;
    cpu.memory[method](addr, cpu.getGpr(i.rt));
    return ExecutionResult.CONTINUE;
  };
}

// ============================================
// Branch Factories
// ============================================

/**
 * Create branch with delay slot executor
 */
function executeBranch(
  cpu: CpuState,
  target: number,
  execute: (cpu: CpuState, instr: Instruction) => ExecutionResult,
  Instruction: new (pc: number, data: number) => Instruction
): ExecutionResult
{
  const delaySlotPc = (cpu.pc + 4) >>> 0;
  const delayInstr = new Instruction(delaySlotPc, cpu.memory.lw(delaySlotPc));
  execute(cpu, delayInstr);
  cpu.pc = target;
  return ExecutionResult.BRANCH;
}

/**
 * Branch factory context - passed to createBranchHandlers
 */
export interface BranchContext
{
  execute: (cpu: CpuState, instr: Instruction) => ExecutionResult;
  Instruction: new (pc: number, data: number) => Instruction;
}

/**
 * Create conditional branch: if (pred(rs, rt)) branch to target
 */
export function branchRR(
  pred: Predicate,
  ctx: BranchContext
): Handler
{
  return (cpu, i) =>
  {
    if (pred(cpu.getGpr(i.rs), cpu.getGpr(i.rt)))
    {
      return executeBranch(cpu, i.branchTarget, ctx.execute, ctx.Instruction);
    }
    return ExecutionResult.CONTINUE;
  };
}

/**
 * Create conditional branch on rs only: if (pred(rs)) branch
 */
export function branchR(
  pred: (rs: number) => boolean,
  ctx: BranchContext
): Handler
{
  return (cpu, i) =>
  {
    if (pred(cpu.getGpr(i.rs)))
    {
      return executeBranch(cpu, i.branchTarget, ctx.execute, ctx.Instruction);
    }
    return ExecutionResult.CONTINUE;
  };
}

/**
 * Create branch-and-link on rs: ra = pc+8, if (pred(rs)) branch
 */
export function branchLink(
  pred: (rs: number) => boolean,
  ctx: BranchContext
): Handler
{
  return (cpu, i) =>
  {
    cpu.ra = (cpu.pc + 8) >>> 0;
    if (pred(cpu.getGpr(i.rs)))
    {
      return executeBranch(cpu, i.branchTarget, ctx.execute, ctx.Instruction);
    }
    return ExecutionResult.CONTINUE;
  };
}

/**
 * Create likely branch: if (!pred) skip delay slot
 */
export function branchLikely(
  pred: (rs: number, rt?: number) => boolean,
  useRt: boolean,
  ctx: BranchContext
): Handler
{
  return (cpu, i) =>
  {
    const rs = cpu.getGpr(i.rs);
    const rt = useRt ? cpu.getGpr(i.rt) : undefined;
    if (pred(rs, rt))
    {
      return executeBranch(cpu, i.branchTarget, ctx.execute, ctx.Instruction);
    }
    cpu.pc = (cpu.pc + 8) >>> 0; // Skip delay slot
    return ExecutionResult.BRANCH;
  };
}

/**
 * Create likely branch-and-link
 */
export function branchLinkLikely(
  pred: (rs: number) => boolean,
  ctx: BranchContext
): Handler
{
  return (cpu, i) =>
  {
    cpu.ra = (cpu.pc + 8) >>> 0;
    if (pred(cpu.getGpr(i.rs)))
    {
      return executeBranch(cpu, i.branchTarget, ctx.execute, ctx.Instruction);
    }
    cpu.pc = (cpu.pc + 8) >>> 0;
    return ExecutionResult.BRANCH;
  };
}

/**
 * Create jump handler
 */
export function jump(ctx: BranchContext): Handler
{
  return (cpu, i) =>
  {
    return executeBranch(cpu, i.jumpTarget, ctx.execute, ctx.Instruction);
  };
}

/**
 * Create jump-and-link handler
 */
export function jumpLink(ctx: BranchContext): Handler
{
  return (cpu, i) =>
  {
    cpu.ra = (cpu.pc + 8) >>> 0;
    return executeBranch(cpu, i.jumpTarget, ctx.execute, ctx.Instruction);
  };
}

/**
 * Create jump-register handler
 */
export function jumpReg(ctx: BranchContext): Handler
{
  return (cpu, i) =>
  {
    return executeBranch(cpu, cpu.getGprU(i.rs), ctx.execute, ctx.Instruction);
  };
}

/**
 * Create jump-and-link-register handler
 */
export function jumpLinkReg(ctx: BranchContext): Handler
{
  return (cpu, i) =>
  {
    const target = cpu.getGprU(i.rs);
    cpu.setGpr(i.rd, (cpu.pc + 8) >>> 0);
    return executeBranch(cpu, target, ctx.execute, ctx.Instruction);
  };
}

// ============================================
// FPU Factories
// ============================================

/**
 * Create FPU binary: fd = op(fs, ft)
 */
export function fpuBinary(op: BinaryOp): Handler
{
  return (cpu, i) =>
  {
    cpu.fpr[i.fd] = op(cpu.fpr[i.fs], cpu.fpr[i.ft]);
    return ExecutionResult.CONTINUE;
  };
}

/**
 * Create FPU unary: fd = op(fs)
 */
export function fpuUnary(op: UnaryOp): Handler
{
  return (cpu, i) =>
  {
    cpu.fpr[i.fd] = op(cpu.fpr[i.fs]);
    return ExecutionResult.CONTINUE;
  };
}

/**
 * Create FPU comparison: fcr31.cc = (fs CMP ft)
 */
export function fpuCmp(pred: Predicate): Handler
{
  return (cpu, i) =>
  {
    const result = pred(cpu.fpr[i.fs], cpu.fpr[i.ft]);
    cpu.fcr31 = result ? (cpu.fcr31 | 0x800000) : (cpu.fcr31 & ~0x800000);
    return ExecutionResult.CONTINUE;
  };
}

/**
 * Create FPU conversion: fd = op(fs)
 */
export function fpuConvert(op: (v: number) => number, fromInt: boolean = false): Handler
{
  return (cpu, i) =>
  {
    if (fromInt)
    {
      cpu.fpr[i.fd] = op(cpu.fprInt[i.fs]);
    }
    else
    {
      cpu.fprInt[i.fd] = op(cpu.fpr[i.fs]);
    }
    return ExecutionResult.CONTINUE;
  };
}

/**
 * Create FPU branch: if (cc == expected) branch
 */
export function fpuBranch(expected: boolean, ctx: BranchContext): Handler
{
  return (cpu, i) =>
  {
    const cc = (cpu.fcr31 & 0x800000) !== 0;
    if (cc === expected)
    {
      return executeBranch(cpu, i.branchTarget, ctx.execute, ctx.Instruction);
    }
    cpu.pc = (cpu.pc + 4) >>> 0;
    return ExecutionResult.CONTINUE;
  };
}

/**
 * Create FPU likely branch
 */
export function fpuBranchLikely(expected: boolean, ctx: BranchContext): Handler
{
  return (cpu, i) =>
  {
    const cc = (cpu.fcr31 & 0x800000) !== 0;
    if (cc === expected)
    {
      return executeBranch(cpu, i.branchTarget, ctx.execute, ctx.Instruction);
    }
    cpu.pc = (cpu.pc + 8) >>> 0;
    return ExecutionResult.BRANCH;
  };
}

// ============================================
// Common Operations
// ============================================

export const ops = {
  // Arithmetic
  add: (a: number, b: number) => a + b,
  sub: (a: number, b: number) => a - b,

  // Logical
  and: (a: number, b: number) => a & b,
  or: (a: number, b: number) => a | b,
  xor: (a: number, b: number) => a ^ b,
  nor: (a: number, b: number) => ~(a | b),

  // Shifts
  sll: (a: number, b: number) => a << b,
  srl: (a: number, b: number) => a >>> b,
  sra: (a: number, b: number) => a >> b,

  // Comparisons
  lt: (a: number, b?: number) => a < (b ?? 0),
  le: (a: number, b?: number) => a <= (b ?? 0),
  gt: (a: number, b?: number) => a > (b ?? 0),
  ge: (a: number, b?: number) => a >= (b ?? 0),
  eq: (a: number, b?: number) => a === (b ?? 0),
  ne: (a: number, b?: number) => a !== (b ?? 0),

  // FPU
  fadd: (a: number, b: number) => a + b,
  fsub: (a: number, b: number) => a - b,
  fmul: (a: number, b: number) => a * b,
  fdiv: (a: number, b: number) => a / b,
  fsqrt: (a: number) => Math.sqrt(a),
  fabs: (a: number) => Math.abs(a),
  fneg: (a: number) => -a,
};
