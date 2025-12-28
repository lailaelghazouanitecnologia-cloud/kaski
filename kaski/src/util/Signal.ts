/**
 * Signal - Event dispatcher pattern
 *
 * Provides type-safe event dispatching for callbacks and notifications.
 * Used for memory invalidation, IO completion, thread state changes, etc.
 */

/** No-argument signal */
export class Signal0
{
  private handlers: Set<() => void> = new Set();

  /** Add a handler */
  add(handler: () => void): void
  {
    this.handlers.add(handler);
  }

  /** Remove a handler */
  remove(handler: () => void): void
  {
    this.handlers.delete(handler);
  }

  /** Add handler that fires once */
  once(handler: () => void): void
  {
    const wrapper = () =>
    {
      this.remove(wrapper);
      handler();
    };
    this.add(wrapper);
  }

  /** Dispatch to all handlers */
  dispatch(): void
  {
    for (const handler of this.handlers)
    {
      handler();
    }
  }

  /** Clear all handlers */
  clear(): void
  {
    this.handlers.clear();
  }

  /** Number of handlers */
  get count(): number
  {
    return this.handlers.size;
  }
}

/** Single-argument signal */
export class Signal1<T>
{
  private handlers: Set<(arg: T) => void> = new Set();

  /** Add a handler */
  add(handler: (arg: T) => void): void
  {
    this.handlers.add(handler);
  }

  /** Remove a handler */
  remove(handler: (arg: T) => void): void
  {
    this.handlers.delete(handler);
  }

  /** Add handler that fires once */
  once(handler: (arg: T) => void): void
  {
    const wrapper = (arg: T) =>
    {
      this.remove(wrapper);
      handler(arg);
    };
    this.add(wrapper);
  }

  /** Dispatch to all handlers */
  dispatch(arg: T): void
  {
    for (const handler of this.handlers)
    {
      handler(arg);
    }
  }

  /** Clear all handlers */
  clear(): void
  {
    this.handlers.clear();
  }

  /** Number of handlers */
  get count(): number
  {
    return this.handlers.size;
  }
}

/** Two-argument signal */
export class Signal2<T1, T2>
{
  private handlers: Set<(arg1: T1, arg2: T2) => void> = new Set();

  /** Add a handler */
  add(handler: (arg1: T1, arg2: T2) => void): void
  {
    this.handlers.add(handler);
  }

  /** Remove a handler */
  remove(handler: (arg1: T1, arg2: T2) => void): void
  {
    this.handlers.delete(handler);
  }

  /** Add handler that fires once */
  once(handler: (arg1: T1, arg2: T2) => void): void
  {
    const wrapper = (arg1: T1, arg2: T2) =>
    {
      this.remove(wrapper);
      handler(arg1, arg2);
    };
    this.add(wrapper);
  }

  /** Dispatch to all handlers */
  dispatch(arg1: T1, arg2: T2): void
  {
    for (const handler of this.handlers)
    {
      handler(arg1, arg2);
    }
  }

  /** Clear all handlers */
  clear(): void
  {
    this.handlers.clear();
  }

  /** Number of handlers */
  get count(): number
  {
    return this.handlers.size;
  }
}

/** Three-argument signal */
export class Signal3<T1, T2, T3>
{
  private handlers: Set<(arg1: T1, arg2: T2, arg3: T3) => void> = new Set();

  /** Add a handler */
  add(handler: (arg1: T1, arg2: T2, arg3: T3) => void): void
  {
    this.handlers.add(handler);
  }

  /** Remove a handler */
  remove(handler: (arg1: T1, arg2: T2, arg3: T3) => void): void
  {
    this.handlers.delete(handler);
  }

  /** Dispatch to all handlers */
  dispatch(arg1: T1, arg2: T2, arg3: T3): void
  {
    for (const handler of this.handlers)
    {
      handler(arg1, arg2, arg3);
    }
  }

  /** Clear all handlers */
  clear(): void
  {
    this.handlers.clear();
  }

  /** Number of handlers */
  get count(): number
  {
    return this.handlers.size;
  }
}
