import { URL } from 'node:url';

import { sha256Hex } from './binary-format.mjs';
import { fetchHorizonsCached } from './cache-fetch.mjs';
import { parseHorizonsReferenceVectors } from './horizons-parser.mjs';
import { buildHorizonsTlistRequestUrl } from './horizons-request.mjs';
import { createHorizonsCometBody } from './small-body-horizons.mjs';

const SECONDS_PER_DAY = 86_400;

export const SMALL_BODY_MAX_TLIST_EPOCHS_PER_REQUEST = 24;
export const SMALL_BODY_REFERENCE_SOURCE_NAME =
  'NASA/JPL Horizons withheld TLIST reference samples';
export const SMALL_BODY_REFERENCE_SOURCE_METHOD =
  'Separate cached TLIST requests at deterministic quarter-step epochs; samples are never copied from the generated cadence grid.';

export const SMALL_BODY_REFERENCE_FRACTIONS = Object.freeze([0.25, 0.5, 0.75]);
export const SMALL_BODY_VALIDATION_TOLERANCES = Object.freeze({
  baseline: Object.freeze({
    positionToleranceM: 250_000,
    velocityToleranceMps: 5,
  }),
  perihelion: Object.freeze({
    positionToleranceM: 25_000,
    velocityToleranceMps: 1,
  }),
});

/** Fetches one independent Horizons TLIST response per logical comet. */
export async function fetchSmallBodyValidationReferences({
  cometCatalog,
  resolutions,
  horizonsCatalog,
  routing,
  datasetId,
  cacheDir,
  offline = false,
  refreshCache = false,
  retries = 3,
  backoffMs = 500,
  intervalsPerSegment = 1,
  seed = 'iom-small-body-validation-v1',
  fetchImpl = globalThis.fetch,
  sleep,
}) {
  if (routing.datasetId !== datasetId) {
    throw new Error('Small-body validation routing does not match datasetId.');
  }
  const resolutionsById = new Map(resolutions.map((entry) => [entry.id, entry]));
  const routingById = new Map(routing.bodies.map((entry) => [entry.bodyId, entry]));
  const samples = [];
  const requests = [];

  // Deliberately sequential: generation should not burst requests at JPL.
  for (const comet of cometCatalog.comets) {
    const resolution = resolutionsById.get(comet.id);
    const routeBody = routingById.get(comet.id);
    if (resolution === undefined || routeBody === undefined) {
      throw new Error(`Cannot validate ${comet.id}; resolution or routing is missing.`);
    }
    const body = createHorizonsCometBody(comet, resolution);
    const descriptors = selectSmallBodyWithheldEpochs({
      routeBody,
      intervalsPerSegment,
      seed,
    });
    const responseHashes = [];
    const retrievalDates = [];
    let targetSource = null;
    let sourceSignature = null;
    let parsedSampleCount = 0;
    const descriptorChunks = chunkArray(
      descriptors,
      SMALL_BODY_MAX_TLIST_EPOCHS_PER_REQUEST,
    );
    for (const descriptorChunk of descriptorChunks) {
      const epochs = descriptorChunk.map((descriptor) => descriptor.jdTdb);
      const url = buildHorizonsTlistRequestUrl({
        body,
        catalog: horizonsCatalog,
        jdTdb: epochs,
      });
      const response = await fetchHorizonsCached({
        url: new URL(url),
        cacheDir,
        offline,
        refreshCache,
        retries,
        backoffMs,
        fetchImpl,
        ...(sleep === undefined ? {} : { sleep }),
      });
      const parsed = parseHorizonsReferenceVectors(response.text, {
        body,
        catalog: horizonsCatalog,
        expectedJdTdb: epochs,
      });
      if (
        (targetSource !== null && parsed.targetSource !== targetSource) ||
        (sourceSignature !== null &&
          (parsed.sourceSignature.source !== sourceSignature.source ||
            parsed.sourceSignature.version !== sourceSignature.version))
      ) {
        throw new Error(`${comet.id} withheld TLIST chunks disagree on source identity.`);
      }
      targetSource = parsed.targetSource;
      sourceSignature = parsed.sourceSignature;
      for (let index = 0; index < parsed.samples.length; index += 1) {
        const sample = parsed.samples[index];
        const descriptor = descriptorChunk[index];
        const tolerance = SMALL_BODY_VALIDATION_TOLERANCES[descriptor.kind];
        samples.push({
          ...sample,
          bodyId: descriptor.seriesBodyId,
          logicalBodyId: comet.id,
          segmentKind: descriptor.kind,
          positionToleranceM: tolerance.positionToleranceM,
          velocityToleranceMps: tolerance.velocityToleranceMps,
        });
      }
      parsedSampleCount += parsed.samples.length;
      responseHashes.push(sha256Hex(response.text));
      retrievalDates.push(response.retrievedAtIso);
    }
    requests.push({
      bodyId: comet.id,
      targetId: comet.jpl.spkId,
      horizonsCommand: body.horizonsCommand,
      targetSource,
      sourceSignature,
      sourceHash: sha256Hex(responseHashes.join('\n')),
      retrievedAtIso: [...retrievalDates].sort().at(-1),
      chunkCount: descriptorChunks.length,
      sampleCount: parsedSampleCount,
    });
  }

  return {
    schemaVersion: 1,
    independent: true,
    sourceName: SMALL_BODY_REFERENCE_SOURCE_NAME,
    sourceMethod: SMALL_BODY_REFERENCE_SOURCE_METHOD,
    generatedAtIso: new Date().toISOString(),
    datasetId,
    seed,
    samplingFractions: SMALL_BODY_REFERENCE_FRACTIONS,
    intervalsPerSegment,
    tolerancesBySegmentKind: SMALL_BODY_VALIDATION_TOLERANCES,
    requests,
    samples,
  };
}

