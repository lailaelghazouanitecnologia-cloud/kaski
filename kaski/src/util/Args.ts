/**
 * Args - Automatic argument extraction for HLE functions
 *
 * Decorator-based system to automatically extract PSP syscall arguments
 * from the CPU state, reducing boilerplate code.
 */

/**
 * Argument types supported by PSP syscalls
 */
export type ArgType =
  | 'i32'      // Signed 32-bit integer
  | 'u32'      // Unsigned 32-bit integer
  | 'i64'      // Signed 64-bit integer (uses 2 registers)
  | 'u64'      // Unsigned 64-bit integer (uses 2 registers)
  | 'ptr'      // Pointer (unsigned 32-bit)
  | 'str'      // String pointer (auto-read)
  | 'f32'      // 32-bit float
  | 'bool';    // Boolean (0 = false, else true)

/**
 * Metadata key for storing argument info
 */
const ARGS_METADATA = Symbol('args_metadata');

/**
 * Argument metadata stored on functions
 */
interface ArgsMetadata
{
  types: ArgType[];
}

/**
 * Get stored argument metadata
 */
export function getArgsMetadata(target: object, propertyKey: string | symbol): ArgsMetadata | undefined
{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (target as any)[ARGS_METADATA]?.[propertyKey];
}

/**
 * @args decorator - Defines argument types for automatic extraction
 *
 * @example
 * ```typescript
 * @nativeFunction(0x446D8DE6, 150)
 * @args('ptr', 'u32', 'i32', 'u32', 'u32')
 * sceKernelCreateThread(
 *   namePtr: number,
 *   entry: number,
 *   priority: number,
 *   stackSize: number,
 *   attr: number
 * ): number {
 *   // Arguments are already extracted and typed
 * }
 * ```
 */
export function args(...types: ArgType[]): MethodDecorator
{
  return function(
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor
  {
    // Store metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = (target as any)[ARGS_METADATA] ??= {};
    metadata[propertyKey] = { types };

    const originalMethod = descriptor.value;

    descriptor.value = function(this: HleModuleWithContext, ...manualArgs: unknown[])
    {
      // If manual args provided, use them (for testing)
      if (manualArgs.length > 0)
      {
        return originalMethod.apply(this, manualArgs);
      }

      // Extract arguments from CPU state
      const extractedArgs = extractArguments(this.ctx, types);
      return originalMethod.apply(this, extractedArgs);
    };

    return descriptor;
  };
}

/**
 * Interface for HLE module with context
 */
interface HleModuleWithContext
{
  ctx: ArgContext;
}

/**
 * Minimal context interface for argument extraction
 */
interface ArgContext
{
  arg(index: number): number;
  argPtr(index: number): number;
  arg64(index: number): { low: number; high: number };
  argFloat(index: number): number;
  readString(address: number): string;
}

/**
 * Extract arguments from context based on types
 */
export function extractArguments(ctx: ArgContext, types: ArgType[]): unknown[]
{
  const args: unknown[] = [];
  let regIndex = 0;

  for (const type of types)
  {
    switch (type)
    {
      case 'i32':
        args.push(ctx.arg(regIndex) | 0);
        regIndex++;
        break;

      case 'u32':
      case 'ptr':
        args.push(ctx.arg(regIndex) >>> 0);
        regIndex++;
        break;

      case 'i64':
      case 'u64':
        {
          // MIPS 64-bit args must be aligned to even register
          if (regIndex % 2 !== 0) regIndex++;
          const value = ctx.arg64(regIndex);
          args.push(value);
          regIndex += 2;
        }
        break;

      case 'str':
        {
          const ptr = ctx.argPtr(regIndex);
          args.push(ptr ? ctx.readString(ptr) : '');
          regIndex++;
        }
        break;

      case 'f32':
        args.push(ctx.argFloat(regIndex));
        regIndex++;
        break;

      case 'bool':
        args.push(ctx.arg(regIndex) !== 0);
        regIndex++;
        break;
    }
  }

  return args;
}

/**
 * Create argument extractor function for a specific signature
 * (Useful for hot paths where decorator overhead matters)
 */
export function createArgExtractor(types: ArgType[]): (ctx: ArgContext) => unknown[]
{
  // Generate optimized extractor based on types
  return (ctx: ArgContext) => extractArguments(ctx, types);
}

/**
 * Type helper to infer function parameter types from ArgType array
 */
export type ArgTypeToTS<T extends ArgType> =
  T extends 'i32' ? number :
  T extends 'u32' ? number :
  T extends 'ptr' ? number :
  T extends 'i64' ? { low: number; high: number } :
  T extends 'u64' ? { low: number; high: number } :
  T extends 'str' ? string :
  T extends 'f32' ? number :
  T extends 'bool' ? boolean :
  never;

/**
 * Helper type to map ArgType tuple to TypeScript types
 */
export type ArgsToTS<T extends readonly ArgType[]> = {
  [K in keyof T]: T[K] extends ArgType ? ArgTypeToTS<T[K]> : never;
};
