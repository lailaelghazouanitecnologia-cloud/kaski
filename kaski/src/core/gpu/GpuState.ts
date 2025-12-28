/**
 * PSP GPU State
 *
 * 512 x 32-bit registers representing the complete GPU state.
 * State objects provide typed views into this data.
 */

import { GpuOpCodes as Op } from './GpuOpCodes';
import { PixelFormat, PixelConverter, PixelFormatUtils } from '../format/PixelFormat';
import type { Memory } from '../memory/Memory';

// ============================================
// Parameter extraction helpers
// ============================================

function bool1(p: number): boolean { return p !== 0; }
function parambool(p: number, offset: number): boolean { return ((p >>> offset) & 0x1) !== 0; }
function param1(p: number, offset: number): number { return (p >>> offset) & 0x1; }
function param2(p: number, offset: number): number { return (p >>> offset) & 0x3; }
function param3(p: number, offset: number): number { return (p >>> offset) & 0x7; }
function param4(p: number, offset: number): number { return (p >>> offset) & 0xF; }
function param5(p: number, offset: number): number { return (p >>> offset) & 0x1F; }
function param6(p: number, offset: number): number { return (p >>> offset) & 0x3F; }
function param8(p: number, offset: number): number { return (p >>> offset) & 0xFF; }
function param10(p: number, offset: number): number { return (p >>> offset) & 0x3FF; }
function param16(p: number, offset: number): number { return (p >>> offset) & 0xFFFF; }
function param24(p: number): number { return p & 0xFFFFFF; }

/** Reinterpret 24-bit int as float (shifted left 8 bits) */
function float1(p: number): number
{
  const buffer = new ArrayBuffer(4);
  const intView = new Int32Array(buffer);
  const floatView = new Float32Array(buffer);
  intView[0] = p << 8;
  return floatView[0];
}

// ============================================
// Enums
// ============================================

export const enum CullingDirection
{
  CounterClockWise = 0,
  ClockWise = 1
}

export const enum SyncType
{
  WaitForCompletion = 0,
  Peek = 1,
}

export const enum DisplayListStatus
{
  Completed = 0,
  Queued = 1,
  Drawing = 2,
  Stalling = 3,
  Paused = 4,
}

export const enum IndexEnum
{
  Void = 0,
  Byte = 1,
  Short = 2,
}

export const enum NumericEnum
{
  Void = 0,
  Byte = 1,
  Short = 2,
  Float = 3,
}

export const enum ColorEnum
{
  Void = 0,
  Invalid1 = 1,
  Invalid2 = 2,
  Invalid3 = 3,
  Color5650 = 4,
  Color5551 = 5,
  Color4444 = 6,
  Color8888 = 7,
}

export const enum PrimitiveType
{
  Points = 0,
  Lines = 1,
  LineStrip = 2,
  Triangles = 3,
  TriangleStrip = 4,
  TriangleFan = 5,
  Sprites = 6,
}

export const enum WrapMode
{
  Repeat = 0,
  Clamp = 1,
}

export const enum TextureEffect
{
  Modulate = 0,
  Decal = 1,
  Blend = 2,
  Replace = 3,
  Add = 4,
}

export const enum TextureFilter
{
  Nearest = 0,
  Linear = 1,
  NearestMipmapNearest = 4,
  LinearMipmapNearest = 5,
  NearestMipmapLinear = 6,
  LinearMipmapLinear = 7,
}

export const enum TextureColorComponent
{
  Rgb = 0,
  Rgba = 1,
}

export const enum TextureMapMode
{
  GU_TEXTURE_COORDS = 0,
  GU_TEXTURE_MATRIX = 1,
  GU_ENVIRONMENT_MAP = 2,
}

export const enum TextureProjectionMapMode
{
  GU_POSITION = 0,
  GU_UV = 1,
  GU_NORMALIZED_NORMAL = 2,
  GU_NORMAL = 3,
}

export const enum TextureLevelMode
{
  Auto = 0,
  Const = 1,
  Slope = 2
}

