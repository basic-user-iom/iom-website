import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  FrontSide,
  Group,
  IcosahedronGeometry,
  Line,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
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
  readonly tailRendering: 'diffuse ion and dust particle tails';
}

export interface CometVisual {
  readonly bodyId: string;
  readonly root: Group;
  readonly nucleus: Mesh<IcosahedronGeometry, MeshBasicMaterial>;
  readonly coma: Mesh<SphereGeometry, ShaderMaterial>;
  readonly innerComa: Mesh<SphereGeometry, ShaderMaterial>;
  readonly ionCore: Line<BufferGeometry, ShaderMaterial>;
  readonly dustSpine: Line<BufferGeometry, ShaderMaterial>;
  readonly ionRibbon: Mesh<BufferGeometry, ShaderMaterial>;
  readonly ionRibbonCross: Mesh<BufferGeometry, ShaderMaterial>;
  readonly dustRibbon: Mesh<BufferGeometry, ShaderMaterial>;
  readonly ionTail: Points<BufferGeometry, ShaderMaterial>;
  readonly dustTail: Points<BufferGeometry, ShaderMaterial>;
  readonly profile: Readonly<CometVisualProfile>;
  readonly ionPositionAttribute: BufferAttribute;
  readonly ionPhaseAttribute: BufferAttribute;
  readonly ionSpinePositionAttribute: BufferAttribute;
  readonly ionSpinePhaseAttribute: BufferAttribute;
  readonly dustPositionAttribute: BufferAttribute;
  readonly dustPhaseAttribute: BufferAttribute;
  readonly dustSpinePositionAttribute: BufferAttribute;
  readonly dustSpinePhaseAttribute: BufferAttribute;
  readonly ionRibbonPositionAttribute: BufferAttribute;
  readonly ionRibbonSideAttribute: BufferAttribute;
  readonly ionRibbonPhaseAttribute: BufferAttribute;
  readonly ionRibbonCrossPositionAttribute: BufferAttribute;
  readonly ionRibbonCrossSideAttribute: BufferAttribute;
  readonly ionRibbonCrossPhaseAttribute: BufferAttribute;
  readonly dustRibbonPositionAttribute: BufferAttribute;
  readonly dustRibbonSideAttribute: BufferAttribute;
  readonly dustRibbonPhaseAttribute: BufferAttribute;
  focusRadiusRenderUnits: number;
  activity: number;
  ionPointCount: number;
  ionSpinePointCount: number;
  dustPointCount: number;
  dustSpinePointCount: number;
  dustHistorySpanDays: number;
  dustCurvatureM: number;
  trustedEphemeris: boolean;
  approximationWarning: string | null;
}

const MAX_ION_SPINE_POINTS = 160;
const ION_STREAMER_COUNT = 5;
const MAX_ION_POINTS = MAX_ION_SPINE_POINTS * ION_STREAMER_COUNT;
const MAX_DUST_POINTS = 288 * 12;
const DUST_GRAINS_PER_AGE_BIN = 4;
const MAX_DUST_SPINE_POINTS = 288 / DUST_GRAINS_PER_AGE_BIN;
const SCENE_NORTH = new Vector3(0, 1, 0);
const MAPPED_ION_DIRECTION = new Vector3();
const VIEW_LOCAL = new Vector3();

/** Procedural nucleus/coma/tail renderer. No downloaded comet imagery is used. */
export class CometVisualSystem {
  private readonly profiles = new Map<string, Readonly<CometVisualProfile>>();
  private readonly visuals = new Map<string, CometVisual>();
  private readonly sphereGeometry = new SphereGeometry(1, 24, 16);
  private readonly viewWorldPosition = new Vector3(0, 8, 12);
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
    const nucleusMaterial = new MeshBasicMaterial({
      color: new Color(profile.nucleusColor),
    });
    nucleusMaterial.name = 'rough-irregular-comet-nucleus';
    const nucleus = new Mesh(nucleusGeometry, nucleusMaterial);
    nucleus.name = `comet-nucleus-${body.bodyId}`;
    nucleus.castShadow = false;
    nucleus.receiveShadow = false;
    nucleus.renderOrder = 6;
    root.add(nucleus);

    const comaMaterial = createComaMaterial(0x6a736c, 3.4, 0.18, profile.activity.deterministicSeed);
    const coma = new Mesh(this.sphereGeometry, comaMaterial);
    coma.name = `comet-coma-${body.bodyId}`;
    coma.renderOrder = 3;
    root.add(coma);

    const innerComaMaterial = createComaMaterial(
      0x7a756c,
      3.0,
      0.08,
      profile.activity.deterministicSeed ^ 0x5f_37_59,
    );
    const innerComa = new Mesh(this.sphereGeometry, innerComaMaterial);
    innerComa.name = `comet-inner-coma-${body.bodyId}`;
    innerComa.renderOrder = 4;
    root.add(innerComa);

