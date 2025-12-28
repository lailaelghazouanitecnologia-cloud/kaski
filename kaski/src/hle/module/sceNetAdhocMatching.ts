/**
 * sceNetAdhocMatching
 *
 * Ad-hoc matching module.
 * Handles player matching for multiplayer games.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * Matching mode
 */
const enum MatchingMode
{
  Host = 1,
  Client = 2,
  Ptp = 3,
}

/**
 * Matching event
 */
const enum MatchingEvent
{
  Hello = 1,
  Join = 2,
  Left = 3,
  Reject = 4,
  Cancel = 5,
  Accept = 6,
  Complete = 7,
  Timeout = 8,
  Error = 9,
  Disconnect = 10,
  Data = 11,
  DataConfirm = 12,
  DataTimeout = 13,
}

/**
 * Matching context
 */
interface MatchingContext
{
  id: number;
  mode: MatchingMode;
  maxPeers: number;
  port: number;
  bufSize: number;
  callback: number;
  started: boolean;
}

@hleModule('sceNetAdhocMatching')
export class sceNetAdhocMatching
{
  readonly name = 'sceNetAdhocMatching';

  private ctx!: EmulatorContext;

  private contexts: MatchingContext[] = [];
  private nextContextId = 1;
  private poolSize = 0;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
    this.contexts = [];
    this.nextContextId = 1;
    this.poolSize = 0;
  }

  /**
   * sceNetAdhocMatchingInit
   * Initialize matching library
   *
   * @param memSize - Memory pool size
   * @returns 0 on success
   */
  @nativeFunction(0x2A2A1E07, 150)
  sceNetAdhocMatchingInit(): number
  {
    const memSize = this.ctx.arg(0);
    this.poolSize = memSize;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocMatchingTerm
   * Terminate matching library
   *
   * @returns 0 on success
   */
  @nativeFunction(0x7945ECDA, 150)
  sceNetAdhocMatchingTerm(): number
  {
    this.contexts = [];
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocMatchingCreate
   * Create matching context
   *
   * @returns Context ID or error
   */
  @nativeFunction(0xCA5EDA6F, 150)
  sceNetAdhocMatchingCreate(): number
  {
    const mode = this.ctx.arg(0) as MatchingMode;
    const maxPeers = this.ctx.arg(1);
    const port = this.ctx.arg(2);
    const bufSize = this.ctx.arg(3);
    const callback = this.ctx.arg(8);

    const context: MatchingContext = {
      id: this.nextContextId++,
      mode,
      maxPeers,
      port,
      bufSize,
      callback,
      started: false,
    };
    this.contexts.push(context);

    return context.id;
  }

  /**
   * sceNetAdhocMatchingDelete
   * Delete matching context
   *
   * @param matchingId - Context ID
   * @returns 0 on success
   */
  @nativeFunction(0xF16EAF4F, 150)
  sceNetAdhocMatchingDelete(): number
  {
    const matchingId = this.ctx.arg(0);

    const index = this.contexts.findIndex(c => c.id === matchingId);
    if (index >= 0)
    {
      this.contexts.splice(index, 1);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocMatchingStart
   * Start matching
   *
   * @returns 0 on success
   */
  @nativeFunction(0x93EF3843, 150)
  sceNetAdhocMatchingStart(): number
  {
    const matchingId = this.ctx.arg(0);

    const context = this.contexts.find(c => c.id === matchingId);
    if (context)
    {
      context.started = true;
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocMatchingStop
   * Stop matching
   *
   * @returns 0 on success
   */
  @nativeFunction(0x32B156B3, 150)
  sceNetAdhocMatchingStop(): number
  {
    const matchingId = this.ctx.arg(0);

    const context = this.contexts.find(c => c.id === matchingId);
    if (context)
    {
      context.started = false;
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocMatchingSelectTarget
   * Select matching target
   *
   * @returns 0 on success
   */
  @nativeFunction(0x5E3D4B79, 150)
  sceNetAdhocMatchingSelectTarget(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocMatchingCancelTarget
   * Cancel matching target
   *
   * @returns 0 on success
   */
  @nativeFunction(0xEA3C6108, 150)
  sceNetAdhocMatchingCancelTarget(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocMatchingCancelTargetWithOpt
   * Cancel matching target with option
   *
   * @returns 0 on success
   */
  @nativeFunction(0x8F58BEDF, 150)
  sceNetAdhocMatchingCancelTargetWithOpt(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocMatchingSendData
   * Send data to target
   *
   * @returns 0 on success
   */
  @nativeFunction(0xF79472D7, 150)
  sceNetAdhocMatchingSendData(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocMatchingAbortSendData
   * Abort sending data
   *
   * @returns 0 on success
   */
  @nativeFunction(0xEC19337D, 150)
  sceNetAdhocMatchingAbortSendData(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocMatchingSetHelloOpt
   * Set hello option
   *
   * @returns 0 on success
   */
  @nativeFunction(0xB58E61B7, 150)
  sceNetAdhocMatchingSetHelloOpt(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocMatchingGetHelloOpt
   * Get hello option
   *
   * @returns 0 on success
   */
  @nativeFunction(0xB5D96C2A, 150)
  sceNetAdhocMatchingGetHelloOpt(): number
  {
    const matchingId = this.ctx.arg(0);
    const lengthPtr = this.ctx.argPtr(1);

    if (lengthPtr)
    {
      this.ctx.write32(lengthPtr, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocMatchingGetMembers
   * Get member list
   *
   * @returns 0 on success
   */
  @nativeFunction(0xC58BCD9E, 150)
  sceNetAdhocMatchingGetMembers(): number
  {
    const matchingId = this.ctx.arg(0);
    const lengthPtr = this.ctx.argPtr(1);

    // No members
    if (lengthPtr)
    {
      this.ctx.write32(lengthPtr, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocMatchingGetPoolMaxAlloc
   * Get max pool allocation
   *
   * @returns Max size
   */
  @nativeFunction(0x40F8F435, 150)
  sceNetAdhocMatchingGetPoolMaxAlloc(): number
  {
    return this.poolSize;
  }

  /**
   * sceNetAdhocMatchingGetPoolStat
   * Get pool stats
   *
   * @returns 0 on success
   */
  @nativeFunction(0x9C5CFB7D, 150)
  sceNetAdhocMatchingGetPoolStat(): number
  {
    const statPtr = this.ctx.argPtr(0);

    if (statPtr)
    {
      this.ctx.write32(statPtr + 0, this.poolSize);  // size
      this.ctx.write32(statPtr + 4, this.poolSize);  // maxsize
      this.ctx.write32(statPtr + 8, this.poolSize);  // freesize
    }

    return SceKernelErrors.ERROR_OK;
  }
}
