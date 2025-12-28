/**
 * PromiseFast - Promise-like async handling with synchronous fallbacks
 *
 * Critical for bridging PSP blocking calls with async JavaScript operations.
 * Supports synchronous resolution for performance when values are immediately available.
 */

export type PromiseFastState = 'pending' | 'resolved' | 'rejected';

/**
 * PromiseFast - Fast promise implementation with sync optimization
 */
export class PromiseFast<T>
{
  private _state: PromiseFastState = 'pending';
  private _value: T | undefined;
  private _error: unknown;
  private _callbacks: Array<{
    onResolve: (value: T) => void;
    onReject: (error: unknown) => void;
  }> = [];

  private constructor() { }

  /** Current state */
  get state(): PromiseFastState
  {
    return this._state;
  }

  /** Is resolved */
  get isResolved(): boolean
  {
    return this._state === 'resolved';
  }

  /** Is rejected */
  get isRejected(): boolean
  {
    return this._state === 'rejected';
  }

  /** Is pending */
  get isPending(): boolean
  {
    return this._state === 'pending';
  }

  /** Resolved value (only valid if resolved) */
  get value(): T
  {
    if (this._state !== 'resolved')
    {
      throw new Error('Promise not resolved');
    }
    return this._value!;
  }

  /** Error value (only valid if rejected) */
  get error(): unknown
  {
    if (this._state !== 'rejected')
    {
      throw new Error('Promise not rejected');
    }
    return this._error;
  }

  /**
   * Create a resolved promise
   */
  static resolve<T>(value: T): PromiseFast<T>
  {
    const p = new PromiseFast<T>();
    p._state = 'resolved';
    p._value = value;
    return p;
  }

  /**
   * Create a rejected promise
   */
  static reject<T>(error: unknown): PromiseFast<T>
  {
    const p = new PromiseFast<T>();
    p._state = 'rejected';
    p._error = error;
    return p;
  }

  /**
   * Create a pending promise with resolve/reject callbacks
   */
  static create<T>(): {
    promise: PromiseFast<T>;
    resolve: (value: T) => void;
    reject: (error: unknown) => void;
  }
  {
    const p = new PromiseFast<T>();
    return {
      promise: p,
      resolve: (value: T) => p._resolve(value),
      reject: (error: unknown) => p._reject(error),
    };
  }

  /**
   * Wrap a native Promise
   */
  static fromPromise<T>(promise: Promise<T>): PromiseFast<T>
  {
    const { promise: p, resolve, reject } = PromiseFast.create<T>();
    promise.then(resolve, reject);
    return p;
  }

  /**
   * Ensure value is a PromiseFast (wrap if needed)
   */
  static ensure<T>(value: T | PromiseFast<T> | Promise<T>): PromiseFast<T>
  {
    if (value instanceof PromiseFast)
    {
      return value;
    }
    if (value instanceof Promise)
    {
      return PromiseFast.fromPromise(value);
    }
    return PromiseFast.resolve(value);
  }

  /**
   * Wait for all promises
   */
  static all<T>(promises: PromiseFast<T>[]): PromiseFast<T[]>
  {
    if (promises.length === 0)
    {
      return PromiseFast.resolve([]);
    }

    // Fast path: all already resolved
    if (promises.every(p => p.isResolved))
    {
      return PromiseFast.resolve(promises.map(p => p.value));
    }

    // Check for any rejected
    const rejected = promises.find(p => p.isRejected);
    if (rejected)
    {
      return PromiseFast.reject(rejected.error);
    }

    const { promise, resolve, reject } = PromiseFast.create<T[]>();
    const results: T[] = new Array(promises.length);
    let remaining = promises.length;

    promises.forEach((p, i) =>
    {
      p.then(
        value =>
        {
          results[i] = value;
          remaining--;
          if (remaining === 0)
          {
            resolve(results);
          }
        },
        reject
      );
    });

    return promise;
  }

