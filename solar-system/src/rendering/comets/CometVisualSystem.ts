import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  FrontSide,
  Group,
  IcosahedronGeometry,
  Line,
  Mesh,
  MeshStandardMaterial,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type BufferAttribute,
} from 'three';

import type { DebugBodyRenderState, DebugRenderFrame } from '../RenderContext';
import type { VisualQuality } from '../bodies/VisualQuality';
import type { CometActivityProfile, CometTailSample } from './CometTailDynamics';

export interface CometVisualProfile {
  readonly bodyId: string;
  readonly nucleusColor: string;
  readonly dustColor: string;
  readonly ionColor: string;
  readonly nucleusElongation: readonly [number, number, number];
  readonly activity: Readonly<CometActivityProfile>;
}

export interface CometFrameState {
  readonly bodyId: string;
  readonly tail: Readonly<CometTailSample>;
  readonly trustedEphemeris: boolean;
  readonly approximationWarning: string | null;
}

export interface CometVisualDiagnostics {
  readonly bodyId: string | null;
  readonly activity: number;
  readonly ionDirection: Readonly<Vector3>;
  readonly ionPointCount: number;
  readonly dustPointCount: number;
  readonly dustHistorySpanDays: number;
  readonly dustCurvatureM: number;
  readonly trustedEphemeris: boolean;
  readonly approximationWarning: string | null;
  readonly comaRendering: 'soft radial density';
  readonly tailRendering: 'continuous faded ribbons with soft particles';
}

export interface CometVisual {
  readonly bodyId: string;
  readonly root: Group;
  readonly nucleus: Mesh<IcosahedronGeometry, MeshStandardMaterial>;
  readonly coma: Mesh<SphereGeometry, ShaderMaterial>;
  readonly innerComa: Mesh<SphereGeometry, ShaderMaterial>;
  readonly ionCore: Line<BufferGeometry, ShaderMaterial>;
  readonly dustSpine: Line<BufferGeometry, ShaderMaterial>;
  readonly ionTail: Points<BufferGeometry, ShaderMaterial>;
  readonly dustTail: Points<BufferGeometry, ShaderMaterial>;
  readonly profile: Readonly<CometVisualProfile>;
  readonly ionPositionAttribute: BufferAttribute;
  readonly ionPhaseAttribute: BufferAttribute;
  readonly dustPositionAttribute: BufferAttribute;
  readonly dustPhaseAttribute: BufferAttribute;
  readonly dustSpinePositionAttribute: BufferAttribute;
  readonly dustSpinePhaseAttribute: BufferAttribute;
  focusRadiusRenderUnits: number;
  activity: number;
  ionPointCount: number;
  dustPointCount: number;
  dustSpinePointCount: number;
  dustHistorySpanDays: number;
  dustCurvatureM: number;
  trustedEphemeris: boolean;
  approximationWarning: string | null;
}

const MAX_ION_POINTS = 160;
const MAX_DUST_POINTS = 288;
const DUST_GRAINS_PER_AGE_BIN = 4;
const MAX_DUST_SPINE_POINTS = MAX_DUST_POINTS / DUST_GRAINS_PER_AGE_BIN;
const SCENE_NORTH = new Vector3(0, 1, 0);
const MAPPED_ION_DIRECTION = new Vector3();

/** Procedural nucleus/coma/tail renderer. No downloaded comet imagery is used. */
export class CometVisualSystem {
  private readonly profiles = new Map<string, Readonly<CometVisualProfile>>();
  private readonly visuals = new Map<string, CometVisual>();
  private readonly sphereGeometry = new SphereGeometry(1, 24, 16);
  private quality: VisualQuality;
  private disposed = false;

  public constructor(
    profiles: readonly Readonly<CometVisualProfile>[],
    initialQuality: VisualQuality = 'high',
  ) {
    for (const profile of profiles) {
      if (this.profiles.has(profile.bodyId)) {
        throw new Error(`Duplicate comet visual profile "${profile.bodyId}".`);
      }
      this.profiles.set(profile.bodyId, profile);
    }
    this.quality = initialQuality;
  }

