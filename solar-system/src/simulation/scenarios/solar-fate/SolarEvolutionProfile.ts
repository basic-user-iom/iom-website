import rawSolarEvolutionProfile from '../../../data/catalogs/solar-evolution-profile.v1.json';
import {
  SOLAR_FATE_PLANET_IDS,
  type SolarFatePlanetId,
} from './SolarFateTypes';
import {
  SOLAR_EVOLUTION_PHASE_IDS,
  type SolarEvolutionPhaseId,
  type SolarEvolutionPhaseProfile,
  type SolarEvolutionProfile,
  type SolarEvolutionProvenance,
  type SolarEvolutionSample,
} from './ScientificSolarEvolutionTypes';

const REQUIRED_NASA_URLS = Object.freeze([
  'https://science.nasa.gov/sun/facts/',
  'https://science.nasa.gov/universe/stars/types/',
  'https://science.nasa.gov/exoplanets/resources/life-and-death/chapter-6/',
  'https://www.nasa.gov/image-article/why-sun-wont-become-black-hole/',
] as const);

export const SOLAR_MEAN_RADIUS_M = 695_700_000;
export const SOLAR_EVOLUTION_MODEL_VERSION = 'solar-evolution-narrative-v1' as const;

export const SOLAR_EVOLUTION_PROFILE = parseSolarEvolutionProfile(
  rawSolarEvolutionProfile,
);

export function parseSolarEvolutionProfile(value: unknown): Readonly<SolarEvolutionProfile> {
  const root = requireRecord(value, 'Solar evolution profile');
  if (root.schemaVersion !== 1) throw new RangeError('Solar evolution schemaVersion must be 1.');
  if (root.profileId !== 'sun-1-solar-mass-v1') {
    throw new RangeError('Solar evolution profileId is unsupported.');
  }
  if (root.title !== 'Scientific Solar Evolution') {
    throw new RangeError('Solar evolution title is invalid.');
  }
  if (root.classification !== 'educational-approximation') {
    throw new RangeError('Solar evolution classification must be educational-approximation.');
  }
  if (root.valuesAreIllustrative !== true) {
    throw new RangeError('Solar evolution profile must identify illustrative values.');
  }
  if (root.modelVersion !== SOLAR_EVOLUTION_MODEL_VERSION) {
    throw new RangeError(
      `Solar evolution modelVersion must be ${SOLAR_EVOLUTION_MODEL_VERSION}.`,
    );
  }
  const timeCompressionNotice = requireText(
    root.timeCompressionNotice,
    'timeCompressionNotice',
  );
  const globalCaveats = parseTextArray(root.globalCaveats, 'globalCaveats');
  const provenance = parseProvenance(root.provenance);
  const phasesRaw = requireArray(root.phases, 'phases');
  if (phasesRaw.length !== SOLAR_EVOLUTION_PHASE_IDS.length) {
    throw new RangeError('Solar evolution profile must contain exactly six phases.');
  }
  const phases = phasesRaw.map((phase, index) =>
    parsePhase(phase, SOLAR_EVOLUTION_PHASE_IDS[index]),
  );
  const totalDurationSeconds = phases.reduce(
    (total, phase) => total + phase.durationSeconds,
    0,
  );

  assertNoFictionalEventLabel(root.title, 'title');
  phases.forEach((phase) => assertNoFictionalEventLabel(phase.label, phase.id));

  return Object.freeze({
    schemaVersion: 1,
    profileId: 'sun-1-solar-mass-v1',
    modelVersion: SOLAR_EVOLUTION_MODEL_VERSION,
    title: 'Scientific Solar Evolution',
    classification: 'educational-approximation',
    timeCompressionNotice,
    valuesAreIllustrative: true,
    provenance: Object.freeze(provenance),
    globalCaveats: Object.freeze(globalCaveats),
    phases: Object.freeze(phases),
    totalDurationSeconds,
  });
}

