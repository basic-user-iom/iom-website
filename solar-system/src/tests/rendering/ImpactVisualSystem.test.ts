import {
  Group,
  type Mesh,
  type Points,
  type MeshStandardMaterial,
  type BufferGeometry,
  type Line,
  type LineBasicMaterial,
  type ShaderMaterial,
} from 'three';

import {
  ImpactVisualSystem,
  resolveImpactCameraPose,
  type ImpactCameraPresetId,
  type ImpactRenderState,
} from '../../rendering/impact';

describe('ImpactVisualSystem', () => {
  it('renders deterministic water and steam, suppresses land effects, and clears on reset', () => {
    const system = new ImpactVisualSystem('high');
    const event = state({ outcomeKind: 'ocean-surface-impact', eventElapsedSeconds: 3,
      earthSurface: { kind: 'ocean', elevationM: -4000, surfaceAltitudeM: 0, waterDepthM: 4000, coastal: false }, aftermathKind: 'none' });
    system.update(event);
    const water = system.root.getObjectByName('impact-water-column-and-crown') as Mesh<BufferGeometry, ShaderMaterial>;
    const waves = system.root.getObjectByName('impact-ocean-wave-train')!;
    const steam = system.root.getObjectByName('impact-layered-volumetric-plume') as Mesh<BufferGeometry, ShaderMaterial>;
    expect(water.visible).toBe(true); expect(waves.visible).toBe(true);
    expect(steam.material.uniforms.uProfile!.value).toBe(2);
    expect(system.getDiagnostics().craterVisible).toBe(false);
    expect(system.getDiagnostics().ejectaActiveCount).toBe(0);
    expect(system.getDiagnostics().groundShockwaveVisible).toBe(false);
    const positions = Array.from(water.geometry.getAttribute('position').array);
    system.update({ ...event, lifecycleState: 'paused' });
    expect(Array.from(water.geometry.getAttribute('position').array)).toEqual(positions);
    system.reset(); expect(water.visible).toBe(false); expect(waves.visible).toBe(false);
    system.update(event); expect(Array.from(water.geometry.getAttribute('position').array)).toEqual(positions);
    system.update({ ...event, lifecycleState: 'complete' }); expect(waves.visible).toBe(true); // The water surface must continue to cover the excavated globe.
    system.update({ ...event, outcomeKind: 'airburst' }); expect(water.visible).toBe(false);
    system.dispose();
  });
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
      fragmentCount: 0,
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


  it('grows spatial dust during ejecta and freezes the cloud when playback is paused', () => {
    const system = new ImpactVisualSystem('medium');
    const event = state({ stage: 'ejecta', eventElapsedSeconds: 3 });
    system.update(event);
    expect(system.getDiagnostics().plumeVisible).toBe(true);
    const cloud = system.root.getObjectByName('impact-layered-volumetric-plume') as Mesh<BufferGeometry, ShaderMaterial>;
    const centers = pointPositions(system, cloud.name);
    // A spatial cloud must extend in both surface-tangent directions.
    const ys = centers.filter((_, i) => i % 3 === 1);
    const zs = centers.filter((_, i) => i % 3 === 2);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.001);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(0.001);
    expect(cloud.geometry.drawRange.count).toBe(64 * 6);
    system.update({ ...event, lifecycleState: 'paused' });
    expect(pointPositions(system, cloud.name)).toEqual(centers);
    expect(cloud.material.uniforms.uTime?.value).toBe(3);
    system.reset();
    expect(cloud.visible).toBe(false);
    system.update(event);
    expect(pointPositions(system, cloud.name)).toEqual(centers);
    system.dispose();
  });

  it('places the visible airburst fireball at altitude and clears it on reset', () => {
    const system = new ImpactVisualSystem('high');
    system.update(state({
      stage: 'airburst',
      outcomeKind: 'airburst',
      impactorLocalEnuM: { eastM: 0, northM: 0, upM: 30_000 },
    }));
    const fireball = system.root.getObjectByName('impact-expanding-fireball')!;
    const light = system.root.getObjectByName('impact-bounded-flash-light')!;
    expect(fireball.visible).toBe(true);
    expect(fireball.position.toArray()).toEqual(light.position.toArray());
    expect(fireball.position.length()).toBeGreaterThan(1.004);
    expect(fireball.scale.x).toBeGreaterThan(0);
    system.reset();
    expect(fireball.visible).toBe(false);
    system.dispose();
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
      | Mesh<BufferGeometry, ShaderMaterial>
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
      | Mesh<BufferGeometry, ShaderMaterial>
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
    expect(impactor.material.type).toBe('MeshBasicMaterial');
    expect(impactor.material.vertexColors).toBe(true);
    expect(impactor.material.toneMapped).toBe(false);
    const surfaceColors = Array.from(
      impactor.geometry.getAttribute('color').array as Float32Array,
    );
    expect(new Set(surfaceColors.map((value) => value.toFixed(5))).size).toBeGreaterThan(8);
    expect(bowShock.material.uniforms.uOpacity?.value).toBeGreaterThan(0);
    expect(plasma.material.uniforms.uPlasma?.value).toBe(1);
    expect(bowShock.material.fragmentShader).toContain('float shell');
    expect(system.getDiagnostics().impactorSizeExaggerated).toBe(false);

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
    expect(impactor.material.type).toBe('MeshBasicMaterial');
    // Leading-face ablation: windward vertices glow; lee face stays dark rock/metal.
    const heatedColors = Array.from(
      impactor.geometry.getAttribute('color').array as Float32Array,
    );
    expect(Math.max(...heatedColors)).toBeGreaterThan(0.55);
    expect(Math.max(...heatedColors) - Math.min(...heatedColors)).toBeGreaterThan(0.25);

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

  it('heats only the windward face during entry and keeps lee-side rock dark', () => {
    const system = new ImpactVisualSystem('high');
    const impactor = system.root.getObjectByName('impact-impactor') as
      | Mesh<BufferGeometry, MeshStandardMaterial>
      | undefined;
    expect(impactor).toBeDefined();
    if (impactor === undefined) throw new Error('Missing impactor mesh.');

    system.update(state({
      stage: 'atmospheric-entry',
      impactorMaterial: 'stone',
      normalizedHeating: 0.95,
      normalizedDynamicPressure: 0.8,
    }));

    const colors = impactor.geometry.getAttribute('color').array as Float32Array;
    let maxLuma = 0;
    let minLuma = 1;
    for (let offset = 0; offset < colors.length; offset += 3) {
      const luma = (colors[offset] ?? 0) * 0.4
        + (colors[offset + 1] ?? 0) * 0.45
        + (colors[offset + 2] ?? 0) * 0.15;
      maxLuma = Math.max(maxLuma, luma);
      minLuma = Math.min(minLuma, luma);
    }

    expect(maxLuma).toBeGreaterThan(0.55);
    expect(maxLuma - minLuma).toBeGreaterThan(0.18);
    expect(impactor.material.type).toBe('MeshBasicMaterial');
    expect(system.getDiagnostics()).toMatchObject({
      bowShockVisible: true,
      plasmaVisible: true,
      entryTrailVisible: true,
      impactorVisible: true,
      velocityAlignmentDot: expect.any(Number),
    });
    expect(system.getDiagnostics().velocityAlignmentDot).toBeGreaterThan(0.98);
    system.dispose();
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
      flashVisible: false,
      flashLightVisible: false,
      craterVisible: true,
      craterPersistent: true,
      groundShockwaveVisible: true,
      atmosphericShockwaveVisible: true,
      shockwaveSurfaceConforming: true,
      plumeVisible: true,
      plumeLayerCount: 1,
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
    expect(diagnostics.activeObjectCount).toBeGreaterThanOrEqual(4);

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
      'impact-expanding-fireball',
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

  it('keeps the chase camera outside the drawn impactor and aimed at it', () => {
    const event = state({
      stage: 'atmospheric-entry',
      physicalDiameterM: 80,
      targetRadiusM: 6_371_008.4,
    });
    const pose = resolveImpactCameraPose('chase', event);
    const radiusM = event.targetRadiusM;
    const impactor = event.impactorLocalEnuM;
    if (impactor === null) throw new Error('Fixture impactor position is missing.');
    const body = {
      x: 1 + impactor.upM / radiusM,
      y: impactor.northM / radiusM,
      z: impactor.eastM / radiusM,
    };
    const cameraDistance = Math.hypot(
      pose.position.x - body.x,
      pose.position.y - body.y,
      pose.position.z - body.z,
    );
    const visualRadius = event.physicalDiameterM * 0.5 / radiusM;
    expect(cameraDistance).toBeGreaterThan(visualRadius * 4);
    expect(cameraDistance).toBeLessThan(visualRadius * 12);
    const lookDistance = Math.hypot(
      pose.target.x - body.x,
      pose.target.y - body.y,
      pose.target.z - body.z,
    );
    expect(lookDistance).toBeLessThan(visualRadius * 4);
  });

  it('frames plume chase with surface-up so the column rises on screen', () => {
    const event = state({
      stage: 'plume',
      eventElapsedSeconds: 48,
      plumeHeightM: 780_000,
      plumeRadiusM: 240_000,
      plumeOpacity: 0.72,
      flashIntensity: 0,
    });
    const pose = resolveImpactCameraPose('chase', event, 16);
    // Normal is +X in the fixture body frame → camera up should stay near +X.
    expect(pose.up.x).toBeGreaterThan(0.85);
    expect(Math.abs(pose.up.y)).toBeLessThan(0.35);
    expect(Math.abs(pose.up.z)).toBeLessThan(0.35);
    // Aim mid-column above the surface, not along the limb horizon.
    expect(pose.target.x).toBeGreaterThan(1.002);
    expect(pose.position.x).toBeGreaterThan(1);
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
    expect(localDistanceFromImpact).toBeGreaterThan(0);
    expect((Math.hypot(localPose.position.x,localPose.position.y,localPose.position.z)-1)*localEvent.targetRadiusM).toBeCloseTo(2,5);
    expect(localDistanceFromImpact).toBeLessThan(0.15);
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
    expect(enhancedDistanceFromImpact).toBeCloseTo(localDistanceFromImpact,12);
    expect(resolveImpactCameraPose('ground-observer',{...localEvent,plumeHeightM:100000} ).position).toEqual(localPose.position);
  });
});

function pointPositions(system: ImpactVisualSystem, name: string): readonly number[] {
  const object = system.root.getObjectByName(name) as
    | { geometry: BufferGeometry; userData: { ballisticSampleCount?: number } }
    | undefined;
  if (object === undefined) throw new Error(`Missing test points "${name}".`);
  const sampleAttribute = object.geometry.getAttribute('aBallisticCenter');
  const positionAttribute = sampleAttribute ?? object.geometry.getAttribute('position');
  if (positionAttribute === undefined) {
    throw new Error(`Missing position attribute on "${name}".`);
  }
  const count = object.userData.ballisticSampleCount
    ?? (sampleAttribute !== undefined ? sampleAttribute.count : object.geometry.drawRange.count);
  const values = positionAttribute.array as Float32Array;
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

it('keeps airborne plume, pressure wave and camera anchored above the burst', () => {
  const system = new ImpactVisualSystem('high');
  const event = state({ stage: 'plume', outcomeKind: 'airburst', eventElapsedSeconds: 3,
    impactorLocalEnuM: { eastM: 0, northM: 0, upM: 30_000 },
    plumeHeightM: 1_000, plumeRadiusM: 400, craterRadiusM: 0, craterFormationProgress: 0,
    ejectaOpacity: 0, groundShockwaveOpacity: 0, flashIntensity: 0 });
  system.update(event);
  const centers = pointPositions(system, 'impact-layered-volumetric-plume');
  expect(Math.min(...centers.filter((_, i) => i % 3 === 0))).toBeGreaterThan(1 + 30_000 / event.targetRadiusM);
  const wave = system.root.getObjectByName('impact-curved-atmospheric-shockwave')!;
  expect(wave.visible).toBe(true);
  expect(wave.position.x).toBeCloseTo(1 + 30_000 / event.targetRadiusM, 8);
  expect(system.getDiagnostics().groundShockwaveVisible).toBe(false);
  for (const preset of ['chase', 'ground-observer'] as const) {
    const pose = resolveImpactCameraPose(preset, event);
    expect(pose.target.x).toBeGreaterThan(1 + 30_000 / event.targetRadiusM);
    if(preset==='chase')expect(pose.position.x).toBeGreaterThan(pose.target.x);
    else expect((Math.hypot(pose.position.x,pose.position.y,pose.position.z)-1)*event.targetRadiusM).toBeCloseTo(2,5);
  }
  system.dispose();
});
it('reports the actual world-space impactor radius for entry clipping', () => {
  const system = new ImpactVisualSystem('high');
  const target = new Group();
  target.scale.setScalar(0.00004);
  system.attachToTarget(target);
  system.update(state({ stage: 'entry', eventElapsedSeconds: null }));
  const impactor = system.root.getObjectByName('impact-impactor')!;
  expect(system.getImpactorClipSphere()?.radius).toBeCloseTo(impactor.scale.x * target.scale.x, 14);
  system.dispose();
});
it('keeps a ground wave attached to an oblate rocky target',()=>{
  const system=new ImpactVisualSystem('high');
  const event=state({targetBodyId:'mars',targetRadiusM:3000000,targetEquatorialRadiusM:3100000,
    targetPolarRadiusM:2900000,stage:'ejecta',eventElapsedSeconds:3,craterFormationProgress:0});
  system.update(event);
  const mesh=system.root.getObjectByName('impact-curved-ground-shockwave') as Mesh<BufferGeometry,ShaderMaterial>;
  expect(mesh.visible).toBe(true);
  const p=mesh.geometry.getAttribute('position');
  for(let i=0;i<p.count;i+=17){
    const radius=Math.sqrt((p.getX(i)**2+p.getZ(i)**2)/(31/30)**2+p.getY(i)**2/(29/30)**2);
    expect(radius).toBeGreaterThan(1);
    expect(radius).toBeLessThan(1.000005);
  }
  system.dispose();
});

it('reduces ocean draw work at low quality without changing physical water dimensions',()=>{
  const system=new ImpactVisualSystem('high');
  const event=state({outcomeKind:'ocean-surface-impact',eventElapsedSeconds:3,
    earthSurface:{kind:'ocean',elevationM:-4000,surfaceAltitudeM:0,waterDepthM:4000,coastal:false}});
  system.update(event);
  const mesh=system.root.getObjectByName('impact-ocean-wave-train') as Mesh<BufferGeometry,ShaderMaterial>;
  const highCount=mesh.geometry.getIndex()!.count,cavity=mesh.material.uniforms.uCavity!.value;
  system.setQuality('low');system.update(event);
  expect(mesh.geometry.getIndex()!.count).toBeLessThan(highCount/3);
  expect(mesh.material.uniforms.uCavity!.value).toBe(cavity);
  system.dispose();
});

it('pulls the terminal camera back on a portrait viewport while keeping the event target', () => {
  const event = state({ stage:'plume', outcomeKind:'airburst', eventElapsedSeconds:10 });
  const wide = resolveImpactCameraPose('chase', event, 1, 16/9);
  const portrait = resolveImpactCameraPose('chase', event, 1, 390/844);
  expect(portrait.target).toEqual(wide.target);
  const distance = (pose: typeof wide) => Math.hypot(pose.position.x-pose.target.x,
    pose.position.y-pose.target.y,pose.position.z-pose.target.z);
  expect(distance(portrait)).toBeGreaterThan(distance(wide)*1.5);
  expect(resolveImpactCameraPose('ground-observer',event,1,390/844).position)
    .toEqual(resolveImpactCameraPose('ground-observer',event,1,16/9).position);
});

it('keeps the regional event camera above the ocean instead of using the distant ground observer', () => {
  const event = state({stage:'plume', outcomeKind:'ocean-surface-impact', eventElapsedSeconds:10,
    physicalDiameterM:1000, visibilityReferenceSizeM:392381, plumeHeightM:45000, plumeRadiusM:18000,
    earthSurface:{kind:'ocean',elevationM:-4642,surfaceAltitudeM:0,waterDepthM:4642,coastal:false}});
  for(const multiplier of [1, 4]) {
    const regional=resolveImpactCameraPose('regional',event,multiplier);
    const altitude=(Math.hypot(regional.position.x,regional.position.y,regional.position.z)-1)*event.targetRadiusM;
    expect(altitude).toBeGreaterThan(10000);
    expect(regional.position.x).toBeGreaterThan(regional.target.x);
  }
  const ground=resolveImpactCameraPose('ground-observer',event);
  const groundRadius = Math.hypot(ground.position.x,ground.position.y,ground.position.z);
  expect((groundRadius-1)*event.targetRadiusM).toBeCloseTo(2,5);
  const normal = event.impactNormalBodyLocal;
  const distanceM = Math.acos((ground.position.x*normal.x+ground.position.y*normal.y+ground.position.z*normal.z)/groundRadius)*event.targetRadiusM;
  expect(distanceM).toBeLessThan(250000);
  expect(distanceM).toBeGreaterThan(50000);
  const targetHeightM = (ground.target.x*normal.x+ground.target.y*normal.y+ground.target.z*normal.z-1)*event.targetRadiusM;
  expect(targetHeightM).toBeLessThan(30000);
});
