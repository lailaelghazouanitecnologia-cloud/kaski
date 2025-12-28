import { Instruction } from '../core/cpu/Instruction';
import { InstructionTable } from '../core/cpu/InstructionTable';
import type { InstructionType } from '../core/cpu/InstructionType';
import { disassembler, type DisassemblyResult } from '../core/cpu/Disassembler';

/**
 * Disassembled instruction with analysis metadata
 */
export interface AnalyzedInstruction
{
  /** Instruction address */
  address: number;

  /** Raw instruction data */
  data: number;

  /** Decoded instruction */
  instruction: Instruction;

  /** Instruction type info */
  type: InstructionType | null;

  /** Disassembly result */
  disasm: DisassemblyResult;

  /** Is this a function call? */
  isCall: boolean;

  /** Is this a branch? */
  isBranch: boolean;

  /** Is this a return (jr $ra)? */
  isReturn: boolean;

  /** Is this a jump? */
  isJump: boolean;

  /** Branch/jump target (if fixed) */
  target: number | null;

  /** Is this in a delay slot? */
  isDelaySlot: boolean;
}

/**
 * Basic block type
 */
export const enum BlockType
{
  /** Normal block */
  NORMAL = 'normal',
  /** Function entry point */
  ENTRY = 'entry',
  /** Block ends with return */
  RETURN = 'return',
  /** Block ends with call */
  CALL = 'call',
  /** Block ends with conditional branch */
  BRANCH = 'branch',
  /** Block ends with unconditional jump */
  JUMP = 'jump',
  /** Block ends with syscall */
  SYSCALL = 'syscall',
}

/**
 * Basic block - a sequence of instructions with single entry and exit
 */
export class BasicBlock
{
  /** Unique block ID */
  readonly id: number;

  /** Start address */
  readonly startAddress: number;

  /** Instructions in this block */
  readonly instructions: AnalyzedInstruction[] = [];

  /** Block type based on terminator */
  type: BlockType = BlockType.NORMAL;

  /** Successor blocks */
  readonly successors: BasicBlock[] = [];

  /** Predecessor blocks */
  readonly predecessors: BasicBlock[] = [];

  /** Function this block belongs to (set later) */
  functionAddress: number | null = null;

  private static nextId = 0;

  constructor(startAddress: number)
  {
    this.id = BasicBlock.nextId++;
    this.startAddress = startAddress;
  }

  /**
   * Get the end address (after last instruction)
   */
  get endAddress(): number
  {
    if (this.instructions.length === 0)
    {
      return this.startAddress;
    }
    const last = this.instructions[this.instructions.length - 1];
    return last.address + 4;
  }

  /**
   * Get the size in bytes
   */
  get size(): number
  {
    return this.instructions.length * 4;
  }

  /**
   * Get the last instruction (terminator)
   */
  get terminator(): AnalyzedInstruction | null
  {
    if (this.instructions.length === 0)
    {
      return null;
    }
    // Check for delay slot
    const len = this.instructions.length;
    if (len >= 2 && this.instructions[len - 1].isDelaySlot)
    {
      return this.instructions[len - 2];
    }
    return this.instructions[len - 1];
  }

  /**
   * Add an instruction to this block
   */
  addInstruction(instr: AnalyzedInstruction): void
  {
    this.instructions.push(instr);
  }

  /**
   * Add a successor block
   */
  addSuccessor(block: BasicBlock): void
  {
    if (!this.successors.includes(block))
    {
      this.successors.push(block);
      block.predecessors.push(this);
    }
  }

  /**
   * Check if this block contains an address
   */
  containsAddress(address: number): boolean
  {
    return address >= this.startAddress && address < this.endAddress;
  }

