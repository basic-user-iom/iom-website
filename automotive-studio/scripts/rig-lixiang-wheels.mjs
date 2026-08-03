/**
 * Offline Lixiang wheel re-rig (Phase 3).
 * Never overwrites source / unrigged optimized inputs unless --out-file overwrites intentionally.
 *
 * Usage:
 *   node automotive-studio/scripts/rig-lixiang-wheels.mjs
 *   node automotive-studio/scripts/rig-lixiang-wheels.mjs --variants
 *   node automotive-studio/scripts/rig-lixiang-wheels.mjs --input path.glb --out-file name.glb
 */
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, prune } from '@gltf-transform/functions'
import { Box3, Matrix4, Quaternion, Vector3 } from 'three'

const DEFAULT_INPUT = resolve(
  'F:/FREE_Lixiang_L9_2024_(White_Interior)/FREE_Lixiang_L9_2024_(White_Interior).glb',
)
const DEFAULT_OUT = resolve('F:/FREE_Lixiang_L9_2024_(White_Interior)/optimized')

const FRONT_STEER = ['FL_Wheel_26', 'FL_Wheel.001_28']
const REAR_COMBINED = 'RL_Wheel_30'
/** Studio normalizes this asset to a 5.1 m vehicle; wheel radius is derived from that. */
const TARGET_LENGTH_METRES = 5.1
const FALLBACK_RADIUS_METRES = 0.37

const VARIANT_JOBS = [
  {
    input: 'lixiang-presentation-high.glb',
    outFile: 'lixiang-presentation-high-rigged.glb',
  },
  { input: 'lixiang-balanced.glb', outFile: 'lixiang-balanced-rigged.glb' },
  { input: 'lixiang-mobile.glb', outFile: 'lixiang-mobile-rigged.glb' },
]

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    out: DEFAULT_OUT,
    outFile: 'lixiang-wheels-rigged.glb',
    variants: false,
  }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--input') args.input = resolve(argv[++i])
    else if (argv[i] === '--out') args.out = resolve(argv[++i])
    else if (argv[i] === '--out-file') args.outFile = argv[++i]
    else if (argv[i] === '--variants') args.variants = true
  }
  return args
}

async function sha256File(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

function findNode(root, name) {
  return root.listNodes().find((n) => n.getName() === name) || null
}

function localMatrix(node) {
  return new Matrix4().compose(
    new Vector3().fromArray(node.getTranslation()),
    new Quaternion().fromArray(node.getRotation()),
    new Vector3().fromArray(node.getScale()),
  )
}

/**
 * Mesh bounds of a node subtree expressed in the space of that node's parent.
 * Uses normalized accessor extrema so KHR_mesh_quantization is handled.
 */
function subtreeBounds(node, parentMatrix = new Matrix4(), skip = null) {
  const box = new Box3()
  const walk = (n, parent) => {
    if (skip && skip(n)) return
    const world = new Matrix4().multiplyMatrices(parent, localMatrix(n))
    const mesh = n.getMesh()
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION')
        if (!pos) continue
        const min = new Vector3().fromArray(pos.getMinNormalized([]))
        const max = new Vector3().fromArray(pos.getMaxNormalized([]))
        box.union(new Box3(min, max).applyMatrix4(world))
      }
    }
    for (const child of n.listChildren()) walk(child, world)
  }
  walk(node, parentMatrix)
  return box.isEmpty() ? null : box
}

/** World (scene-space) matrix for every node, keyed by node. */
function buildWorldMatrices(root) {
  const map = new Map()
  const walk = (n, parent) => {
    const world = new Matrix4().multiplyMatrices(parent, localMatrix(n))
    map.set(n, world)
    for (const c of n.listChildren()) walk(c, world)
  }
  for (const scene of root.listScenes()) {
    for (const child of scene.listChildren()) walk(child, new Matrix4())
  }
  return map
}

/** Scene bounds excluding the watermark plane at any depth, so length is measured cleanly. */
function vehicleSceneBounds(root) {
  const skip = (n) => /discord/i.test(n.getName() || '')
  const box = new Box3()
  for (const scene of root.listScenes()) {
    for (const child of scene.listChildren()) {
      const b = subtreeBounds(child, new Matrix4(), skip)
      if (b) box.union(b)
    }
  }
  return box.isEmpty() ? null : box
}

/**
 * Insert a roll pivot **at the hub centre** and rebase the wheel children onto it.
 * A pivot at the steering-node origin makes the tire orbit on a wide arc instead of
 * spinning in place, so the centre offset is mandatory.
 */
