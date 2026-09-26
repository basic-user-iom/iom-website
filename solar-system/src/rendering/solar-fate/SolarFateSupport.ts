import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Uniform,
  type BufferAttribute,
  type Group,
  type Side,
} from 'three';

import type { VisualQuality } from '../bodies/VisualQuality';
import type {
  SolarFateLifecycleState,
  SolarFateScaleContext,
} from './SolarFateRenderTypes';

const SOLAR_NOISE = /* glsl */ `
  float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
  float noise3(vec3 p) {
    vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),
                   mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),
                   mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float cloudNoise(vec3 p) {
    return noise3(p)*0.55 + noise3(p*2.03+7.1)*0.28 + noise3(p*4.07+13.7)*0.17;
  }
`;

const MAX_SAFE_RENDER_MAGNITUDE = 1e30;

export interface DynamicSolarPoints {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  readonly attribute: BufferAttribute;
  readonly maximumCount: number;
  setOpacity(opacity: number): void;
  setPointSize(size: number): void;
}

export class PlanetHeatOverlayLayer {
  private readonly geometry = new SphereGeometry(1, 32, 20);
  private readonly overlays = new Map<
    string,
    Mesh<SphereGeometry, MeshBasicMaterial>
  >();
  private disposed = false;

  public attachBody(bodyId: string, root: Group): void {
    if (this.disposed || this.overlays.has(bodyId) || bodyId === 'sun') return;
    const material = new MeshBasicMaterial({
      blending: AdditiveBlending,
      color: 0xff5428,
      depthWrite: false,
      opacity: 0,
      toneMapped: false,
      transparent: true,
    });
    const overlay = new Mesh(this.geometry, material);
    overlay.name = `solar-fate-heat-${bodyId}`;
    overlay.renderOrder = 9;
    overlay.scale.setScalar(1.026);
    overlay.visible = false;
    root.add(overlay);
    this.overlays.set(bodyId, overlay);
  }

  public update(
    values: Readonly<Record<string, number>>,
    reducedFlashes: boolean,
    secondaryValues: Readonly<Record<string, number>> = {},
  ): number {
    let visibleCount = 0;
    for (const [bodyId, overlay] of this.overlays) {
      const value = clamp01(Math.max(
        values[bodyId] ?? 0,
        secondaryValues[bodyId] ?? 0,
      ));
      const effective = reducedFlashes ? Math.min(value, 0.56) : value;
      overlay.material.opacity = effective * 0.48;
      overlay.visible = effective > 0.001;
      if (overlay.visible) visibleCount += 1;
    }
    return visibleCount;
  }

  public reset(): void {
    for (const overlay of this.overlays.values()) {
      overlay.visible = false;
      overlay.material.opacity = 0;
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const overlay of this.overlays.values()) {
      overlay.removeFromParent();
      overlay.material.dispose();
    }
    this.overlays.clear();
    this.geometry.dispose();
  }
}

export function createSolarPoints(
  name: string,
  maximumCount: number,
  color: number,
  size: number,
): DynamicSolarPoints {
  const attribute = new Float32BufferAttribute(new Float32Array(maximumCount * 3), 3);
  attribute.setUsage(DynamicDrawUsage);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', attribute);
  geometry.setDrawRange(0, 0);
  const tint = new Color(color);
  const material = new ShaderMaterial({
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    transparent: true,
    uniforms: {
      opacity: new Uniform(0),
      pointSize: new Uniform(size),
      referenceRadius: new Uniform(1),
      tint: new Uniform(tint),
    },
    vertexShader: /* glsl */ `
      uniform float pointSize;
      uniform float referenceRadius;
      varying float vSeed;
      void main() {
        vSeed = fract(sin(dot(position.xy, vec2(12.9898, 78.233))) * 43758.5453);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float worldRadius = length(modelViewMatrix[0].xyz) * referenceRadius;
        float atten = clamp(worldRadius / max(-mvPosition.z, 1e-12), 0.3, 2.0);
        gl_PointSize = clamp(pointSize * (0.55 + vSeed * 0.9) * atten, 0.8, 7.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float opacity;
      uniform vec3 tint;
      varying float vSeed;
      void main() {
        vec2 centered = gl_PointCoord - vec2(0.5);
        float dist = length(centered);
        float soft = (1.0 - smoothstep(0.05, 0.5, dist));
        float spark = mix(0.55, 1.35, vSeed);
        gl_FragColor = vec4(tint * spark, soft * opacity);
      }
    `,
  });
  const points = new Points(geometry, material);
  points.name = name;
  points.frustumCulled = false;
  points.renderOrder = 8;
  points.visible = false;
  return {
    points,
    attribute,
    maximumCount,
    setOpacity(opacity: number) {
      (material.uniforms.opacity as Uniform<number>).value = opacity;
    },
    setPointSize(nextSize: number) {
      (material.uniforms.pointSize as Uniform<number>).value = nextSize;
    },
  };
}