export const enum TestFunctionEnum
{
  Never = 0,
  Always = 1,
  Equal = 2,
  NotEqual = 3,
  Less = 4,
  LessOrEqual = 5,
  Greater = 6,
  GreaterOrEqual = 7,
}

export const enum ShadingModelEnum
{
  Flat = 0,
  Smooth = 1,
}

export const enum GuBlendingFactor
{
  GU_SRC_COLOR = 0,
  GU_ONE_MINUS_SRC_COLOR = 1,
  GU_SRC_ALPHA = 2,
  GU_ONE_MINUS_SRC_ALPHA = 3,
  GU_DST_ALPHA = 4,
  GU_ONE_MINUS_DST_ALPHA = 5,
  GU_FIX = 10,
}

export const enum GuBlendingEquation
{
  Add = 0,
  Substract = 1,
  ReverseSubstract = 2,
  Min = 3,
  Max = 4,
  Abs = 5,
}

export const enum StencilOperationEnum
{
  Keep = 0,
  Zero = 1,
  Replace = 2,
  Invert = 3,
  Increment = 4,
  Decrement = 5,
}

export const enum LightTypeEnum
{
  Directional = 0,
  PointLight = 1,
  SpotLight = 2
}

export const enum LightModelEnum
{
  SingleColor = 0,
  SeparateSpecularColor = 1
}

// ============================================
// Helper functions
// ============================================

function createMatrix4x4(data: Uint32Array, offset: number): Float32Array
{
  return new Float32Array(data.buffer, offset * 4, 16);
}

function createMatrix4x3(data: Uint32Array, offset: number): Float32Array
{
  return new Float32Array(data.buffer, offset * 4, 12);
}

// ============================================
// Color class
// ============================================

export class Color
{
  constructor(
    public r: number = 0,
    public g: number = 0,
    public b: number = 0,
    public a: number = 1
  ) {}

  setRGB(rgb: number): this
  {
    this.r = ((rgb >>> 0) & 0xFF) / 255;
    this.g = ((rgb >>> 8) & 0xFF) / 255;
    this.b = ((rgb >>> 16) & 0xFF) / 255;
    this.a = 1;
    return this;
  }

  setRGB_A(rgb: number, a: number): this
  {
    this.setRGB(rgb);
    this.a = (a & 0xFF) / 255;
    return this;
  }

  set(r: number, g: number, b: number, a: number = 1): this
  {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
    return this;
  }

  equals(r: number, g: number, b: number, a: number): boolean
  {
    return this.r === r && this.g === g && this.b === b && this.a === a;
  }

  static add(a: Color, b: Color, dest: Color = new Color()): Color
  {
    dest.r = a.r + b.r;
    dest.g = a.g + b.g;
    dest.b = a.b + b.b;
    dest.a = a.a * b.a;
    return dest;
  }
}

// ============================================
// Rectangle class
// ============================================

export class Rectangle
{
  constructor(
    public left: number,
    public top: number,
    public right: number,
    public bottom: number
  ) {}

  get width(): number { return this.right - this.left; }
  get height(): number { return this.bottom - this.top; }
}

// ============================================
// State component classes
// ============================================

export class GpuFrameBufferState
{
  constructor(private data: Uint32Array) {}

  get width(): number { return param16(this.data[Op.FRAMEBUFWIDTH], 0); }
  get highAddress(): number { return param8(this.data[Op.FRAMEBUFWIDTH], 16); }
  get lowAddress(): number { return param24(this.data[Op.FRAMEBUFPTR]); }
  get address(): number { return (this.highAddress << 24) | this.lowAddress; }
}

export class VertexState
{
  constructor(private data: Uint32Array) {}

  get value(): number { return param24(this.data[Op.VERTEXTYPE]); }
  get reversedNormal(): boolean { return bool1(this.data[Op.REVERSENORMAL]); }
  get address(): number { return param24(this.data[Op.VADDR]); }
  set address(value: number) { this.data[Op.VADDR] = value | (Op.VADDR << 24); }

