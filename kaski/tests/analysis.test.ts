import { describe, it, expect, beforeEach } from 'bun:test';
import { Memory, MAIN_MEMORY_BASE } from '../src/core/memory';
import {
  BasicBlock,
  BlockType,
  ControlFlowGraph,
  FunctionFinder,
  FunctionSource,
  Analyzer,
} from '../src/analysis';

describe('ControlFlowGraph', () =>
{
  let memory: Memory;
  let cfg: ControlFlowGraph;

  beforeEach(() =>
  {
    memory = new Memory();
    cfg = new ControlFlowGraph();
    BasicBlock.resetIds();
  });

  describe('Basic Block Building', () =>
  {
    it('should create single block for linear code', () =>
    {
      // ADDIU $t0, $zero, 42
      memory.sw(MAIN_MEMORY_BASE, 0x2408002A);
      // ADDIU $t1, $zero, 10
      memory.sw(MAIN_MEMORY_BASE + 4, 0x2409000A);
      // ADD $t2, $t0, $t1
      memory.sw(MAIN_MEMORY_BASE + 8, 0x01095020);
      // SYSCALL
      memory.sw(MAIN_MEMORY_BASE + 12, 0x0000000C);

      cfg.build((addr) => memory.lw(addr), MAIN_MEMORY_BASE);

      expect(cfg.blocks.size).toBe(1);
      expect(cfg.entry).not.toBeNull();
      expect(cfg.entry!.instructions.length).toBe(4);
      expect(cfg.entry!.type).toBe(BlockType.SYSCALL);
    });

    it('should create multiple blocks for branching code', () =>
    {
      // ADDIU $t0, $zero, 5
      memory.sw(MAIN_MEMORY_BASE, 0x24080005);
      // BEQ $t0, $zero, +2 (skip to block 2)
      memory.sw(MAIN_MEMORY_BASE + 4, 0x11000002);
      // NOP (delay slot)
      memory.sw(MAIN_MEMORY_BASE + 8, 0x00000000);
      // ADDIU $t1, $zero, 10 (block 1 - fall through)
      memory.sw(MAIN_MEMORY_BASE + 12, 0x2409000A);
      // SYSCALL (block 2 - branch target)
      memory.sw(MAIN_MEMORY_BASE + 16, 0x0000000C);

      cfg.build((addr) => memory.lw(addr), MAIN_MEMORY_BASE);

      expect(cfg.blocks.size).toBeGreaterThanOrEqual(2);
      expect(cfg.entry).not.toBeNull();
      expect(cfg.entry!.type).toBe(BlockType.BRANCH);
    });

    it('should handle jump instructions', () =>
    {
      // J to MAIN_MEMORY_BASE + 0x100
      const target = (MAIN_MEMORY_BASE + 0x100) >> 2;
      memory.sw(MAIN_MEMORY_BASE, 0x08000000 | target);
      // NOP (delay slot)
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000);

      // Target block
      memory.sw(MAIN_MEMORY_BASE + 0x100, 0x2408002A); // ADDIU $t0, $zero, 42
      memory.sw(MAIN_MEMORY_BASE + 0x104, 0x0000000C); // SYSCALL

      cfg.build((addr) => memory.lw(addr), MAIN_MEMORY_BASE);

      expect(cfg.blocks.size).toBe(2);

      const entryBlock = cfg.blocks.get(MAIN_MEMORY_BASE);
      expect(entryBlock).not.toBeNull();
      expect(entryBlock!.type).toBe(BlockType.JUMP);
      expect(entryBlock!.successors.length).toBe(1);
    });

    it('should handle JAL instruction', () =>
    {
      // JAL to MAIN_MEMORY_BASE + 0x100
      const target = (MAIN_MEMORY_BASE + 0x100) >> 2;
      memory.sw(MAIN_MEMORY_BASE, 0x0C000000 | target);
      // NOP (delay slot)
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000);
      // SYSCALL (after call returns)
      memory.sw(MAIN_MEMORY_BASE + 8, 0x0000000C);

      // Target function
      memory.sw(MAIN_MEMORY_BASE + 0x100, 0x2408002A); // ADDIU $t0, $zero, 42
      memory.sw(MAIN_MEMORY_BASE + 0x104, 0x03E00008); // JR $ra
      memory.sw(MAIN_MEMORY_BASE + 0x108, 0x00000000); // NOP (delay slot)

      cfg.build((addr) => memory.lw(addr), MAIN_MEMORY_BASE);

      const entryBlock = cfg.blocks.get(MAIN_MEMORY_BASE);
      expect(entryBlock).not.toBeNull();
      expect(entryBlock!.type).toBe(BlockType.CALL);
    });

    it('should handle JR $ra (return)', () =>
    {
      // ADDIU $t0, $zero, 42
      memory.sw(MAIN_MEMORY_BASE, 0x2408002A);
      // JR $ra
      memory.sw(MAIN_MEMORY_BASE + 4, 0x03E00008);
      // NOP (delay slot)
      memory.sw(MAIN_MEMORY_BASE + 8, 0x00000000);

      cfg.build((addr) => memory.lw(addr), MAIN_MEMORY_BASE);

      expect(cfg.entry).not.toBeNull();
      expect(cfg.entry!.type).toBe(BlockType.RETURN);
      expect(cfg.entry!.successors.length).toBe(0);
    });
  });

  describe('Block Connectivity', () =>
  {
    it('should connect branch blocks correctly', () =>
    {
      // Block 0: compare and branch
      memory.sw(MAIN_MEMORY_BASE, 0x24080005);     // ADDIU $t0, $zero, 5
      memory.sw(MAIN_MEMORY_BASE + 4, 0x11000002); // BEQ $t0, $zero, +2
      memory.sw(MAIN_MEMORY_BASE + 8, 0x00000000); // NOP

      // Block 1: fall-through
      memory.sw(MAIN_MEMORY_BASE + 12, 0x2409000A); // ADDIU $t1, $zero, 10

      // Block 2: branch target / common exit
      memory.sw(MAIN_MEMORY_BASE + 16, 0x0000000C); // SYSCALL

      cfg.build((addr) => memory.lw(addr), MAIN_MEMORY_BASE);

      const entryBlock = cfg.entry;
      expect(entryBlock).not.toBeNull();
      expect(entryBlock!.successors.length).toBe(2);
    });

    it('should connect loop back edges', () =>
    {
      // Loop: count from 0 to 5
      // ADDIU $t0, $zero, 0
      memory.sw(MAIN_MEMORY_BASE, 0x24080000);
      // ADDIU $t1, $zero, 5
      memory.sw(MAIN_MEMORY_BASE + 4, 0x24090005);

      // Loop body (block 1)
      // ADDIU $t0, $t0, 1
      memory.sw(MAIN_MEMORY_BASE + 8, 0x25080001);
      // BNE $t0, $t1, -1 (loop back)
      memory.sw(MAIN_MEMORY_BASE + 12, 0x1509FFFF);
      // NOP
      memory.sw(MAIN_MEMORY_BASE + 16, 0x00000000);

      // Exit
      memory.sw(MAIN_MEMORY_BASE + 20, 0x0000000C); // SYSCALL

      cfg.build((addr) => memory.lw(addr), MAIN_MEMORY_BASE);

      expect(cfg.blocks.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Block Properties', () =>
  {
    it('should track delay slots correctly', () =>
    {
      // J to target
      const target = (MAIN_MEMORY_BASE + 0x100) >> 2;
      memory.sw(MAIN_MEMORY_BASE, 0x08000000 | target);
      // ADDIU $t0, $zero, 42 (delay slot - should execute)
      memory.sw(MAIN_MEMORY_BASE + 4, 0x2408002A);

      memory.sw(MAIN_MEMORY_BASE + 0x100, 0x0000000C); // SYSCALL

      cfg.build((addr) => memory.lw(addr), MAIN_MEMORY_BASE);

      const entryBlock = cfg.entry;
      expect(entryBlock).not.toBeNull();
      expect(entryBlock!.instructions.length).toBe(2);

      const delaySlotInstr = entryBlock!.instructions[1];
      expect(delaySlotInstr.isDelaySlot).toBe(true);
    });

    it('should compute block addresses correctly', () =>
    {
      memory.sw(MAIN_MEMORY_BASE, 0x2408002A);     // ADDIU
      memory.sw(MAIN_MEMORY_BASE + 4, 0x2409000A); // ADDIU
      memory.sw(MAIN_MEMORY_BASE + 8, 0x01095020); // ADD
      memory.sw(MAIN_MEMORY_BASE + 12, 0x0000000C); // SYSCALL

      cfg.build((addr) => memory.lw(addr), MAIN_MEMORY_BASE);

      const block = cfg.entry!;
      expect(block.startAddress).toBe(MAIN_MEMORY_BASE);
      expect(block.endAddress).toBe(MAIN_MEMORY_BASE + 16);
      expect(block.size).toBe(16);
    });
  });

  describe('Utility Methods', () =>
  {
    it('should find block containing address', () =>
    {
      memory.sw(MAIN_MEMORY_BASE, 0x2408002A);
      memory.sw(MAIN_MEMORY_BASE + 4, 0x2409000A);
      memory.sw(MAIN_MEMORY_BASE + 8, 0x0000000C);

      cfg.build((addr) => memory.lw(addr), MAIN_MEMORY_BASE);

      const block = cfg.getBlockAt(MAIN_MEMORY_BASE + 4);
      expect(block).not.toBeNull();
      expect(block!.startAddress).toBe(MAIN_MEMORY_BASE);
    });

    it('should get blocks in address order', () =>
    {
      // Create two blocks with a jump
      const target = (MAIN_MEMORY_BASE + 0x100) >> 2;
      memory.sw(MAIN_MEMORY_BASE, 0x08000000 | target);
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000);
      memory.sw(MAIN_MEMORY_BASE + 0x100, 0x0000000C);

      cfg.build((addr) => memory.lw(addr), MAIN_MEMORY_BASE);

      const blocks = cfg.getBlocksInOrder();
      expect(blocks.length).toBe(2);
      expect(blocks[0].startAddress).toBeLessThan(blocks[1].startAddress);
    });
  });
});

describe('FunctionFinder', () =>
{
  let memory: Memory;
  let finder: FunctionFinder;

  beforeEach(() =>
  {
    memory = new Memory();
    finder = new FunctionFinder();
    BasicBlock.resetIds();
  });

  describe('Function Detection via Calls', () =>
  {
    it('should detect function from JAL target', () =>
    {
      const funcAddr = MAIN_MEMORY_BASE + 0x100;

      // Main: call function
      const target = funcAddr >> 2;
      memory.sw(MAIN_MEMORY_BASE, 0x0C000000 | target); // JAL
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000);      // NOP
      memory.sw(MAIN_MEMORY_BASE + 8, 0x0000000C);      // SYSCALL

      // Function
      memory.sw(funcAddr, 0x2408002A);     // ADDIU $t0, $zero, 42
      memory.sw(funcAddr + 4, 0x03E00008); // JR $ra
      memory.sw(funcAddr + 8, 0x00000000); // NOP

      finder.findFunctions(
        (addr) => memory.lw(addr),
        [MAIN_MEMORY_BASE]
      );

      expect(finder.functions.size).toBe(2);
      expect(finder.getFunction(MAIN_MEMORY_BASE)).not.toBeNull();
      expect(finder.getFunction(funcAddr)).not.toBeNull();

      const func = finder.getFunction(funcAddr)!;
      expect(func.source).toBe(FunctionSource.CALL);
    });

    it('should detect multiple functions from call chain', () =>
    {
      const func1 = MAIN_MEMORY_BASE + 0x100;
      const func2 = MAIN_MEMORY_BASE + 0x200;

      // Main calls func1
      memory.sw(MAIN_MEMORY_BASE, 0x0C000000 | (func1 >> 2));
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000);
      memory.sw(MAIN_MEMORY_BASE + 8, 0x0000000C);

      // func1 calls func2
      memory.sw(func1, 0x0C000000 | (func2 >> 2));
      memory.sw(func1 + 4, 0x00000000);
      memory.sw(func1 + 8, 0x03E00008);
      memory.sw(func1 + 12, 0x00000000);

      // func2
      memory.sw(func2, 0x2408002A);
      memory.sw(func2 + 4, 0x03E00008);
      memory.sw(func2 + 8, 0x00000000);

      finder.findFunctions(
        (addr) => memory.lw(addr),
        [MAIN_MEMORY_BASE]
      );

      expect(finder.functions.size).toBe(3);
    });

    it('should track cross-references', () =>
    {
      const funcAddr = MAIN_MEMORY_BASE + 0x100;

      // Main calls function
      memory.sw(MAIN_MEMORY_BASE, 0x0C000000 | (funcAddr >> 2));
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000);
      memory.sw(MAIN_MEMORY_BASE + 8, 0x0000000C);

      // Function
      memory.sw(funcAddr, 0x2408002A);
      memory.sw(funcAddr + 4, 0x03E00008);
      memory.sw(funcAddr + 8, 0x00000000);

      finder.findFunctions(
        (addr) => memory.lw(addr),
        [MAIN_MEMORY_BASE]
      );

      const main = finder.getFunction(MAIN_MEMORY_BASE)!;
      const func = finder.getFunction(funcAddr)!;

      expect(main.calls).toContain(funcAddr);
      expect(func.calledBy).toContain(MAIN_MEMORY_BASE);
    });
  });

  describe('Prologue Detection', () =>
  {
    it('should detect function by stack frame setup', () =>
    {
      const funcAddr = MAIN_MEMORY_BASE + 0x100;

      // Function with standard prologue
      // ADDIU $sp, $sp, -32
      memory.sw(funcAddr, 0x27BDFFE0);
      // SW $ra, 28($sp)
      memory.sw(funcAddr + 4, 0xAFBF001C);
      // ... function body
      memory.sw(funcAddr + 8, 0x2408002A);
      // LW $ra, 28($sp)
      memory.sw(funcAddr + 12, 0x8FBF001C);
      // ADDIU $sp, $sp, 32
      memory.sw(funcAddr + 16, 0x27BD0020);
      // JR $ra
      memory.sw(funcAddr + 20, 0x03E00008);
      memory.sw(funcAddr + 24, 0x00000000);

      finder.findByPrologue(
        (addr) => memory.lw(addr),
        funcAddr,
        funcAddr + 4 // Only scan first instruction
      );

      expect(finder.functions.size).toBe(1);
      const func = finder.getFunction(funcAddr)!;
      expect(func.source).toBe(FunctionSource.PROLOGUE);
    });

    it('should detect function by SW $ra pattern', () =>
    {
      const funcAddr = MAIN_MEMORY_BASE + 0x100;

      // Function that starts with saving $ra
      // SW $ra, 0($sp)
      memory.sw(funcAddr, 0xAFBF0000);
      memory.sw(funcAddr + 4, 0x2408002A);
      memory.sw(funcAddr + 8, 0x03E00008);
      memory.sw(funcAddr + 12, 0x00000000);

      finder.findByPrologue(
        (addr) => memory.lw(addr),
        funcAddr,
        funcAddr + 16
      );

      expect(finder.functions.size).toBe(1);
    });
  });

  describe('Function Analysis', () =>
  {
    it('should compute function size', () =>
    {
      // Simple function
      memory.sw(MAIN_MEMORY_BASE, 0x2408002A);     // ADDIU
      memory.sw(MAIN_MEMORY_BASE + 4, 0x24090005); // ADDIU
      memory.sw(MAIN_MEMORY_BASE + 8, 0x03E00008); // JR $ra
      memory.sw(MAIN_MEMORY_BASE + 12, 0x00000000); // NOP

      finder.findFunctions(
        (addr) => memory.lw(addr),
        [MAIN_MEMORY_BASE]
      );

      const func = finder.getFunction(MAIN_MEMORY_BASE)!;
      expect(func.size).toBeGreaterThan(0);
      expect(func.endAddress).toBeGreaterThan(func.address);
    });

    it('should detect stack frame size', () =>
    {
      // Function with 32-byte stack frame
      // ADDIU $sp, $sp, -32
      memory.sw(MAIN_MEMORY_BASE, 0x27BDFFE0);
      memory.sw(MAIN_MEMORY_BASE + 4, 0xAFBF001C); // SW $ra
      memory.sw(MAIN_MEMORY_BASE + 8, 0x2408002A);
      memory.sw(MAIN_MEMORY_BASE + 12, 0x8FBF001C); // LW $ra
      memory.sw(MAIN_MEMORY_BASE + 16, 0x27BD0020); // ADDIU $sp, +32
      memory.sw(MAIN_MEMORY_BASE + 20, 0x03E00008); // JR $ra
      memory.sw(MAIN_MEMORY_BASE + 24, 0x00000000);

      finder.findFunctions(
        (addr) => memory.lw(addr),
        [MAIN_MEMORY_BASE]
      );

      const func = finder.getFunction(MAIN_MEMORY_BASE)!;
      expect(func.stackSize).toBe(32);
    });

    it('should build CFG for each function', () =>
    {
      memory.sw(MAIN_MEMORY_BASE, 0x2408002A);
      memory.sw(MAIN_MEMORY_BASE + 4, 0x03E00008);
      memory.sw(MAIN_MEMORY_BASE + 8, 0x00000000);

      finder.findFunctions(
        (addr) => memory.lw(addr),
        [MAIN_MEMORY_BASE]
      );

      const func = finder.getFunction(MAIN_MEMORY_BASE)!;
      expect(func.cfg).not.toBeNull();
      expect(func.cfg!.blocks.size).toBeGreaterThan(0);
    });
  });

  describe('Utility Methods', () =>
  {
    it('should find function containing address', () =>
    {
      memory.sw(MAIN_MEMORY_BASE, 0x2408002A);
      memory.sw(MAIN_MEMORY_BASE + 4, 0x24090005);
      memory.sw(MAIN_MEMORY_BASE + 8, 0x03E00008);
      memory.sw(MAIN_MEMORY_BASE + 12, 0x00000000);

      finder.findFunctions(
        (addr) => memory.lw(addr),
        [MAIN_MEMORY_BASE]
      );

      const func = finder.getFunctionContaining(MAIN_MEMORY_BASE + 4);
      expect(func).not.toBeNull();
      expect(func!.address).toBe(MAIN_MEMORY_BASE);
    });

    it('should get functions in address order', () =>
    {
      const func1 = MAIN_MEMORY_BASE;
      const func2 = MAIN_MEMORY_BASE + 0x100;

      memory.sw(func1, 0x0C000000 | (func2 >> 2));
      memory.sw(func1 + 4, 0x00000000);
      memory.sw(func1 + 8, 0x0000000C);

      memory.sw(func2, 0x2408002A);
      memory.sw(func2 + 4, 0x03E00008);
      memory.sw(func2 + 8, 0x00000000);

      finder.findFunctions(
        (addr) => memory.lw(addr),
        [MAIN_MEMORY_BASE]
      );

      const funcs = finder.getFunctionsInOrder();
      expect(funcs.length).toBe(2);
      expect(funcs[0].address).toBeLessThan(funcs[1].address);
    });

    it('should add user-defined functions', () =>
    {
      finder.addFunction(MAIN_MEMORY_BASE, 'myFunc', FunctionSource.USER, 1.0);

      const func = finder.getFunction(MAIN_MEMORY_BASE);
      expect(func).not.toBeNull();
      expect(func!.name).toBe('myFunc');
      expect(func!.source).toBe(FunctionSource.USER);
    });

    it('should update function with higher confidence', () =>
    {
      finder.addFunction(MAIN_MEMORY_BASE, 'sub_auto', FunctionSource.CALL, 0.5);
      finder.addFunction(MAIN_MEMORY_BASE, 'myFunc', FunctionSource.USER, 1.0);

      const func = finder.getFunction(MAIN_MEMORY_BASE);
      expect(func!.name).toBe('myFunc');
      expect(func!.confidence).toBe(1.0);
    });
  });
});

