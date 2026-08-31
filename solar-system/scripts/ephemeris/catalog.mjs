import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

export const DEFAULT_CATALOG_URL = new URL(
  '../../src/data/catalogs/horizons-bodies.json',
  import.meta.url,
);

export async function loadBodyCatalog(url = DEFAULT_CATALOG_URL) {
  const raw = await readFile(url, 'utf8');
  const catalog = JSON.parse(raw);
  validateBodyCatalog(catalog);
  return catalog;
}

export function validateBodyCatalog(catalog) {
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.bodies) || catalog.bodies.length === 0) {
    throw new Error('Horizons body catalog must use schemaVersion 1 and contain bodies.');
  }
  const ids = new Set();
  for (const body of catalog.bodies) {
    if (typeof body.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(body.id)) {
      throw new Error(`Invalid catalog body id: ${String(body.id)}`);
    }
    if (ids.has(body.id)) {
      throw new Error(`Duplicate catalog body id: ${body.id}`);
    }
    ids.add(body.id);
    if (typeof body.targetId !== 'string' || body.targetId.length === 0) {
      throw new Error(`Catalog body ${body.id} is missing targetId.`);
    }
    if (!Array.isArray(body.expectedTargetNames) || body.expectedTargetNames.length === 0) {
      throw new Error(`Catalog body ${body.id} requires expectedTargetNames.`);
    }
    if (!Number.isInteger(body.defaultStepSeconds) || body.defaultStepSeconds <= 0) {
      throw new Error(`Catalog body ${body.id} has an invalid defaultStepSeconds.`);
    }
    if (!isNonNegativeFinite(body.validationPositionToleranceM) ||
        !isNonNegativeFinite(body.validationVelocityToleranceMps)) {
      throw new Error(`Catalog body ${body.id} has invalid validation tolerances.`);
    }
  }
  return catalog;
}

const isNonNegativeFinite = (value) => Number.isFinite(value) && value >= 0;

export function selectCatalogBodies(catalog, requestedIds = []) {
  if (requestedIds.length === 0) {
    return [...catalog.bodies];
  }
  const byId = new Map(catalog.bodies.map((body) => [body.id, body]));
  const selected = [];
  for (const id of requestedIds) {
    const body = byId.get(id);
    if (body === undefined) {
      throw new Error(`Unknown body "${id}". Available: ${[...byId.keys()].join(', ')}`);
    }
    if (!selected.includes(body)) {
      selected.push(body);
    }
  }
  return selected;
}
