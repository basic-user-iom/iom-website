import { getEarthSurfaceSampler } from '../../simulation/scenarios/impact/EarthSurface';
import { craterDisplacementM } from './ImpactSurfaceDeformation';
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  Mesh,
  ShaderMaterial,
  Vector3,
} from 'three';

import { IMPACT_NOISE_GLSL } from './ImpactNoise';
import type { ImpactRenderState } from './ImpactRenderTypes';
import {
  clampImpactUnit,
  impactHash,
  impactRandom01,
  setEllipsoidSurfaceNormal,
  setEllipsoidSurfacePoint,
  type ImpactSurfaceBasis,
} from './ImpactSurfaceMath';

const MAX_EJECTA_PARTICLES = 256;
/** Curtain filaments along a downrange arc — never a full 360° starburst. */
const MAX_STREAKS = 36;
const ARC_SEGMENTS = 8;
const VERTS_PER_STREAK = 4 * ARC_SEGMENTS;
/** Half-width of the curtain fan around downrange (radians). */
const CURTAIN_HALF_SPAN = 0.72;

/**
 * Downrange ejecta as a curtain wall leaving the crater rim.
 * From chase: an arc/cone wall thicker downrange, gaps between filaments.
 */
export class EjectaRenderer {
  public readonly root = new Group();
  public activeCount = 0;
  public recontactCount = 0;
  public visible = false;
  public activeObjectCount = 0;

