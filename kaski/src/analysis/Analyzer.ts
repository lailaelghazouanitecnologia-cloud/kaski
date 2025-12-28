import { Instruction } from '../core/cpu/Instruction';
import { disassembler } from '../core/cpu/Disassembler';
import { InstructionTable } from '../core/cpu/InstructionTable';
import { ControlFlowGraph, BasicBlock, BlockType } from './cfg';
import { FunctionFinder, FunctionInfo, FunctionSource } from './functions';

/**
 * Analysis options
 */
export interface AnalyzerOptions
{
  /** Find functions via call targets */
  findFunctions?: boolean;

  /** Find functions via prologue patterns */
  findByPrologue?: boolean;

  /** Maximum instructions to analyze */
  maxInstructions?: number;
}

/**
 * Analysis result
 */
export interface AnalysisResult
{
  /** All detected functions */
  functions: FunctionInfo[];

  /** Total instructions analyzed */
  instructionCount: number;

  /** Analysis time in ms */
  analysisTime: number;
}

/**
 * ASM output options
 */
export interface AsmOptions
{
  /** Include address comments */
  showAddresses?: boolean;

  /** Include raw bytes */
  showBytes?: boolean;

  /** Include function separators */
  showSeparators?: boolean;

  /** Label prefix for auto-generated labels */
  labelPrefix?: string;
}

/**
 * Main static analyzer
 *
 * Coordinates CFG building, function finding, and ASM output
 */
export class Analyzer
{
  private table: InstructionTable;
  private functionFinder: FunctionFinder;
  private readWord: ((addr: number) => number) | null = null;

  /** Analysis statistics */
  stats = {
    functionsFound: 0,
    blocksAnalyzed: 0,
    instructionsAnalyzed: 0,
  };

  constructor()
  {
    this.table = InstructionTable.instance;
    this.functionFinder = new FunctionFinder();
  }

  /**
   * Analyze code starting from entry points
   *
   * @param readWord - Function to read instruction words
   * @param entryPoints - Known entry points to start from
   * @param options - Analysis options
   */
  analyze(
    readWord: (addr: number) => number,
    entryPoints: number[],
    options: AnalyzerOptions = {}
  ): AnalysisResult
  {
    const startTime = performance.now();
    this.readWord = readWord;

    const opts = {
      findFunctions: true,
      findByPrologue: false,
      maxInstructions: 100000,
      ...options,
    };

    // Reset finder
    this.functionFinder = new FunctionFinder();

    // Find functions via call targets
    if (opts.findFunctions)
    {
      this.functionFinder.findFunctions(
        readWord,
        entryPoints,
        opts.maxInstructions
      );
    }

    // Update stats
    this.stats.functionsFound = this.functionFinder.functions.size;
    this.stats.blocksAnalyzed = 0;
    this.stats.instructionsAnalyzed = 0;

    for (const func of this.functionFinder.functions.values())
    {
      if (func.cfg)
      {
        this.stats.blocksAnalyzed += func.cfg.blocks.size;
        for (const block of func.cfg.blocks.values())
        {
          this.stats.instructionsAnalyzed += block.instructions.length;
        }
      }
    }

    const endTime = performance.now();

    return {
      functions: this.functionFinder.getFunctionsInOrder(),
      instructionCount: this.stats.instructionsAnalyzed,
      analysisTime: endTime - startTime,
    };
  }

  /**
   * Analyze a memory region by scanning for prologues
   */
  analyzeRegion(
    readWord: (addr: number) => number,
    startAddress: number,
    endAddress: number
  ): AnalysisResult
  {
    const startTime = performance.now();
    this.readWord = readWord;

    this.functionFinder = new FunctionFinder();
    this.functionFinder.findByPrologue(readWord, startAddress, endAddress);

    // Analyze each detected function
    for (const func of this.functionFinder.functions.values())
    {
      if (!func.cfg)
      {
        const cfg = new ControlFlowGraph();
        cfg.build(readWord, func.address, 1000);
        func.cfg = cfg;
      }
    }

    this.stats.functionsFound = this.functionFinder.functions.size;

    const endTime = performance.now();

    return {
      functions: this.functionFinder.getFunctionsInOrder(),
      instructionCount: this.stats.instructionsAnalyzed,
      analysisTime: endTime - startTime,
    };
  }

  /**
   * Add a known function
   */
  addFunction(address: number, name: string): FunctionInfo
  {
    return this.functionFinder.addFunction(
      address,
      name,
      FunctionSource.USER,
      1.0
    );
  }

  /**
   * Get function at address
   */
  getFunction(address: number): FunctionInfo | null
  {
    return this.functionFinder.getFunction(address);
  }

  /**
   * Get function containing address
   */
  getFunctionContaining(address: number): FunctionInfo | null
  {
    return this.functionFinder.getFunctionContaining(address);
  }

  /**
   * Get all functions
   */
  getFunctions(): FunctionInfo[]
  {
    return this.functionFinder.getFunctionsInOrder();
  }

