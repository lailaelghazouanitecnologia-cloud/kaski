/**
 * Audio Manager
 *
 * Manages PSP audio channels and output.
 */

import { PromiseFast } from '../../util/PromiseFast';
import { WaitQueue, Waitable, WaitStatus } from '../../util/WaitQueue';
import { SceKernelErrors } from '../errors';

/**
 * Audio format
 */
export const enum AudioFormat
{
  Stereo = 0x00,
  Mono = 0x10,
}

/**
 * Audio channel state
 */
export interface AudioChannel
{
  id: number;
  reserved: boolean;
  sampleCount: number;
  format: AudioFormat;
  volumeLeft: number;
  volumeRight: number;
  restLength: number;
}

/**
 * Maximum number of audio channels
 */
const MAX_CHANNELS = 8;

/**
 * SRC (Sample Rate Converter) channel for output2
 */
const SRC_CHANNEL_ID = 8;

/**
 * Audio Manager
 *
 * Handles audio channel reservation and output.
 */
export class AudioManager
{
  // Audio channels
  private channels: Map<number, AudioChannel> = new Map();

  // SRC channel for sceAudioOutput2
  private srcChannel: AudioChannel | null = null;

  // Output waiters
  private outputWaiters: Map<number, Array<{
    waitable: Waitable;
    resolve: (value: number) => void;
  }>> = new Map();

  /**
   * Reset audio state
   */
  reset(): void
  {
    this.channels.clear();
    this.srcChannel = null;
    this.outputWaiters.clear();
  }

  // ============================================
  // Channel Management
  // ============================================

  /**
   * Reserve an audio channel
   *
   * @param channelId - Channel ID (-1 = auto)
   * @param sampleCount - Sample count
   * @param format - Audio format
   * @returns Channel ID or error
   */
  reserveChannel(
    channelId: number,
    sampleCount: number,
    format: AudioFormat
  ): number
  {
    // Validate sample count
    if (sampleCount <= 0 || sampleCount > 65536)
    {
      return SceKernelErrors.ERROR_AUDIO_INVALID_SIZE;
    }

    // Sample count must be aligned to 64
    if ((sampleCount & 63) !== 0)
    {
      return SceKernelErrors.ERROR_AUDIO_INVALID_SIZE;
    }

    // Auto-select channel
    if (channelId < 0)
    {
      for (let i = 0; i < MAX_CHANNELS; i++)
      {
        if (!this.channels.has(i))
        {
          channelId = i;
          break;
        }
      }

      if (channelId < 0)
      {
        return SceKernelErrors.ERROR_AUDIO_CHANNEL_BUSY;
      }
    }

    // Check if channel is valid and available
    if (channelId >= MAX_CHANNELS)
    {
      return SceKernelErrors.ERROR_AUDIO_INVALID_CHANNEL;
    }

    if (this.channels.has(channelId))
    {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_BUSY;
    }

    const channel: AudioChannel = {
      id: channelId,
      reserved: true,
      sampleCount,
      format,
      volumeLeft: 0x8000,  // Max volume
      volumeRight: 0x8000,
      restLength: 0,
    };

    this.channels.set(channelId, channel);

    return channelId;
  }

