/**
 * Function Compiler - Compiles MIPS functions to JavaScript
 *
 * Uses AST builder for code generation and Relooper for control flow.
 * This produces optimized JavaScript for entire functions, not just
 * basic blocks.
 */

import { Instruction } from '../instruction/Instruction';
import { InstructionTable } from '../instruction/InstructionTable';
import type { InstructionType } from '../instruction/InstructionType';
import type { CpuState } from '../CpuState';
import { Relooper, RelooperBlock } from './Relooper';
import { MipsAstBuilder, type Stmt, Block } from './ast';

/**
 * Compiled function
 */
export interface CompiledFunction
{
  /** JavaScript function */
  func: (state: CpuState) => number;
  /** Start PC */
  startPc: number;
  /** End PC */
  endPc: number;
  /** Generated source code (for debugging) */
  source: string;
  /** Number of blocks */
  blockCount: number;
}

/**
 * Basic block info
 */
interface BasicBlock
{
  /** Start PC of block */
  startPc: number;
  /** End PC of block (exclusive) */
  endPc: number;
  /** Instructions in block */
  instructions: Array<{ pc: number; data: number; type: InstructionType }>;
  /** Relooper block (assigned during compilation) */
  rblock?: RelooperBlock;
  /** Generated code for this block */
  code: string;
  /** Branch target (if conditional branch) */
  branchTarget?: number;
  /** Branch condition (JS expression) */
  branchCond?: string;
  /** Fallthrough target */
  fallthrough?: number;
  /** Is this a terminal block (syscall, return) */
  terminal: boolean;
}

/**
 * Function Compiler
 */
export class FunctionCompiler
{
  private table: InstructionTable;
  private ast: MipsAstBuilder;

  constructor()
  {
    this.table = InstructionTable.instance;
    this.ast = new MipsAstBuilder();
  }

  /**
   * Compile a function starting at the given PC
   */
  compile(
    readWord: (addr: number) => number,
    startPc: number,
    maxInstructions: number = 1000
  ): CompiledFunction | null
  {
    // Discover basic blocks
    const blocks = this.discoverBlocks(readWord, startPc, maxInstructions);

    if (blocks.length === 0)
    {
      return null;
    }

    // Generate code for each block
    for (const block of blocks)
    {
      block.code = this.generateBlockCode(block);
    }

    // Build control flow graph using Relooper
    const source = this.buildFunction(blocks);

    // Compile to function
    try
    {
      const func = new Function('state', source) as (state: CpuState) => number;

      const lastBlock = blocks[blocks.length - 1];
      return {
        func,
        startPc,
        endPc: lastBlock.endPc,
        source,
        blockCount: blocks.length,
      };
    }
    catch (e)
    {
      console.error('Function compilation failed:', e);
      console.error('Source:', source);
      return null;
    }
  }

  /**
   * Discover basic blocks in a function
   */
  private discoverBlocks(
    readWord: (addr: number) => number,
    startPc: number,
    maxInstructions: number
  ): BasicBlock[]
  {
    const blocks: BasicBlock[] = [];
    const blockStarts = new Set<number>();
    const visited = new Set<number>();

    // Queue of PCs to analyze
    const queue: number[] = [startPc];
    blockStarts.add(startPc);

    // First pass: find all block starts
    while (queue.length > 0)
    {
      const pc = queue.shift()!;
      if (visited.has(pc)) continue;

      let currentPc = pc;
      let instructionCount = 0;

      while (instructionCount < maxInstructions)
      {
        if (visited.has(currentPc)) break;
        visited.add(currentPc);

        const data = readWord(currentPc);
        const type = this.table.find(data);

        if (!type)
        {
          // Unknown instruction - end block
          break;
        }

        instructionCount++;

        if (type.isSyscall || type.isBreak)
        {
          // Terminal instruction
          break;
        }

        if (type.isBranch)
        {
          const instr = new Instruction(currentPc, data);
          const target = instr.branchTarget;

          // Branch target starts a new block
          if (!blockStarts.has(target))
          {
            blockStarts.add(target);
            queue.push(target);
          }

          // Instruction after delay slot starts a new block
          const afterDelay = currentPc + 8;
          if (!blockStarts.has(afterDelay))
          {
            blockStarts.add(afterDelay);
            queue.push(afterDelay);
          }

          // Include delay slot and end block
          currentPc += 4;
          visited.add(currentPc);
          break;
        }

        if (type.isJump)
        {
          const instr = new Instruction(currentPc, data);

          if (type.isJumpNoLink && !type.isRegister)
          {
            // Unconditional non-register jump (j instruction)
            const target = instr.jumpTarget;
            if (!blockStarts.has(target))
            {
              blockStarts.add(target);
              queue.push(target);
            }
          }
          else if (type.name === 'jal')
          {
            // JAL - function call, continue after
            const afterDelay = currentPc + 8;
            if (!blockStarts.has(afterDelay))
            {
              blockStarts.add(afterDelay);
              queue.push(afterDelay);
            }
          }

          // Include delay slot and end block
          currentPc += 4;
          visited.add(currentPc);
          break;
        }

        currentPc += 4;
      }
    }

    // Second pass: build blocks
    const sortedStarts = Array.from(blockStarts).sort((a, b) => a - b);

    for (const blockStart of sortedStarts)
    {
      const block = this.buildBlock(readWord, blockStart, blockStarts, maxInstructions);
      if (block.instructions.length > 0)
      {
        blocks.push(block);
      }
    }

    return blocks;
  }

