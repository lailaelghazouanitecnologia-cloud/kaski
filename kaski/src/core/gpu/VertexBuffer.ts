/**
 * Vertex Buffer
 *
 * Manages vertex and index data for GPU rendering.
 * Supports batching of primitives for efficient draw calls.
 */

import { GpuState, PrimitiveType } from './GpuState';
import { VertexInfo } from './VertexInfo';

// ============================================
// Optimized Batch
// ============================================

export interface OptimizedBatch
{
  /** GPU state snapshot */
  stateData: Uint32Array;

  /** Primitive type */
  primType: PrimitiveType;

  /** Vertex data range */
  dataLow: number;
  dataHigh: number;

  /** Index data range */
  indexLow: number;
  indexHigh: number;

  /** Number of indices */
  indexCount: number;

  /** Texture data (if any) */
  textureData: Uint8Array | null;

  /** CLUT data (if any) */
  clutData: Uint8Array | null;
}

// ============================================
// Batch Transfer Format
// ============================================

export interface OptimizedBatchTransfer
{
  stateOffset: number;
  primType: PrimitiveType;
  dataLow: number;
  dataHigh: number;
  indexLow: number;
  indexHigh: number;
  indexCount: number;
  textureLow: number;
  textureHigh: number;
  clutLow: number;
  clutHigh: number;
}

export interface DrawBufferDataTransfer
{
  data: number;
  datasize: number;
  indices: number;
  indicesCount: number;
}

export interface BatchesTransfer
{
  buffer: ArrayBuffer;
  data: DrawBufferDataTransfer;
  batches: OptimizedBatchTransfer[];
}

// ============================================
// Sprite Expander
// ============================================

type SpriteExpanderFunc = (input: Uint8Array, output: Uint8Array, count: number) => void;

/**
 * Expands sprite primitives from 2 vertices to 4 vertices (quad)
 */
class SpriteExpander
{
  private static cache = new Map<number, SpriteExpanderFunc>();

  static forVertexInfo(vi: VertexInfo): SpriteExpanderFunc
  {
    const hash = vi.hash;
    if (!this.cache.has(hash))
    {
      this.cache.set(hash, this.createExpander(vi));
    }
    return this.cache.get(hash)!;
  }

  private static createExpander(vi: VertexInfo): SpriteExpanderFunc
  {
    const vsize = vi.size;

    // Create a function that expands sprites
    return (input: Uint8Array, output: Uint8Array, count: number): void =>
    {
      const i8 = input;
      const o8 = output;
      let iOff = 0;
      let oOff = 0;

      for (let n = 0; n < count; n++)
      {
        // Copy TL (top-left) from first input vertex
        for (let b = 0; b < vsize; b++)
        {
          o8[oOff + b] = i8[iOff + b];
        }

        // Copy BR (bottom-right) from second input vertex
        for (let b = 0; b < vsize; b++)
        {
          o8[oOff + vsize + b] = i8[iOff + vsize + b];
        }

        // TR (top-right) = X from BR, Y from TL
        // BL (bottom-left) = X from TL, Y from BR
        // Copy initial values
        for (let b = 0; b < vsize; b++)
        {
          o8[oOff + vsize * 2 + b] = i8[iOff + b];
          o8[oOff + vsize * 3 + b] = i8[iOff + b];
        }

        // Now fix up position X/Y components
        if (vi.hasPosition)
        {
          const pOff = vi.positionOffset;
          const pSize = vi.positionSize;

          // TR.x = BR.x, TR.y = TL.y
          // BL.x = TL.x, BL.y = BR.y
          for (let b = 0; b < pSize; b++)
          {
            // TR.x = BR.x
            o8[oOff + vsize * 2 + pOff + b] = i8[iOff + vsize + pOff + b];
            // BL.y = BR.y
            o8[oOff + vsize * 3 + pOff + pSize + b] = i8[iOff + vsize + pOff + pSize + b];
          }
        }

        // Fix up texture coordinates similarly
        if (vi.hasTexture)
        {
          const tOff = vi.textureOffset;
          const tSize = vi.textureSize;

          for (let b = 0; b < tSize; b++)
          {
            // TR.u = BR.u, TR.v = TL.v
            o8[oOff + vsize * 2 + tOff + b] = i8[iOff + vsize + tOff + b];
            // BL.v = BR.v
            o8[oOff + vsize * 3 + tOff + tSize + b] = i8[iOff + vsize + tOff + tSize + b];
          }
        }

        // Copy color from BR to all vertices
        if (vi.hasColor)
        {
          const cOff = vi.colorOffset;
          const cSize = vi.colorSize;

          for (let b = 0; b < cSize; b++)
          {
            const c = i8[iOff + vsize + cOff + b];
            o8[oOff + cOff + b] = c;
            o8[oOff + vsize * 2 + cOff + b] = c;
            o8[oOff + vsize * 3 + cOff + b] = c;
          }
        }

        iOff += vsize * 2;
        oOff += vsize * 4;
      }
    };
  }
}

