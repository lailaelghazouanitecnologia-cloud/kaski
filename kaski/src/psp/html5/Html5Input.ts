/**
 * Html5Input - Keyboard and Gamepad Input
 *
 * Maps keyboard and gamepad input to PSP controller.
 */

import { Controller, PspButton, ANALOG_CENTER } from '../../core/controller';

// ============================================
// Types
// ============================================

/** Key mapping */
export interface KeyMapping
{
  [key: string]: PspButton;
}

/** Gamepad mapping */
export interface GamepadMapping
{
  buttons: { [index: number]: PspButton };
  axes: {
    leftX: number;
    leftY: number;
    deadzone: number;
  };
}

// ============================================
// Default Mappings
// ============================================

/** Default keyboard mapping */
export const DEFAULT_KEY_MAPPING: KeyMapping = {
  // D-pad
  'ArrowUp': PspButton.Up,
  'ArrowDown': PspButton.Down,
  'ArrowLeft': PspButton.Left,
  'ArrowRight': PspButton.Right,

  // Face buttons (WASD alternative)
  'w': PspButton.Triangle,
  's': PspButton.Cross,
  'a': PspButton.Square,
  'd': PspButton.Circle,

  // Face buttons (IJKL alternative)
  'i': PspButton.Triangle,
  'k': PspButton.Cross,
  'j': PspButton.Square,
  'l': PspButton.Circle,

  // Triggers
  'q': PspButton.LTrigger,
  'e': PspButton.RTrigger,

  // Start/Select
  'Enter': PspButton.Start,
  'Shift': PspButton.Select,

  // Home
  'Escape': PspButton.Home,
};

/** Default gamepad mapping (Xbox-style) */
export const DEFAULT_GAMEPAD_MAPPING: GamepadMapping = {
  buttons: {
    0: PspButton.Cross,     // A
    1: PspButton.Circle,    // B
    2: PspButton.Square,    // X
    3: PspButton.Triangle,  // Y
    4: PspButton.LTrigger,  // LB
    5: PspButton.RTrigger,  // RB
    8: PspButton.Select,    // Back
    9: PspButton.Start,     // Start
    12: PspButton.Up,       // D-pad Up
    13: PspButton.Down,     // D-pad Down
    14: PspButton.Left,     // D-pad Left
    15: PspButton.Right,    // D-pad Right
    16: PspButton.Home,     // Xbox button
  },
  axes: {
    leftX: 0,
    leftY: 1,
    deadzone: 0.15,
  },
};

// ============================================
// Html5Input
// ============================================

export class Html5Input
{
  private controller: Controller;
  private keyMapping: KeyMapping;
  private gamepadMapping: GamepadMapping;

  /** Currently pressed keys */
  private pressedKeys: Set<string> = new Set();

  /** Active gamepad index */
  private gamepadIndex: number = -1;

  /** Keyboard event handlers */
  private keydownHandler: (e: KeyboardEvent) => void;
  private keyupHandler: (e: KeyboardEvent) => void;

  /** Gamepad polling interval */
  private gamepadPollInterval: number | null = null;

  constructor(
    controller: Controller,
    keyMapping: KeyMapping = DEFAULT_KEY_MAPPING,
    gamepadMapping: GamepadMapping = DEFAULT_GAMEPAD_MAPPING
  )
  {
    this.controller = controller;
    this.keyMapping = keyMapping;
    this.gamepadMapping = gamepadMapping;

    // Create event handlers
    this.keydownHandler = this.onKeyDown.bind(this);
    this.keyupHandler = this.onKeyUp.bind(this);
  }

  // ---- Initialization ----

  /**
   * Start listening for input
   */
  start(): void
  {
    // Keyboard events
    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);

