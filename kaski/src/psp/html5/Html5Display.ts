/**
 * Html5Display - Browser Canvas Display
 *
 * Renders PSP framebuffer to HTML5 canvas using WebGPU or 2D context.
 */

import { SCREEN_WIDTH, SCREEN_HEIGHT, Display } from '../../core/display';
import { Memory } from '../../core/memory/Memory';
import { PixelFormat } from '../../core/format/PixelFormat';

// ============================================
// Types
// ============================================

export interface Html5DisplayOptions
{
  /** Target canvas element */
  canvas: HTMLCanvasElement;

  /** Use WebGPU if available */
  preferWebGpu?: boolean;

  /** Scale factor (default: 2) */
  scale?: number;

  /** Enable smoothing */
  smoothing?: boolean;
}

// ============================================
// Html5Display
// ============================================

export class Html5Display
{
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private imageData: ImageData | null = null;
  private scale: number;
  private smoothing: boolean;

  /** Display controller reference */
  private display: Display;

  /** Memory reference for framebuffer access */
  private memory: Memory;

  /** Frame count */
  private frameCount: number = 0;

  /** Last FPS update time */
  private lastFpsTime: number = 0;

  /** Current FPS */
  private fps: number = 0;

  constructor(options: Html5DisplayOptions, display: Display, memory: Memory)
  {
    this.canvas = options.canvas;
    this.scale = options.scale ?? 2;
    this.smoothing = options.smoothing ?? false;
    this.display = display;
    this.memory = memory;

    this.initCanvas();
  }

  // ---- Getters ----

  get currentFps(): number { return this.fps; }
  get width(): number { return SCREEN_WIDTH; }
  get height(): number { return SCREEN_HEIGHT; }

  // ---- Initialization ----

  private initCanvas(): void
  {
    // Set canvas size
    this.canvas.width = SCREEN_WIDTH * this.scale;
    this.canvas.height = SCREEN_HEIGHT * this.scale;

    // Get 2D context
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    if (!this.ctx)
    {
      throw new Error('Failed to get 2D canvas context');
    }

    // Configure rendering
    this.ctx.imageSmoothingEnabled = this.smoothing;

    // Create image data buffer
    this.imageData = this.ctx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
  }

  // ---- Rendering ----

  /**
   * Render current framebuffer to canvas
   */
  render(): void
  {
    if (!this.ctx || !this.imageData) return;

    const fb = this.display.getFrameBuf();

    // Debug: log framebuffer info on first render only (use a static flag)
    if (!(Html5Display as any)._debugDone)
    {
      (Html5Display as any)._debugDone = true;
      console.log(`[Html5Display] FB: addr=0x${fb.address.toString(16)}, width=${fb.bufferWidth}, format=${fb.pixelFormat}`);

      // Test memory reads BEFORE render
      const testAddr = fb.address;
      const raw0 = this.memory.lwu(testAddr);
      const raw100 = this.memory.lwu(testAddr + (100 * fb.bufferWidth + 100) * 4);
      const raw200 = this.memory.lwu(testAddr + (200 * fb.bufferWidth + 200) * 4);
      console.log(`[Html5Display] Raw mem BEFORE render:`);
      console.log(`  [0,0]: 0x${raw0.toString(16).padStart(8,'0')} -> R=${raw0 & 0xFF}, G=${(raw0>>>8)&0xFF}, B=${(raw0>>>16)&0xFF}, A=${(raw0>>>24)&0xFF}`);
      console.log(`  [100,100]: 0x${raw100.toString(16).padStart(8,'0')} -> R=${raw100 & 0xFF}, G=${(raw100>>>8)&0xFF}, B=${(raw100>>>16)&0xFF}, A=${(raw100>>>24)&0xFF}`);
      console.log(`  [200,200]: 0x${raw200.toString(16).padStart(8,'0')} -> R=${raw200 & 0xFF}, G=${(raw200>>>8)&0xFF}, B=${(raw200>>>16)&0xFF}, A=${(raw200>>>24)&0xFF}`);
    }

    this.renderFramebuffer(fb.address, fb.bufferWidth, fb.pixelFormat);

    // Debug: check imageData after render
    if ((Html5Display as any)._debugDone && !(Html5Display as any)._debugDone2)
    {
      (Html5Display as any)._debugDone2 = true;
      const pixels = this.imageData.data;
      // Correct indexing: (y * width + x) * 4
      const idx0 = 0;  // pixel (0,0)
      const idx100 = (100 * SCREEN_WIDTH + 100) * 4;  // pixel (100,100)
      const idx200 = (200 * SCREEN_WIDTH + 200) * 4;  // pixel (200,200)
      console.log(`[Html5Display] ImageData AFTER render:`);
      console.log(`  px[0,0]: R=${pixels[idx0]}, G=${pixels[idx0+1]}, B=${pixels[idx0+2]}, A=${pixels[idx0+3]}`);
      console.log(`  px[100,100]: R=${pixels[idx100]}, G=${pixels[idx100+1]}, B=${pixels[idx100+2]}, A=${pixels[idx100+3]}`);
      console.log(`  px[200,200]: R=${pixels[idx200]}, G=${pixels[idx200+1]}, B=${pixels[idx200+2]}, A=${pixels[idx200+3]}`);
    }

    // Put imageData directly to canvas context
    this.ctx.putImageData(this.imageData, 0, 0);

    // Scale up if needed
    if (this.scale > 1)
    {
      // Create temp canvas for scaling
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = SCREEN_WIDTH;
      tempCanvas.height = SCREEN_HEIGHT;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(this.imageData, 0, 0);

      // Clear and draw scaled
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(
        tempCanvas,
        0, 0, SCREEN_WIDTH, SCREEN_HEIGHT,
        0, 0, this.canvas.width, this.canvas.height
      );
    }

    // Update FPS
    this.updateFps();
  }

