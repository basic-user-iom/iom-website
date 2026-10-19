// Fixed subprocess for in-memory container inspection. No filesystem extraction,
// scanned-code execution, external document fetch or raw parser error output.
import fs from 'node:fs'
import { gunzipSync, inflateRawSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { scanReleaseFile, safeRelative, credentialPath, secretName, binaryTypes } from './deploy-secret-scan.mjs'

const ENTRY_LIMIT = 8 * 1024 * 1024
const fail = code => { throw Object.assign(new Error(code), { code }) }
const need = (value, code) => { if (!value) fail(code) }
const decode = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes)
const crcTable = Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0); return n >>> 0 })
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0 }

export async function inspectContainer(name, bytes, knownValues = []) {
  const EXPANDED_LIMIT = /\.iomcar$/i.test(name) ? 128 * 1024 * 1024 : 64 * 1024 * 1024
  const rules = new Set(), errors = new Set()
  let expanded = 0, entries = 0
  const started = Date.now()
  const check = () => need(Date.now() - started < 15000, 'CONTAINER_TIME_LIMIT')
  const merge = report => { for (const rule of report.rules) rules.add(rule); for (const error of report.errors) errors.add(error) }
  const plain = (kind, value) => merge(scanReleaseFile(kind, Buffer.isBuffer(value) ? value : Buffer.from(value), knownValues))
  const charge = count => { expanded += count; need(expanded <= EXPANDED_LIMIT, 'CONTAINER_EXPANDED_LIMIT'); check() }
  const inspect = async (entryName, data, depth) => {
    check(); need(depth <= 3, 'CONTAINER_DEPTH_LIMIT'); need(++entries <= 1000, 'CONTAINER_ENTRY_LIMIT')
    need(safeRelative(entryName), 'CONTAINER_PATH_REFUSED')
    // Names, comments and original container bytes get the same signature and
    // supplied-known-value checks in addition to decoded payload inspection.
    plain('name.txt', entryName); plain('raw.bin', data)
    if (credentialPath(entryName)) { rules.add('credential_file'); return }
    if (/\.gz$/i.test(entryName)) {
      // Inspect compressed and expanded bytes. Keep ordinary text limits, the
      // shared recursion budget, CRC validation and bounded decompression.
      const innerName = entryName.slice(0, -3)
      const outputLimit = Math.min(binaryTypes.test(innerName) ? 64 * 1024 * 1024 : ENTRY_LIMIT, EXPANDED_LIMIT - expanded)
      need(outputLimit > 0, 'CONTAINER_EXPANDED_LIMIT')
      const output = gunzipSync(data, { maxOutputLength: outputLimit })
      try {
        charge(output.length)
        await inspect(innerName, output, depth + 1)
      } finally { output.fill(0) }
      return
    }
    if (/\.zip$/i.test(entryName) || (/\.(?:iomcar|360project)$/i.test(entryName) && data.length >= 4 && data.readUInt32LE(0) === 0x04034b50)) { await zip(data, depth); return }
    if (/\.pdf$/i.test(entryName)) { await pdf(data, depth); return }
    if (/\.(?:iomcar|360project)$/i.test(entryName)) { plain('project.json', data); return }
    if (/\.dat$/i.test(entryName)) {
      // JSON/numeric tables or little-endian float32 LUTs, not an arbitrary
      // filename allowlist. Entire raw bytes were checked above.
      const text = data.toString('utf8').trim()
      if (/^[\[{]/.test(text)) { plain('table.json', data); return }
      if (/^[+\-0-9.eE,;\s]+$/.test(text)) {
        need(text.split(/[\s,;]+/).filter(Boolean).every(value => Number.isFinite(Number(value))), 'DAT_FORMAT_UNSUPPORTED')
        plain('table.txt', data); return
      }
      need(!/^[\x09\x0a\x0d\x20-\x7e]*$/.test(text), 'DAT_FORMAT_UNSUPPORTED')
      need(data.length > 0 && data.length % 4 === 0, 'DAT_FORMAT_UNSUPPORTED')
      for (let i = 0; i < data.length; i += 4) need(Number.isFinite(data.readFloatLE(i)), 'DAT_FORMAT_UNSUPPORTED')
      return
    }
    if (/\.tga$/i.test(entryName)) {
      need(data.length >= 18 && data[1] === 0 && [2, 3, 10, 11].includes(data[2]) && [8, 24, 32].includes(data[16]), 'TGA_FORMAT_UNSUPPORTED')
      const pixels = data.readUInt16LE(12) * data.readUInt16LE(14), stride = data[16] / 8
      need(pixels > 0 && pixels * stride <= EXPANDED_LIMIT, 'TGA_LIMIT')
      need([3, 11].includes(data[2]) ? stride === 1 : stride >= 3, 'TGA_FORMAT_UNSUPPORTED')
      charge(pixels * stride)
      let offset = 18 + data[0], decodedPixels = 0
      if (data[2] < 10) need(offset + pixels * stride <= data.length, 'TGA_TRUNCATED')
      else {
        const decoded = Buffer.alloc(pixels * stride)
        try {
          while (decodedPixels < pixels) {
            need(offset < data.length, 'TGA_TRUNCATED')
            const packet = data[offset++], count = (packet & 127) + 1, length = packet & 128 ? stride : count * stride
            need(decodedPixels + count <= pixels && offset + length <= data.length, 'TGA_TRUNCATED')
            if (packet & 128) for (let i = 0; i < count; i++) data.copy(decoded, (decodedPixels + i) * stride, offset, offset + stride)
            else data.copy(decoded, decodedPixels * stride, offset, offset + length)
            decodedPixels += count; offset += length
          }
          plain('pixels.bin', decoded)
        } finally { decoded.fill(0) }
      }
      return
    }
    plain(entryName, data)
  }
  const zip = async (data, depth) => {
    need(data.length >= 22, 'ZIP_INVALID')
    let end = -1
    for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) {
      if (data.readUInt32LE(i) === 0x06054b50 && i + 22 + data.readUInt16LE(i + 20) === data.length) { end = i; break }
    }
    need(end >= 0 && data.readUInt16LE(end + 4) === 0 && data.readUInt16LE(end + 6) === 0, 'ZIP_MULTIDISK_OR_INVALID')
    const count = data.readUInt16LE(end + 10), centralSize = data.readUInt32LE(end + 12), start = data.readUInt32LE(end + 16)
    need(count <= 1000 && count === data.readUInt16LE(end + 8) && count !== 65535 && start + centralSize === end, 'ZIP_DIRECTORY_INVALID')
    plain('comment.txt', decode(data.subarray(end + 22)))
    const names = new Set(), records = []; let offset = start, declared = 0
    for (let index = 0; index < count; index++) {
      need(offset + 46 <= end && data.readUInt32LE(offset) === 0x02014b50, 'ZIP_DIRECTORY_INVALID')
      const flags = data.readUInt16LE(offset + 8), method = data.readUInt16LE(offset + 10)
      const crc = data.readUInt32LE(offset + 16), compressed = data.readUInt32LE(offset + 20), size = data.readUInt32LE(offset + 24)
      const nl = data.readUInt16LE(offset + 28), el = data.readUInt16LE(offset + 30), cl = data.readUInt16LE(offset + 32)
      const disk = data.readUInt16LE(offset + 34), attr = data.readUInt32LE(offset + 38), local = data.readUInt32LE(offset + 42)
      need((flags & ~0x080e) === 0 && [0, 8].includes(method) && disk === 0 && ((attr >>> 16) & 0xf000) !== 0xa000, 'ZIP_ENCRYPTED_OR_UNSUPPORTED')
      need(offset + 46 + nl + el + cl <= end && compressed <= data.length, 'ZIP_ENTRY_LIMIT')
      const rawName = data.subarray(offset + 46, offset + 46 + nl), original = decode(rawName).replaceAll('\\', '/'), directory = original.endsWith('/'), name = directory ? original.slice(0, -1) : original
      const entryLimit = binaryTypes.test(name) ? 64 * 1024 * 1024 : ENTRY_LIMIT
      need(size <= entryLimit, 'ZIP_ENTRY_LIMIT')
      need(safeRelative(name) && !names.has(name.toLowerCase()), 'ZIP_PATH_OR_DUPLICATE'); names.add(name.toLowerCase())
      need(!directory || size === 0, 'ZIP_DIRECTORY_INVALID')
      plain('comment.txt', decode(data.subarray(offset + 46 + nl + el, offset + 46 + nl + el + cl)))
      for (let p = offset + 46 + nl; p < offset + 46 + nl + el;) {
        need(p + 4 <= offset + 46 + nl + el, 'ZIP_EXTRA_INVALID'); const id = data.readUInt16LE(p), length = data.readUInt16LE(p + 2)
        need(![1, 0x7075, 0x6375].includes(id) && p + 4 + length <= offset + 46 + nl + el, 'ZIP_EXTRA_UNSUPPORTED'); p += 4 + length
      }
      declared += size; need(expanded + declared <= EXPANDED_LIMIT, 'CONTAINER_EXPANDED_LIMIT')
      records.push({ name, rawName, directory, flags, method, crc, compressed, size, local, entryLimit }); offset += 46 + nl + el + cl
    }
    need(offset === end, 'ZIP_DIRECTORY_INVALID')
    let cursor = 0
    for (const r of records.sort((a, b) => a.local - b.local)) {
      need(r.local === cursor && cursor + 30 <= start && data.readUInt32LE(cursor) === 0x04034b50, 'ZIP_LOCAL_INVALID')
      const nl = data.readUInt16LE(cursor + 26), el = data.readUInt16LE(cursor + 28), payload = cursor + 30 + nl + el
      need(payload + r.compressed <= start && data.readUInt16LE(cursor + 6) === r.flags && data.readUInt16LE(cursor + 8) === r.method &&
        data.subarray(cursor + 30, cursor + 30 + nl).equals(r.rawName), 'ZIP_LOCAL_INVALID')
      if (!(r.flags & 8)) need(data.readUInt32LE(cursor + 14) === r.crc && data.readUInt32LE(cursor + 18) === r.compressed && data.readUInt32LE(cursor + 22) === r.size, 'ZIP_LOCAL_INVALID')
      cursor = payload + r.compressed
      if (r.flags & 8) {
        if (data.readUInt32LE(cursor) === 0x08074b50) cursor += 4
        need(cursor + 12 <= start && data.readUInt32LE(cursor) === r.crc && data.readUInt32LE(cursor + 4) === r.compressed && data.readUInt32LE(cursor + 8) === r.size, 'ZIP_DESCRIPTOR_INVALID'); cursor += 12
      }
      if (credentialPath(r.name)) { rules.add('credential_file'); continue }
      const compressed = data.subarray(payload, payload + r.compressed)
      const output = r.method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: r.entryLimit })
      try {
        need(output.length === r.size && crc32(output) === r.crc, 'ZIP_CONTENT_MISMATCH')
        charge(output.length)
        if (!r.directory) await inspect(r.name, output, depth + 1)
      } finally { output.fill(0) }
    }
    need(cursor === start, 'ZIP_UNINDEXED_DATA')
  }
  const pdf = async (data, depth) => {
    need(data.subarray(0, 5).toString() === '%PDF-', 'PDF_INVALID')
    // Never provide a URL/password. Embedded JavaScript is detected, not run.
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const task = getDocument({ data: Uint8Array.from(data), verbosity: 0, stopAtErrors: true,
      useWorkerFetch: false, useSystemFonts: false, disableFontFace: true,
      isEvalSupported: false, enableXfa: false, disableAutoFetch: true, disableStream: true })
    task.onPassword = () => { task.destroy() }
    let doc
    const inspectData = value => {
      const queue = [value]; let count = 0
      while (queue.length) {
        need(++count < 200000, 'PDF_METADATA_LIMIT')
        const item = queue.pop()
        if (typeof item === 'string') { charge(Buffer.byteLength(item)); plain('decoded.txt', item) }
        else if (item instanceof Map) for (const [key, value] of item) {
          if (credentialPath(String(key))) rules.add('credential_file')
          if (secretName(String(key)) && typeof value === 'string' && value) rules.add('credential_pdf_field')
          queue.push(value)
        }
        else if (Array.isArray(item)) queue.push(...item)
        else if (item && typeof item === 'object' && !(item instanceof Uint8Array)) {
          if (secretName(String(item.name ?? item.fieldName ?? '')) && item.value != null && item.value !== '') rules.add('credential_pdf_field')
          need(!item.actions || Object.keys(item.actions).length === 0, 'PDF_ACTIVE_CONTENT_REFUSED')
          need(!/^\s*(?:javascript|data):/i.test(item.unsafeUrl ?? item.url ?? ''), 'PDF_ACTIVE_CONTENT_REFUSED')
          const small = Object.fromEntries(Object.entries(item).filter(([, v]) => typeof v === 'string' || typeof v === 'number'))
          plain('metadata.json', JSON.stringify(small)); queue.push(...Object.values(item))
        }
      }
    }
    try {
      doc = await task.promise
      need(!doc.isPureXfa && doc.numPages <= 300, 'PDF_XFA_OR_PAGE_LIMIT')
      need(!(await doc.getJSActions())?.size, 'PDF_ACTIVE_CONTENT_REFUSED')
      const metadata = await doc.getMetadata()
      need(!metadata.info.IsXFAPresent && !metadata.info.EncryptFilterName, 'PDF_ENCRYPTED_OR_XFA_REFUSED')
      // PDF.js 6 Metadata is iterable; getAll() no longer exists. Keep both
      // decoded metadata and raw XML checks, including fail-closed XML rules.
      inspectData(metadata.info); if (metadata.metadata) { inspectData(new Map(metadata.metadata)); plain('metadata.xmp', metadata.metadata.getRaw()) }
      inspectData(await doc.getOutline()); inspectData(await doc.getFieldObjects()); inspectData(await doc.getOpenAction())
      const attachments = await doc.getAttachments()
      for (const [id, entry] of attachments ?? []) {
        inspectData(entry)
        const content = await doc.getAttachmentContent(id)
        need(content instanceof Uint8Array && content.length <= ENTRY_LIMIT, 'PDF_ATTACHMENT_INVALID')
        const attachment = Buffer.from(content)
        try { charge(content.length); await inspect(entry.rawFilename || entry.filename, attachment, depth + 1) }
        finally { attachment.fill(0); content.fill(0) }
      }
      for (let number = 1; number <= doc.numPages; number++) {
        check(); const page = await doc.getPage(number)
        need(!(await page.getJSActions())?.size, 'PDF_ACTIVE_CONTENT_REFUSED')
        const text = await page.getTextContent({ disableNormalization: true })
        const parts = text.items.filter(item => typeof item.str === 'string')
        const joined = parts.map(item => item.str + (item.hasEOL ? '\n' : '')).join('')
        charge(Buffer.byteLength(joined)); plain('page.txt', joined)
        plain('page.txt', parts.map(item => item.str).join('\n'))
        inspectData(await page.getAnnotations()); page.cleanup()
      }
    } finally { await task.destroy() }
  }
  try {
    need(Buffer.isBuffer(bytes) && bytes.length <= (/\.iomcar$/i.test(name) ? 64 : 32) * 1024 * 1024, 'CONTAINER_FILE_LIMIT')
    await inspect(name, bytes, 0)
  } catch (error) { errors.add(/^[A-Z_]{1,80}$/.test(error.code ?? '') ? error.code : 'CONTAINER_PARSE_FAILED') }
  return { complete: errors.size === 0, rules: [...rules].sort(), errors: [...errors].sort() }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // PDF libraries may otherwise print document-specific warnings. This process
  // has a single fixed JSON response; parent captures both output channels.
  for (const key of ['log', 'info', 'warn', 'error', 'debug']) console[key] = () => {}
  globalThis.fetch = async () => { fail('CONTAINER_NETWORK_REFUSED') }
  let result
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8'))
    result = await inspectContainer(input.name, Buffer.from(input.base64, 'base64'), input.knownValues)
  } catch { result = { complete: false, rules: [], errors: ['CONTAINER_PROCESS_FAILED'] } }
  process.stdout.write(JSON.stringify(result) + '\n')
}
