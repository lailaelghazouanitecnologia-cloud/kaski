import { Instruction } from './Instruction';
import { InstructionTable } from './InstructionTable';
import type { InstructionType } from './InstructionType';
import type { CpuState } from './CpuState';

/**
 * Generated function result
 */
export interface GeneratedFunction
{
  /** Compiled JavaScript function */
  func: (state: CpuState) => number;
  /** Start address of the block */
  startPc: number;
  /** End address of the block */
  endPc: number;
  /** Number of instructions in the block */
  instructionCount: number;
}

/**
 * Block termination type
 */
const enum BlockEnd
{
  /** Block continues to next instruction */
  CONTINUE = 0,
  /** Block ends with unconditional jump */
  JUMP = 1,
  /** Block ends with conditional branch */
  BRANCH = 2,
  /** Block ends with syscall/break */
  SYSTEM = 3,
}

/**
 * Code Generator - Compiles MIPS basic blocks to JavaScript functions
 *
 * This is a simple JIT that generates string-based JavaScript code
 * and uses `new Function()` to compile it at runtime.
 */
export class CodeGenerator
{
  private table: InstructionTable;

  constructor()
  {
    this.table = InstructionTable.instance;
  }

  /**
   * Generate a compiled function for a basic block starting at the given PC
   *
   * @param readWord - Function to read instruction words from memory
   * @param startPc - Starting program counter
   * @param maxInstructions - Maximum instructions to compile (default: 100)
   * @returns Generated function info or null if compilation fails
   */
  generate(
    readWord: (addr: number) => number,
    startPc: number,
    maxInstructions: number = 100
  ): GeneratedFunction | null
  {
    const instructions: { pc: number; data: number; type: InstructionType }[] = [];
    let pc = startPc;
    let blockEnd = BlockEnd.CONTINUE;

    // Collect instructions until we hit a block terminator
    for (let i = 0; i < maxInstructions; i++)
    {
      const data = readWord(pc);
      const type = this.table.find(data);

      if (!type)
      {
        // Unknown instruction - stop here
        break;
      }

      instructions.push({ pc, data, type });

      // Check for block-ending instructions
      if (type.isSyscall || type.isBreak)
      {
        blockEnd = BlockEnd.SYSTEM;
        break;
      }

      if (type.isJumpNoLink && !type.isRegister)
      {
        // Unconditional jump (j) - include delay slot
        const delayData = readWord(pc + 4);
        const delayType = this.table.find(delayData);
        if (delayType)
        {
          instructions.push({ pc: pc + 4, data: delayData, type: delayType });
        }
        blockEnd = BlockEnd.JUMP;
        break;
      }

      if (type.isJump || type.isBranch)
      {
        // Jump or branch - include delay slot
        const delayData = readWord(pc + 4);
        const delayType = this.table.find(delayData);
        if (delayType)
        {
          instructions.push({ pc: pc + 4, data: delayData, type: delayType });
        }
        blockEnd = BlockEnd.BRANCH;
        break;
      }

      pc += 4;
    }

    if (instructions.length === 0)
    {
      return null;
    }

    // Generate the code
    const code = this.generateCode(instructions, blockEnd);
    const endPc = instructions[instructions.length - 1].pc + 4;

    try
    {
      // Compile the function
      // The function takes a CpuState and returns the next PC to execute
      const func = new Function('state', code) as (state: CpuState) => number;

      return {
        func,
        startPc,
        endPc,
        instructionCount: instructions.length,
      };
    }
    catch (e)
    {
      console.error('JIT compilation failed:', e);
      console.error('Generated code:', code);
      return null;
    }
  }

