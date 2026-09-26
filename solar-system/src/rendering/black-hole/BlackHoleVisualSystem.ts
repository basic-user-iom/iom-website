import {
  AdditiveBlending,
  BufferGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
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
/** Inclined disk plane — classic educational silhouette, not face-on plate. */
const DISK_INCLINATION = Math.PI * 0.58;

/**
 * Overlay layer composited after Bruneton lensing so the educational disk /
 * photon ring are not warped into concentric moiré stripes.
 * Horizon stays on the default layer (0) so the silhouette feeds the pass.
 */
export const BLACK_HOLE_OVERLAY_LAYER = 1;

interface StreamResources {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  readonly position: BufferAttribute;
  readonly size: BufferAttribute;
  readonly heat: BufferAttribute;
}

interface BodyOverlayResources {
  readonly overlay: Mesh<SphereGeometry, MeshBasicMaterial>;
}

/**
 * Scene-space visuals for both Phase 10 encounter modes.
 *
 * Bruneton warps the sky (and the horizon silhouette). Mesh overlays supply a
 * continuous photon ring, an inclined Doppler accretion disk, and soft ribbon
 * jets — rendered on BLACK_HOLE_OVERLAY_LAYER so they are not lensed. No ConeGeometry.
 */
export class BlackHoleVisualSystem {
  public readonly root = new Group();

  private readonly horizonGeometry = new SphereGeometry(1, 64, 40);
  private readonly horizonMaterial = new MeshBasicMaterial({
    color: 0x000000,
    depthWrite: true,
    toneMapped: true,
  });
  private readonly horizon = new Mesh(this.horizonGeometry, this.horizonMaterial);

  /** Continuous tube ring — not a fresnel sphere that aliases into dashes. */
  private readonly photonRingGeometry = new TorusGeometry(1.06, 0.018, 24, 192);
  private readonly photonRingMaterial = createPhotonRingMaterial();
  private readonly photonRing = new Mesh(
    this.photonRingGeometry,
    this.photonRingMaterial,
  );

  /** Narrow inclined annulus — band, not a screen-filling plate. */
  private readonly diskGeometry = new RingGeometry(1.85, 4.6, 192, 8);
  private readonly diskMaterial = createAccretionDiskMaterial();
  private readonly accretionDisk = new Mesh(this.diskGeometry, this.diskMaterial);

  /** Far-side educational warp arching over the silhouette. */
  private readonly lensedArchGeometry = new RingGeometry(2.0, 4.2, 128, 6);
  private readonly lensedArchMaterial = createLensedArchMaterial();
  private readonly lensedArch = new Mesh(
    this.lensedArchGeometry,
    this.lensedArchMaterial,
  );

  /** Crisp silhouette for the post-lensing overlay pass (depth occludes disk). */
  private readonly overlayHorizon = new Mesh(
    this.horizonGeometry,
    this.horizonMaterial,
  );

  private readonly jetRibbonGeometry = createJetRibbonGeometry();
  private readonly jetMaterialA = createJetRibbonMaterial();
  private readonly jetMaterialB = createJetRibbonMaterial();
  private readonly jetA = new Mesh(this.jetRibbonGeometry, this.jetMaterialA);
  private readonly jetB = new Mesh(this.jetRibbonGeometry, this.jetMaterialB);

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
    this.overlayHorizon.name = 'black-hole-overlay-horizon';
    this.overlayHorizon.renderOrder = 14;
    this.photonRing.name = 'black-hole-photon-ring-cue';
    this.photonRing.renderOrder = 17;
    this.accretionDisk.name = 'black-hole-accretion-disk';
    this.accretionDisk.renderOrder = 13;
    this.lensedArch.name = 'black-hole-lensed-disk-arch';
    this.lensedArch.renderOrder = 15;
    this.jetA.name = 'black-hole-relativistic-jet-a';
    this.jetB.name = 'black-hole-relativistic-jet-b';
    this.jetA.renderOrder = 12;
    this.jetB.renderOrder = 12;
    this.streams.points.renderOrder = 12;

    // Default layer 0: silhouette for Bruneton. Overlay layer: educational fill.
    this.horizon.layers.set(0);
    this.overlayHorizon.layers.set(BLACK_HOLE_OVERLAY_LAYER);
    this.photonRing.layers.set(BLACK_HOLE_OVERLAY_LAYER);
    this.accretionDisk.layers.set(BLACK_HOLE_OVERLAY_LAYER);
    this.lensedArch.layers.set(BLACK_HOLE_OVERLAY_LAYER);
    this.jetA.layers.set(BLACK_HOLE_OVERLAY_LAYER);
    this.jetB.layers.set(BLACK_HOLE_OVERLAY_LAYER);
    this.streams.points.layers.set(BLACK_HOLE_OVERLAY_LAYER);

    this.accretionDisk.rotation.x = DISK_INCLINATION;
    this.lensedArch.rotation.x = DISK_INCLINATION;
    // Torus lies in XY — continuous circle around the silhouette for +Z views.
    this.photonRing.rotation.set(0, 0, 0);
    this.jetA.rotation.x = DISK_INCLINATION;
    this.jetB.rotation.x = DISK_INCLINATION + Math.PI;

    this.root.add(
      this.jetA,
      this.jetB,
      this.accretionDisk,
      this.lensedArch,
      this.streams.points,
      this.horizon,
      this.overlayHorizon,
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
      toneMapped: true,
      transparent: true,
    });
    const overlay = new Mesh(this.bodyOverlayGeometry, material);
    overlay.name = `black-hole-redshift-${bodyId}`;
    overlay.renderOrder = 16;
    overlay.scale.setScalar(1.035);
    overlay.visible = false;
    overlay.layers.set(BLACK_HOLE_OVERLAY_LAYER);
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
    const spin = frame.spinVisualization;
    const absSpin = Math.abs(spin);
    const time = this.reducedMotion ? 0 : frame.scenarioTimeSeconds % 10_000;

    this.root.position.fromArray(frame.positionRenderUnits);
    this.root.visible = active;
    this.horizon.visible = active;
    this.overlayHorizon.visible = active;
    this.horizon.scale.setScalar(Math.max(visualRadius, 1e-12));
    this.overlayHorizon.scale.setScalar(Math.max(visualRadius, 1e-12));

    this.photonRing.visible = active && this.quality !== 'low';
    this.photonRing.scale.setScalar(Math.max(visualRadius, 1e-12));
    const photonUniforms = this.photonRingMaterial.uniforms as {
      time: Uniform<number>;
      opacity: Uniform<number>;
      spin: Uniform<number>;
    };
    photonUniforms.time.value = time;
    photonUniforms.spin.value = spin;
    photonUniforms.opacity.value = photonOpacityForQuality(this.quality) *
      (this.reducedMotion ? 0.85 : 1);

    const diskVisible = active && frame.accretionDiskEnabled;
    this.accretionDisk.visible = diskVisible;
    this.accretionDisk.scale.setScalar(Math.max(visualRadius, 1e-12));
    const diskUniforms = this.diskMaterial.uniforms as {
      time: Uniform<number>;
      spin: Uniform<number>;
      opacity: Uniform<number>;
    };
    diskUniforms.time.value = time;
    diskUniforms.spin.value = spin;
    diskUniforms.opacity.value = diskOpacityForQuality(this.quality);

    this.lensedArch.visible = diskVisible && this.quality !== 'low';
    this.lensedArch.scale.setScalar(Math.max(visualRadius, 1e-12));
    const archUniforms = this.lensedArchMaterial.uniforms as {
      time: Uniform<number>;
      spin: Uniform<number>;
      opacity: Uniform<number>;
    };
    archUniforms.time.value = time;
    archUniforms.spin.value = spin;
    archUniforms.opacity.value = diskOpacityForQuality(this.quality) * 0.72;

    const jetVisible =
      active
      && frame.accretionDiskEnabled
      && absSpin > 0.12
      && this.quality !== 'low';
    this.jetA.visible = jetVisible;
    this.jetB.visible = jetVisible;
    if (jetVisible) {
      const jetLength = visualRadius * (5.2 + absSpin * 2.4);
      const jetWidth = visualRadius * (0.28 + absSpin * 0.14);
      this.jetA.scale.set(jetWidth, jetLength, 1);
      this.jetB.scale.set(jetWidth * 0.88, jetLength * 0.9, 1);
      const ny = Math.cos(DISK_INCLINATION);
      const nz = Math.sin(DISK_INCLINATION);
      this.jetA.position.set(0, ny * jetLength * 0.5, nz * jetLength * 0.5);
      this.jetB.position.set(0, -ny * jetLength * 0.46, -nz * jetLength * 0.46);
      const jetOpacity = (this.reducedMotion ? 0.12 : 0.18) * Math.max(absSpin, 0.35);
      const jetAUniforms = this.jetMaterialA.uniforms as {
        time: Uniform<number>;
        opacity: Uniform<number>;
      };
      const jetBUniforms = this.jetMaterialB.uniforms as {
        time: Uniform<number>;
        opacity: Uniform<number>;
      };
      jetAUniforms.time.value = time;
      jetBUniforms.time.value = time;
      jetAUniforms.opacity.value = jetOpacity;
      jetBUniforms.opacity.value = jetOpacity * 0.75;
    }

    const streamPointCount = active
      ? this.writeStreams(frame, visualRadius)
      : 0;
    this.streams.points.geometry.setDrawRange(0, streamPointCount);
    this.streams.points.visible = streamPointCount > 0;
    (this.streams.points.material.uniforms as { opacity: Uniform<number> }).opacity.value =
      streamPointCount > 0 ? 0.92 : 0;

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
    this.overlayHorizon.visible = false;
    this.photonRing.visible = false;
    this.accretionDisk.visible = false;
    this.lensedArch.visible = false;
    this.jetA.visible = false;
    this.jetB.visible = false;
    this.streams.points.visible = false;
    this.streams.points.geometry.setDrawRange(0, 0);
    (this.streams.points.material.uniforms as { opacity: Uniform<number> }).opacity.value = 0;
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
    if (this.diagnostics.accretionDiskVisible) return 0.68;
    if (this.lensingDiagnostics.path === 'schwarzschild') return 0.74;
    return 0.82;
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
    this.lensedArchGeometry.dispose();
    this.lensedArchMaterial.dispose();
    this.jetRibbonGeometry.dispose();
    this.jetMaterialA.dispose();
    this.jetMaterialB.dispose();
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
    const positions = this.streams.position.array as Float32Array;
    const sizes = this.streams.size.array as Float32Array;
    const heats = this.streams.heat.array as Float32Array;
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
        positions[offset] = safeX * remaining + Math.cos(angle) * taper * 0.16;
        positions[offset + 1] = safeY * remaining + Math.sin(angle * 0.77) * taper * 0.08;
        positions[offset + 2] = safeZ * remaining + Math.sin(angle) * taper * 0.16;
        sizes[cursor] = 1.2 + (1 - along) * 2.8 + random01(seed, 4 + index) * 1.4;
        heats[cursor] = clampUnit(0.35 + (1 - along) * 0.65 + flow * 0.2);
        cursor += 1;
      }
    }
    this.streams.position.needsUpdate = true;
    this.streams.size.needsUpdate = true;
    this.streams.heat.needsUpdate = true;
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
    const sizeScale =
      this.quality === 'low' ? 0.7 : this.quality === 'medium' ? 0.9 : this.quality === 'high' ? 1.1 : 1.35;
    (this.streams.points.material.uniforms as { sizeScale: Uniform<number> }).sizeScale.value =
      sizeScale;
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error('Black-hole visual system is disposed.');
  }
}

