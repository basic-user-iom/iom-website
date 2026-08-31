import cometCatalogPayload from '../../data/catalogs/comets.json';
import type { CometVisualProfile } from '../../rendering/comets/CometVisualSystem';
import type { DataProvenance } from './DataProvenance';

export const COMET_BODY_IDS = [
  '1p-halley',
  '2p-encke',
  '67p-churyumov-gerasimenko',
  'c-1995-o1-hale-bopp',
  'c-2020-f3-neowise',
] as const;

export type CometBodyId = (typeof COMET_BODY_IDS)[number];

export interface CometBodyDefinition {
  readonly id: CometBodyId;
  readonly displayName: string;
  readonly kind: 'comet';
  readonly parentId: 'sun';
  /** Null when the pinned JPL records provide no defensible mass. */
  readonly massKg: null;
  /** Null when the pinned JPL records provide no measured effective diameter. */
  readonly meanRadiusM: number | null;
  /** Explicitly illustrative fallback used only to make an unknown nucleus renderable. */
  readonly visualNucleusRadiusM: number;
  readonly rotationPeriodSeconds: number | null;
  readonly renderProfile: 'phase6-active-comet';
  readonly jplDesignation: string;
  readonly jplSpkId: string;
  readonly jplOrbitId: string;
  readonly orbitElementEpochJdTdb: number;
  readonly trustedStartJdTdb: number;
  readonly trustedEndJdTdb: number;
  readonly solutionWarningDays: number;
  readonly physicalSourceNote: string;
  readonly provenance: readonly DataProvenance[];
}

interface RuntimeCometCatalogEntry {
  readonly id: string;
  readonly displayName: string;
  readonly kind: 'comet';
  readonly parentId: 'sun';
  readonly jpl: {
    readonly designation: string;
    readonly spkId: string;
    readonly orbitId: string;
    readonly epochJdTdb: number;
    readonly expectedFullNames: readonly string[];
  };
  readonly physical: {
    readonly meanRadiusM: number | null;
    readonly rotationPeriodSeconds: number | null;
    readonly sourceParameter: string;
  };
  readonly renderProfile: 'phase6-active-comet';
  readonly visualSeed: number;
  readonly activity: {
    readonly referenceDistanceAu: number;
    readonly onsetDistanceAu: number;
    readonly comaScale: number;
    readonly ionTailScale: number;
    readonly dustTailScale: number;
  };
  readonly trustedInterval: {
    readonly startJdTdb: number;
    readonly endJdTdb: number;
    readonly reason: string;
  };
}

interface RuntimeCometCatalogPayload {
  readonly schemaVersion: 1;
  readonly catalogVersion: string;
  readonly comets: readonly RuntimeCometCatalogEntry[];
}

const catalog = cometCatalogPayload as RuntimeCometCatalogPayload;
validateCatalog(catalog);

const JPL_SBDB_DOCUMENTATION = 'https://ssd-api.jpl.nasa.gov/doc/sbdb.html';
const RETRIEVED_AT_ISO = '2026-08-29T12:27:35.734Z';

