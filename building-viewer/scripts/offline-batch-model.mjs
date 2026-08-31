/**
 * Animation-safe offline batching for architectural GLBs.
 *
 * Exact repeated meshes are converted to EXT_mesh_gpu_instancing first. The
 * remaining opaque sibling primitives are then joined per existing hierarchy
 * level. Nodes targeted directly by animation channels are preserved by the
 * glTF Transform join operation. Transparent/transmission meshes are excluded
 * because merging them breaks per-pane depth sorting.
 *
 * Usage:
 *   node building-viewer/scripts/offline-batch-model.mjs ^
 *     --input building-viewer/tmp/icm-anim-2025-cleaned.glb ^
 *     --out building-viewer/tmp/icm-anim-2025-batched.glb
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { NodeIO, PropertyType } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, flatten, getBounds, instance, join, prune } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import {
  auditSurfaceRepairCertificates,
  hasExactSurfaceRepairCertificate,
  surfaceRepairAuditSummary,
} from './lib/surface-repair-certificate.mjs'

function parseArgs(argv) {
  const args = {
    input: null,
    out: null,
    report: null,
    inspectOnly: false,
    minInstances: 3,
    joinSceneRoot: false,
    flattenStatic: false,
    cellSize: 18,
    floorBand: 4,
    maxBatchTriangles: 200_000,
  }
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--input') args.input = resolve(argv[++i])
    else if (arg === '--out') args.out = resolve(argv[++i])
    else if (arg === '--report') args.report = resolve(argv[++i])
    else if (arg === '--inspect') args.inspectOnly = true
    else if (arg === '--min-instances') args.minInstances = Math.max(2, Number(argv[++i]) || 3)
    else if (arg === '--join-scene-root') args.joinSceneRoot = true
    else if (arg === '--flatten-static') args.flattenStatic = true
    else if (arg === '--cell-size') args.cellSize = Math.max(4, Number(argv[++i]) || 18)
    else if (arg === '--floor-band') args.floorBand = Math.max(2, Number(argv[++i]) || 4)
    else if (arg === '--max-batch-triangles') {
      args.maxBatchTriangles = Math.max(25_000, Number(argv[++i]) || 200_000)
    }
  }
  if (!args.input || (!args.inspectOnly && !args.out)) {
    throw new Error('Required: --input <source.glb> and either --inspect or --out <batched.glb>')
  }
  if (args.out && args.input === args.out) throw new Error('Input and output must be different files')
  if (args.out) args.report ||= args.out.replace(/\.glb$/i, '.offline-batch-report.json')
  return args
}

function primitiveTriangles(primitive) {
  const indices = primitive.getIndices()
  if (indices) return Math.floor(indices.getCount() / 3)
  const position = primitive.getAttribute('POSITION')
  return position ? Math.floor(position.getCount() / 3) : 0
}

function meshTriangles(mesh) {
  return mesh.listPrimitives().reduce((sum, primitive) => sum + primitiveTriangles(primitive), 0)
}

function instanceCount(node) {
  const ext = node.getExtension('EXT_mesh_gpu_instancing')
  if (!ext) return 1
  for (const semantic of ['TRANSLATION', 'ROTATION', 'SCALE', '_ID']) {
    const accessor = ext.getAttribute?.(semantic)
    if (accessor) return accessor.getCount()
  }
  return 1
}

function materialIsTransparent(material) {
  if (!material) return false
  if (material.getAlphaMode() === 'BLEND') return true
  const transmission = material.getExtension('KHR_materials_transmission')
  return Boolean(transmission && (transmission.getTransmissionFactor?.() ?? 0) > 0.001)
}

function nodeHasTransparentPrimitive(node) {
  const mesh = node.getMesh()
  return Boolean(mesh?.listPrimitives().some((primitive) => materialIsTransparent(primitive.getMaterial())))
}

function nodeIsDirectSceneChild(node) {
  return node.listParents().some((parent) => parent.propertyType === PropertyType.SCENE)
}

function nodeIsAnimatedTarget(node) {
  return node.listParents().some((parent) => parent.propertyType === PropertyType.ANIMATION_CHANNEL)
}

/**
 * Insert identity grouping nodes before joining so a common wall/floor material
 * cannot become one multi-million-triangle, campus-wide mesh. Reparenting a
 * direct child below an identity node preserves its transform and any animation
 * inherited from the existing parent (for example one of the five floor roots).
 */
