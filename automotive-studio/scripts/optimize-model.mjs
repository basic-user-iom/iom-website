/**
 * Offline automotive GLB optimizer (Phase 3).
 * Never overwrites the source — writes variants + JSON reports beside the out dir.
 *
 * Usage:
 *   node scripts/optimize-automotive-model.mjs --input <src.glb> [--out <dir>] [--variant high|balanced|mobile|all]
 *
 * Default input: F:/FREE_Lixiang_L9_2024_(White_Interior)/FREE_Lixiang_L9_2024_(White_Interior).glb
 * Default out:   F:/FREE_Lixiang_L9_2024_(White_Interior)/optimized/
 *
 * Safe ops: dedup, prune unused, resample, quantize, texture resize (sharp).
 * Does NOT flatten hierarchy (preserves doors/wheels/animation targets).
 * Simplification is opt-in per variant and skipped on High by default.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, access, rename, unlink } from 'node:fs/promises'
import { dirname, join, basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import {
  dedup,
  prune,
  quantize,
  resample,
  simplify,
  textureCompress,
  weld,
} from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const DEFAULT_INPUT = resolve(
  'F:/FREE_Lixiang_L9_2024_(White_Interior)/FREE_Lixiang_L9_2024_(White_Interior).glb',
)
const DEFAULT_OUT = resolve('F:/FREE_Lixiang_L9_2024_(White_Interior)/optimized')

/** @type {Record<string, { file: string, resize: [number, number], format: string, quality: number, simplifyRatio: number|null, simplifyError: number, resampleTolerance: number }>} */
const VARIANTS = {
  high: {
    file: 'lixiang-presentation-high.glb',
    resize: [1280, 1280],
    format: 'webp',
    quality: 78,
    simplifyRatio: null,
    simplifyError: 0,
    resampleTolerance: 0.0001,
  },
  balanced: {
    file: 'lixiang-balanced.glb',
    resize: [1024, 1024],
    format: 'webp',
    quality: 75,
    simplifyRatio: 0.65,
    simplifyError: 0.02,
    resampleTolerance: 0.001,
  },
  mobile: {
    file: 'lixiang-mobile.glb',
    resize: [640, 640],
    format: 'webp',
    quality: 68,
    simplifyRatio: 0.35,
    simplifyError: 0.06,
    resampleTolerance: 0.002,
  },
}

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT, out: DEFAULT_OUT, variant: 'all' }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--input') args.input = resolve(argv[++i])
    else if (a === '--out') args.out = resolve(argv[++i])
    else if (a === '--variant') args.variant = argv[++i]
  }
  return args
}

async function sha256File(path) {
  const buf = await readFile(path)
  return createHash('sha256').update(buf).digest('hex')
}

function countTriangles(document) {
  let triangles = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const mode = prim.getMode()
      const indices = prim.getIndices()
      const position = prim.getAttribute('POSITION')
      if (indices) {
        const n = indices.getCount()
        triangles += mode === 5 ? Math.max(0, n - 2) : n / 3
      } else if (position) {
        triangles += position.getCount() / 3
      }
    }
  }
  return Math.round(triangles)
}

function countAnimations(document) {
  return document.getRoot().listAnimations().map((anim) => {
    let duration = 0
    for (const s of anim.listSamplers()) {
      const arr = s.getInput()?.getArray()
      if (arr?.length) duration = Math.max(duration, Number(arr[arr.length - 1]))
    }
    return {
      name: anim.getName() || 'Animation',
      channels: anim.listChannels().length,
      duration,
    }
  })
}

function preserveAnimatedNodeNames(document) {
  const names = new Set()
  for (const anim of document.getRoot().listAnimations()) {
    for (const ch of anim.listChannels()) {
      const n = ch.getTargetNode()?.getName()
      if (n) names.add(n)
    }
  }
  return [...names]
}

/** Ensure every embedded texture decodes with sharp (catches corrupt WebP writes). */
async function validateTextureImages(document) {
  let ok = 0
  let bad = 0
  const total = document.getRoot().listTextures().length
  for (const texture of document.getRoot().listTextures()) {
    const bytes = texture.getImage()
    if (!bytes || bytes.byteLength === 0) {
      bad += 1
      continue
    }
    try {
      await sharp(Buffer.from(bytes)).metadata()
      ok += 1
    } catch {
      bad += 1
    }
  }
  return { ok, bad, total }
}