function createStreams(): StreamResources {
  const position = new Float32BufferAttribute(
    new Float32Array(MAX_STREAM_POINTS * 3),
    3,
  );
  const size = new Float32BufferAttribute(new Float32Array(MAX_STREAM_POINTS), 1);
  const heat = new Float32BufferAttribute(new Float32Array(MAX_STREAM_POINTS), 1);
  position.setUsage(DynamicDrawUsage);
  size.setUsage(DynamicDrawUsage);
  heat.setUsage(DynamicDrawUsage);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', position);
  geometry.setAttribute('aSize', size);
  geometry.setAttribute('aHeat', heat);
  geometry.setDrawRange(0, 0);
  const material = new ShaderMaterial({
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: true,
    transparent: true,
    uniforms: {
      opacity: new Uniform(0),
      sizeScale: new Uniform(1.1),
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aHeat;
      uniform float sizeScale;
      varying float vHeat;
      void main() {
        vHeat = aHeat;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(aSize * sizeScale * (180.0 / max(-mvPosition.z, 1.0)), 1.5, 28.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float opacity;
      varying float vHeat;
      void main() {
        vec2 centered = gl_PointCoord - vec2(0.5);
        float dist = length(centered);
        float soft = smoothstep(0.5, 0.08, dist);
        vec3 cool = vec3(1.05, 0.28, 0.05);
        vec3 hot = vec3(2.6, 1.55, 0.55);
        vec3 color = mix(cool, hot, clamp(vHeat, 0.0, 1.0));
        gl_FragColor = vec4(color, soft * opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const points = new Points(geometry, material);
  points.name = 'black-hole-deterministic-accretion-streams';
  points.frustumCulled = false;
  points.visible = false;
  return { points, position, size, heat };
}

function createPhotonRingMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: true,
    transparent: true,
    uniforms: {
      time: new Uniform(0),
      spin: new Uniform(0),
      opacity: new Uniform(1),
    },
    vertexShader: /* glsl */ `
      varying vec2 vLocal;
      void main() {
        // Torus local XY is the ring plane; radial distance from tube center
        // is encoded via normal-ish projection — use UV along tube.
        vLocal = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform float spin;
      uniform float opacity;
      varying vec2 vLocal;

      void main() {
        // Soft continuous tube — no discard gaps that read as a dashed circle.
        // Torus UV: x = around tube, y = around major ring.
        float across = abs(vLocal.x - 0.5) * 2.0;
        float core = exp(-across * across * 14.0);
        float halo = exp(-across * across * 4.0) * 0.35;
        float band = clamp(core + halo, 0.0, 1.0);
        float signedSpin = clamp(spin, -1.0, 1.0);
        float direction = signedSpin < 0.0 ? -1.0 : 1.0;
        float azimuth = vLocal.y * 6.28318530718;
        float approachingSide = 0.5 + 0.5 * cos(azimuth) * direction;
        approachingSide = smoothstep(0.2, 0.8, approachingSide);
        float beaming = mix(0.85, 1.35, approachingSide);
        vec3 color = vec3(2.9, 2.15, 1.25) * beaming;
        gl_FragColor = vec4(color, band * opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function createAccretionDiskMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: true,
    transparent: true,
    uniforms: {
      time: new Uniform(0),
      spin: new Uniform(0),
      opacity: new Uniform(0.78),
    },
    vertexShader: /* glsl */ `
      varying vec2 diskPosition;
      varying float diskHeight;
      void main() {
        diskPosition = position.xy;
        float radius = max(length(position.xy), 0.0001);
        // Gentle thickness + far-side lift so the back of the disk arches over.
        float thickness = sin((radius - 1.85) / 2.75 * 3.14159) * 0.18;
        float farLift = max(-position.y, 0.0) * 0.42 * smoothstep(2.0, 4.2, radius);
        vec3 warped = position + vec3(0.0, 0.0, thickness + farLift);
        diskHeight = warped.z;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(warped, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform float spin;
      uniform float opacity;
      varying vec2 diskPosition;
      varying float diskHeight;

      void main() {
        float radius = max(length(diskPosition), 0.0001);
        // Smooth radial falloff only — no high-frequency sin bands / moiré.
        float radial = smoothstep(1.85, 2.15, radius) * (1.0 - smoothstep(3.9, 4.6, radius));
        float azimuth = atan(diskPosition.y, diskPosition.x);
        float signedSpin = clamp(spin, -1.0, 1.0);
        float direction = signedSpin < 0.0 ? -1.0 : 1.0;
        float orbital = max(abs(signedSpin), 0.55);

        // Doppler: approaching half clearly brighter/whiter, receding dimmer/redder.
        float approachingSide = 0.5 + 0.5 * cos(azimuth) * direction;
        approachingSide = smoothstep(0.12, 0.88, approachingSide);
        float beaming = mix(0.22, 2.35, approachingSide);
        beaming = mix(1.0, beaming, orbital);

        float temperature = pow(clamp((4.6 - radius) / 2.6, 0.0, 1.0), 0.65);
        vec3 cool = vec3(0.42, 0.04, 0.012);
        vec3 warm = vec3(1.55, 0.32, 0.05);
        vec3 hot = vec3(3.5, 2.45, 1.55);
        vec3 approachingTint = mix(warm, hot, temperature);
        vec3 recedingTint = mix(cool, vec3(0.95, 0.12, 0.03), temperature * 0.55);
        vec3 color = mix(recedingTint, approachingTint, approachingSide);
        color *= beaming;

        // Very soft, low-frequency glow drift — not concentric stripes.
        float drift = 0.94 + 0.06 * sin(azimuth * 2.0 + time * 0.2 * direction);
        color *= drift;

        float heightFade = 1.0 - smoothstep(0.22, 0.55, abs(diskHeight));
        float innerRim = smoothstep(1.85, 2.05, radius) * (1.0 - smoothstep(2.05, 2.45, radius));
        color += vec3(2.6, 1.85, 1.1) * innerRim * mix(0.25, 1.2, approachingSide);
        gl_FragColor = vec4(color, radial * opacity * heightFade);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function createLensedArchMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: true,
    transparent: true,
    uniforms: {
      time: new Uniform(0),
      spin: new Uniform(0),
      opacity: new Uniform(0.55),
    },
    vertexShader: /* glsl */ `
      varying vec2 diskPosition;
      void main() {
        diskPosition = position.xy;
        float radius = max(length(position.xy), 0.0001);
        float far = max(-position.y, 0.0);
        // Lift the far side clearly over the silhouette as a thin arch.
        float arch = far * far * 0.55 * smoothstep(2.0, 4.0, radius);
        vec3 warped = vec3(position.x * (1.0 + arch * 0.06), position.y, position.z + arch);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(warped, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform float spin;
      uniform float opacity;
      varying vec2 diskPosition;

      void main() {
        float radius = max(length(diskPosition), 0.0001);
        float radial = smoothstep(2.0, 2.35, radius) * (1.0 - smoothstep(3.6, 4.2, radius));
        float azimuth = atan(diskPosition.y, diskPosition.x);
        float signedSpin = clamp(spin, -1.0, 1.0);
        float direction = signedSpin < 0.0 ? -1.0 : 1.0;
        float farMask = smoothstep(0.05, 0.65, -diskPosition.y / max(radius, 0.001));
        float approachingSide = 0.5 + 0.5 * cos(azimuth) * direction;
        approachingSide = smoothstep(0.15, 0.85, approachingSide);
        float beaming = mix(0.35, 1.85, approachingSide);
        vec3 cool = vec3(0.9, 0.14, 0.04);
        vec3 hot = vec3(2.9, 2.0, 1.15);
        vec3 color = mix(cool, hot, approachingSide) * beaming;
        gl_FragColor = vec4(color, radial * farMask * opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function createJetRibbonGeometry(): PlaneGeometry {
  return new PlaneGeometry(1, 1, 1, 48);
}

function createJetRibbonMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: true,
    transparent: true,
    uniforms: {
      time: new Uniform(0),
      opacity: new Uniform(0.15),
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform float opacity;
      varying vec2 vUv;

      void main() {
        float across = abs(vUv.x - 0.5) * 2.0;
        float radial = exp(-across * across * 7.0);
        float along = vUv.y;
        // Soft fade at BOTH ends — no hard rectangular cutoff or spikes.
        float tip = smoothstep(0.0, 0.22, along);
        float tail = 1.0 - smoothstep(0.45, 1.0, along);
        float taper = tip * tail;
        vec3 color = mix(vec3(0.35, 0.55, 1.2), vec3(1.2, 1.35, 2.0), radial);
        float alpha = radial * taper * opacity;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function qualityStreamBudget(quality: VisualQuality, reducedMotion: boolean): number {
  const budget = quality === 'low' ? 28 : quality === 'medium' ? 56 : quality === 'high' ? 96 : 144;
  return Math.max(8, Math.floor(budget * (reducedMotion ? 0.5 : 1)));
}

function diskOpacityForQuality(quality: VisualQuality): number {
  return quality === 'low' ? 0.55 : quality === 'medium' ? 0.7 : quality === 'high' ? 0.82 : 0.9;
}

function photonOpacityForQuality(quality: VisualQuality): number {
  return quality === 'low' ? 0 : quality === 'medium' ? 0.85 : quality === 'high' ? 1.0 : 1.05;
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
