/**
 * Validate every manifest-routed building-viewer asset.
 *
 * Normal validation reports stale optimization metadata as warnings so local
 * source builds remain possible. The release gate is intentionally strict:
 *
 *   npm run model:validate
 *   npm run model:gate
 */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, readFile, readdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listTextureInfo } from '@gltf-transform/functions'
import { createGltfIO } from './lib/gltf-io.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = join(SCRIPT_DIR, '..', '..')
const MANIFEST_PATH = join(ROOT, 'public', 'models', 'manifest.json')
const PUBLIC = join(ROOT, 'public')

const MAX_ALWAYS_ON_TRIS = 150_000
const OWNERSHIP_TOLERANCE = 0.08
const MAX_TOTAL_CELL_BYTES = 900 * 1024 * 1024

// Full-asset pre-runtime gates. Runtime visible-view budgets are tighter and
// belong to the route/device harness; these catch monoliths before bundling.
const ACTIVE_ASSET_BUDGETS = {
  web: { expandedTriangles: 2_000_000, primitiveDraws: 1_000, bytes: 200 * 1024 * 1024 },
  quest: { expandedTriangles: 800_000, primitiveDraws: 1_000, bytes: 100 * 1024 * 1024 },
}

const EXTERIOR_FLOOR_DEBUG_CHECKER = Object.freeze({
  material: 'Material 2097707472',
  texture: 'Material 2097707472_base_color_map',
  encodedTextureSha256: 'a1f19cc4bbb82ddff7603cdb395122ffcc08e1f4b405d2de00ddaf850b568b20',
})

function parseArgs(argv) {
  const args = {
    requireCells: false,
    failOnWarn: false,
    requireCurrentReports: false,
    enforceBudgets: false,
  }
  for (let i = 2; i < argv.length; i++) {
    const value = argv[i]
    if (value === '--require-cells') args.requireCells = true
    else if (value === '--fail-on-warn') args.failOnWarn = true
    else if (value === '--require-current-reports') args.requireCurrentReports = true
    else if (value === '--enforce-budgets') args.enforceBudgets = true
    else throw new Error(`Unknown argument: ${value}`)
  }
  return args
}

