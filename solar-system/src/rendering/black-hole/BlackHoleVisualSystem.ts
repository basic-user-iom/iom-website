import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  Uniform,
  type BufferAttribute,
} from 'three';

import type { VisualQuality } from '../bodies/VisualQuality';
import {
  EMPTY_BLACK_HOLE_LENSING_DIAGNOSTICS,
  EMPTY_BLACK_HOLE_VISUAL_DIAGNOSTICS,
  type BlackHoleBodyOutcome,
  type BlackHoleLensingDiagnostics,
  type BlackHoleMappedBodyRenderState,
  type BlackHoleVisualDiagnostics,
  type BlackHoleVisualFrame,
} from './BlackHoleRenderTypes';
import {
  clampUnit,
  isBlackHoleRenderActive,
  validateBlackHoleVisualFrame,
} from './BlackHoleRenderValidation';

const MAX_STREAM_POINTS = 2_048;
const MAX_SAFE_STREAM_MAGNITUDE = 1e24;

interface StreamResources {
  readonly points: Points<BufferGeometry, PointsMaterial>;
  readonly attribute: BufferAttribute;
}

interface BodyOverlayResources {
  readonly overlay: Mesh<SphereGeometry, MeshBasicMaterial>;
}

/**
 * Scene-space visuals for both Phase 10 encounter modes.
 *
 * The event-horizon physical radius and the presentation radius stay separate:
 * the latter can be enlarged for robust framing but is never returned to the
 * integrator or used as a capture boundary.
 */
export class BlackHoleVisualSystem {
  public readonly root = new Group();

  private readonly horizonGeometry = new SphereGeometry(1, 64, 40);
  private readonly horizonMaterial = new MeshBasicMaterial({
    color: 0x000000,
    depthWrite: true,
    toneMapped: false,
  });
  private readonly horizon = new Mesh(this.horizonGeometry, this.horizonMaterial);
  private readonly photonRingGeometry = new RingGeometry(1.42, 1.58, 128, 1);
  private readonly photonRingMaterial = new MeshBasicMaterial({
    blending: AdditiveBlending,
    color: new Color().setRGB(2.2, 0.82, 0.24),
    depthWrite: false,
    opacity: 0.74,
    side: DoubleSide,
    toneMapped: false,
    transparent: true,
  });
  private readonly photonRing = new Mesh(
    this.photonRingGeometry,
    this.photonRingMaterial,
  );
  private readonly diskGeometry = new RingGeometry(1.8, 6.2, 192, 6);
  private readonly diskMaterial = createAccretionDiskMaterial();
  private readonly accretionDisk = new Mesh(this.diskGeometry, this.diskMaterial);
  private readonly streams = createStreams();
  private readonly bodyOverlayGeometry = new SphereGeometry(1, 32, 20);
  private readonly bodyOverlays = new Map<string, BodyOverlayResources>();
  private readonly activeOverlayBodyIds = new Set<string>();
  private quality: VisualQuality;
  private reducedMotion = false;
  private lensingDiagnostics: Readonly<BlackHoleLensingDiagnostics> =
    EMPTY_BLACK_HOLE_LENSING_DIAGNOSTICS;
  private diagnostics: Readonly<BlackHoleVisualDiagnostics> =
    EMPTY_BLACK_HOLE_VISUAL_DIAGNOSTICS;
  private disposed = false;

  public constructor(initialQuality: VisualQuality = 'high') {
    this.quality = initialQuality;
    this.root.name = 'black-hole-encounter-layer';
    this.root.visible = false;
    this.horizon.name = 'black-hole-event-horizon';
    this.horizon.renderOrder = 14;
    this.photonRing.name = 'black-hole-photon-ring-cue';
    this.photonRing.renderOrder = 15;
    this.accretionDisk.name = 'black-hole-accretion-disk';
    this.accretionDisk.renderOrder = 13;
    this.accretionDisk.rotation.x = Math.PI * 0.34;
    this.streams.points.renderOrder = 12;
    this.root.add(
      this.accretionDisk,
      this.streams.points,
      this.horizon,
      this.photonRing,
    );
    this.applyQuality();
    this.reset();
  }

  public attachBody(bodyId: string, bodyRoot: Group): void {
    this.assertNotDisposed();
    if (bodyId.trim().length === 0 || this.bodyOverlays.has(bodyId)) return;
    const material = new MeshBasicMaterial({
      blending: AdditiveBlending,
      color: 0xff3519,
      depthWrite: false,
      opacity: 0,
      toneMapped: false,
      transparent: true,
    });
    const overlay = new Mesh(this.bodyOverlayGeometry, material);
    overlay.name = `black-hole-redshift-${bodyId}`;
    overlay.renderOrder = 16;
    overlay.scale.setScalar(1.035);
    overlay.visible = false;
    bodyRoot.add(overlay);
    this.bodyOverlays.set(bodyId, { overlay });
  }

