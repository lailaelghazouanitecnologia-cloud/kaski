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
   * sceKernelChangeCurrentThreadAttr
   * Change current thread attributes
   *
   * @param removeAttr - Attributes to remove
   * @param addAttr - Attributes to add
   * @returns 0
   */
  @nativeFunction(0xEA748E31, 150)
  sceKernelChangeCurrentThreadAttr(): number
  {
    const removeAttr = this.ctx.arg(0);
    const addAttr = this.ctx.arg(1);

    const thread = this.ctx.threadManager.getCurrentThread();
    if (thread)
    {
      thread.attributes = (thread.attributes & ~removeAttr) | addAttr;
    }

    return 0;
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
  // System Time
  // ============================================

  /**
   * sceKernelGetSystemTimeLow
   * Get low 32 bits of system time in microseconds
   *
   * @returns Low 32 bits of system time
   */
  @nativeFunction(0x369ED59D, 150)
  sceKernelGetSystemTimeLow(): number
  {
    // Return current time in microseconds (low 32 bits)
    return (performance.now() * 1000) >>> 0;
  }

  /**
   * sceKernelGetSystemTimeWide
   * Get system time as 64-bit value in microseconds
   *
   * @returns System time in microseconds (as 64-bit)
   */
  @nativeFunction(0x82BC5777, 150)
  sceKernelGetSystemTimeWide(): bigint
  {
    // Return current time in microseconds as 64-bit
    return BigInt(Math.floor(performance.now() * 1000));
  }

  /**
   * sceKernelGetSystemTime
   * Get system time and store in pointer
   *
   * @param timePtr - Pointer to store 64-bit time value
   * @returns 0 or error
   */
  @nativeFunction(0xDB738F35, 150)
  sceKernelGetSystemTime(): number
  {
    const timePtr = this.ctx.argPtr(0);
    if (!timePtr)
    {
      return SceKernelErrors.ERROR_INVALID_ARGUMENT;
    }

    const time = BigInt(Math.floor(performance.now() * 1000));
    this.ctx.write64(timePtr, time);
    return 0;
  }

  /**
   * sceKernelUSec2SysClock
   * Convert microseconds to system clock value
   *
   * @param usec - Microseconds
   * @param clockPtr - Pointer to store clock value
   * @returns 0 or error
   */
  @nativeFunction(0x110DEC9A, 150)
  sceKernelUSec2SysClock(): number
  {
    const usec = this.ctx.arg(0);
    const clockPtr = this.ctx.argPtr(1);

    if (clockPtr)
    {
      this.ctx.write64(clockPtr, BigInt(usec));
    }
    return 0;
  }

  /**
   * sceKernelUSec2SysClockWide
   * Convert microseconds to system clock value (wide)
   *
   * @param usec - Microseconds
   * @returns Clock value
   */
  @nativeFunction(0xC8CD158C, 150)
  sceKernelUSec2SysClockWide(): number
  {
    const usec = this.ctx.arg(0);
    // Simply return the microseconds value
    return usec;
  }

  // ============================================
  // Thread Wait/Status
  // ============================================

  /**
   * sceKernelWaitThreadEnd
   * Wait for thread to end
   *
   * @param thid - Thread UID
   * @param timeoutPtr - Timeout pointer
   * @returns Exit status or error
   */
  @nativeFunction(0x278C0DF5, 150)
  sceKernelWaitThreadEnd(): number
  {
    const thid = this.ctx.arg(0);
    // const timeoutPtr = this.ctx.argPtr(1);

    const thread = this.ctx.threadManager.getThread(thid);
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    // For now, return the exit status if thread is stopped
    // TODO: Implement actual waiting
    return thread.exitStatus;
  }

  /**
   * sceKernelWaitThreadEndCB
   * Wait for thread to end with callback processing
   *
   * @param thid - Thread UID
   * @param timeoutPtr - Timeout pointer
   * @returns Exit status or error
   */
  @nativeFunction(0x840E8133, 150)
  sceKernelWaitThreadEndCB(): number
  {
    const thid = this.ctx.arg(0);
    // const timeoutPtr = this.ctx.argPtr(1);

    const currentThread = this.ctx.threadManager.getCurrentThread();
    if (currentThread)
    {
      currentThread.callbackAccepting = true;
    }

    const thread = this.ctx.threadManager.getThread(thid);
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    return thread.exitStatus;
  }

  /**
   * sceKernelGetThreadExitStatus
   * Get thread exit status
   *
   * @param thid - Thread UID
   * @returns Exit status or error
   */
  @nativeFunction(0x3B183E26, 150)
  sceKernelGetThreadExitStatus(): number
  {
    const thid = this.ctx.arg(0);

    const thread = this.ctx.threadManager.getThread(thid);
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    return thread.exitStatus;
  }

  /**
   * sceKernelTerminateDeleteThread
   * Terminate and delete a thread
   *
   * @param thid - Thread UID
   * @returns 0 or error
   */
  @nativeFunction(0x383F7BCC, 150)
  sceKernelTerminateDeleteThread(): number
  {
    const thid = this.ctx.arg(0);

    // Terminate first
    const termResult = this.ctx.threadManager.terminateThread(thid);
    if (termResult !== 0)
    {
      return termResult;
    }

    // Then delete
    return this.ctx.threadManager.deleteThread(thid);
  }

  /**
   * sceKernelReferThreadStatus
   * Get thread status information
   *
   * @param thid - Thread UID
   * @param infoPtr - Pointer to SceKernelThreadInfo struct
   * @returns 0 or error
   */
  @nativeFunction(0x17C1684E, 150)
  sceKernelReferThreadStatus(): number
  {
    const thid = this.ctx.arg(0);
    const infoPtr = this.ctx.argPtr(1);

    const thread = this.ctx.threadManager.getThread(thid);
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    if (!infoPtr)
    {
      return SceKernelErrors.ERROR_INVALID_ARGUMENT;
    }

    // Write SceKernelThreadInfo structure
    // Size is at offset 0
    const size = this.ctx.read32(infoPtr);

    // Write thread info fields
    this.ctx.write32(infoPtr + 0, size); // size
    this.ctx.writeString(infoPtr + 4, thread.name, 32); // name[32]
    this.ctx.write32(infoPtr + 36, thread.attributes); // attr
    this.ctx.write32(infoPtr + 40, thread.status); // status
    this.ctx.write32(infoPtr + 44, thread.entryPoint); // entry
    this.ctx.write32(infoPtr + 48, thread.cpu.gpr[29]); // stack
    this.ctx.write32(infoPtr + 52, thread.stackSize); // stackSize
    this.ctx.write32(infoPtr + 56, thread.cpu.gpr[28]); // gpReg
    this.ctx.write32(infoPtr + 60, thread.priority); // initPriority
    this.ctx.write32(infoPtr + 64, thread.priority); // currentPriority
    this.ctx.write32(infoPtr + 68, 0); // waitType
    this.ctx.write32(infoPtr + 72, 0); // waitId
    this.ctx.write32(infoPtr + 76, 0); // wakeupCount
    this.ctx.write32(infoPtr + 80, thread.exitStatus); // exitStatus
    this.ctx.write32(infoPtr + 84, 0); // runClocksLow
    this.ctx.write32(infoPtr + 88, 0); // runClocksHigh
    this.ctx.write32(infoPtr + 92, 0); // intrPreemptCount
    this.ctx.write32(infoPtr + 96, 0); // threadPreemptCount
    this.ctx.write32(infoPtr + 100, 0); // releaseCount

    return 0;
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

  /**
   * sceKernelReferEventFlagStatus
   * Get event flag status
   *
   * @param evid - Event flag UID
   * @param infoPtr - Pointer to info structure
   * @returns 0 or error
   */
  @nativeFunction(0xA66B0120, 150)
  sceKernelReferEventFlagStatus(): number
  {
    const evid = this.ctx.arg(0);
    const infoPtr = this.ctx.argPtr(1);

    const ef = this.ctx.syncManager.getEventFlag(evid);
    if (!ef)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_EVENT_FLAG;
    }

    if (infoPtr)
    {
      // SceKernelEventFlagInfo structure:
      // 0x00: size (4 bytes)
      // 0x04: name (32 bytes)
      // 0x24: attr (4 bytes)
      // 0x28: initPattern (4 bytes)
      // 0x2C: currentPattern (4 bytes)
      // 0x30: numWaitThreads (4 bytes)
      const size = this.ctx.read32(infoPtr);
      if (size >= 0x34)
      {
        this.ctx.write32(infoPtr, 0x34); // size
        this.ctx.writeString(infoPtr + 4, ef.name, 32);
        this.ctx.write32(infoPtr + 0x24, ef.attr);
        this.ctx.write32(infoPtr + 0x28, ef.initialPattern);
        this.ctx.write32(infoPtr + 0x2C, ef.currentPattern);
        this.ctx.write32(infoPtr + 0x30, ef.waitingThreads);
      }
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelCancelSema
   * Cancel all waiting threads on a semaphore
   *
   * @param semaId - Semaphore UID
   * @param count - New semaphore count
   * @param numWaitThreadsPtr - Output for number of cancelled threads
   * @returns 0 or error
   */
  @nativeFunction(0x8FFDF9A2, 150)
  sceKernelCancelSema(): number
  {
    const semaId = this.ctx.arg(0);
    const count = this.ctx.arg(1);
    const numWaitPtr = this.ctx.argPtr(2);

    const info = this.ctx.syncManager.getSemaphoreInfo(semaId);
    if (!info)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE;
    }

    const sema = this.ctx.syncManager.getSemaphore(semaId);
    if (!sema)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE;
    }

    // Get number of waiting threads before cancel
    const numWaiting = info.numWaitThreads;
    if (numWaitPtr)
    {
      this.ctx.write32(numWaitPtr, numWaiting);
    }

    // Cancel all waiting threads
    sema.cancelAll();

    return SceKernelErrors.ERROR_OK;
  }

  // ========================================
  // Fixed Pool (FPL) functions - stub implementations
  // ========================================

  /**
   * sceKernelCreateFpl
   * Create a fixed pool memory block
   *
   * @param name - Pool name
   * @param partitionId - Memory partition ID
   * @param attr - Pool attributes
   * @param size - Block size
   * @param blocks - Number of blocks
   * @param optionsPtr - Options pointer
   * @returns FPL UID or error
   */
  @nativeFunction(0xC07BB470, 150)
  sceKernelCreateFpl(): number
  {
    const namePtr = this.ctx.argPtr(0);
    const partitionId = this.ctx.arg(1);
    const attr = this.ctx.arg(2);
    const size = this.ctx.arg(3);
    const blocks = this.ctx.arg(4);
    // optionsPtr = this.ctx.argPtr(5);

    const name = namePtr ? this.ctx.readString(namePtr, 32) : '';
    console.warn(`sceKernelCreateFpl: ${name} (partition=${partitionId}, size=${size}, blocks=${blocks}) - stub`);

    // Return a dummy UID for now
    return 1;
  }

  /**
   * sceKernelAllocateFpl
   * Allocate a block from a fixed pool
   *
   * @param uid - FPL UID
   * @param dataPtr - Output address pointer
   * @param timeoutPtr - Timeout pointer
   * @returns 0 or error
   */
  @nativeFunction(0xD979E9BF, 150)
  sceKernelAllocateFpl(): number
  {
    const uid = this.ctx.arg(0);
    const dataPtr = this.ctx.argPtr(1);
    // timeoutPtr = this.ctx.argPtr(2);

    console.warn(`sceKernelAllocateFpl: uid=${uid} - stub`);

    // Return a dummy address in user memory
    if (dataPtr)
    {
      this.ctx.write32(dataPtr, 0x08900000);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelFreeFpl
   * Free a block back to a fixed pool
   *
   * @param uid - FPL UID
   * @param dataPtr - Address to free
   * @returns 0 or error
   */
  @nativeFunction(0xF6414A71, 150)
  sceKernelFreeFpl(): number
  {
    const uid = this.ctx.arg(0);
    const dataPtr = this.ctx.argPtr(1);

    console.warn(`sceKernelFreeFpl: uid=${uid}, addr=${dataPtr?.toString(16)} - stub`);

    return SceKernelErrors.ERROR_OK;
  }

  // ========================================
  // Variable Pool (VPL) functions - stub implementations
  // ========================================

  /**
   * sceKernelCreateVpl
   * Create a variable pool memory block
   *
   * @param name - Pool name
   * @param partitionId - Memory partition ID
   * @param attr - Pool attributes
   * @param size - Pool size
   * @param optionsPtr - Options pointer
   * @returns VPL UID or error
   */
  @nativeFunction(0x56C039B5, 150)
  sceKernelCreateVpl(): number
  {
    const namePtr = this.ctx.argPtr(0);
    const partitionId = this.ctx.arg(1);
    const attr = this.ctx.arg(2);
    const size = this.ctx.arg(3);
    // optionsPtr = this.ctx.argPtr(4);

    const name = namePtr ? this.ctx.readString(namePtr, 32) : '';
    console.warn(`sceKernelCreateVpl: ${name} (partition=${partitionId}, size=${size}) - stub`);

    // Return a dummy UID for now
    return 1;
  }

  /**
   * sceKernelTryAllocateVpl
   * Try to allocate from a variable pool (non-blocking)
   *
   * @param uid - VPL UID
   * @param size - Size to allocate
   * @param addressPtr - Output address pointer
   * @returns 0 or error
   */
  @nativeFunction(0xAF36D708, 150)
  sceKernelTryAllocateVpl(): number
  {
    const uid = this.ctx.arg(0);
    const size = this.ctx.arg(1);
    const addressPtr = this.ctx.argPtr(2);

    console.warn(`sceKernelTryAllocateVpl: uid=${uid}, size=${size} - stub`);

    // Return a dummy address in user memory
    if (addressPtr)
    {
      this.ctx.write32(addressPtr, 0x08A00000);
    }

    return SceKernelErrors.ERROR_OK;
  }
}
