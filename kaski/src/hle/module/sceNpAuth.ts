/**
 * sceNpAuth
 *
 * PlayStation Network authentication module.
 * Provides PSN sign-in functionality.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

@hleModule('sceNpAuth')
export class sceNpAuth
{
  readonly name = 'sceNpAuth';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  /**
   * sceNpAuthInit
   * Initialize NP auth library
   *
   * @returns 0 on success
   */
  @nativeFunction(0x4EC1DFB6, 150)
  sceNpAuthInit(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNpAuthTerm
   * Terminate NP auth library
   *
   * @returns 0 on success
   */
  @nativeFunction(0xCD86A656, 150)
  sceNpAuthTerm(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNpAuthCreateStartRequest
   * Create and start auth request
   *
   * @returns Request ID or error
   */
  @nativeFunction(0xF4531ADC, 150)
  sceNpAuthCreateStartRequest(): number
  {
    // Return not available
    return 0x80550002; // SCE_NP_AUTH_ERROR_SERVICE_DOWN
  }

  /**
   * sceNpAuthDestroyRequest
   * Destroy auth request
   *
   * @returns 0 on success
   */
  @nativeFunction(0x3F1C1F70, 150)
  sceNpAuthDestroyRequest(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNpAuthAbortRequest
   * Abort auth request
   *
   * @returns 0 on success
   */
  @nativeFunction(0x6900F084, 150)
  sceNpAuthAbortRequest(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNpAuthGetTicket
   * Get auth ticket
   *
   * @returns 0 on success
   */
  @nativeFunction(0xD99455DD, 150)
  sceNpAuthGetTicket(): number
  {
    return 0x80550002; // Not available
  }

  /**
   * sceNpAuthGetTicketParam
   * Get ticket parameter
   *
   * @returns 0 on success
   */
  @nativeFunction(0x75FB0AE3, 150)
  sceNpAuthGetTicketParam(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNpAuthGetEntitlementIdList
   * Get entitlement ID list
   *
   * @returns 0 on success
   */
  @nativeFunction(0x6B50D407, 150)
  sceNpAuthGetEntitlementIdList(): number
  {
    const countPtr = this.ctx.argPtr(1);

    if (countPtr)
    {
      this.ctx.write32(countPtr, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNpAuthGetEntitlementById
   * Get entitlement by ID
   *
   * @returns 0 on success
   */
  @nativeFunction(0xD8BC70C8, 150)
  sceNpAuthGetEntitlementById(): number
  {
    return 0x80550201; // Not found
  }
}
