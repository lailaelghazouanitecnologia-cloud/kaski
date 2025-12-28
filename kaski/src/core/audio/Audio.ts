/**
 * Audio - PSP Audio Output
 *
 * Manages audio channels, output format, and volume.
 * PSP has 8 hardware audio channels.
 */

// ============================================
// Constants
// ============================================

/** Number of audio channels */
export const AUDIO_CHANNELS = 8;

/** Default sample rate */
export const DEFAULT_SAMPLE_RATE = 44100;

/** Maximum volume */
export const MAX_VOLUME = 0x8000;

/** Default volume */
export const DEFAULT_VOLUME = 0x8000;

/** Samples per channel buffer */
export const SAMPLES_PER_BUFFER = 1024;

// ============================================
// Types
// ============================================

/** Audio format */
export enum AudioFormat
{
  /** Stereo (interleaved L/R) */
  Stereo = 0x00,
  /** Mono */
  Mono = 0x10,
}

/** Audio channel state */
export interface AudioChannel
{
  /** Channel ID */
  id: number;

  /** Channel reserved */
  reserved: boolean;

  /** Sample count */
  sampleCount: number;

  /** Audio format */
  format: AudioFormat;

  /** Left volume (0-0x8000) */
  leftVolume: number;

  /** Right volume (0-0x8000) */
  rightVolume: number;

  /** Sample rate */
  sampleRate: number;
}

/** Audio output callback */
export type AudioCallback = (channel: number, samples: Float32Array) => void;

// ============================================
// Audio State
// ============================================

export interface AudioState
{
  /** Audio channels */
  channels: AudioChannel[];

  /** Master volume */
  masterVolume: number;

  /** Audio enabled */
  enabled: boolean;

  /** Current sample rate */
  sampleRate: number;
}

// ============================================
// Audio
// ============================================

export class Audio
{
  /** Audio state */
  private state: AudioState;

  /** Audio output callbacks */
  private callbacks: AudioCallback[] = [];

  /** Pending audio data per channel */
  private pendingData: Map<number, Int16Array[]> = new Map();

  constructor()
  {
    this.state = this.createInitialState();
  }

  private createInitialState(): AudioState
  {
    const channels: AudioChannel[] = [];
    for (let i = 0; i < AUDIO_CHANNELS; i++)
    {
      channels.push({
        id: i,
        reserved: false,
        sampleCount: SAMPLES_PER_BUFFER,
        format: AudioFormat.Stereo,
        leftVolume: DEFAULT_VOLUME,
        rightVolume: DEFAULT_VOLUME,
        sampleRate: DEFAULT_SAMPLE_RATE,
      });
    }

    return {
      channels,
      masterVolume: MAX_VOLUME,
      enabled: true,
      sampleRate: DEFAULT_SAMPLE_RATE,
    };
  }

  // ---- Getters ----

  get channels(): readonly AudioChannel[] { return this.state.channels; }
  get masterVolume(): number { return this.state.masterVolume; }
  get enabled(): boolean { return this.state.enabled; }
  get sampleRate(): number { return this.state.sampleRate; }

  /**
   * Get channel by ID
   */
  getChannel(id: number): AudioChannel | undefined
  {
    if (id < 0 || id >= AUDIO_CHANNELS) return undefined;
    return this.state.channels[id];
  }

  // ---- Channel Management ----

  /**
   * Reserve an audio channel
   */
  reserveChannel(sampleCount: number, format: AudioFormat): number
  {
    // Find free channel
    for (let i = 0; i < AUDIO_CHANNELS; i++)
    {
      if (!this.state.channels[i].reserved)
      {
        const channel = this.state.channels[i];
        channel.reserved = true;
        channel.sampleCount = sampleCount;
        channel.format = format;
        this.pendingData.set(i, []);
        return i;
      }
    }
    return -1; // No free channel
  }

  /**
   * Reserve a specific channel
   */
  reserveChannelById(id: number, sampleCount: number, format: AudioFormat): number
  {
    if (id < 0 || id >= AUDIO_CHANNELS) return -1;

    const channel = this.state.channels[id];
    if (channel.reserved) return -1;

    channel.reserved = true;
    channel.sampleCount = sampleCount;
    channel.format = format;
    this.pendingData.set(id, []);
    return id;
  }

  /**
   * Release an audio channel
   */
  releaseChannel(id: number): boolean
  {
    if (id < 0 || id >= AUDIO_CHANNELS) return false;

    const channel = this.state.channels[id];
    if (!channel.reserved) return false;

    channel.reserved = false;
    channel.leftVolume = DEFAULT_VOLUME;
    channel.rightVolume = DEFAULT_VOLUME;
    this.pendingData.delete(id);
    return true;
  }

  /**
   * Set channel volume
   */
  setChannelVolume(id: number, left: number, right: number): boolean
  {
    if (id < 0 || id >= AUDIO_CHANNELS) return false;

    const channel = this.state.channels[id];
    channel.leftVolume = Math.max(0, Math.min(MAX_VOLUME, left));
    channel.rightVolume = Math.max(0, Math.min(MAX_VOLUME, right));
    return true;
  }

  /**
   * Change channel configuration
   */
  changeChannel(id: number, sampleCount: number, format: AudioFormat): boolean
  {
    if (id < 0 || id >= AUDIO_CHANNELS) return false;

    const channel = this.state.channels[id];
    if (!channel.reserved) return false;

    channel.sampleCount = sampleCount;
    channel.format = format;
    return true;
  }

  // ---- Audio Output ----

  /**
   * Output audio data to channel
   */
  output(id: number, data: Int16Array): void
  {
    if (id < 0 || id >= AUDIO_CHANNELS) return;

    const pending = this.pendingData.get(id);
    if (pending)
    {
      pending.push(data);
    }

    // Notify callbacks
    const floatData = this.convertToFloat(data);
    for (const callback of this.callbacks)
    {
      callback(id, floatData);
    }
  }

  /**
   * Output audio with volume
   */
  outputWithVolume(id: number, leftVol: number, rightVol: number, data: Int16Array): void
  {
    this.setChannelVolume(id, leftVol, rightVol);
    this.output(id, data);
  }

  /**
   * Get pending sample count for channel
   */
  getPendingSamples(id: number): number
  {
    const pending = this.pendingData.get(id);
    if (!pending) return 0;

    let total = 0;
    for (const data of pending)
    {
      total += data.length;
    }
    return total;
  }

  // ---- Callbacks ----

  /**
   * Register audio output callback
   */
  onOutput(callback: AudioCallback): () => void
  {
    this.callbacks.push(callback);
    return () =>
    {
      const index = this.callbacks.indexOf(callback);
      if (index >= 0) this.callbacks.splice(index, 1);
    };
  }

  // ---- Master Controls ----

  /**
   * Set master volume
   */
  setMasterVolume(volume: number): void
  {
    this.state.masterVolume = Math.max(0, Math.min(MAX_VOLUME, volume));
  }

  /**
   * Enable/disable audio
   */
  setEnabled(enabled: boolean): void
  {
    this.state.enabled = enabled;
  }

  // ---- Helpers ----

  /**
   * Convert Int16 audio to Float32
   */
  private convertToFloat(data: Int16Array): Float32Array
  {
    const result = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++)
    {
      result[i] = data[i] / 32768;
    }
    return result;
  }

  /**
   * Reset audio state
   */
  reset(): void
  {
    this.state = this.createInitialState();
    this.pendingData.clear();
  }
}
