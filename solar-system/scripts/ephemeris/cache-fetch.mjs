import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

export function cacheKeyForUrl(url) {
  return createHash('sha256').update(String(url)).digest('hex');
}

export async function fetchHorizonsCached({
  url,
  cacheDir,
  offline = false,
  refreshCache = false,
  retries = 3,
  backoffMs = 500,
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
}) {
  const key = cacheKeyForUrl(url);
  const cachePath = join(cacheDir, `${key}.json`);
  if (!refreshCache) {
    const cached = await readOptionalUtf8(cachePath);
    if (cached !== null) {
      const cacheStat = await stat(cachePath);
      return { text: cached, cachePath, cacheHit: true, retrievedAtIso: cacheStat.mtime.toISOString() };
    }
  }
  if (offline) {
    throw new Error(`Offline cache miss for Horizons request ${key} (${cachePath}).`);
  }
  if (typeof fetchImpl !== 'function') throw new Error('No fetch implementation is available.');

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'iom-solar-system-ephemeris/1' },
      });
      const text = await response.text();
      if (!response.ok) {
        const error = new Error(`Horizons HTTP ${response.status}: ${text.slice(0, 240)}`);
        error.retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        throw error;
      }
      assertHorizonsJsonEnvelope(text);
      await mkdir(cacheDir, { recursive: true });
      const temporaryPath = `${cachePath}.${process.pid}.tmp`;
      await writeFile(temporaryPath, text, 'utf8');
      await rename(temporaryPath, cachePath);
      return { text, cachePath, cacheHit: false, retrievedAtIso: new Date().toISOString() };
    } catch (error) {
      lastError = error;
      const retryable = error?.retryable !== false;
      if (!retryable || attempt === retries) break;
      await sleep(backoffMs * 2 ** attempt);
    }
  }
  throw new Error(
    `Horizons request failed after ${retries + 1} attempt(s): ` +
      `${lastError instanceof Error ? lastError.message : String(lastError)}`,
    { cause: lastError },
  );
}

export function assertHorizonsJsonEnvelope(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error('Horizons returned invalid JSON.', { cause: error });
  }
  if (typeof payload.error === 'string' && payload.error.length > 0) {
    const apiError = new Error(`Horizons API error: ${payload.error}`);
    apiError.retryable = false;
    throw apiError;
  }
  if (typeof payload.result !== 'string') {
    const schemaError = new Error('Horizons JSON response is missing the result text.');
    schemaError.retryable = false;
    throw schemaError;
  }
  return payload;
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
