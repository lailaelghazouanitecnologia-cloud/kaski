import type { CpuState } from '../CpuState';
import type { Instruction } from '../instruction/Instruction';
import { ExecutionResult } from './Interpreter';

/**
 * VFPU operation type for unary operations
 */
export type VfpuUnaryOp = (value: number) => number;

/**
 * VFPU operation type for binary operations
 */
export type VfpuBinaryOp = (a: number, b: number) => number;

/**
 * Helper for unary VFPU operations (vs -> vd)
 *
 * @param cpu - CPU state
 * @param instr - Instruction
 * @param op - Operation to apply to each element
 * @returns ExecutionResult.CONTINUE
 */
export function vfpuUnary(
  cpu: CpuState,
  instr: Instruction,
  op: VfpuUnaryOp
): ExecutionResult
{
  const size = instr.oneTwoSize;
  const vs = cpu.readVector(instr.vs, size);
  const result = new Float32Array(size);

  for (let i = 0; i < size; i++)
  {
    result[i] = op(vs[i]);
  }

  cpu.writeVector(instr.vd, size, result);
  return ExecutionResult.CONTINUE;
}

/**
 * Helper for binary VFPU operations (vs, vt -> vd)
 *
 * @param cpu - CPU state
 * @param instr - Instruction
 * @param op - Operation to apply element-wise
 * @returns ExecutionResult.CONTINUE
 */
export function vfpuBinary(
  cpu: CpuState,
  instr: Instruction,
  op: VfpuBinaryOp
): ExecutionResult
{
  const size = instr.oneTwoSize;
  const vs = cpu.readVector(instr.vs, size);
  const vt = cpu.readVector(instr.vt, size);
  const result = new Float32Array(size);

  for (let i = 0; i < size; i++)
  {
    result[i] = op(vs[i], vt[i]);
  }

  cpu.writeVector(instr.vd, size, result);
  return ExecutionResult.CONTINUE;
}

/**
 * Helper for VFPU constant operations (vd = constant)
 *
 * @param cpu - CPU state
 * @param instr - Instruction
 * @param value - Constant value to fill
 * @returns ExecutionResult.CONTINUE
 */
export function vfpuConstant(
  cpu: CpuState,
  instr: Instruction,
  value: number
): ExecutionResult
{
  const size = instr.oneTwoSize;
  const result = new Float32Array(size);
  result.fill(value);
  cpu.writeVector(instr.vd, size, result);
  return ExecutionResult.CONTINUE;
}

/**
 * Helper for VFPU reduction operations (vs -> scalar vd)
 * Applies operation across all elements to produce a single result
 *
 * @param cpu - CPU state
 * @param instr - Instruction
 * @param initial - Initial value for reduction
 * @param op - Operation to combine elements
 * @returns ExecutionResult.CONTINUE
 */
export function vfpuReduce(
  cpu: CpuState,
  instr: Instruction,
  initial: number,
  op: VfpuBinaryOp
): ExecutionResult
{
  const size = instr.oneTwoSize;
  const vs = cpu.readVector(instr.vs, size);

  let result = initial;
  for (let i = 0; i < size; i++)
  {
    result = op(result, vs[i]);
  }

  cpu.writeVector(instr.vd, 1, [result]);
  return ExecutionResult.CONTINUE;
}

/**
 * Helper for VFPU dot product
 *
 * @param cpu - CPU state
 * @param instr - Instruction
 * @returns ExecutionResult.CONTINUE
 */
export function vfpuDot(
  cpu: CpuState,
  instr: Instruction
): ExecutionResult
{
  const size = instr.oneTwoSize;
  const vs = cpu.readVector(instr.vs, size);
  const vt = cpu.readVector(instr.vt, size);

  let dot = 0;
  for (let i = 0; i < size; i++)
  {
    dot += vs[i] * vt[i];
  }

  cpu.writeVector(instr.vd, 1, [dot]);
  return ExecutionResult.CONTINUE;
}

/**
 * Helper for VFPU scale operation (vs * scalar vt -> vd)
 *
 * @param cpu - CPU state
 * @param instr - Instruction
 * @returns ExecutionResult.CONTINUE
 */
export function vfpuScale(
  cpu: CpuState,
  instr: Instruction
): ExecutionResult
{
  const size = instr.oneTwoSize;
  const vs = cpu.readVector(instr.vs, size);
  const scale = cpu.readVector(instr.vt, 1)[0];
  const result = new Float32Array(size);

  for (let i = 0; i < size; i++)
  {
    result[i] = vs[i] * scale;
  }

  cpu.writeVector(instr.vd, size, result);
  return ExecutionResult.CONTINUE;
}

// Common VFPU operations

/** Add operation */
export const vAdd: VfpuBinaryOp = (a, b) => a + b;

/** Subtract operation */
export const vSub: VfpuBinaryOp = (a, b) => a - b;

/** Multiply operation */
export const vMul: VfpuBinaryOp = (a, b) => a * b;

/** Divide operation */
export const vDiv: VfpuBinaryOp = (a, b) => a / b;

/** Min operation */
export const vMin: VfpuBinaryOp = (a, b) => Math.min(a, b);

/** Max operation */
export const vMax: VfpuBinaryOp = (a, b) => Math.max(a, b);

/** Absolute value */
export const vAbs: VfpuUnaryOp = (a) => Math.abs(a);

/** Negate */
export const vNeg: VfpuUnaryOp = (a) => -a;

/** Square root */
export const vSqrt: VfpuUnaryOp = (a) => Math.sqrt(a);

/** Reciprocal */
export const vRcp: VfpuUnaryOp = (a) => 1.0 / a;

/** Reciprocal square root */
export const vRsq: VfpuUnaryOp = (a) => 1.0 / Math.sqrt(a);

/** Sine (cycles: 0-1 = 0-2π) */
export const vSin: VfpuUnaryOp = (a) => Math.sin(a * Math.PI * 2);

/** Cosine (cycles: 0-1 = 0-2π) */
export const vCos: VfpuUnaryOp = (a) => Math.cos(a * Math.PI * 2);

/** Power of 2 */
export const vExp2: VfpuUnaryOp = (a) => Math.pow(2, a);

/** Log base 2 */
export const vLog2: VfpuUnaryOp = (a) => Math.log2(a);

/** Saturate 0-1 */
export const vSat0: VfpuUnaryOp = (a) => Math.max(0, Math.min(1, a));

/** Saturate -1 to 1 */
export const vSat1: VfpuUnaryOp = (a) => Math.max(-1, Math.min(1, a));

/** Identity (for vmov) */
export const vMov: VfpuUnaryOp = (a) => a;
