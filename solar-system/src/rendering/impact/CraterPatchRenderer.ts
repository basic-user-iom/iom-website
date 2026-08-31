import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  ShaderMaterial,
  Uint32BufferAttribute,
  Vector3,
} from 'three';

import type { ImpactRenderState } from './ImpactRenderTypes';
import {
  clampImpactUnit,
  ellipsoidSurfaceAttachmentErrorM,
  impactAngularRadius,
  setEllipsoidSurfacePoint,
  type ImpactSurfaceBasis,
} from './ImpactSurfaceMath';

const PATCH_RINGS = 32;
const PATCH_SEGMENTS = 72;

export class CraterPatchRenderer {
  public readonly root = new Group();
  public visible = false;
  public attachmentErrorM = 0;
  public angularRadiusRad = 0;
  public formationProgress = 0;
  public persistent = false;
  public readonly vertexCount: number;
  public activeObjectCount = 0;

  private readonly geometry = createPolarPatchGeometry();
  private readonly material = new ShaderMaterial({
    depthTest: true,
    depthWrite: false,
    fragmentShader: `
      uniform float uFormation;
      uniform float uScorchOpacity;
      uniform float uCraterToPatchRatio;
      uniform float uSeedPhase;
      uniform float uDusty;
      varying vec2 vPatchUv;
      varying float vCraterRadius;
      varying float vRim;
      void main() {
        float patchRadius = length(vPatchUv);
        if (patchRadius > 1.0) discard;
        float edgeFade = 1.0 - smoothstep(0.84, 1.0, patchRadius);
        float crater = 1.0 - smoothstep(0.0, 1.0, vCraterRadius);
        float bowl = pow(max(1.0 - vCraterRadius, 0.0), 2.2);
        float azimuth = atan(vPatchUv.y, vPatchUv.x);
        float rayNoise = pow(max(sin(azimuth * 11.0 + uSeedPhase), 0.0), 5.0);
        float rays = rayNoise * exp(-patchRadius * 2.8) * uScorchOpacity;
        vec3 charColor = mix(vec3(0.055, 0.035, 0.025), vec3(0.12, 0.095, 0.075), uDusty);
        vec3 rimColor = mix(vec3(0.34, 0.18, 0.08), vec3(0.43, 0.35, 0.27), uDusty);
        vec3 color = mix(charColor, rimColor, clamp(vRim * 1.8 + rays * 0.4, 0.0, 1.0));
        color *= 1.0 - bowl * 0.38;
        float alpha = edgeFade * max(crater * uFormation * 0.82, uScorchOpacity * (0.34 + rays));
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(color, min(alpha, 0.96));
      }
    `,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    side: DoubleSide,
    transparent: true,
    uniforms: {
      uAxisScale: { value: new Vector3(1, 1, 1) },
      uCraterDepthRatio: { value: 0 },
      uCraterToPatchRatio: { value: 0.5 },
      uDusty: { value: 0 },
      uEast: { value: new Vector3(0, 0, 1) },
      uFormation: { value: 0 },
      uImpactDirection: { value: new Vector3(1, 0, 0) },
      uNorth: { value: new Vector3(0, 1, 0) },
      uPatchAngularRadius: { value: 0 },
      uRimHeightRatio: { value: 0 },
      uScorchOpacity: { value: 0 },
      uSeedPhase: { value: 0 },
      uSurfaceBias: { value: 0 },
    },
    vertexShader: `
      uniform vec3 uAxisScale;
      uniform vec3 uImpactDirection;
      uniform vec3 uEast;
      uniform vec3 uNorth;
      uniform float uPatchAngularRadius;
      uniform float uCraterToPatchRatio;
      uniform float uCraterDepthRatio;
      uniform float uRimHeightRatio;
      uniform float uFormation;
      uniform float uSurfaceBias;
      varying vec2 vPatchUv;
      varying float vCraterRadius;
      varying float vRim;
      vec3 ellipsoidPoint(vec3 direction) {
        vec3 d = normalize(direction);
        float denominator = sqrt(dot(d * d, 1.0 / (uAxisScale * uAxisScale)));
        return d / max(denominator, 0.000001);
      }
      vec3 ellipsoidNormal(vec3 point) {
        return normalize(point / (uAxisScale * uAxisScale));
      }
      void main() {
        vPatchUv = position.xy;
        float patchRadius = length(position.xy);
        vec2 tangentUv = patchRadius > 0.000001 ? position.xy / patchRadius : vec2(1.0, 0.0);
        vec3 tangent = normalize(uEast * tangentUv.x + uNorth * tangentUv.y);
        float angle = patchRadius * uPatchAngularRadius;
        vec3 direction = normalize(uImpactDirection * cos(angle) + tangent * sin(angle));
        vec3 surface = ellipsoidPoint(direction);
        vec3 surfaceNormal = ellipsoidNormal(surface);
        vCraterRadius = patchRadius / max(uCraterToPatchRatio, 0.0001);
        float bowl = -uCraterDepthRatio * pow(max(1.0 - vCraterRadius, 0.0), 2.2);
        vRim = exp(-pow((vCraterRadius - 1.0) / 0.16, 2.0));
        float boundedDisplacement = max(-uSurfaceBias * 0.45, bowl * 0.06)
          + vRim * uRimHeightRatio;
        surface += surfaceNormal * (uSurfaceBias + boundedDisplacement * uFormation);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(surface, 1.0);
      }
    `,
  });
  private readonly patch = new Mesh(this.geometry, this.material);
  private readonly anchor = new Vector3();
  private disposed = false;

