/**
 * sceNetApctl
 *
 * Access point control module.
 * Manages WiFi access point connections.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * Apctl state
 */
const enum ApctlState
{
  Disconnected = 0,
  Scanning = 1,
  Joining = 2,
  GettingIP = 3,
  GotIP = 4,
}

/**
 * Apctl event
 */
const enum ApctlEvent
{
  ConnectRequest = 0,
  ScanRequest = 1,
  ScanComplete = 2,
  Established = 3,
  GetIP = 4,
  DisconnectRequest = 5,
  Error = 6,
  Info = 7,
  EAP_Auth = 8,
  KeyExchange = 9,
  Reconnect = 10,
}

/**
 * Apctl info types
 */
const enum ApctlInfo
{
  ProfileName = 0,
  BSSID = 1,
  SSID = 2,
  SSIDLength = 3,
  SecurityType = 4,
  Strength = 5,
  Channel = 6,
  PowerSave = 7,
  IP = 8,
  SubnetMask = 9,
  Gateway = 10,
  PrimaryDNS = 11,
  SecondaryDNS = 12,
  UseProxy = 13,
  ProxyURL = 14,
  ProxyPort = 15,
  EAPType = 16,
  StartBrowser = 17,
  WifiSP = 18,
}

/**
 * Handler callback info
 */
interface ApctlHandler
{
  id: number;
  callback: number;
  argument: number;
}

@hleModule('sceNetApctl')
export class sceNetApctl
{
  readonly name = 'sceNetApctl';

  private ctx!: EmulatorContext;

  private currentState = ApctlState.Disconnected;
  private handlers: ApctlHandler[] = [];
  private nextHandlerId = 1;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
    this.currentState = ApctlState.Disconnected;
    this.handlers = [];
    this.nextHandlerId = 1;
  }

  /**
   * sceNetApctlInit
   * Initialize apctl
   *
   * @param stackSize - Thread stack size
   * @param priority - Thread priority
   * @returns 0 on success
   */
  @nativeFunction(0xE2F91F9B, 150)
  sceNetApctlInit(): number
  {
    this.currentState = ApctlState.Disconnected;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetApctlTerm
   * Terminate apctl
   *
   * @returns 0 on success
   */
  @nativeFunction(0xB3EDD0EC, 150)
  sceNetApctlTerm(): number
  {
    this.handlers = [];
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetApctlConnect
   * Connect to access point
   *
   * @param configId - Configuration ID
   * @returns 0 on success
   */
  @nativeFunction(0xCFB957C6, 150)
  sceNetApctlConnect(): number
  {
    // Simulate connection (would fail in reality)
    this.currentState = ApctlState.GotIP;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetApctlDisconnect
   * Disconnect from access point
   *
   * @returns 0 on success
   */
  @nativeFunction(0x24FE91A1, 150)
  sceNetApctlDisconnect(): number
  {
    this.currentState = ApctlState.Disconnected;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetApctlGetState
   * Get connection state
   *
   * @param statePtr - Output state
   * @returns 0 on success
   */
  @nativeFunction(0x5DEAC81B, 150)
  sceNetApctlGetState(): number
  {
    const statePtr = this.ctx.argPtr(0);

    if (statePtr)
    {
      this.ctx.write32(statePtr, this.currentState);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetApctlAddHandler
   * Add event handler
   *
   * @param callback - Callback function
   * @param argument - Callback argument
   * @returns Handler ID
   */
  @nativeFunction(0x8ABADD51, 150)
  sceNetApctlAddHandler(): number
  {
    const callback = this.ctx.arg(0);
    const argument = this.ctx.arg(1);

    const handler: ApctlHandler = {
      id: this.nextHandlerId++,
      callback,
      argument,
    };
    this.handlers.push(handler);

    return handler.id;
  }

  /**
   * sceNetApctlDelHandler
   * Delete event handler
   *
   * @param handlerId - Handler ID
   * @returns 0 on success
   */
  @nativeFunction(0x5963991B, 150)
  sceNetApctlDelHandler(): number
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
   * sceNetApctlGetInfo
   * Get connection info
   *
   * @param infoType - Info type
   * @param infoPtr - Output info
   * @returns 0 on success
   */
  @nativeFunction(0x2BEFDF23, 150)
  sceNetApctlGetInfo(): number
  {
    const infoType = this.ctx.arg(0) as ApctlInfo;
    const infoPtr = this.ctx.argPtr(1);

    if (!infoPtr)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }

    switch (infoType)
    {
      case ApctlInfo.IP:
      case ApctlInfo.SubnetMask:
      case ApctlInfo.Gateway:
      case ApctlInfo.PrimaryDNS:
      case ApctlInfo.SecondaryDNS:
        // Write stub IP: 192.168.1.1
        this.ctx.writeStringZ(infoPtr, '192.168.1.1');
        break;

      case ApctlInfo.SSID:
      case ApctlInfo.ProfileName:
        this.ctx.writeStringZ(infoPtr, 'PSP_Emulator');
        break;

      case ApctlInfo.SSIDLength:
        this.ctx.write32(infoPtr, 12);
        break;

      case ApctlInfo.Strength:
        this.ctx.write32(infoPtr, 100);
        break;

      case ApctlInfo.Channel:
        this.ctx.write32(infoPtr, 1);
        break;

      case ApctlInfo.UseProxy:
        this.ctx.write32(infoPtr, 0);
        break;

      default:
        // Zero out unknown info
        this.ctx.write32(infoPtr, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetApctlScan
   * Scan for access points
   *
   * @returns 0 on success
   */
  @nativeFunction(0xF25A5006, 150)
  sceNetApctlScan(): number
  {
    this.currentState = ApctlState.Scanning;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetApctlGetBSSDescIDList
   * Get BSS descriptor ID list
   *
   * @returns 0 on success
   */
  @nativeFunction(0x2935C45B, 150)
  sceNetApctlGetBSSDescIDList(): number
  {
    const entryCountPtr = this.ctx.argPtr(0);

    // No entries
    if (entryCountPtr)
    {
      this.ctx.write32(entryCountPtr, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetApctlGetBSSDescEntry
   * Get BSS descriptor entry
   *
   * @returns 0 on success
   */
  @nativeFunction(0x04776994, 150)
  sceNetApctlGetBSSDescEntry(): number
  {
    return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_DEVICE;
  }

  /**
   * sceNetApctlGetBSSDescEntry2
   * Get BSS descriptor entry (extended)
   *
   * @returns 0 on success
   */
  @nativeFunction(0x6BDDCB8C, 150)
  sceNetApctlGetBSSDescEntry2(): number
  {
    return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_DEVICE;
  }
}
