/**
 * Reproducible gltfpack wrapper for the final Meshopt + KTX2 release stage.
 * It never overwrites the input and refuses an existing output unless --force
 * is explicitly supplied.
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { access, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listTextureInfo, listTextureInfoByMaterial } from '@gltf-transform/functions'
import { createGltfIO } from './lib/gltf-io.mjs'
import {
  auditSurfaceRepairCertificates,
  surfaceRepairAuditSummary,
} from './lib/surface-repair-certificate.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = join(SCRIPT_DIR, '..')
const CONFIG_PATH = join(VIEWER_ROOT, 'toolchain', 'gltfpack-1.2.json')

function parseArgs(argv) {
  const args = {
    check: false,
    dryRun: false,
    force: false,
    input: null,
    output: null,
    profile: 'web',
    binary: null,
    animationFps: null,
  }
  for (let i = 2; i < argv.length; i++) {
    const value = argv[i]
    if (value === '--check') args.check = true
    else if (value === '--dry-run') args.dryRun = true
    else if (value === '--force') args.force = true
    else if (value === '--input') args.input = resolve(argv[++i])
    else if (value === '--output') args.output = resolve(argv[++i])
    else if (value === '--profile') args.profile = argv[++i]
    else if (value === '--binary') args.binary = resolve(argv[++i])
    else if (value === '--animation-fps') args.animationFps = Number(argv[++i])
    else throw new Error(`Unknown argument: ${value}`)
  }
  return args
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
  const bytes = await readFile(path)
  return createHash('sha256').update(bytes).digest('hex')
}

function triangleCount(primitive) {
  const count = primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')?.getCount() ?? 0
  const mode = primitive.getMode()
  if (mode === 4) return Math.floor(count / 3)
  if (mode === 5 || mode === 6) return Math.max(0, count - 2)
  return 0
}

function expandedWorkload(document) {
  let triangles = 0
  let primitiveDraws = 0
  let meshNodes = 0
  let logicalInstances = 0
  for (const node of document.getRoot().listNodes()) {
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
      triangles += triangleCount(primitive) * instanceCount
    }
  }
  return { triangles, primitiveDraws, meshNodes, logicalInstances }
}

function validTexCoord(value) {
  return Number.isInteger(value) && value >= 0 && value <= 7
}

function sanitizeTextureCoordinates(document) {
  let textureInfos = 0
  let transforms = 0
  for (const texture of document.getRoot().listTextures()) {
    for (const info of listTextureInfo(texture)) {
      const texCoord = info.getTexCoord()
      if (!validTexCoord(texCoord)) {
        info.setTexCoord(0)
        textureInfos += 1
      }
      const transform = info.getExtension('KHR_texture_transform')
      const override = transform?.getTexCoord?.()
      if (override != null && !validTexCoord(override)) {
        transform.setTexCoord(null)
        transforms += 1
      }
    }
  }
  return { textureInfos, transforms, total: textureInfos + transforms }
}

function effectiveTexCoord(info) {
  return info.getExtension('KHR_texture_transform')?.getTexCoord?.() ?? info.getTexCoord()
}

function fallbackTileMeters(material) {
  const label = [
    material.getName?.() || '',
    material.getBaseColorTexture?.()?.getName?.() || '',
    material.getNormalTexture?.()?.getName?.() || '',
  ].join(' ')
  if (/wasser|water|\bteich\b|\bsee\b|\bpond\b|\bpool\b|brunnen|fountain/i.test(label)) {
    return 8
  }
  if (
    /kopfstein|pflaster|cobblestone|cobble|paving|steinplatten|steinboden|seeweg|fussweg|fußweg|gehweg|grass|gras|rasen|gruen|grün/i.test(label)
  ) {
    return 1.5
  }
  return 4
}

function fallbackTextureScale(material, texCoord) {
  for (const info of listTextureInfoByMaterial(material)) {
    if (effectiveTexCoord(info) !== texCoord) continue
    const scale = info.getExtension('KHR_texture_transform')?.getScale?.()
    if (scale && scale.length >= 2) {
      return [Math.abs(scale[0]) > 1e-8 ? scale[0] : 1, Math.abs(scale[1]) > 1e-8 ? scale[1] : 1]
    }
  }
  return [1, 1]
}

function createPlanarTexCoord(document, primitive, material, texCoord) {
  const position = primitive.getAttribute('POSITION')
  if (!position || position.getCount() < 1) return false

  const count = position.getCount()
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const value = [0, 0, 0]
  for (let i = 0; i < count; i++) {
    position.getElement(i, value)
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], value[axis])
      max[axis] = Math.max(max[axis], value[axis])
    }
  }
  const spans = max.map((v, axis) => Math.max(0, v - min[axis]))
  const axes = [0, 1, 2].sort((a, b) => spans[b] - spans[a]).slice(0, 2)
  const tileMeters = fallbackTileMeters(material)
  const textureScale = fallbackTextureScale(material, texCoord)
  const uvs = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) {
    position.getElement(i, value)
    uvs[i * 2] = spans[axes[0]] > 1e-8 ? value[axes[0]] / (tileMeters * textureScale[0]) : 0
    uvs[i * 2 + 1] = spans[axes[1]] > 1e-8 ? value[axes[1]] / (tileMeters * textureScale[1]) : 0
  }
  const buffer = document.getRoot().listBuffers()[0] || document.createBuffer('IOM generated data')
  const accessor = document
    .createAccessor(`IOM generated TEXCOORD_${texCoord}`)
    .setType('VEC2')
    .setArray(uvs)
    .setBuffer(buffer)
  primitive.setAttribute(`TEXCOORD_${texCoord}`, accessor)
  return true
}

/**
 * A texture reference without the corresponding vertex attribute is legal to
 * parse but renders as a constant texel. Generate deterministic metric planar
 * UVs as a release-safe fallback; normalized 0–1 UVs stretched one paving tile
 * across the former 174 × 77 m campus slab. Project-authored unwraps remain
 * preferable.
 */
