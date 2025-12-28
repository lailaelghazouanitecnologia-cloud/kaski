/**
 * sceWlanDrv
 *
 * WLAN driver module.
 * Provides WLAN hardware access.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

@hleModule('sceWlanDrv')
export class sceWlanDrv
{
  readonly name = 'sceWlanDrv';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  /**
   * sceWlanGetSwitchState
   * Get WLAN switch state
   *
   * @returns 1 if WLAN is enabled, 0 if disabled
   */
  @nativeFunction(0xD7763699, 150)
  sceWlanGetSwitchState(): number
  {
    // WLAN switch is always on in emulator
    return 1;
  }

  /**
   * sceWlanGetEtherAddr
   * Get WLAN MAC address
   *
   * @param etherAddrPtr - Output buffer (6 bytes)
   * @returns 0 on success
   */
  @nativeFunction(0x0C622081, 150)
  sceWlanGetEtherAddr(): number
  {
    const etherAddrPtr = this.ctx.argPtr(0);

    // Return fake MAC address
    const mac = [0x00, 0x11, 0x22, 0x33, 0x44, 0x55];
    if (etherAddrPtr)
    {
      for (let i = 0; i < 6; i++)
      {
        this.ctx.write8(etherAddrPtr + i, mac[i]);
      }
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceWlanDevIsPowerOn
   * Check if WLAN is powered on
   *
   * @returns 1 if powered on
   */
  @nativeFunction(0x93440B11, 150)
  sceWlanDevIsPowerOn(): number
  {
    return 1;
  }

  /**
   * sceWlanDevAttach
   * Attach WLAN device
   *
   * @returns 0 on success
   */
  @nativeFunction(0x482CAE9A, 150)
  sceWlanDevAttach(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceWlanDevDetach
   * Detach WLAN device
   *
   * @returns 0 on success
   */
  @nativeFunction(0xC9A8CAB7, 150)
  sceWlanDevDetach(): number
  {
    return SceKernelErrors.ERROR_OK;
  }
}
