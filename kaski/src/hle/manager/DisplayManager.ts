/**
 * Display Manager
 *
 * Manages PSP display state: frame buffers, VBlank timing, display modes.
 */

import { PromiseFast } from '../../util/PromiseFast';
import { WaitQueue, Waitable, WaitStatus } from '../../util/WaitQueue';
import { SceKernelErrors } from '../errors';

// PSP display constants
export const PSP_DISPLAY_WIDTH = 480;
export const PSP_DISPLAY_HEIGHT = 272;
export const PSP_DISPLAY_LINE_SIZE = 512; // Stride in pixels

export const enum PixelFormat
{
  RGB565 = 0,
  RGBA5551 = 1,
  RGBA4444 = 2,
  RGBA8888 = 3,
}

export const enum SyncMode
{
  Immediate = 0,
  NextFrame = 1,
}

/**
 * Frame buffer info
 */
export interface FrameBuffer
{
  /** VRAM address of top-left pixel */
  topAddr: number;
  /** Buffer width in pixels (stride) */
  bufferWidth: number;
  /** Pixel format */
  pixelFormat: PixelFormat;
  /** Sync mode */
  syncMode: SyncMode;
}

/**
 * Display Manager
 *
 * Handles display mode, frame buffers, and VBlank synchronization.
 */
export class DisplayManager
{
  // Display mode
  private mode: number = 0;
  private width: number = PSP_DISPLAY_WIDTH;
  private height: number = PSP_DISPLAY_HEIGHT;

  // Frame buffers (double buffering)
  private frontBuffer: FrameBuffer = {
    topAddr: 0x04000000, // Default VRAM address
    bufferWidth: PSP_DISPLAY_LINE_SIZE,
    pixelFormat: PixelFormat.RGBA8888,
    syncMode: SyncMode.Immediate,
  };

  private backBuffer: FrameBuffer | null = null;

  // VBlank state
  private vcount: number = 0;
  private hcount: number = 0;
  private accumulatedHcount: number = 0;
  private lastVblankTime: number = 0;
  private vblankInterval: number = 1000 / 60; // ~16.67ms for 60fps

  // VBlank waiters
  private vblankWaiters: Array<{
    waitable: Waitable;
    resolve: (value: number) => void;
    isStart: boolean;
  }> = [];

  // Running state
  private vblankTimerId?: ReturnType<typeof setInterval>;
  private isForeground: boolean = true;

  /**
   * Start VBlank timer
   */
  start(): void
  {
    if (this.vblankTimerId) return;

    this.lastVblankTime = Date.now();
    this.vblankTimerId = setInterval(() => this.onVblank(), this.vblankInterval);
  }

  /**
   * Stop VBlank timer
   */
  stop(): void
  {
    if (this.vblankTimerId)
    {
      clearInterval(this.vblankTimerId);
      this.vblankTimerId = undefined;
    }
  }

  /**
   * Reset display state
   */
  reset(): void
  {
    this.stop();
    this.mode = 0;
    this.width = PSP_DISPLAY_WIDTH;
    this.height = PSP_DISPLAY_HEIGHT;
    this.vcount = 0;
    this.hcount = 0;
    this.accumulatedHcount = 0;
    this.frontBuffer = {
      topAddr: 0x04000000,
      bufferWidth: PSP_DISPLAY_LINE_SIZE,
      pixelFormat: PixelFormat.RGBA8888,
      syncMode: SyncMode.Immediate,
    };
    this.backBuffer = null;
    this.cancelAllWaiters();
  }

  /**
   * VBlank interrupt handler
   */
  private onVblank(): void
  {
    this.vcount++;
    this.hcount = 0;
    this.accumulatedHcount += PSP_DISPLAY_HEIGHT;
    this.lastVblankTime = Date.now();

    // Swap buffers if pending
    if (this.backBuffer && this.frontBuffer.syncMode === SyncMode.NextFrame)
    {
      this.frontBuffer = this.backBuffer;
      this.backBuffer = null;
    }

    // Wake all VBlank waiters
    this.wakeVblankWaiters();
  }

  /**
   * Wake all threads waiting for VBlank
   */
  private wakeVblankWaiters(): void
  {
    const waiters = this.vblankWaiters;
    this.vblankWaiters = [];

    for (const entry of waiters)
    {
      entry.waitable.status = WaitStatus.READY;
      entry.resolve(0);
    }
  }

