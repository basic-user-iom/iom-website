import type { DataProvenance } from '../../simulation/bodies/DataProvenance';
import { ASTRONOMICAL_UNIT_M, SECONDS_PER_DAY } from '../../simulation/core/Units';
import { EphemerisBodyNotFoundError, EphemerisOutOfRangeError } from '../../simulation/ephemeris/EphemerisErrors';
import type { EphemerisProvider } from '../../simulation/ephemeris/EphemerisProvider';
import type {
  EphemerisCoverage,
  EphemerisStateVector,
} from '../../simulation/ephemeris/EphemerisTypes';
import {
  cometActivityAtDistance,
  qualityTailPointBudget,
  sampleCometTail,
  type CometActivityProfile,
} from '../../rendering/comets/CometTailDynamics';

const EPOCH_JD_TDB = 2_460_000;
const PROFILE: CometActivityProfile = Object.freeze({
  onsetDistanceAu: 4,
  peakDistanceAu: 1,
  comaRadiusKm: 50_000,
  ionTailLengthAu: 0.3,
  dustTailAgeDays: 90,
  dustRadiationPressureBeta: 0.08,
  dustEjectionSpeedMps: 35,
  deterministicSeed: 0x67_50_36,
});

describe('CometTailDynamics', () => {
  it('keeps the ion tail anti-solar and reconstructs deterministic dust history', () => {
    const provider = new CircularCometProvider();
    const first = sampleCometTail(provider, '67p', EPOCH_JD_TDB, PROFILE, { quality: 'low' });
    sampleCometTail(provider, '67p', EPOCH_JD_TDB + 10, PROFILE, { quality: 'low' });
    const replay = sampleCometTail(provider, '67p', EPOCH_JD_TDB, PROFILE, { quality: 'low' });
    const budget = qualityTailPointBudget('low');

    expect(first.ionDirection.x).toBeCloseTo(1, 12);
    expect(first.ionDirection.y).toBeCloseTo(0, 12);
    expect(first.ionDirection.z).toBeCloseTo(0, 12);
    expect(first.ionPositionsM).toHaveLength(budget.ion * 3);
    expect(first.dustPositionsM).toHaveLength(budget.dust * 3);
    expect([...replay.ionPositionsM]).toEqual([...first.ionPositionsM]);
    expect([...replay.dustPositionsM]).toEqual([...first.dustPositionsM]);
    expect([...replay.dustBirthJdTdb]).toEqual([...first.dustBirthJdTdb]);
    expect(first.dustBirthJdTdb[0]).toBe(EPOCH_JD_TDB);
    expect(first.dustBirthJdTdb.at(-1)).toBeLessThan(EPOCH_JD_TDB);
    expect(first.dustHistorySpanDays).toBeGreaterThan(0);
    expect(first.dustCurvatureM).toBeGreaterThan(0);
    expect(budget.dust % 4).toBe(0);
    for (let index = 0; index < first.dustBirthJdTdb.length; index += 4) {
      const sharedBirthEpoch = first.dustBirthJdTdb[index];
      expect([...first.dustBirthJdTdb.slice(index, index + 4)]).toEqual(
        Array.from({ length: 4 }, () => sharedBirthEpoch),
      );
    }
    const secondAgeBin = Array.from({ length: 4 }, (_, lane) => {
      const offset = (4 + lane) * 3;
      return [
        first.dustPositionsM[offset],
        first.dustPositionsM[offset + 1],
        first.dustPositionsM[offset + 2],
      ].join(',');
    });
    expect(new Set(secondAgeBin).size).toBeGreaterThan(1);

    const lastIonOffset = first.ionPositionsM.length - 3;
    const antiSolarDot =
      first.ionPositionsM[lastIonOffset]! * first.ionDirection.x +
      first.ionPositionsM[lastIonOffset + 1]! * first.ionDirection.y +
      first.ionPositionsM[lastIonOffset + 2]! * first.ionDirection.z;
    expect(antiSolarDot).toBeGreaterThan(0);
  });

  it('uses a bounded smooth activity curve and validates its distance contract', () => {
    expect(cometActivityAtDistance(PROFILE.onsetDistanceAu, PROFILE)).toBe(0);
    expect(cometActivityAtDistance(PROFILE.peakDistanceAu, PROFILE)).toBe(1);
    expect(cometActivityAtDistance(2.5, PROFILE)).toBeCloseTo(0.5, 12);
    expect(cometActivityAtDistance(20, PROFILE)).toBe(0);
    expect(() => cometActivityAtDistance(Number.NaN, PROFILE)).toThrow(/finite/);
    expect(() =>
      cometActivityAtDistance(1, { onsetDistanceAu: 1, peakDistanceAu: 1 }),
    ).toThrow(/peak < onset/);
  });
});

class CircularCometProvider implements EphemerisProvider {
  public readonly id = 'circular-comet-fixture';
  public readonly bodyIds = Object.freeze(['67p']);
  private readonly coverage: EphemerisCoverage = Object.freeze({
    startJdTdb: EPOCH_JD_TDB - 365,
    endJdTdb: EPOCH_JD_TDB + 365,
    sampleStepSeconds: 21_600,
    sampleCount: 2_921,
  });

  public hasBody(bodyId: string): boolean {
    return bodyId === '67p';
  }

  public getCoverage(bodyId: string): EphemerisCoverage | undefined {
    return this.hasBody(bodyId) ? this.coverage : undefined;
  }

  public getProvenance(bodyId: string): DataProvenance | undefined {
    return this.hasBody(bodyId)
      ? {
          provider: 'GENERATED',
          sourceName: 'Analytic circular comet fixture',
          units: 'm and m/s',
          retrievedAtIso: '2026-08-29T00:00:00.000Z',
          generatorVersion: 'tail-test/1',
        }
      : undefined;
  }

  public sample(bodyId: string, jdTdb: number, out: EphemerisStateVector): EphemerisStateVector {
    if (!this.hasBody(bodyId)) throw new EphemerisBodyNotFoundError(bodyId);
    if (jdTdb < this.coverage.startJdTdb || jdTdb > this.coverage.endJdTdb) {
      throw new EphemerisOutOfRangeError(bodyId, jdTdb, this.coverage);
    }
    const angularRateRadPerDay = 0.012;
    const angle = (jdTdb - EPOCH_JD_TDB) * angularRateRadPerDay;
    const angularRateRadPerSecond = angularRateRadPerDay / SECONDS_PER_DAY;
    out.jdTdb = jdTdb;
    out.positionM.x = Math.cos(angle) * ASTRONOMICAL_UNIT_M;
    out.positionM.y = Math.sin(angle) * ASTRONOMICAL_UNIT_M;
    out.positionM.z = 0;
    out.velocityMps.x = -Math.sin(angle) * ASTRONOMICAL_UNIT_M * angularRateRadPerSecond;
    out.velocityMps.y = Math.cos(angle) * ASTRONOMICAL_UNIT_M * angularRateRadPerSecond;
    out.velocityMps.z = 0;
    return out;
  }
}
