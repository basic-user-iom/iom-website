import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

import {
  BRIGHT_STAR_SOURCE,
  DEFAULT_CACHE_DIRECTORY,
  DEFAULT_CATALOG_DIRECTORY,
  DEFAULT_OUTPUT_DIRECTORY,
  GENERATOR_ID,
  NONSTELLAR_BSC5P_HR,
  STAR_BINARY,
  STAR_JSON_FILE_NAME,
} from './phase6-config.mjs'
import {
  atomicWriteFile,
  describeFile,
  fetchToCache,
  isDirectRun,
  parseGeneratorArguments,
} from './phase6-io.mjs'

const DEG_TO_RAD = Math.PI / 180
const excludedHr = new Set(NONSTELLAR_BSC5P_HR)

export async function generateBrightStarCatalog(options) {
  const cached = await fetchToCache({
    url: BRIGHT_STAR_SOURCE.query,
    cachePath: join(options.cacheDirectory, BRIGHT_STAR_SOURCE.cacheFileName),
    offline: options.offline,
    refresh: options.refresh,
  })
  const responseText = await readFile(cached.path, 'utf8')
  const sourceRows = parseBsc5pStream(responseText)

  if (sourceRows.length !== BRIGHT_STAR_SOURCE.expectedRows) {
    throw new Error(
      `BSC5P returned ${sourceRows.length} rows; expected ${BRIGHT_STAR_SOURCE.expectedRows}. ` +
        'The upstream table or query contract may have changed.',
    )
  }

  const retained = sourceRows.filter((star) => !excludedHr.has(star.hr))
  const omitted = sourceRows.filter((star) => excludedHr.has(star.hr)).map((star) => star.hr)
  assertIntegerArrayEqual(omitted, NONSTELLAR_BSC5P_HR, 'nonstellar HR filter')
  if (retained.length !== BRIGHT_STAR_SOURCE.expectedRetainedRows) {
    throw new Error(
      `BSC5P retained ${retained.length} rows; expected ${BRIGHT_STAR_SOURCE.expectedRetainedRows}.`,
    )
  }

  const jsonPath = join(options.outputDirectory, STAR_JSON_FILE_NAME)
  const compileTimeJsonPath = join(
    options.catalogDirectory ?? DEFAULT_CATALOG_DIRECTORY,
    STAR_JSON_FILE_NAME,
  )
  const binaryPath = join(options.outputDirectory, STAR_BINARY.fileName)
  const jsonCatalog = createJsonCatalog(retained, sourceRows.length)
  const binaryCatalog = createBinaryCatalog(retained)
  const serializedJson = `${JSON.stringify(jsonCatalog, null, 2)}\n`
  await atomicWriteFile(jsonPath, serializedJson)
  await atomicWriteFile(compileTimeJsonPath, serializedJson)
  await atomicWriteFile(binaryPath, binaryCatalog)

  const [jsonFile, compileTimeJsonFile, binaryFile] = await Promise.all([
    describeFile(jsonPath),
    describeFile(compileTimeJsonPath),
    describeFile(binaryPath),
  ])
  if (
    compileTimeJsonFile.byte_length !== jsonFile.byte_length ||
    compileTimeJsonFile.checksum.value !== jsonFile.checksum.value
  ) {
    throw new Error('Public and compile-time BSC5P JSON copies are not byte-for-byte identical.')
  }
  const bvCount = retained.reduce((count, star) => count + Number(star.bvColor !== null), 0)
  const magnitudeValues = retained.map((star) => star.vmag)

  return {
    source: {
      source_id: BRIGHT_STAR_SOURCE.id,
      organization: BRIGHT_STAR_SOURCE.organization,
      title: BRIGHT_STAR_SOURCE.title,
      record: BRIGHT_STAR_SOURCE.record,
      api_documentation: BRIGHT_STAR_SOURCE.apiDocumentation,
      exact_query: BRIGHT_STAR_SOURCE.query,
      retrieved_at: cached.retrieved_at,
      final_url: cached.final_url,
      response_headers: cached.response_headers,
      media_type: BRIGHT_STAR_SOURCE.mediaType,
      byte_length: cached.byte_length,
      checksum: cached.checksum,
      catalog_citation: BRIGHT_STAR_SOURCE.catalogCitation,
    },
    assets: [
      {
        asset_id: 'bright-star-catalog-bsc5p-json-v1',
        local_file: STAR_JSON_FILE_NAME,
        source_id: BRIGHT_STAR_SOURCE.id,
        media_type: 'application/json',
        usage: 'Published inspection/provenance copy; the browser runtime does not fetch this file.',
        byte_length: jsonFile.byte_length,
        checksum: jsonFile.checksum,
        compile_time_copy: {
          project_path: 'src/data/catalogs/bright-stars.bsc5p.v1.json',
          relationship: 'byte-for-byte identical to the public JSON asset',
          usage: 'Imported at build time and bundled as the current browser runtime star-catalog input.',
          byte_length: compileTimeJsonFile.byte_length,
          checksum: compileTimeJsonFile.checksum,
        },
        schema: {
          schema_version: 1,
          row_container: 'stars',
          field_order: ['hr', 'ra_rad', 'dec_rad', 'vmag', 'bv_color'],
          missing_value: null,
        },
      },
      {
        asset_id: 'bright-star-catalog-bsc5p-binary-v1',
        local_file: STAR_BINARY.fileName,
        source_id: BRIGHT_STAR_SOURCE.id,
        media_type: 'application/octet-stream',
        usage: 'Published compact alternate/verification encoding; the browser runtime does not fetch this file.',
        byte_length: binaryFile.byte_length,
        checksum: binaryFile.checksum,
        binary_format: describeBinaryFormat(retained.length),
      },
    ],
    transforms: [
      'Parse HEASARC Xamin pipe-delimited fields hr, ra, dec, vmag, and bv_color.',
      'Convert sexagesimal J2000 right ascension and declination to radians without precession or proper-motion propagation.',
      `Exclude the ${NONSTELLAR_BSC5P_HR.length} HEASARC-identified nonstellar HR rows listed in filters.excluded_nonstellar_hr.`,
      'Sort by ascending Harvard Revised number and encode both a transparent JSON catalog and compact little-endian binary catalog.',
    ],
    filters: jsonCatalog.filters,
    statistics: {
      bv_color_present: bvCount,
      bv_color_missing: retained.length - bvCount,
      minimum_vmag: Math.min(...magnitudeValues),
      maximum_vmag: Math.max(...magnitudeValues),
    },
  }
}

