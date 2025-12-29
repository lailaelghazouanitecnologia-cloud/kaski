/**
 * Sync Manager
 *
 * Manages PSP synchronization primitives: semaphores, mutexes, event flags.
 */

import { UidCollection } from '../../util/UidCollection';
import { PromiseFast } from '../../util/PromiseFast';
import { Semaphore, Mutex, WaitQueue, Waitable } from '../../util/WaitQueue';
import { SceKernelErrors } from '../errors';

// ============================================
// Semaphore Info (for sceKernelReferSemaStatus)
// ============================================

export interface SemaphoreInfo
{
  size: number;
  name: string;
  attr: number;
  initCount: number;
  currentCount: number;
  maxCount: number;
  numWaitThreads: number;
}

// ============================================
// Mutex Info
// ============================================

export interface MutexInfo
{
  size: number;
  name: string;
  attr: number;
  initCount: number;
  currentCount: number;
  owner: number;
  numWaitThreads: number;
}

// ============================================
// Event Flag
// ============================================

export const enum EventFlagWaitMode
{
  And = 0x00,      // Wait for all bits
  Or = 0x01,       // Wait for any bit
  Clear = 0x10,    // Clear bits after wait
  ClearAll = 0x20, // Clear all bits after wait
}

export class EventFlag
{
  private pattern: number;
  private waitQueue = new WaitQueue<EventFlag, number>();
  public readonly initialPattern: number;

  constructor(
    public readonly uid: number,
    public readonly name: string,
    public readonly attr: number,
    initialPattern: number
  )
  {
    this.pattern = initialPattern >>> 0;
    this.initialPattern = initialPattern >>> 0;
  }

  get currentPattern(): number
  {
    return this.pattern;
  }

  get waitingThreads(): number
  {
    return this.waitQueue.length;
  }

  /**
   * Set bits in pattern
   */
  set(bits: number): void
  {
    this.pattern = (this.pattern | bits) >>> 0;
    this.waitQueue.signal(this, true);
  }

  /**
   * Clear bits in pattern
   */
  clear(bits: number): void
  {
    this.pattern = (this.pattern & ~bits) >>> 0;
  }

  /**
   * Wait for pattern
   */
  wait(
    bits: number,
    mode: number,
    thread: Waitable,
    timeout: number = 0
  ): number | PromiseFast<number>
  {
    const isOr = (mode & EventFlagWaitMode.Or) !== 0;
    const clearBits = (mode & EventFlagWaitMode.Clear) !== 0;
    const clearAll = (mode & EventFlagWaitMode.ClearAll) !== 0;

    const condition = (ef: EventFlag): boolean =>
    {
      if (isOr)
      {
        return (ef.pattern & bits) !== 0;
      }
      return (ef.pattern & bits) === bits;
    };

    const onAcquire = (ef: EventFlag): number =>
    {
      const matched = ef.pattern;
      if (clearAll)
      {
        ef.pattern = 0;
      }
      else if (clearBits)
      {
        ef.pattern = (ef.pattern & ~bits) >>> 0;
      }
      return matched;
    };

    return this.waitQueue.acquire(this, condition, onAcquire, thread, timeout);
  }

  /**
   * Poll (non-blocking wait)
   */
  poll(bits: number, mode: number): { success: boolean; pattern: number }
  {
    const isOr = (mode & EventFlagWaitMode.Or) !== 0;
    const clearBits = (mode & EventFlagWaitMode.Clear) !== 0;
    const clearAll = (mode & EventFlagWaitMode.ClearAll) !== 0;

    const matches = isOr
      ? (this.pattern & bits) !== 0
      : (this.pattern & bits) === bits;

    if (!matches)
    {
      return { success: false, pattern: this.pattern };
    }

    const matched = this.pattern;
    if (clearAll)
    {
      this.pattern = 0;
    }
    else if (clearBits)
    {
      this.pattern = (this.pattern & ~bits) >>> 0;
    }

    return { success: true, pattern: matched };
  }

  /**
   * Cancel all waiting threads
   */
  cancelAll(): number
  {
    return this.waitQueue.cancelAll();
  }
}

// ============================================
// Sync Manager
// ============================================

