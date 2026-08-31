import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import process from 'node:process'

export const DEFAULT_BLACK_HOLE_LENSING_ASSET_DIRECTORY = fileURLToPath(
  new URL('../../public/assets/phase10/black-hole/', import.meta.url),
)

export async function verifyBlackHoleLensingAssets(
  assetDirectory = DEFAULT_BLACK_HOLE_LENSING_ASSET_DIRECTORY,
) {
  const directory = resolve(assetDirectory)
  const manifestPath = join(directory, 'manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (
    manifest.schemaVersion !== 1 ||
    manifest.assetFamily !== 'bruneton-black-hole-ray-lookup-tables' ||
    !Array.isArray(manifest.files) ||
    manifest.files.length !== 2
  ) {
    throw new Error('Phase 10 black-hole lensing manifest schema is invalid.')
  }
  if (!/^[0-9a-f]{40}$/.test(manifest.upstream?.referenceCommit ?? '')) {
    throw new Error('Phase 10 black-hole reference commit is missing or invalid.')
  }

  const expectedNames = new Set(['deflection.dat', 'inverse_radius.dat'])
  const actualNames = new Set(manifest.files.map((entry) => entry.path))
  if (
    expectedNames.size !== actualNames.size ||
    [...expectedNames].some((name) => !actualNames.has(name))
  ) {
    throw new Error('Phase 10 black-hole lensing asset set is unexpected.')
  }

  const verified = []
  for (const entry of manifest.files) {
    if (basename(entry.path) !== entry.path || !expectedNames.has(entry.path)) {
      throw new Error(`Unsafe or unexpected Phase 10 asset path: ${entry.path}`)
    }
    if (!entry.sourceUrl?.startsWith('https://ebruneton.github.io/black_hole_shader/demo/')) {
      throw new Error(`Unexpected upstream URL for ${entry.path}.`)
    }
    const bytes = await readFile(join(directory, entry.path))
    const digest = createHash('sha256').update(bytes).digest('hex')
    if (bytes.byteLength !== entry.byteLength || digest !== entry.sha256) {
      throw new Error(`Byte length or SHA-256 mismatch for ${entry.path}.`)
    }
    if (
      bytes.readFloatLE(0) !== entry.width ||
      bytes.readFloatLE(4) !== entry.height ||
      bytes.byteLength !== 8 + entry.width * entry.height * entry.components * 4
    ) {
      throw new Error(`Float32 header/payload dimensions mismatch for ${entry.path}.`)
    }
    let minimum = Number.POSITIVE_INFINITY
    let maximum = Number.NEGATIVE_INFINITY
    for (let offset = 8; offset < bytes.byteLength; offset += 4) {
      const value = bytes.readFloatLE(offset)
      if (!Number.isFinite(value)) {
        throw new Error(`Non-finite Float32 payload value in ${entry.path} at byte ${offset}.`)
      }
      minimum = Math.min(minimum, value)
      maximum = Math.max(maximum, value)
    }
    verified.push({
      path: entry.path,
      byteLength: bytes.byteLength,
      sha256: digest,
      dimensions: [entry.width, entry.height, entry.components],
      range: [minimum, maximum],
    })
  }

  const notice = await readFile(join(directory, manifest.notice), 'utf8')
  if (
    !notice.includes('Copyright (c) 2020 Eric Bruneton') ||
    !notice.includes('Redistribution and use in source and binary forms') ||
    !notice.includes(manifest.upstream.referenceCommit)
  ) {
    throw new Error('Phase 10 Bruneton BSD-3-Clause notice is incomplete.')
  }

  return {
    manifest: manifestPath,
    referenceCommit: manifest.upstream.referenceCommit,
    transformation: manifest.retrieval.transformation,
    verified,
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const report = await verifyBlackHoleLensingAssets(process.argv[2])
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}