function ensureReferencedTextureCoordinates(document) {
  let primitives = 0
  let accessors = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const material = primitive.getMaterial()
      if (!material) continue
      let repairedPrimitive = false
      const coordinates = new Set(
        listTextureInfoByMaterial(material)
          .map(effectiveTexCoord)
          .filter(validTexCoord),
      )
      for (const texCoord of coordinates) {
        if (primitive.getAttribute(`TEXCOORD_${texCoord}`)) continue
        if (createPlanarTexCoord(document, primitive, material, texCoord)) {
          accessors += 1
          repairedPrimitive = true
        }
      }
      if (repairedPrimitive) primitives += 1
    }
  }
  return { primitives, accessors }
}

function missingReferencedTextureCoordinates(document) {
  const missing = []
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const material = primitive.getMaterial()
      if (!material) continue
      for (const info of listTextureInfoByMaterial(material)) {
        const texCoord = effectiveTexCoord(info)
        if (validTexCoord(texCoord) && !primitive.getAttribute(`TEXCOORD_${texCoord}`)) {
          missing.push({ mesh: mesh.getName(), material: material.getName(), texCoord })
        }
      }
    }
  }
  return missing
}

const EXTERIOR_FLOOR_CHECKER = Object.freeze({
  node: 'c5_fb_neu001',
  parent: 'Environment',
  mesh: 'Mesh.9312',
  material: 'Material 2097707472',
  texture: 'Material 2097707472_base_color_map',
  textureSha256: '170132b79901d8fc25d77be0b99a0389e1d0263e2f788926937406bb8d50f428',
  replacementMaterial: 'fb_c5_c6',
  triangles: 43,
})

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function closeNumber(actual, expected, tolerance = 1e-9) {
  return Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance
}

/**
 * The authored C5/C6 exterior slab contains a single-use 2x2 pure black/white
 * debug checker stretched once across roughly 145 x 43 m. Retiling it would
 * only produce smaller debug squares. Replace that exact, hash-pinned use with
 * the neutral companion floor material already authored on the same mesh.
 *
 * This is deliberately fail-closed: a partial name match, changed image, extra
 * use, or changed target geometry requires a new visual review.
 */
export function replaceExteriorFloorDebugChecker(document) {
  const root = document.getRoot()
  const placeholders = root.listMaterials()
    .filter((material) => material.getName() === EXTERIOR_FLOOR_CHECKER.material)
  if (placeholders.length === 0) {
    return {
      applied: false,
      reassignedPrimitives: 0,
      reason: 'exact placeholder material absent',
    }
  }
  if (placeholders.length !== 1) {
    throw new Error(
      `Exterior floor checker repair expected one ${EXTERIOR_FLOOR_CHECKER.material} material, found ${placeholders.length}.`,
    )
  }

  const placeholder = placeholders[0]
  const texture = placeholder.getBaseColorTexture()
  const image = texture?.getImage()
  if (
    texture?.getName() !== EXTERIOR_FLOOR_CHECKER.texture ||
    !image ||
    sha256Bytes(image) !== EXTERIOR_FLOOR_CHECKER.textureSha256
  ) {
    throw new Error('Exterior floor checker repair refused an unreviewed texture payload.')
  }

  const uses = []
  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMaterial() === placeholder) uses.push({ node, mesh, primitive })
    }
  }
  if (uses.length !== 1) {
    throw new Error(`Exterior floor checker repair expected one primitive use, found ${uses.length}.`)
  }

  const [{ node, mesh, primitive }] = uses
  if (
    node.getName() !== EXTERIOR_FLOOR_CHECKER.node ||
    node.getParentNode()?.getName() !== EXTERIOR_FLOOR_CHECKER.parent ||
    mesh.getName() !== EXTERIOR_FLOOR_CHECKER.mesh ||
    triangleCount(primitive) !== EXTERIOR_FLOOR_CHECKER.triangles
  ) {
    throw new Error('Exterior floor checker repair target identity or geometry changed.')
  }

  const replacements = mesh.listPrimitives()
    .map((candidate) => candidate.getMaterial())
    .filter((material, index, values) =>
      material?.getName() === EXTERIOR_FLOOR_CHECKER.replacementMaterial &&
      values.indexOf(material) === index)
  if (replacements.length !== 1) {
    throw new Error(
      `Exterior floor checker repair expected one ${EXTERIOR_FLOOR_CHECKER.replacementMaterial} companion material, found ${replacements.length}.`,
    )
  }
  const replacement = replacements[0]
  const color = replacement.getBaseColorFactor()
  const textureCount = [
    replacement.getBaseColorTexture(),
    replacement.getNormalTexture(),
    replacement.getMetallicRoughnessTexture(),
    replacement.getOcclusionTexture(),
    replacement.getEmissiveTexture(),
  ].filter(Boolean).length
  if (
    textureCount !== 0 ||
    color.length !== 4 ||
    !color.every((value, index) => closeNumber(value, [0.5, 0.5, 0.5, 1][index])) ||
    !closeNumber(replacement.getRoughnessFactor(), 0.5527864098548889) ||
    !closeNumber(replacement.getMetallicFactor(), 0)
  ) {
    throw new Error('Exterior floor checker repair companion material changed from the reviewed neutral finish.')
  }

  const textureUsers = root.listMaterials().filter((material) => [
    material.getBaseColorTexture(),
    material.getNormalTexture(),
    material.getMetallicRoughnessTexture(),
    material.getOcclusionTexture(),
    material.getEmissiveTexture(),
  ].includes(texture))
  if (textureUsers.length !== 1 || textureUsers[0] !== placeholder) {
    throw new Error(`Exterior floor checker repair expected one texture owner, found ${textureUsers.length}.`)
  }

  primitive.setMaterial(replacement)
  placeholder.dispose()
  texture.dispose()
  return {
    applied: true,
    reassignedPrimitives: 1,
    node: `${EXTERIOR_FLOOR_CHECKER.parent}/${EXTERIOR_FLOOR_CHECKER.node}`,
    mesh: EXTERIOR_FLOOR_CHECKER.mesh,
    triangles: EXTERIOR_FLOOR_CHECKER.triangles,
    removedMaterial: EXTERIOR_FLOOR_CHECKER.material,
    removedTexture: EXTERIOR_FLOOR_CHECKER.texture,
    removedTextureSha256: EXTERIOR_FLOOR_CHECKER.textureSha256,
    removedOrphanResources: true,
    replacementMaterial: EXTERIOR_FLOOR_CHECKER.replacementMaterial,
  }
}