export const COMET_BODY_DEFINITIONS: readonly Readonly<CometBodyDefinition>[] =
  Object.freeze(catalog.comets.map((entry) => {
    const bodyId = requireCometBodyId(entry.id);
    const provenance: readonly DataProvenance[] = Object.freeze([
      Object.freeze({
        provider: 'JPL_SBDB',
        sourceName: 'NASA/JPL Small-Body Database (SBDB) API',
        targetId: entry.jpl.spkId,
        centerId: '10',
        referenceFrame: 'ICRF',
        referencePlane: 'ECLIPTIC',
        timeScale: 'TDB',
        units: 'mixed catalog units; runtime definition normalized to SI where available',
        retrievedAtIso: RETRIEVED_AT_ISO,
        generatorVersion: catalog.catalogVersion,
        notes: Object.freeze([
          `Canonical designation ${entry.jpl.designation}; JPL orbit ${entry.jpl.orbitId}.`,
          `Element epoch JD ${entry.jpl.epochJdTdb} TDB.`,
          `Resolver documentation: ${JPL_SBDB_DOCUMENTATION}`,
          entry.physical.sourceParameter,
          'Mass is not synthesized when absent from the pinned JPL record.',
        ]),
      }),
      Object.freeze({
        provider: 'GENERATED',
        sourceName: 'Phase 6 deterministic comet visual profile',
        units: 'SI render inputs and dimensionless display controls',
        retrievedAtIso: RETRIEVED_AT_ISO,
        generatorVersion: catalog.catalogVersion,
        notes: Object.freeze([
          'Nucleus irregularity, coma response, particle emission, and tail brightness are educational visualizations.',
          'Ion direction is instantaneous anti-solar; dust retains time-stamped trajectory memory.',
        ]),
      }),
    ]);
    return Object.freeze({
      id: bodyId,
      displayName: entry.displayName,
      kind: 'comet' as const,
      parentId: 'sun' as const,
      massKg: null,
      meanRadiusM: entry.physical.meanRadiusM,
      visualNucleusRadiusM: entry.physical.meanRadiusM ?? 2_500,
      rotationPeriodSeconds: entry.physical.rotationPeriodSeconds,
      renderProfile: entry.renderProfile,
      jplDesignation: entry.jpl.designation,
      jplSpkId: entry.jpl.spkId,
      jplOrbitId: entry.jpl.orbitId,
      orbitElementEpochJdTdb: entry.jpl.epochJdTdb,
      trustedStartJdTdb: entry.trustedInterval.startJdTdb,
      trustedEndJdTdb: entry.trustedInterval.endJdTdb,
      solutionWarningDays: solutionWarningDays(bodyId),
      physicalSourceNote: entry.physical.sourceParameter,
      provenance,
    });
  }));

export const COMET_VISUAL_PROFILES: readonly Readonly<CometVisualProfile>[] =
  Object.freeze(catalog.comets.map((entry) => {
    const bodyId = requireCometBodyId(entry.id);
    const appearance = appearanceFor(bodyId);
    return Object.freeze({
      bodyId,
      nucleusColor: appearance.nucleusColor,
      dustColor: appearance.dustColor,
      ionColor: appearance.ionColor,
      nucleusElongation: appearance.elongation,
      activity: Object.freeze({
        onsetDistanceAu: entry.activity.onsetDistanceAu,
        peakDistanceAu: Math.min(
          entry.activity.referenceDistanceAu,
          entry.activity.onsetDistanceAu * 0.72,
        ),
        comaRadiusKm: 58_000 * entry.activity.comaScale,
        ionTailLengthAu: 0.28 * entry.activity.ionTailScale,
        dustTailAgeDays: 115 * entry.activity.dustTailScale,
        dustRadiationPressureBeta: appearance.dustBeta,
        dustEjectionSpeedMps: 34 * entry.activity.dustTailScale,
        deterministicSeed: entry.visualSeed,
      }),
    });
  }));

export function isCometBodyId(bodyId: string): bodyId is CometBodyId {
  return COMET_BODY_IDS.includes(bodyId as CometBodyId);
}

export function getCometDefinition(bodyId: string): Readonly<CometBodyDefinition> | undefined {
  return COMET_BODY_DEFINITIONS.find((definition) => definition.id === bodyId);
}

export function getCometVisualProfile(bodyId: string): Readonly<CometVisualProfile> | undefined {
  return COMET_VISUAL_PROFILES.find((profile) => profile.bodyId === bodyId);
}