  /**
   * Build a single basic block
   */
  private buildBlock(
    readWord: (addr: number) => number,
    startPc: number,
    blockStarts: Set<number>,
    maxInstructions: number
  ): BasicBlock
  {
    const instructions: BasicBlock['instructions'] = [];
    let pc = startPc;
    let terminal = false;
    let branchTarget: number | undefined;
    let branchCond: string | undefined;
    let fallthrough: number | undefined;

    for (let i = 0; i < maxInstructions; i++)
    {
      const data = readWord(pc);
      const type = this.table.find(data);

      if (!type)
      {
        terminal = true;
        break;
      }

      instructions.push({ pc, data, type });

      if (type.isSyscall || type.isBreak)
      {
        terminal = true;
        break;
      }

      if (type.isBranch)
      {
        const instr = new Instruction(pc, data);
        branchTarget = instr.branchTarget;
        branchCond = this.getBranchCondition(instr, type);
        fallthrough = pc + 8; // After delay slot

        // Include delay slot
        pc += 4;
        const delayData = readWord(pc);
        const delayType = this.table.find(delayData);
        if (delayType)
        {
          instructions.push({ pc, data: delayData, type: delayType });
        }
        break;
      }

      if (type.isJump)
      {
        const instr = new Instruction(pc, data);

        if (type.name === 'jr' && instr.rs === 31)
        {
          // jr $ra - function return
          terminal = true;
        }
        else if (type.name === 'j')
        {
          // Unconditional jump
          branchTarget = instr.jumpTarget;
        }
        else if (type.name === 'jal')
        {
          // Function call - continue after delay slot
          fallthrough = pc + 8;
        }
        else if (type.isRegister)
        {
          // jr/jalr to register - terminal (we don't know target)
          terminal = true;
        }

        // Include delay slot
        pc += 4;
        const delayData = readWord(pc);
        const delayType = this.table.find(delayData);
        if (delayType)
        {
          instructions.push({ pc, data: delayData, type: delayType });
        }
        break;
      }

      pc += 4;

      // Check if next instruction starts a new block
      if (blockStarts.has(pc))
      {
        fallthrough = pc;
        break;
      }
    }

    return {
      startPc,
      endPc: pc + 4,
      instructions,
      code: '',
      branchTarget,
      branchCond,
      fallthrough,
      terminal,
    };
  }

  /**
   * Get branch condition as JavaScript expression
   */
  private getBranchCondition(instr: Instruction, type: InstructionType): string
  {
    const rs = instr.rs;
    const rt = instr.rt;

    switch (type.name)
    {
      case 'beq': return `gpr[${rs}] === gpr[${rt}]`;
      case 'bne': return `gpr[${rs}] !== gpr[${rt}]`;
      case 'bgtz': return `gpr[${rs}] > 0`;
      case 'blez': return `gpr[${rs}] <= 0`;
      case 'bgez': return `gpr[${rs}] >= 0`;
      case 'bltz': return `gpr[${rs}] < 0`;
      case 'bgezal': return `gpr[${rs}] >= 0`;
      case 'bltzal': return `gpr[${rs}] < 0`;
      default: return 'true';
    }
  }

