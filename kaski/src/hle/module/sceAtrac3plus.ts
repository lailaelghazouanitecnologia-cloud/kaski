/**
 * sceAtrac3plus
 *
 * ATRAC3/ATRAC3+ audio codec module.
 * Handles streaming and decoding of Sony's proprietary audio format.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * Codec types
 */
export const enum AtracCodecType
{
  AT3Plus = 0x00001000,
  AT3 = 0x00001001,
}

/**
 * Maximum number of ATRAC IDs
 */
const MAX_ATRAC_IDS = 6;

/**
 * Frame samples per codec
 */
const ATRAC3P_FRAME_SAMPLES = 2048; // 16 subbands * 128 samples
const ATRAC3_FRAME_SAMPLES = 1024;

/**
 * ATRAC instance state
 */
interface AtracInstance
{
  id: number;
  inUse: boolean;
  codecType: AtracCodecType;

  // Buffer info
  dataPtr: number;
  bufferSize: number;

  // Stream info
  channels: number;
  sampleRate: number;
  bitrate: number;
  bytesPerFrame: number;

  // Playback state
  currentSample: number;
  endSample: number;
  loopStartSample: number;
  loopEndSample: number;
  numLoops: number;

  // Decode state
  readOffset: number;
  dataSize: number;

  // Second buffer
  secondBufferNeeded: boolean;
  secondBufferSet: boolean;
  secondBufferPtr: number;
  secondBufferSize: number;
}

/**
 * Create a default ATRAC instance
 */
function createAtracInstance(id: number): AtracInstance
{
  return {
    id,
    inUse: false,
    codecType: AtracCodecType.AT3Plus,
    dataPtr: 0,
    bufferSize: 0,
    channels: 2,
    sampleRate: 44100,
    bitrate: 128,
    bytesPerFrame: 2048,
    currentSample: 0,
    endSample: 0,
    loopStartSample: -1,
    loopEndSample: -1,
    numLoops: 0,
    readOffset: 0,
    dataSize: 0,
    secondBufferNeeded: false,
    secondBufferSet: false,
    secondBufferPtr: 0,
    secondBufferSize: 0,
  };
}

@hleModule('sceAtrac3plus')
export class sceAtrac3plus
{
  readonly name = 'sceAtrac3plus';

  private ctx!: EmulatorContext;

  // ATRAC instances
  private instances: AtracInstance[] = [];

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;