function insertRollingPivot(document, steeringNode, label) {
  const existing = steeringNode.listChildren().find((c) => c.getName() === `${label}_RollingPivot`)
  if (existing) {
    return {
      pivot: existing,
      centre: new Vector3().fromArray(existing.getTranslation()),
      size: new Vector3(),
    }
  }

  const children = [...steeringNode.listChildren()]
  const named = children.filter((child) => {
    const name = child.getName() || ''
    return /tire|tyre|wheel|rim/i.test(name) && !/rollingpivot/i.test(name)
  })
  const move = named.length ? named : children.filter((c) => !/rollingpivot/i.test(c.getName() || ''))
  if (!move.length) throw new Error(`No wheel children under ${steeringNode.getName()}`)

  const hub = new Box3()
  for (const child of move) {
    const b = subtreeBounds(child)
    if (b) hub.union(b)
  }
  const centre = hub.isEmpty() ? new Vector3() : hub.getCenter(new Vector3())

  const pivot = document.createNode(`${label}_RollingPivot`)
  pivot.setTranslation(centre.toArray())

  for (const child of move) {
    const t = child.getTranslation()
    steeringNode.removeChild(child)
    child.setTranslation([t[0] - centre.x, t[1] - centre.y, t[2] - centre.z])
    pivot.addChild(child)
  }

  steeringNode.addChild(pivot)
  return { pivot, centre, size: hub.isEmpty() ? new Vector3() : hub.getSize(new Vector3()) }
}

function buildManifest(sourcePath, sourceHash, outGlb, outHash, measured = {}) {
  const RADIUS_METRES = measured.radiusMetres ?? FALLBACK_RADIUS_METRES
  const AXLE_AXIS = measured.axleAxis ?? 'y'
  return {
    schemaVersion: 1,
    assetFingerprint: sourceHash,
    sourcePath,
    outputPath: outGlb,
    outputSha256: outHash,
    primaryRoot: { name: 'GLTF_SceneRootNode' },
    boundsExclusions: [{ name: 'discord_32' }, { name: 'discord' }],
    forwardAxis: '+x',
    upAxis: '+y',
    notes: [
      'Front FL/FR RollingPivot under steering roots; animation targets unchanged.',
      'RollingPivots sit at the measured hub centre — a pivot at the steering origin orbits the tire.',
      'Rear combined RL_Wheel_30 uses Rear_RollingPivot on the shared axle line (no L/R mesh split yet).',
      'Studio re-measures axle axis, roll direction and radius at runtime; these values are hints.',
      'Import this manifesto after loading a *-rigged.glb for Bound status.',
      'Hero High size exception: presentation-high ≤35.48 MiB approved for prototype (3 Aug 2026).',
    ],
    wheels: [
      {
        id: 'FL',
        steeringNode: { name: 'FL_Wheel_26' },
        rollingNode: { name: 'FL_RollingPivot' },
        radiusMetres: RADIUS_METRES,
        axleAxis: AXLE_AXIS,
        rollingDriver: 'route-distance',
      },
      {
        id: 'FR',
        steeringNode: { name: 'FL_Wheel.001_28' },
        rollingNode: { name: 'FR_RollingPivot' },
        radiusMetres: RADIUS_METRES,
        axleAxis: AXLE_AXIS,
        rollingDriver: 'route-distance',
      },
      {
        id: 'RL',
        steeringNode: { name: 'RL_Wheel_30' },
        rollingNode: { name: 'Rear_RollingPivot' },
        radiusMetres: RADIUS_METRES,
        axleAxis: AXLE_AXIS,
        rollingDriver: 'route-distance',
      },
      {
        id: 'RR',
        steeringNode: { name: 'RL_Wheel_30' },
        rollingNode: { name: 'Rear_RollingPivot' },
        radiusMetres: RADIUS_METRES,
        axleAxis: AXLE_AXIS,
        rollingDriver: 'route-distance',
      },
    ],
    preservedNodes: FRONT_STEER.map((name) => ({ name })).concat([
      { name: 'FL_Door_8' },
      { name: 'FR_Door_10' },
      { name: 'RL_Door_24' },
      { name: 'RR_Door_22' },
      { name: 'Plane.005_12' },
      { name: 'Plane.164_19' },
      { name: 'RL_Wheel_30' },
      { name: 'Rear_RollingPivot' },
    ]),
    semanticActions: [],
    createdAt: new Date().toISOString(),
  }
}

async function writeGlbAtomic(io, document, outGlb) {
  const tmpGlb = outGlb.replace(/\.glb$/i, '.tmp.glb')
  await io.write(tmpGlb, document)
  try {
    await unlink(outGlb)
  } catch {
    /* first write */
  }
  await rename(tmpGlb, outGlb)
}

