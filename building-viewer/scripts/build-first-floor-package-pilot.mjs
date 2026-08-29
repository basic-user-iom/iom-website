/**
 * Build a disabled, owner-local streaming-package pilot for 1st Floor._anim1.
 *
 * This is an offline asset artifact only. It never edits public assets or the
 * production model manifest. Detail packages are lossless with respect to the
 * selected release variant. Required shell authoring is deliberately left to
 * the DCC handoff because blind architectural decimation can recreate missing
 * faces. Per-detail HLOD is optional under the manifest-v3 runtime contract.
 *
 * Usage:
 *   node scripts/build-first-floor-package-pilot.mjs
 *   node scripts/build-first-floor-package-pilot.mjs --plan-only
 *   node scripts/build-first-floor-package-pilot.mjs --force
 *   node scripts/build-first-floor-package-pilot.mjs --partition material-aware --force
 *
 * Material-aware mode writes a separate disabled tmp pilot, uses a 96-draw
 * package ceiling by default, and never changes production assets/manifests.
 */
import { createHash } from 'node:crypto'
import { access, copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Document, ExtensionProperty, Texture } from '@gltf-transform/core'
import {
  cloneDocument,
  copyToDocument,
  createDefaultPropertyResolver,
  listTextureInfoByMaterial,
  prune,
} from '@gltf-transform/functions'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { createGltfIO } from './lib/gltf-io.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const SITE_ROOT = resolve(VIEWER_ROOT, '..')
const GLTFPACK_BINARY = resolve(VIEWER_ROOT, 'tmp', 'tools', 'gltfpack-v1.2', 'gltfpack.exe')
const PACKAGE_PROFILES = {
  'first-floor': {
    slug: 'first-floor',
    title: 'First floor',
    ownerName: '1st Floor._anim1',
    ownerId: 'rig-owner:first-floor-anim1',
    criticalNames: ['Fire', 'Verbindung West002.001', 'Verbindung West.002'],
    criticalRequiredRoles: ['building-connection', 'fire-safety'],
    residentTriangleBudgets: { web: 2_000_000, quest: 800_000 },
  },
  'second-floor': {
    slug: 'second-floor',
    title: 'Second floor',
    ownerName: '2st Floor._anim1',
    ownerId: 'rig-owner:second-floor-anim1',
    criticalNames: [],
    residentTriangleBudgets: { web: 1_000_000, quest: 500_000 },
  },
  mezzanine: {
    slug: 'mezzanine',
    title: 'Mezzanine',
    ownerName: 'Mezzanine._anim1',
    ownerId: 'rig-owner:mezzanine-anim1',
    criticalNames: [],
    residentTriangleBudgets: { web: 300_000, quest: 200_000 },
  },
  ceiling: {
    slug: 'ceiling',
    title: 'Ceiling',
    ownerName: 'Ceiling._anim1',
    ownerId: 'rig-owner:ceiling-anim1',
    criticalNames: [],
    residentTriangleBudgets: { web: 250_000, quest: 200_000 },
  },
  'ground-floor': {
    slug: 'ground-floor',
    title: 'Ground floor',
    ownerName: 'Ground Floor._anim1',
    ownerId: 'rig-owner:ground-floor-anim1',
    criticalNames: [],
    criticalMaterialRolePrefix: 'fire-safety-',
    criticalGroupName: 'FireHoseOwnershipCorrected',
    criticalRequiredRoles: ['fire-safety'],
    staticOwner: true,
    allowInstancing: true,
    shellExplicitAnchorPattern: /wand holz hinten/,
    webInput: resolve(VIEWER_ROOT, 'tmp', 'fire-hose-ownership-candidate', 'model-web-fire-hose-owned.glb'),
    questInput: resolve(VIEWER_ROOT, 'tmp', 'fire-hose-ownership-candidate', 'model-quest-fire-hose-owned.glb'),
    productionInputs: {
      web: resolve(SITE_ROOT, 'public', 'models', 'icm-anim-2025', 'model-web.glb'),
      quest: resolve(SITE_ROOT, 'public', 'models', 'icm-anim-2025', 'model-quest.glb'),
    },
    preprocessingReport: resolve(VIEWER_ROOT, 'tmp', 'fire-hose-ownership-candidate', 'candidate-report.json'),
    ownershipMigration: resolve(VIEWER_ROOT, 'tmp', 'fire-hose-ownership-candidate', 'source-ownership-migration-v1.json'),
    wholeLayerContract: resolve(VIEWER_ROOT, 'tmp', 'whole-layer-ownership-v1', 'whole-layer-ownership-contract-v1.json'),
    residentTriangleBudgets: { web: 250_000, quest: 200_000 },
  },
}

function requestedProfile(argv) {
  const index = argv.indexOf('--profile')
  const id = index >= 0 ? argv[index + 1] : 'first-floor'
  const profile = PACKAGE_PROFILES[id]
  if (!profile) throw new Error(`--profile must be one of: ${Object.keys(PACKAGE_PROFILES).join(', ')}`)
  return profile
}

const PROFILE = requestedProfile(process.argv)
const DEFAULT_OUT = resolve(VIEWER_ROOT, 'tmp', `hlod-pilot-${PROFILE.slug}`)
const COALESCED_OUT = resolve(VIEWER_ROOT, 'tmp', `hlod-pilot-${PROFILE.slug}-coalesced`)
const SHELL_CANDIDATE_OUT = resolve(VIEWER_ROOT, 'tmp', `hlod-pilot-${PROFILE.slug}-shell-candidate`)
const OWNER_NAME = PROFILE.ownerName
const OWNER_ID = PROFILE.ownerId
const CRITICAL_NAMES = PROFILE.criticalNames
const CRITICAL_MATERIAL_ROLE_PREFIX = PROFILE.criticalMaterialRolePrefix || null
const CRITICAL_REQUIRED_ROLES = PROFILE.criticalRequiredRoles || []
const HAS_CRITICAL_PACKAGE = CRITICAL_NAMES.length > 0 || Boolean(CRITICAL_MATERIAL_ROLE_PREFIX)
const CRITICAL_PACKAGE_ID = `${PROFILE.slug}-critical`
const SHELL_ID = `${PROFILE.slug}-shell`
const IDENTITY_MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const REQUIRED_ATTRIBUTES = ['POSITION', 'NORMAL']

function parseArgs(argv) {
  const args = {
    webInput: PROFILE.webInput || resolve(SITE_ROOT, 'public', 'models', 'icm-anim-2025', 'model-web.glb'),
    questInput: PROFILE.questInput || resolve(SITE_ROOT, 'public', 'models', 'icm-anim-2025', 'model-quest.glb'),
    cleanedSource: resolve(VIEWER_ROOT, 'tmp', 'icm-anim-2025-cleaned.glb'),
    out: DEFAULT_OUT,
    cellSize: 24,
    maxTriangles: 235_000,
    maxDraws: 150,
    partition: 'spatial',
    partitionExplicit: false,
    maxClusterSpanCells: 2,
    maxDrawsExplicit: false,
    planOnly: false,
    force: false,
    outExplicit: false,
    shellCandidate: false,
    shellMaxTriangles: 150_000,
  }
  for (let i = 2; i < argv.length; i += 1) {
    const value = argv[i]
    if (value === '--web-input') args.webInput = resolve(argv[++i])
    else if (value === '--profile') i += 1
    else if (value === '--quest-input') args.questInput = resolve(argv[++i])
    else if (value === '--cleaned-source') args.cleanedSource = resolve(argv[++i])
    else if (value === '--out') {
      args.out = resolve(argv[++i])
      args.outExplicit = true
    }
    else if (value === '--cell-size') args.cellSize = Number(argv[++i])
    else if (value === '--max-triangles') args.maxTriangles = Number(argv[++i])
    else if (value === '--max-draws') {
      args.maxDraws = Number(argv[++i])
      args.maxDrawsExplicit = true
    }
    else if (value === '--partition') {
      args.partition = argv[++i]
      args.partitionExplicit = true
    }
    else if (value === '--max-cluster-span-cells') args.maxClusterSpanCells = Number(argv[++i])
    else if (value === '--shell-candidate') args.shellCandidate = true
    else if (value === '--shell-max-triangles') args.shellMaxTriangles = Number(argv[++i])
    else if (value === '--plan-only') args.planOnly = true
    else if (value === '--force') args.force = true
    else throw new Error(`Unknown argument: ${value}`)
  }
  if (!Number.isFinite(args.cellSize) || args.cellSize < 12 || args.cellSize > 24) {
    throw new Error('--cell-size must be between 12 and 24 metres')
  }
  if (!Number.isSafeInteger(args.maxTriangles) || args.maxTriangles < 25_000 || args.maxTriangles > 250_000) {
    throw new Error('--max-triangles must be an integer between 25,000 and 250,000')
  }
  if (!Number.isSafeInteger(args.maxDraws) || args.maxDraws < 16 || args.maxDraws > 250) {
    throw new Error('--max-draws must be an integer between 16 and 250')
  }
  if (!['spatial', 'material-aware'].includes(args.partition)) {
    throw new Error('--partition must be spatial or material-aware')
  }
  if (!Number.isSafeInteger(args.maxClusterSpanCells) || args.maxClusterSpanCells < 1 || args.maxClusterSpanCells > 3) {
    throw new Error('--max-cluster-span-cells must be an integer between 1 and 3')
  }
  if (!Number.isSafeInteger(args.shellMaxTriangles) || args.shellMaxTriangles < 25_000 || args.shellMaxTriangles > 150_000) {
    throw new Error('--shell-max-triangles must be an integer between 25,000 and 150,000')
  }
  if (args.shellCandidate && !args.partitionExplicit) args.partition = 'material-aware'
  if (args.partition === 'material-aware' && !args.maxDrawsExplicit) args.maxDraws = 96
  if (args.shellCandidate && !args.outExplicit) args.out = SHELL_CANDIDATE_OUT
  else if (args.partition === 'material-aware' && !args.outExplicit) args.out = COALESCED_OUT
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

async function groundPreprocessingEvidence(out, args) {
  if (!PROFILE.productionInputs) return null
  const [reportBytes, migrationBytes, wholeLayerBytes] = await Promise.all([
    readFile(PROFILE.preprocessingReport),
    readFile(PROFILE.ownershipMigration),
    readFile(PROFILE.wholeLayerContract),
  ])
  const report = JSON.parse(reportBytes)
  const migration = JSON.parse(migrationBytes)
  if (
    report.schema !== 'iom-ground-floor-fire-hose-ownership-candidate-v1' ||
    report.enabled !== false ||
    report.productionAssetsModified !== false ||
    report.intendedOwner !== OWNER_NAME
  ) throw new Error('Ground Floor fire-hose preprocessing report contract is invalid')
  if (
    migration.schema !== 'IOM_GROUND_FLOOR_SOURCE_OWNERSHIP_MIGRATION' ||
    migration.version !== 2 ||
    migration.enabled !== false ||
    migration.productionModified !== false ||
    migration.owner !== OWNER_NAME ||
    migration.atomicUnit !== 'mesh-primitive-instance' ||
    migration.identityPolicy !== 'pinned-active-scene-owner-relative-hierarchy-v1'
  ) throw new Error('Ground Floor ownership migration sidecar contract is invalid')
  if (migration.preprocessing?.report?.sha256 !== createHash('sha256').update(reportBytes).digest('hex')) {
    throw new Error('Ground Floor migration sidecar does not pin the current fire-hose report')
  }
  if (
    migration.preprocessing?.wholeLayerContract?.sha256 !== createHash('sha256').update(wholeLayerBytes).digest('hex') ||
    migration.preprocessing?.wholeLayerContract?.bytes !== wholeLayerBytes.length ||
    migration.preprocessing?.wholeLayerContract?.readOnlyCompatibilityPin !== true
  ) throw new Error('Ground Floor migration sidecar does not pin the unchanged whole-layer contract')
  const variants = {}
  for (const variant of ['web', 'quest']) {
    const productionPath = PROFILE.productionInputs[variant]
    const correctedPath = variant === 'web' ? args.webInput : args.questInput
    const [productionFile, correctedFile, productionSha256, correctedSha256] = await Promise.all([
      stat(productionPath),
      stat(correctedPath),
      sha256File(productionPath),
      sha256File(correctedPath),
    ])
    const reportVariant = report.variants?.[variant]
    const migrationVariant = migration.variants?.[variant]
    if (
      productionSha256 !== reportVariant?.source?.sha256 ||
      correctedSha256 !== reportVariant?.candidate?.sha256 ||
      productionSha256 !== migrationVariant?.production?.sha256 ||
      correctedSha256 !== migrationVariant?.correctedPackagingInput?.sha256
    ) throw new Error(`${variant}: production/corrected preprocessing source pins are inconsistent`)
    if (
      migrationVariant?.scope?.productionGroundOwnedMeshNodes !== 143 ||
      migrationVariant?.scope?.productionGroundOwnedAtomicUnits !== 230 ||
      migrationVariant?.scope?.migratedDetachedFireMeshNodes !== 6 ||
      migrationVariant?.scope?.migratedDetachedFireAtomicUnits !== 60 ||
      migrationVariant?.scope?.correctedGroundOwnedMeshNodes !== 149 ||
      migrationVariant?.scope?.correctedGroundOwnedAtomicUnits !== 290 ||
      migrationVariant?.scope?.nodeMappingCount !== 149 ||
      migrationVariant?.scope?.atomicMappingCount !== 290 ||
      migrationVariant?.nodeMappings?.length !== 149 ||
      migrationVariant?.atomicMappings?.length !== 290 ||
      migrationVariant?.conservation?.duplicateProductionNodeIds !== 0 ||
      migrationVariant?.conservation?.duplicateCorrectedNodeIds !== 0 ||
      migrationVariant?.conservation?.duplicateAtomicIds !== 0 ||
      migrationVariant?.conservation?.duplicateCorrectedAtomicIds !== 0 ||
      migrationVariant?.conservation?.missingCorrectedAtomicUnits !== 0 ||
      migrationVariant?.conservation?.extraCorrectedAtomicUnits !== 0 ||
      migrationVariant?.transformEvidence?.maxNodeWorldMatrixDelta !== 0 ||
      migrationVariant?.transformEvidence?.maxFireInstanceWorldMatrixDelta !== 0 ||
      migrationVariant?.transformEvidence?.maxAtomicWorldMatrixDelta !== 0 ||
      migrationVariant?.wholeLayerCompatibility?.atomicUnit !== 'mesh-primitive-instance'
    ) throw new Error(`${variant}: Ground Floor ownership migration evidence is incomplete or has transform drift`)
    variants[variant] = {
      production: {
        url: relative(out, productionPath).replaceAll('\\', '/'),
        bytes: productionFile.size,
        sha256: productionSha256,
      },
      correctedPackagingInput: {
        url: relative(out, correctedPath).replaceAll('\\', '/'),
        bytes: correctedFile.size,
        sha256: correctedSha256,
      },
      scope: migrationVariant.scope,
      conservation: migrationVariant.conservation,
      transformEvidence: migrationVariant.transformEvidence,
      wholeLayerCompatibility: migrationVariant.wholeLayerCompatibility,
      nodeMappingsSha256: migrationVariant.nodeMappingsSha256,
      atomicMappingsSha256: migrationVariant.atomicMappingsSha256,
      fireHosePayload: {
        meshNodes: reportVariant.batchCount,
        logicalInstances: reportVariant.logicalInstances,
        uniqueTriangles: reportVariant.uniqueTriangles,
        expandedTriangles: reportVariant.expandedTriangles,
      },
    }
  }
  return {
    kind: 'json-only-fire-hose-owner-migration',
    report: {
      url: relative(out, PROFILE.preprocessingReport).replaceAll('\\', '/'),
      bytes: reportBytes.length,
      sha256: createHash('sha256').update(reportBytes).digest('hex'),
      schema: report.schema,
    },
    ownershipMigration: {
      url: relative(out, PROFILE.ownershipMigration).replaceAll('\\', '/'),
      bytes: migrationBytes.length,
      sha256: createHash('sha256').update(migrationBytes).digest('hex'),
      schema: migration.schema,
      version: migration.version,
      atomicUnit: migration.atomicUnit,
      identityPolicy: migration.identityPolicy,
      scopeDefinition: migration.scopeDefinition,
    },
    wholeLayerContract: {
      url: relative(out, PROFILE.wholeLayerContract).replaceAll('\\', '/'),
      bytes: wholeLayerBytes.length,
      sha256: createHash('sha256').update(wholeLayerBytes).digest('hex'),
      readOnlyCompatibilityPin: true,
    },
    invariants: report.invariants,
    variants,
  }
}

function triangleCount(primitive) {
  const count = primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')?.getCount() ?? 0
  const mode = primitive.getMode()
  if (mode === 4) return Math.floor(count / 3)
  if (mode === 5 || mode === 6) return Math.max(0, count - 2)
  return 0
}

function instanceCount(node) {
  const instancing = node.getExtension('EXT_mesh_gpu_instancing')
  if (!instancing) return 1
  for (const semantic of ['TRANSLATION', 'ROTATION', 'SCALE', '_ID']) {
    const accessor = instancing.getAttribute?.(semantic)
    if (accessor) return accessor.getCount()
  }
  return 1
}

function normalizedAccessorValue(accessor, index) {
  const value = accessor.getArray()[index]
  if (!accessor.getNormalized()) return value
  const componentType = accessor.getComponentType()
  if (componentType === 5120) return Math.max(-1, value / 127)
  if (componentType === 5121) return value / 255
  if (componentType === 5122) return Math.max(-1, value / 32767)
  if (componentType === 5123) return value / 65535
  return value
}

function instanceLocalMatrices(node) {
  const instancing = node.getExtension('EXT_mesh_gpu_instancing')
  if (!instancing) return [new Matrix4()]
  const attributes = instancing.listAttributes()
  if (!attributes.length) throw new Error('EXT_mesh_gpu_instancing has no attributes')
  const count = attributes[0].getCount()
  if (!attributes.every((accessor) => accessor.getCount() === count)) {
    throw new Error('EXT_mesh_gpu_instancing attribute counts differ')
  }
  const translation = instancing.getAttribute('TRANSLATION')
  const rotation = instancing.getAttribute('ROTATION')
  const scale = instancing.getAttribute('SCALE')
  return Array.from({ length: count }, (_, index) => {
    const position = translation
      ? new Vector3(
          normalizedAccessorValue(translation, index * 3),
          normalizedAccessorValue(translation, index * 3 + 1),
          normalizedAccessorValue(translation, index * 3 + 2),
        )
      : new Vector3()
    const quaternion = rotation
      ? new Quaternion(
          normalizedAccessorValue(rotation, index * 4),
          normalizedAccessorValue(rotation, index * 4 + 1),
          normalizedAccessorValue(rotation, index * 4 + 2),
          normalizedAccessorValue(rotation, index * 4 + 3),
        ).normalize()
      : new Quaternion()
    const size = scale
      ? new Vector3(
          normalizedAccessorValue(scale, index * 3),
          normalizedAccessorValue(scale, index * 3 + 1),
          normalizedAccessorValue(scale, index * 3 + 2),
        )
      : new Vector3(1, 1, 1)
    return new Matrix4().compose(position, quaternion, size)
  })
}

function transformedInstanceMatrices(node, baseMatrix) {
  return instanceLocalMatrices(node).map((local) => new Matrix4().multiplyMatrices(baseMatrix, local))
}

function cloneExtras(extras) {
  return extras && typeof extras === 'object' ? structuredClone(extras) : {}
}

function stringListSha256(values) {
  return createHash('sha256').update(JSON.stringify([...values].sort())).digest('hex')
}

function findUniqueNode(document, name) {
  const matches = document.getRoot().listNodes().filter((node) => node.getName() === name)
  if (matches.length !== 1) throw new Error(`Expected exactly one node named "${name}", found ${matches.length}`)
  return matches[0]
}

function isDescendantOf(node, ancestor) {
  let current = node
  while (current) {
    if (current === ancestor) return true
    current = current.getParentNode()
  }
  return false
}

function descendants(root) {
  const output = []
  const stack = [root]
  while (stack.length) {
    const node = stack.pop()
    output.push(node)
    for (const child of node.listChildren()) stack.push(child)
  }
  return output
}

function pathMap(owner) {
  const nodeToPath = new Map()
  const pathToNode = new Map()
  const visit = (node, path) => {
    nodeToPath.set(node, path)
    pathToNode.set(path, node)
    node.listChildren().forEach((child, index) => visit(child, `${path}/${index}`))
  }
  owner.listChildren().forEach((child, index) => visit(child, String(index)))
  return { nodeToPath, pathToNode }
}

function emptyBounds() {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  }
}

