#!/usr/bin/env node

/**
 * Build an independently reproducible, fail-closed v3 planning index over the
 * immutable spatial-v2 payloads plus a physical low-cost Web proxy. This does
 * not assemble v3 packages or change runtime routing. It proves the exact
 * all-package selection sweep and records the missing visual/browser gates.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { createGltfIO } from './lib/gltf-io.mjs'
import { triangleCount } from './build-ground-floor-selective-repeat-lod-pilot.mjs'
import { validateRepeatSpatialV2Index } from './build-ground-floor-repeat-spatial-payload-v2.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const DEFAULT_V2 = resolve(VIEWER_ROOT, 'tmp/repeat-spatial-payload-v2/index.json')
const DEFAULT_PROXY = resolve(VIEWER_ROOT, 'tmp/repeat-cluster-hlod-v3/dcc/web-row-cluster-hlod-v3.glb')
const DEFAULT_PROXY_REPORT = resolve(VIEWER_ROOT, 'tmp/repeat-cluster-hlod-v3/dcc/blender-report.json')
const DEFAULT_VISUAL = resolve(VIEWER_ROOT, 'tmp/repeat-cluster-hlod-v3/visual-qa/visual-approval.json')
const DEFAULT_OUT = resolve(VIEWER_ROOT, 'tmp/repeat-spatial-payload-v3')
const EXPECTED_V2_INDEX_BYTES = 1_055_119
const EXPECTED_V2_INDEX_SHA256 = '9ba4f70c94816eaef7d869d546bd868e09e841c5e649eb2fd117d46cd990e003'
const LOGICAL_INSTANCES = 78
const MATERIAL_SLOTS = 4
const MAX_PROXY_TRIANGLES = 2_000
const EXPECTED_DCC_SOURCE_BYTES = 1_744_016
const EXPECTED_DCC_SOURCE_SHA256 = '5e825834692b57e85dc09f7cb48d956815c3c6a7cee1ab8c35e9c3b92a345efe'
const NEGATIVE_TRIANGLES_PER_SOURCE = 3_000
const EXPECTED_NEGATIVE_EXIT = 1_500_456
const SOURCE_IDS_SHA256 = 'd2883d11372b27f23ae8388db283195e13b979870cb5897e63a7971676a5189b'
const SOURCE_PATHS_SHA256 = '72f559e1f08017caeb07b3c5577b0f2e3f2cf85a1886f781f9f5b863836d30bc'
const REVIEWER_LOD0_PINSETS = Object.freeze({
  webLod0: 'b0d59f87ab014d63eb7483280cc56b511b800b53767b44e8a4a5e8c1ddf83ea3',
  questLod0: '6037bac0f4a73d9a8c39d89a00b6dbeeee1abca2c7b80ae50b5007e2744d9c8e',
})
const REVIEWER_PINSET_LENGTHS = Object.freeze({ web: 13_363, quest: 13_420 })
const EXPECTED_MATERIALS = [
  'vray Stuhl_Plastik',
  'vray Stuhl_Plakete',
  'vray Stuhl_Metall',
  'vray Stuhl_Bezug',
]
const RESERVATION = Object.freeze({
  web: Object.freeze({ residentTriangles: 500_000, transitionPeakTriangles: 500_000 }),
  quest: Object.freeze({ residentTriangles: 250_000, transitionPeakTriangles: 250_000 }),
})

function parseArgs(argv) {
  const args = { v2: DEFAULT_V2, proxy: DEFAULT_PROXY, proxyReport: DEFAULT_PROXY_REPORT, visual: DEFAULT_VISUAL, out: DEFAULT_OUT }
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--v2') args.v2 = resolve(argv[++index])
    else if (value === '--proxy') args.proxy = resolve(argv[++index])
    else if (value === '--proxy-report') args.proxyReport = resolve(argv[++index])
    else if (value === '--visual') args.visual = resolve(argv[++index])
    else if (value === '--out') args.out = resolve(argv[++index])
    else throw new Error(`Unknown argument: ${value}`)
  }
  return args
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, stableValue(child)]))
  if (typeof value === 'number' && Object.is(value, -0)) return 0
  return value
}
const stableStringify = (value) => JSON.stringify(stableValue(value))
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const canonicalNumber = (value) => Number(Number(value).toPrecision(9))
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

async function exists(path) {
  try { await access(path); return true } catch { return false }
}

function safeOutput(out) {
  const tmp = resolve(VIEWER_ROOT, 'tmp')
  const target = resolve(out)
  assert.ok(target.startsWith(`${tmp}${sep}`) && target !== tmp, 'output must stay below building-viewer/tmp')
}

function normalizedValue(accessor, index) {
  const value = accessor.getArray()[index]
  if (!accessor.getNormalized()) return value
  const type = accessor.getComponentType()
  if (type === 5120) return Math.max(-1, value / 127)
  if (type === 5121) return value / 255
  if (type === 5122) return Math.max(-1, value / 32767)
  if (type === 5123) return value / 65535
  return value
}

function instanceMatrices(node) {
  const extension = node.getExtension('EXT_mesh_gpu_instancing')
  assert.ok(extension, `${node.getName()} lacks EXT_mesh_gpu_instancing`)
  const translation = extension.getAttribute('TRANSLATION')
  const rotation = extension.getAttribute('ROTATION')
  const scale = extension.getAttribute('SCALE')
  const count = translation?.getCount() ?? rotation?.getCount() ?? scale?.getCount() ?? 0
  assert.ok(count > 0, `${node.getName()} has no instances`)
  return Array.from({ length: count }, (_, index) => {
    const t = new Vector3(
      translation ? normalizedValue(translation, index * 3) : 0,
      translation ? normalizedValue(translation, index * 3 + 1) : 0,
      translation ? normalizedValue(translation, index * 3 + 2) : 0,
    )
    const q = new Quaternion(
      rotation ? normalizedValue(rotation, index * 4) : 0,
      rotation ? normalizedValue(rotation, index * 4 + 1) : 0,
      rotation ? normalizedValue(rotation, index * 4 + 2) : 0,
      rotation ? normalizedValue(rotation, index * 4 + 3) : 1,
    ).normalize()
    const s = new Vector3(
      scale ? normalizedValue(scale, index * 3) : 1,
      scale ? normalizedValue(scale, index * 3 + 1) : 1,
      scale ? normalizedValue(scale, index * 3 + 2) : 1,
    )
    return new Matrix4().compose(t, q, s)
  })
}

function matrixRecords(document, pkg) {
  const nodes = document.getRoot().listNodes()
    .filter((node) => node.getExtras()?.prepartitionedRepeatBatch === true)
    .sort((left, right) => left.getExtras().materialSlot - right.getExtras().materialSlot)
  assert.equal(nodes.length, MATERIAL_SLOTS, `${pkg.id}: expected four batch nodes`)
  assert.deepEqual(nodes.map((node) => node.getExtras().materialSlot), [0, 1, 2, 3])
  const records = []
  for (const node of nodes) {
    const extras = node.getExtras()
    assert.equal(extras.spatialPayloadId, pkg.id)
    assert.deepEqual(extras.sourceIds, pkg.sourceIds)
    assert.equal(extras.instanceParity, pkg.parity)
    const matrices = instanceMatrices(node)
    assert.equal(matrices.length, pkg.sourceIds.length)
    const world = new Matrix4().fromArray(node.getWorldMatrix())
    for (let index = 0; index < matrices.length; index += 1) {
      const matrix = new Matrix4().multiplyMatrices(world, matrices[index])
      assert.ok(matrix.elements.every(Number.isFinite), `${pkg.id}: non-finite instance matrix`)
      assert.ok(matrices[index].determinant() > 0, `${pkg.id}: unsafe local instance determinant`)
      records.push({
        sourceId: pkg.sourceIds[index],
        materialSlot: extras.materialSlot,
        matrix: matrix.toArray().map(canonicalNumber),
      })
    }
  }
  const roots = document.getRoot().listNodes().filter((node) => Array.isArray(node.getExtras()?.iomPackageSourcePaths))
  assert.equal(roots.length, 1, `${pkg.id}: ownership root missing`)
  assert.deepEqual(roots[0].getExtras().iomPackageSourceIds, pkg.sourceIds)
  assert.deepEqual(roots[0].getExtras().iomPackageSourcePaths, pkg.sourcePaths)
  return records.sort((left, right) => left.sourceId - right.sourceId || left.materialSlot - right.materialSlot)
}

async function auditImmutableV2(io, index, indexDir) {
  const ownershipRows = index.packages.flatMap((pkg) => pkg.sourceIds.map((sourceId, position) => ({
    sourceId,
    sourcePath: pkg.sourcePaths[position],
  }))).sort((left, right) => left.sourceId - right.sourceId)
  assert.deepEqual(ownershipRows.map((row) => row.sourceId), Array.from({ length: LOGICAL_INSTANCES }, (_, value) => value),
    'physical package ownership is not an exact 0..77 source-ID bijection')
  const observedSourceIdsSha256 = sha256(Buffer.from(stableStringify(ownershipRows.map((row) => row.sourceId))))
  const observedSourcePathsSha256 = sha256(Buffer.from(stableStringify(ownershipRows.map((row) => row.sourcePath))))
  assert.equal(observedSourceIdsSha256, SOURCE_IDS_SHA256, 'independently recomputed source ID digest changed')
  assert.equal(observedSourcePathsSha256, SOURCE_PATHS_SHA256, 'independently recomputed source path digest changed')
  const allAssets = []
  for (const pkg of index.packages) for (const variant of ['web', 'quest']) {
    for (const [level, payload] of Object.entries(pkg.variants[variant].levels)) {
      const file = resolve(indexDir, payload.asset.path)
      const bytes = await readFile(file)
      assert.equal(bytes.length, payload.asset.bytes, `${pkg.id}:${variant}:${level} byte pin changed`)
      assert.equal(sha256(bytes), payload.asset.sha256, `${pkg.id}:${variant}:${level} SHA-256 changed`)
      allAssets.push({ id: pkg.id, variant, level, path: payload.asset.path, bytes: bytes.length, sha256: payload.asset.sha256 })
    }
  }

  const lod0 = { web: [], quest: [] }
  let crossVariantMatrixCorrespondence = true
  for (const pkg of index.packages) {
    const matrices = {}
    for (const variant of ['web', 'quest']) {
      const asset = pkg.variants[variant].levels.lod0.asset
      const document = await io.read(resolve(indexDir, asset.path))
      matrices[variant] = matrixRecords(document, pkg)
      lod0[variant].push({
        id: pkg.id,
        asset,
        sourceIds: pkg.sourceIds,
        sourcePaths: pkg.sourcePaths,
        matrixDigestSha256: sha256(Buffer.from(stableStringify(matrices[variant]))),
      })
    }
    if (stableStringify(matrices.web) !== stableStringify(matrices.quest)) crossVariantMatrixCorrespondence = false
  }
  assert.equal(crossVariantMatrixCorrespondence, true, 'Web/Quest LOD0 instance matrices differ')
  const reviewerPinsets = {}
  for (const variant of ['web', 'quest']) {
    const rows = index.packages.map((pkg) => {
      const asset = pkg.variants[variant].levels.lod0.asset
      return { id: pkg.id, sourceIds: pkg.sourceIds, path: asset.path, bytes: asset.bytes, sha256: asset.sha256 }
    })
    const serialized = JSON.stringify(rows)
    const digestSha256 = sha256(Buffer.from(serialized))
    assert.equal(Buffer.byteLength(serialized), REVIEWER_PINSET_LENGTHS[variant], `${variant}: reviewer pinset length changed`)
    assert.equal(digestSha256, REVIEWER_LOD0_PINSETS[`${variant}Lod0`], `${variant}: reviewer LOD0 pinset changed`)
    reviewerPinsets[variant] = { serialization: 'ordinary compact JSON.stringify; object insertion order id,sourceIds,path,bytes,sha256',
      serializedBytes: Buffer.byteLength(serialized), digestSha256, enforced: true }
  }
  const algorithm = 'sha256(stable-json(sorted[{id,asset:{path,bytes,sha256},sourceIds,sourcePaths,matrixDigestSha256}]))'
  return {
    allIndividualAssetPinsPassed: true,
    physicalAssetCount: allAssets.length,
    allAssetPinsetDigestSha256: sha256(Buffer.from(stableStringify(allAssets))),
    lod0PinsetAlgorithm: algorithm,
    lod0Pinsets: Object.fromEntries(['web', 'quest'].map((variant) => [variant, {
      packageCount: lod0[variant].length,
      digestSha256: sha256(Buffer.from(stableStringify(lod0[variant]))),
    }])),
    sourceIdsSha256: observedSourceIdsSha256,
    sourcePathsSha256: observedSourcePathsSha256,
    ownershipDigestsIndependentlyRecomputed: true,
    crossVariantMatrixCorrespondence,
    reviewerSuppliedLod0Pinsets: reviewerPinsets,
  }
}

function auditProxy(document) {
  assert.equal(document.getRoot().listAnimations().length, 0, 'proxy contains animation')
  assert.equal(document.getRoot().listCameras().length, 0, 'proxy contains camera')
  assert.equal(document.getRoot().listNodes().filter((node) => node.getExtension('KHR_lights_punctual')).length, 0,
    'proxy contains punctual light')
  assert.equal(document.getRoot().listTextures().length, 0, 'proxy unexpectedly embeds textures')
  const meshes = document.getRoot().listMeshes()
  assert.equal(meshes.length, 1, 'proxy must contain one shared row mesh')
  const primitives = meshes[0].listPrimitives()
  assert.equal(primitives.length, MATERIAL_SLOTS, 'proxy must retain four material primitives')
  const rows = []
  for (let slot = 0; slot < primitives.length; slot += 1) {
    const primitive = primitives[slot]
    assert.equal(primitive.getMode(), 4, `slot ${slot}: primitive is not TRIANGLES`)
    assert.equal(primitive.getMaterial()?.getName(), EXPECTED_MATERIALS[slot], `slot ${slot}: material role changed`)
    const position = primitive.getAttribute('POSITION')
    const normal = primitive.getAttribute('NORMAL')
    const indices = primitive.getIndices()
    assert.ok(position && normal && indices, `slot ${slot}: POSITION/NORMAL/indices required`)
    assert.ok([...position.getArray(), ...normal.getArray()].every(Number.isFinite), `slot ${slot}: non-finite vertex data`)
    const indexValues = indices.getArray()
    assert.ok([...indexValues].every((value) => Number.isInteger(value) && value >= 0 && value < position.getCount()),
      `slot ${slot}: out-of-range index`)
    let repeatedIndexTriangles = 0
    let zeroAreaTriangles = 0
    const edges = new Map()
    const parents = Array.from({ length: position.getCount() }, (_, value) => value)
    const used = new Set()
    const find = (value) => {
      while (parents[value] !== value) { parents[value] = parents[parents[value]]; value = parents[value] }
      return value
    }
    const union = (left, right) => {
      const a = find(left); const b = find(right)
      if (a !== b) parents[b] = a
    }
    const positions = position.getArray()
    for (let offset = 0; offset < indexValues.length; offset += 3) {
      const a = indexValues[offset]; const b = indexValues[offset + 1]; const c = indexValues[offset + 2]
      if (new Set([a, b, c]).size < 3) repeatedIndexTriangles += 1
      used.add(a); used.add(b); used.add(c); union(a, b); union(b, c)
      for (const [left, right] of [[a, b], [b, c], [c, a]]) {
        const key = left < right ? `${left}:${right}` : `${right}:${left}`
        edges.set(key, (edges.get(key) ?? 0) + 1)
      }
      const abx = positions[b * 3] - positions[a * 3]
      const aby = positions[b * 3 + 1] - positions[a * 3 + 1]
      const abz = positions[b * 3 + 2] - positions[a * 3 + 2]
      const acx = positions[c * 3] - positions[a * 3]
      const acy = positions[c * 3 + 1] - positions[a * 3 + 1]
      const acz = positions[c * 3 + 2] - positions[a * 3 + 2]
      const crossX = aby * acz - abz * acy
      const crossY = abz * acx - abx * acz
      const crossZ = abx * acy - aby * acx
      if (crossX * crossX + crossY * crossY + crossZ * crossZ <= 1e-18) zeroAreaTriangles += 1
    }
    assert.equal(repeatedIndexTriangles, 0, `slot ${slot}: repeated-index triangle found`)
    assert.equal(zeroAreaTriangles, 0, `slot ${slot}: zero-area triangle found`)
    rows.push({
      slot,
      material: EXPECTED_MATERIALS[slot],
      triangles: triangleCount(primitive),
      vertices: position.getCount(),
      semantics: primitive.listSemantics().sort(),
      repeatedIndexTriangles,
      zeroAreaTriangles,
      connectedComponents: new Set([...used].map(find)).size,
      boundaryEdges: [...edges.values()].filter((count) => count === 1).length,
      nonManifoldEdges: [...edges.values()].filter((count) => count > 2).length,
    })
  }
  const triangles = rows.reduce((sum, row) => sum + row.triangles, 0)
  assert.ok(triangles > 0 && triangles <= MAX_PROXY_TRIANGLES, `proxy triangle ceiling failed: ${triangles}`)
  assert.ok(rows.every((row) => row.triangles > 0), 'proxy lost a material role')
  return { triangles, trianglesByMaterial: rows.map((row) => row.triangles), rows }
}

function expandedBounds(bounds, margin) {
  return { min: bounds.min.map((value) => value - margin), max: bounds.max.map((value) => value + margin) }
}

function sweepEvents(items, axis) {
  const events = new Map()
  for (const item of items) for (const [coordinate, kind] of [[item.bounds.min[axis], 'starts'], [item.bounds.max[axis], 'ends']]) {
    const event = events.get(coordinate) ?? { coordinate, starts: [], ends: [] }
    event[kind].push(item)
    events.set(coordinate, event)
  }
  return [...events.values()].sort((left, right) => left.coordinate - right.coordinate)
}

function exactTriangleSweep({ packages, variant, lod0Margin, hlodMargin = null, transition = false, policy }) {
  const items = []
  for (const pkg of packages) {
    const record = pkg.variants[variant]
    items.push({ packageId: pkg.id, kind: 'base', level: 'lod0', sourceCount: pkg.sourceIds.length,
      bounds: expandedBounds(record.selectionBounds, lod0Margin), triangles: record.levels.lod0.estimates.triangles })
    if (hlodMargin !== null && record.levels.hlod) items.push({ packageId: pkg.id, kind: 'base', level: 'hlod', sourceCount: pkg.sourceIds.length,
      bounds: expandedBounds(record.selectionBounds, hlodMargin), triangles: record.levels.hlod.estimates.triangles })
    if (transition && record.levels.hlod) items.push({ packageId: pkg.id, kind: 'transition', level: 'hlod', sourceCount: pkg.sourceIds.length,
      bounds: expandedBounds(record.selectionBounds, policy.marginsMeters.lod0Entry), triangles: record.levels.hlod.estimates.triangles })
  }
  let worst = null
  let focusCount = 0
  const evaluate = (active, focus) => {
    focusCount += 1
    const selected = new Map()
    const transitions = []
    for (const item of active) {
      if (item.kind === 'transition') { transitions.push(item); continue }
      const previous = selected.get(item.packageId)
      if (!previous || item.level === 'lod0') selected.set(item.packageId, item)
    }
    const chosen = [...selected.values()]
    const baseTriangles = chosen.reduce((sum, item) => sum + item.triangles, 0)
    const extra = transitions.sort((left, right) => right.triangles - left.triangles || left.packageId.localeCompare(right.packageId))[0] ?? null
    const triangles = baseTriangles + (extra?.triangles ?? 0)
    if (!worst || triangles > worst.triangles) {
      worst = {
        focus: [...focus], triangles,
        immutableLod0Triangles: chosen.filter((item) => item.level === 'lod0').reduce((sum, item) => sum + item.triangles, 0),
        hlodTriangles: chosen.filter((item) => item.level === 'hlod').reduce((sum, item) => sum + item.triangles, 0),
        lod0LogicalInstances: chosen.filter((item) => item.level === 'lod0').reduce((sum, item) => sum + item.sourceCount, 0),
        hlodLogicalInstances: chosen.filter((item) => item.level === 'hlod').reduce((sum, item) => sum + item.sourceCount, 0),
        packages: chosen.sort((left, right) => left.packageId.localeCompare(right.packageId)).map((item) => `${item.packageId}:${item.level}`),
        transitionPackageId: extra?.packageId ?? null,
        transitionTriangles: extra?.triangles ?? 0,
      }
    }
  }
  const scanZ = (candidates, x, y) => {
    const active = new Set()
    for (const event of sweepEvents(candidates, 2)) {
      for (const item of event.starts) active.add(item)
      evaluate(active, [x, y, event.coordinate])
      for (const item of event.ends) active.delete(item)
    }
  }
  const scanY = (candidates, x) => {
    const active = new Set()
    for (const event of sweepEvents(candidates, 1)) {
      for (const item of event.starts) active.add(item)
      scanZ(active, x, event.coordinate)
      for (const item of event.ends) active.delete(item)
    }
  }
  const active = new Set()
  let xEvents = 0
  for (const event of sweepEvents(items, 0)) {
    for (const item of event.starts) active.add(item)
    xEvents += 1
    scanY(active, event.coordinate)
    for (const item of event.ends) active.delete(item)
  }
  return { exactClosedAabbSweep: true, focusCount, xEvents, worst }
}

function analyze(packages, variant, policy) {
  const hasHlod = variant === 'web'
  const entry = exactTriangleSweep({ packages, variant, lod0Margin: policy.marginsMeters.lod0Entry,
    hlodMargin: hasHlod ? policy.marginsMeters.hlodEntry : null, policy })
  const exit = exactTriangleSweep({ packages, variant, lod0Margin: policy.marginsMeters.lod0Exit,
    hlodMargin: hasHlod ? policy.marginsMeters.hlodExit : null, policy })
  const peak = exactTriangleSweep({ packages, variant, lod0Margin: policy.marginsMeters.lod0Exit,
    hlodMargin: hasHlod ? policy.marginsMeters.hlodExit : null, transition: hasHlod, policy })
  peak.concurrencyContract = hasHlod
    ? 'conditional upper envelope with at most one concurrent same-package HLOD-to-LOD0 swap'
    : 'no HLOD transition for this variant'
  peak.maxConcurrentSamePackageSwaps = hasHlod ? 1 : 0
  peak.runtimeConcurrencyEnforcementVerified = false
  const reservation = RESERVATION[variant]
  const residentLimit = policy.hardBudgets.resident[variant].triangles - reservation.residentTriangles
  const peakLimit = policy.hardBudgets.transitionPeak[variant].triangles - reservation.transitionPeakTriangles
  return {
    entry,
    exitUpperEnvelope: exit,
    loadBeforeRetirePeak: peak,
    reservation: { residentTriangles: reservation.residentTriangles, transitionPeakTriangles: reservation.transitionPeakTriangles,
      residentLimit, transitionPeakLimit: peakLimit,
      residentPassed: exit.worst.triangles <= residentLimit,
      transitionPeakPassed: peak.worst.triangles <= peakLimit },
  }
}

function plannedPackages(v2, proxyTriangles) {
  const packages = structuredClone(v2.packages)
  for (const pkg of packages) {
    const payload = pkg.variants.web.levels.hlod
    payload.sourceLevel = 'cluster-hlod-v3-planning-proxy'
    payload.role = 'far-web-disabled-planning-only'
    payload.estimates.triangles = proxyTriangles * pkg.sourceIds.length
    payload.audit.triangles = payload.estimates.triangles
    delete payload.asset
    payload.physicalAssemblyComplete = false
  }
  return packages
}

async function visualRecord(path, out) {
  const evidencePath = relative(out, path).replaceAll('\\', '/')
  if (!await exists(path)) return { present: false, automatedPassed: false, status: 'missing', path: evidencePath }
  const bytes = await readFile(path)
  const value = JSON.parse(bytes)
  assert.equal(value.schema, 'IOM_GROUND_REPEAT_CLUSTER_HLOD_VISUAL_AUDIT_V3', 'visual audit schema changed')
  assert.equal(value.version, 3, 'visual audit version changed')
  assert.equal(value.enabled, false, 'visual audit must remain disabled')
  assert.equal(value.ready, false, 'visual audit must remain not ready')
  assert.equal(value.runtimeIntegrated, false, 'visual audit must remain unintegrated')
  assert.equal(value.activationApproved, false, 'visual audit must not approve activation')
  const failures = value.failures ?? []
  return {
    present: true,
    path: evidencePath,
    bytes: bytes.length,
    sha256: sha256(bytes),
    schema: value.schema,
    status: value.status,
    automatedPassed: value.automatedPassed === true,
    diagnosticOnly: value.activationUse === 'diagnostic-only',
    exactSelectorWitnessRendered: value.exactSelectorWitnessRendered === true,
    dccReportSha256: value.dccReport?.sha256 ?? null,
    compositionReportSha256: value.compositionReport?.sha256 ?? null,
    failureCount: failures.length,
    failures,
  }
}

export function validateRepeatSpatialV3Index(index) {
  const errors = []
  const gate = (condition, message) => { if (!condition) errors.push(message) }
  gate(index?.schema === 'IOM_GROUND_REPEAT_SPATIAL_PLANNING_INDEX_V3' && index?.version === 3, 'schema/version mismatch')
  gate(index?.enabled === false && index?.ready === false && index?.runtimeIntegrated === false && index?.activationApproved === false,
    'candidate must remain disabled')
  gate(index?.productionManifestChanged === false && index?.productionRoutingChanged === false, 'production mutation flags changed')
  gate(index?.immutableV2?.allIndividualAssetPinsPassed === true, 'immutable v2 physical pins failed')
  gate(index?.immutableV2?.sourceIdsSha256 === SOURCE_IDS_SHA256, 'source ID pin changed')
  gate(index?.immutableV2?.sourcePathsSha256 === SOURCE_PATHS_SHA256, 'source path pin changed')
  gate(index?.immutableV2?.crossVariantMatrixCorrespondence === true, 'Web/Quest matrix correspondence failed')
  gate(index?.proxy?.triangles > 0 && index.proxy.triangles <= MAX_PROXY_TRIANGLES, 'proxy triangle ceiling failed')
  gate(index?.proxy?.trianglesByMaterial?.length === 4 && index.proxy.trianglesByMaterial.every((value) => value > 0), 'material role lost')
  gate(index?.sweeps?.web?.exitUpperEnvelope?.exactClosedAabbSweep === true, 'Web exact exit sweep missing')
  gate(index?.sweeps?.web?.reservation?.residentPassed === true, 'Web 500k resident reservation failed')
  gate(index?.sweeps?.web?.reservation?.transitionPeakPassed === true, 'Web 500k transition reservation failed')
  gate(index?.negativeMutation?.trianglesPerSource === NEGATIVE_TRIANGLES_PER_SOURCE, 'negative mutation changed')
  gate(index?.negativeMutation?.exitTriangles === EXPECTED_NEGATIVE_EXIT, '3k/source negative witness drifted')
  gate(index?.negativeMutation?.reservationPassed === false, 'negative mutation did not fail closed')
  gate(index?.gates?.physicalV3PackageAssembly === false && index?.gates?.mixedSceneBrowserQa === false,
    'unfinished physical/browser gates must remain false')
  gate(index?.gates?.activationApproved === false, 'activation must remain blocked')
  return errors
}

function markdown(index) {
  return `# Ground Floor repeat spatial v3 planning audit\n\n` +
    `Status: **${index.status}**. This is a disabled planning/evidence artifact; no v3 physical packages or runtime route were emitted.\n\n` +
    `The physical proxy contains ${index.proxy.triangles.toLocaleString('en-US')} triangles per logical row across four material roles. ` +
    `The exact closed-AABB sweep covers all ${index.packageCount} floor/parity-aware packages at every event coordinate. ` +
    `Web exit is ${index.sweeps.web.exitUpperEnvelope.worst.triangles.toLocaleString('en-US')} triangles and load-before-retire peak is ` +
    `${index.sweeps.web.loadBeforeRetirePeak.worst.triangles.toLocaleString('en-US')}; both preserve the required 500,000-triangle reservation.\n\n` +
    `The 3,000-triangle/source negative mutation reaches exactly ${index.negativeMutation.exitTriangles.toLocaleString('en-US')} triangles and fails the resident reservation, proving the gate rejects an over-budget proxy.\n\n` +
    `Auto-framed aggregate visual diagnostic: **${index.visual.automatedPassed ? 'pass' : 'blocked/not present'}**. This is not the exact selector-witness release gate. Remaining: semantic proxy authoring, physical v3 package assembly, emitted-bounds re-sweep, exact-witness mixed-scene visual parity, rapid-threshold focus churn, and browser/hardware QA. Production remains unchanged.\n`
}

async function main() {
  const args = parseArgs(process.argv)
  safeOutput(args.out)
  const [v2Bytes, proxyBytes, proxyReportBytes] = await Promise.all([
    readFile(args.v2), readFile(args.proxy), readFile(args.proxyReport),
  ])
  const v2 = JSON.parse(v2Bytes)
  const proxyReport = JSON.parse(proxyReportBytes)
  assert.equal(v2Bytes.length, EXPECTED_V2_INDEX_BYTES, 'spatial-v2 index byte pin changed')
  assert.equal(sha256(v2Bytes), EXPECTED_V2_INDEX_SHA256, 'spatial-v2 index SHA-256 pin changed')
  assert.deepEqual(validateRepeatSpatialV2Index(v2), [], 'v2 index contract is no longer valid')
  assert.equal(v2.ownership.sourceIdsSha256, SOURCE_IDS_SHA256)
  assert.equal(v2.ownership.sourcePathsSha256, SOURCE_PATHS_SHA256)
  const io = await createGltfIO({ encoder: true })
  const proxyDocument = await io.read(args.proxy)
  const proxyAudit = auditProxy(proxyDocument)
  assert.equal(proxyReport.schema, 'IOM_BLENDER_GROUND_REPEAT_CLUSTER_HLOD_V3')
  assert.equal(proxyReport.input.bytes, EXPECTED_DCC_SOURCE_BYTES, 'DCC source byte pin changed')
  assert.equal(proxyReport.input.sha256, EXPECTED_DCC_SOURCE_SHA256, 'DCC source SHA-256 pin changed')
  assert.equal(proxyReport.output.sha256, sha256(proxyBytes), 'proxy report SHA-256 mismatch')
  assert.equal(proxyReport.output.bytes, proxyBytes.length, 'proxy report byte pin mismatch')
  assert.equal(proxyReport.trianglesAfter, proxyAudit.triangles, 'proxy report triangle count mismatch')
  assert.deepEqual(proxyReport.trianglesByMaterialAfter, proxyAudit.trianglesByMaterial)

  const indexDir = dirname(args.v2)
  const immutableV2 = await auditImmutableV2(io, v2, indexDir)
  const packages = plannedPackages(v2, proxyAudit.triangles)
  const sweeps = Object.fromEntries(['web', 'quest'].map((variant) => [variant, analyze(packages, variant, v2.policy)]))
  const negativePackages = plannedPackages(v2, NEGATIVE_TRIANGLES_PER_SOURCE)
  const negative = analyze(negativePackages, 'web', v2.policy)
  assert.equal(negative.exitUpperEnvelope.worst.triangles, EXPECTED_NEGATIVE_EXIT,
    '3,000/source negative mutation no longer yields the pinned exact failure')
  assert.equal(negative.reservation.residentPassed, false)
  const visual = await visualRecord(args.visual, args.out)
  if (visual.present) assert.equal(visual.dccReportSha256, sha256(proxyReportBytes),
    'visual audit does not pin the selected proxy DCC report')

  const index = {
    schema: 'IOM_GROUND_REPEAT_SPATIAL_PLANNING_INDEX_V3',
    version: 3,
    status: visual.automatedPassed
      ? 'reservation-pass-aggregate-diagnostic-pass-physical-assembly-required'
      : 'reservation-pass-visual-blocked-physical-assembly-required',
    enabled: false,
    ready: false,
    runtimeIntegrated: false,
    activationApproved: false,
    productionManifestChanged: false,
    productionRoutingChanged: false,
    modelId: v2.modelId,
    owner: v2.owner,
    sourceV2: { path: relative(args.out, args.v2).replaceAll('\\', '/'), bytes: v2Bytes.length, sha256: sha256(v2Bytes), schema: v2.schema, version: v2.version },
    immutableV2,
    proxy: {
      asset: { path: relative(args.out, args.proxy).replaceAll('\\', '/'), bytes: proxyBytes.length, sha256: sha256(proxyBytes) },
      report: { path: relative(args.out, args.proxyReport).replaceAll('\\', '/'), bytes: proxyReportBytes.length, sha256: sha256(proxyReportBytes) },
      maxTriangles: MAX_PROXY_TRIANGLES,
      ...proxyAudit,
      webOnly: true,
      questChanged: false,
    },
    packageCount: packages.length,
    ownership: v2.ownership,
    policy: v2.policy,
    planningContract: {
      selectionBounds: 'immutable spatial-v2 union bounds; physical v3 assembly must recompute and re-sweep exact emitted bounds',
      lod0: 'immutable physical v2 Web/Quest packages with every byte and SHA-256 reverified',
      webHlod: 'proxy triangle count multiplied by exact per-package logical source count',
      questHlod: 'excluded; Quest remains exact LOD0',
      transitionPeak: 'conditional on at most one concurrent same-package HLOD-to-LOD0 swap; runtime enforcement remains unverified',
    },
    sweeps,
    negativeMutation: {
      trianglesPerSource: NEGATIVE_TRIANGLES_PER_SOURCE,
      exactClosedAabbSweep: true,
      exitTriangles: negative.exitUpperEnvelope.worst.triangles,
      exitWitness: negative.exitUpperEnvelope.worst,
      residentLimit: negative.reservation.residentLimit,
      reservationPassed: negative.reservation.residentPassed,
    },
    visual,
    gates: {
      failClosed: true,
      immutableV2PhysicalPins: true,
      exactLogicalIdentityAndMatrices: immutableV2.crossVariantMatrixCorrespondence,
      physicalProxyPostExportAudit: true,
      proxyTriangleCeiling: proxyAudit.triangles <= MAX_PROXY_TRIANGLES,
      exactAllPackageSweep: true,
      planningReservationHeadroom: Object.values(sweeps).every((entry) => entry.reservation.residentPassed && entry.reservation.transitionPeakPassed),
      negativeMutationRejected: negative.reservation.residentPassed === false,
      aggregateVisualDiagnostic: visual.automatedPassed,
      composedVisualQa: false,
      exactSelectorWitnessVisualQa: false,
      physicalV3PackageAssembly: false,
      exactEmittedBoundsResweep: false,
      mixedSceneBrowserQa: false,
      focusChurnQa: false,
      productionUnchanged: true,
      activationApproved: false,
    },
    blockers: [
      visual.automatedPassed ? null : 'The strict composed seven-view proxy comparison is not passed.',
      'The aggregate visual diagnostic is auto-framed and cannot approve exact selector-witness or switch-distance quality.',
      'Physical Web v3 HLOD packages have not been assembled; current v3 sweep is planning evidence over immutable v2 selection envelopes.',
      'Exact post-assembly bounds must be re-swept before integration.',
      'The conditional transition peak assumes at most one concurrent same-package swap; runtime enforcement remains required.',
      'Mixed-scene browser/hardware and rapid-threshold focus-churn QA remain required.',
      'The candidate is not wired to production runtime routing.',
    ].filter(Boolean),
  }
  index.reproducibilityDigestSha256 = sha256(Buffer.from(stableStringify({
    sourceV2: index.sourceV2,
    immutableV2: index.immutableV2,
    proxy: index.proxy,
    ownership: index.ownership,
    policy: index.policy,
    sweeps: index.sweeps,
    negativeMutation: index.negativeMutation,
    visual: index.visual,
    gates: index.gates,
    blockers: index.blockers,
  })))
  const errors = validateRepeatSpatialV3Index(index)
  assert.deepEqual(errors, [], errors.join('\n'))
  await mkdir(args.out, { recursive: true })
  const indexText = `${JSON.stringify(index, null, 2)}\n`
  const physicalAudit = {
    schema: 'IOM_GROUND_REPEAT_SPATIAL_PHYSICAL_AUDIT_V3', version: 3,
    status: 'PASS-PLANNING-ONLY', ready: false, activationApproved: false,
    index: { path: 'index.json', bytes: Buffer.byteLength(indexText), sha256: sha256(Buffer.from(indexText)) },
    immutableV2: index.immutableV2, proxy: index.proxy, sweeps: index.sweeps,
    negativeMutation: index.negativeMutation, gates: index.gates, blockers: index.blockers,
  }
  await Promise.all([
    writeFile(resolve(args.out, 'index.json'), indexText),
    writeFile(resolve(args.out, 'physical-audit.json'), `${JSON.stringify(physicalAudit, null, 2)}\n`),
    writeFile(resolve(args.out, 'README.md'), markdown(index)),
  ])
  console.log(`Ground repeat spatial v3: ${index.status.toUpperCase()}`)
  console.log(`  proxy=${proxyAudit.triangles}; Web exit=${sweeps.web.exitUpperEnvelope.worst.triangles}; peak=${sweeps.web.loadBeforeRetirePeak.worst.triangles}`)
  console.log(`  negative 3000/source exit=${index.negativeMutation.exitTriangles}; physical assembly=false; production unchanged`)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main().catch((error) => {
  console.error(error?.stack || error)
  process.exitCode = 1
})