  /**
   * Generate JavaScript code for a list of instructions
   */
  private generateCode(
    instructions: { pc: number; data: number; type: InstructionType }[],
    blockEnd: BlockEnd
  ): string
  {
    const lines: string[] = [];

    // Prologue - extract commonly used state
    lines.push(`"use strict";`);
    lines.push(`const gpr = state.gpr;`);
    lines.push(`const fpr = state.fpr;`);
    lines.push(`const memory = state.memory;`);
    lines.push(`let branchTarget = 0;`);
    lines.push(`let takeBranch = false;`);
    lines.push(``);

    // Generate code for each instruction
    for (let i = 0; i < instructions.length; i++)
    {
      const { pc, data, type } = instructions[i];
      const instr = new Instruction(pc, data);
      const isDelaySlot = i === instructions.length - 1 && blockEnd !== BlockEnd.CONTINUE;

      // Add comment with instruction info
      lines.push(`// 0x${pc.toString(16).padStart(8, '0')}: ${type.name}`);

      // Generate the instruction code
      const instrCode = this.generateInstruction(instr, type, isDelaySlot);
      if (instrCode)
      {
        lines.push(instrCode);
      }
      lines.push(``);
    }

    // Epilogue - return next PC
    const lastInstr = instructions[instructions.length - 1];

    if (blockEnd === BlockEnd.SYSTEM)
    {
      // Syscall or break - return current PC
      lines.push(`state.pc = 0x${lastInstr.pc.toString(16)};`);
      lines.push(`return -1; // System call`);
    }
    else if (blockEnd === BlockEnd.JUMP || blockEnd === BlockEnd.BRANCH)
    {
      lines.push(`if (takeBranch) {`);
      lines.push(`  state.pc = branchTarget >>> 0;`);
      lines.push(`  return branchTarget >>> 0;`);
      lines.push(`} else {`);
      lines.push(`  state.pc = 0x${(lastInstr.pc + 4).toString(16)};`);
      lines.push(`  return 0x${(lastInstr.pc + 4).toString(16)};`);
      lines.push(`}`);
    }
    else
    {
      // Continue to next instruction
      lines.push(`state.pc = 0x${(lastInstr.pc + 4).toString(16)};`);
      lines.push(`return 0x${(lastInstr.pc + 4).toString(16)};`);
    }

    return lines.join('\n');
  }

