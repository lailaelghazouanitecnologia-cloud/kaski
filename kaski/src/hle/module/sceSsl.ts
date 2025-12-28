/**
 * sceSsl
 *
 * SSL library module.
 * Provides SSL/TLS functionality.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

@hleModule('sceSsl')
export class sceSsl
{
  readonly name = 'sceSsl';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  /**
   * sceSslInit
   * Initialize SSL library
   *
   * @param memSize - Memory pool size
   * @returns 0 on success
   */
  @nativeFunction(0x957ECBE2, 150)
  sceSslInit(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceSslEnd
   * Terminate SSL library
   *
   * @returns 0 on success
   */
  @nativeFunction(0x191CDEFF, 150)
  sceSslEnd(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceSslGetUsedMemoryMax
   * Get maximum used memory
   *
   * @param sizePtr - Output size
   * @returns 0 on success
   */
  @nativeFunction(0x5BFB6B61, 150)
  sceSslGetUsedMemoryMax(): number
  {
    const sizePtr = this.ctx.argPtr(0);

    if (sizePtr)
    {
      this.ctx.write32(sizePtr, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceSslGetUsedMemoryCurrent
   * Get current used memory
   *
   * @param sizePtr - Output size
   * @returns 0 on success
   */
  @nativeFunction(0xD6D097B4, 150)
  sceSslGetUsedMemoryCurrent(): number
  {
    const sizePtr = this.ctx.argPtr(0);

    if (sizePtr)
    {
      this.ctx.write32(sizePtr, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceSslGetKeyUsage
   * Get key usage
   *
   * @returns 0 on success
   */
  @nativeFunction(0x17A10DCC, 150)
  sceSslGetKeyUsage(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceSslGetNameEntryCount
   * Get name entry count
   *
   * @returns Count
   */
  @nativeFunction(0x3DD5E023, 150)
  sceSslGetNameEntryCount(): number
  {
    return 0;
  }

  /**
   * sceSslGetNameEntryInfo
   * Get name entry info
   *
   * @returns 0 on success
   */
  @nativeFunction(0x5A5CE86D, 150)
  sceSslGetNameEntryInfo(): number
  {
    return SceKernelErrors.ERROR_OK;
  }
}
