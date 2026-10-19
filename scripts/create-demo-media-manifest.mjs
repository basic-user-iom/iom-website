// Explicit opt-in for NEW public demo media. Existing legacy URLs are unchanged.
import { readdirSync, readFileSync, writeFileSync, lstatSync, realpathSync } from 'node:fs'
import { resolve, join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mediaType, objectKey, sha256, canonicalAssetUrl, inside } from './r2-release-manifest.mjs'
import { scanReleaseFile, knownValuesFromEnvironment } from './deploy-secret-scan.mjs'

export function createDemoMediaManifest(publicRoot, slug, visibility, knownValues = []) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !['public', 'private'].includes(visibility)) throw Error('Specify a safe demo slug and explicit public or private visibility')
  const directory = join(realpathSync(publicRoot), 'demos', slug)
  if (lstatSync(directory).isSymbolicLink()) throw Error('Symlink demo refused')
  inside(publicRoot, realpathSync(directory))
  const files = []
  function visit(folder) {
    for (const item of readdirSync(folder, { withFileTypes: true })) {
      const disk = join(folder, item.name)
      if (item.isSymbolicLink()) throw Error('Symlink media refused')
      if (item.isDirectory()) visit(disk)
      else {
        const path = '/' + relative(publicRoot, disk).replaceAll('\\', '/')
        if (!mediaType(path)) continue
        const bytes = readFileSync(disk), hash = sha256(bytes)
        const report = scanReleaseFile('public' + path, bytes, knownValues)
        if (!report.complete || report.rules.length || report.errors.length) throw Error('Media failed secret/content checks; no manifest written')
        if (!bytes.length) throw Error('Empty media refused')
        // Multi-file formats need authored absolute references before relocation.
        if (visibility === 'public' && /\.(gltf|obj|mtl)$/i.test(path)) throw Error('Use a self-contained GLB or review absolute dependency references before externalizing this format')
        const entry = { path, bytes: bytes.length, sha256: hash, key: objectKey(path, hash) }
        files.push({ path, bytes: entry.bytes, sha256: hash, url: visibility === 'public' ? canonicalAssetUrl(entry) : path })
      }
    }
  }
  visit(directory)
  files.sort((a,b) => a.path.localeCompare(b.path))
  return { version: 1, visibility, files }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [slug, flag, visibility] = process.argv.slice(2)
  if (flag !== '--visibility') throw Error('Usage: node scripts/create-demo-media-manifest.mjs <demo-slug> --visibility public|private')
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../public')
  const manifest = createDemoMediaManifest(root, slug, visibility, knownValuesFromEnvironment(process.env))
  writeFileSync(join(root, 'demos', slug, 'media-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`Wrote ${visibility} manifest for ${manifest.files.length} media files. Originals are unchanged. No upload performed.`)
}
