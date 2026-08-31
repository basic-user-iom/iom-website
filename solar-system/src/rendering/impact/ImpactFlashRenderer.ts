import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  PointLight,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

import type { ImpactRenderState } from './ImpactRenderTypes';
import {
  ellipsoidSurfaceAttachmentErrorM,
  impactAngularRadius,
  mapImpactEnuToBodyLocal,
  setEllipsoidSurfaceNormal,
  setEllipsoidSurfacePoint,
  type ImpactSurfaceBasis,
} from './ImpactSurfaceMath';

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

  private readonly geometry = new SphereGeometry(1, 48, 24);
  private readonly material = new ShaderMaterial({
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    fragmentShader: `
      uniform vec3 uImpactDirection;
      uniform float uAngularRadius;
      uniform float uIntensity;
      varying vec3 vBodyDirection;
      void main() {
        float angularDistance = acos(clamp(
          dot(normalize(vBodyDirection), normalize(uImpactDirection)), -1.0, 1.0
        ));
        float normalizedRadius = angularDistance / max(uAngularRadius, 0.000001);
        float cap = 1.0 - smoothstep(0.56, 1.0, normalizedRadius);
        float core = 1.0 - smoothstep(0.0, 0.42, normalizedRadius);
        float alpha = cap * min(0.94, 0.2 + uIntensity * 0.38);
        if (alpha < 0.004) discard;
        vec3 edge = vec3(1.0, 0.22, 0.035);
        vec3 center = vec3(1.0, 0.94, 0.68);
        vec3 color = mix(edge, center, core) * (0.8 + min(uIntensity, 4.0) * 0.72);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    toneMapped: false,
    transparent: true,
    uniforms: {
      uAngularRadius: { value: 0 },
      uAxisScale: { value: new Vector3(1, 1, 1) },
      uImpactDirection: { value: new Vector3(1, 0, 0) },
      uIntensity: { value: 0 },
      uSurfaceOffset: { value: 0 },
    },
    vertexShader: `
      uniform vec3 uAxisScale;
      uniform float uSurfaceOffset;
      varying vec3 vBodyDirection;
      void main() {
        vBodyDirection = normalize(position);
        vec3 bodyPosition = position * uAxisScale * (1.0 + uSurfaceOffset);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(bodyPosition, 1.0);
      }
    `,
  });
  private readonly cap = new Mesh(this.geometry, this.material);
  private readonly light = new PointLight(new Color(0xffb05d), 0, 0.08, 2);
  private readonly surfacePoint = new Vector3();
  private readonly surfaceNormal = new Vector3();
  private readonly airburstPoint = new Vector3();
  private readonly alignmentScratch = new Vector3();
  private disposed = false;

  public constructor() {
    this.root.name = 'impact-flash-renderer';
    this.cap.name = 'impact-surface-flash-cap';
    this.cap.frustumCulled = false;
    this.cap.renderOrder = 12;
    this.light.name = 'impact-bounded-flash-light';
    this.light.castShadow = false;
    this.root.add(this.cap, this.light);
    this.reset();
  }

  public update(
    state: Readonly<ImpactRenderState>,
    basis: Readonly<ImpactSurfaceBasis>,
    active: boolean,
    reduceFlashes: boolean,
  ): void {
    const ceiling = reduceFlashes ? 0.72 : 4;
    this.effectiveIntensity = Math.min(state.flashIntensity, ceiling);
    this.hdrClamped = state.flashIntensity > ceiling;
    const terminalVisible = active
      && state.eventElapsedSeconds !== null
      && this.effectiveIntensity > 0.001;
    const surfaceFlash = terminalVisible && state.outcomeKind !== 'airburst';
    this.capAngularRadiusRad = impactAngularRadius(state.flashRadiusM, state.targetRadiusM);

    setEllipsoidSurfacePoint(this.surfacePoint, basis.normal, state);
    setEllipsoidSurfaceNormal(this.surfaceNormal, this.surfacePoint, state);
    this.attachmentErrorM = surfaceFlash
      ? ellipsoidSurfaceAttachmentErrorM(this.surfacePoint, state)
      : 0;

    const axis = this.material.uniforms.uAxisScale!.value as Vector3;
    axis.set(
      state.targetEquatorialRadiusM / state.targetRadiusM,
      state.targetPolarRadiusM / state.targetRadiusM,
      state.targetEquatorialRadiusM / state.targetRadiusM,
    );
    (this.material.uniforms.uImpactDirection!.value as Vector3).copy(basis.normal);
    this.material.uniforms.uAngularRadius!.value = this.capAngularRadiusRad;
    this.material.uniforms.uIntensity!.value = this.effectiveIntensity;
    this.material.uniforms.uSurfaceOffset!.value = 2 / state.targetRadiusM;
    this.cap.visible = surfaceFlash && this.capAngularRadiusRad > 0;

    if (state.outcomeKind === 'airburst' && state.impactorLocalEnuM !== null) {
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
        Math.max(2, state.flashRadiusM * 0.04) / state.targetRadiusM,
      );
      this.normalAlignmentDot = this.alignmentScratch.copy(this.light.position)
        .sub(this.surfacePoint)
        .normalize()
        .dot(this.surfaceNormal);
    }
    this.light.intensity = terminalVisible ? 4 + this.effectiveIntensity * 13 : 0;
    this.light.distance = Math.min(
      0.08,
      Math.max(0.004, state.flashRadiusM / state.targetRadiusM * 9),
    );
    this.light.visible = terminalVisible;
    this.root.visible = terminalVisible;
    this.visible = terminalVisible;
    this.lightVisible = this.light.visible;
    this.activeObjectCount = Number(this.cap.visible) + Number(this.light.visible);
  }

  public reset(): void {
    if (this.disposed) return;
    this.root.visible = false;
    this.cap.visible = false;
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
    this.root.clear();
  }
}