  /**
   * Render framebuffer from memory
   */
  private renderFramebuffer(address: number, stride: number, format: PixelFormat): void
  {
    if (!this.imageData) return;

    const pixels = this.imageData.data;
    const bytesPerPixel = this.getBytesPerPixel(format);

    for (let y = 0; y < SCREEN_HEIGHT; y++)
    {
      for (let x = 0; x < SCREEN_WIDTH; x++)
      {
        const srcOffset = address + (y * stride + x) * bytesPerPixel;
        const dstOffset = (y * SCREEN_WIDTH + x) * 4;

        const { r, g, b, a } = this.readPixel(srcOffset, format);
        pixels[dstOffset] = r;
        pixels[dstOffset + 1] = g;
        pixels[dstOffset + 2] = b;
        pixels[dstOffset + 3] = a;
      }
    }
  }

  /**
   * Read pixel from memory
   */
  private readPixel(address: number, format: PixelFormat): { r: number; g: number; b: number; a: number }
  {
    switch (format)
    {
      case PixelFormat.RGBA_8888:
      {
        // Use lwu for unsigned value, then use unsigned shift
        const value = this.memory.lwu(address);
        return {
          r: value & 0xFF,
          g: (value >>> 8) & 0xFF,
          b: (value >>> 16) & 0xFF,
          a: (value >>> 24) & 0xFF,
        };
      }

      case PixelFormat.RGB_565:
      {
        const value = this.memory.lhu(address);
        return {
          r: ((value & 0x1F) << 3) | ((value & 0x1F) >> 2),
          g: (((value >>> 5) & 0x3F) << 2) | (((value >>> 5) & 0x3F) >> 4),
          b: (((value >>> 11) & 0x1F) << 3) | (((value >>> 11) & 0x1F) >> 2),
          a: 255,
        };
      }

      case PixelFormat.RGBA_5551:
      {
        const value = this.memory.lhu(address);
        return {
          r: ((value & 0x1F) << 3) | ((value & 0x1F) >> 2),
          g: (((value >>> 5) & 0x1F) << 3) | (((value >>> 5) & 0x1F) >> 2),
          b: (((value >>> 10) & 0x1F) << 3) | (((value >>> 10) & 0x1F) >> 2),
          a: (value & 0x8000) ? 255 : 0,
        };
      }

      case PixelFormat.RGBA_4444:
      {
        const value = this.memory.lhu(address);
        return {
          r: ((value & 0xF) << 4) | (value & 0xF),
          g: (((value >>> 4) & 0xF) << 4) | ((value >>> 4) & 0xF),
          b: (((value >>> 8) & 0xF) << 4) | ((value >>> 8) & 0xF),
          a: (((value >>> 12) & 0xF) << 4) | ((value >>> 12) & 0xF),
        };
      }

      default:
        return { r: 0, g: 0, b: 0, a: 255 };
    }
  }

  /**
   * Get bytes per pixel for format
   */
  private getBytesPerPixel(format: PixelFormat): number
  {
    switch (format)
    {
      case PixelFormat.RGBA_8888: return 4;
      case PixelFormat.RGB_565: return 2;
      case PixelFormat.RGBA_5551: return 2;
      case PixelFormat.RGBA_4444: return 2;
      default: return 4;
    }
  }

  // ---- FPS Tracking ----

  private updateFps(): void
  {
    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastFpsTime;

    if (elapsed >= 1000)
    {
      this.fps = Math.round(this.frameCount * 1000 / elapsed);
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
  }

  // ---- Configuration ----

  /**
   * Set scale factor
   */
  setScale(scale: number): void
  {
    this.scale = scale;
    this.canvas.width = SCREEN_WIDTH * scale;
    this.canvas.height = SCREEN_HEIGHT * scale;
  }

  /**
   * Set smoothing
   */
  setSmoothing(enabled: boolean): void
  {
    this.smoothing = enabled;
    if (this.ctx)
    {
      this.ctx.imageSmoothingEnabled = enabled;
    }
  }

  /**
   * Clear display
   */
  clear(color: string = '#000000'): void
  {
    if (!this.ctx) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