  public create(body: DebugBodyRenderState): CometVisual {
    this.assertNotDisposed();
    if (body.kind !== 'comet') {
      throw new TypeError(`Comet visual system cannot render body kind "${body.kind}".`);
    }
    const existing = this.visuals.get(body.bodyId);
    if (existing !== undefined) return existing;
    const profile = this.profiles.get(body.bodyId);
    if (profile === undefined) {
      throw new Error(`Missing comet visual profile for "${body.bodyId}".`);
    }

    const root = new Group();
    root.name = `comet-${body.bodyId}`;
    const nucleusGeometry = createIrregularNucleusGeometry(profile.activity.deterministicSeed);
    const nucleusMaterial = new MeshStandardMaterial({
      color: new Color(profile.nucleusColor),
      emissive: new Color(profile.nucleusColor).multiplyScalar(0.035),
      emissiveIntensity: 0.7,
      flatShading: true,
      metalness: 0,
      roughness: 0.98,
    });
    nucleusMaterial.name = 'rough-irregular-comet-nucleus';
    const nucleus = new Mesh(nucleusGeometry, nucleusMaterial);
    nucleus.name = `comet-nucleus-${body.bodyId}`;
    nucleus.castShadow = false;
    nucleus.receiveShadow = false;
    root.add(nucleus);

    const comaMaterial = createComaMaterial(0xcce8d6, 2.6, 0.30, profile.activity.deterministicSeed);
    const coma = new Mesh(this.sphereGeometry, comaMaterial);
    coma.name = `comet-coma-${body.bodyId}`;
    coma.renderOrder = 4;
    root.add(coma);

    const innerComaMaterial = createComaMaterial(
      0xf2f5dc,
      2.05,
      0.15,
      profile.activity.deterministicSeed ^ 0x5f_37_59,
    );
    const innerComa = new Mesh(this.sphereGeometry, innerComaMaterial);
    innerComa.name = `comet-inner-coma-${body.bodyId}`;
    innerComa.renderOrder = 5;
    root.add(innerComa);

    const ionGeometry = createTailGeometry(
      MAX_ION_POINTS,
      profile.activity.deterministicSeed ^ 0x49_4f_4e,
    );
    const ionMaterial = createTailParticleMaterial(
      profile.ionColor,
      'ion',
      pointSizeForQuality(this.quality, 'ion'),
    );
    const ionTail = new Points(ionGeometry.geometry, ionMaterial);
    ionTail.name = `comet-ion-tail-${body.bodyId}`;
    ionTail.frustumCulled = false;
    ionTail.renderOrder = 2;
    root.add(ionTail);

    const ionCore = new Line(
      ionGeometry.geometry,
      createTailRibbonMaterial(profile.ionColor, 'ion'),
    );
    ionCore.name = `comet-ion-core-${body.bodyId}`;
    ionCore.frustumCulled = false;
    ionCore.renderOrder = 3;
    root.add(ionCore);

    const dustGeometry = createTailGeometry(
      MAX_DUST_POINTS,
      profile.activity.deterministicSeed ^ 0x44_55_53_54,
    );
    const dustMaterial = createTailParticleMaterial(
      profile.dustColor,
      'dust',
      pointSizeForQuality(this.quality, 'dust'),
    );
    const dustTail = new Points(dustGeometry.geometry, dustMaterial);
    dustTail.name = `comet-dust-tail-${body.bodyId}`;
    dustTail.frustumCulled = false;
    dustTail.renderOrder = 3;
    root.add(dustTail);

    const dustSpineGeometry = createTailGeometry(
      MAX_DUST_SPINE_POINTS,
      profile.activity.deterministicSeed ^ 0x53_50_49_4e,
    );
    const dustSpine = new Line(
      dustSpineGeometry.geometry,
      createTailRibbonMaterial(profile.dustColor, 'dust'),
    );
    dustSpine.name = `comet-dust-spine-${body.bodyId}`;
    dustSpine.frustumCulled = false;
    dustSpine.renderOrder = 2;
    root.add(dustSpine);

    const visual: CometVisual = {
      bodyId: body.bodyId,
      root,
      nucleus,
      coma,
      innerComa,
      ionCore,
      dustSpine,
      ionTail,
      dustTail,
      profile,
      ionPositionAttribute: ionGeometry.attribute,
      ionPhaseAttribute: ionGeometry.phaseAttribute,
      dustPositionAttribute: dustGeometry.attribute,
      dustPhaseAttribute: dustGeometry.phaseAttribute,
      dustSpinePositionAttribute: dustSpineGeometry.attribute,
      dustSpinePhaseAttribute: dustSpineGeometry.phaseAttribute,
      focusRadiusRenderUnits: 0,
      activity: 0,
      ionPointCount: 0,
      dustPointCount: 0,
      dustSpinePointCount: 0,
      dustHistorySpanDays: 0,
      dustCurvatureM: 0,
      trustedEphemeris: false,
      approximationWarning: 'Comet ephemeris has not loaded.',
    };
    this.visuals.set(body.bodyId, visual);
    return visual;
  }

