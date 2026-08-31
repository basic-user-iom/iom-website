import { createHash } from 'node:crypto';
import { URL } from 'node:url';

import { fetchSbdbCached } from './small-body-cache.mjs';
import { normalizeDesignation, validateCometCatalog } from './small-body-catalog.mjs';

export const SBDB_API_URL = 'https://ssd-api.jpl.nasa.gov/sbdb.api';
export const SBDB_DOCUMENTATION_URL = 'https://ssd-api.jpl.nasa.gov/doc/sbdb.html';
export const SUPPORTED_SBDB_API_VERSIONS = Object.freeze(['1.3']);
const SBDB_SIGNATURE_SOURCE = 'NASA/JPL Small-Body Database (SBDB) API';

export class SbdbAmbiguousMatchError extends Error {
  constructor(designation, matches) {
    const options = matches
      .map((match) => `${String(match.pdes ?? '?')}: ${String(match.name ?? '?')}`)
      .join(', ');
    super(`SBDB designation "${designation}" is ambiguous; refusing to choose from: ${options}`);
    this.name = 'SbdbAmbiguousMatchError';
    this.designation = designation;
    this.matches = matches;
  }
}

export function buildSbdbResolveUrl(comet) {
  const designation = comet?.jpl?.designation;
  if (typeof designation !== 'string' || designation.trim() === '') {
    throw new Error('SBDB resolution requires a non-empty JPL designation.');
  }
  if (/[*\r\n]/.test(designation)) {
    throw new Error('SBDB catalog designations must be exact and cannot contain wildcards.');
  }
  const url = new URL(SBDB_API_URL);
  url.searchParams.set('des', designation);
  url.searchParams.set('full-prec', '1');
  url.searchParams.set('cov', 'mat');
  url.searchParams.set('phys-par', '1');
  url.searchParams.set('alt-des', '1');
  url.searchParams.set('alt-spk', '1');
  url.searchParams.set('alt-orbits', '1');
  url.searchParams.set('cd-epoch', '1');
  url.searchParams.set('cd-tp', '1');
  url.searchParams.set('nv-fmt', 'jd');
  return url;
}

export function parseSbdbResolution(jsonText, { comet, requestUrl, retrievedAtIso }) {
  let payload;
  try {
    payload = JSON.parse(jsonText);
  } catch (error) {
    throw new Error('SBDB resolver received invalid JSON.', { cause: error });
  }
  validateSignature(payload?.signature);

  if (Array.isArray(payload.list) || payload.code === 300) {
    throw new SbdbAmbiguousMatchError(comet.jpl.designation, payload.list ?? []);
  }
  if (payload?.object === undefined) {
    const detail = payload?.message ?? payload?.error ?? 'no object record returned';
    throw new Error(`SBDB did not resolve "${comet.jpl.designation}": ${detail}`);
  }
  if (payload.orbit === undefined || payload.orbit === null) {
    throw new Error(`SBDB object "${comet.jpl.designation}" has no orbit solution.`);
  }

  validateResolvedIdentity(payload.object, comet);
  validateOrbit(payload.orbit, comet.id);
  validatePinnedSolution(payload.object, payload.orbit, comet);
  validatePhysicalParameters(payload.phys_par ?? [], `${comet.id} physical parameters`);
  validateAlternateOrbits(payload.alt_orbits ?? [], comet.id);

  const elementsByName = new Map(payload.orbit.elements.map((element) => [element.name, element]));
  const perihelion = requireNumericParameter(elementsByName.get('tp'), `${comet.id} perihelion`);
  const period = optionalNumericParameter(elementsByName.get('per'), `${comet.id} period`);
  const resolvedRequestUrl = requestUrl instanceof URL ? requestUrl : new URL(String(requestUrl));

  return {
    id: comet.id,
    requestedDesignation: comet.jpl.designation,
    identity: payload.object,
    orbit: payload.orbit,
    alternateOrbits: payload.alt_orbits ?? [],
    physicalParameters: payload.phys_par ?? [],
    samplingSeed: {
      perihelionJdTdb: perihelion,
      periodDays: period,
    },
    provenance: {
      provider: 'JPL_SBDB',
      sourceName: SBDB_SIGNATURE_SOURCE,
      apiVersion: payload.signature.version,
      endpoint: `${resolvedRequestUrl.origin}${resolvedRequestUrl.pathname}`,
      requestUrl: resolvedRequestUrl.href,
      retrievedAtIso,
      sourceHashSha256: createHash('sha256').update(jsonText).digest('hex'),
      notes: [
        'Full-precision orbital elements requested.',
        'Full covariance matrix requested when JPL provides one.',
        'Physical parameters and alternate comet orbit solutions requested.',
      ],
    },
  };
}

