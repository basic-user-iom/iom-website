import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { URL } from 'node:url';

import { cacheKeyForUrl } from './cache-fetch.mjs';

const OFFICIAL_SBDB_ORIGIN = 'https://ssd-api.jpl.nasa.gov';
const OFFICIAL_SBDB_PATH = '/sbdb.api';

export async function fetchSbdbCached({
  url,
  cacheDir,
  offline = false,
  refreshCache = false,
  retries = 3,
  backoffMs = 500,
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
}) {
  const requestUrl = assertOfficialSbdbUrl(url);
  const key = cacheKeyForUrl(requestUrl);
  const cachePath = join(cacheDir, `${key}.json`);
  if (!refreshCache) {
    const cached = await readOptionalUtf8(cachePath);
    if (cached !== null) {
      assertJsonObject(cached, 'cached SBDB response');
      const cacheStat = await stat(cachePath);
      return {
        text: cached,
        cachePath,
        cacheHit: true,
        retrievedAtIso: cacheStat.mtime.toISOString(),
      };
    }
  }
  if (offline) {
    throw new Error(`Offline cache miss for SBDB request ${key} (${cachePath}).`);
  }
  if (typeof fetchImpl !== 'function') throw new Error('No fetch implementation is available.');

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(requestUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'iom-solar-system-small-body/1',
        },
      });
      const text = await response.text();
      assertJsonObject(text, 'SBDB response');
      if (!response.ok) {
        const error = new Error(`SBDB HTTP ${response.status}: ${text.slice(0, 240)}`);
        error.retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        error.responseText = text;
        throw error;
      }

      await mkdir(cacheDir, { recursive: true });
      const temporaryPath = `${cachePath}.${process.pid}.tmp`;
      await writeFile(temporaryPath, text, 'utf8');
      await rename(temporaryPath, cachePath);
      return {
        text,
        cachePath,
        cacheHit: false,
        retrievedAtIso: new Date().toISOString(),
      };
    } catch (error) {
      lastError = error;
      const retryable = error?.retryable !== false;
      if (!retryable || attempt === retries) break;
      await sleep(backoffMs * 2 ** attempt);
    }
  }
  throw new Error(`SBDB request failed after ${retries + 1} attempt(s).`, { cause: lastError });
}

export function assertOfficialSbdbUrl(value) {
  const url = value instanceof URL ? value : new URL(String(value));
  if (url.origin !== OFFICIAL_SBDB_ORIGIN || url.pathname !== OFFICIAL_SBDB_PATH) {
    throw new Error(`SBDB requests must use ${OFFICIAL_SBDB_ORIGIN}${OFFICIAL_SBDB_PATH}.`);
  }
  if (url.username !== '' || url.password !== '' || url.hash !== '') {
    throw new Error('SBDB request URL must not contain credentials or a fragment.');
  }
  return url;
}

function assertJsonObject(text, label) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const invalidJson = new Error(`${label} is not valid JSON.`, { cause: error });
    invalidJson.retryable = false;
    throw invalidJson;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    const schemaError = new Error(`${label} must be a JSON object.`);
    schemaError.retryable = false;
    throw schemaError;
  }
  return value;
}

async function readOptionalUtf8(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

const defaultSleep = (milliseconds) => delay(milliseconds);