  /**
   * Generate JavaScript code for a basic block
   */
  private generateBlockCode(block: BasicBlock): string
  {
    const stmts: Stmt[] = [];

    for (let i = 0; i < block.instructions.length; i++)
    {
      const { pc, data, type } = block.instructions[i];
      const instr = new Instruction(pc, data);
      const isDelaySlot = i === block.instructions.length - 1 &&
        (block.branchTarget !== undefined || block.fallthrough !== undefined);

      const stmt = this.generateInstruction(instr, type, isDelaySlot);
      if (stmt)
      {
        stmts.push(stmt);
      }
    }

    return new Block(stmts).toJs();
  }

  /**
   * Generate AST for a single instruction
   */
  private generateInstruction(
    instr: Instruction,
    type: InstructionType,
    _isDelaySlot: boolean
  ): Stmt | null
  {
    const a = this.ast;
    const { rs, rt, rd, sa, imm16, uimm16 } = instr;

    switch (type.name)
    {
      // Arithmetic
      case 'add':
      case 'addu':
        return a.assignGprS(rd, a.add(a.gpr(rs), a.gpr(rt)));

      case 'addi':
      case 'addiu':
        return a.assignGprS(rt, a.add(a.gpr(rs), a.i32(imm16)));

      case 'sub':
      case 'subu':
        return a.assignGprS(rd, a.sub(a.gpr(rs), a.gpr(rt)));

      case 'lui':
        return a.assignGpr(rt, a.i32(uimm16 << 16));

      // Logical
      case 'and':
        return a.assignGpr(rd, a.and(a.gpr(rs), a.gpr(rt)));

      case 'andi':
        return a.assignGpr(rt, a.and(a.gpr(rs), a.u32(uimm16)));

      case 'or':
        return a.assignGpr(rd, a.or(a.gpr(rs), a.gpr(rt)));

      case 'ori':
        return a.assignGpr(rt, a.or(a.gpr(rs), a.u32(uimm16)));

      case 'xor':
        return a.assignGpr(rd, a.xor(a.gpr(rs), a.gpr(rt)));

      case 'xori':
        return a.assignGpr(rt, a.xor(a.gpr(rs), a.u32(uimm16)));

      case 'nor':
        return a.assignGpr(rd, a.not(a.or(a.gpr(rs), a.gpr(rt))));

      // Shifts
      case 'sll':
        if (instr.data === 0) return null; // NOP
        return a.assignGpr(rd, a.sll(a.gpr(rt), a.i32(sa)));

      case 'srl':
        return a.assignGpr(rd, a.srl(a.gpr(rt), a.i32(sa)));

      case 'sra':
        return a.assignGpr(rd, a.sra(a.gpr(rt), a.i32(sa)));

      case 'sllv':
        return a.assignGpr(rd, a.sll(a.gpr(rt), a.and(a.gpr(rs), a.i32(31))));

      case 'srlv':
        return a.assignGpr(rd, a.srl(a.gpr(rt), a.and(a.gpr(rs), a.i32(31))));

      case 'srav':
        return a.assignGpr(rd, a.sra(a.gpr(rt), a.and(a.gpr(rs), a.i32(31))));

      // Comparisons
      case 'slt':
        return a.slt(rd, a.lt(a.gprS(rs), a.gprS(rt)));

      case 'sltu':
        return a.slt(rd, a.lt(a.gprU(rs), a.gprU(rt)));

      case 'slti':
        return a.slt(rt, a.lt(a.gprS(rs), a.i32(imm16)));

      case 'sltiu':
        return a.slt(rt, a.lt(a.gprU(rs), a.toU32(a.i32(imm16))));

      // Multiply/Divide
      case 'mult':
        return a.mult(rs, rt, true);

      case 'multu':
        return a.mult(rs, rt, false);

      case 'div':
        return a.div(rs, rt, true);

      case 'divu':
        return a.div(rs, rt, false);

      case 'mfhi':
        return a.assignGpr(rd, a.hi());

      case 'mflo':
        return a.assignGpr(rd, a.lo());

      case 'mthi':
        return a.assign(a.hi(), a.gpr(rs));

      case 'mtlo':
        return a.assign(a.lo(), a.gpr(rs));

      // Load/Store
      case 'lw':
        return a.assignGpr(rt, a.lw(a.memAddr(rs, imm16)));

      case 'lh':
        return a.assignGpr(rt, a.lh(a.memAddr(rs, imm16)));

      case 'lhu':
        return a.assignGpr(rt, a.lhu(a.memAddr(rs, imm16)));

      case 'lb':
        return a.assignGpr(rt, a.lb(a.memAddr(rs, imm16)));

      case 'lbu':
        return a.assignGpr(rt, a.lbu(a.memAddr(rs, imm16)));

      case 'sw':
        return a.stmt(a.sw(a.memAddr(rs, imm16), a.gpr(rt)));

      case 'sh':
        return a.stmt(a.sh(a.memAddr(rs, imm16), a.gpr(rt)));

      case 'sb':
        return a.stmt(a.sb(a.memAddr(rs, imm16), a.gpr(rt)));

      // Branches - handled at block level
      case 'beq':
      case 'bne':
      case 'bgtz':
      case 'blez':
      case 'bgez':
      case 'bltz':
        return null; // Branch logic handled in buildFunction

      case 'bgezal':
      case 'bltzal':
        return a.assignGpr(31, a.u32(instr.pc + 8));

      // Jumps
      case 'j':
        return null; // Handled at block level

      case 'jal':
        return a.assignGpr(31, a.u32(instr.pc + 8));

      case 'jr':
        return null; // Handled at block level

      case 'jalr':
        return a.assignGpr(rd === 0 ? 31 : rd, a.u32(instr.pc + 8));

      // System
      case 'syscall':
        return a.rawStmt(`state.pc = 0x${instr.pc.toString(16)}; return -1;`);

      case 'break':
        return a.rawStmt(`state.pc = 0x${instr.pc.toString(16)}; return -2;`);

      case 'nop':
      case 'sync':
        return null;

      default:
        // Fallback for unimplemented instructions
        return a.rawStmt(`/* TODO: ${type.name} */`);
    }
  }

