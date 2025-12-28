/**
 * Texture Cache
 *
 * Manages PSP textures with caching for WebGPU.
 * Handles texture format conversion, CLUT palettes, and swizzling.
 */

import { GpuState, TextureFilter, WrapMode } from './GpuState';
import { PixelFormat, PixelConverter, PixelFormatUtils } from '../format/PixelFormat';
import type { Memory } from '../memory/Memory';

// ============================================
// Types
// ============================================

export interface CachedTexture
{
  texture: GPUTexture;
  view: GPUTextureView;
  width: number;
  height: number;
  hash: string;
  address: number;
  addressEnd: number;
  valid: boolean;
}

// ============================================
// Texture Cache
// ============================================

export class TextureCache
{
  private device: GPUDevice;
  private texturesByHash = new Map<string, CachedTexture>();
  private texturesByAddress = new Map<number, CachedTexture>();
  private textures: CachedTexture[] = [];

  constructor(device: GPUDevice)
  {
    this.device = device;
  }

  /**
   * Get or create texture for current state
   */
  getTexture(
    state: GpuState,
    textureData: Uint8Array,
    clutData: Uint8Array | null,
    memory: Memory
  ): CachedTexture | null
  {
    const textureState = state.texture;
    const clutState = textureState.clut;
    const mipmap = textureState.mipmaps[0];

    if (mipmap.bufferWidth === 0 || mipmap.textureWidth === 0 || mipmap.textureHeight === 0)
    {
      return null;
    }

    const hasClut = textureState.hasClut;
    const clutAddress = hasClut ? clutState.address : 0;

    // Fast hash for lookup
    const fastHash = mipmap.address +
      clutAddress * Math.pow(2, 24) +
      textureState.colorComponent * Math.pow(2, 18);

    // Check if texture exists at this address
    let texture = this.texturesByAddress.get(fastHash);

    if (!texture)
    {
      // Create new texture entry
      texture = this.createTexture(mipmap.textureWidth, mipmap.textureHeight, mipmap.address);
      this.texturesByAddress.set(fastHash, texture);
      this.textures.push(texture);
    }

    // Check if content needs updating
    if (!texture.valid)
    {
      const hash = textureState.getHashSlow(textureData, clutData);

      if (this.texturesByHash.has(hash))
      {
        // Reuse existing texture with same content
        texture = this.texturesByHash.get(hash)!;
        this.texturesByAddress.set(fastHash, texture);
      }
      else if (texture.hash !== hash)
      {
        // Update texture content
        this.texturesByHash.delete(texture.hash);
        texture.hash = hash;
        texture.valid = true;
        this.texturesByHash.set(hash, texture);

        this.updateTextureFromState(texture, state, textureData, clutData, memory);
      }
    }

    return texture;
  }

  /**
   * Create a new GPU texture
   */
  private createTexture(width: number, height: number, address: number): CachedTexture
  {
    const texture = this.device.createTexture({
      size: { width, height },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    return {
      texture,
      view: texture.createView(),
      width,
      height,
      hash: '',
      address,
      addressEnd: address,
      valid: false,
    };
  }

  /**
   * Update texture content from PSP memory
   */
  private updateTextureFromState(
    cached: CachedTexture,
    state: GpuState,
    textureData: Uint8Array,
    clutData: Uint8Array | null,
    memory: Memory
  ): void
  {
    const textureState = state.texture;
    const clutState = textureState.clut;
    const mipmap = textureState.mipmaps[0];

    const w = mipmap.textureWidth;
    const h = mipmap.textureHeight;
    const w2 = mipmap.bufferWidth;

    // Copy texture data
    const srcData = new Uint8Array(PixelConverter.getSizeInBytes(textureState.pixelFormat, w2 * h));
    srcData.set(textureData.subarray(0, srcData.length));

    // Unswizzle if needed
    if (textureState.swizzled)
    {
      PixelConverter.unswizzleInline(textureState.pixelFormat, srcData, w2, h);
    }

    // Build CLUT if needed
    let clut: Uint32Array | null = null;
    if (textureState.hasClut && clutData)
    {
      clut = new Uint32Array(clutState.numberOfColors);
      for (let n = 0; n < clut.length; n++)
      {
        clut[n] = clutState.getColor(memory, n);
      }
    }

    // Decode to RGBA
    const rgba = PixelConverter.decode(
      textureState.pixelFormat,
      srcData,
      new Uint32Array(w2 * h),
      textureState.hasAlpha,
      clut,
      0, 0, 0xFF
    );

    // Convert to Uint8Array for upload
    const rgbaBytes = new Uint8Array(rgba.buffer);

    // Resize texture if needed
    if (cached.width !== w2 || cached.height !== h)
    {
      cached.texture.destroy();
      cached.texture = this.device.createTexture({
        size: { width: w2, height: h },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });
      cached.view = cached.texture.createView();
      cached.width = w2;
      cached.height = h;
    }

    // Upload to GPU
    this.device.queue.writeTexture(
      { texture: cached.texture },
      rgbaBytes,
      { bytesPerRow: w2 * 4 },
      { width: w2, height: h }
    );

    cached.address = mipmap.address;
    cached.addressEnd = mipmap.addressEnd;
  }

  /**
   * Invalidate all textures
   */
  invalidateAll(): void
  {
    for (const texture of this.textures)
    {
      texture.valid = false;
    }
  }

  /**
   * Invalidate textures in memory range
   */
  invalidateRange(low: number, high: number): void
  {
    for (const texture of this.textures)
    {
      if (texture.address >= low && texture.addressEnd <= high)
      {
        texture.valid = false;
      }
    }
  }

  /**
   * Create sampler for texture
   */
  createSampler(
    minFilter: TextureFilter,
    magFilter: TextureFilter,
    wrapU: WrapMode,
    wrapV: WrapMode,
    enableBilinear: boolean
  ): GPUSampler
  {
    const getFilter = (filter: TextureFilter, bilinear: boolean): GPUFilterMode =>
    {
      if (!bilinear) return 'nearest';
      return filter === TextureFilter.Linear ? 'linear' : 'nearest';
    };

    const getAddressMode = (wrap: WrapMode): GPUAddressMode =>
    {
      return wrap === WrapMode.Repeat ? 'repeat' : 'clamp-to-edge';
    };

    return this.device.createSampler({
      magFilter: getFilter(magFilter, enableBilinear),
      minFilter: getFilter(minFilter, enableBilinear),
      addressModeU: getAddressMode(wrapU),
      addressModeV: getAddressMode(wrapV),
    });
  }

  /**
   * Clean up resources
   */
  destroy(): void
  {
    for (const texture of this.textures)
    {
      texture.texture.destroy();
    }
    this.textures = [];
    this.texturesByHash.clear();
    this.texturesByAddress.clear();
  }
}
