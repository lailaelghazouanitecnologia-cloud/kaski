/**
 * WebGPU Driver
 *
 * Modern GPU rendering backend using WebGPU.
 * Replaces the legacy WebGL implementation.
 */

import {
  GpuState,
  PrimitiveType,
  ColorEnum,
  CullingDirection,
  GuBlendingFactor,
  GuBlendingEquation,
  TextureFilter,
  WrapMode,
} from './GpuState';
import { VertexInfo } from './VertexInfo';
import {
  OptimizedDrawBuffer,
  OptimizedBatch,
  BatchesTransfer,
  OptimizedBatchTransfer,
} from './VertexBuffer';

// ============================================
// Types
// ============================================

export interface GpuDriverStats
{
  batchCount: number;
  drawCalls: number;
  triangles: number;
}

// ============================================
// Shader Source
// ============================================

const PSP_SHADER_SOURCE = `
// PSP GPU Shaders - WGSL

struct Uniforms {
  modelViewProjMatrix: mat4x4<f32>,
  texMatrix: mat4x4<f32>,
  uniformColor: vec4<f32>,
  textureSize: vec2<f32>,
  pixelSize: vec2<f32>,
  time: f32,
  tfx: u32,
  tcc: u32,
  alphaTestFunc: u32,
  alphaTestReference: u32,
  alphaTestMask: u32,
  enableColors: u32,
  enableTextures: u32,
  enableBilinear: u32,
  enableSkinning: u32,
  hasVertexColor: u32,
  hasTexture: u32,
  _padding: u32,
}

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) texcoord: vec2<f32>,
  @location(2) color: vec4<f32>,
  @location(3) normal: vec3<f32>,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) texcoord: vec2<f32>,
  @location(1) color: vec4<f32>,
  @location(2) normal: vec3<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var texSampler: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uniforms.modelViewProjMatrix * vec4<f32>(input.position, 1.0);
  output.texcoord = (uniforms.texMatrix * vec4<f32>(input.texcoord, 0.0, 1.0)).xy;
  output.color = select(uniforms.uniformColor, input.color, uniforms.hasVertexColor != 0u);
  output.normal = input.normal;
  return output;
}

const TFX_MODULATE: u32 = 0u;
const TFX_DECAL: u32 = 1u;
const TFX_BLEND: u32 = 2u;
const TFX_REPLACE: u32 = 3u;
const TFX_ADD: u32 = 4u;
const TCC_RGB: u32 = 0u;
const TCC_RGBA: u32 = 1u;

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  var fragColor = input.color;

  if (uniforms.hasTexture != 0u && uniforms.enableTextures != 0u) {
    let texColor = textureSample(tex, texSampler, input.texcoord);

    switch (uniforms.tfx) {
      case TFX_MODULATE: {
        fragColor = vec4<f32>(
          texColor.rgb * fragColor.rgb,
          select(texColor.a, fragColor.a * texColor.a, uniforms.tcc == TCC_RGBA)
        );
      }
      case TFX_DECAL: {
        if (uniforms.tcc == TCC_RGB) {
          fragColor = texColor;
        } else {
          fragColor = vec4<f32>(texColor.rgb * fragColor.rgb, texColor.a);
        }
      }
      case TFX_BLEND: {
        fragColor = mix(texColor, fragColor, 0.5);
      }
      case TFX_REPLACE: {
        fragColor = vec4<f32>(texColor.rgb, select(fragColor.a, texColor.a, uniforms.tcc == TCC_RGBA));
      }
      case TFX_ADD: {
        fragColor = vec4<f32>(fragColor.rgb + texColor.rgb, select(fragColor.a, texColor.a * fragColor.a, uniforms.tcc == TCC_RGBA));
      }
      default: {
        fragColor = vec4<f32>(1.0, 0.0, 1.0, 1.0);
      }
    }
  }

  return fragColor;
}
`;

// ============================================
// Matrix Utilities
// ============================================

