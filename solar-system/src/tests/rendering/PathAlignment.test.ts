import { NaturalSatelliteVisualSystem } from '../../rendering/satellites/NaturalSatelliteVisualSystem';
import { TrueRenderScale } from '../../rendering/TrueRenderScale';
import { PrecisionLine } from '../../rendering/PrecisionPath';
import { PerspectiveCamera, Vector3 } from 'three';
import { PrecisionPath } from '../../rendering/PrecisionPath';
import { writeEpochAnchoredPath } from '../../rendering/EpochAnchoredPath';
import { sampleEpochsThroughCurrent } from '../../simulation/core/PathSampling';
import { SPACECRAFT_DEFINITIONS, sampleSpacecraftTrajectory, sampleSpacecraftTrajectoryPath } from '../../simulation/spacecraft';
import { EARTH_SATELLITE_DEFINITIONS, sampleEarthSatellite, sampleEarthSatelliteOrbitPath } from '../../simulation/artificial';
import { getNaturalSatellitesByParent, sampleNaturalSatellite, sampleNaturalSatelliteOrbit } from '../../simulation/satellites';
import { SpaceObjectVisualSystem } from '../../rendering/spaceobjects/SpaceObjectVisualSystem';
import type { SpaceObjectWorkerResultResponse } from '../../workers/space-objects';

function vertexGap(path: Float64Array, p: { x: number; y: number; z: number }): number {
  let gap = Infinity;
  for (let i = 0; i < path.length; i += 3) {
    if (Number.isFinite(path[i])) gap = Math.min(gap, Math.hypot(path[i]! - p.x, path[i + 1]! - p.y, path[i + 2]! - p.z));
  }
  return gap;
}

describe('same-epoch path attachment', () => {
  it('retains both coverage edges and the exact epoch in even sample counts', () => {
    for (const now of [1, 1.000001, 4.12345, 10]) {
      const epochs = sampleEpochsThroughCurrent(1, 10, now, 128);
      expect(epochs[0]).toBe(1);
      expect(epochs[127]).toBe(10);
      expect([...epochs]).toContain(now);
      expect([...epochs]).toEqual([...epochs].sort((a, b) => a - b));
    }
  });

  for (const mission of SPACECRAFT_DEFINITIONS) {
    it('attaches the ' + mission.id + ' path at coverage edges and between source samples', () => {
      for (const fraction of [0, 0.1234567, 0.5, 0.999999, 1]) {
        const jd = mission.validStartJdTdb + (mission.validEndJdTdb - mission.validStartJdTdb) * fraction;
        const path = sampleSpacecraftTrajectoryPath(mission, jd);
        expect(vertexGap(path, sampleSpacecraftTrajectory(mission, jd).positionM)).toBe(0);
        expect([...path].every(Number.isFinite)).toBe(true);
      }
    });
  }

  for (const satellite of EARTH_SATELLITE_DEFINITIONS) {
    it('attaches ' + satellite.id + ' without drawing invalid OMM samples to the Earth centre', () => {
      for (const days of [-satellite.hardMaximumWindowDays, -0.003456, 0, 0.023456, satellite.hardMaximumWindowDays]) {
        const jd = satellite.elementEpochJdTdb + days;
        const path = sampleEarthSatelliteOrbitPath(satellite, jd);
        const current = sampleEarthSatellite(satellite, jd);
        if (current.propagationStatus === 'ok') expect(vertexGap(path, current.positionEarthCenteredM)).toBe(0);
        for (let i = 0; i < path.length; i += 3) {
          if (Number.isFinite(path[i])) expect(Math.hypot(path[i]!, path[i + 1]!, path[i + 2]!)).toBeGreaterThan(6e6);
        }
      }
    });
  }

  const moons = ['mars', 'jupiter', 'saturn', 'uranus', 'neptune'].flatMap(parent => getNaturalSatellitesByParent(parent).filter(moon => moon.tier === 'major'));
  for (const moon of moons) {
    it('attaches the parent-relative orbit of ' + moon.id, () => {
      for (const jd of [2451545.123456, 2459000.765432, 2488068.3]) {
        expect(vertexGap(sampleNaturalSatelliteOrbit(moon, jd), sampleNaturalSatellite(moon, jd).positionM)).toBe(0);
      }
    });
  }

  it('rejects an otherwise valid but older worker position during forward and reverse playback', () => {
    const system = new SpaceObjectVisualSystem();
    const satellite = EARTH_SATELLITE_DEFINITIONS[0]!;
    const jd = satellite.elementEpochJdTdb;
    const access = system as unknown as {
      workerResult: SpaceObjectWorkerResultResponse;
      earthSatelliteState: (satellite: typeof EARTH_SATELLITE_DEFINITIONS[number], jd: number) => ReturnType<typeof sampleEarthSatellite>;
    };
    for (const lag of [-0.01, 0.01]) {
      access.workerResult = { type: 'space-objects/result', requestId: 'delayed', jdTdb: jd + lag, spacecraft: [], earthSatellites: [{ id: satellite.id, positionM: [1, 2, 3], velocityMps: [0, 0, 0], dataAgeDays: 0, dataAgeState: 'fresh', propagationStatus: 'ok', propagationError: null }] };
      expect(access.earthSatelliteState(satellite, jd).positionEarthCenteredM).toEqual(sampleEarthSatellite(satellite, jd).positionEarthCenteredM);
    }
    system.dispose();
  });
});