function expandBounds(bounds, x, y, z) {
  bounds.min[0] = Math.min(bounds.min[0], x)
  bounds.min[1] = Math.min(bounds.min[1], y)
  bounds.min[2] = Math.min(bounds.min[2], z)
  bounds.max[0] = Math.max(bounds.max[0], x)
  bounds.max[1] = Math.max(bounds.max[1], y)
  bounds.max[2] = Math.max(bounds.max[2], z)
}

function mergeBounds(target, source) {
  expandBounds(target, source.min[0], source.min[1], source.min[2])
  expandBounds(target, source.max[0], source.max[1], source.max[2])
  return target
}

function finiteBounds(bounds) {
  return bounds.min.every(Number.isFinite) && bounds.max.every(Number.isFinite)
}

function boundsCenter(bounds) {
  return [
    (bounds.min[0] + bounds.max[0]) * 0.5,
    (bounds.min[1] + bounds.max[1]) * 0.5,
    (bounds.min[2] + bounds.max[2]) * 0.5,
  ]
}

const _ownerInverse = new Matrix4()
const _nodeWorld = new Matrix4()
const _relative = new Matrix4()
const _point = new Vector3()

function relativeNodeMatrix(owner, node) {
  _ownerInverse.fromArray(owner.getWorldMatrix()).invert()
  _nodeWorld.fromArray(node.getWorldMatrix())
  return _relative.multiplyMatrices(_ownerInverse, _nodeWorld).clone()
}

function expandAccessorBounds(bounds, accessor, matrix) {
  const min = accessor.getMin([])
  const max = accessor.getMax([])
  if (!min?.length || !max?.length) return
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) {
        _point.set(x, y, z).applyMatrix4(matrix)
        expandBounds(bounds, _point.x, _point.y, _point.z)
      }
    }
  }
}

function expandReferencedPrimitiveBounds(bounds, primitive, matrix) {
  const position = primitive.getAttribute('POSITION')
  if (!position) return
  const referenced = new Set()
  const indices = primitive.getIndices()
  const element = []
  if (indices) {
    for (let index = 0; index < indices.getCount(); index += 1) {
      indices.getElement(index, element)
      const vertexIndex = element[0]
      if (!Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= position.getCount()) {
        throw new Error(`Primitive index ${vertexIndex} is outside POSITION[${position.getCount()}]`)
      }
      referenced.add(vertexIndex)
    }
  } else {
    for (let index = 0; index < position.getCount(); index += 1) referenced.add(index)
  }
  const value = []
  for (const vertexIndex of referenced) {
    position.getElement(vertexIndex, value)
    if (!value.slice(0, 3).every(Number.isFinite)) throw new Error('Primitive POSITION contains non-finite values')
    _point.fromArray(value).applyMatrix4(matrix)
    expandBounds(bounds, _point.x, _point.y, _point.z)
  }
}

function semanticRoles(label, criticalName = null) {
  const roles = new Set(['architectural-detail', 'interior'])
  if (criticalName === 'Fire' || /fire|hose|feuer|hydrant|brandschutz/i.test(label)) roles.add('fire-safety')
  if (criticalName?.startsWith('Verbindung') || /verbindung|walkway|connector|passage/i.test(label)) {
    roles.add('building-connection')
  }
  if (/treppe|stair|podest|step/i.test(label)) roles.add('stair')
  return [...roles].sort()
}

function normalizeSemanticText(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function semanticTextForNode(owner, node) {
  const labels = []
  let current = node
  while (current && current !== owner) {
    if (current.getName()) labels.push(current.getName())
    if (current.getMesh()?.getName()) labels.push(current.getMesh().getName())
    current = current.getParentNode()
  }
  for (const primitive of node.getMesh()?.listPrimitives() || []) {
    const material = primitive.getMaterial()
    if (material?.getName()) labels.push(material.getName())
    const role = material?.getExtras()?.iomMaterialRole
    if (role) labels.push(role)
  }
  return normalizeSemanticText(labels.join(' '))
}

function primitiveIsOpaque(primitive) {
  const material = primitive.getMaterial()
  if (!material) return true
  const transmission = material.getExtension('KHR_materials_transmission')?.getTransmissionFactor?.() || 0
  return material.getAlphaMode() === 'OPAQUE' && transmission <= 1e-6
}

const STRUCTURAL_RULES = [
  ['wall', /(?:wall|wand|waend|innenwaend|tragwand|partition)/],
  ['floor-slab', /(?:boden|fussboden|estrich|slab)/],
  ['ceiling', /(?:decke|ceiling)/],
  ['facade', /(?:fassade|facade)/],
  ['roof', /(?:dach|roof)/],
  ['column', /(?:saeule|column|stuetze|stutze|pillar)/],
  ['beam', /(?:traeger|trager|trger|beam)/],
  ['stair', /(?:treppe|stair|stufe|podest)/],
  ['parapet', /(?:bruestung|parapet)/],
  ['corridor', /(?:corridor|hallway|gang innen)/],
]

const NON_SHELL_RULE = /(?:chair|stuhl|seat|sitz|table|tisch|wardrobe|schrank|door|tuer|fenster|window|glass|glas|gelander|railing|curtain|vorhang|lamp|light|speaker|sprinkler|sprenkler|lufter|lftung|vent|screen|display|fire|hose|verbindung|connector|furniture|mobel|bench|bank|sofa|raster|gitter|stage|buehne|seil)/

function shellCandidateEvidence(unit) {
  const size = unit.bounds.max.map((value, index) => Math.max(0, value - unit.bounds.min[index]))
  const planarAreas = [size[0] * size[1], size[0] * size[2], size[1] * size[2]]
  const projectedArea = Math.max(...planarAreas)
  const categories = STRUCTURAL_RULES.filter(([, pattern]) => pattern.test(unit.semanticText)).map(([name]) => name)
  const explicitProfileStructuralAnchor = Boolean(PROFILE.shellExplicitAnchorPattern?.test(unit.semanticText))
  const rejectReasons = []
  if (unit.criticalName) rejectReasons.push('persistent-critical-content')
  if (!unit.allOpaque) rejectReasons.push('transparent-or-transmissive-material')
  if (!categories.length) rejectReasons.push('no-structural-semantic')
  if (NON_SHELL_RULE.test(unit.semanticText) && !explicitProfileStructuralAnchor) rejectReasons.push('non-shell-semantic')
  if (unit.triangles > 25_000) rejectReasons.push('single-source-detail-cost-over-25k')
  if ((Math.max(...size) < 1.5 || projectedArea < 0.75) && !explicitProfileStructuralAnchor) {
    rejectReasons.push('insufficient-architectural-span')
  }
  const categoryWeight = categories.some((value) => ['wall', 'floor-slab', 'ceiling', 'facade', 'roof'].includes(value))
    ? 4
    : categories.some((value) => ['column', 'beam', 'stair', 'parapet'].includes(value)) ? 2 : 1
  return {
    eligible: rejectReasons.length === 0,
    rejectReasons,
    categories,
    explicitProfileStructuralAnchor,
    size,
    projectedArea,
    score: projectedArea * categoryWeight / Math.sqrt(Math.max(1, unit.triangles)),
  }
}

function finalizeShellSelection(evaluated, selected) {
  const triangles = selected.reduce((sum, entry) => sum + entry.unit.triangles, 0)
  if (!selected.length) throw new Error('No structurally classified opaque source unit fits the shell triangle budget')
  const selectedPaths = new Set(selected.flatMap((entry) => entry.unit.paths))
  const bounds = boundsForUnits(selected.map((entry) => entry.unit))
  const rejectionCounts = {}
  for (const { evidence } of evaluated) {
    for (const reason of evidence.rejectReasons) rejectionCounts[reason] = (rejectionCounts[reason] || 0) + 1
  }
  return {
    evaluated,
    selected,
    units: selected.map((entry) => entry.unit),
    paths: [...selectedPaths].sort(),
    triangles,
    draws: selected.reduce((sum, entry) => sum + entry.unit.draws, 0),
    bounds,
    eligibleUnits: evaluated.filter((entry) => entry.evidence.eligible).length,
    evaluatedUnits: evaluated.length,
    rejectionCounts,
    records: selected.map(({ unit, evidence }) => ({
      sourcePaths: unit.paths,
      names: unit.labels,
      triangles: unit.triangles,
      draws: unit.draws,
      bounds: unit.bounds,
      categories: evidence.categories,
      explicitProfileStructuralAnchor: evidence.explicitProfileStructuralAnchor,
      projectedAreaSquareMeters: evidence.projectedArea,
      score: evidence.score,
    })),
  }
}

function selectOpaqueShellUnits(analysis, maxTriangles) {
  const evaluated = analysis.units.map((unit) => ({ unit, evidence: shellCandidateEvidence(unit) }))
  const eligible = evaluated
    .filter((entry) => entry.evidence.eligible)
    .sort((a, b) => b.evidence.score - a.evidence.score || a.unit.key.localeCompare(b.unit.key))
  const selected = []
  let triangles = 0
  for (const entry of eligible) {
    if (triangles + entry.unit.triangles > maxTriangles) continue
    selected.push(entry)
    triangles += entry.unit.triangles
  }
  return finalizeShellSelection(evaluated, selected)
}

function harmonizeDetailCellCoverage(analyses, selections) {
  const selectedKeys = {
    web: new Set(selections.web.selected.map((entry) => entry.unit.key)),
    quest: new Set(selections.quest.selected.map((entry) => entry.unit.key)),
  }
  const detailCells = (variant) => new Set(analyses[variant].units
    .filter((unit) => !unit.criticalName && !selectedKeys[variant].has(unit.key))
    .map((unit) => unit.cellKey))
  for (;;) {
    const webCells = detailCells('web')
    const questCells = detailCells('quest')
    const mismatch = [...new Set([...webCells, ...questCells])].sort(compareCellKey)
      .find((cell) => webCells.has(cell) !== questCells.has(cell))
    if (!mismatch) break
    const variant = webCells.has(mismatch) ? 'quest' : 'web'
    const restore = selections[variant].selected
      .filter((entry) => entry.unit.cellKey === mismatch)
      .sort((a, b) => a.unit.triangles - b.unit.triangles || a.unit.key.localeCompare(b.unit.key))[0]
    if (!restore) throw new Error(`${variant}: cannot restore detail coverage for spatial cell ${mismatch}`)
    selectedKeys[variant].delete(restore.unit.key)
  }
  return {
    web: finalizeShellSelection(
      selections.web.evaluated,
      selections.web.selected.filter((entry) => selectedKeys.web.has(entry.unit.key)),
    ),
    quest: finalizeShellSelection(
      selections.quest.evaluated,
      selections.quest.selected.filter((entry) => selectedKeys.quest.has(entry.unit.key)),
    ),
  }
}

function ktx2DecodedRgba8Bytes(image) {
  const identifier = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]
  if (!image || image.byteLength < 48 || identifier.some((value, index) => image[index] !== value)) return null
  const view = new DataView(image.buffer, image.byteOffset, image.byteLength)
  const width = view.getUint32(20, true)
  const height = Math.max(1, view.getUint32(24, true))
  const depth = Math.max(1, view.getUint32(28, true))
  const layers = Math.max(1, view.getUint32(32, true))
  const faces = Math.max(1, view.getUint32(36, true))
  const levels = Math.max(1, view.getUint32(40, true))
  let bytes = 0
  for (let level = 0; level < levels; level += 1) {
    bytes += Math.max(1, width >> level) * Math.max(1, height >> level) *
      Math.max(1, depth >> level) * layers * faces * 4
  }
  return bytes
}

