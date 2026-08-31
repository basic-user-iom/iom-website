import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { URL } from 'node:url';

import { parseCometResolverCli } from '../resolve-comets.mjs';
import {
  SbdbAmbiguousMatchError,
  buildSbdbResolveUrl,
  parseSbdbResolution,
} from '../sbdb-resolver.mjs';
import {
  fetchSbdbCached,
} from '../small-body-cache.mjs';
import {
  loadCometCatalog,
  validateCometCatalog,
} from '../small-body-catalog.mjs';
import {
  buildSmallBodyHorizonsCommand,
  buildSmallBodyHorizonsRecordCommand,
  enumeratePerihelia,
  planCometSamplingSegments,
  planSmallBodyHorizonsRequests,
} from '../small-body-horizons.mjs';
import {
  assertSegmentBoundaryContinuity,
  generateSegmentedCometEphemeris,
} from '../small-body-ephemeris-generator.mjs';

const fixtureUrl = (name) => new URL(`./fixtures/${name}`, import.meta.url);
const readFixture = (name) => readFile(fixtureUrl(name), 'utf8');

test('versioned runtime catalog contains five unique, validated JPL comet identities', async () => {
  const catalog = await loadCometCatalog();
  assert.equal(catalog.catalogVersion, 'phase6-comets/1.0.0');
  assert.deepEqual(
    catalog.comets.map((comet) => comet.displayName),
    [
      '1P/Halley',
      '2P/Encke',
      '67P/Churyumov-Gerasimenko',
      'C/1995 O1 (Hale-Bopp)',
      'C/2020 F3 (NEOWISE)',
    ],
  );
  assert.equal(new Set(catalog.comets.map((comet) => comet.jpl.spkId)).size, 5);
  assert.deepEqual(
    catalog.comets.map((comet) => comet.jpl.horizonsRecordId),
    ['90000030', '90000091', '90000703', null, null],
  );
  assert.equal(catalog.sourcePolicy.normalRuntimeNetworkRequests, false);

  const invalid = cloneJson(catalog);
  invalid.comets[1].jpl.spkId = invalid.comets[0].jpl.spkId;
  assert.throws(() => validateCometCatalog(invalid), /Duplicate JPL SPK id/);
});

test('generated SBDB sidecar joins every pinned catalog solution with complete provenance', async () => {
  const catalog = await loadCometCatalog();
  const metadata = JSON.parse(
    await readFile(new URL('../../../src/data/generated/comets.sbdb.json', import.meta.url), 'utf8'),
  );
  assert.equal(metadata.schemaVersion, 1);
  assert.equal(metadata.catalogVersion, catalog.catalogVersion);
  assert.equal(metadata.comets.length, 5);
  const generatedById = new Map(metadata.comets.map((comet) => [comet.id, comet]));
  for (const comet of catalog.comets) {
    const generated = generatedById.get(comet.id);
    assert.ok(generated, `missing generated metadata for ${comet.id}`);
    assert.equal(generated.identity.spkid, comet.jpl.spkId);
    assert.equal(generated.orbit.orbit_id, comet.jpl.orbitId);
    assert.equal(Number(generated.orbit.epoch), comet.jpl.epochJdTdb);
    assert.ok(Array.isArray(generated.orbit.covariance.labels));
    assert.ok(Array.isArray(generated.orbit.model_pars));
    assert.ok(Array.isArray(generated.physicalParameters));
    assert.equal(generated.provenance.provider, 'JPL_SBDB');
    assert.equal(generated.provenance.endpoint, 'https://ssd-api.jpl.nasa.gov/sbdb.api');
    assert.match(generated.provenance.sourceHashSha256, /^[a-f0-9]{64}$/);
  }
});

