/**
 * Relooper - Control Flow Restructuring Algorithm
 *
 * Converts arbitrary control flow graphs into structured JavaScript code
 * using loops and switches. Based on the Emscripten relooper algorithm.
 *
 * This allows MIPS code with arbitrary jumps to be compiled into valid
 * JavaScript that doesn't require goto statements.
 */

/**
 * Branch between blocks
 */
export interface RelooperBranch
{
  /** Target block */
  to: RelooperBlock;
  /** Condition expression (undefined = unconditional/fallthrough) */
  condition?: string;
  /** Code to execute before jumping */
  code?: string;
}

/**
 * Basic block in the control flow graph
 */
export class RelooperBlock
{
  /** Unique block ID */
  readonly id: number;
  /** JavaScript code in this block */
  code: string;
  /** Conditional branches (evaluated in order) */
  branches: RelooperBranch[] = [];
  /** Next block (fallthrough, unconditional) */
  next: RelooperBlock | null = null;

  constructor(id: number, code: string)
  {
    this.id = id;
    this.code = code;
  }

  /**
   * Add a conditional branch
   */
  addBranch(to: RelooperBlock, condition: string, code?: string): void
  {
    this.branches.push({ to, condition, code });
  }

  /**
   * Set the fallthrough/unconditional next block
   */
  setNext(to: RelooperBlock, code?: string): void
  {
    if (code)
    {
      this.next = to;
      // Add code as last thing before fallthrough
      this.code = this.code ? `${this.code}\n${code}` : code;
    }
    else
    {
      this.next = to;
    }
  }
}

/**
 * Relooper - restructures control flow into JavaScript
 */
export class Relooper
{
  private blocks: RelooperBlock[] = [];
  private nextId = 0;

  /**
   * Create a new basic block with the given code
   */
  addBlock(code: string): RelooperBlock
  {
    const block = new RelooperBlock(this.nextId++, code);
    this.blocks.push(block);
    return block;
  }

  /**
   * Add a branch between blocks
   *
   * @param from - Source block
   * @param to - Target block
   * @param condition - Optional condition (if omitted, sets as next/fallthrough)
   * @param code - Optional code to execute before branch
   */
  addBranch(
    from: RelooperBlock,
    to: RelooperBlock,
    condition?: string,
    code?: string
  ): void
  {
    if (condition)
    {
      from.addBranch(to, condition, code);
    }
    else
    {
      from.setNext(to, code);
    }
  }

  /**
   * Render the control flow graph as JavaScript code
   *
   * @param entry - Entry block (first block to execute)
   * @returns JavaScript code string
   */
  render(entry: RelooperBlock): string
  {
    if (this.blocks.length === 0)
    {
      return '';
    }

    if (this.blocks.length === 1)
    {
      // Single block - no control flow needed
      return entry.code;
    }

    // Use labeled loop + switch for multiple blocks
    return this.renderSwitch(entry);
  }

  /**
   * Render using labeled loop and switch statement
   *
   * Generates code without block braces to allow variable sharing:
   * ```
   * let label = 0;
   * loop: while (true) switch (label) {
   *   case 0:
   *     ...
   *     label = X; continue loop;
   *   case 1:
   *     ...
   * }
   * ```
   */
  private renderSwitch(entry: RelooperBlock): string
  {
    const lines: string[] = [];

    lines.push(`let label = ${entry.id};`);
    lines.push(`loop: while (true) switch (label) {`);

    for (const block of this.blocks)
    {
      lines.push(`  case ${block.id}:`);

      // Block code
      if (block.code)
      {
        const indented = block.code.split('\n').map(l => `    ${l}`).join('\n');
        lines.push(indented);
      }

      // Conditional branches
      for (const branch of block.branches)
      {
        lines.push(`    if (${branch.condition}) {`);
        if (branch.code)
        {
          lines.push(`      ${branch.code}`);
        }
        lines.push(`      label = ${branch.to.id}; continue loop;`);
        lines.push(`    }`);
      }

      // Next block (fallthrough or unconditional)
      if (block.next)
      {
        lines.push(`    label = ${block.next.id}; continue loop;`);
      }
      else
      {
        // No next block - exit the loop
        lines.push(`    break loop;`);
      }
    }

    lines.push(`}`);

    return lines.join('\n');
  }

  /**
   * Optimize: detect simple patterns and simplify
   */
  optimize(): void
  {
    // TODO: Implement optimizations
    // - Linear sequences (no branches) -> remove switch
    // - Simple if/else patterns
    // - Loop detection (back edges)
  }

  /**
   * Get statistics about the control flow graph
   */
  getStats(): { blocks: number; branches: number; hasLoops: boolean }
  {
    let branches = 0;
    let hasLoops = false;

    for (const block of this.blocks)
    {
      branches += block.branches.length;
      if (block.next) branches++;

      // Check for back edges (loops)
      for (const branch of block.branches)
      {
        if (branch.to.id <= block.id)
        {
          hasLoops = true;
        }
      }
      if (block.next && block.next.id <= block.id)
      {
        hasLoops = true;
      }
    }

    return { blocks: this.blocks.length, branches, hasLoops };
  }
}

/**
 * Convenience function to create and render a relooper graph
 */
export function reloop(
  builder: (relooper: Relooper) => RelooperBlock
): string
{
  const relooper = new Relooper();
  const entry = builder(relooper);
  return relooper.render(entry);
}
