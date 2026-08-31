import {
  AdditiveBlending,
  BufferGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  SphereGeometry,
  type BufferAttribute,
  type Group,
} from 'three';

import type { VisualQuality } from '../bodies/VisualQuality';
import type {
  SolarFateLifecycleState,
  SolarFateScaleContext,
} from './SolarFateRenderTypes';

const MAX_SAFE_RENDER_MAGNITUDE = 1e30;

export interface DynamicSolarPoints {
  readonly points: Points<BufferGeometry, PointsMaterial>;
  readonly attribute: BufferAttribute;
  readonly maximumCount: number;
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
  const material = new PointsMaterial({
    blending: AdditiveBlending,
    color,
    depthWrite: false,
    opacity: 0,
    size,
    sizeAttenuation: false,
    toneMapped: false,
    transparent: true,
  });
  const points = new Points(geometry, material);
  points.name = name;
  points.frustumCulled = false;
  points.renderOrder = 8;
  points.visible = false;
  return { points, attribute, maximumCount };
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