  get texture(): NumericEnum { return param2(this.data[Op.VERTEXTYPE], 0); }
  get color(): ColorEnum { return param3(this.data[Op.VERTEXTYPE], 2) as ColorEnum; }
  get normal(): NumericEnum { return param2(this.data[Op.VERTEXTYPE], 5) as NumericEnum; }
  get position(): NumericEnum { return param2(this.data[Op.VERTEXTYPE], 7) as NumericEnum; }
  get weight(): NumericEnum { return param2(this.data[Op.VERTEXTYPE], 9) as NumericEnum; }
  get index(): IndexEnum { return param2(this.data[Op.VERTEXTYPE], 11) as IndexEnum; }
  get weightCount(): number { return param3(this.data[Op.VERTEXTYPE], 14); }
  get morphingVertexCount(): number { return param2(this.data[Op.VERTEXTYPE], 18); }
  get transform2D(): boolean { return parambool(this.data[Op.VERTEXTYPE], 23); }
}

export class ViewPort
{
  constructor(private data: Uint32Array) {}

  get x(): number { return float1(this.data[Op.VIEWPORTX2]); }
  get y(): number { return float1(this.data[Op.VIEWPORTY2]); }
  get z(): number { return float1(this.data[Op.VIEWPORTZ2]); }

  get width(): number { return float1(this.data[Op.VIEWPORTX1]); }
  get height(): number { return float1(this.data[Op.VIEWPORTY1]); }
  get depth(): number { return float1(this.data[Op.VIEWPORTZ1]); }
}

export class Region
{
  constructor(private data: Uint32Array) {}

  get x1(): number { return param10(this.data[Op.REGION1], 0); }
  get y1(): number { return param10(this.data[Op.REGION1], 10); }
  get x2(): number { return param10(this.data[Op.REGION2], 0); }
  get y2(): number { return param10(this.data[Op.REGION2], 10); }
}

export class OffsetState
{
  constructor(private data: Uint32Array) {}

  get x(): number { return param4(this.data[Op.OFFSETX], 0); }
  get y(): number { return param4(this.data[Op.OFFSETY], 0); }
}

export class CullingState
{
  constructor(private data: Uint32Array) {}

  get enabled(): boolean { return bool1(this.data[Op.CULLFACEENABLE]); }
  get direction(): CullingDirection { return param24(this.data[Op.CULL]) as CullingDirection; }
}

export class ClipPlane
{
  constructor(private data: Uint32Array) {}

  get enabled(): boolean { return bool1(this.data[Op.CLIPENABLE]); }
  get scissor(): Rectangle { return new Rectangle(this.left, this.top, this.right, this.bottom); }
  get left(): number { return param10(this.data[Op.SCISSOR1], 0); }
  get top(): number { return param10(this.data[Op.SCISSOR1], 10); }
  get right(): number { return param10(this.data[Op.SCISSOR2], 0); }
  get bottom(): number { return param10(this.data[Op.SCISSOR2], 10); }
}

export class DepthTestState
{
  constructor(private data: Uint32Array) {}

  get enabled(): boolean { return bool1(this.data[Op.ZTESTENABLE]); }
  get func(): number { return param8(this.data[Op.ZTST], 0); }
  get mask(): number { return param16(this.data[Op.ZMSK], 0); }

  get rangeNear(): number { return (this.data[Op.MAXZ] & 0xFFFF) / 65536; }
  get rangeFar(): number { return (this.data[Op.MINZ] & 0xFFFF) / 65536; }
}

export class StencilState
{
  constructor(private data: Uint32Array) {}

  get enabled(): boolean { return bool1(this.data[Op.STENCILTESTENABLE]); }

  get fail(): StencilOperationEnum { return param8(this.data[Op.SOP], 0) as StencilOperationEnum; }
  get zfail(): StencilOperationEnum { return param8(this.data[Op.SOP], 8) as StencilOperationEnum; }
  get zpass(): StencilOperationEnum { return param8(this.data[Op.SOP], 16) as StencilOperationEnum; }

