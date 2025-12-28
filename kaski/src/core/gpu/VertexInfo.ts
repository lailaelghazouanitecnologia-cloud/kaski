/**
 * Vertex Information
 *
 * Parses and describes vertex format from GPU state.
 * Handles variable vertex layouts with optional components.
 */

import { GpuState, NumericEnum, ColorEnum, IndexEnum } from './GpuState';

// ============================================
// Size lookup tables
// ============================================

const NUMERIC_ENUM_SIZES = [0, 1, 2, 4]; // Void, Byte, Short, Float
const COLOR_ENUM_SIZES = [0, 0, 0, 0, 2, 2, 2, 4]; // Void, Invalid x3, 5650, 5551, 4444, 8888

// ============================================
// Vertex Info
// ============================================

export class VertexInfo
{
  // Component offsets within vertex
  weightOffset: number = 0;
  textureOffset: number = 0;
  colorOffset: number = 0;
  normalOffset: number = 0;
  positionOffset: number = 0;

  // Component sizes
  weightSize: number = 0;
  colorSize: number = 0;
  textureSize: number = 0;
  positionSize: number = 0;
  normalSize: number = 0;

  // Other properties
  textureComponentsCount: number = 0;
  align: number = 0;
  size: number = 0;

  // From state
  value: number = -1;
  reversedNormal: boolean = false;
  address: number = 0;

  // Vertex type components
  weight: NumericEnum = NumericEnum.Void;
  texture: NumericEnum = NumericEnum.Void;
  color: ColorEnum = ColorEnum.Void;
  normal: NumericEnum = NumericEnum.Void;
  position: NumericEnum = NumericEnum.Void;

  // Vertex type flags
  index: IndexEnum = IndexEnum.Void;
  weightCount: number = 0;
  morphingVertexCount: number = 0;
  transform2D: boolean = false;

  describe(): string
  {
    return `vertexInfo_${this.value >>> 0}_${this.textureComponentsCount}`;
  }

  clone(): VertexInfo
  {
    return new VertexInfo().copyFrom(this);
  }

  copyFrom(that: VertexInfo): this
  {
    this.weightOffset = that.weightOffset;
    this.textureOffset = that.textureOffset;
    this.colorOffset = that.colorOffset;
    this.normalOffset = that.normalOffset;
    this.positionOffset = that.positionOffset;
    this.textureComponentsCount = that.textureComponentsCount;
    this.value = that.value;
    this.size = that.size;
    this.reversedNormal = that.reversedNormal;
    this.address = that.address;
    this.texture = that.texture;
    this.color = that.color;
    this.normal = that.normal;
    this.position = that.position;
    this.weight = that.weight;
    this.index = that.index;
    this.weightCount = that.weightCount;
    this.morphingVertexCount = that.morphingVertexCount;
    this.transform2D = that.transform2D;
    this.weightSize = that.weightSize;
    this.colorSize = that.colorSize;
    this.textureSize = that.textureSize;
    this.positionSize = that.positionSize;
    this.normalSize = that.normalSize;
    this.align = that.align;
    return this;
  }

  setState(state: GpuState): this
  {
    const vstate = state.vertex;
    this.address = vstate.address;

    if (
      this.value !== vstate.value ||
      this.textureComponentsCount !== state.texture.textureComponentsCount ||
      this.reversedNormal !== vstate.reversedNormal
    )
    {
      this.textureComponentsCount = state.texture.textureComponentsCount;
      this.reversedNormal = vstate.reversedNormal;
      this.value = vstate.value;
      this.texture = vstate.texture;
      this.color = vstate.color;
      this.normal = vstate.normal;
      this.position = vstate.position;
      this.weight = vstate.weight;
      this.index = vstate.index;
      this.weightCount = vstate.weightCount;
      this.morphingVertexCount = vstate.morphingVertexCount;
      this.transform2D = vstate.transform2D;

      this.updateSizeAndPositions();
    }

    return this;
  }

  private nextAligned(value: number, alignment: number): number
  {
    if (alignment <= 0) return value;
    return (value + alignment - 1) & ~(alignment - 1);
  }

  updateSizeAndPositions(): void
  {
    this.weightSize = NUMERIC_ENUM_SIZES[this.weight];
    this.colorSize = COLOR_ENUM_SIZES[this.color];
    this.textureSize = NUMERIC_ENUM_SIZES[this.texture];
    this.positionSize = NUMERIC_ENUM_SIZES[this.position];
    this.normalSize = NUMERIC_ENUM_SIZES[this.normal];

    this.size = 0;

    // Weights
    this.size = this.nextAligned(this.size, this.weightSize);
    this.weightOffset = this.size;
    this.size += this.realWeightCount * this.weightSize;

    // Texture coordinates
    this.size = this.nextAligned(this.size, this.textureSize);
    this.textureOffset = this.size;
    this.size += this.textureComponentsCount * this.textureSize;

    // Color
    this.size = this.nextAligned(this.size, this.colorSize);
    this.colorOffset = this.size;
    this.size += 1 * this.colorSize;

    // Normal
    this.size = this.nextAligned(this.size, this.normalSize);
    this.normalOffset = this.size;
    this.size += 3 * this.normalSize;

    // Position
    this.size = this.nextAligned(this.size, this.positionSize);
    this.positionOffset = this.size;
    this.size += 3 * this.positionSize;

    // Total alignment
    this.align = Math.max(
      this.weightSize,
      this.colorSize,
      this.textureSize,
      this.positionSize,
      this.normalSize
    );
    this.size = this.nextAligned(this.size, this.align);
  }

  oneWeightOffset(n: number): number
  {
    return this.weightOffset + this.weightSize * n;
  }

  // Computed properties
  get realWeightCount(): number { return this.hasWeight ? (this.weightCount + 1) : 0; }
  get realMorphingVertexCount(): number { return this.morphingVertexCount + 1; }

  get hasTexture(): boolean { return this.texture !== NumericEnum.Void; }
  get hasColor(): boolean { return this.color !== ColorEnum.Void; }
  get hasNormal(): boolean { return this.normal !== NumericEnum.Void; }
  get hasPosition(): boolean { return this.position !== NumericEnum.Void; }
  get hasWeight(): boolean { return this.weight !== NumericEnum.Void; }
  get hasIndex(): boolean { return this.index !== IndexEnum.Void; }

  get positionComponents(): number { return 3; }
  get normalComponents(): number { return 3; }
  get colorComponents(): number { return 4; }
  get textureComponents(): number { return this.textureComponentsCount; }

  get hash(): number
  {
    return (this.value + (this.textureComponentsCount * Math.pow(2, 24))) | 0;
  }

  toString(): string
  {
    return `VertexInfo(${JSON.stringify({
      address: this.address,
      texture: this.texture,
      color: this.color,
      normal: this.normal,
      position: this.position,
      weight: this.weight,
      index: this.index,
      realWeightCount: this.realWeightCount,
      morphingVertexCount: this.morphingVertexCount,
      transform2D: this.transform2D,
      size: this.size,
    })})`;
  }
}