export async function resolveComet(comet, options) {
  const url = buildSbdbResolveUrl(comet);
  let response;
  try {
    response = await fetchSbdbCached({ ...options, url });
  } catch (error) {
    const responseText = error?.cause?.responseText;
    if (typeof responseText === 'string') {
      return parseSbdbResolution(responseText, {
        comet,
        requestUrl: url,
        retrievedAtIso: new Date().toISOString(),
      });
    }
    throw error;
  }
  return parseSbdbResolution(response.text, {
    comet,
    requestUrl: url,
    retrievedAtIso: response.retrievedAtIso,
  });
}

export async function resolveCometCatalog(catalog, options) {
  validateCometCatalog(catalog);
  const requestedIds = options.cometIds ?? [];
  const selected = requestedIds.length === 0
    ? catalog.comets
    : requestedIds.map((id) => {
        const comet = catalog.comets.find((candidate) => candidate.id === id);
        if (comet === undefined) throw new Error(`Unknown comet "${id}".`);
        return comet;
      });
  const resolutions = [];
  // Keep official service usage deliberately sequential. Cache hits remain fast,
  // while uncached generation avoids a burst of simultaneous JPL requests.
  for (const comet of selected) {
    resolutions.push(await resolveComet(comet, options));
  }
  return {
    schemaVersion: 1,
    catalogVersion: catalog.catalogVersion,
    generatedAtIso: new Date().toISOString(),
    documentationUrl: SBDB_DOCUMENTATION_URL,
    comets: resolutions,
  };
}

function validateSignature(signature) {
  if (
    signature?.source !== SBDB_SIGNATURE_SOURCE ||
    !SUPPORTED_SBDB_API_VERSIONS.includes(signature.version)
  ) {
    throw new Error(
      `Unsupported SBDB API signature: ${String(signature?.source)} ${String(signature?.version)}.`,
    );
  }
}

function validateResolvedIdentity(object, comet) {
  if (!['cn', 'cu'].includes(object.kind)) {
    throw new Error(`${comet.id} resolved to non-comet kind "${String(object.kind)}".`);
  }
  if (normalizeDesignation(object.des) !== normalizeDesignation(comet.jpl.designation)) {
    throw new Error(
      `${comet.id} designation mismatch: received "${String(object.des)}", expected "${comet.jpl.designation}".`,
    );
  }
  if (object.spkid !== comet.jpl.spkId) {
    throw new Error(
      `${comet.id} SPK id mismatch: received "${String(object.spkid)}", expected "${comet.jpl.spkId}".`,
    );
  }
  const fullName = normalizeName(object.fullname);
  if (!comet.jpl.expectedFullNames.some((name) => normalizeName(name) === fullName)) {
    throw new Error(`${comet.id} full-name mismatch: received "${String(object.fullname)}".`);
  }
}

function validatePinnedSolution(object, orbit, comet) {
  if (object.orbit_id !== comet.jpl.orbitId || orbit.orbit_id !== comet.jpl.orbitId) {
    throw new Error(
      `${comet.id} orbit solution changed: received ${String(orbit.orbit_id)}, ` +
        `catalog pins ${comet.jpl.orbitId}. Review and regenerate metadata explicitly.`,
    );
  }
  if (Number(orbit.epoch) !== comet.jpl.epochJdTdb) {
    throw new Error(
      `${comet.id} element epoch changed: received ${String(orbit.epoch)}, ` +
        `catalog pins ${comet.jpl.epochJdTdb}. Review and regenerate metadata explicitly.`,
    );
  }
}

