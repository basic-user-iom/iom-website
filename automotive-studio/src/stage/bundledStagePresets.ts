/**
 * Bundled floor PBR packs and cyclorama wall videos shipped under public/stage-presets/.
 * Loaded into IndexedDB the same way as user uploads so they persist on the project.
 */

const PRESET_BASE = `${import.meta.env.BASE_URL}stage-presets/`

export type FloorPresetId = 'asphalt' | 'ice'
export type CycloramaVideoPresetId = '1' | '2' | '3'

export const FLOOR_PRESETS: Record<
  FloorPresetId,
  { label: string; files: string[] }
> = {
  asphalt: {
    label: 'Asphalt',
    files: [
      'asphalt011/Asphalt011_1K-JPG_Color.jpg',
      'asphalt011/Asphalt011_1K-JPG_NormalGL.jpg',
      'asphalt011/Asphalt011_1K-JPG_Roughness.jpg',
      'asphalt011/Asphalt011_1K-JPG_Displacement.jpg',
    ],
  },
  ice: {
    label: 'Ice',
    files: [
      'ice/Ice002_1K-JPG_Color.jpg',
      'ice/Ice002_1K-JPG_NormalGL.jpg',
      'ice/Ice002_1K-JPG_Roughness.jpg',
      'ice/Ice002_1K-JPG_Displacement.jpg',
    ],
  },
}

export const CYCLORAMA_VIDEO_PRESETS: Record<
  CycloramaVideoPresetId,
  { label: string; path: string; filename: string }
> = {
  '1': { label: 'Video 1', path: 'videos/video1.mp4', filename: 'video1.mp4' },
  '2': { label: 'Video 2', path: 'videos/video2.mp4', filename: 'video2.mp4' },
  '3': { label: 'Video 3', path: 'videos/video3.mp4', filename: 'video3.mp4' },
}

function guessMime(name: string, blobType: string): string {
  if (blobType && blobType !== 'application/octet-stream') return blobType
  if (/\.mp4$/i.test(name)) return 'video/mp4'
  if (/\.webm$/i.test(name)) return 'video/webm'
  if (/\.jpe?g$/i.test(name)) return 'image/jpeg'
  if (/\.png$/i.test(name)) return 'image/png'
  if (/\.webp$/i.test(name)) return 'image/webp'
  return blobType || 'application/octet-stream'
}

async function fetchPresetFile(relativePath: string): Promise<File> {
  const url = `${PRESET_BASE}${relativePath}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to load preset ${relativePath} (${res.status})`)
  }
  const blob = await res.blob()
  const name = relativePath.split('/').pop() || relativePath
  return new File([blob], name, { type: guessMime(name, blob.type) })
}

export async function fetchFloorPresetFiles(id: FloorPresetId): Promise<File[]> {
  const pack = FLOOR_PRESETS[id]
  const files: File[] = []
  for (const rel of pack.files) {
    files.push(await fetchPresetFile(rel))
  }
  return files
}

export async function fetchCycloramaVideoPreset(id: CycloramaVideoPresetId): Promise<File> {
  return fetchPresetFile(CYCLORAMA_VIDEO_PRESETS[id].path)
}

export function cycloramaPresetIdFromFilename(filename: string | undefined): CycloramaVideoPresetId | null {
  if (!filename) return null
  const lower = filename.toLowerCase()
  if (lower === 'video1.mp4') return '1'
  if (lower === 'video2.mp4') return '2'
  if (lower === 'video3.mp4') return '3'
  return null
}