  /**
   * Wait for first promise to resolve
   */
  static race<T>(promises: PromiseFast<T>[]): PromiseFast<T>
  {
    if (promises.length === 0)
    {
      return PromiseFast.reject(new Error('Empty race'));
    }

    // Fast path: any already settled
    for (const p of promises)
    {
      if (p.isResolved)
      {
        return PromiseFast.resolve(p.value);
      }
      if (p.isRejected)
      {
        return PromiseFast.reject(p.error);
      }
    }

    const { promise, resolve, reject } = PromiseFast.create<T>();
    let settled = false;

    for (const p of promises)
    {
      p.then(
        value =>
        {
          if (!settled)
          {
            settled = true;
            resolve(value);
          }
        },
        error =>
        {
          if (!settled)
          {
            settled = true;
            reject(error);
          }
        }
      );
    }

    return promise;
  }

  /**
   * Delay for specified milliseconds
   */
  static delay(ms: number): PromiseFast<void>
  {
    const { promise, resolve } = PromiseFast.create<void>();
    setTimeout(() => resolve(), ms);
    return promise;
  }

  private _resolve(value: T): void
  {
    if (this._state !== 'pending') return;
    this._state = 'resolved';
    this._value = value;
    this._notify();
  }

  private _reject(error: unknown): void
  {
    if (this._state !== 'pending') return;
    this._state = 'rejected';
    this._error = error;
    this._notify();
  }

  private _notify(): void
  {
    const callbacks = this._callbacks;
    this._callbacks = [];

    for (const { onResolve, onReject } of callbacks)
    {
      if (this._state === 'resolved')
      {
        onResolve(this._value!);
      }
      else
      {
        onReject(this._error);
      }
    }
  }

  /**
   * Chain handlers (similar to Promise.then)
   */
  then<R>(
    onResolve?: (value: T) => R | PromiseFast<R>,
    onReject?: (error: unknown) => R | PromiseFast<R>
  ): PromiseFast<R>
  {
    // Fast path: already resolved
    if (this._state === 'resolved' && onResolve)
    {
      try
      {
        const result = onResolve(this._value!);
        return PromiseFast.ensure(result);
      }
      catch (e)
      {
        return PromiseFast.reject(e);
      }
    }

    // Fast path: already rejected
    if (this._state === 'rejected')
    {
      if (onReject)
      {
        try
        {
          const result = onReject(this._error);
          return PromiseFast.ensure(result);
        }
        catch (e)
        {
          return PromiseFast.reject(e);
        }
      }
      return PromiseFast.reject(this._error);
    }

    // Pending: chain callbacks
    const { promise, resolve, reject } = PromiseFast.create<R>();

    this._callbacks.push({
      onResolve: (value: T) =>
      {
        if (onResolve)
        {
          try
          {
            const result = onResolve(value);
            if (result instanceof PromiseFast)
            {
              result.then(resolve, reject);
            }
            else
            {
              resolve(result as R);
            }
          }
          catch (e)
          {
            reject(e);
          }
        }
        else
        {
          resolve(value as unknown as R);
        }
      },
      onReject: (error: unknown) =>
      {
        if (onReject)
        {
          try
          {
            const result = onReject(error);
            if (result instanceof PromiseFast)
            {
              result.then(resolve, reject);
            }
            else
            {
              resolve(result as R);
            }
          }
          catch (e)
          {
            reject(e);
          }
        }
        else
        {
          reject(error);
        }
      },
    });

    return promise;
  }

  /**
   * Chain error handler
   */
  catch<R>(onReject: (error: unknown) => R | PromiseFast<R>): PromiseFast<T | R>
  {
    return this.then(undefined, onReject);
  }

  /**
   * Chain finally handler
   */
  finally(handler: () => void): PromiseFast<T>
  {
    return this.then(
      value =>
      {
        handler();
        return value;
      },
      error =>
      {
        handler();
        throw error;
      }
    );
  }

  /**
   * Convert to native Promise
   */
  toPromise(): Promise<T>
  {
    return new Promise((resolve, reject) =>
    {
      this.then(resolve, reject);
    });
  }
}

/**
 * Deferred - Promise with exposed resolve/reject
 */
export class Deferred<T>
{
  readonly promise: PromiseFast<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (error: unknown) => void;

  constructor()
  {
    const { promise, resolve, reject } = PromiseFast.create<T>();
    this.promise = promise;
    this.resolve = resolve;
    this.reject = reject;
  }
}