  public constructor() {
    this.vertexCount = this.geometry.getAttribute('position').count;
    this.root.name = 'impact-crater-patch-renderer';
    this.patch.name = 'impact-curved-crater-patch';
    this.patch.frustumCulled = false;
    this.patch.renderOrder = 6;
    this.root.add(this.patch);
    this.reset();
  }

  public update(
    state: Readonly<ImpactRenderState>,
    basis: Readonly<ImpactSurfaceBasis>,
    active: boolean,
  ): void {
    const allowed = state.supportsCrater
      && state.outcomeKind === 'solid-surface-impact'
      && (state.aftermathKind === 'crater' || state.aftermathKind === 'dusty-crater');
    this.formationProgress = clampImpactUnit(state.craterFormationProgress);
    this.angularRadiusRad = impactAngularRadius(state.craterRadiusM, state.targetRadiusM);
    const patchRadiusM = Math.max(state.scorchRadiusM, state.craterRadiusM * 1.45);
    const patchAngularRadius = impactAngularRadius(patchRadiusM, state.targetRadiusM);
    this.visible = active
      && state.eventElapsedSeconds !== null
      && allowed
      && this.angularRadiusRad > 0
      && (this.formationProgress > 0 || state.surfaceScorchOpacity > 0);

    const axis = this.material.uniforms.uAxisScale!.value as Vector3;
    axis.set(
      state.targetEquatorialRadiusM / state.targetRadiusM,
      state.targetPolarRadiusM / state.targetRadiusM,
      state.targetEquatorialRadiusM / state.targetRadiusM,
    );
    (this.material.uniforms.uImpactDirection!.value as Vector3).copy(basis.normal);
    (this.material.uniforms.uEast!.value as Vector3).copy(basis.east);
    (this.material.uniforms.uNorth!.value as Vector3).copy(basis.north);
    this.material.uniforms.uPatchAngularRadius!.value = patchAngularRadius;
    this.material.uniforms.uCraterToPatchRatio!.value = patchRadiusM > 0
      ? state.craterRadiusM / patchRadiusM
      : 0;
    this.material.uniforms.uCraterDepthRatio!.value = Math.min(
      state.craterDepthM / state.targetRadiusM,
      this.angularRadiusRad * 0.22,
    );
    this.material.uniforms.uRimHeightRatio!.value = Math.min(
      state.craterDepthM * 0.18 / state.targetRadiusM,
      this.angularRadiusRad * 0.04,
    );
    this.material.uniforms.uFormation!.value = this.formationProgress;
    this.material.uniforms.uScorchOpacity!.value = clampImpactUnit(
      state.surfaceScorchOpacity,
    );
    this.material.uniforms.uDusty!.value = state.aftermathKind === 'dusty-crater' ? 1 : 0;
    this.material.uniforms.uSeedPhase!.value = hashPhase(state.runSignature);
    this.material.uniforms.uSurfaceBias!.value = 1.5 / state.targetRadiusM;

    setEllipsoidSurfacePoint(this.anchor, basis.normal, state);
    this.attachmentErrorM = this.visible
      ? ellipsoidSurfaceAttachmentErrorM(this.anchor, state)
      : 0;
    this.persistent = this.visible && state.supportsPersistentSurfaceDecal;
    this.patch.visible = this.visible;
    this.root.visible = this.visible;
    this.activeObjectCount = Number(this.visible);
  }

  public reset(): void {
    if (this.disposed) return;
    this.root.visible = false;
    this.patch.visible = false;
    this.visible = false;
    this.attachmentErrorM = 0;
    this.angularRadiusRad = 0;
    this.formationProgress = 0;
    this.persistent = false;
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

function createPolarPatchGeometry(): BufferGeometry {
  const vertexCount = 1 + PATCH_RINGS * PATCH_SEGMENTS;
  const positions = new Float32Array(vertexCount * 3);
  let vertex = 1;
  for (let ring = 1; ring <= PATCH_RINGS; ring += 1) {
    const radius = ring / PATCH_RINGS;
    for (let segment = 0; segment < PATCH_SEGMENTS; segment += 1) {
      const angle = segment / PATCH_SEGMENTS * Math.PI * 2;
      const offset = vertex * 3;
      positions[offset] = Math.cos(angle) * radius;
      positions[offset + 1] = Math.sin(angle) * radius;
      vertex += 1;
    }
  }
  const triangleCount = PATCH_SEGMENTS + (PATCH_RINGS - 1) * PATCH_SEGMENTS * 2;
  const indices = new Uint32Array(triangleCount * 3);
  let write = 0;
  for (let segment = 0; segment < PATCH_SEGMENTS; segment += 1) {
    indices[write++] = 0;
    indices[write++] = 1 + segment;
    indices[write++] = 1 + (segment + 1) % PATCH_SEGMENTS;
  }
  for (let ring = 2; ring <= PATCH_RINGS; ring += 1) {
    const innerStart = 1 + (ring - 2) * PATCH_SEGMENTS;
    const outerStart = 1 + (ring - 1) * PATCH_SEGMENTS;
    for (let segment = 0; segment < PATCH_SEGMENTS; segment += 1) {
      const next = (segment + 1) % PATCH_SEGMENTS;
      indices[write++] = innerStart + segment;
      indices[write++] = outerStart + segment;
      indices[write++] = outerStart + next;
      indices[write++] = innerStart + segment;
      indices[write++] = outerStart + next;
      indices[write++] = innerStart + next;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(new Uint32BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  geometry.name = 'impact-polar-crater-patch-geometry';
  return geometry;
}

function hashPhase(signature: string): number {
  let hash = 0;
  for (let index = 0; index < signature.length; index += 1) {
    hash = Math.imul(hash ^ signature.charCodeAt(index), 0x45d9f3b);
  }
  return (hash >>> 0) / 0x1_0000_0000 * Math.PI * 2;
}