  public update(frame: Readonly<BlackHoleVisualFrame>): void {
    this.assertNotDisposed();
    validateBlackHoleVisualFrame(frame);
    const active = isBlackHoleRenderActive(frame.lifecycleState);
    const physicalRadius = frame.eventHorizonRadiusRenderUnits;
    const visualRadius = Math.max(
      physicalRadius,
      active ? frame.minimumVisualRadiusRenderUnits : 0,
    );
    const presentationRadiusExaggerated = visualRadius > physicalRadius * (1 + 1e-9);

    this.root.position.fromArray(frame.positionRenderUnits);
    this.root.visible = active;
    this.horizon.visible = active;
    this.horizon.scale.setScalar(Math.max(visualRadius, 1e-12));

    this.photonRing.visible = active && this.quality !== 'low';
    this.photonRing.scale.setScalar(Math.max(visualRadius, 1e-12));
    this.photonRingMaterial.opacity = this.reducedMotion ? 0.52 : 0.74;

    const diskVisible = active && frame.accretionDiskEnabled;
    this.accretionDisk.visible = diskVisible;
    this.accretionDisk.scale.setScalar(Math.max(visualRadius, 1e-12));
    const diskUniforms = this.diskMaterial.uniforms as {
      time: Uniform<number>;
      spin: Uniform<number>;
      opacity: Uniform<number>;
    };
    diskUniforms.time.value = this.reducedMotion
      ? 0
      : frame.scenarioTimeSeconds % 10_000;
    diskUniforms.spin.value = frame.spinVisualization;
    diskUniforms.opacity.value = diskOpacityForQuality(this.quality);

    const streamPointCount = active
      ? this.writeStreams(frame, visualRadius)
      : 0;
    this.streams.points.geometry.setDrawRange(0, streamPointCount);
    this.streams.points.visible = streamPointCount > 0;
    this.streams.points.material.opacity = streamPointCount > 0 ? 0.78 : 0;

    this.updateBodyOverlays(active ? frame.bodies : []);
    let capturedBodyCount = 0;
    let disruptedBodyCount = 0;
    for (const body of frame.bodies) {
      if (body.outcome === 'captured') capturedBodyCount += 1;
      if (isStreamOutcome(body.outcome)) disruptedBodyCount += 1;
    }
    this.diagnostics = Object.freeze({
      active,
      mode: active ? frame.mode : 'none',
      lifecycleState: active ? frame.lifecycleState : 'idle',
      stage: active ? frame.stage : 'idle',
      runSignature: active ? frame.runSignature : '',
      eventHorizonRadiusRenderUnits: active ? physicalRadius : 0,
      visualRadiusRenderUnits: active ? visualRadius : 0,
      presentationRadiusExaggerated: active && presentationRadiusExaggerated,
      accretionDiskVisible: diskVisible,
      streamPointCount,
      capturedBodyCount: active ? capturedBodyCount : 0,
      disruptedBodyCount: active ? disruptedBodyCount : 0,
      baseBodyOverrideCount: active ? frame.bodies.length : 0,
      finite: true,
      lensing: this.lensingDiagnostics,
    });
  }

  public setLensingDiagnostics(
    diagnostics: Readonly<BlackHoleLensingDiagnostics>,
  ): void {
    this.assertNotDisposed();
    this.lensingDiagnostics = diagnostics;
    this.diagnostics = Object.freeze({
      ...this.diagnostics,
      lensing: diagnostics,
      finite: this.diagnostics.finite && diagnostics.finite,
    });
  }

  public reset(): void {
    if (this.disposed) return;
    this.root.visible = false;
    this.horizon.visible = false;
    this.photonRing.visible = false;
    this.accretionDisk.visible = false;
    this.streams.points.visible = false;
    this.streams.points.geometry.setDrawRange(0, 0);
    this.streams.points.material.opacity = 0;
    this.resetBodyOverlays();
    this.lensingDiagnostics = Object.freeze({
      ...EMPTY_BLACK_HOLE_LENSING_DIAGNOSTICS,
      quality: this.quality,
    });
    this.diagnostics = Object.freeze({
      ...EMPTY_BLACK_HOLE_VISUAL_DIAGNOSTICS,
      lensing: this.lensingDiagnostics,
    });
  }

  public setQuality(quality: VisualQuality): void {
    this.assertNotDisposed();
    this.quality = quality;
    this.applyQuality();
  }

  public setReducedMotion(reducedMotion: boolean): void {
    this.assertNotDisposed();
    this.reducedMotion = reducedMotion;
  }

