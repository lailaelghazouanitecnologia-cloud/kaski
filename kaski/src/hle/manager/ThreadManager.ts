/**
 * Thread Manager
 *
 * Manages PSP threads including creation, scheduling, and state management.
 */

import { UidCollection } from '../../util/UidCollection';
import { Signal1 } from '../../util/Signal';
import { PromiseFast, Deferred } from '../../util/PromiseFast';
import { SceKernelErrors } from '../errors';
import type { CpuState } from '../../core/cpu/CpuState';
import type { MemoryManager, MemoryPartition } from './MemoryManager';
import { PartitionId, MemoryAnchor } from './MemoryManager';

// ============================================
// Constants
// ============================================

/** Thread status flags */
export const enum ThreadStatus
{
  RUNNING = 0x01,
  READY = 0x02,
  WAIT = 0x04,
  SUSPEND = 0x08,
  DORMANT = 0x10,
  DEAD = 0x20,
  WAIT_SUSPEND = WAIT | SUSPEND,
}

/** Thread attributes */
export const enum ThreadAttributes
{
  NONE = 0x00000000,
  LOW_STACK = 0x00000010,
  VFPU = 0x00004000,
  USER = 0x80000000,
  USBWLAN = 0xA0000000,
  VSH = 0xC0000000,
  SCRATCH_SRAM = 0x00008000,
  NO_FILLSTACK = 0x00100000,
  CLEAR_STACK = 0x00200000,
}

/** Wait types */
export const enum WaitType
{
  NONE = 0,
  SLEEP = 1,
  DELAY = 2,
  SEMA = 3,
  EVENTFLAG = 4,
  MBX = 5,
  VPL = 6,
  FPL = 7,
  MSGPIPE_SEND = 8,
  MSGPIPE_RECV = 9,
  THREAD_END = 10,
  CALLBACK = 11,
  MUTEX = 12,
  LWMUTEX = 13,
  CTRL = 14,
  IO = 15,
  UMD = 16,
  VBLANK = 17,
  HLEDELAY = 18,
}

/** Default stack size */
const DEFAULT_STACK_SIZE = 0x4000; // 16KB

/** Priority range */
const MIN_PRIORITY = 1;
const MAX_PRIORITY = 127;

// ============================================
// Thread
// ============================================

/**
 * A PSP thread
 */
export class Thread
{
  /** Thread UID */
  uid: number = 0;

  /** Thread name */
  name: string;

  /** Entry point address */
  entryPoint: number;

  /** Stack pointer */
  sp: number = 0;

  /** Stack size */
  stackSize: number;

  /** Stack memory block */
  stackBlock: MemoryPartition | null = null;

  /** Thread priority (lower = higher priority) */
  priority: number;

  /** Initial priority */
  initialPriority: number;

  /** Thread attributes */
  attributes: number;

  /** Thread status */
  status: ThreadStatus = ThreadStatus.DORMANT;

  /** Exit status */
  exitStatus: number = 0;

  /** Wait type */
  waitType: WaitType = WaitType.NONE;

  /** Wait object ID */
  waitId: number = 0;

  /** Wait timeout (0 = infinite) */
  waitTimeout: number = 0;

  /** Wake up count (for sceKernelWakeupThread) */
  wakeupCount: number = 0;

  /** Callback accepting */
  callbackAccepting: boolean = false;

  /** CPU state for this thread */
  cpu: CpuState | null = null;

  /** Deferred for wait completion */
  waitDeferred: Deferred<number> | null = null;

  /** GP value */
  gp: number = 0;

  constructor(
    name: string,
    entryPoint: number,
    priority: number,
    stackSize: number = DEFAULT_STACK_SIZE,
    attributes: number = ThreadAttributes.USER
  )
  {
    this.name = name;
    this.entryPoint = entryPoint;
    this.priority = Math.max(MIN_PRIORITY, Math.min(MAX_PRIORITY, priority));
    this.initialPriority = this.priority;
    this.stackSize = stackSize;
    this.attributes = attributes;
  }

  /** Is thread running? */
  get isRunning(): boolean
  {
    return this.status === ThreadStatus.RUNNING;
  }

  /** Is thread ready to run? */
  get isReady(): boolean
  {
    return this.status === ThreadStatus.READY;
  }

  /** Is thread waiting? */
  get isWaiting(): boolean
  {
    return (this.status & ThreadStatus.WAIT) !== 0;
  }

  /** Is thread suspended? */
  get isSuspended(): boolean
  {
    return (this.status & ThreadStatus.SUSPEND) !== 0;
  }

  /** Is thread dormant? */
  get isDormant(): boolean
  {
    return this.status === ThreadStatus.DORMANT;
  }

  /** Is thread dead? */
  get isDead(): boolean
  {
    return this.status === ThreadStatus.DEAD;
  }

  /** Can thread be scheduled? */
  get canSchedule(): boolean
  {
    return this.status === ThreadStatus.READY;
  }

  /**
   * Start waiting with optional timeout
   */
  startWait(type: WaitType, id: number = 0, timeout: number = 0): PromiseFast<number>
  {
    this.waitType = type;
    this.waitId = id;
    this.waitTimeout = timeout;
    this.status = ThreadStatus.WAIT;
    this.waitDeferred = new Deferred<number>();
    return this.waitDeferred.promise;
  }

