/**
 * sceNp
 *
 * PlayStation Network module.
 * Provides PSN functionality.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

@hleModule('sceNp')
export class sceNp
{
  readonly name = 'sceNp';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  /**
   * sceNpInit
   * Initialize NP library
   *
   * @returns 0 on success
   */
  @nativeFunction(0x857B47D3, 150)
  sceNpInit(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNpTerm
   * Terminate NP library
   *
   * @returns 0 on success
   */
  @nativeFunction(0x633B5F71, 150)
  sceNpTerm(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNpGetContentRatingFlag
   * Get content rating flag
   *
   * @returns 0 on success
   */
  @nativeFunction(0xAD218B5A, 150)
  sceNpGetContentRatingFlag(): number
  {
    const flagPtr = this.ctx.argPtr(0);
    const agePtr = this.ctx.argPtr(1);

    if (flagPtr)
    {
      this.ctx.write32(flagPtr, 0); // No restrictions
    }
    if (agePtr)
    {
      this.ctx.write32(agePtr, 18); // Adult
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNpGetChatRestrictionFlag
   * Get chat restriction flag
   *
   * @returns 0 on success
   */
  @nativeFunction(0x2E6F5F3E, 150)
  sceNpGetChatRestrictionFlag(): number
  {
    const flagPtr = this.ctx.argPtr(0);

    if (flagPtr)
    {
      this.ctx.write32(flagPtr, 0); // No restrictions
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNpGetOnlineId
   * Get online ID
   *
   * @returns 0 on success
   */
  @nativeFunction(0x4EC1DFB5, 150)
  sceNpGetOnlineId(): number
  {
    const onlineIdPtr = this.ctx.argPtr(0);

    if (onlineIdPtr)
    {
      // Online ID structure: 16 bytes for name + padding
      this.ctx.writeStringZ(onlineIdPtr, 'PSP_User');
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNpGetNpId
   * Get NP ID
   *
   * @returns 0 on success
   */
  @nativeFunction(0xA0BE3C4B, 150)
  sceNpGetNpId(): number
  {
    const npIdPtr = this.ctx.argPtr(0);

    if (npIdPtr)
    {
      // NP ID structure: zero it out
      for (let i = 0; i < 36; i++)
      {
        this.ctx.write8(npIdPtr + i, 0);
      }
      // Write online ID
      this.ctx.writeStringZ(npIdPtr, 'PSP_User');
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNpGetUserProfile
   * Get user profile
   *
   * @returns 0 on success
   */
  @nativeFunction(0xEB567512, 150)
  sceNpGetUserProfile(): number
  {
    return SceKernelErrors.ERROR_OK;
  }
}
