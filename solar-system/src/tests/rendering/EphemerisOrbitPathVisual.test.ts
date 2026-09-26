import { Color, Vector2 } from 'three';

import {
  applyEphemerisOrbitPathRole,
  calculateEphemerisOrbitPathPresentation,
  createEphemerisOrbitPath,
  disposeEphemerisOrbitPath,
  resolveEphemerisOrbitPathEmphasis,
  setEphemerisOrbitPathResolution,
  syncEphemerisOrbitPathGeometry,
} from '../../rendering/EphemerisOrbitPathVisual';

describe('ephemeris orbit path visual', () => {
  it('builds a single Line2 stroke per path', () => {
    const positionsM = new Float64Array([0, 0, 0, 1, 0, 0, 2, 0.5, 0]);
    const resources = createEphemerisOrbitPath(
      { bodyId: 'earth', kind: 'orbit', positionsM },
      new Color(0x55a9ff),
      new Vector2(1440, 900),
    );

    expect(resources.spinePointCount).toBe(3);
    expect(resources.root.children).toHaveLength(1);
    expect(resources.core.material.transparent).toBe(true);
    expect(resources.core.material.depthWrite).toBe(false);
    expect(resources.core.isLine2).toBe(true);

    disposeEphemerisOrbitPath(resources);
  });

  it('emphasizes selected and system paths above background orbits', () => {
    const selected = calculateEphemerisOrbitPathPresentation({
      kind: 'orbit',
      emphasis: 'selected',
    });
    const system = calculateEphemerisOrbitPathPresentation({
      kind: 'orbit',
      emphasis: 'system',
    });
    const background = calculateEphemerisOrbitPathPresentation({
      kind: 'orbit',
      emphasis: 'background',
    });
    const trail = calculateEphemerisOrbitPathPresentation({
      kind: 'trail',
      emphasis: 'selected',
    });

    expect(selected.opacity).toBeGreaterThan(system.opacity);
    expect(system.opacity).toBeGreaterThan(background.opacity);
    expect(selected.widthPx).toBeGreaterThan(background.widthPx);
    expect(trail.opacity).toBeGreaterThan(selected.opacity);
  });

  it('resolves sun selection as system emphasis for planet orbits only', () => {
    expect(resolveEphemerisOrbitPathEmphasis('earth', 'earth', 'orbit')).toBe('selected');
    expect(resolveEphemerisOrbitPathEmphasis('earth', 'sun', 'orbit')).toBe('system');
    expect(resolveEphemerisOrbitPathEmphasis('1p-halley', 'sun', 'orbit')).toBe(
      'background',
    );
    expect(resolveEphemerisOrbitPathEmphasis('mars', 'earth', 'orbit')).toBe('background');
  });

  it('uploads camera-relative positions and selection linewidths', () => {
    const positionsM = new Float64Array([0, 0, 0, 4, 0, 0]);
    const resources = createEphemerisOrbitPath(
      { bodyId: 'mars', kind: 'trail', positionsM, centerBodyId: 'sun' },
      new Color(0xd86e4a),
      new Vector2(800, 600),
    );

    resources.mappedPositions.set([0, 0, 0, 1, 0.25, -0.5]);
    resources.mappedColors.set([1, 0.4, 0.2, 0.4, 0.2, 0.1]);
    syncEphemerisOrbitPathGeometry(resources);
    applyEphemerisOrbitPathRole(resources, { kind: 'trail', emphasis: 'selected' });
    setEphemerisOrbitPathResolution(resources, 1280, 720);

    expect(resources.core.material.opacity).toBeCloseTo(0.82, 5);
    expect(resources.core.material.linewidth).toBeCloseTo(2.8, 5);
    expect(resources.core.material.resolution.x).toBe(1280);

    disposeEphemerisOrbitPath(resources);
  });
});
