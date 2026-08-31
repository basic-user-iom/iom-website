import {
  buildHorizonsRequestUrl,
  planHorizonsChunks,
} from './horizons-request.mjs';

const JULIAN_DAY_UNIX_EPOCH = 2_440_587.5;
const MILLISECONDS_PER_DAY = 86_400_000;
const SECONDS_PER_DAY = 86_400;

export function buildSmallBodyHorizonsCommand(designation) {
  if (typeof designation !== 'string' || designation.trim() === '') {
    throw new Error('Small-body Horizons command requires a designation.');
  }
  const normalized = designation.replace(/\s+/g, ' ').trim();
  if (/[*;'"\r\n]/.test(normalized)) {
    throw new Error('Small-body Horizons designation must be exact and contain no directives.');
  }
  return `DES=${normalized};`;
}

export function buildSmallBodyHorizonsRecordCommand(recordId) {
  if (typeof recordId !== 'string' || !/^9\d{7}$/.test(recordId)) {
    throw new Error('Small-body Horizons record id must be an eight-digit JPL comet record.');
  }
  return `${recordId};`;
}

export function createHorizonsCometBody(comet, resolution) {
  if (resolution.id !== comet.id) {
    throw new Error(`Resolved SBDB metadata id ${resolution.id} does not match ${comet.id}.`);
  }
  if (resolution.identity.spkid !== comet.jpl.spkId) {
    throw new Error(`${comet.id} resolved SPK id does not match its catalog contract.`);
  }
  return Object.freeze({
    id: comet.id,
    targetId: comet.jpl.spkId,
    horizonsCommand: comet.jpl.horizonsRecordId === null
      ? buildSmallBodyHorizonsCommand(comet.jpl.designation)
      : buildSmallBodyHorizonsRecordCommand(comet.jpl.horizonsRecordId),
    expectedTargetNames: [...comet.jpl.expectedFullNames],
    expectedTargetSource: `JPL#${comet.jpl.orbitId}`,
    allowMissingNumericTargetId: true,
    defaultStepSeconds: comet.sampling.coarseStepSeconds,
  });
}

export function buildSmallBodyHorizonsRequestUrl({
  comet,
  resolution,
  catalog,
  startDate,
  endDate,
  stepSeconds,
}) {
  return buildHorizonsRequestUrl({
    body: createHorizonsCometBody(comet, resolution),
    catalog,
    startDate,
    endDate,
    stepSeconds,
  });
}

/**
 * Plans constant-cadence segments with shared boundaries. Dense windows are
 * snapped to the coarse cadence, so each segment can still use the existing
 * strict Horizons parser/chunker without pretending the v1 binary is uniform.
 */
export function planCometSamplingSegments({ comet, resolution, startDate, endDate }) {
  const startJdTdb = calendarToJulianDay(startDate, 'startDate');
  const endJdTdb = calendarToJulianDay(endDate, 'endDate');
  if (!(endJdTdb > startJdTdb)) throw new Error('Comet sampling start must precede end.');

  const coarseStepSeconds = requireStep(comet.sampling.coarseStepSeconds, 'coarse step');
  const denseStepSeconds = requireStep(comet.sampling.denseStepSeconds, 'dense step');
  if (
    denseStepSeconds >= coarseStepSeconds ||
    coarseStepSeconds % denseStepSeconds !== 0
  ) {
    throw new Error('Dense comet cadence must evenly refine the coarse cadence.');
  }
  assertAlignedSpan(startJdTdb, endJdTdb, coarseStepSeconds);

  const perihelia = enumeratePerihelia({
    seedJdTdb: resolution.samplingSeed.perihelionJdTdb,
    periodDays: resolution.samplingSeed.periodDays,
    alternateOrbits: resolution.alternateOrbits,
    startJdTdb,
    endJdTdb,
    marginDays: comet.sampling.denseWindowDays,
  });
  const denseWindows = mergeDenseWindows(
    perihelia.map((perihelionJdTdb) => ({
      startJdTdb: snapToGrid(
        perihelionJdTdb - comet.sampling.denseWindowDays,
        startJdTdb,
        coarseStepSeconds,
        Math.floor,
      ),
      endJdTdb: snapToGrid(
        perihelionJdTdb + comet.sampling.denseWindowDays,
        startJdTdb,
        coarseStepSeconds,
        Math.ceil,
      ),
      perihelionJdTdb,
    })),
    startJdTdb,
    endJdTdb,
  );

  const segments = [];
  let cursor = startJdTdb;
  for (const window of denseWindows) {
    if (window.startJdTdb > cursor) {
      segments.push(createSegment('coarse', cursor, window.startJdTdb, coarseStepSeconds, []));
    }
    if (window.endJdTdb > window.startJdTdb) {
      segments.push(
        createSegment(
          'perihelion-dense',
          window.startJdTdb,
          window.endJdTdb,
          denseStepSeconds,
          window.periheliaJdTdb,
        ),
      );
    }
    cursor = window.endJdTdb;
  }
  if (cursor < endJdTdb) {
    segments.push(createSegment('coarse', cursor, endJdTdb, coarseStepSeconds, []));
  }
  if (segments.length === 0) {
    segments.push(createSegment('coarse', startJdTdb, endJdTdb, coarseStepSeconds, []));
  }
  return Object.freeze(segments);
}

export function planSmallBodyHorizonsRequests({
  comet,
  resolution,
  catalog,
  startDate,
  endDate,
  maxRows,
}) {
  const segments = planCometSamplingSegments({ comet, resolution, startDate, endDate });
  return segments.map((segment, segmentIndex) => {
    const chunks = planHorizonsChunks({
      startDate: segment.startDate,
      endDate: segment.endDate,
      stepSeconds: segment.stepSeconds,
      ...(maxRows === undefined ? {} : { maxRows }),
    });
    return Object.freeze({
      ...segment,
      segmentIndex,
      chunks: Object.freeze(
        chunks.map((chunk) => Object.freeze({
          ...chunk,
          url: buildSmallBodyHorizonsRequestUrl({
            comet,
            resolution,
            catalog,
            ...chunk,
            stepSeconds: segment.stepSeconds,
          }).href,
        })),
      ),
    });
  });
}

export function enumeratePerihelia({
  seedJdTdb,
  periodDays,
  alternateOrbits = [],
  startJdTdb,
  endJdTdb,
  marginDays = 0,
}) {
  if (![seedJdTdb, startJdTdb, endJdTdb, marginDays].every(Number.isFinite)) {
    throw new Error('Perihelion planning inputs must be finite.');
  }
  const lower = startJdTdb - marginDays;
  const upper = endJdTdb + marginDays;
  const epochs = [seedJdTdb];
  for (const orbit of alternateOrbits) {
    const value = orbit?.elements?.find((element) => element.name === 'tp')?.value;
    if (typeof value === 'string' && Number.isFinite(Number(value))) epochs.push(Number(value));
  }
  if (periodDays !== null) {
    if (!Number.isFinite(periodDays) || periodDays <= 0) {
      throw new Error('Periodic-comet period must be finite and positive.');
    }
    const minimumCycle = Math.floor((lower - seedJdTdb) / periodDays) - 1;
    const maximumCycle = Math.ceil((upper - seedJdTdb) / periodDays) + 1;
    for (let cycle = minimumCycle; cycle <= maximumCycle; cycle += 1) {
      epochs.push(seedJdTdb + cycle * periodDays);
    }
  }
  return [...new Set(epochs.filter((epoch) => epoch >= lower && epoch <= upper).map(roundJd))]
    .sort((left, right) => left - right);
}

function mergeDenseWindows(windows, rangeStart, rangeEnd) {
  const clipped = windows
    .map((window) => ({
      startJdTdb: Math.max(rangeStart, window.startJdTdb),
      endJdTdb: Math.min(rangeEnd, window.endJdTdb),
      periheliaJdTdb: [window.perihelionJdTdb],
    }))
    .filter((window) => window.endJdTdb > window.startJdTdb)
    .sort((left, right) => left.startJdTdb - right.startJdTdb);
  const merged = [];
  for (const window of clipped) {
    const previous = merged.at(-1);
    if (previous === undefined || window.startJdTdb > previous.endJdTdb) {
      merged.push(window);
    } else {
      previous.endJdTdb = Math.max(previous.endJdTdb, window.endJdTdb);
      previous.periheliaJdTdb.push(...window.periheliaJdTdb);
    }
  }
  return merged;
}

function createSegment(kind, startJdTdb, endJdTdb, stepSeconds, periheliaJdTdb) {
  const intervalSeconds = (endJdTdb - startJdTdb) * SECONDS_PER_DAY;
  const intervalCount = Math.round(intervalSeconds / stepSeconds);
  if (intervalCount < 1 || Math.abs(intervalSeconds - intervalCount * stepSeconds) > 0.01) {
    throw new Error(`${kind} segment is not aligned to its ${stepSeconds}s cadence.`);
  }
  return Object.freeze({
    kind,
    startJdTdb,
    endJdTdb,
    startDate: julianDayToCalendar(startJdTdb),
    endDate: julianDayToCalendar(endJdTdb),
    stepSeconds,
    sampleCount: intervalCount + 1,
    periheliaJdTdb: Object.freeze([...periheliaJdTdb].sort((a, b) => a - b)),
  });
}

function snapToGrid(value, origin, stepSeconds, rounding) {
  const stepDays = stepSeconds / SECONDS_PER_DAY;
  return roundJd(origin + rounding((value - origin) / stepDays) * stepDays);
}

function assertAlignedSpan(startJdTdb, endJdTdb, stepSeconds) {
  const intervals = ((endJdTdb - startJdTdb) * SECONDS_PER_DAY) / stepSeconds;
  if (Math.abs(intervals - Math.round(intervals)) > 1e-7) {
    throw new Error('Comet sampling range must align to the coarse cadence.');
  }
}

function requireStep(value, label) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer.`);
  return value;
}

function calendarToJulianDay(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD or YYYY-MM-DD HH:mm:ss.`);
  }
  const normalized = value.length === 10 ? `${value}T00:00:00.000Z` : `${value.replace(' ', 'T')}.000Z`;
  const milliseconds = Date.parse(normalized);
  if (!Number.isFinite(milliseconds)) throw new Error(`${label} is not a valid calendar epoch.`);
  return roundJd(milliseconds / MILLISECONDS_PER_DAY + JULIAN_DAY_UNIX_EPOCH);
}

function julianDayToCalendar(jdTdb) {
  const milliseconds = Math.round((jdTdb - JULIAN_DAY_UNIX_EPOCH) * MILLISECONDS_PER_DAY);
  const iso = new Date(milliseconds).toISOString();
  return iso.slice(0, 19).replace('T', ' ');
}

const roundJd = (value) => Math.round(value * 1e9) / 1e9;
