import { Instruction } from '../core/cpu/Instruction';
import { InstructionTable } from '../core/cpu/InstructionTable';
import { ControlFlowGraph, BasicBlock, BlockType } from './cfg';

/**
 * Function detection source
 */
export const enum FunctionSource
{
  /** Detected via JAL/JALR target */
  CALL = 'call',
  /** Detected via prologue pattern */
  PROLOGUE = 'prologue',
  /** Detected via symbol table */
  SYMBOL = 'symbol',
  /** Detected via import table */
  IMPORT = 'import',
  /** User-defined */
  USER = 'user',
}

/**
 * Detected function info
 */
export interface FunctionInfo
{
  /** Function entry address */
  address: number;

  /** Function name (if known) */
  name: string;

  /** How was this function detected? */
  source: FunctionSource;

  /** Detection confidence (0.0 - 1.0) */
  confidence: number;

  /** Function size in bytes (if known) */
  size: number;

  /** End address (if known) */
  endAddress: number;

  /** Stack frame size (if detected) */
  stackSize: number;

  /** Addresses this function calls */
  calls: number[];

  /** Addresses that call this function */
  calledBy: number[];

  /** Control flow graph for this function */
  cfg: ControlFlowGraph | null;
}

/**
 * Stack frame info
 */
interface StackFrame
{
  size: number;
  savesRa: boolean;
  savedRegs: number[];
}

/**
 * Function finder - identifies function boundaries in code
 */
export class FunctionFinder
{
  /** Detected functions by address */
  readonly functions: Map<number, FunctionInfo> = new Map();

  /** Instruction table */
  private table: InstructionTable;

  constructor()
  {
    this.table = InstructionTable.instance;
  }

  /**
   * Find functions starting from entry points
   *
   * @param readWord - Function to read instruction words
   * @param entryPoints - Known entry points to start from
   * @param maxInstructions - Maximum instructions to analyze
   */
  findFunctions(
    readWord: (addr: number) => number,
    entryPoints: number[],
    maxInstructions: number = 50000
  ): void
  {
    this.functions.clear();

    // First pass: Find call targets
    const callTargets = new Set<number>();
    const worklist = [...entryPoints];
    const visited = new Set<number>();
    let instructionCount = 0;

    while (worklist.length > 0 && instructionCount < maxInstructions)
    {
      const address = worklist.shift()!;

      if (visited.has(address))
      {
        continue;
      }

      visited.add(address);
      instructionCount++;

      const data = readWord(address);
      const instr = new Instruction(address, data);
      const type = this.table.find(data);

      if (!type)
      {
        continue;
      }

      // Track call targets
      if (type.isJal && !type.isRegister)
      {
        callTargets.add(instr.jumpTarget);
        worklist.push(instr.jumpTarget);
      }

      // Track branch targets
      if (type.isBranch)
      {
        worklist.push(instr.branchTarget);
      }

      // Continue linear scan
      if (!type.isJump || type.isBranch)
      {
        worklist.push(address + 4);
      }

      // For unconditional jumps, add target
      if (type.isJump && !type.isRegister)
      {
        worklist.push(instr.jumpTarget);
      }
    }

    // Add entry points as functions
    for (const entry of entryPoints)
    {
      this.addFunction(entry, 'entry_' + entry.toString(16), FunctionSource.USER, 1.0);
    }

    // Add call targets as functions
    for (const target of callTargets)
    {
      if (!this.functions.has(target))
      {
        this.addFunction(target, 'sub_' + target.toString(16), FunctionSource.CALL, 0.9);
      }
    }

    // Second pass: Analyze each function
    for (const func of this.functions.values())
    {
      this.analyzeFunction(readWord, func);
    }

    // Build cross-references
    this.buildCrossReferences(readWord);
  }

  /**
   * Find functions using prologue patterns
   *
   * @param readWord - Function to read instruction words
   * @param startAddress - Start of code region
   * @param endAddress - End of code region
   */
  findByPrologue(
    readWord: (addr: number) => number,
    startAddress: number,
    endAddress: number
  ): void
  {
    for (let addr = startAddress; addr < endAddress; addr += 4)
    {
      if (this.functions.has(addr))
      {
        continue;
      }

      if (this.isPrologue(readWord, addr))
      {
        this.addFunction(addr, 'sub_' + addr.toString(16), FunctionSource.PROLOGUE, 0.7);
      }
    }
  }

  /**
   * Check if address looks like a function prologue
   */
  private isPrologue(readWord: (addr: number) => number, address: number): boolean
  {
    const data = readWord(address);
    const instr = new Instruction(address, data);
    const type = this.table.find(data);

    if (!type)
    {
      return false;
    }

    // Pattern 1: addiu $sp, $sp, -N (N > 0)
    if (type.name === 'addiu' && instr.rt === 29 && instr.rs === 29)
    {
      const imm = instr.imm16;
      if (imm < 0)
      {
        return true;
      }
    }

    // Pattern 2: sw $ra, offset($sp)
    if (type.name === 'sw' && instr.rt === 31 && instr.rs === 29)
    {
      return true;
    }

    return false;
  }