function publicPath(url) {
  if (!url?.startsWith('/')) return null
  return join(PUBLIC, url.replace(/^\//, ''))
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function sha256File(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

function primitiveTriangleCount(primitive) {
  const count = primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')?.getCount() ?? 0
  const mode = primitive.getMode()
  if (mode === 4) return Math.floor(count / 3)
  if (mode === 5 || mode === 6) return Math.max(0, count - 2)
  return 0
}

function hasMaterialTexture(material) {
  if (!material) return false
  return Boolean(
    material.getBaseColorTexture() ||
      material.getNormalTexture() ||
      material.getMetallicRoughnessTexture() ||
      material.getOcclusionTexture() ||
      material.getEmissiveTexture(),
  )
}

function isLightmapReceiver(material) {
  if (!material) return true
  const emissive = material.getEmissiveFactor?.() ?? [0, 0, 0]
  if (material.getEmissiveTexture?.() || Math.max(...emissive) > 0.02) return false
  const alpha = material.getBaseColorFactor?.()?.[3] ?? 1
  if (material.getAlphaMode?.() === 'BLEND' && alpha < 0.95) return false
  const transmission = material
    .getExtension?.('KHR_materials_transmission')
    ?.getTransmissionFactor?.() ?? 0
  return transmission <= 0.02
}

function analyzeDocument(document) {
  const root = document.getRoot()
  let storedTriangles = 0
  let storedPrimitives = 0
  let expandedTriangles = 0
  let primitiveDraws = 0
  let meshNodes = 0
  let logicalInstances = 0
  let texturedPrimitivesWithoutUv0 = 0
  let primitivesWithUv1 = 0
  let primitiveCount = 0
  let lightmapReceiversWithUv1 = 0
  let lightmapReceiverCount = 0

  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      primitiveCount += 1
      storedPrimitives += 1
      storedTriangles += primitiveTriangleCount(primitive)
      if (hasMaterialTexture(primitive.getMaterial()) && !primitive.getAttribute('TEXCOORD_0')) {
        texturedPrimitivesWithoutUv0 += 1
      }
      if (primitive.getAttribute('TEXCOORD_1')) primitivesWithUv1 += 1
      if (isLightmapReceiver(primitive.getMaterial())) {
        lightmapReceiverCount += 1
        if (primitive.getAttribute('TEXCOORD_1')) lightmapReceiversWithUv1 += 1
      }
    }
  }

  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const instancing = node.getExtension('EXT_mesh_gpu_instancing')
    let instanceCount = 1
    if (instancing) {
      for (const semantic of ['TRANSLATION', 'ROTATION', 'SCALE', '_ID']) {
        const accessor = instancing.getAttribute?.(semantic)
        if (accessor) {
          instanceCount = accessor.getCount()
          break
        }
      }
    }
    meshNodes += 1
    logicalInstances += instanceCount
    for (const primitive of mesh.listPrimitives()) {
      primitiveDraws += 1
      expandedTriangles += primitiveTriangleCount(primitive) * instanceCount
    }
  }

  const materials = root.listMaterials()
  const exteriorFloorDebugCheckerMaterials = materials
    .filter((material) => material.getName() === EXTERIOR_FLOOR_DEBUG_CHECKER.material)
    .length
  let exteriorFloorDebugCheckerTextures = 0
  let invalidTextureCoordinates = 0
  for (const texture of root.listTextures()) {
    const image = texture.getImage()
    const digest = image ? createHash('sha256').update(image).digest('hex') : null
    if (
      texture.getName() === EXTERIOR_FLOOR_DEBUG_CHECKER.texture ||
      digest === EXTERIOR_FLOOR_DEBUG_CHECKER.encodedTextureSha256
    ) {
      exteriorFloorDebugCheckerTextures += 1
    }
    for (const info of listTextureInfo(texture)) {
      const texCoord = info.getTexCoord()
      if (!Number.isInteger(texCoord) || texCoord < 0 || texCoord > 7) invalidTextureCoordinates += 1
      const override = info.getExtension('KHR_texture_transform')?.getTexCoord?.()
      if (override != null && (!Number.isInteger(override) || override < 0 || override > 7)) {
        invalidTextureCoordinates += 1
      }
    }
  }
  const extensionsUsed = root.listExtensionsUsed().map((extension) => extension.extensionName).sort()
  return {
    generator: root.getAsset().generator || null,
    nodes: root.listNodes().length,
    meshNodes,
    logicalInstances,
    meshes: root.listMeshes().length,
    storedPrimitives,
    storedTriangles,
    primitiveDraws,
    expandedTriangles,
    materials: materials.length,
    doubleSidedMaterials: materials.filter((material) => material.getDoubleSided()).length,
    exteriorFloorDebugCheckerMaterials,
    exteriorFloorDebugCheckerTextures,
    textures: root.listTextures().length,
    ktx2Textures: root.listTextures().filter((texture) => texture.getMimeType?.() === 'image/ktx2').length,
    texturedPrimitivesWithoutUv0,
    primitivesWithUv1,
    primitiveCount,
    lightmapReceiversWithUv1,
    lightmapReceiverCount,
    invalidTextureCoordinates,
    extensionsUsed,
  }
}

async function analyzeVisual(path, io, cache) {
  if (!cache.has(path)) {
    cache.set(
      path,
      (async () => {
        const [document, digest, fileStat] = await Promise.all([
          io.read(path),
          sha256File(path),
          stat(path),
        ])
        return { ...analyzeDocument(document), sha256: digest, bytes: fileStat.size }
      })(),
    )
  }
  return cache.get(path)
}

function reportExpandedTriangles(report) {
  return report?.output?.expandedTriangles ?? report?.output?.expandedWorkload?.triangles ?? null
}

function reportPrimitiveDraws(report) {
  return report?.output?.primitiveDraws ?? report?.output?.expandedWorkload?.primitiveDraws ?? null
}

async function findMatchingReport(path, profile, analysis) {
  const baseDir = dirname(path)
  const fileNames = await readdir(baseDir)
  const preferred = `report-${profile}.json`
  const candidates = [
    ...fileNames.filter((name) => name === preferred),
    ...fileNames.filter((name) => /^report-[a-z0-9_-]+\.json$/i.test(name) && name !== preferred),
  ]
  if (await exists(`${path}.provenance.json`)) candidates.push(`${path}.provenance.json`)

  const inspected = []
  for (const candidate of candidates) {
    const reportPath = candidate.includes(':') || candidate.startsWith(baseDir)
      ? candidate
      : join(baseDir, candidate)
    try {
      const report = JSON.parse(await readFile(reportPath, 'utf8'))
      const reportHash = report?.output?.sha256
      inspected.push({ reportPath, report, reportHash })
      if (reportHash === analysis.sha256) return { reportPath, report }
    } catch {
      // Malformed reports are surfaced as no matching current report below.
    }
  }
  return { reportPath: null, report: null, inspected }
}

function addGateIssue(args, errors, warnings, message) {
  if (args.requireCurrentReports) errors.push(message)
  else warnings.push(message)
}

async function validateVisualRoute(entry, profile, path, analysis, args, errors, warnings) {
  const id = entry.id
  console.log(
    `  ${profile} workload: stored=${analysis.storedTriangles.toLocaleString()} tris/${analysis.storedPrimitives.toLocaleString()} prims · ` +
      `expanded=${analysis.expandedTriangles.toLocaleString()} tris/${analysis.primitiveDraws.toLocaleString()} draws · ` +
      `sha256=${analysis.sha256.slice(0, 12)}…`,
  )
  console.log(
    `    generator=${analysis.generator || '(missing)'} · textures=${analysis.textures} (${analysis.ktx2Textures} KTX2) · ` +
      `materials=${analysis.materials} (${analysis.doubleSidedMaterials} double-sided)`,
  )

  if (analysis.texturedPrimitivesWithoutUv0 > 0) {
    warnings.push(
      `${id}.${profile}: ${analysis.texturedPrimitivesWithoutUv0} textured primitive(s) have no TEXCOORD_0`,
    )
  }
  if (analysis.invalidTextureCoordinates > 0) {
    errors.push(
      `${id}.${profile}: ${analysis.invalidTextureCoordinates} invalid texture coordinate reference(s); this can produce invalid WebGL shaders`,
    )
  }
  if (
    id === 'icm-ext' &&
    (analysis.exteriorFloorDebugCheckerMaterials > 0 || analysis.exteriorFloorDebugCheckerTextures > 0)
  ) {
    errors.push(
      `${id}.${profile}: exterior C5/C6 floor still contains the single-use black/white debug checker ` +
        `(${analysis.exteriorFloorDebugCheckerMaterials} material, ${analysis.exteriorFloorDebugCheckerTextures} texture)`,
    )
  }
  if (
    entry.lightmap &&
    analysis.lightmapReceiversWithUv1 !== analysis.lightmapReceiverCount
  ) {
    warnings.push(
      `${id}.${profile}: lightmap route has TEXCOORD_1 on ` +
        `${analysis.lightmapReceiversWithUv1}/${analysis.lightmapReceiverCount} receiving primitives`,
    )
  }
  if (
    analysis.materials > 0 &&
    analysis.doubleSidedMaterials === analysis.materials &&
    !entry.hideInLayerList
  ) {
    warnings.push(`${id}.${profile}: every material is double-sided; back-face culling is disabled`)
  }
  if (
    !entry.hideInLayerList &&
    analysis.textures > 0 &&
    analysis.ktx2Textures !== analysis.textures
  ) {
    warnings.push(
      `${id}.${profile}: only ${analysis.ktx2Textures}/${analysis.textures} textures are KTX2`,
    )
  }
  if (!entry.hideInLayerList && !analysis.extensionsUsed.includes('EXT_meshopt_compression')) {
    warnings.push(`${id}.${profile}: EXT_meshopt_compression is missing`)
  }

  if (!entry.hideInLayerList) {
    const match = await findMatchingReport(path, profile, analysis)
    if (!match.report) {
      addGateIssue(
        args,
        errors,
        warnings,
        `${id}.${profile}: no optimization/provenance report matches active hash ${analysis.sha256}`,
      )
    } else {
      const reportExpanded = reportExpandedTriangles(match.report)
      const reportDraws = reportPrimitiveDraws(match.report)
      if (
        id === 'icm-ext' &&
        match.report?.sourcePreparation?.exteriorFloorCheckerRepair?.applied !== true
      ) {
        errors.push(
          `${id}.${profile}: current provenance does not prove the hash-pinned C5/C6 floor checker repair`,
        )
      }
      if (reportExpanded == null || reportDraws == null) {
        addGateIssue(
          args,
          errors,
          warnings,
          `${id}.${profile}: current report ${match.reportPath} omits expandedTriangles/primitiveDraws`,
        )
      } else if (
        reportExpanded !== analysis.expandedTriangles ||
        reportDraws !== analysis.primitiveDraws
      ) {
        addGateIssue(
          args,
          errors,
          warnings,
          `${id}.${profile}: report workload differs from active GLB ` +
            `(report ${reportExpanded}/${reportDraws}, actual ${analysis.expandedTriangles}/${analysis.primitiveDraws})`,
        )
      } else {
        console.log(`    report: ${match.reportPath} (hash + expanded workload current)`)
      }
    }
  }

  if (args.enforceBudgets && !entry.hideInLayerList) {
    const budget = ACTIVE_ASSET_BUDGETS[profile]
    if (budget && analysis.expandedTriangles > budget.expandedTriangles) {
      errors.push(
        `${id}.${profile}: expanded triangles ${analysis.expandedTriangles.toLocaleString()} > ${budget.expandedTriangles.toLocaleString()} asset gate`,
      )
    }
    if (budget && analysis.primitiveDraws > budget.primitiveDraws) {
      errors.push(
        `${id}.${profile}: primitive draws ${analysis.primitiveDraws.toLocaleString()} > ${budget.primitiveDraws.toLocaleString()} asset gate`,
      )
    }
    if (budget && analysis.bytes > budget.bytes) {
      errors.push(
        `${id}.${profile}: transfer ${(analysis.bytes / (1024 * 1024)).toFixed(2)} MiB > ${(budget.bytes / (1024 * 1024)).toFixed(0)} MiB asset gate`,
      )
    }
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const errors = []
  const warnings = []
  const io = await createGltfIO()
  const visualCache = new Map()

  const raw = await readFile(MANIFEST_PATH, 'utf8')
  const manifest = JSON.parse(raw)
  if (!Array.isArray(manifest.models) || manifest.models.length === 0) {
    errors.push('manifest.models is empty')
  }

  for (const entry of manifest.models || []) {
    const id = entry.id || '?'
    console.log(`\n[${id}]`)

    if (entry.collisionMergeVisual === undefined) {
      warnings.push(`${id}: collisionMergeVisual not set (implicit true)`)
    } else {
      console.log(`  collisionMergeVisual=${entry.collisionMergeVisual}`)
    }

    for (const key of [
      'web',
      'quest',
      'collision',
      'spatialMeta',
      'animation',
      'cellManifest',
      'lightmap',
    ]) {
      const url = entry[key]
      if (!url) continue
      const path = publicPath(url)
      if (!path) {
        errors.push(`${id}.${key}: invalid URL ${url}`)
        continue
      }
      if (!(await exists(path))) {
        errors.push(`${id}.${key}: missing file ${url}`)
        continue
      }
      const fileStat = await stat(path)
      console.log(`  ${key}: ${(fileStat.size / (1024 * 1024)).toFixed(2)} MiB`)
    }

    for (const profile of ['web', 'quest']) {
      if (!entry[profile]) continue
      const path = publicPath(entry[profile])
      if (!path || !(await exists(path))) continue
      try {
        const analysis = await analyzeVisual(path, io, visualCache)
        await validateVisualRoute(entry, profile, path, analysis, args, errors, warnings)
      } catch (error) {
        errors.push(`${id}.${profile}: failed to read active visual GLB — ${error.message}`)
      }
    }

    if (entry.collision) {
      const collisionPath = publicPath(entry.collision)
      try {
        const document = await io.read(collisionPath)
        const analysis = analyzeDocument(document)
        const textures = document.getRoot().listTextures().length
        console.log(
          `  collision workload: expanded=${analysis.expandedTriangles.toLocaleString()} tris/${analysis.primitiveDraws.toLocaleString()} draws · textures=${textures}`,
        )
        if (analysis.expandedTriangles > 500_000) {
          const message = `${id}: collision expanded tris ${analysis.expandedTriangles} > 500k runtime max`
          if (args.enforceBudgets) errors.push(message)
          else warnings.push(message)
        }
        if (textures > 0) warnings.push(`${id}: collision still has ${textures} textures`)
        if (entry.collisionMergeVisual === false && analysis.expandedTriangles < 50_000) {
          warnings.push(
            `${id}: proxy-only with only ${analysis.expandedTriangles} expanded tris — verify floors/stairs`,
          )
        }
      } catch (error) {
        errors.push(`${id}: failed to read collision — ${error.message}`)
      }
    }

    if (entry.animation) {
      try {
        const animationDocument = await io.read(publicPath(entry.animation))
        const animations = animationDocument.getRoot().listAnimations().length
        console.log(`  animation clips=${animations}`)
        if (animations === 0) warnings.push(`${id}: animation sidecar contains no clips`)
      } catch (error) {
        errors.push(`${id}: failed to read animation sidecar — ${error.message}`)
      }
    }

    if (entry.animation && entry.cellManifest) {
      warnings.push(
        `${id}: cellManifest + animation — flattened cells will not move with floor clips; keep streaming OFF unless bake preserves anim rigs`,
      )
    }

    if (entry.cellManifest) {
      const cellPath = publicPath(entry.cellManifest)
      try {
        const cellManifest = JSON.parse(await readFile(cellPath, 'utf8'))
        await validateCellManifest(entry, cellManifest, cellPath, errors, warnings)
      } catch (error) {
        errors.push(`${id}: cellManifest invalid — ${error.message}`)
      }
    } else if (args.requireCells) {
      errors.push(`${id}: missing cellManifest (--require-cells)`)
    } else {
      console.log('  cellManifest: (not enabled — OK for Phase 0)')
    }
  }

  console.log('\n---')
  for (const warning of warnings) console.warn(`WARN: ${warning}`)
  for (const error of errors) console.error(`ERROR: ${error}`)

  if (errors.length || (args.failOnWarn && warnings.length)) {
    console.error(`\nValidation FAILED (${errors.length} errors, ${warnings.length} warnings)`)
    process.exit(1)
  }
  console.log(`\nValidation OK (${warnings.length} warnings)`)
}

async function validateCellManifest(entry, cellManifest, cellPath, errors, warnings) {
  const id = entry.id
  const baseDir = dirname(cellPath)
  const cells = cellManifest.cells || []
  let alwaysOn = 0
  let owned = 0
  let bytes = 0

  if ((cellManifest.version ?? 1) < 2) {
    warnings.push(`${id}: cell-manifest version ${cellManifest.version} — rebuild with triangle ownership bake`)
  }

  for (const cell of cells) {
    owned += cell.triangles || 0
    bytes += cell.bytes || 0
    if (cell.alwaysOn) alwaysOn += cell.triangles || 0
    const relative = cell.url
    if (!relative) {
      errors.push(`${id}: cell ${cell.id} missing url`)
      continue
    }
    const path = relative.startsWith('/') ? publicPath(relative) : join(baseDir, relative)
    if (!(await exists(path))) errors.push(`${id}: missing cell file ${relative}`)
  }

  const sourceTris = cellManifest.stats?.sourceTriangles
  console.log(
    `  cells=${cells.length} ownedTris=${owned.toLocaleString()} alwaysOn=${alwaysOn.toLocaleString()} bytes=${(bytes / (1024 * 1024)).toFixed(1)} MiB`,
  )

  if (alwaysOn > MAX_ALWAYS_ON_TRIS) {
    errors.push(`${id}: always-on tris ${alwaysOn} > ${MAX_ALWAYS_ON_TRIS}`)
  }
  if (bytes > MAX_TOTAL_CELL_BYTES) {
    errors.push(
      `${id}: cell total ${(bytes / (1024 * 1024)).toFixed(0)} MiB exceeds ${(MAX_TOTAL_CELL_BYTES / (1024 * 1024)).toFixed(0)} MiB budget`,
    )
  }
  if (sourceTris && owned > sourceTris * (1 + OWNERSHIP_TOLERANCE)) {
    errors.push(
      `${id}: cell owned tris ${owned} exceeds source ${sourceTris} by more than ${(OWNERSHIP_TOLERANCE * 100).toFixed(0)}%`,
    )
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
