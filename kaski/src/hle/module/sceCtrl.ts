/**
 * sceCtrl
 *
 * Controller input module.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SamplingMode, ControllerData } from '../manager/InputManager';
import { SceKernelErrors } from '../errors';

/**
 * SceCtrlData structure size
 *
 * struct SceCtrlData {
 *   unsigned int timeStamp;  // 0x00
 *   unsigned int buttons;    // 0x04
 *   unsigned char lx;        // 0x08
 *   unsigned char ly;        // 0x09
 *   unsigned char rsrv[6];   // 0x0A
 * }; // Size: 0x10 (16 bytes)
 */
const CTRL_DATA_SIZE = 16;

@hleModule('sceCtrl')
export class sceCtrl
{
  readonly name = 'sceCtrl';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  // ============================================
  // Sampling Configuration
  // ============================================

  /**
   * sceCtrlSetSamplingCycle
   * Set controller sampling cycle
   *
   * @param cycle - Sampling cycle in microseconds (0 = VBlank)
   * @returns 0 on success
   */
  @nativeFunction(0x6A2774F3, 150)
  sceCtrlSetSamplingCycle(): number
  {
    const cycle = this.ctx.arg(0);
    return this.ctx.inputManager.setSamplingCycle(cycle);
  }

  /**
   * sceCtrlGetSamplingCycle
   * Get controller sampling cycle
   *
   * @param cyclePtr - Output sampling cycle
   * @returns 0 on success
   */
  @nativeFunction(0x02BAAD91, 150)
  sceCtrlGetSamplingCycle(): number
  {
    const cyclePtr = this.ctx.argPtr(0);

    if (cyclePtr)
    {
      this.ctx.write32(cyclePtr, this.ctx.inputManager.getSamplingCycle());
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceCtrlSetSamplingMode
   * Set controller sampling mode
   *
   * @param mode - Sampling mode (0 = digital, 1 = analog)
   * @returns Previous mode
   */
  @nativeFunction(0x1F4011E6, 150)
  sceCtrlSetSamplingMode(): number
  {
    const mode = this.ctx.arg(0) as SamplingMode;
    return this.ctx.inputManager.setSamplingMode(mode);
  }

  /**
   * sceCtrlGetSamplingMode
   * Get controller sampling mode
   *
   * @param modePtr - Output sampling mode
   * @returns 0 on success
   */
  @nativeFunction(0xDA6B76A1, 150)
  sceCtrlGetSamplingMode(): number
  {
    const modePtr = this.ctx.argPtr(0);

    if (modePtr)
    {
      this.ctx.write32(modePtr, this.ctx.inputManager.getSamplingMode());
    }

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Controller Reading
  // ============================================

  /**
   * Write controller data to memory
   */
  private writeCtrlData(address: number, data: ControllerData): void
  {
    this.ctx.write32(address + 0x00, data.timeStamp);
    this.ctx.write32(address + 0x04, data.buttons);
    this.ctx.write8(address + 0x08, data.lx);
    this.ctx.write8(address + 0x09, data.ly);
    // Reserved bytes already zeroed
    for (let i = 0; i < 6; i++)
    {
      this.ctx.write8(address + 0x0A + i, 0);
    }
  }

  /**
   * sceCtrlPeekBufferPositive
   * Read controller data without blocking (positive logic)
   *
   * @param padDataPtr - Output SceCtrlData array
   * @param count - Number of samples to read
   * @returns Number of samples read
   */
  @nativeFunction(0x3A622550, 150)
  sceCtrlPeekBufferPositive(): number
  {
    const padDataPtr = this.ctx.argPtr(0);
    const count = this.ctx.arg(1);

    const samples = this.ctx.inputManager.peekBuffer(count);

    for (let i = 0; i < samples.length; i++)
    {
      this.writeCtrlData(padDataPtr + i * CTRL_DATA_SIZE, samples[i]);
    }

    // If no samples in buffer, return current state
    if (samples.length === 0 && count > 0)
    {
      this.writeCtrlData(padDataPtr, this.ctx.inputManager.getCurrentData());
      return 1;
    }

    return samples.length;
  }

  /**
   * sceCtrlPeekBufferNegative
   * Read controller data without blocking (negative logic)
   *
   * @param padDataPtr - Output SceCtrlData array
   * @param count - Number of samples to read
   * @returns Number of samples read
   */
  @nativeFunction(0xC152080A, 150)
  sceCtrlPeekBufferNegative(): number
  {
    const padDataPtr = this.ctx.argPtr(0);
    const count = this.ctx.arg(1);

    const samples = this.ctx.inputManager.peekBuffer(count);

    for (let i = 0; i < samples.length; i++)
    {
      // Negative logic: invert button state
      const sample = { ...samples[i], buttons: ~samples[i].buttons & 0xFFFFFFFF };
      this.writeCtrlData(padDataPtr + i * CTRL_DATA_SIZE, sample);
    }

    if (samples.length === 0 && count > 0)
    {
      const current = this.ctx.inputManager.getCurrentData();
      current.buttons = ~current.buttons & 0xFFFFFFFF;
      this.writeCtrlData(padDataPtr, current);
      return 1;
    }

    return samples.length;
  }

  /**
   * sceCtrlReadBufferPositive
   * Read controller data with blocking (positive logic)
   *
   * @param padDataPtr - Output SceCtrlData array
   * @param count - Number of samples to read
   * @returns Number of samples read
   */
  @nativeFunction(0x1F803938, 150)
  sceCtrlReadBufferPositive(): number
  {
    const padDataPtr = this.ctx.argPtr(0);
    const count = this.ctx.arg(1);

    const samples = this.ctx.inputManager.readBuffer(count);

    for (let i = 0; i < samples.length; i++)
    {
      this.writeCtrlData(padDataPtr + i * CTRL_DATA_SIZE, samples[i]);
    }

    if (samples.length === 0 && count > 0)
    {
      this.writeCtrlData(padDataPtr, this.ctx.inputManager.getCurrentData());
      return 1;
    }

    return samples.length;
  }

  /**
   * sceCtrlReadBufferNegative
   * Read controller data with blocking (negative logic)
   *
   * @param padDataPtr - Output SceCtrlData array
   * @param count - Number of samples to read
   * @returns Number of samples read
   */
  @nativeFunction(0x60B81F86, 150)
  sceCtrlReadBufferNegative(): number
  {
    const padDataPtr = this.ctx.argPtr(0);
    const count = this.ctx.arg(1);

    const samples = this.ctx.inputManager.readBuffer(count);

    for (let i = 0; i < samples.length; i++)
    {
      const sample = { ...samples[i], buttons: ~samples[i].buttons & 0xFFFFFFFF };
      this.writeCtrlData(padDataPtr + i * CTRL_DATA_SIZE, sample);
    }

    if (samples.length === 0 && count > 0)
    {
      const current = this.ctx.inputManager.getCurrentData();
      current.buttons = ~current.buttons & 0xFFFFFFFF;
      this.writeCtrlData(padDataPtr, current);
      return 1;
    }

    return samples.length;
  }

  // ============================================
  // Latch Operations
  // ============================================

  /**
   * sceCtrlPeekLatch
   * Peek controller latch data
   *
   * @param latchDataPtr - Output latch data
   * @returns Number of times latch was updated
   */
  @nativeFunction(0xB1D0E5CD, 150)
  sceCtrlPeekLatch(): number
  {
    const latchDataPtr = this.ctx.argPtr(0);

    const current = this.ctx.inputManager.getCurrentData();

    // SceCtrlLatch structure:
    // 0x00: uiMake (buttons just pressed)
    // 0x04: uiBreak (buttons just released)
    // 0x08: uiPress (buttons currently held)
    // 0x0C: uiRelease (buttons currently not held)
    this.ctx.write32(latchDataPtr + 0x00, current.buttons);  // uiMake
    this.ctx.write32(latchDataPtr + 0x04, 0);                // uiBreak
    this.ctx.write32(latchDataPtr + 0x08, current.buttons);  // uiPress
    this.ctx.write32(latchDataPtr + 0x0C, ~current.buttons); // uiRelease

    return 1;
  }

  /**
   * sceCtrlReadLatch
   * Read controller latch data (destructive)
   *
   * @param latchDataPtr - Output latch data
   * @returns Number of times latch was updated
   */
  @nativeFunction(0x0B588501, 150)
  sceCtrlReadLatch(): number
  {
    // Same as peek for now, but clears latch state
    return this.sceCtrlPeekLatch();
  }

  // ============================================
  // Idle Timer
  // ============================================

  /**
   * sceCtrlGetIdleCancelThreshold
   * Get idle cancel thresholds
   *
   * @param idleResetPtr - Output idle reset value
   * @param idleBackPtr - Output idle back value
   * @returns 0 on success
   */
  @nativeFunction(0xA7144800, 150)
  sceCtrlGetIdleCancelThreshold(): number
  {
    const idleResetPtr = this.ctx.argPtr(0);
    const idleBackPtr = this.ctx.argPtr(1);

    if (idleResetPtr)
    {
      this.ctx.write32(idleResetPtr, -1);
    }
    if (idleBackPtr)
    {
      this.ctx.write32(idleBackPtr, -1);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceCtrlSetIdleCancelThreshold
   * Set idle cancel thresholds
   *
   * @param idleReset - Idle reset value
   * @param idleBack - Idle back value
   * @returns 0 on success
   */
  @nativeFunction(0xA68FD260, 150)
  sceCtrlSetIdleCancelThreshold(): number
  {
    // No-op, we don't track idle timer
    return SceKernelErrors.ERROR_OK;
  }
}
