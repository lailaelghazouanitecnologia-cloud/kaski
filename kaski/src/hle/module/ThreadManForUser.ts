/**
 * ThreadManForUser
 *
 * Thread management module.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';
import { ThreadStatus } from '../manager/ThreadManager';
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
}
