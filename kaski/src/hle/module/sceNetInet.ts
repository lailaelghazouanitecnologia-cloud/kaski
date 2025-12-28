/**
 * sceNetInet
 *
 * Internet socket module.
 * Provides BSD-like socket functions.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

@hleModule('sceNetInet')
export class sceNetInet
{
  readonly name = 'sceNetInet';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  /**
   * sceNetInetInit
   * Initialize inet library
   *
   * @returns 0 on success
   */
  @nativeFunction(0x17943399, 150)
  sceNetInetInit(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetInetTerm
   * Terminate inet library
   *
   * @returns 0 on success
   */
  @nativeFunction(0xA9ED66B9, 150)
  sceNetInetTerm(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetInetSocket
   * Create socket
   *
   * @returns Socket ID or error
   */
  @nativeFunction(0x8B7B220F, 150)
  sceNetInetSocket(): number
  {
    // Return error - no network
    return -1;
  }

  /**
   * sceNetInetClose
   * Close socket
   *
   * @returns 0 on success
   */
  @nativeFunction(0x8D7284EA, 150)
  sceNetInetClose(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetInetConnect
   * Connect socket
   *
   * @returns 0 on success
   */
  @nativeFunction(0x410B34AA, 150)
  sceNetInetConnect(): number
  {
    return -1; // Connection failed
  }

  /**
   * sceNetInetBind
   * Bind socket
   *
   * @returns 0 on success
   */
  @nativeFunction(0x1A33F9AE, 150)
  sceNetInetBind(): number
  {
    return -1;
  }

  /**
   * sceNetInetListen
   * Listen on socket
   *
   * @returns 0 on success
   */
  @nativeFunction(0xD10A1A7A, 150)
  sceNetInetListen(): number
  {
    return -1;
  }

  /**
   * sceNetInetAccept
   * Accept connection
   *
   * @returns Socket ID or error
   */
  @nativeFunction(0xDB094E1B, 150)
  sceNetInetAccept(): number
  {
    return -1;
  }

  /**
   * sceNetInetSend
   * Send data
   *
   * @returns Bytes sent or error
   */
  @nativeFunction(0x7AA671BC, 150)
  sceNetInetSend(): number
  {
    return -1;
  }

  /**
   * sceNetInetSendto
   * Send data to address
   *
   * @returns Bytes sent or error
   */
  @nativeFunction(0x05038FC7, 150)
  sceNetInetSendto(): number
  {
    return -1;
  }

  /**
   * sceNetInetRecv
   * Receive data
   *
   * @returns Bytes received or error
   */
  @nativeFunction(0xCDA85C99, 150)
  sceNetInetRecv(): number
  {
    return -1;
  }

  /**
   * sceNetInetRecvfrom
   * Receive data from address
   *
   * @returns Bytes received or error
   */
  @nativeFunction(0xC91142E4, 150)
  sceNetInetRecvfrom(): number
  {
    return -1;
  }

  /**
   * sceNetInetSelect
   * Select on sockets
   *
   * @returns Number ready or error
   */
  @nativeFunction(0x5BE8D595, 150)
  sceNetInetSelect(): number
  {
    return 0;
  }

  /**
   * sceNetInetPoll
   * Poll sockets
   *
   * @returns Number ready or error
   */
  @nativeFunction(0xFAABB1DD, 150)
  sceNetInetPoll(): number
  {
    return 0;
  }

  /**
   * sceNetInetSetsockopt
   * Set socket option
   *
   * @returns 0 on success
   */
  @nativeFunction(0x2FE71FE7, 150)
  sceNetInetSetsockopt(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetInetGetsockopt
   * Get socket option
   *
   * @returns 0 on success
   */
  @nativeFunction(0x4A114C7C, 150)
  sceNetInetGetsockopt(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetInetGetpeername
   * Get peer name
   *
   * @returns 0 on success
   */
  @nativeFunction(0xB3888AD4, 150)
  sceNetInetGetpeername(): number
  {
    return -1;
  }

  /**
   * sceNetInetGetsockname
   * Get socket name
   *
   * @returns 0 on success
   */
  @nativeFunction(0x162E6FD5, 150)
  sceNetInetGetsockname(): number
  {
    return -1;
  }

  /**
   * sceNetInetShutdown
   * Shutdown socket
   *
   * @returns 0 on success
   */
  @nativeFunction(0x4CFE4E56, 150)
  sceNetInetShutdown(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetInetGetErrno
   * Get last error
   *
   * @returns Error code
   */
  @nativeFunction(0xB75D5B0A, 150)
  sceNetInetGetErrno(): number
  {
    return 0;
  }

  /**
   * sceNetInetInetAddr
   * Convert IP string to address
   *
   * @returns Address or error
   */
  @nativeFunction(0xB80A8FF7, 150)
  sceNetInetInetAddr(): number
  {
    return 0;
  }

  /**
   * sceNetInetInetAton
   * Convert IP string to address
   *
   * @returns 1 on success
   */
  @nativeFunction(0xD0792666, 150)
  sceNetInetInetAton(): number
  {
    return 1;
  }

  /**
   * sceNetInetInetNtop
   * Convert address to string
   *
   * @returns String pointer
   */
  @nativeFunction(0xE30B8C19, 150)
  sceNetInetInetNtop(): number
  {
    return 0;
  }

  /**
   * sceNetInetInetPton
   * Convert string to address
   *
   * @returns 1 on success
   */
  @nativeFunction(0xE247B6D6, 150)
  sceNetInetInetPton(): number
  {
    return 1;
  }
}
