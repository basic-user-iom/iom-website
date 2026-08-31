import { resolve } from 'node:path';
import process from 'node:process';

export const DEFAULT_START_DATE = '2000-01-01';
export const DEFAULT_END_DATE = '2100-01-01';

export function parseEphemerisCli(argv, cwd = process.cwd()) {
  const options = {
    startDate: DEFAULT_START_DATE,
    endDate: DEFAULT_END_DATE,
    stepSeconds: null,
    bodyIds: [],
    cacheDir: resolve(cwd, '.cache', 'horizons'),
    outputDir: resolve(cwd, 'src', 'data', 'generated'),
    offline: false,
    refreshCache: false,
    retries: 3,
    backoffMs: 500,
    referencesPath: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--offline') options.offline = true;
    else if (token === '--refresh-cache') options.refreshCache = true;
    else if (token === '--help' || token === '-h') options.help = true;
    else if (token === '--start') options.startDate = requireValue(argv, ++index, token);
    else if (token === '--end') options.endDate = requireValue(argv, ++index, token);
    else if (token === '--step') options.stepSeconds = parseStepSeconds(requireValue(argv, ++index, token));
    else if (token === '--body') options.bodyIds.push(...parseBodyIds(requireValue(argv, ++index, token)));
    else if (token === '--cache-dir') options.cacheDir = resolve(cwd, requireValue(argv, ++index, token));
    else if (token === '--output-dir') options.outputDir = resolve(cwd, requireValue(argv, ++index, token));
    else if (token === '--references') options.referencesPath = resolve(cwd, requireValue(argv, ++index, token));
    else if (token === '--retries') options.retries = parseNonNegativeInteger(requireValue(argv, ++index, token), token);
    else if (token === '--backoff-ms') options.backoffMs = parseNonNegativeInteger(requireValue(argv, ++index, token), token);
    else throw new Error(`Unknown option: ${String(token)}`);
  }

  validateIsoDate(options.startDate, '--start');
  validateIsoDate(options.endDate, '--end');
  if (Date.parse(`${options.startDate}T00:00:00Z`) >= Date.parse(`${options.endDate}T00:00:00Z`)) {
    throw new Error('--start must be earlier than --end.');
  }
  if (options.offline && options.refreshCache) {
    throw new Error('--offline and --refresh-cache cannot be used together.');
  }
  options.bodyIds = [...new Set(options.bodyIds)];
  return options;
}

export function parseStepSeconds(value) {
  const match = /^(\d+(?:\.\d+)?)\s*(s|sec|m|min|h|hr|d|day)$/i.exec(value.trim());
  if (match === null) throw new Error(`Invalid --step "${value}". Use values such as 6h or 1d.`);
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = unit.startsWith('d') ? 86_400 : unit.startsWith('h') ? 3_600 : unit.startsWith('m') ? 60 : 1;
  const seconds = amount * multiplier;
  if (!Number.isInteger(seconds) || seconds <= 0) {
    throw new Error('--step must resolve to a positive whole number of seconds.');
  }
  return seconds;
}

export function formatCliHelp() {
  return `Usage: node scripts/ephemeris/generate-ephemeris.mjs [options]\n\n` +
    `  --start YYYY-MM-DD   Start date (default ${DEFAULT_START_DATE})\n` +
    `  --end YYYY-MM-DD     End date (default ${DEFAULT_END_DATE})\n` +
    `  --step 6h|1d         Override catalog sampling for every body\n` +
    `  --body earth,moon    Select bodies; repeatable (default all)\n` +
    `  --cache-dir PATH     Raw-response cache directory\n` +
    `  --output-dir PATH    Generated binary/metadata directory\n` +
    `  --references PATH   Optional independent reference JSON\n` +
    `  --offline            Require cached responses; make no requests\n` +
    `  --refresh-cache      Ignore existing cached responses\n` +
    `  --retries N          Retry count after the initial request\n` +
    `  --backoff-ms N       Initial exponential retry delay`;
}

function requireValue(argv, index, option) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`${option} requires a value.`);
  return value;
}

function parseBodyIds(value) {
  const ids = value.split(',').map((id) => id.trim().toLowerCase()).filter(Boolean);
  if (ids.length === 0) throw new Error('--body requires at least one body id.');
  return ids;
}

function parseNonNegativeInteger(value, option) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${option} must be a non-negative integer.`);
  return parsed;
}

function validateIsoDate(value, option) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${option} must be a valid YYYY-MM-DD date.`);
  }
}
