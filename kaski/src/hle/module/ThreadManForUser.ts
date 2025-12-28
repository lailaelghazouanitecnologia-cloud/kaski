/**
 * ThreadManForUser
 *
 * Thread management module.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';
import { ThreadStatus } from '../manager/ThreadManager';
import { SemaphoreInfo, MutexInfo, EventFlagWaitMode } from '../manager/SyncManager';
import { fromNullable, match } from '../../util/Result';

@hleModule('ThreadManForUser')
export class ThreadManForUser
{
  readonly name = 'ThreadManForUser';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  // ============================================
  // Thread Management
  // ============================================

  /**
   * sceKernelCreateThread
   * Create a new thread
   *
   * @param name - Thread name
   * @param entry - Entry point
   * @param priority - Initial priority
   * @param stackSize - Stack size
   * @param attr - Attributes
   * @param option - Options (unused)
   * @returns Thread UID or error
   */
  @nativeFunction(0x446D8DE6, 150)
  sceKernelCreateThread(): number
  {
    const namePtr = this.ctx.argPtr(0);
    const entry = this.ctx.arg(1);
    const priority = this.ctx.arg(2);
    const stackSize = this.ctx.arg(3);
    const attr = this.ctx.arg(4);

    const name = this.ctx.readString(namePtr);

    const { thread, error } = this.ctx.threadManager.createThread(
      name,
      entry,
      priority,
      stackSize,
      attr
    );

    if (!thread)
    {
      return error;
    }

    this.ctx.log(`Created thread "${name}" uid=${thread.uid} entry=0x${entry.toString(16)}`);
    return thread.uid;
  }

  /**
   * sceKernelDeleteThread
   * Delete a thread
   *
   * @param thid - Thread UID
   * @returns 0 or error
   */
  @nativeFunction(0x9FA03CD3, 150)
  sceKernelDeleteThread(): number
  {
    const thid = this.ctx.arg(0);
    return this.ctx.threadManager.deleteThread(thid);
  }

  /**
   * sceKernelStartThread
   * Start a dormant thread
   *
   * @param thid - Thread UID
   * @param arglen - Argument length
   * @param argp - Argument pointer
   * @returns 0 or error
   */
  @nativeFunction(0xF475845D, 150)
  sceKernelStartThread(): number
  {
    const thid = this.ctx.arg(0);
    const arglen = this.ctx.arg(1);
    const argp = this.ctx.arg(2);

    return this.ctx.threadManager.startThread(thid, arglen, argp);
  }

  /**
   * sceKernelExitThread
   * Exit current thread
   *
   * @param status - Exit status
   * @returns Never returns
   */
  @nativeFunction(0xAA73C935, 150)
  sceKernelExitThread(): number
  {
    const status = this.ctx.arg(0);
    return this.ctx.threadManager.exitThread(status);
  }

  /**
   * sceKernelExitDeleteThread
   * Exit and delete current thread
   *
   * @param status - Exit status
   * @returns Never returns
   */
  @nativeFunction(0x809CE29B, 150)
  sceKernelExitDeleteThread(): number
  {
    const status = this.ctx.arg(0);
    return this.ctx.threadManager.exitDeleteThread(status);
  }

  /**
   * sceKernelTerminateThread
   * Terminate a thread
   *
   * @param thid - Thread UID
   * @returns 0 or error
   */
  @nativeFunction(0x616403BA, 150)
  sceKernelTerminateThread(): number
  {
    const thid = this.ctx.arg(0);

    return match(
      fromNullable(this.ctx.threadManager.getThread(thid), SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD),
      thread =>
      {
        thread.status = ThreadStatus.DORMANT;
        thread.exitStatus = 0x800201A4; // SCE_KERNEL_ERROR_THREAD_TERMINATED
        return 0;
      },
      error => error
    );
  }

  /**
   * sceKernelSuspendThread
   * Suspend a thread
   *
   * @param thid - Thread UID
   * @returns 0 or error
   */
  @nativeFunction(0x9944F31F, 150)
  sceKernelSuspendThread(): number
  {
    const thid = this.ctx.arg(0);
    return this.ctx.threadManager.suspendThread(thid);
  }

  /**
   * sceKernelResumeThread
   * Resume a suspended thread
   *
   * @param thid - Thread UID
   * @returns 0 or error
   */
  @nativeFunction(0x75156E8F, 150)
  sceKernelResumeThread(): number
  {
    const thid = this.ctx.arg(0);
    return this.ctx.threadManager.resumeThread(thid);
  }

  /**
   * sceKernelGetThreadId
   * Get current thread ID
   *
   * @returns Current thread UID
   */
  @nativeFunction(0x293B45B8, 150)
  sceKernelGetThreadId(): number
  {
    return match(
      fromNullable(this.ctx.threadManager.getCurrentThread(), SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD),
      thread => thread.uid,
      error => error
    );
  }

  /**
   * sceKernelGetThreadCurrentPriority
   * Get current thread's priority
   *
   * @returns Priority
   */
  @nativeFunction(0x94AA61EE, 150)
  sceKernelGetThreadCurrentPriority(): number
  {
    const thread = this.ctx.threadManager.getCurrentThread();
    return thread?.priority ?? 0;
  }

  /**
   * sceKernelChangeThreadPriority
   * Change thread priority
   *
   * @param thid - Thread UID (0 = current)
   * @param priority - New priority
   * @returns 0 or error
   */
  @nativeFunction(0x71BC9871, 150)
  sceKernelChangeThreadPriority(): number
  {
    const thid = this.ctx.arg(0);
    const priority = this.ctx.arg(1);

    return this.ctx.threadManager.changeThreadPriority(thid, priority);
  }

  /**
   * sceKernelRotateThreadReadyQueue
   * Rotate thread ready queue
   *
   * @param priority - Priority level to rotate
   * @returns 0
   */
  @nativeFunction(0x912354A7, 150)
  sceKernelRotateThreadReadyQueue(): number
  {
    const priority = this.ctx.arg(0);
    return this.ctx.threadManager.rotateThreadReadyQueue(priority);
  }

  // ============================================
  // Delay/Sleep
  // ============================================

  /**
   * sceKernelDelayThread
   * Delay thread for specified microseconds
   *
   * @param delay - Delay in microseconds
   * @returns 0 or error
   */
  @nativeFunction(0xCEADEB47, 150)
  sceKernelDelayThread(): number | Promise<number>
  {
    const delay = this.ctx.arg(0);
    return this.ctx.threadManager.delayThread(delay).toPromise();
  }

  /**
   * sceKernelDelayThreadCB
   * Delay thread with callback processing
   *
   * @param delay - Delay in microseconds
   * @returns 0 or error
   */
  @nativeFunction(0x68DA9E36, 150)
  sceKernelDelayThreadCB(): number | Promise<number>
  {
    const delay = this.ctx.arg(0);
    const thread = this.ctx.threadManager.getCurrentThread();
    if (thread)
    {
      thread.callbackAccepting = true;
    }
    return this.ctx.threadManager.delayThread(delay).toPromise();
  }

  /**
   * sceKernelSleepThread
   * Put current thread to sleep
   *
   * @returns 0 or error
   */
  @nativeFunction(0x9ACE131E, 150)
  sceKernelSleepThread(): number | Promise<number>
  {
    return this.ctx.threadManager.sleepThread().toPromise();
  }

  /**
   * sceKernelSleepThreadCB
   * Put current thread to sleep with callback processing
   *
   * @returns 0 or error
   */
  @nativeFunction(0x82826F70, 150)
  sceKernelSleepThreadCB(): number | Promise<number>
  {
    const thread = this.ctx.threadManager.getCurrentThread();
    if (thread)
    {
      thread.callbackAccepting = true;
    }
    return this.ctx.threadManager.sleepThread().toPromise();
  }

  /**
   * sceKernelWakeupThread
   * Wake up a sleeping thread
   *
   * @param thid - Thread UID
   * @returns 0 or error
   */
  @nativeFunction(0xD59EAD2F, 150)
  sceKernelWakeupThread(): number
  {
    const thid = this.ctx.arg(0);
    return this.ctx.threadManager.wakeupThread(thid);
  }

  // ============================================
  // Callbacks
  // ============================================

  /**
   * sceKernelCreateCallback
   * Create a callback
   *
   * @param name - Callback name
   * @param func - Function address
   * @param arg - Common argument
   * @returns Callback UID or error
   */
  @nativeFunction(0xE81CAF8F, 150)
  sceKernelCreateCallback(): number
  {
    const namePtr = this.ctx.argPtr(0);
    const func = this.ctx.arg(1);
    const arg = this.ctx.arg(2);

    const name = this.ctx.readString(namePtr);
    const threadUid = this.ctx.threadManager.getCurrentThread()?.uid ?? 0;

    const { callback, error } = this.ctx.callbackManager.createCallback(
      name,
      threadUid,
      func,
      arg
    );

    if (!callback)
    {
      return error;
    }

    return callback.uid;
  }

  /**
   * sceKernelDeleteCallback
   * Delete a callback
   *
   * @param cbid - Callback UID
   * @returns 0 or error
   */
  @nativeFunction(0xEDBA5844, 150)
  sceKernelDeleteCallback(): number
  {
    const cbid = this.ctx.arg(0);
    return this.ctx.callbackManager.deleteCallback(cbid);
  }

  /**
   * sceKernelNotifyCallback
   * Notify a callback
   *
   * @param cbid - Callback UID
   * @param arg - Notification argument
   * @returns 0 or error
   */
  @nativeFunction(0xC11BA8C4, 150)
  sceKernelNotifyCallback(): number
  {
    const cbid = this.ctx.arg(0);
    const arg = this.ctx.arg(1);

    return this.ctx.callbackManager.notifyCallback(cbid, arg);
  }

  /**
   * sceKernelCancelCallback
   * Cancel a callback
   *
   * @param cbid - Callback UID
   * @returns 0 or error
   */
  @nativeFunction(0xBA4051D6, 150)
  sceKernelCancelCallback(): number
  {
    const cbid = this.ctx.arg(0);
    return this.ctx.callbackManager.cancelCallback(cbid);
  }

  /**
   * sceKernelCheckCallback
   * Check for pending callbacks
   *
   * @returns Number of callbacks executed
   */
  @nativeFunction(0x349D6D6C, 150)
  sceKernelCheckCallback(): number
  {
    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread)
    {
      return 0;
    }

    return this.ctx.callbackManager.getPendingCallbacks(thread.uid).length;
  }

  // ============================================
  // Semaphores
  // ============================================

  /**
   * sceKernelCreateSema
   * Create a semaphore
   *
   * @param name - Semaphore name
   * @param attr - Attributes
   * @param initCount - Initial count
   * @param maxCount - Maximum count
   * @param option - Options (unused)
   * @returns Semaphore UID or error
   */
  @nativeFunction(0xD6DA4BA1, 150)
  sceKernelCreateSema(): number
  {
    const namePtr = this.ctx.argPtr(0);
    const attr = this.ctx.arg(1);
    const initCount = this.ctx.arg(2);
    const maxCount = this.ctx.arg(3);

    const name = this.ctx.readString(namePtr);

    const { semaphore, error } = this.ctx.syncManager.createSemaphore(
      name,
      attr,
      initCount,
      maxCount
    );

    if (!semaphore)
    {
      return error;
    }

    this.ctx.log(`Created semaphore "${name}" uid=${semaphore.uid} init=${initCount} max=${maxCount}`);
    return semaphore.uid;
  }

  /**
   * sceKernelDeleteSema
   * Delete a semaphore
   *
   * @param semaId - Semaphore UID
   * @returns 0 or error
   */
  @nativeFunction(0x28B6489C, 150)
  sceKernelDeleteSema(): number
  {
    const semaId = this.ctx.arg(0);
    return this.ctx.syncManager.deleteSemaphore(semaId);
  }

  /**
   * sceKernelSignalSema
   * Signal a semaphore
   *
   * @param semaId - Semaphore UID
   * @param signal - Signal count
   * @returns 0 or error
   */
  @nativeFunction(0x3F53E640, 150)
  sceKernelSignalSema(): number
  {
    const semaId = this.ctx.arg(0);
    const signal = this.ctx.arg(1);

    return match(
      fromNullable(this.ctx.syncManager.getSemaphore(semaId), SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE),
      sema => sema.signal(signal),
      error => error
    );
  }

  /**
   * sceKernelWaitSema
   * Wait on a semaphore
   *
   * @param semaId - Semaphore UID
   * @param signal - Wait count
   * @param timeout - Timeout in microseconds (null = infinite)
   * @returns 0 or error
   */
  @nativeFunction(0x4E3A1105, 150)
  sceKernelWaitSema(): number | Promise<number>
  {
    const semaId = this.ctx.arg(0);
    const signal = this.ctx.arg(1);
    const timeoutPtr = this.ctx.argPtr(2);

    const sema = this.ctx.syncManager.getSemaphore(semaId);
    if (!sema)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE;
    }

    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    const timeout = timeoutPtr ? this.ctx.read32(timeoutPtr) : 0;

    const result = sema.wait(signal, thread, timeout);
    if (typeof result === 'number')
    {
      return result;
    }
    return result.toPromise();
  }

  /**
   * sceKernelWaitSemaCB
   * Wait on a semaphore with callback processing
   *
   * @param semaId - Semaphore UID
   * @param signal - Wait count
   * @param timeout - Timeout in microseconds
   * @returns 0 or error
   */
  @nativeFunction(0x6D212BAC, 150)
  sceKernelWaitSemaCB(): number | Promise<number>
  {
    const thread = this.ctx.threadManager.getCurrentThread();
    if (thread)
    {
      thread.callbackAccepting = true;
    }
    return this.sceKernelWaitSema();
  }

  /**
   * sceKernelPollSema
   * Poll a semaphore (non-blocking)
   *
   * @param semaId - Semaphore UID
   * @param signal - Poll count
   * @returns 0 or error
   */
  @nativeFunction(0x58B1F937, 150)
  sceKernelPollSema(): number
  {
    const semaId = this.ctx.arg(0);
    const signal = this.ctx.arg(1);

    return match(
      fromNullable(this.ctx.syncManager.getSemaphore(semaId), SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE),
      sema => sema.poll(signal),
      error => error
    );
  }

  /**
   * sceKernelReferSemaStatus
   * Get semaphore status
   *
   * @param semaId - Semaphore UID
   * @param infoPtr - Pointer to SceKernelSemaInfo
   * @returns 0 or error
   */
  @nativeFunction(0xBC6FEBC5, 150)
  sceKernelReferSemaStatus(): number
  {
    const semaId = this.ctx.arg(0);
    const infoPtr = this.ctx.argPtr(1);

    const info = this.ctx.syncManager.getSemaphoreInfo(semaId);
    if (!info)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE;
    }

    // Write SceKernelSemaInfo structure
    // 0x00: size (4)
    // 0x04: name (32)
    // 0x24: attr (4)
    // 0x28: initCount (4)
    // 0x2C: currentCount (4)
    // 0x30: maxCount (4)
    // 0x34: numWaitThreads (4)
    this.ctx.write32(infoPtr + 0x00, info.size);
    this.ctx.writeString(infoPtr + 0x04, info.name);
    this.ctx.write32(infoPtr + 0x24, info.attr);
    this.ctx.write32(infoPtr + 0x28, info.initCount);
    this.ctx.write32(infoPtr + 0x2C, info.currentCount);
    this.ctx.write32(infoPtr + 0x30, info.maxCount);
    this.ctx.write32(infoPtr + 0x34, info.numWaitThreads);

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Mutexes
  // ============================================

  /**
   * sceKernelCreateMutex
   * Create a mutex
   *
   * @param name - Mutex name
   * @param attr - Attributes (0x200 = recursive)
   * @param initCount - Initial lock count
   * @param option - Options (unused)
   * @returns Mutex UID or error
   */
  @nativeFunction(0xB7D098C6, 150)
  sceKernelCreateMutex(): number
  {
    const namePtr = this.ctx.argPtr(0);
    const attr = this.ctx.arg(1);
    const initCount = this.ctx.arg(2);

    const name = this.ctx.readString(namePtr);

    const { mutex, error } = this.ctx.syncManager.createMutex(name, attr, initCount);

    if (!mutex)
    {
      return error;
    }

    this.ctx.log(`Created mutex "${name}" uid=${mutex.uid} attr=0x${attr.toString(16)}`);
    return mutex.uid;
  }

  /**
   * sceKernelDeleteMutex
   * Delete a mutex
   *
   * @param mutexId - Mutex UID
   * @returns 0 or error
   */
  @nativeFunction(0xF8170FBE, 150)
  sceKernelDeleteMutex(): number
  {
    const mutexId = this.ctx.arg(0);
    return this.ctx.syncManager.deleteMutex(mutexId);
  }

  /**
   * sceKernelLockMutex
   * Lock a mutex
   *
   * @param mutexId - Mutex UID
   * @param lockCount - Lock count
   * @param timeout - Timeout in microseconds
   * @returns 0 or error
   */
  @nativeFunction(0xB011B11F, 150)
  sceKernelLockMutex(): number | Promise<number>
  {
    const mutexId = this.ctx.arg(0);
    const lockCount = this.ctx.arg(1);
    const timeoutPtr = this.ctx.argPtr(2);

    const mutex = this.ctx.syncManager.getMutex(mutexId);
    if (!mutex)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE;
    }

    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    const timeout = timeoutPtr ? this.ctx.read32(timeoutPtr) : 0;

    const result = mutex.lock(thread, timeout);
    if (typeof result === 'number')
    {
      return result;
    }
    return result.toPromise();
  }

  /**
   * sceKernelLockMutexCB
   * Lock a mutex with callback processing
   *
   * @param mutexId - Mutex UID
   * @param lockCount - Lock count
   * @param timeout - Timeout in microseconds
   * @returns 0 or error
   */
  @nativeFunction(0x5BF4DD27, 150)
  sceKernelLockMutexCB(): number | Promise<number>
  {
    const thread = this.ctx.threadManager.getCurrentThread();
    if (thread)
    {
      thread.callbackAccepting = true;
    }
    return this.sceKernelLockMutex();
  }

  /**
   * sceKernelTryLockMutex
   * Try to lock a mutex (non-blocking)
   *
   * @param mutexId - Mutex UID
   * @param lockCount - Lock count
   * @returns 0 or error
   */
  @nativeFunction(0x0DDCD2C9, 150)
  sceKernelTryLockMutex(): number
  {
    const mutexId = this.ctx.arg(0);

    const mutex = this.ctx.syncManager.getMutex(mutexId);
    if (!mutex)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE;
    }

    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    return mutex.tryLock(thread);
  }

  /**
   * sceKernelUnlockMutex
   * Unlock a mutex
   *
   * @param mutexId - Mutex UID
   * @param unlockCount - Unlock count
   * @returns 0 or error
   */
  @nativeFunction(0x6B30100F, 150)
  sceKernelUnlockMutex(): number
  {
    const mutexId = this.ctx.arg(0);

    const mutex = this.ctx.syncManager.getMutex(mutexId);
    if (!mutex)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE;
    }

    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    return mutex.unlock(thread);
  }

  // ============================================
  // Event Flags
  // ============================================

  /**
   * sceKernelCreateEventFlag
   * Create an event flag
   *
   * @param name - Event flag name
   * @param attr - Attributes
   * @param initPattern - Initial bit pattern
   * @param option - Options (unused)
   * @returns Event flag UID or error
   */
  @nativeFunction(0x55C20A00, 150)
  sceKernelCreateEventFlag(): number
  {
    const namePtr = this.ctx.argPtr(0);
    const attr = this.ctx.arg(1);
    const initPattern = this.ctx.arg(2);

    const name = this.ctx.readString(namePtr);

    const { eventFlag, error } = this.ctx.syncManager.createEventFlag(name, attr, initPattern);

    if (!eventFlag)
    {
      return error;
    }

    this.ctx.log(`Created event flag "${name}" uid=${eventFlag.uid} pattern=0x${initPattern.toString(16)}`);
    return eventFlag.uid;
  }

  /**
   * sceKernelDeleteEventFlag
   * Delete an event flag
   *
   * @param evid - Event flag UID
   * @returns 0 or error
   */
  @nativeFunction(0xEF9E4C70, 150)
  sceKernelDeleteEventFlag(): number
  {
    const evid = this.ctx.arg(0);
    return this.ctx.syncManager.deleteEventFlag(evid);
  }

  /**
   * sceKernelSetEventFlag
   * Set bits in an event flag
   *
   * @param evid - Event flag UID
   * @param bits - Bits to set
   * @returns 0 or error
   */
  @nativeFunction(0x1FB15A32, 150)
  sceKernelSetEventFlag(): number
  {
    const evid = this.ctx.arg(0);
    const bits = this.ctx.arg(1);

    return match(
      fromNullable(this.ctx.syncManager.getEventFlag(evid), SceKernelErrors.ERROR_KERNEL_NOT_FOUND_EVENT_FLAG),
      ef =>
      {
        ef.set(bits);
        return SceKernelErrors.ERROR_OK;
      },
      error => error
    );
  }

  /**
   * sceKernelClearEventFlag
   * Clear bits in an event flag
   *
   * @param evid - Event flag UID
   * @param bits - Bits to clear (inverted)
   * @returns 0 or error
   */
  @nativeFunction(0x812346E4, 150)
  sceKernelClearEventFlag(): number
  {
    const evid = this.ctx.arg(0);
    const bits = this.ctx.arg(1);

    return match(
      fromNullable(this.ctx.syncManager.getEventFlag(evid), SceKernelErrors.ERROR_KERNEL_NOT_FOUND_EVENT_FLAG),
      ef =>
      {
        ef.clear(~bits >>> 0); // PSP uses inverted mask
        return SceKernelErrors.ERROR_OK;
      },
      error => error
    );
  }

  /**
   * sceKernelWaitEventFlag
   * Wait for an event flag
   *
   * @param evid - Event flag UID
   * @param bits - Bits to wait for
   * @param wait - Wait mode (AND/OR/CLEAR)
   * @param outBits - Output matched bits
   * @param timeout - Timeout in microseconds
   * @returns 0 or error
   */
  @nativeFunction(0x402FCF22, 150)
  sceKernelWaitEventFlag(): number | Promise<number>
  {
    const evid = this.ctx.arg(0);
    const bits = this.ctx.arg(1);
    const wait = this.ctx.arg(2);
    const outBitsPtr = this.ctx.argPtr(3);
    const timeoutPtr = this.ctx.argPtr(4);

    const ef = this.ctx.syncManager.getEventFlag(evid);
    if (!ef)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_EVENT_FLAG;
    }

    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    const timeout = timeoutPtr ? this.ctx.read32(timeoutPtr) : 0;

    const result = ef.wait(bits, wait, thread, timeout);

    const handleResult = (matched: number): number =>
    {
      if (outBitsPtr)
      {
        this.ctx.write32(outBitsPtr, matched);
      }
      return SceKernelErrors.ERROR_OK;
    };

    if (typeof result === 'number')
    {
      return handleResult(result);
    }

    return result.then(handleResult).toPromise();
  }

  /**
   * sceKernelWaitEventFlagCB
   * Wait for an event flag with callback processing
   */
  @nativeFunction(0x328C546A, 150)
  sceKernelWaitEventFlagCB(): number | Promise<number>
  {
    const thread = this.ctx.threadManager.getCurrentThread();
    if (thread)
    {
      thread.callbackAccepting = true;
    }
    return this.sceKernelWaitEventFlag();
  }

  /**
   * sceKernelPollEventFlag
   * Poll an event flag (non-blocking)
   *
   * @param evid - Event flag UID
   * @param bits - Bits to check
   * @param wait - Wait mode
   * @param outBits - Output matched bits
   * @returns 0 or error
   */
  @nativeFunction(0x30FD48F0, 150)
  sceKernelPollEventFlag(): number
  {
    const evid = this.ctx.arg(0);
    const bits = this.ctx.arg(1);
    const wait = this.ctx.arg(2);
    const outBitsPtr = this.ctx.argPtr(3);

    const ef = this.ctx.syncManager.getEventFlag(evid);
    if (!ef)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_EVENT_FLAG;
    }

    const { success, pattern } = ef.poll(bits, wait);

    if (outBitsPtr)
    {
      this.ctx.write32(outBitsPtr, pattern);
    }

    if (!success)
    {
      return SceKernelErrors.ERROR_KERNEL_EVENT_FLAG_POLL_FAILED;
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelCancelEventFlag
   * Cancel all waiting threads
   *
   * @param evid - Event flag UID
   * @param newPattern - New pattern to set
   * @param numWaitThreads - Output number of cancelled threads
   * @returns 0 or error
   */
  @nativeFunction(0xCD203292, 150)
  sceKernelCancelEventFlag(): number
  {
    const evid = this.ctx.arg(0);
    const newPattern = this.ctx.arg(1);
    const numWaitPtr = this.ctx.argPtr(2);

    return match(
      fromNullable(this.ctx.syncManager.getEventFlag(evid), SceKernelErrors.ERROR_KERNEL_NOT_FOUND_EVENT_FLAG),
      ef =>
      {
        const numCancelled = ef.cancelAll();
        if (numWaitPtr)
        {
          this.ctx.write32(numWaitPtr, numCancelled);
        }
        // Set new pattern after cancelling
        ef.clear(0xFFFFFFFF);
        ef.set(newPattern);
        return SceKernelErrors.ERROR_OK;
      },
      error => error
    );
  }
}
