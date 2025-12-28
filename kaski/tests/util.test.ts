import { describe, it, expect } from 'bun:test';
import {
  UidCollection,
  Signal0, Signal1, Signal2,
  PromiseFast, Deferred,
  Int64,
} from '../src/util';

describe('UidCollection', () =>
{
  it('should allocate sequential UIDs', () =>
  {
    const collection = new UidCollection<string>();
    const uid1 = collection.allocate('first');
    const uid2 = collection.allocate('second');
    const uid3 = collection.allocate('third');

    expect(uid1).toBe(1);
    expect(uid2).toBe(2);
    expect(uid3).toBe(3);
    expect(collection.size).toBe(3);
  });

  it('should get items by UID', () =>
  {
    const collection = new UidCollection<string>();
    const uid = collection.allocate('test');

    expect(collection.get(uid)).toBe('test');
    expect(collection.get(999)).toBeUndefined();
  });

  it('should recycle UIDs on release', () =>
  {
    const collection = new UidCollection<string>();
    const uid1 = collection.allocate('first');
    collection.allocate('second');
    collection.release(uid1);

    const uid3 = collection.allocate('third');
    expect(uid3).toBe(uid1); // Recycled
  });

  it('should find UID by item', () =>
  {
    const collection = new UidCollection<string>();
    collection.allocate('first');
    const uid2 = collection.allocate('second');

    expect(collection.findUid('second')).toBe(uid2);
    expect(collection.findUid('notfound')).toBeUndefined();
  });

  it('should filter items', () =>
  {
    const collection = new UidCollection<number>();
    collection.allocate(1);
    collection.allocate(2);
    collection.allocate(3);
    collection.allocate(4);

    const evens = collection.filter(n => n % 2 === 0);
    expect(evens).toEqual([2, 4]);
  });

  it('should throw on getOrThrow with invalid UID', () =>
  {
    const collection = new UidCollection<string>();
    expect(() => collection.getOrThrow(999)).toThrow();
  });
});

describe('Signal', () =>
{
  it('should dispatch to handlers (Signal0)', () =>
  {
    const signal = new Signal0();
    let called = false;
    signal.add(() => { called = true; });
    signal.dispatch();
    expect(called).toBe(true);
  });

  it('should dispatch with argument (Signal1)', () =>
  {
    const signal = new Signal1<number>();
    let received: number | undefined;
    signal.add(n => { received = n; });
    signal.dispatch(42);
    expect(received).toBe(42);
  });

  it('should dispatch with two arguments (Signal2)', () =>
  {
    const signal = new Signal2<string, number>();
    let receivedStr: string | undefined;
    let receivedNum: number | undefined;
    signal.add((s, n) => { receivedStr = s; receivedNum = n; });
    signal.dispatch('hello', 123);
    expect(receivedStr).toBe('hello');
    expect(receivedNum).toBe(123);
  });

  it('should remove handlers', () =>
  {
    const signal = new Signal0();
    let count = 0;
    const handler = () => { count++; };
    signal.add(handler);
    signal.dispatch();
    signal.remove(handler);
    signal.dispatch();
    expect(count).toBe(1);
  });

  it('should fire once handlers only once', () =>
  {
    const signal = new Signal0();
    let count = 0;
    signal.once(() => { count++; });
    signal.dispatch();
    signal.dispatch();
    expect(count).toBe(1);
  });
});