function invalidTextureCoordinates(document) {
  const invalid = []
  for (const texture of document.getRoot().listTextures()) {
    for (const info of listTextureInfo(texture)) {
      const texCoord = info.getTexCoord()
      if (!validTexCoord(texCoord)) invalid.push(texCoord)
      const override = info.getExtension('KHR_texture_transform')?.getTexCoord?.()
      if (override != null && !validTexCoord(override)) invalid.push(override)
    }
  }
  return invalid
}

const CRITICAL_NAME_GROUPS = [
  { label: 'fire-safety', pattern: /fire|hose|feuer|hydrant|brandschutz/i },
  { label: 'building-connection', pattern: /verbindung|walkway|footbridge|skybridge|connector|passage|uebergang|\u00fcbergang/i },
]

const FIRE_HOSE_NODE_NAME = /fire[\s._-]*hose|firehose|fire[\s._-]*cabinet/i
const EXPLICIT_GLASS_MATERIAL = /(?:^|[\s._-])(?:glass|glas|glazing|scheibe|verglas)(?=$|[\s._-]|\d)/i
const NON_GLASS_MATERIAL = /frame|body|housing|cabinet|hose|handle|metal|red|seal|gasket|profil/i
const IOM_MATERIAL_ROLE = 'iomMaterialRole'
const KEEP_DOUBLE_SIDED_MATERIAL =
  /leaf|leaves|foliage|grass|flower|blossom|stalk|fence|grille|fabric|cloth|curtain|decal|sign|flag|banner|plane|logo/i
const OPEN_ARCHITECTURAL_SHELL_NAME =
  /flugturm|fassad|facade|geb[aä]?ude|gebude|building|halle|(?:^|[\s._-])hall(?:$|[\s._-]|\d)|innenw[aä]nd|waende|wände|wnde|tragwand|trennwand|walls|(?:^|[\s._-])wand(?:$|[\s._-]|\d)|(?:^|[\s._-])wall(?:$|[\s._-]|\d)|dark[_\s-]?wall|wall[_\s-]?raster|wandfarbe|wellblech|cladding|wall[_\s-]?panel|verbindung|walkway|footbridge|skybridge|connector|passage|uebergang|übergang/i
const AUDITED_OPEN_SHELL_MATERIAL =
  /^(?:mat_24 - Default(?:_\d+)?|Material 30_002|vray Paint - Sienna S_001|dach allu|Floor_Wood_Vray(?:_\d+)?|Treppen all(?:\.\d+)?|Rang_Dunkel)$/i
const AUDITED_MIXED_WINDING_SHELL_NAMES = new Set([
  'fassade003',
  'fassade003001',
  'fassade001001',
  'fassade001003',
  'fassadebuero1',
  'fassadebuero1001',
  'fassadebuero2',
  'fassadebuero2001',
  'fassadebuero3',
  'fassadebuero3001',
  'fassade005002',
  'fassade008002',
  'fassade005',
  'fassade005001',
  'fassade006001',
  'bt3innenwaende002',
  'bt3innenwaende006',
  'ogwaendeinnen01',
  'saal1waende004',
  'bt1kabinenwnde24',
  'bt1kabinenwnde31',
  'bt1kabinenwnde34',
  'bt1kabinenwnde43',
  'bt1kabinenwnde50',
  'bt1kabinenwnde57',
  's11trennwand',
  's12trennwand',
  's21trennwand',
  's22trennwand',
  'wandbt1001002',
  'wand40005',
  'dachdeckelturmwest',
  'foyerdachaussen1',
  'foyerdachaussen002',
  'deckenlampen',
  'egdeckebergangaussen',
  'buhneaufbaudecke',
  'saal1deckenpaneelelftung001',
  'tuerenholz001',
  'tuer1',
  'bt3glastuergeteilt',
  'bt3glastuergeteilt001001',
  'object010',
])
const IOM_DOUBLE_SIDED_REASON = 'iomDoubleSidedReason'

function isAuditedMixedWindingShellName(name) {
  const normalized = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return (
    AUDITED_MIXED_WINDING_SHELL_NAMES.has(normalized) ||
    /^tuerhinten\d*$/.test(normalized)
  )
}

