import {
  AdditiveBlending,
  BufferGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  Points,
  ShaderMaterial,
  Vector3,
  type BufferAttribute,
} from 'three';

import type { ImpactRenderState } from './ImpactRenderTypes';
import {
  clampImpactUnit,
  impactHash,
  impactRandom01,
  setEllipsoidSurfaceNormal,
  setEllipsoidSurfacePoint,
  type ImpactSurfaceBasis,
} from './ImpactSurfaceMath';

const MAX_PLUME_PARTICLES = 192;

export class VolumetricPlumeRenderer {
  public readonly root = new Group();
  public visible = false;
  public pointCount = 0;
  public layerCount = 0;
  public coolingProgress = 0;
  public activeObjectCount = 0;

  private readonly positionAttribute = dynamicAttribute(MAX_PLUME_PARTICLES, 3);
  private readonly layerAttribute = dynamicAttribute(MAX_PLUME_PARTICLES, 1);
  private readonly sizeAttribute = dynamicAttribute(MAX_PLUME_PARTICLES, 1);
  private readonly geometry = new BufferGeometry();
  private readonly material = new ShaderMaterial({
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    fragmentShader: `
      uniform float uCooling;
      uniform float uOpacity;
      uniform float uProfile;
      varying float vLayer;
      void main() {
        vec2 point = gl_PointCoord * 2.0 - 1.0;
        float softEdge = 1.0 - smoothstep(0.08, 1.0, length(point));
        vec3 hotCore = mix(vec3(1.0, 0.44, 0.12), vec3(0.42, 0.35, 0.31), uCooling);
        vec3 vapor = mix(vec3(0.92, 0.82, 0.68), vec3(0.48, 0.46, 0.44), uCooling);
        vec3 dust = uProfile < 0.5
          ? vec3(0.54, 0.51, 0.48)
          : (uProfile < 1.5 ? vec3(0.5, 0.34, 0.23) : vec3(0.72, 0.67, 0.58));
        vec3 color = vLayer < 0.5 ? hotCore : (vLayer < 1.5 ? vapor : dust);
        float layerAlpha = vLayer < 0.5 ? 0.78 : (vLayer < 1.5 ? 0.5 : 0.36);
        float alpha = softEdge * uOpacity * layerAlpha;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    toneMapped: false,
    transparent: true,
    uniforms: {
      uBasePointSize: { value: 8 },
      uCooling: { value: 0 },
      uOpacity: { value: 0 },
      uProfile: { value: 1 },
    },
    vertexShader: `
      attribute float aLayer;
      attribute float aSize;
      uniform float uBasePointSize;
      varying float vLayer;
      void main() {
        vLayer = aLayer;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float perspective = clamp(220.0 / max(-viewPosition.z, 1.0), 0.62, 3.2);
        gl_PointSize = uBasePointSize * aSize * perspective;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
  });
  private readonly points = new Points(this.geometry, this.material);
  private readonly surfacePoint = new Vector3();
  private readonly surfaceNormal = new Vector3();
  private maximumCount = MAX_PLUME_PARTICLES;
  private disposed = false;

  public constructor() {
    this.geometry.setAttribute('position', this.positionAttribute);
    this.geometry.setAttribute('aLayer', this.layerAttribute);
    this.geometry.setAttribute('aSize', this.sizeAttribute);
    this.geometry.setDrawRange(0, 0);
    this.points.name = 'impact-layered-volumetric-plume';
    this.points.frustumCulled = false;
    this.points.renderOrder = 9;
    this.root.name = 'impact-volumetric-plume-renderer';
    this.root.add(this.points);
    this.reset();
  }

  public setBudget(maximumCount: number, pointSize: number): void {
    this.maximumCount = Math.min(MAX_PLUME_PARTICLES, Math.max(0, Math.floor(maximumCount)));
    this.material.uniforms.uBasePointSize!.value = pointSize;
  }

  public update(
    state: Readonly<ImpactRenderState>,
    basis: Readonly<ImpactSurfaceBasis>,
    active: boolean,
  ): void {
    const elapsed = state.eventElapsedSeconds;
    this.visible = active
      && elapsed !== null
      && state.plumeOpacity > 0
      && state.plumeHeightM > 0
      && state.plumeRadiusM > 0;
    if (!this.visible) {
      this.hide();
      return;
    }
    if (elapsed === null) {
      this.hide();
      return;
    }
    setEllipsoidSurfacePoint(this.surfacePoint, basis.normal, state);
    setEllipsoidSurfaceNormal(this.surfaceNormal, this.surfacePoint, state);
    const seed = impactHash(state.runSignature) ^ 0x71a5b9;
    const positions = this.positionAttribute.array as Float32Array;
    const layers = this.layerAttribute.array as Float32Array;
    const sizes = this.sizeAttribute.array as Float32Array;
    for (let index = 0; index < this.maximumCount; index += 1) {
      const layer = index % 3;
      const heightRandom = impactRandom01(seed, index * 4);
      const radialRandom = impactRandom01(seed, index * 4 + 1);
      const angle = impactRandom01(seed, index * 4 + 2) * Math.PI * 2;
      const curl = Math.sin(heightRandom * Math.PI * 4 + elapsed * 0.48 + layer) * 0.18;
      const heightScale = layer === 0 ? 0.72 : layer === 1 ? 1 : 0.84;
      const radialScale = layer === 0 ? 0.38 : layer === 1 ? 0.7 : 1;
      const heightM = state.plumeHeightM * Math.pow(heightRandom, 0.74) * heightScale;
      const radialM = state.plumeRadiusM * Math.sqrt(radialRandom) * radialScale;
      const eastM = Math.cos(angle + curl) * radialM;
      const northM = Math.sin(angle + curl) * radialM;
      const offset = index * 3;
      positions[offset] = this.surfacePoint.x
        + basis.east.x * eastM / state.targetRadiusM
        + basis.north.x * northM / state.targetRadiusM
        + this.surfaceNormal.x * heightM / state.targetRadiusM;
      positions[offset + 1] = this.surfacePoint.y
        + basis.east.y * eastM / state.targetRadiusM
        + basis.north.y * northM / state.targetRadiusM
        + this.surfaceNormal.y * heightM / state.targetRadiusM;
      positions[offset + 2] = this.surfacePoint.z
        + basis.east.z * eastM / state.targetRadiusM
        + basis.north.z * northM / state.targetRadiusM
        + this.surfaceNormal.z * heightM / state.targetRadiusM;
      layers[index] = layer;
      sizes[index] = 0.55 + impactRandom01(seed, index * 4 + 3) * (layer === 2 ? 1.4 : 0.9);
    }
    this.positionAttribute.needsUpdate = this.maximumCount > 0;
    this.layerAttribute.needsUpdate = this.maximumCount > 0;
    this.sizeAttribute.needsUpdate = this.maximumCount > 0;
    this.geometry.setDrawRange(0, this.maximumCount);
    this.coolingProgress = clampImpactUnit(state.plumeCoolingProgress);
    this.material.uniforms.uCooling!.value = this.coolingProgress;
    this.material.uniforms.uOpacity!.value = clampImpactUnit(state.plumeOpacity);
    this.material.uniforms.uProfile!.value = state.surfaceEffectProfile === 'solid-airless'
      ? 0
      : state.surfaceEffectProfile === 'giant-atmospheric' ? 2 : 1;
    this.pointCount = this.maximumCount;
    this.layerCount = Math.min(3, this.maximumCount);
    this.points.visible = true;
    this.root.visible = true;
    this.activeObjectCount = 1;
  }

  public reset(): void {
    if (this.disposed) return;
    this.hide();
    this.material.uniforms.uOpacity!.value = 0;
    this.coolingProgress = 0;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.root.clear();
  }

  private hide(): void {
    this.geometry.setDrawRange(0, 0);
    this.points.visible = false;
    this.root.visible = false;
    this.visible = false;
    this.pointCount = 0;
    this.layerCount = 0;
    this.activeObjectCount = 0;
  }
}

function dynamicAttribute(count: number, itemSize: number): BufferAttribute {
  const attribute = new Float32BufferAttribute(new Float32Array(count * itemSize), itemSize);
  attribute.setUsage(DynamicDrawUsage);
  return attribute;
}