export function parseBsc5pStream(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const headerIndex = lines.findIndex((line) => {
    const columns = line.split('|').map(normalizeColumnName)
    return ['hr', 'ra', 'dec', 'vmag', 'bvcolor'].every((column) => columns.includes(column))
  })
  if (headerIndex < 0) throw new Error('BSC5P stream is missing its expected pipe-delimited header.')

  const headers = lines[headerIndex].split('|').map(normalizeColumnName)
  const column = Object.fromEntries(headers.map((name, index) => [name, index]))
  const stars = []
  const seenHr = new Set()

  for (let lineIndex = headerIndex + 1; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex].trim()
    if (line.length === 0) continue
    const values = line.split('|').map((value) => value.trim())
    const hrText = values[column.hr]
    if (!/^\d+$/.test(hrText ?? '')) {
      throw new Error(`Unexpected BSC5P stream row ${lineIndex + 1}: ${line}`)
    }
    const hr = Number(hrText)
    if (!Number.isInteger(hr) || hr < 1 || hr > 9999 || seenHr.has(hr)) {
      throw new Error(`Invalid or duplicate BSC5P HR value at row ${lineIndex + 1}: ${hrText}`)
    }
    seenHr.add(hr)

    // The 14 catalog rows explicitly classified as nonstellar by HEASARC can
    // have intentionally blank astrometric/photometric fields. Retain their HR
    // identifiers for the source-row/filter audit, then omit them before any
    // point-record encoding.
    if (excludedHr.has(hr)) {
      stars.push({ hr, excludedNonstellar: true })
      continue
    }

    const vmag = parseRequiredNumber(values[column.vmag], 'V magnitude', hr)
    const bvColor = parseOptionalNumber(values[column.bvcolor], 'B-V color', hr)
    if (vmag < -5 || vmag > 20) throw new Error(`BSC5P HR ${hr} has implausible V magnitude ${vmag}.`)
    if (bvColor !== null && (bvColor < -2 || bvColor > 6)) {
      throw new Error(`BSC5P HR ${hr} has implausible B-V color ${bvColor}.`)
    }

    stars.push({
      hr,
      raRad: parseRightAscension(values[column.ra], hr),
      decRad: parseDeclination(values[column.dec], hr),
      vmag,
      bvColor,
    })
  }

  stars.sort((left, right) => left.hr - right.hr)
  return stars
}

