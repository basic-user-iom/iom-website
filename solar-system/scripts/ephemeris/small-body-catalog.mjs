import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

export const DEFAULT_COMET_CATALOG_URL = new URL(
  '../../src/data/catalogs/comets.json',
  import.meta.url,
);

export async function loadCometCatalog(url = DEFAULT_COMET_CATALOG_URL) {
  const catalog = JSON.parse(await readFile(url, 'utf8'));
  return validateCometCatalog(catalog);
}

export function validateCometCatalog(catalog) {
  if (
    catalog?.schemaVersion !== 1 ||
    typeof catalog.catalogVersion !== 'string' ||
    !Array.isArray(catalog.comets) ||
    catalog.comets.length !== 5
  ) {
    throw new Error('Comet catalog must use schemaVersion 1 and contain exactly five comets.');
  }
  if (catalog.sourcePolicy?.normalRuntimeNetworkRequests !== false) {
    throw new Error('Comet catalog must prohibit normal-runtime network requests.');
  }

  const ids = new Set();
  const designations = new Set();
  const spkIds = new Set();
  const horizonsRecordIds = new Set();
  for (const comet of catalog.comets) {
    requireString(comet.id, 'comet id', /^[a-z0-9][a-z0-9-]*$/);
    requireUnique(ids, comet.id, 'comet id');
    requireString(comet.displayName, `${comet.id} displayName`);
    if (comet.kind !== 'comet' || comet.parentId !== 'sun') {
      throw new Error(`${comet.id} must be a comet parented to the Sun.`);
    }

    requireString(comet.jpl?.designation, `${comet.id} JPL designation`);
    requireUnique(designations, normalizeDesignation(comet.jpl.designation), 'JPL designation');
    requireString(comet.jpl?.spkId, `${comet.id} JPL SPK id`, /^\d+$/);
    requireUnique(spkIds, comet.jpl.spkId, 'JPL SPK id');
    requireString(comet.jpl?.orbitId, `${comet.id} JPL orbit id`);
    requirePositive(comet.jpl?.epochJdTdb, `${comet.id} JPL element epoch`);
    if (comet.jpl?.horizonsRecordId !== null) {
      requireString(
        comet.jpl?.horizonsRecordId,
        `${comet.id} Horizons record id`,
        /^9\d{7}$/,
      );
      requireUnique(
        horizonsRecordIds,
        comet.jpl.horizonsRecordId,
        'Horizons record id',
      );
    }
    if (
      !Array.isArray(comet.jpl.expectedFullNames) ||
      comet.jpl.expectedFullNames.length === 0 ||
      comet.jpl.expectedFullNames.some((name) => typeof name !== 'string' || name.trim() === '')
    ) {
      throw new Error(`${comet.id} requires at least one expected JPL full name.`);
    }

    requirePositiveOrNull(comet.physical?.meanRadiusM, `${comet.id} mean radius`);
    requirePositiveOrNull(
      comet.physical?.visualizationFallbackMeanRadiusM,
      `${comet.id} visualization fallback radius`,
    );
    if (comet.physical.meanRadiusM === null) {
      requirePositive(
        comet.physical.visualizationFallbackMeanRadiusM,
        `${comet.id} visualization fallback radius`,
      );
    }
    requirePositiveOrNull(
      comet.physical?.rotationPeriodSeconds,
      `${comet.id} rotation period`,
    );
    requireString(comet.physical?.sourceParameter, `${comet.id} physical source note`);
    requireString(comet.renderProfile, `${comet.id} render profile`);
    if (!Number.isInteger(comet.visualSeed) || comet.visualSeed < 0 || comet.visualSeed > 0xffff_ffff) {
      throw new Error(`${comet.id} visualSeed must be a uint32.`);
    }

    const activity = comet.activity;
    if (activity?.model !== 'distance-power-law-visualization') {
      throw new Error(`${comet.id} activity must be explicitly classified as a visualization model.`);
    }
    for (const key of [
      'referenceDistanceAu',
      'onsetDistanceAu',
      'comaScale',
      'ionTailScale',
      'dustTailScale',
    ]) {
      requirePositive(activity[key], `${comet.id} activity ${key}`);
    }
    if (activity.onsetDistanceAu <= activity.referenceDistanceAu) {
      throw new Error(`${comet.id} activity onset must exceed its reference distance.`);
    }

    const sampling = comet.sampling;
    requirePositiveInteger(sampling?.coarseStepSeconds, `${comet.id} coarse step`);
    requirePositiveInteger(sampling?.denseStepSeconds, `${comet.id} dense step`);
    requirePositiveInteger(sampling?.denseWindowDays, `${comet.id} dense window`);
    if (
      sampling.denseStepSeconds >= sampling.coarseStepSeconds ||
      sampling.coarseStepSeconds % sampling.denseStepSeconds !== 0
    ) {
      throw new Error(`${comet.id} dense sampling must evenly refine its coarse sampling.`);
    }

    const trusted = comet.trustedInterval;
    if (
      !Number.isFinite(trusted?.startJdTdb) ||
      !Number.isFinite(trusted?.endJdTdb) ||
      trusted.startJdTdb >= trusted.endJdTdb
    ) {
      throw new Error(`${comet.id} trusted interval is invalid.`);
    }
    requireString(trusted.reason, `${comet.id} trusted interval reason`);
  }
  return catalog;
}

export function selectCatalogComets(catalog, requestedIds = []) {
  validateCometCatalog(catalog);
  if (requestedIds.length === 0) return [...catalog.comets];
  const byId = new Map(catalog.comets.map((comet) => [comet.id, comet]));
  const selected = [];
  for (const id of requestedIds) {
    const comet = byId.get(id);
    if (comet === undefined) {
      throw new Error(`Unknown comet "${id}". Available: ${[...byId.keys()].join(', ')}`);
    }
    if (!selected.includes(comet)) selected.push(comet);
  }
  return selected;
}

export function normalizeDesignation(value) {
  return value.toUpperCase().replace(/\s+/g, ' ').trim();
}

function requireUnique(values, value, label) {
  if (values.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
  values.add(value);
}

function requireString(value, label, pattern = null) {
  if (typeof value !== 'string' || value.trim() === '' || (pattern !== null && !pattern.test(value))) {
    throw new Error(`Invalid ${label}: ${String(value)}`);
  }
}

function requirePositive(value, label) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be finite and positive.`);
}

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer.`);
}

function requirePositiveOrNull(value, label) {
  if (value !== null) requirePositive(value, label);
}