function chunkArray(values, maximumLength) {
  const chunks = [];
  for (let index = 0; index < values.length; index += maximumLength) {
    chunks.push(values.slice(index, index + maximumLength));
  }
  return chunks;
}

/**
 * Selects deterministic strata independently inside every physical series.
 * Returning routing descriptors prevents a logical comet reference from being
 * accidentally compared with the wrong segment in the packed binary.
 */
export function selectSmallBodyWithheldEpochs({
  routeBody,
  intervalsPerSegment = 1,
  seed = 'iom-small-body-validation-v1',
}) {
  if (!Number.isInteger(intervalsPerSegment) || intervalsPerSegment <= 0) {
    throw new Error('intervalsPerSegment must be a positive integer.');
  }
  if (typeof routeBody?.bodyId !== 'string' || !Array.isArray(routeBody.segments)) {
    throw new Error('Withheld-epoch selection requires a logical routing body.');
  }
  const descriptors = [];
  for (const segment of routeBody.segments) {
    const totalIntervals = Math.round(
      ((segment.endJdTdb - segment.startJdTdb) * SECONDS_PER_DAY) /
        segment.stepSeconds,
    );
    if (totalIntervals < 1) {
      throw new Error(`${segment.seriesBodyId} has no interpolation intervals.`);
    }
    const count = Math.min(intervalsPerSegment, totalIntervals);
    let state = hashSeed(`${seed}:${routeBody.bodyId}:${segment.seriesBodyId}`);
    for (let stratum = 0; stratum < count; stratum += 1) {
      const first = Math.floor((stratum * totalIntervals) / count);
      const exclusiveEnd = Math.floor(((stratum + 1) * totalIntervals) / count);
      const width = Math.max(1, exclusiveEnd - first);
      state = nextState(state);
      const intervalIndex = first + (state % width);
      for (const fraction of SMALL_BODY_REFERENCE_FRACTIONS) {
        descriptors.push({
          bodyId: routeBody.bodyId,
          seriesBodyId: segment.seriesBodyId,
          kind: segment.kind,
          jdTdb:
            segment.startJdTdb +
            ((intervalIndex + fraction) * segment.stepSeconds) / SECONDS_PER_DAY,
        });
      }
    }
  }
  descriptors.sort((left, right) => left.jdTdb - right.jdTdb);
  for (let index = 1; index < descriptors.length; index += 1) {
    if (!(descriptors[index].jdTdb > descriptors[index - 1].jdTdb)) {
      throw new Error(`${routeBody.bodyId} withheld validation epochs are not unique.`);
    }
  }
  return descriptors;
}

function hashSeed(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function nextState(state) {
  let next = state;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
}
