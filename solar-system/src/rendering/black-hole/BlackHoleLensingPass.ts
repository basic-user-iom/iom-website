/**
 * Bounded real-time black-hole lensing pass.
 *
 * Reference lineage and adaptation note:
 * The High/Ultra path adapts the nonrotating ray-parameter mappings,
 * precomputed deflection lookup, and inward-ray branch of `TraceRay` from Eric
 * Bruneton's `black_hole_shader` at commit
 * e72b3f293409893a6fa25528b29572c96fc57f57
 * (https://github.com/ebruneton/black_hole_shader). It uses unmodified copies
 * of the official demo's `deflection.dat` and `inverse_radius.dat` tables.
 * Changes are isolated here: GLSL macros/types were ported to the Three.js
 * ShaderPass dialect, filtering is explicit bilinear sampling, and the
 * deflected direction is projected back into the existing 2D scene buffer for
 * a static, distant observer. The inverse-radius table is consulted as a
 * bounded ray-domain guard; this pass does not claim Bruneton's cubemap star
 * filtering, accretion-disc intersection shading, Doppler model, moving-camera
 * model, or full-scene equivalence. Medium remains an authored simple fallback.
 * This visual effect is separate from the Newtonian encounter integrator.
 *
 * Copyright (c) 2020 Eric Bruneton
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its
 *    contributors may be used to endorse or promote products derived from
 *    this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

import {
  ClampToEdgeWrapping,
  DataTexture,
  FloatType,
  NearestFilter,
  RGFormat,
  Uniform,
  Vector2,
} from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import type { VisualQuality } from '../bodies/VisualQuality';
import {
  EMPTY_BLACK_HOLE_LENSING_DIAGNOSTICS,
  type BlackHoleLensingDiagnostics,
  type BlackHoleLensingPath,
} from './BlackHoleRenderTypes';
import {
  BRUNETON_DEFLECTION_TABLE_SPEC,
  BRUNETON_INVERSE_RADIUS_TABLE_SPEC,
  BRUNETON_REFERENCE_COMMIT,
  loadBrunetonLookupTables,
  type BrunetonLookupTables,
} from './BrunetonLensingTables';

export interface BlackHoleLensingPassOptions {
  readonly initialQuality?: VisualQuality;
  readonly highQualitySupported?: boolean;
  /** Test/offline injection point; production uses the bundled official data. */
  readonly tableLoader?: () => Promise<Readonly<BrunetonLookupTables>>;
}

export interface BlackHoleLensingFrame {
  readonly active: boolean;
  readonly centerNdc: readonly [number, number];
  readonly eventHorizonRadiusNdc: number;
  readonly viewportAspect: number;
  readonly redshiftStrength?: number;
}

interface LensingUniforms {
  readonly tDiffuse: Uniform<unknown>;
  readonly center: Uniform<Vector2>;
  readonly eventHorizonRadius: Uniform<number>;
  readonly influenceRadius: Uniform<number>;
  readonly viewportAspect: Uniform<number>;
  readonly strength: Uniform<number>;
  readonly redshiftStrength: Uniform<number>;
  readonly mode: Uniform<number>;
  readonly rayDeflectionTexture: Uniform<DataTexture | null>;
  readonly rayInverseRadiusTexture: Uniform<DataTexture | null>;
}

export type BlackHoleLensingTableStatus =
  | 'deferred'
  | 'loading'
  | 'ready'
  | 'error'
  | 'disposed';

export interface BlackHoleLensingTableDiagnostics {
  readonly status: BlackHoleLensingTableStatus;
  readonly referenceCommit: typeof BRUNETON_REFERENCE_COMMIT;
  readonly deflectionDimensions: readonly [number, number];
  readonly inverseRadiusDimensions: readonly [number, number];
  readonly error: string | null;
}

const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D rayDeflectionTexture;
uniform sampler2D rayInverseRadiusTexture;
uniform vec2 center;
uniform float eventHorizonRadius;
uniform float influenceRadius;
uniform float viewportAspect;
uniform float strength;
uniform float redshiftStrength;
uniform float mode;

varying vec2 vUv;

