import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = path.resolve(SCRIPT_DIR, '..', '..', 'public', 'assets', 'moons');
const manifest = JSON.parse(await readFile(path.join(ASSET_DIR, 'manifest.json'), 'utf8'));

if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets) || manifest.assets.length < 10) {
  throw new Error('Major-moon texture manifest is missing required records.');
}

for (const asset of manifest.assets) {
  const bytes = await readFile(path.join(ASSET_DIR, asset.file));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== asset.sha256) throw new Error(`${asset.id} texture checksum mismatch.`);
  const metadata = await sharp(bytes).metadata();
  if (metadata.width !== asset.width || metadata.height !== asset.height) {
    throw new Error(`${asset.id} texture dimensions do not match the manifest.`);
  }
}

console.log(`Verified ${manifest.assets.length} NASA-derived Sun and major-moon texture assets.`);
