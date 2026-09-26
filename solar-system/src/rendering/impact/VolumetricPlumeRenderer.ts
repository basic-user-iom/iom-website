import {
  BufferAttribute, BufferGeometry, DynamicDrawUsage, Float32BufferAttribute,
  Group, Matrix4, Mesh, ShaderMaterial, Vector3,
} from 'three';
import type { ImpactRenderState } from './ImpactRenderTypes';
import { impactDepthUniforms, IMPACT_DEPTH_GLSL } from './ImpactDepthContext';
import { IMPACT_NOISE_GLSL } from './ImpactNoise';
import {
  clampImpactUnit, impactHash, impactRandom01, mapImpactEnuToBodyLocal, setEllipsoidSurfaceNormal,
  setEllipsoidSurfacePoint, type ImpactSurfaceBasis,
} from './ImpactSurfaceMath';

import { airburstWakeLengthM, sampleAirburstWake } from './AirburstPlumeShape';

const MAX_PUFFS = 192;

/** Pooled camera-facing dust volumes with centers in body-local 3D space.
 * Turbulence uses scenario time so pause and replay remain deterministic.
 */
export class VolumetricPlumeRenderer {
  public readonly root = new Group();
  public visible = false;
  public pointCount = 0;
  public layerCount = 0;
  public coolingProgress = 0;
  public activeObjectCount = 0;
  private readonly positions = dynamicAttribute(MAX_PUFFS * 4, 3);
  private readonly corners = dynamicAttribute(MAX_PUFFS * 4, 2);
  private readonly radii = dynamicAttribute(MAX_PUFFS * 4, 1);
  private readonly heights = dynamicAttribute(MAX_PUFFS * 4, 1);
  private readonly seeds = dynamicAttribute(MAX_PUFFS * 4, 1);
  private readonly densities = dynamicAttribute(MAX_PUFFS * 4, 1);
  private readonly wakeOffset = new Vector3();
  private readonly sampleCenters = dynamicAttribute(MAX_PUFFS, 3);
  private readonly geometry = new BufferGeometry();
  private readonly material = new ShaderMaterial({
    depthTest: true,
    depthWrite: false,
    transparent: true,
    toneMapped: false,
    uniforms: {
      ...impactDepthUniforms,
      uTargetRadiusM: { value: 6371008.4 }, uAtmosphere: { value: 1 }, uVolumeSteps: { value: 8 },
      uOpacity: { value: 0 }, uCooling: { value: 0 },
      uTime: { value: 0 }, uProfile: { value: 1 }, uAirburst: { value: 0 },
    },
    vertexShader: `
      uniform float uTargetRadiusM;
      uniform vec3 uImpactSunWorld;
      varying float vWorldRadius, vWorldScale, vSunlight, vAltitudeM;
      varying vec3 vViewPosition;
      attribute vec2 aCorner;
      attribute float aRadius;
      attribute float aHeight;
      attribute float aSeed;
      attribute float aDensity;
      varying float vDensity;
      varying vec2 vCorner;
      varying float vHeight;
      varying float vSeed;
      void main() {
        vCorner = aCorner;
        vHeight = aHeight;
        vSeed = aSeed;
        vDensity = aDensity;
        vec4 center = modelViewMatrix * vec4(position, 1.0);
        float scale = length(modelViewMatrix[0].xyz);
        vWorldScale=scale;
        vWorldRadius=aRadius*scale;
        vAltitudeM=max(0.0,(length(position)-1.0)*uTargetRadiusM);
        vSunlight=smoothstep(-0.08,0.12,dot(normalize(mat3(modelMatrix)*position),uImpactSunWorld));
        center.xy += aCorner * aRadius * scale;
        vViewPosition=center.xyz;
        gl_Position = projectionMatrix * center;
      }
    `,
    fragmentShader: `
      ${IMPACT_DEPTH_GLSL}
      uniform float uTargetRadiusM,uAtmosphere,uVolumeSteps;
      varying float vWorldRadius,vWorldScale,vSunlight,vAltitudeM;
      varying vec3 vViewPosition;
      uniform float uOpacity;
      uniform float uCooling;
      uniform float uTime;
      uniform float uProfile;
      uniform float uAirburst;
      varying float vDensity;
      varying vec2 vCorner;
      varying float vHeight;
      varying float vSeed;
      ${IMPACT_NOISE_GLSL}
      void main() {
        float r2 = dot(vCorner, vCorner);
        if (r2 >= 1.0) discard;
        float depth = sqrt(1.0 - r2);
        vec3 p = vec3(vCorner, depth);
        vec3 flow = vec3(vSeed, -uTime * 0.09, vSeed * 0.37);
        float density = impactFbm(p * 3.4 + flow);
        float detail = impactNoise(p * 9.0 + flow);
        float edge = 1.0 - smoothstep(0.52 + density * 0.3, 1.0, sqrt(r2));
        float mass = smoothstep(0.22, 0.72, density) * (0.78 + detail * 0.22);
        float columnMass=0.0;
        for(int i=0;i<12;i++){
          if(float(i)>=uVolumeSteps)break;
          float z=mix(-depth,depth,(float(i)+0.5)/uVolumeSteps);
          columnMass+=smoothstep(0.25,0.7,impactNoise(vec3(vCorner,z)*4.2+flow));
        }
        columnMass/=uVolumeSteps;
        float alpha = (1.0 - exp(-columnMass * depth * 3.4)) * edge * uOpacity * vDensity;
        if(uImpactDepthEnabled>0.5){
          float frontDepth=-vViewPosition.z-depth*vWorldRadius;
          alpha*=clamp((impactSceneDepth()-frontDepth)/max(vWorldRadius*0.65,1e-18),0.0,1.0);
        }
        if (alpha < 0.008) discard;
        float light = clamp(dot(normalize(p + vec3(0.0, density * 0.3, 0.0)),
          normalize(uImpactSunView)), 0.0, 1.0) * vSunlight;
        vec3 shadow = uProfile > 1.5 ? vec3(0.28, 0.38, 0.43) : vec3(0.075, 0.06, 0.05);
        vec3 dust = uProfile < 0.5 ? vec3(0.44, 0.4, 0.34) : vec3(0.52, 0.44, 0.34);
        if (uProfile > 1.5) dust = vec3(0.91, 0.96, 1.0);
        if (uAirburst > 0.5) {
          dust = vec3(0.72, 0.76, 0.8);
          shadow = vec3(0.18, 0.22, 0.27);
        }
        vec3 color = mix(shadow, dust, light * (0.55 + density * 0.45));
        float heat = (uProfile > 1.5 ? 0.18 : 1.0) * (1.0 - uCooling) * (1.0 - smoothstep(0.02, 0.62, vHeight));
        color = mix(color, vec3(1.65, 0.48, 0.075), heat * (0.4 + mass * 0.6));
        float distanceM=length(vViewPosition)/max(vWorldScale,1e-18)*uTargetRadiusM;
        vec3 beta=vec3(5.8e-6,13.5e-6,33.1e-6)*exp(-vAltitudeM/8000.0)
          +vec3(4e-6)*exp(-vAltitudeM/1200.0);
        vec3 transmission=exp(-beta*distanceM*uAtmosphere);
        vec3 sky=vec3(0.15,0.28,0.46)*(0.08+vSunlight*0.92);
        color=color*transmission+sky*(1.0-transmission);
        gl_FragColor = vec4(color, min(alpha, 0.78));
      }
    `,
  });
  private readonly column = new Mesh(this.geometry, this.material);
  private readonly surfacePoint = new Vector3();
  private readonly eventPoint = new Vector3();
  private readonly surfaceNormal = new Vector3();
  private readonly viewTransform = new Matrix4();
  private readonly sortedPuffs: number[] = [];
  private readonly depths = new Float32Array(MAX_PUFFS);
  private maximumCount = MAX_PUFFS;
  private disposed = false;