function texturesForMaterial(material) {
  const graph = material.getGraph()
  const textures = new Set()
  const visited = new Set()
  const traverse = (property) => {
    if (visited.has(property)) return
    visited.add(property)
    for (const edge of graph.listChildEdges(property)) {
      const child = edge.getChild()
      if (child instanceof Texture) textures.add(child)
      else if (child instanceof ExtensionProperty) traverse(child)
    }
  }
  traverse(material)
  return [...textures]
}

function dependencyMapForMeshNodes(meshNodes) {
  const textures = new Map()
  const materials = new Set()
  for (const node of meshNodes) {
    for (const primitive of node.getMesh().listPrimitives()) {
      const material = primitive.getMaterial()
      if (!material) continue
      const materialSha256 = createHash('sha256')
        .update(JSON.stringify(materialPbrSignature(material)))
        .digest('hex')
      materials.add(materialSha256)
      for (const texture of texturesForMaterial(material)) {
        const image = texture.getImage()
        if (!image) continue
        const sha256 = createHash('sha256').update(image).digest('hex')
        if (!textures.has(sha256)) {
          textures.set(sha256, {
            sha256,
            embeddedBytes: image.byteLength,
            decodedRgba8Bytes: ktx2DecodedRgba8Bytes(image) ?? image.byteLength * 4,
          })
        }
      }
    }
  }
  return {
    textures: [...textures.values()].sort((a, b) => a.sha256.localeCompare(b.sha256)),
    materials: [...materials].sort(),
  }
}

function makeUnit(owner, meshNodes, nodeToPath, criticalName = null) {
  const bounds = emptyBounds()
  let triangles = 0
  let draws = 0
  const paths = []
  const labels = []
  const semanticTexts = []
  let allOpaque = true
  for (const node of meshNodes) {
    const path = nodeToPath.get(node)
    if (!path) throw new Error(`Mesh node ${node.getName() || '(unnamed)'} is outside ${OWNER_NAME}`)
    const instances = instanceCount(node)
    if (instances !== 1 && !PROFILE.allowInstancing) {
      throw new Error(`Imported instancing is not supported in owner-package pilot: ${node.getName() || path}`)
    }
    paths.push(path)
    labels.push(node.getName() || node.getMesh()?.getName() || path)
    semanticTexts.push(semanticTextForNode(owner, node))
    const matrices = transformedInstanceMatrices(node, relativeNodeMatrix(owner, node))
    for (const primitive of node.getMesh().listPrimitives()) {
      triangles += triangleCount(primitive) * instances
      draws += 1
      for (const matrix of matrices) expandReferencedPrimitiveBounds(bounds, primitive, matrix)
      allOpaque = allOpaque && primitiveIsOpaque(primitive)
    }
  }
  if (!finiteBounds(bounds)) throw new Error(`Could not calculate bounds for unit ${criticalName || paths[0]}`)
  const label = [criticalName || '', ...labels].join(' ')
  const dependencies = dependencyMapForMeshNodes(meshNodes)
  return {
    key: criticalName ? `critical:${criticalName}` : `mesh:${paths[0]}`,
    paths: paths.sort(),
    triangles,
    draws,
    bounds,
    center: boundsCenter(bounds),
    semanticRoles: semanticRoles(label, criticalName),
    criticalName,
    labels: [...new Set(labels)].sort(),
    semanticText: semanticTexts.join(' '),
    allOpaque,
    textureDependencies: dependencies.textures,
    materialDependencies: dependencies.materials,
  }
}

function analyzeOwner(document, grid) {
  const owner = findUniqueNode(document, OWNER_NAME)
  owner.updateWorldMatrix?.()
  const { nodeToPath, pathToNode } = pathMap(owner)
  const criticalRoots = new Map()
  const criticalDescendants = new Set()
  for (const name of CRITICAL_NAMES) {
    const matches = document.getRoot().listNodes().filter((node) => node.getName() === name && isDescendantOf(node, owner))
    if (matches.length !== 1) throw new Error(`Expected one ${name} below ${OWNER_NAME}, found ${matches.length}`)
    const root = matches[0]
    criticalRoots.set(name, root)
    for (const node of descendants(root)) criticalDescendants.add(node)
  }
  const criticalRoleNodes = CRITICAL_MATERIAL_ROLE_PREFIX
    ? descendants(owner).filter((node) => node.getMesh()?.listPrimitives().some((primitive) => {
        const role = primitive.getMaterial()?.getExtras()?.iomMaterialRole
        return typeof role === 'string' && role.startsWith(CRITICAL_MATERIAL_ROLE_PREFIX)
      }))
    : []
  for (const node of criticalRoleNodes) criticalDescendants.add(node)

  const units = []
  for (const [name, criticalRoot] of criticalRoots) {
    const meshes = descendants(criticalRoot).filter((node) => node.getMesh())
    if (!meshes.length) throw new Error(`Critical subtree ${name} has no render meshes`)
    units.push(makeUnit(owner, meshes, nodeToPath, name))
  }
  if (CRITICAL_MATERIAL_ROLE_PREFIX) {
    if (!criticalRoleNodes.length) {
      throw new Error(`No ${CRITICAL_MATERIAL_ROLE_PREFIX} material-role nodes were found below ${OWNER_NAME}`)
    }
    units.push(makeUnit(owner, criticalRoleNodes, nodeToPath, PROFILE.criticalGroupName || CRITICAL_MATERIAL_ROLE_PREFIX))
  }
  for (const node of descendants(owner)) {
    if (node === owner || criticalDescendants.has(node) || !node.getMesh()) continue
    units.push(makeUnit(owner, [node], nodeToPath))
  }

  const ownerBounds = emptyBounds()
  for (const unit of units) mergeBounds(ownerBounds, unit.bounds)
  const assignedPaths = new Set(units.flatMap((unit) => unit.paths))
  const sourceMeshPaths = [...nodeToPath.entries()].filter(([node]) => node.getMesh()).map(([, path]) => path)
  if (assignedPaths.size !== sourceMeshPaths.length || sourceMeshPaths.some((path) => !assignedPaths.has(path))) {
    throw new Error(`Unit ownership mismatch: assigned ${assignedPaths.size}, source ${sourceMeshPaths.length}`)
  }

  for (const unit of units) {
    unit.cellX = Math.floor((unit.center[0] - grid.originX) / grid.cellSize)
    unit.cellZ = Math.floor((unit.center[2] - grid.originZ) / grid.cellSize)
    unit.cellKey = `${unit.cellX}|${unit.cellZ}`
  }
  return {
    owner,
    nodeToPath,
    pathToNode,
    units,
    bounds: ownerBounds,
    triangles: units.reduce((sum, unit) => sum + unit.triangles, 0),
    draws: units.reduce((sum, unit) => sum + unit.draws, 0),
    meshNodes: sourceMeshPaths.length,
  }
}

function cellIdPart(value) {
  return value < 0 ? `m${Math.abs(value)}` : String(value)
}

function compareCellKey(a, b) {
  const [ax, az] = a.split('|').map(Number)
  const [bx, bz] = b.split('|').map(Number)
  return ax - bx || az - bz
}

function rolesForUnits(units) {
  return [...new Set(units.flatMap((unit) => unit.semanticRoles))].sort()
}

function boundsForUnits(units) {
  const bounds = emptyBounds()
  for (const unit of units) mergeBounds(bounds, unit.bounds)
  return bounds
}

function firstFitBins(units, limits) {
  const bins = []
  const sorted = [...units].sort((a, b) => b.triangles - a.triangles || b.draws - a.draws || a.key.localeCompare(b.key))
  for (const unit of sorted) {
    if (unit.triangles > limits.maxTriangles || unit.draws > limits.maxDraws) {
      throw new Error(
        `Single unit ${unit.key} exceeds package budget (${unit.triangles} tris, ${unit.draws} draws)`,
      )
    }
    let target = bins.find(
      (bin) => bin.triangles + unit.triangles <= limits.maxTriangles && bin.draws + unit.draws <= limits.maxDraws,
    )
    if (!target) {
      target = { units: [], triangles: 0, draws: 0 }
      bins.push(target)
    }
    target.units.push(unit)
    target.triangles += unit.triangles
    target.draws += unit.draws
  }
  return bins
}

function fitIntoBinCount(units, count, limits, label) {
  if (units.length < count) throw new Error(`${label}: ${units.length} units cannot fill ${count} package bins`)
  const bins = Array.from({ length: count }, () => ({ units: [], triangles: 0, draws: 0 }))
  const sorted = [...units].sort((a, b) => b.triangles - a.triangles || b.draws - a.draws || a.key.localeCompare(b.key))
  for (const unit of sorted) {
    const candidates = bins
      .filter((bin) => bin.triangles + unit.triangles <= limits.maxTriangles && bin.draws + unit.draws <= limits.maxDraws)
      .sort((a, b) => a.triangles - b.triangles || a.draws - b.draws)
    if (!candidates.length) {
      throw new Error(`${label}: cannot fit ${unit.key} within ${count} bins and package budgets`)
    }
    const target = candidates[0]
    target.units.push(unit)
    target.triangles += unit.triangles
    target.draws += unit.draws
  }
  if (bins.some((bin) => bin.units.length === 0)) throw new Error(`${label}: variant produced an empty package bin`)
  return bins
}

function createPackagePlan(webAnalysis, questAnalysis, limits) {
  const criticalWeb = webAnalysis.units.filter((unit) => unit.criticalName)
  const criticalQuest = questAnalysis.units.filter((unit) => unit.criticalName)
  const packages = criticalWeb.length || criticalQuest.length ? [{
    id: CRITICAL_PACKAGE_ID,
    cell: null,
    webUnits: criticalWeb,
    questUnits: criticalQuest,
  }] : []
  const webGroups = new Map()
  const questGroups = new Map()
  for (const unit of webAnalysis.units.filter((item) => !item.criticalName)) {
    const list = webGroups.get(unit.cellKey) || []
    list.push(unit)
    webGroups.set(unit.cellKey, list)
  }
  for (const unit of questAnalysis.units.filter((item) => !item.criticalName)) {
    const list = questGroups.get(unit.cellKey) || []
    list.push(unit)
    questGroups.set(unit.cellKey, list)
  }
  const webKeys = [...webGroups.keys()].sort(compareCellKey)
  const questOnly = [...questGroups.keys()].filter((key) => !webGroups.has(key))
  if (questOnly.length) throw new Error(`Quest contains spatial cells absent from Web: ${questOnly.join(', ')}`)

  for (const key of webKeys) {
    const webBins = firstFitBins(webGroups.get(key), limits)
    const questUnits = questGroups.get(key)
    if (!questUnits?.length) throw new Error(`Quest is missing Web spatial cell ${key}`)
    const questBins = fitIntoBinCount(questUnits, webBins.length, limits, `Quest cell ${key}`)
    const [cellX, cellZ] = key.split('|').map(Number)
    for (let index = 0; index < webBins.length; index += 1) {
      packages.push({
        id: `${PROFILE.slug}-cx${cellIdPart(cellX)}-cz${cellIdPart(cellZ)}-p${index + 1}`,
        cell: [cellX, 0, cellZ],
        webUnits: webBins[index].units,
        questUnits: questBins[index].units,
      })
    }
  }
  return packages
}