export function sampleSolarEvolutionProfile(
  profile: Readonly<SolarEvolutionProfile>,
  timeSeconds: number,
): Readonly<SolarEvolutionSample> {
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0) {
    throw new RangeError('Solar evolution sample time must be finite and non-negative.');
  }
  const boundedTime = Math.min(timeSeconds, profile.totalDurationSeconds);
  let phaseStartSeconds = 0;
  let phaseIndex = profile.phases.length - 1;
  for (let index = 0; index < profile.phases.length; index += 1) {
    const phase = profile.phases[index];
    if (phase === undefined) continue;
    if (boundedTime < phaseStartSeconds + phase.durationSeconds) {
      phaseIndex = index;
      break;
    }
    phaseStartSeconds += phase.durationSeconds;
  }
  const phase = requiredPhase(profile.phases[phaseIndex]);
  const next = requiredPhase(profile.phases[Math.min(phaseIndex + 1, profile.phases.length - 1)]);
  const phaseProgress = phaseIndex === profile.phases.length - 1 && boundedTime >= profile.totalDurationSeconds
    ? 1
    : clamp((boundedTime - phaseStartSeconds) / phase.durationSeconds, 0, 1);
  const blend = phaseProgress * phaseProgress * (3 - 2 * phaseProgress);

  return Object.freeze({
    phaseId: phase.id,
    phaseLabel: phase.label,
    phaseProgress,
    radiusSolarRadii: lerp(phase.radiusSolarRadii, next.radiusSolarRadii, blend),
    luminositySolar: lerp(phase.luminositySolar, next.luminositySolar, blend),
    massSolarMasses: lerp(phase.massSolarMasses, next.massSolarMasses, blend),
    effectiveTemperatureK: lerp(
      phase.effectiveTemperatureK,
      next.effectiveTemperatureK,
      blend,
    ),
    radiusLabel: phase.radiusLabel,
    luminosityLabel: phase.luminosityLabel,
    massLossLabel: phase.massLossLabel,
    innerSystemHeating: lerp(phase.innerSystemHeating, next.innerSystemHeating, blend),
    massLossShellOpacity: lerp(
      phase.massLossShellOpacity,
      next.massLossShellOpacity,
      blend,
    ),
    nebulaOpacity: lerp(phase.nebulaOpacity, next.nebulaOpacity, blend),
    nebulaDisplayRadiusSolarRadii: lerp(
      phase.nebulaDisplayRadiusSolarRadii,
      next.nebulaDisplayRadiusSolarRadii,
      blend,
    ),
    whiteDwarfBlend: lerp(phase.whiteDwarfBlend, next.whiteDwarfBlend, blend),
    engulfedBodyIds: phase.engulfedBodyIds,
    uncertainBodyIds: phase.uncertainBodyIds,
    caveats: Object.freeze([...profile.globalCaveats, ...phase.caveats]),
  });
}

function parseProvenance(value: unknown): Readonly<SolarEvolutionProvenance>[] {
  const sourceEntries = requireArray(value, 'provenance');
  if (sourceEntries.length !== REQUIRED_NASA_URLS.length) {
    throw new RangeError('Solar evolution provenance must contain exactly four NASA sources.');
  }
  const records = sourceEntries.map((entry, index) => {
    const record = requireRecord(entry, `provenance[${index}]`);
    if (record.provider !== 'NASA') {
      throw new RangeError(`Solar evolution provenance[${index}] provider must be NASA.`);
    }
    const url = requireText(record.url, `provenance[${index}].url`);
    if (!REQUIRED_NASA_URLS.includes(url as (typeof REQUIRED_NASA_URLS)[number])) {
      throw new RangeError(`Solar evolution provenance URL "${url}" is not approved.`);
    }
    const retrievedAtIso = requireText(
      record.retrievedAtIso,
      `provenance[${index}].retrievedAtIso`,
    );
    if (!Number.isFinite(Date.parse(retrievedAtIso))) {
      throw new RangeError(`Solar evolution provenance[${index}] retrieval date is invalid.`);
    }
    return Object.freeze({
      provider: 'NASA' as const,
      sourceName: requireText(record.sourceName, `provenance[${index}].sourceName`),
      url,
      retrievedAtIso,
      notes: requireText(record.notes, `provenance[${index}].notes`),
    });
  });
  for (const url of REQUIRED_NASA_URLS) {
    if (!records.some((record) => record.url === url)) {
      throw new RangeError(`Solar evolution provenance is missing "${url}".`);
    }
  }
  if (new Set(records.map((record) => record.url)).size !== records.length) {
    throw new RangeError('Solar evolution provenance contains duplicate URLs.');
  }
  return records;
}

