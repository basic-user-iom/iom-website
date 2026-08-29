/**
 * Fail-closed assembly for a disabled, production-shaped manifest-v3 candidate.
 *
 * This module never reads or writes the production model manifest. The caller
 * supplies an exact, SHA/byte-pinned snapshot of every release input. All
 * output is created below building-viewer/tmp only after every input gate has
 * passed. A failed output verification removes that new candidate directory.
 */
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

import { createGltfIO } from './gltf-io.mjs'
import {
  inspectManifestV3Payload,
} from './inspect-stream-payload.mjs'
import {
  validateAnimationPackageManifestV3,
  validateAnimationPackageManifestV3File,
} from '../validate-animation-package-manifest-v3.mjs'

const execFileAsync = promisify(execFile)
const LIB_DIR = dirname(fileURLToPath(import.meta.url))
export const VIEWER_ROOT = resolve(LIB_DIR, '..', '..')
export const REPOSITORY_ROOT = resolve(VIEWER_ROOT, '..')
export const CANDIDATE_TMP_ROOT = resolve(VIEWER_ROOT, 'tmp')

const VARIANTS = ['web', 'quest']
const LEVELS = ['lod0', 'hlod']
const RESOURCE_KEYS = ['triangles', 'draws', 'bytes', 'encodedTextureBytes', 'gpuTextureBytes']
const SHA256 = /^[a-f0-9]{64}$/i
const REQUIRED_SHELL_VIEWS = ['front', 'back', 'left', 'right', 'top', 'bottom', 'grazing']
const JSON_CHUNK = 0x4e4f534a
const GLB_MAGIC = 0x46546c67

export class DisabledManifestV3CandidateError extends Error {
  constructor(message) {
    super(message)
    this.name = 'DisabledManifestV3CandidateError'
  }
}

function fail(message) {
  throw new DisabledManifestV3CandidateError(message)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0
}