  get func(): TestFunctionEnum { return param8(this.data[Op.STST], 0) as TestFunctionEnum; }
  get funcRef(): number { return param8(this.data[Op.STST], 8); }
  get funcMask(): number { return param8(this.data[Op.STST], 16); }
}

export class AlphaTest
{
  constructor(private data: Uint32Array) {}

  get enabled(): boolean { return bool1(this.data[Op.ALPHATESTENABLE]); }

  get func(): TestFunctionEnum { return param8(this.data[Op.ATST], 0) as TestFunctionEnum; }
  get value(): number { return param8(this.data[Op.ATST], 8); }
  get mask(): number { return param8(this.data[Op.ATST], 16); }
}

export class Blending
{
  constructor(private data: Uint32Array) {}

  get fixColorSource(): Color { return new Color().setRGB(param24(this.data[Op.SFIX])); }
  get fixColorDestination(): Color { return new Color().setRGB(param24(this.data[Op.DFIX])); }

  get enabled(): boolean { return bool1(this.data[Op.ALPHABLENDENABLE]); }

  get functionSource(): GuBlendingFactor { return param4(this.data[Op.ALPHA], 0) as GuBlendingFactor; }
  get functionDestination(): GuBlendingFactor { return param4(this.data[Op.ALPHA], 4) as GuBlendingFactor; }
  get equation(): GuBlendingEquation { return param4(this.data[Op.ALPHA], 8) as GuBlendingEquation; }

  get colorMask(): Color
  {
    return new Color().setRGB_A(
      param24(this.data[Op.PMSKC]),
      param8(this.data[Op.PMSKA], 0)
    );
  }
}

export class Fog
{
  constructor(private data: Uint32Array) {}

  get color(): Color { return new Color().setRGB(this.data[Op.FCOL]); }
  get far(): number { return float1(this.data[Op.FFAR]); }
  get dist(): number { return float1(this.data[Op.FDIST]); }
  get enabled(): boolean { return bool1(this.data[Op.FOGENABLE]); }
}

export class LogicOp
{
  constructor(private data: Uint32Array) {}

  get enabled(): boolean { return bool1(this.data[Op.LOGICOPENABLE]); }
}

export class DitheringState
{
  constructor(private data: Uint32Array) {}

  get enabled(): boolean { return bool1(this.data[Op.DITHERENABLE]); }
}

export class ColorTestState
{
  constructor(private data: Uint32Array) {}

  get enabled(): boolean { return bool1(this.data[Op.COLORTESTENABLE]); }
}

export class LineSmoothState
{
  constructor(private data: Uint32Array) {}

  get enabled(): boolean { return bool1(this.data[Op.ANTIALIASENABLE]); }
}

export class PatchCullingState
{
  constructor(private data: Uint32Array) {}

  get enabled(): boolean { return bool1(this.data[Op.PATCHCULLENABLE]); }
  get faceFlag(): boolean { return bool1(this.data[Op.PATCHFACING]); }
}

export class PatchState
{
  constructor(private data: Uint32Array) {}

  get divs(): number { return param8(this.data[Op.PATCHDIVISION], 0); }
  get divt(): number { return param8(this.data[Op.PATCHDIVISION], 8); }
}

export class SkinningState
{
  dataf: Float32Array;
  boneMatrices: Float32Array[];

  constructor(private data: Uint32Array)
  {
    this.dataf = new Float32Array(this.data.buffer);
    this.boneMatrices = [
      createMatrix4x3(this.data, Op.MAT_BONES + 12 * 0),
      createMatrix4x3(this.data, Op.MAT_BONES + 12 * 1),
      createMatrix4x3(this.data, Op.MAT_BONES + 12 * 2),
      createMatrix4x3(this.data, Op.MAT_BONES + 12 * 3),
      createMatrix4x3(this.data, Op.MAT_BONES + 12 * 4),
      createMatrix4x3(this.data, Op.MAT_BONES + 12 * 5),
      createMatrix4x3(this.data, Op.MAT_BONES + 12 * 6),
      createMatrix4x3(this.data, Op.MAT_BONES + 12 * 7)
    ];
  }
}