  /**
   * Convert to string for debugging
   */
  toString(): string
  {
    const lines: string[] = [];
    lines.push(`Block ${this.id} [0x${this.startAddress.toString(16)} - 0x${this.endAddress.toString(16)}] (${this.type})`);

    for (const instr of this.instructions)
    {
      const prefix = instr.isDelaySlot ? '  (ds) ' : '       ';
      lines.push(`${prefix}0x${instr.address.toString(16).padStart(8, '0')}: ${instr.disasm.text}`);
    }

    if (this.successors.length > 0)
    {
      lines.push(`  -> ${this.successors.map(b => `Block ${b.id}`).join(', ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Reset static ID counter (for testing)
   */
  static resetIds(): void
  {
    BasicBlock.nextId = 0;
  }
}

/**
 * Control Flow Graph
 */
export class ControlFlowGraph
{
  /** All blocks by start address */
  readonly blocks: Map<number, BasicBlock> = new Map();

  /** Entry block (if identified) */
  entry: BasicBlock | null = null;

  /** Instruction table for decoding */
  private table: InstructionTable;

  constructor()
  {
    this.table = InstructionTable.instance;
  }

  /**
   * Build CFG from memory starting at entry point
   *
   * @param readWord - Function to read instruction words
   * @param entryPoint - Starting address
   * @param maxInstructions - Maximum instructions to analyze
   */
  build(
    readWord: (addr: number) => number,
    entryPoint: number,
    maxInstructions: number = 10000
  ): void
  {
    const worklist: number[] = [entryPoint];
    const visited = new Set<number>();
    let instructionCount = 0;

    // Labels/block starts discovered during analysis
    const labels = new Set<number>();
    labels.add(entryPoint);

    // First pass: discover all labels and basic structure
    while (worklist.length > 0 && instructionCount < maxInstructions)
    {
      const address = worklist.shift()!;

      if (visited.has(address))
      {
        continue;
      }

      // Analyze from this address
      let pc = address;
      let inDelaySlot = false;

      while (instructionCount < maxInstructions)
      {
        if (visited.has(pc) && !inDelaySlot)
        {
          // Already processed
          labels.add(pc);
          break;
        }

        visited.add(pc);
        instructionCount++;

        const data = readWord(pc);
        const instr = new Instruction(pc, data);
        const type = this.table.find(data);

        if (!type)
        {
          // Unknown instruction - stop here
          break;
        }

        // Handle branch/jump targets
        if (type.isBranch || type.isJump)
        {
          if (!type.isRegister)
          {
            // Fixed target
            const target = type.isBranch ? instr.branchTarget : instr.jumpTarget;
            labels.add(target);
            worklist.push(target);
          }

          // Fall-through for branches
          if (type.isBranch)
          {
            labels.add(pc + 8); // After delay slot
            worklist.push(pc + 8);
          }

          // Process delay slot
          inDelaySlot = true;
          pc += 4;
          continue;
        }

        if (inDelaySlot)
        {
          // After delay slot, stop this path
          break;
        }

        if (type.isSyscall || type.isBreak)
        {
          break;
        }

        pc += 4;
      }
    }

    // Second pass: build actual blocks
    BasicBlock.resetIds();
    this.blocks.clear();

    // Sort labels
    const sortedLabels = Array.from(labels).sort((a, b) => a - b);

    // Create blocks for each label
    for (const label of sortedLabels)
    {
      if (!this.blocks.has(label))
      {
        this.buildBlock(readWord, label, labels);
      }
    }

    // Set entry block
    this.entry = this.blocks.get(entryPoint) ?? null;

    // Connect blocks
    this.connectBlocks();
  }

  /**
   * Build a single basic block
   */
  private buildBlock(
    readWord: (addr: number) => number,
    startAddress: number,
    labels: Set<number>
  ): BasicBlock
  {
    const block = new BasicBlock(startAddress);
    this.blocks.set(startAddress, block);

    let pc = startAddress;
    let inDelaySlot = false;

    while (true)
    {
      const data = readWord(pc);
      const instr = new Instruction(pc, data);
      const type = this.table.find(data);
      const disasm = disassembler.disassemble(instr);

      const analyzed: AnalyzedInstruction = {
        address: pc,
        data,
        instruction: instr,
        type,
        disasm,
        isCall: type?.isJal ?? false,
        isBranch: type?.isBranch ?? false,
        isReturn: type?.name === 'jr' && instr.rs === 31,
        isJump: type?.isJump ?? false,
        target: null,
        isDelaySlot: inDelaySlot,
      };

      // Compute target
      if (type)
      {
        if (type.isBranch)
        {
          analyzed.target = instr.branchTarget;
        }
        else if (type.isJump && !type.isRegister)
        {
          analyzed.target = instr.jumpTarget;
        }
      }

      block.addInstruction(analyzed);

      // Determine block type and termination
      if (inDelaySlot)
      {
        // Block ends after delay slot
        break;
      }

      if (type)
      {
        if (type.isSyscall)
        {
          block.type = BlockType.SYSCALL;
          break;
        }

        if (type.isBreak)
        {
          block.type = BlockType.NORMAL;
          break;
        }

        if (analyzed.isReturn)
        {
          block.type = BlockType.RETURN;
          inDelaySlot = true;
          pc += 4;
          continue;
        }

        if (type.isJal)
        {
          block.type = BlockType.CALL;
          inDelaySlot = true;
          pc += 4;
          continue;
        }

        if (type.isBranch)
        {
          block.type = BlockType.BRANCH;
          inDelaySlot = true;
          pc += 4;
          continue;
        }

        if (type.isJump)
        {
          block.type = BlockType.JUMP;
          inDelaySlot = true;
          pc += 4;
          continue;
        }
      }

      // Check if next instruction starts a new block
      pc += 4;
      if (labels.has(pc))
      {
        break;
      }
    }

    return block;
  }

  /**
   * Connect blocks based on control flow
   */
  private connectBlocks(): void
  {
    for (const block of this.blocks.values())
    {
      const terminator = block.terminator;
      if (!terminator) continue;

      switch (block.type)
      {
        case BlockType.BRANCH:
          // Fall-through edge
          const fallthrough = this.blocks.get(block.endAddress);
          if (fallthrough)
          {
            block.addSuccessor(fallthrough);
          }
          // Target edge
          if (terminator.target !== null)
          {
            const target = this.blocks.get(terminator.target);
            if (target)
            {
              block.addSuccessor(target);
            }
          }
          break;

        case BlockType.JUMP:
          // Only target edge
          if (terminator.target !== null)
          {
            const target = this.blocks.get(terminator.target);
            if (target)
            {
              block.addSuccessor(target);
            }
          }
          break;

        case BlockType.CALL:
          // Fall-through after call returns
          const afterCall = this.blocks.get(block.endAddress);
          if (afterCall)
          {
            block.addSuccessor(afterCall);
          }
          break;

        case BlockType.NORMAL:
          // Fall-through to next block
          const next = this.blocks.get(block.endAddress);
          if (next)
          {
            block.addSuccessor(next);
          }
          break;

        // RETURN and SYSCALL have no successors
      }
    }
  }

  /**
   * Get block containing address
   */
  getBlockAt(address: number): BasicBlock | null
  {
    for (const block of this.blocks.values())
    {
      if (block.containsAddress(address))
      {
        return block;
      }
    }
    return null;
  }

  /**
   * Get all blocks in address order
   */
  getBlocksInOrder(): BasicBlock[]
  {
    return Array.from(this.blocks.values())
      .sort((a, b) => a.startAddress - b.startAddress);
  }

  /**
   * Convert to string for debugging
   */
  toString(): string
  {
    const lines: string[] = [];
    lines.push(`CFG with ${this.blocks.size} blocks`);
    lines.push('');

    for (const block of this.getBlocksInOrder())
    {
      lines.push(block.toString());
      lines.push('');
    }

    return lines.join('\n');
  }
}