function primitiveSurfaceTopology(primitive) {
  const position = primitive.getAttribute('POSITION')
  if (!position || primitive.getMode() !== 4 || position.getCount() < 3) return null
  const positions = position.getArray()
  const vertexCount = position.getCount()
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = positions[vertex * 3 + axis]
      min[axis] = Math.min(min[axis], value)
      max[axis] = Math.max(max[axis], value)
    }
  }
  const maxDim = Math.max(...max.map((value, axis) => value - min[axis]))
  const tolerance = Math.max(1e-6, maxDim * 1e-6)
  const byPosition = new Map()
  const weldedVertex = new Uint32Array(vertexCount)
  let weldedVertices = 0
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const key = [
      Math.round(positions[vertex * 3] / tolerance),
      Math.round(positions[vertex * 3 + 1] / tolerance),
      Math.round(positions[vertex * 3 + 2] / tolerance),
    ].join(',')
    let canonical = byPosition.get(key)
    if (canonical === undefined) {
      canonical = weldedVertices++
      byPosition.set(key, canonical)
    }
    weldedVertex[vertex] = canonical
  }

  const indices = primitive.getIndices()
  const indexArray = indices?.getArray()
  const indexCount = indices?.getCount() ?? vertexCount
  const edgeState = new Map()
  const addEdge = (fromVertex, toVertex) => {
    const from = weldedVertex[fromVertex]
    const to = weldedVertex[toVertex]
    if (from === to) return
    const low = Math.min(from, to)
    const high = Math.max(from, to)
    const key = low * weldedVertices + high
    const direction = from === low ? 1 : -1
    const previous = edgeState.get(key)
    if (previous === undefined) edgeState.set(key, direction)
    else if (previous === 1) edgeState.set(key, direction === 1 ? 2 : 3)
    else if (previous === -1) edgeState.set(key, direction === -1 ? -2 : 3)
    else edgeState.set(key, 4)
  }
  let triangles = 0
  for (let offset = 0; offset + 2 < indexCount; offset += 3) {
    const a = indexArray ? indexArray[offset] : offset
    const b = indexArray ? indexArray[offset + 1] : offset + 1
    const c = indexArray ? indexArray[offset + 2] : offset + 2
    if (
      weldedVertex[a] === weldedVertex[b] ||
      weldedVertex[b] === weldedVertex[c] ||
      weldedVertex[c] === weldedVertex[a]
    ) continue
    triangles += 1
    addEdge(a, b)
    addEdge(b, c)
    addEdge(c, a)
  }
  let boundaryEdges = 0
  let windingConflictEdges = 0
  let nonManifoldEdges = 0
  for (const state of edgeState.values()) {
    if (state === 1 || state === -1) boundaryEdges += 1
    else if (state === 2 || state === -2) windingConflictEdges += 1
    else if (state === 4) nonManifoldEdges += 1
  }
  return {
    triangles,
    edges: edgeState.size,
    boundaryEdges,
    windingConflictEdges,
    nonManifoldEdges,
  }
}

