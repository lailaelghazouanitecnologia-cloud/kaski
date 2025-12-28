/**
 * WaitQueue - Thread synchronization abstraction
 *
 * Generic wait queue for PSP synchronization primitives like
 * semaphores, mutexes, event flags, and message boxes.
 */

import { PromiseFast } from './PromiseFast';
import { SceKernelErrors } from '../hle/errors';

/**
 * Thread-like interface (minimal requirements)
 */
export interface Waitable
{
  uid: number;
  status: number;
  wakeupCount: number;
}

/**
 * Thread status constants
 */
export const WaitStatus = {
  READY: 1,
  WAIT: 4,
} as const;

/**
 * Waiter entry in the queue
 */
interface WaiterEntry<T, R = number>
{
  /** Thread waiting */
  waitable: Waitable;
  /** Condition to check */
  condition: (resource: T) => boolean;
  /** Action on acquire */
  onAcquire: (resource: T) => R;
  /** Resolve function */
  resolve: (result: R) => void;
  /** Reject function */
  reject: (error: number) => void;
  /** Timeout handle */
  timeoutId?: ReturnType<typeof setTimeout>;
  /** Priority for ordering */
  priority: number;
}

/**
 * WaitQueue - Manages threads waiting for a resource
 */
export class WaitQueue<T, R = number>
{
  private waiters: WaiterEntry<T, R>[] = [];

  /**
   * Number of waiting threads
   */
  get length(): number
  {
    return this.waiters.length;
  }

  /**
   * Check if queue is empty
   */
  get isEmpty(): boolean
  {
    return this.waiters.length === 0;
  }

  /**
   * Try to acquire resource, or wait if condition not met
   *
   * @param resource - The resource to acquire
   * @param condition - Function to check if resource can be acquired
   * @param onAcquire - Function to call when acquired (modifies resource)
   * @param waitable - Thread to put to sleep if waiting
   * @param timeout - Optional timeout in microseconds (0 = no timeout)
   * @param priority - Thread priority for ordering
   * @returns Result of onAcquire, or error on timeout/cancel
   */
  acquire(
    resource: T,
    condition: (r: T) => boolean,
    onAcquire: (r: T) => R,
    waitable: Waitable,
    timeout: number = 0,
    priority: number = 32
  ): R | PromiseFast<R>
  {
    // Try immediate acquire
    if (condition(resource))
    {
      return onAcquire(resource);
    }

    // Must wait - create deferred promise
    const { promise, resolve, reject } = PromiseFast.create<R>();

    const entry: WaiterEntry<T, R> = {
      waitable,
      condition,
      onAcquire,
      resolve,
      reject: reject as (error: number) => void,
      priority,
    };

    // Set up timeout if specified
    if (timeout > 0)
    {
      const timeoutMs = timeout / 1000; // Convert microseconds to ms
      entry.timeoutId = setTimeout(() =>
      {
        this.removeWaiter(entry);
        waitable.status = WaitStatus.READY;
        reject(SceKernelErrors.ERROR_KERNEL_WAIT_TIMEOUT);
      }, timeoutMs);
    }

    // Add to queue (sorted by priority)
    this.insertWaiter(entry);

    // Mark thread as waiting
    waitable.status = WaitStatus.WAIT;

    return promise;
  }

  /**
   * Try to acquire without waiting (poll)
   */
  tryAcquire(
    resource: T,
    condition: (r: T) => boolean,
    onAcquire: (r: T) => R
  ): { success: true; result: R } | { success: false }
  {
    if (condition(resource))
    {
      return { success: true, result: onAcquire(resource) };
    }
    return { success: false };
  }

  /**
   * Signal that resource state changed - wake eligible waiters
   *
   * @param resource - The resource that changed
   * @param wakeAll - Wake all eligible waiters (default: false, wake one)
   * @returns Number of waiters woken
   */
  signal(resource: T, wakeAll: boolean = false): number
  {
    let woken = 0;

    for (let i = 0; i < this.waiters.length;)
    {
      const entry = this.waiters[i];

      if (entry.condition(resource))
      {
        // Remove from queue
        this.waiters.splice(i, 1);

        // Clear timeout
        if (entry.timeoutId)
        {
          clearTimeout(entry.timeoutId);
        }

        // Wake thread
        entry.waitable.status = WaitStatus.READY;

        // Execute acquire action and resolve
        try
        {
          const result = entry.onAcquire(resource);
          entry.resolve(result);
        }
        catch (e)
        {
          entry.reject(SceKernelErrors.ERROR_KERNEL_WAIT_CANCELLED);
        }

        woken++;

        if (!wakeAll)
        {
          break;
        }
      }
      else
      {
        i++;
      }
    }

    return woken;
  }

  /**
   * Cancel all waiters (e.g., when resource is deleted)
   *
   * @param error - Error code to return to waiters
   * @returns Number of waiters cancelled
   */
  cancelAll(error: number = SceKernelErrors.ERROR_KERNEL_WAIT_DELETE): number
  {
    const count = this.waiters.length;

    for (const entry of this.waiters)
    {
      if (entry.timeoutId)
      {
        clearTimeout(entry.timeoutId);
      }
      entry.waitable.status = WaitStatus.READY;
      entry.reject(error);
    }

    this.waiters = [];
    return count;
  }

