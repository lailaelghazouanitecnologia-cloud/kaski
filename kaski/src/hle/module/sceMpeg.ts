/**
 * sceMpeg
 *
 * MPEG video decoder module.
 * Handles video playback for PMF/PSMF files.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * MPEG memory size
 */
const MPEG_MEMSIZE = 64 * 1024;

/**
 * Ring buffer packet size
 */
const RING_BUFFER_PACKET_SIZE = 0x800;

/**
 * Stream types
 */
export const enum MpegStreamType
{
  Avc = 0,
  Atrac = 1,
  Pcm = 2,
  Data = 3,
  Audio = 15,
}

@hleModule('sceMpeg')
export class sceMpeg
{
  readonly name = 'sceMpeg';

  private ctx!: EmulatorContext;

  // Track MPEG instances
  private mpegInstances: Set<number> = new Set();
  private nextStreamId = 1;
  private nextEsBuf = 1;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
    this.mpegInstances.clear();
    this.nextStreamId = 1;
    this.nextEsBuf = 1;
  }

  // ============================================
  // Initialization
  // ============================================

  /**
   * sceMpegInit
   * Initialize MPEG library
   *
   * @returns 0 on success, -1 if disabled
   */
  @nativeFunction(0x682A619B, 150)
  sceMpegInit(): number
  {
    // Return -1 to indicate MPEG is not available
    // This makes games skip video playback
    return -1;
  }

  /**
   * sceMpegFinish
   * Finish MPEG library
   *
   * @returns 0 on success
   */
  @nativeFunction(0x874624D6, 150)
  sceMpegFinish(): number
  {
    this.mpegInstances.clear();
    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // MPEG Creation
  // ============================================

  /**
   * sceMpegQueryMemSize
   * Query required memory size
   *
   * @param mode - Mode
   * @returns Memory size required
   */
  @nativeFunction(0xC132E22F, 150)
  sceMpegQueryMemSize(): number
  {
    return MPEG_MEMSIZE;
  }

  /**
   * sceMpegCreate
   * Create MPEG handle
   *
   * @param mpegAddr - MPEG structure address
   * @param dataPtr - Data buffer
   * @param size - Buffer size
   * @param ringbufferAddr - Ring buffer
   * @param mode - Mode
   * @param ddrTop - DDR top
   * @returns 0 on success
   */
  @nativeFunction(0xD8C5F121, 150)
  sceMpegCreate(): number
  {
    const mpegAddr = this.ctx.arg(0);
    const dataPtr = this.ctx.arg(1);
    const size = this.ctx.arg(2);

    if (size < MPEG_MEMSIZE)
    {
      return SceKernelErrors.ERROR_MPEG_NO_MEMORY;
    }

    // Write MPEG handle
    this.ctx.write32(mpegAddr, dataPtr + 0x30);

    // Write magic
    const handleAddr = dataPtr + 0x30;
    const magic = 'LIBMPEG\0001\0';
    for (let i = 0; i < magic.length; i++)
    {
      this.ctx.write8(handleAddr + i, magic.charCodeAt(i));
    }
    this.ctx.write32(handleAddr + 12, -1);

    this.mpegInstances.add(mpegAddr);

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceMpegDelete
   * Delete MPEG handle
   *
   * @param mpegAddr - MPEG address
   * @returns 0 on success
   */
  @nativeFunction(0x606A4649, 150)
  sceMpegDelete(): number
  {
    const mpegAddr = this.ctx.arg(0);
    this.mpegInstances.delete(mpegAddr);
    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Stream Query
  // ============================================

  /**
   * sceMpegQueryStreamOffset
   * Query stream offset in PSMF
   */
  @nativeFunction(0x21FF80E4, 150)
  sceMpegQueryStreamOffset(): number
  {
    const mpegAddr = this.ctx.arg(0);
    const bufferAddr = this.ctx.arg(1);
    const outputPtr = this.ctx.argPtr(2);

    // Read PSMF magic
    const magic = this.ctx.read32(bufferAddr);
    if (magic !== 0x464D5350) // 'PSMF'
    {
      return SceKernelErrors.ERROR_MPEG_INVALID_VALUE;
    }

    // Read offset from PSMF header
    const offset = this.ctx.read32(bufferAddr + 8);
    if (outputPtr)
    {
      this.ctx.write32(outputPtr, offset);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceMpegQueryStreamSize
   * Query stream size
   */
  @nativeFunction(0x611E9E11, 150)
  sceMpegQueryStreamSize(): number
  {
    const bufferAddr = this.ctx.arg(0);
    const outputPtr = this.ctx.argPtr(1);

    // Read size from PSMF header
    const size = this.ctx.read32(bufferAddr + 12);
    if (outputPtr)
    {
      this.ctx.write32(outputPtr, size);
    }

    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Ring Buffer
  // ============================================

  /**
   * sceMpegRingbufferQueryMemSize
   * Query ring buffer memory size
   */
  @nativeFunction(0xD7A29F46, 150)
  sceMpegRingbufferQueryMemSize(): number
  {
    const numPackets = this.ctx.arg(0);
    return (RING_BUFFER_PACKET_SIZE + 0x68) * numPackets;
  }

  /**
   * sceMpegRingbufferConstruct
   * Construct ring buffer
   */
  @nativeFunction(0x37295ED8, 150)
  sceMpegRingbufferConstruct(): number
  {
    const ringbufferAddr = this.ctx.argPtr(0);
    const numPackets = this.ctx.arg(1);
    const data = this.ctx.arg(2);
    const size = this.ctx.arg(3);
    const callbackAddr = this.ctx.arg(4);
    const callbackArg = this.ctx.arg(5);

    if (ringbufferAddr === 0)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ADDR;
    }

    // Initialize ring buffer structure
    this.ctx.write32(ringbufferAddr + 0, numPackets);      // packets
    this.ctx.write32(ringbufferAddr + 4, 0);               // packetsRead
    this.ctx.write32(ringbufferAddr + 8, 0);               // packetsWritten
    this.ctx.write32(ringbufferAddr + 12, 0);              // packetsAvail
    this.ctx.write32(ringbufferAddr + 16, 2048);           // packetSize
    this.ctx.write32(ringbufferAddr + 20, data);           // data
    this.ctx.write32(ringbufferAddr + 24, callbackAddr);   // callback_addr
    this.ctx.write32(ringbufferAddr + 28, callbackArg);    // callback_args
    this.ctx.write32(ringbufferAddr + 32, data + numPackets * 2048); // dataUpperBound
    this.ctx.write32(ringbufferAddr + 36, 0);              // semaID
    this.ctx.write32(ringbufferAddr + 40, 0);              // mpeg

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceMpegRingbufferDestruct
   * Destruct ring buffer
   */
  @nativeFunction(0x13407F13, 150)
  sceMpegRingbufferDestruct(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceMpegRingbufferAvailableSize
   * Get available ring buffer size
   */
  @nativeFunction(0xB5F6DC87, 150)
  sceMpegRingbufferAvailableSize(): number
  {
    const ringbufferAddr = this.ctx.argPtr(0);

    const packets = this.ctx.read32(ringbufferAddr + 0);
    const packetsAvail = this.ctx.read32(ringbufferAddr + 12);

    return packets - packetsAvail;
  }

  /**
   * sceMpegRingbufferPut
   * Put data into ring buffer
   */
  @nativeFunction(0xB240A59E, 150)
  sceMpegRingbufferPut(): number
  {
    // Stub - return 0 packets written
    return 0;
  }

  // ============================================
  // Stream Registration
  // ============================================

  /**
   * sceMpegRegistStream
   * Register a stream
   */
  @nativeFunction(0x42560F23, 150)
  sceMpegRegistStream(): number
  {
    const mpegAddr = this.ctx.arg(0);
    const streamType = this.ctx.arg(1);
    const streamNum = this.ctx.arg(2);

    return this.nextStreamId++;
  }

  /**
   * sceMpegUnRegistStream
   * Unregister a stream
   */
  @nativeFunction(0x591A4AA2, 150)
  sceMpegUnRegistStream(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // AU (Access Unit) Functions
  // ============================================

  /**
   * sceMpegInitAu
   * Initialize access unit
   */
  @nativeFunction(0x167AFD9E, 150)
  sceMpegInitAu(): number
  {
    const mpegAddr = this.ctx.arg(0);
    const bufferAddr = this.ctx.arg(1);
    const auPtr = this.ctx.argPtr(2);

    // Initialize AU structure
    // pts (8 bytes), dts (8 bytes), esBuffer (4 bytes), esSize (4 bytes)
    this.ctx.write32(auPtr + 0, 0);        // pts low
    this.ctx.write32(auPtr + 4, 0);        // pts high
    this.ctx.write32(auPtr + 8, 0);        // dts low
    this.ctx.write32(auPtr + 12, 0);       // dts high
    this.ctx.write32(auPtr + 16, bufferAddr); // esBuffer
    this.ctx.write32(auPtr + 20, 2112);    // esSize

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceMpegQueryAtracEsSize
   * Query ATRAC ES size
   */
  @nativeFunction(0xF8DCB679, 150)
  sceMpegQueryAtracEsSize(): number
  {
    const mpegAddr = this.ctx.arg(0);
    const esSizePtr = this.ctx.argPtr(1);
    const outSizePtr = this.ctx.argPtr(2);

    if (esSizePtr)
    {
      this.ctx.write32(esSizePtr, 2112);
    }
    if (outSizePtr)
    {
      this.ctx.write32(outSizePtr, 8192);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceMpegMallocAvcEsBuf
   * Allocate AVC ES buffer
   */
  @nativeFunction(0xA780CF7E, 150)
  sceMpegMallocAvcEsBuf(): number
  {
    return this.nextEsBuf++;
  }

  /**
   * sceMpegFreeAvcEsBuf
   * Free AVC ES buffer
   */
  @nativeFunction(0xCEB870B1, 150)
  sceMpegFreeAvcEsBuf(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  // ============================================
  // Decode Mode
  // ============================================

  /**
   * sceMpegAvcDecodeMode
   * Set AVC decode mode
   */
  @nativeFunction(0xA11C7026, 150)
  sceMpegAvcDecodeMode(): number
  {
    // Accept any mode
    return SceKernelErrors.ERROR_OK;
  }
}