function dependencyMapForUnits(units) {
  const textures = new Map()
  const materials = new Set()
  for (const unit of units) {
    for (const texture of unit.textureDependencies) textures.set(texture.sha256, texture)
    for (const material of unit.materialDependencies) materials.add(material)
  }
  return { textures, materials }
}

function dependencySummaryForUnits(units) {
  const dependencies = dependencyMapForUnits(units)
  return {
    textureCount: dependencies.textures.size,
    embeddedTextureBytes: [...dependencies.textures.values()].reduce((sum, texture) => sum + texture.embeddedBytes, 0),
    decodedRgba8Bytes: [...dependencies.textures.values()].reduce((sum, texture) => sum + texture.decodedRgba8Bytes, 0),
    materialCount: dependencies.materials.size,
    textureSetSha256: stringListSha256([...dependencies.textures.keys()]),
    materialSetSha256: stringListSha256([...dependencies.materials]),
  }
}

function sharedDependencyCost(leftUnits, rightUnits) {
  const left = dependencyMapForUnits(leftUnits)
  const right = dependencyMapForUnits(rightUnits)
  let embeddedBytes = 0
  let decodedRgba8Bytes = 0
  let textureCount = 0
  for (const [sha256, texture] of left.textures) {
    if (!right.textures.has(sha256)) continue
    textureCount += 1
    embeddedBytes += texture.embeddedBytes
    decodedRgba8Bytes += texture.decodedRgba8Bytes
  }
  let materialCount = 0
  for (const material of left.materials) if (right.materials.has(material)) materialCount += 1
  return { embeddedBytes, decodedRgba8Bytes, textureCount, materialCount }
}

function materialAwareFitIntoBinCount(units, count, limits, label) {
  if (count === 1) {
    const triangles = units.reduce((sum, unit) => sum + unit.triangles, 0)
    const draws = units.reduce((sum, unit) => sum + unit.draws, 0)
    if (triangles > limits.maxTriangles || draws > limits.maxDraws) {
      throw new Error(`${label}: single package exceeds detail budgets`)
    }
    return [{ units: [...units], triangles, draws }]
  }
  if (units.length < count) throw new Error(`${label}: ${units.length} units cannot fill ${count} package bins`)
  const bins = Array.from({ length: count }, () => ({ units: [], triangles: 0, draws: 0 }))
  const sorted = [...units].sort((a, b) => b.triangles - a.triangles || b.draws - a.draws || a.key.localeCompare(b.key))
  for (const unit of sorted) {
    const candidates = bins
      .map((bin, index) => {
        if (bin.triangles + unit.triangles > limits.maxTriangles || bin.draws + unit.draws > limits.maxDraws) return null
        const existing = dependencyMapForUnits(bin.units)
        let addedEmbeddedBytes = 0
        let addedDecodedBytes = 0
        let sharedMaterials = 0
        for (const texture of unit.textureDependencies) {
          if (!existing.textures.has(texture.sha256)) {
            addedEmbeddedBytes += texture.embeddedBytes
            addedDecodedBytes += texture.decodedRgba8Bytes
          }
        }
        for (const material of unit.materialDependencies) if (existing.materials.has(material)) sharedMaterials += 1
        return { bin, index, addedEmbeddedBytes, addedDecodedBytes, sharedMaterials }
      })
      .filter(Boolean)
      .sort((a, b) =>
        a.addedEmbeddedBytes - b.addedEmbeddedBytes ||
        a.addedDecodedBytes - b.addedDecodedBytes ||
        b.sharedMaterials - a.sharedMaterials ||
        a.bin.triangles - b.bin.triangles ||
        a.bin.draws - b.bin.draws ||
        a.index - b.index,
      )
    if (!candidates.length) {
      // The affinity heuristic can paint itself into a capacity corner. The
      // proven deterministic capacity-first allocator remains the safe fallback.
      return fitIntoBinCount(units, count, limits, `${label} (capacity fallback)`)
    }
    const target = candidates[0].bin
    target.units.push(unit)
    target.triangles += unit.triangles
    target.draws += unit.draws
  }
  if (bins.some((bin) => bin.units.length === 0)) {
    return fitIntoBinCount(units, count, limits, `${label} (empty-bin fallback)`)
  }
  return bins
}

function cellCoordinates(key) {
  return key.split('|').map(Number)
}

function clusterCellBounds(cluster) {
  const cells = [...cluster.cellKeys].map(cellCoordinates)
  return {
    minX: Math.min(...cells.map(([x]) => x)),
    maxX: Math.max(...cells.map(([x]) => x)),
    minZ: Math.min(...cells.map(([, z]) => z)),
    maxZ: Math.max(...cells.map(([, z]) => z)),
  }
}

function clustersAreAdjacent(left, right) {
  for (const leftKey of left.cellKeys) {
    const [leftX, leftZ] = cellCoordinates(leftKey)
    for (const rightKey of right.cellKeys) {
      const [rightX, rightZ] = cellCoordinates(rightKey)
      if (Math.abs(leftX - rightX) + Math.abs(leftZ - rightZ) <= 1) return true
    }
  }
  return false
}

function clusterFits(cluster, limits) {
  for (const units of [cluster.webUnits, cluster.questUnits]) {
    const triangles = units.reduce((sum, unit) => sum + unit.triangles, 0)
    const draws = units.reduce((sum, unit) => sum + unit.draws, 0)
    if (triangles > limits.maxTriangles || draws > limits.maxDraws) return false
  }
  return true
}

function mergeScore(left, right) {
  const web = sharedDependencyCost(left.webUnits, right.webUnits)
  const quest = sharedDependencyCost(left.questUnits, right.questUnits)
  const merged = {
    cellKeys: new Set([...left.cellKeys, ...right.cellKeys]),
  }
  const bounds = clusterCellBounds(merged)
  const spanArea = (bounds.maxX - bounds.minX + 1) * (bounds.maxZ - bounds.minZ + 1)
  const textureEmbeddedSavings = web.embeddedBytes + quest.embeddedBytes
  const textureDecodedSavings = web.decodedRgba8Bytes + quest.decodedRgba8Bytes
  const materialAffinity = web.materialCount + quest.materialCount
  return {
    score: textureEmbeddedSavings * 32 + textureDecodedSavings + materialAffinity * 1_000_000 - spanArea * 10_000,
    textureEmbeddedSavings,
    textureDecodedSavings,
    textureCount: web.textureCount + quest.textureCount,
    materialAffinity,
  }
}

function coalescedPackageId(cluster, ordinal) {
  const bounds = clusterCellBounds(cluster)
  const xPart = bounds.minX === bounds.maxX
    ? `cx${cellIdPart(bounds.minX)}`
    : `cx${cellIdPart(bounds.minX)}-${cellIdPart(bounds.maxX)}`
  const zPart = bounds.minZ === bounds.maxZ
    ? `cz${cellIdPart(bounds.minZ)}`
    : `cz${cellIdPart(bounds.minZ)}-${cellIdPart(bounds.maxZ)}`
  return `${PROFILE.slug}-coalesced-${xPart}-${zPart}-p${ordinal}`
}

function createMaterialAwarePackagePlan(webAnalysis, questAnalysis, limits, maxClusterSpanCells) {
  const webGroups = new Map()
  const questGroups = new Map()
  for (const unit of webAnalysis.units.filter((item) => !item.criticalName)) {
    const list = webGroups.get(unit.cellKey) || []
    list.push(unit)
    webGroups.set(unit.cellKey, list)
  }
  for (const unit of questAnalysis.units.filter((item) => !item.criticalName)) {
    const list = questGroups.get(unit.cellKey) || []
    list.push(unit)
    questGroups.set(unit.cellKey, list)
  }
  const webKeys = [...webGroups.keys()].sort(compareCellKey)
  const questOnly = [...questGroups.keys()].filter((key) => !webGroups.has(key))
  if (questOnly.length) throw new Error(`Quest contains spatial cells absent from Web: ${questOnly.join(', ')}`)

  let clusters = []
  for (const key of webKeys) {
    const webUnits = webGroups.get(key)
    const questUnits = questGroups.get(key)
    if (!questUnits?.length) throw new Error(`Quest is missing Web spatial cell ${key}`)
    const webBinCount = firstFitBins(webUnits, limits).length
    const questBinCount = firstFitBins(questUnits, limits).length
    const binCount = Math.max(webBinCount, questBinCount)
    const webBins = materialAwareFitIntoBinCount(webUnits, binCount, limits, `Web cell ${key}`)
    const questBins = materialAwareFitIntoBinCount(questUnits, binCount, limits, `Quest cell ${key}`)
    for (let index = 0; index < binCount; index += 1) {
      clusters.push({
        stableKey: `${key}|${index}`,
        cellKeys: new Set([key]),
        webUnits: webBins[index].units,
        questUnits: questBins[index].units,
        mergeEvidence: [],
      })
    }
  }

  for (;;) {
    let best = null
    for (let leftIndex = 0; leftIndex < clusters.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < clusters.length; rightIndex += 1) {
        const left = clusters[leftIndex]
        const right = clusters[rightIndex]
        if (!clustersAreAdjacent(left, right)) continue
        const candidate = {
          stableKey: [left.stableKey, right.stableKey].sort().join('+'),
          cellKeys: new Set([...left.cellKeys, ...right.cellKeys]),
          webUnits: [...left.webUnits, ...right.webUnits],
          questUnits: [...left.questUnits, ...right.questUnits],
          mergeEvidence: [...left.mergeEvidence, ...right.mergeEvidence],
        }
        const spatial = clusterCellBounds(candidate)
        if (
          spatial.maxX - spatial.minX + 1 > maxClusterSpanCells ||
          spatial.maxZ - spatial.minZ + 1 > maxClusterSpanCells ||
          candidate.cellKeys.size > maxClusterSpanCells * maxClusterSpanCells ||
          !clusterFits(candidate, limits)
        ) continue
        const evidence = mergeScore(left, right)
        const ranking = `${String(Math.max(0, evidence.score)).padStart(24, '0')}|${candidate.stableKey}`
        if (!best || evidence.score > best.evidence.score ||
          (evidence.score === best.evidence.score && ranking.localeCompare(best.ranking) < 0)) {
          best = { leftIndex, rightIndex, candidate, evidence, ranking }
        }
      }
    }
    if (!best) break
    best.candidate.mergeEvidence.push({
      left: clusters[best.leftIndex].stableKey,
      right: clusters[best.rightIndex].stableKey,
      ...best.evidence,
    })
    clusters = clusters.filter((_, index) => index !== best.leftIndex && index !== best.rightIndex)
    clusters.push(best.candidate)
    clusters.sort((a, b) => a.stableKey.localeCompare(b.stableKey))
  }

  clusters.sort((a, b) => {
    const ab = clusterCellBounds(a)
    const bb = clusterCellBounds(b)
    return ab.minX - bb.minX || ab.minZ - bb.minZ || ab.maxX - bb.maxX || ab.maxZ - bb.maxZ ||
      a.stableKey.localeCompare(b.stableKey)
  })
  const rangeOrdinals = new Map()
  const criticalWeb = webAnalysis.units.filter((unit) => unit.criticalName)
  const criticalQuest = questAnalysis.units.filter((unit) => unit.criticalName)
  const packages = criticalWeb.length || criticalQuest.length ? [{
    id: CRITICAL_PACKAGE_ID,
    cell: null,
    coverageCells: [],
    webUnits: criticalWeb,
    questUnits: criticalQuest,
    mergeEvidence: [],
  }] : []
  for (const cluster of clusters) {
    const bounds = clusterCellBounds(cluster)
    const rangeKey = `${bounds.minX}|${bounds.maxX}|${bounds.minZ}|${bounds.maxZ}`
    const ordinal = (rangeOrdinals.get(rangeKey) || 0) + 1
    rangeOrdinals.set(rangeKey, ordinal)
    const coverageCells = [...cluster.cellKeys].sort(compareCellKey).map(cellCoordinates)
    const averageX = coverageCells.reduce((sum, [x]) => sum + x, 0) / coverageCells.length
    const averageZ = coverageCells.reduce((sum, [, z]) => sum + z, 0) / coverageCells.length
    packages.push({
      id: coalescedPackageId(cluster, ordinal),
      cell: [averageX, 0, averageZ],
      coverageCells,
      webUnits: cluster.webUnits,
      questUnits: cluster.questUnits,
      mergeEvidence: cluster.mergeEvidence,
    })
  }
  return packages
}

function createTargetExtensions(target, source) {
  for (const extension of source.getRoot().listExtensionsUsed()) {
    const next = target.createExtension(extension.constructor)
    if (extension.isRequired()) next.setRequired(true)
  }
}

function assignSelectedNodeProperties(targetNode, sourceNode, propertyMap) {
  targetNode.setMesh(propertyMap.get(sourceNode.getMesh()))
  const instancing = sourceNode.getExtension('EXT_mesh_gpu_instancing')
  if (instancing) {
    const copied = propertyMap.get(instancing)
    if (!copied) throw new Error(`Failed to copy instancing extension for ${sourceNode.getName() || '(unnamed)'}`)
    targetNode.setExtension('EXT_mesh_gpu_instancing', copied)
  }
}

function targetNodeChain(target, scene, sourceOwner, sourceNode, selected, propertyMap, nodeMap) {
  const existing = nodeMap.get(sourceNode)
  if (existing) {
    if (selected.has(sourceNode) && !existing.getMesh()) assignSelectedNodeProperties(existing, sourceNode, propertyMap)
    return existing
  }
  const parent = sourceNode.getParentNode()
  if (!parent) throw new Error(`Node ${sourceNode.getName() || '(unnamed)'} lost owner ancestry`)
  const node = target
    .createNode(sourceNode.getName())
    .setMatrix(sourceNode.getMatrix())
    .setExtras(cloneExtras(sourceNode.getExtras()))
  nodeMap.set(sourceNode, node)
  if (selected.has(sourceNode)) assignSelectedNodeProperties(node, sourceNode, propertyMap)
  if (parent === sourceOwner) scene.addChild(node)
  else targetNodeChain(target, scene, sourceOwner, parent, selected, propertyMap, nodeMap).addChild(node)
  return node
}