test('SBDB request is exact, official-only, and asks for full scientific metadata', async () => {
  const catalog = await loadCometCatalog();
  const url = buildSbdbResolveUrl(catalog.comets[2]);
  assert.equal(url.origin, 'https://ssd-api.jpl.nasa.gov');
  assert.equal(url.pathname, '/sbdb.api');
  assert.equal(url.searchParams.get('des'), '67P');
  assert.equal(url.searchParams.get('full-prec'), '1');
  assert.equal(url.searchParams.get('cov'), 'mat');
  assert.equal(url.searchParams.get('phys-par'), '1');
  assert.equal(url.searchParams.get('alt-orbits'), '1');
  assert.equal(url.searchParams.has('sstr'), false);
});

test('SBDB parser verifies identity and preserves epochs, covariance, model, and physical fields', async () => {
  const catalog = await loadCometCatalog();
  const comet = catalog.comets[2];
  const text = await readFixture('sbdb-67p.json');
  const requestUrl = buildSbdbResolveUrl(comet);
  const resolved = parseSbdbResolution(text, {
    comet,
    requestUrl,
    retrievedAtIso: '2026-08-29T12:00:00.000Z',
  });

  assert.equal(resolved.identity.fullname, '67P/Churyumov-Gerasimenko');
  assert.equal(resolved.orbit.epoch, '2457305.5');
  assert.equal(comet.jpl.orbitId, 'K213/6');
  assert.equal(comet.jpl.epochJdTdb, 2457305.5);
  assert.deepEqual(resolved.orbit.covariance.labels, ['e', 'q']);
  assert.equal(resolved.orbit.covariance.data[0][0], '7.543E-16');
  assert.equal(resolved.orbit.model_pars[0].name, 'A1');
  assert.equal(resolved.physicalParameters[1].value, '4.3x4.1x2.6');
  assert.equal(resolved.samplingSeed.perihelionJdTdb, Number('2457247.588657863465'));
  assert.equal(resolved.samplingSeed.periodDays, 2353.076067532089);
  assert.match(resolved.provenance.sourceHashSha256, /^[a-f0-9]{64}$/);
});

test('SBDB parser refuses ambiguous, wrong-kind, and mismatched identity payloads', async () => {
  const catalog = await loadCometCatalog();
  const comet = catalog.comets[2];
  const options = {
    comet,
    requestUrl: buildSbdbResolveUrl(comet),
    retrievedAtIso: '2026-08-29T12:00:00.000Z',
  };
  assert.throws(
    () => parseSbdbResolution(awaitText('sbdb-ambiguous.json'), options),
    SbdbAmbiguousMatchError,
  );

  const payload = JSON.parse(await readFixture('sbdb-67p.json'));
  payload.object.kind = 'an';
  assert.throws(() => parseSbdbResolution(JSON.stringify(payload), options), /non-comet/);
  payload.object.kind = 'cn';
  payload.object.spkid = '999';
  assert.throws(() => parseSbdbResolution(JSON.stringify(payload), options), /SPK id mismatch/);
  payload.object.spkid = comet.jpl.spkId;
  payload.signature.version = '99.0';
  assert.throws(() => parseSbdbResolution(JSON.stringify(payload), options), /Unsupported SBDB/);
});

