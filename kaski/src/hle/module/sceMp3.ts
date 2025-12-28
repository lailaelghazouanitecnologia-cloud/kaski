/**
 * sceMp3
 *
 * MP3 decoder module.
 * Handles MP3 audio decoding.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * MP3 handle info
 */
interface Mp3Handle
{
  id: number;
  inUse: boolean;
  mp3Buf: number;
  mp3BufSize: number;
  pcmBuf: number;
  pcmBufSize: number;
  sampleRate: number;
  channels: number;
  sumDecodedSamples: number;
  loopNum: number;
}

const MAX_MP3_HANDLES = 2;

function createMp3Handle(id: number): Mp3Handle
{
  return {
    id,
    inUse: false,
    mp3Buf: 0,
    mp3BufSize: 0,
    pcmBuf: 0,
    pcmBufSize: 0,
    sampleRate: 44100,
    channels: 2,
    sumDecodedSamples: 0,
    loopNum: 0,
  };
}

@hleModule('sceMp3')
export class sceMp3
{
  readonly name = 'sceMp3';

  private ctx!: EmulatorContext;

  // MP3 handles
  private handles: Mp3Handle[] = [];

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
    this.handles = [];
    for (let i = 0; i < MAX_MP3_HANDLES; i++)
    {
      this.handles.push(createMp3Handle(i));
    }
  }

  private getHandle(id: number): Mp3Handle | null
  {
    if (id < 0 || id >= MAX_MP3_HANDLES)
    {
      return null;
    }
    return this.handles[id];
  }

  /**
   * sceMp3InitResource
   * Initialize MP3 resources
   *
   * @returns 0 on success
   */
  @nativeFunction(0x35750070, 150)
  sceMp3InitResource(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceMp3TermResource
   * Terminate MP3 resources
   *
   * @returns 0 on success
   */
  @nativeFunction(0x3C2FA058, 150)
  sceMp3TermResource(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceMp3ReserveMp3Handle
   * Reserve an MP3 handle
   *
   * @param mp3InitPtr - MP3 init structure
   * @returns Handle ID or error
   */
  @nativeFunction(0x07EC321A, 150)
  sceMp3ReserveMp3Handle(): number
  {
    const mp3InitPtr = this.ctx.argPtr(0);

    // Find free handle
    for (const handle of this.handles)
    {
      if (!handle.inUse)
      {
        handle.inUse = true;

        // Read init structure
        if (mp3InitPtr)
        {
          handle.mp3Buf = this.ctx.read32(mp3InitPtr + 0);
          handle.mp3BufSize = this.ctx.read32(mp3InitPtr + 4);
          handle.pcmBuf = this.ctx.read32(mp3InitPtr + 8);
          handle.pcmBufSize = this.ctx.read32(mp3InitPtr + 12);
        }

        return handle.id;
      }
    }

    return SceKernelErrors.ERROR_BUSY;
  }

  /**
   * sceMp3ReleaseMp3Handle
   * Release an MP3 handle
   *
   * @param handle - Handle ID
   * @returns 0 on success
   */
  @nativeFunction(0xF5478233, 150)
  sceMp3ReleaseMp3Handle(): number
  {
    const handleId = this.ctx.arg(0);

    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }

    Object.assign(handle, createMp3Handle(handleId));

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceMp3Init
   * Initialize MP3 decoding
   *
   * @param handle - Handle ID
   * @returns 0 on success
   */
  @nativeFunction(0x44E07129, 150)
  sceMp3Init(): number
  {
    const handleId = this.ctx.arg(0);

    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }

    handle.sumDecodedSamples = 0;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceMp3Decode
   * Decode MP3 data
   *
   * @param handle - Handle ID
   * @param outPcmPtr - Output PCM pointer
   * @returns Number of bytes decoded or error
   */
  @nativeFunction(0xD021C0FB, 150)
  sceMp3Decode(): number
  {
    const handleId = this.ctx.arg(0);
    const outPcmPtr = this.ctx.argPtr(1);

    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }

    // Stub: Write PCM buffer address to output
    if (outPcmPtr)
    {
      this.ctx.write32(outPcmPtr, handle.pcmBuf);
    }

    // Return 0 bytes decoded (EOF)
    return 0;
  }

  /**
   * sceMp3GetInfoToAddStreamData
   * Get info to add stream data
   *
   * @param handle - Handle ID
   * @param dstPtr - Output destination pointer
   * @param toWritePtr - Output bytes to write
   * @param srcPosPtr - Output source position
   * @returns 0 on success
   */
  @nativeFunction(0x732B042A, 150)
  sceMp3GetInfoToAddStreamData(): number
  {
    const handleId = this.ctx.arg(0);
    const dstPtr = this.ctx.argPtr(1);
    const toWritePtr = this.ctx.argPtr(2);
    const srcPosPtr = this.ctx.argPtr(3);

    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }

    if (dstPtr)
    {
      this.ctx.write32(dstPtr, handle.mp3Buf);
    }
    if (toWritePtr)
    {
      this.ctx.write32(toWritePtr, 0);
    }
    if (srcPosPtr)
    {
      this.ctx.write32(srcPosPtr, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceMp3NotifyAddStreamData
   * Notify stream data added
   *
   * @param handle - Handle ID
   * @param size - Bytes added
   * @returns 0 on success
   */
  @nativeFunction(0x87677E40, 150)
  sceMp3NotifyAddStreamData(): number
  {
    const handleId = this.ctx.arg(0);
    const size = this.ctx.arg(1);

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceMp3CheckStreamDataNeeded
   * Check if stream data is needed
   *
   * @param handle - Handle ID
   * @returns 1 if data needed, 0 if not
   */
  @nativeFunction(0xA703FE0F, 150)
  sceMp3CheckStreamDataNeeded(): number
  {
    const handleId = this.ctx.arg(0);

    // Never need more data (stub)
    return 0;
  }

  /**
   * sceMp3SetLoopNum
   * Set loop count
   *
   * @param handle - Handle ID
   * @param loopNum - Loop count (-1 = infinite)
   * @returns 0 on success
   */
  @nativeFunction(0xD8F54A51, 150)
  sceMp3SetLoopNum(): number
  {
    const handleId = this.ctx.arg(0);
    const loopNum = this.ctx.arg(1);

    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }

    handle.loopNum = loopNum;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceMp3GetLoopNum
   * Get loop count
   *
   * @param handle - Handle ID
   * @returns Loop count
   */
  @nativeFunction(0x3548AEC8, 150)
  sceMp3GetLoopNum(): number
  {
    const handleId = this.ctx.arg(0);

    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }

    return handle.loopNum;
  }

  /**
   * sceMp3GetSamplingRate
   * Get sampling rate
   *
   * @param handle - Handle ID
   * @returns Sample rate in Hz
   */
  @nativeFunction(0x8F450998, 150)
  sceMp3GetSamplingRate(): number
  {
    const handleId = this.ctx.arg(0);

    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }

    return handle.sampleRate;
  }

  /**
   * sceMp3GetBitRate
   * Get bit rate
   *
   * @param handle - Handle ID
   * @returns Bit rate in kbps
   */
  @nativeFunction(0x7F696782, 150)
  sceMp3GetBitRate(): number
  {
    const handleId = this.ctx.arg(0);

    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }

    return 128; // Default 128kbps
  }

  /**
   * sceMp3GetMp3ChannelNum
   * Get number of channels
   *
   * @param handle - Handle ID
   * @returns Number of channels
   */
  @nativeFunction(0x87C263D1, 150)
  sceMp3GetMp3ChannelNum(): number
  {
    const handleId = this.ctx.arg(0);

    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }

    return handle.channels;
  }

  /**
   * sceMp3GetSumDecodedSample
   * Get total decoded samples
   *
   * @param handle - Handle ID
   * @returns Total samples decoded
   */
  @nativeFunction(0x8AB81558, 150)
  sceMp3GetSumDecodedSample(): number
  {
    const handleId = this.ctx.arg(0);

    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }

    return handle.sumDecodedSamples;
  }

  /**
   * sceMp3GetMaxOutputSample
   * Get max output samples
   *
   * @param handle - Handle ID
   * @returns Max samples per decode
   */
  @nativeFunction(0x3CEF484F, 150)
  sceMp3GetMaxOutputSample(): number
  {
    const handleId = this.ctx.arg(0);

    // Return typical MP3 frame size
    return 1152;
  }

  /**
   * sceMp3ResetPlayPosition
   * Reset play position
   *
   * @param handle - Handle ID
   * @returns 0 on success
   */
  @nativeFunction(0x2A368661, 150)
  sceMp3ResetPlayPosition(): number
  {
    const handleId = this.ctx.arg(0);

    const handle = this.getHandle(handleId);
    if (!handle || !handle.inUse)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }

    handle.sumDecodedSamples = 0;

    return SceKernelErrors.ERROR_OK;
  }
}
