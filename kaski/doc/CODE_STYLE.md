# Code Style for Kaski

***Keep in mind that the code you write is not only read by yourself.***

Based on Sony's style, adapted for TypeScript.

## Naming Conventions

1. **Variables and functions**: lower camelCase
   ```typescript
   let shaderModifier: number;
   function generateVsFetchShader(): void;
   ```

2. **Classes, enums, interfaces, types**: Upper CamelCase (PascalCase)
   ```typescript
   class ConstantUpdateEngine {}
   enum PsslType {}
   interface VsStageRegisters {}
   ```

3. **Private class members**: Use `private` modifier (no prefix needed in TS)
   ```typescript
   class Example {
     private cmdPtr: number;
     private readonly handlers: Map<string, Handler>;
   }
   ```

4. **Constants and enum values**: UPPER_SNAKE_CASE or PascalCase
   ```typescript
   const MAIN_MEMORY_BASE = 0x08000000;
   enum CpuStatus {
     STOPPED = 0,
     RUNNING = 1,
   }
   ```

5. **Type parameters**: Single uppercase letter or descriptive name
   ```typescript
   function process<T>(item: T): T;
   ```

## Formatting

1. **Braces on new line** (Allman style)
   ```typescript
   if (shaderResourceOffset !== 0)
   {
     doSomething();
   }
   ```

2. **Always use braces** even for single-line statements
   ```typescript
   // Good
   if (condition)
   {
     return;
   }

   // Bad
   if (condition) return;
   ```

3. **Indentation**: 2 spaces (TypeScript standard)

## Code Structure Rules

### Must Follow

1. **Maximum nesting: 3 levels**. Use early returns/continues to reduce nesting.

   ```typescript
   // Recommended
   if (!isFileExist(fileName))
   {
     return;
   }
   if (isFileBroken(fileName))
   {
     return;
   }
   const result = processFile(fileName);

   // Discouraged
   if (isFileExist(fileName))
   {
     if (!isFileBroken(fileName))
     {
       const result = processFile(fileName);
     }
   }
   ```

2. **Function length**: Maximum 50-80 lines (screen height).
   Exception: Large switch statements or lookup tables.

3. **No magic numbers**: Give meaningful names.
   ```typescript
   // Good
   const VRAM_SIZE = 0x00200000;
   memory.allocate(VRAM_SIZE);

   // Bad
   memory.allocate(0x00200000);
   ```

4. **Initialize variables when defined**
   ```typescript
   let count = 0;
   const handlers = new Map<string, Handler>();
   ```

5. **No exceptions for control flow**: Use Result types or return values.

### Recommended

1. **One function, one return** when possible. Use early exit pattern:
   ```typescript
   function loadModule(fileName: string): Module | null
   {
     if (!fileName)
     {
       return null;
     }

     const file = readFile(fileName);
     if (!file)
     {
       return null;
     }

     // Main logic here
     return parseModule(file);
   }
   ```

2. **Guard clauses at the beginning** of functions:
   ```typescript
   function process(data: Data): Result
   {
     // Guards first
     if (!data)
     {
       return Result.Error;
     }
     if (!data.isValid)
     {
       return Result.Invalid;
     }

     // Main logic after guards
     return doProcess(data);
   }
   ```

3. **Design before coding**: Think about class responsibilities and code reuse.

4. **Simple return types**: Prefer `void`, `boolean`, `number`, or simple objects.

5. **Descriptive names**: Use `textureAlign`, not `tA`.

6. **Minimal scope**: Local > class member > global.

7. **Minimal imports**: Use only what's needed.

## TypeScript Specific

1. **Use strict types**: Enable `strict` mode in tsconfig.
   ```typescript
   // Good
   function getGpr(index: number): number

   // Bad
   function getGpr(index: any): any
   ```

2. **Prefer `readonly` for immutable properties**:
   ```typescript
   class CpuState
   {
     readonly gpr = new Int32Array(32);
     private readonly fprBuffer = new ArrayBuffer(32 * 4);
   }
   ```

3. **Use `const enum` for performance-critical enums**:
   ```typescript
   const enum ExecutionResult
   {
     CONTINUE = 0,
     BRANCH = 1,
     SYSCALL = 2,
   }
   ```

4. **Explicit return types** on public functions:
   ```typescript
   public execute(cpu: CpuState, instr: Instruction): ExecutionResult
   ```

5. **Use `>>>` for unsigned operations**:
   ```typescript
   const address = (base + offset) >>> 0;  // Ensure unsigned 32-bit
   ```

## Memory and Performance

1. **Use TypedArrays** for numerical data:
   ```typescript
   readonly gpr = new Int32Array(32);
   readonly fpr = new Float32Array(32);
   ```

2. **Avoid allocations in hot paths**: Pre-allocate buffers.

3. **Use `Map` over objects** for dynamic lookups:
   ```typescript
   private handlers = new Map<string, Handler>();
   ```

## Comments

1. **Section separators** for large files:
   ```typescript
   // ============================================
   // Arithmetic Operations
   // ============================================
   ```

2. **JSDoc for public APIs**:
   ```typescript
   /**
    * Execute a single instruction at current PC
    * @returns Execution status after the instruction
    */
   step(): CpuStatus
   ```

3. **Inline comments for complex logic**:
   ```typescript
   // Sign-extend 16-bit immediate to 32-bit
   const signed = (value << 16) >> 16;
   ```

## File Organization

```
src/
  core/
    cpu/
      Cpu.ts              # Main CPU class
      CpuState.ts         # Register state
      Instruction.ts      # Instruction decoding
      InstructionType.ts  # Instruction definitions
      InstructionTable.ts # Instruction lookup
      Interpreter.ts      # Execution engine
      Disassembler.ts     # Disassembly
      index.ts            # Public exports
    memory/
      Memory.ts
      constants.ts
      index.ts
tests/
  cpu.test.ts
  memory.test.ts
doc/
  CODE_STYLE.md
  STATIC_ANALYSIS.md
```

## Example: Well-Structured Function

```typescript
/**
 * Execute a single instruction
 */
public execute(cpu: CpuState, instr: Instruction): ExecutionResult
{
  const type = this.table.find(instr.data);

  if (!type)
  {
    console.warn(`Unknown instruction: 0x${instr.data.toString(16)}`);
    return ExecutionResult.UNKNOWN;
  }

  const handler = this.handlers.get(type.name);
  if (!handler)
  {
    console.warn(`Unimplemented: ${type.name}`);
    return ExecutionResult.UNKNOWN;
  }

  return handler(cpu, instr);
}
```
