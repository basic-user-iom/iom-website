import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveCometCatalog } from './sbdb-resolver.mjs';
import { loadCometCatalog } from './small-body-catalog.mjs';

const APP_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function parseCometResolverCli(argv, baseDirectory = APP_DIRECTORY) {
  const options = {
    catalogPath: resolve(baseDirectory, 'src/data/catalogs/comets.json'),
    outputPath: resolve(baseDirectory, 'src/data/generated/comets.sbdb.json'),
    cacheDir: resolve(baseDirectory, '.cache/sbdb'),
    cometIds: [],
    offline: false,
    refreshCache: false,
    retries: 3,
    backoffMs: 500,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--offline') options.offline = true;
    else if (token === '--refresh-cache') options.refreshCache = true;
    else if (token === '--help' || token === '-h') options.help = true;
    else if (token === '--catalog') {
      options.catalogPath = resolve(baseDirectory, requireValue(argv, ++index, token));
    } else if (token === '--output') {
      options.outputPath = resolve(baseDirectory, requireValue(argv, ++index, token));
    } else if (token === '--cache-dir') {
      options.cacheDir = resolve(baseDirectory, requireValue(argv, ++index, token));
    } else if (token === '--comet') {
      options.cometIds.push(...parseIds(requireValue(argv, ++index, token)));
    } else if (token === '--retries') {
      options.retries = parseNonNegativeInteger(requireValue(argv, ++index, token), token);
    } else if (token === '--backoff-ms') {
      options.backoffMs = parseNonNegativeInteger(requireValue(argv, ++index, token), token);
    } else {
      throw new Error(`Unknown option: ${String(token)}`);
    }
  }

  if (options.offline && options.refreshCache) {
    throw new Error('--offline and --refresh-cache cannot be used together.');
  }
  options.cometIds = [...new Set(options.cometIds)];
  return options;
}

export function formatCometResolverHelp() {
  return [
    'Usage: node scripts/ephemeris/resolve-comets.mjs [options]',
    '',
    '  --catalog PATH       Authored comet catalog',
    '  --output PATH        Generated SBDB metadata sidecar',
    '  --cache-dir PATH     Raw official-response cache',
    '  --comet ID[,ID]      Resolve selected catalog ids only',
    '  --offline            Require cache hits; make no requests',
    '  --refresh-cache      Ignore existing cached responses',
    '  --retries N          Retry count after the initial request',
    '  --backoff-ms N       Initial exponential retry delay',
  ].join('\n');
}

export async function generateResolvedCometMetadata(options) {
  const catalog = await loadCometCatalog(pathToFileURL(options.catalogPath));
  const metadata = await resolveCometCatalog(catalog, options);
  await atomicWriteJson(options.outputPath, metadata);
  return metadata;
}

async function main() {
  const options = parseCometResolverCli(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${formatCometResolverHelp()}\n`);
    return;
  }
  const metadata = await generateResolvedCometMetadata(options);
  process.stdout.write(
    `Resolved ${metadata.comets.length} comet(s) through JPL SBDB.\n` +
      `Metadata: ${options.outputPath}\n`,
  );
}

async function atomicWriteJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, path);
}

function requireValue(argv, index, option) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`${option} requires a value.`);
  return value;
}

function parseIds(value) {
  const ids = value.split(',').map((id) => id.trim().toLowerCase()).filter(Boolean);
  if (ids.length === 0) throw new Error('--comet requires at least one id.');
  return ids;
}

function parseNonNegativeInteger(value, option) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${option} must be a non-negative integer.`);
  }
  return parsed;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}