export class Light
{
  private static REG_TYPES = [Op.LIGHTTYPE0, Op.LIGHTTYPE1, Op.LIGHTTYPE2, Op.LIGHTTYPE3];
  private static REG_LCA = [Op.LCA0, Op.LCA1, Op.LCA2, Op.LCA3];
  private static REG_LLA = [Op.LLA0, Op.LLA1, Op.LLA2, Op.LLA3];
  private static REG_LQA = [Op.LQA0, Op.LQA1, Op.LQA2, Op.LQA3];
  private static REG_SPOTEXP = [Op.SPOTEXP0, Op.SPOTEXP1, Op.SPOTEXP2, Op.SPOTEXP3];
  private static REG_SPOTCUT = [Op.SPOTCUT0, Op.SPOTCUT1, Op.SPOTCUT2, Op.SPOTCUT3];

  private static LXP = [Op.LXP0, Op.LXP1, Op.LXP2, Op.LXP3];
  private static LYP = [Op.LYP0, Op.LYP1, Op.LYP2, Op.LYP3];
  private static LZP = [Op.LZP0, Op.LZP1, Op.LZP2, Op.LZP3];

  private static LXD = [Op.LXD0, Op.LXD1, Op.LXD2, Op.LXD3];
  private static LYD = [Op.LYD0, Op.LYD1, Op.LYD2, Op.LYD3];
  private static LZD = [Op.LZD0, Op.LZD1, Op.LZD2, Op.LZD3];

  private static ALC = [Op.ALC0, Op.ALC1, Op.ALC2, Op.ALC3];
  private static DLC = [Op.DLC0, Op.DLC1, Op.DLC2, Op.DLC3];
  private static SLC = [Op.SLC0, Op.SLC1, Op.SLC2, Op.SLC3];

  constructor(private data: Uint32Array, public index: number) {}

  get enabled(): boolean { return bool1(this.data[Op.LIGHTENABLE0 + this.index]); }

  get kind(): LightModelEnum { return param8(this.data[Light.REG_TYPES[this.index]], 0) as LightModelEnum; }
  get type(): LightTypeEnum { return param8(this.data[Light.REG_TYPES[this.index]], 8) as LightTypeEnum; }

  get pw(): number { return (this.type === LightTypeEnum.SpotLight) ? 1 : 0; }

  get px(): number { return float1(this.data[Light.LXP[this.index]]); }
  get py(): number { return float1(this.data[Light.LYP[this.index]]); }
  get pz(): number { return float1(this.data[Light.LZP[this.index]]); }

  get dx(): number { return float1(this.data[Light.LXD[this.index]]); }
  get dy(): number { return float1(this.data[Light.LYD[this.index]]); }
  get dz(): number { return float1(this.data[Light.LZD[this.index]]); }

  get spotExponent(): number { return float1(this.data[Light.REG_SPOTEXP[this.index]]); }
  get spotCutoff(): number { return float1(this.data[Light.REG_SPOTCUT[this.index]]); }
  get constantAttenuation(): number { return float1(this.data[Light.REG_LCA[this.index]]); }
  get linearAttenuation(): number { return float1(this.data[Light.REG_LLA[this.index]]); }
  get quadraticAttenuation(): number { return float1(this.data[Light.REG_LQA[this.index]]); }

  get ambientColor(): Color { return new Color().setRGB(this.data[Light.ALC[this.index]]); }
  get diffuseColor(): Color { return new Color().setRGB(this.data[Light.DLC[this.index]]); }
  get specularColor(): Color { return new Color().setRGB(this.data[Light.SLC[this.index]]); }
}

export class Lightning
{
  lights: Light[];

  constructor(private data: Uint32Array)
  {
    this.lights = [
      new Light(this.data, 0),
      new Light(this.data, 1),
      new Light(this.data, 2),
      new Light(this.data, 3)
    ];
  }