  /**
   * Build complete function using Relooper
   */
  private buildFunction(blocks: BasicBlock[]): string
  {
    const lines: string[] = [];

    // Prologue
    lines.push(`"use strict";`);
    lines.push(`var gpr = state.gpr;`);
    lines.push(`var fpr = state.fpr;`);
    lines.push(`var fprInt = state.fprInt;`);
    lines.push(`var memory = state.memory;`);
    lines.push(``);

    if (blocks.length === 1 && blocks[0].terminal)
    {
      // Single terminal block - no control flow needed
      lines.push(blocks[0].code);
      if (!blocks[0].code.includes('return'))
      {
        lines.push(`state.pc = 0x${blocks[0].endPc.toString(16)};`);
        lines.push(`return 0x${blocks[0].endPc.toString(16)};`);
      }
    }
    else
    {
      // Use Relooper for control flow
      const relooper = new Relooper();
      const blockMap = new Map<number, BasicBlock>();

      // Create relooper blocks
      for (const block of blocks)
      {
        block.rblock = relooper.addBlock(block.code);
        blockMap.set(block.startPc, block);
      }

      // Add branches
      for (const block of blocks)
      {
        if (block.terminal)
        {
          // Terminal block - no outgoing edges
          continue;
        }

        // Conditional branch
        if (block.branchTarget !== undefined && block.branchCond)
        {
          const targetBlock = blockMap.get(block.branchTarget);
          if (targetBlock?.rblock)
          {
            relooper.addBranch(block.rblock!, targetBlock.rblock, block.branchCond);
          }
        }

        // Fallthrough/unconditional
        if (block.fallthrough !== undefined)
        {
          const targetBlock = blockMap.get(block.fallthrough);
          if (targetBlock?.rblock)
          {
            relooper.addBranch(block.rblock!, targetBlock.rblock);
          }
        }
        else if (block.branchTarget !== undefined && !block.branchCond)
        {
          // Unconditional jump (j instruction)
          const targetBlock = blockMap.get(block.branchTarget);
          if (targetBlock?.rblock)
          {
            relooper.addBranch(block.rblock!, targetBlock.rblock);
          }
        }
      }

      // Render control flow
      const entry = blocks[0].rblock!;
      lines.push(relooper.render(entry));

      // Epilogue
      lines.push(``);
      lines.push(`state.pc = 0x${blocks[blocks.length - 1].endPc.toString(16)};`);
      lines.push(`return 0x${blocks[blocks.length - 1].endPc.toString(16)};`);
    }

    return lines.join('\n');
  }
}
