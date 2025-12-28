/**
 * sceDisplay
 *
 * Display mode and VBlank synchronization module.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { PixelFormat, SyncMode } from '../manager/DisplayManager';
import { SceKernelErrors } from '../errors';

@hleModule('sceDisplay')
export class sceDisplay
{
  readonly name = 'sceDisplay';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  // ============================================
  // Display Mode
  // ============================================

  /**
   * sceDisplaySetMode
   * Set display mode
   *
   * @param mode - Display mode (usually 0)
   * @param width - Display width (480)
   * @param height - Display height (272)
   * @returns 0 on success
   */
  @nativeFunction(0x0E20F177, 150)
  sceDisplaySetMode(): number
  {
    const mode = this.ctx.arg(0);
    const width = this.ctx.arg(1);
    const height = this.ctx.arg(2);

    this.ctx.log(`sceDisplaySetMode(${mode}, ${width}, ${height})`);
    return this.ctx.displayManager.setMode(mode, width, height);
  }

  /**
   * sceDisplayGetMode
   * Get current display mode
   *
   * @param modePtr - Output mode
   * @param widthPtr - Output width
   * @param heightPtr - Output height
   * @returns 0 on success
   */
  @nativeFunction(0xDEA197D4, 150)
  sceDisplayGetMode(): number
  {
    const modePtr = this.ctx.argPtr(0);
    const widthPtr = this.ctx.argPtr(1);
    const heightPtr = this.ctx.argPtr(2);

    const { mode, width, height } = this.ctx.displayManager.getMode();

    if (modePtr)
    {
      this.ctx.write32(modePtr, mode);
    }
    if (widthPtr)
    {
      this.ctx.write32(widthPtr, width);
    }
    if (heightPtr)
    {
      this.ctx.write32(heightPtr, height);
    }

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Frame Buffer
  // ============================================

  /**
   * sceDisplaySetFrameBuf
   * Set frame buffer
   *
   * @param topAddr - VRAM address
   * @param bufferWidth - Buffer width (stride)
   * @param pixelFormat - Pixel format
   * @param syncMode - Sync mode
   * @returns 0 on success
   */
  @nativeFunction(0x289D82FE, 150)
  sceDisplaySetFrameBuf(): number
  {
    const topAddr = this.ctx.arg(0);
    const bufferWidth = this.ctx.arg(1);
    const pixelFormat = this.ctx.arg(2) as PixelFormat;
    const syncMode = this.ctx.arg(3) as SyncMode;

    this.ctx.log(`sceDisplaySetFrameBuf(0x${topAddr.toString(16)}, ${bufferWidth}, ${pixelFormat}, ${syncMode})`);

    return this.ctx.displayManager.setFrameBuf(
      topAddr,
      bufferWidth,
      pixelFormat,
      syncMode
    );
  }

  /**
   * sceDisplayGetFrameBuf
   * Get current frame buffer
   *
   * @param topAddrPtr - Output VRAM address
   * @param bufferWidthPtr - Output buffer width
   * @param pixelFormatPtr - Output pixel format
   * @param syncModePtr - Sync mode requested
   * @returns 0 on success
   */
  @nativeFunction(0xEEDA2E54, 150)
  sceDisplayGetFrameBuf(): number
  {
    const topAddrPtr = this.ctx.argPtr(0);
    const bufferWidthPtr = this.ctx.argPtr(1);
    const pixelFormatPtr = this.ctx.argPtr(2);
    const syncModePtr = this.ctx.argPtr(3);

    const fb = this.ctx.displayManager.getFrameBuf();

    if (topAddrPtr)
    {
      this.ctx.write32(topAddrPtr, fb.topAddr);
    }
    if (bufferWidthPtr)
    {
      this.ctx.write32(bufferWidthPtr, fb.bufferWidth);
    }
    if (pixelFormatPtr)
    {
      this.ctx.write32(pixelFormatPtr, fb.pixelFormat);
    }

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // VBlank Synchronization
  // ============================================

  /**
   * sceDisplayWaitVblank
   * Wait for VBlank
   *
   * @returns 0 on success
   */
  @nativeFunction(0x36CDFADE, 150)
  sceDisplayWaitVblank(): number | Promise<number>
  {
    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    const result = this.ctx.displayManager.waitVblank(thread, false);
    if (typeof result === 'number')
    {
      return result;
    }
    return result.toPromise();
  }

  /**
   * sceDisplayWaitVblankStart
   * Wait for VBlank start
   *
   * @returns 0 on success
   */
  @nativeFunction(0x984C27E7, 150)
  sceDisplayWaitVblankStart(): number | Promise<number>
  {
    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    const result = this.ctx.displayManager.waitVblank(thread, true);
    if (typeof result === 'number')
    {
      return result;
    }
    return result.toPromise();
  }

  /**
   * sceDisplayWaitVblankCB
   * Wait for VBlank with callback processing
   *
   * @returns 0 on success
   */
  @nativeFunction(0x8EB9EC49, 150)
  sceDisplayWaitVblankCB(): number | Promise<number>
  {
    const thread = this.ctx.threadManager.getCurrentThread();
    if (thread)
    {
      thread.callbackAccepting = true;
    }
    return this.sceDisplayWaitVblank();
  }

  /**
   * sceDisplayWaitVblankStartCB
   * Wait for VBlank start with callback processing
   *
   * @returns 0 on success
   */
  @nativeFunction(0x46F186C3, 150)
  sceDisplayWaitVblankStartCB(): number | Promise<number>
  {
    const thread = this.ctx.threadManager.getCurrentThread();
    if (thread)
    {
      thread.callbackAccepting = true;
    }
    return this.sceDisplayWaitVblankStart();
  }

  // ============================================
  // VBlank Counter
  // ============================================

  /**
   * sceDisplayGetVcount
   * Get VBlank count since boot
   *
   * @returns VBlank count
   */
  @nativeFunction(0x9C6EAAD7, 150)
  sceDisplayGetVcount(): number
  {
    return this.ctx.displayManager.getVcount();
  }

  /**
   * sceDisplayGetCurrentHcount
   * Get current horizontal line count within frame
   *
   * @returns Horizontal count
   */
  @nativeFunction(0x773DD3A3, 150)
  sceDisplayGetCurrentHcount(): number
  {
    return this.ctx.displayManager.getCurrentHcount();
  }

  /**
   * sceDisplayGetAccumulatedHcount
   * Get total horizontal count since boot
   *
   * @returns Accumulated horizontal count
   */
  @nativeFunction(0x210EAB3A, 150)
  sceDisplayGetAccumulatedHcount(): number
  {
    return this.ctx.displayManager.getAccumulatedHcount();
  }

  // ============================================
  // Display State
  // ============================================

  /**
   * sceDisplayIsVblank
   * Check if currently in VBlank period
   *
   * @returns 1 if VBlank, 0 otherwise
   */
  @nativeFunction(0x4D4E10EC, 150)
  sceDisplayIsVblank(): number
  {
    return this.ctx.displayManager.isVblank() ? 1 : 0;
  }

  /**
   * sceDisplayIsForeground
   * Check if display is in foreground
   *
   * @returns 1 if foreground, 0 otherwise
   */
  @nativeFunction(0xB4F378FA, 150)
  sceDisplayIsForeground(): number
  {
    return this.ctx.displayManager.getIsForeground() ? 1 : 0;
  }
}
