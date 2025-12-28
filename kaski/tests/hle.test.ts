import { describe, it, expect } from 'bun:test';
import { Memory } from '../src/core/memory/Memory';
import {
  MemoryManager, PartitionId, MemoryAnchor,
  ThreadManager, Thread, ThreadStatus,
  CallbackManager,
  ModuleManager, hleModule, nativeFunction,
  EmulatorContext,
  SceKernelErrors,
} from '../src/hle';

describe('MemoryManager', () =>
{
  it('should allocate from user partition', () =>
  {
    const mm = new MemoryManager();
    const { block, error } = mm.allocate(PartitionId.User, 0x1000);

    expect(error).toBe(SceKernelErrors.ERROR_OK);
    expect(block).not.toBeNull();
    expect(block!.size).toBe(0x1000);
    expect(block!.allocated).toBe(true);
  });

  it('should allocate aligned memory', () =>
  {
    const mm = new MemoryManager();
    const { block } = mm.allocate(PartitionId.User, 0x100, MemoryAnchor.Low, 0, 0x1000);

    expect(block).not.toBeNull();
    expect(block!.address % 0x1000).toBe(0);
  });

  it('should allocate from high address', () =>
  {
    const mm = new MemoryManager();
    const { block: block1 } = mm.allocate(PartitionId.User, 0x1000, MemoryAnchor.High);
    const { block: block2 } = mm.allocate(PartitionId.User, 0x1000, MemoryAnchor.High);

    expect(block1).not.toBeNull();
    expect(block2).not.toBeNull();
    expect(block1!.address).toBeGreaterThan(block2!.address);
  });

  it('should free memory and merge blocks', () =>
  {
    const mm = new MemoryManager();
    const { block: block1 } = mm.allocate(PartitionId.User, 0x1000);
    const { block: block2 } = mm.allocate(PartitionId.User, 0x1000);

    const freeBefore = mm.getFreeMemory(PartitionId.User);
    mm.free(block1!);
    const freeAfter = mm.getFreeMemory(PartitionId.User);

    expect(freeAfter).toBe(freeBefore + 0x1000);

    mm.free(block2!);
    // After freeing both adjacent blocks, they should merge
  });

  it('should track free memory', () =>
  {
    const mm = new MemoryManager();
    const initialFree = mm.getFreeMemory(PartitionId.User);

    mm.allocate(PartitionId.User, 0x10000);
    const afterAlloc = mm.getFreeMemory(PartitionId.User);

    expect(afterAlloc).toBe(initialFree - 0x10000);
  });

  it('should fail on invalid partition', () =>
  {
    const mm = new MemoryManager();
    const { block, error } = mm.allocate(99 as PartitionId, 0x1000);

    expect(block).toBeNull();
    expect(error).toBe(SceKernelErrors.ERROR_KERNEL_ILLEGAL_PARTITION_ID);
  });
});

describe('ThreadManager', () =>
{
  it('should create threads', () =>
  {
    const mm = new MemoryManager();
    const tm = new ThreadManager(mm);

    const { thread, error } = tm.createThread('test', 0x08800000, 32);

    expect(error).toBe(SceKernelErrors.ERROR_OK);
    expect(thread).not.toBeNull();
    expect(thread!.name).toBe('test');
    expect(thread!.priority).toBe(32);
    expect(thread!.isDormant).toBe(true);
  });

  it('should validate priority range', () =>
  {
    const mm = new MemoryManager();
    const tm = new ThreadManager(mm);

    const { thread: t1 } = tm.createThread('low', 0x08800000, 0);
    const { thread: t2 } = tm.createThread('high', 0x08800000, 200);

    expect(t1).toBeNull();
    expect(t2).toBeNull();
  });

  it('should delete dormant threads', () =>
  {
    const mm = new MemoryManager();
    const tm = new ThreadManager(mm);

    const { thread } = tm.createThread('test', 0x08800000, 32);
    const uid = thread!.uid;

    const error = tm.deleteThread(uid);
    expect(error).toBe(SceKernelErrors.ERROR_OK);
    expect(tm.getThread(uid)).toBeUndefined();
  });

  it('should schedule by priority', () =>
  {
    const mm = new MemoryManager();
    const tm = new ThreadManager(mm);

    const { thread: t1 } = tm.createThread('low', 0x08800000, 50);
    const { thread: t2 } = tm.createThread('high', 0x08800000, 10);

    t1!.status = ThreadStatus.READY;
    t2!.status = ThreadStatus.READY;

    const next = tm.getNextThread();
    expect(next).toBe(t2); // Higher priority (lower number) wins
  });

  it('should suspend and resume threads', () =>
  {
    const mm = new MemoryManager();
    const tm = new ThreadManager(mm);

    const { thread } = tm.createThread('test', 0x08800000, 32);
    thread!.status = ThreadStatus.READY;

    tm.suspendThread(thread!.uid);
    expect(thread!.isSuspended).toBe(true);

    tm.resumeThread(thread!.uid);
    expect(thread!.isReady).toBe(true);
  });

  it('should change thread priority', () =>
  {
    const mm = new MemoryManager();
    const tm = new ThreadManager(mm);

    const { thread } = tm.createThread('test', 0x08800000, 32);
    tm.changeThreadPriority(thread!.uid, 64);

    expect(thread!.priority).toBe(64);
  });
});

