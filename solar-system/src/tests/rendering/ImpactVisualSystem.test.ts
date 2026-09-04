import {
  Group,
  type Mesh,
  type MeshStandardMaterial,
  type BufferGeometry,
  type Line,
  type LineBasicMaterial,
  type Points,
  type ShaderMaterial,
} from 'three';

import {
  ImpactVisualSystem,
  resolveImpactCameraPose,
  type ImpactCameraPresetId,
  type ImpactRenderState,
} from '../../rendering/impact';

describe('ImpactVisualSystem', () => {
  it('renders a complete target-local event from preallocated deterministic resources', () => {
    const system = new ImpactVisualSystem('high');
    const target = new Group();
    system.attachToTarget(target);
    expect(system.root.parent).toBe(target);
    expect(system.root.name).toBe('impact-lab-target-local-layer');

    const event = state();
    system.update(event);
    const diagnostics = system.getDiagnostics();
    expect(diagnostics).toMatchObject({
      active: true,
      lifecycleState: 'running',
      stage: 'impact-flash',
      runSignature: 'fixture:42',
      trailPointCount: 0,
      fragmentCount: 2,
      ejectaPointCount: 160,
      plumePointCount: 128,
      impactorVisible: false,
      flashVisible: true,
      craterVisible: true,
      shockwaveVisible: true,
      hazeVisible: true,
    });
    expect(diagnostics.effectiveFlashIntensity).toBe(0.72);
    expect(diagnostics.boundingRadiusMultiplier).toBeGreaterThan(1);

    const children = system.root.children.slice();
    const firstEjecta = pointPositions(system, 'impact-ballistic-ejecta');
    const firstPlume = pointPositions(system, 'impact-layered-volumetric-plume');
    system.reset();
    system.reset();
    expect(system.root.children).toEqual(children);
    expect(system.getDiagnostics()).toMatchObject({ active: false, stage: 'idle' });

    system.update(event);
    expect(pointPositions(system, 'impact-ballistic-ejecta')).toEqual(firstEjecta);
    expect(pointPositions(system, 'impact-layered-volumetric-plume')).toEqual(firstPlume);

    system.update(state({ runSignature: 'fixture:different' }));
    expect(pointPositions(system, 'impact-ballistic-ejecta')).not.toEqual(firstEjecta);

    system.dispose();
    system.dispose();
    expect(system.root.children).toHaveLength(0);
  });

  it('renders setup preview as only a constant-screen reticle and projected trajectory', () => {
    const system = new ImpactVisualSystem('high');
    const preview = state({
      presentationMode: 'preview',
      lifecycleState: 'armed',
      stage: 'preview',
    });
    const children = system.root.children.slice();

    system.update(preview);

    expect(system.getDiagnostics()).toMatchObject({
      active: true,
      presentationMode: 'preview',
      lifecycleState: 'armed',
      stage: 'preview',
      reticleVisible: true,
      projectedTrajectoryPointCount: 3,
      trailPointCount: 0,
      fragmentCount: 0,
      ejectaPointCount: 0,
      plumePointCount: 0,
      impactorVisible: false,
      flashVisible: false,
      craterVisible: false,
      shockwaveVisible: false,
      hazeVisible: false,
      effectiveFlashIntensity: 0,
    });
    expect(system.root.children.filter((child) => child.visible).map((child) => child.name))
      .toEqual(['impact-preview-target-reticle', 'impact-preview-trajectory']);

    const reticle = system.root.getObjectByName('impact-preview-target-reticle') as
      | Points<BufferGeometry, ShaderMaterial>
      | undefined;
    const trajectory = system.root.getObjectByName('impact-preview-trajectory') as
      | Line<BufferGeometry, LineBasicMaterial>
      | undefined;
    expect(reticle).toBeDefined();
    expect(trajectory).toBeDefined();
    if (reticle === undefined || trajectory === undefined) throw new Error('Missing preview resources.');
    expect(reticle.material.depthTest).toBe(true);
    expect(reticle.material.depthWrite).toBe(false);
    expect(reticle.material.uniforms.uPointSize?.value).toBe(22);
    expect(reticle.material.vertexShader).toContain('gl_PointSize = uPointSize');
    expect(reticle.position.length()).toBeCloseTo(1.00002, 8);
    expect(trajectory.material.depthTest).toBe(true);
    expect(trajectory.material.depthWrite).toBe(false);
    expect(trajectory.material.linewidth).toBe(1);
    const firstTrajectory = Array.from(
      (trajectory.geometry.getAttribute('position').array as Float32Array).slice(0, 9),
    );

    const reticleGeometryDispose = vi.spyOn(reticle.geometry, 'dispose');
    const reticleMaterialDispose = vi.spyOn(reticle.material, 'dispose');
    const trajectoryGeometryDispose = vi.spyOn(trajectory.geometry, 'dispose');
    const trajectoryMaterialDispose = vi.spyOn(trajectory.material, 'dispose');

    system.reset();
    system.reset();
    expect(system.root.children).toEqual(children);
    expect(system.root.children.every((child) => !child.visible)).toBe(true);
    expect(trajectory.geometry.drawRange.count).toBe(0);

    system.update(preview);
    expect(system.root.children).toEqual(children);
    expect(Array.from(
      (trajectory.geometry.getAttribute('position').array as Float32Array).slice(0, 9),
    )).toEqual(firstTrajectory);

    system.update(state());
    expect(reticle.visible).toBe(false);
    expect(trajectory.visible).toBe(false);
    expect(system.getDiagnostics().presentationMode).toBe('playback');

    system.dispose();
    system.dispose();
    expect(reticleGeometryDispose).toHaveBeenCalledTimes(1);
    expect(reticleMaterialDispose).toHaveBeenCalledTimes(1);
    expect(trajectoryGeometryDispose).toHaveBeenCalledTimes(1);
    expect(trajectoryMaterialDispose).toHaveBeenCalledTimes(1);
  });

  it('downsamples long preview paths without dropping the impact endpoint', () => {
    const system = new ImpactVisualSystem('high');
    const sampleCount = 420;
    const path = new Float64Array(sampleCount * 3);
    for (let index = 0; index < sampleCount; index += 1) {
      const offset = index * 3;
      path[offset] = index * 1_000;
      path[offset + 1] = index * 200;
      path[offset + 2] = 160_000 - index * (160_000 / (sampleCount - 1));
    }

    const preview = state({
      presentationMode: 'preview',
      lifecycleState: 'armed',
      stage: 'preview',
      trailLocalEnuM: path,
    });
    system.update(preview);

    const trajectory = system.root.getObjectByName('impact-preview-trajectory') as
      | Line<BufferGeometry, LineBasicMaterial>
      | undefined;
    expect(trajectory).toBeDefined();
    if (trajectory === undefined) throw new Error('Missing preview trajectory.');
    expect(trajectory.geometry.drawRange.count).toBe(256);
    expect(system.getDiagnostics().projectedTrajectoryPointCount).toBe(256);

    const output = trajectory.geometry.getAttribute('position').array as Float32Array;
    const finalOffset = (trajectory.geometry.drawRange.count - 1) * 3;
    const finalInputOffset = (sampleCount - 1) * 3;
    expect(output[finalOffset]).toBeCloseTo(
      1 + (path[finalInputOffset + 2] ?? 0) / preview.targetRadiusM,
      6,
    );
    expect(output[finalOffset + 1]).toBeCloseTo(
      (path[finalInputOffset] ?? 0) / preview.targetRadiusM,
      6,
    );
    expect(output[finalOffset + 2]).toBeCloseTo(
      -(path[finalInputOffset + 1] ?? 0) / preview.targetRadiusM,
      6,
    );
    system.dispose();
  });

  it('applies quality and accessibility budgets without changing physical inputs', () => {
    const system = new ImpactVisualSystem('low');
    const event = state({ flashIntensity: 3.5 });
    system.setReduceFlashes(false);
    system.update(event);
    expect(system.getDiagnostics()).toMatchObject({
      ejectaPointCount: 48,
      plumePointCount: 32,
      effectiveFlashIntensity: 3.5,
    });
    expect(system.getProtectiveExposureCeiling()).toBe(0.58);

    system.setReducedMotion(true);
    system.setQuality('ultra');
    system.setReduceFlashes(true);
    system.update(event);
    expect(system.getDiagnostics()).toMatchObject({
      ejectaPointCount: 115,
      plumePointCount: 96,
      effectiveFlashIntensity: 0.72,
    });
    expect(system.getProtectiveExposureCeiling()).toBe(0.5);
    system.dispose();
  });

  it('keeps physical diagnostics separate from enhanced local presentation scale', () => {
    const system = new ImpactVisualSystem('high');
    const event = state({ stage: 'ejecta', eventElapsedSeconds: 4 });
    system.setCameraPreset('ground-observer');
    system.update(event);
    const physical = system.getDiagnostics();
    expect(physical.visibilityMode).toBe('physical');
    expect(physical.visibilityMultiplier).toBe(1);

    system.setVisibilityMode('enhanced');
    system.update(event);
    const enhanced = system.getDiagnostics();
    expect(enhanced.visibilityMode).toBe('enhanced');
    expect(enhanced.visibilityMultiplier).toBeGreaterThan(1);
    expect(enhanced.craterAngularRadiusRad).toBeGreaterThan(
      physical.craterAngularRadiusRad,
    );
    expect(event.craterRadiusM).toBe(state().craterRadiusM);

    system.setVisibilityMode('physical');
    system.update(event);
    expect(system.getDiagnostics()).toMatchObject({
      visibilityMode: 'physical',
      visibilityMultiplier: 1,
    });
    system.dispose();
  });

  it('aligns entry envelopes to velocity and scales thin, dense, and giant profiles', () => {
    const system = new ImpactVisualSystem('high');
    const entry = state({
      stage: 'entry',
      flashIntensity: 0,
      craterRadiusM: 0,
      ejectaRadiusM: 0,
      shockwaveRadiusM: 0,
      plumeHeightM: 0,
      hazeOpacity: 0,
      fragmentsLocalEnuM: new Float64Array(0),
      normalizedHeating: 0.62,
      normalizedDynamicPressure: 0.5,
    });

    system.update({ ...entry, entryEffectProfile: 'thin' });
    const thinIntensity = system.getDiagnostics().entryEffectIntensity;
    system.update({ ...entry, entryEffectProfile: 'dense' });
    const denseDiagnostics = system.getDiagnostics();
    expect(denseDiagnostics).toMatchObject({
      bowShockVisible: true,
      plasmaVisible: true,
      entryTrailVisible: true,
      entryEffectProfile: 'dense',
      normalizedHeating: 0.62,
    });
    expect(denseDiagnostics.velocityAlignmentDot).toBeGreaterThan(0.999_999);
    expect(denseDiagnostics.entryEffectIntensity).toBeGreaterThan(thinIntensity);

    const impactor = system.root.getObjectByName('impact-impactor');
    const bowShock = system.root.getObjectByName('impact-entry-bow-shock');
    const plasma = system.root.getObjectByName('impact-entry-plasma-envelope');
    expect(impactor).toBeDefined();
    expect(bowShock).toBeDefined();
    expect(plasma).toBeDefined();
    if (impactor === undefined || bowShock === undefined || plasma === undefined) {
      throw new Error('Missing entry envelope resources.');
    }
    const velocityDirection = bowShock.position.clone().sub(impactor.position).normalize();
    expect(velocityDirection.dot(plasma.position.clone().sub(impactor.position))).toBeLessThan(0);

    system.update({ ...entry, entryEffectProfile: 'giant' });
    expect(system.getDiagnostics().entryEffectIntensity).toBeGreaterThan(
      denseDiagnostics.entryEffectIntensity,
    );
    system.dispose();
  });

  it('absolutely hides atmospheric entry effects for an airless profile', () => {
    const system = new ImpactVisualSystem('ultra');
    const entry = state({ stage: 'fragmentation' });
    system.update(entry);
    expect(system.getDiagnostics()).toMatchObject({
      bowShockVisible: true,
      plasmaVisible: true,
      entryTrailVisible: true,
    });

    system.update({
      ...entry,
      entryEffectProfile: 'none',
      normalizedHeating: 1,
      normalizedDynamicPressure: 1,
    });
    expect(system.getDiagnostics()).toMatchObject({
      bowShockVisible: false,
      plasmaVisible: false,
      entryTrailVisible: false,
      velocityAlignmentDot: 0,
      entryEffectProfile: 'none',
      entryEffectIntensity: 0,
    });
    expect(system.root.getObjectByName('impact-entry-bow-shock')?.visible).toBe(false);
    expect(system.root.getObjectByName('impact-entry-plasma-envelope')?.visible).toBe(false);
    const trail = system.root.getObjectByName('impact-ablation-trail') as
      | Points<BufferGeometry, ShaderMaterial>
      | undefined;
    expect(trail?.geometry.drawRange.count).toBe(0);
    system.dispose();
  });

  it('reuses and disposes deterministic irregular PBR entry resources', () => {
    const system = new ImpactVisualSystem();
    const impactor = system.root.getObjectByName('impact-impactor') as
      | Mesh<BufferGeometry, MeshStandardMaterial>
      | undefined;
    const bowShock = system.root.getObjectByName('impact-entry-bow-shock') as
      | Mesh<BufferGeometry, ShaderMaterial>
      | undefined;
    const plasma = system.root.getObjectByName('impact-entry-plasma-envelope') as
      | Mesh<BufferGeometry, ShaderMaterial>
      | undefined;
    const trail = system.root.getObjectByName('impact-ablation-trail') as
      | Points<BufferGeometry, ShaderMaterial>
      | undefined;
    expect(impactor).toBeDefined();
    expect(bowShock).toBeDefined();
    expect(plasma).toBeDefined();
    expect(trail).toBeDefined();
    if (impactor === undefined || bowShock === undefined || plasma === undefined || trail === undefined) {
      throw new Error('Missing preallocated entry resources.');
    }

    system.update(state({ stage: 'entry', impactorMaterial: 'porous-rock' }));
    const firstShape = Array.from(
      impactor.geometry.getAttribute('position').array as Float32Array,
    );
    expect(impactor.material.roughness).toBeGreaterThan(0.95);
    expect(impactor.material.metalness).toBeLessThan(0.02);
    expect(impactor.material.vertexColors).toBe(true);
    const surfaceColors = Array.from(
      impactor.geometry.getAttribute('color').array as Float32Array,
    );
    expect(new Set(surfaceColors.map((value) => value.toFixed(5))).size).toBeGreaterThan(8);
    expect(bowShock.material.uniforms.uOpacity?.value).toBeGreaterThan(0);
    expect(plasma.material.uniforms.uPlasma?.value).toBe(1);
    expect(bowShock.material.fragmentShader).toContain('float shell');
    expect(system.getDiagnostics().impactorSizeExaggerated).toBe(true);

    const children = system.root.children.slice();
    system.reset();
    system.update(state({ stage: 'entry', impactorMaterial: 'porous-rock' }));
    expect(system.root.children).toEqual(children);
    expect(Array.from(
      impactor.geometry.getAttribute('position').array as Float32Array,
    )).toEqual(firstShape);

    system.update(state({
      stage: 'entry',
      runSignature: 'fixture:new-shape',
      impactorMaterial: 'iron',
      normalizedHeating: 0.9,
    }));
    expect(Array.from(
      impactor.geometry.getAttribute('position').array as Float32Array,
    )).not.toEqual(firstShape);
    expect(Array.from(
      impactor.geometry.getAttribute('color').array as Float32Array,
    )).not.toEqual(surfaceColors);
    expect(impactor.material.metalness).toBeGreaterThan(0.7);
    expect(impactor.material.emissiveIntensity).toBeGreaterThan(2.7);

    const disposeSpies = [
      vi.spyOn(impactor.geometry, 'dispose'),
      vi.spyOn(impactor.material, 'dispose'),
      vi.spyOn(bowShock.geometry, 'dispose'),
      vi.spyOn(bowShock.material, 'dispose'),
      vi.spyOn(plasma.geometry, 'dispose'),
      vi.spyOn(plasma.material, 'dispose'),
      vi.spyOn(trail.geometry, 'dispose'),
      vi.spyOn(trail.material, 'dispose'),
    ];
    system.dispose();
    system.dispose();
    disposeSpies.forEach((spy) => { expect(spy).toHaveBeenCalledTimes(1); });
  });

  it('rejects malformed render snapshots at the subsystem boundary', () => {
    const system = new ImpactVisualSystem();
    expect(() => system.update(state({ progress: 1.1 }))).toThrow(RangeError);
    expect(() => system.update(state({ targetBodyId: '  ' }))).toThrow(/target body id/);
    expect(() => system.update(state({ targetRadiusM: 0 }))).toThrow(/target radius/);
    expect(() => system.update(state({ trailLocalEnuM: new Float64Array([1, 2]) })))
      .toThrow(/interleaved/);
    system.dispose();
  });

  it('places an airburst flash at the terminal impactor position, not on the surface', () => {
    const system = new ImpactVisualSystem();
    system.update(state({
      stage: 'airburst',
      outcomeKind: 'airburst',
      aftermathKind: 'none',
      eventElapsedSeconds: 0.2,
      craterRadiusM: 0,
      craterFormationProgress: 0,
      surfaceScorchOpacity: 0,
      ejectaRadiusM: 0,
      ejectaOpacity: 0,
      groundShockwaveAngularRadiusRad: 0,
      groundShockwaveOpacity: 0,
      atmosphericShockwaveAngularRadiusRad: 0,
      atmosphericShockwaveOpacity: 0,
      plumeHeightM: 0,
      plumeRadiusM: 0,
      plumeOpacity: 0,
    }));
    const flash = system.root.getObjectByName('impact-bounded-flash-light');
    const impactor = system.root.getObjectByName('impact-impactor');
    expect(flash).toBeDefined();
    expect(impactor).toBeDefined();
    expect(flash?.position.toArray()).toEqual(impactor?.position.toArray());
    expect(flash?.position.length()).toBeGreaterThan(1.001);
    expect(flash?.position.length()).not.toBeCloseTo(1.012, 5);
    system.dispose();
  });

  it('renders an ellipsoid-conforming solid aftermath without flat circle or ring geometry', () => {
    const system = new ImpactVisualSystem('high');
    system.update(state({ stage: 'aftermath', eventElapsedSeconds: 1.2 }));
    const diagnostics = system.getDiagnostics();

    expect(diagnostics).toMatchObject({
      surfaceEffectProfile: 'solid-atmospheric',
      aftermathKind: 'crater',
      flashVisible: true,
      flashLightVisible: true,
      craterVisible: true,
      craterPersistent: true,
      groundShockwaveVisible: true,
      atmosphericShockwaveVisible: true,
      shockwaveSurfaceConforming: true,
      plumeVisible: true,
      plumeLayerCount: 3,
      cloudScarVisible: false,
      solidSurfaceEffectsSuppressed: false,
      aftermathPersistent: true,
    });
    expect(diagnostics.flashAttachmentErrorM).toBeLessThan(0.05);
    expect(diagnostics.craterAttachmentErrorM).toBeLessThan(0.05);
    expect(diagnostics.flashNormalAlignmentDot).toBeGreaterThan(0.999_999);
    expect(diagnostics.craterAngularRadiusRad).toBeCloseTo(
      5_200 / 6_371_008.4,
      10,
    );
    expect(diagnostics.activeObjectCount).toBeGreaterThan(6);

    const geometryTypes: string[] = [];
    system.root.traverse((object) => {
      const geometry = (object as { geometry?: { type?: string } }).geometry;
      if (geometry?.type !== undefined) geometryTypes.push(geometry.type);
    });
    expect(geometryTypes).not.toContain('CircleGeometry');
    expect(geometryTypes).not.toContain('RingGeometry');
    expect(system.root.getObjectByName('impact-curved-crater-patch')).toBeDefined();
    expect(system.root.getObjectByName('impact-curved-ground-shockwave')).toBeDefined();
    system.dispose();
  });

  it('hard-disables solid aftermath on giants while advecting a cloud scar', () => {
    const system = new ImpactVisualSystem('ultra');
    const giant = state({
      stage: 'plume',
      targetBodyId: 'jupiter',
      targetRadiusM: 69_911_000,
      targetEquatorialRadiusM: 71_492_000,
      targetPolarRadiusM: 66_854_000,
      targetClass: 'gas-giant',
      surfaceGravityMps2: 24.79,
      supportsCrater: false,
      supportsGroundShockwave: false,
      supportsAtmosphericShockwave: true,
      supportsPersistentSurfaceDecal: false,
      supportsCloudScar: true,
      outcomeKind: 'deep-atmosphere-breakup',
      surfaceEffectProfile: 'giant-atmospheric',
      aftermathKind: 'cloud-scar',
      entryEffectProfile: 'giant',
      eventElapsedSeconds: 3.4,
      craterFormationProgress: 1,
      surfaceScorchOpacity: 1,
      ejectaOpacity: 1,
      groundShockwaveAngularRadiusRad: 0.08,
      groundShockwaveOpacity: 1,
      atmosphericShockwaveAngularRadiusRad: 0.06,
      atmosphericShockwaveOpacity: 0.62,
      plumeHeightM: 780_000,
      plumeRadiusM: 240_000,
      plumeOpacity: 0.72,
      cloudScarRadiusM: 1_300_000,
      cloudScarGrowthProgress: 0.58,
      cloudScarOpacity: 0.66,
      cloudScarAdvectionRad: 0.24,
    });
    system.update(giant);
    const diagnostics = system.getDiagnostics();
    expect(diagnostics).toMatchObject({
      craterVisible: false,
      craterPersistent: false,
      groundShockwaveVisible: false,
      atmosphericShockwaveVisible: true,
      ejectaActiveCount: 0,
      plumeVisible: true,
      cloudScarVisible: true,
      cloudRippleVisible: true,
      cloudScarOpacity: 0.66,
      cloudScarAdvectionRad: 0.24,
      solidSurfaceEffectsSuppressed: true,
      aftermathPersistent: true,
    });
    expect(diagnostics.cloudScarAngularRadiusRad).toBeGreaterThan(0);
    expect(system.root.getObjectByName('impact-curved-crater-patch')?.visible).toBe(false);
    expect(system.root.getObjectByName('impact-advected-cloud-scar')?.visible).toBe(true);

    const scar = system.root.getObjectByName('impact-advected-cloud-scar') as
      | Mesh<BufferGeometry, ShaderMaterial>
      | undefined;
    expect(scar).toBeDefined();
    const firstCenter = scar === undefined
      ? []
      : (scar.material.uniforms.uScarDirection?.value as { toArray(): number[] }).toArray();
    system.update({ ...giant, cloudScarAdvectionRad: 0.51 });
    const secondCenter = scar === undefined
      ? []
      : (scar.material.uniforms.uScarDirection?.value as { toArray(): number[] }).toArray();
    expect(secondCenter).not.toEqual(firstCenter);
    system.dispose();
  });

  it('allows an airless crater/ejecta profile but rejects atmospheric waves and scars', () => {
    const system = new ImpactVisualSystem('medium');
    system.update(state({
      targetBodyId: 'moon',
      targetRadiusM: 1_737_400,
      targetEquatorialRadiusM: 1_737_400,
      targetPolarRadiusM: 1_737_400,
      targetClass: 'airless-rocky',
      surfaceGravityMps2: 1.62,
      supportsAtmosphericShockwave: false,
      supportsCloudScar: false,
      surfaceEffectProfile: 'solid-airless',
      aftermathKind: 'dusty-crater',
      entryEffectProfile: 'none',
      atmosphericShockwaveAngularRadiusRad: 0.2,
      atmosphericShockwaveOpacity: 1,
      cloudScarRadiusM: 80_000,
      cloudScarGrowthProgress: 1,
      cloudScarOpacity: 1,
    }));
    expect(system.getDiagnostics()).toMatchObject({
      craterVisible: true,
      groundShockwaveVisible: true,
      atmosphericShockwaveVisible: false,
      ejectaActiveCount: 96,
      cloudScarVisible: false,
    });
    system.dispose();
  });

  it('replays pooled ejecta deterministically and restores a pristine target on reset', () => {
    const system = new ImpactVisualSystem('high');
    const target = new Group();
    const event = state({ stage: 'ejecta', eventElapsedSeconds: 1.4 });
    expect(target.children).toHaveLength(0);
    system.attachToTarget(target);
    system.update(event);
    const first = pointPositions(system, 'impact-ballistic-ejecta');
    expect(first.length).toBeGreaterThan(0);
    expect(target.children).toHaveLength(1);

    system.reset();
    expect(target.children).toHaveLength(0);
    expect(system.getDiagnostics()).toMatchObject({ activeObjectCount: 0, active: false });
    system.attachToTarget(target);
    system.update(event);
    expect(pointPositions(system, 'impact-ballistic-ejecta')).toEqual(first);
    system.update({ ...event, runSignature: 'fixture:other-ejecta' });
    expect(pointPositions(system, 'impact-ballistic-ejecta')).not.toEqual(first);
    system.dispose();
  });

  it('keeps aftermath GPU resources through reset and disposes each resource exactly once', () => {
    const system = new ImpactVisualSystem('high');
    system.update(state({ stage: 'aftermath', eventElapsedSeconds: 1.2 }));

    const resourceNames = [
      'impact-surface-flash-cap',
      'impact-curved-crater-patch',
      'impact-curved-ground-shockwave',
      'impact-curved-atmospheric-shockwave',
      'impact-ballistic-ejecta',
      'impact-layered-volumetric-plume',
      'impact-advected-cloud-scar',
    ] as const;
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<ShaderMaterial>();
    for (const name of resourceNames) {
      const renderObject = system.root.getObjectByName(name) as
        | { geometry: BufferGeometry; material: ShaderMaterial }
        | undefined;
      expect(renderObject, `missing pooled renderer object ${name}`).toBeDefined();
      if (renderObject === undefined) continue;
      geometries.add(renderObject.geometry);
      materials.add(renderObject.material);
    }
    const disposeSpies = [
      ...Array.from(geometries, (geometry) => vi.spyOn(geometry, 'dispose')),
      ...Array.from(materials, (material) => vi.spyOn(material, 'dispose')),
    ];

    system.reset();
    disposeSpies.forEach((spy) => { expect(spy).not.toHaveBeenCalled(); });
    system.dispose();
    system.dispose();
    disposeSpies.forEach((spy) => { expect(spy).toHaveBeenCalledTimes(1); });
  });
});

