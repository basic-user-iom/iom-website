#!/usr/bin/env node
// Runs after the remote build; only removes verified copies from build output.
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MANIFEST_FILE, readAsset, sha256, sourcePath, validateManifest } from './r2-release-manifest.mjs'

export function finalizeBuild(root, checkOnly = false) {
  const manifest = validateManifest(JSON.parse(readFileSync(resolve(root, MANIFEST_FILE), 'utf8')))
  if (checkOnly) return { files: manifest.files.length }
  const output = resolve(root, 'dist'), remove = []
  for (const entry of manifest.files) {
    const file = sourcePath(output, entry.path)
    if (!existsSync(file)) continue
    const bytes = readAsset(output, entry.path)
    if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) throw new Error(`Build changed an R2 asset; refusing publication: ${entry.path}`)
    remove.push(file)
  }
  // Validate every file before deleting any; the working public/ directory is untouched.
  for (const file of remove) unlinkSync(file)
  return { removedBuildCopies: remove.length, externalAssets: manifest.files.length }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(finalizeBuild(process.cwd(), process.argv.includes('--check-manifest')))) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