async function writeRawPackage(io, source, sourceAnalysis, units, packageId, outPath) {
  const selectedPaths = new Set(units.flatMap((unit) => unit.paths))
  const selectedNodes = [...selectedPaths].map((path) => {
    const node = sourceAnalysis.pathToNode.get(path)
    if (!node?.getMesh()) throw new Error(`${packageId}: unresolved source mesh path ${path}`)
    return node
  })
  const target = new Document().setLogger(source.getLogger())
  createTargetExtensions(target, source)
  const scene = target.createScene(`OwnerLocal:${packageId}`)
  const uniqueMeshes = [...new Set(selectedNodes.map((node) => node.getMesh()))]
  const instancingProperties = selectedNodes
    .map((node) => node.getExtension('EXT_mesh_gpu_instancing'))
    .filter(Boolean)
  const resolver = createDefaultPropertyResolver(target, source)
  const propertyMap = copyToDocument(target, source, [...uniqueMeshes, ...instancingProperties], resolver)
  const selected = new Set(selectedNodes)
  const nodeMap = new Map()
  for (const sourceNode of selectedNodes) {
    const targetNode = targetNodeChain(target, scene, sourceAnalysis.owner, sourceNode, selected, propertyMap, nodeMap)
    targetNode.setExtras({
      ...cloneExtras(targetNode.getExtras()),
      iomPackageSourcePath: sourceAnalysis.nodeToPath.get(sourceNode),
    })
  }
  await target.transform(prune({ keepAttributes: true, keepIndices: true, keepExtras: true }))
  await mkdir(dirname(outPath), { recursive: true })
  await io.write(outPath, target)
}

function textureCoordinatesForMaterial(material) {
  return listTextureInfoByMaterial(material).map((info) => {
    return info.getExtension('KHR_texture_transform')?.getTexCoord?.() ?? info.getTexCoord()
  })
}

function countStrings(values) {
  return Object.fromEntries(
    [...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length]),
  )
}

function textureBinding(texture, info) {
  if (!texture) return null
  const transform = info?.getExtension?.('KHR_texture_transform')
  const image = texture.getImage()
  return {
    name: texture.getName(),
    mimeType: texture.getMimeType(),
    imageSha256: image ? createHash('sha256').update(image).digest('hex') : null,
    texCoord: transform?.getTexCoord?.() ?? info?.getTexCoord?.() ?? 0,
    offset: transform?.getOffset?.() ?? null,
    rotation: transform?.getRotation?.() ?? null,
    scale: transform?.getScale?.() ?? null,
  }
}

function materialPbrSignature(material) {
  const transmission = material.getExtension('KHR_materials_transmission')
  const specular = material.getExtension('KHR_materials_specular')
  const ior = material.getExtension('KHR_materials_ior')
  const emissiveStrength = material.getExtension('KHR_materials_emissive_strength')
  return {
    name: material.getName(),
    baseColorFactor: material.getBaseColorFactor(),
    metallicFactor: material.getMetallicFactor(),
    roughnessFactor: material.getRoughnessFactor(),
    emissiveFactor: material.getEmissiveFactor(),
    alphaMode: material.getAlphaMode(),
    alphaCutoff: material.getAlphaCutoff(),
    doubleSided: material.getDoubleSided(),
    extras: cloneExtras(material.getExtras()),
    baseColorTexture: textureBinding(material.getBaseColorTexture(), material.getBaseColorTextureInfo()),
    metallicRoughnessTexture: textureBinding(
      material.getMetallicRoughnessTexture(),
      material.getMetallicRoughnessTextureInfo(),
    ),
    normalTexture: {
      ...textureBinding(material.getNormalTexture(), material.getNormalTextureInfo()),
      scale: material.getNormalTextureInfo()?.getScale?.() ?? 1,
    },
    occlusionTexture: {
      ...textureBinding(material.getOcclusionTexture(), material.getOcclusionTextureInfo()),
      strength: material.getOcclusionTextureInfo()?.getStrength?.() ?? 1,
    },
    emissiveTexture: textureBinding(material.getEmissiveTexture(), material.getEmissiveTextureInfo()),
    extensions: {
      transmission: transmission ? {
        factor: transmission.getTransmissionFactor(),
        texture: textureBinding(transmission.getTransmissionTexture(), transmission.getTransmissionTextureInfo()),
      } : null,
      specular: specular ? {
        factor: specular.getSpecularFactor(),
        colorFactor: specular.getSpecularColorFactor(),
        texture: textureBinding(specular.getSpecularTexture(), specular.getSpecularTextureInfo()),
        colorTexture: textureBinding(specular.getSpecularColorTexture(), specular.getSpecularColorTextureInfo()),
      } : null,
      ior: ior ? ior.getIOR() : null,
      emissiveStrength: emissiveStrength ? emissiveStrength.getEmissiveStrength() : null,
      unlit: Boolean(material.getExtension('KHR_materials_unlit')),
    },
  }
}

function documentBounds(document) {
  const bounds = emptyBounds()
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const matrices = transformedInstanceMatrices(node, new Matrix4().fromArray(node.getWorldMatrix()))
    for (const primitive of mesh.listPrimitives()) {
      for (const matrix of matrices) expandReferencedPrimitiveBounds(bounds, primitive, matrix)
    }
  }
  return bounds
}

async function payloadMetrics(io, path) {
  const document = await io.read(path)
  let triangles = 0
  let draws = 0
  let meshNodes = 0
  let logicalInstances = 0
  let missingPosition = 0
  let missingNormal = 0
  let missingReferencedTexcoord = 0
  const attributes = new Set()
  const sourcePaths = []
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    if (typeof node.getExtras()?.iomPackageSourcePath === 'string') {
      sourcePaths.push(node.getExtras().iomPackageSourcePath)
    }
    const instances = instanceCount(node)
    meshNodes += 1
    logicalInstances += instances
    for (const primitive of mesh.listPrimitives()) {
      draws += 1
      triangles += triangleCount(primitive) * instances
      for (const semantic of primitive.listSemantics()) attributes.add(semantic)
      if (!primitive.getAttribute('POSITION')) missingPosition += 1
      if (!primitive.getAttribute('NORMAL')) missingNormal += 1
      const material = primitive.getMaterial()
      if (material) {
        for (const texCoord of textureCoordinatesForMaterial(material)) {
          if (Number.isInteger(texCoord) && !primitive.getAttribute(`TEXCOORD_${texCoord}`)) {
            missingReferencedTexcoord += 1
          }
        }
      }
    }
  }
  const materials = document.getRoot().listMaterials()
  const textures = document.getRoot().listTextures()
  const materialRoles = [...new Set(materials.map((material) => material.getExtras()?.iomMaterialRole).filter(Boolean))].sort()
  const doubleSidedReasons = [
    ...new Set(materials.map((material) => material.getExtras()?.iomDoubleSidedReason).filter(Boolean)),
  ].sort()
  const criticalNodes = document
    .getRoot()
    .listNodes()
    .map((node) => node.getName())
    .filter((name) => CRITICAL_NAMES.includes(name))
    .sort()
  const encodedTextureBytes = textures.reduce((sum, texture) => sum + (texture.getImage()?.byteLength || 0), 0)
  const gpuTextureBytes = textures.reduce((sum, texture) => {
    const image = texture.getImage()
    if (!image) return sum
    return sum + (ktx2DecodedRgba8Bytes(image) ?? image.byteLength * 4)
  }, 0)
  const roleValues = materials.map((material) => material.getExtras()?.iomMaterialRole).filter(Boolean)
  const reasonValues = materials.map((material) => material.getExtras()?.iomDoubleSidedReason).filter(Boolean)
  const alphaModes = materials.map((material) => material.getAlphaMode())
  const pbrSignatures = materials.map(materialPbrSignature).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  const file = await stat(path)
  return {
    sha256: await sha256File(path),
    triangles,
    draws,
    bytes: file.size,
    encodedTextureBytes,
    gpuTextureBytes,
    meshNodes,
    logicalInstances,
    materialCount: materials.length,
    textureCount: textures.length,
    ktx2Textures: textures.filter((texture) => texture.getMimeType() === 'image/ktx2').length,
    doubleSidedMaterials: materials.filter((material) => material.getDoubleSided()).length,
    materialRoles,
    materialRoleCounts: countStrings(roleValues),
    doubleSidedReasons,
    doubleSidedReasonCounts: countStrings(reasonValues),
    alphaModeCounts: countStrings(alphaModes),
    pbrMaterialSha256: createHash('sha256').update(JSON.stringify(pbrSignatures)).digest('hex'),
    criticalNodes,
    attributes: [...attributes].sort(),
    missingPosition,
    missingNormal,
    missingReferencedTexcoord,
    bounds: documentBounds(document),
    extensionsUsed: document.getRoot().listExtensionsUsed().map((extension) => extension.extensionName).sort(),
    sourcePathCount: sourcePaths.length,
    sourcePathsSha256: stringListSha256(sourcePaths),
    duplicateSourcePaths: sourcePaths.length - new Set(sourcePaths).size,
  }
}

function sourceSummary(analysis) {
  const bounds = emptyBounds()
  for (const node of descendants(analysis.owner)) {
    if (!node.getMesh()) continue
    const matrices = transformedInstanceMatrices(node, relativeNodeMatrix(analysis.owner, node))
    for (const primitive of node.getMesh().listPrimitives()) {
      const position = primitive.getAttribute('POSITION')
      if (position) for (const matrix of matrices) expandAccessorBounds(bounds, position, matrix)
    }
  }
  return {
    owner: OWNER_NAME,
    ownerLocalMatrix: IDENTITY_MATRIX,
    meshNodes: analysis.meshNodes,
    triangles: analysis.triangles,
    draws: analysis.draws,
    bounds,
    criticalNodes: CRITICAL_NAMES,
  }
}

function detachedSemanticOverlaySummary(document, owner) {
  const bounds = emptyBounds()
  const roles = []
  const materials = []
  let triangles = 0
  let draws = 0
  let logicalInstances = 0
  const nodes = document.getRoot().listNodes().filter((node) => {
    if (!node.getMesh() || isDescendantOf(node, owner)) return false
    return node.getMesh().listPrimitives().some((primitive) => primitive.getMaterial()?.getExtras()?.iomMaterialRole)
  })
  for (const node of nodes) {
    logicalInstances += instanceCount(node)
    const matrix = new Matrix4().fromArray(node.getWorldMatrix())
    for (const primitive of node.getMesh().listPrimitives()) {
      const role = primitive.getMaterial()?.getExtras()?.iomMaterialRole
      if (role) roles.push(role)
      const name = primitive.getMaterial()?.getName()
      if (name) materials.push(name)
      triangles += triangleCount(primitive) * instanceCount(node)
      draws += instanceCount(node)
      const position = primitive.getAttribute('POSITION')
      if (position) expandAccessorBounds(bounds, position, matrix)
    }
  }
  return {
    nodeCount: nodes.length,
    triangles,
    draws,
    logicalInstances,
    materialRoleCounts: countStrings(roles),
    materials: [...new Set(materials)].sort(),
    bounds: nodes.length ? bounds : { min: [null, null, null], max: [null, null, null] },
    ownerAssignment: 'unresolved-global-root-batches',
  }
}

function animationDurationSeconds(document) {
  let duration = 0
  for (const animation of document.getRoot().listAnimations()) {
    for (const sampler of animation.listSamplers()) {
      const input = sampler.getInput()?.getArray()
      if (input?.length) duration = Math.max(duration, input[input.length - 1])
    }
  }
  return duration
}

function sampleAnimationSampler(sampler, targetPath, time) {
  const input = sampler.getInput()?.getArray()
  const outputAccessor = sampler.getOutput()
  const output = outputAccessor?.getArray()
  const size = outputAccessor?.getElementSize() || 0
  if (!input?.length || !output || !size) throw new Error(`Animation sampler for ${targetPath} is incomplete`)
  const interpolation = sampler.getInterpolation() || 'LINEAR'
  if (interpolation === 'CUBICSPLINE') {
    throw new Error('CUBICSPLINE is not supported by the deterministic pilot transform sampler')
  }
  let right = input.findIndex((value) => value >= time)
  if (right < 0) right = input.length - 1
  let left = Math.max(0, right - 1)
  if (input[right] === time || right === 0) left = right
  const alpha = left === right || interpolation === 'STEP'
    ? 0
    : (time - input[left]) / Math.max(Number.EPSILON, input[right] - input[left])
  const a = Array.from(output.slice(left * size, left * size + size))
  if (!alpha) return a
  const b = Array.from(output.slice(right * size, right * size + size))
  if (targetPath === 'rotation') {
    return new Quaternion().fromArray(a).slerp(new Quaternion().fromArray(b), alpha).toArray()
  }
  return a.map((value, index) => value + (b[index] - value) * alpha)
}

function animationEvidence(document, ownerName) {
  const duration = animationDurationSeconds(document)
  const animations = document.getRoot().listAnimations()
  if (!animations.length || !(duration > 0)) throw new Error('Pilot source must contain a non-empty animation clip')
  const owner = findUniqueNode(document, ownerName)
  const sampleTimes = [0, duration * 0.5, duration]
  const ownerTransforms = []
  for (const animation of animations) {
    const ownerChannels = animation.listChannels().filter((channel) => channel.getTargetNode() === owner)
    if (!ownerChannels.length && !PROFILE.staticOwner) continue
    const samples = sampleTimes.map((timeSeconds) => {
      const translation = Array.from(owner.getTranslation())
      const rotation = Array.from(owner.getRotation())
      const scale = Array.from(owner.getScale())
      for (const channel of ownerChannels) {
        const value = sampleAnimationSampler(channel.getSampler(), channel.getTargetPath(), timeSeconds)
        if (channel.getTargetPath() === 'translation') translation.splice(0, translation.length, ...value)
        else if (channel.getTargetPath() === 'rotation') rotation.splice(0, rotation.length, ...value)
        else if (channel.getTargetPath() === 'scale') scale.splice(0, scale.length, ...value)
      }
      const matrix = new Matrix4().compose(
        new Vector3().fromArray(translation),
        new Quaternion().fromArray(rotation),
        new Vector3().fromArray(scale),
      ).toArray()
      return { timeSeconds, translation, rotation, scale, matrix }
    })
    ownerTransforms.push({ animation: animation.getName() || '(unnamed)', ownerChannelCount: ownerChannels.length, samples })
  }
  const ownerChannelCount = animations.reduce(
    (sum, animation) => sum + animation.listChannels().filter((channel) => channel.getTargetNode() === owner).length,
    0,
  )
  if (PROFILE.staticOwner && ownerChannelCount !== 0) {
    throw new Error(`${ownerName} is declared static but has ${ownerChannelCount} animation channels`)
  }
  if (!PROFILE.staticOwner && !ownerTransforms.length) throw new Error(`No animation channel targets ${ownerName}`)
  const clips = animations.map((animation) => ({
    name: animation.getName() || '(unnamed)',
    channels: animation.listChannels().length,
    durationSeconds: Math.max(
      0,
      ...animation.listSamplers().map((sampler) => {
        const input = sampler.getInput()?.getArray()
        return input?.length ? input[input.length - 1] : 0
      }),
    ),
  }))
  const digest = createHash('sha256').update(JSON.stringify(ownerTransforms)).digest('hex')
  return {
    animationDurationSeconds: duration,
    clipCount: animations.length,
    channelCount: clips.reduce((sum, clip) => sum + clip.channels, 0),
    clips,
    ownerName,
    ownerAnimated: ownerChannelCount > 0,
    ownerChannelCount,
    ownerTransforms,
    ownerTransformSamplesSha256: digest,
  }
}