// ============================================
// Optimized Draw Buffer
// ============================================

export class OptimizedDrawBuffer
{
  /** Vertex data buffer (2MB) */
  data = new Uint8Array(2 * 1024 * 1024);

  /** Current offset in vertex data */
  private dataOffset = 0;

  /** Index buffer (512K indices) */
  indices = new Uint16Array(512 * 1024);

  /** Current offset in index buffer */
  private indexOffset = 0;

  /** Current vertex index */
  private vertexIndex = 0;

  /** Batch start offsets */
  private batchDataOffset: number = 0;
  private batchIndexOffset: number = 0;

  reset(): void
  {
    this.dataOffset = 0;
    this.indexOffset = 0;
    this.vertexIndex = 0;
    this.batchDataOffset = 0;
    this.batchIndexOffset = 0;
  }

  getData(): Uint8Array
  {
    return this.data.subarray(0, this.dataOffset);
  }

  getIndices(): Uint16Array
  {
    return this.indices.subarray(0, this.indexOffset);
  }

  get hasElements(): boolean
  {
    return this.dataOffset > this.batchDataOffset;
  }

  /**
   * Create a batch from current data
   */
  createBatch(
    state: GpuState,
    primType: PrimitiveType,
    vertexInfo: VertexInfo,
    memory?: { getPointerU8Array: (addr: number, size: number) => Uint8Array }
  ): OptimizedBatch
  {
    const batch: OptimizedBatch = {
      stateData: state.readData(),
      primType,
      dataLow: this.batchDataOffset,
      dataHigh: this.dataOffset,
      indexLow: this.batchIndexOffset,
      indexHigh: this.indexOffset,
      indexCount: this.indexOffset - this.batchIndexOffset,
      textureData: null,
      clutData: null,
    };

    // Capture texture data if needed
    if (vertexInfo.hasTexture && memory)
    {
      const mipmap = state.texture.mipmaps[0];
      if (mipmap.sizeInBytes > 0)
      {
        batch.textureData = memory.getPointerU8Array(mipmap.address, mipmap.sizeInBytes);
      }
      if (state.texture.hasClut)
      {
        const clut = state.texture.clut;
        if (clut.sizeInBytes > 0)
        {
          batch.clutData = memory.getPointerU8Array(clut.address, clut.sizeInBytes);
        }
      }
    }

    // Align data offset for next batch
    this.dataOffset = this.batchDataOffset = (this.dataOffset + 15) & ~0xF;
    this.batchIndexOffset = this.indexOffset;
    this.vertexIndex = 0;

    return batch;
  }

  /**
   * Add vertex data
   */
  addVerticesData(vertices: Uint8Array, verticesSize: number): void
  {
    this.data.set(vertices.subarray(0, verticesSize), this.dataOffset);
    this.dataOffset += verticesSize;
  }

  /**
   * Add sequential indices
   */
  addVerticesIndices(vertexCount: number): void
  {
    for (let n = 0; n < vertexCount; n++)
    {
      this.indices[this.indexOffset++] = this.vertexIndex++;
    }
  }