describe('PromiseFast', () =>
{
  it('should create resolved promise', () =>
  {
    const p = PromiseFast.resolve(42);
    expect(p.isResolved).toBe(true);
    expect(p.value).toBe(42);
  });

  it('should create rejected promise', () =>
  {
    const p = PromiseFast.reject<number>(new Error('test'));
    expect(p.isRejected).toBe(true);
    expect(p.error).toBeInstanceOf(Error);
  });

  it('should chain with then (sync)', () =>
  {
    const p = PromiseFast.resolve(10);
    const p2 = p.then(v => v * 2);
    expect(p2.isResolved).toBe(true);
    expect(p2.value).toBe(20);
  });

  it('should chain with then (async)', async () =>
  {
    const { promise, resolve } = PromiseFast.create<number>();
    const p2 = promise.then(v => v * 2);

    expect(p2.isPending).toBe(true);
    resolve(10);
    expect(p2.isResolved).toBe(true);
    expect(p2.value).toBe(20);
  });

  it('should handle rejection in chain', () =>
  {
    const p = PromiseFast.reject<number>(new Error('oops'));
    let caught = false;
    p.catch(() => { caught = true; return 0; });
    expect(caught).toBe(true);
  });

  it('should wait for all (sync)', () =>
  {
    const promises = [
      PromiseFast.resolve(1),
      PromiseFast.resolve(2),
      PromiseFast.resolve(3),
    ];
    const all = PromiseFast.all(promises);
    expect(all.isResolved).toBe(true);
    expect(all.value).toEqual([1, 2, 3]);
  });

  it('should ensure wraps values', () =>
  {
    const p1 = PromiseFast.ensure(42);
    expect(p1.value).toBe(42);

    const p2 = PromiseFast.resolve(100);
    const p3 = PromiseFast.ensure(p2);
    expect(p3).toBe(p2); // Same instance
  });

  it('Deferred should work', () =>
  {
    const deferred = new Deferred<string>();
    expect(deferred.promise.isPending).toBe(true);
    deferred.resolve('done');
    expect(deferred.promise.value).toBe('done');
  });
});

describe('Int64', () =>
{
  it('should create from number', () =>
  {
    const i = Int64.fromNumber(0x123456789);
    expect(i.low).toBe(0x23456789);
    expect(i.high).toBe(0x1);
  });

  it('should convert to number', () =>
  {
    const i = new Int64(0x23456789, 0x1);
    expect(i.toNumber()).toBe(0x123456789);
  });

  it('should handle ZERO and ONE', () =>
  {
    expect(Int64.ZERO.isZero()).toBe(true);
    expect(Int64.ONE.toNumber()).toBe(1);
  });

  it('should add', () =>
  {
    const a = Int64.fromNumber(0xFFFFFFFF);
    const b = Int64.fromNumber(1);
    const c = a.add(b);
    expect(c.low).toBe(0);
    expect(c.high).toBe(1);
  });

  it('should subtract', () =>
  {
    const a = new Int64(0, 1);
    const b = Int64.fromNumber(1);
    const c = a.sub(b);
    expect(c.low).toBe(0xFFFFFFFF);
    expect(c.high).toBe(0);
  });

  it('should compare', () =>
  {
    const a = Int64.fromNumber(100);
    const b = Int64.fromNumber(200);
    expect(a.lt(b)).toBe(true);
    expect(b.gt(a)).toBe(true);
    expect(a.eq(Int64.fromNumber(100))).toBe(true);
  });

  it('should bitwise operations', () =>
  {
    const a = Int64.fromNumber(0xFF00);
    const b = Int64.fromNumber(0x0FF0);
    expect(a.and(b).toNumber()).toBe(0x0F00);
    expect(a.or(b).toNumber()).toBe(0xFFF0);
    expect(a.xor(b).toNumber()).toBe(0xF0F0);
  });

  it('should shift left', () =>
  {
    const a = Int64.fromNumber(1);
    expect(a.shl(32).high).toBe(1);
    expect(a.shl(32).low).toBe(0);
  });

  it('should shift right', () =>
  {
    const a = new Int64(0, 1);
    const b = a.shr(32);
    expect(b.low).toBe(1);
    expect(b.high).toBe(0);
  });

  it('should convert to/from BigInt', () =>
  {
    const big = 0x123456789ABCDEFn;
    const i = Int64.fromBigInt(big);
    expect(i.toBigInt()).toBe(big);
  });
});