async function buildVariant(io, sourcePath, sourceHash, outDir, key, variant) {
  console.log(`\n→ Building ${key}…`)
  const document = await io.read(sourcePath)
  const animated = preserveAnimatedNodeNames(document)
  console.log(`  preserving ${animated.length} animated node names: ${animated.join(', ')}`)

  const transforms = [
    weld(),
    dedup(),
    prune(),
    resample({ tolerance: variant.resampleTolerance }),
  ]

  if (variant.simplifyRatio != null) {
    await MeshoptSimplifier.ready
    transforms.push(
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: variant.simplifyRatio,
        error: variant.simplifyError,
        // Keep skinned / morph if any; Lixiang is rigid hierarchy.
      }),
    )
  }

  // Compress textures BEFORE quantize so image bufferViews are finalized
  // and cannot be confused with quantized accessor packing.
  transforms.push(
    prune(),
    textureCompress({
      encoder: sharp,
      resize: variant.resize,
      targetFormat: variant.format,
      quality: variant.quality,
    }),
    quantize({
      quantizePosition: 14,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
    }),
    prune(),
  )

  await document.transform(...transforms)

  const outPath = join(outDir, variant.file)
  // Must end in `.glb` — NodeIO picks container format from the extension.
  // `file.glb.tmp` was written as non-GLB (~200 KiB, textures only).
  const tmpPath = join(outDir, `${variant.file}.tmp.glb`)
  await io.write(tmpPath, document)

  // Re-read from the temp file — catches write/pack corruption before replace.
  const verifyIo = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const written = await verifyIo.read(tmpPath)
  const textureCheck = await validateTextureImages(written)
  if (textureCheck.bad > 0) {
    throw new Error(
      `Texture validation failed for ${variant.file}: ${textureCheck.bad}/${textureCheck.total} images are not decodable ${variant.format}. Refusing to keep a broken variant.`,
    )
  }
  console.log(`  textures OK (${textureCheck.ok}/${textureCheck.total} decodable)`)

  try {
    await unlink(outPath)
  } catch {
    // first write
  }
  await rename(tmpPath, outPath)

  const size = (await readFile(outPath)).length
  if (size < 1024 * 1024) {
    throw new Error(
      `Refusing ${variant.file}: output is only ${(size / 1024).toFixed(1)} KiB — expected a full GLB (check temp path ends in .glb).`,
    )
  }
  const tris = countTriangles(document)
  const anims = countAnimations(document)
  const outHash = await sha256File(outPath)

  const report = {
    variant: key,
    tool: {
      script: 'scripts/optimize-automotive-model.mjs',
      gltfTransform: '^4.4',
      meshoptimizer: 'meshopt simplifier + quantize',
      sharp: true,
    },
    source: {
      path: sourcePath,
      sha256: sourceHash,
    },
    output: {
      path: outPath,
      sha256: outHash,
      bytes: size,
      miB: Number((size / (1024 * 1024)).toFixed(2)),
      triangles: tris,
      animations: anims,
    },
    settings: variant,
    preservedAnimatedNodes: animated,
    gates: {
      presentationHighMiB: key === 'high' ? size / (1024 * 1024) <= 30 : null,
      mobileMiB: key === 'mobile' ? size / (1024 * 1024) <= 15 : null,
      animationChannelCount: anims[0]?.channels ?? 0,
      animationDuration: anims[0]?.duration ?? 0,
    },
    createdAt: new Date().toISOString(),
  }

  await writeFile(join(outDir, `report-${key}.json`), JSON.stringify(report, null, 2))
  console.log(
    `  wrote ${variant.file} — ${tris.toLocaleString()} tris · ${report.output.miB} MiB` +
      (variant.simplifyRatio != null ? ` · simplify ${variant.simplifyRatio}` : ' · no simplify'),
  )
  if (key === 'high' && report.output.miB > 30) {
    console.warn(`  WARN: High variant ${report.output.miB} MiB exceeds 30 MiB gate — review textures/settings.`)
  }
  if (key === 'mobile' && report.output.miB > 15) {
    console.warn(`  WARN: Mobile variant ${report.output.miB} MiB exceeds 15 MiB gate.`)
  }
  return report
}

async function main() {
  const args = parseArgs(process.argv)
  try {
    await access(args.input)
  } catch {
    console.error(`Source GLB not found: ${args.input}`)
    process.exit(1)
  }

  await mkdir(args.out, { recursive: true })
  const sourceHash = await sha256File(args.input)
  const sourceBytes = (await readFile(args.input)).length
  console.log(`Source: ${args.input}`)
  console.log(`  ${(sourceBytes / (1024 * 1024)).toFixed(2)} MiB · sha256 ${sourceHash.slice(0, 16)}…`)
  console.log(`Out:    ${args.out}`)
  console.log('NOTE: source file is never overwritten.')

  await MeshoptSimplifier.ready

  // Do not register meshopt encoder on the writer IO — we only use MeshoptSimplifier
  // for optional triangle reduction. Meshopt buffer compression is not applied.
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

  const keys =
    args.variant === 'all' ? Object.keys(VARIANTS) : [args.variant]
  for (const key of keys) {
    if (!VARIANTS[key]) {
      console.error(`Unknown variant: ${key}`)
      process.exit(1)
    }
  }

  const reports = []
  for (const key of keys) {
    reports.push(await buildVariant(io, args.input, sourceHash, args.out, key, VARIANTS[key]))
  }

  await writeFile(
    join(args.out, 'optimize-summary.json'),
    JSON.stringify(
      {
        source: { path: args.input, sha256: sourceHash, bytes: sourceBytes },
        variants: reports,
        licenseNote:
          'Prototype Lixiang asset — internal/technical use only until written clearance (Phase 0 decision B).',
      },
      null,
      2,
    ),
  )
  console.log('\nDone. Reports in', args.out)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
