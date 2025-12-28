/**
 * GPU Manager
 *
 * Manages GPU state: display lists, VRAM, callbacks.
 */

import { PromiseFast } from '../../util/PromiseFast';
import { WaitQueue, Waitable, WaitStatus } from '../../util/WaitQueue';
import { SceKernelErrors } from '../errors';

/**
 * EDRAM (VRAM) constants
 */
export const EDRAM_BASE = 0x04000000;
export const EDRAM_SIZE = 0x00200000; // 2MB

/**
 * GE list sync types
 */
export const enum GeSyncType
{
  Wait = 0,      // Wait for list to finish
  Peek = 1,      // Check status without waiting
}

/**
 * GE list state
 */
export const enum GeListState
{
  Done = 0,        // List finished
  Queued = 1,      // List in queue
  DrawingDone = 2, // Drawing finished
  StallReached = 3, // Stall address reached
  CancelDone = 4,  // Cancelled
}

/**
 * GE callback info
 */
export interface GeCallback
{
  signal: number;  // Signal callback function
  finish: number;  // Finish callback function
  arg: number;     // Callback argument
}

/**
 * Display list entry
 */
export interface DisplayList
{
  id: number;
  state: GeListState;
  startAddress: number;
  stallAddress: number;
  callbackId: number;
  arg: number;
  ctx: number;       // Context address
  stackAddress: number;
  stackPointer: number;
}

/**
 * GPU Manager
 *
 * Handles GPU command lists and synchronization.
 */
export class GpuManager
{
  // Display lists
  private lists: Map<number, DisplayList> = new Map();
  private nextListId: number = 1;

  // Active list queue
  private queue: number[] = [];

  // Callbacks
  private callbacks: Map<number, GeCallback> = new Map();
  private nextCallbackId: number = 1;

  // Sync waiters
  private listWaiters: Map<number, Array<{
    waitable: Waitable;
    resolve: (value: number) => void;
  }>> = new Map();

  private drawSyncWaiters: Array<{
    waitable: Waitable;
    resolve: (value: number) => void;
  }> = [];

  /**
   * Reset GPU state
   */
  reset(): void
  {
    this.lists.clear();
    this.queue = [];
    this.callbacks.clear();
    this.listWaiters.clear();
    this.drawSyncWaiters = [];
    this.nextListId = 1;
    this.nextCallbackId = 1;
  }

  // ============================================
  // EDRAM
  // ============================================

  /**
   * Get EDRAM base address
   */
  getEdramAddress(): number
  {
    return EDRAM_BASE;
  }

  /**
   * Get EDRAM size
   */
  getEdramSize(): number
  {
    return EDRAM_SIZE;
  }

  // ============================================
  // Display Lists
  // ============================================

  /**
   * Enqueue a display list
   *
   * @param list - List start address
   * @param stall - Stall address (0 = no stall)
   * @param callbackId - Callback ID (-1 = none)
   * @param arg - Callback argument
   * @returns List ID
   */
  enqueueList(
    list: number,
    stall: number,
    callbackId: number,
    arg: number
  ): number
  {
    const id = this.nextListId++;

    const displayList: DisplayList = {
      id,
      state: GeListState.Queued,
      startAddress: list,
      stallAddress: stall,
      callbackId,
      arg,
      ctx: 0,
      stackAddress: 0,
      stackPointer: 0,
    };

    this.lists.set(id, displayList);
    this.queue.push(id);

    // Auto-execute (simplified - real GPU would process commands)
    this.executeList(id);

    return id;
  }

  /**
   * Enqueue list at head of queue
   */
  enqueueListHead(
    list: number,
    stall: number,
    callbackId: number,
    arg: number
  ): number
  {
    const id = this.nextListId++;

    const displayList: DisplayList = {
      id,
      state: GeListState.Queued,
      startAddress: list,
      stallAddress: stall,
      callbackId,
      arg,
      ctx: 0,
      stackAddress: 0,
      stackPointer: 0,
    };

    this.lists.set(id, displayList);
    this.queue.unshift(id);

    this.executeList(id);

    return id;
  }

