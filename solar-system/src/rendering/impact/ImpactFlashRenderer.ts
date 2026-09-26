import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  PlaneGeometry,
  PointLight,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

import { IMPACT_NOISE_GLSL } from './ImpactNoise';
import type { ImpactRenderState } from './ImpactRenderTypes';
import {
  ellipsoidSurfaceAttachmentErrorM,
  impactAngularRadius,
  mapImpactEnuToBodyLocal,
  setEllipsoidSurfaceNormal,
  setEllipsoidSurfacePoint,
  type ImpactSurfaceBasis,
} from './ImpactSurfaceMath';

/** Visual-only scale — keep flash local, not a fireworks disc. */
const FLASH_VISUAL_RADIUS_SCALE = 0.85;

/**
 * Brief anisotropic impact flash: short screen-facing ribbon stretched
 * downrange — not a sphere cap and not a filled disc.
 */
export class ImpactFlashRenderer {
  public readonly root = new Group();
  public visible = false;
  public attachmentErrorM = 0;
  public normalAlignmentDot = 0;
  public capAngularRadiusRad = 0;
  public lightVisible = false;
  public hdrClamped = false;
  public effectiveIntensity = 0;
  public activeObjectCount = 0;

  private readonly geometry = new PlaneGeometry(2, 1, 1, 1);
  private readonly material = new ShaderMaterial({
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    fragmentShader: `
      uniform float uIntensity;
      varying vec2 vUv;
      ${IMPACT_NOISE_GLSL}
      void main() {
        vec2 centered = vUv * 2.0 - 1.0;
        // Anisotropic: long along X (downrange), thin across Y.
        float along = abs(centered.x);
        float across = abs(centered.y);
        float noise = impactFbm(vec3(centered * 5.0, uIntensity * 0.3));
        float core = exp(-along * along * 2.8 - across * across * 14.0);
        float fringe = exp(-along * along * 1.1 - across * across * 6.5)
          * (0.55 + noise * 0.45);
        float alpha = max(core * 1.15, fringe * 0.7)
          * min(0.95, 0.18 + uIntensity * 0.35);
        // Punch holes so it never reads as a solid oval.
        alpha *= mix(0.55, 1.0, noise) * (1.0 - smoothstep(0.65, 1.0, length(centered)));
        if (alpha < 0.012) discard;
        vec3 edge = vec3(1.0, 0.42, 0.08);
        vec3 center = vec3(1.0, 0.97, 0.88);
        vec3 color = mix(edge, center, core) * (0.9 + min(uIntensity, 4.0) * 0.65);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    side: DoubleSide,
    toneMapped: false,
    transparent: true,
    uniforms: {
      uIntensity: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  });
  private readonly cap = new Mesh(this.geometry, this.material);
  private readonly fireballGeometry = new SphereGeometry(1, 32, 24);
  private readonly fireballMaterial = new ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
    uniforms: { uIntensity: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vPosition = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uIntensity;
      uniform float uTime;
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying vec3 vView;
      ${IMPACT_NOISE_GLSL}
      void main() {
        float n = impactFbm(vPosition * 4.2 + vec3(0.0, -uTime * 0.7, 0.0));
        float facing = max(0.0, dot(normalize(vNormal), normalize(vView)));
        float edge = smoothstep(0.0, 0.48, facing);
        float heat = smoothstep(0.24, 0.76, n) * min(1.0, uIntensity);
        vec3 color = mix(vec3(0.95, 0.12, 0.015), vec3(2.5, 1.85, 0.85), heat);
        float alpha = edge * min(0.9, uIntensity * 0.75) * (0.55 + n * 0.45);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
  private readonly fireball = new Mesh(this.fireballGeometry, this.fireballMaterial);
  private readonly light = new PointLight(new Color(0xffc878), 0, 0.08, 2);
  private readonly surfacePoint = new Vector3();
  private readonly surfaceNormal = new Vector3();
  private readonly airburstPoint = new Vector3();
  private readonly alignmentScratch = new Vector3();
  private readonly downrangeScratch = new Vector3();
  private readonly acrossScratch = new Vector3();
  private readonly basisX = new Vector3();
  private readonly basisY = new Vector3();
  private readonly basisZ = new Vector3();
  private readonly orientation = new Matrix4();
  private disposed = false;

  public constructor() {
    this.root.name = 'impact-flash-renderer';
    this.cap.name = 'impact-surface-flash-cap';
    this.cap.frustumCulled = false;
    this.cap.renderOrder = 12;
    this.light.name = 'impact-bounded-flash-light';
    this.light.castShadow = false;
    this.fireball.name = 'impact-expanding-fireball';
    this.fireball.frustumCulled = false;
    this.fireball.renderOrder = 11;
    this.root.add(this.cap, this.fireball, this.light);
    this.reset();
  }

  public update(
    state: Readonly<ImpactRenderState>,
    basis: Readonly<ImpactSurfaceBasis>,
    active: boolean,
    reduceFlashes: boolean,
    presentationMultiplier = 1,
  ): void {
    const ceiling = reduceFlashes ? 0.72 : 4;
    this.effectiveIntensity = Math.min(state.flashIntensity, ceiling);
    this.hdrClamped = state.flashIntensity > ceiling;
    const terminalVisible = active
      && state.eventElapsedSeconds !== null
      && this.effectiveIntensity > 0.001;
    const surfaceFlash = terminalVisible && (state.outcomeKind === 'solid-surface-impact' || state.outcomeKind === 'ocean-surface-impact');
    const drawnFlashRadiusM = state.flashRadiusM * presentationMultiplier * FLASH_VISUAL_RADIUS_SCALE;
    this.capAngularRadiusRad = impactAngularRadius(drawnFlashRadiusM, state.targetRadiusM);

    setEllipsoidSurfacePoint(this.surfacePoint, basis.normal, state);
    setEllipsoidSurfaceNormal(this.surfaceNormal, this.surfacePoint, state);
    this.attachmentErrorM = surfaceFlash
      ? ellipsoidSurfaceAttachmentErrorM(this.surfacePoint, state)
      : 0;

    resolveDownrangeDirection(this.downrangeScratch, state, basis);
    this.acrossScratch.copy(this.surfaceNormal).cross(this.downrangeScratch);
    if (this.acrossScratch.lengthSq() < 1e-12) {
      this.acrossScratch.copy(basis.east);
    }
    this.acrossScratch.normalize();

    // Plane local: X = downrange, Y = across, facing along surface normal.
    this.basisX.copy(this.downrangeScratch);
    this.basisY.copy(this.acrossScratch);
    this.basisZ.copy(this.surfaceNormal);
    this.orientation.makeBasis(this.basisX, this.basisY, this.basisZ);
    this.cap.quaternion.setFromRotationMatrix(this.orientation);
    this.cap.position.copy(this.surfacePoint).addScaledVector(
      this.surfaceNormal,
      Math.max(2, drawnFlashRadiusM * 0.04) / state.targetRadiusM,
    );
    const length = drawnFlashRadiusM * 1.8 / state.targetRadiusM;
    const width = drawnFlashRadiusM * 0.55 / state.targetRadiusM;
    this.cap.scale.set(length, width, 1);
    // Cap flash to the impact-flash stage so later stages are not a leftover star.
    const flashStage = state.stage === 'impact-flash' || state.stage === 'impact' || state.stage === 'airburst';
    this.material.uniforms.uIntensity!.value = flashStage ? this.effectiveIntensity : 0;
    this.cap.visible = surfaceFlash && flashStage && this.capAngularRadiusRad > 0;

    if (state.outcomeKind !== 'solid-surface-impact' && state.outcomeKind !== 'ocean-surface-impact' && state.impactorLocalEnuM !== null) {
      mapImpactEnuToBodyLocal(
        this.airburstPoint,
        state.impactorLocalEnuM.eastM,
        state.impactorLocalEnuM.northM,
        state.impactorLocalEnuM.upM,
        state,
        basis,
        this.surfacePoint,
        this.surfaceNormal,
      );
      this.light.position.copy(this.airburstPoint);
      this.normalAlignmentDot = 0;
    } else {
      setEllipsoidSurfacePoint(this.surfacePoint, basis.normal, state);
      setEllipsoidSurfaceNormal(this.surfaceNormal, this.surfacePoint, state);
      this.light.position.copy(this.surfacePoint).addScaledVector(
        this.surfaceNormal,
        Math.max(2, state.flashRadiusM * presentationMultiplier * 0.04) / state.targetRadiusM,
      );
      this.normalAlignmentDot = this.alignmentScratch.copy(this.light.position)
        .sub(this.surfacePoint)
        .normalize()
        .dot(this.surfaceNormal);
    }
    this.fireball.position.copy(this.light.position);
    this.fireball.quaternion.copy(this.cap.quaternion);
    const fireballRadius = drawnFlashRadiusM / state.targetRadiusM;
    const expansion = 0.28 + 0.72 * (1 - Math.exp(-Math.max(0, state.eventElapsedSeconds ?? 0) * 4));
    this.fireball.scale.set(fireballRadius * expansion, fireballRadius * expansion,
      fireballRadius * expansion * (surfaceFlash ? 0.8 : 1));
    this.fireballMaterial.uniforms.uIntensity!.value = this.effectiveIntensity;
    this.fireballMaterial.uniforms.uTime!.value = state.eventElapsedSeconds ?? 0;
    this.fireball.visible = terminalVisible && flashStage && fireballRadius > 0;
    this.light.intensity = terminalVisible ? 4.2 + this.effectiveIntensity * 14 : 0;
    this.light.distance = Math.min(
      0.07,
      Math.max(0.004, drawnFlashRadiusM / state.targetRadiusM * 9),
    );
    this.light.visible = terminalVisible && (state.outcomeKind === 'airburst' || flashStage);
    this.root.visible = this.light.visible || this.cap.visible || this.fireball.visible;
    this.visible = this.root.visible;
    this.lightVisible = this.light.visible;
    this.activeObjectCount = Number(this.cap.visible) + Number(this.light.visible) + Number(this.fireball.visible);
  }

  public reset(): void {
    if (this.disposed) return;
    this.root.visible = false;
    this.cap.visible = false;
    this.fireball.visible = false;
    this.light.visible = false;
    this.light.intensity = 0;
    this.visible = false;
    this.attachmentErrorM = 0;
    this.normalAlignmentDot = 0;
    this.capAngularRadiusRad = 0;
    this.lightVisible = false;
    this.hdrClamped = false;
    this.effectiveIntensity = 0;
    this.activeObjectCount = 0;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.fireballGeometry.dispose();
    this.fireballMaterial.dispose();
    this.root.clear();
  }
}

function resolveDownrangeDirection(
  output: Vector3,
  state: Readonly<ImpactRenderState>,
  basis: Readonly<ImpactSurfaceBasis>,
): void {
  const velocity = state.impactorVelocityLocalEnuMps;
  if (velocity !== null) {
    const horizontal = Math.hypot(velocity.eastM, velocity.northM);
    if (horizontal > 1e-6) {
      output.copy(basis.east).multiplyScalar(velocity.eastM / horizontal)
        .addScaledVector(basis.north, velocity.northM / horizontal);
      if (output.lengthSq() > 1e-12) {
        output.normalize();
        return;
      }
    }
  }
  output.copy(basis.east);
}