describe('Analyzer', () =>
{
  let memory: Memory;
  let analyzer: Analyzer;

  beforeEach(() =>
  {
    memory = new Memory();
    analyzer = new Analyzer();
    BasicBlock.resetIds();
  });

  describe('Analysis', () =>
  {
    it('should analyze code and find functions', () =>
    {
      const funcAddr = MAIN_MEMORY_BASE + 0x100;

      // Main calls function
      memory.sw(MAIN_MEMORY_BASE, 0x0C000000 | (funcAddr >> 2));
      memory.sw(MAIN_MEMORY_BASE + 4, 0x00000000);
      memory.sw(MAIN_MEMORY_BASE + 8, 0x0000000C);

      // Function
      memory.sw(funcAddr, 0x2408002A);
      memory.sw(funcAddr + 4, 0x03E00008);
      memory.sw(funcAddr + 8, 0x00000000);

      const result = analyzer.analyze(
        (addr) => memory.lw(addr),
        [MAIN_MEMORY_BASE]
      );

      expect(result.functions.length).toBe(2);
      expect(result.instructionCount).toBeGreaterThan(0);
      expect(result.analysisTime).toBeGreaterThanOrEqual(0);
    });

    it('should track analysis statistics', () =>
    {
      memory.sw(MAIN_MEMORY_BASE, 0x2408002A);
      memory.sw(MAIN_MEMORY_BASE + 4, 0x24090005);
      memory.sw(MAIN_MEMORY_BASE + 8, 0x0000000C);

      analyzer.analyze(
        (addr) => memory.lw(addr),
        [MAIN_MEMORY_BASE]
      );

      expect(analyzer.stats.functionsFound).toBe(1);
      expect(analyzer.stats.blocksAnalyzed).toBeGreaterThan(0);
    });

    it('should allow adding named functions', () =>
    {
      analyzer.addFunction(MAIN_MEMORY_BASE, 'myMain');

      const func = analyzer.getFunction(MAIN_MEMORY_BASE);
      expect(func).not.toBeNull();
      expect(func!.name).toBe('myMain');
    });
  });

  describe('ASM Output', () =>
  {
    it('should generate ASM for a function', () =>
    {
      memory.sw(MAIN_MEMORY_BASE, 0x2408002A);     // ADDIU $t0, $zero, 42
      memory.sw(MAIN_MEMORY_BASE + 4, 0x03E00008); // JR $ra
      memory.sw(MAIN_MEMORY_BASE + 8, 0x00000000); // NOP

      analyzer.analyze(
        (addr) => memory.lw(addr),
        [MAIN_MEMORY_BASE]
      );

      const func = analyzer.getFunction(MAIN_MEMORY_BASE)!;
      const asm = analyzer.functionToAsm(func);

      expect(asm).toContain('entry_');
      expect(asm).toContain('addiu');
      expect(asm).toContain('jr');
    });

    it('should generate full ASM output', () =>
    {
      memory.sw(MAIN_MEMORY_BASE, 0x2408002A);
      memory.sw(MAIN_MEMORY_BASE + 4, 0x0000000C);

      analyzer.analyze(
        (addr) => memory.lw(addr),
        [MAIN_MEMORY_BASE]
      );

      const asm = analyzer.toAsm();

      expect(asm).toContain('Generated by Kaski');
      expect(asm).toContain('Functions:');
    });

    it('should support ASM options', () =>
    {
      memory.sw(MAIN_MEMORY_BASE, 0x2408002A);
      memory.sw(MAIN_MEMORY_BASE + 4, 0x0000000C);

      analyzer.analyze(
        (addr) => memory.lw(addr),
        [MAIN_MEMORY_BASE]
      );

      const func = analyzer.getFunction(MAIN_MEMORY_BASE)!;
      const asm = analyzer.functionToAsm(func, {
        showBytes: true,
        showAddresses: true,
      });

      // Should include raw instruction bytes
      expect(asm).toContain('2408002a');
    });
  });

  describe('Disassembly', () =>
  {
    it('should disassemble a range', () =>
    {
      memory.sw(MAIN_MEMORY_BASE, 0x2408002A);
      memory.sw(MAIN_MEMORY_BASE + 4, 0x24090005);
      memory.sw(MAIN_MEMORY_BASE + 8, 0x01095020);

      const disasm = analyzer.disassembleRange(
        (addr) => memory.lw(addr),
        MAIN_MEMORY_BASE,
        3
      );

      expect(disasm).toContain('addiu');
      expect(disasm).toContain('add');
    });
  });

  describe('JSON Output', () =>
  {
    it('should convert analysis to JSON', () =>
    {
      memory.sw(MAIN_MEMORY_BASE, 0x2408002A);
      memory.sw(MAIN_MEMORY_BASE + 4, 0x0000000C);

      analyzer.analyze(
        (addr) => memory.lw(addr),
        [MAIN_MEMORY_BASE]
      );

      const json = analyzer.toJSON() as any;

      expect(json.stats).toBeDefined();
      expect(json.functions).toBeInstanceOf(Array);
      expect(json.functions.length).toBe(1);
      expect(json.functions[0].name).toContain('entry_');
    });
  });
});