function partitionOpaqueSiblings(document, options) {
  const root = document.getRoot()
  const parents = [...root.listScenes(), ...root.listNodes()]
  let groupsCreated = 0
  let nodesPartitioned = 0
  let largestGroupTriangles = 0

  for (const parent of parents) {
    const isScene = parent.propertyType === PropertyType.SCENE
    if (isScene && !options.joinSceneRoot) continue
    const assignments = new Map()
    for (const node of [...parent.listChildren()]) {
      const mesh = node.getMesh()
      if (!mesh || nodeIsAnimatedTarget(node) || nodeHasTransparentPrimitive(node)) continue
      if (hasExactSurfaceRepairCertificate(node.getExtras())) continue
      if (node.getExtension('EXT_mesh_gpu_instancing')) continue
      const bounds = getBounds(node)
      if (!bounds?.min || !bounds?.max) continue
      const cx = (bounds.min[0] + bounds.max[0]) * 0.5
      const cy = (bounds.min[1] + bounds.max[1]) * 0.5
      const cz = (bounds.min[2] + bounds.max[2]) * 0.5
      const cell = `${Math.floor(cx / options.cellSize)}|${Math.floor(cy / options.floorBand)}|${Math.floor(cz / options.cellSize)}`
      const triangles = meshTriangles(mesh)
      const chunks = assignments.get(cell) || []
      let chunk = chunks[chunks.length - 1]
      if (!chunk || (chunk.triangles > 0 && chunk.triangles + triangles > options.maxBatchTriangles)) {
        chunk = { triangles: 0, nodes: [] }
        chunks.push(chunk)
        assignments.set(cell, chunks)
      }
      chunk.triangles += triangles
      chunk.nodes.push(node)
    }

    for (const [cell, chunks] of assignments) {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        if (chunk.nodes.length < 2) continue
        const group = document.createNode(`IOM_BATCH_${cell.replaceAll('|', '_')}_${i}`)
        parent.addChild(group)
        for (const node of chunk.nodes) group.addChild(node)
        groupsCreated += 1
        nodesPartitioned += chunk.nodes.length
        largestGroupTriangles = Math.max(largestGroupTriangles, chunk.triangles)
      }
    }
  }

  return { groupsCreated, nodesPartitioned, largestGroupTriangles }
}

