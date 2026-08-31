import { assertHorizonsJsonEnvelope } from './cache-fetch.mjs';

const KM_TO_M = 1_000;
const SECONDS_PER_DAY = 86_400;

export function parseHorizonsVectors(jsonText, { body, catalog, expectedStepSeconds }) {
  const { payload, target, center, rows } = parseValidatedResponse(jsonText, body, catalog);
  if (rows.length < 2) throw new Error(`Horizons returned ${rows.length} sample(s); at least two are required.`);

  const sampleJdTdb = new Float64Array(rows.length);
  const valuesSi = new Float64Array(rows.length * 6);
  let measuredStepSeconds = 0;
  for (let sampleIndex = 0; sampleIndex < rows.length; sampleIndex += 1) {
    const fields = parseCsvVectorRow(rows[sampleIndex]);
    const jdTdb = parseFinite(fields[0], `sample ${sampleIndex} JDTDB`);
    sampleJdTdb[sampleIndex] = jdTdb;
    if (sampleIndex > 0) {
      const deltaSeconds = (jdTdb - sampleJdTdb[sampleIndex - 1]) * SECONDS_PER_DAY;
      if (!(deltaSeconds > 0)) throw new Error(`Horizons sample ${sampleIndex} is not strictly increasing.`);
      if (sampleIndex === 1) measuredStepSeconds = deltaSeconds;
      else assertStepClose(deltaSeconds, measuredStepSeconds, `sample ${sampleIndex}`);
    }
    for (let component = 0; component < 6; component += 1) {
      valuesSi[sampleIndex * 6 + component] = parseFinite(
        fields[component + 2],
        `sample ${sampleIndex} component ${component}`,
      ) * KM_TO_M;
    }
  }
  assertStepClose(measuredStepSeconds, expectedStepSeconds, 'requested sampling');

  return {
    bodyId: body.id,
    targetId: target.id ?? body.targetId,
    targetName: target.name,
    targetSource: target.source,
    centerId: center.id,
    centerName: center.name,
    startJdTdb: sampleJdTdb[0],
    endJdTdb: sampleJdTdb[sampleJdTdb.length - 1],
    stepSeconds: expectedStepSeconds,
    sampleCount: rows.length,
    sampleJdTdb,
    valuesSi,
    sourceSignature: payload.signature ?? null,
  };
}

export function parseHorizonsReferenceVectors(jsonText, { body, catalog, expectedJdTdb }) {
  const { payload, target, rows } = parseValidatedResponse(jsonText, body, catalog);
  if (rows.length !== expectedJdTdb.length) {
    throw new Error(`Horizons returned ${rows.length} reference rows; expected ${expectedJdTdb.length}.`);
  }
  const samples = [];
  for (let sampleIndex = 0; sampleIndex < rows.length; sampleIndex += 1) {
    const fields = parseCsvVectorRow(rows[sampleIndex]);
    const jdTdb = parseFinite(fields[0], `reference ${sampleIndex} JDTDB`);
    if (Math.abs(jdTdb - expectedJdTdb[sampleIndex]) * SECONDS_PER_DAY > 0.01) {
      throw new Error(`Reference ${sampleIndex} epoch does not match requested TLIST epoch.`);
    }
    const state = fields.slice(2).map((value, component) =>
      parseFinite(value, `reference ${sampleIndex} component ${component}`) * KM_TO_M);
    samples.push({
      bodyId: body.id,
      jdTdb,
      positionM: state.slice(0, 3),
      velocityMps: state.slice(3, 6),
    });
  }
  return {
    samples,
    targetSource: target.source,
    sourceSignature: payload.signature,
  };
}

export function parseCsvVectorRow(line) {
  const fields = line.split(',').map((field) => field.trim());
  if (fields.length === 9 && fields[8] === '') fields.pop();
  if (fields.length !== 8 || fields[1] === '') {
    throw new Error(`Malformed Horizons vector row; expected 8 CSV fields plus optional trailing comma: ${line}`);
  }
  return fields;
}

