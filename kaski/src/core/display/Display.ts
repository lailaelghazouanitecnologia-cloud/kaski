/**
 * Display - PSP Display Controller
 *
 * Manages framebuffer, vertical sync timing, and display interrupts.
 * PSP display: 480x272 pixels, various pixel formats.
 */

import { PixelFormat } from '../format/PixelFormat';

// ============================================
// Constants
// ============================================

/** PSP screen width */
export const SCREEN_WIDTH = 480;

/** PSP screen height */
export const SCREEN_HEIGHT = 272;

/** Horizontal sync frequency (Hz) */
export const HSYNC_HZ = 17142.8571428571;

/** Vertical sync frequency (Hz) */
export const VSYNC_HZ = 59.94;

/** Time per vblank in milliseconds */
export const VBLANK_MS = 1000 / VSYNC_HZ;

/** Cycles per scanline */
export const CYCLES_PER_SCANLINE = 333333333 / HSYNC_HZ;

/** Total scanlines per frame (including vblank) */
export const SCANLINES_PER_FRAME = 286;

/** Visible scanlines */
export const VISIBLE_SCANLINES = 272;

// ============================================
// Types
// ============================================

/** Display sync mode */
export enum DisplaySync
{
  Immediate = 0,
  NextFrame = 1,
}

/** Display mode */
export enum DisplayMode
{
  Lcd = 0,
}

/** VBlank callback */
export type VBlankCallback = (vcount: number) => void;

// ============================================
// Display State
// ============================================

export interface DisplayState
{
  /** Framebuffer address in VRAM */
  frameBufferAddress: number;

  /** Framebuffer width (stride) */
  frameBufferWidth: number;

  /** Pixel format */
  pixelFormat: PixelFormat;

  /** Sync mode */
  sync: DisplaySync;

  /** Display enabled */
  enabled: boolean;

  /** Current vertical count (scanline) */
  vcount: number;

  /** Total vblank count since start */
  vblankCount: number;
}

// ============================================
// Display
// ============================================

export class Display
{
  /** Display state */
  private state: DisplayState = {
    frameBufferAddress: 0x04000000,
    frameBufferWidth: 512,
    pixelFormat: PixelFormat.RGBA_8888,
    sync: DisplaySync.Immediate,
    enabled: true,
    vcount: 0,
    vblankCount: 0,
  };

  /** VBlank waiting promises */
  private vblankWaiters: { resolve: () => void; targetCount: number }[] = [];

  /** VBlank callbacks */
  private vblankCallbacks: VBlankCallback[] = [];

  /** Last update time */
  private lastUpdateTime: number = 0;

  /** Accumulated time for vblank */
  private accumulatedTime: number = 0;

  // ---- Getters ----

  get frameBufferAddress(): number { return this.state.frameBufferAddress; }
  get frameBufferWidth(): number { return this.state.frameBufferWidth; }
  get pixelFormat(): PixelFormat { return this.state.pixelFormat; }
  get sync(): DisplaySync { return this.state.sync; }
  get enabled(): boolean { return this.state.enabled; }
  get vcount(): number { return this.state.vcount; }
  get vblankCount(): number { return this.state.vblankCount; }

  /** Is currently in vblank period? */
  get isVblank(): boolean
  {
    return this.state.vcount >= VISIBLE_SCANLINES;
  }

  /** Seconds until next vblank */
  get secondsToVblank(): number
  {
    if (this.isVblank) return 0;
    const remainingScanlines = VISIBLE_SCANLINES - this.state.vcount;
    return remainingScanlines / HSYNC_HZ;
  }

  /** Seconds until vblank starts */
  get secondsToVblankStart(): number
  {
    const remainingScanlines = this.isVblank
      ? SCANLINES_PER_FRAME - this.state.vcount + VISIBLE_SCANLINES
      : VISIBLE_SCANLINES - this.state.vcount;
    return remainingScanlines / HSYNC_HZ;
  }

  // ---- Control Methods ----