  private readonly ballisticCenterAttribute = dynamicAttribute(MAX_EJECTA_PARTICLES, 3);
  private readonly positionAttribute = dynamicAttribute(MAX_STREAKS * VERTS_PER_STREAK, 3);
  private readonly heatAttribute = dynamicAttribute(MAX_STREAKS * VERTS_PER_STREAK, 1);
  private readonly alongAttribute = dynamicAttribute(MAX_STREAKS * VERTS_PER_STREAK, 1);
  private readonly sideAttribute = dynamicAttribute(MAX_STREAKS * VERTS_PER_STREAK, 1);
  private readonly biasAttribute = dynamicAttribute(MAX_STREAKS * VERTS_PER_STREAK, 1);
  private readonly geometry = new BufferGeometry();
  private readonly indexBuffer = new Uint16Array(MAX_STREAKS * ARC_SEGMENTS * 6);
  private readonly material = new ShaderMaterial({
    depthTest: true,
    depthWrite: false,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uCooling;
      varying float vHeat;
      varying float vAlong;
      varying float vSide;
      varying float vBias;
      ${IMPACT_NOISE_GLSL}
      void main() {
        // Hard curtain edge across width; darker/denser near the rim (low along).
        float width = 1.0 - smoothstep(0.02, 0.62, abs(vSide));
        float lengthFade = 1.0 - smoothstep(0.5, 1.05, vAlong);
        float grain = impactFbm(vec3(vAlong * 12.0, vSide * 3.0, vBias * 6.0));
        float gap = smoothstep(0.22, 0.65, grain + vBias * 0.12);
        vec3 rimDark = vec3(0.1, 0.08, 0.055);
        vec3 dust = vec3(0.38, 0.29, 0.19);
        vec3 ember = mix(vec3(0.72, 0.36, 0.1), vec3(0.35, 0.18, 0.07), uCooling);
        vec3 color = mix(rimDark, dust, smoothstep(0.0, 0.4, vAlong));
        color = mix(color, ember, clamp(vHeat * 0.55 * (1.0 - vAlong * 0.5), 0.0, 1.0));
        float alpha = uOpacity * width * lengthFade * gap
          * mix(0.9, 0.35, smoothstep(0.0, 0.35, vAlong))
          * mix(0.55, 1.0, vBias);
        if (alpha < 0.03) discard;
        gl_FragColor = vec4(color, min(alpha, 0.72));
      }
    `,
    side: DoubleSide,
    transparent: true,
    toneMapped: false,
    uniforms: {
      uCooling: { value: 0 },
      uOpacity: { value: 0 },
    },
    vertexShader: `
      attribute float aHeat;
      attribute float aAlong;
      attribute float aSide;
      attribute float aBias;
      varying float vHeat;
      varying float vAlong;
      varying float vSide;
      varying float vBias;
      void main() {
        vHeat = aHeat;
        vAlong = aAlong;
        vSide = aSide;
        vBias = aBias;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  });
  private readonly streaks = new Mesh(this.geometry, this.material);

  private readonly initialVelocitiesMps = new Float32Array(MAX_EJECTA_PARTICLES * 3);
  private readonly particleTypes = new Float32Array(MAX_EJECTA_PARTICLES);
  private readonly particleSizes = new Float32Array(MAX_EJECTA_PARTICLES);
  private readonly particleDensities = new Float32Array(MAX_EJECTA_PARTICLES);
  private readonly particleRay = new Int16Array(MAX_EJECTA_PARTICLES);
  private readonly particleAngles = new Float32Array(MAX_EJECTA_PARTICLES);
  private readonly surfacePoint = new Vector3();
  private readonly surfaceNormal = new Vector3();
  private readonly gravityDirection = new Vector3();
  private readonly particlePositionM = new Vector3();
  private readonly surfacePointM = new Vector3();
  private readonly displacementM = new Vector3();
  private readonly velocityScratch = new Vector3();
  private readonly lateralScratch = new Vector3();
  private readonly tipScratch = new Vector3();
  private readonly rimScratch = new Vector3();
  private configuredSignature = '';
  private rayCount = 24;
  private downrangeAngle = 0;
  private maximumCount = MAX_EJECTA_PARTICLES;
  private disposed = false;

  public constructor() {
    for (let index = 0; index < MAX_STREAKS * ARC_SEGMENTS; index += 1) {
      const offset = index * 6;
      const base = index * 4;
      this.indexBuffer[offset] = base;
      this.indexBuffer[offset + 1] = base + 1;
      this.indexBuffer[offset + 2] = base + 2;
      this.indexBuffer[offset + 3] = base + 1;
      this.indexBuffer[offset + 4] = base + 3;
      this.indexBuffer[offset + 5] = base + 2;
    }
    this.geometry.setAttribute('position', this.positionAttribute);
    this.geometry.setAttribute('aHeat', this.heatAttribute);
    this.geometry.setAttribute('aAlong', this.alongAttribute);
    this.geometry.setAttribute('aSide', this.sideAttribute);
    this.geometry.setAttribute('aBias', this.biasAttribute);
    this.geometry.setAttribute('aBallisticCenter', this.ballisticCenterAttribute);
    this.geometry.setIndex(new BufferAttribute(this.indexBuffer, 1));
    this.geometry.setDrawRange(0, 0);
    this.streaks.name = 'impact-ballistic-ejecta';
    this.streaks.frustumCulled = false;
    this.streaks.renderOrder = 10;
    this.streaks.userData.ballisticSampleCount = 0;
    this.root.name = 'impact-ejecta-renderer';
    this.root.add(this.streaks);
    this.reset();
  }

  public setBudget(maximumCount: number, pointSize: number): void {
    void pointSize; // Mesh billows use world-space radii, not point sprite sizes.
    this.maximumCount = Math.min(MAX_EJECTA_PARTICLES, Math.max(0, Math.floor(maximumCount)));
  }

  public update(
    state: Readonly<ImpactRenderState>,
    basis: Readonly<ImpactSurfaceBasis>,
    active: boolean,
    presentationMultiplier = 1,
  ): void {
    const elapsed = state.eventElapsedSeconds;
    const allowed = state.supportsCrater
      && state.outcomeKind === 'solid-surface-impact'
      && (state.surfaceEffectProfile === 'solid-airless'
        || state.surfaceEffectProfile === 'solid-atmospheric');
    if (
      !active
      || elapsed === null
      || !allowed
      || state.ejectaOpacity <= 0
      || state.ejectaLaunchSpeedMps <= 0
      || state.ejectaLifetimeSeconds <= 0
      || elapsed > state.ejectaLifetimeSeconds
    ) {
      this.hide();
      return;
    }
    // Curtain draw only during ejecta — flash must not share a 360° starburst.
    const drawCurtain = elapsed > 0;
    if (this.configuredSignature !== state.runSignature) {
      this.configurePool(state, basis);
    }

    setEllipsoidSurfacePoint(this.surfacePoint, basis.normal, state);
    setEllipsoidSurfaceNormal(this.surfaceNormal, this.surfacePoint, state);
    this.gravityDirection.copy(this.surfacePoint).normalize();
    const ballistic = this.ballisticCenterAttribute.array as Float32Array;
    const equatorialRatio = state.targetEquatorialRadiusM / state.targetRadiusM;
    const polarRatio = state.targetPolarRadiusM / state.targetRadiusM;
    const surfaceX = this.surfacePoint.x * state.targetRadiusM;
    const surfaceY = this.surfacePoint.y * state.targetRadiusM;
    const surfaceZ = this.surfacePoint.z * state.targetRadiusM;
    this.surfacePointM.set(surfaceX, surfaceY, surfaceZ);

    const positions = this.positionAttribute.array as Float32Array;
    const heats = this.heatAttribute.array as Float32Array;
    const alongs = this.alongAttribute.array as Float32Array;
    const sides = this.sideAttribute.array as Float32Array;
    const biases = this.biasAttribute.array as Float32Array;

    let write = 0;
    let recontact = 0;
    let streakCount = 0;
    const maxStreaks = Math.min(MAX_STREAKS, Math.max(16, Math.floor(this.maximumCount * 0.35)));

    // The visible ribbon tips and the diagnostic samples share this pool.
    for (let index = 0; index < this.maximumCount; index += 1) {
      const velocityOffset = index * 3;
      const time = elapsed * (0.9 + impactRandom01(impactHash(state.runSignature), index + 901) * 0.1);
      const gravityTerm = 0.5 * state.surfaceGravityMps2 * time * time;
      this.particlePositionM.set(
        surfaceX + (this.initialVelocitiesMps[velocityOffset] ?? 0) * time
          - this.gravityDirection.x * gravityTerm,
        surfaceY + (this.initialVelocitiesMps[velocityOffset + 1] ?? 0) * time
          - this.gravityDirection.y * gravityTerm,
        surfaceZ + (this.initialVelocitiesMps[velocityOffset + 2] ?? 0) * time
          - this.gravityDirection.z * gravityTerm,
      );
      const localHeight = this.displacementM.copy(this.particlePositionM)
        .sub(this.surfacePointM)
        .dot(this.surfaceNormal);
      if (state.ejectaHeightM > 0 && localHeight > state.ejectaHeightM * 1.12) {
        this.particlePositionM.addScaledVector(
          this.surfaceNormal,
          state.ejectaHeightM * 1.12 - localHeight,
        );
      }
      const localX = this.particlePositionM.x / state.targetRadiusM;
      const localY = this.particlePositionM.y / state.targetRadiusM;
      const localZ = this.particlePositionM.z / state.targetRadiusM;
      const implicitRadius = Math.sqrt(
        (localX * localX + localZ * localZ) / (equatorialRatio * equatorialRatio)
          + localY * localY / (polarRatio * polarRatio),
      );
      const radialLength=Math.hypot(localX,localY,localZ);
      const terrain=state.earthSurface?getEarthSurfaceSampler()?.(
        Math.asin(localY/radialLength)*180/Math.PI,Math.atan2(-localZ,localX)*180/Math.PI):undefined;
      const distance=state.targetRadiusM*Math.acos(Math.min(1,Math.max(-1,
        (localX*basis.normal.x+localY*basis.normal.y+localZ*basis.normal.z)/radialLength)));
      const height=(terrain?.surfaceAltitudeM ?? 0)+craterDisplacementM(distance,state.craterRadiusM,
        state.craterDepthM,state.craterFormationProgress);
      if (time > 0.08 && implicitRadius <= 1 + (height+0.5)/state.targetRadiusM) {
        recontact += 1;
        continue;
      }
      this.displacementM.copy(this.particlePositionM).sub(this.surfacePointM);
      this.particlePositionM.copy(this.surfacePointM).addScaledVector(
        this.displacementM,
        presentationMultiplier,
      );
      const target = write * 3;
      ballistic[target] = this.particlePositionM.x / state.targetRadiusM;
      ballistic[target + 1] = this.particlePositionM.y / state.targetRadiusM;
      ballistic[target + 2] = this.particlePositionM.z / state.targetRadiusM;
      write += 1;
    }

    // Render the same ballistic samples used by diagnostics. Returning
    // fragments leave the pool, so their visible curtains disappear too.
    if (drawCurtain && write > 0) {
      for (let streak = 0; streak < Math.min(maxStreaks, write); streak += 1) {
        const sample = Math.floor(streak * write / Math.min(maxStreaks, write));
        this.tipScratch.fromArray(ballistic, sample * 3);
        this.displacementM.copy(this.tipScratch).sub(this.surfacePoint);
        const east = this.displacementM.dot(basis.east);
        const north = this.displacementM.dot(basis.north);
        const horizontal = Math.hypot(east, north);
        const rimRadius = Math.min(horizontal * 0.25,
          state.craterRadiusM * presentationMultiplier / state.targetRadiusM * 0.65);
        this.rimScratch.copy(this.surfacePoint);
        if (horizontal > 1e-12) this.rimScratch
          .addScaledVector(basis.east, east / horizontal * rimRadius)
          .addScaledVector(basis.north, north / horizontal * rimRadius);
        const downrangeBias = 0.65;
        this.velocityScratch.copy(this.tipScratch).sub(this.rimScratch);
        if (this.velocityScratch.lengthSq() < 1e-14) continue;
        this.velocityScratch.normalize();
        this.lateralScratch.copy(this.surfaceNormal).cross(this.velocityScratch);
        if (this.lateralScratch.lengthSq() < 1e-12) this.lateralScratch.copy(basis.east);
        this.lateralScratch.normalize();

        const length = this.rimScratch.distanceTo(this.tipScratch);
        // Wide panels so the curtain reads as a wall, not needle rays.
        const halfWidth = length * 0.045;
        const heat = clampImpactUnit(0.3 + downrangeBias * 0.4);
        const base = streakCount * VERTS_PER_STREAK;
        const ox = this.velocityScratch.x * length;
        const oy = this.velocityScratch.y * length;
        const oz = this.velocityScratch.z * length;
        const wx = this.lateralScratch.x * halfWidth;
        const wy = this.lateralScratch.y * halfWidth;
        const wz = this.lateralScratch.z * halfWidth;
        const sx = this.rimScratch.x;
        const sy = this.rimScratch.y;
        const sz = this.rimScratch.z;
        for (let segment = 0; segment < ARC_SEGMENTS; segment += 1) {
          for (let corner = 0; corner < 4; corner += 1) {
            const t = (segment + Math.floor(corner / 2)) / ARC_SEGMENTS;
            const side = corner % 2 === 0 ? -1 : 1;
            const bow = 0.5 * state.surfaceGravityMps2 * elapsed ** 2 *
              presentationMultiplier / state.targetRadiusM * t * (1 - t);
            const width = side * (0.45 + Math.sin(t * Math.PI) * 0.7);
            writeCorner(positions, heats, alongs, sides, biases, base + segment * 4 + corner,
              sx + ox * t + wx * width + this.surfaceNormal.x * bow,
              sy + oy * t + wy * width + this.surfaceNormal.y * bow,
              sz + oz * t + wz * width + this.surfaceNormal.z * bow,
              heat * (1 - t * 0.65), t, side, downrangeBias);
          }
        }
        streakCount += 1;
      }
    }

    this.ballisticCenterAttribute.needsUpdate = write > 0;
    this.positionAttribute.needsUpdate = streakCount > 0;
    this.heatAttribute.needsUpdate = streakCount > 0;
    this.alongAttribute.needsUpdate = streakCount > 0;
    this.sideAttribute.needsUpdate = streakCount > 0;
    this.biasAttribute.needsUpdate = streakCount > 0;
    this.geometry.setDrawRange(0, streakCount * ARC_SEGMENTS * 6);
    if (streakCount > 0) this.geometry.computeBoundingSphere();

    const opacity = Math.min(0.85, clampImpactUnit(state.ejectaOpacity) * 0.95 * Math.min(1, elapsed / 0.8));
    const cooling = clampImpactUnit(elapsed / state.ejectaLifetimeSeconds);
    this.material.uniforms.uOpacity!.value = drawCurtain ? opacity : 0;
    this.material.uniforms.uCooling!.value = cooling;

    this.activeCount = write;
    this.recontactCount = recontact;
    this.visible = drawCurtain && write > 0 && streakCount > 0;
    this.streaks.visible = this.visible;
    this.streaks.userData.ballisticSampleCount = write;
    this.root.visible = this.visible;
    this.activeObjectCount = Number(this.visible);
  }

  public reset(): void {
    if (this.disposed) return;
    this.hide();
    this.material.uniforms.uOpacity!.value = 0;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.root.clear();
  }

  private configurePool(
    state: Readonly<ImpactRenderState>,
    basis: Readonly<ImpactSurfaceBasis>,
  ): void {
    const seed = impactHash(state.runSignature);
    const lifetime = Math.max(state.ejectaLifetimeSeconds, 0.1);
    const horizontalCeiling = Math.max(
      state.ejectaRadiusM / lifetime * 2.2,
      state.ejectaLaunchSpeedMps * 0.12,
    );
    this.rayCount = 12 + Math.floor(impactRandom01(seed, 888) * 6);
    const velocity = state.impactorVelocityLocalEnuMps;
    this.downrangeAngle = velocity !== null
      && Math.hypot(velocity.eastM, velocity.northM) > 1e-6
      ? Math.atan2(velocity.northM, velocity.eastM)
      : impactRandom01(seed, 889) * Math.PI * 2;
    for (let index = 0; index < MAX_EJECTA_PARTICLES; index += 1) {
      const speed = state.ejectaLaunchSpeedMps
        * (0.18 + impactRandom01(seed, index * 7) ** 1.65 * 0.9);
      // Constrain ballistic samples to the same downrange fan as the curtain.
      const fan = (impactRandom01(seed, index * 7 + 1) - 0.5) * 2 * CURTAIN_HALF_SPAN;
      const angle = this.downrangeAngle + fan;
      this.particleAngles[index] = angle;
      this.particleRay[index] = Math.floor((fan / CURTAIN_HALF_SPAN + 1) * 0.5 * this.rayCount);
      const cone = 1.05 + (impactRandom01(seed, index * 7 + 5) - 0.5) * 0.12;
      const horizontalSpeed = Math.min(horizontalCeiling, Math.sin(cone) * speed);
      const verticalSpeed = Math.cos(cone) * speed;
      const eastSpeed = Math.cos(angle) * horizontalSpeed;
      const northSpeed = Math.sin(angle) * horizontalSpeed;
      const offset = index * 3;
      this.initialVelocitiesMps[offset] = basis.east.x * eastSpeed
        + basis.north.x * northSpeed + basis.normal.x * verticalSpeed;
      this.initialVelocitiesMps[offset + 1] = basis.east.y * eastSpeed
        + basis.north.y * northSpeed + basis.normal.y * verticalSpeed;
      this.initialVelocitiesMps[offset + 2] = basis.east.z * eastSpeed
        + basis.north.z * northSpeed + basis.normal.z * verticalSpeed;
      const hotThreshold = 0.28 + state.normalizedHeating * 0.35;
      this.particleTypes[index] = impactRandom01(seed, index * 7 + 6) < hotThreshold ? 1 : 0;
      this.particleSizes[index] = 0.55 + impactRandom01(seed ^ 0x51_7e, index * 3) ** 1.4 * 1.8;
      this.particleDensities[index] = 0.18
        + impactRandom01(seed ^ 0xd3_45, index * 3 + 1) * 0.82;
    }
    this.configuredSignature = state.runSignature;
  }

  private hide(): void {
    this.geometry.setDrawRange(0, 0);
    this.streaks.visible = false;
    this.root.visible = false;
    this.streaks.userData.ballisticSampleCount = 0;
    this.activeCount = 0;
    this.recontactCount = 0;
    this.visible = false;
    this.activeObjectCount = 0;
  }
}

function writeCorner(
  positions: Float32Array,
  heats: Float32Array,
  alongs: Float32Array,
  sides: Float32Array,
  biases: Float32Array,
  vertex: number,
  x: number,
  y: number,
  z: number,
  heat: number,
  along: number,
  side: number,
  bias: number,
): void {
  const offset = vertex * 3;
  positions[offset] = x;
  positions[offset + 1] = y;
  positions[offset + 2] = z;
  heats[vertex] = heat;
  alongs[vertex] = along;
  sides[vertex] = side;
  biases[vertex] = bias;
}

function dynamicAttribute(count: number, itemSize: number): BufferAttribute {
  const attribute = new Float32BufferAttribute(new Float32Array(count * itemSize), itemSize);
  attribute.setUsage(DynamicDrawUsage);
  return attribute;
}
