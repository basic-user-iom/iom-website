import {
  Group,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

import type { ImpactRenderState } from './ImpactRenderTypes';
import {
  clampImpactUnit,
  impactAngularRadius,
  setBodyYAxisAdvection,
  type ImpactSurfaceBasis,
} from './ImpactSurfaceMath';

export class AtmosphericScarRenderer {
  public readonly root = new Group();
  public visible = false;
  public rippleVisible = false;
  public angularRadiusRad = 0;
  public opacity = 0;
  public advectionRad = 0;
  public activeObjectCount = 0;

  private readonly geometry = new SphereGeometry(1, 64, 32);
  private readonly material = new ShaderMaterial({
    depthTest: true,
    depthWrite: false,
    fragmentShader: `
      uniform vec3 uScarDirection;
      uniform float uAngularRadius;
      uniform float uGrowth;
      uniform float uOpacity;
      varying vec3 vBodyDirection;
      void main() {
        float angularDistance = acos(clamp(
          dot(normalize(vBodyDirection), normalize(uScarDirection)), -1.0, 1.0
        ));
        float normalizedRadius = angularDistance / max(uAngularRadius, 0.000001);
        float core = 1.0 - smoothstep(0.16, 0.9, normalizedRadius);
        float irregular = 0.84 + 0.16 * sin(
          atan(vBodyDirection.z, vBodyDirection.x) * 13.0 + normalizedRadius * 18.0
        );
        float scar = core * irregular;
        float rippleWidth = max(0.035, 0.11 * (1.0 - uGrowth));
        float ripple = 1.0 - smoothstep(
          rippleWidth,
          rippleWidth * 1.9,
          abs(normalizedRadius - 1.0)
        );
        vec3 darkCloud = vec3(0.105, 0.075, 0.055);
        vec3 brightRipple = vec3(0.82, 0.72, 0.56);
        vec3 color = mix(darkCloud, brightRipple, ripple * 0.72);
        float alpha = (scar * 0.72 + ripple * (1.0 - uGrowth) * 0.42) * uOpacity;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(color, min(alpha, 0.84));
      }
    `,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    transparent: true,
    uniforms: {
      uAngularRadius: { value: 0 },
      uAxisScale: { value: new Vector3(1, 1, 1) },
      uGrowth: { value: 0 },
      uOpacity: { value: 0 },
      uScarDirection: { value: new Vector3(1, 0, 0) },
      uSurfaceOffset: { value: 0.0025 },
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
  private readonly scar = new Mesh(this.geometry, this.material);
  private readonly advectedDirection = new Vector3();
  private disposed = false;

  public constructor() {
    this.root.name = 'impact-atmospheric-scar-renderer';
    this.scar.name = 'impact-advected-cloud-scar';
    this.scar.frustumCulled = false;
    this.scar.renderOrder = 7;
    this.root.add(this.scar);
    this.reset();
  }

  public update(
    state: Readonly<ImpactRenderState>,
    basis: Readonly<ImpactSurfaceBasis>,
    active: boolean,
    presentationMultiplier = 1,
  ): void {
    const growth = clampImpactUnit(state.cloudScarGrowthProgress);
    this.opacity = clampImpactUnit(state.cloudScarOpacity);
    this.advectionRad = state.cloudScarAdvectionRad;
    this.angularRadiusRad = impactAngularRadius(
      state.cloudScarRadiusM * presentationMultiplier * Math.max(growth, 0.035),
      state.targetRadiusM,
    );
    this.visible = active
      && state.eventElapsedSeconds !== null
      && state.supportsCloudScar
      && (state.surfaceEffectProfile === 'giant-atmospheric'
        || state.surfaceEffectProfile === 'solid-atmospheric')
      && this.angularRadiusRad > 0
      && this.opacity > 0;
    setBodyYAxisAdvection(
      this.advectedDirection,
      basis.normal,
      state.cloudScarAdvectionRad,
    );
    (this.material.uniforms.uAxisScale!.value as Vector3).set(
      state.targetEquatorialRadiusM / state.targetRadiusM,
      state.targetPolarRadiusM / state.targetRadiusM,
      state.targetEquatorialRadiusM / state.targetRadiusM,
    );
    (this.material.uniforms.uScarDirection!.value as Vector3).copy(this.advectedDirection);
    this.material.uniforms.uAngularRadius!.value = this.angularRadiusRad;
    this.material.uniforms.uGrowth!.value = growth;
    this.material.uniforms.uOpacity!.value = this.opacity;
    this.rippleVisible = this.visible && growth < 0.98;
    this.scar.visible = this.visible;
    this.root.visible = this.visible;
    this.activeObjectCount = Number(this.visible);
  }

  public reset(): void {
    if (this.disposed) return;
    this.root.visible = false;
    this.scar.visible = false;
    this.material.uniforms.uOpacity!.value = 0;
    this.visible = false;
    this.rippleVisible = false;
    this.angularRadiusRad = 0;
    this.opacity = 0;
    this.advectionRad = 0;
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