  /**
   * Complete wait
   */
  completeWait(result: number): void
  {
    if (this.waitDeferred)
    {
      this.waitDeferred.resolve(result);
      this.waitDeferred = null;
    }
    this.waitType = WaitType.NONE;
    this.waitId = 0;
    this.waitTimeout = 0;
    if (this.status === ThreadStatus.WAIT)
    {
      this.status = ThreadStatus.READY;
    }
    else if (this.status === ThreadStatus.WAIT_SUSPEND)
    {
      this.status = ThreadStatus.SUSPEND;
    }
  }

  /**
   * Cancel wait
   */
  cancelWait(error: number = SceKernelErrors.ERROR_KERNEL_WAIT_CANCELLED): void
  {
    this.completeWait(error);
  }
}

// ============================================
// Thread Manager
// ============================================

/**
 * Thread Manager
 */
export class ThreadManager
{
  /** All threads by UID */
  private threads: UidCollection<Thread> = new UidCollection();

  /** Currently running thread */
  private currentThread: Thread | null = null;

  /** Idle thread */
  private idleThread: Thread | null = null;

  /** Signal when thread list changes */
  readonly onThreadChange: Signal1<Thread> = new Signal1();

  /** Memory manager reference */
  private memoryManager: MemoryManager;

  constructor(memoryManager: MemoryManager)
  {
    this.memoryManager = memoryManager;
  }

  /**
   * Reset to initial state
   */
  reset(): void
  {
    this.threads.clear();
    this.currentThread = null;
    this.idleThread = null;
  }

  /**
   * Create a new thread
   */
  createThread(
    name: string,
    entryPoint: number,
    priority: number,
    stackSize: number = DEFAULT_STACK_SIZE,
    attributes: number = ThreadAttributes.USER,
    optionAddr: number = 0
  ): { thread: Thread | null; error: number }
  {
    // Validate priority
    if (priority < MIN_PRIORITY || priority > MAX_PRIORITY)
    {
      return { thread: null, error: SceKernelErrors.ERROR_KERNEL_ILLEGAL_THREAD_PRIORITY };
    }

    // Validate stack size
    if (stackSize < 0x200)
    {
      return { thread: null, error: SceKernelErrors.ERROR_KERNEL_ILLEGAL_STACK_SIZE };
    }

    // Align stack size
    stackSize = (stackSize + 0xFF) & ~0xFF;

    // Allocate stack
    const { block: stackBlock, error: allocError } = this.memoryManager.allocate(
      PartitionId.UserStacks,
      stackSize,
      MemoryAnchor.High,
      0,
      0x100,
      `${name}_stack`
    );

    if (!stackBlock)
    {
      return { thread: null, error: allocError };
    }

    // Create thread
    const thread = new Thread(name, entryPoint, priority, stackSize, attributes);
    thread.stackBlock = stackBlock;
    thread.sp = stackBlock.address + stackBlock.size;
    thread.uid = this.threads.allocate(thread);

    this.onThreadChange.dispatch(thread);

    return { thread, error: SceKernelErrors.ERROR_OK };
  }