  public updateFrame(
    frame: DebugRenderFrame,
    cometStates: readonly Readonly<CometFrameState>[],
    metersPerRenderUnit: number,
    radiusForBody: (body: DebugBodyRenderState) => number,
  ): void {
    this.assertNotDisposed();
    if (!Number.isFinite(metersPerRenderUnit) || metersPerRenderUnit <= 0) {
      throw new RangeError('Comet render scale must be finite and positive.');
    }
    const states = new Map(cometStates.map((state) => [state.bodyId, state]));
    for (const [bodyId, visual] of this.visuals) {
      const body = frame.bodies.find((candidate) => candidate.bodyId === bodyId);
      const state = states.get(bodyId);
      if (body === undefined || state === undefined) {
        visual.root.visible = false;
        continue;
      }
      visual.root.visible = body.visible;
      const nucleusRadius = radiusForBody(body);
      const elongation = visual.profile.nucleusElongation;
      visual.nucleus.scale.set(
        nucleusRadius * elongation[0],
        nucleusRadius * elongation[1],
        nucleusRadius * elongation[2],
      );
      const days = frame.currentJdTdb - 2_451_545;
      visual.nucleus.quaternion
        .setFromAxisAngle(SCENE_NORTH, days * 0.43 + visual.profile.activity.deterministicSeed)
        .normalize();

      const physicalComaRadius =
        visual.profile.activity.comaRadiusKm * 1_000 / metersPerRenderUnit;
      const presentationComaFloor =
        nucleusRadius * (1.06 + state.tail.activity * 0.16);
      const comaRadius = Math.max(
        presentationComaFloor,
        physicalComaRadius * Math.max(0.08, state.tail.activity ** 0.55),
      );
      visual.coma.scale.setScalar(comaRadius);
      visual.innerComa.scale.setScalar(Math.max(nucleusRadius * 1.015, comaRadius * 0.31));
      const comaVisible = state.tail.activity > 0.006;
      visual.coma.visible = comaVisible;
      visual.innerComa.visible = comaVisible;
      setMaterialUniform(visual.coma.material, 'uOpacity', 0.003 + state.tail.activity * 0.027);
      setMaterialUniform(
        visual.innerComa.material,
        'uOpacity',
        0.007 + state.tail.activity * 0.052,
      );
      MAPPED_ION_DIRECTION.set(
        state.tail.ionDirection.x,
        state.tail.ionDirection.z,
        -state.tail.ionDirection.y,
      ).normalize();
      setDirectionUniform(visual.coma.material, MAPPED_ION_DIRECTION);
      setDirectionUniform(visual.innerComa.material, MAPPED_ION_DIRECTION);
      visual.focusRadiusRenderUnits = Math.max(
        nucleusRadius * 2.5,
        comaVisible ? comaRadius * 1.08 : 0,
      );
      visual.activity = state.tail.activity;
      visual.trustedEphemeris = state.trustedEphemeris;
      visual.approximationWarning = state.approximationWarning;
      visual.dustHistorySpanDays = state.tail.dustHistorySpanDays;
      visual.dustCurvatureM = state.tail.dustCurvatureM;

      visual.ionPointCount = writeMappedTail(
        visual.ionPositionAttribute,
        visual.ionPhaseAttribute,
        state.tail.ionPositionsM,
        metersPerRenderUnit,
      );
      visual.dustPointCount = writeMappedTail(
        visual.dustPositionAttribute,
        visual.dustPhaseAttribute,
        state.tail.dustPositionsM,
        metersPerRenderUnit,
        DUST_GRAINS_PER_AGE_BIN,
      );
      visual.dustSpinePointCount = writeMappedDustSpine(
        visual.dustSpinePositionAttribute,
        visual.dustSpinePhaseAttribute,
        state.tail.dustPositionsM,
        metersPerRenderUnit,
      );
      visual.ionTail.geometry.setDrawRange(0, visual.ionPointCount);
      visual.dustTail.geometry.setDrawRange(0, visual.dustPointCount);
      visual.dustSpine.geometry.setDrawRange(0, visual.dustSpinePointCount);
      visual.ionTail.visible = state.tail.activity > 0.012;
      visual.dustTail.visible = state.tail.activity > 0.018;
      visual.ionCore.visible = visual.ionTail.visible;
      visual.dustSpine.visible = visual.dustTail.visible;
      setMaterialUniform(
        visual.ionTail.material,
        'uOpacity',
        0.08 + state.tail.activity * 0.3,
      );
      setMaterialUniform(
        visual.dustTail.material,
        'uOpacity',
        0.055 + state.tail.activity * 0.25,
      );
      setMaterialUniform(
        visual.ionCore.material,
        'uOpacity',
        0.035 + state.tail.activity * 0.13,
      );
      setMaterialUniform(
        visual.dustSpine.material,
        'uOpacity',
        0.018 + state.tail.activity * 0.052,
      );
    }
  }