  get lightModel(): LightModelEnum { return param8(this.data[Op.LIGHTMODE], 0) as LightModelEnum; }
  get specularPower(): number { return float1(this.data[Op.MATERIALSPECULARCOEF]); }
  get ambientLightColor(): Color { return new Color().setRGB_A(this.data[Op.AMBIENTCOLOR], this.data[Op.AMBIENTALPHA]); }
  get enabled(): boolean { return bool1(this.data[Op.LIGHTINGENABLE]); }
}

export class ClutState
{
  constructor(private data: Uint32Array) {}

  getHashFast(): number
  {
    return (this.data[Op.CMODE] << 0) +
           (this.data[Op.CLOAD] << 8) +
           (this.data[Op.CLUTADDR] << 16) +
           (this.data[Op.CLUTADDRUPPER] << 24);
  }

  get cmode(): number { return this.data[Op.CMODE]; }
  get cload(): number { return this.data[Op.CLOAD]; }

  get address(): number
  {
    return param24(this.data[Op.CLUTADDR]) | ((this.data[Op.CLUTADDRUPPER] << 8) & 0xFF000000);
  }
  get addressEnd(): number { return this.address + this.sizeInBytes; }
  get numberOfBlocks(): number { return param6(this.cload, 0); }
  get numberOfColors(): number { return this.numberOfBlocks << 4; }
  get pixelFormat(): PixelFormat { return param2(this.data[Op.CMODE], 0) as PixelFormat; }
  get colorBits(): number { return PixelConverter.getSizeInBits(this.pixelFormat); }

  get shift(): number { return param5(this.data[Op.CMODE], 2); }
  get mask(): number { return param8(this.data[Op.CMODE], 8); }
  get start(): number { return param5(this.data[Op.CMODE], 16); }
  get sizeInBytes(): number { return PixelConverter.getSizeInBytes(this.pixelFormat, this.numberOfColors); }

  getIndex(n: number): number
  {
    return ((n >>> this.shift) & this.mask) + (this.start << 4);
  }

  getRawColor(mem: Memory, n: number): number
  {
    switch (this.colorBits)
    {
      case 16: return mem.lhu(this.address + this.getIndex(n) * 2);
      case 32: return mem.lw(this.address + this.getIndex(n) * 4);
      default: throw new Error('Invalid palette bit depth');
    }
  }

  getColor(mem: Memory, n: number): number
  {
    return PixelConverter.unpackToRGBA(this.pixelFormat, this.getRawColor(mem, n));
  }
}

export class MipmapState
{
  constructor(public texture: TextureState, private data: Uint32Array, public index: number) {}

  get bufferWidth(): number { return param16(this.data[Op.TEXBUFWIDTH0 + this.index], 0); }
  get address(): number
  {
    return param24(this.data[Op.TEXADDR0 + this.index]) |
           ((param8(this.data[Op.TEXBUFWIDTH0 + this.index], 16) << 24));
  }
  get addressEnd(): number { return this.address + this.sizeInBytes; }
  get textureWidth(): number { return 1 << param4(this.data[Op.TSIZE0 + this.index], 0); }
  get textureHeight(): number { return 1 << param4(this.data[Op.TSIZE0 + this.index], 8); }
  get size(): number { return this.bufferWidth * this.textureHeight; }
  get sizeInBytes(): number { return PixelConverter.getSizeInBytes(this.texture.pixelFormat, this.size); }
}

export class TextureState
{
  matrix: Float32Array;
  clut: ClutState;
  mipmaps: MipmapState[];

  constructor(private data: Uint32Array)
  {
    this.matrix = createMatrix4x4(this.data, Op.MAT_TEXTURE);
    this.clut = new ClutState(this.data);
    this.mipmaps = [
      new MipmapState(this, this.data, 0),
      new MipmapState(this, this.data, 1),
      new MipmapState(this, this.data, 2),
      new MipmapState(this, this.data, 3),
      new MipmapState(this, this.data, 4),
      new MipmapState(this, this.data, 5),
      new MipmapState(this, this.data, 6),
      new MipmapState(this, this.data, 7)
    ];
  }

  get mipmap(): MipmapState { return this.mipmaps[0]; }

