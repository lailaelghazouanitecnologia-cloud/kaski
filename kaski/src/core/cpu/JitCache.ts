import type { CpuState } from './CpuState';
import type { Memory } from '../memory';
import { CodeGenerator, type GeneratedFunction } from './CodeGenerator';

/**
 * Cached compiled function wrapper
 *
 * Supports lazy compilation and invalidation
 */
class CachedFunction
{
  private compiled: GeneratedFunction | null = null;
  private generator: CodeGenerator;
  private memory: Memory;

  constructor(
    public readonly startPc: number,
    generator: CodeGenerator,
    memory: Memory
  )
  {
    this.generator = generator;
    this.memory = memory;
  }

  /**
   * Execute this function
   *
   * Lazily compiles on first execution
   *
   * @returns Next PC to execute, or -1 for syscall, -2 for break
   */
  execute(state: CpuState): number
  {
    if (this.compiled === null)
    {
      this.compiled = this.generator.generate(
        (addr) => this.memory.lw(addr),
        this.startPc
      );

      if (this.compiled === null)
      {
        // Compilation failed - return for interpreter fallback
        return -1;
      }
    }

    return this.compiled.func(state);
  }

  /**
   * Invalidate this cached function
   *
   * Will be recompiled on next execution
   */
  invalidate(): void
  {
    this.compiled = null;
  }

  /**
   * Check if this function is compiled
   */
  get isCompiled(): boolean
  {
    return this.compiled !== null;
  }

  /**
   * Get info about the compiled function
   */
  get info(): GeneratedFunction | null
  {
    return this.compiled;
  }
}

/**
 * JIT Cache - Manages compiled function cache
 *
 * Provides lazy compilation and cache invalidation for self-modifying code
 */
export class JitCache
{
  private cache: Map<number, CachedFunction> = new Map();
  private generator: CodeGenerator;
  private memory: Memory;

  /** Cache statistics */
  stats = {
    hits: 0,
    misses: 0,
    compilations: 0,
    invalidations: 0,
  };

  constructor(memory: Memory)
  {
    this.generator = new CodeGenerator();
    this.memory = memory;
  }

  /**
   * Get or create a compiled function for the given PC
   */
  get(pc: number): CachedFunction
  {
    let cached = this.cache.get(pc);

    if (cached)
    {
      this.stats.hits++;
      return cached;
    }

    this.stats.misses++;
    cached = new CachedFunction(pc, this.generator, this.memory);
    this.cache.set(pc, cached);
    return cached;
  }

  /**
   * Execute compiled code starting at the given PC
   *
   * @returns Next PC to execute, or -1 for syscall, -2 for break
   */
  execute(state: CpuState, pc: number): number
  {
    const cached = this.get(pc);

    if (!cached.isCompiled)
    {
      this.stats.compilations++;
    }

    return cached.execute(state);
  }

  /**
   * Invalidate all cached functions
   */
  invalidateAll(): void
  {
    for (const cached of this.cache.values())
    {
      cached.invalidate();
    }
    this.cache.clear();
    this.stats.invalidations++;
  }

  /**
   * Invalidate cached functions in a memory range
   *
   * Call this when memory is written to in executable regions
   */
  invalidateRange(from: number, to: number): void
  {
    for (const [pc, cached] of this.cache)
    {
      if (pc >= from && pc < to)
      {
        cached.invalidate();
        this.cache.delete(pc);
      }
      else if (cached.isCompiled && cached.info)
      {
        // Check if the range overlaps with the compiled block
        const info = cached.info;
        if (info.startPc < to && info.endPc > from)
        {
          cached.invalidate();
          this.cache.delete(pc);
        }
      }
    }
    this.stats.invalidations++;
  }

  /**
   * Get cache size
   */
  get size(): number
  {
    return this.cache.size;
  }

  /**
   * Get number of compiled functions
   */
  get compiledCount(): number
  {
    let count = 0;
    for (const cached of this.cache.values())
    {
      if (cached.isCompiled) count++;
    }
    return count;
  }

  /**
   * Clear the cache
   */
  clear(): void
  {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      compilations: 0,
      invalidations: 0,
    };
  }

  /**
   * Get cache statistics summary
   */
  getStats(): string
  {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    return [
      `Cache size: ${this.size}`,
      `Compiled: ${this.compiledCount}`,
      `Hits: ${this.stats.hits}`,
      `Misses: ${this.stats.misses}`,
      `Hit rate: ${(hitRate * 100).toFixed(1)}%`,
      `Compilations: ${this.stats.compilations}`,
      `Invalidations: ${this.stats.invalidations}`,
    ].join('\n');
  }
}