    // Initialize instances
    this.instances = [];
    for (let i = 0; i < MAX_ATRAC_IDS; i++)
    {
      this.instances.push(createAtracInstance(i));
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  private getMaxSamples(codecType: AtracCodecType): number
  {
    switch (codecType)
    {
      case AtracCodecType.AT3:
        return ATRAC3_FRAME_SAMPLES;
      case AtracCodecType.AT3Plus:
        return ATRAC3P_FRAME_SAMPLES;
      default:
        return 0;
    }
  }

  private getInstance(id: number): AtracInstance | null
  {
    if (id < 0 || id >= MAX_ATRAC_IDS)
    {
      return null;
    }
    return this.instances[id];
  }

  private findFreeInstance(): AtracInstance | null
  {
    for (const inst of this.instances)
    {
      if (!inst.inUse)
      {
        return inst;
      }
    }
    return null;
  }

  private parseRiffHeader(dataPtr: number, bufferSize: number, inst: AtracInstance): number
  {
    // Parse RIFF/WAVE header to extract codec info
    // RIFF header: 'RIFF' + size + 'WAVE'
    const riff = this.ctx.read32(dataPtr);
    if (riff !== 0x46464952) // 'RIFF'
    {
      return SceKernelErrors.ERROR_ATRAC_UNKNOWN_FORMAT;
    }

    const wave = this.ctx.read32(dataPtr + 8);
    if (wave !== 0x45564157) // 'WAVE'
    {
      return SceKernelErrors.ERROR_ATRAC_UNKNOWN_FORMAT;
    }

    // Find fmt chunk
    let offset = 12;
    while (offset < bufferSize - 8)
    {
      const chunkId = this.ctx.read32(dataPtr + offset);
      const chunkSize = this.ctx.read32(dataPtr + offset + 4);

      if (chunkId === 0x20746D66) // 'fmt '
      {
        const format = this.ctx.read16(dataPtr + offset + 8);
        inst.channels = this.ctx.read16(dataPtr + offset + 10);
        inst.sampleRate = this.ctx.read32(dataPtr + offset + 12);
        inst.bitrate = Math.floor(this.ctx.read32(dataPtr + offset + 16) * 8 / 1000);

        // Determine codec type
        if (format === 0xFFFE)
        {
          inst.codecType = AtracCodecType.AT3Plus;
        }
        else if (format === 0x0270)
        {
          inst.codecType = AtracCodecType.AT3;
        }
      }
      else if (chunkId === 0x61746164) // 'data'
      {
        inst.dataSize = chunkSize;
        inst.readOffset = offset + 8;
        break;
      }

      offset += 8 + chunkSize;
      // Align to word boundary
      if (chunkSize & 1)
      {
        offset++;
      }
    }

    // Estimate end sample from data size
    if (inst.bytesPerFrame > 0)
    {
      const frameCount = Math.floor(inst.dataSize / inst.bytesPerFrame);
      inst.endSample = frameCount * this.getMaxSamples(inst.codecType);
    }

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // ID Management
  // ============================================

  /**
   * sceAtracGetAtracID
   * Get an ATRAC ID for the specified codec type
   *
   * @param codecType - Codec type (AT3 or AT3Plus)
   * @returns ATRAC ID or error
   */
  @nativeFunction(0x780F88D1, 150)
  sceAtracGetAtracID(): number
  {
    const codecType = this.ctx.arg(0) as AtracCodecType;

    if (codecType !== AtracCodecType.AT3 && codecType !== AtracCodecType.AT3Plus)
    {
      return SceKernelErrors.ERROR_ATRAC_INVALID_CODECTYPE;
    }

    const inst = this.findFreeInstance();
    if (!inst)
    {
      return SceKernelErrors.ERROR_ATRAC_NO_ID;
    }

    inst.inUse = true;
    inst.codecType = codecType;

    return inst.id;
  }

  /**
   * sceAtracReleaseAtracID
   * Release an ATRAC ID
   *
   * @param atID - ATRAC ID
   * @returns 0 on success
   */
  @nativeFunction(0x61EB33F5, 150)
  sceAtracReleaseAtracID(): number
  {
    const atID = this.ctx.arg(0);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    // Reset instance
    Object.assign(inst, createAtracInstance(atID));

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Data Setup
  // ============================================

  /**
   * sceAtracSetDataAndGetID
   * Set ATRAC data and get an ID
   *
   * @param dataPtr - Pointer to ATRAC data
   * @param bufferSize - Buffer size
   * @returns ATRAC ID or error
   */
  @nativeFunction(0x7A20E7AF, 150)
  sceAtracSetDataAndGetID(): number
  {
    const dataPtr = this.ctx.argPtr(0);
    const bufferSize = this.ctx.arg(1);

    const inst = this.findFreeInstance();
    if (!inst)
    {
      return SceKernelErrors.ERROR_ATRAC_NO_ID;
    }

    inst.inUse = true;
    inst.dataPtr = dataPtr;
    inst.bufferSize = bufferSize;

    const result = this.parseRiffHeader(dataPtr, bufferSize, inst);
    if (result < 0)
    {
      inst.inUse = false;
      return result;
    }

    this.ctx.log(`sceAtracSetDataAndGetID: id=${inst.id}, channels=${inst.channels}, rate=${inst.sampleRate}`);

    return inst.id;
  }

  /**
   * sceAtracSetData
   * Set ATRAC data for an existing ID
   *
   * @param atID - ATRAC ID
   * @param dataPtr - Pointer to ATRAC data
   * @param bufferSize - Buffer size
   * @returns 0 on success
   */
  @nativeFunction(0x0E2A73AB, 150)
  sceAtracSetData(): number
  {
    const atID = this.ctx.arg(0);
    const dataPtr = this.ctx.argPtr(1);
    const bufferSize = this.ctx.arg(2);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    inst.dataPtr = dataPtr;
    inst.bufferSize = bufferSize;

    return this.parseRiffHeader(dataPtr, bufferSize, inst);
  }

  /**
   * sceAtracSetHalfwayBuffer
   * Set data with a partial buffer
   *
   * @param atID - ATRAC ID
   * @param dataPtr - Pointer to ATRAC data
   * @param readSize - Bytes read so far
   * @param bufferSize - Total buffer size
   * @returns 0 on success
   */
  @nativeFunction(0x3F6E26B5, 150)
  sceAtracSetHalfwayBuffer(): number
  {
    const atID = this.ctx.arg(0);
    const dataPtr = this.ctx.argPtr(1);
    const readSize = this.ctx.arg(2);
    const bufferSize = this.ctx.arg(3);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    inst.dataPtr = dataPtr;
    inst.bufferSize = bufferSize;

    return this.parseRiffHeader(dataPtr, readSize, inst);
  }

  /**
   * sceAtracSetHalfwayBufferAndGetID
   * Set data with partial buffer and get ID
   */
  @nativeFunction(0x0FAE370E, 150)
  sceAtracSetHalfwayBufferAndGetID(): number
  {
    const dataPtr = this.ctx.argPtr(0);
    const readSize = this.ctx.arg(1);
    const bufferSize = this.ctx.arg(2);

    const inst = this.findFreeInstance();
    if (!inst)
    {
      return SceKernelErrors.ERROR_ATRAC_NO_ID;
    }

    inst.inUse = true;
    inst.dataPtr = dataPtr;
    inst.bufferSize = bufferSize;

    const result = this.parseRiffHeader(dataPtr, readSize, inst);
    if (result < 0)
    {
      inst.inUse = false;
      return result;
    }

    return inst.id;
  }

  // ============================================
  // Decoding
  // ============================================

  /**
   * sceAtracDecodeData
   * Decode ATRAC data
   *
   * @param atID - ATRAC ID
   * @param samplesPtr - Output sample buffer
   * @param samplesNbrPtr - Output number of samples decoded
   * @param outEndPtr - Output end flag
   * @param remainFramesPtr - Output remaining frames
   * @returns 0 on success
   */
  @nativeFunction(0x6A8C3CD5, 150)
  sceAtracDecodeData(): number | Promise<number>
  {
    const atID = this.ctx.arg(0);
    const samplesPtr = this.ctx.argPtr(1);
    const samplesNbrPtr = this.ctx.argPtr(2);
    const outEndPtr = this.ctx.argPtr(3);
    const remainFramesPtr = this.ctx.argPtr(4);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    // Check if second buffer is needed but not set
    if (inst.secondBufferNeeded && !inst.secondBufferSet)
    {
      return SceKernelErrors.ERROR_ATRAC_SECOND_BUFFER_NEEDED;
    }

    const maxSamples = this.getMaxSamples(inst.codecType);
    const remainingSamples = inst.endSample - inst.currentSample;
    const samplesToOutput = Math.min(maxSamples, remainingSamples);

    // Output silence (stub - no actual decoding)
    // In a full implementation, we'd decode the ATRAC data here
    for (let i = 0; i < samplesToOutput * inst.channels; i++)
    {
      this.ctx.write16(samplesPtr + i * 2, 0);
    }

    // Update state
    inst.currentSample += samplesToOutput;

    // Calculate remaining frames
    const remainFrames = inst.bytesPerFrame > 0
      ? Math.floor((inst.dataSize - inst.readOffset) / inst.bytesPerFrame)
      : 0;

    // Output results
    if (samplesNbrPtr)
    {
      this.ctx.write32(samplesNbrPtr, samplesToOutput);
    }

    if (outEndPtr)
    {
      this.ctx.write32(outEndPtr, inst.currentSample >= inst.endSample ? 1 : 0);
    }

    if (remainFramesPtr)
    {
      this.ctx.write32(remainFramesPtr, remainFrames);
    }

    // Simulate decode time
    return new Promise(resolve =>
    {
      setTimeout(() => resolve(SceKernelErrors.ERROR_OK), 2);
    });
  }

  // ============================================
  // Stream Info
  // ============================================

  /**
   * sceAtracGetRemainFrame
   * Get remaining frames
   */
  @nativeFunction(0x9AE849A7, 150)
  sceAtracGetRemainFrame(): number
  {
    const atID = this.ctx.arg(0);
    const remainFramePtr = this.ctx.argPtr(1);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    const remainFrames = inst.bytesPerFrame > 0
      ? Math.floor((inst.dataSize - inst.readOffset) / inst.bytesPerFrame)
      : -1;

    if (remainFramePtr)
    {
      this.ctx.write32(remainFramePtr, remainFrames);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceAtracGetStreamDataInfo
   * Get stream data info for adding more data
   */
  @nativeFunction(0x5D268707, 150)
  sceAtracGetStreamDataInfo(): number
  {
    const atID = this.ctx.arg(0);
    const writePointerPtr = this.ctx.argPtr(1);
    const availableBytesPtr = this.ctx.argPtr(2);
    const readOffsetPtr = this.ctx.argPtr(3);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    // Stub: indicate no more data needed
    if (writePointerPtr)
    {
      this.ctx.write32(writePointerPtr, inst.dataPtr + inst.readOffset);
    }
    if (availableBytesPtr)
    {
      this.ctx.write32(availableBytesPtr, 0);
    }
    if (readOffsetPtr)
    {
      this.ctx.write32(readOffsetPtr, inst.readOffset);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceAtracAddStreamData
   * Add streaming data
   */
  @nativeFunction(0x7DB31251, 150)
  sceAtracAddStreamData(): number
  {
    const atID = this.ctx.arg(0);
    const bytesToAdd = this.ctx.arg(1);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    // Stub: accept but ignore
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceAtracGetNextDecodePosition
   * Get next decode position in samples
   */
  @nativeFunction(0xE23E3A35, 150)
  sceAtracGetNextDecodePosition(): number
  {
    const atID = this.ctx.arg(0);
    const samplePositionPtr = this.ctx.argPtr(1);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    if (inst.currentSample >= inst.endSample)
    {
      return SceKernelErrors.ERROR_ATRAC_ALL_DATA_DECODED;
    }

    if (samplePositionPtr)
    {
      this.ctx.write32(samplePositionPtr, inst.currentSample);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceAtracGetSoundSample
   * Get sample info (end, loop start, loop end)
   */
  @nativeFunction(0xA2BBA8BE, 150)
  sceAtracGetSoundSample(): number
  {
    const atID = this.ctx.arg(0);
    const endSamplePtr = this.ctx.argPtr(1);
    const loopStartSamplePtr = this.ctx.argPtr(2);
    const loopEndSamplePtr = this.ctx.argPtr(3);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    if (endSamplePtr)
    {
      this.ctx.write32(endSamplePtr, inst.endSample);
    }
    if (loopStartSamplePtr)
    {
      this.ctx.write32(loopStartSamplePtr, inst.loopStartSample);
    }
    if (loopEndSamplePtr)
    {
      this.ctx.write32(loopEndSamplePtr, inst.loopEndSample);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceAtracGetBitrate
   * Get bitrate in kbps
   */
  @nativeFunction(0xA554A158, 150)
  sceAtracGetBitrate(): number
  {
    const atID = this.ctx.arg(0);
    const bitratePtr = this.ctx.argPtr(1);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    if (bitratePtr)
    {
      this.ctx.write32(bitratePtr, inst.bitrate);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceAtracGetChannel
   * Get number of channels
   */
  @nativeFunction(0x31668BAA, 150)
  sceAtracGetChannel(): number
  {
    const atID = this.ctx.arg(0);
    const channelsPtr = this.ctx.argPtr(1);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    if (channelsPtr)
    {
      this.ctx.write32(channelsPtr, inst.channels);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceAtracGetMaxSample
   * Get maximum samples per frame
   */
  @nativeFunction(0xD6A5F2F7, 150)
  sceAtracGetMaxSample(): number
  {
    const atID = this.ctx.arg(0);
    const maxSamplesPtr = this.ctx.argPtr(1);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    if (maxSamplesPtr)
    {
      this.ctx.write32(maxSamplesPtr, this.getMaxSamples(inst.codecType));
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceAtracGetNextSample
   * Get samples in next frame
   */
  @nativeFunction(0x36FAABFB, 150)
  sceAtracGetNextSample(): number
  {
    const atID = this.ctx.arg(0);
    const nextSamplesPtr = this.ctx.argPtr(1);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    const maxSamples = this.getMaxSamples(inst.codecType);
    const remaining = inst.endSample - inst.currentSample;
    const nextSamples = Math.min(maxSamples, remaining);

    if (nextSamplesPtr)
    {
      this.ctx.write32(nextSamplesPtr, nextSamples);
    }

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Loop Control
  // ============================================

  /**
   * sceAtracSetLoopNum
   * Set number of loops
   */
  @nativeFunction(0x868120B5, 150)
  sceAtracSetLoopNum(): number
  {
    const atID = this.ctx.arg(0);
    const numLoops = this.ctx.arg(1);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    inst.numLoops = numLoops;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceAtracGetLoopStatus
   * Get loop status
   */
  @nativeFunction(0xFAA4F89B, 150)
  sceAtracGetLoopStatus(): number
  {
    const atID = this.ctx.arg(0);
    const loopNumPtr = this.ctx.argPtr(1);
    const statusPtr = this.ctx.argPtr(2);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    if (loopNumPtr)
    {
      this.ctx.write32(loopNumPtr, inst.numLoops);
    }
    if (statusPtr)
    {
      this.ctx.write32(statusPtr, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Second Buffer
  // ============================================

  /**
   * sceAtracGetSecondBufferInfo
   * Get second buffer info
   */
  @nativeFunction(0x83E85EA0, 150)
  sceAtracGetSecondBufferInfo(): number
  {
    const atID = this.ctx.arg(0);
    const positionPtr = this.ctx.argPtr(1);
    const dataBytesPtr = this.ctx.argPtr(2);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    if (!inst.secondBufferNeeded)
    {
      if (positionPtr)
      {
        this.ctx.write32(positionPtr, 0);
      }
      if (dataBytesPtr)
      {
        this.ctx.write32(dataBytesPtr, 0);
      }
      return SceKernelErrors.ERROR_ATRAC_SECOND_BUFFER_NOT_NEEDED;
    }

    if (positionPtr)
    {
      this.ctx.write32(positionPtr, inst.secondBufferPtr);
    }
    if (dataBytesPtr)
    {
      this.ctx.write32(dataBytesPtr, inst.secondBufferSize);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceAtracSetSecondBuffer
   * Set second buffer
   */
  @nativeFunction(0x83BF7AFD, 150)
  sceAtracSetSecondBuffer(): number
  {
    const atID = this.ctx.arg(0);
    const bufferPtr = this.ctx.argPtr(1);
    const bufferSize = this.ctx.arg(2);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    inst.secondBufferPtr = bufferPtr;
    inst.secondBufferSize = bufferSize;
    inst.secondBufferSet = true;

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Reset/Position
  // ============================================

  /**
   * sceAtracGetBufferInfoForReseting
   * Get buffer info for resetting position
   */
  @nativeFunction(0xCA3CA3D2, 150)
  sceAtracGetBufferInfoForReseting(): number
  {
    const atID = this.ctx.arg(0);
    const sample = this.ctx.arg(1);
    const bufferInfoPtr = this.ctx.argPtr(2);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    // Stub: return zeros
    if (bufferInfoPtr)
    {
      for (let i = 0; i < 8; i++)
      {
        this.ctx.write32(bufferInfoPtr + i * 4, 0);
      }
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceAtracResetPlayPosition
   * Reset play position
   */
  @nativeFunction(0x644E5607, 150)
  sceAtracResetPlayPosition(): number
  {
    const atID = this.ctx.arg(0);
    const sample = this.ctx.arg(1);
    const writeByteFirstBuf = this.ctx.arg(2);
    const writeByteSecondBuf = this.ctx.arg(3);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    inst.currentSample = sample;

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Output Channel
  // ============================================

  /**
   * sceAtracGetOutputChannel
   * Get output audio channel
   */
  @nativeFunction(0xB3B5D042, 150)
  sceAtracGetOutputChannel(): number
  {
    const atID = this.ctx.arg(0);
    const outputChannelPtr = this.ctx.argPtr(1);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    // Reserve an audio channel
    const channel = this.ctx.audioManager.reserveChannel(
      -1,
      this.getMaxSamples(inst.codecType),
      0 // Stereo
    );

    if (outputChannelPtr)
    {
      this.ctx.write32(outputChannelPtr, channel);
    }

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Error Info
  // ============================================

  /**
   * sceAtracGetInternalErrorInfo
   * Get internal error info
   */
  @nativeFunction(0xE88F759B, 150)
  sceAtracGetInternalErrorInfo(): number
  {
    const atID = this.ctx.arg(0);
    const errorResultPtr = this.ctx.argPtr(1);

    const inst = this.getInstance(atID);
    if (!inst || !inst.inUse)
    {
      return SceKernelErrors.ERROR_ATRAC_BAD_ID;
    }

    if (errorResultPtr)
    {
      this.ctx.write32(errorResultPtr, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }
}