const float PI = 3.14159265358979323846;
const float kMu = 4.0 / 27.0;
const vec2 RAY_DEFLECTION_TEXTURE_SIZE = vec2(512.0, 512.0);
const vec2 RAY_INVERSE_RADIUS_TEXTURE_SIZE = vec2(64.0, 32.0);

vec2 safeUv(vec2 value) {
  return clamp(value, vec2(0.001), vec2(0.999));
}

// Manual bilinear filtering keeps RG32F lookup behavior deterministic without
// requiring OES_texture_float_linear. The uploaded textures use NEAREST.
vec2 SampleBilinearRg(sampler2D table, vec2 textureCoord, vec2 textureSize) {
  vec2 samplePosition = clamp(
    textureCoord * textureSize - 0.5,
    vec2(0.0),
    textureSize - 1.0
  );
  vec2 base = floor(samplePosition);
  vec2 fraction = fract(samplePosition);
  vec2 p0 = clamp(base, vec2(0.0), textureSize - 1.0);
  vec2 p1 = min(p0 + 1.0, textureSize - 1.0);
  vec2 a = texture2D(table, (vec2(p0.x, p0.y) + 0.5) / textureSize).rg;
  vec2 b = texture2D(table, (vec2(p1.x, p0.y) + 0.5) / textureSize).rg;
  vec2 c = texture2D(table, (vec2(p0.x, p1.y) + 0.5) / textureSize).rg;
  vec2 d = texture2D(table, (vec2(p1.x, p1.y) + 0.5) / textureSize).rg;
  return mix(mix(a, b, fraction.x), mix(c, d, fraction.x), fraction.y);
}

// The following mappings and lookup functions are direct GLSL-dialect ports
// of Bruneton's black_hole/functions.glsl at the pinned commit above.
float GetRayDeflectionTextureUFromEsquare(float eSquare) {
  if (eSquare < kMu) {
    return 0.5 - sqrt(-log(1.0 - eSquare / kMu) * (1.0 / 50.0));
  }
  return 0.5 + sqrt(-log(1.0 - kMu / eSquare) * (1.0 / 50.0));
}

float GetUapsisFromEsquare(float eSquare) {
  float x = (2.0 / kMu) * eSquare - 1.0;
  return 1.0 / 3.0 + (2.0 / 3.0) * sin(asin(x) * (1.0 / 3.0));
}

float GetRayDeflectionTextureVFromEsquareAndU(float eSquare, float u) {
  if (eSquare > kMu) {
    float x = u < 2.0 / 3.0
      ? -sqrt(2.0 / 3.0 - u)
      : sqrt(u - 2.0 / 3.0);
    return (sqrt(2.0 / 3.0) + x) /
      (sqrt(2.0 / 3.0) + sqrt(1.0 / 3.0));
  }
  return 1.0 - sqrt(max(1.0 - u / GetUapsisFromEsquare(eSquare), 0.0));
}

float GetTextureCoordFromUnitRange(float x, float textureSize) {
  return 0.5 / textureSize + x * (1.0 - 1.0 / textureSize);
}

vec2 LookupRayDeflection(float eSquare, float u, out vec2 deflectionApsis) {
  float texU = GetTextureCoordFromUnitRange(
    GetRayDeflectionTextureUFromEsquare(eSquare),
    RAY_DEFLECTION_TEXTURE_SIZE.x
  );
  float texV = GetTextureCoordFromUnitRange(
    GetRayDeflectionTextureVFromEsquareAndU(eSquare, u),
    RAY_DEFLECTION_TEXTURE_SIZE.y
  );
  float texVApsis = GetTextureCoordFromUnitRange(
    1.0,
    RAY_DEFLECTION_TEXTURE_SIZE.y
  );
  deflectionApsis = SampleBilinearRg(
    rayDeflectionTexture,
    vec2(texU, texVApsis),
    RAY_DEFLECTION_TEXTURE_SIZE
  );
  return SampleBilinearRg(
    rayDeflectionTexture,
    vec2(texU, texV),
    RAY_DEFLECTION_TEXTURE_SIZE
  );
}

float GetPhiUbFromEsquare(float eSquare) {
  return (1.0 + eSquare) /
    (1.0 / 3.0 + 2.0 * eSquare * sqrt(eSquare));
}

