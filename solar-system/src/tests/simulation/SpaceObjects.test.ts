import { describe, expect, it } from 'vitest';

import {
  EARTH_SATELLITE_DEFINITIONS,
  normalizeOmmRecord,
  normalizeOmmSnapshot,
  sampleEarthSatellite,
  sampleEarthSatelliteOrbitPath,
} from '../../simulation/artificial';
import {
  SPACECRAFT_DEFINITIONS,
  getSpacecraftDefinition,
  nearestSpacecraftCoverageJdTdb,
  sampleSpacecraftTrajectory,
} from '../../simulation/spacecraft';
import { SpaceObjectWorkerRuntime } from '../../workers/space-objects';

describe('Earth satellite OMM boundary', () => {
  it('preserves catalog IDs above five digits and explicit TEME frame metadata', () => {
    const definition = normalizeOmmRecord({
      NORAD_CAT_ID: '123456',
      EPOCH: '2026-08-30T12:00:00.000Z',
      MEAN_MOTION: 15,
      ECCENTRICITY: 0.001,
      INCLINATION: 51,
      RA_OF_ASC_NODE: 10,
      ARG_OF_PERICENTER: 20,
      MEAN_ANOMALY: 30,
    });
    expect(definition.catalogId).toBe('123456');
    expect(definition.provenance[0]?.provider).toBe('CELESTRAK_OMM');
    const state = sampleEarthSatellite(definition, definition.elementEpochJdTdb);
    expect(state.sourceFrame).toBe('TEME');
    expect(state.propagator).toBe('SGP4/SDP4');
    expect(state.propagationStatus).toBe('ok');
  });

  it('skips malformed OMM records without poisoning valid records', () => {
    const result = normalizeOmmSnapshot([
      { NORAD_CAT_ID: '25544', EPOCH: '2026-08-30T12:00:00.000Z', MEAN_MOTION: 15, ECCENTRICITY: 0.001, INCLINATION: 51, RA_OF_ASC_NODE: 10, ARG_OF_PERICENTER: 20, MEAN_ANOMALY: 30 },
      null,
      { NORAD_CAT_ID: 'bad', EPOCH: 'not-a-date', MEAN_MOTION: 0, ECCENTRICITY: 2, INCLINATION: 0, RA_OF_ASC_NODE: 0, ARG_OF_PERICENTER: 0, MEAN_ANOMALY: 0 },
    ]);
    expect(result.definitions).toHaveLength(1);
    expect(result.rejected).toHaveLength(2);
  });

  it('reports stale data outside the hard propagation window', () => {
    const iss = EARTH_SATELLITE_DEFINITIONS[0]!;
    const state = sampleEarthSatellite(iss, iss.elementEpochJdTdb + 365);
    expect(state.dataAgeState).toBe('outside-hard-window');
    expect(state.positionEarthCenteredM).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('matches the satellite.js SGP4 reference state for the bundled ISS fixture', () => {
    const iss = EARTH_SATELLITE_DEFINITIONS[0]!;
    const state = sampleEarthSatellite(iss, iss.elementEpochJdTdb);
    expect(state.propagationStatus).toBe('ok');
    expect(state.positionTemeM.x).toBeCloseTo(-3_869_299.354, 0);
    expect(state.positionTemeM.y).toBeCloseTo(5_587_729.533, 0);
    expect(state.positionTemeM.z).toBeCloseTo(-59_730.352, 0);
    expect(state.velocityTemeMps.x).toBeCloseTo(-3_932.026, 1);
    expect(state.velocityTemeMps.y).toBeCloseTo(-2_670.055, 1);
    expect(state.velocityTemeMps.z).toBeCloseTo(6_008.789, 1);
  });

  it('generates a closed local orbit arc for selected-object framing', () => {
    const iss = EARTH_SATELLITE_DEFINITIONS[0]!;
    const path = sampleEarthSatelliteOrbitPath(iss, iss.elementEpochJdTdb, 32);
    expect(path).toHaveLength(96);
    expect(Math.hypot(path[0]!, path[1]!, path[2]!)).toBeGreaterThan(6_000_000);
    expect(Math.hypot(path[93]!, path[94]!, path[95]!)).toBeGreaterThan(6_000_000);
  });
});

describe('spacecraft trajectories', () => {
  it('keeps mission trajectories separate from Earth-orbit propagation', () => {
    const voyager = getSpacecraftDefinition('voyager-1');
    expect(voyager?.trajectorySource).toBe('JPL_HORIZONS');
    expect(voyager?.trajectoryKind).toBe('open-cruise');
    const state = sampleSpacecraftTrajectory(voyager!, voyager!.validStartJdTdb + 100);
    expect(state.valid).toBe(true);
    expect(state.source).toBe('JPL_HORIZONS');
    expect(state.interpolation).toBe('cubic-hermite');
    expect(state.distanceFromSunM).toBeGreaterThan(0);
  });

  it('provides a valid, visible framing instant for every bundled spacecraft', () => {
    for (const mission of SPACECRAFT_DEFINITIONS) {
      for (const requested of [mission.validStartJdTdb - 10_000, mission.validEndJdTdb + 10_000]) {
        const focusJdTdb = nearestSpacecraftCoverageJdTdb(mission, requested);
        expect(sampleSpacecraftTrajectory(mission, focusJdTdb).valid, mission.id).toBe(true);
      }
    }
  });

  it('hides historical missions outside their declared coverage', () => {
    const cassini = SPACECRAFT_DEFINITIONS.find((mission) => mission.id === 'cassini')!;
    const state = sampleSpacecraftTrajectory(cassini, cassini.validEndJdTdb + 10);
    expect(state.valid).toBe(false);
    expect(state.speedMps).toBe(0);
    const focusJdTdb = nearestSpacecraftCoverageJdTdb(cassini, cassini.validEndJdTdb + 10);
    expect(focusJdTdb).toBeLessThan(cassini.validEndJdTdb);
    expect(sampleSpacecraftTrajectory(cassini, focusJdTdb).valid).toBe(true);
  });

  it('keeps SGP4 work isolated without duplicating the Horizons bundle in the worker', () => {
    const runtime = new SpaceObjectWorkerRuntime();
    const response = runtime.handle({ type: 'space-objects/sample', requestId: 'test-1', jdTdb: 2_451_545, spacecraftIds: ['voyager-1'] });
    expect(response.type).toBe('space-objects/result');
    if (response.type !== 'space-objects/result') return;
    expect(response.earthSatellites).toHaveLength(EARTH_SATELLITE_DEFINITIONS.length);
    expect(response.spacecraft).toHaveLength(0);
  });
});
