/**
 * sceOpenPSID
 *
 * PSP ID access module.
 * Provides access to the unique PSP ID.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * Fake PSP ID (16 bytes)
 */
const FAKE_PSID = new Uint8Array([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
  0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F,
]);

@hleModule('sceOpenPSID')
export class sceOpenPSID
{
  readonly name = 'sceOpenPSID';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  /**
   * sceOpenPSIDGetOpenPSID
   * Get the OpenPSID
   *
   * @param openPSIDPtr - Output buffer (16 bytes)
   * @returns 0 on success
   */
  @nativeFunction(0xC69BEBCE, 150)
  sceOpenPSIDGetOpenPSID(): number
  {
    const openPSIDPtr = this.ctx.argPtr(0);

    if (openPSIDPtr)
    {
      for (let i = 0; i < 16; i++)
      {
        this.ctx.write8(openPSIDPtr + i, FAKE_PSID[i]);
      }
    }

    return SceKernelErrors.ERROR_OK;
  }
}