  /**
   * Cancel a specific waiter
   */
  cancel(waitable: Waitable, error: number = SceKernelErrors.ERROR_KERNEL_WAIT_CANCELLED): boolean
  {
    const index = this.waiters.findIndex(e => e.waitable.uid === waitable.uid);
    if (index === -1) return false;

    const entry = this.waiters[index];
    this.waiters.splice(index, 1);

    if (entry.timeoutId)
    {
      clearTimeout(entry.timeoutId);
    }

    entry.waitable.status = WaitStatus.READY;
    entry.reject(error);

    return true;
  }

  /**
   * Check if a waitable is in queue
   */
  has(waitable: Waitable): boolean
  {
    return this.waiters.some(e => e.waitable.uid === waitable.uid);
  }

  /**
   * Get all waiting thread UIDs
   */
  getWaiters(): number[]
  {
    return this.waiters.map(e => e.waitable.uid);
  }

  private insertWaiter(entry: WaiterEntry<T, R>): void
  {
    // Insert sorted by priority (lower = higher priority)
    let i = 0;
    while (i < this.waiters.length && this.waiters[i].priority <= entry.priority)
    {
      i++;
    }
    this.waiters.splice(i, 0, entry);
  }

  private removeWaiter(entry: WaiterEntry<T, R>): void
  {
    const index = this.waiters.indexOf(entry);
    if (index !== -1)
    {
      this.waiters.splice(index, 1);
    }
  }
}

/**
 * Simple semaphore using WaitQueue
 */
export class Semaphore
{
  private count: number;
  private waitQueue = new WaitQueue<Semaphore, number>();

  constructor(
    public readonly uid: number,
    public readonly name: string,
    initialCount: number,
    public readonly maxCount: number
  )
  {
    this.count = initialCount;
  }

  get currentCount(): number
  {
    return this.count;
  }

  get waitingThreads(): number
  {
    return this.waitQueue.length;
  }

  /**
   * Wait for semaphore
   */
  wait(
    signal: number,
    thread: Waitable,
    timeout: number = 0
  ): number | PromiseFast<number>
  {
    return this.waitQueue.acquire(
      this,
      s => s.count >= signal,
      s => { s.count -= signal; return 0; },
      thread,
      timeout,
      32 // Use thread priority
    );
  }

  /**
   * Poll semaphore (non-blocking)
   */
  poll(signal: number): number
  {
    const result = this.waitQueue.tryAcquire(
      this,
      s => s.count >= signal,
      s => { s.count -= signal; return 0; }
    );
    return result.success ? result.result : SceKernelErrors.ERROR_KERNEL_SEMA_ZERO;
  }

  /**
   * Signal semaphore
   */
  signal(count: number): number
  {
    if (this.count + count > this.maxCount)
    {
      return SceKernelErrors.ERROR_KERNEL_SEMA_OVERFLOW;
    }

    this.count += count;
    this.waitQueue.signal(this, false);
    return 0;
  }

  /**
   * Cancel all waiting threads
   */
  cancelAll(): number
  {
    return this.waitQueue.cancelAll();
  }
}

/**
 * Simple mutex using WaitQueue
 */
export class Mutex
{
  private owner: number = 0;  // Thread UID that owns the mutex
  private lockCount: number = 0;
  private waitQueue = new WaitQueue<Mutex, number>();

  constructor(
    public readonly uid: number,
    public readonly name: string,
    public readonly recursive: boolean = false
  ) {}

  get isLocked(): boolean
  {
    return this.owner !== 0;
  }

  get waitingThreads(): number
  {
    return this.waitQueue.length;
  }

  /**
   * Lock mutex
   */
  lock(thread: Waitable, timeout: number = 0): number | PromiseFast<number>
  {
    // Already owned by this thread?
    if (this.owner === thread.uid)
    {
      if (this.recursive)
      {
        this.lockCount++;
        return 0;
      }
      // Deadlock
      return SceKernelErrors.ERROR_KERNEL_WAIT_STATUS_RELEASED;
    }

    return this.waitQueue.acquire(
      this,
      m => m.owner === 0,
      m =>
      {
        m.owner = thread.uid;
        m.lockCount = 1;
        return 0;
      },
      thread,
      timeout,
      32
    );
  }

  /**
   * Try to lock (non-blocking)
   */
  tryLock(thread: Waitable): number
  {
    if (this.owner === thread.uid && this.recursive)
    {
      this.lockCount++;
      return 0;
    }

    const result = this.waitQueue.tryAcquire(
      this,
      m => m.owner === 0,
      m =>
      {
        m.owner = thread.uid;
        m.lockCount = 1;
        return 0;
      }
    );

    return result.success ? 0 : SceKernelErrors.ERROR_KERNEL_WAIT_TIMEOUT;
  }

  /**
   * Unlock mutex
   */
  unlock(thread: Waitable): number
  {
    if (this.owner !== thread.uid)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_HOLDER_UID;
    }

    this.lockCount--;
    if (this.lockCount === 0)
    {
      this.owner = 0;
      this.waitQueue.signal(this, false);
    }

    return 0;
  }

  /**
   * Cancel all waiting threads
   */
  cancelAll(): number
  {
    return this.waitQueue.cancelAll();
  }
}
