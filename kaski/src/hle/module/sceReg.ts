/**
 * sceReg
 *
 * Registry access module.
 * Provides access to system configuration registry.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * Registry key types
 */
export const enum RegKeyType
{
  Directory = 1,
  Integer = 2,
  String = 3,
  Binary = 4,
}

/**
 * Fake handle IDs
 */
let nextRegHandle = 1;
let nextCategoryHandle = 100;
let nextKeyHandle = 1000;

@hleModule('sceReg')
export class sceReg
{
  readonly name = 'sceReg';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  /**
   * sceRegOpenRegistry
   * Open a registry
   *
   * @param regParamPtr - Registry parameters
   * @param mode - Open mode
   * @param regHandlePtr - Output handle
   * @returns 0 on success
   */
  @nativeFunction(0x92E41280, 150)
  sceRegOpenRegistry(): number
  {
    const regParamPtr = this.ctx.argPtr(0);
    const mode = this.ctx.arg(1);
    const regHandlePtr = this.ctx.argPtr(2);

    // Read registry name from param structure
    const regType = this.ctx.read32(regParamPtr);
    const namePtr = regParamPtr + 4;
    const name = this.ctx.readString(namePtr, 256);

    this.ctx.log(`sceRegOpenRegistry("${name}", mode=${mode})`);

    if (regHandlePtr)
    {
      this.ctx.write32(regHandlePtr, nextRegHandle++);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceRegCloseRegistry
   * Close a registry
   *
   * @param regHandle - Registry handle
   * @returns 0 on success
   */
  @nativeFunction(0xFA8A5739, 150)
  sceRegCloseRegistry(): number
  {
    const regHandle = this.ctx.arg(0);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceRegFlushRegistry
   * Flush registry changes to storage
   *
   * @param regHandle - Registry handle
   * @returns 0 on success
   */
  @nativeFunction(0x39461B4D, 150)
  sceRegFlushRegistry(): number
  {
    const regHandle = this.ctx.arg(0);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceRegOpenCategory
   * Open a registry category
   *
   * @param regHandle - Registry handle
   * @param namePtr - Category name
   * @param mode - Open mode
   * @param categoryHandlePtr - Output handle
   * @returns 0 on success
   */
  @nativeFunction(0x1D8A762E, 150)
  sceRegOpenCategory(): number
  {
    const regHandle = this.ctx.arg(0);
    const namePtr = this.ctx.argPtr(1);
    const mode = this.ctx.arg(2);
    const categoryHandlePtr = this.ctx.argPtr(3);

    const name = this.ctx.readString(namePtr);
    this.ctx.log(`sceRegOpenCategory("${name}")`);

    if (categoryHandlePtr)
    {
      this.ctx.write32(categoryHandlePtr, nextCategoryHandle++);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceRegCloseCategory
   * Close a registry category
   *
   * @param categoryHandle - Category handle
   * @returns 0 on success
   */
  @nativeFunction(0x0CAE832B, 150)
  sceRegCloseCategory(): number
  {
    const categoryHandle = this.ctx.arg(0);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceRegFlushCategory
   * Flush category changes
   *
   * @param categoryHandle - Category handle
   * @returns 0 on success
   */
  @nativeFunction(0x0D69BF40, 150)
  sceRegFlushCategory(): number
  {
    const categoryHandle = this.ctx.arg(0);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceRegGetKeyInfo
   * Get key info
   *
   * @param categoryHandle - Category handle
   * @param namePtr - Key name
   * @param keyHandlePtr - Output key handle
   * @param keyTypePtr - Output key type
   * @param sizePtr - Output size
   * @returns 0 on success
   */
  @nativeFunction(0xD4475AA8, 150)
  sceRegGetKeyInfo(): number
  {
    const categoryHandle = this.ctx.arg(0);
    const namePtr = this.ctx.argPtr(1);
    const keyHandlePtr = this.ctx.argPtr(2);
    const keyTypePtr = this.ctx.argPtr(3);
    const sizePtr = this.ctx.argPtr(4);

    const name = this.ctx.readString(namePtr);
    this.ctx.log(`sceRegGetKeyInfo("${name}")`);

    if (keyHandlePtr)
    {
      this.ctx.write32(keyHandlePtr, nextKeyHandle++);
    }
    if (keyTypePtr)
    {
      this.ctx.write32(keyTypePtr, RegKeyType.Integer);
    }
    if (sizePtr)
    {
      this.ctx.write32(sizePtr, 4);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceRegGetKeyValue
   * Get key value
   *
   * @param categoryHandle - Category handle
   * @param keyHandle - Key handle
   * @param bufferPtr - Output buffer
   * @param size - Buffer size
   * @returns 0 on success
   */
  @nativeFunction(0x28A8E98A, 150)
  sceRegGetKeyValue(): number
  {
    const categoryHandle = this.ctx.arg(0);
    const keyHandle = this.ctx.arg(1);
    const bufferPtr = this.ctx.argPtr(2);
    const size = this.ctx.arg(3);

    // Return 0 as default value
    if (bufferPtr && size >= 4)
    {
      this.ctx.write32(bufferPtr, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceRegGetKeyInfoByName
   * Get key info by name
   */
  @nativeFunction(0x4CA16893, 150)
  sceRegGetKeyInfoByName(): number
  {
    const categoryHandle = this.ctx.arg(0);
    const namePtr = this.ctx.argPtr(1);
    const keyTypePtr = this.ctx.argPtr(2);
    const sizePtr = this.ctx.argPtr(3);

    if (keyTypePtr)
    {
      this.ctx.write32(keyTypePtr, RegKeyType.Integer);
    }
    if (sizePtr)
    {
      this.ctx.write32(sizePtr, 4);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceRegGetKeyValueByName
   * Get key value by name
   */
  @nativeFunction(0x30BE0259, 150)
  sceRegGetKeyValueByName(): number
  {
    const categoryHandle = this.ctx.arg(0);
    const namePtr = this.ctx.argPtr(1);
    const bufferPtr = this.ctx.argPtr(2);
    const size = this.ctx.arg(3);

    if (bufferPtr && size >= 4)
    {
      this.ctx.write32(bufferPtr, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }
}
