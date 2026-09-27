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
export const mediaType = name => TYPES[extname(name).toLowerCase()]
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
    paths.add(entry.path)
  }
  return manifest
}
export function routeSource(path) {
  // Vercel sources use path-to-regexp. Escape its token syntax in literal filenames.
  return encodeURI(path).replace(/[():*+?{}[\]\\]/g, '\\$&')
}
export function releaseConfig(config, manifest) {
  validateManifest(manifest)
  const rewrites = manifest.files.map(entry => ({ source: routeSource(entry.path), destination: `${PUBLIC_ORIGIN}/${entry.key}` }))
  const headers = manifest.files.map(entry => ({ source: routeSource(entry.path), headers: [
    { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
    { key: 'CDN-Cache-Control', value: 'public, max-age=0, must-revalidate' },
    { key: 'Vercel-CDN-Cache-Control', value: 'public, max-age=0, must-revalidate' },
  ] }))
  const result = { ...config, buildCommand: 'npm run build && node scripts/finalize-r2-build.mjs',
    rewrites: [...rewrites, ...(config.rewrites || [])], headers: [...(config.headers || []), ...headers] }
  if (result.routes) throw new Error('Legacy routes cannot be combined with R2 rewrites')
  const count = result.rewrites.length + result.headers.length + (result.redirects?.length || 0)
  if (count > 2048) throw new Error(`R2 release needs ${count} routes; Vercel limit is 2048`)
  return result
}