  /**
   * Generate ASM output for a function
   */
  functionToAsm(func: FunctionInfo, options: AsmOptions = {}): string
  {
    const opts = {
      showAddresses: true,
      showBytes: false,
      showSeparators: true,
      labelPrefix: '.L',
      ...options,
    };

    const lines: string[] = [];

    if (opts.showSeparators)
    {
      lines.push('; ' + '='.repeat(77));
      lines.push(`; Function: ${func.name}`);
      lines.push(`; Address: 0x${func.address.toString(16).padStart(8, '0')}`);
      lines.push(`; Size: 0x${func.size.toString(16)} bytes`);
      if (func.stackSize > 0)
      {
        lines.push(`; Stack: ${func.stackSize} bytes`);
      }
      if (func.calls.length > 0)
      {
        lines.push(`; Calls: ${func.calls.map(a => '0x' + a.toString(16)).join(', ')}`);
      }
      lines.push('; ' + '='.repeat(77));
    }

    lines.push(`${func.name}:`);

    if (!func.cfg)
    {
      lines.push('    ; (no CFG available)');
      return lines.join('\n');
    }

    // Build label map for branch targets
    const labels = new Map<number, string>();
    let labelIndex = 0;

    for (const block of func.cfg.blocks.values())
    {
      // Label blocks that have multiple predecessors or are branch targets
      if (block.predecessors.length > 1 || block.startAddress !== func.address)
      {
        // Check if any predecessor branches to this block
        for (const pred of block.predecessors)
        {
          const term = pred.terminator;
          if (term && term.target === block.startAddress)
          {
            if (!labels.has(block.startAddress))
            {
              labels.set(block.startAddress, `${opts.labelPrefix}${labelIndex++}`);
            }
          }
        }
      }
    }

    // Output blocks in address order
    for (const block of func.cfg.getBlocksInOrder())
    {
      const label = labels.get(block.startAddress);
      if (label)
      {
        lines.push(`${label}:`);
      }

      for (const instr of block.instructions)
      {
        const addr = instr.address.toString(16).padStart(8, '0');
        const prefix = instr.isDelaySlot ? '    ' : '';

        let line = '';

        if (opts.showAddresses)
        {
          if (opts.showBytes)
          {
            const bytes = instr.data.toString(16).padStart(8, '0');
            line = `  ${addr}: ${bytes}  ${prefix}${instr.disasm.text}`;
          }
          else
          {
            line = `  ${addr}:  ${prefix}${instr.disasm.text}`;
          }
        }
        else
        {
          line = `    ${prefix}${instr.disasm.text}`;
        }

        // Add target label comment for branches
        if (instr.target !== null)
        {
          const targetLabel = labels.get(instr.target);
          if (targetLabel)
          {
            line += `  ; -> ${targetLabel}`;
          }
          else
          {
            // External target (function call or external jump)
            const targetFunc = this.functionFinder.getFunction(instr.target);
            if (targetFunc)
            {
              line += `  ; -> ${targetFunc.name}`;
            }
          }
        }

        lines.push(line);
      }
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Generate ASM output for all functions
   */
  toAsm(options: AsmOptions = {}): string
  {
    const lines: string[] = [];

    lines.push('; Generated by Kaski Static Analyzer');
    lines.push(`;`);
    lines.push(`; Functions: ${this.stats.functionsFound}`);
    lines.push(`; Blocks: ${this.stats.blocksAnalyzed}`);
    lines.push(`; Instructions: ${this.stats.instructionsAnalyzed}`);
    lines.push('');

    for (const func of this.functionFinder.getFunctionsInOrder())
    {
      lines.push(this.functionToAsm(func, options));
    }

    return lines.join('\n');
  }

  /**
   * Disassemble a range of memory (linear disassembly)
   */
  disassembleRange(
    readWord: (addr: number) => number,
    startAddress: number,
    count: number
  ): string
  {
    const lines: string[] = [];

    for (let i = 0; i < count; i++)
    {
      const addr = startAddress + i * 4;
      const data = readWord(addr);
      const instr = new Instruction(addr, data);
      const result = disassembler.disassemble(instr);

      const addrStr = addr.toString(16).padStart(8, '0');
      const bytesStr = data.toString(16).padStart(8, '0');

      lines.push(`${addrStr}: ${bytesStr}  ${result.text}`);
    }

    return lines.join('\n');
  }

  /**
   * Get analysis statistics as string
   */
  getStats(): string
  {
    return [
      `Functions: ${this.stats.functionsFound}`,
      `Blocks: ${this.stats.blocksAnalyzed}`,
      `Instructions: ${this.stats.instructionsAnalyzed}`,
    ].join('\n');
  }

  /**
   * Convert analysis to JSON
   */
  toJSON(): object
  {
    const functions = this.functionFinder.getFunctionsInOrder().map(func => ({
      name: func.name,
      address: '0x' + func.address.toString(16),
      size: func.size,
      stackSize: func.stackSize,
      source: func.source,
      confidence: func.confidence,
      calls: func.calls.map(a => '0x' + a.toString(16)),
      calledBy: func.calledBy.map(a => '0x' + a.toString(16)),
      blockCount: func.cfg?.blocks.size ?? 0,
    }));

    return {
      stats: this.stats,
      functions,
    };
  }
}
