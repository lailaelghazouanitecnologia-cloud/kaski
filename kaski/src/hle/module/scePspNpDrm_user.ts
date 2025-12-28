/**
 * scePspNpDrm_user
 *
 * PlayStation Network DRM module.
 * Provides DRM functionality for PSN content.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

@hleModule('scePspNpDrm_user')
export class scePspNpDrm_user
{
  readonly name = 'scePspNpDrm_user';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  /**
   * sceNpDrmSetLicenseeKey
   * Set licensee key
   *
   * @param keyPtr - Key data
   * @returns 0 on success
   */
  @nativeFunction(0xA1336091, 150)
  sceNpDrmSetLicenseeKey(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNpDrmClearLicenseeKey
   * Clear licensee key
   *
   * @returns 0 on success
   */
  @nativeFunction(0x9B745542, 150)
  sceNpDrmClearLicenseeKey(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNpDrmRenameCheck
   * Check for rename
   *
   * @param filePtr - File path
   * @returns 0 on success
   */
  @nativeFunction(0x275987D1, 150)
  sceNpDrmRenameCheck(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNpDrmEdataSetupKey
   * Setup EDATA key
   *
   * @param fd - File descriptor
   * @returns 0 on success
   */
  @nativeFunction(0x08D98894, 150)
  sceNpDrmEdataSetupKey(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNpDrmEdataGetDataSize
   * Get EDATA data size
   *
   * @param fd - File descriptor
   * @returns Data size
   */
  @nativeFunction(0x219EF5CC, 150)
  sceNpDrmEdataGetDataSize(): number
  {
    // Return 0 - no data
    return 0;
  }

  /**
   * sceNpDrmOpen
   * Open DRM file
   *
   * @returns File descriptor or error
   */
  @nativeFunction(0x2BAA4294, 150)
  sceNpDrmOpen(): number
  {
    // Not supported
    return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_DEVICE;
  }

  /**
   * sceNpDrmGetVersionKey
   * Get version key
   *
   * @returns 0 on success
   */
  @nativeFunction(0xF2FA9E60, 150)
  sceNpDrmGetVersionKey(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNpDrmActivation
   * Activate DRM
   *
   * @returns 0 on success
   */
  @nativeFunction(0xFD0D2CB4, 150)
  sceNpDrmActivation(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNpDrmVerifyAct
   * Verify activation
   *
   * @returns 0 on success
   */
  @nativeFunction(0xC61A3BD9, 150)
  sceNpDrmVerifyAct(): number
  {
    return SceKernelErrors.ERROR_OK;
  }
}
