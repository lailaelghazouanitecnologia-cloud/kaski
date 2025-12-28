/**
 * Callback Manager
 *
 * Manages PSP callbacks for threads.
 * Callbacks are functions that can be invoked when certain events occur.
 */

import { UidCollection } from '../../util/UidCollection';
import { Signal1 } from '../../util/Signal';
import { SceKernelErrors } from '../errors';

// ============================================
// Callback
// ============================================

/**
 * A PSP callback
 */
export class Callback
{
  /** Callback UID */
  uid: number = 0;

  /** Callback name */
  name: string;

  /** Thread UID that owns this callback */
  threadUid: number;

  /** Function address */
  functionAddr: number;

  /** Common argument (passed as first arg) */
  commonArg: number;

  /** Number of times notified */
  notifyCount: number = 0;

  /** Pending notify argument */
  notifyArg: number = 0;

  constructor(
    name: string,
    threadUid: number,
    functionAddr: number,
    commonArg: number = 0
  )
  {
    this.name = name;
    this.threadUid = threadUid;
    this.functionAddr = functionAddr;
    this.commonArg = commonArg;
  }

  /**
   * Notify this callback
   */
  notify(arg: number): void
  {
    this.notifyCount++;
    this.notifyArg = arg;
  }

  /**
   * Check if callback is pending
   */
  get isPending(): boolean
  {
    return this.notifyCount > 0;
  }

  /**
   * Clear pending notification
   */
  clearNotify(): void
  {
    if (this.notifyCount > 0)
    {
      this.notifyCount--;
    }
  }
}

// ============================================
// Callback Manager
// ============================================

/**
 * Callback Manager
 */
export class CallbackManager
{
  /** All callbacks by UID */
  private callbacks: UidCollection<Callback> = new UidCollection();

  /** Signal when callback is added */
  readonly onCallbackAdded: Signal1<Callback> = new Signal1();

  /** Signal when callback is notified */
  readonly onCallbackNotified: Signal1<Callback> = new Signal1();

  constructor()
  {
  }

  /**
   * Reset to initial state
   */
  reset(): void
  {
    this.callbacks.clear();
  }

  /**
   * Create a new callback
   */
  createCallback(
    name: string,
    threadUid: number,
    functionAddr: number,
    commonArg: number = 0
  ): { callback: Callback | null; error: number }
  {
    const callback = new Callback(name, threadUid, functionAddr, commonArg);
    callback.uid = this.callbacks.allocate(callback);

    this.onCallbackAdded.dispatch(callback);

    return { callback, error: SceKernelErrors.ERROR_OK };
  }

  /**
   * Delete a callback
   */
  deleteCallback(uid: number): number
  {
    if (!this.callbacks.has(uid))
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_CALLBACK;
    }

    this.callbacks.release(uid);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Get callback by UID
   */
  getCallback(uid: number): Callback | undefined
  {
    return this.callbacks.get(uid);
  }

  /**
   * Notify a callback
   */
  notifyCallback(uid: number, arg: number): number
  {
    const callback = this.callbacks.get(uid);
    if (!callback)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_CALLBACK;
    }

    callback.notify(arg);
    this.onCallbackNotified.dispatch(callback);

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Cancel a callback notification
   */
  cancelCallback(uid: number): number
  {
    const callback = this.callbacks.get(uid);
    if (!callback)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_CALLBACK;
    }

    callback.notifyCount = 0;
    callback.notifyArg = 0;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Get all callbacks for a thread
   */
  getCallbacksForThread(threadUid: number): Callback[]
  {
    return this.callbacks.filter(cb => cb.threadUid === threadUid);
  }

  /**
   * Get pending callbacks for a thread
   */
  getPendingCallbacks(threadUid: number): Callback[]
  {
    return this.callbacks.filter(
      cb => cb.threadUid === threadUid && cb.isPending
    );
  }

  /**
   * Get all callbacks
   */
  getAllCallbacks(): Callback[]
  {
    return [...this.callbacks.values()];
  }

  /**
   * Check if there are pending callbacks for a thread
   */
  hasPendingCallbacks(threadUid: number): boolean
  {
    return this.callbacks.find(
      cb => cb.threadUid === threadUid && cb.isPending
    ) !== undefined;
  }

  /**
   * Get next pending callback for a thread
   */
  getNextPendingCallback(threadUid: number): Callback | undefined
  {
    return this.callbacks.find(
      cb => cb.threadUid === threadUid && cb.isPending
    );
  }

  /**
   * Get callback count
   */
  get callbackCount(): number
  {
    return this.callbacks.size;
  }
}
