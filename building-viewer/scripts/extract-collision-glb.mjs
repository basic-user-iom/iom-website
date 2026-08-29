/**
 * Extract a dedicated low-complexity collision GLB from a visual building model.
 * Keeps floors / stairs / ramps (+ optional walls), renames to COLLIDER_*,
 * strips textures, optionally simplifies, and writes `collision.glb` next to the source.
 *
 * Usage:
 *   node scripts/extract-collision-glb.mjs --input ../public/models/icm-ext/model-web.glb --out ../public/models/icm-ext/collision.glb --walk-only
 *   node scripts/extract-collision-glb.mjs --input semantic-prebatch-animated.glb --out ../public/models/icm-anim-2025/collision.glb --walk-only
 */
import { mkdir, access, stat } from 'node:fs/promises'
import { dirname, join, resolve, basename } from 'node:path'
import { PropertyType } from '@gltf-transform/core'
import { dedup, flatten, prune, simplifyPrimitive, weld } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import { createGltfIO } from './lib/gltf-io.mjs'

const WALK =
  /floor|stairs?|steps?|ground|slab|ramp|landing|tread|riser|plaza|terrain|walkway|path|pavement|sidewalk|kerb|curb|platform|lobby|foyer|corridor|hallway|mezzanine|galerie|gallery|storey|geschoss|etage|flur|diele|gang|treppe|stufen?|podest|boden|lauf_treppe|etagentreppe|laufband|rolltreppe|escalator|tile|fliese|paving|\.bt\d?|(?<![a-z])deck(?![a-z])/i
/** Checked before WALK so `Treppe_handlauf` is not kept as a tread. */
const RAILING =
  /handlauf|handrail|geländer|gelander|balustrade|baluster|railing|banister|guardrail|griffe?|door.?handle|tuergriff|türgriff|treppengitter|gitter|grille|unterbau|trger|trager|träger|traeger/i
const WALL =
  /wall|column|pillar|beam|corridor|railing|balustrade|wand|pfeiler|geländer|gelander|handlauf/i
const SKIP =
  /glass|window|glazing|fenster|scheib|sign|light|lamp|leuchte|furniture|möbel|moebel|mbel|chair|table|desk|sofa|plant|foliage|curtain|decal|logo|icon|screen|monitor|decke|ceiling|soffit|fixture|cabinet|shelf|door|tür|tuer|lüftung|lueftung|luftung|lftung|ventilation|duct/i
/** Explicit non-walk owners win over reused floor/stair materials. */
const NON_WALK_OWNER =
  /wall|wand|door|tür|tuer|window|fenster|ceiling|decke|soffit|light|lamp|leuchte|furniture|möbel|moebel|mbel|chair|table|desk|sofa|cabinet|shelf|lüftung|lueftung|luftung|lftung|ventilation|duct/i
const STAIR_OR_RAMP =
  /stair|step|tread|riser|landing|treppe|stufe|stufen|podest|laufband|rolltreppe|escalator|ramp/i

const ICM_BRIDGE_FLOOR_OWNER = /^(?:Floor|Floor001|Floor_Mitte)(?:\s|$)/
const ICM_BRIDGE_FLOOR_MATERIAL = 'vray Bruecke_Gitter'

function isIcmBridgeFloor(nodeOwner, matNames) {
  return (
    ICM_BRIDGE_FLOOR_OWNER.test(nodeOwner) &&
    matNames === ICM_BRIDGE_FLOOR_MATERIAL
  )
}

/** Engineering target for walk-only coarse proxies (instance-expanded budget checked at runtime). */
const DEFAULT_WALK_TRI_BUDGET = 400_000

function parseArgs(argv) {
  const args = {
    input: null,
    out: null,
    walkOnly: false,
    simplify: false,
    ratio: 0.22,
    error: 0.045,
    triBudget: DEFAULT_WALK_TRI_BUDGET,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--input') args.input = resolve(argv[++i])
    else if (a === '--out') args.out = resolve(argv[++i])
    else if (a === '--walk-only') args.walkOnly = true
    else if (a === '--simplify') args.simplify = true
    else if (a === '--ratio') args.ratio = Number(argv[++i])
    else if (a === '--error') args.error = Number(argv[++i])
    else if (a === '--tri-budget') args.triBudget = Number(argv[++i])
  }
  if (args.walkOnly && !argv.includes('--no-simplify')) args.simplify = true
  return args
}