  /**
   * Dequeue a list
   */
  dequeueList(listId: number): number
  {
    const list = this.lists.get(listId);
    if (!list)
    {
      return SceKernelErrors.ERROR_INVALID_ID;
    }

    const index = this.queue.indexOf(listId);
    if (index !== -1)
    {
      this.queue.splice(index, 1);
    }

    list.state = GeListState.CancelDone;
    this.wakeListWaiters(listId);

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Update stall address
   */
  updateStallAddress(listId: number, stall: number): number
  {
    const list = this.lists.get(listId);
    if (!list)
    {
      return SceKernelErrors.ERROR_INVALID_ID;
    }

    list.stallAddress = stall;

    // Continue execution if stalled
    if (list.state === GeListState.StallReached)
    {
      this.executeList(listId);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Execute a display list (simplified)
   */
  private executeList(listId: number): void
  {
    const list = this.lists.get(listId);
    if (!list) return;

    // Simplified: immediately mark as done
    // Real GPU would parse and execute GE commands
    list.state = GeListState.Done;

    // Remove from queue
    const index = this.queue.indexOf(listId);
    if (index !== -1)
    {
      this.queue.splice(index, 1);
    }

    // Wake waiters
    this.wakeListWaiters(listId);

    // If queue is empty, wake draw sync waiters
    if (this.queue.length === 0)
    {
      this.wakeDrawSyncWaiters();
    }
  }

  /**
   * Get list state
   */
  getListState(listId: number): GeListState
  {
    const list = this.lists.get(listId);
    return list?.state ?? GeListState.Done;
  }

  // ============================================
  // Synchronization
  // ============================================

  /**
   * Wait for list to complete
   */
  listSync(
    listId: number,
    syncType: GeSyncType,
    thread: Waitable
  ): number | PromiseFast<number>
  {
    const list = this.lists.get(listId);
    if (!list)
    {
      return GeListState.Done; // Already done/doesn't exist
    }

    if (list.state === GeListState.Done || list.state === GeListState.CancelDone)
    {
      return list.state;
    }

    if (syncType === GeSyncType.Peek)
    {
      return list.state;
    }

    // Must wait
    const { promise, resolve } = PromiseFast.create<number>();

    if (!this.listWaiters.has(listId))
    {
      this.listWaiters.set(listId, []);
    }

    this.listWaiters.get(listId)!.push({
      waitable: thread,
      resolve,
    });

    thread.status = WaitStatus.WAIT;

    return promise;
  }

  /**
   * Wait for all lists to complete
   */
  drawSync(
    syncType: GeSyncType,
    thread: Waitable
  ): number | PromiseFast<number>
  {
    // Check if all lists are done
    if (this.queue.length === 0)
    {
      return GeListState.Done;
    }

    if (syncType === GeSyncType.Peek)
    {
      return GeListState.Queued;
    }

    // Must wait
    const { promise, resolve } = PromiseFast.create<number>();

    this.drawSyncWaiters.push({
      waitable: thread,
      resolve,
    });

    thread.status = WaitStatus.WAIT;

    return promise;
  }

  /**
   * Wake list waiters
   */
  private wakeListWaiters(listId: number): void
  {
    const waiters = this.listWaiters.get(listId);
    if (!waiters) return;

    const list = this.lists.get(listId);
    const state = list?.state ?? GeListState.Done;

    for (const entry of waiters)
    {
      entry.waitable.status = WaitStatus.READY;
      entry.resolve(state);
    }

    this.listWaiters.delete(listId);
  }

  /**
   * Wake draw sync waiters
   */
  private wakeDrawSyncWaiters(): void
  {
    const waiters = this.drawSyncWaiters;
    this.drawSyncWaiters = [];

    for (const entry of waiters)
    {
      entry.waitable.status = WaitStatus.READY;
      entry.resolve(GeListState.Done);
    }
  }

  // ============================================
  // Callbacks
  // ============================================

  /**
   * Set GE callback
   */
  setCallback(signal: number, finish: number, arg: number): number
  {
    const id = this.nextCallbackId++;

    this.callbacks.set(id, { signal, finish, arg });

    return id;
  }

  /**
   * Unset GE callback
   */
  unsetCallback(cbid: number): number
  {
    if (!this.callbacks.has(cbid))
    {
      return SceKernelErrors.ERROR_INVALID_ID;
    }

    this.callbacks.delete(cbid);
    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Control
  // ============================================

  /**
   * Continue GE execution
   */
  continue(): number
  {
    // Resume any stalled lists
    for (const list of this.lists.values())
    {
      if (list.state === GeListState.StallReached)
      {
        this.executeList(list.id);
      }
    }
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Break GE execution
   */
  break(mode: number): number
  {
    // Mark all queued lists as stalled
    for (const listId of this.queue)
    {
      const list = this.lists.get(listId);
      if (list)
      {
        list.state = GeListState.StallReached;
      }
    }
    return SceKernelErrors.ERROR_OK;
  }
}