  /**
   * Delete a thread
   */
  deleteThread(uid: number): number
  {
    const thread = this.threads.get(uid);
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    if (!thread.isDormant && !thread.isDead)
    {
      return SceKernelErrors.ERROR_KERNEL_THREAD_IS_NOT_DORMANT;
    }

    // Free stack
    if (thread.stackBlock)
    {
      this.memoryManager.free(thread.stackBlock);
      thread.stackBlock = null;
    }

    this.threads.release(uid);
    this.onThreadChange.dispatch(thread);

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Start a dormant thread
   */
  startThread(uid: number, argSize: number = 0, argAddr: number = 0): number
  {
    const thread = this.threads.get(uid);
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    if (!thread.isDormant)
    {
      return SceKernelErrors.ERROR_KERNEL_THREAD_IS_NOT_DORMANT;
    }

    // Set up CPU state
    if (thread.cpu)
    {
      thread.cpu.pc = thread.entryPoint;
      thread.cpu.gpr[29] = thread.sp; // SP
      thread.cpu.gpr[28] = thread.gp; // GP
      thread.cpu.gpr[4] = argSize;    // a0 = arglen
      thread.cpu.gpr[5] = argAddr;    // a1 = argp
      thread.cpu.gpr[31] = 0;         // RA = 0 (will exit thread)
    }

    thread.status = ThreadStatus.READY;
    this.onThreadChange.dispatch(thread);

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Exit current thread
   */
  exitThread(status: number): number
  {
    if (!this.currentThread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    this.currentThread.exitStatus = status;
    this.currentThread.status = ThreadStatus.DORMANT;
    this.onThreadChange.dispatch(this.currentThread);

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Exit and delete current thread
   */
  exitDeleteThread(status: number): number
  {
    if (!this.currentThread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    const uid = this.currentThread.uid;
    this.currentThread.exitStatus = status;
    this.currentThread.status = ThreadStatus.DEAD;

    // Free stack
    if (this.currentThread.stackBlock)
    {
      this.memoryManager.free(this.currentThread.stackBlock);
      this.currentThread.stackBlock = null;
    }

    this.threads.release(uid);
    this.onThreadChange.dispatch(this.currentThread);
    this.currentThread = null;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Suspend a thread
   */
  suspendThread(uid: number): number
  {
    const thread = this.threads.get(uid);
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    if (thread.isSuspended)
    {
      return SceKernelErrors.ERROR_KERNEL_THREAD_ALREADY_SUSPEND;
    }

    if (thread.isDormant || thread.isDead)
    {
      return SceKernelErrors.ERROR_KERNEL_THREAD_ALREADY_DORMANT;
    }

    if (thread.isWaiting)
    {
      thread.status = ThreadStatus.WAIT_SUSPEND;
    }
    else
    {
      thread.status = ThreadStatus.SUSPEND;
    }

    this.onThreadChange.dispatch(thread);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Resume a suspended thread
   */
  resumeThread(uid: number): number
  {
    const thread = this.threads.get(uid);
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    if (!thread.isSuspended)
    {
      return SceKernelErrors.ERROR_KERNEL_THREAD_IS_NOT_SUSPEND;
    }

    if (thread.status === ThreadStatus.WAIT_SUSPEND)
    {
      thread.status = ThreadStatus.WAIT;
    }
    else
    {
      thread.status = ThreadStatus.READY;
    }

    this.onThreadChange.dispatch(thread);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Change thread priority
   */
  changeThreadPriority(uid: number, priority: number): number
  {
    const thread = uid === 0 ? this.currentThread : this.threads.get(uid);
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    if (priority < MIN_PRIORITY || priority > MAX_PRIORITY)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_THREAD_PRIORITY;
    }

    thread.priority = priority;
    this.onThreadChange.dispatch(thread);

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Get thread by UID
   */
  getThread(uid: number): Thread | undefined
  {
    if (uid === 0) return this.currentThread ?? undefined;
    return this.threads.get(uid);
  }

  /**
   * Get current thread
   */
  getCurrentThread(): Thread | null
  {
    return this.currentThread;
  }

  /**
   * Set current thread
   */
  setCurrentThread(thread: Thread | null): void
  {
    if (this.currentThread && this.currentThread !== thread)
    {
      if (this.currentThread.isRunning)
      {
        this.currentThread.status = ThreadStatus.READY;
      }
    }

    this.currentThread = thread;
    if (thread)
    {
      thread.status = ThreadStatus.RUNNING;
    }
  }

  /**
   * Get all threads
   */
  getAllThreads(): Thread[]
  {
    return [...this.threads.values()];
  }

  /**
   * Get ready threads sorted by priority
   */
  getReadyThreads(): Thread[]
  {
    return this.getAllThreads()
      .filter(t => t.canSchedule)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get next thread to run
   */
  getNextThread(): Thread | null
  {
    const ready = this.getReadyThreads();
    return ready.length > 0 ? ready[0] : this.idleThread;
  }

  /**
   * Schedule next thread
   */
  schedule(): Thread | null
  {
    const next = this.getNextThread();
    this.setCurrentThread(next);
    return next;
  }

  /**
   * Sleep current thread
   */
  sleepThread(): PromiseFast<number>
  {
    if (!this.currentThread)
    {
      return PromiseFast.resolve(SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD);
    }

    if (this.currentThread.wakeupCount > 0)
    {
      this.currentThread.wakeupCount--;
      return PromiseFast.resolve(SceKernelErrors.ERROR_OK);
    }

    return this.currentThread.startWait(WaitType.SLEEP);
  }

  /**
   * Wakeup a sleeping thread
   */
  wakeupThread(uid: number): number
  {
    const thread = this.threads.get(uid);
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    if (thread.waitType === WaitType.SLEEP)
    {
      thread.completeWait(SceKernelErrors.ERROR_OK);
    }
    else
    {
      thread.wakeupCount++;
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Delay current thread
   */
  delayThread(microseconds: number): PromiseFast<number>
  {
    if (!this.currentThread)
    {
      return PromiseFast.resolve(SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD);
    }

    const thread = this.currentThread;
    const promise = thread.startWait(WaitType.DELAY, 0, microseconds);

    // Schedule wakeup
    setTimeout(() =>
    {
      if (thread.waitType === WaitType.DELAY)
      {
        thread.completeWait(SceKernelErrors.ERROR_OK);
      }
    }, microseconds / 1000);

    return promise;
  }

  /**
   * Rotate ready queue (yield to same-priority threads)
   */
  rotateThreadReadyQueue(priority: number): number
  {
    // Find threads with this priority
    const threads = this.getAllThreads()
      .filter(t => t.canSchedule && t.priority === priority);

    if (threads.length < 2)
    {
      return SceKernelErrors.ERROR_OK;
    }

    // Move current thread to end if it matches priority
    if (this.currentThread?.priority === priority)
    {
      this.schedule();
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Get thread count
   */
  get threadCount(): number
  {
    return this.threads.size;
  }
}
