/**
 * sceSasCore
 *
 * Software Audio Synthesizer (SAS) module.
 * Handles PSP sound synthesis for games.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * SAS constants
 */
const PSP_SAS_VOICES_MAX = 32;
const PSP_SAS_VOL_MAX = 0x1000;
const PSP_SAS_PITCH_MIN = 0x1;
const PSP_SAS_PITCH_BASE = 0x1000;
const PSP_SAS_PITCH_MAX = 0x4000;

/**
 * Output modes
 */
export const enum SasOutputMode
{
  Stereo = 0,
  Multichannel = 1,
}

/**
 * Waveform effect types
 */
export const enum SasEffectType
{
  Off = -1,
  Room = 0,
  Hall = 4,
  Space = 5,
  Echo = 6,
  Delay = 7,
  Pipe = 8,
}

/**
 * Voice state
 */
interface SasVoice
{
  on: boolean;
  paused: boolean;
  pitch: number;
  leftVolume: number;
  rightVolume: number;
  effectLeftVolume: number;
  effectRightVolume: number;
  sustainLevel: number;
  envelope: {
    attackRate: number;
    decayRate: number;
    sustainRate: number;
    releaseRate: number;
    height: number;
  };
}

function createVoice(): SasVoice
{
  return {
    on: false,
    paused: false,
    pitch: PSP_SAS_PITCH_BASE,
    leftVolume: PSP_SAS_VOL_MAX,
    rightVolume: PSP_SAS_VOL_MAX,
    effectLeftVolume: PSP_SAS_VOL_MAX,
    effectRightVolume: PSP_SAS_VOL_MAX,
    sustainLevel: 0,
    envelope: {
      attackRate: 0,
      decayRate: 0,
      sustainRate: 0,
      releaseRate: 0,
      height: 0,
    },
  };
}

@hleModule('sceSasCore')
export class sceSasCore
{
  readonly name = 'sceSasCore';

  private ctx!: EmulatorContext;

  // SAS core state
  private initialized = false;
  private grainSamples = 256;
  private maxVoices = 32;
  private outputMode: SasOutputMode = SasOutputMode.Stereo;
  private sampleRate = 44100;

  // Effect settings
  private effectType: SasEffectType = SasEffectType.Off;
  private effectIsDry = false;
  private effectIsWet = false;
  private effectLeftVolume = PSP_SAS_VOL_MAX;
  private effectRightVolume = PSP_SAS_VOL_MAX;
  private delay = 0;
  private feedback = 0;