  public getDiagnostics(): Readonly<BlackHoleVisualDiagnostics> {
    return this.diagnostics;
  }

  public getProtectiveExposureCeiling(): number | null {
    if (!this.diagnostics.active) return null;
    return this.diagnostics.accretionDiskVisible ? 0.68 : 0.82;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
    this.root.removeFromParent();
    for (const { overlay } of this.bodyOverlays.values()) {
      overlay.removeFromParent();
      overlay.material.dispose();
    }
    this.bodyOverlays.clear();
    this.streams.points.geometry.dispose();
    this.streams.points.material.dispose();
    this.horizonGeometry.dispose();
    this.horizonMaterial.dispose();
    this.photonRingGeometry.dispose();
    this.photonRingMaterial.dispose();
    this.diskGeometry.dispose();
    this.diskMaterial.dispose();
    this.bodyOverlayGeometry.dispose();
    this.root.clear();
  }

  private writeStreams(
    frame: Readonly<BlackHoleVisualFrame>,
    visualRadius: number,
  ): number {
    let candidateCount = 0;
    for (const body of frame.bodies) {
      if (isStreamOutcome(body.outcome)) candidateCount += 1;
    }
    if (candidateCount === 0) return 0;
    const perBodyBudget = Math.max(
      4,
      Math.min(
        qualityStreamBudget(this.quality, this.reducedMotion),
        Math.floor(MAX_STREAM_POINTS / candidateCount),
      ),
    );
    const values = this.streams.attribute.array as Float32Array;
    let cursor = 0;
    for (const body of frame.bodies) {
      if (!isStreamOutcome(body.outcome)) continue;
      const flow = streamAmount(body);
      const bodyPointCount = Math.max(4, Math.floor(perBodyBudget * flow));
      const startX = body.positionRenderUnits[0] - frame.positionRenderUnits[0];
      const startY = body.positionRenderUnits[1] - frame.positionRenderUnits[1];
      const startZ = body.positionRenderUnits[2] - frame.positionRenderUnits[2];
      const startLength = Math.max(Math.hypot(startX, startY, startZ), visualRadius * 1.8);
      const safeStartScale = startLength > 0
        ? Math.min(1, MAX_SAFE_STREAM_MAGNITUDE / startLength)
        : 1;
      const safeX = startX * safeStartScale;
      const safeY = startY * safeStartScale;
      const safeZ = startZ * safeStartScale;
      const seed = hashString(`${frame.runSignature}:${body.bodyId}`);
      const phase = random01(seed, 1) * Math.PI * 2;
      const handedness = random01(seed, 2) > 0.5 ? 1 : -1;
      for (let index = 0; index < bodyPointCount && cursor < MAX_STREAM_POINTS; index += 1) {
        const along = bodyPointCount <= 1 ? 1 : index / (bodyPointCount - 1);
        const eased = along * along * (3 - 2 * along);
        const remaining = 1 - eased;
        const spiralRadius = Math.max(
          visualRadius * (1.55 + 1.5 * remaining),
          startLength * remaining * 0.12,
        );
        const turns = (2.4 + random01(seed, 3) * 1.8) * flow;
        const motion = this.reducedMotion
          ? 0
          : (frame.scenarioTimeSeconds % 10_000) * 0.38 * handedness;
        const angle = phase + along * turns * Math.PI * 2 * handedness + motion;
        const taper = Math.sin(along * Math.PI) * spiralRadius;
        const offset = cursor * 3;
        values[offset] = safeX * remaining + Math.cos(angle) * taper * 0.16;
        values[offset + 1] = safeY * remaining + Math.sin(angle * 0.77) * taper * 0.08;
        values[offset + 2] = safeZ * remaining + Math.sin(angle) * taper * 0.16;
        cursor += 1;
      }
    }
    this.streams.attribute.needsUpdate = true;
    return cursor;
  }

  private updateBodyOverlays(
    bodies: readonly Readonly<BlackHoleMappedBodyRenderState>[],
  ): void {
    this.activeOverlayBodyIds.clear();
    for (const body of bodies) {
      this.activeOverlayBodyIds.add(body.bodyId);
      const resources = this.bodyOverlays.get(body.bodyId);
      if (resources === undefined) continue;
      const redshift = clampUnit(Math.max(
        body.tidalStress * 0.55,
        body.streamProgress,
        body.captureProgress,
      ));
      const overlay = resources.overlay;
      overlay.material.opacity = redshift * 0.54;
      overlay.material.color.setRGB(
        1.25,
        0.08 + (1 - redshift) * 0.16,
        0.025,
      );
      overlay.scale.set(
        1.035 + redshift * 0.08,
        1.035 + redshift * 0.42,
        1.035 + redshift * 0.08,
      );
      overlay.visible = redshift > 0.001 && body.outcome !== 'captured';
    }
    for (const [bodyId, resources] of this.bodyOverlays) {
      if (this.activeOverlayBodyIds.has(bodyId)) continue;
      resources.overlay.visible = false;
      resources.overlay.material.opacity = 0;
      resources.overlay.scale.setScalar(1.035);
    }
  }