function primSize(prim) {
  const attr = prim.getAttribute('POSITION')
  if (!attr) return null
  const min = attr.getMin([])
  const max = attr.getMax([])
  if (!min?.length || !max?.length) return null
  return {
    dx: Math.abs(max[0] - min[0]),
    dy: Math.abs(max[1] - min[1]),
    dz: Math.abs(max[2] - min[2]),
  }
}

function keepPrimitive(nodeOwner, meshName, matNames, prim, walkOnly) {
  const blob = `${nodeOwner} ${meshName} ${matNames}`
  // Exact exception: these are the authored bridge decks, not railings. Keep
  // this before the generic `gitter` rejection and avoid substring matching.
  if (isIcmBridgeFloor(nodeOwner, matNames)) return true
  if (SKIP.test(blob) || RAILING.test(blob)) return false
  if (walkOnly && NON_WALK_OWNER.test(nodeOwner)) return false
  if (WALK.test(blob)) return true
  if (!walkOnly && WALL.test(blob)) return true
  const size = primSize(prim)
  if (!size) return false
  const footprint = Math.max(0, size.dx) * Math.max(0, size.dz)
  const thin =
    size.dy <= 1.25 &&
    size.dy <= Math.max(size.dx, size.dz) * 0.08 + 0.5
  return thin && footprint >= 4
}

function ownerPath(node) {
  const names = []
  const seen = new Set()
  let current = node
  while (current && !seen.has(current)) {
    seen.add(current)
    if (current.getName()) names.push(current.getName())
    current = current
      .listParents()
      .find((parent) => parent.propertyType === PropertyType.NODE) ?? null
  }
  return names.join(' ')
}

function safeName(value) {
  return (value || 'mesh').replace(/[^\w\-]+/g, '_').slice(0, 64)
}

/**
 * Filter per node rather than per shared mesh. CAD/glTF optimization commonly
 * reuses a floor/stair material on doors, lights, or furniture. Filtering only
 * by mesh/material retained those false blockers and could drop the real stair
 * owner. Each distinct primitive selection is cloned once and shared only by
 * nodes with the same collision role.
 */
function isolateCollisionNodes(document, walkOnly) {
  const root = document.getRoot()
  const sourceMeshes = root.listMeshes()
  const meshIds = new Map(sourceMeshes.map((mesh, index) => [mesh, index]))
  const variants = new Map()
  let keptNodes = 0
  let droppedNodes = 0
  let horizontalExtras = 0
  let stairNodes = 0

  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    if (node.getSkin()) {
      node.setMesh(null)
      droppedNodes += 1
      continue
    }

    const owner = ownerPath(node)
    const meshName = mesh.getName() || ''
    const primitives = mesh.listPrimitives()
    const groups = new Map()
    for (let index = 0; index < primitives.length; index++) {
      const primitive = primitives[index]
      const material = primitive.getMaterial()
      const materialName = material?.getName() || ''
      const primitiveLabel = `${owner} ${meshName} ${materialName}`
      const named = WALK.test(primitiveLabel) || WALL.test(primitiveLabel)
      if (!keepPrimitive(owner, meshName, materialName, primitive, walkOnly)) continue
      const stair = STAIR_OR_RAMP.test(primitiveLabel) && !RAILING.test(primitiveLabel)
      const role = stair ? 'stair' : WALK.test(primitiveLabel) ? 'walk' : 'inferred-walk'
      const group = groups.get(role) ?? { indices: [], materials: [] }
      group.indices.push(index)
      group.materials.push(materialName)
      groups.set(role, group)
      if (!named && !SKIP.test(`${owner} ${meshName} ${materialName}`)) horizontalExtras += 1
      if (material) {
        material.setBaseColorTexture(null)
        material.setNormalTexture(null)
        material.setMetallicRoughnessTexture(null)
        material.setOcclusionTexture(null)
        material.setEmissiveTexture(null)
        material.setBaseColorFactor([0.85, 0.25, 0.2, 1])
      }
    }

    if (groups.size === 0) {
      node.setMesh(null)
      droppedNodes += 1
      continue
    }

    const parents = node.listParents().filter(
      (parent) => parent.propertyType === PropertyType.NODE || parent.propertyType === PropertyType.SCENE,
    )
    const originalName = node.getName() || meshName || 'node'
    const sourceId = meshIds.get(mesh) ?? -1
    let groupIndex = 0
    for (const [role, group] of groups) {
      const key = `${sourceId}|${group.indices.join(',')}|role:${role}`
      let variant = variants.get(key)
      if (!variant) {
        variant = document.createMesh(`COLLIDER_${safeName(meshName || originalName)}_${role}`)
        for (const index of group.indices) variant.addPrimitive(primitives[index].clone())
        variant.setExtras({
          iomCollisionRole: role,
          iomCollisionPreserveDetail: role === 'stair',
        })
        variants.set(key, variant)
      }

      const targetNode = groupIndex === 0
        ? node
        : document
            .createNode()
            .setMatrix(node.getMatrix())
            .setWeights(node.getWeights())
            .setExtras({ ...node.getExtras() })
      if (targetNode !== node) {
        for (const extension of node.listExtensions()) {
          targetNode.setExtension(extension.extensionName, extension.clone())
        }
        for (const parent of parents) parent.addChild(targetNode)
      }
      const roleName = role === 'stair' || groups.size === 1
        ? safeName(originalName)
        : `${safeName(originalName)}_${role}`
      targetNode.setName(`COLLIDER_${roleName}`)
      targetNode.setMesh(variant)
      keptNodes += 1
      if (role === 'stair') stairNodes += 1
      groupIndex += 1
    }
  }

  return { keptNodes, droppedNodes, horizontalExtras, stairNodes }
}