function collectStats(document) {
  const root = document.getRoot()
  const semanticNamePattern = /fire|hose|feuer|hydrant|brandschutz|verbindung|walkway|footbridge|skybridge|connector|passage|uebergang|übergang/i
  let uniqueTriangles = 0
  let storedPrimitives = 0
  let expandedTriangles = 0
  let gpuSubmissions = 0
  let opaqueSubmissions = 0
  let transparentSubmissions = 0
  let opaqueExpandedTriangles = 0
  let transparentExpandedTriangles = 0
  let logicalInstances = 0
  let instancedNodes = 0
  let largestMeshTriangles = 0
  const criticalMaterialRoleUsage = new Map()

  for (const mesh of root.listMeshes()) {
    const triangles = meshTriangles(mesh)
    uniqueTriangles += triangles
    storedPrimitives += mesh.listPrimitives().length
    largestMeshTriangles = Math.max(largestMeshTriangles, triangles)
  }
  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const count = instanceCount(node)
    if (count > 1) instancedNodes += 1
    logicalInstances += count
    expandedTriangles += meshTriangles(mesh) * count
    gpuSubmissions += mesh.listPrimitives().length
    for (const primitive of mesh.listPrimitives()) {
      const triangles = primitiveTriangles(primitive) * count
      const material = primitive.getMaterial()
      const role = material?.getExtras()?.iomMaterialRole
      if (typeof role === 'string') {
        const name = material.getName() || '(unnamed)'
        const key = `${role}|${name}`
        const usage = criticalMaterialRoleUsage.get(key) || {
          role,
          name,
          primitiveSubmissions: 0,
          logicalPrimitiveInstances: 0,
          expandedTriangles: 0,
          sampleNodes: [],
        }
        usage.primitiveSubmissions += 1
        usage.logicalPrimitiveInstances += count
        usage.expandedTriangles += triangles
        if (usage.sampleNodes.length < 12) usage.sampleNodes.push(node.getName() || '(unnamed)')
        criticalMaterialRoleUsage.set(key, usage)
      }
      if (materialIsTransparent(primitive.getMaterial())) {
        transparentSubmissions += 1
        transparentExpandedTriangles += triangles
      } else {
        opaqueSubmissions += 1
        opaqueExpandedTriangles += triangles
      }
    }
  }

  const materials = root.listMaterials()
  const animatedTargets = new Set()
  const animationDetails = []
  for (const animation of root.listAnimations()) {
    const channels = []
    let durationSeconds = 0
    for (const channel of animation.listChannels()) {
      const node = channel.getTargetNode()
      if (node) animatedTargets.add(node)
      const input = channel.getSampler()?.getInput()
      const output = channel.getSampler()?.getOutput()
      const values = input?.getArray()
      if (values?.length) durationSeconds = Math.max(durationSeconds, values[values.length - 1])
      const outputValues = output?.getArray()
      const elementSize = output?.getElementSize() || 0
      channels.push({
        target: node?.getName() || '(unnamed)',
        path: channel.getTargetPath(),
        keyframes: input?.getCount() || 0,
        firstValue: outputValues && elementSize
          ? Array.from(outputValues.slice(0, elementSize))
          : [],
        lastValue: outputValues && elementSize
          ? Array.from(outputValues.slice(-elementSize))
          : [],
      })
    }
    animationDetails.push({
      name: animation.getName() || '(unnamed)',
      channels,
      durationSeconds,
    })
  }

  return {
    scenes: root.listScenes().map((scene) => ({
      name: scene.getName() || '(unnamed)',
      rootNodes: scene.listChildren().length,
    })),
    nodes: root.listNodes().length,
    meshes: root.listMeshes().length,
    storedPrimitives,
    uniqueTriangles,
    expandedTriangles,
    gpuSubmissions,
    opaqueSubmissions,
    transparentSubmissions,
    opaqueExpandedTriangles,
    transparentExpandedTriangles,
    criticalMaterialRoleUsage: [...criticalMaterialRoleUsage.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    logicalInstances,
    instancedNodes,
    largestMeshTriangles,
    materials: materials.length,
    doubleSidedMaterials: materials.filter((material) => material.getDoubleSided()).length,
    transparentMaterials: materials.filter(materialIsTransparent).length,
    animations: root.listAnimations().length,
    animatedTargetNodes: animatedTargets.size,
    animationDetails,
    semanticNodeNames: root.listNodes()
      .map((node) => node.getName())
      .filter((name) => semanticNamePattern.test(name))
      .sort(),
  }
}

function animationTrackSet(stats) {
  return new Set(
    stats.animationDetails.flatMap((animation) =>
      animation.channels.map(
        (channel) => `${animation.name}|${channel.target}|${channel.path}`,
      ),
    ),
  )
}

