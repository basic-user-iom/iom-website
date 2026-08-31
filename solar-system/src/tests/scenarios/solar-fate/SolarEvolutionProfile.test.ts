import rawSolarEvolutionProfile from '../../../data/catalogs/solar-evolution-profile.v1.json';
import {
  parseSolarEvolutionProfile,
  sampleSolarEvolutionProfile,
  SOLAR_EVOLUTION_PROFILE,
} from '../../../simulation/scenarios/solar-fate/SolarEvolutionProfile';
import { SOLAR_EVOLUTION_PHASE_IDS } from '../../../simulation/scenarios/solar-fate/ScientificSolarEvolutionTypes';

const REQUIRED_NASA_URLS = [
  'https://science.nasa.gov/sun/facts/',
  'https://science.nasa.gov/universe/stars/types/',
  'https://science.nasa.gov/exoplanets/resources/life-and-death/chapter-6/',
  'https://www.nasa.gov/image-article/why-sun-wont-become-black-hole/',
];

describe('solar evolution profile', () => {
  it('loads a deeply frozen, ordered educational profile with approved provenance', () => {
    expect(SOLAR_EVOLUTION_PROFILE.classification).toBe('educational-approximation');
    expect(SOLAR_EVOLUTION_PROFILE.title).toBe('Scientific Solar Evolution');
    expect(SOLAR_EVOLUTION_PROFILE.phases.map((phase) => phase.id)).toEqual(
      SOLAR_EVOLUTION_PHASE_IDS,
    );
    expect(SOLAR_EVOLUTION_PROFILE.provenance.map((entry) => entry.url)).toEqual(
      REQUIRED_NASA_URLS,
    );
    expect(SOLAR_EVOLUTION_PROFILE.totalDurationSeconds).toBe(42);
    expect(Object.isFrozen(SOLAR_EVOLUTION_PROFILE)).toBe(true);
    expect(Object.isFrozen(SOLAR_EVOLUTION_PROFILE.phases)).toBe(true);
    for (const phase of SOLAR_EVOLUTION_PROFILE.phases) {
      expect(Object.isFrozen(phase)).toBe(true);
      expect(Object.isFrozen(phase.caveats)).toBe(true);
      expect(Object.isFrozen(phase.engulfedBodyIds)).toBe(true);
    }
    expect(JSON.stringify(SOLAR_EVOLUTION_PROFILE)).not.toMatch(/supernova/i);
  });

  it('samples every boundary and clamps the final state to finite values', () => {
    let elapsedSeconds = 0;
    for (const expectedPhase of SOLAR_EVOLUTION_PROFILE.phases) {
      const sample = sampleSolarEvolutionProfile(
        SOLAR_EVOLUTION_PROFILE,
        elapsedSeconds,
      );
      expect(sample.phaseId).toBe(expectedPhase.id);
      expect(allNumbersAreFinite(sample)).toBe(true);
      elapsedSeconds += expectedPhase.durationSeconds;
    }
    const final = sampleSolarEvolutionProfile(
      SOLAR_EVOLUTION_PROFILE,
      Number.MAX_SAFE_INTEGER,
    );
    expect(final.phaseId).toBe('cooling-remnant');
    expect(final.phaseProgress).toBe(1);
    expect(allNumbersAreFinite(final)).toBe(true);
  });

  it('rejects schema drift, phase reordering, non-finite values, and missing sources', () => {
    const wrongSchema = structuredClone(rawSolarEvolutionProfile);
    wrongSchema.schemaVersion = 2;
    expect(() => parseSolarEvolutionProfile(wrongSchema)).toThrow(/schemaVersion/);

    const wrongModel = structuredClone(rawSolarEvolutionProfile);
    wrongModel.modelVersion = 'unversioned-model';
    expect(() => parseSolarEvolutionProfile(wrongModel)).toThrow(/modelVersion/);

    const reordered = structuredClone(rawSolarEvolutionProfile);
    const first = required(reordered.phases[0]);
    const second = required(reordered.phases[1]);
    reordered.phases[0] = second;
    reordered.phases[1] = first;
    expect(() => parseSolarEvolutionProfile(reordered)).toThrow(/out of order/);

    const nonFinite = structuredClone(rawSolarEvolutionProfile);
    required(nonFinite.phases[0]).durationSeconds = Number.NaN;
    expect(() => parseSolarEvolutionProfile(nonFinite)).toThrow(/durationSeconds/);

    const missingSource = structuredClone(rawSolarEvolutionProfile);
    missingSource.provenance.pop();
    expect(() => parseSolarEvolutionProfile(missingSource)).toThrow(/four NASA sources/);
  });

  it('rejects fictional-event naming inside the scientific narrative', () => {
    const mislabeled = structuredClone(rawSolarEvolutionProfile);
    required(mislabeled.phases[1]).label = 'Solar supernova';
    expect(() => parseSolarEvolutionProfile(mislabeled)).toThrow(
      /fictional-event naming/,
    );
  });
});

function required<Value>(value: Value | undefined): Value {
  if (value === undefined) throw new Error('Test fixture entry is missing.');
  return value;
}

function allNumbersAreFinite(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allNumbersAreFinite);
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).every(allNumbersAreFinite);
  }
  return true;
}