  private resetBodyOverlays(): void {
    for (const { overlay } of this.bodyOverlays.values()) {
      overlay.visible = false;
      overlay.material.opacity = 0;
      overlay.scale.setScalar(1.035);
    }
  }

  private applyQuality(): void {
    this.streams.points.material.size =
      this.quality === 'low' ? 2 : this.quality === 'medium' ? 2.6 : this.quality === 'high' ? 3.3 : 4;
    this.photonRingMaterial.opacity =
      this.quality === 'low' ? 0 : this.quality === 'medium' ? 0.48 : this.quality === 'high' ? 0.68 : 0.8;
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error('Black-hole visual system is disposed.');
  }
}

function createStreams(): StreamResources {
  const attribute = new Float32BufferAttribute(
    new Float32Array(MAX_STREAM_POINTS * 3),
    3,
  );
  attribute.setUsage(DynamicDrawUsage);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', attribute);
  geometry.setDrawRange(0, 0);
  const material = new PointsMaterial({
    blending: AdditiveBlending,
    color: 0xff6a32,
    depthWrite: false,
    opacity: 0,
    size: 3.3,
    sizeAttenuation: false,
    toneMapped: false,
    transparent: true,
  });
  const points = new Points(geometry, material);
  points.name = 'black-hole-deterministic-accretion-streams';
  points.frustumCulled = false;
  points.visible = false;
  return { points, attribute };
}

function createAccretionDiskMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
    transparent: true,
    uniforms: {
      time: new Uniform(0),
      spin: new Uniform(0),
      opacity: new Uniform(0.78),
    },
    vertexShader: /* glsl */ `
      varying vec2 diskPosition;
      void main() {
        diskPosition = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform float spin;
      uniform float opacity;
      varying vec2 diskPosition;

      void main() {
        float radius = max(length(diskPosition), 0.0001);
        float radial = smoothstep(1.8, 2.2, radius) * (1.0 - smoothstep(4.6, 6.2, radius));
        float azimuth = atan(diskPosition.y, diskPosition.x);
        float signedSpin = clamp(spin, -1.0, 1.0);
        float direction = signedSpin < 0.0 ? -1.0 : 1.0;
        float orbitalBands = 0.82 + 0.18 * sin(radius * 17.0 - time * (0.3 + abs(signedSpin)) * direction + azimuth * 5.0);
        // Doppler-inspired artistic cue only: one approaching side is brighter.
        float approachingSide = 0.5 + 0.5 * cos(azimuth) * direction;
        float asymmetry = 0.68 + 0.56 * approachingSide * abs(signedSpin);
        float temperature = clamp((6.2 - radius) / 4.4, 0.0, 1.0);
        vec3 cool = vec3(0.92, 0.14, 0.025);
        vec3 hot = vec3(2.8, 1.35, 0.48);
        vec3 color = mix(cool, hot, temperature) * asymmetry * orbitalBands;
        gl_FragColor = vec4(color, radial * opacity);
      }
    `,
  });
}

function qualityStreamBudget(quality: VisualQuality, reducedMotion: boolean): number {
  const budget = quality === 'low' ? 28 : quality === 'medium' ? 56 : quality === 'high' ? 96 : 144;
  return Math.max(8, Math.floor(budget * (reducedMotion ? 0.5 : 1)));
}

function diskOpacityForQuality(quality: VisualQuality): number {
  return quality === 'low' ? 0.54 : quality === 'medium' ? 0.66 : quality === 'high' ? 0.78 : 0.88;
}

function streamAmount(body: Readonly<BlackHoleMappedBodyRenderState>): number {
  const outcomeFloor: Readonly<Record<BlackHoleBodyOutcome, number>> = {
    intact: 0,
    'tidally-stressed': 0,
    disrupted: 0.24,
    'accretion-stream': 0.52,
    captured: 1,
    ejected: 0,
  };
  return Math.max(
    0.08,
    clampUnit(Math.max(outcomeFloor[body.outcome], body.streamProgress, body.captureProgress)),
  );
}

function isStreamOutcome(outcome: BlackHoleBodyOutcome): boolean {
  return outcome === 'disrupted' ||
    outcome === 'accretion-stream' ||
    outcome === 'captured';
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