function assertAnimationPreserved(before, after, label) {
  const expected = animationTrackSet(before)
  const actual = animationTrackSet(after)
  for (const track of expected) {
    if (!actual.has(track)) {
      throw new Error(`${label} removed animation track: ${track}`)
    }
  }
  const beforeDuration = Math.max(
    0,
    ...before.animationDetails.map((animation) => animation.durationSeconds),
  )
  const afterDuration = Math.max(
    0,
    ...after.animationDetails.map((animation) => animation.durationSeconds),
  )
  if (Math.abs(beforeDuration - afterDuration) > 0.001) {
    throw new Error(
      `${label} changed animation duration from ${beforeDuration} to ${afterDuration}.`,
    )
  }
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

async function main() {
  const args = parseArgs(process.argv)
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready])
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    })

  const document = await io.read(args.input)
  const beforeSurfaceRepairAudit = auditSurfaceRepairCertificates(document, {
    mirrorMeshCertificates: true,
  })
  const before = collectStats(document)

  if (args.inspectOnly) {
    console.log(JSON.stringify({ path: args.input, stats: before }, null, 2))
    return
  }

  await document.transform(
    dedup({
      // Material extras carry fire-safety semantics. Material deduplication
      // would spread that role to unrelated visually-identical CAD parts.
      propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE],
    }),
  )
  auditSurfaceRepairCertificates(document, {
    expectedCertificateCount: beforeSurfaceRepairAudit.certificateCount,
  })
  if (args.flattenStatic) {
    // glTF Transform retains animation targets and everything below animated
    // ancestors, while lifting unrelated static meshes to the scene. This
    // exposes more same-cell/material candidates without breaking floor motion.
    await document.transform(flatten({ cleanup: false }))
  }
  const partition = partitionOpaqueSiblings(document, args)
  // The glTF Transform instance pass intentionally refuses documents with
  // animations. Joining below animation roots remains safe and useful there.
  if (
    document.getRoot().listAnimations().length === 0 &&
    beforeSurfaceRepairAudit.certificateCount === 0
  ) {
    await document.transform(instance({ min: args.minInstances }))
  }
  await document.transform(
    join({
      keepNamed: false,
      cleanup: false,
      filter: (node) => {
        if (!args.joinSceneRoot && nodeIsDirectSceneChild(node)) return false
        if (hasExactSurfaceRepairCertificate(node.getExtras())) return false
        return !nodeHasTransparentPrimitive(node)
      },
    }),
    prune({ keepAttributes: true, keepIndices: true }),
  )

  const afterSurfaceRepairAudit = auditSurfaceRepairCertificates(document, {
    expectedCertificateCount: beforeSurfaceRepairAudit.certificateCount,
  })
  const after = collectStats(document)
  assertAnimationPreserved(before, after, 'Offline batching')
  await io.write(args.out, document)
  const writtenDocument = await io.read(args.out)
  const writtenSurfaceRepairAudit = auditSurfaceRepairCertificates(writtenDocument, {
    expectedCertificateCount: beforeSurfaceRepairAudit.certificateCount,
  })
  const written = collectStats(writtenDocument)
  assertAnimationPreserved(before, written, 'Written offline batch')
  const inputBytes = (await readFile(args.input)).byteLength
  const outputBytes = (await readFile(args.out)).byteLength
  const report = {
    version: 1,
    createdAt: new Date().toISOString(),
    tool: {
      script: 'building-viewer/scripts/offline-batch-model.mjs',
      node: process.version,
      minInstances: args.minInstances,
      joinSceneRoot: args.joinSceneRoot,
      flattenStatic: args.flattenStatic,
      cellSize: args.cellSize,
      floorBand: args.floorBand,
      maxBatchTriangles: args.maxBatchTriangles,
      policy: 'instance exact repeats, join opaque siblings, preserve animation targets and transparent meshes',
      partition,
      surfaceRepairCertificates: {
        input: surfaceRepairAuditSummary(beforeSurfaceRepairAudit),
        transformed: surfaceRepairAuditSummary(afterSurfaceRepairAudit),
        written: surfaceRepairAuditSummary(writtenSurfaceRepairAudit),
      },
    },
    input: {
      path: args.input,
      bytes: inputBytes,
      sha256: await sha256(args.input),
      stats: before,
    },
    output: {
      path: args.out,
      bytes: outputBytes,
      sha256: await sha256(args.out),
      stats: written,
    },
    reduction: {
      gpuSubmissions: before.gpuSubmissions
        ? 1 - after.gpuSubmissions / before.gpuSubmissions
        : 0,
      uniqueTriangles: before.uniqueTriangles
        ? 1 - after.uniqueTriangles / before.uniqueTriangles
        : 0,
      bytes: inputBytes ? 1 - outputBytes / inputBytes : 0,
    },
  }
  await writeFile(args.report, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