    const ionParticleGeometry = createTailGeometry(
      MAX_ION_POINTS,
      profile.activity.deterministicSeed ^ 0x49_4f_4e,
    );
    const ionMaterial = createTailParticleMaterial(
      profile.ionColor,
      'ion',
      pointSizeForQuality(this.quality, 'ion'),
    );
    const ionTail = new Points(ionParticleGeometry.geometry, ionMaterial);
    ionTail.name = `comet-ion-tail-${body.bodyId}`;
    ionTail.frustumCulled = false;
    ionTail.renderOrder = 7;
    root.add(ionTail);

    const ionSpineGeometry = createTailGeometry(
      MAX_ION_SPINE_POINTS,
      profile.activity.deterministicSeed ^ 0x49_4f_4e_53,
    );
    const ionCore = new Line(
      ionSpineGeometry.geometry,
      createTailRibbonMaterial(profile.ionColor, 'ion'),
    );
    ionCore.name = `comet-ion-core-${body.bodyId}`;
    ionCore.frustumCulled = false;
    ionCore.renderOrder = 3;
    root.add(ionCore);

    const ionRibbonResources = createSoftRibbonGeometry(MAX_ION_SPINE_POINTS);
    const ionRibbon = new Mesh(
      ionRibbonResources.geometry,
      createSoftRibbonMaterial(profile.ionColor, 'ion'),
    );
    ionRibbon.name = `comet-ion-ribbon-${body.bodyId}`;
    ionRibbon.frustumCulled = false;
    ionRibbon.renderOrder = 2;
    const captureView = (
      _renderer: unknown,
      _scene: unknown,
      camera: { readonly matrixWorld: { readonly elements: ArrayLike<number> } },
    ): void => {
      this.viewWorldPosition.setFromMatrixPosition(camera.matrixWorld as never);
    };
    ionRibbon.onBeforeRender = captureView as typeof ionRibbon.onBeforeRender;
    root.add(ionRibbon);

    const ionRibbonCrossResources = createSoftRibbonGeometry(MAX_ION_SPINE_POINTS);
    const ionRibbonCross = new Mesh(
      ionRibbonCrossResources.geometry,
      createSoftRibbonMaterial(profile.ionColor, 'ion'),
    );
    ionRibbonCross.name = `comet-ion-ribbon-cross-${body.bodyId}`;
    ionRibbonCross.frustumCulled = false;
    ionRibbonCross.renderOrder = 2;
    root.add(ionRibbonCross);

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
    dustTail.renderOrder = 8;
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

    const dustRibbonResources = createSoftRibbonGeometry(MAX_DUST_SPINE_POINTS);
    const dustRibbon = new Mesh(
      dustRibbonResources.geometry,
      createSoftRibbonMaterial(profile.dustColor, 'dust'),
    );
    dustRibbon.name = `comet-dust-ribbon-${body.bodyId}`;
    dustRibbon.frustumCulled = false;
    dustRibbon.renderOrder = 1;
    dustRibbon.onBeforeRender = captureView as typeof dustRibbon.onBeforeRender;
    root.add(dustRibbon);

