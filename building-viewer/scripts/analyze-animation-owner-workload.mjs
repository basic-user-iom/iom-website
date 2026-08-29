/** Inventory render workload by nearest *_anim1 owner for expansion planning. */
import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGltfIO } from './lib/gltf-io.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const MODEL_ROOT = resolve(VIEWER_ROOT, '..', 'public', 'models', 'icm-anim-2025')
const OUT_DIR = resolve(process.argv[2] ?? join(VIEWER_ROOT, 'tmp', 'animation-owner-workload'))

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function nearestOwner(node) {
  let current = node
  while (current) {
    if (/_anim1$/.test(current.getName() || '')) return current.getName()
    current = current.getParentNode()
  }
  return '__unowned__'
}

function instanceCount(node) {
  const extension = node.getExtension('EXT_mesh_gpu_instancing')
  const attribute = extension?.getAttribute?.('TRANSLATION') ??
    extension?.getAttribute?.('ROTATION') ?? extension?.getAttribute?.('SCALE')
  return attribute?.getCount?.() ?? 1
}

function meshWorkload(node, nodeIndex) {
  const mesh = node.getMesh()
  if (!mesh) return null
  const instances = instanceCount(node)
  let uniqueTriangles = 0
  let primitiveDraws = 0
  for (const primitive of mesh.listPrimitives()) {
    const elements = primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')?.getCount() ?? 0
    uniqueTriangles += Math.floor(elements / 3)
    if (elements >= 3) primitiveDraws += 1
  }
  const extras = node.getExtras() ?? {}
  const sourceIds = Array.isArray(extras.sourceIds) ? extras.sourceIds : []
  return {
    nodeIndex,
    node: node.getName() || '(unnamed)',
    mesh: mesh.getName() || '(unnamed)',
    metadataKeys: Object.keys(extras).sort(),
    sourcePath: typeof extras.iomPackageSourcePath === 'string' ? extras.iomPackageSourcePath : null,
    sourceIdCount: sourceIds.length,
    sourceIdRange: sourceIds.length ? [sourceIds[0], sourceIds.at(-1)] : null,
    instances,
    uniqueTriangles,
    expandedTriangles: uniqueTriangles * instances,
    rendererDraws: primitiveDraws,
    logicalPrimitiveInstances: primitiveDraws * instances,
  }
}

async function analyze(variant) {
  const path = join(MODEL_ROOT, `model-${variant}.glb`)
  const file = await readFile(path)
  const io = await createGltfIO()
  const document = await io.read(path)
  const root = document.getRoot()
  const animatedChannels = new Map()
  for (const animation of root.listAnimations()) {
    for (const channel of animation.listChannels()) {
      const name = channel.getTargetNode()?.getName() || '(unnamed)'
      animatedChannels.set(name, (animatedChannels.get(name) ?? 0) + 1)
    }
  }

  const byOwner = new Map()
  for (const [nodeIndex, node] of root.listNodes().entries()) {
    const workload = meshWorkload(node, nodeIndex)
    if (!workload) continue
    const owner = nearestOwner(node)
    const record = byOwner.get(owner) ?? {
      owner,
      animatedChannels: animatedChannels.get(owner) ?? 0,
      meshNodes: 0,
      logicalInstances: 0,
      uniqueTriangles: 0,
      expandedTriangles: 0,
      rendererDraws: 0,
      logicalPrimitiveInstances: 0,
      largestNodes: [],
    }
    record.meshNodes += 1
    record.logicalInstances += workload.instances
    record.uniqueTriangles += workload.uniqueTriangles
    record.expandedTriangles += workload.expandedTriangles
    record.rendererDraws += workload.rendererDraws
    record.logicalPrimitiveInstances += workload.logicalPrimitiveInstances
    record.largestNodes.push(workload)
    byOwner.set(owner, record)
  }

  const owners = [...byOwner.values()].map((record) => ({
    ...record,
    largestNodes: record.largestNodes
      .sort((left, right) => right.expandedTriangles - left.expandedTriangles)
      .slice(0, 20),
  })).sort((left, right) => right.expandedTriangles - left.expandedTriangles)
  return {
    variant,
    file: { bytes: (await stat(path)).size, sha256: sha256(file) },
    animations: root.listAnimations().map((animation) => ({
      name: animation.getName(),
      channels: animation.listChannels().length,
      samplers: animation.listSamplers().length,
    })),
    animatedTargets: [...animatedChannels].map(([name, channels]) => ({ name, channels })).sort((a, b) => a.name.localeCompare(b.name)),
    owners,
    aggregate: owners.reduce((total, owner) => ({
      meshNodes: total.meshNodes + owner.meshNodes,
      logicalInstances: total.logicalInstances + owner.logicalInstances,
      uniqueTriangles: total.uniqueTriangles + owner.uniqueTriangles,
      expandedTriangles: total.expandedTriangles + owner.expandedTriangles,
      rendererDraws: total.rendererDraws + owner.rendererDraws,
      logicalPrimitiveInstances: total.logicalPrimitiveInstances + owner.logicalPrimitiveInstances,
    }), {
      meshNodes: 0,
      logicalInstances: 0,
      uniqueTriangles: 0,
      expandedTriangles: 0,
      rendererDraws: 0,
      logicalPrimitiveInstances: 0,
    }),
  }
}

const variants = { web: await analyze('web'), quest: await analyze('quest') }
const report = {
  schema: 'IOM_ANIMATION_OWNER_WORKLOAD',
  version: 1,
  productionModified: false,
  variants,
  recommendation: 'Package animated owners in descending resident-impact order, then explicitly assign the unowned/static render set before whole-layer routing can replace the monolith.',
}
await mkdir(OUT_DIR, { recursive: true })
await writeFile(join(OUT_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)

const rows = ['web', 'quest'].flatMap((variant) => variants[variant].owners.map((owner) =>
  `| ${variant} | ${owner.owner} | ${owner.animatedChannels} | ${owner.meshNodes.toLocaleString()} | ${owner.logicalInstances.toLocaleString()} | ${owner.expandedTriangles.toLocaleString()} | ${owner.rendererDraws.toLocaleString()} | ${owner.logicalPrimitiveInstances.toLocaleString()} |`))
await writeFile(join(OUT_DIR, 'REPORT.md'), `# Animated model owner workload\n\n` +
  `This is a read-only expansion inventory. Production assets are unchanged.\n\n` +
  `| Variant | Nearest owner | Animation channels | Mesh nodes | Logical instances | Expanded triangles | Renderer draws | Logical primitive instances |\n` +
  `|---|---|---:|---:|---:|---:|---:|---:|\n${rows.join('\n')}\n\n` +
  `Whole-layer manifest-v3 routing is not valid until every animated-owner and unowned/static render path is represented exactly once.\n`)

console.log('Animation owner workload analysis: PASS')
for (const variant of ['web', 'quest']) {
  console.log(`  ${variant}: ${variants[variant].aggregate.expandedTriangles.toLocaleString()} tris / ${variants[variant].aggregate.rendererDraws.toLocaleString()} renderer draws`)
  for (const owner of variants[variant].owners) {
    console.log(`    ${owner.owner}: ${owner.expandedTriangles.toLocaleString()} tris / ${owner.rendererDraws.toLocaleString()} renderer draws`)
  }
}