  public setQuality(quality: VisualQuality): void {
    this.assertNotDisposed();
    this.quality = quality;
    for (const visual of this.visuals.values()) {
      setMaterialUniform(
        visual.ionTail.material,
        'uPointSize',
        pointSizeForQuality(quality, 'ion'),
      );
      setMaterialUniform(
        visual.dustTail.material,
        'uPointSize',
        pointSizeForQuality(quality, 'dust'),
      );
    }
  }

  public getDiagnostics(bodyId: string): Readonly<CometVisualDiagnostics> {
    const visual = this.visuals.get(bodyId);
    if (visual === undefined) return EMPTY_DIAGNOSTICS;
    const positions = visual.ionPositionAttribute.array as Float32Array;
    const last = Math.max(0, visual.ionPointCount - 1) * 3;
    const direction = new Vector3(
      positions[last] ?? 0,
      positions[last + 1] ?? 0,
      positions[last + 2] ?? 0,
    ).normalize();
    return Object.freeze({
      bodyId,
      activity: visual.activity,
      ionDirection: Object.freeze(direction),
      ionPointCount: visual.ionPointCount,
      dustPointCount: visual.dustPointCount,
      dustHistorySpanDays: visual.dustHistorySpanDays,
      dustCurvatureM: visual.dustCurvatureM,
      trustedEphemeris: visual.trustedEphemeris,
      approximationWarning: visual.approximationWarning,
      comaRendering: 'soft radial density',
      tailRendering: 'continuous faded ribbons with soft particles',
    });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const visual of this.visuals.values()) {
      visual.nucleus.geometry.dispose();
      visual.nucleus.material.dispose();
      visual.coma.material.dispose();
      visual.innerComa.material.dispose();
      visual.ionCore.material.dispose();
      visual.dustSpine.material.dispose();
      visual.ionTail.geometry.dispose();
      visual.ionTail.material.dispose();
      visual.dustTail.geometry.dispose();
      visual.dustTail.material.dispose();
      visual.dustSpine.geometry.dispose();
    }
    this.sphereGeometry.dispose();
    this.visuals.clear();
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error('Comet visual system is disposed.');
  }
}

function createIrregularNucleusGeometry(seed: number): IcosahedronGeometry {
  const geometry = new IcosahedronGeometry(1, 3);
  const positions = geometry.getAttribute('position');
  const random = createRandom(seed);
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const ridge =
      Math.sin(x * 8.7 + seed * 0.0001) *
      Math.cos(y * 11.1 - z * 7.3) *
      0.075;
    const displacement = 0.79 + random() * 0.27 + ridge;
    positions.setXYZ(index, x * displacement, y * displacement, z * displacement);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.name = `deterministic-irregular-comet-${seed}`;
  return geometry;
}