function assertAnimationEvidenceMatches(source, output, tolerance = 1e-6) {
  if (Math.abs(source.animationDurationSeconds - output.animationDurationSeconds) > tolerance) {
    throw new Error(
      `Rig duration changed from ${source.animationDurationSeconds} to ${output.animationDurationSeconds}`,
    )
  }
  if (source.clipCount !== output.clipCount || source.channelCount !== output.channelCount) {
    throw new Error(
      `Rig clip/channel count changed from ${source.clipCount}/${source.channelCount} to ` +
      `${output.clipCount}/${output.channelCount}`,
    )
  }
  if (source.ownerAnimated !== output.ownerAnimated || source.ownerChannelCount !== output.ownerChannelCount) {
    throw new Error(`Rig ${OWNER_NAME} static/animated owner contract changed`)
  }
  const sourceValues = source.ownerTransforms.flatMap((entry) =>
    entry.samples.flatMap((sample) => [sample.timeSeconds, ...sample.matrix]),
  )
  const outputValues = output.ownerTransforms.flatMap((entry) =>
    entry.samples.flatMap((sample) => [sample.timeSeconds, ...sample.matrix]),
  )
  if (
    sourceValues.length !== outputValues.length ||
    sourceValues.some((value, index) => Math.abs(value - outputValues[index]) > tolerance)
  ) {
    throw new Error(`Rig ${OWNER_NAME} transform samples changed at t=0/mid/end`)
  }
}

function namedRepeatedMeshTarget(document, meshName) {
  const nodes = document.getRoot().listNodes().filter((node) => node.getMesh()?.getName() === meshName)
  if (!nodes.length) throw new Error(`Cleaned-source hotspot mesh ${meshName} was not found`)
  const meshes = [...new Set(nodes.map((node) => node.getMesh()))]
  if (meshes.length !== 1) throw new Error(`${meshName} resolves to ${meshes.length} mesh objects`)
  const mesh = meshes[0]
  const trianglesPerInstance = mesh.listPrimitives().reduce((sum, primitive) => sum + triangleCount(primitive), 0)
  const attributes = [...new Set(mesh.listPrimitives().flatMap((primitive) => primitive.listSemantics()))].sort()
  const ownerNames = [...new Set(nodes.map((node) => {
    let current = node
    while (current && !/_anim1$/.test(current.getName() || '')) current = current.getParentNode()
    return current?.getName() || '(unresolved)'
  }))].sort()
  return {
    id: 'ground-floor-repeated-hall-furniture',
    priority: 'immediate-second-expansion-target',
    status: `outside-${PROFILE.slug}-pilot`,
    sourceMesh: meshName,
    ownerNames,
    instances: nodes.length,
    trianglesPerInstance,
    expandedTriangles: trianglesPerInstance * nodes.length,
    materialSlots: mesh.listPrimitives().length,
    materials: mesh.listPrimitives().map((primitive) => primitive.getMaterial()?.getName() || '(none)'),
    attributes,
    nodeNameRange: [nodes[0].getName(), nodes[nodes.length - 1].getName()],
    requiredTreatment: 'Create a shared low-poly chair-table asset, retain all 4 material slots, add UV0 only if an atlas is introduced, and instance it; do not generic-decimate the floor.',
  }
}

function fireHoseOwnershipProvenance(cleanedDocument, variants) {
  const sourceNodes = cleanedDocument.getRoot().listNodes().filter((node) =>
    /^FireHoseHousing(?:00[1-9])?$/.test(node.getName() || ''),
  )
  if (sourceNodes.length !== 10) throw new Error(`Expected 10 cleaned FireHoseHousing nodes, found ${sourceNodes.length}`)
  const sourceOwnerNames = [...new Set(sourceNodes.map((node) => {
    let current = node
    while (current && !/_anim1$/.test(current.getName() || '')) current = current.getParentNode()
    return current?.getName() || '(unresolved)'
  }))].sort()
  const sourceMeshes = [...new Set(sourceNodes.map((node) => node.getMesh()?.getName()).filter(Boolean))].sort()
  const sourceMaterials = [...new Set(sourceNodes.flatMap((node) =>
    node.getMesh()?.listPrimitives().map((primitive) => primitive.getMaterial()?.getName()).filter(Boolean) || [],
  ))].sort()
  const sourceTranslations = sourceNodes.map((node) => node.getWorldTranslation())

  const variantEvidence = Object.fromEntries(Object.entries(variants).map(([variant, document]) => {
    const owner = findUniqueNode(document, 'Ground Floor._anim1')
    const allBatches = document.getRoot().listNodes().filter((node) =>
      node.getMesh()?.listPrimitives().some(
        (primitive) => primitive.getMaterial()?.getExtras()?.iomMaterialRole,
      ),
    )
    const detachedBatches = allBatches.filter((node) => !isDescendantOf(node, owner))
    const ownedBatches = allBatches.filter((node) => isDescendantOf(node, owner))
    const translationAccessor = allBatches[0]?.getExtension('EXT_mesh_gpu_instancing')?.getAttribute?.('TRANSLATION')
    const array = translationAccessor?.getArray()
    const batchTranslations = array
      ? Array.from({ length: translationAccessor.getCount() }, (_, index) => Array.from(array.slice(index * 3, index * 3 + 3)))
      : []
    const remaining = new Set(batchTranslations.map((_, index) => index))
    let maxTranslationErrorMeters = 0
    for (const source of sourceTranslations) {
      let bestIndex = -1
      let bestDistance = Infinity
      for (const index of remaining) {
        const target = batchTranslations[index]
        const distance = Math.hypot(source[0] - target[0], source[1] - target[1], source[2] - target[2])
        if (distance < bestDistance) {
          bestDistance = distance
          bestIndex = index
        }
      }
      if (bestIndex >= 0) remaining.delete(bestIndex)
      maxTranslationErrorMeters = Math.max(maxTranslationErrorMeters, bestDistance)
    }
    const ownerAnimated = document.getRoot().listAnimations().some((animation) =>
      animation.listChannels().some((channel) => channel.getTargetNode() === owner),
    )
    return [variant, {
      rootBatchCount: detachedBatches.length,
      ownedBatchCount: ownedBatches.length,
      instancesPerBatch: translationAccessor?.getCount() || 0,
      identifyingMaterials: allBatches.map((node) => node.getMesh().listPrimitives()[0].getMaterial()?.getName()).sort(),
      maxTranslationErrorMeters,
      groundFloorOwnerAnimatedInCurrentClip: ownerAnimated,
      groundFloorOwnerRestMatrix: owner.getMatrix(),
    }]
  }))
  return {
    cleanedSourceNodes: sourceNodes.map((node) => node.getName()).sort(),
    cleanedSourceOwnerNames: sourceOwnerNames,
    cleanedSharedMeshes: sourceMeshes,
    cleanedMaterialSlots: sourceMaterials,
    intendedOwner: 'Ground Floor._anim1',
    variantEvidence,
    currentProductionPlacementConclusion:
      'No visible animation displacement is proven in the current clip because Ground Floor._anim1 is not animated and its rest matrix is identity.',
    safestFix: PROFILE.slug === 'ground-floor'
      ? 'Use only the pinned ownership-corrected preprocessing GLBs for this disabled candidate; keep all six role-tagged batches exclusively in the persistent Ground Floor fire-safety package and do not reparent them again.'
      : `Reparent all six role-tagged instanced batches under Ground Floor._anim1 while preserving world transforms; include them in the future Ground Floor package. Do not add them to the ${PROFILE.title.toLowerCase()} package.`,
  }
}

async function buildRig(sourceDocument, outPath, sourceEvidence) {
  const document = cloneDocument(sourceDocument)
  const root = document.getRoot()
  const keep = new Set()
  for (const animation of root.listAnimations()) {
    for (const channel of animation.listChannels()) {
      let node = channel.getTargetNode()
      while (node) {
        keep.add(node)
        node = node.getParentNode()
      }
    }
  }
  if (PROFILE.staticOwner) {
    let node = findUniqueNode(document, OWNER_NAME)
    while (node) {
      keep.add(node)
      node = node.getParentNode()
    }
  }
  for (const node of [...root.listNodes()]) if (!keep.has(node)) node.dispose()
  for (const mesh of [...root.listMeshes()]) mesh.dispose()
  for (const texture of [...root.listTextures()]) texture.dispose()
  await document.transform(prune({ keepExtras: true, keepLeaves: Boolean(PROFILE.staticOwner) }))
  const io = await createGltfIO({ encoder: true })
  await io.write(outPath, document)
  const outputDocument = await io.read(outPath)
  const outputEvidence = animationEvidence(outputDocument, OWNER_NAME)
  assertAnimationEvidenceMatches(sourceEvidence, outputEvidence)
  const file = await stat(outPath)
  return {
    url: relative(dirname(outPath), outPath).replaceAll('\\', '/'),
    sha256: await sha256File(outPath),
    bytes: file.size,
    animationDurationSeconds: outputEvidence.animationDurationSeconds,
    clipCount: outputEvidence.clipCount,
    channelCount: outputEvidence.channelCount,
    ownerAnimated: outputEvidence.ownerAnimated,
    ownerChannelCount: outputEvidence.ownerChannelCount,
    ownerTransformSamplesSha256: outputEvidence.ownerTransformSamplesSha256,
    sourceOwnerTransformSamplesSha256: sourceEvidence.ownerTransformSamplesSha256,
    transformSampleMatch: true,
    transformSamples: outputEvidence.ownerTransforms,
  }
}

function aggregate(packages, variant) {
  return packages.reduce(
    (sum, pkg) => {
      const metrics = pkg.variants[variant].lod0.metrics
      sum.triangles += metrics.triangles
      sum.draws += metrics.draws
      sum.bytes += metrics.bytes
      sum.encodedTextureBytes += metrics.encodedTextureBytes
      sum.gpuTextureBytes += metrics.gpuTextureBytes
      return sum
    },
    { triangles: 0, draws: 0, bytes: 0, encodedTextureBytes: 0, gpuTextureBytes: 0 },
  )
}

async function writeShellCandidate(io, out, sources, analyses, selections, maxTriangles) {
  const variants = {}
  for (const variant of ['web', 'quest']) {
    const output = join(out, 'hlod', variant, `${PROFILE.slug}-shell-hlod.glb`)
    const selection = selections[variant]
    await writeRawPackage(
      io,
      sources[variant],
      analyses[variant],
      selection.units,
      SHELL_ID,
      output,
    )
    const metrics = await payloadMetrics(io, output)
    if (metrics.triangles !== selection.triangles) {
      throw new Error(`${variant}: shell source-to-output triangle count changed`)
    }
    if (metrics.triangles > maxTriangles) throw new Error(`${variant}: shell exceeds ${maxTriangles} triangles`)
    if (metrics.missingPosition || metrics.missingNormal || metrics.missingReferencedTexcoord) {
      throw new Error(`${variant}: shell lost required geometry attributes`)
    }
    if (metrics.duplicateSourcePaths || metrics.sourcePathCount !== selection.paths.length ||
      metrics.sourcePathsSha256 !== stringListSha256(selection.paths)) {
      throw new Error(`${variant}: shell source ownership differs from the selected structural paths`)
    }
    if (Object.keys(metrics.alphaModeCounts).some((mode) => mode !== 'OPAQUE')) {
      throw new Error(`${variant}: shell contains a non-opaque material`)
    }
    variants[variant] = {
      url: relative(out, output).replaceAll('\\', '/'),
      sha256: metrics.sha256,
      bounds: { space: 'owner-local', min: metrics.bounds.min, max: metrics.bounds.max },
      metrics,
    }
  }
  return {
    id: SHELL_ID,
    kind: 'always-resident-shell',
    residency: 'persistent-lossless',
    ownerId: OWNER_ID,
    transform: { space: 'owner-local', matrix: IDENTITY_MATRIX },
    semanticRoles: ['architectural-shell', 'interior', 'stair', 'structural-envelope'],
    requiredAttributes: REQUIRED_ATTRIBUTES,
    sourcePaths: {
      web: selections.web.paths,
      quest: selections.quest.paths,
    },
    content: Object.fromEntries(['web', 'quest'].map((variant) => [variant, {
      ownershipStage: 'lossless-source-subset',
      sourcePathCount: selections[variant].paths.length,
      sourcePathsSha256: stringListSha256(selections[variant].paths),
    }])),
    selectionBounds: Object.fromEntries(['web', 'quest'].map((variant) => [variant, {
      space: 'owner-local',
      min: variants[variant].metrics.bounds.min,
      max: variants[variant].metrics.bounds.max,
    }])),
    variants,
    selectionEvidence: Object.fromEntries(['web', 'quest'].map((variant) => [variant, {
      method: 'deterministic-lossless-opaque-structural-source-subset-v1',
      evaluatedUnits: selections[variant].evaluatedUnits,
      eligibleUnits: selections[variant].eligibleUnits,
      selectedUnits: selections[variant].units.length,
      selectedTriangles: selections[variant].triangles,
      selectedDraws: selections[variant].draws,
      rejectionCounts: selections[variant].rejectionCounts,
      records: selections[variant].records,
    }])),
  }
}

