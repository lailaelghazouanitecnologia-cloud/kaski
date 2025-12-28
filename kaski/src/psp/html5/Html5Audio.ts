/**
 * Html5Audio - Web Audio API Integration
 *
 * Outputs PSP audio through Web Audio API.
 */

import { Audio, AudioFormat, AUDIO_CHANNELS, DEFAULT_SAMPLE_RATE } from '../../core/audio';

// ============================================
// Types
// ============================================

export interface Html5AudioOptions
{
  /** Sample rate (default: 44100) */
  sampleRate?: number;

  /** Buffer size (default: 4096) */
  bufferSize?: number;

  /** Latency hint */
  latencyHint?: 'interactive' | 'balanced' | 'playback';
}

// ============================================
// Html5Audio
// ============================================

export class Html5Audio
{
  private audio: Audio;
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private sampleRate: number;
  private bufferSize: number;

  /** Channel buffers */
  private channelBuffers: Map<number, Float32Array[]> = new Map();

  /** Audio worklet node (if supported) */
  private workletNode: AudioWorkletNode | null = null;

  /** Script processor node (fallback) */
  private scriptNode: ScriptProcessorNode | null = null;

  constructor(audio: Audio, options: Html5AudioOptions = {})
  {
    this.audio = audio;
    this.sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
    this.bufferSize = options.bufferSize ?? 4096;

    // Initialize channel buffers
    for (let i = 0; i < AUDIO_CHANNELS; i++)
    {
      this.channelBuffers.set(i, []);
    }

    // Register audio callback
    this.audio.onOutput((channel, samples) =>
    {
      this.queueSamples(channel, samples);
    });
  }

  // ---- Getters ----

  get isInitialized(): boolean { return this.audioContext !== null; }
  get isRunning(): boolean { return this.audioContext?.state === 'running'; }
  get currentSampleRate(): number { return this.sampleRate; }

  // ---- Initialization ----

  /**
   * Initialize audio context (must be called after user interaction)
   */
  async init(): Promise<void>
  {
    if (this.audioContext) return;

    // Create audio context
    this.audioContext = new AudioContext({
      sampleRate: this.sampleRate,
      latencyHint: 'interactive',
    });

    // Create gain node for master volume
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);

    // Use ScriptProcessorNode (deprecated but widely supported)
    await this.initScriptProcessor();
  }

  /**
   * Initialize using ScriptProcessorNode
   */
  private async initScriptProcessor(): Promise<void>
  {
    if (!this.audioContext || !this.gainNode) return;

    this.scriptNode = this.audioContext.createScriptProcessor(
      this.bufferSize,
      0, // No input channels
      2  // Stereo output
    );

    this.scriptNode.onaudioprocess = (event) =>
    {
      this.processAudio(event);
    };

    this.scriptNode.connect(this.gainNode);
  }

  // ---- Audio Processing ----

  /**
   * Queue samples for output
   */
  private queueSamples(channel: number, samples: Float32Array): void
  {
    const buffer = this.channelBuffers.get(channel);
    if (buffer)
    {
      buffer.push(samples);
    }
  }

  /**
   * Process audio output
   */
  private processAudio(event: AudioProcessingEvent): void
  {
    const left = event.outputBuffer.getChannelData(0);
    const right = event.outputBuffer.getChannelData(1);

    // Clear buffers
    left.fill(0);
    right.fill(0);

    // Mix all channels
    for (let ch = 0; ch < AUDIO_CHANNELS; ch++)
    {
      const channel = this.audio.getChannel(ch);
      if (!channel || !channel.reserved) continue;

      const buffers = this.channelBuffers.get(ch);
      if (!buffers || buffers.length === 0) continue;

      const samples = buffers.shift()!;
      const isStereo = channel.format === AudioFormat.Stereo;
      const leftVol = channel.leftVolume / 0x8000;
      const rightVol = channel.rightVolume / 0x8000;

      if (isStereo)
      {
        for (let i = 0; i < left.length && i * 2 + 1 < samples.length; i++)
        {
          left[i] += samples[i * 2] * leftVol;
          right[i] += samples[i * 2 + 1] * rightVol;
        }
      }
      else
      {
        for (let i = 0; i < left.length && i < samples.length; i++)
        {
          const sample = samples[i];
          left[i] += sample * leftVol;
          right[i] += sample * rightVol;
        }
      }
    }

    // Apply master volume
    const masterVol = this.audio.masterVolume / 0x8000;
    for (let i = 0; i < left.length; i++)
    {
      left[i] = Math.max(-1, Math.min(1, left[i] * masterVol));
      right[i] = Math.max(-1, Math.min(1, right[i] * masterVol));
    }
  }

  // ---- Control ----

  /**
   * Resume audio context (required after user interaction)
   */
  async resume(): Promise<void>
  {
    if (this.audioContext?.state === 'suspended')
    {
      await this.audioContext.resume();
    }
  }

  /**
   * Suspend audio context
   */
  async suspend(): Promise<void>
  {
    if (this.audioContext?.state === 'running')
    {
      await this.audioContext.suspend();
    }
  }

  /**
   * Set master volume (0-1)
   */
  setVolume(volume: number): void
  {
    if (this.gainNode)
    {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Clear all audio buffers
   */
  clearBuffers(): void
  {
    for (const buffer of this.channelBuffers.values())
    {
      buffer.length = 0;
    }
  }

  /**
   * Destroy audio context
   */
  destroy(): void
  {
    if (this.scriptNode)
    {
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }

    if (this.audioContext)
    {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.gainNode = null;
    this.clearBuffers();
  }
}
