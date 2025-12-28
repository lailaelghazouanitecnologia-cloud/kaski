/**
 * Tests for utility abstractions
 */

import { describe, it, expect } from 'bun:test';
import {
  Ok, Err, isOk, isErr, unwrap, unwrapOr, unwrapOrElse,
  map, mapErr, andThen, orElse, match, fromNullable, tryCatch, all,
  ResultAsync
} from '../src/util/Result';
import { BitFlags, flagMapping } from '../src/util/BitFlags';
import { extractArguments } from '../src/util/Args';
import { WaitQueue, Semaphore, Mutex, WaitStatus } from '../src/util/WaitQueue';
import { PromiseFast } from '../src/util/PromiseFast';

// ============================================
// Result Tests
// ============================================

describe('Result', () =>
{
  describe('Ok and Err', () =>
  {
    it('should create Ok result', () =>
    {
      const result = Ok(42);
      expect(result.ok).toBe(true);
      expect(isOk(result)).toBe(true);
      expect(isErr(result)).toBe(false);
      if (result.ok) expect(result.value).toBe(42);
    });

    it('should create Err result', () =>
    {
      const result = Err('error');
      expect(result.ok).toBe(false);
      expect(isOk(result)).toBe(false);
      expect(isErr(result)).toBe(true);
      if (!result.ok) expect(result.error).toBe('error');
    });
  });

  describe('unwrap', () =>
  {
    it('should unwrap Ok value', () =>
    {
      expect(unwrap(Ok(42))).toBe(42);
    });

    it('should throw on unwrap Err', () =>
    {
      expect(() => unwrap(Err('error'))).toThrow();
    });

    it('should unwrapOr with default', () =>
    {
      expect(unwrapOr(Ok(42), 0)).toBe(42);
      expect(unwrapOr(Err('error'), 0)).toBe(0);
    });

    it('should unwrapOrElse with function', () =>
    {
      expect(unwrapOrElse(Ok(42), () => 0)).toBe(42);
      expect(unwrapOrElse(Err('error'), e => e.length)).toBe(5);
    });
  });

  describe('map', () =>
  {
    it('should map Ok value', () =>
    {
      const result = map(Ok(2), x => x * 2);
      expect(unwrap(result)).toBe(4);
    });

    it('should not map Err', () =>
    {
      const result = map(Err<number>('error'), x => x * 2);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('mapErr', () =>
  {
    it('should map Err value', () =>
    {
      const result = mapErr(Err('error'), e => e.toUpperCase());
      if (!result.ok) expect(result.error).toBe('ERROR');
    });

    it('should not map Ok', () =>
    {
      const result = mapErr(Ok(42), (e: string) => e.toUpperCase());
      expect(unwrap(result)).toBe(42);
    });
  });

  describe('andThen', () =>
  {
    it('should chain Ok results', () =>
    {
      const result = andThen(Ok(2), x => Ok(x * 3));
      expect(unwrap(result)).toBe(6);
    });

    it('should short-circuit on Err', () =>
    {
      const result = andThen(Err<number>('error'), x => Ok(x * 3));
      expect(isErr(result)).toBe(true);
    });
  });

  describe('orElse', () =>
  {
    it('should recover from Err', () =>
    {
      const result = orElse(Err('error'), () => Ok(42));
      expect(unwrap(result)).toBe(42);
    });

    it('should not run on Ok', () =>
    {
      const result = orElse(Ok(42), () => Ok(0));
      expect(unwrap(result)).toBe(42);
    });
  });

  describe('match', () =>
  {
    it('should match Ok', () =>
    {
      const result = match(Ok(42), v => `value: ${v}`, e => `error: ${e}`);
      expect(result).toBe('value: 42');
    });

    it('should match Err', () =>
    {
      const result = match(Err('oops'), v => `value: ${v}`, e => `error: ${e}`);
      expect(result).toBe('error: oops');
    });
  });

  describe('fromNullable', () =>
  {
    it('should convert value to Ok', () =>
    {
      expect(isOk(fromNullable(42, 'null'))).toBe(true);
    });

    it('should convert null to Err', () =>
    {
      expect(isErr(fromNullable(null, 'null'))).toBe(true);
    });

    it('should convert undefined to Err', () =>
    {
      expect(isErr(fromNullable(undefined, 'null'))).toBe(true);
    });
  });

  describe('tryCatch', () =>
  {
    it('should catch success', () =>
    {
      const result = tryCatch(() => 42);
      expect(unwrap(result)).toBe(42);
    });

    it('should catch error', () =>
    {
      const result = tryCatch(() => { throw new Error('oops'); });
      expect(isErr(result)).toBe(true);
    });
  });

  describe('all', () =>
  {
    it('should combine all Ok', () =>
    {
      const result = all([Ok(1), Ok(2), Ok(3)]);
      expect(unwrap(result)).toEqual([1, 2, 3]);
    });

    it('should fail on any Err', () =>
    {
      const result = all([Ok(1), Err('error'), Ok(3)]);
      expect(isErr(result)).toBe(true);
    });
  });
});

describe('ResultAsync', () =>
{
  it('should map async', async () =>
  {
    const result = await ResultAsync.ok(2).map(x => x * 3).toPromise();
    expect(unwrap(result)).toBe(6);
  });

  it('should chain async', async () =>
  {
    const result = await ResultAsync.ok(2)
      .andThen(x => Ok(x * 3))
      .toPromise();
    expect(unwrap(result)).toBe(6);
  });

  it('should match async', async () =>
  {
    const value = await ResultAsync.ok(42).match(
      v => `ok: ${v}`,
      e => `err: ${e}`
    );
    expect(value).toBe('ok: 42');
  });
});

// ============================================
// BitFlags Tests
// ============================================

describe('BitFlags', () =>
{
  const enum TestFlags
  {
    A = 0x01,
    B = 0x02,
    C = 0x04,
    D = 0x08,
  }

  describe('basic operations', () =>
  {
    it('should set and check flags', () =>
    {
      const flags = new BitFlags<TestFlags>();
      flags.set(TestFlags.A);
      expect(flags.has(TestFlags.A)).toBe(true);
      expect(flags.has(TestFlags.B)).toBe(false);
    });

    it('should clear flags', () =>
    {
      const flags = new BitFlags<TestFlags>(TestFlags.A | TestFlags.B);
      flags.clear(TestFlags.A);
      expect(flags.has(TestFlags.A)).toBe(false);
      expect(flags.has(TestFlags.B)).toBe(true);
    });

    it('should toggle flags', () =>
    {
      const flags = new BitFlags<TestFlags>(TestFlags.A);
      flags.toggle(TestFlags.A);
      expect(flags.has(TestFlags.A)).toBe(false);
      flags.toggle(TestFlags.A);
      expect(flags.has(TestFlags.A)).toBe(true);
    });

    it('should check multiple flags', () =>
    {
      const flags = new BitFlags<TestFlags>(TestFlags.A | TestFlags.B);
      expect(flags.hasAll(TestFlags.A, TestFlags.B)).toBe(true);
      expect(flags.hasAll(TestFlags.A, TestFlags.C)).toBe(false);
      expect(flags.hasAny(TestFlags.A, TestFlags.C)).toBe(true);
      expect(flags.hasAny(TestFlags.C, TestFlags.D)).toBe(false);
    });
  });

  describe('map', () =>
  {
    const enum PspFlags
    {
      Read = 0x0001,
      Write = 0x0002,
      Append = 0x0100,
      Create = 0x0200,
    }

    const enum OpenFlags
    {
      Read = 1,
      Write = 2,
      Append = 4,
      Create = 8,
    }

    it('should map flags', () =>
    {
      const pspValue = PspFlags.Read | PspFlags.Create;
      const mapped = BitFlags.map(pspValue, [
        [PspFlags.Read, OpenFlags.Read],
        [PspFlags.Write, OpenFlags.Write],
        [PspFlags.Append, OpenFlags.Append],
        [PspFlags.Create, OpenFlags.Create],
      ]);

      expect(mapped.has(OpenFlags.Read)).toBe(true);
      expect(mapped.has(OpenFlags.Create)).toBe(true);
      expect(mapped.has(OpenFlags.Write)).toBe(false);
      expect(mapped.has(OpenFlags.Append)).toBe(false);
    });
  });

  describe('bit manipulation', () =>
  {
    it('should extract bits', () =>
    {
      expect(BitFlags.extract(0b11010110, 1, 3)).toBe(0b011);
      expect(BitFlags.extract(0xFF00, 8, 8)).toBe(0xFF);
    });

    it('should insert bits', () =>
    {
      expect(BitFlags.insert(0b11110000, 0b101, 0, 4)).toBe(0b11110101);
      expect(BitFlags.insert(0x0000, 0xFF, 8, 8)).toBe(0xFF00);
    });

    it('should count bits', () =>
    {
      expect(BitFlags.popcount(0)).toBe(0);
      expect(BitFlags.popcount(1)).toBe(1);
      expect(BitFlags.popcount(0b10101010)).toBe(4);
      expect(BitFlags.popcount(0xFFFFFFFF)).toBe(32);
    });

    it('should find first set bit', () =>
    {
      expect(BitFlags.ffs(0)).toBe(0);
      expect(BitFlags.ffs(1)).toBe(1);
      expect(BitFlags.ffs(0b1000)).toBe(4);
      expect(BitFlags.ffs(0b1010)).toBe(2);
    });

    it('should find last set bit', () =>
    {
      expect(BitFlags.fls(0)).toBe(0);
      expect(BitFlags.fls(1)).toBe(1);
      expect(BitFlags.fls(0b1000)).toBe(4);
      expect(BitFlags.fls(0x80000000)).toBe(32);
    });
  });
});

// ============================================
// Args Tests
// ============================================

describe('Args', () =>
{
  describe('extractArguments', () =>
  {
    it('should extract i32 arguments', () =>
    {
      const ctx = {
        arg: (i: number) => i === 0 ? -1 : 42,
        argPtr: (i: number) => i * 0x1000,
        arg64: () => ({ low: 0, high: 0 }),
        argFloat: () => 0,
        readString: () => '',
      };

      const args = extractArguments(ctx, ['i32', 'i32']);
      expect(args[0]).toBe(-1);
      expect(args[1]).toBe(42);
    });

    it('should extract u32 arguments', () =>
    {
      const ctx = {
        arg: () => 0xFFFFFFFF,
        argPtr: () => 0,
        arg64: () => ({ low: 0, high: 0 }),
        argFloat: () => 0,
        readString: () => '',
      };

      const args = extractArguments(ctx, ['u32']);
      expect(args[0]).toBe(0xFFFFFFFF);
    });

    it('should extract ptr arguments', () =>
    {
      const ctx = {
        arg: (i: number) => 0x08800000 + i * 0x100,
        argPtr: (i: number) => 0x08800000 + i * 0x100,
        arg64: () => ({ low: 0, high: 0 }),
        argFloat: () => 0,
        readString: () => '',
      };

      const args = extractArguments(ctx, ['ptr', 'ptr']);
      expect(args[0]).toBe(0x08800000);
      expect(args[1]).toBe(0x08800100);
    });

    it('should extract str arguments', () =>
    {
      const ctx = {
        arg: () => 0x08800000,
        argPtr: () => 0x08800000,
        arg64: () => ({ low: 0, high: 0 }),
        argFloat: () => 0,
        readString: (addr: number) => addr === 0x08800000 ? 'hello' : 'world',
      };

      const args = extractArguments(ctx, ['str']);
      expect(args[0]).toBe('hello');
    });

    it('should extract bool arguments', () =>
    {
      const ctx = {
        arg: (i: number) => i === 0 ? 0 : 1,
        argPtr: () => 0,
        arg64: () => ({ low: 0, high: 0 }),
        argFloat: () => 0,
        readString: () => '',
      };

      const args = extractArguments(ctx, ['bool', 'bool']);
      expect(args[0]).toBe(false);
      expect(args[1]).toBe(true);
    });

    it('should extract i64 with alignment', () =>
    {
      const ctx = {
        arg: () => 0,
        argPtr: () => 0,
        arg64: (i: number) => ({ low: i === 0 ? 0x12345678 : 0, high: i === 0 ? 0xDEADBEEF : 0 }),
        argFloat: () => 0,
        readString: () => '',
      };

      const args = extractArguments(ctx, ['i64']);
      const val = args[0] as { low: number; high: number };
      expect(val.low).toBe(0x12345678);
      expect(val.high).toBe(0xDEADBEEF);
    });
  });
});

// ============================================
// WaitQueue Tests
// ============================================

describe('WaitQueue', () =>
{
  function createWaitable(uid: number): { uid: number; status: number; wakeupCount: number }
  {
    return { uid, status: WaitStatus.READY, wakeupCount: 0 };
  }

  describe('acquire', () =>
  {
    it('should acquire immediately if condition met', () =>
    {
      const queue = new WaitQueue<{ value: number }>();
      const resource = { value: 10 };
      const thread = createWaitable(1);

      const result = queue.acquire(
        resource,
        r => r.value >= 5,
        r => { r.value -= 5; return 0; },
        thread
      );

      expect(result).toBe(0);
      expect(resource.value).toBe(5);
      expect(thread.status).toBe(WaitStatus.READY);
    });

    it('should wait if condition not met', async () =>
    {
      const queue = new WaitQueue<{ value: number }>();
      const resource = { value: 0 };
      const thread = createWaitable(1);

      const promise = queue.acquire(
        resource,
        r => r.value >= 5,
        r => { r.value -= 5; return 0; },
        thread
      );

      expect(queue.length).toBe(1);
      expect(thread.status).toBe(WaitStatus.WAIT);

      // Signal with enough value
      resource.value = 10;
      queue.signal(resource);

      const result = await promise;
      expect(result).toBe(0);
      expect(resource.value).toBe(5);
      expect(thread.status).toBe(WaitStatus.READY);
    });
  });

  describe('signal', () =>
  {
    it('should wake one waiter by default', async () =>
    {
      const queue = new WaitQueue<{ value: number }>();
      const resource = { value: 0 };
      const t1 = createWaitable(1);
      const t2 = createWaitable(2);

      const p1 = queue.acquire(resource, r => r.value > 0, () => 1, t1);
      const p2 = queue.acquire(resource, r => r.value > 0, () => 2, t2);

      expect(queue.length).toBe(2);

      resource.value = 1;
      const woken = queue.signal(resource);

      expect(woken).toBe(1);
      expect(queue.length).toBe(1);

      const r1 = await p1;
      expect(r1).toBe(1);
    });

    it('should wake all when requested', async () =>
    {
      const queue = new WaitQueue<{ value: number }>();
      const resource = { value: 0 };
      const t1 = createWaitable(1);
      const t2 = createWaitable(2);

      const p1 = queue.acquire(resource, r => r.value > 0, () => 1, t1);
      const p2 = queue.acquire(resource, r => r.value > 0, () => 2, t2);

      resource.value = 1;
      const woken = queue.signal(resource, true);

      expect(woken).toBe(2);
      expect(queue.length).toBe(0);
    });
  });

  describe('cancelAll', () =>
  {
    it('should cancel all waiters', async () =>
    {
      const queue = new WaitQueue<{ value: number }>();
      const resource = { value: 0 };
      const t1 = createWaitable(1);
      const t2 = createWaitable(2);

      const p1 = queue.acquire(resource, r => r.value > 0, () => 0, t1) as PromiseFast<number>;
      const p2 = queue.acquire(resource, r => r.value > 0, () => 0, t2) as PromiseFast<number>;

      const cancelled = queue.cancelAll(0x80000001);

      expect(cancelled).toBe(2);
      expect(queue.length).toBe(0);

      // Convert to native Promise for expect().rejects
      await expect(p1.toPromise()).rejects.toBe(0x80000001);
      await expect(p2.toPromise()).rejects.toBe(0x80000001);
    });
  });
});

describe('Semaphore', () =>
{
  function createWaitable(uid: number): { uid: number; status: number; wakeupCount: number }
  {
    return { uid, status: WaitStatus.READY, wakeupCount: 0 };
  }

  it('should wait immediately if count available', () =>
  {
    const sema = new Semaphore(1, 'test', 5, 10);
    const thread = createWaitable(1);

    const result = sema.wait(3, thread);
    expect(result).toBe(0);
    expect(sema.currentCount).toBe(2);
  });

  it('should block if count not available', async () =>
  {
    const sema = new Semaphore(1, 'test', 2, 10);
    const thread = createWaitable(1);

    const promise = sema.wait(5, thread);
    expect(sema.waitingThreads).toBe(1);

    sema.signal(5);
    const result = await promise;
    expect(result).toBe(0);
    expect(sema.currentCount).toBe(2);
  });

  it('should poll without blocking', () =>
  {
    const sema = new Semaphore(1, 'test', 3, 10);

    expect(sema.poll(2)).toBe(0);
    expect(sema.currentCount).toBe(1);
    expect(sema.poll(2)).not.toBe(0); // Should fail
  });
});

describe('Mutex', () =>
{
  function createWaitable(uid: number): { uid: number; status: number; wakeupCount: number }
  {
    return { uid, status: WaitStatus.READY, wakeupCount: 0 };
  }

  it('should lock immediately if unlocked', () =>
  {
    const mutex = new Mutex(1, 'test');
    const thread = createWaitable(1);

    const result = mutex.lock(thread);
    expect(result).toBe(0);
    expect(mutex.isLocked).toBe(true);
  });

  it('should block if already locked', async () =>
  {
    const mutex = new Mutex(1, 'test');
    const t1 = createWaitable(1);
    const t2 = createWaitable(2);

    mutex.lock(t1);
    const promise = mutex.lock(t2);

    expect(mutex.waitingThreads).toBe(1);

    mutex.unlock(t1);
    const result = await promise;
    expect(result).toBe(0);
  });

  it('should support recursive locking', () =>
  {
    const mutex = new Mutex(1, 'test', true);
    const thread = createWaitable(1);

    expect(mutex.lock(thread)).toBe(0);
    expect(mutex.lock(thread)).toBe(0); // Should succeed
    expect(mutex.unlock(thread)).toBe(0);
    expect(mutex.isLocked).toBe(true); // Still locked once
    expect(mutex.unlock(thread)).toBe(0);
    expect(mutex.isLocked).toBe(false);
  });
});