function handoffMarkdown(index) {
  const rows = index.packages
    .map((pkg) => {
      const web = pkg.variants.web.lod0.metrics
      return `| \`${pkg.id}\` | ${pkg.residency} | ${web.triangles.toLocaleString()} | ${web.draws} |`
    })
    .join('\n')
  const shellBuilt = index.shellCompletion?.candidateBuilt === true
  const criticalGuidance = CRITICAL_NAMES.length
    ? `- Keep the critical package (${CRITICAL_NAMES.join(', ')}) exact, persistent, and LOD0-only.\n`
    : CRITICAL_MATERIAL_ROLE_PREFIX
      ? `- Keep the six ownership-corrected fire-safety material batches exact, instanced, persistent, and LOD0-only.\n`
    : `- This owner has no profile-declared persistent critical subtree; all detail packages remain lossless streamed LOD0.\n`
  const criticalWork = HAS_CRITICAL_PACKAGE
    ? `3. Preserve the profile-declared persistent critical package exactly and keep it disjoint from shell and streamed detail ownership.\n`
    : `3. Preserve every profile-declared persistent critical subtree exactly; none are declared for this profile.\n`
  const fireSafetyHandoff = PROFILE.slug === 'ground-floor'
    ? `The selected packaging inputs contain zero detached fire-safety batches. The six corrected mesh batches, representing 60 logical instances, are already below \`${OWNER_NAME}\` and are owned only by the persistent \`${CRITICAL_PACKAGE_ID}\` payload. The preprocessing sidecar maps all 60 original production primitive-instance IDs to their corrected owner paths with zero node and per-instance world-matrix drift. Do not reparent them again; verify the pinned sidecar before every rebuild.\n\n`
    : `The current release also contains ${index.source.detachedSemanticOverlays.web.nodeCount} Web / ` +
      `${index.source.detachedSemanticOverlays.quest.nodeCount} Quest global root batches carrying fire-safety material roles ` +
      `(${index.source.detachedSemanticOverlays.web.triangles.toLocaleString()} / ` +
      `${index.source.detachedSemanticOverlays.quest.triangles.toLocaleString()} expanded triangles). Cleaned-source provenance ` +
      `maps all 10 instances to \`${index.source.detachedSemanticOverlays.provenance.intendedOwner}\` as ` +
      `\`${index.source.detachedSemanticOverlays.provenance.cleanedSourceNodes.join('`, `')}\`. They are not ${PROFILE.title.toLowerCase()} content. ` +
      `The current clip does not animate Ground Floor and its rest transform is identity, so no present visual displacement is proven; ` +
      `the defect is ownership/streaming correctness. Reparent the six instanced batches under Ground Floor while preserving world ` +
      `transforms, include them in the future Ground Floor package, and rerun the audit.\n\n`
  return `# ${PROFILE.title} shell/detail streaming DCC handoff\n\n` +
    (shellBuilt
      ? `Status: **lossless, ownership-disjoint shell candidate built; visual approval is required**.\n\n`
      : `Status: **lossless detail packages complete; one two-variant shell and visual approval are required**.\n\n`) +
    `This pilot is disabled and is not referenced by the production model manifest. ` +
    `Far nonstructural detail is intentionally omitted while one disjoint persistent architectural shell retains structural coverage. Per-detail HLOD is not required. ` +
    `Automatic global decimation was intentionally rejected because the source contains open architectural shells, ` +
    `mirrored CAD parts and open or single-sided surfaces whose faces must not disappear.\n\n` +
    `## Owner and coordinate contract\n\n` +
    `- Animation owner: \`${OWNER_NAME}\`.\n` +
    `- Every input GLB is already in owner-local metres with an identity package transform.\n` +
    `- Do not apply or bake the animated owner's transform into geometry.\n` +
    criticalGuidance + `\n` +
    `## Required DCC work\n\n` +
    (shellBuilt
      ? `1. Review the generated lossless source-subset shell from exterior, interior, opposite-sided, stair, and connector cameras.\n` +
        `2. If coverage is insufficient, revise the exact source path selection without overlapping detail ownership; do not decimate or invent proxy boxes blindly.\n`
      : `1. Import the Web owner source as reference in Blender 5.2 or the approved 3ds Max/V-Ray workflow.\n` +
        `2. Author one opaque ${PROFILE.title.toLowerCase()} shell below 150,000 triangles in both Web and Quest variants. Its source ownership must be disjoint from every detail package; furniture and transparent panes do not belong in the shell.\n`) +
    criticalWork +
    `4. Preserve POSITION, NORMAL, referenced UV sets, material assignments, alpha behavior, and all IOM semantic extras.\n` +
    `5. Keep wall/facade/open-shell sidedness visually equivalent from opposing interior and exterior cameras.\n` +
    `6. Export the shell to the exact two paths in \`shellCompletion.requiredAlwaysResidentShell.outputs\`.\n` +
    `7. Run \`node scripts/audit-first-floor-package-pilot.mjs ${index.artifactDirectory}/detail-package-index.json --profile ${PROFILE.slug} --require-shell\`.\n` +
    `8. Complete multi-angle browser image review before a final manifest-v3 is emitted or enabled.\n\n` +
    `## Regional HLOD\n\n` +
    `Regional HLOD activation is currently disabled. Do not author one until the contract declares the exact detail packages it replaces and the runtime can hide/restore those sources atomically. The disjoint persistent shell remains the approved far-field path.\n\n` +
    `## Detached fire-safety correction batches\n\n` +
    fireSafetyHandoff +
    `## Immediate second expansion target\n\n` +
    `The cleaned source contains \`${index.nextPhaseTargets[0].instances}\` instances of ` +
    `\`${index.nextPhaseTargets[0].sourceMesh}\` under \`${index.nextPhaseTargets[0].ownerNames.join(', ')}\`: ` +
    `\`${index.nextPhaseTargets[0].trianglesPerInstance.toLocaleString()}\` triangles each, or ` +
    `\`${index.nextPhaseTargets[0].expandedTriangles.toLocaleString()}\` expanded triangles. ` +
    `This Ground Floor chair/table family is outside the present ${PROFILE.title.toLowerCase()} pilot and remains a selective ` +
    `shared-mesh/instancing LOD target after this pilot passes. Retain its ` +
    `\`${index.nextPhaseTargets[0].materialSlots}\` material slots; the cleaned mesh has no UV0, so create UV0 only if the DCC result introduces an atlas.\n\n` +
    `## Per-package Web LOD0 inventory\n\n` +
    `| Package | Residency | LOD0 tris | LOD0 draws |\n` +
    `|---|---|---:|---:|\n${rows}\n\n` +
    `The exact numerical targets, coverage cells, and SHA-256 hashes are machine-readable in \`detail-package-index.json\`.\n`
}

