/**
 * sceNetAdhocctl
 *
 * Ad-hoc control module.
 * Manages ad-hoc network connections and state.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * Adhoc control state
 */
const enum AdhocctlState
{
  Disconnected = 0,
  Connected = 1,
  Scan = 2,
  Game = 3,
  Discover = 4,
  Wol = 5,
}

/**
 * Adhoc control event
 */
const enum AdhocctlEvent
{
  Error = 0,
  Connected = 1,
  Disconnected = 2,
  Scan = 3,
  Game = 4,
  Discover = 5,
  Wol = 6,
  WolInterrupted = 7,
}

/**
 * Handler callback info
 */
interface HandlerCallback
{
  id: number;
  callback: number;
  argument: number;
}

@hleModule('sceNetAdhocctl')
export class sceNetAdhocctl
{
  readonly name = 'sceNetAdhocctl';

  private ctx!: EmulatorContext;

  private currentState = AdhocctlState.Disconnected;
  private handlers: HandlerCallback[] = [];
  private nextHandlerId = 1;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
    this.currentState = AdhocctlState.Disconnected;
    this.handlers = [];
    this.nextHandlerId = 1;
  }

  /**
   * sceNetAdhocctlInit
   * Initialize adhoc control
   *
   * @param stackSize - Thread stack size
   * @param priority - Thread priority
   * @param productPtr - Product info
   * @returns 0 on success
   */
  @nativeFunction(0xE26F226E, 150)
  sceNetAdhocctlInit(): number
  {
    this.currentState = AdhocctlState.Disconnected;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocctlTerm
   * Terminate adhoc control
   *
   * @returns 0 on success
   */
  @nativeFunction(0x9D689E13, 150)
  sceNetAdhocctlTerm(): number
  {
    this.handlers = [];
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocctlConnect
   * Connect to adhoc network
   *
   * @param name - Group name
   * @returns 0 on success
   */
  @nativeFunction(0x0AD043ED, 150)
  sceNetAdhocctlConnect(): number
  {
    // Simulate immediate connection
    this.currentState = AdhocctlState.Connected;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocctlDisconnect
   * Disconnect from adhoc network
   *
   * @returns 0 on success
   */
  @nativeFunction(0x34401D65, 150)
  sceNetAdhocctlDisconnect(): number
  {
    this.currentState = AdhocctlState.Disconnected;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocctlGetState
   * Get current state
   *
   * @param stateOut - Output state
   * @returns 0 on success
   */
  @nativeFunction(0x75ECD386, 150)
  sceNetAdhocctlGetState(): number
  {
    const stateOut = this.ctx.argPtr(0);

    if (stateOut)
    {
      this.ctx.write32(stateOut, this.currentState);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocctlAddHandler
   * Add event handler
   *
   * @param callback - Callback function
   * @param parameter - Callback parameter
   * @returns Handler ID
   */
  @nativeFunction(0x20B317A0, 150)
  sceNetAdhocctlAddHandler(): number
  {
    const callback = this.ctx.arg(0);
    const parameter = this.ctx.arg(1);

    const handler: HandlerCallback = {
      id: this.nextHandlerId++,
      callback,
      argument: parameter,
    };
    this.handlers.push(handler);

    return handler.id;
  }

  /**
   * sceNetAdhocctlDelHandler
   * Delete event handler
   *
   * @param handlerId - Handler ID
   * @returns 0 on success
   */
  @nativeFunction(0x6402490B, 150)
  sceNetAdhocctlDelHandler(): number
  {
    const handlerId = this.ctx.arg(0);

    const index = this.handlers.findIndex(h => h.id === handlerId);
    if (index >= 0)
    {
      this.handlers.splice(index, 1);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocctlScan
   * Scan for adhoc networks
   *
   * @returns 0 on success
   */
  @nativeFunction(0x08FFF7A0, 150)
  sceNetAdhocctlScan(): number
  {
    this.currentState = AdhocctlState.Scan;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocctlGetScanInfo
   * Get scan results
   *
   * @returns 0 on success
   */
  @nativeFunction(0x81AEE1BE, 150)
  sceNetAdhocctlGetScanInfo(): number
  {
    const lengthPtr = this.ctx.argPtr(0);

    // No networks found
    if (lengthPtr)
    {
      this.ctx.write32(lengthPtr, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocctlCreate
   * Create adhoc network
   *
   * @returns 0 on success
   */
  @nativeFunction(0xE8455085, 150)
  sceNetAdhocctlCreate(): number
  {
    this.currentState = AdhocctlState.Connected;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocctlJoin
   * Join adhoc network
   *
   * @returns 0 on success
   */
  @nativeFunction(0x5E7F79C9, 150)
  sceNetAdhocctlJoin(): number
  {
    this.currentState = AdhocctlState.Connected;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocctlGetPeerList
   * Get peer list
   *
   * @returns 0 on success
   */
  @nativeFunction(0xE162CB14, 150)
  sceNetAdhocctlGetPeerList(): number
  {
    const lengthPtr = this.ctx.argPtr(0);

    // No peers
    if (lengthPtr)
    {
      this.ctx.write32(lengthPtr, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocctlGetPeerInfo
   * Get peer info
   *
   * @returns 0 on success
   */
  @nativeFunction(0x8DB83FDC, 150)
  sceNetAdhocctlGetPeerInfo(): number
  {
    return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_DEVICE;
  }

  /**
   * sceNetAdhocctlGetAdhocId
   * Get adhoc ID
   *
   * @returns 0 on success
   */
  @nativeFunction(0x362CBE8F, 150)
  sceNetAdhocctlGetAdhocId(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocctlGetNameByAddr
   * Get name by address
   *
   * @returns 0 on success
   */
  @nativeFunction(0x99560ABE, 150)
  sceNetAdhocctlGetNameByAddr(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocctlGetAddrByName
   * Get address by name
   *
   * @returns 0 on success
   */
  @nativeFunction(0x8916C003, 150)
  sceNetAdhocctlGetAddrByName(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocctlGetParameter
   * Get adhoc parameter
   *
   * @returns 0 on success
   */
  @nativeFunction(0xDED9D28E, 150)
  sceNetAdhocctlGetParameter(): number
  {
    const paramPtr = this.ctx.argPtr(0);

    if (paramPtr)
    {
      // Write stub parameter structure
      // channel (4), name (8), bssid (6), nickname (128)
      for (let i = 0; i < 146; i++)
      {
        this.ctx.write8(paramPtr + i, 0);
      }
      // Channel
      this.ctx.write32(paramPtr, 1);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocctlCreateEnterGameMode
   * Create and enter game mode
   *
   * @returns 0 on success
   */
  @nativeFunction(0xA5C055CE, 150)
  sceNetAdhocctlCreateEnterGameMode(): number
  {
    this.currentState = AdhocctlState.Game;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocctlJoinEnterGameMode
   * Join and enter game mode
   *
   * @returns 0 on success
   */
  @nativeFunction(0x1FF89745, 150)
  sceNetAdhocctlJoinEnterGameMode(): number
  {
    this.currentState = AdhocctlState.Game;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocctlExitGameMode
   * Exit game mode
   *
   * @returns 0 on success
   */
  @nativeFunction(0xCF8E084D, 150)
  sceNetAdhocctlExitGameMode(): number
  {
    this.currentState = AdhocctlState.Disconnected;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocctlGetGameModeInfo
   * Get game mode info
   *
   * @returns 0 on success
   */
  @nativeFunction(0x5A014CE0, 150)
  sceNetAdhocctlGetGameModeInfo(): number
  {
    const infoPtr = this.ctx.argPtr(0);

    if (infoPtr)
    {
      // num (4), macs (16*6=96)
      this.ctx.write32(infoPtr, 0); // 0 members
    }

    return SceKernelErrors.ERROR_OK;
  }
}