float GetRayInverseRadiusTextureUFromEsquare(float eSquare) {
  return 1.0 / (1.0 + 6.0 * eSquare);
}

vec2 LookupRayInverseRadius(float eSquare, float phi) {
  float texU = GetTextureCoordFromUnitRange(
    GetRayInverseRadiusTextureUFromEsquare(eSquare),
    RAY_INVERSE_RADIUS_TEXTURE_SIZE.x
  );
  float texV = GetTextureCoordFromUnitRange(
    phi / GetPhiUbFromEsquare(eSquare),
    RAY_INVERSE_RADIUS_TEXTURE_SIZE.y
  );
  return SampleBilinearRg(
    rayInverseRadiusTexture,
    vec2(texU, texV),
    RAY_INVERSE_RADIUS_TEXTURE_SIZE
  );
}

float TraceInwardRayDeflection(float u, float uDot, float eSquare) {
  if (eSquare < kMu && u > 2.0 / 3.0) return -1.0;
  vec2 deflectionApsis;
  vec2 deflection = LookupRayDeflection(eSquare, u, deflectionApsis);
  float rayDeflection = deflection.x;
  if (uDot > 0.0) {
    rayDeflection = eSquare < kMu
      ? 2.0 * deflectionApsis.x - rayDeflection
      : -1.0;
  }
  return rayDeflection;
}

vec3 SimplifiedLensing(
  vec2 metricDelta,
  float radius,
  float horizon,
  float influence,
  float falloff
) {
  float safeRadius = max(radius, horizon * 1.035);
  vec2 radial = metricDelta / max(safeRadius, 0.000001);
  float compactness = clamp(horizon / safeRadius, 0.0, 0.965);
  float denominator = max(1.0 - 0.78 * compactness, 0.18);
  float deflection = horizon * compactness / denominator * strength * falloff;
  vec2 metricWarp = metricDelta + radial * deflection;
  vec2 warpedUv = center + vec2(
    metricWarp.x / max(viewportAspect, 0.001),
    metricWarp.y
  );
  vec3 color = texture2D(tDiffuse, safeUv(warpedUv)).rgb;
  float redshift = redshiftStrength * compactness * falloff;
  color = mix(
    color,
    vec3(color.r * 0.92, color.g * 0.34, color.b * 0.12),
    redshift * 0.38
  );
  float silhouette = 1.0 - smoothstep(horizon * 0.9, horizon * 1.025, radius);
  return color * (1.0 - silhouette);
}