describe('CallbackManager', () =>
{
  it('should create callbacks', () =>
  {
    const cm = new CallbackManager();

    const { callback, error } = cm.createCallback('test', 1, 0x08800000, 42);

    expect(error).toBe(SceKernelErrors.ERROR_OK);
    expect(callback).not.toBeNull();
    expect(callback!.name).toBe('test');
    expect(callback!.commonArg).toBe(42);
  });

  it('should notify callbacks', () =>
  {
    const cm = new CallbackManager();

    const { callback } = cm.createCallback('test', 1, 0x08800000);
    expect(callback!.isPending).toBe(false);

    cm.notifyCallback(callback!.uid, 100);
    expect(callback!.isPending).toBe(true);
    expect(callback!.notifyArg).toBe(100);
    expect(callback!.notifyCount).toBe(1);
  });

  it('should get pending callbacks for thread', () =>
  {
    const cm = new CallbackManager();

    const { callback: cb1 } = cm.createCallback('cb1', 1, 0x08800000);
    const { callback: cb2 } = cm.createCallback('cb2', 1, 0x08800000);
    cm.createCallback('cb3', 2, 0x08800000); // Different thread

    cm.notifyCallback(cb1!.uid, 0);
    cm.notifyCallback(cb2!.uid, 0);

    const pending = cm.getPendingCallbacks(1);
    expect(pending.length).toBe(2);
  });

  it('should delete callbacks', () =>
  {
    const cm = new CallbackManager();

    const { callback } = cm.createCallback('test', 1, 0x08800000);
    const uid = callback!.uid;

    cm.deleteCallback(uid);
    expect(cm.getCallback(uid)).toBeUndefined();
  });
});

describe('ModuleManager', () =>
{
  it('should register standalone functions', () =>
  {
    const mm = new ModuleManager();

    mm.registerFunction(0x12345678, 'testFunc', () => 42);

    const func = mm.getFunction(0x12345678);
    expect(func).not.toBeUndefined();
    expect(func!.name).toBe('testFunc');
  });

  it('should register module with decorators', () =>
  {
    @hleModule('TestModule')
    class TestModule
    {
      readonly name = 'TestModule';

      @nativeFunction(0xABCDEF00)
      testMethod(): number
      {
        return 123;
      }
    }

    const mm = new ModuleManager();
    mm.registerModule(TestModule);

    const func = mm.getFunction(0xABCDEF00);
    expect(func).not.toBeUndefined();
    expect(func!.name).toBe('TestModule::testMethod');
  });

  it('should get function by name', () =>
  {
    const mm = new ModuleManager();
    mm.registerFunction(0x11111111, 'MyModule::myFunc', () => 0);

    const func = mm.getFunctionByName('MyModule::myFunc');
    expect(func).not.toBeUndefined();
    expect(func!.nid).toBe(0x11111111);
  });
});

describe('EmulatorContext', () =>
{
  it('should create with all managers', () =>
  {
    const memory = new Memory();
    const ctx = new EmulatorContext(memory);

    expect(ctx.memory).toBe(memory);
    expect(ctx.memoryManager).toBeDefined();
    expect(ctx.threadManager).toBeDefined();
    expect(ctx.callbackManager).toBeDefined();
    expect(ctx.moduleManager).toBeDefined();
  });

  it('should reset all managers', () =>
  {
    const memory = new Memory();
    const ctx = new EmulatorContext(memory);

    // Allocate some memory
    ctx.memoryManager.allocate(PartitionId.User, 0x1000);
    const freeBefore = ctx.memoryManager.getFreeMemory(PartitionId.User);

    ctx.reset();
    const freeAfter = ctx.memoryManager.getFreeMemory(PartitionId.User);

    expect(freeAfter).toBeGreaterThan(freeBefore);
  });

  it('should read/write memory', () =>
  {
    const memory = new Memory();
    const ctx = new EmulatorContext(memory);

    ctx.write32(0x08800000, 0x12345678);
    expect(ctx.read32(0x08800000)).toBe(0x12345678);

    ctx.write16(0x08800010, 0xABCD);
    expect(ctx.read16(0x08800010)).toBe(0xABCD);

    ctx.write8(0x08800020, 0x42);
    expect(ctx.read8(0x08800020)).toBe(0x42);
  });

  it('should read/write strings', () =>
  {
    const memory = new Memory();
    const ctx = new EmulatorContext(memory);

    ctx.writeString(0x08800000, 'Hello World');
    expect(ctx.readString(0x08800000)).toBe('Hello World');
  });

  it('should start and stop', () =>
  {
    const memory = new Memory();
    const ctx = new EmulatorContext(memory);

    expect(ctx.running).toBe(false);
    ctx.start();
    expect(ctx.running).toBe(true);
    ctx.stop();
    expect(ctx.running).toBe(false);
  });
});