export function cometEphemerisWarning(bodyId: CometBodyId, jdTdb: number): string | null {
  const definition = getCometDefinition(bodyId);
  if (definition === undefined) throw new Error(`Missing comet definition "${bodyId}".`);
  if (!Number.isFinite(jdTdb)) throw new RangeError('Comet warning epoch must be finite.');
  if (jdTdb < definition.trustedStartJdTdb || jdTdb > definition.trustedEndJdTdb) {
    return `Outside bundled Horizons vectors (${definition.trustedStartJdTdb.toFixed(1)}–${definition.trustedEndJdTdb.toFixed(1)} JD TDB); no silent comet extrapolation.`;
  }
  const distanceFromSolutionDays = Math.abs(jdTdb - definition.orbitElementEpochJdTdb);
  if (distanceFromSolutionDays > definition.solutionWarningDays) {
    return `Horizons vector is ${Math.round(distanceFromSolutionDays / 365.25)} years from JPL orbit solution ${definition.jplOrbitId}; long-range comet activity and nongravitational acceleration are uncertain.`;
  }
  return null;
}

function requireCometBodyId(bodyId: string): CometBodyId {
  if (!isCometBodyId(bodyId)) throw new Error(`Unknown Phase 6 comet "${bodyId}".`);
  return bodyId;
}

function validateCatalog(payload: RuntimeCometCatalogPayload): void {
  if (payload.schemaVersion !== 1 || payload.comets.length < 3) {
    throw new Error('Phase 6 comet catalog requires schemaVersion 1 and at least three comets.');
  }
  const ids = payload.comets.map((entry) => entry.id);
  if (
    ids.length !== COMET_BODY_IDS.length ||
    COMET_BODY_IDS.some((bodyId) => !ids.includes(bodyId)) ||
    new Set(ids).size !== ids.length
  ) {
    throw new Error('Phase 6 comet catalog must contain the five canonical comet IDs exactly once.');
  }
  for (const entry of payload.comets) {
    if (
      entry.kind !== 'comet' ||
      entry.parentId !== 'sun' ||
      entry.jpl.designation.length === 0 ||
      !/^\d+$/.test(entry.jpl.spkId) ||
      entry.jpl.orbitId.length === 0 ||
      !Number.isFinite(entry.jpl.epochJdTdb) ||
      !Number.isInteger(entry.visualSeed)
    ) {
      throw new Error(`Invalid Phase 6 comet entry "${entry.id}".`);
    }
  }
}

function solutionWarningDays(bodyId: CometBodyId): number {
  switch (bodyId) {
    case '1p-halley':
      return 50 * 365.25;
    case '2p-encke':
      return 12 * 365.25;
    case '67p-churyumov-gerasimenko':
      return 15 * 365.25;
    case 'c-1995-o1-hale-bopp':
      return 35 * 365.25;
    case 'c-2020-f3-neowise':
      return 22 * 365.25;
  }
}

function appearanceFor(bodyId: CometBodyId): Readonly<{
  nucleusColor: string;
  dustColor: string;
  ionColor: string;
  elongation: readonly [number, number, number];
  dustBeta: number;
}> {
  switch (bodyId) {
    case '1p-halley':
      return Object.freeze({ nucleusColor: '#34302b', dustColor: '#e7c18e', ionColor: '#72c9ff', elongation: [1.35, 0.74, 0.72] as const, dustBeta: 0.085 });
    case '2p-encke':
      return Object.freeze({ nucleusColor: '#2d2b28', dustColor: '#d9b27d', ionColor: '#68bde9', elongation: [1.12, 0.82, 0.74] as const, dustBeta: 0.075 });
    case '67p-churyumov-gerasimenko':
      return Object.freeze({ nucleusColor: '#393531', dustColor: '#d9b98c', ionColor: '#6dc8f6', elongation: [1.28, 0.9, 0.78] as const, dustBeta: 0.065 });
    case 'c-1995-o1-hale-bopp':
      return Object.freeze({ nucleusColor: '#332e29', dustColor: '#f0c78c', ionColor: '#78d3ff', elongation: [1.08, 0.9, 0.82] as const, dustBeta: 0.1 });
    case 'c-2020-f3-neowise':
      return Object.freeze({ nucleusColor: '#302d2a', dustColor: '#edc391', ionColor: '#71cbff', elongation: [1.18, 0.83, 0.76] as const, dustBeta: 0.095 });
  }
}