  /**
   * Generate JavaScript code for a single instruction
   */
  private generateInstruction(instr: Instruction, type: InstructionType, isDelaySlot: boolean): string
  {
    const name = type.name;

    // Generate based on instruction name
    switch (name)
    {
      // ============================================
      // Arithmetic
      // ============================================
      case 'add':
      case 'addu':
        return this.genR(`gpr[${instr.rd}] = (gpr[${instr.rs}] + gpr[${instr.rt}]) | 0;`, instr.rd);

      case 'addi':
      case 'addiu':
        return this.genR(`gpr[${instr.rt}] = (gpr[${instr.rs}] + ${instr.imm16}) | 0;`, instr.rt);

      case 'sub':
      case 'subu':
        return this.genR(`gpr[${instr.rd}] = (gpr[${instr.rs}] - gpr[${instr.rt}]) | 0;`, instr.rd);

      case 'lui':
        return this.genR(`gpr[${instr.rt}] = ${instr.uimm16 << 16};`, instr.rt);

      // ============================================
      // Logical
      // ============================================
      case 'and':
        return this.genR(`gpr[${instr.rd}] = gpr[${instr.rs}] & gpr[${instr.rt}];`, instr.rd);

      case 'andi':
        return this.genR(`gpr[${instr.rt}] = gpr[${instr.rs}] & ${instr.uimm16};`, instr.rt);

      case 'or':
        return this.genR(`gpr[${instr.rd}] = gpr[${instr.rs}] | gpr[${instr.rt}];`, instr.rd);

      case 'ori':
        return this.genR(`gpr[${instr.rt}] = gpr[${instr.rs}] | ${instr.uimm16};`, instr.rt);

      case 'xor':
        return this.genR(`gpr[${instr.rd}] = gpr[${instr.rs}] ^ gpr[${instr.rt}];`, instr.rd);

      case 'xori':
        return this.genR(`gpr[${instr.rt}] = gpr[${instr.rs}] ^ ${instr.uimm16};`, instr.rt);

      case 'nor':
        return this.genR(`gpr[${instr.rd}] = ~(gpr[${instr.rs}] | gpr[${instr.rt}]);`, instr.rd);

      // ============================================
      // Shift
      // ============================================
      case 'sll':
        if (instr.data === 0) return ''; // NOP
        return this.genR(`gpr[${instr.rd}] = gpr[${instr.rt}] << ${instr.sa};`, instr.rd);

      case 'srl':
        return this.genR(`gpr[${instr.rd}] = gpr[${instr.rt}] >>> ${instr.sa};`, instr.rd);

      case 'sra':
        return this.genR(`gpr[${instr.rd}] = gpr[${instr.rt}] >> ${instr.sa};`, instr.rd);

      case 'sllv':
        return this.genR(`gpr[${instr.rd}] = gpr[${instr.rt}] << (gpr[${instr.rs}] & 31);`, instr.rd);

      case 'srlv':
        return this.genR(`gpr[${instr.rd}] = gpr[${instr.rt}] >>> (gpr[${instr.rs}] & 31);`, instr.rd);

      case 'srav':
        return this.genR(`gpr[${instr.rd}] = gpr[${instr.rt}] >> (gpr[${instr.rs}] & 31);`, instr.rd);

      // ============================================
      // Compare
      // ============================================
      case 'slt':
        return this.genR(`gpr[${instr.rd}] = (gpr[${instr.rs}] < gpr[${instr.rt}]) ? 1 : 0;`, instr.rd);

      case 'sltu':
        return this.genR(`gpr[${instr.rd}] = ((gpr[${instr.rs}] >>> 0) < (gpr[${instr.rt}] >>> 0)) ? 1 : 0;`, instr.rd);

      case 'slti':
        return this.genR(`gpr[${instr.rt}] = (gpr[${instr.rs}] < ${instr.imm16}) ? 1 : 0;`, instr.rt);

      case 'sltiu':
        return this.genR(`gpr[${instr.rt}] = ((gpr[${instr.rs}] >>> 0) < ${(instr.imm16 << 16 >> 16) >>> 0}) ? 1 : 0;`, instr.rt);

      // ============================================
      // Multiply/Divide
      // ============================================
      case 'mult':
        return `{ const r = BigInt(gpr[${instr.rs}]) * BigInt(gpr[${instr.rt}]); state.lo = Number(r & 0xFFFFFFFFn); state.hi = Number(r >> 32n); }`;

      case 'multu':
        return `{ const r = BigInt(gpr[${instr.rs}] >>> 0) * BigInt(gpr[${instr.rt}] >>> 0); state.lo = Number(r & 0xFFFFFFFFn); state.hi = Number(r >> 32n); }`;

      case 'div':
        return `if (gpr[${instr.rt}] !== 0) { state.lo = (gpr[${instr.rs}] / gpr[${instr.rt}]) | 0; state.hi = (gpr[${instr.rs}] % gpr[${instr.rt}]) | 0; }`;

      case 'divu':
        return `if (gpr[${instr.rt}] !== 0) { state.lo = ((gpr[${instr.rs}] >>> 0) / (gpr[${instr.rt}] >>> 0)) >>> 0; state.hi = ((gpr[${instr.rs}] >>> 0) % (gpr[${instr.rt}] >>> 0)) >>> 0; }`;

      case 'mfhi':
        return this.genR(`gpr[${instr.rd}] = state.hi;`, instr.rd);

      case 'mflo':
        return this.genR(`gpr[${instr.rd}] = state.lo;`, instr.rd);

      case 'mthi':
        return `state.hi = gpr[${instr.rs}];`;

      case 'mtlo':
        return `state.lo = gpr[${instr.rs}];`;

      // ============================================
      // Load/Store
      // ============================================
      case 'lw':
        return this.genR(`gpr[${instr.rt}] = memory.lw((gpr[${instr.rs}] + ${instr.imm16}) >>> 0);`, instr.rt);

      case 'lh':
        return this.genR(`gpr[${instr.rt}] = memory.lh((gpr[${instr.rs}] + ${instr.imm16}) >>> 0);`, instr.rt);

      case 'lhu':
        return this.genR(`gpr[${instr.rt}] = memory.lhu((gpr[${instr.rs}] + ${instr.imm16}) >>> 0);`, instr.rt);

      case 'lb':
        return this.genR(`gpr[${instr.rt}] = memory.lb((gpr[${instr.rs}] + ${instr.imm16}) >>> 0);`, instr.rt);

      case 'lbu':
        return this.genR(`gpr[${instr.rt}] = memory.lbu((gpr[${instr.rs}] + ${instr.imm16}) >>> 0);`, instr.rt);

      case 'sw':
        return `memory.sw((gpr[${instr.rs}] + ${instr.imm16}) >>> 0, gpr[${instr.rt}]);`;

      case 'sh':
        return `memory.sh((gpr[${instr.rs}] + ${instr.imm16}) >>> 0, gpr[${instr.rt}]);`;

      case 'sb':
        return `memory.sb((gpr[${instr.rs}] + ${instr.imm16}) >>> 0, gpr[${instr.rt}]);`;

      // ============================================
      // Branch
      // ============================================
      case 'beq':
        return `if (gpr[${instr.rs}] === gpr[${instr.rt}]) { takeBranch = true; branchTarget = 0x${instr.branchTarget.toString(16)}; }`;

      case 'bne':
        return `if (gpr[${instr.rs}] !== gpr[${instr.rt}]) { takeBranch = true; branchTarget = 0x${instr.branchTarget.toString(16)}; }`;

      case 'bgtz':
        return `if (gpr[${instr.rs}] > 0) { takeBranch = true; branchTarget = 0x${instr.branchTarget.toString(16)}; }`;

      case 'blez':
        return `if (gpr[${instr.rs}] <= 0) { takeBranch = true; branchTarget = 0x${instr.branchTarget.toString(16)}; }`;

      case 'bgez':
        return `if (gpr[${instr.rs}] >= 0) { takeBranch = true; branchTarget = 0x${instr.branchTarget.toString(16)}; }`;

      case 'bltz':
        return `if (gpr[${instr.rs}] < 0) { takeBranch = true; branchTarget = 0x${instr.branchTarget.toString(16)}; }`;

      case 'bgezal':
        return `gpr[31] = 0x${(instr.pc + 8).toString(16)}; if (gpr[${instr.rs}] >= 0) { takeBranch = true; branchTarget = 0x${instr.branchTarget.toString(16)}; }`;

      case 'bltzal':
        return `gpr[31] = 0x${(instr.pc + 8).toString(16)}; if (gpr[${instr.rs}] < 0) { takeBranch = true; branchTarget = 0x${instr.branchTarget.toString(16)}; }`;

      // ============================================
      // Jump
      // ============================================
      case 'j':
        return `takeBranch = true; branchTarget = 0x${instr.jumpTarget.toString(16)};`;

      case 'jal':
        return `gpr[31] = 0x${(instr.pc + 8).toString(16)}; takeBranch = true; branchTarget = 0x${instr.jumpTarget.toString(16)};`;

      case 'jr':
        return `takeBranch = true; branchTarget = gpr[${instr.rs}] >>> 0;`;

      case 'jalr':
        return `{ const target = gpr[${instr.rs}] >>> 0; gpr[${instr.rd !== 0 ? instr.rd : 31}] = 0x${(instr.pc + 8).toString(16)}; takeBranch = true; branchTarget = target; }`;

      // ============================================
      // System
      // ============================================
      case 'syscall':
        return `return -1; // SYSCALL`;

      case 'break':
        return `return -2; // BREAK`;

      case 'nop':
      case 'sync':
        return '';

      // ============================================
      // Fallback to interpreter
      // ============================================
      default:
        return `state.pc = 0x${instr.pc.toString(16)}; throw new Error('JIT: unimplemented ${name}');`;
    }
  }

  /**
   * Generate code that skips write to R0
   */
  private genR(code: string, rd: number): string
  {
    if (rd === 0) return ''; // Writes to R0 are ignored
    return code;
  }
}