export class SyncManager
{
  private semaphores = new UidCollection<Semaphore>();
  private mutexes = new UidCollection<Mutex>();
  private eventFlags = new UidCollection<EventFlag>();

  /**
   * Reset all sync primitives
   */
  reset(): void
  {
    // Cancel all waiters first
    for (const sema of this.semaphores.values())
    {
      sema.cancelAll();
    }
    for (const mutex of this.mutexes.values())
    {
      mutex.cancelAll();
    }
    for (const ef of this.eventFlags.values())
    {
      ef.cancelAll();
    }

    this.semaphores.clear();
    this.mutexes.clear();
    this.eventFlags.clear();
  }

  // ============================================
  // Semaphores
  // ============================================

  /**
   * Create a semaphore
   */
  createSemaphore(
    name: string,
    attr: number,
    initCount: number,
    maxCount: number
  ): { semaphore: Semaphore | null; error: number }
  {
    if (initCount < 0 || initCount > maxCount)
    {
      return { semaphore: null, error: SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT };
    }

    if (maxCount <= 0)
    {
      return { semaphore: null, error: SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT };
    }

    const uid = this.semaphores.nextId();
    const semaphore = new Semaphore(uid, name, initCount, maxCount);
    this.semaphores.set(uid, semaphore);

    return { semaphore, error: SceKernelErrors.ERROR_OK };
  }

  /**
   * Delete a semaphore
   */
  deleteSemaphore(uid: number): number
  {
    const sema = this.semaphores.get(uid);
    if (!sema)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE;
    }

    sema.cancelAll();
    this.semaphores.release(uid);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Get semaphore by UID
   */
  getSemaphore(uid: number): Semaphore | undefined
  {
    return this.semaphores.get(uid);
  }

  /**
   * Get semaphore info
   */
  getSemaphoreInfo(uid: number): SemaphoreInfo | null
  {
    const sema = this.semaphores.get(uid);
    if (!sema)
    {
      return null;
    }

    return {
      size: 56, // SceKernelSemaInfo size
      name: sema.name,
      attr: 0,
      initCount: sema.maxCount, // Not tracked separately
      currentCount: sema.currentCount,
      maxCount: sema.maxCount,
      numWaitThreads: sema.waitingThreads,
    };
  }

  // ============================================
  // Mutexes
  // ============================================

  /**
   * Create a mutex
   */
  createMutex(
    name: string,
    attr: number,
    initCount: number
  ): { mutex: Mutex | null; error: number }
  {
    const recursive = (attr & 0x200) !== 0; // SCE_KERNEL_MUTEX_ATTR_RECURSIVE
    const uid = this.mutexes.nextId();
    const mutex = new Mutex(uid, name, recursive);
    this.mutexes.set(uid, mutex);

    return { mutex, error: SceKernelErrors.ERROR_OK };
  }

  /**
   * Delete a mutex
   */
  deleteMutex(uid: number): number
  {
    const mutex = this.mutexes.get(uid);
    if (!mutex)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE; // Uses same error
    }

    mutex.cancelAll();
    this.mutexes.release(uid);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Get mutex by UID
   */
  getMutex(uid: number): Mutex | undefined
  {
    return this.mutexes.get(uid);
  }

  // ============================================
  // Event Flags
  // ============================================

  /**
   * Create an event flag
   */
  createEventFlag(
    name: string,
    attr: number,
    initPattern: number
  ): { eventFlag: EventFlag | null; error: number }
  {
    const uid = this.eventFlags.nextId();
    const eventFlag = new EventFlag(uid, name, attr, initPattern);
    this.eventFlags.set(uid, eventFlag);

    return { eventFlag, error: SceKernelErrors.ERROR_OK };
  }

  /**
   * Delete an event flag
   */
  deleteEventFlag(uid: number): number
  {
    const ef = this.eventFlags.get(uid);
    if (!ef)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_EVENT_FLAG;
    }

    ef.cancelAll();
    this.eventFlags.release(uid);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Get event flag by UID
   */
  getEventFlag(uid: number): EventFlag | undefined
  {
    return this.eventFlags.get(uid);
  }
}