function mat4Ortho(
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number
): Float32Array
{
  const out = new Float32Array(16);
  const lr = 1 / (left - right);
  const bt = 1 / (bottom - top);
  const nf = 1 / (near - far);

  out[0] = -2 * lr;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = -2 * bt;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 2 * nf;
  out[11] = 0;
  out[12] = (left + right) * lr;
  out[13] = (top + bottom) * bt;
  out[14] = (far + near) * nf;
  out[15] = 1;

  return out;
}

function mat4Identity(): Float32Array
{
  const out = new Float32Array(16);
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}

function mat4Multiply(a: Float32Array, b: Float32Array): Float32Array
{
  const out = new Float32Array(16);

  for (let i = 0; i < 4; i++)
  {
    for (let j = 0; j < 4; j++)
    {
      out[i * 4 + j] =
        a[i * 4 + 0] * b[0 * 4 + j] +
        a[i * 4 + 1] * b[1 * 4 + j] +
        a[i * 4 + 2] * b[2 * 4 + j] +
        a[i * 4 + 3] * b[3 * 4 + j];
    }
  }

  return out;
}

function mat4From4x3(m: Float32Array): Float32Array
{
  const out = new Float32Array(16);
  out[0] = m[0]; out[1] = m[1]; out[2] = m[2]; out[3] = 0;
  out[4] = m[3]; out[5] = m[4]; out[6] = m[5]; out[7] = 0;
  out[8] = m[6]; out[9] = m[7]; out[10] = m[8]; out[11] = 0;
  out[12] = m[9]; out[13] = m[10]; out[14] = m[11]; out[15] = 1;
  return out;
}

// ============================================
// WebGPU Driver
// ============================================

export class WebGpuDriver
{
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';

  // Pipeline resources
  private pipeline: GPURenderPipeline | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private uniformBindGroup: GPUBindGroup | null = null;
  private sampler: GPUSampler | null = null;
  private dummyTexture: GPUTexture | null = null;
  private dummyTextureView: GPUTextureView | null = null;

  // Vertex/Index buffers
  private vertexBuffer: GPUBuffer | null = null;
  private indexBuffer: GPUBuffer | null = null;

  // Depth/Stencil
  private depthTexture: GPUTexture | null = null;
  private depthTextureView: GPUTextureView | null = null;

  // State
  private state = new GpuState();
  private transformMatrix2d: Float32Array;
  private transformMatrix: Float32Array = mat4Identity();
  private texMatrix: Float32Array = mat4Identity();

  // Stats
  public stats: GpuDriverStats = {
    batchCount: 0,
    drawCalls: 0,
    triangles: 0,
  };

  // Settings
  public enableColors: boolean = true;
  public enableTextures: boolean = true;
  public enableBilinear: boolean = true;
  public enableSkinning: boolean = true;

  constructor(private canvas: HTMLCanvasElement)
  {
    this.transformMatrix2d = mat4Ortho(0, 480, 272, 0, 0, -0xFFFF);
  }

  // ============================================
  // Initialization
  // ============================================