  /**
   * Set display mode
   */
  setMode(mode: DisplayMode, width: number, height: number): number
  {
    // PSP only supports 480x272 LCD mode
    if (mode !== DisplayMode.Lcd || width !== SCREEN_WIDTH || height !== SCREEN_HEIGHT)
    {
      return -1; // Invalid mode
    }
    return 0;
  }

  /**
   * Set framebuffer
   */
  setFrameBuf(address: number, bufferWidth: number, pixelFormat: PixelFormat, sync: DisplaySync): number
  {
    this.state.frameBufferAddress = address;
    this.state.frameBufferWidth = bufferWidth;
    this.state.pixelFormat = pixelFormat;
    this.state.sync = sync;
    return 0;
  }

  /**
   * Get framebuffer info
   */
  getFrameBuf(): { address: number; bufferWidth: number; pixelFormat: PixelFormat; sync: DisplaySync }
  {
    return {
      address: this.state.frameBufferAddress,
      bufferWidth: this.state.frameBufferWidth,
      pixelFormat: this.state.pixelFormat,
      sync: this.state.sync,
    };
  }

  /**
   * Enable/disable display
   */
  setEnabled(enabled: boolean): void
  {
    this.state.enabled = enabled;
  }

  /**
   * Get current vcount
   */
  getVcount(): number
  {
    return this.state.vcount;
  }

  // ---- VBlank Methods ----

  /**
   * Wait for next vblank
   */
  waitVblank(): Promise<void>
  {
    return new Promise(resolve =>
    {
      this.vblankWaiters.push({
        resolve,
        targetCount: this.state.vblankCount + 1,
      });
    });
  }

  /**
   * Wait for vblank start
   */
  waitVblankStart(): Promise<void>
  {
    if (this.isVblank)
    {
      // Already in vblank, wait for next one
      return this.waitVblank();
    }
    return this.waitVblank();
  }

  /**
   * Register vblank callback
   */
  onVblank(callback: VBlankCallback): () => void
  {
    this.vblankCallbacks.push(callback);
    return () =>
    {
      const index = this.vblankCallbacks.indexOf(callback);
      if (index >= 0) this.vblankCallbacks.splice(index, 1);
    };
  }

  // ---- Frame Update ----

  /**
   * Update display timing (call each frame)
   */
  update(currentTime: number): void
  {
    if (this.lastUpdateTime === 0)
    {
      this.lastUpdateTime = currentTime;
      return;
    }

    const deltaTime = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;
    this.accumulatedTime += deltaTime;

    // Check for vblank
    while (this.accumulatedTime >= VBLANK_MS)
    {
      this.accumulatedTime -= VBLANK_MS;
      this.triggerVblank();
    }

    // Update vcount based on accumulated time
    const scanlineProgress = (this.accumulatedTime / VBLANK_MS) * SCANLINES_PER_FRAME;
    this.state.vcount = Math.floor(scanlineProgress) % SCANLINES_PER_FRAME;
  }

  /**
   * Trigger vblank (used internally or for testing)
   */
  triggerVblank(): void
  {
    this.state.vblankCount++;

    // Notify callbacks
    for (const callback of this.vblankCallbacks)
    {
      callback(this.state.vblankCount);
    }

    // Resolve waiters
    const resolvedWaiters: number[] = [];
    for (let i = 0; i < this.vblankWaiters.length; i++)
    {
      const waiter = this.vblankWaiters[i];
      if (this.state.vblankCount >= waiter.targetCount)
      {
        waiter.resolve();
        resolvedWaiters.push(i);
      }
    }

    // Remove resolved waiters (in reverse to maintain indices)
    for (let i = resolvedWaiters.length - 1; i >= 0; i--)
    {
      this.vblankWaiters.splice(resolvedWaiters[i], 1);
    }
  }

  /**
   * Reset display state
   */
  reset(): void
  {
    this.state = {
      frameBufferAddress: 0x04000000,
      frameBufferWidth: 512,
      pixelFormat: PixelFormat.RGBA_8888,
      sync: DisplaySync.Immediate,
      enabled: true,
      vcount: 0,
      vblankCount: 0,
    };
    this.vblankWaiters = [];
    this.lastUpdateTime = 0;
    this.accumulatedTime = 0;
  }
}