describe('cached ephemeris paths', () => {
  const source = new Float64Array([0, 0, 0, 10, 0, 0, 20, 0, 0]);
  const epochs = new Float64Array([1, 2, 3]);
  it('inserts the actual curved state into an orbit without replacing an unrelated branch', () => {
    const output = new Float64Array(12);
    const count = writeEpochAnchoredPath(output, source, epochs, 1.5, { x: 5, y: 2, z: 0 });
    expect(count).toBe(4);
    expect([...output]).toEqual([0, 0, 0, 5, 2, 0, 10, 0, 0, 20, 0, 0]);
    expect(writeEpochAnchoredPath(output, source, epochs, 4, { x: 40, y: 0, z: 0 })).toBe(3);
  });
  it('trims stale history/future tails as the clock crosses cached samples in either direction', () => {
    for (const now of [1.5, 2.5, 3.5, 2.2, 0.5]) {
      for (const direction of ['previous', 'next'] as const) {
        const output = new Float64Array(12);
        const current = { x: now * 10, y: 2, z: 0 };
        const count = writeEpochAnchoredPath(output, source, epochs, now, current, direction);
        const endpoint = direction === 'previous' ? (count - 1) * 3 : 0;
        expect([...output.subarray(endpoint, endpoint + 3)]).toEqual([current.x, 2, 0]);
        expect(count).toBe(1 + [...epochs].filter(t => direction === 'previous' ? t < now : t > now).length);
      }
    }
  });
});

describe('camera-space line precision', () => {
  it('retains a metre-sized view at 200 AU while zooming and orbiting through very long segments', () => {
    const unit = 149597870700;
    const path = new PrecisionPath(3);
    path.anchor.set(180, 20, -80);
    path.positions.set([-5, -3, -8, 0, 0, 0, 5, 3, 8]);
    for (const distance of [5, 10, 40, 1000, 1e7]) {
      for (const angle of [0, 0.6, 1.5, 3]) {
        const camera = new PerspectiveCamera(50, 1.6, distance / unit / 100, 1000);
        camera.position.copy(path.anchor).add(new Vector3(Math.sin(angle), 0.2, Math.cos(angle)).normalize().multiplyScalar(distance / unit));
        camera.lookAt(path.anchor);
        camera.updateMatrixWorld(true);
        const count = path.prepare(camera);
        expect(count).toBe(2);
        const positions = path.segments.subarray(0, count * 6);
        expect([...positions].every(Number.isFinite)).toBe(true);
        // The shared current-position vertex must project to the same subpixel point.
        for (const i of [3, 6]) {
          const v = new Vector3(positions[i]!, positions[i + 1]!, positions[i + 2]!).applyMatrix4(camera.projectionMatrix);
          expect(Math.abs(v.x)).toBeLessThan(0.002);
          expect(Math.abs(v.y)).toBeLessThan(0.002);
        }
      }
    }
  });
  it('clips behind-camera and invalid segments before the GPU sees them', () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    camera.updateMatrixWorld(true);
    const path = new PrecisionPath(5);
    path.positions.set([0, 0, 5, 0, 0, -10, NaN, NaN, NaN, 0, 0, -20, 1, 0, -30]);
    expect(path.prepare(camera)).toBe(2);
    expect(path.segments[2]).toBeCloseTo(-0.1, 6);
  });
});


it('renders a full sampled period of Nereid and Phoebe instead of a 35% arc', () => {
  const system = new NaturalSatelliteVisualSystem();
  const scale = new TrueRenderScale();
  const zero = { x: 0, y: 0, z: 0 }, jd = 2461322.123456;
  try {
    for (const parentId of ['saturn', 'neptune']) {
      system.updateFrame({ currentJdTdb: jd, originM: zero, originRevision: 0, trails: [], bodies: [
        { bodyId: parentId, displayName: parentId, kind: 'planet', meanRadiusM: 25e6, positionM: zero, velocityMps: zero, visible: true },
      ] }, scale, zero, parentId);
      const id = parentId === 'saturn' ? 'phoebe' : 'nereid';
      const definition = getNaturalSatellitesByParent(parentId).find(moon => moon.id === id)!;
      const orbit = system.root.getObjectByName(`natural-satellite-orbit-${id}`) as PrecisionLine;
      const start = sampleNaturalSatellite(definition, jd - definition.orbitalPeriodSeconds / 172800).positionM;
      const end = sampleNaturalSatellite(definition, jd + definition.orbitalPeriodSeconds / 172800).positionM;
      expect(orbit.visible).toBe(true);
      const points = orbit.path.positions;
      for (const [index, expected] of [[0, start], [orbit.path.pointCount - 1, end]] as const) {
        const actual = new Vector3(points[index * 3], points[index * 3 + 1], points[index * 3 + 2]).add(orbit.path.anchor).multiplyScalar(scale.metersPerRenderUnit);
        expect(actual.distanceTo(new Vector3(expected.x, expected.z, -expected.y))).toBeLessThan(0.01);
      }
    }
  } finally { system.dispose(); }
});