  get hasClut(): boolean { return PixelFormatUtils.hasClut(this.pixelFormat); }

  get wrapU(): WrapMode { return param8(this.data[Op.TWRAP], 0) as WrapMode; }
  get wrapV(): WrapMode { return param8(this.data[Op.TWRAP], 8) as WrapMode; }

  get levelMode(): TextureLevelMode { return param8(this.data[Op.TBIAS], 0) as TextureLevelMode; }
  get mipmapBias(): number { return param8(this.data[Op.TBIAS], 16) / 16; }

  get offsetU(): number { return float1(this.data[Op.TEXOFFSETU]); }
  get offsetV(): number { return float1(this.data[Op.TEXOFFSETV]); }

  get scaleU(): number { return float1(this.data[Op.TEXSCALEU]); }
  get scaleV(): number { return float1(this.data[Op.TEXSCALEV]); }

  get shadeU(): number { return param2(this.data[Op.TEXTURE_ENV_MAP_MATRIX], 0); }
  get shadeV(): number { return param2(this.data[Op.TEXTURE_ENV_MAP_MATRIX], 8); }

  get effect(): TextureEffect { return param8(this.data[Op.TFUNC], 0) as TextureEffect; }
  get hasAlpha(): boolean { return this.colorComponent === TextureColorComponent.Rgba; }
  get colorComponent(): TextureColorComponent { return param8(this.data[Op.TFUNC], 8) as TextureColorComponent; }
  get fragment2X(): boolean { return param8(this.data[Op.TFUNC], 16) !== 0; }
  get envColor(): Color { return new Color().setRGB(param24(this.data[Op.TEC])); }

  get pixelFormat(): PixelFormat { return param4(this.data[Op.TPSM], 0) as PixelFormat; }

  get slopeLevel(): number { return float1(this.data[Op.TSLOPE]); }

  get swizzled(): boolean { return param8(this.data[Op.TMODE], 0) !== 0; }
  get mipmapShareClut(): boolean { return param8(this.data[Op.TMODE], 8) !== 0; }
  get mipmapMaxLevel(): boolean { return param8(this.data[Op.TMODE], 16) !== 0; }

  get filterMinification(): TextureFilter { return param8(this.data[Op.TFLT], 0) as TextureFilter; }
  get filterMagnification(): TextureFilter { return param8(this.data[Op.TFLT], 8) as TextureFilter; }
  get enabled(): boolean { return bool1(this.data[Op.TEXTUREMAPENABLE]); }

  get textureMapMode(): TextureMapMode { return param8(this.data[Op.TMAP], 0) as TextureMapMode; }
  get textureProjectionMapMode(): TextureProjectionMapMode { return param8(this.data[Op.TMAP], 8) as TextureProjectionMapMode; }

  get tmode(): number { return this.data[Op.TMODE]; }

  getPixelsSize(size: number): number
  {
    return PixelConverter.getSizeInBytes(this.pixelFormat, size);
  }

  get textureComponentsCount(): number
  {
    switch (this.textureMapMode)
    {
      case TextureMapMode.GU_TEXTURE_COORDS:
        return 2;
      case TextureMapMode.GU_TEXTURE_MATRIX:
        switch (this.textureProjectionMapMode)
        {
          case TextureProjectionMapMode.GU_NORMAL:
          case TextureProjectionMapMode.GU_NORMALIZED_NORMAL:
          case TextureProjectionMapMode.GU_POSITION:
            return 3;
          case TextureProjectionMapMode.GU_UV:
            return 2;
        }
        return 2;
      case TextureMapMode.GU_ENVIRONMENT_MAP:
        return 2;
      default:
        throw new Error('Invalid textureMapMode');
    }
  }

  getHashSlow(textureData: Uint8Array, clutData: Uint8Array | null): string
  {
    const hash: (number | string)[] = [];
    hash.push(this.hashArray(textureData));
    hash.push(this.mipmap.address);
    hash.push(this.mipmap.textureWidth);
    hash.push(this.colorComponent);
    hash.push(this.mipmap.textureHeight);
    hash.push(+this.swizzled);
    hash.push(+this.pixelFormat);
    if (this.hasClut && clutData)
    {
      hash.push(this.clut.getHashFast());
      hash.push(this.hashArray(clutData));
    }
    return hash.join('_');
  }

