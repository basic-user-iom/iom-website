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

const MAX_EJECTA_PARTICLES = 256;

export class EjectaRenderer {
  public readonly root = new Group();
  public activeCount = 0;
  public recontactCount = 0;
  public visible = false;
  public activeObjectCount = 0;

  private readonly positionAttribute = dynamicAttribute(MAX_EJECTA_PARTICLES, 3);
  private readonly typeAttribute = dynamicAttribute(MAX_EJECTA_PARTICLES, 1);
  private readonly geometry = new BufferGeometry();
  private readonly material = new ShaderMaterial({
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uCooling;
      varying float vType;
      void main() {
        vec2 point = gl_PointCoord * 2.0 - 1.0;
        float softEdge = 1.0 - smoothstep(0.22, 1.0, length(point));
        vec3 dust = vec3(0.56, 0.42, 0.3);
        vec3 hot = mix(vec3(1.0, 0.18, 0.025), vec3(0.5, 0.26, 0.16), uCooling);
        vec3 color = mix(dust, hot, step(0.55, vType));
        float alpha = softEdge * uOpacity * mix(0.52, 0.92, step(0.55, vType));
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    toneMapped: false,
    transparent: true,
    uniforms: {
      uBasePointSize: { value: 4 },
      uCooling: { value: 0 },
      uOpacity: { value: 0 },
    },
    vertexShader: `
      attribute float aType;
      uniform float uBasePointSize;
      varying float vType;
      void main() {
        vType = aType;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float perspective = clamp(180.0 / max(-viewPosition.z, 1.0), 0.65, 2.8);
        gl_PointSize = uBasePointSize * mix(0.72, 1.35, aType) * perspective;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
  });
  private readonly points = new Points(this.geometry, this.material);
  private readonly initialVelocitiesMps = new Float32Array(MAX_EJECTA_PARTICLES * 3);
  private readonly particleTypes = new Float32Array(MAX_EJECTA_PARTICLES);
  private readonly surfacePoint = new Vector3();
  private readonly surfaceNormal = new Vector3();
  private readonly gravityDirection = new Vector3();
  private readonly particlePositionM = new Vector3();
  private readonly surfacePointM = new Vector3();
  private readonly displacementM = new Vector3();
  private configuredSignature = '';
  private maximumCount = MAX_EJECTA_PARTICLES;
  private disposed = false;

  public constructor() {
    this.geometry.setAttribute('position', this.positionAttribute);
    this.geometry.setAttribute('aType', this.typeAttribute);
    this.geometry.setDrawRange(0, 0);
    this.points.name = 'impact-ballistic-ejecta';
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.root.name = 'impact-ejecta-renderer';
    this.root.add(this.points);
    this.reset();
  }

  public setBudget(maximumCount: number, pointSize: number): void {
    this.maximumCount = Math.min(MAX_EJECTA_PARTICLES, Math.max(0, Math.floor(maximumCount)));
    this.material.uniforms.uBasePointSize!.value = pointSize;
  }

  public update(
    state: Readonly<ImpactRenderState>,
    basis: Readonly<ImpactSurfaceBasis>,
    active: boolean,
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
    if (this.configuredSignature !== state.runSignature) {
      this.configurePool(state, basis);
    }

    setEllipsoidSurfacePoint(this.surfacePoint, basis.normal, state);
    setEllipsoidSurfaceNormal(this.surfaceNormal, this.surfacePoint, state);
    this.gravityDirection.copy(this.surfacePoint).normalize();
    const output = this.positionAttribute.array as Float32Array;
    const outputTypes = this.typeAttribute.array as Float32Array;
    const equatorialRatio = state.targetEquatorialRadiusM / state.targetRadiusM;
    const polarRatio = state.targetPolarRadiusM / state.targetRadiusM;
    const surfaceX = this.surfacePoint.x * state.targetRadiusM;
    const surfaceY = this.surfacePoint.y * state.targetRadiusM;
    const surfaceZ = this.surfacePoint.z * state.targetRadiusM;
    this.surfacePointM.set(surfaceX, surfaceY, surfaceZ);
    let write = 0;
    let recontact = 0;
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
      if (time > 0.08 && implicitRadius <= 1.000002) {
        recontact += 1;
        continue;
      }
      const target = write * 3;
      output[target] = localX;
      output[target + 1] = localY;
      output[target + 2] = localZ;
      outputTypes[write] = this.particleTypes[index] ?? 0;
      write += 1;
    }
    this.positionAttribute.needsUpdate = write > 0;
    this.typeAttribute.needsUpdate = write > 0;
    this.geometry.setDrawRange(0, write);
    this.material.uniforms.uOpacity!.value = clampImpactUnit(state.ejectaOpacity);
    this.material.uniforms.uCooling!.value = clampImpactUnit(
      elapsed / state.ejectaLifetimeSeconds,
    );
    this.activeCount = write;
    this.recontactCount = recontact;
    this.visible = write > 0;
    this.points.visible = this.visible;
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
    const wideCone = state.surfaceEffectProfile === 'solid-airless';
    for (let index = 0; index < MAX_EJECTA_PARTICLES; index += 1) {
      const speed = state.ejectaLaunchSpeedMps
        * (0.28 + impactRandom01(seed, index * 5) * 0.72);
      const angle = impactRandom01(seed, index * 5 + 1) * Math.PI * 2;
      const cone = (wideCone ? 0.34 : 0.22)
        + impactRandom01(seed, index * 5 + 2) * (wideCone ? 0.72 : 0.55);
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
      const hotThreshold = 0.18 + state.normalizedHeating * 0.38;
      this.particleTypes[index] = impactRandom01(seed, index * 5 + 3) < hotThreshold ? 1 : 0;
    }
    this.configuredSignature = state.runSignature;
  }

  private hide(): void {
    this.geometry.setDrawRange(0, 0);
    this.points.visible = false;
    this.root.visible = false;
    this.activeCount = 0;
    this.recontactCount = 0;
    this.visible = false;
    this.activeObjectCount = 0;
  }
}

function dynamicAttribute(count: number, itemSize: number): BufferAttribute {
  const attribute = new Float32BufferAttribute(new Float32Array(count * itemSize), itemSize);
  attribute.setUsage(DynamicDrawUsage);
  return attribute;
}
