/**
 * Map ambientCG / Poly Haven / Substance-style pack filenames onto stage slots.
 *
 * ambientCG (unzip JPG/PNG pack — preferred for Studio):
 *   Asphalt011_1K-JPG_Color.jpg
 *   Asphalt011_1K-JPG_NormalGL.jpg   → OpenGL normals (Three.js default)
 *   Asphalt011_1K-JPG_NormalDX.jpg   → DirectX (Y flip) only if no GL
 *   Asphalt011_1K-JPG_Roughness.jpg
 *   Asphalt011_1K-JPG_Displacement.jpg
 *   Asphalt011_1K-JPG_AmbientOcclusion.jpg (when present)
 *   Asphalt011_1K-JPG_Metalness.jpg (metals)
 *   *_Opacity.jpg → skipped (stage is opaque)
 *
 * Poly Haven CDN-style: rock_diff_1k.jpg, rock_nor_gl_1k.jpg, rock_arm_1k.jpg
 *
 * Docs: https://docs.ambientcg.com / https://ambientcg.com/
 */

export type StageMapSlot =
  | 'map'
  | 'normal'
  | 'roughness'
  | 'metalness'
  | 'displacement'
  | 'ao'
  | 'emissive'

export type DetectedPbrMaps = {
  /** Slot → chosen file */
  files: Partial<Record<StageMapSlot, File>>
  /** True when the chosen normal is DirectX-style (needs normalScale.y = -1). */
  normalYFlip: boolean
  /** Filenames recognised but not assignable (e.g. Opacity, Preview). */
  skipped: string[]
  /** Image files that did not match any known suffix. */
  unmatched: string[]
}

/** Formats TextureLoader can actually decode (EXR/HDR need separate loaders). */
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i
const RES_OR_FMT = /^(1k|2k|4k|8k|16k|jpg|jpeg|png|webp)$/i

type Ranked = { file: File; rank: number; flip?: boolean }

function basename(file: File): string {
  const name = file.name.replace(/^.*[\\/]/, '')
  return name.replace(IMAGE_EXT, '')
}

function classifyToken(token: string): { slot: StageMapSlot; rank: number; flip?: boolean } | 'skip' | null {
  const t = token.toLowerCase().replace(/[\s\-_]+/g, '')

  // Prefer exact ambientCG / Poly Haven suffixes (higher rank = preferred).
  if (/^(color|diffuse|diff|col|albedo|basecolor|basecolour)$/.test(t)) {
    return {
      slot: 'map',
      rank: t === 'color' || t === 'albedo' || t === 'basecolor' || t === 'col' ? 10 : 8,
    }
  }
  if (/^(normalgl|norgl|openglnormal)$/.test(t)) return { slot: 'normal', rank: 20, flip: false }
  if (/^(normaldx|nordx|directxnormal)$/.test(t)) return { slot: 'normal', rank: 10, flip: true }
  if (/^(normal|nor|nrm|norm)$/.test(t)) return { slot: 'normal', rank: 5, flip: false }
  if (/^(roughness|rough|rgh)$/.test(t)) return { slot: 'roughness', rank: 10 }
  if (/^(metalness|metallic|metal|mtl)$/.test(t)) return { slot: 'metalness', rank: 10 }
  if (/^(displacement|displace|height|disp|depth)$/.test(t)) return { slot: 'displacement', rank: 10 }
  if (/^(ao|ambientocclusion|occlusion|occ)$/.test(t)) return { slot: 'ao', rank: 10 }
  if (/^(emissive|emission|emit)$/.test(t)) return { slot: 'emissive', rank: 10 }
  if (/^(orm|arm|occlusionroughnessmetallic)$/.test(t)) {
    // Packed ORM — caller fills empty ao/rough/metal slots.
    return { slot: 'ao', rank: 15 }
  }
  if (/^(opacity|alpha|alphamask|transparency)$/.test(t)) return 'skip'
  if (/^(preview|thumb|thumbnail|sphere|render|flat)$/.test(t)) return 'skip'
  return null
}

/**
 * Collect candidate tokens from `Asphalt011_1K-JPG_Color` / `rock_diff_1k` / `nor_gl`.
 * Resolution / format segments (1K, JPG, PNG) are skipped so type tokens stay visible.
 */
function tokensFromBasename(base: string): string[] {
  const parts = base.split(/[_\-.]+/).filter(Boolean)
  const out: string[] = []
  for (let i = 0; i < parts.length; i++) {
    if (RES_OR_FMT.test(parts[i])) continue
    out.push(parts[i])
    if (i + 1 < parts.length && !RES_OR_FMT.test(parts[i + 1])) {
      out.push(`${parts[i]}${parts[i + 1]}`)
      out.push(`${parts[i]}_${parts[i + 1]}`)
    }
  }
  if (parts.length) out.push(parts[parts.length - 1])
  out.push(base)
  return [...new Set(out)]
}