  /**
   * Add sprite indices (2 input vertices -> 6 indices for quad)
   */
  addVerticesIndicesSprite(vertexCount: number): void
  {
    for (let n = 0; n < vertexCount / 2; n++)
    {
      // Triangle 1: BL, TL, TR
      this.indices[this.indexOffset++] = this.vertexIndex + 3;
      this.indices[this.indexOffset++] = this.vertexIndex + 0;
      this.indices[this.indexOffset++] = this.vertexIndex + 2;
      // Triangle 2: BL, TR, BR
      this.indices[this.indexOffset++] = this.vertexIndex + 3;
      this.indices[this.indexOffset++] = this.vertexIndex + 2;
      this.indices[this.indexOffset++] = this.vertexIndex + 1;
      this.vertexIndex += 4;
    }
  }

  /**
   * Add sprite vertex data (expands 2 vertices to 4)
   */
  addVerticesDataSprite(
    vertices: Uint8Array,
    verticesSize: number,
    count: number,
    vi: VertexInfo
  ): void
  {
    const func = SpriteExpander.forVertexInfo(vi);
    func(vertices, this.data.subarray(this.dataOffset), count / 2);
    this.dataOffset += verticesSize * 2;
  }

  /**
   * Add indexed vertex list
   */
  addVerticesIndicesList(indices: Uint8Array | Uint16Array): number
  {
    let max = 0;
    const ioffset = this.indexOffset;
    for (let n = 0; n < indices.length; n++)
    {
      const v = indices[n];
      this.indices[ioffset + n] = v;
      max = Math.max(max, v);
    }
    max++;
    this.vertexIndex = max;
    this.indexOffset += indices.length;
    return max;
  }

  /**
   * Add degenerate triangle join vertices
   */
  join(vertexSize: number): void
  {
    this.indices[this.indexOffset++] = this.vertexIndex - 1;
    this.indices[this.indexOffset++] = this.vertexIndex;
  }
}

// ============================================
// Batch Transfer Builder
// ============================================

export class BatchTransferBuilder
{
  /**
   * Build transfer data for batches
   */
  static buildBatchesTransfer(
    odb: OptimizedDrawBuffer,
    batches: OptimizedBatch[]
  ): BatchesTransfer
  {
    const chunks: { offset: number; size: number; data: ArrayBufferView }[] = [];
    let offset = 0;

    function nextAligned(size: number): number
    {
      return (size + 15) & ~15;
    }

    function alloc(size: number): number
    {
      const address = offset;
      offset += nextAligned(size);
      return address;
    }

    function allocData(data: ArrayBufferView): number
    {
      chunks.push({ offset, size: data.byteLength, data });
      return alloc(data.byteLength);
    }

    const odbData = odb.getData();
    const odbIndices = odb.getIndices();

    const data: DrawBufferDataTransfer = {
      data: allocData(odbData),
      datasize: odbData.length,
      indices: allocData(odbIndices),
      indicesCount: odbIndices.length,
    };

    const memorySegments = new Map<number, number>();

    function allocMemoryData(data: Uint8Array | null): number
    {
      if (!data) return 0;
      if (!memorySegments.has(data.byteOffset))
      {
        memorySegments.set(data.byteOffset, allocData(data));
      }
      return memorySegments.get(data.byteOffset)!;
    }

    const batchTransfers: OptimizedBatchTransfer[] = [];

    for (const batch of batches)
    {
      const btl = allocMemoryData(batch.textureData);
      const bcl = allocMemoryData(batch.clutData);

      batchTransfers.push({
        stateOffset: allocData(batch.stateData),
        primType: batch.primType,
        dataLow: batch.dataLow,
        dataHigh: batch.dataHigh,
        indexLow: batch.indexLow,
        indexHigh: batch.indexHigh,
        indexCount: batch.indexCount,
        textureLow: btl,
        textureHigh: btl + (batch.textureData ? batch.textureData.length : 0),
        clutLow: bcl,
        clutHigh: bcl + (batch.clutData ? batch.clutData.length : 0),
      });
    }

    const buffer = new ArrayBuffer(offset);
    const bufferU8 = new Uint8Array(buffer);

    for (const chunk of chunks)
    {
      bufferU8.set(
        new Uint8Array(chunk.data.buffer, chunk.data.byteOffset, chunk.size),
        chunk.offset
      );
    }

    return {
      buffer,
      data,
      batches: batchTransfers,
    };
  }
}