describe('impact event-camera poses', () => {
  it('resolves every declared preset deterministically in target-local units', () => {
    const event = state({
      stage: 'atmospheric-entry',
      flashIntensity: 0,
      craterRadiusM: 0,
      ejectaRadiusM: 0,
      shockwaveRadiusM: 0,
      plumeHeightM: 0,
      hazeOpacity: 0,
    });
    const ids: readonly ImpactCameraPresetId[] = [
      'orbital',
      'horizon',
      'chase',
      'ground-observer',
    ];
    for (const id of ids) {
      const first = resolveImpactCameraPose(id, event);
      const replay = resolveImpactCameraPose(id, event);
      expect(replay).toEqual(first);
      expect(Object.isFrozen(first)).toBe(true);
      expect(Object.values(first.position).every(Number.isFinite)).toBe(true);
      expect(Object.values(first.target).every(Number.isFinite)).toBe(true);
      expect(Math.hypot(first.up.x, first.up.y, first.up.z)).toBeCloseTo(1, 10);
      expect(first.position).not.toEqual(first.target);
    }
    expect(resolveImpactCameraPose('chase', event)).not.toEqual(
      resolveImpactCameraPose('orbital', event),
    );
  });

  it('uses the selected target radius for metre-to-local-unit camera math', () => {
    const earth = state({ targetBodyId: 'earth', targetRadiusM: 6_371_008.4 });
    const moon = state({ targetBodyId: 'moon', targetRadiusM: 1_737_400 });

    const earthPose = resolveImpactCameraPose('chase', earth);
    const moonPose = resolveImpactCameraPose('chase', moon);

    expect(moonPose).not.toEqual(earthPose);
    expect(resolveImpactCameraPose('chase', moon)).toEqual(moonPose);
  });

  it('frames solid impact stages within the regional viewing envelope', () => {
    const localEvent = state({
      stage: 'ejecta',
      eventElapsedSeconds: 4,
      flashIntensity: 0,
    });
    const localPose = resolveImpactCameraPose('ground-observer', localEvent);
    const localDistanceFromImpact = Math.hypot(
      localPose.position.x - 1,
      localPose.position.y,
      localPose.position.z,
    );
    expect(localDistanceFromImpact).toBeGreaterThan(0.24);
    expect(localDistanceFromImpact).toBeLessThan(0.3);
    expect(localPose.target.x - 1).toBeGreaterThan(0);
    expect(localPose.target.x - 1).toBeLessThanOrEqual(0.02);

    const regionalEvent = state({
      stage: 'ejecta',
      eventElapsedSeconds: 4,
      flashIntensity: 0,
      flashRadiusM: 82_000,
      craterRadiusM: 52_000,
      scorchRadiusM: 120_000,
      plumeRadiusM: 240_000,
    });
    const regionalPose = resolveImpactCameraPose('ground-observer', regionalEvent);
    const regionalDistanceFromImpact = Math.hypot(
      regionalPose.position.x - 1,
      regionalPose.position.y,
      regionalPose.position.z,
    );
    expect(regionalDistanceFromImpact).toBeGreaterThanOrEqual(localDistanceFromImpact);
    expect(regionalDistanceFromImpact).toBeLessThan(0.5);

    const enhancedPose = resolveImpactCameraPose('ground-observer', localEvent, 16);
    const enhancedDistanceFromImpact = Math.hypot(
      enhancedPose.position.x - 1,
      enhancedPose.position.y,
      enhancedPose.position.z,
    );
    expect(enhancedDistanceFromImpact).toBeGreaterThan(localDistanceFromImpact);
  });
});

