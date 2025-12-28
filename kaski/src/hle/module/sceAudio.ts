/**
 * sceAudio
 *
 * Audio output module.
 * Provides audio channel management and playback.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { AudioFormat } from '../manager/AudioManager';
import { SceKernelErrors } from '../errors';

@hleModule('sceAudio')
export class sceAudio
{
  readonly name = 'sceAudio';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  // ============================================
  // Channel Management
  // ============================================

  /**
   * sceAudioChReserve
   * Reserve an audio channel
   *
   * @param channel - Channel ID (-1 = auto)
   * @param sampleCount - Sample count (must be aligned to 64)
   * @param format - Audio format
   * @returns Channel ID or error
   */
  @nativeFunction(0x5EC81C55, 150)
  sceAudioChReserve(): number
  {
    const channel = this.ctx.arg(0);
    const sampleCount = this.ctx.arg(1);
    const format = this.ctx.arg(2) as AudioFormat;

    return this.ctx.audioManager.reserveChannel(channel, sampleCount, format);
  }

  /**
   * sceAudioChRelease
   * Release an audio channel
   *
   * @param channel - Channel ID
   * @returns 0 on success
   */
  @nativeFunction(0x6FC46853, 150)
  sceAudioChRelease(): number
  {
    const channel = this.ctx.arg(0);
    return this.ctx.audioManager.releaseChannel(channel);
  }

  // ============================================
  // Audio Output
  // ============================================

  /**
   * sceAudioOutput
   * Output audio (non-blocking)
   *
   * @param channel - Channel ID
   * @param vol - Volume
   * @param buf - Audio buffer
   * @returns Sample count or error
   */
  @nativeFunction(0x8C1009B2, 150)
  sceAudioOutput(): number
  {
    const channel = this.ctx.arg(0);
    const vol = this.ctx.arg(1);
    const buf = this.ctx.argPtr(2);

    return this.ctx.audioManager.output(channel, vol, buf);
  }

  /**
   * sceAudioOutputBlocking
   * Output audio (blocking)
   *
   * @param channel - Channel ID
   * @param vol - Volume
   * @param buf - Audio buffer
   * @returns Sample count or error
   */
  @nativeFunction(0x136CAF51, 150)
  sceAudioOutputBlocking(): number | Promise<number>
  {
    const channel = this.ctx.arg(0);
    const vol = this.ctx.arg(1);
    const buf = this.ctx.argPtr(2);

    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    const result = this.ctx.audioManager.outputBlocking(channel, vol, buf, thread);
    if (typeof result === 'number')
    {
      return result;
    }
    return result.toPromise();
  }

  /**
   * sceAudioOutputPanned
   * Output audio with panning (non-blocking)
   *
   * @param channel - Channel ID
   * @param leftVol - Left volume
   * @param rightVol - Right volume
   * @param buf - Audio buffer
   * @returns Sample count or error
   */
  @nativeFunction(0xE2D56B2D, 150)
  sceAudioOutputPanned(): number
  {
    const channel = this.ctx.arg(0);
    const leftVol = this.ctx.arg(1);
    const rightVol = this.ctx.arg(2);
    const buf = this.ctx.argPtr(3);

    return this.ctx.audioManager.outputPanned(channel, leftVol, rightVol, buf);
  }

  /**
   * sceAudioOutputPannedBlocking
   * Output audio with panning (blocking)
   *
   * @param channel - Channel ID
   * @param leftVol - Left volume
   * @param rightVol - Right volume
   * @param buf - Audio buffer
   * @returns Sample count or error
   */
  @nativeFunction(0x13F592BC, 150)
  sceAudioOutputPannedBlocking(): number | Promise<number>
  {
    const channel = this.ctx.arg(0);
    const leftVol = this.ctx.arg(1);
    const rightVol = this.ctx.arg(2);
    const buf = this.ctx.argPtr(3);

    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    const result = this.ctx.audioManager.outputPannedBlocking(
      channel, leftVol, rightVol, buf, thread
    );
    if (typeof result === 'number')
    {
      return result;
    }
    return result.toPromise();
  }

  // ============================================
  // Channel Configuration
  // ============================================

  /**
   * sceAudioGetChannelRestLen
   * Get remaining samples in channel
   *
   * @param channel - Channel ID
   * @returns Remaining samples
   */
  @nativeFunction(0xB7E1D8E7, 150)
  sceAudioGetChannelRestLen(): number
  {
    const channel = this.ctx.arg(0);
    return this.ctx.audioManager.getChannelRestLen(channel);
  }

  /**
   * sceAudioGetChannelRestLength
   * Get remaining samples in channel (alias)
   */
  @nativeFunction(0xE9D97901, 150)
  sceAudioGetChannelRestLength(): number
  {
    return this.sceAudioGetChannelRestLen();
  }

  /**
   * sceAudioSetChannelDataLen
   * Set channel sample length
   *
   * @param channel - Channel ID
   * @param sampleCount - Sample count
   * @returns 0 on success
   */
  @nativeFunction(0xCB2E439E, 150)
  sceAudioSetChannelDataLen(): number
  {
    const channel = this.ctx.arg(0);
    const sampleCount = this.ctx.arg(1);

    return this.ctx.audioManager.setChannelDataLen(channel, sampleCount);
  }

  /**
   * sceAudioChangeChannelConfig
   * Change channel format
   *
   * @param channel - Channel ID
   * @param format - Audio format
   * @returns 0 on success
   */
  @nativeFunction(0x95FD0C2D, 150)
  sceAudioChangeChannelConfig(): number
  {
    const channel = this.ctx.arg(0);
    const format = this.ctx.arg(1) as AudioFormat;

    return this.ctx.audioManager.changeChannelConfig(channel, format);
  }

  /**
   * sceAudioChangeChannelVolume
   * Change channel volume
   *
   * @param channel - Channel ID
   * @param leftVol - Left volume
   * @param rightVol - Right volume
   * @returns 0 on success
   */
  @nativeFunction(0xB7E1D8E7, 150)
  sceAudioChangeChannelVolume(): number
  {
    const channel = this.ctx.arg(0);
    const leftVol = this.ctx.arg(1);
    const rightVol = this.ctx.arg(2);

    return this.ctx.audioManager.setChannelVolume(channel, leftVol, rightVol);
  }

  // ============================================
  // Output2 (SRC Channel)
  // ============================================

  /**
   * sceAudioOutput2Reserve
   * Reserve SRC output channel
   *
   * @param sampleCount - Sample count
   * @returns 0 on success
   */
  @nativeFunction(0x01562BA3, 150)
  sceAudioOutput2Reserve(): number
  {
    const sampleCount = this.ctx.arg(0);
    return this.ctx.audioManager.reserveOutput2(sampleCount);
  }

  /**
   * sceAudioOutput2Release
   * Release SRC output channel
   *
   * @returns 0 on success
   */
  @nativeFunction(0x43196845, 150)
  sceAudioOutput2Release(): number
  {
    return this.ctx.audioManager.releaseOutput2();
  }

  /**
   * sceAudioOutput2OutputBlocking
   * Output to SRC channel (blocking)
   *
   * @param vol - Volume
   * @param buf - Audio buffer
   * @returns Sample count or error
   */
  @nativeFunction(0x2D53F36E, 150)
  sceAudioOutput2OutputBlocking(): number | Promise<number>
  {
    const vol = this.ctx.arg(0);
    const buf = this.ctx.argPtr(1);

    const thread = this.ctx.threadManager.getCurrentThread();
    if (!thread)
    {
      return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
    }

    const result = this.ctx.audioManager.output2Blocking(vol, buf, thread);
    if (typeof result === 'number')
    {
      return result;
    }
    return result.toPromise();
  }

  /**
   * sceAudioOutput2GetRestSample
   * Get remaining samples in SRC channel
   *
   * @returns Remaining samples
   */
  @nativeFunction(0x647CEF33, 150)
  sceAudioOutput2GetRestSample(): number
  {
    return this.ctx.audioManager.getOutput2RestLen();
  }

  /**
   * sceAudioOutput2ChangeLength
   * Change SRC output sample count
   *
   * @param sampleCount - Sample count
   * @returns 0 on success
   */
  @nativeFunction(0x63F2889C, 150)
  sceAudioOutput2ChangeLength(): number
  {
    // Not fully implemented, just return success
    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // SRC Configuration
  // ============================================

  /**
   * sceAudioSRCChReserve
   * Reserve SRC channel with frequency
   *
   * @param sampleCount - Sample count
   * @param freq - Output frequency
   * @param channels - Number of channels
   * @returns 0 on success
   */
  @nativeFunction(0x38553111, 150)
  sceAudioSRCChReserve(): number
  {
    const sampleCount = this.ctx.arg(0);
    return this.ctx.audioManager.reserveOutput2(sampleCount);
  }

  /**
   * sceAudioSRCChRelease
   * Release SRC channel
   *
   * @returns 0 on success
   */
  @nativeFunction(0x5C37C0AE, 150)
  sceAudioSRCChRelease(): number
  {
    return this.ctx.audioManager.releaseOutput2();
  }

  /**
   * sceAudioSRCOutputBlocking
   * Output to SRC (blocking)
   *
   * @param vol - Volume
   * @param buf - Audio buffer
   * @returns Sample count or error
   */
  @nativeFunction(0xE0727056, 150)
  sceAudioSRCOutputBlocking(): number | Promise<number>
  {
    return this.sceAudioOutput2OutputBlocking();
  }

  // ============================================
  // Input (Stubs)
  // ============================================

  /**
   * sceAudioInputInit
   * Initialize audio input
   *
   * @returns 0 on success
   */
  @nativeFunction(0x7DE61688, 150)
  sceAudioInputInit(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceAudioInputBlocking
   * Record audio (blocking)
   *
   * @returns 0 on success (not implemented)
   */
  @nativeFunction(0x086E5895, 150)
  sceAudioInputBlocking(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceAudioInput
   * Record audio (non-blocking)
   *
   * @returns 0 on success (not implemented)
   */
  @nativeFunction(0x6D4BEC68, 150)
  sceAudioInput(): number
  {
    return SceKernelErrors.ERROR_OK;
  }
}
