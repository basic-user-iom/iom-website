import { createHash } from 'node:crypto'
import { basename, extname, isAbsolute, relative, resolve } from 'node:path'
import { lstatSync, readFileSync, realpathSync } from 'node:fs'

export const PUBLIC_ORIGIN = 'https://assets.iobjectm.com'
export const MANIFEST_FILE = '.iom-r2-release.json'
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.avif': 'image/avif', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.bmp': 'image/bmp', '.tif': 'image/tiff', '.tiff': 'image/tiff',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/mp4',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.flac': 'audio/flac',
  '.pdf': 'application/pdf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.obj': 'text/plain', '.mtl': 'text/plain', '.fbx': 'application/octet-stream', '.stl': 'model/stl',
  '.hdr': 'application/octet-stream', '.exr': 'application/octet-stream', '.ktx': 'image/ktx', '.ktx2': 'image/ktx2',
  '.basis': 'application/octet-stream', '.dds': 'application/octet-stream', '.tga': 'application/octet-stream',
  '.zip': 'application/zip', '.gz': 'application/gzip', '.br': 'application/octet-stream', '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed', '.iomcar': 'application/octet-stream', '.dat': 'application/octet-stream',
}
// Reviewed, already-public astronomical datasets. Do not externalize arbitrary JSON:
// application config, private records and other demos require their own access review.
const PUBLIC_DATA_PATHS = new Set([
  '/demos/solar-system/assets/phase6/bright-stars.bsc5p.v1.json',
  '/demos/solar-system/assets/small-body-ephemeris.manifest-B7FFgHF2.json',
  '/demos/solar-system/assets/small-body-ephemeris.validation-B55youGz.json',
])
// These generated modules contain only public numerical tables and exports;
// ordinary JavaScript application code remains in the deployment.
const PUBLIC_DATA_MODULE_PATHS = new Set([
  '/demos/solar-system/assets/spacecraft-data-BAKJSIXU.js',
  '/demos/solar-system/assets/moon-anchor-data-BR6eL6pP.js',
])
export const mediaType = name => PUBLIC_DATA_PATHS.has(name) ? 'application/json'
  : PUBLIC_DATA_MODULE_PATHS.has(name) ? 'application/javascript' : TYPES[extname(name).toLowerCase()]
export const objectKey = (path, hash) => `iom-website/v1/${hash}/${basename(path).replace(/[^A-Za-z0-9._-]/g, '-')}`

export function inside(root, path) {
  const base = resolve(root), absolute = resolve(base, path), rel = relative(base, absolute)
  if (!rel || rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel)) throw new Error('Asset path escapes its directory')
  return absolute
}
export function sourcePath(root, path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.includes('\\') || path.slice(1).split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Invalid public asset path')
  if (/[\x00-\x1f?#%]/.test(path)) throw new Error('Unsupported public asset path')
  return inside(root, path.slice(1))
}
export function readAsset(root, path) {
  const file = sourcePath(root, path)
  if (!lstatSync(file).isFile()) throw new Error(`Asset is not a regular file: ${path}`)
  inside(realpathSync(root), realpathSync(file))
  return readFileSync(file)
}
export function validateManifest(manifest) {
  if (manifest.version !== 1 || manifest.origin !== PUBLIC_ORIGIN || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Invalid R2 release manifest')
  const paths = new Set()
  for (const entry of manifest.files) {
    sourcePath(resolve('validation-only'), entry.path)
    if (paths.has(entry.path) || !mediaType(entry.path) || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 1 || entry.key !== objectKey(entry.path, entry.sha256)) throw new Error('Invalid R2 release asset')
    if (entry.access && entry.access !== 'public') throw new Error('Private media cannot use public R2 delivery')
    if (entry.delivery && !['legacy', 'canonical'].includes(entry.delivery)) throw new Error('Unknown asset delivery mode')
    if (entry.delivery === 'canonical' && !/^[a-f0-9]{64}$/.test(entry.rangeSha256 || '')) throw new Error('Missing canonical asset integrity')
    paths.add(entry.path)
  }
  return manifest
}
export function canonicalAssetUrl(entry) {
  return `/_assets/${entry.sha256}/${entry.key.split('/').at(-1)}`
}
export const CANONICAL_ROUTE = '/_assets/:hash([a-f0-9]{64})/:name([A-Za-z0-9._-]+)'
export function routeSource(path) {
  // Vercel sources use path-to-regexp. Escape its token syntax in literal filenames.
  return encodeURI(path).replace(/[():*+?{}[\]\\]/g, '\\$&')
}
// One header rule may match multiple exact public paths. Bound pattern size and
// escape REGEX syntax inside the custom path-to-regexp parameter; routeSource's
// top-level path escaping is not sufficient here (notably dots, dollar and pipe).
export const MAX_HEADER_SOURCE_LENGTH = 3000
export function groupedLegacyHeaders(entries) {
  const groups = []
  let alternatives = []
  const sourceFor = values => `/:iomAsset(${values.join('|')})`
  const emit = () => {
    if (!alternatives.length) return
    groups.push({ source: sourceFor(alternatives), headers: [
      { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
      { key: 'CDN-Cache-Control', value: 'public, max-age=0, must-revalidate' },
      { key: 'Vercel-CDN-Cache-Control', value: 'public, max-age=0, must-revalidate' },
    ] })
    alternatives = []
  }
  for (const entry of entries) {
    const literal = encodeURI(entry.path).slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (sourceFor([literal]).length > MAX_HEADER_SOURCE_LENGTH) throw new Error('Legacy media path exceeds header pattern budget')
    if (sourceFor([...alternatives, literal]).length > MAX_HEADER_SOURCE_LENGTH) emit()
    alternatives.push(literal)
  }
  emit()
  return groups
}


export function releaseConfig(config, manifest) {
  validateManifest(manifest)
  const legacy = manifest.files.filter(entry => (entry.delivery ?? 'legacy') === 'legacy')
  const rewrites = legacy.map(entry => ({ source: routeSource(entry.path), destination: `${PUBLIC_ORIGIN}/${entry.key}` }))
  const headers = groupedLegacyHeaders(legacy)
  rewrites.push({ source: CANONICAL_ROUTE, destination: `${PUBLIC_ORIGIN}/iom-website/v1/:hash/:name` })
  headers.push({ source: CANONICAL_ROUTE, headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] })
  const result = { ...config, buildCommand: 'npm run build && node scripts/finalize-r2-build.mjs',
    rewrites: [...rewrites, ...(config.rewrites || [])], headers: [...(config.headers || []), ...headers] }
  if (result.routes) throw new Error('Legacy routes cannot be combined with R2 rewrites')
  const count = result.rewrites.length + result.headers.length + (result.redirects?.length || 0)
  if (count > 2048) throw new Error(`R2 release needs ${count} routes; Vercel limit is 2048`)
  return result
}