function pointPositions(system: ImpactVisualSystem, name: string): readonly number[] {
  const points = system.root.getObjectByName(name) as Points<BufferGeometry> | undefined;
  if (points === undefined) throw new Error(`Missing test points "${name}".`);
  const count = points.geometry.drawRange.count;
  const values = points.geometry.getAttribute('position').array as Float32Array;
  return Array.from(values.slice(0, count * 3));
}

function state(overrides: Partial<ImpactRenderState> = {}): Readonly<ImpactRenderState> {
  return Object.freeze({
    presentationMode: 'playback',
    lifecycleState: 'running',
    stage: 'impact-flash',
    scenarioTimeSeconds: 12.5,
    progress: 0.56,
    targetBodyId: 'earth',
    targetRadiusM: 6_371_008.4,
    targetEquatorialRadiusM: 6_371_008.4,
    targetPolarRadiusM: 6_371_008.4,
    targetClass: 'dense-atmosphere-rocky',
    surfaceGravityMps2: 9.80665,
    supportsCrater: true,
    supportsGroundShockwave: true,
    supportsAtmosphericShockwave: true,
    supportsPersistentSurfaceDecal: true,
    supportsCloudScar: false,
    outcomeKind: 'solid-surface-impact',
    surfaceEffectProfile: 'solid-atmospheric',
    aftermathKind: 'crater',
    impactNormalBodyLocal: Object.freeze({ x: 1, y: 0, z: 0 }),
    impactEastBodyLocal: Object.freeze({ x: 0, y: 0, z: 1 }),
    impactNorthBodyLocal: Object.freeze({ x: 0, y: 1, z: 0 }),
    impactorLocalEnuM: Object.freeze({ eastM: 12_000, northM: 2_500, upM: 48_000 }),
    impactorVelocityLocalEnuMps: Object.freeze({
      eastM: 3_400,
      northM: 620,
      upM: -17_800,
    }),
    trailLocalEnuM: new Float64Array([
      -20_000, 0, 140_000,
      -4_000, 1_000, 92_000,
      12_000, 2_500, 48_000,
    ]),
    fragmentsLocalEnuM: new Float64Array([
      11_000, 2_200, 47_500,
      13_000, 2_900, 48_600,
    ]),
    physicalDiameterM: 140,
    impactorMaterial: 'stone',
    entryEffectProfile: 'dense',
    normalizedHeating: 0.74,
    normalizedDynamicPressure: 0.68,
    remainingMassFraction: 0.72,
    eventElapsedSeconds: 0.8,
    flashIntensity: 2.4,
    flashRadiusM: 8_200,
    craterRadiusM: 5_200,
    craterDepthM: 1_050,
    scorchRadiusM: 12_000,
    craterFormationProgress: 0.78,
    surfaceScorchOpacity: 0.64,
    ejectaRadiusM: 18_000,
    ejectaLaunchSpeedMps: 1_400,
    ejectaLifetimeSeconds: 18,
    ejectaHeightM: 72_000,
    ejectaOpacity: 0.7,
    shockwaveRadiusM: 32_000,
    groundShockwaveAngularRadiusRad: 0.0048,
    groundShockwaveOpacity: 0.62,
    atmosphericShockwaveAngularRadiusRad: 0.0062,
    atmosphericShockwaveOpacity: 0.42,
    plumeHeightM: 140_000,
    plumeRadiusM: 24_000,
    plumeOpacity: 0.68,
    plumeCoolingProgress: 0.34,
    hazeOpacity: 0.48,
    cloudScarRadiusM: 0,
    cloudScarGrowthProgress: 0,
    cloudScarOpacity: 0,
    cloudScarAdvectionRad: 0,
    runSignature: 'fixture:42',
    ...overrides,
  });
}