function parsePhase(
  value: unknown,
  expectedId: SolarEvolutionPhaseId | undefined,
): Readonly<SolarEvolutionPhaseProfile> {
  if (expectedId === undefined) throw new RangeError('Solar evolution phase order is invalid.');
  const phase = requireRecord(value, `phase ${expectedId}`);
  if (phase.id !== expectedId) {
    throw new RangeError(`Solar evolution phase ${expectedId} is out of order.`);
  }
  const engulfedBodyIds = parsePlanetIds(phase.engulfedBodyIds, `${expectedId}.engulfedBodyIds`);
  const uncertainBodyIds = parsePlanetIds(phase.uncertainBodyIds, `${expectedId}.uncertainBodyIds`);
  if (engulfedBodyIds.some((bodyId) => uncertainBodyIds.includes(bodyId))) {
    throw new RangeError(`Solar evolution phase ${expectedId} has conflicting body statuses.`);
  }
  return Object.freeze({
    id: expectedId,
    label: requireText(phase.label, `${expectedId}.label`),
    durationSeconds: requireNumber(phase.durationSeconds, `${expectedId}.durationSeconds`, 0.1, 120),
    radiusSolarRadii: requireNumber(phase.radiusSolarRadii, `${expectedId}.radiusSolarRadii`, 0.001, 1_000),
    luminositySolar: requireNumber(phase.luminositySolar, `${expectedId}.luminositySolar`, 0, 1_000_000),
    massSolarMasses: requireNumber(phase.massSolarMasses, `${expectedId}.massSolarMasses`, 0.1, 1.1),
    effectiveTemperatureK: requireNumber(phase.effectiveTemperatureK, `${expectedId}.effectiveTemperatureK`, 1_000, 1_000_000),
    radiusLabel: requireText(phase.radiusLabel, `${expectedId}.radiusLabel`),
    luminosityLabel: requireText(phase.luminosityLabel, `${expectedId}.luminosityLabel`),
    massLossLabel: requireText(phase.massLossLabel, `${expectedId}.massLossLabel`),
    innerSystemHeating: requireNumber(phase.innerSystemHeating, `${expectedId}.innerSystemHeating`, 0, 1),
    massLossShellOpacity: requireNumber(phase.massLossShellOpacity, `${expectedId}.massLossShellOpacity`, 0, 1),
    nebulaOpacity: requireNumber(phase.nebulaOpacity, `${expectedId}.nebulaOpacity`, 0, 1),
    nebulaDisplayRadiusSolarRadii: requireNumber(
      phase.nebulaDisplayRadiusSolarRadii,
      `${expectedId}.nebulaDisplayRadiusSolarRadii`,
      0,
      100_000,
    ),
    whiteDwarfBlend: requireNumber(phase.whiteDwarfBlend, `${expectedId}.whiteDwarfBlend`, 0, 1),
    engulfedBodyIds: Object.freeze(engulfedBodyIds),
    uncertainBodyIds: Object.freeze(uncertainBodyIds),
    caveats: Object.freeze(parseTextArray(phase.caveats, `${expectedId}.caveats`)),
  });
}

function parsePlanetIds(value: unknown, label: string): SolarFatePlanetId[] {
  const ids = requireArray(value, label).map((entry) => {
    if (typeof entry !== 'string' || !SOLAR_FATE_PLANET_IDS.includes(entry as SolarFatePlanetId)) {
      throw new RangeError(`Solar evolution ${label} contains an unknown body.`);
    }
    return entry as SolarFatePlanetId;
  });
  if (new Set(ids).size !== ids.length) {
    throw new RangeError(`Solar evolution ${label} contains duplicate bodies.`);
  }
  return ids;
}

function parseTextArray(value: unknown, label: string): string[] {
  const entries = requireArray(value, label).map((entry, index) =>
    requireText(entry, `${label}[${index}]`),
  );
  if (entries.length === 0) throw new RangeError(`Solar evolution ${label} must not be empty.`);
  return entries;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`Solar evolution ${label} must be an array.`);
  return value;
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value !== value.trim()) {
    throw new TypeError(`Solar evolution ${label} must be non-empty trimmed text.`);
  }
  return value;
}

function requireNumber(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`Solar evolution ${label} must be between ${minimum} and ${maximum}.`);
  }
  return value;
}

function requiredPhase(
  phase: Readonly<SolarEvolutionPhaseProfile> | undefined,
): Readonly<SolarEvolutionPhaseProfile> {
  if (phase === undefined) throw new Error('Solar evolution profile phase is unavailable.');
  return phase;
}

function assertNoFictionalEventLabel(value: unknown, label: string): void {
  if (typeof value === 'string' && /supernova/i.test(value)) {
    throw new RangeError(`Scientific solar evolution ${label} must not use fictional-event naming.`);
  }
}

function lerp(left: number, right: number, alpha: number): number {
  return left + (right - left) * alpha;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
