import {
  Group,
  Vector3,
  type BufferGeometry,
  type Material,
  type Mesh,
  type ShaderMaterial,
} from 'three';

import {
  EARTH_TIDE_DEBUG_BOUNDING_RADIUS_MULTIPLIER,
  EarthTideDebugOverlay,
  evaluateEquilibriumTideP2,
  mapEarthFixedDirectionToEarthVisual,
  type EarthTideDebugMode,
  type EarthTideDebugRenderSample,
} from '../../rendering/tides/EarthTideDebugOverlay';

describe('EarthTideDebugOverlay', () => {
  it('maps Earth-fixed directions exactly and updates both preallocated components', () => {
    const overlay = new EarthTideDebugOverlay();
    const earth = new Group();
    earth.add(overlay.root);
    const diagnosticsIdentity = overlay.getDiagnostics();
    const childrenIdentity = overlay.root.children.slice();

    overlay.update(sample({
      moonDirectionEarthFixed: Object.freeze({ x: 0, y: 4, z: 0 }),
      sunDirectionEarthFixed: Object.freeze({ x: 0, y: 0, z: 2 }),
    }));

    const sublunar = requiredMesh(overlay, 'earth-tide-sublunar-marker');
    const subsolar = requiredMesh(overlay, 'earth-tide-subsolar-marker');
    expect(sublunar.position.x).toBeCloseTo(0, 12);
    expect(sublunar.position.y).toBeCloseTo(0, 12);
    expect(sublunar.position.z).toBeLessThan(-1);
    expect(subsolar.position.x).toBeCloseTo(0, 12);
    expect(subsolar.position.y).toBeGreaterThan(1);
    expect(subsolar.position.z).toBeCloseTo(0, 12);
    expect(overlay.getDiagnostics()).toBe(diagnosticsIdentity);
    expect(overlay.getDiagnostics()).toMatchObject({
      active: true,
      hasValidSample: true,
      mode: 'both',
      lunarVisible: true,
      solarVisible: true,
      lunarVisualX: 0,
      lunarVisualY: 0,
      lunarVisualZ: -1,
      solarVisualX: 0,
      solarVisualY: 1,
      solarVisualZ: 0,
      boundingRadiusMultiplier: EARTH_TIDE_DEBUG_BOUNDING_RADIUS_MULTIPLIER,
    });

    const lunarShell = requiredMesh(overlay, 'earth-tide-lunar-p2-shell');
    const solarShell = requiredMesh(overlay, 'earth-tide-solar-p2-shell');
    expect(lunarShell.geometry).toBe(solarShell.geometry);
    expect((lunarShell.material as ShaderMaterial).vertexShader).toContain(
      '3.0 * cosine * cosine - 1.0',
    );

    overlay.clear();
    overlay.reset();
    expect(overlay.root.children).toEqual(childrenIdentity);
    expect(overlay.root.visible).toBe(false);
    expect(overlay.getDiagnostics()).toMatchObject({
      active: false,
      hasValidSample: false,
      mode: 'off',
      boundingRadiusMultiplier: 1,
    });

    overlay.update(sample());
    expect(overlay.root.children).toEqual(childrenIdentity);
    expect(overlay.getDiagnostics()).toBe(diagnosticsIdentity);
    overlay.dispose();
  });

  it.each<[EarthTideDebugMode, boolean, boolean]>([
    ['off', false, false],
    ['lunar', true, false],
    ['solar', false, true],
    ['both', true, true],
  ])('supports %s mode with independent component visibility', (
    mode,
    lunarVisible,
    solarVisible,
  ) => {
    const overlay = new EarthTideDebugOverlay();
    overlay.update(sample({ mode }));
    expect(overlay.root.visible).toBe(lunarVisible || solarVisible);
    expect(overlay.root.getObjectByName('earth-tide-lunar-component')?.visible)
      .toBe(lunarVisible);
    expect(overlay.root.getObjectByName('earth-tide-solar-component')?.visible)
      .toBe(solarVisible);
    expect(overlay.getDiagnostics()).toMatchObject({
      mode,
      lunarVisible,
      solarVisible,
    });
    overlay.dispose();
  });

  it('exposes the normalized coordinate mapping and symmetric P2 model', () => {
    const target = new Vector3();
    expect(mapEarthFixedDirectionToEarthVisual(target, { x: 5, y: 0, z: 0 }))
      .toBe(target);
    expect(target.toArray()).toEqual([1, 0, 0]);
    mapEarthFixedDirectionToEarthVisual(target, { x: 0, y: 3, z: 0 });
    expect(target.toArray()).toEqual([0, 0, -1]);
    mapEarthFixedDirectionToEarthVisual(target, { x: 0, y: 0, z: 7 });
    expect(target.toArray()).toEqual([0, 1, 0]);

    expect(evaluateEquilibriumTideP2(1)).toBe(1);
    expect(evaluateEquilibriumTideP2(-1)).toBe(1);
    expect(evaluateEquilibriumTideP2(0)).toBe(-0.5);
  });

  it('rejects invalid samples before mutating the visible overlay', () => {
    const overlay = new EarthTideDebugOverlay();
    overlay.update(sample({ mode: 'lunar' }));
    const before = { ...overlay.getDiagnostics() };
    expect(() => overlay.update(sample({ jdTdb: Number.NaN }))).toThrow(/Julian date/);
    expect(() => overlay.update(sample({
      moonDirectionEarthFixed: Object.freeze({ x: 0, y: 0, z: 0 }),
    }))).toThrow(/non-zero/);
    expect(() => overlay.update(sample({ solarAmplitude: 1.01 }))).toThrow(/\[0, 1\]/);
    expect(() => overlay.update(sample({
      mode: 'invalid' as EarthTideDebugMode,
    }))).toThrow(/Unsupported/);
    expect(overlay.getDiagnostics()).toEqual(before);
    overlay.dispose();
  });

  it('detaches and disposes every shared resource exactly once', () => {
    const overlay = new EarthTideDebugOverlay();
    const earth = new Group();
    earth.add(overlay.root);
    const shell = requiredMesh(overlay, 'earth-tide-lunar-p2-shell');
    const marker = requiredMesh(overlay, 'earth-tide-sublunar-marker');
    const geometrySpies = [
      vi.spyOn(shell.geometry, 'dispose'),
      vi.spyOn(marker.geometry, 'dispose'),
    ];
    const materialSpies = overlay.root.children.flatMap((component) =>
      component.children.map((child) =>
        vi.spyOn((child as Mesh<BufferGeometry, Material>).material, 'dispose'),
      ),
    );

    overlay.dispose();
    overlay.dispose();

    expect(overlay.root.parent).toBeNull();
    expect(overlay.root.children).toHaveLength(0);
    geometrySpies.forEach((spy) => { expect(spy).toHaveBeenCalledTimes(1); });
    materialSpies.forEach((spy) => { expect(spy).toHaveBeenCalledTimes(1); });
    expect(() => overlay.update(sample())).toThrow(/disposed/);
  });
});

function requiredMesh(
  overlay: EarthTideDebugOverlay,
  name: string,
): Mesh<BufferGeometry, Material> {
  const mesh = overlay.root.getObjectByName(name) as Mesh<BufferGeometry, Material> | undefined;
  if (mesh === undefined) throw new Error(`Missing test mesh "${name}".`);
  return mesh;
}

function sample(
  overrides: Partial<EarthTideDebugRenderSample> = {},
): Readonly<EarthTideDebugRenderSample> {
  return Object.freeze({
    jdTdb: 2_460_000.5,
    mode: 'both',
    moonDirectionEarthFixed: Object.freeze({ x: 1, y: 0, z: 0 }),
    sunDirectionEarthFixed: Object.freeze({ x: 0, y: 1, z: 0 }),
    lunarAmplitude: 0.82,
    solarAmplitude: 0.37,
    ...overrides,
  });
}
