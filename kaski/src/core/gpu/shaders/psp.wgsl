// PSP GPU Shaders - WGSL
// Handles vertex transformation, texturing, and fragment processing

// ============================================
// Structures
// ============================================

struct Uniforms {
  modelViewProjMatrix: mat4x4<f32>,
  texMatrix: mat4x4<f32>,
  uniformColor: vec4<f32>,
  textureSize: vec2<f32>,
  pixelSize: vec2<f32>,
  time: f32,
  tfx: u32,           // Texture effect
  tcc: u32,           // Texture color component
  alphaTestFunc: u32,
  alphaTestReference: u32,
  alphaTestMask: u32,
  enableColors: u32,
  enableTextures: u32,
  enableBilinear: u32,
  enableSkinning: u32,
  _padding: u32,
}

struct VertexInput {
  @location(0) position: vec4<f32>,
  @location(1) texcoord: vec4<f32>,
  @location(2) color: vec4<f32>,
  @location(3) normal: vec4<f32>,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) texcoord: vec4<f32>,
  @location(1) color: vec4<f32>,
  @location(2) normal: vec4<f32>,
}

// ============================================
// Bindings
// ============================================

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var texSampler: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;

// ============================================
// Vertex Shader
// ============================================

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  // Transform position
  output.position = uniforms.modelViewProjMatrix * input.position;

  // Transform texture coordinates
  output.texcoord = uniforms.texMatrix * input.texcoord;

  // Pass through color and normal
  output.color = input.color;
  output.normal = input.normal;

  return output;
}

// ============================================
// Fragment Shader
// ============================================

// Texture effect constants
const TFX_MODULATE: u32 = 0u;
const TFX_DECAL: u32 = 1u;
const TFX_BLEND: u32 = 2u;
const TFX_REPLACE: u32 = 3u;
const TFX_ADD: u32 = 4u;

// Texture color component constants
const TCC_RGB: u32 = 0u;
const TCC_RGBA: u32 = 1u;

// Alpha test function constants
const ALPHA_NEVER: u32 = 0u;
const ALPHA_ALWAYS: u32 = 1u;
const ALPHA_EQUAL: u32 = 2u;
const ALPHA_NOT_EQUAL: u32 = 3u;
const ALPHA_LESS: u32 = 4u;
const ALPHA_LESS_OR_EQUAL: u32 = 5u;
const ALPHA_GREATER: u32 = 6u;
const ALPHA_GREATER_OR_EQUAL: u32 = 7u;

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  var fragColor: vec4<f32>;

  // Start with vertex color or uniform color
  if (uniforms.enableColors != 0u) {
    fragColor = input.color;
  } else {
    fragColor = uniforms.uniformColor;
  }

  // Apply texture if enabled
  if (uniforms.enableTextures != 0u) {
    let texColor = textureSample(tex, texSampler, input.texcoord.xy);

    // Apply alpha test
    if (uniforms.alphaTestFunc != ALPHA_ALWAYS) {
      let alphaValue = u32(texColor.a * 255.0) & uniforms.alphaTestMask;
      var discard_frag = false;

      switch (uniforms.alphaTestFunc) {
        case ALPHA_NEVER: {
          discard_frag = true;
        }
        case ALPHA_EQUAL: {
          discard_frag = alphaValue != uniforms.alphaTestReference;
        }
        case ALPHA_NOT_EQUAL: {
          discard_frag = alphaValue == uniforms.alphaTestReference;
        }
        case ALPHA_LESS: {
          discard_frag = alphaValue >= uniforms.alphaTestReference;
        }
        case ALPHA_LESS_OR_EQUAL: {
          discard_frag = alphaValue > uniforms.alphaTestReference;
        }
        case ALPHA_GREATER: {
          discard_frag = alphaValue <= uniforms.alphaTestReference;
        }
        case ALPHA_GREATER_OR_EQUAL: {
          discard_frag = alphaValue < uniforms.alphaTestReference;
        }
        default: {}
      }

      if (discard_frag) {
        discard;
      }
    }

    // Apply texture effect
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
          fragColor = vec4<f32>(
            texColor.rgb * fragColor.rgb,
            texColor.a
          );
        }
      }
      case TFX_BLEND: {
        fragColor = mix(texColor, fragColor, 0.5);
      }
      case TFX_REPLACE: {
        fragColor = vec4<f32>(
          texColor.rgb,
          select(fragColor.a, texColor.a, uniforms.tcc == TCC_RGBA)
        );
      }
      case TFX_ADD: {
        fragColor = vec4<f32>(
          fragColor.rgb + texColor.rgb,
          select(fragColor.a, texColor.a * fragColor.a, uniforms.tcc == TCC_RGBA)
        );
      }
      default: {
        fragColor = vec4<f32>(1.0, 0.0, 1.0, 1.0); // Magenta for unknown
      }
    }
  }

  return fragColor;
}

// ============================================
// Clearing Shader (separate pipeline)
// ============================================

@fragment
fn fs_clear(input: VertexOutput) -> @location(0) vec4<f32> {
  return input.color;
}
