/**
 * sceGe_user
 *
 * Graphics Engine (GE) user mode module.
 * Provides GPU command list management and synchronization.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { GeSyncType, GeListState } from '../manager/GpuManager';
import { SceKernelErrors } from '../errors';

@hleModule('sceGe_user')
export class sceGe_user
{
  readonly name = 'sceGe_user';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  // ============================================
  // EDRAM Functions
  // ============================================

  /**
   * sceGeEdramGetSize
   * Get EDRAM (VRAM) size
   *
   * @returns EDRAM size in bytes (2MB)
   */
  @nativeFunction(0x1F6752AD, 150)
  sceGeEdramGetSize(): number
  {
    return this.ctx.gpuManager.getEdramSize();
  }

  /**
   * sceGeEdramGetAddr
   * Get EDRAM base address
   *
   * @returns EDRAM base address (0x04000000)
   */
  @nativeFunction(0xE47E40E4, 150)
  sceGeEdramGetAddr(): number
  {
    return this.ctx.gpuManager.getEdramAddress();
  }

  /**
   * sceGeEdramSetAddrTranslation
   * Set EDRAM address translation
   *
   * @param size - Translation size
   * @returns Previous size
   */
  @nativeFunction(0xB77905EA, 150)
  sceGeEdramSetAddrTranslation(): number
  {
    const size = this.ctx.arg(0);
    // No-op, return success
    return size;
  }

  // ============================================
  // Display List Functions
  // ============================================

  /**
   * sceGeListEnQueue
   * Enqueue a display list for execution
   *
   * @param list - List start address
   * @param stall - Stall address (0 = no stall)
   * @param cbid - Callback ID
   * @param arg - Callback argument
   * @returns List ID or error
   */
  @nativeFunction(0xAB49E76A, 150)
  sceGeListEnQueue(): number
  {
    const list = this.ctx.arg(0);
    const stall = this.ctx.arg(1);
    const cbid = this.ctx.arg(2);
    const argPtr = this.ctx.argPtr(3);

    this.ctx.log(`sceGeListEnQueue(0x${list.toString(16)}, 0x${stall.toString(16)}, ${cbid})`);

    const id = this.ctx.gpuManager.enqueueList(list, stall, cbid, argPtr);
    return id;
  }

  /**
   * sceGeListEnQueueHead
   * Enqueue a display list at head of queue
   *
   * @param list - List start address
   * @param stall - Stall address
   * @param cbid - Callback ID
   * @param arg - Callback argument
   * @returns List ID or error
   */
  @nativeFunction(0x1C0D95A6, 150)
  sceGeListEnQueueHead(): number
  {
    const list = this.ctx.arg(0);
    const stall = this.ctx.arg(1);
    const cbid = this.ctx.arg(2);
    const argPtr = this.ctx.argPtr(3);

    const id = this.ctx.gpuManager.enqueueListHead(list, stall, cbid, argPtr);
    return id;
  }

  /**
   * sceGeListDeQueue
   * Dequeue a display list
   *
   * @param qid - List ID
   * @returns 0 on success
   */
  @nativeFunction(0x5FB86AB0, 150)
  sceGeListDeQueue(): number
  {
    const qid = this.ctx.arg(0);
    return this.ctx.gpuManager.dequeueList(qid);
  }

  /**
   * sceGeListUpdateStallAddr
   * Update stall address for a list
   *
   * @param qid - List ID
   * @param stall - New stall address
   * @returns 0 on success
   */
  @nativeFunction(0xE0D68148, 150)
  sceGeListUpdateStallAddr(): number
  {
    const qid = this.ctx.arg(0);
    const stall = this.ctx.arg(1);

    return this.ctx.gpuManager.updateStallAddress(qid, stall);
  }

  // ============================================
  // Synchronization
  // ============================================

  /**
   * sceGeListSync
   * Wait for a display list to complete
   *
   * @param qid - List ID
   * @param syncType - Sync type (0=wait, 1=peek)
   * @returns List state
   */
  @nativeFunction(0x03444EB4, 150)
  sceGeListSync(): number | Promise<number>
  {
    const qid = this.ctx.arg(0);
    const syncType = this.ctx.arg(1) as GeSyncType;

    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    const result = this.ctx.gpuManager.listSync(qid, syncType, thread);
    if (typeof result === 'number')
    {
      return result;
    }
    return result.toPromise();
  }

  /**
   * sceGeDrawSync
   * Wait for all display lists to complete
   *
   * @param syncType - Sync type (0=wait, 1=peek)
   * @returns Status
   */
  @nativeFunction(0xB287BD61, 150)
  sceGeDrawSync(): number | Promise<number>
  {
    const syncType = this.ctx.arg(0) as GeSyncType;

    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    const result = this.ctx.gpuManager.drawSync(syncType, thread);
    if (typeof result === 'number')
    {
      return result;
    }
    return result.toPromise();
  }

  // ============================================
  // Control
  // ============================================

  /**
   * sceGeContinue
   * Continue GE execution after break
   *
   * @returns 0 on success
   */
  @nativeFunction(0x4C06E472, 150)
  sceGeContinue(): number
  {
    return this.ctx.gpuManager.continue();
  }

  /**
   * sceGeBreak
   * Break GE execution
   *
   * @param mode - Break mode
   * @param pParam - Parameter
   * @returns 0 on success
   */
  @nativeFunction(0xB448EC0D, 150)
  sceGeBreak(): number
  {
    const mode = this.ctx.arg(0);
    return this.ctx.gpuManager.break(mode);
  }

  // ============================================
  // Callbacks
  // ============================================

  /**
   * sceGeSetCallback
   * Set GE callbacks
   *
   * @param cbPtr - Pointer to PspGeCallbackData
   * @returns Callback ID
   */
  @nativeFunction(0xA4FC06A4, 150)
  sceGeSetCallback(): number
  {
    const cbPtr = this.ctx.argPtr(0);

    // PspGeCallbackData:
    // 0x00: signal_func
    // 0x04: signal_arg
    // 0x08: finish_func
    // 0x0C: finish_arg
    const signalFunc = this.ctx.read32(cbPtr + 0x00);
    const signalArg = this.ctx.read32(cbPtr + 0x04);
    const finishFunc = this.ctx.read32(cbPtr + 0x08);
    const finishArg = this.ctx.read32(cbPtr + 0x0C);

    return this.ctx.gpuManager.setCallback(signalFunc, finishFunc, signalArg);
  }

  /**
   * sceGeUnsetCallback
   * Unset GE callbacks
   *
   * @param cbid - Callback ID
   * @returns 0 on success
   */
  @nativeFunction(0x05DB22CE, 150)
  sceGeUnsetCallback(): number
  {
    const cbid = this.ctx.arg(0);
    return this.ctx.gpuManager.unsetCallback(cbid);
  }

  // ============================================
  // Context/State (Stubs)
  // ============================================

  /**
   * sceGeSaveContext
   * Save GE context
   *
   * @param contextPtr - Context buffer
   * @returns 0 on success
   */
  @nativeFunction(0x438A385A, 150)
  sceGeSaveContext(): number
  {
    // No-op for now
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceGeRestoreContext
   * Restore GE context
   *
   * @param contextPtr - Context buffer
   * @returns 0 on success
   */
  @nativeFunction(0x0BF608FB, 150)
  sceGeRestoreContext(): number
  {
    // No-op for now
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceGeGetMtx
   * Get matrix from GE
   *
   * @param type - Matrix type
   * @param matrixPtr - Output matrix
   * @returns 0 on success
   */
  @nativeFunction(0x57C8945B, 150)
  sceGeGetMtx(): number
  {
    // No-op for now
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceGeGetCmd
   * Get GE command value
   *
   * @param cmd - Command ID
   * @returns Command value
   */
  @nativeFunction(0xDC93CFEF, 150)
  sceGeGetCmd(): number
  {
    // Return 0 for all commands
    return 0;
  }

  /**
   * sceGeGetStack
   * Get GE stack
   *
   * @param stackId - Stack ID
   * @param stackPtr - Output stack info
   * @returns 0 on success
   */
  @nativeFunction(0xE66CB92E, 150)
  sceGeGetStack(): number
  {
    return SceKernelErrors.ERROR_OK;
  }
}