function createTailGeometry(maxPointCount: number, seed: number): {
  readonly geometry: BufferGeometry;
  readonly attribute: BufferAttribute;
  readonly phaseAttribute: BufferAttribute;
} {
  const attribute = new Float32BufferAttribute(new Float32Array(maxPointCount * 3), 3);
  attribute.setUsage(35048); // DynamicDrawUsage, kept numeric for a lean import surface.
  const phaseAttribute = new Float32BufferAttribute(new Float32Array(maxPointCount), 1);
  phaseAttribute.setUsage(35048);
  const brightness = new Float32Array(maxPointCount);
  const random = createRandom(seed);
  for (let index = 0; index < maxPointCount; index += 1) {
    brightness[index] = 0.68 + random() * 0.32;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', attribute);
  geometry.setAttribute('aTailPhase', phaseAttribute);
  geometry.setAttribute('aBrightness', new Float32BufferAttribute(brightness, 1));
  geometry.setDrawRange(0, 0);
  return { geometry, attribute, phaseAttribute };
}

function writeMappedTail(
  attribute: BufferAttribute,
  phaseAttribute: BufferAttribute,
  physicalPositionsM: Float64Array,
  metersPerRenderUnit: number,
  phaseGroupSize = 1,
): number {
  const output = attribute.array as Float32Array;
  const phases = phaseAttribute.array as Float32Array;
  if (
    physicalPositionsM.length % 3 !== 0 ||
    output.length % 3 !== 0 ||
    phases.length !== output.length / 3
  ) {
    throw new RangeError('Comet tail position buffers must contain packed xyz triples.');
  }
  if (!Number.isInteger(phaseGroupSize) || phaseGroupSize <= 0) {
    throw new RangeError('Comet tail phase groups must contain a positive integer number of points.');
  }
  const pointCount = Math.min(output.length, physicalPositionsM.length) / 3;
  const phaseCount = Math.ceil(pointCount / phaseGroupSize);
  for (let index = 0; index < pointCount; index += 1) {
    const offset = index * 3;
    const x = physicalPositionsM[offset];
    const y = physicalPositionsM[offset + 1];
    const z = physicalPositionsM[offset + 2];
    if (x === undefined || y === undefined || z === undefined) {
      throw new RangeError(`Comet tail point ${index} is outside the physical position buffer.`);
    }
    // Horizons ECLIPTIC +Z becomes scene +Y, matching camera-relative bodies.
    output[offset] = x / metersPerRenderUnit;
    output[offset + 1] = z / metersPerRenderUnit;
    output[offset + 2] = -y / metersPerRenderUnit;
    phases[index] = phaseCount <= 1
      ? 0
      : Math.floor(index / phaseGroupSize) / (phaseCount - 1);
  }
  attribute.needsUpdate = true;
  phaseAttribute.needsUpdate = true;
  return pointCount;
}

function writeMappedDustSpine(
  attribute: BufferAttribute,
  phaseAttribute: BufferAttribute,
  physicalPositionsM: Float64Array,
  metersPerRenderUnit: number,
): number {
  const output = attribute.array as Float32Array;
  const phases = phaseAttribute.array as Float32Array;
  if (
    physicalPositionsM.length % (DUST_GRAINS_PER_AGE_BIN * 3) !== 0 ||
    output.length % 3 !== 0 ||
    phases.length !== output.length / 3
  ) {
    throw new RangeError('Comet dust-spine buffers must contain complete age-bin groups.');
  }
  const physicalBinCount = physicalPositionsM.length / (DUST_GRAINS_PER_AGE_BIN * 3);
  const binCount = Math.min(output.length / 3, physicalBinCount);
  for (let binIndex = 0; binIndex < binCount; binIndex += 1) {
    let x = 0;
    let y = 0;
    let z = 0;
    for (let grain = 0; grain < DUST_GRAINS_PER_AGE_BIN; grain += 1) {
      const sourceOffset = (binIndex * DUST_GRAINS_PER_AGE_BIN + grain) * 3;
      x += physicalPositionsM[sourceOffset] ?? 0;
      y += physicalPositionsM[sourceOffset + 1] ?? 0;
      z += physicalPositionsM[sourceOffset + 2] ?? 0;
    }
    const outputOffset = binIndex * 3;
    output[outputOffset] = x / DUST_GRAINS_PER_AGE_BIN / metersPerRenderUnit;
    output[outputOffset + 1] = z / DUST_GRAINS_PER_AGE_BIN / metersPerRenderUnit;
    output[outputOffset + 2] = -y / DUST_GRAINS_PER_AGE_BIN / metersPerRenderUnit;
    phases[binIndex] = binCount <= 1 ? 0 : binIndex / (binCount - 1);
  }
  attribute.needsUpdate = true;
  phaseAttribute.needsUpdate = true;
  return binCount;
}

function pointSizeForQuality(quality: VisualQuality, kind: 'ion' | 'dust'): number {
  const base = quality === 'low' ? 2.4 : quality === 'medium' ? 2.25 : quality === 'high' ? 2.1 : 2;
  return kind === 'ion' ? base : base * 1.65;
}

function createComaMaterial(
  color: number,
  radialExponent: number,
  asymmetry: number,
  seed: number,
): ShaderMaterial {
  return new ShaderMaterial({
    name: 'soft-optically-thin-comet-coma',
    side: FrontSide,
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    toneMapped: false,
    uniforms: {
      uColor: { value: new Color(color) },
      uOpacity: { value: 0 },
      uRadialExponent: { value: radialExponent },
      uAsymmetry: { value: asymmetry },
      uSeed: { value: (seed >>> 0) / 0xffff_ffff },
      uTailDirection: { value: new Vector3(1, 0, 0) },
    },
    vertexShader: `
      varying vec3 vObjectNormal;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vObjectNormal = normalize(normal);
        vViewNormal = normalize(normalMatrix * normal);
        vViewPosition = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uTailDirection;
      uniform float uOpacity;
      uniform float uRadialExponent;
      uniform float uAsymmetry;
      uniform float uSeed;
      varying vec3 vObjectNormal;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      void main() {
        vec3 viewDirection = normalize(-vViewPosition);
        float facing = clamp(dot(normalize(vViewNormal), viewDirection), 0.0, 1.0);
        float radialDensity = pow(facing, uRadialExponent);
        float sunward = dot(normalize(vObjectNormal), -normalize(uTailDirection));
        float directionalDensity = 1.0 + sunward * uAsymmetry;
        float wisp = 0.91 + 0.09 * sin(
          dot(vObjectNormal, vec3(8.7, 11.3, 6.1)) + uSeed * 31.4159
        );
        float alpha = uOpacity * radialDensity * directionalDensity * wisp;
        if (alpha < 0.0005) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
}

function createTailParticleMaterial(
  color: string,
  kind: 'ion' | 'dust',
  pointSize: number,
): ShaderMaterial {
  const dust = kind === 'dust';
  return new ShaderMaterial({
    name: `soft-tapered-comet-${kind}-particles`,
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    toneMapped: false,
    uniforms: {
      uColor: { value: new Color(color) },
      uOpacity: { value: 0 },
      uPointSize: { value: pointSize },
      uTailKind: { value: dust ? 1 : 0 },
    },
    vertexShader: `
      attribute float aTailPhase;
      attribute float aBrightness;
      uniform float uPointSize;
      uniform float uTailKind;
      varying float vTailPhase;
      varying float vBrightness;
      void main() {
        vTailPhase = aTailPhase;
        vBrightness = aBrightness;
        float taper = mix(1.16, 0.62, aTailPhase);
        float dustSpread = mix(1.0, 1.18, uTailKind);
        gl_PointSize = max(1.0, uPointSize * taper * dustSpread);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTailKind;
      varying float vTailPhase;
      varying float vBrightness;
      void main() {
        vec2 centered = gl_PointCoord * 2.0 - 1.0;
        float radius2 = dot(centered, centered);
        if (radius2 > 1.0) discard;
        float softness = exp(-radius2 * mix(4.8, 3.2, uTailKind));
        float longitudinalFade = mix(0.055, 1.0, pow(1.0 - vTailPhase, 1.25));
        float alpha = uOpacity * softness * longitudinalFade * vBrightness;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
}

function createTailRibbonMaterial(color: string, kind: 'ion' | 'dust'): ShaderMaterial {
  return new ShaderMaterial({
    name: `continuous-tapered-comet-${kind}-ribbon`,
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    toneMapped: false,
    uniforms: {
      uColor: { value: new Color(color) },
      uOpacity: { value: 0 },
      uDust: { value: kind === 'dust' ? 1 : 0 },
    },
    vertexShader: `
      attribute float aTailPhase;
      varying float vTailPhase;
      void main() {
        vTailPhase = aTailPhase;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uDust;
      varying float vTailPhase;
      void main() {
        float fade = mix(0.025, 1.0, pow(1.0 - vTailPhase, mix(1.4, 0.95, uDust)));
        gl_FragColor = vec4(uColor, uOpacity * fade);
      }
    `,
  });
}

function setMaterialUniform(material: ShaderMaterial, name: string, value: number): void {
  const uniform = material.uniforms[name];
  if (uniform === undefined) throw new Error(`Comet material is missing uniform "${name}".`);
  uniform.value = value;
}

function setDirectionUniform(material: ShaderMaterial, direction: Readonly<Vector3>): void {
  const uniform = material.uniforms.uTailDirection;
  if (uniform === undefined || !(uniform.value instanceof Vector3)) {
    throw new Error('Comet coma material is missing its tail-direction uniform.');
  }
  uniform.value.copy(direction);
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const EMPTY_DIAGNOSTICS: Readonly<CometVisualDiagnostics> = Object.freeze({
  bodyId: null,
  activity: 0,
  ionDirection: Object.freeze(new Vector3()),
  ionPointCount: 0,
  dustPointCount: 0,
  dustHistorySpanDays: 0,
  dustCurvatureM: 0,
  trustedEphemeris: false,
  approximationWarning: null,
  comaRendering: 'soft radial density',
  tailRendering: 'continuous faded ribbons with soft particles',
});