  async init(): Promise<boolean>
  {
    if (!navigator.gpu)
    {
      console.error('WebGPU not supported');
      return false;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter)
    {
      console.error('No WebGPU adapter found');
      return false;
    }

    this.device = await adapter.requestDevice();
    this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;

    if (!this.context)
    {
      console.error('Could not get WebGPU context');
      return false;
    }

    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    });

    await this.createResources();
    return true;
  }

  private async createResources(): Promise<void>
  {
    if (!this.device) return;

    // Create shader module
    const shaderModule = this.device.createShaderModule({
      code: PSP_SHADER_SOURCE,
    });

    // Create uniform buffer (must be 16-byte aligned)
    this.uniformBuffer = this.device.createBuffer({
      size: 256, // Uniforms struct size (padded)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create sampler
    this.sampler = this.device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    // Create dummy 1x1 white texture
    this.dummyTexture = this.device.createTexture({
      size: { width: 1, height: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    this.device.queue.writeTexture(
      { texture: this.dummyTexture },
      new Uint8Array([255, 255, 255, 255]),
      { bytesPerRow: 4 },
      { width: 1, height: 1 }
    );

    this.dummyTextureView = this.dummyTexture.createView();

    // Create bind group layout
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'filtering' },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float' },
        },
      ],
    });

    // Create bind group
    this.uniformBindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.dummyTextureView },
      ],
    });

    // Create pipeline layout
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    // Create depth texture
    this.createDepthTexture();

    // Create render pipeline
    this.pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 48, // 3*4 + 2*4 + 4*4 + 3*4 = 48 bytes
            stepMode: 'vertex',
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },   // position
              { shaderLocation: 1, offset: 12, format: 'float32x2' },  // texcoord
              { shaderLocation: 2, offset: 20, format: 'float32x4' },  // color
              { shaderLocation: 3, offset: 36, format: 'float32x3' },  // normal
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: this.format,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none',
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less-equal',
        format: 'depth24plus-stencil8',
      },
    });

    // Create vertex buffer
    this.vertexBuffer = this.device.createBuffer({
      size: 4 * 1024 * 1024, // 4MB
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Create index buffer
    this.indexBuffer = this.device.createBuffer({
      size: 1024 * 1024, // 1MB
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
  }

  private createDepthTexture(): void
  {
    if (!this.device) return;

    if (this.depthTexture)
    {
      this.depthTexture.destroy();
    }

    this.depthTexture = this.device.createTexture({
      size: {
        width: this.canvas.width,
        height: this.canvas.height,
      },
      format: 'depth24plus-stencil8',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.depthTextureView = this.depthTexture.createView();
  }

  // ============================================
  // Rendering
  // ============================================

  drawBatchesTransfer(transfer: BatchesTransfer): void
  {
    if (!this.device || !this.context || !this.pipeline) return;

    const { buffer, data, batches } = transfer;

    // Upload vertex data
    const vertexData = new Uint8Array(buffer, data.data, data.datasize);
    this.device.queue.writeBuffer(this.vertexBuffer!, 0, vertexData);

    // Upload index data
    const indexData = new Uint16Array(buffer, data.indices, data.indicesCount);
    this.device.queue.writeBuffer(this.indexBuffer!, 0, indexData);

    // Get current texture
    const textureView = this.context.getCurrentTexture().createView();

    // Create render pass
    const commandEncoder = this.device.createCommandEncoder();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: this.depthTextureView!,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
        stencilClearValue: 0,
        stencilLoadOp: 'clear',
        stencilStoreOp: 'store',
      },
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.uniformBindGroup!);
    renderPass.setVertexBuffer(0, this.vertexBuffer!);
    renderPass.setIndexBuffer(this.indexBuffer!, 'uint16');

    // Draw batches
    this.stats.batchCount = 0;
    this.stats.drawCalls = 0;
    this.stats.triangles = 0;

    for (const batch of batches)
    {
      this.drawBatch(renderPass, buffer, batch);
    }

    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  private drawBatch(
    renderPass: GPURenderPassEncoder,
    buffer: ArrayBuffer,
    batch: OptimizedBatchTransfer
  ): void
  {
    if (!this.device || !this.uniformBuffer) return;

    // Read state from batch
    this.state.writeData(new Uint32Array(buffer, batch.stateOffset, 512));

    // Update matrices
    this.updateMatrices();

    // Create uniform data
    const uniformData = new ArrayBuffer(256);
    const uniformView = new DataView(uniformData);
    const uniformF32 = new Float32Array(uniformData);

    // Write matrices (64 bytes each)
    const matrix = this.state.vertex.transform2D ? this.transformMatrix2d : this.transformMatrix;
    uniformF32.set(matrix, 0);           // modelViewProjMatrix (0-63)
    uniformF32.set(this.texMatrix, 16);  // texMatrix (64-127)

    // Write uniform color (128-143)
    const ac = this.state.ambientModelColor;
    uniformF32[32] = ac.r;
    uniformF32[33] = ac.g;
    uniformF32[34] = ac.b;
    uniformF32[35] = ac.a;

    // Write texture size and pixel size (144-159)
    const mipmap = this.state.texture.mipmaps[0];
    uniformF32[36] = mipmap.textureWidth;
    uniformF32[37] = mipmap.textureHeight;
    uniformF32[38] = 1.0 / Math.max(1, mipmap.textureWidth);
    uniformF32[39] = 1.0 / Math.max(1, mipmap.textureHeight);

    // Write scalars (160+)
    uniformF32[40] = performance.now() / 1000.0;  // time

    // Write u32 uniforms (at byte offset 164)
    uniformView.setUint32(164, this.state.texture.effect, true);           // tfx
    uniformView.setUint32(168, this.state.texture.colorComponent, true);   // tcc
    uniformView.setUint32(172, this.state.alphaTest.func, true);           // alphaTestFunc
    uniformView.setUint32(176, this.state.alphaTest.value, true);          // alphaTestReference
    uniformView.setUint32(180, this.state.alphaTest.mask, true);           // alphaTestMask
    uniformView.setUint32(184, this.enableColors ? 1 : 0, true);           // enableColors
    uniformView.setUint32(188, this.enableTextures ? 1 : 0, true);         // enableTextures
    uniformView.setUint32(192, this.enableBilinear ? 1 : 0, true);         // enableBilinear
    uniformView.setUint32(196, this.enableSkinning ? 1 : 0, true);         // enableSkinning
    uniformView.setUint32(200, 1, true);  // hasVertexColor (simplified)
    uniformView.setUint32(204, batch.textureLow > 0 ? 1 : 0, true);        // hasTexture

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

    // Draw
    const indexCount = batch.indexCount;
    const indexStart = batch.indexLow;

    renderPass.drawIndexed(indexCount, 1, indexStart, 0, 0);

    this.stats.batchCount++;
    this.stats.drawCalls++;
    this.stats.triangles += indexCount / 3;
  }

  private updateMatrices(): void
  {
    // Build combined MVP matrix
    const proj = new Float32Array(this.state.projectionMatrix);
    const view = mat4From4x3(this.state.viewMatrix);
    const world = mat4From4x3(this.state.worldMatrix);

    let mvp = mat4Identity();
    mvp = mat4Multiply(mvp, proj);
    mvp = mat4Multiply(mvp, view);
    mvp = mat4Multiply(mvp, world);
    this.transformMatrix = mvp;

    // Build texture matrix
    const tex = this.state.texture;
    const mipmap = tex.mipmaps[0];

    this.texMatrix = mat4Identity();

    if (this.state.vertex.transform2D)
    {
      // 2D mode: scale by buffer width
      this.texMatrix[0] = 1.0 / mipmap.bufferWidth;
      this.texMatrix[5] = 1.0 / mipmap.textureHeight;
    }
    else
    {
      // 3D mode: apply scale and offset
      this.texMatrix[0] = tex.scaleU;
      this.texMatrix[5] = tex.scaleV;
      this.texMatrix[12] = tex.offsetU;
      this.texMatrix[13] = tex.offsetV;
    }
  }

  // ============================================
  // Cleanup
  // ============================================

  destroy(): void
  {
    this.vertexBuffer?.destroy();
    this.indexBuffer?.destroy();
    this.uniformBuffer?.destroy();
    this.depthTexture?.destroy();
    this.dummyTexture?.destroy();
    this.device?.destroy();
  }

  // ============================================
  // Size management
  // ============================================

  setFramebufferSize(width: number, height: number): void
  {
    this.canvas.width = width;
    this.canvas.height = height;
    this.createDepthTexture();
  }

  getFramebufferSize(): { width: number; height: number }
  {
    return {
      width: this.canvas.width,
      height: this.canvas.height,
    };
  }
}
