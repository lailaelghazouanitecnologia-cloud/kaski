/**
 * sceNet
 *
 * Network library module.
 * Provides basic network initialization and MAC address functions.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

@hleModule('sceNet')
export class sceNet
{
  readonly name = 'sceNet';

  private ctx!: EmulatorContext;

  // Random MAC address for this session
  private mac: Uint8Array = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
    // Generate random MAC address
    for (let i = 0; i < 6; i++)
    {
      this.mac[i] = Math.floor(Math.random() * 256);
    }
  }

  /**
   * sceNetInit
   * Initialize network library
   *
   * @param memoryPoolSize - Memory pool size
   * @param calloutPrio - Callout thread priority
   * @param calloutStack - Callout thread stack size
   * @param netintrPrio - Netintr thread priority
   * @param netintrStack - Netintr thread stack size
   * @returns 0 on success
   */
  @nativeFunction(0x39AF39A6, 150)
  sceNetInit(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetTerm
   * Terminate network library
   *
   * @returns 0 on success
   */
  @nativeFunction(0x281928A9, 150)
  sceNetTerm(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetFreeThreadinfo
   * Free thread info
   *
   * @param threadId - Thread ID
   * @returns 0 on success
   */
  @nativeFunction(0x50647530, 150)
  sceNetFreeThreadinfo(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetThreadAbort
   * Abort thread
   *
   * @param threadId - Thread ID
   * @returns 0 on success
   */
  @nativeFunction(0xAD6844C6, 150)
  sceNetThreadAbort(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetEtherStrton
   * Convert string to MAC address
   *
   * @param stringPtr - MAC string
   * @param macPtr - Output MAC address
   * @returns 0 on success
   */
  @nativeFunction(0xD27961C9, 150)
  sceNetEtherStrton(): number
  {
    const stringPtr = this.ctx.argPtr(0);
    const macPtr = this.ctx.argPtr(1);

    // Parse MAC string and write to output
    if (stringPtr && macPtr)
    {
      const str = this.ctx.readStringZ(stringPtr);
      const parts = str.split(':');
      for (let i = 0; i < 6 && i < parts.length; i++)
      {
        this.ctx.write8(macPtr + i, parseInt(parts[i], 16) || 0);
      }
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetEtherNtostr
   * Convert MAC address to string
   *
   * @param macPtr - MAC address
   * @param stringPtr - Output string
   * @returns 0 on success
   */
  @nativeFunction(0x89360950, 150)
  sceNetEtherNtostr(): number
  {
    const macPtr = this.ctx.argPtr(0);
    const stringPtr = this.ctx.argPtr(1);

    if (macPtr && stringPtr)
    {
      const parts: string[] = [];
      for (let i = 0; i < 6; i++)
      {
        parts.push(this.ctx.read8(macPtr + i).toString(16).padStart(2, '0'));
      }
      const str = parts.join(':');
      this.ctx.writeStringZ(stringPtr, str);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetGetLocalEtherAddr
   * Get local MAC address
   *
   * @param macOut - Output MAC address
   * @returns 0 on success
   */
  @nativeFunction(0x0BF0A3AE, 150)
  sceNetGetLocalEtherAddr(): number
  {
    const macOut = this.ctx.argPtr(0);

    if (macOut)
    {
      for (let i = 0; i < 6; i++)
      {
        this.ctx.write8(macOut + i, this.mac[i]);
      }
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetGetMallocStat
   * Get memory allocation stats
   *
   * @param statPtr - Output stats
   * @returns 0 on success
   */
  @nativeFunction(0xCC393E48, 150)
  sceNetGetMallocStat(): number
  {
    const statPtr = this.ctx.argPtr(0);

    if (statPtr)
    {
      // Write stub stats
      this.ctx.write32(statPtr + 0, 0x10000);  // pool size
      this.ctx.write32(statPtr + 4, 0x10000);  // max size
      this.ctx.write32(statPtr + 8, 0x10000);  // free size
    }

    return SceKernelErrors.ERROR_OK;
  }
}