function classifyFile(file: File): { slot: StageMapSlot; rank: number; flip?: boolean } | 'skip' | null {
  if (!IMAGE_EXT.test(file.name)) return null
  const base = basename(file)
  const lower = base.toLowerCase()
  // ambientCG / PH previews are not PBR maps.
  if (/\b(preview|thumb|thumbnail|sphere|sqm?)\b/.test(lower) || /_sq$/i.test(base)) {
    return 'skip'
  }
  for (const token of tokensFromBasename(base)) {
    const hit = classifyToken(token)
    if (hit) return hit
  }
  // Loose contains match for odd exporters.
  if (/\bnormal\s*gl\b|normalgl|nor_gl/.test(lower)) return { slot: 'normal', rank: 18, flip: false }
  if (/\bnormal\s*dx\b|normaldx|nor_dx/.test(lower)) return { slot: 'normal', rank: 9, flip: true }
  if (/\b(color|albedo|diffuse|basecolor|diff|col)\b/.test(lower)) return { slot: 'map', rank: 6 }
  if (/\brough/.test(lower)) return { slot: 'roughness', rank: 6 }
  if (/\bmetal/.test(lower)) return { slot: 'metalness', rank: 6 }
  if (/\b(disp|height|displacement)\b/.test(lower)) return { slot: 'displacement', rank: 6 }
  if (/\b(ao|occlusion)\b/.test(lower)) return { slot: 'ao', rank: 6 }
  if (/\b(emiss|emit)\b/.test(lower)) return { slot: 'emissive', rank: 6 }
  if (/\b(opacity|alpha)\b/.test(lower)) return 'skip'
  return null
}

function isOrmName(base: string): boolean {
  const compact = base.toLowerCase().replace(/[_\-.\s]/g, '')
  return (
    /(^|[^a-z])(orm|arm)([^a-z]|$)/.test(base.toLowerCase()) ||
    /(orm|arm|occlusionroughnessmetallic)$/.test(compact)
  )
}

/** Classify a set of files (folder or multi-select) into stage map slots. */
export function detectPbrMapsFromFiles(files: Iterable<File>): DetectedPbrMaps {
  const best: Partial<Record<StageMapSlot, Ranked>> = {}
  const skipped: string[] = []
  const unmatched: string[] = []
  let ormFile: File | null = null

  for (const file of files) {
    if (!IMAGE_EXT.test(file.name)) {
      if (/\.(exr|hdr|tif{1,2})$/i.test(file.name)) {
        skipped.push(`${file.name} (use JPG/PNG from ambientCG — EXR not loaded yet)`)
      }
      continue
    }
    const hit = classifyFile(file)
    if (!hit) {
      unmatched.push(file.name)
      continue
    }
    if (hit === 'skip') {
      skipped.push(file.name)
      continue
    }
    const base = basename(file)
    if (isOrmName(base)) ormFile = file
    const prev = best[hit.slot]
    if (!prev || hit.rank > prev.rank) {
      best[hit.slot] = { file, rank: hit.rank, flip: hit.flip }
    }
  }

  const out: DetectedPbrMaps = {
    files: {},
    normalYFlip: false,
    skipped,
    unmatched,
  }

  for (const [slot, ranked] of Object.entries(best) as Array<[StageMapSlot, Ranked]>) {
    out.files[slot] = ranked.file
    if (slot === 'normal') out.normalYFlip = Boolean(ranked.flip)
  }

  // Packed ORM/ARM: fill only empty slots so discrete ambientCG maps win.
  if (ormFile) {
    if (!out.files.ao) out.files.ao = ormFile
    if (!out.files.roughness) out.files.roughness = ormFile
    if (!out.files.metalness) out.files.metalness = ormFile
  }

  return out
}

export function summarizeDetectedPbrMaps(detected: DetectedPbrMaps): string {
  const assigned = Object.entries(detected.files)
    .map(([slot, file]) => `${slot}=${file!.name}`)
    .join(', ')
  const bits = [assigned || 'nothing matched']
  if (detected.normalYFlip) bits.push('NormalDX → Y flip')
  if (detected.skipped.length) bits.push(`skipped ${detected.skipped.length}`)
  if (detected.unmatched.length) bits.push(`unmatched ${detected.unmatched.length}`)
  return bits.join(' · ')
}