function validateOrbit(orbit, cometId, { requireJplSource = true } = {}) {
  if (requireJplSource && orbit.source !== 'JPL') {
    throw new Error(`${cometId} orbit source is not JPL.`);
  }
  requireFiniteString(orbit.epoch, `${cometId} element epoch`);
  if (!Array.isArray(orbit.elements) || orbit.elements.length < 6) {
    throw new Error(`${cometId} orbit requires at least six elements.`);
  }
  validateParameters(orbit.elements, `${cometId} elements`, { allowCalendarValues: true });
  validateParameters(orbit.model_pars ?? [], `${cometId} model parameters`);
  if (orbit.covariance !== undefined && orbit.covariance !== null) {
    validateCovariance(orbit.covariance, cometId);
  }
}

function validateAlternateOrbits(orbits, cometId) {
  if (!Array.isArray(orbits)) throw new Error(`${cometId} alternate orbits must be an array.`);
  for (const orbit of orbits) {
    validateOrbit(orbit, `${cometId} alternate orbit`, { requireJplSource: false });
  }
}

function validateParameters(parameters, label, { allowCalendarValues = false } = {}) {
  if (!Array.isArray(parameters)) throw new Error(`${label} must be an array.`);
  const names = new Set();
  for (const parameter of parameters) {
    if (typeof parameter?.name !== 'string' || parameter.name === '') {
      throw new Error(`${label} contains an unnamed parameter.`);
    }
    if (names.has(parameter.name)) throw new Error(`${label} repeats parameter ${parameter.name}.`);
    names.add(parameter.name);
    if (allowCalendarValues && parameter.name.endsWith('_cd')) {
      if (typeof parameter.value !== 'string' || parameter.value.trim() === '') {
        throw new Error(`${label} ${parameter.name} has no calendar value.`);
      }
    } else {
      requireFiniteString(parameter.value, `${label} ${parameter.name}`);
    }
    if (parameter.sigma !== null && parameter.sigma !== undefined) {
      requireFiniteString(parameter.sigma, `${label} ${parameter.name} sigma`);
    }
  }
}

function validatePhysicalParameters(parameters, label) {
  if (!Array.isArray(parameters)) throw new Error(`${label} must be an array.`);
  const names = new Set();
  for (const parameter of parameters) {
    if (typeof parameter?.name !== 'string' || parameter.name === '') {
      throw new Error(`${label} contains an unnamed parameter.`);
    }
    if (names.has(parameter.name)) throw new Error(`${label} repeats parameter ${parameter.name}.`);
    names.add(parameter.name);
    if (typeof parameter.value !== 'string' || parameter.value.trim() === '') {
      throw new Error(`${label} ${parameter.name} has no value.`);
    }
  }
}

function validateCovariance(covariance, cometId) {
  if (!Array.isArray(covariance.labels) || covariance.labels.length === 0) {
    throw new Error(`${cometId} covariance requires labels.`);
  }
  const size = covariance.labels.length;
  if (!Array.isArray(covariance.data) || covariance.data.length !== size) {
    throw new Error(`${cometId} covariance matrix has the wrong row count.`);
  }
  for (const row of covariance.data) {
    if (!Array.isArray(row) || row.length !== size) {
      throw new Error(`${cometId} covariance matrix must be square.`);
    }
    for (const value of row) requireFiniteString(value, `${cometId} covariance value`);
  }
  requireFiniteString(covariance.epoch, `${cometId} covariance epoch`);
}

function requireNumericParameter(parameter, label) {
  if (parameter === undefined) throw new Error(`${label} is missing.`);
  return Number(requireFiniteString(parameter.value, label));
}

function optionalNumericParameter(parameter, label) {
  return parameter === undefined ? null : Number(requireFiniteString(parameter.value, label));
}

function requireFiniteString(value, label) {
  const validString = typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value));
  const validNumber = typeof value === 'number' && Number.isFinite(value);
  if (!validString && !validNumber) {
    throw new Error(`${label} must be a finite numeric value.`);
  }
  return value;
}

function normalizeName(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