function meshTris(mesh) {
  let n = 0
  for (const prim of mesh.listPrimitives()) {
    const idx = prim.getIndices()
    if (idx) n += idx.getCount() / 3
    else {
      const pos = prim.getAttribute('POSITION')
      if (pos) n += pos.getCount() / 3
    }
  }
  return Math.round(n)
}

function countTris(document) {
  return document.getRoot().listMeshes().reduce((sum, mesh) => sum + meshTris(mesh), 0)
}

function nodeInstanceCount(node) {
  const instancing = node.getExtension('EXT_mesh_gpu_instancing')
  for (const semantic of ['TRANSLATION', 'ROTATION', 'SCALE', '_ID']) {
    const accessor = instancing?.getAttribute?.(semantic)
    if (accessor) return Math.max(1, accessor.getCount())
  }
  return 1
}

/** Runtime cost: shared meshes count once for every owning node / instance. */
function countExpandedTris(document) {
  let total = 0
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    total += meshTris(mesh) * nodeInstanceCount(node)
  }
  return Math.round(total)
}

function expandedRoleStats(document) {
  let stair = 0
  let other = 0
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const expanded = meshTris(mesh) * nodeInstanceCount(node)
    if (mesh.getExtras().iomCollisionPreserveDetail === true) stair += expanded
    else other += expanded
  }
  return { stair: Math.round(stair), other: Math.round(other) }
}

/** Drop largest non-stair meshes until under budget (walk-only coarse pass). */
function enforceTriBudget(document, budget) {
  const root = document.getRoot()
  const entries = []
  for (const mesh of root.listMeshes()) {
    const meshName = mesh.getName() || ''
    const extras = mesh.getExtras()
    const stair = extras.iomCollisionRole === 'stair' || STAIR_OR_RAMP.test(meshName)
    const walkKeep = extras.iomCollisionRole === 'walk' || WALK.test(meshName)
    let tris = 0
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices()
      if (idx) tris += idx.getCount() / 3
      else {
        const pos = prim.getAttribute('POSITION')
        if (pos) tris += pos.getCount() / 3
      }
    }
    let references = 0
    for (const node of root.listNodes()) {
      if (node.getMesh() === mesh) references += nodeInstanceCount(node)
    }
    entries.push({
      mesh,
      tris: Math.round(tris),
      expanded: Math.round(tris * references),
      stair,
      walkKeep,
      name: meshName,
    })
  }
  let total = entries.reduce((s, e) => s + e.expanded, 0)
  if (total <= budget) return { dropped: 0, total }

  entries.sort((a, b) => {
    if (a.stair !== b.stair) return a.stair ? -1 : 1
    if (a.walkKeep !== b.walkKeep) return a.walkKeep ? -1 : 1
    return b.expanded - a.expanded
  })

  let dropped = 0
  for (const e of entries) {
    if (total <= budget) break
    // Never drop named floors/stairs — holes here cause fall-through.
    if (e.stair || e.walkKeep) continue
    e.mesh.dispose()
    total -= e.expanded
    dropped += 1
  }
  return { dropped, total: Math.round(total) }
}