function createJsonCatalog(stars, sourceRowCount) {
  return {
    schema_version: 1,
    catalog_id: 'bright-stars-bsc5p-v1',
    generator: GENERATOR_ID,
    source_id: BRIGHT_STAR_SOURCE.id,
    coordinate_frame: {
      system: 'FK5 equatorial',
      equinox: 'J2000.0',
      epoch: 'J2000.0',
      right_ascension_unit: 'radian',
      declination_unit: 'radian',
      propagation: 'Static catalog directions; no proper motion, parallax, aberration, or precession.',
    },
    field_order: ['hr', 'ra_rad', 'dec_rad', 'vmag', 'bv_color'],
    missing_value: null,
    filters: {
      source_rows: sourceRowCount,
      excluded_nonstellar_hr: [...NONSTELLAR_BSC5P_HR],
      retained_rows: stars.length,
    },
    stars: stars.map((star) => [
      star.hr,
      star.raRad,
      star.decRad,
      star.vmag,
      star.bvColor,
    ]),
  }
}

function createBinaryCatalog(stars) {
  const fileBytes = STAR_BINARY.headerBytes + stars.length * STAR_BINARY.recordBytes
  const buffer = Buffer.alloc(fileBytes)
  buffer.write(STAR_BINARY.magic, 0, 8, 'ascii')
  buffer.writeUInt16LE(STAR_BINARY.majorVersion, 8)
  buffer.writeUInt16LE(STAR_BINARY.minorVersion, 10)
  buffer.writeUInt32LE(STAR_BINARY.headerBytes, 12)
  buffer.writeUInt32LE(stars.length, 16)
  buffer.writeUInt16LE(STAR_BINARY.recordBytes, 20)
  buffer.writeUInt16LE(STAR_BINARY.flags, 22)
  buffer.writeUInt32LE(STAR_BINARY.dataOffset, 24)
  buffer.writeUInt32LE(fileBytes, 28)

  for (let index = 0; index < stars.length; index += 1) {
    const star = stars[index]
    const offset = STAR_BINARY.dataOffset + index * STAR_BINARY.recordBytes
    buffer.writeUInt16LE(star.hr, offset)
    buffer.writeUInt16LE(star.bvColor === null ? 0 : 1, offset + 2)
    buffer.writeFloatLE(star.raRad, offset + 4)
    buffer.writeFloatLE(star.decRad, offset + 8)
    buffer.writeFloatLE(star.vmag, offset + 12)
    buffer.writeFloatLE(star.bvColor ?? 0, offset + 16)
  }
  return buffer
}

