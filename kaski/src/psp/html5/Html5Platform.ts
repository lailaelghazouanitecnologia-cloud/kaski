/**
 * Html5Platform - Browser Platform Integration
 *
 * Combines display, audio, and input for browser execution.
 */

import { Memory } from '../../core/memory/Memory';
import { Display } from '../../core/display';
import { Audio } from '../../core/audio';
import { Controller } from '../../core/controller';
import { Battery } from '../../core/battery';
import { Html5Display, Html5DisplayOptions } from './Html5Display';
import { Html5Audio, Html5AudioOptions } from './Html5Audio';
import { Html5Input, KeyMapping, GamepadMapping } from './Html5Input';

// ============================================
// Types
// ============================================

export interface Html5PlatformOptions
{
  /** Canvas element for display */
  canvas: HTMLCanvasElement;

  /** Display options */
  display?: Partial<Html5DisplayOptions>;

  /** Audio options */
  audio?: Html5AudioOptions;

  /** Custom key mapping */
  keyMapping?: KeyMapping;

  /** Custom gamepad mapping */
  gamepadMapping?: GamepadMapping;
}

/** Frame callback */
export type FrameCallback = (deltaTime: number) => void;

// ============================================
// Html5Platform
// ============================================

export class Html5Platform
{
  /** Core components */
  readonly display: Display;
  readonly audio: Audio;
  readonly controller: Controller;
  readonly battery: Battery;
  readonly memory: Memory;

  /** HTML5 integrations */
  readonly html5Display: Html5Display;
  readonly html5Audio: Html5Audio;
  readonly html5Input: Html5Input;

  /** Frame loop state */
  private running: boolean = false;
  private animationFrameId: number = 0;
  private lastFrameTime: number = 0;
  private frameCallback: FrameCallback | null = null;

  /** Stats */
  private frameCount: number = 0;
  private totalTime: number = 0;

  constructor(memory: Memory, options: Html5PlatformOptions)
  {
    this.memory = memory;

    // Create core components
    this.display = new Display();
    this.audio = new Audio();
    this.controller = new Controller();
    this.battery = new Battery();

    // Create HTML5 integrations
    this.html5Display = new Html5Display(
      { canvas: options.canvas, ...options.display },
      this.display,
      memory
    );

    this.html5Audio = new Html5Audio(this.audio, options.audio);

    this.html5Input = new Html5Input(
      this.controller,
      options.keyMapping,
      options.gamepadMapping
    );
  }

  // ---- Getters ----

  get isRunning(): boolean { return this.running; }
  get fps(): number { return this.html5Display.currentFps; }
  get averageFrameTime(): number
  {
    return this.frameCount > 0 ? this.totalTime / this.frameCount : 0;
  }

  // ---- Lifecycle ----

  /**
   * Initialize platform (call after user interaction)
   */
  async init(): Promise<void>
  {
    await this.html5Audio.init();
  }

  /**
   * Start the platform
   */
  start(frameCallback?: FrameCallback): void
  {
    if (this.running) return;

    this.running = true;
    this.frameCallback = frameCallback ?? null;
    this.lastFrameTime = performance.now();

    // Start input handling
    this.html5Input.start();

    // Start frame loop
    this.scheduleFrame();
  }

  /**
   * Stop the platform
   */
  stop(): void
  {
    if (!this.running) return;

    this.running = false;
    this.html5Input.stop();

    if (this.animationFrameId)
    {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  /**
   * Pause (suspend audio, keep display)
   */
  async pause(): Promise<void>
  {
    await this.html5Audio.suspend();
  }

  /**
   * Resume (resume audio)
   */
  async resume(): Promise<void>
  {
    await this.html5Audio.resume();
  }

  // ---- Frame Loop ----

  private scheduleFrame(): void
  {
    this.animationFrameId = requestAnimationFrame((time) => this.onFrame(time));
  }

  private onFrame(currentTime: number): void
  {
    if (!this.running) return;

    // Calculate delta time
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    // Update stats
    this.frameCount++;
    this.totalTime += deltaTime;

    // Update core components
    this.display.update(currentTime);
    this.controller.update();
    this.battery.update(deltaTime);

    // Call frame callback (emulator step)
    if (this.frameCallback)
    {
      this.frameCallback(deltaTime);
    }

    // Render display
    this.html5Display.render();

    // Schedule next frame
    this.scheduleFrame();
  }

  // ---- Utility ----

  /**
   * Single step (for debugging)
   */
  step(): void
  {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    this.display.update(currentTime);
    this.controller.update();

    if (this.frameCallback)
    {
      this.frameCallback(deltaTime);
    }

    this.html5Display.render();
  }

  /**
   * Take screenshot
   */
  takeScreenshot(): string
  {
    const canvas = document.querySelector('canvas');
    return canvas?.toDataURL('image/png') ?? '';
  }

  /**
   * Reset platform state
   */
  reset(): void
  {
    this.display.reset();
    this.audio.reset();
    this.controller.reset();
    this.battery.reset();
    this.html5Audio.clearBuffers();

    this.frameCount = 0;
    this.totalTime = 0;
  }

  /**
   * Destroy platform
   */
  destroy(): void
  {
    this.stop();
    this.html5Audio.destroy();
  }
}