  public constructor() {
    const indices = new Uint16Array(MAX_PUFFS * 6);
    for (let i = 0; i < MAX_PUFFS; i += 1) {
      const v = i * 4;
      indices.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], i * 6);
      this.corners.setXY(v, -1, -1);
      this.corners.setXY(v + 1, 1, -1);
      this.corners.setXY(v + 2, -1, 1);
      this.corners.setXY(v + 3, 1, 1);
    }
    this.geometry.setAttribute('position', this.positions);
    this.geometry.setAttribute('aCorner', this.corners);
    this.geometry.setAttribute('aRadius', this.radii);
    this.geometry.setAttribute('aHeight', this.heights);
    this.geometry.setAttribute('aSeed', this.seeds);
    this.geometry.setAttribute('aDensity', this.densities);
    this.geometry.setAttribute('aBallisticCenter', this.sampleCenters);
    this.geometry.setIndex(new BufferAttribute(indices, 1));
    this.column.name = 'impact-layered-volumetric-plume';
    this.column.frustumCulled = false;
    this.column.renderOrder = 9;
    // Transparent volumes are sorted per camera, without changing simulation
    // samples or allocating new geometry when the observer changes direction.
    this.column.onBeforeRender = (_renderer, _scene, camera) => {
      this.viewTransform.multiplyMatrices(camera.matrixWorldInverse, this.column.matrixWorld);
      const e = this.viewTransform.elements;
      this.sortedPuffs.length = this.pointCount;
      for (let i = 0; i < this.pointCount; i += 1) {
        this.sortedPuffs[i] = i;
        this.depths[i] = e[2]! * this.sampleCenters.getX(i)
          + e[6]! * this.sampleCenters.getY(i) + e[10]! * this.sampleCenters.getZ(i) + e[14]!;
      }
      this.sortedPuffs.sort((a, b) => this.depths[a]! - this.depths[b]!);
      const index = this.geometry.getIndex()!;
      for (let i = 0; i < this.pointCount; i += 1) {
        const v = this.sortedPuffs[i]! * 4;
        index.setX(i * 6, v);
        index.setX(i * 6 + 1, v + 1);
        index.setX(i * 6 + 2, v + 2);
        index.setX(i * 6 + 3, v + 2);
        index.setX(i * 6 + 4, v + 1);
        index.setX(i * 6 + 5, v + 3);
      }
      index.needsUpdate = true;
    };
    this.root.name = 'impact-volumetric-plume-renderer';
    this.root.add(this.column);
    this.reset();
  }

  public setBudget(maximumCount: number, pointSize: number): void {
    void pointSize; // Mesh billows use world-space radii, not point sprite sizes.
    this.maximumCount = Math.min(MAX_PUFFS, Math.max(0, Math.floor(maximumCount)));
    this.material.uniforms.uVolumeSteps!.value = maximumCount >= 192 ? 12 : maximumCount >= 128 ? 8 : 4;
  }

  public update(
    state: Readonly<ImpactRenderState>,
    basis: Readonly<ImpactSurfaceBasis>,
    active: boolean,
    presentationMultiplier = 1,
  ): void {
    this.material.uniforms.uTargetRadiusM!.value=state.targetRadiusM;
    this.material.uniforms.uAtmosphere!.value=state.entryEffectProfile === 'none' ? 0 : 1;
    const elapsed = state.eventElapsedSeconds;
    if (!active || elapsed === null || state.plumeOpacity <= 0
      || state.plumeHeightM <= 0 || state.plumeRadiusM <= 0 || this.maximumCount === 0) {
      this.hide();
      return;
    }
    setEllipsoidSurfacePoint(this.surfacePoint, basis.normal, state);
    setEllipsoidSurfaceNormal(this.surfaceNormal, this.surfacePoint, state);
    this.eventPoint.copy(this.surfacePoint);
    if (state.outcomeKind !== 'solid-surface-impact' && state.outcomeKind !== 'ocean-surface-impact' && state.impactorLocalEnuM !== null) {
      const p = state.impactorLocalEnuM;
      mapImpactEnuToBodyLocal(this.eventPoint, p.eastM, p.northM, p.upM,
        state, basis, this.surfacePoint, this.surfaceNormal);
    }
    const seed = impactHash(state.runSignature);
    const emergence = 1 - Math.exp(-elapsed * 0.65);
    const height = state.plumeHeightM * presentationMultiplier / state.targetRadiusM;
    const radius = Math.max(state.plumeRadiusM, state.plumeHeightM * 0.13, Math.max(state.flashRadiusM * 0.5, state.craterRadiusM * 0.45) * emergence) * presentationMultiplier / state.targetRadiusM;
    const velocity = state.impactorVelocityLocalEnuMps;
    const horizontal = Math.hypot(velocity?.eastM ?? 0, velocity?.northM ?? 0) || 1;
    const shearEast = (velocity?.eastM ?? 0) / horizontal;
    const shearNorth = (velocity?.northM ?? 0) / horizontal;
    const airless = state.surfaceEffectProfile === 'solid-airless';
    const airburst = state.outcomeKind === 'airburst' || state.outcomeKind === 'deep-atmosphere-breakup';
    const wakeLengthM = airburst ? airburstWakeLengthM(state) : 0;

    for (let i = 0; i < this.maximumCount; i += 1) {
      const t = (i + 0.5) / this.maximumCount;
      const angle = impactRandom01(seed, i * 7 + 1) * Math.PI * 2;
      const spread = Math.sqrt(impactRandom01(seed, i * 7 + 2));
      const crown = Math.sin(Math.min(1, t / 0.82) * Math.PI * 0.5);
      const width = radius * (0.09 + crown * crown * 0.75);
      const shear = height * t * 0.12;
      let east = Math.cos(angle) * spread * width + shearEast * shear;
      let north = Math.sin(angle) * spread * width + shearNorth * shear;
      let h = height * (airless ? Math.pow(t, 0.7) : Math.pow(t, 0.82));
      let puffRadius = radius * (0.2 + t * 0.35)
        * (0.75 + impactRandom01(seed, i * 7 + 3) * 0.5);
      let density = 1;
      if (airburst) {
        // A detached, rolling head and a thinning wake following the entry
        // samples. No ground-fed stem is invented for an atmospheric event.
        if (t < 0.55 && wakeLengthM > 0) {
          const along = t / 0.55;
          sampleAirburstWake(this.wakeOffset, state, wakeLengthM * along);
          const scale = presentationMultiplier / state.targetRadiusM;
          const roll = Math.sin(along * 11 + elapsed * 0.08) * radius * 0.15 * emergence;
          east = this.wakeOffset.x * scale + Math.cos(angle) * radius * 0.12 + shearNorth * roll;
          north = this.wakeOffset.y * scale + Math.sin(angle) * radius * 0.12 - shearEast * roll;
          h = this.wakeOffset.z * scale + height * (0.18 + along * 0.12);
          puffRadius = radius * (0.4 - along * 0.08);
          density = (0.6 - along * 0.35) * Math.exp(-elapsed / 70);
        } else {
          const head = (t - 0.55) / 0.45;
          const roll = Math.sin(head * Math.PI) * radius * 0.6;
          east = Math.cos(angle) * spread * radius * 0.55 + shearNorth * roll;
          north = Math.sin(angle) * spread * radius * 0.55 - shearEast * roll;
          h = height * (0.35 + Math.max(0, head) * 0.55);
          puffRadius = radius * (0.24 + impactRandom01(seed, i * 7 + 3) * 0.19);
          density = 0.65;
        }
      }
      const x = this.eventPoint.x + basis.east.x * east + basis.north.x * north + this.surfaceNormal.x * h;
      const y = this.eventPoint.y + basis.east.y * east + basis.north.y * north + this.surfaceNormal.y * h;
      const z = this.eventPoint.z + basis.east.z * east + basis.north.z * north + this.surfaceNormal.z * h;
      this.sampleCenters.setXYZ(i, x, y, z);
      for (let corner = 0; corner < 4; corner += 1) {
        const v = i * 4 + corner;
        this.positions.setXYZ(v, x, y, z);
        this.radii.setX(v, puffRadius);
        this.heights.setX(v, t);
        this.densities.setX(v, density);
        this.seeds.setX(v, impactRandom01(seed, i * 7 + 4) * 97);
      }
    }
    for (const attribute of [this.positions, this.radii, this.heights, this.seeds, this.densities, this.sampleCenters]) {
      attribute.needsUpdate = true;
    }
    this.coolingProgress = clampImpactUnit(state.plumeCoolingProgress);
    this.material.uniforms.uCooling!.value = this.coolingProgress;
    this.material.uniforms.uTime!.value = elapsed;
    this.material.uniforms.uAirburst!.value = airburst ? 1 : 0;
    this.material.uniforms.uProfile!.value = state.outcomeKind === 'ocean-surface-impact' ? 2 : airless ? 0 : 1;
    this.material.uniforms.uOpacity!.value = clampImpactUnit(state.plumeOpacity)
      * emergence * (airless ? 0.36 : 0.7);
    this.geometry.setDrawRange(0, this.maximumCount * 6);
    this.column.userData.ballisticSampleCount = this.maximumCount;
    this.pointCount = this.maximumCount;
    this.layerCount = 1;
    this.column.visible = true;
    this.root.visible = true;
    this.visible = true;
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
    this.column.visible = false;
    this.root.visible = false;
    this.visible = false;
    this.pointCount = 0;
    this.layerCount = 0;
    this.activeObjectCount = 0;
    this.column.userData.ballisticSampleCount = 0;
  }
}
function dynamicAttribute(count: number, itemSize: number): BufferAttribute {
  const attribute = new Float32BufferAttribute(new Float32Array(count * itemSize), itemSize);
  attribute.setUsage(DynamicDrawUsage);
  return attribute;
}