async function main() {
  const args = parseArgs(process.argv)
  await Promise.all([
    access(args.webInput),
    access(args.questInput),
    access(args.cleanedSource),
    access(GLTFPACK_BINARY),
    ...(PROFILE.productionInputs ? [
      access(PROFILE.productionInputs.web),
      access(PROFILE.productionInputs.quest),
      access(PROFILE.preprocessingReport),
      access(PROFILE.ownershipMigration),
    ] : []),
  ])
  const preprocessing = await groundPreprocessingEvidence(resolve(args.out), args)

  const io = await createGltfIO({ encoder: true })
  console.log('Reading release variants and cleaned-source provenance…')
  const [webDocument, questDocument, cleanedDocument] = await Promise.all([
    io.read(args.webInput),
    io.read(args.questInput),
    io.read(args.cleanedSource),
  ])
  const webAnimation = animationEvidence(webDocument, OWNER_NAME)
  const questAnimation = animationEvidence(questDocument, OWNER_NAME)
  assertAnimationEvidenceMatches(webAnimation, questAnimation)
  const cleanedAnimationDurationSeconds = animationDurationSeconds(cleanedDocument)
  const repeatedHallFurniture = namedRepeatedMeshTarget(cleanedDocument, 'Mesh.13786')

  const cleanedOwner = findUniqueNode(cleanedDocument, OWNER_NAME)
  const cleanedBounds = emptyBounds()
  let cleanedMeshes = 0
  let cleanedTriangles = 0
  for (const node of descendants(cleanedOwner)) {
    if (!node.getMesh()) continue
    cleanedMeshes += 1
    const matrix = relativeNodeMatrix(cleanedOwner, node)
    for (const primitive of node.getMesh().listPrimitives()) {
      cleanedTriangles += triangleCount(primitive)
      const position = primitive.getAttribute('POSITION')
      if (position) expandAccessorBounds(cleanedBounds, position, matrix)
    }
  }

  const provisionalGrid = { originX: 0, originZ: 0, cellSize: args.cellSize }
  const webProbe = analyzeOwner(webDocument, provisionalGrid)
  const grid = {
    originX: Math.floor(webProbe.bounds.min[0] / args.cellSize) * args.cellSize,
    originZ: Math.floor(webProbe.bounds.min[2] / args.cellSize) * args.cellSize,
    cellSize: args.cellSize,
  }
  const web = analyzeOwner(webDocument, grid)
  const quest = analyzeOwner(questDocument, grid)
  const shellSelections = args.shellCandidate ? harmonizeDetailCellCoverage(
    { web, quest },
    {
      web: selectOpaqueShellUnits(web, args.shellMaxTriangles),
      quest: selectOpaqueShellUnits(quest, args.shellMaxTriangles),
    },
  ) : null
  const webShellPaths = new Set(shellSelections?.web.paths || [])
  const questShellPaths = new Set(shellSelections?.quest.paths || [])
  const detailWeb = shellSelections
    ? { ...web, units: web.units.filter((unit) => !unit.paths.some((path) => webShellPaths.has(path))) }
    : web
  const detailQuest = shellSelections
    ? { ...quest, units: quest.units.filter((unit) => !unit.paths.some((path) => questShellPaths.has(path))) }
    : quest
  const detachedSemanticOverlays = {
    web: detachedSemanticOverlaySummary(webDocument, web.owner),
    quest: detachedSemanticOverlaySummary(questDocument, quest.owner),
    provenance: fireHoseOwnershipProvenance(cleanedDocument, { web: webDocument, quest: questDocument }),
  }
  const limits = { maxTriangles: args.maxTriangles, maxDraws: args.maxDraws }
  const plan = args.partition === 'material-aware'
    ? createMaterialAwarePackagePlan(detailWeb, detailQuest, limits, args.maxClusterSpanCells)
    : createPackagePlan(detailWeb, detailQuest, limits)
  const planSummary = plan.map((pkg) => ({
    id: pkg.id,
    cell: pkg.cell,
    coverageCells: pkg.coverageCells ?? (pkg.cell ? [[pkg.cell[0], pkg.cell[2]]] : []),
    mergeEvidence: pkg.mergeEvidence ?? [],
    web: {
      units: pkg.webUnits.length,
      triangles: pkg.webUnits.reduce((sum, unit) => sum + unit.triangles, 0),
      draws: pkg.webUnits.reduce((sum, unit) => sum + unit.draws, 0),
      dependencies: dependencySummaryForUnits(pkg.webUnits),
    },
    quest: {
      units: pkg.questUnits.length,
      triangles: pkg.questUnits.reduce((sum, unit) => sum + unit.triangles, 0),
      draws: pkg.questUnits.reduce((sum, unit) => sum + unit.draws, 0),
      dependencies: dependencySummaryForUnits(pkg.questUnits),
    },
  }))
  console.log(JSON.stringify({
    grid,
    shellCandidate: shellSelections ? {
      web: { paths: shellSelections.web.paths.length, triangles: shellSelections.web.triangles, draws: shellSelections.web.draws },
      quest: { paths: shellSelections.quest.paths.length, triangles: shellSelections.quest.triangles, draws: shellSelections.quest.draws },
    } : null,
    packages: planSummary,
    aggregate: { web: sourceSummary(web), quest: sourceSummary(quest) },
  }, null, 2))
  if (args.planOnly) return

  const allowedRoot = resolve(VIEWER_ROOT, 'tmp') + sep
  const out = resolve(args.out)
  if (!out.startsWith(allowedRoot) || out === resolve(VIEWER_ROOT, 'tmp')) {
    throw new Error(`Output must be a dedicated directory below ${resolve(VIEWER_ROOT, 'tmp')}`)
  }
  if (await exists(out)) {
    if (!args.force) throw new Error(`Output already exists: ${out} (use --force to rebuild this tmp artifact)`)
    await rm(out, { recursive: true, force: true })
  }
  await mkdir(out, { recursive: true })

  const shellRecord = shellSelections
    ? await writeShellCandidate(
      io,
      out,
      { web: webDocument, quest: questDocument },
      { web, quest },
      shellSelections,
      args.shellMaxTriangles,
    )
    : null

  console.log(`Writing ${plan.length} owner-local packages per variant…`)
  const packageRecords = []
  for (let index = 0; index < plan.length; index += 1) {
    const pkg = plan[index]
    console.log(`  [${index + 1}/${plan.length}] ${pkg.id}`)
    const rawWeb = join(out, 'dcc-source', 'web', `${pkg.id}.glb`)
    const rawQuest = join(out, 'dcc-source', 'quest', `${pkg.id}.glb`)
    const webOut = join(out, 'web', `${pkg.id}-lod0.glb`)
    const questOut = join(out, 'quest', `${pkg.id}-lod0.glb`)
    await writeRawPackage(io, webDocument, web, pkg.webUnits, pkg.id, rawWeb)
    await writeRawPackage(io, questDocument, quest, pkg.questUnits, pkg.id, rawQuest)
    const [rawWebMetrics, rawQuestMetrics] = await Promise.all([
      payloadMetrics(io, rawWeb),
      payloadMetrics(io, rawQuest),
    ])
    await mkdir(dirname(webOut), { recursive: true })
    await mkdir(dirname(questOut), { recursive: true })
    // The direct NodeIO output is already meshopt/KTX2-compressed. A tested
    // gltfpack 1.2 repack removed semantic nodes and 402/320 zero-area source
    // triangles from Web/Quest, so this surface-correctness pilot retains the
    // direct export byte-for-byte instead of accepting any topology drift.
    await copyFile(rawWeb, webOut)
    await copyFile(rawQuest, questOut)
    const [webMetrics, questMetrics] = await Promise.all([
      payloadMetrics(io, webOut),
      payloadMetrics(io, questOut),
    ])
    const webSourcePaths = pkg.webUnits.flatMap((unit) => unit.paths).sort()
    const questSourcePaths = pkg.questUnits.flatMap((unit) => unit.paths).sort()
    if (webMetrics.triangles > args.maxTriangles || questMetrics.triangles > args.maxTriangles) {
      throw new Error(`${pkg.id}: compressed detail payload exceeds ${args.maxTriangles} triangles`)
    }
    if (webMetrics.missingPosition || webMetrics.missingNormal || webMetrics.missingReferencedTexcoord) {
      throw new Error(`${pkg.id}: Web detail payload lost required geometry attributes`)
    }
    if (questMetrics.missingPosition || questMetrics.missingNormal || questMetrics.missingReferencedTexcoord) {
      throw new Error(`${pkg.id}: Quest detail payload lost required geometry attributes`)
    }
    if (
      rawWebMetrics.duplicateSourcePaths ||
      rawWebMetrics.sourcePathCount !== webSourcePaths.length ||
      rawWebMetrics.sourcePathsSha256 !== stringListSha256(webSourcePaths)
    ) {
      throw new Error(`${pkg.id}: Web DCC source ownership does not match the package plan`)
    }
    if (
      rawQuestMetrics.duplicateSourcePaths ||
      rawQuestMetrics.sourcePathCount !== questSourcePaths.length ||
      rawQuestMetrics.sourcePathsSha256 !== stringListSha256(questSourcePaths)
    ) {
      throw new Error(`${pkg.id}: Quest DCC source ownership does not match the package plan`)
    }
    const critical = pkg.id === CRITICAL_PACKAGE_ID
    packageRecords.push({
      id: pkg.id,
      kind: 'detail',
      residency: critical ? 'persistent-lossless' : 'streamed',
      ...(critical ? {} : {
        streaming: { lod0MarginMeters: 12 },
        farBehavior: 'intentional-nonstructural-omission',
      }),
      ownerId: OWNER_ID,
      cell: pkg.cell,
      coverageCells: pkg.coverageCells ?? (pkg.cell ? [[pkg.cell[0], pkg.cell[2]]] : []),
      partitionEvidence: pkg.mergeEvidence ?? [],
      transform: { space: 'owner-local', matrix: IDENTITY_MATRIX },
      selectionBounds: {
        web: { space: 'owner-local', min: webMetrics.bounds.min, max: webMetrics.bounds.max },
        quest: { space: 'owner-local', min: questMetrics.bounds.min, max: questMetrics.bounds.max },
      },
      semanticRoles: [...new Set([...rolesForUnits(pkg.webUnits), ...rolesForUnits(pkg.questUnits)])].sort(),
      sourcePaths: { web: webSourcePaths, quest: questSourcePaths },
      requiredAttributes: REQUIRED_ATTRIBUTES,
      content: {
        web: {
          ownershipStage: 'dcc-source',
          sourcePathCount: webSourcePaths.length,
          sourcePathsSha256: stringListSha256(webSourcePaths),
        },
        quest: {
          ownershipStage: 'dcc-source',
          sourcePathCount: questSourcePaths.length,
          sourcePathsSha256: stringListSha256(questSourcePaths),
        },
      },
      variants: {
        web: {
          lod0: {
            url: relative(out, webOut).replaceAll('\\', '/'),
            sha256: webMetrics.sha256,
            bounds: { space: 'owner-local', min: webMetrics.bounds.min, max: webMetrics.bounds.max },
            metrics: webMetrics,
          },
        },
        quest: {
          lod0: {
            url: relative(out, questOut).replaceAll('\\', '/'),
            sha256: questMetrics.sha256,
            bounds: { space: 'owner-local', min: questMetrics.bounds.min, max: questMetrics.bounds.max },
            metrics: questMetrics,
          },
        },
      },
      dccSources: {
        web: {
          url: relative(out, rawWeb).replaceAll('\\', '/'),
          sha256: rawWebMetrics.sha256,
          metrics: rawWebMetrics,
        },
        quest: {
          url: relative(out, rawQuest).replaceAll('\\', '/'),
          sha256: rawQuestMetrics.sha256,
          metrics: rawQuestMetrics,
        },
      },
    })
  }

  const residentTriangleBudgets = PROFILE.residentTriangleBudgets
  const maxAlwaysResidentShellTriangles = args.shellMaxTriangles
  const criticalPackage = packageRecords.find((pkg) => pkg.id === CRITICAL_PACKAGE_ID)
  const detailSourcePaths = Object.fromEntries(['web', 'quest'].map((variant) => {
    const paths = packageRecords.flatMap((pkg) => pkg.sourcePaths[variant]).sort()
    if (new Set(paths).size !== paths.length) {
      throw new Error(`${variant}: detail packages contain duplicate global source ownership paths`)
    }
    return [variant, paths]
  }))
  const completeSourcePaths = Object.fromEntries(['web', 'quest'].map((variant) => {
    const shellPaths = shellRecord?.sourcePaths?.[variant] || []
    const paths = [...detailSourcePaths[variant], ...shellPaths].sort()
    if (new Set(paths).size !== paths.length) {
      throw new Error(`${variant}: shell and detail source ownership overlap`)
    }
    const sourcePaths = (variant === 'web' ? web : quest).units.flatMap((unit) => unit.paths).sort()
    if (JSON.stringify(paths) !== JSON.stringify(sourcePaths)) {
      throw new Error(`${variant}: shell plus detail ownership does not exactly cover the source owner`)
    }
    return [variant, paths]
  }))
  const persistentTriangleTargets = Object.fromEntries(['web', 'quest'].map((variant) => {
    const criticalTriangles = criticalPackage?.variants?.[variant]?.lod0?.metrics?.triangles || 0
    const withMaxShellTriangles = criticalTriangles + maxAlwaysResidentShellTriangles
    if (withMaxShellTriangles > residentTriangleBudgets[variant]) {
      throw new Error(
        `${variant}: persistent critical LOD0 plus shell cap require ${withMaxShellTriangles} triangles, ` +
        `over resident budget ${residentTriangleBudgets[variant]}`,
      )
    }
    return [variant, { criticalTriangles, withMaxShellTriangles }]
  }))

  const rigPath = join(out, 'rig.glb')
  const rig = await buildRig(webDocument, rigPath, webAnimation)
  rig.url = relative(out, rigPath).replaceAll('\\', '/')
  rig.owners = [{ id: OWNER_ID, nodeName: OWNER_NAME, persistent: true }]

  const index = {
    schema: 'IOM_OWNER_LOCAL_DETAIL_PACKAGE_PILOT',
    version: 1,
    contractTarget: 3,
    enabled: false,
    status: shellRecord
      ? 'disabled-lossless-shell-candidate-complete-visual-review-required'
      : 'detail-packages-complete-shell-dcc-required',
    modelId: shellRecord
      ? `icm-anim-2025-${PROFILE.slug}-shell-candidate`
      : args.partition === 'material-aware'
      ? `icm-anim-2025-${PROFILE.slug}-coalesced-pilot`
      : `icm-anim-2025-${PROFILE.slug}-pilot`,
    packageProfile: {
      id: PROFILE.slug,
      title: PROFILE.title,
      ownerName: OWNER_NAME,
      ownerId: OWNER_ID,
      criticalNames: CRITICAL_NAMES,
      criticalMaterialRolePrefix: CRITICAL_MATERIAL_ROLE_PREFIX,
      criticalRequiredRoles: CRITICAL_REQUIRED_ROLES,
      staticOwner: Boolean(PROFILE.staticOwner),
      criticalPackageId: HAS_CRITICAL_PACKAGE ? CRITICAL_PACKAGE_ID : null,
      shellId: SHELL_ID,
    },
    artifactDirectory: relative(VIEWER_ROOT, out).replaceAll('\\', '/'),
    units: 'meters',
    detailOwnership: {
      web: {
        mode: 'disjoint-additive',
        pathCount: detailSourcePaths.web.length,
        pathsSha256: stringListSha256(detailSourcePaths.web),
        status: shellRecord ? 'complete-repartitioned-disjoint-from-shell' : 'partial-until-shell-source-paths-are-authored',
      },
      quest: {
        mode: 'disjoint-additive',
        pathCount: detailSourcePaths.quest.length,
        pathsSha256: stringListSha256(detailSourcePaths.quest),
        status: shellRecord ? 'complete-repartitioned-disjoint-from-shell' : 'partial-until-shell-source-paths-are-authored',
      },
    },
    ...(shellRecord ? {
      completeOwnership: Object.fromEntries(['web', 'quest'].map((variant) => [variant, {
        mode: 'disjoint-additive',
        pathCount: completeSourcePaths[variant].length,
        pathsSha256: stringListSha256(completeSourcePaths[variant]),
        components: [SHELL_ID, 'detail-packages'],
      }])),
    } : {}),
    packaging: {
      method: 'gltf-transform-direct-meshopt-preserve-hierarchy',
      partition: args.partition,
      baseCellSizeMeters: args.cellSize,
      maxClusterSpanCells: args.partition === 'material-aware' ? args.maxClusterSpanCells : 1,
      maxClusterNominalSpanMeters: args.cellSize *
        (args.partition === 'material-aware' ? args.maxClusterSpanCells : 1),
      planSha256: createHash('sha256').update(JSON.stringify(planSummary)).digest('hex'),
      topologyPolicy: 'exact-expanded-triangle-conservation',
      evaluatedGltfpack: {
        version: '1.2',
        executableSha256: await sha256File(GLTFPACK_BINARY),
        status: 'rejected-for-lossless-owner-pipeline',
        reason: 'Prior project evaluation flattened semantic hierarchy and removed source topology; this candidate therefore retains the direct lossless export.',
      },
    },
    owner: {
      id: OWNER_ID,
      nodeName: OWNER_NAME,
      persistent: true,
      transformSpace: 'owner-local',
    },
    source: {
      animationDurationSeconds: webAnimation.animationDurationSeconds,
      rigSourceVariant: 'web',
      ownerTransformSamplesSha256: webAnimation.ownerTransformSamplesSha256,
      cleaned: {
        url: relative(out, args.cleanedSource).replaceAll('\\', '/'),
        sha256: await sha256File(args.cleanedSource),
        animationDurationSeconds: cleanedAnimationDurationSeconds,
        hierarchy: { meshNodes: cleanedMeshes, triangles: cleanedTriangles, bounds: cleanedBounds },
      },
      web: {
        url: relative(out, args.webInput).replaceAll('\\', '/'),
        sha256: await sha256File(args.webInput),
        animationDurationSeconds: webAnimation.animationDurationSeconds,
        animation: webAnimation,
        owner: sourceSummary(web),
      },
      quest: {
        url: relative(out, args.questInput).replaceAll('\\', '/'),
        sha256: await sha256File(args.questInput),
        animationDurationSeconds: questAnimation.animationDurationSeconds,
        animation: questAnimation,
        owner: sourceSummary(quest),
      },
      detachedSemanticOverlays,
      ...(preprocessing ? { preprocessing } : {}),
    },
    rig,
    grid,
    budgets: {
      maxDetailTriangles: args.maxTriangles,
      maxDetailDraws: args.maxDraws,
      maxAlwaysResidentShellTriangles,
      maxResidentTriangles: residentTriangleBudgets,
    },
    packages: packageRecords,
    aggregate: {
      web: aggregate(packageRecords, 'web'),
      quest: aggregate(packageRecords, 'quest'),
    },
    nextPhaseTargets: [repeatedHallFurniture],
    activationBlockers: [
      ...(shellRecord ? [
        'The deterministic lossless opaque shell candidate requires multi-angle visual approval; semantic source classification is not a substitute for DCC review.',
      ] : [
        'A visually approved opaque always-resident shell is not authored in Web and Quest variants.',
        `Current detail packages own every ${PROFILE.title.toLowerCase()} source path. Structural paths must be moved from detail ownership into the shell contract before adding that shell; additive overlap is forbidden because it can duplicate surfaces and z-fight.`,
      ]),
      'Self-contained package texture duplication must be resolved with shared external KTX2 textures or package-local atlases.',
      ...(preprocessing ? [] : [
        'Six detached instanced fire-hose material batches must be reparented to Ground Floor._anim1 before Ground Floor owner streaming.',
      ]),
    ],
    shellCompletion: {
      ready: false,
      candidateBuilt: Boolean(shellRecord),
      ownershipRepartitioned: Boolean(shellRecord),
      blocker: shellRecord
        ? 'The lossless structural source-subset shell exists and ownership is disjoint, but browser/DCC visual approval is still required.'
        : 'A visually approved opaque architectural shell does not exist in both variants. Blind decimation is prohibited.',
      persistentTriangleTargets,
      requiredAlwaysResidentShell: {
        ...(shellRecord || {
          id: SHELL_ID,
          kind: 'always-resident-shell',
          residency: 'persistent-lossless',
          ownerId: OWNER_ID,
          selectionBounds: {
            web: { space: 'owner-local', min: web.bounds.min, max: web.bounds.max },
            quest: { space: 'owner-local', min: quest.bounds.min, max: quest.bounds.max },
          },
          requiredAttributes: REQUIRED_ATTRIBUTES,
        }),
        maxTriangles: maxAlwaysResidentShellTriangles,
        sourceOwnership: shellRecord
          ? 'Lossless selected structural source paths are owned only by this shell; all remaining source paths are owned only by detail packages.'
          : 'Select structural source paths for the shell, remove those exact paths from every detail package, rebuild both variants, and then recompute the complete disjoint manifest source.ownership digest. Never add the shell over the current all-owner detail set.',
        requiresDetailOwnershipRepartition: !shellRecord,
        outputs: {
          web: `hlod/web/${PROFILE.slug}-shell-hlod.glb`,
          quest: `hlod/quest/${PROFILE.slug}-shell-hlod.glb`,
        },
      },
    },
    optionalRegionalHlod: {
      required: false,
      status: 'deferred-runtime-ownership-contract-required',
      contractKind: 'regional-hlod',
      activationSupported: false,
      policy: 'Do not author or activate regional HLOD until it has an explicit replacement-source mapping and atomic hide/restore runtime.',
      fallback: 'The persistent structural shell plus intentional omission of nonstructural far detail is the only approved v3 pilot behavior.',
    },
    generatedAt: new Date().toISOString(),
  }

  const indexPath = join(out, 'detail-package-index.json')
  await writeFile(indexPath, JSON.stringify(index, null, 2))
  await writeFile(join(out, 'STREAMING_DCC_HANDOFF.md'), handoffMarkdown(index))
  await writeFile(join(out, 'package-plan.json'), JSON.stringify({ grid, packages: planSummary }, null, 2))
  console.log(`Wrote ${indexPath}`)
  console.log(`Detail aggregate: Web ${index.aggregate.web.triangles.toLocaleString()} tris / ${packageRecords.length} packages`)
  console.log(`                  Quest ${index.aggregate.quest.triangles.toLocaleString()} tris / ${packageRecords.length} packages`)
  console.log(shellRecord
    ? 'Shell status: lossless disjoint candidate built; visual approval and remaining activation gates are still required.'
    : 'Shell status: blocked pending two-variant visual DCC authoring; regional HLOD activation is deferred (pilot remains disabled).')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