function normalizeCadMaterialSidedness(document, certifiedMeshes = new Set()) {
  const root = document.getRoot()
  const owners = new Map()
  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const names = owners.get(mesh) || []
    names.push(node.getName() || '')
    owners.set(mesh, names)
  }

  const topologyCache = new Map()
  const uses = new Map()
  let topologyScanned = 0
  let openSurfacePrimitives = 0
  for (const mesh of root.listMeshes()) {
    const ownerNames = owners.get(mesh) || []
    const ownerLabel = ownerNames.join(' ')
    const certifiedLogicalMesh = certifiedMeshes.has(mesh)
    const auditedMixedWindingShell =
      !certifiedLogicalMesh &&
      (ownerNames.some(isAuditedMixedWindingShellName) ||
        isAuditedMixedWindingShellName(mesh.getName()))
    for (const primitive of mesh.listPrimitives()) {
      const material = primitive.getMaterial()
      if (!material) continue
      const label = `${ownerLabel} ${mesh.getName() || ''} ${material.getName() || ''}`
      const authoredReason = material.getExtras()?.[IOM_DOUBLE_SIDED_REASON]
      const materialRole = material.getExtras()?.[IOM_MATERIAL_ROLE]
      const explicitGlass = EXPLICIT_GLASS_MATERIAL.test(material.getName() || '')
      const explicitSafety =
        materialRole === 'fire-safety-opaque' ||
        materialRole === 'fire-safety-glass'
      const explicitSheet =
        typeof authoredReason === 'string' ||
        explicitGlass ||
        explicitSafety ||
        KEEP_DOUBLE_SIDED_MATERIAL.test(material.getName() || '')
      const visibilityCritical =
        explicitSafety ||
        /verbindung|walkway|footbridge|skybridge|connector|passage|uebergang|übergang/i.test(label)
      const semanticCandidate =
        visibilityCritical ||
        auditedMixedWindingShell ||
        OPEN_ARCHITECTURAL_SHELL_NAME.test(label) ||
        AUDITED_OPEN_SHELL_MATERIAL.test(material.getName() || '')
      // Arbitrary FrontSide props still skip the topology cost. Semantic wall
      // sheets must reach the audit so optimization can promote only damaged
      // uses and clone shared materials per primitive.
      if (!material.getDoubleSided() && !explicitSheet && !semanticCandidate) {
        const list = uses.get(material) || []
        list.push({ primitive, keep: false, reason: null })
        uses.set(material, list)
        continue
      }
      let topology = null
      if (!certifiedLogicalMesh && !explicitSheet && semanticCandidate) {
        topology = topologyCache.get(primitive)
        if (topology === undefined) {
          topology = primitiveSurfaceTopology(primitive)
          topologyCache.set(primitive, topology)
          topologyScanned += 1
        }
      }
      const topologyRisk = Boolean(
        topology &&
          topology.boundaryEdges > 0 &&
          (topology.triangles <= 2 ||
            topology.boundaryEdges >= 24 ||
            topology.boundaryEdges / Math.max(1, topology.edges) >= 0.02),
      )
      const auditedWindingRisk = Boolean(
        topology &&
          auditedMixedWindingShell &&
          (topology.boundaryEdges > 0 ||
            topology.windingConflictEdges > 0 ||
            topology.nonManifoldEdges > 0),
      )
      const keep = explicitSheet || (semanticCandidate && topologyRisk) || auditedWindingRisk
      if (topologyRisk || auditedWindingRisk) openSurfacePrimitives += 1
      const list = uses.get(material) || []
      list.push({
        primitive,
        keep,
        reason:
          typeof authoredReason === 'string'
            ? authoredReason
            : explicitGlass
              ? 'explicit-glass'
              : explicitSafety
                ? 'visibility-critical'
                : explicitSheet
                  ? 'explicit-sheet'
                  : auditedWindingRisk
                    ? 'audited-mixed-winding-shell'
                    : 'open-architectural-shell',
      })
      uses.set(material, list)
    }
  }

  let madeSingleSided = 0
  let retainedDoubleSided = 0
  let promotedSingleSided = 0
  let splitMaterials = 0
  for (const material of root.listMaterials()) {
    const materialUses = uses.get(material) || []
    const keptUses = materialUses.filter((use) => use.keep)
    if (!material.getDoubleSided()) {
      if (keptUses.length === 0) continue
      if (keptUses.length === materialUses.length) {
        material.setDoubleSided(true)
        material.setExtras({
          ...material.getExtras(),
          [IOM_DOUBLE_SIDED_REASON]: keptUses[0].reason,
        })
      } else {
        const twoSided = material.clone()
        twoSided.setDoubleSided(true)
        twoSided.setExtras({
          ...material.getExtras(),
          [IOM_DOUBLE_SIDED_REASON]: keptUses[0].reason,
        })
        for (const use of keptUses) use.primitive.setMaterial(twoSided)
        splitMaterials += 1
      }
      retainedDoubleSided += 1
      promotedSingleSided += 1
      continue
    }
    if (keptUses.length === materialUses.length && keptUses.length > 0) {
      material.setExtras({
        ...material.getExtras(),
        [IOM_DOUBLE_SIDED_REASON]: keptUses[0].reason,
      })
      retainedDoubleSided += 1
      continue
    }
    material.setDoubleSided(false)
    madeSingleSided += 1
    if (keptUses.length === 0) continue

    const twoSided = material.clone()
    twoSided.setDoubleSided(true)
    twoSided.setExtras({
      ...material.getExtras(),
      [IOM_DOUBLE_SIDED_REASON]: keptUses[0].reason,
    })
    for (const use of keptUses) use.primitive.setMaterial(twoSided)
    retainedDoubleSided += 1
    splitMaterials += 1
  }
  return {
    madeSingleSided,
    retainedDoubleSided,
    promotedSingleSided,
    splitMaterials,
    topologyScanned,
    openSurfacePrimitives,
  }
}