function describeBinaryFormat(recordCount) {
  return {
    byte_order: 'little-endian',
    magic_ascii: 'IOMSTAR\\0',
    version: `${STAR_BINARY.majorVersion}.${STAR_BINARY.minorVersion}`,
    header_bytes: STAR_BINARY.headerBytes,
    record_bytes: STAR_BINARY.recordBytes,
    record_count: recordCount,
    header_layout: [
      { offset: 0, bytes: 8, type: 'ASCII', field: 'magic' },
      { offset: 8, bytes: 2, type: 'uint16', field: 'major_version' },
      { offset: 10, bytes: 2, type: 'uint16', field: 'minor_version' },
      { offset: 12, bytes: 4, type: 'uint32', field: 'header_bytes' },
      { offset: 16, bytes: 4, type: 'uint32', field: 'record_count' },
      { offset: 20, bytes: 2, type: 'uint16', field: 'record_bytes' },
      { offset: 22, bytes: 2, type: 'uint16', field: 'flags', semantics: 'bit 0: sorted by HR' },
      { offset: 24, bytes: 4, type: 'uint32', field: 'data_offset' },
      { offset: 28, bytes: 4, type: 'uint32', field: 'file_bytes' },
    ],
    record_layout: [
      { offset: 0, bytes: 2, type: 'uint16', field: 'hr' },
      { offset: 2, bytes: 2, type: 'uint16', field: 'flags', semantics: 'bit 0: B-V present' },
      { offset: 4, bytes: 4, type: 'float32', field: 'ra_rad' },
      { offset: 8, bytes: 4, type: 'float32', field: 'dec_rad' },
      { offset: 12, bytes: 4, type: 'float32', field: 'vmag' },
      { offset: 16, bytes: 4, type: 'float32', field: 'bv_color', semantics: '0 when absent' },
    ],
  }
}

function parseRightAscension(value, hr) {
  const match = /^(\d{1,2})\s+(\d{1,2})\s+(\d+(?:\.\d+)?)$/.exec(value ?? '')
  if (match === null) throw new Error(`BSC5P HR ${hr} has invalid right ascension: ${value}`)
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  if (hours >= 24 || minutes >= 60 || seconds >= 60) {
    throw new Error(`BSC5P HR ${hr} has out-of-range right ascension: ${value}`)
  }
  return (hours + minutes / 60 + seconds / 3600) * 15 * DEG_TO_RAD
}

function parseDeclination(value, hr) {
  const match = /^([+-]?)(\d{1,2})\s+(\d{1,2})\s+(\d+(?:\.\d+)?)$/.exec(value ?? '')
  if (match === null) throw new Error(`BSC5P HR ${hr} has invalid declination: ${value}`)
  const sign = match[1] === '-' ? -1 : 1
  const degrees = Number(match[2])
  const minutes = Number(match[3])
  const seconds = Number(match[4])
  if (degrees > 90 || minutes >= 60 || seconds >= 60 || (degrees === 90 && (minutes > 0 || seconds > 0))) {
    throw new Error(`BSC5P HR ${hr} has out-of-range declination: ${value}`)
  }
  return sign * (degrees + minutes / 60 + seconds / 3600) * DEG_TO_RAD
}

function parseRequiredNumber(value, label, hr) {
  if (value === undefined || value === '' || !Number.isFinite(Number(value))) {
    throw new Error(`BSC5P HR ${hr} has invalid ${label}: ${value}`)
  }
  return Number(value)
}

function parseOptionalNumber(value, label, hr) {
  if (value === undefined || value === '' || value.toLowerCase() === 'null') return null
  if (!Number.isFinite(Number(value))) throw new Error(`BSC5P HR ${hr} has invalid ${label}: ${value}`)
  return Number(value)
}

function normalizeColumnName(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function assertIntegerArrayEqual(actual, expected, label) {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`${label} mismatch: expected ${expected.join(', ')}, found ${actual.join(', ')}`)
  }
}

if (isDirectRun(import.meta.url)) {
  const options = parseGeneratorArguments(process.argv.slice(2), {
    cacheDirectory: DEFAULT_CACHE_DIRECTORY,
    outputDirectory: DEFAULT_OUTPUT_DIRECTORY,
    catalogDirectory: DEFAULT_CATALOG_DIRECTORY,
  })
  if (options.help) {
    process.stdout.write(
      'Usage: node generate-bright-star-catalog.mjs [--offline | --refresh] [--cache-dir PATH] [--output-dir PATH] [--catalog-dir PATH]\n',
    )
  } else {
    const result = await generateBrightStarCatalog(options)
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  }
}
