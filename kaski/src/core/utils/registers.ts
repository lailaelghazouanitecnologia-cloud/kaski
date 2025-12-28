/**
 * MIPS Register Names and Constants
 */

/**
 * General Purpose Register names
 */
export const GPR_NAMES = [
  'zero', 'at', 'v0', 'v1', 'a0', 'a1', 'a2', 'a3',
  't0', 't1', 't2', 't3', 't4', 't5', 't6', 't7',
  's0', 's1', 's2', 's3', 's4', 's5', 's6', 's7',
  't8', 't9', 'k0', 'k1', 'gp', 'sp', 'fp', 'ra',
] as const;

/**
 * FPU Register names (f0-f31)
 */
export const FPR_NAMES = Array.from(
  { length: 32 },
  (_, i) => `f${i}`
) as readonly string[];

/**
 * COP0 Register names
 */
export const COP0_NAMES = [
  'Index', 'Random', 'EntryLo0', 'EntryLo1',
  'Context', 'PageMask', 'Wired', 'Reserved7',
  'BadVAddr', 'Count', 'EntryHi', 'Compare',
  'Status', 'Cause', 'EPC', 'PRId',
  'Config', 'LLAddr', 'WatchLo', 'WatchHi',
  'Reserved20', 'Reserved21', 'Reserved22', 'Debug',
  'DEPC', 'Reserved25', 'ErrCtl', 'Reserved27',
  'TagLo', 'TagHi', 'ErrorEPC', 'Reserved31',
] as const;

/**
 * MIPS Register Indices
 */
export const enum Register
{
  ZERO = 0,  // Always zero
  AT = 1,    // Assembler temporary
  V0 = 2,    // Function return values
  V1 = 3,
  A0 = 4,    // Function arguments
  A1 = 5,
  A2 = 6,
  A3 = 7,
  T0 = 8,    // Temporaries (caller-saved)
  T1 = 9,
  T2 = 10,
  T3 = 11,
  T4 = 12,
  T5 = 13,
  T6 = 14,
  T7 = 15,
  S0 = 16,   // Saved registers (callee-saved)
  S1 = 17,
  S2 = 18,
  S3 = 19,
  S4 = 20,
  S5 = 21,
  S6 = 22,
  S7 = 23,
  T8 = 24,   // More temporaries
  T9 = 25,
  K0 = 26,   // Kernel registers
  K1 = 27,
  GP = 28,   // Global pointer
  SP = 29,   // Stack pointer
  FP = 30,   // Frame pointer (S8)
  RA = 31,   // Return address
}

/**
 * VFPU Control Register Indices
 */
export const enum VfpuCtrl
{
  SPREFIX = 0,
  TPREFIX = 1,
  DPREFIX = 2,
  CC = 3,
  INF4 = 4,
  RSV5 = 5,
  RSV6 = 6,
  REV = 7,
  RCX0 = 8,
  RCX1 = 9,
  RCX2 = 10,
  RCX3 = 11,
  RCX4 = 12,
  RCX5 = 13,
  RCX6 = 14,
  RCX7 = 15,
}

/**
 * Get GPR name by index
 */
export function getGprName(index: number): string
{
  return GPR_NAMES[index] ?? `r${index}`;
}

/**
 * Get FPR name by index
 */
export function getFprName(index: number): string
{
  return FPR_NAMES[index] ?? `f${index}`;
}

/**
 * Get COP0 register name by index
 */
export function getCop0Name(index: number): string
{
  return COP0_NAMES[index] ?? `c0r${index}`;
}

/**
 * Get VFPU register name
 *
 * @param reg - Register index (0-127)
 * @param size - Vector size (1, 2, 3, or 4)
 * @returns Register name like "S000" or "C000"
 */
export function getVfpuName(reg: number, size: number = 1): string
{
  const matrix = (reg >> 2) & 7;
  const column = reg & 3;
  const row = (reg >> 5) & 3;
  const transpose = (reg & 0x20) !== 0;

  const prefix = ['S', 'C', 'C', 'C'][size - 1] ?? 'V';
  const suffix = transpose ? 'T' : '';

  return `${prefix}${matrix}${row}${column}${suffix}`;
}