  private hashArray(data: Uint8Array): number
  {
    let hash = 0;
    for (let i = 0; i < data.length; i += 4)
    {
      hash = (hash * 31 + data[i]) | 0;
    }
    return hash >>> 0;
  }
}

// ============================================
// Main GPU State
// ============================================

export class GpuState
{
  data = new Uint32Array(512);
  dataf = new Float32Array(this.data.buffer);

  copyFrom(that: GpuState): this
  {
    this.data.set(that.data);
    return this;
  }

  writeData(data: Uint32Array): this
  {
    this.data.set(data);
    return this;
  }

  readData(): Uint32Array
  {
    return new Uint32Array(this.data);
  }

  // State components
  frameBuffer = new GpuFrameBufferState(this.data);
  vertex = new VertexState(this.data);
  stencil = new StencilState(this.data);
  skinning = new SkinningState(this.data);

  // Matrices
  projectionMatrix = createMatrix4x4(this.data, Op.MAT_PROJ);
  viewMatrix = createMatrix4x3(this.data, Op.MAT_VIEW);
  worldMatrix = createMatrix4x3(this.data, Op.MAT_WORLD);

  // Other state
  viewport = new ViewPort(this.data);
  region = new Region(this.data);
  offset = new OffsetState(this.data);
  fog = new Fog(this.data);
  clipPlane = new ClipPlane(this.data);
  logicOp = new LogicOp(this.data);
  lightning = new Lightning(this.data);
  alphaTest = new AlphaTest(this.data);
  blending = new Blending(this.data);
  patch = new PatchState(this.data);
  texture = new TextureState(this.data);
  lineSmoothState = new LineSmoothState(this.data);
  patchCullingState = new PatchCullingState(this.data);
  culling = new CullingState(this.data);
  dithering = new DitheringState(this.data);
  colorTest = new ColorTestState(this.data);
  depthTest = new DepthTestState(this.data);

  // Computed properties
  get clearing(): boolean { return param1(this.data[Op.CLEAR], 0) !== 0; }
  get clearFlags(): number { return param8(this.data[Op.CLEAR], 8); }
  get baseAddress(): number { return ((param24(this.data[Op.BASE]) << 8) & 0xff000000); }

  set baseOffset(value: number)
  {
    this.data[Op.OFFSETADDR] &= ~0x00FFFFFF;
    this.data[Op.OFFSETADDR] |= (value >>> 8) & 0x00FFFFFF;
  }

  get baseOffset(): number { return param24(this.data[Op.OFFSETADDR]) << 8; }
  get indexAddress(): number { return param24(this.data[Op.IADDR]); }
  get shadeModel(): ShadingModelEnum { return param16(this.data[Op.SHADEMODE], 0) as ShadingModelEnum; }
  get ambientModelColor(): Color { return new Color().setRGB_A(this.data[Op.MATERIALAMBIENT], this.data[Op.MATERIALALPHA]); }
  get diffuseModelColor(): Color { return new Color().setRGB(this.data[Op.MATERIALDIFFUSE]); }
  get specularModelColor(): Color { return new Color().setRGB(this.data[Op.MATERIALSPECULAR]); }
  get drawPixelFormat(): PixelFormat { return param4(this.data[Op.PSM], 0) as PixelFormat; }

  writeFloat(index: number, offset: number, data: number): void
  {
    this.dataf[offset + this.data[index]++] = data;
  }

  getMorphWeight(index: number): number
  {
    return float1(this.data[Op.MORPHWEIGHT0 + index]);
  }

  getAddressRelativeToBase(relativeAddress: number): number
  {
    return this.baseAddress | relativeAddress;
  }

  getAddressRelativeToBaseOffset(relativeAddress: number): number
  {
    return (this.baseAddress | relativeAddress) + this.baseOffset;
  }
}