  /**
   * Release a channel
   */
  releaseChannel(channelId: number): number
  {
    if (!this.channels.has(channelId))
    {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }

    this.channels.delete(channelId);
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Get channel by ID
   */
  getChannel(channelId: number): AudioChannel | undefined
  {
    return this.channels.get(channelId);
  }

  /**
   * Set channel volume
   */
  setChannelVolume(
    channelId: number,
    volumeLeft: number,
    volumeRight: number
  ): number
  {
    const channel = this.channels.get(channelId);
    if (!channel)
    {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }

    channel.volumeLeft = Math.max(0, Math.min(0xFFFF, volumeLeft));
    channel.volumeRight = Math.max(0, Math.min(0xFFFF, volumeRight));

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Set channel sample length
   */
  setChannelDataLen(channelId: number, sampleCount: number): number
  {
    const channel = this.channels.get(channelId);
    if (!channel)
    {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }

    if ((sampleCount & 63) !== 0 || sampleCount <= 0)
    {
      return SceKernelErrors.ERROR_AUDIO_INVALID_SIZE;
    }

    channel.sampleCount = sampleCount;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Change channel config
   */
  changeChannelConfig(channelId: number, format: AudioFormat): number
  {
    const channel = this.channels.get(channelId);
    if (!channel)
    {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }

    channel.format = format;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Get rest length
   */
  getChannelRestLen(channelId: number): number
  {
    const channel = this.channels.get(channelId);
    if (!channel)
    {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }

    return channel.restLength;
  }

  // ============================================
  // Audio Output
  // ============================================

  /**
   * Output audio (non-blocking)
   *
   * @param channelId - Channel ID
   * @param vol - Volume
   * @param bufPtr - Buffer pointer
   * @returns Sample count or error
   */
  output(channelId: number, vol: number, bufPtr: number): number
  {
    const channel = this.channels.get(channelId);
    if (!channel)
    {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }

    // In emulator, we just return the sample count immediately
    // Real audio would be sent to Web Audio API
    return channel.sampleCount;
  }

  /**
   * Output audio (blocking)
   *
   * @param channelId - Channel ID
   * @param vol - Volume
   * @param bufPtr - Buffer pointer
   * @param thread - Thread to block
   * @returns Sample count or promise
   */
  outputBlocking(
    channelId: number,
    vol: number,
    bufPtr: number,
    thread: Waitable
  ): number | PromiseFast<number>
  {
    const channel = this.channels.get(channelId);
    if (!channel)
    {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }

    // Simulate blocking with a small delay
    // Real implementation would wait for audio buffer to drain
    const { promise, resolve } = PromiseFast.create<number>();

    setTimeout(() =>
    {
      resolve(channel.sampleCount);
    }, Math.floor(channel.sampleCount / 44.1)); // Approximate ms for samples at 44.1kHz

    return promise;
  }

  /**
   * Output audio with panning (non-blocking)
   */
  outputPanned(
    channelId: number,
    volLeft: number,
    volRight: number,
    bufPtr: number
  ): number
  {
    const channel = this.channels.get(channelId);
    if (!channel)
    {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }

    channel.volumeLeft = volLeft;
    channel.volumeRight = volRight;

    return channel.sampleCount;
  }

  /**
   * Output audio with panning (blocking)
   */
  outputPannedBlocking(
    channelId: number,
    volLeft: number,
    volRight: number,
    bufPtr: number,
    thread: Waitable
  ): number | PromiseFast<number>
  {
    const channel = this.channels.get(channelId);
    if (!channel)
    {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }

    channel.volumeLeft = volLeft;
    channel.volumeRight = volRight;

    return this.outputBlocking(channelId, 0, bufPtr, thread);
  }

  // ============================================
  // Output2 (SRC Channel)
  // ============================================

  /**
   * Reserve SRC channel
   */
  reserveOutput2(sampleCount: number): number
  {
    if (this.srcChannel)
    {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_BUSY;
    }

    if ((sampleCount & 63) !== 0 || sampleCount <= 0)
    {
      return SceKernelErrors.ERROR_AUDIO_INVALID_SIZE;
    }

    this.srcChannel = {
      id: SRC_CHANNEL_ID,
      reserved: true,
      sampleCount,
      format: AudioFormat.Stereo,
      volumeLeft: 0x8000,
      volumeRight: 0x8000,
      restLength: 0,
    };

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Release SRC channel
   */
  releaseOutput2(): number
  {
    if (!this.srcChannel)
    {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }

    this.srcChannel = null;
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Output to SRC channel (blocking)
   */
  output2Blocking(
    vol: number,
    bufPtr: number,
    thread: Waitable
  ): number | PromiseFast<number>
  {
    if (!this.srcChannel)
    {
      return SceKernelErrors.ERROR_AUDIO_CHANNEL_NOT_RESERVED;
    }

    const { promise, resolve } = PromiseFast.create<number>();

    setTimeout(() =>
    {
      resolve(this.srcChannel?.sampleCount ?? 0);
    }, Math.floor((this.srcChannel.sampleCount) / 44.1));

    return promise;
  }

  /**
   * Get SRC channel rest length
   */
  getOutput2RestLen(): number
  {
    return this.srcChannel?.restLength ?? 0;
  }

  /**
   * Set SRC channel frequency
   */
  setOutput2Frequency(frequency: number): number
  {
    // Accept but ignore - we always output at native rate
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * Get SRC channel frequency
   */
  getOutput2Frequency(): number
  {
    return 48000; // Default PSP output frequency
  }
}
