import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const JULIAN_DAY_UNIX_EPOCH = 2_440_587.5;
const MILLISECONDS_PER_DAY = 86_400_000;
const APP_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export const DEFAULT_SMALL_BODY_START_DATE = '2000-01-01';
export const DEFAULT_SMALL_BODY_END_DATE = '2100-01-01';

export function parseSmallBodyArtifactCli(argv, baseDirectory = APP_DIRECTORY) {
  const options = sharedDefaults(baseDirectory);
  Object.assign(options, {
    cacheDir: resolve(baseDirectory, '.cache/horizons-small-bodies'),
    outputDir: resolve(baseDirectory, 'src/data/generated'),
    offline: false,
    refreshCache: false,
    retries: 3,
    backoffMs: 500,
    validationIntervals: 1,
    validationSeed: 'iom-small-body-validation-v1',
    help: false,
  });

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--offline') options.offline = true;
    else if (token === '--refresh-cache') options.refreshCache = true;
    else if (token === '--help' || token === '-h') options.help = true;
    else if (token === '--start') options.startDate = requireValue(argv, ++index, token);
    else if (token === '--end') options.endDate = requireValue(argv, ++index, token);
    else if (token === '--catalog') {
      options.catalogPath = resolve(baseDirectory, requireValue(argv, ++index, token));
    } else if (token === '--resolutions') {
      options.resolutionsPath = resolve(baseDirectory, requireValue(argv, ++index, token));
    } else if (token === '--horizons-catalog') {
      options.horizonsCatalogPath = resolve(baseDirectory, requireValue(argv, ++index, token));
    } else if (token === '--cache-dir') {
      options.cacheDir = resolve(baseDirectory, requireValue(argv, ++index, token));
    } else if (token === '--output-dir') {
      options.outputDir = resolve(baseDirectory, requireValue(argv, ++index, token));
    } else if (token === '--retries') {
      options.retries = nonNegativeInteger(requireValue(argv, ++index, token), token);
    } else if (token === '--backoff-ms') {
      options.backoffMs = nonNegativeInteger(requireValue(argv, ++index, token), token);
    } else if (token === '--validation-intervals') {
      options.validationIntervals = positiveInteger(requireValue(argv, ++index, token), token);
    } else if (token === '--validation-seed') {
      options.validationSeed = requireValue(argv, ++index, token);
    } else {
      throw new Error(`Unknown option: ${String(token)}`);
    }
  }
  validateSharedOptions(options);
  if (options.offline && options.refreshCache) {
    throw new Error('--offline and --refresh-cache cannot be used together.');
  }
  return options;
}

export function parseSmallBodyVerifyCli(argv, baseDirectory = APP_DIRECTORY) {
  const options = sharedDefaults(baseDirectory);
  Object.assign(options, {
    directory: resolve(baseDirectory, 'src/data/generated'),
    help: false,
  });
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') options.help = true;
    else if (token === '--start') options.startDate = requireValue(argv, ++index, token);
    else if (token === '--end') options.endDate = requireValue(argv, ++index, token);
    else if (token === '--directory') {
      options.directory = resolve(baseDirectory, requireValue(argv, ++index, token));
    } else if (token === '--catalog') {
      options.catalogPath = resolve(baseDirectory, requireValue(argv, ++index, token));
    } else if (token === '--resolutions') {
      options.resolutionsPath = resolve(baseDirectory, requireValue(argv, ++index, token));
    } else if (token === '--horizons-catalog') {
      options.horizonsCatalogPath = resolve(baseDirectory, requireValue(argv, ++index, token));
    } else {
      throw new Error(`Unknown option: ${String(token)}`);
    }
  }
  validateSharedOptions(options);
  return options;
}

export function formatSmallBodyArtifactHelp() {
  return [
    'Usage: node scripts/ephemeris/generate-small-body-artifacts.mjs [options]',
    '',
    `  --start YYYY-MM-DD          Start date (default ${DEFAULT_SMALL_BODY_START_DATE})`,
    `  --end YYYY-MM-DD            End date (default ${DEFAULT_SMALL_BODY_END_DATE})`,
    '  --catalog PATH              Authored five-comet catalog',
    '  --resolutions PATH          Generated JPL SBDB resolution sidecar',
    '  --horizons-catalog PATH     Horizons frame/center catalog',
    '  --cache-dir PATH            Raw Horizons response cache',
    '  --output-dir PATH           Directory for the four release artifacts',
    '  --validation-intervals N    Withheld intervals per physical segment',
    '  --validation-seed TEXT      Deterministic withheld-epoch seed',
    '  --offline                   Require cached range and TLIST responses',
    '  --refresh-cache             Ignore existing cached Horizons responses',
    '  --retries N                 Retry count after the initial request',
    '  --backoff-ms N              Initial exponential retry delay',
  ].join('\n');
}

export function formatSmallBodyVerifyHelp() {
  return [
    'Usage: node scripts/ephemeris/verify-small-body-release.mjs [options]',
    '',
    '  --directory PATH            Directory containing the four artifacts',
    `  --start YYYY-MM-DD          Expected start date (default ${DEFAULT_SMALL_BODY_START_DATE})`,
    `  --end YYYY-MM-DD            Expected end date (default ${DEFAULT_SMALL_BODY_END_DATE})`,
    '  --catalog PATH              Authored five-comet catalog',
    '  --resolutions PATH          Generated JPL SBDB resolution sidecar',
    '  --horizons-catalog PATH     Horizons frame/center catalog',
  ].join('\n');
}

export function calendarDateToJdTdb(value, label = 'date') {
  validateDate(value, label);
  return Date.parse(`${value}T00:00:00.000Z`) / MILLISECONDS_PER_DAY +
    JULIAN_DAY_UNIX_EPOCH;
}

function sharedDefaults(baseDirectory) {
  return {
    startDate: DEFAULT_SMALL_BODY_START_DATE,
    endDate: DEFAULT_SMALL_BODY_END_DATE,
    catalogPath: resolve(baseDirectory, 'src/data/catalogs/comets.json'),
    resolutionsPath: resolve(baseDirectory, 'src/data/generated/comets.sbdb.json'),
    horizonsCatalogPath: resolve(baseDirectory, 'src/data/catalogs/horizons-bodies.json'),
  };
}

function validateSharedOptions(options) {
  validateDate(options.startDate, '--start');
  validateDate(options.endDate, '--end');
  if (calendarDateToJdTdb(options.startDate) >= calendarDateToJdTdb(options.endDate)) {
    throw new Error('--start must be earlier than --end.');
  }
}

function validateDate(value, option) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
  ) {
    throw new Error(`${option} must be a valid YYYY-MM-DD date.`);
  }
}

function requireValue(argv, index, option) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`${option} requires a value.`);
  return value;
}

function positiveInteger(value, option) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${option} must be a positive integer.`);
  }
  return parsed;
}

function nonNegativeInteger(value, option) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${option} must be a non-negative integer.`);
  }
  return parsed;
}
