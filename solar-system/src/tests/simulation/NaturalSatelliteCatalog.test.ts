import { describe, expect, it } from 'vitest';

import {
  getNaturalSatelliteDefinition,
  getNaturalSatellitesByParent,
  NATURAL_SATELLITE_CATALOG_METADATA,
  validateNaturalSatelliteCatalog,
} from '../../simulation/satellites';
import {
  composeNaturalSatelliteState,
  isNaturalSatelliteInParentShadow,
  sampleNaturalSatellite,
} from '../../simulation/satellites';

describe('natural satellite catalog', () => {
  it('matches the dated snapshot counts without loading zero vectors', () => {
    const metadata = validateNaturalSatelliteCatalog();
    expect(metadata.generatedCountsByParent).toEqual(metadata.expectedCountsByParent);
    expect(getNaturalSatellitesByParent('jupiter').length).toBe(115);
    expect(getNaturalSatellitesByParent('saturn').length).toBe(293);
    expect(getNaturalSatellitesByParent('uranus').length).toBe(29);
    expect(getNaturalSatellitesByParent('neptune').length).toBe(16);
    for (const parentId of Object.keys(metadata.expectedCountsByParent)) {
      for (const satellite of getNaturalSatellitesByParent(parentId)) {
        const state = sampleNaturalSatellite(satellite, 2_451_545);
        expect(Math.hypot(state.positionM.x, state.positionM.y, state.positionM.z)).toBeGreaterThan(0);
      }
    }
  });

  it('contains the required major systems and flags retrograde Triton', () => {
    expect(getNaturalSatelliteDefinition('io')?.tier).toBe('major');
    expect(getNaturalSatelliteDefinition('callisto')?.parentId).toBe('jupiter');
    expect(getNaturalSatelliteDefinition('triton')?.retrograde).toBe(true);
    expect(getNaturalSatelliteDefinition('moon')?.synchronous).toBe(true);
    expect(NATURAL_SATELLITE_CATALOG_METADATA.officialSnapshotDateUtc).toBe('2026-08-31');
  });

  it('composes parent-centered state without incremental drift', () => {
    const moon = getNaturalSatelliteDefinition('moon');
    expect(moon).toBeDefined();
    const parent = {
      bodyId: 'earth',
      jdTdb: 2_451_545,
      positionM: { x: 1e11, y: -2e11, z: 3e10 },
      velocityMps: { x: 12_000, y: -4_000, z: 500 },
      orientation: [0, 0, 0, 1] as const,
      visible: true,
    };
    const state = composeNaturalSatelliteState(moon!, parent, 2_451_545);
    expect(state.heliocentricPositionM.x - parent.positionM.x).toBeCloseTo(state.positionM.x, 5);
    expect(state.heliocentricVelocityMps.y - parent.velocityMps.y).toBeCloseTo(state.velocityMps.y, 6);
  });

  it('uses JPL parent-centered anchors inside their declared interval', () => {
    const io = getNaturalSatelliteDefinition('io');
    expect(io).toBeDefined();
    const state = sampleNaturalSatellite(io!, 2_451_545);
    expect(state.source).toBe('JPL_HORIZONS_ANCHORED');
    expect(state.insideAnchorCoverage).toBe(true);
  });

  it('detects the parent umbra in the anti-solar half-space', () => {
    const moon = getNaturalSatelliteDefinition('moon');
    expect(moon).toBeDefined();
    const state = sampleNaturalSatellite(moon!, 2_451_545);
    const sunDirection = {
      x: -state.positionM.x,
      y: -state.positionM.y,
      z: -state.positionM.z,
    };
    expect(isNaturalSatelliteInParentShadow(state, 6_371_008.4, sunDirection)).toBe(true);
    expect(isNaturalSatelliteInParentShadow(state, 6_371_008.4, state.positionM)).toBe(false);
  });
});