void main() {
  if (mode < 0.5 || eventHorizonRadius <= 0.0) {
    gl_FragColor = texture2D(tDiffuse, vUv);
    return;
  }

  vec2 delta = vUv - center;
  vec2 metricDelta = vec2(delta.x * max(viewportAspect, 0.001), delta.y);
  float radius = length(metricDelta);
  float horizon = max(eventHorizonRadius, 0.000001);
  float influence = max(influenceRadius, horizon * 2.0);
  float falloff = 1.0 - smoothstep(horizon, influence, radius);
  if (mode < 1.5) {
    gl_FragColor = vec4(
      SimplifiedLensing(metricDelta, radius, horizon, influence, falloff),
      1.0
    );
    return;
  }

  if (radius >= influence) {
    gl_FragColor = texture2D(tDiffuse, vUv);
    return;
  }

  // Static-observer camera-plane adapter. With p_r=64 Schwarzschild radii,
  // normalized image radius maps to tan(theta)=r/(p_r*horizon). This preserves
  // the far-observer critical impact parameter (3*sqrt(3)/2 R_s) while the
  // actual deflection comes from Bruneton's validated precomputed table.
  const float observerRadius = 64.0;
  float normalizedImageRadius = radius / horizon;
  float viewAngle = atan(normalizedImageRadius / observerRadius);
  float u = 1.0 / observerRadius;
  float uDot = 1.0 / max(normalizedImageRadius, 0.000001);
  float eSquare = uDot * uDot + u * u * (1.0 - u);
  float lookupESquare = min(eSquare, kMu * (1.0 - 0.00001));
  float rayDeflection = TraceInwardRayDeflection(u, uDot, lookupESquare);

  // The inverse-radius table is part of Bruneton's disc-intersection model.
  // This 2D adapter cannot reproduce that model, but samples the current beam
  // as a strict table-domain/finite guard before applying its direction.
  float phiUpperBound = GetPhiUbFromEsquare(lookupESquare);
  float probePhi = min(abs(rayDeflection), phiUpperBound * 0.999);
  vec2 inverseRadiusProbe = LookupRayInverseRadius(lookupESquare, probePhi);
  bool invalidProbe = !(
    inverseRadiusProbe.x >= 0.0 && inverseRadiusProbe.x <= 1024.0 &&
    inverseRadiusProbe.y >= 0.0 && inverseRadiusProbe.y <= 1024.0
  );
  if (invalidProbe) {
    gl_FragColor = texture2D(tDiffuse, vUv);
    return;
  }

  float sourceAngle = viewAngle - rayDeflection;
  float sourceMetricRadius = clamp(
    tan(sourceAngle) * observerRadius * horizon,
    -influence * 4.0,
    influence * 4.0
  );
  vec2 radial = metricDelta / max(radius, 0.000001);
  vec2 sourceMetricDelta = radial * sourceMetricRadius;
  vec2 sourceUv = center + vec2(
    sourceMetricDelta.x / max(viewportAspect, 0.001),
    sourceMetricDelta.y
  );
  vec2 sampleUv = mix(vUv, sourceUv, falloff);
  vec3 color = texture2D(tDiffuse, safeUv(sampleUv)).rgb;

  float compactness = clamp(horizon / max(radius, horizon), 0.0, 1.0);
  float redshift = redshiftStrength * compactness * falloff;
  color = mix(
    color,
    vec3(color.r * 0.92, color.g * 0.34, color.b * 0.12),
    redshift * 0.34
  );

  // e^2 >= mu is Bruneton's captured-ray branch. fwidth anti-aliases the
  // precomputed critical curve without inventing an image-space ring formula.
  float captureWidth = max(fwidth(eSquare) * 1.5, kMu * 0.0015);
  float captureMask = smoothstep(
    kMu - captureWidth,
    kMu + captureWidth,
    eSquare
  );
  gl_FragColor = vec4(color * (1.0 - captureMask), 1.0);
}
`;

export class BlackHoleLensingPass {
  public readonly pass: ShaderPass;

  private readonly uniforms: LensingUniforms;
  private readonly highQualitySupported: boolean;
  private readonly tableAbortController = new AbortController();
  private readonly tableLoader: () => Promise<Readonly<BrunetonLookupTables>>;
  private tableLoadPromise: Promise<boolean> | null = null;
  private deflectionTexture = createLookupTexture(
    new Float32Array([0, 0]),
    1,
    1,
    'Bruneton deflection placeholder',
  );
  private inverseRadiusTexture = createLookupTexture(
    new Float32Array([0, 0]),
    1,
    1,
    'Bruneton inverse-radius placeholder',
  );
  private tableStatus: BlackHoleLensingTableStatus = 'deferred';
  private tableError: string | null = null;
  private latestFrame: Readonly<BlackHoleLensingFrame> | null = null;
  private quality: VisualQuality;
  private reducedMotion = false;
  private diagnostics: Readonly<BlackHoleLensingDiagnostics> =
    EMPTY_BLACK_HOLE_LENSING_DIAGNOSTICS;
  private disposed = false;

  public constructor(options: BlackHoleLensingPassOptions = {}) {
    this.quality = options.initialQuality ?? 'high';
    this.highQualitySupported = options.highQualitySupported ?? true;
    const uniforms: LensingUniforms = {
      tDiffuse: new Uniform<unknown>(null),
      center: new Uniform(new Vector2(0.5, 0.5)),
      eventHorizonRadius: new Uniform(0),
      influenceRadius: new Uniform(0),
      viewportAspect: new Uniform(1),
      strength: new Uniform(0),
      redshiftStrength: new Uniform(0),
      mode: new Uniform(0),
      rayDeflectionTexture: new Uniform<DataTexture | null>(null),
      rayInverseRadiusTexture: new Uniform<DataTexture | null>(null),
    };
    this.pass = new ShaderPass({
      name: 'BrunetonLookupBlackHoleLensingShader',
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });
    // ShaderPass clones the shader descriptor's uniforms. Retain the live
    // cloned set actually bound to its ShaderMaterial, not the descriptor.
    this.uniforms = this.pass.uniforms as unknown as LensingUniforms;
    this.uniforms.rayDeflectionTexture.value = this.deflectionTexture;
    this.uniforms.rayInverseRadiusTexture.value = this.inverseRadiusTexture;
    this.pass.enabled = false;
    this.tableLoader = options.tableLoader ?? (() => loadBrunetonLookupTables({
      signal: this.tableAbortController.signal,
    }));
  }

  public update(frame: Readonly<BlackHoleLensingFrame>): void {
    this.assertNotDisposed();
    validateFrame(frame);
    this.latestFrame = frame;
    if (frame.active && this.quality !== 'low' && this.highQualitySupported) {
      void this.ensureTablesLoaded();
    }
    this.applyFrame(frame);
  }

  private applyFrame(frame: Readonly<BlackHoleLensingFrame>): void {
    const path = frame.active ? this.pathForQuality() : 'off';
    const active = path !== 'off';
    const centerUvX = frame.centerNdc[0] * 0.5 + 0.5;
    const centerUvY = frame.centerNdc[1] * 0.5 + 0.5;
    const horizonUv = Math.min(frame.eventHorizonRadiusNdc * 0.5, 1.5);
    const influenceUv = Math.min(
      Math.max(horizonUv * (path === 'schwarzschild' ? 18 : 12), 0.025),
      1.5,
    );
    const reducedMotionMultiplier = this.reducedMotion ? 0.72 : 1;

    this.uniforms.center.value.set(centerUvX, centerUvY);
    this.uniforms.eventHorizonRadius.value = active ? horizonUv : 0;
    this.uniforms.influenceRadius.value = active ? influenceUv : 0;
    this.uniforms.viewportAspect.value = frame.viewportAspect;
    const shaderMode = path === 'schwarzschild' ? 2 : active ? 1 : 0;
    this.uniforms.strength.value = active && shaderMode === 1
      ? 0.72 * reducedMotionMultiplier
      : active
        ? 1
        : 0;
    this.uniforms.redshiftStrength.value = Math.min(
      Math.max(frame.redshiftStrength ?? 0.5, 0),
      1,
    );
    this.uniforms.mode.value = shaderMode;
    this.pass.enabled = active;
    this.diagnostics = Object.freeze({
      active,
      path,
      quality: this.quality,
      highQualitySupported: this.highQualitySupported,
      centerNdc: Object.freeze([frame.centerNdc[0], frame.centerNdc[1]] as const),
      eventHorizonRadiusNdc: active ? frame.eventHorizonRadiusNdc : 0,
      influenceRadiusNdc: active ? influenceUv * 2 : 0,
      finite: true,
    });
  }

  public reset(): void {
    if (this.disposed) return;
    this.latestFrame = null;
    this.pass.enabled = false;
    this.uniforms.eventHorizonRadius.value = 0;
    this.uniforms.influenceRadius.value = 0;
    this.uniforms.strength.value = 0;
    this.uniforms.mode.value = 0;
    this.diagnostics = Object.freeze({
      ...EMPTY_BLACK_HOLE_LENSING_DIAGNOSTICS,
      quality: this.quality,
      highQualitySupported: this.highQualitySupported,
    });
  }

  public setQuality(quality: VisualQuality): void {
    this.assertNotDisposed();
    this.quality = quality;
    if (quality === 'low') this.reset();
    else if (this.latestFrame?.active === true && this.highQualitySupported) {
      void this.ensureTablesLoaded();
    }
  }

  public setReducedMotion(reducedMotion: boolean): void {
    this.assertNotDisposed();
    this.reducedMotion = reducedMotion;
    if (this.latestFrame !== null) this.applyFrame(this.latestFrame);
  }

  public getDiagnostics(): Readonly<BlackHoleLensingDiagnostics> {
    return this.diagnostics;
  }

  public getTableDiagnostics(): Readonly<BlackHoleLensingTableDiagnostics> {
    return Object.freeze({
      status: this.tableStatus,
      referenceCommit: BRUNETON_REFERENCE_COMMIT,
      deflectionDimensions: Object.freeze([
        BRUNETON_DEFLECTION_TABLE_SPEC.width,
        BRUNETON_DEFLECTION_TABLE_SPEC.height,
      ] as const),
      inverseRadiusDimensions: Object.freeze([
        BRUNETON_INVERSE_RADIUS_TABLE_SPEC.width,
        BRUNETON_INVERSE_RADIUS_TABLE_SPEC.height,
      ] as const),
      error: this.tableError,
    });
  }

  /** Resolves true only when both validated official tables are GPU-bound. */
  public whenTablesReady(): Promise<boolean> {
    this.assertNotDisposed();
    return this.ensureTablesLoaded();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
    this.tableAbortController.abort();
    this.tableStatus = 'disposed';
    this.deflectionTexture.dispose();
    this.inverseRadiusTexture.dispose();
    this.pass.dispose();
  }

  private installTables(tables: Readonly<BrunetonLookupTables>): boolean {
    if (this.disposed) return false;
    const deflectionTexture = createLookupTexture(
      tables.deflection.data,
      tables.deflection.spec.width,
      tables.deflection.spec.height,
      'Bruneton ray deflection RG32F',
    );
    const inverseRadiusTexture = createLookupTexture(
      tables.inverseRadius.data,
      tables.inverseRadius.spec.width,
      tables.inverseRadius.spec.height,
      'Bruneton ray inverse-radius RG32F',
    );
    this.deflectionTexture.dispose();
    this.inverseRadiusTexture.dispose();
    this.deflectionTexture = deflectionTexture;
    this.inverseRadiusTexture = inverseRadiusTexture;
    this.uniforms.rayDeflectionTexture.value = deflectionTexture;
    this.uniforms.rayInverseRadiusTexture.value = inverseRadiusTexture;
    this.tableStatus = 'ready';
    this.tableError = null;
    if (this.latestFrame !== null) this.applyFrame(this.latestFrame);
    return true;
  }

  private ensureTablesLoaded(): Promise<boolean> {
    if (!this.highQualitySupported || this.disposed) return Promise.resolve(false);
    if (this.tableLoadPromise !== null) return this.tableLoadPromise;
    this.tableStatus = 'loading';
    this.tableLoadPromise = Promise.resolve()
      .then(this.tableLoader)
      .then((tables) => this.installTables(tables))
      .catch((error: unknown) => {
        if (this.disposed) return false;
        this.tableStatus = 'error';
        this.tableError = error instanceof Error ? error.message : String(error);
        if (this.latestFrame !== null) this.applyFrame(this.latestFrame);
        return false;
      });
    return this.tableLoadPromise;
  }

  private pathForQuality(): BlackHoleLensingPath {
    if (this.quality === 'low') return 'off';
    if (this.quality === 'medium' || !this.highQualitySupported) return 'simplified';
    return this.tableStatus === 'ready' ? 'schwarzschild' : 'simplified';
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error('Black-hole lensing pass is disposed.');
  }
}

function createLookupTexture(
  data: Float32Array,
  width: number,
  height: number,
  name: string,
): DataTexture {
  const texture = new DataTexture(data, width, height, RGFormat, FloatType);
  texture.name = name;
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

function validateFrame(frame: Readonly<BlackHoleLensingFrame>): void {
  if (!Number.isFinite(frame.centerNdc[0]) || !Number.isFinite(frame.centerNdc[1])) {
    throw new RangeError('Black-hole lensing center must be finite.');
  }
  if (!Number.isFinite(frame.eventHorizonRadiusNdc) || frame.eventHorizonRadiusNdc < 0) {
    throw new RangeError(
      'Black-hole lensing event-horizon radius must be finite and non-negative.',
    );
  }
  if (!Number.isFinite(frame.viewportAspect) || frame.viewportAspect <= 0) {
    throw new RangeError('Black-hole lensing viewport aspect must be finite and positive.');
  }
  if (
    frame.redshiftStrength !== undefined &&
    (!Number.isFinite(frame.redshiftStrength) || frame.redshiftStrength < 0)
  ) {
    throw new RangeError(
      'Black-hole lensing redshift strength must be finite and non-negative.',
    );
  }
}