function isFiniteTuple(value, length) {
  return Array.isArray(value) && value.length === length && value.every(Number.isFinite)
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function stringListSha256(values) {
  return sha256Bytes(Buffer.from(JSON.stringify([...values].sort())))
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function inside(path, root) {
  const child = relative(resolve(root), resolve(path))
  return child === '' || (!child.startsWith(`..${sep}`) && child !== '..' && !isAbsolute(child))
}

function assertRepositoryPath(path, label) {
  assert(inside(path, REPOSITORY_ROOT), `${label}: path must stay below ${REPOSITORY_ROOT}`)
}

function resolveRequestPath(requestDirectory, value, label) {
  assert(isNonEmptyString(value), `${label}.path: must be a non-empty string`)
  const path = resolve(requestDirectory, value)
  assertRepositoryPath(path, label)
  return path
}

function forwardRelative(fromDirectory, toPath) {
  const value = relative(fromDirectory, toPath).replaceAll('\\', '/')
  return value.startsWith('.') ? value : `./${value}`
}

function safeSegment(value, label) {
  assert(isNonEmptyString(value), `${label}: must be a non-empty string`)
  const result = value.replace(/[^a-zA-Z0-9._-]+/g, '-')
  assert(result !== '.' && result !== '..' && result.length > 0, `${label}: cannot form a safe output name`)
  return result
}

async function pathExists(path) {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

async function readPinnedReference(record, label, requestDirectory, { json = false } = {}) {
  assert(isRecord(record), `${label}: must be a pinned file reference`)
  assert(typeof record.sha256 === 'string' && SHA256.test(record.sha256), `${label}.sha256: must be SHA-256`)
  assert(isPositiveInteger(record.bytes), `${label}.bytes: must be a positive safe integer`)
  const path = resolveRequestPath(requestDirectory, record.path, label)
  const info = await lstat(path)
  assert(info.isFile() && !info.isSymbolicLink(), `${label}: must be a regular, non-symlink file`)
  const bytes = await readFile(path)
  const actualSha256 = sha256Bytes(bytes)
  assert(bytes.byteLength === record.bytes, `${label}.bytes: stale pin (${record.bytes} != ${bytes.byteLength})`)
  assert(actualSha256 === record.sha256.toLowerCase(), `${label}.sha256: stale pin (${record.sha256} != ${actualSha256})`)
  let value = null
  if (json) {
    try {
      value = JSON.parse(bytes.toString('utf8'))
    } catch (error) {
      fail(`${label}: invalid JSON (${error instanceof Error ? error.message : String(error)})`)
    }
  }
  return { path, bytes, sha256: actualSha256, value, record }
}

function assertPinnedUrl(record, label) {
  assert(isNonEmptyString(record?.url), `${label}.url: must be a non-empty candidate URL`)
  assert(!/^[a-z]+:\/\//i.test(record.url), `${label}.url: remote URLs are forbidden in a local candidate`)
}

function getProductionModel(productionManifest, modelId) {
  assert(Array.isArray(productionManifest?.models), 'production.manifest: models must be an array')
  const matches = productionManifest.models.filter((entry) => entry?.id === modelId)
  assert(matches.length === 1, `production.manifest: expected exactly one ${modelId} entry`)
  return matches[0]
}

function assertProductionRoutes(entry, request) {
  for (const variant of VARIANTS) {
    const route = request.production.sources?.[variant]
    assertPinnedUrl(route, `production.sources.${variant}`)
    assert(entry[variant] === route.url, `production.sources.${variant}.url: does not match production manifest`)
  }
  assertPinnedUrl(request.production.animationRig, 'production.animationRig')
  assert(
    entry.animation === request.production.animationRig.url,
    'production.animationRig.url: does not match production manifest animation route',
  )
  assertPinnedUrl(request.production.collision, 'production.collision')
  assert(entry.collision === request.production.collision.url, 'production.collision.url: does not match production manifest')
}

function assertSourceAndRigProvenance(index, assets) {
  assert(index.source?.animationDurationSeconds > 0, 'packageIndex.source.animationDurationSeconds: must be positive')
  for (const variant of VARIANTS) {
    const source = index.source?.[variant]
    assert(isRecord(source), `packageIndex.source.${variant}: missing source provenance`)
    assert(source.sha256 === assets.sources[variant].sha256, `packageIndex.source.${variant}.sha256: production pin mismatch`)
    const resolvedSource = resolve(dirname(assets.index.path), source.url)
    assert(resolvedSource === assets.sources[variant].path, `packageIndex.source.${variant}.url: does not resolve to pinned production source`)
    assert(
      Math.abs(source.animationDurationSeconds - index.source.animationDurationSeconds) <= 1e-6,
      `packageIndex.source.${variant}.animationDurationSeconds: duration mismatch`,
    )
  }
  assert(index.rig?.sha256 === assets.streamRig.sha256, 'packageIndex.rig.sha256: stream-rig pin mismatch')
  assert(index.rig?.bytes === assets.streamRig.bytes.byteLength, 'packageIndex.rig.bytes: stream-rig byte pin mismatch')
  assert(resolve(dirname(assets.index.path), index.rig.url) === assets.streamRig.path, 'packageIndex.rig.url: does not resolve to pinned stream rig')
  assert(index.rig?.transformSampleMatch === true, 'packageIndex.rig.transformSampleMatch: must be true')
  assert(Array.isArray(index.rig?.owners) && index.rig.owners.length > 0, 'packageIndex.rig.owners: must be non-empty')
  assert(
    Math.abs(index.rig.animationDurationSeconds - index.source.animationDurationSeconds) <= 1e-6,
    'packageIndex.rig.animationDurationSeconds: source duration mismatch',
  )
}

function normalizeShellRecord(index) {
  const embedded = (index.packages ?? []).filter((pkg) => pkg?.kind === 'always-resident-shell')
  assert(embedded.length <= 1, 'packageIndex.packages: more than one always-resident shell')
  const completionShell = index.shellCompletion?.requiredAlwaysResidentShell
  if (embedded.length === 1 && completionShell) {
    assert(embedded[0].id === completionShell.id, 'packageIndex: embedded shell and shellCompletion shell disagree')
  }
  const shell = embedded[0] ?? completionShell
  assert(isRecord(shell), 'packageIndex: an always-resident shell record is required')
  assert(shell.kind === 'always-resident-shell', 'packageIndex.shell.kind: must be always-resident-shell')
  assert(shell.residency === 'persistent-lossless', 'packageIndex.shell.residency: must be persistent-lossless')
  assert(shell.requiresDetailOwnershipRepartition === false, 'packageIndex.shell: ownership repartition is incomplete')
  assert(Array.isArray(shell.semanticRoles) && shell.semanticRoles.length > 0, 'packageIndex.shell.semanticRoles: audited semantics are required')

  const normalized = structuredClone(shell)
  for (const variant of VARIANTS) {
    const variantRecord = shell.variants?.[variant]
    assert(isRecord(variantRecord), `packageIndex.shell.variants.${variant}: missing`)
    const hlod = variantRecord.hlod ?? variantRecord
    assert(isRecord(hlod) && isNonEmptyString(hlod.url), `packageIndex.shell.variants.${variant}: missing HLOD payload`)
    normalized.variants ??= {}
    normalized.variants[variant] = { hlod }
  }
  return normalized
}

function assertShellReady(index, shell) {
  const completion = index.shellCompletion
  assert(completion?.ready === true, 'packageIndex.shellCompletion.ready: explicit visual approval is required')
  assert(completion?.candidateBuilt === true, 'packageIndex.shellCompletion.candidateBuilt: must be true')
  assert(completion?.ownershipRepartitioned === true, 'packageIndex.shellCompletion.ownershipRepartitioned: must be true')
  for (const variant of VARIANTS) {
    const declared = shell.variants[variant].hlod
    assert(
      completion.requiredAlwaysResidentShell?.outputs?.[variant] === declared.url,
      `packageIndex.shell.outputs.${variant}: does not match shell payload`,
    )
  }
}

function packageListWithShell(index, shell) {
  const details = (index.packages ?? []).filter((pkg) => pkg?.kind !== 'always-resident-shell')
  assert(details.length > 0, 'packageIndex.packages: at least one detail package is required')
  return [shell, ...details]
}

function assertPackageOwnership(index, packages) {
  const complete = {}
  const ids = new Set()
  for (const pkg of packages) {
    assert(isNonEmptyString(pkg?.id) && !ids.has(pkg.id), `packageIndex.packages: duplicate or invalid id ${pkg?.id}`)
    ids.add(pkg.id)
    assert(pkg.kind !== 'regional-hlod', `${pkg.id}: regional HLOD activation is not supported`)
    assert(Array.isArray(pkg.semanticRoles) && pkg.semanticRoles.length > 0, `${pkg.id}.semanticRoles: must be non-empty`)
    assert(Array.isArray(pkg.requiredAttributes) && pkg.requiredAttributes.includes('POSITION'), `${pkg.id}.requiredAttributes: POSITION is required`)
  }

  for (const variant of VARIANTS) {
    const paths = []
    const seen = new Set()
    for (const pkg of packages) {
      const declared = pkg.sourcePaths?.[variant]
      assert(Array.isArray(declared) && declared.length > 0, `${pkg.id}.sourcePaths.${variant}: must be non-empty`)
      assert(new Set(declared).size === declared.length, `${pkg.id}.sourcePaths.${variant}: contains duplicates`)
      for (const path of declared) {
        assert(isNonEmptyString(path), `${pkg.id}.sourcePaths.${variant}: contains an invalid path`)
        assert(!seen.has(path), `${pkg.id}.sourcePaths.${variant}: global ownership overlap at ${path}`)
        seen.add(path)
        paths.push(path)
      }
      const content = pkg.content?.[variant]
      assert(content?.sourcePathCount === declared.length, `${pkg.id}.content.${variant}.sourcePathCount: stale`)
      assert(content?.sourcePathsSha256 === stringListSha256(declared), `${pkg.id}.content.${variant}.sourcePathsSha256: stale`)
    }
    const sorted = [...paths].sort()
    complete[variant] = {
      mode: 'disjoint-additive',
      pathCount: sorted.length,
      pathsSha256: stringListSha256(sorted),
    }
    const expectedCount = index.source?.[variant]?.owner?.meshNodes
    assert(expectedCount === sorted.length, `packageIndex.completeOwnership.${variant}: does not exactly cover source owner meshes`)
    const declaredComplete = index.completeOwnership?.[variant]
    assert(declaredComplete?.mode === 'disjoint-additive', `packageIndex.completeOwnership.${variant}.mode: invalid`)
    assert(declaredComplete?.pathCount === sorted.length, `packageIndex.completeOwnership.${variant}.pathCount: stale`)
    assert(declaredComplete?.pathsSha256 === complete[variant].pathsSha256, `packageIndex.completeOwnership.${variant}.pathsSha256: stale`)
  }
  return complete
}

function assertAudit(index, shell, audit, indexSha256) {
  assert(audit?.schema === 'IOM_OWNER_LOCAL_DETAIL_PACKAGE_AUDIT' && audit.version === 1, 'packageAudit: wrong schema/version')
  assert(audit.requireShell === true, 'packageAudit.requireShell: must be true')
  assert(audit.detailPayloadStatus === 'passed', 'packageAudit.detailPayloadStatus: must be passed')
  assert(Array.isArray(audit.failures) && audit.failures.length === 0, 'packageAudit.failures: must be empty')
  assert(Array.isArray(audit.missingShellVariants) && audit.missingShellVariants.length === 0, 'packageAudit.missingShellVariants: shell is incomplete')
  assert(audit.visualApprovalRequired === true, 'packageAudit.visualApprovalRequired: must be true')
  if (audit.indexSha256 !== undefined) {
    assert(audit.indexSha256 === indexSha256, 'packageAudit.indexSha256: stale package-index pin')
  }
  for (const variant of VARIANTS) {
    const coverage = audit.sourceCoverage?.[variant]
    assert(coverage?.completeMeshPaths === index.completeOwnership[variant].pathCount, `packageAudit.sourceCoverage.${variant}: incomplete`)
    assert(coverage?.completePathsSha256 === index.completeOwnership[variant].pathsSha256, `packageAudit.sourceCoverage.${variant}: stale digest`)
    const auditedShell = audit.shell?.[variant]
    const shellPayload = shell.variants[variant].hlod
    assert(auditedShell?.sha256 === shellPayload.sha256, `packageAudit.shell.${variant}.sha256: stale`)
    assert(auditedShell?.bytes === (shellPayload.metrics ?? shellPayload.estimates)?.bytes, `packageAudit.shell.${variant}.bytes: stale`)
  }
}

function assertShellVisualApproval(approval, pins) {
  assert(approval?.schema === 'IOM_SHELL_VISUAL_APPROVAL' && approval.version === 1, 'shellVisualApproval: wrong schema/version')
  assert(approval.approved === true, 'shellVisualApproval.approved: must be true')
  assert(approval.productionReferenced === false, 'shellVisualApproval.productionReferenced: must remain false')
  assert(approval.packageIndexSha256 === pins.indexSha256, 'shellVisualApproval.packageIndexSha256: stale')
  assert(approval.packageAuditSha256 === pins.auditSha256, 'shellVisualApproval.packageAuditSha256: stale')
  for (const variant of VARIANTS) {
    const result = approval.variants?.[variant]
    assert(result?.approved === true, `shellVisualApproval.variants.${variant}.approved: must be true`)
    assert(Array.isArray(result.views), `shellVisualApproval.variants.${variant}.views: must be an array`)
    for (const view of REQUIRED_SHELL_VIEWS) {
      assert(result.views.includes(view), `shellVisualApproval.variants.${variant}.views: missing ${view}`)
    }
  }
}

function parseGlbJson(bytes, label) {
  assert(bytes.byteLength >= 20, `${label}: truncated GLB`)
  assert(bytes.readUInt32LE(0) === GLB_MAGIC, `${label}: invalid GLB magic`)
  assert(bytes.readUInt32LE(4) === 2, `${label}: only GLB v2 is accepted`)
  assert(bytes.readUInt32LE(8) === bytes.byteLength, `${label}: declared GLB length is stale`)
  const jsonLength = bytes.readUInt32LE(12)
  assert(bytes.readUInt32LE(16) === JSON_CHUNK, `${label}: first GLB chunk must be JSON`)
  assert(jsonLength > 0 && 20 + jsonLength <= bytes.byteLength, `${label}: invalid JSON chunk length`)
  const jsonText = bytes.subarray(20, 20 + jsonLength).toString('utf8').replace(/[\u0000\u0020]+$/u, '')
  try {
    return JSON.parse(jsonText)
  } catch (error) {
    fail(`${label}: invalid GLB JSON (${error instanceof Error ? error.message : String(error)})`)
  }
}

function imageAnnotationFacts(bytes, label) {
  const json = parseGlbJson(bytes, label)
  const binaryChunkOffset = 20 + bytes.readUInt32LE(12)
  assert(binaryChunkOffset + 8 <= bytes.byteLength, `${label}: missing BIN chunk`)
  const binLength = bytes.readUInt32LE(binaryChunkOffset)
  const binStart = binaryChunkOffset + 8
  const binEnd = binStart + binLength
  assert(binEnd <= bytes.byteLength, `${label}: BIN chunk exceeds file`)

  const hashes = []
  for (const [index, image] of (json.images ?? []).entries()) {
    assert(image.uri === undefined, `${label}: image[${index}] uses a forbidden external/data URI`)
    const view = json.bufferViews?.[image.bufferView]
    assert(view?.buffer === 0, `${label}: image[${index}] must use GLB buffer 0`)
    const start = binStart + (view.byteOffset ?? 0)
    const end = start + view.byteLength
    assert(Number.isSafeInteger(view.byteLength) && view.byteLength > 0 && start >= binStart && end <= binEnd, `${label}: image[${index}] bufferView is invalid`)
    const encoded = bytes.subarray(start, end)
    const hash = sha256Bytes(encoded)
    const annotation = image.extras?.iomSharedTexture
    assert(annotation?.version === 1, `${label}: image[${index}] is missing iomSharedTexture version 1 metadata`)
    assert(annotation.contentSha256 === hash, `${label}: image[${index}] content hash annotation is stale`)
    assert(annotation.encodedBytes === encoded.byteLength, `${label}: image[${index}] encoded-byte annotation is stale`)
    hashes.push(hash)
  }
  for (const [index, texture] of (json.textures ?? []).entries()) {
    const source = texture.extensions?.KHR_texture_basisu?.source ?? texture.source
    assert(Number.isSafeInteger(source) && source >= 0 && source < (json.images?.length ?? 0), `${label}: texture[${index}] has no valid annotated image`)
  }
  return {
    annotatedImages: hashes.length,
    textureDefinitions: json.textures?.length ?? 0,
    imageContentSha256: [...new Set(hashes)].sort(),
  }
}

function payloadRecord(pkg, variant, level) {
  return pkg.variants?.[variant]?.[level]
}

function payloadPath(indexDirectory, record, label) {
  assert(isNonEmptyString(record?.url), `${label}.url: missing`)
  assert(!record.url.startsWith('/') && !/^[a-z]+:\/\//i.test(record.url), `${label}.url: must be local and relative`)
  const path = resolve(indexDirectory, record.url)
  assert(inside(path, indexDirectory), `${label}.url: escapes package-index directory`)
  return path
}

async function inspectPayloads(indexDirectory, packages, sharedEvidence) {
  assert(sharedEvidence?.schema === 'IOM_SHARED_TEXTURE_RELEASE_EVIDENCE' && sharedEvidence.version === 1, 'sharedTextures.evidence: wrong schema/version')
  assert(sharedEvidence.enabled === true, 'sharedTextures.evidence.enabled: must be true')
  assert(sharedEvidence.productionReferenced === false, 'sharedTextures.evidence.productionReferenced: must remain false')
  assert(Array.isArray(sharedEvidence.payloads), 'sharedTextures.evidence.payloads: must be an array')
  const evidenceByKey = new Map()
  for (const item of sharedEvidence.payloads) {
    const key = `${item?.url}\n${item?.candidateSha256}`
    assert(!evidenceByKey.has(key), `sharedTextures.evidence.payloads: duplicate ${item?.url}`)
    evidenceByKey.set(key, item)
  }

  const io = await createGltfIO()
  const inspected = []
  const sharedImageUsage = new Map()
  for (const pkg of packages) {
    for (const variant of VARIANTS) {
      for (const level of LEVELS) {
        const record = payloadRecord(pkg, variant, level)
        if (!record) continue
        const label = `${pkg.id}/${variant}/${level}`
        const path = payloadPath(indexDirectory, record, label)
        const result = await inspectManifestV3Payload(path, pkg, variant, level, {
          io,
          baseDirectory: indexDirectory,
        })
        if (!result.ok) {
          const diagnostics = result.errors.map((error) => error.code ?? JSON.stringify(error)).join(', ')
          fail(`${label}: offline payload validation failed (${diagnostics})`)
        }
        const expectedPaths = [...pkg.sourcePaths[variant]].sort()
        const observedPaths = result.sourceOwnership.occurrences.map((item) => item.path).sort()
        assert(JSON.stringify(observedPaths) === JSON.stringify(expectedPaths), `${label}: exact source ownership differs from package record`)
        const declaredMetrics = record.metrics ?? record.estimates
        assert(isRecord(declaredMetrics), `${label}.metrics: missing`)
        assert(result.textures.summary.textureCount === declaredMetrics.textureCount || declaredMetrics.textureCount === undefined, `${label}.metrics.textureCount: stale`)

        const fileBytes = await readFile(path)
        const annotations = imageAnnotationFacts(fileBytes, label)
        const evidence = evidenceByKey.get(`${record.url}\n${record.sha256}`)
        assert(evidence, `${label}: missing shared-texture candidate evidence`)
        assert(evidence.candidateBytes === fileBytes.byteLength, `${label}: shared-texture evidence bytes are stale`)
        assert(evidence.annotatedImages === annotations.annotatedImages, `${label}: shared-texture annotated-image count is stale`)
        assert(evidence.textureDefinitions === annotations.textureDefinitions, `${label}: shared-texture texture-definition count is stale`)
        assert(
          JSON.stringify([...(evidence.imageContentSha256 ?? [])].sort()) === JSON.stringify(annotations.imageContentSha256),
          `${label}: shared-texture image hash evidence is stale`,
        )
        for (const hash of annotations.imageContentSha256) {
          const users = sharedImageUsage.get(hash) ?? new Set()
          users.add(`${pkg.id}/${variant}`)
          sharedImageUsage.set(hash, users)
        }
        inspected.push({ pkg, variant, level, record, path, result, annotations })
      }
    }
  }
  assert(inspected.length > 0, 'packageIndex: no runtime payloads were found')
  assert(sharedEvidence.payloadCount === inspected.length, 'sharedTextures.evidence.payloadCount: must cover every runtime payload')
  const annotatedImages = inspected.reduce((sum, item) => sum + item.annotations.annotatedImages, 0)
  assert(sharedEvidence.annotatedImageDefinitions === annotatedImages, 'sharedTextures.evidence.annotatedImageDefinitions: stale')
  assert(
    [...sharedImageUsage.values()].some((users) => users.size >= 2),
    'sharedTextures.evidence: no annotated image is shared by at least two package payloads',
  )
  return inspected
}

function assertSharedTextureBrowserQa(qa, inspected) {
  assert(qa?.schema === 'IOM_SHARED_TEXTURE_BROWSER_QA' && qa.version === 1, 'sharedTextures.browserQa: wrong schema/version')
  assert(qa.passed === true, 'sharedTextures.browserQa.passed: must be true')
  assert(qa.productionReferenced === false, 'sharedTextures.browserQa.productionReferenced: must remain false')
  assert(Array.isArray(qa.selected) && qa.selected.length >= 2, 'sharedTextures.browserQa.selected: at least two payloads are required')
  const byHashAndBytes = new Set(inspected.map((item) => `${item.record.sha256}:${item.result.file.bytes}`))
  for (const selected of qa.selected) {
    assert(byHashAndBytes.has(`${selected?.sha256}:${selected?.bytes}`), 'sharedTextures.browserQa.selected: payload pin is not in candidate index')
  }
  assert(Array.isArray(qa.result?.metadataCounts), 'sharedTextures.browserQa.result.metadataCounts: missing')
  assert(qa.result.metadataCounts.length === qa.selected.length, 'sharedTextures.browserQa.result.metadataCounts: count mismatch')
  for (const [index, metadata] of qa.result.metadataCounts.entries()) {
    assert(metadata.textureObjects > 0, `sharedTextures.browserQa.result.metadataCounts[${index}]: no textures observed`)
    assert(metadata.annotated === metadata.textureObjects, `sharedTextures.browserQa.result.metadataCounts[${index}]: missing image hash annotations`)
  }
  assert(
    Array.isArray(qa.result.acquisitions) && qa.result.acquisitions.some((item) => item?.sharedTextures > 0),
    'sharedTextures.browserQa.result.acquisitions: no compatible GPU texture reuse was observed',
  )
  assert(qa.result.registry?.roots >= 2 && qa.result.registry?.references >= 2, 'sharedTextures.browserQa.result.registry: insufficient residency proof')
}

function assertCollisionEvidence(contract, coverage, assets, modelId) {
  assert(contract?.version === 1 && contract.modelId === modelId, 'collision contract: model/version mismatch')
  assert(coverage?.version === 1 && coverage.modelId === modelId, 'collision coverage: model/version mismatch')
  assert(contract.collision?.url === assets.collision.record.url, 'collision contract: production URL mismatch')
  assert(contract.collision?.sha256 === assets.collision.sha256, 'collision contract: collision SHA mismatch')
  assert(contract.collision?.bytes === assets.collision.bytes.byteLength, 'collision contract: collision byte mismatch')
  assert(contract.coverageReport?.url === assets.coverage.record.url, 'collision contract: coverage URL mismatch')
  assert(contract.coverageReport?.sha256 === assets.coverage.sha256, 'collision contract: coverage SHA mismatch')
  assert(contract.coverageReport?.bytes === assets.coverage.bytes.byteLength, 'collision contract: coverage byte mismatch')
  assert(coverage.collision?.sha256 === assets.collision.sha256, 'collision coverage: collision SHA mismatch')
  assert(coverage.collision?.bytes === assets.collision.bytes.byteLength, 'collision coverage: collision byte mismatch')
}

async function runExistingCollisionGate({ contract, coverage, collision }) {
  const script = resolve(VIEWER_ROOT, 'scripts', 'validate-collision-activation-contract.mjs')
  try {
    await execFileAsync(process.execPath, [
      script,
      '--contract', contract,
      '--coverage', coverage,
      '--collision', collision,
    ], {
      cwd: VIEWER_ROOT,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    })
  } catch (error) {
    const diagnostics = [error?.stdout, error?.stderr].filter(Boolean).join('\n').trim()
    fail(`collision activation gate failed${diagnostics ? `:\n${diagnostics}` : ''}`)
  }
}

function clipsFromIndex(index) {
  const sourceVariant = index.source?.rigSourceVariant ?? 'web'
  const clips = index.source?.[sourceVariant]?.animation?.clips
  assert(Array.isArray(clips) && clips.length > 0, 'packageIndex.source animation clips: missing')
  assert(index.rig.clipCount === clips.length, 'packageIndex.rig.clipCount: source clip count mismatch')
  return clips.map((clip, indexValue) => {
    assert(isNonEmptyString(clip?.name), `packageIndex.source clips[${indexValue}].name: missing`)
    assert(Number.isFinite(clip?.durationSeconds) && clip.durationSeconds > 0, `packageIndex.source clips[${indexValue}].durationSeconds: invalid`)
    return { name: clip.name, durationSeconds: clip.durationSeconds }
  })
}

function estimatesFromRecord(record, label) {
  const metrics = record.metrics ?? record.estimates
  assert(isRecord(metrics), `${label}: metrics are missing`)
  const result = {}
  for (const key of RESOURCE_KEYS) {
    const allowZero = key === 'encodedTextureBytes' || key === 'gpuTextureBytes'
    assert(Number.isSafeInteger(metrics[key]) && metrics[key] >= (allowZero ? 0 : 1), `${label}.${key}: invalid metric`)
    result[key] = metrics[key]
  }
  return result
}

function candidateAssetLayout(outputRoot, packages, assets) {
  const copies = []
  // The exact-file validator deliberately forbids ../ URL traversal. Keep
  // every copied asset below the directory that owns both manifest files.
  const manifestDirectory = outputRoot
  const add = (source, targetRelative, label) => {
    const target = resolve(outputRoot, targetRelative)
    assert(inside(target, outputRoot), `${label}: output escapes candidate root`)
    copies.push({ source, target, label })
    return forwardRelative(manifestDirectory, target)
  }
  const sourceUrls = {
    web: add(assets.sources.web.path, 'assets/source/web/model.glb', 'source/web'),
    quest: add(assets.sources.quest.path, 'assets/source/quest/model.glb', 'source/quest'),
  }
  const productionAnimationUrl = add(assets.animationRig.path, 'assets/source/production-animation-rig.glb', 'production-animation-rig')
  const rigUrl = add(assets.streamRig.path, 'assets/rig/stream-rig.glb', 'stream-rig')
  const collisionUrl = add(assets.collision.path, 'assets/collision/collision.glb', 'collision')
  const contractUrl = add(assets.contract.path, 'evidence/collision-activation-v1.json', 'collision-contract')
  const coverageUrl = add(assets.coverage.path, 'evidence/collision-coverage-v1.json', 'collision-coverage')
  add(assets.index.path, 'evidence/package-index.json', 'package-index')
  add(assets.audit.path, 'evidence/package-audit.json', 'package-audit')
  add(assets.sharedEvidence.path, 'evidence/shared-texture-release-evidence.json', 'shared-texture-evidence')
  add(assets.browserQa.path, 'evidence/shared-texture-browser-qa.json', 'shared-texture-browser-qa')
  add(assets.shellApproval.path, 'evidence/shell-visual-approval.json', 'shell-visual-approval')
  add(assets.productionManifest.path, 'evidence/production-manifest-snapshot.json', 'production-manifest-snapshot')

  const payloadUrls = new Map()
  for (const pkg of packages) {
    for (const variant of VARIANTS) {
      for (const level of LEVELS) {
        const record = payloadRecord(pkg, variant, level)
        if (!record) continue
        const key = `${pkg.id}\n${variant}\n${level}`
        const target = `assets/packages/${variant}/${safeSegment(pkg.id, `${pkg.id}.id`)}-${level}.glb`
        payloadUrls.set(key, add(payloadPath(dirname(assets.index.path), record, key), target, key))
      }
    }
  }
  return {
    copies,
    manifestDirectory,
    sourceUrls,
    productionAnimationUrl,
    rigUrl,
    collisionUrl,
    contractUrl,
    coverageUrl,
    payloadUrls,
  }
}

function manifestPackages(packages, layout) {
  return packages.map((pkg) => {
    const next = {
      id: pkg.id,
      kind: pkg.kind,
      residency: pkg.residency,
      ownerId: pkg.ownerId,
      transform: structuredClone(pkg.transform),
      selectionBounds: structuredClone(pkg.selectionBounds),
      semanticRoles: structuredClone(pkg.semanticRoles),
      sourcePaths: structuredClone(pkg.sourcePaths),
      requiredAttributes: structuredClone(pkg.requiredAttributes),
      variants: { web: {}, quest: {} },
    }
    if (pkg.streaming !== undefined) next.streaming = structuredClone(pkg.streaming)
    for (const variant of VARIANTS) {
      for (const level of LEVELS) {
        const record = payloadRecord(pkg, variant, level)
        if (!record) continue
        next.variants[variant][level] = {
          url: layout.payloadUrls.get(`${pkg.id}\n${variant}\n${level}`),
          sha256: record.sha256,
          bounds: structuredClone(record.bounds),
          estimates: estimatesFromRecord(record, `${pkg.id}.${variant}.${level}`),
        }
      }
    }
    return next
  })
}

function residentSets(packages) {
  const result = { web: [], quest: [] }
  for (const variant of VARIANTS) {
    for (const pkg of packages) {
      if (pkg.kind === 'always-resident-shell') result[variant].push({ packageId: pkg.id, level: 'hlod' })
      else if (pkg.residency === 'persistent-lossless') result[variant].push({ packageId: pkg.id, level: 'lod0' })
    }
  }
  return result
}

function buildManifest(request, index, packages, ownership, layout, inputPins, targetVariant) {
  return {
    version: 3,
    enabled: false,
    modelId: request.modelId,
    units: 'meters',
    releaseCandidate: {
      targetVariant,
      productionReferenced: false,
      requestSha256: inputPins.requestSha256,
      packageIndexSha256: inputPins.indexSha256,
      packageAuditSha256: inputPins.auditSha256,
      shellVisualApprovalSha256: inputPins.shellApprovalSha256,
      sharedTextureEvidenceSha256: inputPins.sharedEvidenceSha256,
      sharedTextureBrowserQaSha256: inputPins.browserQaSha256,
      collisionContractSha256: inputPins.contractSha256,
      collisionCoverageSha256: inputPins.coverageSha256,
    },
    source: {
      animationDurationSeconds: index.source.animationDurationSeconds,
      variants: {
        web: { url: layout.sourceUrls.web, sha256: request.production.sources.web.sha256 },
        quest: { url: layout.sourceUrls.quest, sha256: request.production.sources.quest.sha256 },
      },
      ownership,
    },
    rig: {
      url: layout.rigUrl,
      sha256: request.streamRig.sha256,
      bytes: request.streamRig.bytes,
      animationDurationSeconds: index.rig.animationDurationSeconds,
      clips: clipsFromIndex(index),
      owners: structuredClone(index.rig.owners),
    },
    budgets: structuredClone(request.budgets),
    packages: manifestPackages(packages, layout),
    residentSets: residentSets(packages),
  }
}

function manifestObservedAssets(manifest) {
  const hashes = {}
  const bytes = {}
  const add = (asset, byteCount) => {
    hashes[asset.url] = asset.sha256
    if (byteCount !== undefined) bytes[asset.url] = byteCount
  }
  add(manifest.source.variants.web)
  add(manifest.source.variants.quest)
  add(manifest.rig, manifest.rig.bytes)
  for (const pkg of manifest.packages) {
    for (const variant of VARIANTS) {
      for (const level of LEVELS) {
        const payload = pkg.variants[variant][level]
        if (payload) add(payload, payload.estimates.bytes)
      }
    }
  }
  return { observedHashes: hashes, observedBytes: bytes, requireHashVerification: true }
}

function assertManifestContract(manifest, label) {
  const result = validateAnimationPackageManifestV3(manifest, manifestObservedAssets(manifest))
  if (!result.valid) fail(`${label}: manifest-v3 contract rejected:\n${result.errors.map((error) => `  - ${error}`).join('\n')}`)
  assert(manifest.enabled === false, `${label}: enabled must remain false`)
  return result.summary
}

async function copyCandidateAssets(layout) {
  const targets = new Map()
  for (const item of layout.copies) {
    const existing = targets.get(item.target)
    if (existing) {
      assert(existing.source === item.source, `${item.label}: output collision with ${existing.label}`)
      continue
    }
    targets.set(item.target, item)
  }
  for (const item of targets.values()) {
    await mkdir(dirname(item.target), { recursive: true })
    await copyFile(item.source, item.target)
  }
}

async function writeAndPinManifest(path, manifest) {
  const text = stableJson(manifest)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, text)
  return { sha256: sha256Bytes(Buffer.from(text)), bytes: Buffer.byteLength(text) }
}

function candidateEntry(request, layout, pins) {
  const root = layout.manifestDirectory
  return {
    schema: 'IOM_DISABLED_HLOD_STREAMING_ENTRY_CANDIDATE',
    version: 1,
    enabled: false,
    productionReferenced: false,
    modelId: request.modelId,
    productionManifest: {
      sha256: request.production.manifest.sha256,
      bytes: request.production.manifest.bytes,
    },
    productionAnimationRig: {
      url: request.production.animationRig.url,
      candidateUrl: forwardRelative(root, resolve(layout.manifestDirectory, layout.productionAnimationUrl)),
      sha256: request.production.animationRig.sha256,
      bytes: request.production.animationRig.bytes,
    },
    hlodStreaming: {
      enabled: false,
      web: 'manifest-v3-web.json',
      quest: 'manifest-v3-quest.json',
      sourceSha256: {
        web: request.production.sources.web.sha256,
        quest: request.production.sources.quest.sha256,
      },
      rigSha256: request.streamRig.sha256,
      manifestSha256: { web: pins.web.sha256, quest: pins.quest.sha256 },
      manifestBytes: { web: pins.web.bytes, quest: pins.quest.bytes },
      collisionSha256: request.production.collision.sha256,
      collisionBytes: request.production.collision.bytes,
      collisionActivation: {
        contract: {
          url: forwardRelative(root, resolve(layout.manifestDirectory, layout.contractUrl)),
          sha256: request.collisionEvidence.contract.sha256,
          bytes: request.collisionEvidence.contract.bytes,
        },
        coverageReport: {
          url: forwardRelative(root, resolve(layout.manifestDirectory, layout.coverageUrl)),
          sha256: request.collisionEvidence.coverageReport.sha256,
          bytes: request.collisionEvidence.coverageReport.bytes,
        },
      },
    },
  }
}

async function verifyWrittenManifests(stageRoot, summaries) {
  for (const variant of VARIANTS) {
    const path = join(stageRoot, `manifest-v3-${variant}.json`)
    const result = await validateAnimationPackageManifestV3File(path)
    if (!result.valid) {
      fail(`written ${variant} manifest failed exact-file validation:\n${result.errors.map((error) => `  - ${error}`).join('\n')}`)
    }
    assert(JSON.stringify(result.summary) === JSON.stringify(summaries[variant]), `${variant}: written manifest summary changed`)
  }
}

async function loadRequest(requestPath) {
  const absolute = resolve(requestPath)
  assertRepositoryPath(absolute, 'request')
  assert(inside(absolute, CANDIDATE_TMP_ROOT), 'request: release-candidate requests must be below building-viewer/tmp')
  const bytes = await readFile(absolute)
  let value
  try {
    value = JSON.parse(bytes.toString('utf8'))
  } catch (error) {
    fail(`request: invalid JSON (${error instanceof Error ? error.message : String(error)})`)
  }
  assert(value?.schema === 'IOM_DISABLED_MANIFEST_V3_CANDIDATE_REQUEST', 'request.schema: invalid')
  assert(value.version === 1, 'request.version: must equal 1')
  assert(value.enabled === false, 'request.enabled: must remain false')
  assert(isNonEmptyString(value.modelId), 'request.modelId: must be non-empty')
  assert(isRecord(value.budgets), 'request.budgets: exact manifest-v3 budgets are required')
  return { path: absolute, directory: dirname(absolute), bytes, sha256: sha256Bytes(bytes), value }
}

async function loadInputs(requestInfo) {
  const request = requestInfo.value
  const directory = requestInfo.directory
  const [
    index,
    audit,
    productionManifest,
    sourceWeb,
    sourceQuest,
    animationRig,
    streamRig,
    collision,
    contract,
    coverage,
    sharedEvidence,
    browserQa,
    shellApproval,
  ] = await Promise.all([
    readPinnedReference(request.packageIndex, 'packageIndex', directory, { json: true }),
    readPinnedReference(request.packageAudit, 'packageAudit', directory, { json: true }),
    readPinnedReference(request.production.manifest, 'production.manifest', directory, { json: true }),
    readPinnedReference(request.production.sources.web, 'production.sources.web', directory),
    readPinnedReference(request.production.sources.quest, 'production.sources.quest', directory),
    readPinnedReference(request.production.animationRig, 'production.animationRig', directory),
    readPinnedReference(request.streamRig, 'streamRig', directory),
    readPinnedReference(request.production.collision, 'production.collision', directory),
    readPinnedReference(request.collisionEvidence.contract, 'collisionEvidence.contract', directory, { json: true }),
    readPinnedReference(request.collisionEvidence.coverageReport, 'collisionEvidence.coverageReport', directory, { json: true }),
    readPinnedReference(request.sharedTextures.evidence, 'sharedTextures.evidence', directory, { json: true }),
    readPinnedReference(request.sharedTextures.browserQa, 'sharedTextures.browserQa', directory, { json: true }),
    readPinnedReference(request.shellVisualApproval, 'shellVisualApproval', directory, { json: true }),
  ])
  return {
    request,
    index,
    audit,
    productionManifest,
    sources: { web: sourceWeb, quest: sourceQuest },
    animationRig,
    streamRig,
    collision,
    contract,
    coverage,
    sharedEvidence,
    browserQa,
    shellApproval,
  }
}

/**
 * Emit a disabled candidate. `options.collisionGate` is a test seam; the CLI
 * always uses the real collision GLB validator.
 */
export async function emitDisabledManifestV3Candidate(requestPath, outputDirectory, options = {}) {
  const requestInfo = await loadRequest(requestPath)
  const outputRoot = options.preflightOnly ? null : resolve(outputDirectory)
  if (outputRoot) {
    assert(inside(outputRoot, CANDIDATE_TMP_ROOT) && outputRoot !== CANDIDATE_TMP_ROOT, 'output: must be a child of building-viewer/tmp')
    assert(!(await pathExists(outputRoot)), `output: already exists (${outputRoot})`)
  }

  const assets = await loadInputs(requestInfo)
  const request = assets.request
  assert(request.production?.manifest && request.production?.sources && request.production?.animationRig && request.production?.collision, 'request.production: incomplete')
  const productionEntry = getProductionModel(assets.productionManifest.value, request.modelId)
  assertProductionRoutes(productionEntry, request)

  const index = assets.index.value
  assert(index?.schema === 'IOM_OWNER_LOCAL_DETAIL_PACKAGE_PILOT' && index.version === 1, 'packageIndex: wrong schema/version')
  assert(index.contractTarget === 3, 'packageIndex.contractTarget: must equal 3')
  assert(index.enabled === false, 'packageIndex.enabled: must remain false')
  assert(index.units === 'meters', 'packageIndex.units: must be meters')
  assertSourceAndRigProvenance(index, assets)

  const shell = normalizeShellRecord(index)
  assertShellReady(index, shell)
  const packages = packageListWithShell(index, shell)
  const ownership = assertPackageOwnership(index, packages)
  assertAudit(index, shell, assets.audit.value, assets.index.sha256)
  assertShellVisualApproval(assets.shellApproval.value, {
    indexSha256: assets.index.sha256,
    auditSha256: assets.audit.sha256,
  })
  assert(assets.sharedEvidence.value.candidateIndexSha256 === assets.index.sha256, 'sharedTextures.evidence.candidateIndexSha256: stale')
  assertCollisionEvidence(assets.contract.value, assets.coverage.value, assets, request.modelId)

  const collisionGate = options.collisionGate ?? runExistingCollisionGate
  const [inspected] = await Promise.all([
    inspectPayloads(dirname(assets.index.path), packages, assets.sharedEvidence.value),
    collisionGate({
      contract: assets.contract.path,
      coverage: assets.coverage.path,
      collision: assets.collision.path,
    }),
  ])
  assertSharedTextureBrowserQa(assets.browserQa.value, inspected)

  if (options.preflightOnly) {
    return {
      ready: true,
      modelId: request.modelId,
      packageCount: packages.length,
      payloadCount: inspected.length,
      ownership,
      productionReferenced: false,
      enabled: false,
    }
  }

  await mkdir(dirname(outputRoot), { recursive: true })
  // All input validation, including every GLB decode, completed before this
  // first output write. The candidate is disabled throughout; a failed final
  // exact-file check removes this newly-created directory.
  const stageRoot = outputRoot
  await mkdir(stageRoot)
  try {
    const layout = candidateAssetLayout(stageRoot, packages, assets)
    const inputPins = {
      requestSha256: requestInfo.sha256,
      indexSha256: assets.index.sha256,
      auditSha256: assets.audit.sha256,
      shellApprovalSha256: assets.shellApproval.sha256,
      sharedEvidenceSha256: assets.sharedEvidence.sha256,
      browserQaSha256: assets.browserQa.sha256,
      contractSha256: assets.contract.sha256,
      coverageSha256: assets.coverage.sha256,
    }
    const manifests = Object.fromEntries(VARIANTS.map((variant) => [
      variant,
      buildManifest(request, index, packages, ownership, layout, inputPins, variant),
    ]))
    const summaries = Object.fromEntries(VARIANTS.map((variant) => [variant, assertManifestContract(manifests[variant], variant)]))
    await copyCandidateAssets(layout)
    const manifestPins = {}
    for (const variant of VARIANTS) {
      manifestPins[variant] = await writeAndPinManifest(
        join(stageRoot, `manifest-v3-${variant}.json`),
        manifests[variant],
      )
    }
    await verifyWrittenManifests(stageRoot, summaries)
    const entry = candidateEntry(request, layout, manifestPins)
    assert(entry.enabled === false && entry.hlodStreaming.enabled === false, 'candidate entry activation flags changed')
    await writeFile(join(stageRoot, 'disabled-hlod-streaming-entry.json'), stableJson(entry))
    const report = {
      schema: 'IOM_DISABLED_MANIFEST_V3_CANDIDATE_REPORT',
      version: 1,
      enabled: false,
      productionReferenced: false,
      modelId: request.modelId,
      request: { sha256: requestInfo.sha256, bytes: requestInfo.bytes.byteLength },
      manifests: manifestPins,
      packageCount: packages.length,
      payloadCount: inspected.length,
      ownership,
      summaries,
      gates: {
        packageAudit: 'passed',
        shellVisualApproval: 'passed',
        payloadOfflineInspection: 'passed',
        sharedTextureAnnotations: 'passed',
        sharedTextureBrowserQa: 'passed',
        collisionActivation: 'passed',
        manifestV3ExactFiles: 'passed',
      },
      safety: {
        outputRoot: relative(VIEWER_ROOT, outputRoot).replaceAll('\\', '/'),
        productionManifestModified: false,
        productionAssetsModified: false,
        routeModified: false,
        activationEnabled: false,
      },
    }
    await writeFile(join(stageRoot, 'candidate-report.json'), stableJson(report))
    return { outputRoot, report, entry }
  } catch (error) {
    await rm(stageRoot, { recursive: true, force: true })
    throw error
  }
}

/**
 * Read-only review of an exact candidate request. A blocked result is expected
 * while manual shell approval or any later release gate is outstanding.
 */
export async function reviewDisabledManifestV3Candidate(requestPath, options = {}) {
  const absolute = resolve(requestPath)
  const bytes = await readFile(absolute)
  let request = null
  try {
    request = JSON.parse(bytes.toString('utf8'))
  } catch {
    // The normal request loader below returns the authoritative diagnostic.
  }
  const base = {
    schema: 'IOM_DISABLED_MANIFEST_V3_CANDIDATE_REVIEW',
    version: 1,
    enabled: false,
    productionReferenced: false,
    request: {
      path: relative(VIEWER_ROOT, absolute).replaceAll('\\', '/'),
      sha256: sha256Bytes(bytes),
      bytes: bytes.byteLength,
    },
    modelId: request?.modelId ?? null,
    inputPins: request ? {
      packageIndex: { sha256: request.packageIndex?.sha256 ?? null, bytes: request.packageIndex?.bytes ?? null },
      packageAudit: { sha256: request.packageAudit?.sha256 ?? null, bytes: request.packageAudit?.bytes ?? null },
      shellVisualApproval: { sha256: request.shellVisualApproval?.sha256 ?? null, bytes: request.shellVisualApproval?.bytes ?? null },
      sharedTextureEvidence: { sha256: request.sharedTextures?.evidence?.sha256 ?? null, bytes: request.sharedTextures?.evidence?.bytes ?? null },
      sharedTextureBrowserQa: { sha256: request.sharedTextures?.browserQa?.sha256 ?? null, bytes: request.sharedTextures?.browserQa?.bytes ?? null },
      collision: { sha256: request.production?.collision?.sha256 ?? null, bytes: request.production?.collision?.bytes ?? null },
      collisionContract: { sha256: request.collisionEvidence?.contract?.sha256 ?? null, bytes: request.collisionEvidence?.contract?.bytes ?? null },
      collisionCoverage: { sha256: request.collisionEvidence?.coverageReport?.sha256 ?? null, bytes: request.collisionEvidence?.coverageReport?.bytes ?? null },
    } : null,
    safety: {
      manifestsEmitted: false,
      assetsCopied: false,
      productionManifestModified: false,
      productionAssetsModified: false,
      routeModified: false,
      activationEnabled: false,
    },
  }
  let collisionCheck = { status: 'not-run', error: null }
  if (request?.collisionEvidence?.contract?.path && request?.collisionEvidence?.coverageReport?.path && request?.production?.collision?.path) {
    try {
      await (options.collisionGate ?? runExistingCollisionGate)({
        contract: resolve(dirname(absolute), request.collisionEvidence.contract.path),
        coverage: resolve(dirname(absolute), request.collisionEvidence.coverageReport.path),
        collision: resolve(dirname(absolute), request.production.collision.path),
      })
      collisionCheck = { status: 'passed', error: null }
    } catch (error) {
      collisionCheck = {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
  const withChecks = {
    ...base,
    checks: {
      collisionActivation: collisionCheck,
      remainingPreflight: 'fail-closed',
    },
  }
  if (collisionCheck.status === 'failed') {
    return {
      ...withChecks,
      status: 'blocked-fail-closed',
      blocker: collisionCheck.error,
      preflight: null,
    }
  }
  try {
    const result = await emitDisabledManifestV3Candidate(absolute, null, {
      ...options,
      collisionGate: async () => {},
      preflightOnly: true,
    })
    return {
      ...withChecks,
      status: 'ready-for-disabled-candidate-emission',
      blocker: null,
      preflight: result,
    }
  } catch (error) {
    return {
      ...withChecks,
      status: 'blocked-fail-closed',
      blocker: error instanceof Error ? error.message : String(error),
      preflight: null,
    }
  }
}
