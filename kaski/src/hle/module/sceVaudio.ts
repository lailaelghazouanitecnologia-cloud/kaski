/**
 * sceVaudio
 *
 * Virtual Audio module.
 * Provides virtual audio channel for background music.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * Virtual audio channel state
 */
interface VaudioChannel
{
  reserved: boolean;
  sampleCount: number;
  frequency: number;
  format: number;
}

@hleModule('sceVaudio')
export class sceVaudio
{
  readonly name = 'sceVaudio';

  private ctx!: EmulatorContext;

  // Virtual audio channel
  private channel: VaudioChannel = {
    reserved: false,
    sampleCount: 0,
    frequency: 48000,
    format: 0,
  };

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
    this.channel = {
      reserved: false,
      sampleCount: 0,
      frequency: 48000,
      format: 0,
    };
  }

  /**
   * sceVaudioChReserve
   * Reserve the virtual audio channel
   *
   * @param sampleCount - Number of samples
   * @param frequency - Sample frequency
   * @param format - Audio format
   * @returns 0 on success
   */
  @nativeFunction(0x67585DFD, 150)
  sceVaudioChReserve(): number
  {
    const sampleCount = this.ctx.arg(0);
    const frequency = this.ctx.arg(1);
    const format = this.ctx.arg(2);

    if (this.channel.reserved)
    {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_BUSY;
    }

    this.channel.reserved = true;
    this.channel.sampleCount = sampleCount;
    this.channel.frequency = frequency;
    this.channel.format = format;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceVaudioChRelease
   * Release the virtual audio channel
   *
   * @returns 0 on success
   */
  @nativeFunction(0x8986295E, 150)
  sceVaudioChRelease(): number
  {
    if (!this.channel.reserved)
    {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }

    this.channel.reserved = false;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceVaudioOutputBlocking
   * Output audio (blocking)
   *
   * @param vol - Volume
   * @param bufPtr - Audio buffer
   * @returns Sample count
   */
  @nativeFunction(0x03B6807D, 150)
  sceVaudioOutputBlocking(): number | Promise<number>
  {
    const vol = this.ctx.arg(0);
    const bufPtr = this.ctx.argPtr(1);

    if (!this.channel.reserved)
    {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }

    // Simulate blocking with delay
    return new Promise(resolve =>
    {
      setTimeout(() =>
      {
        resolve(this.channel.sampleCount);
      }, Math.floor(this.channel.sampleCount / 48));
    });
  }

  /**
   * sceVaudioSetEffectType
   * Set audio effect type
   *
   * @param type - Effect type
   * @param volume - Effect volume
   * @returns 0 on success
   */
  @nativeFunction(0x346FBE94, 150)
  sceVaudioSetEffectType(): number
  {
    // Accept but ignore
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceVaudioSetAlcMode
   * Set ALC mode
   *
   * @param mode - ALC mode
   * @returns 0 on success
   */
  @nativeFunction(0xCBD4AC51, 150)
  sceVaudioSetAlcMode(): number
  {
    // Accept but ignore
    return SceKernelErrors.ERROR_OK;
  }
}