    const visual: CometVisual = {
      bodyId: body.bodyId,
      root,
      nucleus,
      coma,
      innerComa,
      ionCore,
      dustSpine,
      ionRibbon,
      ionRibbonCross,
      dustRibbon,
      ionTail,
      dustTail,
      profile,
      ionPositionAttribute: ionParticleGeometry.attribute,
      ionPhaseAttribute: ionParticleGeometry.phaseAttribute,
      ionSpinePositionAttribute: ionSpineGeometry.attribute,
      ionSpinePhaseAttribute: ionSpineGeometry.phaseAttribute,
      dustPositionAttribute: dustGeometry.attribute,
      dustPhaseAttribute: dustGeometry.phaseAttribute,
      dustSpinePositionAttribute: dustSpineGeometry.attribute,
      dustSpinePhaseAttribute: dustSpineGeometry.phaseAttribute,
      ionRibbonPositionAttribute: ionRibbonResources.positionAttribute,
      ionRibbonSideAttribute: ionRibbonResources.sideAttribute,
      ionRibbonPhaseAttribute: ionRibbonResources.phaseAttribute,
      ionRibbonCrossPositionAttribute: ionRibbonCrossResources.positionAttribute,
      ionRibbonCrossSideAttribute: ionRibbonCrossResources.sideAttribute,
      ionRibbonCrossPhaseAttribute: ionRibbonCrossResources.phaseAttribute,
      dustRibbonPositionAttribute: dustRibbonResources.positionAttribute,
      dustRibbonSideAttribute: dustRibbonResources.sideAttribute,
      dustRibbonPhaseAttribute: dustRibbonResources.phaseAttribute,
      focusRadiusRenderUnits: 0,
      activity: 0,
      ionPointCount: 0,
      ionSpinePointCount: 0,
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
      const presentationComaFloor = nucleusRadius * 1.55;
      // Soft halo only — never a solid white sphere that hides nucleus/tails.
      const uncappedComa = Math.max(
        presentationComaFloor,
        physicalComaRadius * Math.max(0.02, state.tail.activity ** 0.65),
      );
      const comaRadius = Math.min(uncappedComa, nucleusRadius * 5.5);
      const nucleusExtent =
        nucleusRadius *
        Math.max(elongation[0], elongation[1], elongation[2]);
      visual.coma.scale.setScalar(comaRadius);
      visual.innerComa.scale.setScalar(Math.max(nucleusExtent * 1.12, comaRadius * 0.58));
    // Soft limb haze from a faint non-additive shell (particles carry the streak mass).
      const comaVisible = state.tail.activity > 0.006;
      visual.coma.visible = comaVisible;
      visual.innerComa.visible = false;
      setMaterialUniform(visual.coma.material, 'uOpacity', 0.04 + state.tail.activity * 0.05);
      setMaterialUniform(visual.innerComa.material, 'uOpacity', 0);
      MAPPED_ION_DIRECTION.set(
        state.tail.ionDirection.x,
        state.tail.ionDirection.z,
        -state.tail.ionDirection.y,
      ).normalize();
      setDirectionUniform(visual.coma.material, MAPPED_ION_DIRECTION);
      setDirectionUniform(visual.innerComa.material, MAPPED_ION_DIRECTION);
      visual.activity = state.tail.activity;
      visual.trustedEphemeris = state.trustedEphemeris;
      visual.approximationWarning = state.approximationWarning;
      visual.dustHistorySpanDays = state.tail.dustHistorySpanDays;
      visual.dustCurvatureM = state.tail.dustCurvatureM;

      visual.ionSpinePointCount = writeMappedTail(
        visual.ionSpinePositionAttribute,
        visual.ionSpinePhaseAttribute,
        state.tail.ionPositionsM,
        metersPerRenderUnit,
      );
      visual.ionPointCount = writeMappedIonStreamers(
        visual.ionPositionAttribute,
        visual.ionPhaseAttribute,
        state.tail.ionPositionsM,
        metersPerRenderUnit,
        visual.profile.activity.deterministicSeed,
      );
      visual.dustPointCount = writeMappedDustCloud(
        visual.dustPositionAttribute,
        visual.dustPhaseAttribute,
        state.tail.dustPositionsM,
        metersPerRenderUnit,
        visual.profile.activity.deterministicSeed,
      );
      visual.dustSpinePointCount = writeMappedDustSpine(
        visual.dustSpinePositionAttribute,
        visual.dustSpinePhaseAttribute,
        state.tail.dustPositionsM,
        metersPerRenderUnit,
      );
      // Apply one presentation scale to both physical tails. Independently
      // normalizing each tail inflated a few hours of dust into giant tendrils.
      const physicalIonLength = maximumTailLength(visual.ionSpinePositionAttribute,
        visual.ionSpinePointCount);
      const physicalDustLength = maximumTailLength(visual.dustPositionAttribute,
        visual.dustPointCount);
      const extent = Math.max(physicalIonLength, physicalDustLength, 1e-12);
      const displayExtent = nucleusRadius * (160 + state.tail.activity * 80);
      const tailScale = displayExtent / extent;
      for (const [attribute, count] of [
        [visual.ionPositionAttribute, visual.ionPointCount],
        [visual.ionSpinePositionAttribute, visual.ionSpinePointCount],
        [visual.dustPositionAttribute, visual.dustPointCount],
        [visual.dustSpinePositionAttribute, visual.dustSpinePointCount],
      ] as const) scaleMappedTail(attribute, count, tailScale);
      visual.focusRadiusRenderUnits = Math.max(
        displayExtent * 0.32,
        comaVisible ? comaRadius * 2 : nucleusRadius * 8,
      );
      visual.ionTail.geometry.setDrawRange(0, visual.ionPointCount);
      visual.ionCore.geometry.setDrawRange(0, visual.ionSpinePointCount);
      visual.dustTail.geometry.setDrawRange(0, visual.dustPointCount);
      visual.dustSpine.geometry.setDrawRange(0, visual.dustSpinePointCount);
      visual.ionTail.geometry.computeBoundingSphere();
      visual.dustTail.geometry.computeBoundingSphere();
      // Wide soft envelope (needs screen pixels for falloff); bright core stays peaked in the shader.
      const ionHalfWidth =
        Math.max(nucleusRadius * 0.38, 0.00075) * (0.7 + state.tail.activity * 0.4);
      const dustHalfWidth =
        Math.max(nucleusRadius * 0.85, 0.0022) * (0.7 + state.tail.activity * 0.5);
      VIEW_LOCAL.copy(this.viewWorldPosition);
      visual.root.updateWorldMatrix(true, false);
      visual.root.worldToLocal(VIEW_LOCAL);
      writeSoftRibbon(
        visual.ionRibbon,
        visual.ionRibbonPositionAttribute,
        visual.ionRibbonSideAttribute,
        visual.ionRibbonPhaseAttribute,
        visual.ionSpinePositionAttribute,
        visual.ionSpinePointCount,
        ionHalfWidth,
        0.06,
        'view-aligned',
        VIEW_LOCAL,
      );
      writeSoftRibbon(
        visual.ionRibbonCross,
        visual.ionRibbonCrossPositionAttribute,
        visual.ionRibbonCrossSideAttribute,
        visual.ionRibbonCrossPhaseAttribute,
        visual.ionSpinePositionAttribute,
        visual.ionSpinePointCount,
        ionHalfWidth * 0.4,
        0.05,
        'view-aligned',
        VIEW_LOCAL,
      );
      writeSoftRibbon(
        visual.dustRibbon,
        visual.dustRibbonPositionAttribute,
        visual.dustRibbonSideAttribute,
        visual.dustRibbonPhaseAttribute,
        visual.dustSpinePositionAttribute,
        visual.dustSpinePointCount,
        dustHalfWidth,
        0.22,
        'in-plane',
        VIEW_LOCAL,
      );
      visual.ionTail.visible = state.tail.activity > 0.012;
      visual.dustTail.visible = state.tail.activity > 0.018;
      visual.ionCore.visible = false;
      visual.dustSpine.visible = false;
      // Ion + dust mass is particle streamers. Ribbon meshes still silhouette as
      // hard wedges in enough camera angles that they fail the visual acceptance test.
      visual.ionRibbon.visible = false;
      visual.ionRibbon.geometry.setDrawRange(0, 0);
      visual.ionRibbonCross.visible = false;
      visual.ionRibbonCross.geometry.setDrawRange(0, 0);
      visual.dustRibbon.visible = false;
      visual.dustRibbon.geometry.setDrawRange(0, 0);
      setMaterialUniform(
        visual.ionTail.material,
        'uOpacity',
        0.08 + state.tail.activity * 0.12,
      );
      setMaterialUniform(
        visual.dustTail.material,
        'uOpacity',
        0.02 + state.tail.activity * 0.025,
      );
      setMaterialUniform(visual.ionCore.material, 'uOpacity', 0);
      setMaterialUniform(visual.dustSpine.material, 'uOpacity', 0);
      setMaterialUniform(visual.ionRibbon.material, 'uOpacity', 0);
      setMaterialUniform(visual.ionRibbonCross.material, 'uOpacity', 0);
      setMaterialUniform(visual.dustRibbon.material, 'uOpacity', 0);
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
    const positions = visual.ionSpinePositionAttribute.array as Float32Array;
    const last = Math.max(0, visual.ionSpinePointCount - 1) * 3;
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
      tailRendering: 'diffuse ion and dust particle tails',
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
      visual.ionCore.geometry.dispose();
      visual.ionCore.material.dispose();
      visual.dustSpine.material.dispose();
      visual.ionRibbon.geometry.dispose();
      visual.ionRibbon.material.dispose();
      visual.ionRibbonCross.geometry.dispose();
      visual.ionRibbonCross.material.dispose();
      visual.dustRibbon.geometry.dispose();
      visual.dustRibbon.material.dispose();
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
  // One smooth dark body — mild potato, never a jagged shard cluster.
  const geometry = new IcosahedronGeometry(1, 1);
  const positions = geometry.getAttribute('position');
  const random = createRandom(seed);
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const ridge =
      Math.sin(x * 3.1 + seed * 0.0001) *
      Math.cos(y * 2.7 - z * 2.2) *
      0.012;
    const displacement = 0.97 + random() * 0.035 + ridge;
    positions.setXYZ(index, x * displacement, y * displacement, z * displacement);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.name = `deterministic-irregular-comet-${seed}`;
  return geometry;
}

function maximumTailLength(attribute: BufferAttribute, count: number): number {
  let maximum = 0;
  for (let index = 0; index < count; index += 1) {
    maximum = Math.max(maximum,
      Math.hypot(attribute.getX(index), attribute.getY(index), attribute.getZ(index)));
  }
  return maximum;
}

function scaleMappedTail(attribute: BufferAttribute, count: number, scale: number): void {
  for (let index = 0; index < count; index += 1) {
    attribute.setXYZ(index, attribute.getX(index) * scale,
      attribute.getY(index) * scale, attribute.getZ(index) * scale);
  }
  attribute.needsUpdate = true;
}

/** Fill between beta samples and adjacent emission times, not four separate strands. */
function writeMappedDustCloud(
  attribute: BufferAttribute,
  phaseAttribute: BufferAttribute,
  positionsM: Float64Array,
  metersPerRenderUnit: number,
  seed: number,
): number {
  const bins = positionsM.length / (DUST_GRAINS_PER_AGE_BIN * 3);
  if (!Number.isInteger(bins) || bins < 2) return 0;
  const count = Math.min(attribute.count, (bins - 1) * 48);
  const random = createRandom(seed ^ 0x44_55_53);
  for (let index = 0; index < count; index += 1) {
    const age = (index + random()) / count * (bins - 1);
    const bin = Math.min(bins - 2, Math.floor(age));
    const ageMix = age - bin;
    const grain = random() * (DUST_GRAINS_PER_AGE_BIN - 1);
    const left = Math.floor(grain);
    const grainMix = grain - left;
    const point: number[] = [];
    for (let axis = 0; axis < 3; axis += 1) {
      const sample = (row: number, column: number): number =>
        positionsM[(row * DUST_GRAINS_PER_AGE_BIN + column) * 3 + axis] ?? 0;
      const before = sample(bin, left) * (1 - grainMix) + sample(bin, left + 1) * grainMix;
      const after = sample(bin + 1, left) * (1 - grainMix) + sample(bin + 1, left + 1) * grainMix;
      point.push((before * (1 - ageMix) + after * ageMix) / metersPerRenderUnit);
    }
    attribute.setXYZ(index, point[0]!, point[2]!, -point[1]!);
    phaseAttribute.setX(index, age / (bins - 1));
  }
  attribute.needsUpdate = true;
  phaseAttribute.needsUpdate = true;
  return count;
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
    brightness[index] = 0.82 + random() * 0.18;
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

function writeMappedIonStreamers(
  attribute: BufferAttribute,
  phaseAttribute: BufferAttribute,
  spinePositionsM: Float64Array,
  metersPerRenderUnit: number,
  seed: number,
): number {
  const output = attribute.array as Float32Array;
  const phases = phaseAttribute.array as Float32Array;
  if (spinePositionsM.length % 3 !== 0 || output.length % 3 !== 0) {
    throw new RangeError('Comet ion streamer buffers must contain packed xyz triples.');
  }
  const spineCount = spinePositionsM.length / 3;
  if (spineCount < 1) return 0;
  const maxPoints = output.length / 3;
  // Upsample each spine segment so close body-follow views keep a continuous filament.
  const samplesPerSegment = spineCount >= 2 ? 2 : 1;
  const sampleCount = 1 + Math.max(0, spineCount - 1) * samplesPerSegment;
  const streamerCount = Math.min(
    ION_STREAMER_COUNT,
    Math.max(1, Math.floor(maxPoints / sampleCount)),
  );
  const random = createRandom(seed ^ 0x53_54_52);
  let written = 0;

  const writeSample = (
    x: number,
    y: number,
    z: number,
    fraction: number,
  ): void => {
    const spineLength = Math.hypot(x, y, z);
    const dirX = spineLength > 0 ? x / spineLength : 1;
    const dirY = spineLength > 0 ? y / spineLength : 0;
    const dirZ = spineLength > 0 ? z / spineLength : 0;
    const useZAxis = Math.abs(dirZ) < 0.8;
    const refY = useZAxis ? 0 : 1;
    const refZ = useZAxis ? 1 : 0;
    let tx = dirY * refZ - dirZ * refY;
    let ty = dirZ * 0 - dirX * refZ;
    let tz = dirX * refY - dirY * 0;
    const tLen = Math.hypot(tx, ty, tz) || 1;
    tx /= tLen;
    ty /= tLen;
    tz /= tLen;
    const bx = dirY * tz - dirZ * ty;
    const by = dirZ * tx - dirX * tz;
    const bz = dirX * ty - dirY * tx;
    // Narrow filament envelope — readable as a blue streak, not a sheet.
    const halfWidth = spineLength * (0.0015 + fraction * 0.002);
    for (let streamer = 0; streamer < streamerCount; streamer += 1) {
      if (written >= maxPoints) return;
      const lane = random() - 0.5;
      const wobble = Math.sin(fraction * Math.PI * 3.1 + streamer * 1.7 + seed * 1e-4) * 0.28;
      const lateral = halfWidth * (lane * 2.4 + wobble * (0.16 + random() * 0.1));
      const outOffset = written * 3;
      const px = x + tx * lateral + bx * lateral * 0.18;
      const py = y + ty * lateral + by * lateral * 0.18;
      const pz = z + tz * lateral + bz * lateral * 0.18;
      output[outOffset] = px / metersPerRenderUnit;
      output[outOffset + 1] = pz / metersPerRenderUnit;
      output[outOffset + 2] = -py / metersPerRenderUnit;
      phases[written] = fraction;
      written += 1;
    }
  };

  for (let spineIndex = 0; spineIndex < spineCount; spineIndex += 1) {
    const source = spineIndex * 3;
    const x = spinePositionsM[source];
    const y = spinePositionsM[source + 1];
    const z = spinePositionsM[source + 2];
    if (x === undefined || y === undefined || z === undefined) {
      throw new RangeError(`Comet ion spine point ${spineIndex} is outside the buffer.`);
    }
    const fraction = spineCount <= 1 ? 0 : spineIndex / (spineCount - 1);
    writeSample(x, y, z, fraction);
    if (samplesPerSegment > 1 && spineIndex < spineCount - 1) {
      const next = (spineIndex + 1) * 3;
      const nx = spinePositionsM[next];
      const ny = spinePositionsM[next + 1];
      const nz = spinePositionsM[next + 2];
      if (nx === undefined || ny === undefined || nz === undefined) {
        throw new RangeError(`Comet ion spine point ${spineIndex + 1} is outside the buffer.`);
      }
      writeSample(
        (x + nx) * 0.5,
        (y + ny) * 0.5,
        (z + nz) * 0.5,
        (spineIndex + 0.5) / (spineCount - 1),
      );
    }
  }
  attribute.needsUpdate = true;
  phaseAttribute.needsUpdate = true;
  return written;
}

function createSoftRibbonGeometry(maxSpinePoints: number): {
  readonly geometry: BufferGeometry;
  readonly positionAttribute: BufferAttribute;
  readonly sideAttribute: BufferAttribute;
  readonly phaseAttribute: BufferAttribute;
} {
  const vertexCount = maxSpinePoints * 2;
  const positionAttribute = new Float32BufferAttribute(new Float32Array(vertexCount * 3), 3);
  positionAttribute.setUsage(35048);
  const sideAttribute = new Float32BufferAttribute(new Float32Array(vertexCount), 1);
  sideAttribute.setUsage(35048);
  const phaseAttribute = new Float32BufferAttribute(new Float32Array(vertexCount), 1);
  phaseAttribute.setUsage(35048);
  // Built-in uv is reliably interpolated by Three's ShaderMaterial path.
  const uvAttribute = new Float32BufferAttribute(new Float32Array(vertexCount * 2), 2);
  uvAttribute.setUsage(35048);
  const index = new Uint16Array(Math.max(0, maxSpinePoints - 1) * 6);
  for (let segment = 0; segment < maxSpinePoints - 1; segment += 1) {
    const offset = segment * 6;
    const left = segment * 2;
    index[offset] = left;
    index[offset + 1] = left + 1;
    index[offset + 2] = left + 2;
    index[offset + 3] = left + 1;
    index[offset + 4] = left + 3;
    index[offset + 5] = left + 2;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('aSide', sideAttribute);
  geometry.setAttribute('aTailPhase', phaseAttribute);
  geometry.setAttribute('uv', uvAttribute);
  geometry.setIndex(Array.from(index));
  geometry.setDrawRange(0, 0);
  return { geometry, positionAttribute, sideAttribute, phaseAttribute };
}

function writeSoftRibbon(
  mesh: Mesh<BufferGeometry, ShaderMaterial>,
  positionAttribute: BufferAttribute,
  sideAttribute: BufferAttribute,
  phaseAttribute: BufferAttribute,
  spineAttribute: BufferAttribute,
  spinePointCount: number,
  baseHalfWidth: number,
  flare: number,
  plane: 'in-plane' | 'cross' | 'view-aligned' = 'in-plane',
  viewLocal: Vector3 = SCENE_NORTH,
): void {
  const positions = positionAttribute.array as Float32Array;
  const sides = sideAttribute.array as Float32Array;
  const phases = phaseAttribute.array as Float32Array;
  const spine = spineAttribute.array as Float32Array;
  const uvAttribute = mesh.geometry.getAttribute('uv') as BufferAttribute | undefined;
  const uvs = uvAttribute?.array as Float32Array | undefined;
  if (spinePointCount < 2) {
    mesh.geometry.setDrawRange(0, 0);
    return;
  }
  for (let index = 0; index < spinePointCount; index += 1) {
    const source = index * 3;
    const x = spine[source] ?? 0;
    const y = spine[source + 1] ?? 0;
    const z = spine[source + 2] ?? 0;
    const prev = Math.max(0, index - 1) * 3;
    const next = Math.min(spinePointCount - 1, index + 1) * 3;
    let tx = (spine[next] ?? x) - (spine[prev] ?? x);
    let ty = (spine[next + 1] ?? y) - (spine[prev + 1] ?? y);
    let tz = (spine[next + 2] ?? z) - (spine[prev + 2] ?? z);
    const tLen = Math.hypot(tx, ty, tz) || 1;
    tx /= tLen;
    ty /= tLen;
    tz /= tLen;
    let sx: number;
    let sy: number;
    let sz: number;
    if (plane === 'view-aligned') {
      // Billboard the ribbon toward the camera so soft |vSide| falloff has screen area.
      const vx = viewLocal.x - x;
      const vy = viewLocal.y - y;
      const vz = viewLocal.z - z;
      sx = ty * vz - tz * vy;
      sy = tz * vx - tx * vz;
      sz = tx * vy - ty * vx;
      let sLen = Math.hypot(sx, sy, sz);
      if (sLen < 1e-6) {
        sx = ty * SCENE_NORTH.z - tz * SCENE_NORTH.y;
        sy = tz * SCENE_NORTH.x - tx * SCENE_NORTH.z;
        sz = tx * SCENE_NORTH.y - ty * SCENE_NORTH.x;
        sLen = Math.hypot(sx, sy, sz) || 1;
      }
      sx /= sLen;
      sy /= sLen;
      sz /= sLen;
    } else {
      // Prefer ecliptic-north bias so the dust sheet stays broader in-plane.
      sx = ty * SCENE_NORTH.z - tz * SCENE_NORTH.y;
      sy = tz * SCENE_NORTH.x - tx * SCENE_NORTH.z;
      sz = tx * SCENE_NORTH.y - ty * SCENE_NORTH.x;
      let sLen = Math.hypot(sx, sy, sz);
      if (sLen < 1e-6) {
        sx = ty * 0 - tz * 1;
        sy = tz * 1 - tx * 0;
        sz = tx * 0 - ty * 0;
        sLen = Math.hypot(sx, sy, sz) || 1;
      }
      sx /= sLen;
      sy /= sLen;
      sz /= sLen;
      if (plane === 'cross') {
        const cx = ty * sz - tz * sy;
        const cy = tz * sx - tx * sz;
        const cz = tx * sy - ty * sx;
        const cLen = Math.hypot(cx, cy, cz) || 1;
        sx = cx / cLen;
        sy = cy / cLen;
        sz = cz / cLen;
      }
    }
    const fraction = index / (spinePointCount - 1);
    // Pad the mesh ~2.6× past the lit core so |aSide|→1 is always empty.
    const meshPad = 2.6;
    // Wavy silhouette in geometry — breaks the constant-width ruler edge even before shading.
    const edgeWave =
      1 +
      0.2 * Math.sin(fraction * Math.PI * 8.5 + index * 0.62) +
      0.12 * Math.sin(fraction * Math.PI * 19.0 + index * 1.1) +
      (flare > 0.25 ? 0.08 * Math.sin(fraction * Math.PI * 4.2) : 0);
    // Near-constant ion tube; dust flares gently (never a screen triangle).
    const halfWidth =
      baseHalfWidth * (0.78 + Math.pow(fraction, 1.05) * flare) * edgeWave * meshPad;
    const left = index * 2;
    const right = left + 1;
    positions[left * 3] = x - sx * halfWidth;
    positions[left * 3 + 1] = y - sy * halfWidth;
    positions[left * 3 + 2] = z - sz * halfWidth;
    positions[right * 3] = x + sx * halfWidth;
    positions[right * 3 + 1] = y + sy * halfWidth;
    positions[right * 3 + 2] = z + sz * halfWidth;
    sides[left] = -1;
    sides[right] = 1;
    phases[left] = fraction;
    phases[right] = fraction;
    if (uvs !== undefined) {
      uvs[left * 2] = 0;
      uvs[left * 2 + 1] = fraction;
      uvs[right * 2] = 1;
      uvs[right * 2 + 1] = fraction;
    }
  }
  positionAttribute.needsUpdate = true;
  sideAttribute.needsUpdate = true;
  phaseAttribute.needsUpdate = true;
  if (uvAttribute !== undefined) uvAttribute.needsUpdate = true;
  mesh.geometry.setDrawRange(0, Math.max(0, spinePointCount - 1) * 6);
  mesh.geometry.computeBoundingSphere();
}

function createSoftRibbonMaterial(color: string, kind: 'ion' | 'dust'): ShaderMaterial {
  const dust = kind === 'dust';
  return new ShaderMaterial({
    name: `soft-comet-${kind}-sheet-ribbon`,
    blending: AdditiveBlending,
    depthTest: !dust,
    depthWrite: false,
    transparent: true,
    toneMapped: false,
    side: DoubleSide,
    uniforms: {
      uColor: { value: new Color(color) },
      uOpacity: { value: 0 },
      uDust: { value: dust ? 1 : 0 },
    },
    vertexShader: `
      varying float vSide;
      varying float vTailPhase;
      void main() {
        // uv.x: 0 left edge → 1 right edge. Built-in uv always interpolates.
        vSide = uv.x * 2.0 - 1.0;
        vTailPhase = uv.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uDust;
      varying float vSide;
      varying float vTailPhase;

      float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        float t = abs(vSide);
        // Mesh is padded: t=1 is the geometric edge and must stay fully dark.
        float n0 = hash21(vec2(floor(vTailPhase * 48.0), 0.17));
        float n1 = hash21(vec2(floor(vTailPhase * 48.0) + 1.0, 2.31));
        float n = mix(n0, n1, fract(vTailPhase * 48.0));
        float wave =
          0.11 * sin(vTailPhase * 27.0 + n * 6.28318) +
          0.07 * sin(vTailPhase * 51.0 + n0 * 4.1) +
          0.045 * sin(vTailPhase * 89.0);
        float edge = mix(
          mix(0.32, 0.46, n),
          mix(0.42, 0.62, n),
          uDust
        ) + wave * mix(0.75, 1.25, uDust);
        edge = clamp(edge, 0.22, 0.7);

        // Wide Hermite falloff across the lit envelope.
        float dens = 1.0 - smoothstep(0.0, edge, t);
        dens = dens * dens * mix(1.0, dens, uDust); // softer shoulder, dust softer still
        // Hard zero well before the mesh silhouette.
        dens *= 1.0 - smoothstep(0.58, 0.78, t);
        if (dens < 0.001) discard;

        // Noisy broken margin — kills continuous straight iso-contours.
        float grain = hash21(vec2(vTailPhase * 160.0 + vSide * 5.0, t * 110.0));
        float grain2 = hash21(vec2(vTailPhase * 91.0, t * 63.0 - vSide * 7.0));
        if (dens < 0.38 && grain > dens * 2.4 + 0.06) discard;
        if (dens < 0.22 && grain2 > dens * 3.5) discard;
        dens *= mix(0.5, 1.0, smoothstep(0.0, 0.2, dens + grain * 0.25));

        // Ion: peaked filament + faint wide halo + soft rays.
        float ionCore = exp(-pow(t / max(edge * 0.28, 0.04), 2.0) * 11.0);
        float rayA = pow(max(0.0, cos(vSide * 3.14159 * 2.0 + vTailPhase * 0.4)), 9.0);
        float rayB = pow(max(0.0, cos(vSide * 3.14159 * 3.4 - vTailPhase * 0.55)), 11.0);
        float rays = clamp(rayA * 0.4 + rayB * 0.28, 0.0, 1.0);
        float ionProfile = max(ionCore * mix(0.4, 1.0, rays), dens * 0.18);

        // Dust: wide low-additive mottled fan.
        float dustCore = exp(-pow(t / max(edge * 0.75, 0.08), 2.0) * 2.0);
        float dustMottle = 0.62 + 0.38 * sin(vTailPhase * 13.0 + vSide * 4.2);
        dustMottle *= 0.75 + 0.25 * hash21(vec2(vTailPhase * 33.0, t * 17.0));
        float dustProfile = max(dustCore, dens * 0.5) * dustMottle;

        float profile = mix(ionProfile, dustProfile, uDust);
        float fade = mix(
          mix(0.03, 1.0, pow(1.0 - vTailPhase, 1.75)),
          mix(0.08, 1.0, pow(1.0 - vTailPhase, 0.55)),
          uDust
        );
        float alpha = uOpacity * profile * dens * fade * mix(1.0, 0.4, uDust);
        if (alpha < 0.0005) discard;
        vec3 tint = mix(uColor * 1.04, uColor * mix(0.88, 1.02, dustMottle), uDust);
        gl_FragColor = vec4(tint, alpha);
      }
    `,
  });
}

function pointSizeForQuality(quality: VisualQuality, kind: 'ion' | 'dust'): number {
  const base = quality === 'low' ? 2.8 : quality === 'medium' ? 2.55 : quality === 'high' ? 2.4 : 2.25;
  return kind === 'ion' ? base * 1.35 : base * 2.05;
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
    // Normal blending: additive + bloom turns the coma into a solid white ball.
    blending: NormalBlending,
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
        // Soft limb haze — hollow center so the dark nucleus stays readable.
        float radialDensity = pow(facing, uRadialExponent) * smoothstep(0.18, 0.82, facing);
        radialDensity *= 1.0 - 0.85 * pow(facing, 2.8);
        float sunward = dot(normalize(vObjectNormal), -normalize(uTailDirection));
        float directionalDensity = 1.0 + sunward * uAsymmetry;
        float wisp = 0.92 + 0.08 * sin(
          dot(vObjectNormal, vec3(6.4, 8.2, 4.7)) + uSeed * 31.4159
        );
        float alpha = uOpacity * radialDensity * directionalDensity * wisp;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(uColor, alpha);
        #include <colorspace_fragment>
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
    blending: dust ? NormalBlending : AdditiveBlending,
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
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float depth = max(0.04, -mvPosition.z);
        float perspective = clamp(0.1 / depth, 0.75, 2.8);
        float taper = mix(1.05, mix(0.55, 0.88, uTailKind), aTailPhase);
        float dustSpread = mix(0.9, 1.45, uTailKind);
        gl_PointSize = max(1.4, uPointSize * taper * dustSpread * perspective);
        gl_Position = projectionMatrix * mvPosition;
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
        float softness = exp(-radius2 * mix(6.4, 2.6, uTailKind));
        float longitudinalFade = pow(max(0.0, 1.0 - vTailPhase), mix(1.1, 0.65, uTailKind));
        float midBoost = smoothstep(0.0, 0.025, vTailPhase);
        float alpha = uOpacity * softness * longitudinalFade * max(0.5, vBrightness) * midBoost;
        if (alpha < 0.00035) discard;
        gl_FragColor = vec4(uColor, alpha);
        #include <colorspace_fragment>
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
        // Spine lines are a faint guide only; particles carry the visible mass.
        float fade = mix(0.02, 1.0, pow(1.0 - vTailPhase, mix(1.5, 1.05, uDust)));
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
  tailRendering: 'diffuse ion and dust particle tails',
});
