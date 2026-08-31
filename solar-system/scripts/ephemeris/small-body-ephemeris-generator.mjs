import { createHash } from 'node:crypto';
import { URL } from 'node:url';

import { fetchHorizonsCached } from './cache-fetch.mjs';
import { mergeParsedChunks } from './chunk-merge.mjs';
import { parseHorizonsVectors } from './horizons-parser.mjs';
import {
  createHorizonsCometBody,
  planSmallBodyHorizonsRequests,
} from './small-body-horizons.mjs';

export const SMALL_BODY_EPHEMERIS_GENERATOR_VERSION =
  'iom-small-body-ephemeris-generator/1.0.0';

/**
 * Generates uniform datasets per cadence segment. These must not be flattened
 * into IOMEPH v1, whose directory contract stores one constant step per body.
 */
export async function generateSegmentedCometEphemeris({
  comet,
  resolution,
  catalog,
  startDate,
  endDate,
  cacheDir,
  offline = false,
  refreshCache = false,
  retries = 3,
  backoffMs = 500,
  fetchImpl = globalThis.fetch,
  sleep,
  maxRows,
}) {
  const body = createHorizonsCometBody(comet, resolution);
  const requests = planSmallBodyHorizonsRequests({
    comet,
    resolution,
    catalog,
    startDate,
    endDate,
    maxRows,
  });
  const segments = [];

  for (const requestSegment of requests) {
    const chunks = [];
    const responseHashes = [];
    const retrievalDates = [];
    for (const chunk of requestSegment.chunks) {
      const response = await fetchHorizonsCached({
        url: new URL(chunk.url),
        cacheDir,
        offline,
        refreshCache,
        retries,
        backoffMs,
        fetchImpl,
        ...(sleep === undefined ? {} : { sleep }),
      });
      chunks.push(
        parseHorizonsVectors(response.text, {
          body,
          catalog,
          expectedStepSeconds: requestSegment.stepSeconds,
        }),
      );
      responseHashes.push(sha256Hex(response.text));
      retrievalDates.push(response.retrievedAtIso);
    }
    const dataset = mergeParsedChunks(chunks);
    if (
      Math.abs(dataset.startJdTdb - requestSegment.startJdTdb) * 86_400 > 0.01 ||
      Math.abs(dataset.endJdTdb - requestSegment.endJdTdb) * 86_400 > 0.01
    ) {
      throw new Error(`${comet.id} Horizons segment coverage does not match its request plan.`);
    }
    segments.push({
      ...dataset,
      kind: requestSegment.kind,
      segmentIndex: requestSegment.segmentIndex,
      periheliaJdTdb: requestSegment.periheliaJdTdb,
      sourceHash: sha256Hex(responseHashes.join('\n')),
      retrievedAtIso: [...retrievalDates].sort().at(-1),
    });
  }

  assertSegmentBoundaryContinuity(segments);
  return {
    schemaVersion: 1,
    generatorVersion: SMALL_BODY_EPHEMERIS_GENERATOR_VERSION,
    bodyId: comet.id,
    targetId: body.targetId,
    horizonsCommand: body.horizonsCommand,
    centerId: catalog.centerId,
    centerCommand: catalog.centerCommand,
    referenceFrame: catalog.referenceFrame,
    referencePlane: catalog.referencePlane,
    timeScale: catalog.timeScale,
    sourceUnits: catalog.sourceUnits,
    runtimeUnits: ['m', 'm', 'm', 'm/s', 'm/s', 'm/s'],
    cadence: 'piecewise-uniform-segments',
    segments,
  };
}

export function assertSegmentBoundaryContinuity(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error('Segmented comet ephemeris requires at least one segment.');
  }
  for (let index = 1; index < segments.length; index += 1) {
    const previous = segments[index - 1];
    const current = segments[index];
    if (
      previous.bodyId !== current.bodyId ||
      previous.targetId !== current.targetId ||
      previous.centerId !== current.centerId
    ) {
      throw new Error(`Comet segment ${index} identity contract differs.`);
    }
    const previousJd = previous.sampleJdTdb[previous.sampleCount - 1];
    const currentJd = current.sampleJdTdb[0];
    if (Math.abs(previousJd - currentJd) * 86_400 > 0.01) {
      throw new Error(`Comet segment ${index} has a coverage gap or overlap.`);
    }
    const previousOffset = (previous.sampleCount - 1) * 6;
    for (let component = 0; component < 6; component += 1) {
      const left = previous.valuesSi[previousOffset + component];
      const right = current.valuesSi[component];
      // Horizons evaluates requests independently. A daily request and a
      // six-hour request can therefore differ by a few decimetres at their
      // shared printed epoch even though both identify the same pinned JPL
      // solution. Accept only sub-100-metre / sub-micrometre-per-second
      // differences, then canonicalize the shared sample to the preceding
      // segment so the runtime route is exactly continuous. This gate remains
      // far below the independent 25 km / 250 km interpolation budgets.
      const absoluteTolerance = component < 3 ? 100 : 2e-7;
      const tolerance = Math.max(absoluteTolerance, Math.abs(left) * 1e-13);
      if (Math.abs(left - right) > tolerance) {
        throw new Error(
          `Comet segment ${index} boundary state differs at component ${component}: ` +
            `left=${left}, right=${right}, delta=${Math.abs(left - right)}, tolerance=${tolerance}.`,
        );
      }
      current.valuesSi[component] = left;
    }
  }
  return true;
}

const sha256Hex = (value) => createHash('sha256').update(value).digest('hex');