test('SBDB cache supports deterministic offline reuse and rejects non-JPL endpoints', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'iom-sbdb-test-'));
  const text = await readFixture('sbdb-67p.json');
  const url = new URL('https://ssd-api.jpl.nasa.gov/sbdb.api?des=67P');
  let fetchCount = 0;
  try {
    const first = await fetchSbdbCached({
      url,
      cacheDir: directory,
      retries: 0,
      fetchImpl: async () => {
        fetchCount += 1;
        return { ok: true, status: 200, text: async () => text };
      },
    });
    assert.equal(first.cacheHit, false);
    const second = await fetchSbdbCached({
      url,
      cacheDir: directory,
      offline: true,
      fetchImpl: async () => {
        throw new Error('offline cache hit must not fetch');
      },
    });
    assert.equal(second.cacheHit, true);
    assert.equal(second.text, text);
    assert.equal(fetchCount, 1);
    await assert.rejects(
      fetchSbdbCached({
        url: new URL('https://example.com/sbdb.api?des=67P'),
        cacheDir: directory,
      }),
      /must use https:\/\/ssd-api\.jpl\.nasa\.gov\/sbdb\.api/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('resolver CLI keeps cache/output paths isolated and rejects incompatible modes', () => {
  const options = parseCometResolverCli(
    ['--comet', '1p-halley,67p-churyumov-gerasimenko', '--offline'],
    'C:/fixture/solar-system',
  );
  assert.deepEqual(options.cometIds, ['1p-halley', '67p-churyumov-gerasimenko']);
  assert.match(options.cacheDir.replaceAll('\\', '/'), /solar-system\/\.cache\/sbdb$/);
  assert.match(options.outputPath.replaceAll('\\', '/'), /generated\/comets\.sbdb\.json$/);
  assert.throws(
    () => parseCometResolverCli(['--offline', '--refresh-cache']),
    /cannot be used together/,
  );
});

test('small-body Horizons commands use exact designation or pinned-record syntax', () => {
  assert.equal(buildSmallBodyHorizonsCommand('2020 F3'), 'DES=2020 F3;');
  assert.equal(buildSmallBodyHorizonsRecordCommand('90000030'), '90000030;');
  assert.throws(() => buildSmallBodyHorizonsCommand('2020 F3; LIST'), /no directives/);
  assert.throws(() => buildSmallBodyHorizonsCommand('2020*'), /no directives/);
  assert.throws(() => buildSmallBodyHorizonsRecordCommand('1000036'), /eight-digit JPL comet record/);
});

test('perihelion planner creates boundary-aligned dense segments and exact JPL URLs', async () => {
  const catalog = await loadCometCatalog();
  const comet = cloneJson(catalog.comets[4]);
  comet.sampling.denseWindowDays = 30;
  const resolution = {
    id: comet.id,
    identity: { spkid: comet.jpl.spkId },
    alternateOrbits: [],
    samplingSeed: { perihelionJdTdb: 2459034.178898044, periodDays: null },
  };
  const segments = planCometSamplingSegments({
    comet,
    resolution,
    startDate: '2020-01-01',
    endDate: '2021-01-01',
  });
  assert.equal(segments.length, 3);
  assert.deepEqual(segments.map((segment) => segment.kind), [
    'coarse',
    'perihelion-dense',
    'coarse',
  ]);
  assert.deepEqual(segments.map((segment) => segment.stepSeconds), [86_400, 21_600, 86_400]);
  assert.equal(segments[0].endJdTdb, segments[1].startJdTdb);
  assert.equal(segments[1].endJdTdb, segments[2].startJdTdb);

  const requests = planSmallBodyHorizonsRequests({
    comet,
    resolution,
    catalog: horizonsCatalog(),
    startDate: '2020-01-01',
    endDate: '2021-01-01',
    maxRows: 100,
  });
  const urls = requests.flatMap((segment) => segment.chunks.map((chunk) => new URL(chunk.url)));
  assert.ok(urls.length > 3);
  for (const url of urls) {
    assert.equal(url.origin, 'https://ssd.jpl.nasa.gov');
    assert.equal(url.searchParams.get('COMMAND'), "'DES=2020 F3;'");
    assert.equal(url.searchParams.get('CENTER'), "'500@10'");
  }
});

test('periodic perihelion enumeration is deterministic and limited to the requested range', () => {
  assert.deepEqual(
    enumeratePerihelia({
      seedJdTdb: 2_450_100,
      periodDays: 100,
      startJdTdb: 2_450_000,
      endJdTdb: 2_450_350,
      marginDays: 0,
    }),
    [2_450_000, 2_450_100, 2_450_200, 2_450_300],
  );
});

test('segmented generator fetches uniform cadence pieces and verifies shared states', async () => {
  const catalog = await loadCometCatalog();
  const comet = cloneJson(catalog.comets[2]);
  comet.sampling.denseWindowDays = 1;
  const startJdTdb = calendarJd('2020-01-01 00:00:00');
  const resolution = {
    id: comet.id,
    identity: { spkid: comet.jpl.spkId },
    alternateOrbits: [],
    samplingSeed: { perihelionJdTdb: startJdTdb + 2, periodDays: null },
  };
  const directory = await mkdtemp(join(tmpdir(), 'iom-horizons-comet-test-'));
  const requestedUrls = [];
  try {
    const generated = await generateSegmentedCometEphemeris({
      comet,
      resolution,
      catalog: horizonsCatalog(),
      startDate: '2020-01-01',
      endDate: '2020-01-05',
      cacheDir: directory,
      refreshCache: true,
      retries: 0,
      maxRows: 100,
      fetchImpl: async (url) => {
        requestedUrls.push(String(url));
        return { ok: true, status: 200, text: async () => horizonsFixtureForUrl(url) };
      },
    });
    assert.equal(generated.cadence, 'piecewise-uniform-segments');
    assert.equal(generated.targetId, comet.jpl.spkId);
    assert.deepEqual(generated.segments.map((segment) => segment.stepSeconds), [86_400, 21_600, 86_400]);
    assert.equal(assertSegmentBoundaryContinuity(generated.segments), true);
    assert.ok(requestedUrls.every((url) => url.startsWith('https://ssd.jpl.nasa.gov/api/horizons.api?')));
    assert.ok(requestedUrls.every((url) => new URL(url).searchParams.get('COMMAND') === "'90000703;'"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function horizonsCatalog() {
  return {
    centerId: '10',
    centerCommand: '500@10',
    referenceFrame: 'ICRF',
    referencePlane: 'ECLIPTIC',
    timeScale: 'TDB',
    sourceUnits: 'KM-S',
  };
}

function horizonsFixtureForUrl(value) {
  const url = value instanceof URL ? value : new URL(String(value));
  const start = unquote(url.searchParams.get('START_TIME'));
  const end = unquote(url.searchParams.get('STOP_TIME'));
  const step = unquote(url.searchParams.get('STEP_SIZE'));
  const stepSeconds = step.endsWith(' d')
    ? Number.parseInt(step, 10) * 86_400
    : Number.parseInt(step, 10) * 3_600;
  const startJdTdb = calendarJd(start);
  const endJdTdb = calendarJd(end);
  const rows = [];
  const count = Math.round(((endJdTdb - startJdTdb) * 86_400) / stepSeconds) + 1;
  for (let index = 0; index < count; index += 1) {
    const jd = startJdTdb + (index * stepSeconds) / 86_400;
    const state = [
      jd - 2_450_000,
      (jd - 2_450_000) * 2,
      (jd - 2_450_000) * -0.5,
      1,
      2,
      3,
    ].map((number) => number.toFixed(12));
    rows.push(`${jd.toFixed(12)}, A.D. fixture, ${state.join(',')},`);
  }
  return JSON.stringify({
    signature: { source: 'NASA/JPL Horizons API', version: '1.2' },
    result: [
      'Target body name: 67P/Churyumov-Gerasimenko       {source: JPL#K213/6}',
      'Center body name: Sun (10) {source: DE441}',
      'Center-site name: BODY CENTER',
      `Start time      : A.D. ${start} TDB`,
      `Stop  time      : A.D. ${end} TDB`,
      'Output units    : KM-S',
      'Output type     : GEOMETRIC cartesian states',
      'Output format   : 2 (position and velocity)',
      'Reference frame : Ecliptic of J2000.0',
      'JDTDB, Calendar Date (TDB), X, Y, Z, VX, VY, VZ,',
      '$$SOE',
      ...rows,
      '$$EOE',
    ].join('\n'),
  });
}

function calendarJd(value) {
  const normalized = value.replace(' ', 'T').replace(/Z$/, '');
  return Date.parse(`${normalized}Z`) / 86_400_000 + 2_440_587.5;
}

function unquote(value) {
  return value.replace(/^'(.*)'$/, '$1');
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function awaitText(name) {
  // Deliberately synchronous-looking fixture helper for assert.throws callers.
  // The fixture is tiny and imported through a top-level cache below.
  return fixtureCache.get(name);
}

const fixtureCache = new Map([
  ['sbdb-ambiguous.json', await readFixture('sbdb-ambiguous.json')],
]);
