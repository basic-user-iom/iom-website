import { URL, URLSearchParams } from 'node:url';

export const HORIZONS_API_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api';
export const MAX_HORIZONS_ROWS_PER_REQUEST = 10_000;

export function buildHorizonsRequestUrl({ body, catalog, startDate, endDate, stepSeconds }) {
  validateDate(startDate, 'startDate');
  validateDate(endDate, 'endDate');
  if (!Number.isInteger(stepSeconds) || stepSeconds <= 0) {
    throw new Error('stepSeconds must be a positive integer.');
  }

  const params = new URLSearchParams({
    format: 'json',
    COMMAND: quote(body.horizonsCommand ?? body.targetId),
    OBJ_DATA: quote('NO'),
    MAKE_EPHEM: quote('YES'),
    EPHEM_TYPE: quote('VECTORS'),
    CENTER: quote(catalog.centerCommand),
    START_TIME: quote(startDate),
    STOP_TIME: quote(endDate),
    STEP_SIZE: quote(formatHorizonsStep(stepSeconds)),
    TIME_TYPE: quote(catalog.timeScale),
    OUT_UNITS: quote(catalog.sourceUnits),
    REF_PLANE: quote(catalog.referencePlane),
    REF_SYSTEM: quote(catalog.referenceFrame),
    VEC_CORR: quote('NONE'),
    VEC_DELTA_T: quote('NO'),
    VEC_TABLE: quote('2'),
    CSV_FORMAT: quote('YES'),
    VEC_LABELS: quote('NO'),
    TIME_DIGITS: quote('FRACSEC'),
    CAL_TYPE: quote('GREGORIAN'),
  });
  return new URL(`${HORIZONS_API_URL}?${params.toString()}`);
}

export function buildHorizonsTlistRequestUrl({ body, catalog, jdTdb }) {
  if (!Array.isArray(jdTdb) || jdTdb.length === 0 || jdTdb.length > MAX_HORIZONS_ROWS_PER_REQUEST) {
    throw new Error(`TLIST requires 1-${MAX_HORIZONS_ROWS_PER_REQUEST} Julian Dates.`);
  }
  let previous = -Infinity;
  for (const jd of jdTdb) {
    if (!Number.isFinite(jd) || jd <= previous) throw new Error('TLIST Julian Dates must be finite and increasing.');
    previous = jd;
  }
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: quote(body.horizonsCommand ?? body.targetId),
    OBJ_DATA: quote('NO'),
    MAKE_EPHEM: quote('YES'),
    EPHEM_TYPE: quote('VECTORS'),
    CENTER: quote(catalog.centerCommand),
    // Horizons requires every list value to be individually quote-wrapped.
    TLIST: jdTdb.map((jd) => quote(jd.toFixed(12))).join(','),
    TLIST_TYPE: quote('JD'),
    TIME_TYPE: quote(catalog.timeScale),
    OUT_UNITS: quote(catalog.sourceUnits),
    REF_PLANE: quote(catalog.referencePlane),
    REF_SYSTEM: quote(catalog.referenceFrame),
    VEC_CORR: quote('NONE'),
    VEC_DELTA_T: quote('NO'),
    VEC_TABLE: quote('2'),
    CSV_FORMAT: quote('YES'),
    VEC_LABELS: quote('NO'),
    TIME_DIGITS: quote('FRACSEC'),
    CAL_TYPE: quote('GREGORIAN'),
  });
  return new URL(`${HORIZONS_API_URL}?${params.toString()}`);
}

export function formatHorizonsStep(stepSeconds) {
  if (!Number.isInteger(stepSeconds) || stepSeconds <= 0) {
    throw new Error('Horizons step must be a positive whole number of seconds.');
  }
  if (stepSeconds % 86_400 === 0) return `${stepSeconds / 86_400} d`;
  if (stepSeconds % 3_600 === 0) return `${stepSeconds / 3_600} h`;
  if (stepSeconds % 60 === 0) return `${stepSeconds / 60} m`;
  return `${stepSeconds} s`;
}

/** Plans inclusive chunks with one boundary sample of overlap. */
export function planHorizonsChunks({
  startDate,
  endDate,
  stepSeconds,
  maxRows = MAX_HORIZONS_ROWS_PER_REQUEST,
}) {
  if (!Number.isInteger(maxRows) || maxRows < 2) throw new Error('maxRows must be an integer >= 2.');
  const startMs = parseEpochMs(startDate, 'startDate');
  const endMs = parseEpochMs(endDate, 'endDate');
  if (startMs >= endMs) throw new Error('Chunk range start must precede end.');
  if (!Number.isInteger(stepSeconds) || stepSeconds <= 0) throw new Error('stepSeconds must be positive.');
  const spanMs = (maxRows - 1) * stepSeconds * 1_000;
  const chunks = [];
  let chunkStartMs = startMs;
  while (chunkStartMs < endMs) {
    const chunkEndMs = Math.min(chunkStartMs + spanMs, endMs);
    chunks.push({ startDate: formatEpoch(chunkStartMs), endDate: formatEpoch(chunkEndMs) });
    chunkStartMs = chunkEndMs;
  }
  return chunks;
}

export function requestDescriptor(url) {
  const params = url.searchParams;
  return {
    endpoint: url.origin + url.pathname,
    target: unquote(params.get('COMMAND')),
    center: unquote(params.get('CENTER')),
    start: unquote(params.get('START_TIME')),
    end: unquote(params.get('STOP_TIME')),
    step: unquote(params.get('STEP_SIZE')),
    timeScale: unquote(params.get('TIME_TYPE')),
    units: unquote(params.get('OUT_UNITS')),
    referencePlane: unquote(params.get('REF_PLANE')),
    referenceSystem: unquote(params.get('REF_SYSTEM')),
  };
}

function quote(value) {
  return `'${value}'`;
}

function unquote(value) {
  return value?.replace(/^'(.*)'$/, '$1') ?? null;
}

function validateDate(value, label) {
  parseEpochMs(value, label);
}

function parseEpochMs(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD or YYYY-MM-DD HH:mm:ss.`);
  }
  const normalized = value.length === 10 ? `${value}T00:00:00Z` : `${value.replace(' ', 'T')}Z`;
  const milliseconds = Date.parse(normalized);
  if (!Number.isFinite(milliseconds)) throw new Error(`${label} is not a valid epoch.`);
  return milliseconds;
}

function formatEpoch(milliseconds) {
  return new Date(milliseconds).toISOString().slice(0, 19).replace('T', ' ');
}
