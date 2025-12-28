/**
 * sceHprm
 *
 * Headphone Remote Control module.
 * Handles the PSP remote control buttons on headphones.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * HPRM key flags
 */
export const enum PspHprmKeys
{
  None = 0,
  PlayPause = 0x01,
  Forward = 0x04,
  Back = 0x08,
  VolUp = 0x10,
  VolDown = 0x20,
  Hold = 0x80,
}

@hleModule('sceHprm')
export class sceHprm
{
  readonly name = 'sceHprm';

  private ctx!: EmulatorContext;

  // Current key state (no remote in emulator)
  private currentKeys: number = PspHprmKeys.None;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
    this.currentKeys = PspHprmKeys.None;
  }

  /**
   * sceHprmPeekCurrentKey
   * Get current HPRM key state
   *
   * @param keyPtr - Output key flags
   * @returns 0 on success
   */
  @nativeFunction(0x1910B327, 150)
  sceHprmPeekCurrentKey(): number
  {
    const keyPtr = this.ctx.argPtr(0);

    if (keyPtr)
    {
      this.ctx.write32(keyPtr, this.currentKeys);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHprmPeekLatch
   * Get latched HPRM key state
   *
   * @param latchPtr - Output latch data
   * @returns 0 on success
   */
  @nativeFunction(0x2BCEC83E, 150)
  sceHprmPeekLatch(): number
  {
    const latchPtr = this.ctx.argPtr(0);

    // Latch structure: make, break, press, release (4 words)
    if (latchPtr)
    {
      this.ctx.write32(latchPtr + 0, 0);  // make
      this.ctx.write32(latchPtr + 4, 0);  // break
      this.ctx.write32(latchPtr + 8, 0);  // press
      this.ctx.write32(latchPtr + 12, 0); // release
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHprmReadLatch
   * Read and clear latched HPRM key state
   *
   * @param latchPtr - Output latch data
   * @returns 0 on success
   */
  @nativeFunction(0x40D2F9F0, 150)
  sceHprmReadLatch(): number
  {
    const latchPtr = this.ctx.argPtr(0);

    // Same as peek, but would clear the latch
    if (latchPtr)
    {
      this.ctx.write32(latchPtr + 0, 0);
      this.ctx.write32(latchPtr + 4, 0);
      this.ctx.write32(latchPtr + 8, 0);
      this.ctx.write32(latchPtr + 12, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHprmIsHeadphoneExist
   * Check if headphones are connected
   *
   * @returns 0 = no, 1 = yes
   */
  @nativeFunction(0x7E69EDA4, 150)
  sceHprmIsHeadphoneExist(): number
  {
    // No headphones in emulator
    return 0;
  }

  /**
   * sceHprmIsRemoteExist
   * Check if remote is connected
   *
   * @returns 0 = no, 1 = yes
   */
  @nativeFunction(0x208DB1BD, 150)
  sceHprmIsRemoteExist(): number
  {
    // No remote in emulator
    return 0;
  }

  /**
   * sceHprmIsMicrophoneExist
   * Check if microphone is connected
   *
   * @returns 0 = no, 1 = yes
   */
  @nativeFunction(0x219C58F1, 150)
  sceHprmIsMicrophoneExist(): number
  {
    // No microphone in emulator
    return 0;
  }
}
