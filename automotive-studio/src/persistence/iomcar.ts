import JSZip from 'jszip'
import { migrateProject } from './migrations'
import type { AutomotiveProject } from './schema'

const MANIFEST_NAME = 'manifest.json'

/**
 * Minimal .iomcar ZIP packaging for Phase 1 (manifest only).
 * Binary assets land in assets/ in later phases; size/path limits apply then.
 */
export async function exportIomcar(project: AutomotiveProject): Promise<Blob> {
  const zip = new JSZip()
  const manifest = structuredClone(project)
  delete manifest.dirty
  zip.file(MANIFEST_NAME, JSON.stringify(manifest, null, 2))
  zip.folder('assets')
  zip.folder('license')
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

export async function importIomcar(file: Blob): Promise<AutomotiveProject> {
  const zip = await JSZip.loadAsync(file)
  const manifestFile = zip.file(MANIFEST_NAME)
  if (!manifestFile) {
    throw new Error('.iomcar missing manifest.json')
  }
  const text = await manifestFile.async('string')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('.iomcar manifest.json is not valid JSON')
  }
  return migrateProject(raw)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
