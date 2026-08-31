import { readFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import process from 'node:process'

import sharp from 'sharp'

import {
  DEFAULT_CATALOG_DIRECTORY,
  DEFAULT_OUTPUT_DIRECTORY,
  MILKY_WAY_OUTPUTS,
  STAR_BINARY,
} from './phase6-config.mjs'
import { describeFile, isDirectRun } from './phase6-io.mjs'

export async function verifySkyAssets(
  outputDirectory = DEFAULT_OUTPUT_DIRECTORY,
  catalogDirectory = DEFAULT_CATALOG_DIRECTORY,
) {
  const resolvedOutput = resolve(outputDirectory)
  const manifestPath = join(resolvedOutput, 'sky-manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (manifest.schema_version !== 1 || !Array.isArray(manifest.assets)) {
    throw new Error('Phase 6 sky manifest does not match schema version 1.')
  }

  const expectedFiles = new Set([
    ...MILKY_WAY_OUTPUTS.map((output) => output.fileName),
    'bright-stars.bsc5p.v1.json',
    STAR_BINARY.fileName,
  ])
  const manifestFiles = new Set(manifest.assets.map((asset) => asset.local_file))
  if (
    manifestFiles.size !== expectedFiles.size ||
    [...expectedFiles].some((fileName) => !manifestFiles.has(fileName))
  ) {
    throw new Error(`Phase 6 sky manifest asset set is unexpected: ${[...manifestFiles].join(', ')}`)
  }

  for (const asset of manifest.assets) {
    const assetPath = resolve(resolvedOutput, asset.local_file)
    if (!assetPath.startsWith(`${resolvedOutput}${sep}`)) {
      throw new Error(`Manifest asset escapes the Phase 6 directory: ${asset.local_file}`)
    }
    const actual = await describeFile(assetPath)
    if (
      actual.byte_length !== asset.byte_length ||
      actual.checksum.value !== asset.checksum?.value ||
      actual.checksum.algorithm !== asset.checksum?.algorithm
    ) {
      throw new Error(`Manifest byte/hash mismatch for ${asset.local_file}.`)
    }
  }

  for (const expected of MILKY_WAY_OUTPUTS) {
    const metadata = await sharp(join(resolvedOutput, expected.fileName)).metadata()
    if (
      metadata.format !== 'webp' ||
      metadata.width !== expected.width ||
      metadata.height !== expected.height ||
      metadata.channels !== 3
    ) {
      throw new Error(
        `${expected.fileName} decoded as ${metadata.format} ${metadata.width} x ${metadata.height} x ${metadata.channels}.`,
      )
    }
  }

  const jsonCatalog = JSON.parse(
    await readFile(join(resolvedOutput, 'bright-stars.bsc5p.v1.json'), 'utf8'),
  )
  const publicJson = await describeFile(join(resolvedOutput, 'bright-stars.bsc5p.v1.json'))
  const compileTimeJson = await describeFile(join(resolve(catalogDirectory), 'bright-stars.bsc5p.v1.json'))
  if (
    publicJson.byte_length !== compileTimeJson.byte_length ||
    publicJson.checksum.value !== compileTimeJson.checksum.value
  ) {
    throw new Error('Public and compile-time BSC5P JSON catalogs are not byte-for-byte identical.')
  }
  const binaryCatalog = await readFile(join(resolvedOutput, STAR_BINARY.fileName))
  verifyCatalogPair(jsonCatalog, binaryCatalog)

  return {
    manifest: manifestPath,
    asset_count: manifest.assets.length,
    star_count: jsonCatalog.stars.length,
    verified_files: [...expectedFiles].sort(),
  }
}

function verifyCatalogPair(catalog, binary) {
  if (
    catalog.schema_version !== 1 ||
    catalog.catalog_id !== 'bright-stars-bsc5p-v1' ||
    !Array.isArray(catalog.stars)
  ) {
    throw new Error('Bright-star JSON does not match catalog schema version 1.')
  }
  if (binary.subarray(0, 8).toString('ascii') !== STAR_BINARY.magic) {
    throw new Error('Bright-star binary magic mismatch.')
  }
  const major = binary.readUInt16LE(8)
  const minor = binary.readUInt16LE(10)
  const headerBytes = binary.readUInt32LE(12)
  const recordCount = binary.readUInt32LE(16)
  const recordBytes = binary.readUInt16LE(20)
  const dataOffset = binary.readUInt32LE(24)
  const fileBytes = binary.readUInt32LE(28)
  if (
    major !== STAR_BINARY.majorVersion ||
    minor !== STAR_BINARY.minorVersion ||
    headerBytes !== STAR_BINARY.headerBytes ||
    recordBytes !== STAR_BINARY.recordBytes ||
    dataOffset !== STAR_BINARY.dataOffset ||
    recordCount !== catalog.stars.length ||
    fileBytes !== binary.byteLength
  ) {
    throw new Error('Bright-star binary header does not match its v1 schema or JSON pair.')
  }

  for (let index = 0; index < recordCount; index += 1) {
    const json = catalog.stars[index]
    const offset = dataOffset + index * recordBytes
    const flags = binary.readUInt16LE(offset + 2)
    const binaryBv = flags & 1 ? binary.readFloatLE(offset + 16) : null
    if (
      binary.readUInt16LE(offset) !== json[0] ||
      !float32Matches(binary.readFloatLE(offset + 4), json[1]) ||
      !float32Matches(binary.readFloatLE(offset + 8), json[2]) ||
      !float32Matches(binary.readFloatLE(offset + 12), json[3]) ||
      !nullableFloat32Matches(binaryBv, json[4])
    ) {
      throw new Error(`Bright-star binary/JSON mismatch at record ${index}, HR ${json[0]}.`)
    }
  }
}

function nullableFloat32Matches(actual, expected) {
  return actual === null && expected === null ? true : actual !== null && expected !== null && float32Matches(actual, expected)
}

function float32Matches(actual, expected) {
  // JSON has no signed-zero representation; +0 and -0 are equivalent for all
  // catalog fields even though the source text can contain "-0.00".
  return Math.fround(expected) === actual
}

if (isDirectRun(import.meta.url)) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    process.stdout.write('Usage: node verify-sky-assets.mjs [OUTPUT_DIRECTORY] [CATALOG_DIRECTORY]\n')
  } else {
    const outputDirectory = process.argv[2] ?? DEFAULT_OUTPUT_DIRECTORY
    const catalogDirectory = process.argv[3] ?? DEFAULT_CATALOG_DIRECTORY
    const report = await verifySkyAssets(outputDirectory, catalogDirectory)
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  }
}
