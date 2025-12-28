/**
 * sceNetAdhoc
 *
 * Ad-hoc networking module.
 * Provides peer-to-peer networking for local multiplayer.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * PDP (Peer Data Protocol) socket
 */
interface PdpSocket
{
  id: number;
  inUse: boolean;
  port: number;
  bufSize: number;
}

/**
 * PTP (Peer to Peer) socket
 */
interface PtpSocket
{
  id: number;
  inUse: boolean;
  srcPort: number;
  destPort: number;
  bufSize: number;
}

const MAX_PDP_SOCKETS = 8;
const MAX_PTP_SOCKETS = 8;

@hleModule('sceNetAdhoc')
export class sceNetAdhoc
{
  readonly name = 'sceNetAdhoc';

  private ctx!: EmulatorContext;

  private pdpSockets: PdpSocket[] = [];
  private ptpSockets: PtpSocket[] = [];
  private nextPdpId = 1;
  private nextPtpId = 1;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
    this.pdpSockets = [];
    this.ptpSockets = [];
    this.nextPdpId = 1;
    this.nextPtpId = 1;
  }

  /**
   * sceNetAdhocInit
   * Initialize adhoc library
   *
   * @returns 0 on success
   */
  @nativeFunction(0xE1D621D7, 150)
  sceNetAdhocInit(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocTerm
   * Terminate adhoc library
   *
   * @returns 0 on success
   */
  @nativeFunction(0xA62C6F57, 150)
  sceNetAdhocTerm(): number
  {
    this.pdpSockets = [];
    this.ptpSockets = [];
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocPdpCreate
   * Create PDP socket
   *
   * @param mac - MAC address
   * @param port - Port number
   * @param bufsize - Buffer size
   * @param unk1 - Unknown
   * @returns Socket ID or error
   */
  @nativeFunction(0x6F92741B, 150)
  sceNetAdhocPdpCreate(): number
  {
    const macPtr = this.ctx.argPtr(0);
    const port = this.ctx.arg(1);
    const bufsize = this.ctx.arg(2);

    const socket: PdpSocket = {
      id: this.nextPdpId++,
      inUse: true,
      port,
      bufSize: bufsize,
    };
    this.pdpSockets.push(socket);

    return socket.id;
  }

  /**
   * sceNetAdhocPdpDelete
   * Delete PDP socket
   *
   * @param pdpId - Socket ID
   * @param unk1 - Unknown
   * @returns 0 on success
   */
  @nativeFunction(0x7F27BB5E, 150)
  sceNetAdhocPdpDelete(): number
  {
    const pdpId = this.ctx.arg(0);

    const index = this.pdpSockets.findIndex(s => s.id === pdpId);
    if (index >= 0)
    {
      this.pdpSockets.splice(index, 1);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocPdpSend
   * Send PDP packet
   *
   * @returns 0 on success
   */
  @nativeFunction(0xABED3790, 150)
  sceNetAdhocPdpSend(): number
  {
    // Stub - no actual network
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocPdpRecv
   * Receive PDP packet
   *
   * @returns Bytes received or error
   */
  @nativeFunction(0xDFE53E03, 150)
  sceNetAdhocPdpRecv(): number
  {
    // Return no data available
    return 0x80410709; // ERROR_NET_ADHOC_NO_DATA_AVAILABLE
  }

  /**
   * sceNetAdhocGetPdpStat
   * Get PDP socket status
   *
   * @returns 0 on success
   */
  @nativeFunction(0xC7C1FC57, 150)
  sceNetAdhocGetPdpStat(): number
  {
    const sizePtr = this.ctx.argPtr(0);
    const statPtr = this.ctx.argPtr(1);

    if (sizePtr)
    {
      // Each PDP stat is 20 bytes
      this.ctx.write32(sizePtr, this.pdpSockets.length * 20);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocPollSocket
   * Poll sockets
   *
   * @returns Number ready or error
   */
  @nativeFunction(0x7A662D6B, 150)
  sceNetAdhocPollSocket(): number
  {
    return 0;
  }

  // Game mode functions

  /**
   * sceNetAdhocGameModeCreateMaster
   * Create master game mode
   *
   * @returns 0 on success
   */
  @nativeFunction(0x7F75C338, 150)
  sceNetAdhocGameModeCreateMaster(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocGameModeCreateReplica
   * Create replica game mode
   *
   * @returns 0 on success
   */
  @nativeFunction(0x3278AB0C, 150)
  sceNetAdhocGameModeCreateReplica(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocGameModeUpdateMaster
   * Update master game mode
   *
   * @returns 0 on success
   */
  @nativeFunction(0x98C204C8, 150)
  sceNetAdhocGameModeUpdateMaster(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocGameModeUpdateReplica
   * Update replica game mode
   *
   * @returns 0 on success
   */
  @nativeFunction(0xFA324B4E, 150)
  sceNetAdhocGameModeUpdateReplica(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocGameModeDeleteMaster
   * Delete master game mode
   *
   * @returns 0 on success
   */
  @nativeFunction(0xA0229362, 150)
  sceNetAdhocGameModeDeleteMaster(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocGameModeDeleteReplica
   * Delete replica game mode
   *
   * @returns 0 on success
   */
  @nativeFunction(0x0B2228E9, 150)
  sceNetAdhocGameModeDeleteReplica(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  // PTP functions

  /**
   * sceNetAdhocPtpOpen
   * Open PTP connection
   *
   * @returns Socket ID or error
   */
  @nativeFunction(0x877F6D66, 150)
  sceNetAdhocPtpOpen(): number
  {
    const socket: PtpSocket = {
      id: this.nextPtpId++,
      inUse: true,
      srcPort: this.ctx.arg(1),
      destPort: this.ctx.arg(3),
      bufSize: this.ctx.arg(4),
    };
    this.ptpSockets.push(socket);

    return socket.id;
  }

  /**
   * sceNetAdhocPtpListen
   * Listen for PTP connection
   *
   * @returns Socket ID or error
   */
  @nativeFunction(0xE08BDAC1, 150)
  sceNetAdhocPtpListen(): number
  {
    const socket: PtpSocket = {
      id: this.nextPtpId++,
      inUse: true,
      srcPort: this.ctx.arg(1),
      destPort: 0,
      bufSize: this.ctx.arg(2),
    };
    this.ptpSockets.push(socket);

    return socket.id;
  }

  /**
   * sceNetAdhocPtpConnect
   * Connect PTP socket
   *
   * @returns 0 on success or error
   */
  @nativeFunction(0xFC6FC07B, 150)
  sceNetAdhocPtpConnect(): number
  {
    // Connection timeout
    return 0x80410709;
  }

  /**
   * sceNetAdhocPtpAccept
   * Accept PTP connection
   *
   * @returns Socket ID or error
   */
  @nativeFunction(0x9DF81198, 150)
  sceNetAdhocPtpAccept(): number
  {
    // No incoming connection
    return 0x80410709;
  }

  /**
   * sceNetAdhocPtpSend
   * Send PTP data
   *
   * @returns Bytes sent or error
   */
  @nativeFunction(0x4DA4C788, 150)
  sceNetAdhocPtpSend(): number
  {
    return 0;
  }

  /**
   * sceNetAdhocPtpRecv
   * Receive PTP data
   *
   * @returns Bytes received or error
   */
  @nativeFunction(0x8BEA2B3E, 150)
  sceNetAdhocPtpRecv(): number
  {
    return 0;
  }

  /**
   * sceNetAdhocPtpFlush
   * Flush PTP data
   *
   * @returns 0 on success
   */
  @nativeFunction(0x9AC2EEAC, 150)
  sceNetAdhocPtpFlush(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocPtpClose
   * Close PTP socket
   *
   * @returns 0 on success
   */
  @nativeFunction(0x157E6225, 150)
  sceNetAdhocPtpClose(): number
  {
    const ptpId = this.ctx.arg(0);

    const index = this.ptpSockets.findIndex(s => s.id === ptpId);
    if (index >= 0)
    {
      this.ptpSockets.splice(index, 1);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetAdhocGetPtpStat
   * Get PTP socket status
   *
   * @returns 0 on success
   */
  @nativeFunction(0xB9685118, 150)
  sceNetAdhocGetPtpStat(): number
  {
    const sizePtr = this.ctx.argPtr(0);

    if (sizePtr)
    {
      this.ctx.write32(sizePtr, this.ptpSockets.length * 28);
    }

    return SceKernelErrors.ERROR_OK;
  }
}