  /**
   * Analyze a function to determine its extent
   */
  private analyzeFunction(readWord: (addr: number) => number, func: FunctionInfo): void
  {
    // Build CFG for this function
    const cfg = new ControlFlowGraph();
    cfg.build(readWord, func.address, 1000);
    func.cfg = cfg;

    // Find function extent
    let minAddr = func.address;
    let maxAddr = func.address;

    for (const block of cfg.blocks.values())
    {
      if (block.startAddress < minAddr)
      {
        minAddr = block.startAddress;
      }
      if (block.endAddress > maxAddr)
      {
        maxAddr = block.endAddress;
      }
    }

    func.size = maxAddr - minAddr;
    func.endAddress = maxAddr;

    // Detect stack frame
    const frame = this.detectStackFrame(cfg);
    func.stackSize = frame.size;

    // Find calls made by this function
    for (const block of cfg.blocks.values())
    {
      for (const instr of block.instructions)
      {
        if (instr.isCall && instr.target !== null)
        {
          if (!func.calls.includes(instr.target))
          {
            func.calls.push(instr.target);
          }
        }
      }
    }
  }

  /**
   * Detect stack frame from CFG
   */
  private detectStackFrame(cfg: ControlFlowGraph): StackFrame
  {
    const frame: StackFrame = {
      size: 0,
      savesRa: false,
      savedRegs: [],
    };

    const entry = cfg.entry;
    if (!entry)
    {
      return frame;
    }

    // Look at first few instructions
    for (const instr of entry.instructions.slice(0, 10))
    {
      if (!instr.type)
      {
        continue;
      }

      const i = instr.instruction;

      // addiu $sp, $sp, -N
      if (instr.type.name === 'addiu' && i.rt === 29 && i.rs === 29)
      {
        const imm = i.imm16;
        if (imm < 0)
        {
          frame.size = -imm;
        }
      }

      // sw $ra, offset($sp)
      if (instr.type.name === 'sw' && i.rs === 29)
      {
        if (i.rt === 31)
        {
          frame.savesRa = true;
        }
        else if (i.rt >= 16 && i.rt <= 23)
        {
          // $s0-$s7
          frame.savedRegs.push(i.rt);
        }
      }
    }

    return frame;
  }

  /**
   * Build cross-references between functions
   */
  private buildCrossReferences(readWord: (addr: number) => number): void
  {
    for (const func of this.functions.values())
    {
      for (const callTarget of func.calls)
      {
        const target = this.functions.get(callTarget);
        if (target && !target.calledBy.includes(func.address))
        {
          target.calledBy.push(func.address);
        }
      }
    }
  }

  /**
   * Add a function
   */
  addFunction(
    address: number,
    name: string,
    source: FunctionSource,
    confidence: number
  ): FunctionInfo
  {
    const existing = this.functions.get(address);
    if (existing)
    {
      // Update if higher confidence
      if (confidence > existing.confidence)
      {
        existing.name = name;
        existing.source = source;
        existing.confidence = confidence;
      }
      return existing;
    }

    const func: FunctionInfo = {
      address,
      name,
      source,
      confidence,
      size: 0,
      endAddress: address,
      stackSize: 0,
      calls: [],
      calledBy: [],
      cfg: null,
    };

    this.functions.set(address, func);
    return func;
  }

  /**
   * Get function at address
   */
  getFunction(address: number): FunctionInfo | null
  {
    return this.functions.get(address) ?? null;
  }

  /**
   * Get function containing address
   */
  getFunctionContaining(address: number): FunctionInfo | null
  {
    for (const func of this.functions.values())
    {
      if (address >= func.address && address < func.endAddress)
      {
        return func;
      }
    }
    return null;
  }

  /**
   * Get all functions sorted by address
   */
  getFunctionsInOrder(): FunctionInfo[]
  {
    return Array.from(this.functions.values())
      .sort((a, b) => a.address - b.address);
  }

  /**
   * Convert to string for debugging
   */
  toString(): string
  {
    const lines: string[] = [];
    lines.push(`Found ${this.functions.size} functions:`);
    lines.push('');

    for (const func of this.getFunctionsInOrder())
    {
      const calls = func.calls.length > 0
        ? ` calls: ${func.calls.map(a => '0x' + a.toString(16)).join(', ')}`
        : '';
      const calledBy = func.calledBy.length > 0
        ? ` called by: ${func.calledBy.map(a => '0x' + a.toString(16)).join(', ')}`
        : '';

      lines.push(
        `  ${func.name} @ 0x${func.address.toString(16)} ` +
        `(${func.source}, ${(func.confidence * 100).toFixed(0)}% confidence)` +
        ` size: ${func.size} bytes, stack: ${func.stackSize} bytes` +
        calls + calledBy
      );
    }

    return lines.join('\n');
  }
}