function prepareCriticalMaterialRoles(document) {
  const root = document.getRoot()
  const fireNodes = root.listNodes().filter((node) => FIRE_HOSE_NODE_NAME.test(node.getName()))
  const fireMeshes = new Set(fireNodes.map((node) => node.getMesh()).filter(Boolean))
  const meshOwners = new Map()
  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const owners = meshOwners.get(mesh) || []
    owners.push(node)
    meshOwners.set(mesh, owners)
  }
  for (const mesh of fireMeshes) {
    const mixedOwner = (meshOwners.get(mesh) || []).find((node) => !FIRE_HOSE_NODE_NAME.test(node.getName()))
    if (mixedOwner) {
      throw new Error(
        `Fire-safety mesh is shared with non-fire node "${mixedOwner.getName() || '(unnamed)'}"; ` +
          'separate it in Blender before release.',
      )
    }
  }

  const roleMaterials = new Map()
  for (const mesh of fireMeshes) {
    for (const primitive of mesh.listPrimitives()) {
      const source = primitive.getMaterial()
      if (!source) continue
      let prepared = roleMaterials.get(source)
      if (!prepared) {
        const sourceName = source.getName() || 'unnamed'
        const glass = EXPLICIT_GLASS_MATERIAL.test(sourceName) && !NON_GLASS_MATERIAL.test(sourceName)
        const role = glass ? 'fire-safety-glass' : 'fire-safety-opaque'
        prepared = source.clone()
        prepared.setName(`IOM_${role.replaceAll('-', '_').toUpperCase()}__${sourceName}`)
        prepared.setExtras({ ...source.getExtras(), [IOM_MATERIAL_ROLE]: role })
        roleMaterials.set(source, prepared)
      }
      primitive.setMaterial(prepared)
    }
  }

  return {
    fireNodes: fireNodes.length,
    fireMeshes: fireMeshes.size,
    materialRoles: [...roleMaterials.values()]
      .map((material) => ({
        name: material.getName(),
        role: material.getExtras()[IOM_MATERIAL_ROLE],
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

function criticalMaterialRoles(document) {
  return document.getRoot().listMaterials()
    .map((material) => ({
      name: material.getName(),
      role: material.getExtras()[IOM_MATERIAL_ROLE],
    }))
    .filter((entry) => typeof entry.role === 'string')
    .sort((a, b) => a.name.localeCompare(b.name))
}

function semanticNameGroups(document) {
  const names = document.getRoot().listNodes().map((node) => node.getName()).filter(Boolean)
  return Object.fromEntries(
    CRITICAL_NAME_GROUPS.map(({ label, pattern }) => [label, names.filter((name) => pattern.test(name))]),
  )
}

function nonConstantAnimationTracks(document) {
  const tracks = new Set()
  const allTracks = new Set()
  let durationSeconds = 0
  for (const animation of document.getRoot().listAnimations()) {
    for (const channel of animation.listChannels()) {
      const sampler = channel.getSampler()
      const input = sampler?.getInput()?.getArray()
      const outputAccessor = sampler?.getOutput()
      const output = outputAccessor?.getArray()
      const size = outputAccessor?.getElementSize() || 0
      const track =
        `${animation.getName() || '(unnamed)'}|${channel.getTargetNode()?.getName() || '(unnamed)'}|${channel.getTargetPath()}`
      allTracks.add(track)
      if (input?.length) durationSeconds = Math.max(durationSeconds, input[input.length - 1])
      if (!output || !size || output.length <= size) continue
      let changes = false
      for (let i = size; i < output.length && !changes; i++) {
        if (Math.abs(output[i] - output[i % size]) > 1e-6) changes = true
      }
      if (!changes) continue
      tracks.add(track)
    }
  }
  return { tracks, allTracks, durationSeconds }
}

function inferAnimationRates(document) {
  const rates = new Set()
  for (const animation of document.getRoot().listAnimations()) {
    for (const sampler of animation.listSamplers()) {
      const times = sampler.getInput()?.getArray()
      if (!times || times.length < 2) continue
      const deltas = []
      for (let i = 1; i < times.length; i++) {
        const delta = times[i] - times[i - 1]
        if (delta > 0 && Number.isFinite(delta)) deltas.push(delta)
      }
      if (!deltas.length) continue
      deltas.sort((a, b) => a - b)
      const median = deltas[Math.floor(deltas.length / 2)]
      rates.add(Number((1 / median).toFixed(3)))
    }
  }
  return [...rates].sort((a, b) => a - b)
}

async function verifyBinary(binary, config) {
  if (!(await exists(binary))) {
    throw new Error(
      `gltfpack ${config.version} not found at ${binary}. Set IOM_GLTFPACK_PATH or pass --binary.`,
    )
  }
  const digest = await sha256File(binary)
  if (process.platform === 'win32' && digest !== config.windowsExecutableSha256) {
    throw new Error(
      `gltfpack executable hash mismatch. Expected ${config.windowsExecutableSha256}, got ${digest}.`,
    )
  }
  const probe = spawnSync(binary, ['-v'], { encoding: 'utf8', windowsHide: true })
  const output = `${probe.stdout || ''}\n${probe.stderr || ''}`.trim()
  if (probe.status !== 0 || !new RegExp(`gltfpack\\s+${config.version.replace('.', '\\.')}\\b`).test(output)) {
    throw new Error(`Expected gltfpack ${config.version}; received: ${output || '(no version output)'}`)
  }
  return { digest, versionOutput: output }
}

async function main() {
  const args = parseArgs(process.argv)
  const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'))
  const profileArgs = config.profiles[args.profile]
  if (!profileArgs) throw new Error(`Unknown profile: ${args.profile}`)

  const configured = args.binary || process.env.IOM_GLTFPACK_PATH
  const binary = configured
    ? resolve(configured)
    : join(VIEWER_ROOT, config.defaultWindowsExecutable)
  const tool = await verifyBinary(binary, config)

  console.log(`gltfpack ${config.version} OK · sha256 ${tool.digest}`)
  console.log(`Profile ${args.profile}: ${profileArgs.join(' ')}`)
  if (args.check && !args.input && !args.output) return
  if (!args.input || !args.output) {
    throw new Error('Required: --input <source.glb> --output <release.glb> [--profile web|quest]')
  }
  if (resolve(args.input) === resolve(args.output)) {
    throw new Error('Input and output must be different; source GLBs are never overwritten.')
  }
  if (extname(args.output).toLowerCase() !== '.glb') throw new Error('Output must end in .glb')
  if (!(await exists(args.input))) throw new Error(`Input not found: ${args.input}`)
  if ((await exists(args.output)) && !args.force) {
    throw new Error(`Output already exists: ${args.output}. Pass --force only after verifying the target.`)
  }

  const sourceIo = await createGltfIO({ encoder: true })
  const sourceDocument = await sourceIo.read(args.input)
  const sourceSurfaceRepairAudit = auditSurfaceRepairCertificates(sourceDocument, {
    mirrorMeshCertificates: true,
  })
  const exteriorFloorCheckerRepair = replaceExteriorFloorDebugChecker(sourceDocument)
  const criticalMaterialPreparation = prepareCriticalMaterialRoles(sourceDocument)
  const materialSidedness = normalizeCadMaterialSidedness(
    sourceDocument,
    sourceSurfaceRepairAudit.certifiedMeshes,
  )
  const sourceCriticalMaterialRoles = criticalMaterialRoles(sourceDocument)
  const sourceSemantics = semanticNameGroups(sourceDocument)
  const sourceAnimation = nonConstantAnimationTracks(sourceDocument)
  const scenes = sourceDocument.getRoot().listScenes()
  const populatedScenes = scenes.filter((scene) => scene.listChildren().length > 0)
  if (populatedScenes.length !== 1) {
    const detail = populatedScenes
      .map((scene) => `${scene.getName() || '(unnamed)'}:${scene.listChildren().length}`)
      .join(', ')
    throw new Error(
      `Source contains ${scenes.length} scenes and ${populatedScenes.length} populated scenes ` +
        `(${detail || 'none'}). gltfpack -mi can attach instances to the wrong scene; ` +
        'merge/export exactly one populated scene in Blender before release.',
    )
  }
  const normalizeEmptyScenes = scenes.length > 1
  const textureCoordinateRepairs = sanitizeTextureCoordinates(sourceDocument)
  const generatedTextureCoordinates = ensureReferencedTextureCoordinates(sourceDocument)
  const animationCount = sourceDocument.getRoot().listAnimations().length
  const inferredRates = inferAnimationRates(sourceDocument)
  if (animationCount > 0) {
    if (!Number.isFinite(args.animationFps) || args.animationFps <= 0) {
      throw new Error(
        `Source contains ${animationCount} animation clip(s). Pass an explicit --animation-fps ` +
          `(detected key rates: ${inferredRates.length ? inferredRates.join(', ') : 'unknown'} Hz).`,
      )
    }
    if (inferredRates.length && !inferredRates.some((rate) => Math.abs(rate - args.animationFps) < 0.01)) {
      throw new Error(
        `--animation-fps ${args.animationFps} does not match detected source key rates ` +
          `${inferredRates.join(', ')} Hz; refusing to retime animation implicitly.`,
      )
    }
  } else if (args.animationFps != null) {
    throw new Error('--animation-fps was supplied, but the source contains no animation clips.')
  }

  const outputDir = dirname(args.output)
  const token = `${process.pid}-${Date.now()}`
  const rewriteInput =
    normalizeEmptyScenes ||
    textureCoordinateRepairs.total > 0 ||
    generatedTextureCoordinates.accessors > 0 ||
    materialSidedness.madeSingleSided > 0 ||
    materialSidedness.promotedSingleSided > 0 ||
    materialSidedness.splitMaterials > 0 ||
    sourceSurfaceRepairAudit.mirroredMeshCertificates > 0 ||
    exteriorFloorCheckerRepair.applied ||
    criticalMaterialPreparation.materialRoles.length > 0
  const tempInput = rewriteInput
    ? join(outputDir, `.${basename(args.input, '.glb')}.${token}.prepared.glb`)
    : null
  const tempOutput = join(outputDir, `.${basename(args.output, '.glb')}.${token}.tmp.glb`)
  const tempNativeReport = `${tempOutput}.gltfpack.json`
  const releaseArgs = [
    ...profileArgs,
    ...(animationCount > 0 ? ['-af', String(args.animationFps), '-ac'] : []),
  ]
  const commandInput = tempInput || args.input
  const commandArgs = ['-i', commandInput, '-o', tempOutput, ...releaseArgs, '-r', tempNativeReport]
  if (normalizeEmptyScenes) {
    console.log(
      `Preflight: ${scenes.length - 1} empty scene(s) will be removed; keeping ${populatedScenes[0].getName() || '(unnamed)'}.`,
    )
  }
  if (textureCoordinateRepairs.total > 0) {
    console.log(
      `Preflight: repaired ${textureCoordinateRepairs.textureInfos} invalid texture coordinate reference(s)` +
        `${textureCoordinateRepairs.transforms ? ` and ${textureCoordinateRepairs.transforms} transform override(s)` : ''}.`,
    )
  }
  if (generatedTextureCoordinates.accessors > 0) {
    console.log(
      `Preflight: generated planar texture coordinates for ${generatedTextureCoordinates.primitives} ` +
        `primitive(s) / ${generatedTextureCoordinates.accessors} attribute(s).`,
    )
  }
  if (
    materialSidedness.madeSingleSided > 0 ||
    materialSidedness.promotedSingleSided > 0
  ) {
    console.log(
      `Preflight: made ${materialSidedness.madeSingleSided} closed/CAD material(s) single-sided; ` +
        `retained ${materialSidedness.retainedDoubleSided} explicit/open surface material(s), ` +
        `promoted ${materialSidedness.promotedSingleSided} audited FrontSide material use(s), ` +
        `including ${materialSidedness.splitMaterials} per-primitive material split(s) from ` +
        `${materialSidedness.openSurfacePrimitives} topology-qualified primitive(s).`,
    )
  }
  if (criticalMaterialPreparation.materialRoles.length > 0) {
    console.log(
      `Preflight: isolated ${criticalMaterialPreparation.materialRoles.length} fire-safety material slot(s) ` +
        `across ${criticalMaterialPreparation.fireNodes} cabinet instance(s).`,
    )
  }
  if (exteriorFloorCheckerRepair.applied) {
    console.log(
      `Preflight: replaced the hash-pinned exterior C5/C6 debug checker on ` +
        `${exteriorFloorCheckerRepair.node} with ${exteriorFloorCheckerRepair.replacementMaterial}.`,
    )
  }
  console.log(`${binary} ${commandArgs.join(' ')}`)
  if (args.dryRun) return

  await mkdir(outputDir, { recursive: true })
  const sourceHash = await sha256File(args.input)
  try {
    if (tempInput) {
      for (const scene of scenes) {
        if (scene !== populatedScenes[0]) scene.dispose()
      }
      sourceDocument.getRoot().setDefaultScene(populatedScenes[0])
      await sourceIo.write(tempInput, sourceDocument)
    }
    const result = spawnSync(binary, commandArgs, {
      encoding: 'utf8',
      stdio: 'inherit',
      windowsHide: true,
    })
    if (result.status !== 0) {
      throw new Error(`gltfpack failed with exit code ${result.status ?? 'unknown'}`)
    }

    const io = await createGltfIO()
    const document = await io.read(tempOutput)
    const outputSurfaceRepairAudit = auditSurfaceRepairCertificates(document, {
      expectedCertificateCount: sourceSurfaceRepairAudit.certificateCount,
    })
    const outputScenes = document.getRoot().listScenes()
    if (outputScenes.length !== 1 || outputScenes[0].listChildren().length === 0) {
      throw new Error(
        `Release gate failed: expected one populated output scene, found ${outputScenes.length}.`,
      )
    }
    const invalidTexCoords = invalidTextureCoordinates(document)
    if (invalidTexCoords.length > 0) {
      throw new Error(
        `Release gate failed: ${invalidTexCoords.length} invalid texture coordinate reference(s) remain.`,
      )
    }
    const missingTexCoords = missingReferencedTextureCoordinates(document)
    if (missingTexCoords.length > 0) {
      throw new Error(
        `Release gate failed: ${missingTexCoords.length} textured primitive reference(s) lack their vertex UV attribute.`,
      )
    }
    const outputSemantics = semanticNameGroups(document)
    const outputMaterialRoles = criticalMaterialRoles(document)
    for (const expected of sourceCriticalMaterialRoles) {
      if (!outputMaterialRoles.some((actual) => actual.name === expected.name && actual.role === expected.role)) {
        throw new Error(
          `Release gate failed: critical material role was removed: ${expected.name} (${expected.role}).`,
        )
      }
    }
    for (const { label } of CRITICAL_NAME_GROUPS) {
      if (sourceSemantics[label].length > 0 && outputSemantics[label].length === 0) {
        throw new Error(`Release gate failed: gltfpack removed all ${label} node semantics.`)
      }
    }
    const outputAnimation = nonConstantAnimationTracks(document)
    for (const track of sourceAnimation.allTracks) {
      if (!outputAnimation.allTracks.has(track)) {
        throw new Error(`Release gate failed: animation track was removed: ${track}`)
      }
    }
    for (const track of sourceAnimation.tracks) {
      if (!outputAnimation.tracks.has(track)) {
        throw new Error(`Release gate failed: non-constant animation track was removed: ${track}`)
      }
    }
    if (
      sourceAnimation.durationSeconds > 0 &&
      Math.abs(outputAnimation.durationSeconds - sourceAnimation.durationSeconds) > 0.001
    ) {
      throw new Error(
        `Release gate failed: animation duration changed from ${sourceAnimation.durationSeconds} to ${outputAnimation.durationSeconds}.`,
      )
    }
    const extensions = document
      .getRoot()
      .listExtensionsUsed()
      .map((extension) => extension.extensionName)
    const textures = document.getRoot().listTextures().length
    if (!extensions.includes('EXT_meshopt_compression')) {
      throw new Error('Release gate failed: EXT_meshopt_compression is missing.')
    }
    if (textures > 0 && !extensions.includes('KHR_texture_basisu')) {
      throw new Error('Release gate failed: textured output is missing KHR_texture_basisu.')
    }

    const outputHash = await sha256File(tempOutput)
    const nativeReport = JSON.parse(await readFile(tempNativeReport, 'utf8'))
    const provenance = {
      schemaVersion: 1,
      tool: {
        name: config.name,
        version: config.version,
        executableSha256: tool.digest,
        releaseUrl: config.releaseUrl,
      },
      profile: args.profile,
      arguments: releaseArgs,
      source: { path: args.input, sha256: sourceHash },
      sourcePreparation: {
        normalizedEmptyScenes: normalizeEmptyScenes ? scenes.length - 1 : 0,
        textureCoordinateRepairs,
        generatedTextureCoordinates,
        exteriorFloorCheckerRepair,
        materialSidedness,
        surfaceRepairCertificates: surfaceRepairAuditSummary(sourceSurfaceRepairAudit),
        criticalMaterialPreparation,
        criticalMaterialRoles: sourceCriticalMaterialRoles,
        semanticNames: sourceSemantics,
        nonConstantAnimationTracks: [...sourceAnimation.tracks].sort(),
        animationTracks: [...sourceAnimation.allTracks].sort(),
        animationDurationSeconds: sourceAnimation.durationSeconds,
      },
      output: {
        path: args.output,
        sha256: outputHash,
        bytes: (await stat(tempOutput)).size,
        expandedWorkload: expandedWorkload(document),
        semanticNames: outputSemantics,
        criticalMaterialRoles: outputMaterialRoles,
        surfaceRepairCertificates: surfaceRepairAuditSummary(outputSurfaceRepairAudit),
        extensionsUsed: extensions,
        generator: document.getRoot().getAsset().generator || null,
      },
      nativeReport,
      createdAt: new Date().toISOString(),
    }

    if (args.force) {
      await rm(args.output, { force: true })
      await rm(`${args.output}.provenance.json`, { force: true })
    }
    await rename(tempOutput, args.output)
    await writeFile(`${args.output}.provenance.json`, `${JSON.stringify(provenance, null, 2)}\n`)
    console.log(`Wrote ${args.output}`)
    console.log(`Wrote ${args.output}.provenance.json`)
  } finally {
    if (tempInput) await rm(tempInput, { force: true })
    await rm(tempOutput, { force: true })
    await rm(tempNativeReport, { force: true })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