function validateHeaderContract(header, catalog) {
  if (!new RegExp(`Output units\\s*:\\s*${escapeRegex(catalog.sourceUnits)}`, 'i').test(header)) {
    throw new Error(`Horizons output units do not match ${catalog.sourceUnits}.`);
  }
  if (!/Output type\s*:\s*GEOMETRIC/i.test(header)) {
    throw new Error('Horizons output is not geometric (VEC_CORR=NONE).');
  }
  if (!/Output format\s*:\s*2\s*\(position and velocity\)/i.test(header)) {
    throw new Error('Horizons output is not vector table 2 (position and velocity).');
  }
  if (!/Center-site name\s*:\s*BODY CENTER/i.test(header)) {
    throw new Error('Horizons center-site is not the requested physical body center.');
  }
  if (catalog.timeScale === 'TDB') {
    const declaresTdbRange =
      /Start time\s*:\s*.*\bTDB\b/i.test(header) &&
      /Stop\s+time\s*:\s*.*\bTDB\b/i.test(header);
    const declaresTdbColumns = /\bJDTDB\s*,\s*Calendar Date \(TDB\)/i.test(header);
    if (!declaresTdbRange || !declaresTdbColumns) {
      throw new Error('Horizons response does not declare TDB epochs and JDTDB columns.');
    }
  }
  const expectedFrame = catalog.referencePlane === 'ECLIPTIC' ? 'Ecliptic of J2000' : catalog.referenceFrame;
  if (!new RegExp(`Reference frame\\s*:\\s*.*${escapeRegex(expectedFrame)}`, 'i').test(header)) {
    throw new Error(`Horizons reference frame does not declare ${expectedFrame}.`);
  }
}

function parseValidatedResponse(jsonText, body, catalog) {
  const payload = assertHorizonsJsonEnvelope(jsonText);
  validateApiSignature(payload.signature);
  const lines = payload.result.replace(/\r\n/g, '\n').split('\n');
  const startIndexes = markerIndexes(lines, '$$SOE');
  const endIndexes = markerIndexes(lines, '$$EOE');
  if (startIndexes.length !== 1 || endIndexes.length !== 1 || startIndexes[0] >= endIndexes[0]) {
    throw new Error('Horizons result must contain exactly one ordered $$SOE/$$EOE marker pair.');
  }
  const header = lines.slice(0, startIndexes[0]).join('\n');
  const target = parseBodyHeader(header, 'Target body name');
  const center = parseBodyHeader(header, 'Center body name');
  validateIdentity(target, body.targetId, body.expectedTargetNames, 'target', {
    allowMissingNumericId: body.allowMissingNumericTargetId === true,
  });
  if (
    body.expectedTargetSource !== undefined &&
    target.source !== body.expectedTargetSource
  ) {
    throw new Error(
      `Horizons target source mismatch: received "${String(target.source)}", ` +
        `expected "${body.expectedTargetSource}".`,
    );
  }
  validateIdentity(center, catalog.centerId, catalog.centerExpectedNames ?? ['Sun'], 'center');
  validateHeaderContract(header, catalog);
  const rows = lines.slice(startIndexes[0] + 1, endIndexes[0]).filter((line) => line.trim() !== '');
  return { payload, target, center, rows };
}

function parseBodyHeader(header, label) {
  const expression = new RegExp(`${escapeRegex(label)}\\s*:\\s*(.+)$`, 'im');
  const match = expression.exec(header);
  if (match === null) throw new Error(`Horizons header is missing "${label}".`);
  const sourceMatch = /\s*\{source:\s*([^}]+)\}\s*$/.exec(match[1]);
  const bodyText = (sourceMatch === null
    ? match[1]
    : match[1].slice(0, sourceMatch.index)).trim();
  const numericIdMatch = /^(.*?)\s*\((-?\d+)\)\s*$/.exec(bodyText);
  return {
    name: numericIdMatch?.[1].trim() ?? bodyText,
    id: numericIdMatch?.[2] ?? null,
    source: sourceMatch?.[1].trim() ?? null,
  };
}

function validateIdentity(
  actual,
  expectedId,
  expectedNames,
  label,
  { allowMissingNumericId = false } = {},
) {
  const actualName = normalizeName(actual.name);
  const nameMatches = expectedNames.some((name) => normalizeName(name) === actualName);
  const idMatches = actual.id === expectedId || (allowMissingNumericId && actual.id === null);
  if (!idMatches || !nameMatches) {
    throw new Error(
      `Horizons ${label} mismatch: received "${actual.name}" (${String(actual.id)}), expected ` +
        `${expectedNames.join(' or ')} (${expectedId}).`,
    );
  }
}

function markerIndexes(lines, marker) {
  const indexes = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() === marker) indexes.push(index);
  }
  return indexes;
}

function assertStepClose(actual, expected, label) {
  const toleranceSeconds = Math.max(0.01, Math.abs(expected) * 1e-9);
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > toleranceSeconds) {
    throw new Error(`${label} step is ${actual}s; expected ${expected}s (tolerance ${toleranceSeconds}s).`);
  }
}

function parseFinite(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is not finite: ${value}`);
  return parsed;
}

const normalizeName = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function validateApiSignature(signature) {
  const supportedVersions = new Set(['1.2', '1.3']);
  if (
    signature?.source !== 'NASA/JPL Horizons API' ||
    !supportedVersions.has(signature.version)
  ) {
    throw new Error(
      `Unsupported Horizons API signature: ${String(signature?.source)} ${String(signature?.version)}.`,
    );
  }
}
