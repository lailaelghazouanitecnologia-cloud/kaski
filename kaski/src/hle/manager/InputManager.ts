/**
 * Input Manager
 *
 * Manages PSP controller state and input sampling.
 */

import { SceKernelErrors } from '../errors';

/**
 * PSP button flags
 */
export const PspButtons = {
  SELECT: 0x000001,
  START: 0x000008,
  UP: 0x000010,
  RIGHT: 0x000020,
  DOWN: 0x000040,
  LEFT: 0x000080,
  LTRIGGER: 0x000100,
  RTRIGGER: 0x000200,
  TRIANGLE: 0x001000,
  CIRCLE: 0x002000,
  CROSS: 0x004000,
  SQUARE: 0x008000,
  HOME: 0x010000,
  HOLD: 0x020000,
  NOTE: 0x800000,
} as const;

/**
 * Controller sampling mode
 */
export const enum SamplingMode
{
  Digital = 0,  // Digital buttons only
  Analog = 1,   // Digital + analog stick
}

/**
 * Controller data structure
 */
export interface ControllerData
{
  /** Timestamp */
  timeStamp: number;
  /** Button state */
  buttons: number;
  /** Left analog X (0-255, 128 = center) */
  lx: number;
  /** Left analog Y (0-255, 128 = center) */
  ly: number;
  /** Reserved */
  rsrv: Uint8Array;
}

/**
 * Input Manager
 *
 * Handles controller input state and sampling.
 */
export class InputManager
{
  // Current button state
  private buttonState: number = 0;

  // Analog stick state (0-255, 128 = center)
  private analogX: number = 128;
  private analogY: number = 128;

  // Sampling configuration
  private samplingCycle: number = 0;
  private samplingMode: SamplingMode = SamplingMode.Analog;

  // Input buffer (circular buffer for history)
  private static readonly BUFFER_SIZE = 64;
  private buffer: ControllerData[] = [];
  private bufferIndex: number = 0;

  // Latch state for peek vs read
  private latchData: ControllerData | null = null;

  // Time tracking
  private startTime: number = Date.now();

  constructor()
  {
    this.reset();
  }

  /**
   * Reset input state
   */
  reset(): void
  {
    this.buttonState = 0;
    this.analogX = 128;
    this.analogY = 128;
    this.samplingCycle = 0;
    this.samplingMode = SamplingMode.Analog;
    this.buffer = [];
    this.bufferIndex = 0;
    this.latchData = null;
    this.startTime = Date.now();
  }

  // ============================================
  // Input State (Set by external input handler)
  // ============================================

  /**
   * Set button pressed
   */
  setButton(button: number): void
  {
    this.buttonState |= button;
    this.updateBuffer();
  }

  /**
   * Clear button
   */
  clearButton(button: number): void
  {
    this.buttonState &= ~button;
    this.updateBuffer();
  }

  /**
   * Set all buttons at once
   */
  setButtons(buttons: number): void
  {
    this.buttonState = buttons;
    this.updateBuffer();
  }

  /**
   * Set analog stick position
   *
   * @param x - X position (0-255, 128 = center)
   * @param y - Y position (0-255, 128 = center)
   */
  setAnalog(x: number, y: number): void
  {
    this.analogX = Math.max(0, Math.min(255, x));
    this.analogY = Math.max(0, Math.min(255, y));
    this.updateBuffer();
  }

  /**
   * Get current timestamp
   */
  private getTimestamp(): number
  {
    return Date.now() - this.startTime;
  }

  /**
   * Update input buffer with current state
   */
  private updateBuffer(): void
  {
    const data: ControllerData = {
      timeStamp: this.getTimestamp(),
      buttons: this.buttonState,
      lx: this.samplingMode === SamplingMode.Analog ? this.analogX : 128,
      ly: this.samplingMode === SamplingMode.Analog ? this.analogY : 128,
      rsrv: new Uint8Array(6),
    };

    if (this.buffer.length < InputManager.BUFFER_SIZE)
    {
      this.buffer.push(data);
    }
    else
    {
      this.buffer[this.bufferIndex] = data;
      this.bufferIndex = (this.bufferIndex + 1) % InputManager.BUFFER_SIZE;
    }

    this.latchData = data;
  }

  // ============================================
  // Sampling Configuration
  // ============================================

  /**
   * Set sampling cycle
   *
   * @param cycle - Sampling cycle in microseconds (0 = VBlank)
   */
  setSamplingCycle(cycle: number): number
  {
    this.samplingCycle = cycle;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Get sampling cycle
   */
  getSamplingCycle(): number
  {
    return this.samplingCycle;
  }

  /**
   * Set sampling mode
   *
   * @param mode - Sampling mode (digital or analog)
   */
  setSamplingMode(mode: SamplingMode): number
  {
    const prevMode = this.samplingMode;
    this.samplingMode = mode;
    return prevMode;
  }

  /**
   * Get sampling mode
   */
  getSamplingMode(): SamplingMode
  {
    return this.samplingMode;
  }

  // ============================================
  // Controller Reading
  // ============================================

  /**
   * Get current controller data (snapshot)
   */
  getCurrentData(): ControllerData
  {
    return {
      timeStamp: this.getTimestamp(),
      buttons: this.buttonState,
      lx: this.samplingMode === SamplingMode.Analog ? this.analogX : 128,
      ly: this.samplingMode === SamplingMode.Analog ? this.analogY : 128,
      rsrv: new Uint8Array(6),
    };
  }

  /**
   * Peek controller data (non-destructive)
   *
   * @param count - Number of samples to read
   * @returns Array of controller data
   */
  peekBuffer(count: number): ControllerData[]
  {
    const result: ControllerData[] = [];

    // Return current data if no buffer or requesting more than available
    if (this.buffer.length === 0 || count <= 0)
    {
      if (count > 0)
      {
        result.push(this.getCurrentData());
      }
      return result;
    }

    // Read from buffer
    const available = Math.min(count, this.buffer.length);
    for (let i = 0; i < available; i++)
    {
      const idx = (this.bufferIndex - available + i + this.buffer.length) % this.buffer.length;
      result.push(this.buffer[idx]);
    }

    return result;
  }

  /**
   * Read controller data (destructive - clears latch)
   *
   * @param count - Number of samples to read
   * @returns Array of controller data
   */
  readBuffer(count: number): ControllerData[]
  {
    const result = this.peekBuffer(count);
    this.latchData = null;
    return result;
  }

  /**
   * Check if button is pressed
   */
  isButtonPressed(button: number): boolean
  {
    return (this.buttonState & button) !== 0;
  }

  /**
   * Get all pressed buttons
   */
  getButtons(): number
  {
    return this.buttonState;
  }
}
