/* global AbortSignal, fetch */

import { createHash, randomBytes } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import process from 'node:process'
import { setTimeout } from 'node:timers'
import { pathToFileURL } from 'node:url'

export function parseGeneratorArguments(argv, defaults) {
  const options = {
    cacheDirectory: defaults.cacheDirectory,
    outputDirectory: defaults.outputDirectory,
    catalogDirectory: defaults.catalogDirectory,
    offline: false,
    refresh: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--offline') {
      options.offline = true
    } else if (argument === '--refresh') {
      options.refresh = true
    } else if (argument === '--cache-dir') {
      options.cacheDirectory = requireValue(argv, ++index, argument)
    } else if (argument === '--output-dir') {
      options.outputDirectory = requireValue(argv, ++index, argument)
    } else if (argument === '--catalog-dir') {
      options.catalogDirectory = requireValue(argv, ++index, argument)
    } else if (argument === '--help' || argument === '-h') {
      options.help = true
    } else {
      throw new Error(`Unknown Phase 6 sky generator argument: ${argument}`)
    }
  }

  if (options.offline && options.refresh) {
    throw new Error('--offline and --refresh cannot be used together.')
  }

  options.cacheDirectory = resolve(options.cacheDirectory)
  options.outputDirectory = resolve(options.outputDirectory)
  if (options.catalogDirectory !== undefined) options.catalogDirectory = resolve(options.catalogDirectory)
  return options
}

export function isDirectRun(moduleUrl) {
  return process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === moduleUrl
}

export async function fetchToCache({ url, cachePath, offline, refresh }) {
  const metadataPath = `${cachePath}.meta.json`
  if (!refresh && (await exists(cachePath))) {
    return describeCachedSource(cachePath, metadataPath, url)
  }
  if (offline) {
    throw new Error(`Offline generation requires the cached source: ${cachePath}`)
  }

  await mkdir(dirname(cachePath), { recursive: true })
  const temporaryPath = `${cachePath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
  let response
  let lastError

  try {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        response = await fetch(url, {
          headers: {
            Accept: '*/*',
            'User-Agent': 'IOM-Solar-System-Phase6-Asset-Generator/1.0',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(180_000),
        })
        if (!response.ok || response.body === null) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`)
        }
        break
      } catch (error) {
        lastError = error
        if (attempt === 4) throw error
        await delay(500 * 2 ** (attempt - 1))
      }
    }

    if (response === undefined || response.body === null) throw lastError
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporaryPath, { flags: 'wx' }))

    const downloaded = await stat(temporaryPath)
    if (downloaded.size === 0) throw new Error(`Downloaded an empty response from ${url}`)
    const declaredLength = parseContentLength(response.headers.get('content-length'))
    if (declaredLength !== undefined && downloaded.size !== declaredLength) {
      throw new Error(
        `Downloaded ${downloaded.size} bytes from ${url}; response declared ${declaredLength}.`,
      )
    }

    await replaceFile(temporaryPath, cachePath)
    const metadata = {
      url,
      final_url: response.url,
      retrieved_at: new Date().toISOString(),
      response_headers: {
        content_type: response.headers.get('content-type'),
        content_length: response.headers.get('content-length'),
        etag: response.headers.get('etag'),
        last_modified: response.headers.get('last-modified'),
      },
    }
    await atomicWriteJson(metadataPath, metadata)
    return describeCachedSource(cachePath, metadataPath, url)
  } catch (error) {
    await rm(temporaryPath, { force: true })
    throw new Error(`Unable to retrieve ${url}: ${error instanceof Error ? error.message : error}`, {
      cause: error,
    })
  }
}

export async function describeFile(path) {
  const file = await stat(path)
  return {
    byte_length: file.size,
    checksum: {
      algorithm: 'SHA-256',
      value: await sha256File(path),
    },
  }
}

export async function sha256File(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

export async function atomicWriteJson(path, value) {
  await atomicWriteFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

export async function atomicWriteFile(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
  try {
    await writeFile(temporaryPath, value, { flag: 'wx' })
    await replaceFile(temporaryPath, path)
  } catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}

export async function replaceFile(temporaryPath, destinationPath) {
  await mkdir(dirname(destinationPath), { recursive: true })
  try {
    await rename(temporaryPath, destinationPath)
  } catch (error) {
    if (error?.code !== 'EEXIST' && error?.code !== 'EPERM') throw error
    await rm(destinationPath, { force: true })
    await rename(temporaryPath, destinationPath)
  }
}

async function describeCachedSource(cachePath, metadataPath, expectedUrl) {
  const file = await stat(cachePath)
  let metadata
  try {
    metadata = JSON.parse(await readFile(metadataPath, 'utf8'))
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  if (metadata?.url !== undefined && metadata.url !== expectedUrl) {
    throw new Error(
      `Cached source URL mismatch for ${cachePath}: expected ${expectedUrl}, found ${metadata.url}`,
    )
  }
  return {
    path: cachePath,
    byte_length: file.size,
    checksum: {
      algorithm: 'SHA-256',
      value: await sha256File(cachePath),
    },
    retrieved_at: metadata?.retrieved_at ?? file.mtime.toISOString(),
    final_url: metadata?.final_url ?? expectedUrl,
    response_headers: metadata?.response_headers ?? null,
  }
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

function requireValue(argv, index, flag) {
  const value = argv[index]
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${flag} requires a path value.`)
  }
  return value
}

function parseContentLength(value) {
  if (value === null || !/^\d+$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))
}