    // Gamepad events
    window.addEventListener('gamepadconnected', this.onGamepadConnected.bind(this));
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected.bind(this));

    // Start gamepad polling
    this.startGamepadPolling();
  }

  /**
   * Stop listening for input
   */
  stop(): void
  {
    window.removeEventListener('keydown', this.keydownHandler);
    window.removeEventListener('keyup', this.keyupHandler);

    this.stopGamepadPolling();
    this.pressedKeys.clear();
    this.controller.reset();
  }

  // ---- Keyboard Handling ----

  private onKeyDown(event: KeyboardEvent): void
  {
    const button = this.keyMapping[event.key];
    if (button !== undefined)
    {
      event.preventDefault();
      if (!this.pressedKeys.has(event.key))
      {
        this.pressedKeys.add(event.key);
        this.controller.pressButton(button);
      }
    }
  }

  private onKeyUp(event: KeyboardEvent): void
  {
    const button = this.keyMapping[event.key];
    if (button !== undefined)
    {
      event.preventDefault();
      this.pressedKeys.delete(event.key);
      this.controller.releaseButton(button);
    }
  }

  // ---- Gamepad Handling ----

  private onGamepadConnected(event: GamepadEvent): void
  {
    console.log(`Gamepad connected: ${event.gamepad.id}`);
    if (this.gamepadIndex < 0)
    {
      this.gamepadIndex = event.gamepad.index;
    }
  }

  private onGamepadDisconnected(event: GamepadEvent): void
  {
    console.log(`Gamepad disconnected: ${event.gamepad.id}`);
    if (event.gamepad.index === this.gamepadIndex)
    {
      this.gamepadIndex = -1;
      this.findNextGamepad();
    }
  }

  private findNextGamepad(): void
  {
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++)
    {
      if (gamepads[i])
      {
        this.gamepadIndex = i;
        return;
      }
    }
  }

  private startGamepadPolling(): void
  {
    if (this.gamepadPollInterval !== null) return;

    this.gamepadPollInterval = window.setInterval(() =>
    {
      this.pollGamepad();
    }, 16); // ~60Hz
  }

  private stopGamepadPolling(): void
  {
    if (this.gamepadPollInterval !== null)
    {
      clearInterval(this.gamepadPollInterval);
      this.gamepadPollInterval = null;
    }
  }

  private pollGamepad(): void
  {
    if (this.gamepadIndex < 0) return;

    const gamepads = navigator.getGamepads();
    const gamepad = gamepads[this.gamepadIndex];
    if (!gamepad) return;

    let buttons = 0;

    // Check buttons
    for (const [index, button] of Object.entries(this.gamepadMapping.buttons))
    {
      const btnIndex = parseInt(index);
      if (gamepad.buttons[btnIndex]?.pressed)
      {
        buttons |= button;
      }
    }

    // Update controller buttons
    this.controller.setButtons(buttons | this.getKeyboardButtons());

    // Check analog stick
    const { leftX, leftY, deadzone } = this.gamepadMapping.axes;
    let ax = gamepad.axes[leftX] ?? 0;
    let ay = gamepad.axes[leftY] ?? 0;

    // Apply deadzone
    if (Math.abs(ax) < deadzone) ax = 0;
    if (Math.abs(ay) < deadzone) ay = 0;

    // Convert to PSP analog range (0-255)
    const analogX = Math.floor((ax + 1) * 127.5);
    const analogY = Math.floor((ay + 1) * 127.5);

    this.controller.setAnalog(analogX, analogY);
  }

  /**
   * Get button state from keyboard
   */
  private getKeyboardButtons(): number
  {
    let buttons = 0;
    for (const key of this.pressedKeys)
    {
      const button = this.keyMapping[key];
      if (button !== undefined)
      {
        buttons |= button;
      }
    }
    return buttons;
  }

  // ---- Configuration ----

  /**
   * Set key mapping
   */
  setKeyMapping(mapping: KeyMapping): void
  {
    this.keyMapping = mapping;
  }

  /**
   * Set gamepad mapping
   */
  setGamepadMapping(mapping: GamepadMapping): void
  {
    this.gamepadMapping = mapping;
  }

  /**
   * Get current key mapping
   */
  getKeyMapping(): KeyMapping
  {
    return { ...this.keyMapping };
  }

  /**
   * Get connected gamepads
   */
  getConnectedGamepads(): Gamepad[]
  {
    const gamepads = navigator.getGamepads();
    return Array.from(gamepads).filter((g): g is Gamepad => g !== null);
  }
}