  /**
   * Cancel all waiters
   */
  private cancelAllWaiters(): void
  {
    const waiters = this.vblankWaiters;
    this.vblankWaiters = [];

    for (const entry of waiters)
    {
      entry.waitable.status = WaitStatus.READY;
      entry.resolve(SceKernelErrors.ERROR_KERNEL_WAIT_CANCELLED);
    }
  }

  // ============================================
  // Display Mode
  // ============================================

  /**
   * Set display mode
   *
   * @param mode - Display mode (usually 0)
   * @param width - Display width (480)
   * @param height - Display height (272)
   */
  setMode(mode: number, width: number, height: number): number
  {
    if (width !== PSP_DISPLAY_WIDTH || height !== PSP_DISPLAY_HEIGHT)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_SIZE;
    }

    this.mode = mode;
    this.width = width;
    this.height = height;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Get display mode
   */
  getMode(): { mode: number; width: number; height: number }
  {
    return {
      mode: this.mode,
      width: this.width,
      height: this.height,
    };
  }

  // ============================================
  // Frame Buffer
  // ============================================

  /**
   * Set frame buffer
   *
   * @param topAddr - VRAM address of top-left pixel
   * @param bufferWidth - Buffer width (stride)
   * @param pixelFormat - Pixel format
   * @param syncMode - Sync mode (immediate or next frame)
   */
  setFrameBuf(
    topAddr: number,
    bufferWidth: number,
    pixelFormat: PixelFormat,
    syncMode: SyncMode
  ): number
  {
    if (bufferWidth < 0 || bufferWidth > 2048)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_SIZE;
    }

    if (pixelFormat < 0 || pixelFormat > 3)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }

    const buffer: FrameBuffer = {
      topAddr,
      bufferWidth,
      pixelFormat,
      syncMode,
    };

    if (syncMode === SyncMode.Immediate)
    {
      this.frontBuffer = buffer;
    }
    else
    {
      this.backBuffer = buffer;
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Get current frame buffer
   */
  getFrameBuf(): FrameBuffer
  {
    return this.frontBuffer;
  }

  // ============================================
  // VBlank Synchronization
  // ============================================

  /**
   * Get current VBlank count
   */
  getVcount(): number
  {
    return this.vcount;
  }

  /**
   * Get current horizontal count within frame
   */
  getCurrentHcount(): number
  {
    // Estimate based on time since last VBlank
    const elapsed = Date.now() - this.lastVblankTime;
    const progress = elapsed / this.vblankInterval;
    return Math.floor(progress * PSP_DISPLAY_HEIGHT) % PSP_DISPLAY_HEIGHT;
  }

  /**
   * Get accumulated horizontal count
   */
  getAccumulatedHcount(): number
  {
    return this.accumulatedHcount + this.getCurrentHcount();
  }

  /**
   * Check if currently in VBlank period
   */
  isVblank(): boolean
  {
    // VBlank is at the end of each frame
    // Approximate: last ~10% of frame time is VBlank
    const elapsed = Date.now() - this.lastVblankTime;
    const progress = elapsed / this.vblankInterval;
    return progress > 0.9;
  }

  /**
   * Check if display is in foreground
   */
  getIsForeground(): boolean
  {
    return this.isForeground;
  }

  /**
   * Wait for VBlank
   *
   * @param thread - Thread to suspend
   * @param waitStart - If true, wait for VBlank start; otherwise wait for any VBlank
   */
  waitVblank(thread: Waitable, waitStart: boolean = false): number | PromiseFast<number>
  {
    // If already in VBlank and not waiting for start, return immediately
    if (this.isVblank() && !waitStart)
    {
      return 0;
    }

    const { promise, resolve } = PromiseFast.create<number>();

    this.vblankWaiters.push({
      waitable: thread,
      resolve,
      isStart: waitStart,
    });

    thread.status = WaitStatus.WAIT;

    return promise;
  }

  // ============================================
  // Rendering Interface
  // ============================================

  /**
   * Get bytes per pixel for format
   */
  getBytesPerPixel(format: PixelFormat): number
  {
    switch (format)
    {
      case PixelFormat.RGB565:
      case PixelFormat.RGBA5551:
      case PixelFormat.RGBA4444:
        return 2;
      case PixelFormat.RGBA8888:
        return 4;
      default:
        return 4;
    }
  }

  /**
   * Get frame buffer size in bytes
   */
  getFrameBufferSize(): number
  {
    const bpp = this.getBytesPerPixel(this.frontBuffer.pixelFormat);
    return this.frontBuffer.bufferWidth * PSP_DISPLAY_HEIGHT * bpp;
  }
}
