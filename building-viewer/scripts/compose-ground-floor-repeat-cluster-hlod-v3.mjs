#!/usr/bin/env node

/**
 * Compose the disabled Web cluster-HLOD geometry into the exact 78-instance
 * repeat staging payload used by the pinned seven-view renderer. Materials,
 * instance transforms, parity, source IDs, and ownership extras come from the
 * immutable LOD0 baseline; only indexed POSITION/NORMAL proxy geometry changes.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGltfIO } from './lib/gltf-io.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const EXPECTED_MATERIALS = [
  'vray Stuhl_Plastik',
  'vray Stuhl_Plakete',
  'vray Stuhl_Metall',
  'vray Stuhl_Bezug',
]
const EXPECTED_BASELINE_BYTES = 1_584_120
const EXPECTED_BASELINE_SHA256 = '51e8fa224989ba32a0fea708ded888fc395b6ac155254398f5739021362d5c41'
const LOGICAL_INSTANCES = 78
const MATERIAL_SLOTS = 4
const EXPECTED_BATCH_NODES = 52
const EXPECTED_IDENTITY_GROUPS = 13
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, stableValue(child)]))
  if (typeof value === 'number' && Object.is(value, -0)) return 0
  return value
}

const stableStringify = (value) => JSON.stringify(stableValue(value))

function parseArgs(argv) {
  const args = {
    baseline: resolve(VIEWER_ROOT, 'tmp/repeat-geometry-release-candidate/payloads/web/ground-floor-repeat-lod0.glb'),
    proxy: resolve(VIEWER_ROOT, 'tmp/repeat-cluster-hlod-v3/dcc/web-row-cluster-hlod-v3.glb'),
    output: resolve(VIEWER_ROOT, 'tmp/repeat-cluster-hlod-v3/visual-input/web-full-repeat-cluster-hlod-v3.glb'),
    report: resolve(VIEWER_ROOT, 'tmp/repeat-cluster-hlod-v3/visual-input/composition-report.json'),
  }
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--baseline') args.baseline = resolve(argv[++index])
    else if (value === '--proxy') args.proxy = resolve(argv[++index])
    else if (value === '--output') args.output = resolve(argv[++index])
    else if (value === '--report') args.report = resolve(argv[++index])
    else throw new Error(`Unknown argument: ${value}`)
  }
  return args
}

function cloneAccessor(document, source, name) {
  const SourceArray = source.getArray().constructor
  return document.createAccessor(name)
    .setType(source.getType())
    .setNormalized(source.getNormalized())
    .setArray(new SourceArray(source.getArray()))
}

function accessorRecord(accessor) {
  if (!accessor) return null
  return {
    type: accessor.getType(),
    componentType: accessor.getComponentType(),
    normalized: accessor.getNormalized(),
    values: Array.from(accessor.getArray()),
  }
}

function auditOwnership(document) {
  const nodes = document.getRoot().listNodes()
    .filter((node) => node.getExtras()?.prepartitionedRepeatBatch === true)
    .sort((left, right) => left.getName().localeCompare(right.getName()))
  assert.equal(nodes.length, EXPECTED_BATCH_NODES, 'baseline batch-node count changed')
  const perSlot = Array.from({ length: MATERIAL_SLOTS }, () => [])
  const groups = new Map()
  const transformRecords = []
  for (const node of nodes) {
    const extras = node.getExtras()
    const slot = extras.materialSlot
    assert.ok(Number.isInteger(slot) && slot >= 0 && slot < MATERIAL_SLOTS, `${node.getName()}: invalid material slot`)
    assert.ok(Array.isArray(extras.sourceIds) && extras.sourceIds.length > 0, `${node.getName()}: source IDs missing`)
    const extension = node.getExtension('EXT_mesh_gpu_instancing')
    assert.ok(extension, `${node.getName()}: instancing extension missing`)
    const count = ['TRANSLATION', 'ROTATION', 'SCALE']
      .map((semantic) => extension.getAttribute(semantic)?.getCount() ?? 0)
      .find((value) => value > 0) ?? 0
    assert.equal(count, extras.sourceIds.length, `${node.getName()}: instance/source-ID count changed`)
    perSlot[slot].push(...extras.sourceIds)
    const groupId = extras.instanceIdentityGroup ?? `${extras.instanceParity}:${extras.spatialPartition}`
    const group = groups.get(groupId) ?? []
    group.push({ slot, parity: extras.instanceParity, sourceIds: extras.sourceIds })
    groups.set(groupId, group)
    transformRecords.push({
      name: node.getName(),
      materialSlot: slot,
      parity: extras.instanceParity,
      spatialPartition: extras.spatialPartition,
      sourceIds: extras.sourceIds,
      nodeMatrix: node.getMatrix(),
      translation: accessorRecord(extension.getAttribute('TRANSLATION')),
      rotation: accessorRecord(extension.getAttribute('ROTATION')),
      scale: accessorRecord(extension.getAttribute('SCALE')),
      sourceIdAttribute: accessorRecord(extension.getAttribute('_IOM_SOURCE_ID')),
    })
  }
  const expectedIds = Array.from({ length: LOGICAL_INSTANCES }, (_, index) => index)
  for (let slot = 0; slot < MATERIAL_SLOTS; slot += 1) {
    assert.deepEqual(perSlot[slot].sort((left, right) => left - right), expectedIds,
      `material slot ${slot}: source IDs are not an exact 0..77 bijection`)
  }
  assert.equal(groups.size, EXPECTED_IDENTITY_GROUPS, 'identity-group count changed')
  for (const [groupId, members] of groups) {
    assert.deepEqual(members.map((member) => member.slot).sort((left, right) => left - right), [0, 1, 2, 3],
      `${groupId}: material-slot cohort changed`)
    assert.equal(new Set(members.map((member) => member.parity)).size, 1, `${groupId}: parity cohort changed`)
    for (const member of members.slice(1)) assert.deepEqual(member.sourceIds, members[0].sourceIds,
      `${groupId}: source-ID correspondence changed`)
  }
  const ownershipRoots = document.getRoot().listNodes()
    .filter((node) => Array.isArray(node.getExtras()?.iomPackageSourcePaths))
  assert.equal(ownershipRoots.length, 1, 'baseline ownership root changed')
  const sourcePaths = ownershipRoots[0].getExtras().iomPackageSourcePaths
  assert.equal(sourcePaths.length, LOGICAL_INSTANCES, 'baseline source-path count changed')
  assert.equal(new Set(sourcePaths).size, LOGICAL_INSTANCES, 'baseline source paths are not unique')
  return {
    batchNodes: nodes.length,
    identityGroups: groups.size,
    logicalInstances: perSlot[0].length,
    primitiveInstances: perSlot.reduce((sum, ids) => sum + ids.length, 0),
    materialSlots: MATERIAL_SLOTS,
    sourceIdBijectionPassed: true,
    sourcePathCount: sourcePaths.length,
    sourcePathsUnique: true,
    parities: [...new Set(nodes.map((node) => node.getExtras().instanceParity))].sort(),
    transformAndIdentityDigestSha256: sha256(Buffer.from(stableStringify(transformRecords))),
  }
}

async function main() {
  const args = parseArgs(process.argv)
  await Promise.all([mkdir(dirname(args.output), { recursive: true }), mkdir(dirname(args.report), { recursive: true })])
  const io = await createGltfIO({ encoder: true })
  const [baseline, proxy, baselineBytes, proxyBytes] = await Promise.all([
    io.read(args.baseline), io.read(args.proxy), readFile(args.baseline), readFile(args.proxy),
  ])
  assert.equal(baselineBytes.length, EXPECTED_BASELINE_BYTES, 'baseline byte pin changed')
  assert.equal(sha256(baselineBytes), EXPECTED_BASELINE_SHA256, 'baseline SHA-256 pin changed')
  const baselineOwnership = auditOwnership(baseline)
  const proxyPrimitives = proxy.getRoot().listMeshes()[0]?.listPrimitives() ?? []
  assert.equal(proxyPrimitives.length, 4, 'proxy must contain four material primitives')
  assert.deepEqual(proxyPrimitives.map((primitive) => primitive.getMaterial()?.getName()), EXPECTED_MATERIALS)

  const touchedMeshes = new Set()
  for (const node of baseline.getRoot().listNodes()) {
    const slot = node.getExtras()?.materialSlot
    if (!Number.isInteger(slot) || touchedMeshes.has(node.getMesh())) continue
    const target = node.getMesh()?.listPrimitives()[0]
    const source = proxyPrimitives[slot]
    assert.ok(target && source, `missing primitive for material slot ${slot}`)
    const baselineMaterial = target.getMaterial()
    for (const semantic of target.listSemantics()) target.setAttribute(semantic, null)
    for (const semantic of source.listSemantics()) {
      target.setAttribute(semantic, cloneAccessor(baseline, source.getAttribute(semantic), `v3-${slot}-${semantic}`))
    }
    target.setIndices(source.getIndices() ? cloneAccessor(baseline, source.getIndices(), `v3-${slot}-indices`) : null)
    assert.equal(target.getMaterial(), baselineMaterial, `material slot ${slot} changed`)
    touchedMeshes.add(node.getMesh())
  }
  assert.equal(touchedMeshes.size, 4, 'baseline must expose four shared material-slot meshes')
  await io.write(args.output, baseline)
  const outputBytes = await readFile(args.output)
  const writtenOwnership = auditOwnership(await io.read(args.output))
  assert.deepEqual(writtenOwnership, baselineOwnership, 'composition changed ownership or instance transforms')
  const reportDir = dirname(args.report)
  const report = {
    schema: 'IOM_GROUND_REPEAT_CLUSTER_HLOD_COMPOSITION_V3',
    version: 3,
    baseline: { path: relative(reportDir, args.baseline).replaceAll('\\', '/'), bytes: baselineBytes.length, sha256: sha256(baselineBytes) },
    proxy: { path: relative(reportDir, args.proxy).replaceAll('\\', '/'), bytes: proxyBytes.length, sha256: sha256(proxyBytes) },
    output: { path: relative(reportDir, args.output).replaceAll('\\', '/'), bytes: outputBytes.length, sha256: sha256(outputBytes) },
    baselinePinVerified: true,
    ownership: writtenOwnership,
    logicalInstances: writtenOwnership.logicalInstances,
    primitiveInstances: writtenOwnership.primitiveInstances,
    touchedSharedMeshes: touchedMeshes.size,
    copiedProxyGeometryOnly: true,
    baselineMaterialsPreserved: true,
    baselineOwnershipAndTransformsPreserved: true,
    productionChanged: false,
  }
  await writeFile(args.report, `${JSON.stringify(report, null, 2)}\n`)
  await stat(args.output)
  console.log(`Ground repeat v3 visual composition: ${report.logicalInstances} logical instances / ${report.output.bytes} bytes`)
}

main().catch((error) => {
  console.error(error?.stack || error)
  process.exitCode = 1
})
