/**
 * sceNpService
 *
 * PlayStation Network service module.
 * Provides PSN service functionality.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

@hleModule('sceNpService')
export class sceNpService
{
  readonly name = 'sceNpService';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  /**
   * sceNpServiceInit
   * Initialize NP service
   *
   * @returns 0 on success
   */
  @nativeFunction(0x0F8F5821, 150)
  sceNpServiceInit(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNpServiceTerm
   * Terminate NP service
   *
   * @returns 0 on success
   */
  @nativeFunction(0x00ACFAC3, 150)
  sceNpServiceTerm(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNpServiceGetMemoryStat
   * Get memory stats
   *
   * @returns 0 on success
   */
  @nativeFunction(0x5494274B, 150)
  sceNpServiceGetMemoryStat(): number
  {
    const statPtr = this.ctx.argPtr(0);

    if (statPtr)
    {
      this.ctx.write32(statPtr + 0, 0x10000);  // pool size
      this.ctx.write32(statPtr + 4, 0x10000);  // free size
    }

    return SceKernelErrors.ERROR_OK;
  }
}
