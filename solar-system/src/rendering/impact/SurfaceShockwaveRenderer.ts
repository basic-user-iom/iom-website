import {
  Group,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

import type { ImpactRenderState } from './ImpactRenderTypes';
import { clampImpactUnit, type ImpactSurfaceBasis } from './ImpactSurfaceMath';

export class SurfaceShockwaveRenderer {
  public readonly root = new Group();
  public groundVisible = false;
  public atmosphericVisible = false;
  public groundAngularRadiusRad = 0;
  public atmosphericAngularRadiusRad = 0;
  public surfaceConforming = false;
  public surfaceAttachmentErrorM = 0;
  public activeObjectCount = 0;

  private readonly geometry = new SphereGeometry(1, 64, 32);
  private readonly groundMaterial = createWaveMaterial(0xc58a56, false);
  private readonly atmosphericMaterial = createWaveMaterial(0x9cc8d8, true);
  private readonly ground = new Mesh(this.geometry, this.groundMaterial);
  private readonly atmospheric = new Mesh(this.geometry, this.atmosphericMaterial);
  private disposed = false;

  public constructor() {
    this.root.name = 'impact-curved-shockwave-renderer';
    this.ground.name = 'impact-curved-ground-shockwave';
    this.atmospheric.name = 'impact-curved-atmospheric-shockwave';
    this.ground.frustumCulled = false;
    this.atmospheric.frustumCulled = false;
    this.ground.renderOrder = 8;
    this.atmospheric.renderOrder = 9;
    this.root.add(this.ground, this.atmospheric);
    this.reset();
  }

  public update(
    state: Readonly<ImpactRenderState>,
    basis: Readonly<ImpactSurfaceBasis>,
    active: boolean,
    presentationMultiplier = 1,
  ): void {
    this.groundAngularRadiusRad = Math.min(
      Math.PI * 0.94,
      Math.max(0, state.groundShockwaveAngularRadiusRad * presentationMultiplier),
    );
    this.atmosphericAngularRadiusRad = Math.min(
      Math.PI * 0.94,
      Math.max(0, state.atmosphericShockwaveAngularRadiusRad * presentationMultiplier),
    );
    this.groundVisible = active
      && state.eventElapsedSeconds !== null
      && state.supportsGroundShockwave
      && state.outcomeKind === 'solid-surface-impact'
      && this.groundAngularRadiusRad > 0
      && state.groundShockwaveOpacity > 0;
    this.atmosphericVisible = active
      && state.eventElapsedSeconds !== null
      && state.supportsAtmosphericShockwave
      && this.atmosphericAngularRadiusRad > 0
      && state.atmosphericShockwaveOpacity > 0;
    updateWaveMaterial(
      this.groundMaterial,
      state,
      basis,
      this.groundAngularRadiusRad,
      state.groundShockwaveOpacity * (presentationMultiplier > 1.001 ? 0.15 : 1),
      3 / state.targetRadiusM,
    );
    updateWaveMaterial(
      this.atmosphericMaterial,
      state,
      basis,
      this.atmosphericAngularRadiusRad,
      state.atmosphericShockwaveOpacity * (presentationMultiplier > 1.001 ? 0.08 : 1),
      Math.max(12_000 / state.targetRadiusM, 0.002),
    );
    this.ground.visible = this.groundVisible;
    this.atmospheric.visible = this.atmosphericVisible;
    this.root.visible = this.groundVisible || this.atmosphericVisible;
    this.surfaceConforming = this.root.visible;
    this.surfaceAttachmentErrorM = 0;
    this.activeObjectCount = Number(this.groundVisible) + Number(this.atmosphericVisible);
  }

  public reset(): void {
    if (this.disposed) return;
    this.root.visible = false;
    this.ground.visible = false;
    this.atmospheric.visible = false;
    this.groundVisible = false;
    this.atmosphericVisible = false;
    this.groundAngularRadiusRad = 0;
    this.atmosphericAngularRadiusRad = 0;
    this.surfaceConforming = false;
    this.surfaceAttachmentErrorM = 0;
    this.activeObjectCount = 0;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.geometry.dispose();
    this.groundMaterial.dispose();
    this.atmosphericMaterial.dispose();
    this.root.clear();
  }
}

function createWaveMaterial(color: number, atmospheric: boolean): ShaderMaterial {
  return new ShaderMaterial({
    depthTest: true,
    depthWrite: false,
    fragmentShader: `
      uniform vec3 uImpactDirection;
      uniform vec3 uColor;
      uniform float uAngularRadius;
      uniform float uOpacity;
      uniform float uAtmospheric;
      varying vec3 vBodyDirection;
      void main() {
        float angularDistance = acos(clamp(
          dot(normalize(vBodyDirection), normalize(uImpactDirection)), -1.0, 1.0
        ));
        float ringWidth = max(0.00018, uAngularRadius * mix(0.035, 0.065, uAtmospheric));
        float ring = 1.0 - smoothstep(
          ringWidth,
          ringWidth * 1.8,
          abs(angularDistance - uAngularRadius)
        );
        float wake = uAtmospheric * (1.0 - smoothstep(
          ringWidth * 4.0,
          ringWidth * 12.0,
          abs(angularDistance - uAngularRadius)
        )) * 0.18;
        float alpha = (ring + wake) * uOpacity;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(uColor * (0.68 + ring * 0.24), min(alpha, 0.32));
      }
    `,
    toneMapped: false,
    transparent: true,
    uniforms: {
      uAngularRadius: { value: 0 },
      uAtmospheric: { value: atmospheric ? 1 : 0 },
      uAxisScale: { value: new Vector3(1, 1, 1) },
      uColor: { value: new Vector3(
        ((color >> 16) & 0xff) / 255,
        ((color >> 8) & 0xff) / 255,
        (color & 0xff) / 255,
      ) },
      uImpactDirection: { value: new Vector3(1, 0, 0) },
      uOpacity: { value: 0 },
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
}

function updateWaveMaterial(
  material: ShaderMaterial,
  state: Readonly<ImpactRenderState>,
  basis: Readonly<ImpactSurfaceBasis>,
  angularRadius: number,
  opacity: number,
  surfaceOffset: number,
): void {
  (material.uniforms.uAxisScale!.value as Vector3).set(
    state.targetEquatorialRadiusM / state.targetRadiusM,
    state.targetPolarRadiusM / state.targetRadiusM,
    state.targetEquatorialRadiusM / state.targetRadiusM,
  );
  (material.uniforms.uImpactDirection!.value as Vector3).copy(basis.normal);
  material.uniforms.uAngularRadius!.value = angularRadius;
  material.uniforms.uOpacity!.value = clampImpactUnit(opacity);
  material.uniforms.uSurfaceOffset!.value = surfaceOffset;
}