async function simplifyForRuntimeBudget(document, args) {
  const root = document.getRoot()
  await MeshoptSimplifier.ready
  let pass = 0
  let expanded = countExpandedTris(document)

  while (pass < 3) {
    const roles = expandedRoleStats(document)
    if (roles.other <= 0) break
    const budgetRatio = args.walkOnly && args.triBudget > 0
      ? Math.max(0.01, ((args.triBudget - roles.stair) / roles.other) * 0.9)
      : 1
    const ratio = pass === 0
      ? Math.min(args.ratio, budgetRatio)
      : Math.min(0.75, budgetRatio)
    if (!(ratio > 0 && ratio < 0.995)) break

    for (const mesh of root.listMeshes()) {
      if (mesh.getExtras().iomCollisionPreserveDetail === true) continue
      for (const primitive of mesh.listPrimitives()) {
        simplifyPrimitive(primitive, {
          simplifier: MeshoptSimplifier,
          ratio,
          error: args.error,
          lockBorder: true,
        })
      }
    }
    await document.transform(weld(), dedup(), prune())
    const next = countExpandedTris(document)
    pass += 1
    if (next <= args.triBudget || next >= expanded * 0.995) {
      expanded = next
      break
    }
    expanded = next
  }

  return { passes: pass, expanded }
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.input) {
    console.error(
      'Required: --input <model.glb> [--walk-only] [--simplify] [--ratio 0.22] [--error 0.045]',
    )
    process.exit(1)
  }
  await access(args.input)
  const outPath = args.out || join(dirname(args.input), 'collision.glb')
  await mkdir(dirname(outPath), { recursive: true })

  const io = await createGltfIO({ encoder: true })
  const document = await io.read(args.input)
  const root = document.getRoot()
  const trisIn = countTris(document)
  const isolation = isolateCollisionNodes(document, args.walkOnly)

  for (const anim of [...root.listAnimations()]) anim.dispose()

  await document.transform(flatten(), weld(), dedup(), prune())

  const simplifyInfo = args.simplify
    ? await simplifyForRuntimeBudget(document, args)
    : null

  let budgetInfo = null
  if (args.walkOnly && args.triBudget > 0) {
    const before = countExpandedTris(document)
    if (before > args.triBudget) {
      budgetInfo = enforceTriBudget(document, args.triBudget)
      await document.transform(prune())
    }
  }

  for (const tex of [...root.listTextures()]) tex.dispose()
  await document.transform(prune())

  const trisOut = countTris(document)
  const expandedOut = countExpandedTris(document)
  if (args.walkOnly && args.triBudget > 0 && expandedOut > args.triBudget) {
    throw new Error(
      `Collision runtime budget not met: ${expandedOut.toLocaleString()} expanded triangles > ${args.triBudget.toLocaleString()}. ` +
      'Use a cleaner semantic source, lower --ratio, or provide authored proxy geometry.',
    )
  }
  await io.write(outPath, document)
  const size = (await stat(outPath)).size

  console.log(`Source: ${args.input}`)
  console.log(
    `Mode: ${args.walkOnly ? 'walk-only coarse' : 'walk+wall'} · simplify=${args.simplify}${args.simplify ? ` ratio=${args.ratio} error=${args.error}` : ''}`,
  )
  console.log(
    `Kept nodes: ${isolation.keptNodes} · dropped: ${isolation.droppedNodes} · stair/ramp owners: ${isolation.stairNodes} · horizontal extras: ${isolation.horizontalExtras}`,
  )
  console.log(
    `Triangles: ${trisIn.toLocaleString()} stored source → ${trisOut.toLocaleString()} stored / ${expandedOut.toLocaleString()} runtime-expanded`,
  )
  if (simplifyInfo) console.log(`Selective simplify passes: ${simplifyInfo.passes}`)
  if (budgetInfo?.dropped) {
    console.log(`Tri budget: dropped ${budgetInfo.dropped} meshes · est. ${budgetInfo.total.toLocaleString()} tris`)
  }
  console.log(`Wrote ${outPath} (${(size / (1024 * 1024)).toFixed(2)} MiB)`)
  console.log(
    `Manifest field: "collision": "/models/${basename(dirname(outPath))}/collision.glb"`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