  // Voices
  private voices: SasVoice[] = [];

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
    this.voices = [];
    for (let i = 0; i < PSP_SAS_VOICES_MAX; i++)
    {
      this.voices.push(createVoice());
    }
  }

  // ============================================
  // Initialization
  // ============================================

  /**
   * __sceSasInit
   * Initialize SAS core
   */
  @nativeFunction(0x42778A9F, 150)
  __sceSasInit(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const grainSamples = this.ctx.arg(1);
    const maxVoices = this.ctx.arg(2);
    const outputMode = this.ctx.arg(3);
    const sampleRate = this.ctx.arg(4);

    if (sampleRate !== 44100)
    {
      return SceKernelErrors.ERROR_SAS_INVALID_SAMPLE_RATE;
    }

    if (maxVoices < 1 || maxVoices > PSP_SAS_VOICES_MAX)
    {
      return SceKernelErrors.ERROR_SAS_INVALID_MAX_VOICES;
    }

    if (outputMode !== SasOutputMode.Stereo && outputMode !== SasOutputMode.Multichannel)
    {
      return SceKernelErrors.ERROR_SAS_INVALID_OUTPUT_MODE;
    }

    this.grainSamples = grainSamples;
    this.maxVoices = maxVoices;
    this.outputMode = outputMode;
    this.sampleRate = sampleRate;
    this.initialized = true;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * __sceSasSetGrain
   * Set grain samples
   */
  @nativeFunction(0xD1E0A01E, 150)
  __sceSasSetGrain(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const grainSamples = this.ctx.arg(1);

    this.grainSamples = grainSamples;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * __sceSasSetOutputmode
   * Set output mode
   */
  @nativeFunction(0xE855BF76, 150)
  __sceSasSetOutputmode(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const outputMode = this.ctx.arg(1);

    this.outputMode = outputMode;

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Core Mixing
  // ============================================

  /**
   * __sceSasCore
   * Mix audio without volume control
   */
  @nativeFunction(0xA3589D81, 150)
  __sceSasCore(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const sasOutPtr = this.ctx.argPtr(1);

    return this.mixAudio(sasOutPtr, PSP_SAS_VOL_MAX, PSP_SAS_VOL_MAX);
  }

  /**
   * __sceSasCoreWithMix
   * Mix audio with volume control
   */
  @nativeFunction(0x50A14DFC, 150)
  __sceSasCoreWithMix(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const sasOutPtr = this.ctx.argPtr(1);
    const leftVol = this.ctx.arg(2);
    const rightVol = this.ctx.arg(3);

    return this.mixAudio(sasOutPtr, leftVol, rightVol);
  }

  private mixAudio(outPtr: number, leftVol: number, rightVol: number): number
  {
    // Output silence (stub implementation)
    const samples = this.grainSamples;
    const channels = this.outputMode === SasOutputMode.Stereo ? 2 : 1;

    for (let i = 0; i < samples * channels; i++)
    {
      this.ctx.write16(outPtr + i * 2, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * __sceSasGetEndFlag
   * Get voice end flags
   */
  @nativeFunction(0x68A46B95, 150)
  __sceSasGetEndFlag(): number
  {
    let flags = 0;
    for (let i = 0; i < this.voices.length; i++)
    {
      if (!this.voices[i].on)
      {
        flags |= (1 << i);
      }
    }
    return flags;
  }

  // ============================================
  // Voice Control
  // ============================================

  /**
   * __sceSasSetVoice
   * Set voice ADPCM data
   */
  @nativeFunction(0x99944089, 150)
  __sceSasSetVoice(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const voiceId = this.ctx.arg(1);
    const dataPtr = this.ctx.argPtr(2);
    const loop = this.ctx.arg(3);

    if (voiceId < 0 || voiceId >= PSP_SAS_VOICES_MAX)
    {
      return SceKernelErrors.ERROR_SAS_INVALID_VOICE;
    }

    // Accept but don't actually decode ADPCM
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * __sceSasSetVoicePCM
   * Set voice PCM data
   */
  @nativeFunction(0xE1CD9561, 150)
  __sceSasSetVoicePCM(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const voiceId = this.ctx.arg(1);
    const dataPtr = this.ctx.argPtr(2);
    const loop = this.ctx.arg(3);

    if (voiceId < 0 || voiceId >= PSP_SAS_VOICES_MAX)
    {
      return SceKernelErrors.ERROR_SAS_INVALID_VOICE;
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * __sceSasSetKeyOn
   * Turn voice on
   */
  @nativeFunction(0x76F01ACA, 150)
  __sceSasSetKeyOn(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const voiceId = this.ctx.arg(1);

    if (voiceId < 0 || voiceId >= PSP_SAS_VOICES_MAX)
    {
      return SceKernelErrors.ERROR_SAS_INVALID_VOICE;
    }

    this.voices[voiceId].on = true;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * __sceSasSetKeyOff
   * Turn voice off
   */
  @nativeFunction(0xA0CF2FA4, 150)
  __sceSasSetKeyOff(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const voiceId = this.ctx.arg(1);

    if (voiceId < 0 || voiceId >= PSP_SAS_VOICES_MAX)
    {
      return SceKernelErrors.ERROR_SAS_INVALID_VOICE;
    }

    this.voices[voiceId].on = false;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * __sceSasSetPause
   * Pause/unpause voices
   */
  @nativeFunction(0x787D04D5, 150)
  __sceSasSetPause(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const voiceBits = this.ctx.arg(1);
    const pause = this.ctx.arg(2) !== 0;

    for (let i = 0; i < PSP_SAS_VOICES_MAX; i++)
    {
      if (voiceBits & (1 << i))
      {
        this.voices[i].paused = pause;
      }
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * __sceSasGetPauseFlag
   * Get pause flags
   */
  @nativeFunction(0x2C8E6AB3, 150)
  __sceSasGetPauseFlag(): number
  {
    let flags = 0;
    for (let i = 0; i < this.voices.length; i++)
    {
      if (this.voices[i].paused)
      {
        flags |= (1 << i);
      }
    }
    return flags;
  }

  // ============================================
  // Volume and Pitch
  // ============================================

  /**
   * __sceSasSetVolume
   * Set voice volume
   */
  @nativeFunction(0x440CA7D8, 150)
  __sceSasSetVolume(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const voiceId = this.ctx.arg(1);
    const leftVol = this.ctx.arg(2);
    const rightVol = this.ctx.arg(3);
    const effectLeftVol = this.ctx.arg(4);
    const effectRightVol = this.ctx.arg(5);

    if (voiceId < 0 || voiceId >= PSP_SAS_VOICES_MAX)
    {
      return SceKernelErrors.ERROR_SAS_INVALID_VOICE;
    }

    const voice = this.voices[voiceId];
    voice.leftVolume = Math.abs(leftVol);
    voice.rightVolume = Math.abs(rightVol);
    voice.effectLeftVolume = Math.abs(effectLeftVol);
    voice.effectRightVolume = Math.abs(effectRightVol);

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * __sceSasSetPitch
   * Set voice pitch
   */
  @nativeFunction(0xAD84D37F, 150)
  __sceSasSetPitch(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const voiceId = this.ctx.arg(1);
    const pitch = this.ctx.arg(2);

    if (voiceId < 0 || voiceId >= PSP_SAS_VOICES_MAX)
    {
      return SceKernelErrors.ERROR_SAS_INVALID_VOICE;
    }

    if (pitch < PSP_SAS_PITCH_MIN || pitch > PSP_SAS_PITCH_MAX)
    {
      return SceKernelErrors.ERROR_SAS_INVALID_PITCH;
    }

    this.voices[voiceId].pitch = pitch;

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // ADSR Envelope
  // ============================================

  /**
   * __sceSasSetADSR
   * Set ADSR envelope
   */
  @nativeFunction(0x019B25EB, 150)
  __sceSasSetADSR(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const voiceId = this.ctx.arg(1);
    const flags = this.ctx.arg(2);
    const attackRate = this.ctx.arg(3);
    const decayRate = this.ctx.arg(4);
    const sustainRate = this.ctx.arg(5);
    const releaseRate = this.ctx.arg(6);

    if (voiceId < 0 || voiceId >= PSP_SAS_VOICES_MAX)
    {
      return SceKernelErrors.ERROR_SAS_INVALID_VOICE;
    }

    const voice = this.voices[voiceId];
    if (flags & 1) voice.envelope.attackRate = attackRate;
    if (flags & 2) voice.envelope.decayRate = decayRate;
    if (flags & 4) voice.envelope.sustainRate = sustainRate;
    if (flags & 8) voice.envelope.releaseRate = releaseRate;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * __sceSasSetADSRmode
   * Set ADSR curve modes
   */
  @nativeFunction(0x9EC3676A, 150)
  __sceSasSetADSRmode(): number
  {
    // Accept but ignore curve modes
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * __sceSasSetSL
   * Set sustain level
   */
  @nativeFunction(0x5F9529F6, 150)
  __sceSasSetSL(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const voiceId = this.ctx.arg(1);
    const sustainLevel = this.ctx.arg(2);

    if (voiceId < 0 || voiceId >= PSP_SAS_VOICES_MAX)
    {
      return SceKernelErrors.ERROR_SAS_INVALID_VOICE;
    }

    this.voices[voiceId].sustainLevel = sustainLevel;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * __sceSasSetSimpleADSR
   * Set simple ADSR
   */
  @nativeFunction(0xCBCD4F79, 150)
  __sceSasSetSimpleADSR(): number
  {
    // Accept but ignore
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * __sceSasGetEnvelopeHeight
   * Get envelope height
   */
  @nativeFunction(0x74AE582A, 150)
  __sceSasGetEnvelopeHeight(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const voiceId = this.ctx.arg(1);

    if (voiceId < 0 || voiceId >= PSP_SAS_VOICES_MAX)
    {
      return SceKernelErrors.ERROR_SAS_INVALID_VOICE;
    }

    return this.voices[voiceId].envelope.height;
  }

  /**
   * __sceSasGetAllEnvelopeHeights
   * Get all envelope heights
   */
  @nativeFunction(0x07F58C24, 150)
  __sceSasGetAllEnvelopeHeights(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const heightPtr = this.ctx.argPtr(1);

    for (let i = 0; i < this.voices.length; i++)
    {
      this.ctx.write32(heightPtr + i * 4, this.voices[i].envelope.height);
    }

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Effects
  // ============================================

  /**
   * __sceSasRevType
   * Set reverb type
   */
  @nativeFunction(0x33D4AB37, 150)
  __sceSasRevType(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const effectType = this.ctx.arg(1);

    this.effectType = effectType;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * __sceSasRevVON
   * Set reverb on/off
   */
  @nativeFunction(0xF983B186, 150)
  __sceSasRevVON(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const isDry = this.ctx.arg(1) !== 0;
    const isWet = this.ctx.arg(2) !== 0;

    this.effectIsDry = isDry;
    this.effectIsWet = isWet;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * __sceSasRevEVOL
   * Set reverb volume
   */
  @nativeFunction(0xD5A229C9, 150)
  __sceSasRevEVOL(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const leftVol = this.ctx.arg(1);
    const rightVol = this.ctx.arg(2);

    this.effectLeftVolume = leftVol;
    this.effectRightVolume = rightVol;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * __sceSasRevParam
   * Set reverb parameters
   */
  @nativeFunction(0x267A6DD2, 150)
  __sceSasRevParam(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const delay = this.ctx.arg(1);
    const feedback = this.ctx.arg(2);

    this.delay = delay;
    this.feedback = feedback;

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Noise
  // ============================================

  /**
   * __sceSasSetNoise
   * Set noise frequency
   */
  @nativeFunction(0xB7660A23, 150)
  __sceSasSetNoise(): number
  {
    const sasCorePtr = this.ctx.arg(0);
    const voiceId = this.ctx.arg(1);
    const noiseFreq = this.ctx.arg(2);

    if (noiseFreq < 0 || noiseFreq >= 64)
    {
      return SceKernelErrors.ERROR_SAS_INVALID_NOISE_FREQ;
    }

    if (voiceId < 0 || voiceId >= PSP_SAS_VOICES_MAX)
    {
      return SceKernelErrors.ERROR_SAS_INVALID_VOICE;
    }

    return SceKernelErrors.ERROR_OK;
  }
}