async function rigOne(io, inputPath, outDir, outFile) {
  await access(inputPath)
  const sourceHash = await sha256File(inputPath)
  console.log(`\n→ Rigging ${basename(inputPath)}`)

  const document = await io.read(inputPath)
  const root = document.getRoot()

  const fl = findNode(root, FRONT_STEER[0])
  const fr = findNode(root, FRONT_STEER[1])
  const rear = findNode(root, REAR_COMBINED)
  if (!fl || !fr || !rear) throw new Error(`Missing FL/FR/RL wheel roots in ${inputPath}`)

  const sceneBox = vehicleSceneBounds(root)
  const sceneSize = sceneBox ? sceneBox.getSize(new Vector3()) : new Vector3()
  const lengthUnits = Math.max(sceneSize.x, sceneSize.z)
  const unitsToMetres = lengthUnits > 1e-6 ? TARGET_LENGTH_METRES / lengthUnits : 0
  const worldMatrices = buildWorldMatrices(root)

  const flRoll = insertRollingPivot(document, fl, 'FL')
  const frRoll = insertRollingPivot(document, fr, 'FR')
  const rearRoll = insertRollingPivot(document, rear, 'Rear')

  const fmtVec = (v) => `[${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}]`
  // A single wheel disc is round in two axes and thin in the third — the thin one is the axle.
  // Only valid for the front pivots; the rear pivot spans both wheels along that same axle.
  const axleAxisOf = (size) => {
    const dims = [
      ['x', size.x],
      ['y', size.y],
      ['z', size.z],
    ]
    dims.sort((a, b) => a[1] - b[1])
    return dims[0][0]
  }

  const flAxle = axleAxisOf(flRoll.size)
  const flDiameterUnits = Math.max(flRoll.size.x, flRoll.size.y, flRoll.size.z)
  const flWorld = worldMatrices.get(fl)
  const worldScale = flWorld ? new Vector3().setFromMatrixScale(flWorld).x : 1
  const radiusMetres = (flDiameterUnits / 2) * worldScale * unitsToMetres

  for (const [label, r] of [
    ['FL', flRoll],
    ['FR', frRoll],
    ['Rear', rearRoll],
  ]) {
    console.log(
      `  ${label}_RollingPivot hub ${fmtVec(r.centre)} · size ${fmtVec(r.size)} · children ${r.pivot.listChildren().length}`,
    )
  }
  console.log(
    `  vehicle ${lengthUnits.toFixed(1)} units → ${TARGET_LENGTH_METRES} m · tire radius ≈ ${radiusMetres.toFixed(3)} m · axle ${flAxle}`,
  )

  await document.transform(dedup(), prune())

  const outGlb = join(outDir, outFile)
  await writeGlbAtomic(io, document, outGlb)
  const outHash = await sha256File(outGlb)
  const sizeMiB = (await readFile(outGlb)).length / (1024 * 1024)
  console.log(`  wrote ${outFile} — ${sizeMiB.toFixed(2)} MiB`)

  return {
    inputPath,
    sourceHash,
    outGlb,
    outHash,
    outFile,
    sizeMiB,
    measured: {
      radiusMetres: Number(radiusMetres.toFixed(4)) || FALLBACK_RADIUS_METRES,
      axleAxis: flAxle,
    },
  }
}

async function main() {
  const args = parseArgs(process.argv)
  await mkdir(args.out, { recursive: true })
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

  if (args.variants) {
    const results = []
    for (const job of VARIANT_JOBS) {
      const inputPath = join(args.out, job.input)
      results.push(await rigOne(io, inputPath, args.out, job.outFile))
    }
    // Manifest keyed to high-rigged (primary presentation asset).
    const primary = results[0]
    const manifest = buildManifest(
      primary.inputPath,
      primary.sourceHash,
      primary.outGlb,
      primary.outHash,
      primary.measured,
    )
    manifest.notes.push(
      `Also wrote: ${results.map((r) => r.outFile).join(', ')}`,
    )
    await writeFile(join(args.out, 'vehicle-rig.manifest.json'), JSON.stringify(manifest, null, 2))
    console.log('\nWrote vehicle-rig.manifest.json (points at high-rigged)')
    console.log('Done. Import *-rigged.glb + manifesto for Bound on presentation variants.')
    return
  }

  const result = await rigOne(io, args.input, args.out, args.outFile)
  const manifest = buildManifest(
    result.inputPath,
    result.sourceHash,
    result.outGlb,
    result.outHash,
    result.measured,
  )
  await writeFile(join(args.out, 'vehicle-rig.manifest.json'), JSON.stringify(manifest, null, 2))
  console.log('Wrote vehicle-rig.manifest.json')
  console.log('Source untouched.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
