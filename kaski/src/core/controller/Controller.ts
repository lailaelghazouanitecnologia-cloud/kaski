/**
 * Controller - PSP Controller Input
 *
 * Handles button state, analog stick input, and input sampling.
 * PSP controller: D-pad, face buttons, triggers, analog stick.
 */

// ============================================
// Constants
// ============================================

/** Controller sampling modes */
export enum ControllerMode
{
  /** Digital mode only */
  Digital = 0,
  /** Analog mode enabled */
  Analog = 1,
}

/** PSP Button flags */
export enum PspButton
{
  Select = 0x000001,
  Start = 0x000008,
  Up = 0x000010,
  Right = 0x000020,
  Down = 0x000040,
  Left = 0x000080,
  LTrigger = 0x000100,
  RTrigger = 0x000200,
  Triangle = 0x001000,
  Circle = 0x002000,
  Cross = 0x004000,
  Square = 0x008000,
  Home = 0x010000,
  Hold = 0x020000,
  Note = 0x800000,
  Screen = 0x400000,
  VolUp = 0x100000,
  VolDown = 0x200000,
}

/** Maximum samples in buffer */
export const MAX_SAMPLES = 64;

/** Analog stick center value */
export const ANALOG_CENTER = 128;

/** Analog stick deadzone */
export const ANALOG_DEADZONE = 10;

// ============================================
// Types
// ============================================

/** Controller data structure (matches PSP SceCtrlData) */
export interface ControllerData
{
  /** Timestamp */
  timestamp: number;

  /** Button state (bitmask of PspButton) */
  buttons: number;

  /** Analog X (0-255, 128 = center) */
  analogX: number;

  /** Analog Y (0-255, 128 = center) */
  analogY: number;
}

/** Controller state */
export interface ControllerState
{
  /** Current button state */
  buttons: number;

  /** Current analog X */
  analogX: number;

  /** Current analog Y */
  analogY: number;

  /** Controller mode */
  mode: ControllerMode;

  /** Sample cycle */
  cycle: number;

  /** Sample buffer */
  samples: ControllerData[];

  /** Latch data for positive/negative edge detection */
  latchData: {
    make: number;
    break: number;
    press: number;
    release: number;
  };
}

// ============================================
// Controller
// ============================================

export class Controller
{
  /** Controller state */
  private state: ControllerState = {
    buttons: 0,
    analogX: ANALOG_CENTER,
    analogY: ANALOG_CENTER,
    mode: ControllerMode.Analog,
    cycle: 0,
    samples: [],
    latchData: {
      make: 0,
      break: 0,
      press: 0,
      release: 0,
    },
  };

  /** Timestamp counter */
  private timestamp: number = 0;

  // ---- Getters ----

  get buttons(): number { return this.state.buttons; }
  get analogX(): number { return this.state.analogX; }
  get analogY(): number { return this.state.analogY; }
  get mode(): ControllerMode { return this.state.mode; }

  /** Get latch data for edge detection */
  get latchData(): ControllerState['latchData']
  {
    return { ...this.state.latchData };
  }

  // ---- Control Methods ----

  /**
   * Set controller mode
   */
  setMode(mode: ControllerMode): void
  {
    this.state.mode = mode;
  }

  /**
   * Set sampling cycle
   */
  setCycle(cycle: number): void
  {
    this.state.cycle = cycle;
  }

  /**
   * Press button(s)
   */
  pressButton(button: PspButton | number): void
  {
    const prevButtons = this.state.buttons;
    this.state.buttons |= button;

    // Update latch for newly pressed buttons
    const newPress = this.state.buttons & ~prevButtons;
    this.state.latchData.make |= newPress;
    this.state.latchData.press |= newPress;
  }

  /**
   * Release button(s)
   */
  releaseButton(button: PspButton | number): void
  {
    const prevButtons = this.state.buttons;
    this.state.buttons &= ~button;

    // Update latch for newly released buttons
    const newRelease = prevButtons & ~this.state.buttons;
    this.state.latchData.break |= newRelease;
    this.state.latchData.release |= newRelease;
  }

  /**
   * Set button state directly
   */
  setButtons(buttons: number): void
  {
    const prevButtons = this.state.buttons;
    this.state.buttons = buttons;

    // Update latch
    const newPress = buttons & ~prevButtons;
    const newRelease = prevButtons & ~buttons;
    this.state.latchData.make |= newPress;
    this.state.latchData.press |= newPress;
    this.state.latchData.break |= newRelease;
    this.state.latchData.release |= newRelease;
  }

  /**
   * Set analog stick position
   */
  setAnalog(x: number, y: number): void
  {
    this.state.analogX = Math.max(0, Math.min(255, x));
    this.state.analogY = Math.max(0, Math.min(255, y));
  }

  /**
   * Set analog stick from normalized values (-1 to 1)
   */
  setAnalogNormalized(x: number, y: number): void
  {
    this.state.analogX = Math.floor((x + 1) * 127.5);
    this.state.analogY = Math.floor((y + 1) * 127.5);
  }

  // ---- Sampling ----

  /**
   * Read current controller data (peek, non-blocking)
   */
  peekData(): ControllerData
  {
    return {
      timestamp: this.timestamp,
      buttons: this.state.buttons,
      analogX: this.state.mode === ControllerMode.Analog ? this.state.analogX : ANALOG_CENTER,
      analogY: this.state.mode === ControllerMode.Analog ? this.state.analogY : ANALOG_CENTER,
    };
  }

  /**
   * Read buffered samples
   */
  readBuffers(count: number): ControllerData[]
  {
    const result: ControllerData[] = [];
    const available = Math.min(count, this.state.samples.length);

    for (let i = 0; i < available; i++)
    {
      result.push(this.state.samples.shift()!);
    }

    // Fill remaining with current data
    while (result.length < count)
    {
      result.push(this.peekData());
    }

    return result;
  }

  /**
   * Read and clear latch data
   */
  readLatch(): ControllerState['latchData']
  {
    const latch = { ...this.state.latchData };
    this.state.latchData = {
      make: 0,
      break: 0,
      press: this.state.buttons,
      release: 0,
    };
    return latch;
  }

  // ---- Frame Update ----

  /**
   * Update controller (call each frame)
   */
  update(): void
  {
    this.timestamp++;

    // Add sample to buffer
    if (this.state.samples.length >= MAX_SAMPLES)
    {
      this.state.samples.shift();
    }
    this.state.samples.push(this.peekData());
  }

  /**
   * Reset controller state
   */
  reset(): void
  {
    this.state = {
      buttons: 0,
      analogX: ANALOG_CENTER,
      analogY: ANALOG_CENTER,
      mode: ControllerMode.Analog,
      cycle: 0,
      samples: [],
      latchData: {
        make: 0,
        break: 0,
        press: 0,
        release: 0,
      },
    };
    this.timestamp = 0;
  }
}