export function createStellarCoreMaterial(initialColor: number): ShaderMaterial {
  const tint = new Color(initialColor);
  return new ShaderMaterial({
    depthWrite: true,
    toneMapped: true,
    transparent: false,
    uniforms: {
      tint: new Uniform(tint),
      glowBoost: new Uniform(1),
      time: new Uniform(0),
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalView;
      varying vec3 vLocal;
      varying vec3 vViewDir;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vLocal = normalize(position);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 tint;
      uniform float glowBoost;
      uniform float time;
      ${SOLAR_NOISE}
      varying vec3 vNormalView;
      varying vec3 vLocal;
      varying vec3 vViewDir;
      void main() {
        float ndotv = clamp(dot(normalize(vNormalView), normalize(vViewDir)), 0.0, 1.0);
        float limb = 0.24 + 0.76 * pow(ndotv, 0.6);
        float convection = cloudNoise(vLocal * 9.0 + vec3(time * 0.018, 0.0, 0.0));
        float granules = noise3(vLocal * 88.0 + convection * 3.0);
        float cells = 0.58 + 0.5 * convection + 0.22 * granules;
        vec3 color = tint * limb * cells * glowBoost * 1.5;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

export function createSoftShellMaterial(
  color: number,
  opacity: number,
  side: Side,
  profile: 'shell' | 'nebula' | 'halo' = 'shell',
): ShaderMaterial {
  const tint = new Color(color);
  return new ShaderMaterial({
    blending: AdditiveBlending,
    depthWrite: false,
    side,
    toneMapped: false,
    transparent: true,
    uniforms: {
      tint: new Uniform(tint),
      opacity: new Uniform(opacity),
      structure: new Uniform(profile === 'nebula' ? 1 : 0),
      halo: new Uniform(profile === 'halo' ? 1 : 0),
      time: new Uniform(0),
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalView;
      varying vec3 vLocal;
      varying vec3 vViewDir;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vLocal = normalize(position);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 tint;
      uniform float opacity;
      uniform float structure;
      uniform float halo;
      uniform float time;
      ${SOLAR_NOISE}
      varying vec3 vNormalView;
      varying vec3 vLocal;
      varying vec3 vViewDir;
      void main() {
        float ndotv = abs(dot(normalize(vNormalView), normalize(vViewDir)));
        float edgeFade = smoothstep(0.0, 0.16, ndotv);
        float rim = pow(1.0 - ndotv, 1.6) * edgeFade;
        float cloud = cloudNoise(vLocal * 6.0 + vec3(0.0, time * 0.006, 0.0));
        float filaments = smoothstep(0.28, 0.72, cloud);
        float latitude = 0.6 + 0.4 * pow(abs(vLocal.y), 0.7);
        float density = mix(1.0, filaments * latitude * 2.0, structure);
        float alpha = mix((rim + 0.05 * ndotv) * density, pow(ndotv, 3.0), halo) * opacity;
        vec3 color = tint * mix(1.0, 0.65 + cloud * 1.1, structure);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}

export function setShaderOpacity(material: ShaderMaterial, opacity: number): void {
  (material.uniforms.opacity as Uniform<number>).value = opacity;
}

export function setShaderTint(material: ShaderMaterial, color: number | string): void {
  (material.uniforms.tint as Uniform<Color>).value.set(color);
}

export function setShaderGlowBoost(material: ShaderMaterial, glowBoost: number): void {
  (material.uniforms.glowBoost as Uniform<number>).value = glowBoost;
}

export function writeDeterministicShellParticles(
  resources: DynamicSolarPoints,
  requestedCount: number,
  radiusLocal: number,
  thicknessFraction: number,
  signature: string,
  timeSeconds: number,
  motionScale: number,
): number {
  requireFiniteNonNegative(radiusLocal, 'particle-shell local radius');
  requireFiniteNonNegative(thicknessFraction, 'particle-shell thickness');
  requireFinite(timeSeconds, 'particle-shell time');
  requireFiniteNonNegative(motionScale, 'particle-shell motion scale');
  (resources.points.material.uniforms.referenceRadius as Uniform<number>).value = radiusLocal;
  const count = Math.min(requestedCount, resources.maximumCount);
  const values = resources.attribute.array as Float32Array;
  const seed = hashString(signature);
  const animationTime = (timeSeconds % 1_000_000) * motionScale;
  requireRenderableMagnitude(
    radiusLocal * (1 + thicknessFraction + Math.abs(animationTime)),
    'animated particle-shell radius',
  );
  for (let index = 0; index < count; index += 1) {
    const z = random01(seed, index * 4) * 2 - 1;
    const angle = random01(seed, index * 4 + 1) * Math.PI * 2;
    const radialNoise = random01(seed, index * 4 + 2) * 2 - 1;
    const drift = random01(seed, index * 4 + 3);
    const planar = Math.sqrt(Math.max(0, 1 - z * z));
    const animatedRadius = Math.max(
      0,
      radiusLocal *
        (1 + radialNoise * thicknessFraction + drift * animationTime),
    );
    const offset = index * 3;
    values[offset] = Math.cos(angle) * planar * animatedRadius;
    values[offset + 1] = z * animatedRadius;
    values[offset + 2] = Math.sin(angle) * planar * animatedRadius;
  }
  resources.attribute.needsUpdate = true;
  resources.points.geometry.setDrawRange(0, count);
  return count;
}

export function physicalRadiusToLocal(
  radiusM: number,
  context: Readonly<SolarFateScaleContext>,
): number {
  requireFiniteNonNegative(radiusM, 'physical radius');
  requirePositive(context.metersPerRenderUnit, 'metres per render unit');
  requirePositive(context.baseSunRadiusRenderUnits, 'base Sun render radius');
  const mapped = radiusM /
    context.metersPerRenderUnit /
    context.baseSunRadiusRenderUnits;
  requireRenderableMagnitude(mapped, 'local physical radius');
  return mapped;
}

export function physicalRadiusToRenderUnits(
  radiusM: number,
  context: Readonly<SolarFateScaleContext>,
): number {
  requireFiniteNonNegative(radiusM, 'physical radius');
  requirePositive(context.metersPerRenderUnit, 'metres per render unit');
  const mapped = radiusM / context.metersPerRenderUnit;
  requireRenderableMagnitude(mapped, 'render-unit physical radius');
  return mapped;
}

export function particleBudget(
  quality: VisualQuality,
  maximum: number,
  reducedMotion: boolean,
): number {
  const fraction = quality === 'low' ? 0.2 : quality === 'medium' ? 0.42 : quality === 'high' ? 0.7 : 1;
  return Math.max(8, Math.floor(maximum * fraction * (reducedMotion ? 0.5 : 1)));
}

export function isActiveLifecycle(state: SolarFateLifecycleState): boolean {
  return state === 'running' || state === 'paused' || state === 'complete';
}

export function validateLifecycle(state: SolarFateLifecycleState): void {
  if (!['idle', 'running', 'paused', 'complete', 'error'].includes(state)) {
    throw new RangeError(`Unsupported solar-fate lifecycle "${String(state)}".`);
  }
}

export function validateProgress(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError('Solar-fate progress must be in the interval [0, 1].');
  }
}

export function requireFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`Solar-fate ${label} must be finite.`);
}

export function requireFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Solar-fate ${label} must be finite and non-negative.`);
  }
}

export function requirePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`Solar-fate ${label} must be finite and positive.`);
  }
}

export function requireUnitInterval(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`Solar-fate ${label} must be in the interval [0, 1].`);
  }
}

function requireRenderableMagnitude(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > MAX_SAFE_RENDER_MAGNITUDE) {
    throw new RangeError(
      `Solar-fate ${label} exceeds the finite renderer-safe magnitude.`,
    );
  }
}

export function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function random01(seed: number, index: number): number {
  let value = (seed + Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x1_0000_0000;
}
