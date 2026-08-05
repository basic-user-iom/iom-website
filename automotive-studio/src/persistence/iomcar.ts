import JSZip from 'jszip'
import { migrateProject } from './migrations'
import type { AutomotiveProject, AssetRecord } from './schema'

const MANIFEST_NAME = 'manifest.json'
const ASSETS_DIR = 'assets'

export type IomcarBlobEntry = {
  assetId: string
  blob: Blob
  filename: string
}

export type IomcarImportResult = {
  project: AutomotiveProject
  blobs: IomcarBlobEntry[]
  warnings: string[]
}

/**
 * Package project JSON + IndexedDB asset blobs into a portable .iomcar ZIP.
 * Layout: manifest.json + assets/<assetId>/<filename>
 */
export async function exportIomcar(
  project: AutomotiveProject,
  getBlob: (blobKey: string) => Promise<Blob | null>,
): Promise<{ blob: Blob; included: number; missing: string[] }> {
  const zip = new JSZip()
  const manifest = structuredClone(project)
  delete manifest.dirty
  const missing: string[] = []
  let included = 0

  const assetsFolder = zip.folder(ASSETS_DIR)
  if (!assetsFolder) throw new Error('Failed to create assets folder in .iomcar')

  for (const asset of collectExportAssets(manifest)) {
    const key = asset.blobKey ?? asset.id
    const data = await getBlob(key)
    if (!data) {
      missing.push(asset.filename || asset.id)
      continue
    }
    const safeName = sanitizeFilename(asset.filename || `${asset.id}.bin`)
    assetsFolder.folder(asset.id)?.file(safeName, data)
    asset.blobKey = asset.id
    included += 1
  }

  zip.file(MANIFEST_NAME, JSON.stringify(manifest, null, 2))
  zip.folder('license')

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  return { blob, included, missing }
}

export async function importIomcar(file: Blob): Promise<IomcarImportResult> {
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
  const project = migrateProject(raw)
  const blobs: IomcarBlobEntry[] = []
  const warnings: string[] = []

  const assetFiles = Object.keys(zip.files).filter(
    (path) => path.startsWith(`${ASSETS_DIR}/`) && !zip.files[path].dir,
  )
  for (const path of assetFiles) {
    const parts = path.split('/')
    // assets/<assetId>/<filename>
    if (parts.length < 3) continue
    const assetId = parts[1]
    const filename = parts.slice(2).join('/')
    const entry = zip.file(path)
    if (!entry) continue
    const blob = await entry.async('blob')
    blobs.push({ assetId, blob, filename })
  }

  for (const asset of project.assets) {
    const hasBlob = blobs.some((b) => b.assetId === asset.id)
    if (!hasBlob && (asset.role.startsWith('vehicle') || asset.role === 'image' || asset.role === 'video')) {
      warnings.push(`Missing packaged blob for ${asset.filename}`)
    }
  }

  return { project, blobs, warnings }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function collectExportAssets(project: AutomotiveProject): AssetRecord[] {
  const byId = new Map<string, AssetRecord>()
  for (const asset of project.assets) {
    byId.set(asset.id, asset)
  }
  // Ensure hotspot media referenced by id is included if present in assets.
  for (const hotspot of project.hotspots) {
    for (const block of hotspot.blocks) {
      if (block.type === 'image' || block.type === 'video') {
        const asset = byId.get(block.assetId)
        if (asset) byId.set(asset.id, asset)
      } else if (block.type === 'gallery') {
        for (const id of block.assetIds) {
          const asset = byId.get(id)
          if (asset) byId.set(asset.id, asset)
        }
      }
    }
  }
  return [...byId.values()]
}

function sanitizeFilename(name: string): string {
  const base = name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'asset.bin'
  return base.slice(0, 180)
}
