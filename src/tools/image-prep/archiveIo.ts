import { downloadBlob } from './processImage'

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|bmp|tiff?)$/i
const ARCHIVE_EXT = /\.(zip|rar)$/i

export type ExtractedImage = {
  file: File
  /** Path inside archive / folder (forward slashes, no leading slash) */
  relativePath: string
}

function mimeForName(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.avif')) return 'image/avif'
  if (lower.endsWith('.bmp')) return 'image/bmp'
  if (/\.tiff?$/.test(lower)) return 'image/tiff'
  return 'image/jpeg'
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '')
}

function basename(path: string): string {
  const n = normalizePath(path)
  const i = n.lastIndexOf('/')
  return i >= 0 ? n.slice(i + 1) : n
}

function isIgnoredArchivePath(path: string): boolean {
  const n = normalizePath(path)
  if (!n || n.endsWith('/')) return true
  if (n.startsWith('__MACOSX/') || n.includes('/__MACOSX/')) return true
  if (basename(n).startsWith('.')) return true
  return false
}

export function isImagePath(path: string): boolean {
  return IMAGE_EXT.test(basename(path))
}

export function isArchiveFile(file: File): boolean {
  const name = file.name.toLowerCase()
  if (ARCHIVE_EXT.test(name)) return true
  const t = file.type
  return (
    t === 'application/zip' ||
    t === 'application/x-zip-compressed' ||
    t === 'application/vnd.rar' ||
    t === 'application/x-rar-compressed' ||
    t === 'application/x-rar'
  )
}

export function isRarFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.rar') || /rar/i.test(file.type)
}

export function isZipFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed'
  )
}

function toExtracted(path: string, data: BlobPart, type?: string): ExtractedImage {
  const relativePath = normalizePath(path)
  const name = basename(relativePath)
  const file = new File([data], name, { type: type || mimeForName(name) })
  return { file, relativePath }
}

export async function extractImagesFromZip(file: File): Promise<ExtractedImage[]> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const out: ExtractedImage[] = []

  const entries = Object.values(zip.files)
  for (const entry of entries) {
    if (entry.dir || isIgnoredArchivePath(entry.name) || !isImagePath(entry.name)) continue
    const blob = await entry.async('blob')
    out.push(toExtracted(entry.name, blob))
  }

  return out
}

export async function extractImagesFromRar(file: File): Promise<ExtractedImage[]> {
  const { createExtractorFromData } = await import('node-unrar-js/esm')
  const wasmUrl = (await import('node-unrar-js/esm/js/unrar.wasm?url')).default
  const wasmBinary = await fetch(wasmUrl).then((r) => {
    if (!r.ok) throw new Error('Could not load RAR decoder')
    return r.arrayBuffer()
  })

  const extractor = await createExtractorFromData({
    data: await file.arrayBuffer(),
    wasmBinary,
  })

  const extracted = extractor.extract({
    files: (header) =>
      !header.flags.directory &&
      !isIgnoredArchivePath(header.name) &&
      isImagePath(header.name),
  })

  const out: ExtractedImage[] = []
  for (const item of extracted.files) {
    // Must fully consume iterator (node-unrar-js memory contract)
    if (!item.extraction || item.fileHeader.flags.directory) continue
    if (isIgnoredArchivePath(item.fileHeader.name) || !isImagePath(item.fileHeader.name)) continue
    out.push(toExtracted(item.fileHeader.name, item.extraction))
  }
  return out
}

export async function extractImagesFromArchive(file: File): Promise<ExtractedImage[]> {
  if (isRarFile(file)) return extractImagesFromRar(file)
  if (isZipFile(file)) return extractImagesFromZip(file)
  throw new Error(`Unsupported archive: ${file.name}`)
}

export type ZipReadyFile = {
  /** Path inside the zip (folders preserved) */
  path: string
  blob: Blob
}

/** Build download zip entry path, keeping folder structure. */
export function zipPathForResult(relativePath: string, resultFilename: string): string {
  const n = normalizePath(relativePath)
  const slash = n.lastIndexOf('/')
  const dir = slash >= 0 ? n.slice(0, slash + 1) : ''
  return `${dir}${resultFilename}`
}

export async function downloadAsZip(files: ZipReadyFile[], zipName = 'image-prep.zip') {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  for (const f of files) {
    const path = normalizePath(f.path)
    if (!path) continue
    zip.file(path, f.blob)
  }
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  downloadBlob(blob, zipName.endsWith('.zip') ? zipName : `${zipName}.zip`)
}
