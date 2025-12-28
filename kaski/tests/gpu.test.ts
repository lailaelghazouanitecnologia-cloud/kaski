/**
 * GPU Tests
 *
 * Tests for PSP GPU implementation using WebGPU.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GpuOpCodes, Op } from '../src/core/gpu/GpuOpCodes';
import {
  GpuState,
  PrimitiveType,
  NumericEnum,
  ColorEnum,
  IndexEnum,
  CullingDirection,
  TextureEffect,
  WrapMode,
  TextureFilter,
  GuBlendingFactor,
  GuBlendingEquation,
} from '../src/core/gpu/GpuState';
import { VertexInfo } from '../src/core/gpu/VertexInfo';
import { OptimizedDrawBuffer, BatchTransferBuilder } from '../src/core/gpu/VertexBuffer';
import { PixelFormat, PixelConverter, PixelFormatUtils } from '../src/core/format/PixelFormat';

describe('GpuOpCodes', () =>
{
  it('should have correct opcode values', () =>
  {
    expect(Op.NOP).toBe(0x00);
    expect(Op.PRIM).toBe(0x04);
    expect(Op.END).toBe(0x0C);
    expect(Op.JUMP).toBe(0x08);
    expect(Op.CALL).toBe(0x0A);
    expect(Op.RET).toBe(0x0B);
    expect(Op.FINISH).toBe(0x0F);
    expect(Op.VERTEXTYPE).toBe(0x12);
    expect(Op.FRAMEBUFPTR).toBe(0x9C);
    expect(Op.TEXADDR0).toBe(0xA0);
  });

  it('should have matrix offsets', () =>
  {
    expect(Op.MAT_PROJ).toBe(256 + 16 * 2);
    expect(Op.MAT_VIEW).toBe(256 + 16 * 3);
    expect(Op.MAT_WORLD).toBe(256 + 16 * 4);
    expect(Op.MAT_BONES).toBe(256 + 16 * 5);
  });
});

describe('GpuState', () =>
{
  let state: GpuState;

  beforeEach(() =>
  {
    state = new GpuState();
  });

  it('should have 512 registers', () =>
  {
    expect(state.data.length).toBe(512);
  });

  it('should initialize with zeros', () =>
  {
    for (let i = 0; i < state.data.length; i++)
    {
      expect(state.data[i]).toBe(0);
    }
  });

  it('should copy from another state', () =>
  {
    const other = new GpuState();
    other.data[0] = 0x12345678;
    other.data[255] = 0xDEADBEEF;

    state.copyFrom(other);

    expect(state.data[0]).toBe(0x12345678);
    expect(state.data[255]).toBe(0xDEADBEEF);
  });

  it('should read/write data', () =>
  {
    const data = new Uint32Array(512);
    data[10] = 0xCAFEBABE;

    state.writeData(data);
    expect(state.data[10]).toBe(0xCAFEBABE);

    const readData = state.readData();
    expect(readData[10]).toBe(0xCAFEBABE);
  });

  describe('Vertex State', () =>
  {
    it('should parse vertex type', () =>
    {
      // Set VERTEXTYPE register
      // Format: transform2D(1) | morphCount(2) | weightCount(3) | index(2) | weight(2) | position(2) | normal(2) | color(3) | texture(2)
      const vertexType = (0 << 23) | // transform2D = false
                         (0 << 18) | // morphCount = 0
                         (0 << 14) | // weightCount = 0
                         (0 << 11) | // index = Void
                         (0 << 9)  | // weight = Void
                         (3 << 7)  | // position = Float
                         (0 << 5)  | // normal = Void
                         (7 << 2)  | // color = 8888
                         (3 << 0);   // texture = Float

      state.data[Op.VERTEXTYPE] = vertexType;

      expect(state.vertex.transform2D).toBe(false);
      expect(state.vertex.position).toBe(NumericEnum.Float);
      expect(state.vertex.color).toBe(ColorEnum.Color8888);
      expect(state.vertex.texture).toBe(NumericEnum.Float);
      expect(state.vertex.index).toBe(IndexEnum.Void);
    });
  });

  describe('Culling State', () =>
  {
    it('should parse culling state', () =>
    {
      state.data[Op.CULLFACEENABLE] = 1;
      state.data[Op.CULL] = CullingDirection.ClockWise;

      expect(state.culling.enabled).toBe(true);
      expect(state.culling.direction).toBe(CullingDirection.ClockWise);
    });
  });

  describe('Blending State', () =>
  {
    it('should parse blending state', () =>
    {
      state.data[Op.ALPHABLENDENABLE] = 1;
      // functionSrc(4) | functionDst(4) | equation(4)
      state.data[Op.ALPHA] = (GuBlendingFactor.GU_SRC_ALPHA << 0) |
                             (GuBlendingFactor.GU_ONE_MINUS_SRC_ALPHA << 4) |
                             (GuBlendingEquation.Add << 8);

      expect(state.blending.enabled).toBe(true);
      expect(state.blending.functionSource).toBe(GuBlendingFactor.GU_SRC_ALPHA);
      expect(state.blending.functionDestination).toBe(GuBlendingFactor.GU_ONE_MINUS_SRC_ALPHA);
      expect(state.blending.equation).toBe(GuBlendingEquation.Add);
    });
  });

  describe('Texture State', () =>
  {
    it('should parse texture state', () =>
    {
      state.data[Op.TEXTUREMAPENABLE] = 1;
      state.data[Op.TFUNC] = (TextureEffect.Modulate << 0) | (1 << 8); // Rgba
      state.data[Op.TWRAP] = (WrapMode.Repeat << 0) | (WrapMode.Clamp << 8);
      state.data[Op.TFLT] = (TextureFilter.Linear << 0) | (TextureFilter.Nearest << 8);

      expect(state.texture.enabled).toBe(true);
      expect(state.texture.effect).toBe(TextureEffect.Modulate);
      expect(state.texture.wrapU).toBe(WrapMode.Repeat);
      expect(state.texture.wrapV).toBe(WrapMode.Clamp);
      expect(state.texture.filterMinification).toBe(TextureFilter.Linear);
      expect(state.texture.filterMagnification).toBe(TextureFilter.Nearest);
    });

    it('should calculate mipmap sizes', () =>
    {
      // TSIZE0: width_exp(4) | height_exp(8)
      state.data[Op.TSIZE0] = (8 << 0) | (7 << 8); // 256x128
      state.data[Op.TEXBUFWIDTH0] = 256; // bufferWidth
      state.data[Op.TPSM] = PixelFormat.RGBA_8888;

      expect(state.texture.mipmap.textureWidth).toBe(256);
      expect(state.texture.mipmap.textureHeight).toBe(128);
      expect(state.texture.mipmap.bufferWidth).toBe(256);
    });
  });

  describe('Base Address', () =>
  {
    it('should calculate base address', () =>
    {
      state.data[Op.BASE] = 0x08 << 16; // High byte of address

      expect(state.baseAddress).toBe(0x08000000);
    });
  });
});

describe('VertexInfo', () =>
{
  it('should calculate vertex size for simple position-only vertex', () =>
  {
    const vi = new VertexInfo();
    vi.position = NumericEnum.Float;
    vi.updateSizeAndPositions();

    expect(vi.positionSize).toBe(4);
    expect(vi.size).toBe(12); // 3 floats = 12 bytes
    expect(vi.positionOffset).toBe(0);
  });

  it('should calculate vertex size for complex vertex', () =>
  {
    const vi = new VertexInfo();
    vi.texture = NumericEnum.Float;
    vi.textureComponentsCount = 2;
    vi.color = ColorEnum.Color8888;
    vi.position = NumericEnum.Float;
    vi.updateSizeAndPositions();

    expect(vi.textureOffset).toBe(0);  // 2 floats at start
    expect(vi.colorOffset).toBe(8);    // After texture (2*4 = 8)
    expect(vi.positionOffset).toBe(12); // After color (8 + 4 = 12)
    expect(vi.size).toBe(24); // 2*4 + 4 + 3*4 = 24 bytes
  });

  it('should handle weight components', () =>
  {
    const vi = new VertexInfo();
    vi.weight = NumericEnum.Float;
    vi.weightCount = 3; // 4 weights (count + 1)
    vi.position = NumericEnum.Float;
    vi.updateSizeAndPositions();

    expect(vi.realWeightCount).toBe(4);
    expect(vi.weightOffset).toBe(0);
    expect(vi.positionOffset).toBe(16); // 4 floats = 16 bytes
  });

  it('should set state from GpuState', () =>
  {
    const state = new GpuState();
    const vertexType = (3 << 7) | // position = Float
                       (7 << 2) | // color = 8888
                       (2 << 0);  // texture = Short
    state.data[Op.VERTEXTYPE] = vertexType;

    const vi = new VertexInfo();
    vi.setState(state);

    expect(vi.position).toBe(NumericEnum.Float);
    expect(vi.color).toBe(ColorEnum.Color8888);
    expect(vi.texture).toBe(NumericEnum.Short);
  });
});

describe('OptimizedDrawBuffer', () =>
{
  let buffer: OptimizedDrawBuffer;

  beforeEach(() =>
  {
    buffer = new OptimizedDrawBuffer();
  });

  it('should start empty', () =>
  {
    expect(buffer.hasElements).toBe(false);
    expect(buffer.getData().length).toBe(0);
    expect(buffer.getIndices().length).toBe(0);
  });

  it('should add vertex data', () =>
  {
    const vertices = new Uint8Array([1, 2, 3, 4, 5, 6]);
    buffer.addVerticesData(vertices, 6);
    buffer.addVerticesIndices(2);

    expect(buffer.hasElements).toBe(true);
    expect(buffer.getData().length).toBe(6);
    expect(buffer.getIndices().length).toBe(2);
  });

  it('should add sprite indices', () =>
  {
    // 2 input vertices -> 6 indices for quad
    buffer.addVerticesIndicesSprite(2);

    const indices = buffer.getIndices();
    expect(indices.length).toBe(6);
    // Check quad indices: BL, TL, TR, BL, TR, BR
    expect(indices[0]).toBe(3); // BL
    expect(indices[1]).toBe(0); // TL
    expect(indices[2]).toBe(2); // TR
    expect(indices[3]).toBe(3); // BL
    expect(indices[4]).toBe(2); // TR
    expect(indices[5]).toBe(1); // BR
  });

  it('should create batch', () =>
  {
    const vertices = new Uint8Array([1, 2, 3, 4]);
    buffer.addVerticesData(vertices, 4);
    buffer.addVerticesIndices(1);

    const state = new GpuState();
    const vi = new VertexInfo();
    vi.position = NumericEnum.Float;

    const batch = buffer.createBatch(state, PrimitiveType.Triangles, vi);

    expect(batch.primType).toBe(PrimitiveType.Triangles);
    expect(batch.dataLow).toBe(0);
    expect(batch.dataHigh).toBe(4);
    expect(batch.indexLow).toBe(0);
    expect(batch.indexHigh).toBe(1);
    expect(batch.indexCount).toBe(1);
  });

  it('should reset buffer', () =>
  {
    buffer.addVerticesData(new Uint8Array([1, 2, 3]), 3);
    buffer.addVerticesIndices(1);
    buffer.reset();

    expect(buffer.hasElements).toBe(false);
    expect(buffer.getData().length).toBe(0);
    expect(buffer.getIndices().length).toBe(0);
  });
});

describe('PixelFormat', () =>
{
  describe('PixelFormatUtils', () =>
  {
    it('should detect CLUT formats', () =>
    {
      expect(PixelFormatUtils.hasClut(PixelFormat.PALETTE_T4)).toBe(true);
      expect(PixelFormatUtils.hasClut(PixelFormat.PALETTE_T8)).toBe(true);
      expect(PixelFormatUtils.hasClut(PixelFormat.PALETTE_T16)).toBe(true);
      expect(PixelFormatUtils.hasClut(PixelFormat.PALETTE_T32)).toBe(true);

      expect(PixelFormatUtils.hasClut(PixelFormat.RGBA_8888)).toBe(false);
      expect(PixelFormatUtils.hasClut(PixelFormat.RGBA_5650)).toBe(false);
    });
  });

  describe('PixelConverter', () =>
  {
    it('should return correct size in bytes', () =>
    {
      expect(PixelConverter.getSizeInBytes(PixelFormat.RGBA_8888, 1)).toBe(4);
      expect(PixelConverter.getSizeInBytes(PixelFormat.RGBA_5650, 1)).toBe(2);
      expect(PixelConverter.getSizeInBytes(PixelFormat.PALETTE_T8, 1)).toBe(1);
      expect(PixelConverter.getSizeInBytes(PixelFormat.PALETTE_T4, 2)).toBe(1);
    });

    it('should unpack RGBA_8888', () =>
    {
      const color = 0xFF00FF00; // Green with alpha
      const rgba = PixelConverter.unpackToRGBA(PixelFormat.RGBA_8888, color);
      // Use >>> 0 to compare as unsigned 32-bit integers
      expect(rgba >>> 0).toBe(0xFF00FF00 >>> 0);
    });

    it('should decode 5650 format', () =>
    {
      // 5650: BBBBB_GGGGGG_RRRRR
      const input = new Uint8Array([0xFF, 0xFF]); // All bits set
      const output = new Uint32Array(1);
      PixelConverter.decode(PixelFormat.RGBA_5650, input, output);

      // Should be white with full alpha
      const r = output[0] & 0xFF;
      const g = (output[0] >> 8) & 0xFF;
      const b = (output[0] >> 16) & 0xFF;
      const a = (output[0] >> 24) & 0xFF;

      expect(r).toBe(255);
      expect(g).toBe(255);
      expect(b).toBe(255);
      expect(a).toBe(255);
    });
  });
});

describe('BatchTransferBuilder', () =>
{
  it('should build transfer from batches', () =>
  {
    const buffer = new OptimizedDrawBuffer();
    buffer.addVerticesData(new Uint8Array([1, 2, 3, 4]), 4);
    buffer.addVerticesIndices(2);

    const state = new GpuState();
    const vi = new VertexInfo();
    vi.position = NumericEnum.Float;

    const batch = buffer.createBatch(state, PrimitiveType.Triangles, vi);

    const transfer = BatchTransferBuilder.buildBatchesTransfer(buffer, [batch]);

    expect(transfer.buffer).toBeInstanceOf(ArrayBuffer);
    expect(transfer.batches.length).toBe(1);
    expect(transfer.batches[0].primType).toBe(PrimitiveType.Triangles);
  });
});
