import { createHash } from 'node:crypto'

import {
  sha256,
  stringListSha256,
  WHOLE_LAYER_VARIANTS,
} from './whole-layer-ownership-contract.mjs'
import { composeWholeLayerOwnershipPlan } from './whole-layer-plan-composer.mjs'
import { ownerCandidatePayloadSetSha256 } from './whole-layer-owner-claims-composer.mjs'

export const PHASE_A_CANDIDATE_SCHEMA = 'IOM_PHASE_A_COMPLETE_DISABLED_CANDIDATE'
export const PHASE_A_REVIEW_SCHEMA = 'IOM_PHASE_A_COMPLETE_DISABLED_CANDIDATE_REVIEW'
export const PHASE_A_VERSION = 1

const GLB_MAGIC = 0x46546c67
const GLB_VERSION = 2
const GLB_JSON_CHUNK = 0x4e4f534a
const GLB_BIN_CHUNK = 0x004e4942
const SHA256 = /^[a-f0-9]{64}$/
const UNOWNED = '__unowned__'
const GROUND = 'Ground Floor._anim1'
const ANIMATED_OWNERS = Object.freeze([
  '1st Floor._anim1',
  '2st Floor._anim1',
  'Ceiling._anim1',
  'Mezzanine._anim1',
])
const PERSISTENT_OWNERS = Object.freeze([...ANIMATED_OWNERS, GROUND, UNOWNED])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exactJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function exactSetEqual(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value))
}

function sortedUnique(values) {
  return [...new Set(Array.isArray(values) ? values : [])].sort((left, right) =>
    String(left).localeCompare(String(right)))
}

function stableValue(value, numericPrecision = null) {
  if (Array.isArray(value)) return value.map((child) => stableValue(child, numericPrecision))
  if (isRecord(value)) return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, stableValue(child, numericPrecision)]))
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    if (Object.is(value, -0)) return 0
    return numericPrecision ? Number(value.toPrecision(numericPrecision)) : value
  }
  return value
}

function stableSha256(value, numericPrecision = null) {
  return sha256(JSON.stringify(stableValue(value, numericPrecision)))
}

function artifactPinMatches(pin, bytes) {
  return isRecord(pin) && Buffer.isBuffer(bytes) && pin.bytes === bytes.length && pin.sha256 === sha256(bytes)
}

function exactDisabledArtifact(value) {
  return value?.enabled === false && value?.activationApproved === false &&
    value?.runtimeIntegrated === false && value?.productionModified === false &&
    value?.productionRoutingChanged === false
}

function occurrenceReview(expectedIds, claims) {
  const expected = new Set(expectedIds)
  const occurrences = new Map()
  const unknown = []
  for (const claim of claims) {
    for (const id of claim.sourceUnitIds || []) {
      if (!occurrences.has(id)) occurrences.set(id, [])
      occurrences.get(id).push(claim.id)
      if (!expected.has(id)) unknown.push({ id, claimId: claim.id })
    }
  }
  const missing = [...expected].filter((id) => !occurrences.has(id)).sort()
  const duplicate = [...occurrences]
    .filter(([, claimIds]) => claimIds.length !== 1)
    .map(([id, claimIds]) => ({ id, claimIds }))
    .sort((left, right) => left.id.localeCompare(right.id))
  return {
    valid: missing.length === 0 && duplicate.length === 0 && unknown.length === 0,
    expectedAtomicUnits: expected.size,
    physicalClaimOccurrences: [...occurrences.values()].reduce((sum, claimIds) => sum + claimIds.length, 0),
    physicallyClaimedUniqueAtomicUnits: occurrences.size,
    missingCount: missing.length,
    duplicateCount: duplicate.length,
    unknownCount: unknown.length,
    missingSample: missing.slice(0, 20),
    duplicateSample: duplicate.slice(0, 20),
    unknownSample: unknown.slice(0, 20),
    sourceUnitIdsSha256: stringListSha256([...occurrences.keys()]),
  }
}

function parseGlb(bytes, label = 'GLB') {
  if (!Buffer.isBuffer(bytes)) throw new Error(`${label}: bytes are missing`)
  if (bytes.length < 20) throw new Error(`${label}: file is shorter than a GLB header and JSON chunk`)
  if (bytes.readUInt32LE(0) !== GLB_MAGIC) throw new Error(`${label}: magic is not glTF`)
  if (bytes.readUInt32LE(4) !== GLB_VERSION) throw new Error(`${label}: GLB version is not 2`)
  if (bytes.readUInt32LE(8) !== bytes.length) throw new Error(`${label}: declared length differs from actual bytes`)
  const chunks = []
  let offset = 12
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error(`${label}: truncated chunk header`)
    const byteLength = bytes.readUInt32LE(offset)
    const type = bytes.readUInt32LE(offset + 4)
    const start = offset + 8
    const end = start + byteLength
    if (end > bytes.length) throw new Error(`${label}: truncated chunk payload`)
    chunks.push({ type, bytes: bytes.subarray(start, end) })
    offset = end
  }
  if (offset !== bytes.length || chunks.length === 0 || chunks[0].type !== GLB_JSON_CHUNK) {
    throw new Error(`${label}: first chunk is not JSON or chunk alignment is invalid`)
  }
  let json
  try {
    json = JSON.parse(chunks[0].bytes.toString('utf8').trimEnd())
  } catch (error) {
    throw new Error(`${label}: invalid JSON chunk (${error instanceof Error ? error.message : String(error)})`)
  }
  return { json, chunks }
}

function encodeGlb(json, chunks) {
  const rawJson = Buffer.from(JSON.stringify(json), 'utf8')
  const jsonPadding = (4 - (rawJson.length % 4)) % 4
  const jsonBytes = Buffer.concat([rawJson, Buffer.alloc(jsonPadding, 0x20)])
  const outputChunks = [{ type: GLB_JSON_CHUNK, bytes: jsonBytes }, ...chunks.slice(1)]
  const totalBytes = 12 + outputChunks.reduce((sum, chunk) => sum + 8 + chunk.bytes.length, 0)
  const output = Buffer.alloc(totalBytes)
  output.writeUInt32LE(GLB_MAGIC, 0)
  output.writeUInt32LE(GLB_VERSION, 4)
  output.writeUInt32LE(totalBytes, 8)
  let offset = 12
  for (const chunk of outputChunks) {
    output.writeUInt32LE(chunk.bytes.length, offset)
    output.writeUInt32LE(chunk.type, offset + 4)
    chunk.bytes.copy(output, offset + 8)
    offset += 8 + chunk.bytes.length
  }
  return output
}

function identityNode(node) {
  if (!node) return false
  const matrix = node.matrix
  const identityMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  return (matrix === undefined || exactJson(matrix, identityMatrix)) &&
    (node.translation === undefined || exactJson(node.translation, [0, 0, 0])) &&
    (node.rotation === undefined || exactJson(node.rotation, [0, 0, 0, 1])) &&
    (node.scale === undefined || exactJson(node.scale, [1, 1, 1]))
}

function semanticRigReview(parsed, label) {
  const errors = []
  const json = parsed.json
  const scenes = Array.isArray(json.scenes) ? json.scenes : []
  const sceneIndex = Number.isInteger(json.scene) ? json.scene : 0
  const scene = scenes[sceneIndex]
  const nodes = Array.isArray(json.nodes) ? json.nodes : []
  if (!scene || !Array.isArray(scene.nodes)) errors.push(`${label}: default scene/root list is missing`)
  if (Array.isArray(json.meshes) && json.meshes.length) errors.push(`${label}: persistent rig contains meshes`)
  if (Array.isArray(json.cameras) && json.cameras.length) errors.push(`${label}: persistent rig contains cameras`)
  if (isRecord(json.extensions?.KHR_lights_punctual) && json.extensions.KHR_lights_punctual.lights?.length) {
    errors.push(`${label}: persistent rig contains lights`)
  }
  const nameIndices = new Map()
  nodes.forEach((node, index) => {
    if (!nameIndices.has(node?.name)) nameIndices.set(node?.name, [])
    nameIndices.get(node?.name).push(index)
    if (node?.mesh !== undefined || node?.camera !== undefined || node?.extensions?.KHR_lights_punctual?.light !== undefined) {
      errors.push(`${label}: node ${node?.name || index} contains a forbidden render/camera/light reference`)
    }
  })
  const clips = Array.isArray(json.animations) ? json.animations : []
  const channels = []
  for (const [clipIndex, clip] of clips.entries()) {
    for (const [channelIndex, channel] of (clip.channels || []).entries()) {
      const nodeIndex = channel?.target?.node
      const nodeName = nodes[nodeIndex]?.name
      const sampler = clip.samplers?.[channel?.sampler]
      if (!Number.isInteger(nodeIndex) || !nodeName || !sampler) {
        errors.push(`${label}: animation ${clipIndex} channel ${channelIndex} is unresolved`)
        continue
      }
      channels.push({
        clip: clip.name || `animation-${clipIndex}`,
        owner: nodeName,
        path: channel.target.path,
        interpolation: sampler.interpolation || 'LINEAR',
        inputAccessor: sampler.input,
        outputAccessor: sampler.output,
      })
    }
  }
  return { errors, json, scene, nodes, nameIndices, clips, channels }
}

function animationChannelSemantics(review) {
  return review.channels.map((channel) => ({
    clip: channel.clip,
    owner: channel.owner,
    path: channel.path,
    interpolation: channel.interpolation,
    input: review.json.accessors?.[channel.inputAccessor],
    inputBufferView: review.json.bufferViews?.[review.json.accessors?.[channel.inputAccessor]?.bufferView],
    output: review.json.accessors?.[channel.outputAccessor],
    outputBufferView: review.json.bufferViews?.[review.json.accessors?.[channel.outputAccessor]?.bufferView],
  })).sort((left, right) => `${left.clip}:${left.owner}:${left.path}`.localeCompare(`${right.clip}:${right.owner}:${right.path}`))
}

export function buildCombinedPersistentRig({ commonRigBytes, groundRigBytes }) {
  const errors = []
  let common
  let ground
  try {
    common = parseGlb(commonRigBytes, 'four-owner common rig')
    ground = parseGlb(groundRigBytes, 'Ground corrected rig')
  } catch (error) {
    return { valid: false, errors: [error instanceof Error ? error.message : String(error)], bytes: null, evidence: null }
  }
  const commonReview = semanticRigReview(common, 'four-owner common rig')
  const groundReview = semanticRigReview(ground, 'Ground corrected rig')
  errors.push(...commonReview.errors, ...groundReview.errors)

  for (const owner of ANIMATED_OWNERS) {
    if (commonReview.nameIndices.get(owner)?.length !== 1) errors.push(`four-owner common rig: ${owner} is not unique`)
    if (groundReview.nameIndices.get(owner)?.length !== 1) errors.push(`Ground corrected rig: ${owner} is not unique`)
  }
  if (commonReview.nameIndices.has(GROUND)) errors.push('four-owner common rig unexpectedly contains Ground Floor._anim1')
  if (groundReview.nameIndices.get(GROUND)?.length !== 1) errors.push('Ground corrected rig does not contain exactly one Ground Floor._anim1')
  const groundNode = groundReview.nodes[groundReview.nameIndices.get(GROUND)?.[0]]
  if (!identityNode(groundNode)) errors.push('Ground corrected rig Ground owner is not an identity anchor')
  if (groundReview.channels.some((channel) => channel.owner === GROUND)) errors.push('Ground corrected rig unexpectedly animates the Ground owner')

  const commonChannels = animationChannelSemantics(commonReview)
  const groundChannels = animationChannelSemantics(groundReview)
  if (!exactJson(commonChannels, groundChannels)) errors.push('four-owner and Ground-corrected rigs do not have identical owner/channel semantics')
  const commonBin = common.chunks.filter((chunk) => chunk.type === GLB_BIN_CHUNK)
  const groundBin = ground.chunks.filter((chunk) => chunk.type === GLB_BIN_CHUNK)
  const commonBinSha256 = sha256(Buffer.concat(commonBin.map((chunk) => chunk.bytes)))
  const groundBinSha256 = sha256(Buffer.concat(groundBin.map((chunk) => chunk.bytes)))
  if (commonBinSha256 !== groundBinSha256) errors.push('four-owner and Ground-corrected rig binary animation payloads differ')
  const channelOwners = groundReview.channels.map((channel) => channel.owner).sort()
  if (!exactJson(channelOwners, [...ANIMATED_OWNERS].sort())) errors.push('Ground corrected rig must contain exactly one channel for each animated owner')
  if (groundReview.nameIndices.has(UNOWNED)) errors.push('Ground corrected rig already contains a conflicting __unowned__ anchor')
  if (errors.length) return { valid: false, errors, bytes: null, evidence: null }

  const combinedJson = structuredClone(ground.json)
  const unownedNodeIndex = combinedJson.nodes.length
  combinedJson.nodes.push({ name: UNOWNED })
  combinedJson.scenes[Number.isInteger(combinedJson.scene) ? combinedJson.scene : 0].nodes.push(unownedNodeIndex)
  const combinedBytes = encodeGlb(combinedJson, ground.chunks)
  let combined
  try {
    combined = parseGlb(combinedBytes, 'combined Phase A rig')
  } catch (error) {
    return { valid: false, errors: [error instanceof Error ? error.message : String(error)], bytes: null, evidence: null }
  }
  const combinedReview = semanticRigReview(combined, 'combined Phase A rig')
  errors.push(...combinedReview.errors)
  for (const owner of PERSISTENT_OWNERS) {
    if (combinedReview.nameIndices.get(owner)?.length !== 1) errors.push(`combined Phase A rig: ${owner} is not unique`)
  }
  const combinedUnowned = combinedReview.nodes[combinedReview.nameIndices.get(UNOWNED)?.[0]]
  if (!identityNode(combinedUnowned)) errors.push('combined Phase A rig __unowned__ anchor is not identity')
  if (combinedReview.channels.some((channel) => channel.owner === UNOWNED || channel.owner === GROUND)) {
    errors.push('combined Phase A rig animates a static owner')
  }
  if (!exactJson(animationChannelSemantics(combinedReview), groundChannels)) {
    errors.push('combined Phase A rig changed animation channel semantics')
  }
  const combinedBin = combined.chunks.filter((chunk) => chunk.type === GLB_BIN_CHUNK)
  const combinedBinSha256 = sha256(Buffer.concat(combinedBin.map((chunk) => chunk.bytes)))
  if (combinedBinSha256 !== groundBinSha256) errors.push('combined Phase A rig changed binary animation payloads')

  const evidence = {
    valid: errors.length === 0,
    sourceRigs: {
      fourOwner: { sha256: sha256(commonRigBytes), bytes: commonRigBytes.length },
      groundCorrected: { sha256: sha256(groundRigBytes), bytes: groundRigBytes.length },
      binaryAnimationSha256: groundBinSha256,
      channelSemanticsSha256: sha256(JSON.stringify(groundChannels)),
    },
    output: {
      sha256: sha256(combinedBytes),
      bytes: combinedBytes.length,
      ownerNodeNames: [...PERSISTENT_OWNERS],
      ownerNodeNamesSha256: stringListSha256(PERSISTENT_OWNERS),
      animatedOwnerNodeNames: [...ANIMATED_OWNERS],
      staticIdentityOwnerNodeNames: [GROUND, UNOWNED],
      clipCount: combinedReview.clips.length,
      channelCount: combinedReview.channels.length,
      meshCount: combined.json.meshes?.length || 0,
      cameraCount: combined.json.cameras?.length || 0,
      lightCount: combined.json.extensions?.KHR_lights_punctual?.lights?.length || 0,
      animationBinarySha256: combinedBinSha256,
      channelSemanticsSha256: sha256(JSON.stringify(animationChannelSemantics(combinedReview))),
    },
  }
  return { valid: errors.length === 0, errors, bytes: combinedBytes, evidence }
}

function glbRecord(record) {
  if (!isRecord(record)) return null
  const metrics = isRecord(record.metrics) ? record.metrics : null
  return {
    url: record.url ?? record.path,
    sha256: record.sha256 ?? metrics?.sha256,
    bytes: record.bytes ?? metrics?.bytes,
  }
}

function verifyPayloadBytes(record, bytes, label, errors) {
  const normalized = glbRecord(record)
  if (!normalized || typeof normalized.url !== 'string' || !normalized.url || !SHA256.test(normalized.sha256 || '') ||
    !Number.isSafeInteger(normalized.bytes) || normalized.bytes <= 0) {
    errors.push(`${label}: payload pin is missing or invalid`)
    return null
  }
  if (!Buffer.isBuffer(bytes)) {
    errors.push(`${label}: payload bytes are missing`)
    return null
  }
  const actualSha256 = sha256(bytes)
  if (bytes.length !== normalized.bytes) errors.push(`${label}: byte pin is stale`)
  if (actualSha256 !== normalized.sha256) errors.push(`${label}: SHA-256 pin is stale`)
  try {
    parseGlb(bytes, label)
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
  }
  return { ...normalized, actualSha256, actualBytes: bytes.length }
}

function ownerSourceEntries(index) {
  const entries = (index?.packages || []).map((pkg) => ({
    id: pkg.id,
    kind: 'detail',
    sourcePaths: pkg.sourcePaths,
    variants: Object.fromEntries(WHOLE_LAYER_VARIANTS.map((variant) => [variant, pkg.variants?.[variant]?.lod0])),
  }))
  const shell = index?.shellCompletion?.requiredAlwaysResidentShell ?? index?.alwaysResidentShell
  if (shell) entries.push({
    id: shell.id,
    kind: 'always-resident-shell',
    sourcePaths: shell.sourcePaths,
    variants: Object.fromEntries(WHOLE_LAYER_VARIANTS.map((variant) => [variant, shell.variants?.[variant]])),
  })
  return entries
}

function planClaimForOwnerEntry(plan, variant, owner, entry) {
  const claims = plan?.variants?.[variant]?.claims || []
  const suffix = `:${entry.kind}:${entry.id}`
  const matches = claims.filter((claim) => claim.logicalOwner === owner && claim.id.endsWith(suffix))
  return matches.length === 1 ? matches[0] : null
}

function validateOwnerPayloads(ownerCandidates, plan) {
  const errors = []
  const claims = Object.fromEntries(WHOLE_LAYER_VARIANTS.map((variant) => [variant, []]))
  const variants = Object.fromEntries(WHOLE_LAYER_VARIANTS.map((variant) => [variant, {
    packagePayloads: 0,
    bytes: 0,
    atomicUnits: 0,
  }]))
  const owners = []
  for (const [candidateIndex, candidate] of (ownerCandidates || []).entries()) {
    const index = candidate?.index
    const audit = candidate?.audit
    const owner = index?.owner?.nodeName
    const ownerErrors = []
    if (index?.schema !== 'IOM_OWNER_LOCAL_DETAIL_PACKAGE_PILOT' || index?.version !== 1 || index?.enabled !== false) {
      ownerErrors.push('index is not a disabled owner-local package pilot v1')
    }
    if (audit?.schema !== 'IOM_OWNER_LOCAL_DETAIL_PACKAGE_AUDIT' || audit?.version !== 1 ||
      audit?.detailPayloadStatus !== 'passed' || audit?.activationStatus !== 'blocked' ||
      !Array.isArray(audit?.failures) || audit.failures.length !== 0) {
      ownerErrors.push('audit is not a passed-detail/blocked-activation audit')
    }
    if (audit?.payloadSetSha256 !== ownerCandidatePayloadSetSha256(index)) ownerErrors.push('audit payload-set digest is stale')
    const sourceEntries = ownerSourceEntries(index)
    if (!sourceEntries.length) ownerErrors.push('candidate has no physical source payload entries')
    for (const variant of WHOLE_LAYER_VARIANTS) {
      for (const entry of sourceEntries) {
        const record = entry.variants[variant]
        const label = `${owner || `candidate-${candidateIndex}`}/${variant}/${entry.id}`
        const bytes = candidate?.payloadBytes?.[record?.url]
        const verified = verifyPayloadBytes(record, bytes, label, ownerErrors)
        const claim = planClaimForOwnerEntry(plan, variant, owner, entry)
        if (!claim) ownerErrors.push(`${label}: no unique exact source-unit claim resolves to this physical payload`)
        else {
          claims[variant].push({
            id: `owner-payload:${owner}:${entry.kind}:${entry.id}:${variant}`,
            sourceUnitIds: [...claim.sourceUnitIds],
            evidenceKind: 'verified-owner-payload-bytes',
          })
          variants[variant].atomicUnits += claim.sourceUnitIds.length
        }
        if (verified) {
          variants[variant].packagePayloads += 1
          variants[variant].bytes += verified.actualBytes
        }
      }
    }
    const rigBytes = candidate?.payloadBytes?.[index?.rig?.url]
    verifyPayloadBytes(index?.rig, rigBytes, `${owner || `candidate-${candidateIndex}`}/rig`, ownerErrors)
    errors.push(...ownerErrors.map((error) => `${candidate?.indexPath || `candidate-${candidateIndex}`}: ${error}`))
    owners.push({
      owner,
      accepted: ownerErrors.length === 0,
      errors: ownerErrors,
      indexSha256: candidate?.indexBytes ? sha256(candidate.indexBytes) : null,
      auditSha256: candidate?.auditBytes ? sha256(candidate.auditBytes) : null,
      payloadSetSha256: audit?.payloadSetSha256 ?? null,
      activationStatus: audit?.activationStatus ?? null,
      blockers: audit?.blockers || [],
    })
  }
  return { valid: errors.length === 0 && owners.length === 5, errors, owners, claims, variants }
}

function validateRepeatPayloads(repeatCandidate, unownedPlan, logicalPlan) {
  const errors = []
  const manifest = repeatCandidate?.manifest
  const report = repeatCandidate?.report
  const browserQa = repeatCandidate?.browserQa
  if (!repeatCandidate) errors.push('repeat payload evidence is required')
  if (manifest?.schema !== 'iom-ground-floor-repeat-geometry-disabled-manifest-v1' || manifest?.enabled !== false ||
    manifest?.runtimeIntegrated !== false || manifest?.productionManifestChanged !== false) {
    errors.push('repeat manifest is not fail-closed')
  }
  if (report?.schema !== 'iom-ground-floor-repeat-geometry-release-candidate-v1' || report?.enabled !== false ||
    report?.productionManifestChanged !== false || report?.productionRoutingChanged !== false) {
    errors.push('repeat report is not fail-closed')
  }
  if (browserQa?.schema !== 'iom-ground-floor-repeat-release-browser-qa-v1' || browserQa?.status !== 'passed') {
    errors.push('repeat browser runtime QA has not passed')
  }
  const evidence = unownedPlan?.repeatCandidate?.evidence
  if (repeatCandidate?.manifestBytes && sha256(repeatCandidate.manifestBytes) !== evidence?.disabledManifest?.sha256) {
    errors.push('repeat manifest bytes are stale against the unowned partition plan')
  }
  if (repeatCandidate?.reportBytes && sha256(repeatCandidate.reportBytes) !== evidence?.report?.sha256) {
    errors.push('repeat report bytes are stale against the unowned partition plan')
  }
  const claims = {}
  const variants = {}
  for (const variant of WHOLE_LAYER_VARIANTS) {
    const lod0 = manifest?.variants?.[variant]?.lod0
    const payloadBytes = repeatCandidate?.payloadBytes?.[lod0?.url]
    const verified = verifyPayloadBytes(lod0, payloadBytes, `repeat/${variant}/lod0`, errors)
    for (const [level, record] of Object.entries(manifest?.variants?.[variant] || {})) {
      verifyPayloadBytes(record, repeatCandidate?.payloadBytes?.[record?.url], `repeat/${variant}/${level}`, errors)
    }
    const planClaim = (logicalPlan?.variants?.[variant]?.claims || []).find((claim) => claim.id === `unowned-repeat-plan:${variant}`)
    const plannedIds = (unownedPlan?.repeatCandidate?.variants?.[variant]?.batches || []).flatMap((batch) => batch.sourceUnitIds || []).sort()
    if (!planClaim || !exactSetEqual(new Set(planClaim.sourceUnitIds || []), new Set(plannedIds))) {
      errors.push(`${variant}: repeat physical payload cannot resolve its exact logical ownership claim`)
    }
    if (plannedIds.length !== 312 || new Set(plannedIds).size !== 312) errors.push(`${variant}: repeat claim is not exactly 312 units`)
    if (lod0?.sourceIdsSha256 !== manifest?.variants?.web?.lod0?.sourceIdsSha256) {
      errors.push(`${variant}: repeat source-identity payload digest differs across selectable payloads`)
    }
    claims[variant] = {
      id: `repeat-payload:${variant}:lod0`,
      sourceUnitIds: plannedIds,
      evidenceKind: 'verified-repeat-lod0-payload-bytes',
    }
    variants[variant] = {
      verified: Boolean(verified),
      bytes: verified?.actualBytes || 0,
      atomicUnits: plannedIds.length,
      sourceUnitIdsSha256: stringListSha256(plannedIds),
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    claims,
    variants,
    blockers: [...(manifest?.blockers || []), ...(report?.blockers || [])],
    physicalHardwareAcceptance: report?.gates?.physicalHardwarePerformance === true,
    browserAcceptanceEvidence: browserQa?.acceptanceEvidence === true,
  }
}

export function validateRepeatSpatialPayloads(repeatCandidate, unownedPlan, logicalPlan) {
  const errors = []
  const claims = {}
  const variants = {}
  const index = repeatCandidate?.index
  const audit = repeatCandidate?.audit
  if (!repeatCandidate) {
    errors.push('repeat spatial v2 index/audit evidence is required in final evidence mode')
    return {
      valid: false,
      errors,
      claims,
      variants,
      blockers: ['Emit and independently audit the complete disabled repeat-spatial v2 payload set.'],
      physicalHardwareAcceptance: false,
      browserAcceptanceEvidence: false,
    }
  }
  if (index?.schema !== 'IOM_GROUND_REPEAT_SPATIAL_PAYLOAD_V2' || index?.version !== 2) {
    errors.push('repeat spatial candidate schema/version is not v2')
  }
  if (index?.enabled !== false || index?.ready !== false || index?.runtimeIntegrated !== false ||
    index?.activationApproved !== false || index?.productionManifestChanged !== false ||
    index?.productionRoutingChanged !== false) {
    errors.push('repeat spatial candidate is not exactly fail-closed')
  }
  if (audit?.schema !== 'IOM_GROUND_REPEAT_SPATIAL_PHYSICAL_AUDIT_V2' || audit?.version !== 2 ||
    String(audit?.status).toUpperCase() !== 'PASS' || audit?.ready !== false ||
    audit?.activationApproved !== false || !Array.isArray(audit?.contractErrors) || audit.contractErrors.length !== 0) {
    errors.push('repeat spatial physical audit is missing, failed, or not fail-closed')
  }
  const actualIndexSha256 = Buffer.isBuffer(repeatCandidate?.indexBytes) ? sha256(repeatCandidate.indexBytes) : null
  if (!artifactPinMatches(audit?.index, repeatCandidate?.indexBytes) ||
    audit?.index?.reproducibilityDigestSha256 !== index?.reproducibilityDigestSha256) {
    errors.push('repeat spatial physical audit index byte/hash/digest pin is stale')
  }
  const expectedReproducibilityDigest = stableSha256({
    source: index?.source,
    visualApproval: index?.visualApproval,
    policy: index?.policy,
    packages: index?.packages,
    levelTotals: index?.levelTotals,
    residentWindows: index?.residentWindows,
    physicalTotals: index?.physicalTotals,
    gates: index?.gates,
  })
  if (index?.reproducibilityDigestSha256 !== expectedReproducibilityDigest ||
    audit?.reproducibilityDigestSha256 !== expectedReproducibilityDigest) {
    errors.push('repeat spatial reproducibility digest is stale')
  }
  if (!Array.isArray(index?.packages) || index.packages.length === 0 || index?.packageCount !== index?.packages?.length) {
    errors.push('repeat spatial package set is missing or package count is stale')
  }
  if (audit?.packageCount !== index?.packageCount || audit?.payloadCount !== index?.physicalTotals?.payloadCount) {
    errors.push('repeat spatial audit package/payload totals are stale')
  }

  const sourceIds = []
  const sourcePaths = []
  const payloadUrls = new Set()
  const levelTotals = { web: {}, quest: {} }
  const expectedLevels = { web: ['hlod', 'lod0'], quest: ['lod0'] }
  for (const variant of WHOLE_LAYER_VARIANTS) for (const level of expectedLevels[variant]) {
    levelTotals[variant][level] = {
      payloadCount: 0,
      logicalInstances: 0,
      primitiveInstances: 0,
      triangles: 0,
      draws: 0,
      glbBytes: 0,
      encodedTextureBytes: 0,
      gpuTextureBytes: 0,
      sourceIds: [],
    }
  }
  const packageIds = new Set()
  for (const [packageIndex, pkg] of (index?.packages || []).entries()) {
    const label = pkg?.id || `package-${packageIndex}`
    if (typeof pkg?.id !== 'string' || !pkg.id || packageIds.has(pkg.id)) errors.push(`${label}: duplicate or missing repeat package ID`)
    packageIds.add(pkg?.id)
    if (!Array.isArray(pkg?.sourceIds) || pkg.sourceIds.length === 0 ||
      !pkg.sourceIds.every((id) => Number.isSafeInteger(id) && id >= 0 && id < 78)) {
      errors.push(`${label}: source IDs are missing or outside 0..77`)
    }
    if (!Array.isArray(pkg?.sourcePaths) || pkg.sourcePaths.length !== pkg?.sourceIds?.length ||
      !pkg.sourcePaths.every((path) => typeof path === 'string' && path.length > 0)) {
      errors.push(`${label}: source-path correspondence is invalid`)
    }
    if (!['positive', 'mirrored'].includes(pkg?.parity) || typeof pkg?.spatialCell !== 'string' || !pkg.spatialCell) {
      errors.push(`${label}: parity/spatial-cell metadata is invalid`)
    }
    sourceIds.push(...(pkg?.sourceIds || []))
    sourcePaths.push(...(pkg?.sourcePaths || []))
    for (const variant of WHOLE_LAYER_VARIANTS) {
      const levels = pkg?.variants?.[variant]?.levels
      if (!isRecord(levels) || !exactJson(Object.keys(levels).sort(), expectedLevels[variant])) {
        errors.push(`${label}/${variant}: selectable level set must be exactly ${expectedLevels[variant].join(', ')}`)
        continue
      }
      for (const [level, record] of Object.entries(levels)) {
        const assetUrl = record?.asset?.url ?? record?.asset?.path
        const verified = verifyPayloadBytes(record?.asset, repeatCandidate?.payloadBytes?.[assetUrl],
          `repeat-spatial/${variant}/${level}/${label}`, errors)
        if (payloadUrls.has(assetUrl)) errors.push(`${label}/${variant}/${level}: payload path is reused by another selectable level`)
        payloadUrls.add(assetUrl)
        const logicalInstances = pkg?.sourceIds?.length || 0
        const primitiveInstances = logicalInstances * 4
        if (record?.audit?.logicalInstances !== logicalInstances || record?.audit?.primitiveInstances !== primitiveInstances ||
          record?.audit?.unsafeLocalMatrices !== 0) {
          errors.push(`${label}/${variant}/${level}: physical instance audit is stale`)
        }
        if (!exactJson(record?.bounds, record?.audit?.bounds) || !exactJson(record?.bounds, pkg?.variants?.[variant]?.selectionBounds) &&
          Object.keys(levels).length === 1) {
          errors.push(`${label}/${variant}/${level}: physical/selection bounds evidence is stale`)
        }
        if (record?.estimates?.triangles !== record?.audit?.triangles ||
          record?.estimates?.draws !== record?.audit?.draws || record?.estimates?.bytes !== record?.asset?.bytes ||
          record?.estimates?.encodedTextureBytes !== 0 || record?.estimates?.gpuTextureBytes !== 0 ||
          record?.audit?.textureMemory?.textureCount !== 0 || record?.audit?.textureMemory?.encodedTextureBytes !== 0 ||
          record?.audit?.textureMemory?.gpuTextureBytes !== 0) {
          errors.push(`${label}/${variant}/${level}: physical metric or texture-free evidence is stale`)
        }
        const total = levelTotals[variant][level]
        total.payloadCount += verified ? 1 : 0
        total.logicalInstances += logicalInstances
        total.primitiveInstances += record?.audit?.primitiveInstances || 0
        total.triangles += record?.audit?.triangles || 0
        total.draws += record?.audit?.draws || 0
        total.glbBytes += verified?.actualBytes || 0
        total.encodedTextureBytes += record?.audit?.textureMemory?.encodedTextureBytes || 0
        total.gpuTextureBytes += record?.audit?.textureMemory?.gpuTextureBytes || 0
        total.sourceIds.push(...(pkg?.sourceIds || []))
      }
    }
  }
  const sortedSourceIds = [...sourceIds].sort((left, right) => left - right)
  const expectedSourceIds = Array.from({ length: 78 }, (_, index) => index)
  const expectedPaths = sortedUnique(unownedPlan?.repeatCandidate?.candidateObjectSourcePaths || [])
  if (!exactJson(sortedSourceIds, expectedSourceIds)) errors.push('repeat spatial logical source IDs are not an exact 0..77 bijection')
  if (!exactSetEqual(new Set(sourcePaths), new Set(expectedPaths)) || sourcePaths.length !== 78) {
    errors.push('repeat spatial source paths differ from the pinned 78-path ownership contract')
  }
  const sourceIdsSha256 = sha256(JSON.stringify(sortedSourceIds))
  const sourcePathsSha256 = stringListSha256(sourcePaths)
  if (index?.ownership?.logicalInstances !== 78 || index?.ownership?.materialSlots !== 4 ||
    index?.ownership?.primitiveInstances !== 312 || index?.ownership?.sourceIdsSha256 !== sourceIdsSha256 ||
    index?.ownership?.sourcePathsSha256 !== sourcePathsSha256 ||
    unownedPlan?.repeatCandidate?.candidateObjectSourcePathsSha256 !== sourcePathsSha256) {
    errors.push('repeat spatial ownership totals or source identity digests are stale')
  }
  for (const variant of WHOLE_LAYER_VARIANTS) {
    for (const level of expectedLevels[variant]) {
      const computed = levelTotals[variant][level]
      const normalized = {
        payloadCount: computed.payloadCount,
        logicalInstances: computed.logicalInstances,
        primitiveInstances: computed.primitiveInstances,
        sourceIdsSha256: sha256(JSON.stringify([...computed.sourceIds].sort((left, right) => left - right))),
        triangles: computed.triangles,
        draws: computed.draws,
        glbBytes: computed.glbBytes,
        encodedTextureBytes: computed.encodedTextureBytes,
        gpuTextureBytes: computed.gpuTextureBytes,
      }
      if (!exactJson(index?.levelTotals?.[variant]?.[level], normalized) ||
        !exactJson(audit?.levelTotals?.[variant]?.[level], normalized)) {
        errors.push(`${variant}/${level}: repeat spatial authoritative level totals are stale`)
      }
    }
  }
  if (levelTotals.web.lod0.triangles !== 4_778_982 || levelTotals.quest.lod0.triangles !== 1_711_398 ||
    levelTotals.web.hlod.triangles !== 3_810_534) {
    errors.push('repeat spatial exact near/HLOD triangle totals changed')
  }
  const expectedPayloadCount = (index?.packages?.length || 0) * 3
  const physicalGlbBytes = Object.values(levelTotals).flatMap((variant) => Object.values(variant))
    .reduce((sum, total) => sum + total.glbBytes, 0)
  if (index?.physicalTotals?.payloadCount !== expectedPayloadCount || index?.physicalTotals?.glbBytes !== physicalGlbBytes ||
    index?.physicalTotals?.encodedTextureBytes !== 0 || index?.physicalTotals?.gpuTextureBytes !== 0) {
    errors.push('repeat spatial physical payload totals are stale')
  }
  for (const key of [
    'failClosed', 'exactLogicalSourceBijection', 'exactPrimitiveInstanceOwnership', 'perVariantCorrespondence',
    'boundedInstancesPerPackage', 'perPayloadDetailTriangleCap', 'positiveInstanceDeterminants',
    'parityHomogeneousPackages', 'materialsAndAttributesExact', 'compositeContentExact',
    'webMidVisualApprovalPinned', 'questMidExcludedNoSaving', 'physicalGlbBytesAndTextureResidency',
    'spatialResidentAndPeakBudgets',
  ]) if (index?.gates?.[key] !== true) errors.push(`repeat spatial gate ${key} has not passed`)
  if (index?.gates?.physicalHardwarePerformance !== false || index?.gates?.wholeLayerCombinedBudget !== false) {
    errors.push('repeat spatial pre-activation hardware/whole-layer gates must remain false')
  }
  if (index?.visualApproval?.status !== 'passed' ||
    index?.visualApproval?.manualResult !== 'passed-at-intended-switch-distance' ||
    !exactJson(index?.visualApproval?.approvedMidViews, ['back', 'bottom', 'front', 'grazing', 'left', 'right', 'top'])) {
    errors.push('repeat spatial Web HLOD visual approval pin is incomplete')
  }
  for (const variant of WHOLE_LAYER_VARIANTS) {
    const windows = index?.residentWindows?.[variant]
    if (windows?.entry?.passed !== true || windows?.exitUpperEnvelope?.passed !== true ||
      windows?.loadBeforeRetirePeak?.passed !== true || windows?.passed !== true) {
      errors.push(`${variant}: repeat spatial resident/transition budgets have not all passed`)
    }
  }
  for (const key of ['ownership', 'levelTotals', 'baselineComposite', 'residentWindows', 'gates']) {
    if (!exactJson(audit?.[key], index?.[key])) errors.push(`repeat spatial audit ${key} evidence differs from its pinned index`)
  }
  for (const variant of WHOLE_LAYER_VARIANTS) for (const level of expectedLevels[variant]) {
    if (index?.baselineComposite?.[variant]?.[level]?.exact !== true) {
      errors.push(`${variant}/${level}: repeat spatial baseline composite equivalence has not passed`)
    }
  }
  for (const variant of WHOLE_LAYER_VARIANTS) {
    const plannedIds = (unownedPlan?.repeatCandidate?.variants?.[variant]?.batches || [])
      .flatMap((batch) => batch.sourceUnitIds || []).sort()
    const planClaim = (logicalPlan?.variants?.[variant]?.claims || [])
      .find((claim) => claim.id === `unowned-repeat-plan:${variant}`)
    if (plannedIds.length !== 312 || new Set(plannedIds).size !== 312 ||
      !planClaim || !exactSetEqual(new Set(planClaim.sourceUnitIds || []), new Set(plannedIds))) {
      errors.push(`${variant}: repeat spatial payload cannot resolve the exact 312-unit logical ownership claim`)
    }
    claims[variant] = {
      id: `repeat-spatial-payload:${variant}:near-lod0`,
      sourceUnitIds: plannedIds,
      evidenceKind: 'verified-repeat-spatial-near-lod0-payload-bytes',
    }
    variants[variant] = {
      verified: levelTotals[variant].lod0.payloadCount === index?.packageCount,
      packagePayloads: levelTotals[variant].lod0.payloadCount,
      bytes: levelTotals[variant].lod0.glbBytes,
      atomicUnits: plannedIds.length,
      sourceUnitIdsSha256: stringListSha256(plannedIds),
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    claims,
    variants,
    indexSha256: actualIndexSha256,
    auditSha256: Buffer.isBuffer(repeatCandidate?.auditBytes) ? sha256(repeatCandidate.auditBytes) : null,
    blockers: index?.blockers || [],
    physicalHardwareAcceptance: false,
    browserAcceptanceEvidence: false,
    wholeLayerCombinedBudget: index?.gates?.wholeLayerCombinedBudget === true,
  }
}

function normalizeUnownedPackages(index) {
  return index?.packages ?? index?.staticPackages ?? []
}

function nearLod0PlanPackages(plan) {
  return [
    ...(plan?.nearLod0Packages || []),
    ...(plan?.shellCandidate?.nearLod0Packages || []),
    ...(plan?.structuralProxy?.nearLod0Packages || []),
  ]
}

function physicalUnownedPlanPackages(plan) {
  return [...(plan?.staticPackages || []), ...nearLod0PlanPackages(plan)]
}

function isExplicitStructuralNearLod0Package(pkg, planned, nearPlanIds) {
  const roles = [
    pkg?.role,
    pkg?.materialFidelityRole,
    pkg?.variants?.web?.role,
    pkg?.variants?.quest?.role,
    planned?.role,
    planned?.materialFidelityRole,
  ]
  return nearPlanIds.has(pkg?.id) || pkg?.nearLod0 === true || planned?.nearLod0 === true ||
    pkg?.materialFidelity?.nearLod0 === true || planned?.materialFidelity?.nearLod0 === true ||
    roles.some((role) => ['structural-near-lod0', 'structural-near-lod0-material-fidelity', 'near-lod0-material-fidelity'].includes(role))
}

function unownedVariantRecord(pkg, variant) {
  const record = pkg?.variants?.[variant]
  if (isRecord(record?.asset)) return { ...record.asset, url: record.asset.url ?? record.asset.path }
  return record?.lod0 ?? record?.payload ?? record
}

function unownedRecordSourceUnitIds(pkg, variant) {
  const record = pkg?.variants?.[variant]
  return record?.sourceUnitIds ?? pkg?.sourceUnitIds?.[variant] ?? []
}

function validateUnownedStaticPayloads(unownedCandidate, unownedPlan, unownedPlanBytes) {
  const errors = []
  const claims = Object.fromEntries(WHOLE_LAYER_VARIANTS.map((variant) => [variant, []]))
  const nearLod0Claims = Object.fromEntries(WHOLE_LAYER_VARIANTS.map((variant) => [variant, []]))
  const variants = {}
  if (!unownedCandidate) {
    errors.push('unowned static payload index/audit evidence is required; the partition plan alone is insufficient')
    return { valid: false, errors, claims, nearLod0Claims, variants, blockers: ['Emit and independently audit every planned unowned static Web/Quest GLB.'] }
  }
  const index = unownedCandidate.index
  const audit = unownedCandidate.audit
  if (index?.schema !== 'IOM_UNOWNED_STATIC_PAYLOAD_CANDIDATE' || index?.version !== 1 || index?.enabled !== false) {
    errors.push('unowned static payload index is not a disabled candidate v1')
  }
  if (index?.completePlannedPackageSet !== true) errors.push('unowned static payload candidate is not the complete planned package set')
  if (index?.productionModified !== false || index?.productionRoutingChanged !== false ||
    !String(index?.activationStatus || '').startsWith('disabled-')) {
    errors.push('unowned static payload candidate production/activation state is not fail-closed')
  }
  if (audit?.schema !== 'IOM_UNOWNED_STATIC_PAYLOAD_AUDIT' || audit?.version !== 1) {
    errors.push('unowned static payload audit schema/version is invalid')
  }
  if (!Array.isArray(audit?.failures) || audit.failures.length !== 0) errors.push('unowned static payload audit contains failures or lacks an exact failure list')
  if (audit?.passed !== true && !['passed', 'pass'].includes(String(audit?.status).toLowerCase())) {
    errors.push('unowned static payload audit status has not passed')
  }
  if (audit?.activationApproved !== false || index?.activationApproved === true) errors.push('unowned static payload evidence is not fail-closed')
  if (audit?.productionModified !== false || audit?.productionRoutingChanged !== false) {
    errors.push('unowned static payload audit production flags are not fail-closed')
  }
  if (audit?.failureCount !== 0) errors.push('unowned static payload audit failure count is nonzero')
  if (audit?.deterministicRebuild?.checked !== true || audit?.deterministicRebuild?.pass !== true) {
    errors.push('unowned static payload deterministic rebuild has not passed')
  }
  if (audit?.compositionConstraints?.structuralShellAdditiveCompositionAllowed !== false) {
    errors.push('unowned static audit must explicitly forbid additive structural-shell composition')
  }
  const actualIndexSha256 = unownedCandidate?.indexBytes ? sha256(unownedCandidate.indexBytes) : null
  if (audit?.index?.sha256 !== actualIndexSha256 || audit?.index?.bytes !== unownedCandidate?.indexBytes?.length ||
    audit?.index?.indexDigestSha256 !== index?.indexDigestSha256 ||
    audit?.index?.reproducibilityDigestSha256 !== index?.reproducibilityDigestSha256) {
    errors.push('unowned static payload audit is stale for the supplied index bytes')
  }
  if (!Buffer.isBuffer(unownedPlanBytes) || index?.plan?.sha256 !== sha256(unownedPlanBytes) ||
    index?.plan?.bytes !== unownedPlanBytes.length) {
    errors.push('unowned static payload plan byte pin is stale')
  }
  if ((index?.wholeLayerCoverageDigestSha256 ?? index?.plan?.wholeLayerCoverageDigestSha256) !== unownedPlan?.wholeLayerCoverageDigestSha256) {
    errors.push('unowned static payload whole-layer coverage pin is stale')
  }
  if ((index?.unownedPlanDigestSha256 ?? index?.planDigestSha256 ?? index?.plan?.planDigestSha256) !== unownedPlan?.planDigestSha256) {
    errors.push('unowned static payload plan digest pin is stale')
  }
  if (unownedPlan?.version === 2 && index?.plan?.version !== 2) {
    errors.push('unowned static payload index does not explicitly pin shell-aware plan version 2')
  }
  if (unownedPlan?.version === 2 && (!artifactPinMatches(audit?.plan, unownedPlanBytes) ||
    audit?.plan?.planDigestSha256 !== unownedPlan?.planDigestSha256)) {
    errors.push('unowned static payload audit shell-aware plan byte/hash/digest pin is stale')
  }
  const plannedPackages = physicalUnownedPlanPackages(unownedPlan)
  if (!Array.isArray(plannedPackages) || plannedPackages.length === 0) {
    errors.push('pinned unowned plan contains no staticPackages')
  }
  const plannedPackageIds = plannedPackages.map((pkg) => pkg?.id)
  if (plannedPackageIds.some((id) => typeof id !== 'string' || !id) || new Set(plannedPackageIds).size !== plannedPackageIds.length) {
    errors.push('pinned unowned plan has duplicate or missing physical package IDs')
  }
  const packages = normalizeUnownedPackages(index)
  if (packages.length !== (plannedPackages?.length || 0)) {
    errors.push(`unowned static payload package count differs from the pinned plan (${packages.length} != ${plannedPackages?.length || 0})`)
  }
  if (index?.packageCount !== packages.length) errors.push('unowned static payload index package count is stale')
  const nearPlanIds = new Set(nearLod0PlanPackages(unownedPlan).map((pkg) => pkg?.id))
  for (const variant of WHOLE_LAYER_VARIANTS) {
    const expectedIds = (plannedPackages || []).flatMap((pkg) => pkg.variants?.[variant]?.sourceUnitIds || []).sort()
    const expectedCount = expectedIds.length
    const expectedById = new Map((plannedPackages || []).map((pkg) => [pkg.id, pkg.variants?.[variant]?.sourceUnitIds || []]))
    let verifiedPayloads = 0
    let verifiedBytes = 0
    const ids = []
    for (const pkg of packages) {
      const record = unownedVariantRecord(pkg, variant)
      const sourceUnitIds = [...unownedRecordSourceUnitIds(pkg, variant)].sort()
      const expectedPackageIds = expectedById.get(pkg.id)
      if (!expectedPackageIds) errors.push(`${variant}/${pkg.id}: package is absent from the pinned partition plan`)
      else if (!exactSetEqual(new Set(sourceUnitIds), new Set(expectedPackageIds))) {
        errors.push(`${variant}/${pkg.id}: exact source-unit set differs from the pinned partition plan`)
      }
      const declaredDigest = record?.sourceUnitIdsSha256 ?? pkg?.variants?.[variant]?.sourceUnitIdsSha256
      if (declaredDigest !== stringListSha256(sourceUnitIds)) errors.push(`${variant}/${pkg.id}: source-unit digest is stale`)
      const verified = verifyPayloadBytes(record, unownedCandidate?.payloadBytes?.[record?.url], `unowned-static/${variant}/${pkg.id}`, errors)
      if (verified) {
        verifiedPayloads += 1
        verifiedBytes += verified.actualBytes
      }
      ids.push(...sourceUnitIds)
      claims[variant].push({
        id: `unowned-static-payload:${variant}:${pkg.id}`,
        sourceUnitIds,
        evidenceKind: 'verified-unowned-static-payload-bytes',
      })
      if (isExplicitStructuralNearLod0Package(pkg, plannedPackages.find((entry) => entry.id === pkg.id), nearPlanIds)) {
        nearLod0Claims[variant].push({
          id: `unowned-structural-near-lod0:${variant}:${pkg.id}`,
          sourceUnitIds,
          evidenceKind: 'verified-material-preserving-structural-near-lod0-payload-bytes',
        })
      }
    }
    const unique = new Set(ids)
    const aggregate = index?.aggregate?.[variant] ?? index?.coverage?.[variant] ?? index?.variants?.[variant]?.emitted
    if (ids.length !== expectedCount || unique.size !== expectedCount || !exactSetEqual(unique, new Set(expectedIds))) {
      errors.push(`${variant}: emitted unowned static payloads do not cover exactly the planned ${expectedCount.toLocaleString()} units`) 
    }
    if (aggregate) {
      const expectedCount = aggregate.expectedAtomicUnits ?? aggregate.expectedSourceUnitCount ?? aggregate.expected
      const emittedCount = aggregate.emittedAtomicUnits ?? aggregate.emittedSourceUnitCount ?? aggregate.sourceUnitCount ?? aggregate.emitted
      const digest = aggregate.sourceUnitIdsSha256
      if (expectedCount !== undefined && expectedCount !== ids.length) errors.push(`${variant}: aggregate expected unit count is stale`)
      if (emittedCount !== undefined && emittedCount !== ids.length) errors.push(`${variant}: aggregate emitted unit count is stale`)
      if (digest !== undefined && digest !== stringListSha256(ids)) errors.push(`${variant}: aggregate source-unit digest is stale`)
    }
    if (index?.variants?.[variant]?.byteGatePass !== true) errors.push(`${variant}: unowned static per-payload byte gate has not passed`)
    const auditedCoverage = audit?.exactCoverage?.[variant]
    if (auditedCoverage?.expectedAtomicUnits !== ids.length || auditedCoverage?.emittedAtomicUnits !== ids.length ||
      auditedCoverage?.omissionCount !== 0 || auditedCoverage?.duplicateCount !== 0 ||
      auditedCoverage?.sourceUnitIdsSha256 !== stringListSha256(ids)) {
      errors.push(`${variant}: unowned static audit exact-coverage evidence is stale`)
    }
    variants[variant] = {
      packagePayloads: verifiedPayloads,
      bytes: verifiedBytes,
      atomicUnits: ids.length,
      uniqueAtomicUnits: unique.size,
      sourceUnitIdsSha256: stringListSha256(ids),
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    claims,
    nearLod0Claims,
    variants,
    indexSha256: actualIndexSha256,
    auditSha256: unownedCandidate?.auditBytes ? sha256(unownedCandidate.auditBytes) : null,
    blockers: audit?.blockers || index?.blockers || [],
  }
}

function unitsForWholePaths(contract, variant, paths) {
  const inventory = contract?.variants?.[variant]?.inventory
  const wanted = new Set(paths || [])
  const nodes = (inventory?.nodes || []).filter((node) => node?.owner === UNOWNED && wanted.has(node?.ownerRelativePath))
  const nodeIds = new Set(nodes.map((node) => node.id))
  const byPath = new Map(nodes.map((node) => [node.ownerRelativePath,
    (inventory?.units || []).filter((unit) => unit.nodeId === node.id).map((unit) => unit.id).sort()]))
  return {
    sourceUnitIds: (inventory?.units || []).filter((unit) => nodeIds.has(unit.nodeId)).map((unit) => unit.id).sort(),
    byPath,
    missingPaths: sortedUnique(paths).filter((path) => !byPath.has(path)),
  }
}

function passedAudit(value) {
  const failures = value?.errors ?? value?.failures ?? value?.contractErrors
  const pass = value?.passed === true || String(value?.status || '').toUpperCase() === 'PASS'
  return pass && Array.isArray(failures) && failures.length === 0 && value?.activationApproved !== true
}

function allThresholdsPassed(value) {
  const records = Object.values(value || {}).filter(isRecord).filter((entry) => 'passed' in entry)
  return records.length > 0 && records.every((entry) => entry.passed === true)
}

export function validateStructuralProxyEvidence(structuralShellReview, contract, unownedPlan) {
  const errors = []
  const raw = structuralShellReview?.raw
  const candidate = raw?.candidate
  const repartition = raw?.repartition
  const ownershipAudit = raw?.ownershipAudit
  const dependencyAudit = raw?.dependencyAudit
  const topologyAudit = raw?.topologyAudit
  const projectionAudit = raw?.projectionAudit
  if (!structuralShellReview) {
    errors.push('final structural proxy candidate/repartition/projection evidence is required')
    return { valid: false, errors, variants: {}, blockers: ['Supply all pinned structural proxy v2 evidence.'] }
  }
  if (candidate?.schema !== 'IOM_UNOWNED_STRUCTURAL_PROXY_CANDIDATE' || candidate?.version !== 2 ||
    candidate?.ready !== false || !exactDisabledArtifact(candidate)) {
    errors.push('structural proxy candidate is not an exactly disabled v2 artifact')
  }
  const candidateDigestInput = structuredClone(candidate || {})
  delete candidateDigestInput.candidateDigestSha256
  if (candidate?.candidateDigestSha256 !== sha256(JSON.stringify(candidateDigestInput))) {
    errors.push('structural proxy candidate digest is stale')
  }
  if (repartition?.schema !== 'IOM_UNOWNED_STRUCTURAL_PROXY_REPARTITION' || repartition?.version !== 2 ||
    repartition?.enabled !== false || repartition?.ready !== false || repartition?.activationApproved !== false ||
    repartition?.runtimeIntegrated === true || repartition?.productionModified === true ||
    repartition?.productionRoutingChanged === true) {
    errors.push('structural proxy ownership repartition is not an exactly disabled v2 artifact')
  }
  const repartitionDigestInput = structuredClone(repartition || {})
  delete repartitionDigestInput.repartitionDigestSha256
  if (repartition?.repartitionDigestSha256 !== sha256(JSON.stringify(repartitionDigestInput))) {
    errors.push('structural proxy repartition digest is stale')
  }
  if (ownershipAudit?.schema !== 'IOM_UNOWNED_STRUCTURAL_PROXY_OWNERSHIP_AUDIT' || ownershipAudit?.version !== 2 ||
    ownershipAudit?.ready !== false || ownershipAudit?.activationApproved !== false || !passedAudit(ownershipAudit)) {
    errors.push('structural proxy ownership audit is missing, failed, or has the wrong schema/version')
  }
  if (dependencyAudit?.schema !== 'IOM_UNOWNED_STRUCTURAL_PROXY_DEPENDENCY_AUDIT' || dependencyAudit?.version !== 2 ||
    dependencyAudit?.enabled !== false || dependencyAudit?.ready !== false || dependencyAudit?.activationApproved !== false ||
    dependencyAudit?.conclusions?.texturesStripped !== true || dependencyAudit?.conclusions?.animationsStripped !== true ||
    dependencyAudit?.conclusions?.unreferencedDependencies !== 0 ||
    dependencyAudit?.conclusions?.sourcePbrMaterialFidelityPreserved !== false) {
    errors.push('structural proxy dependency audit is missing, unsafe, or has the wrong schema/version')
  }
  if (topologyAudit?.schema !== 'IOM_UNOWNED_STRUCTURAL_PROXY_TOPOLOGY_AUDIT' || topologyAudit?.version !== 2 ||
    topologyAudit?.enabled !== false || topologyAudit?.ready !== false || topologyAudit?.activationApproved !== false ||
    topologyAudit?.globalRatioDecimationUsed !== false || topologyAudit?.normalsRecalculated !== true ||
    topologyAudit?.opposingSideVisible !== true || !exactJson(topologyAudit?.boundsBefore, topologyAudit?.boundsAfter)) {
    errors.push('structural proxy topology audit is missing, unsafe, or has the wrong schema/version')
  }
  for (const [label, pin, bytes] of [
    ['candidate repartition', candidate?.evidencePins?.ownershipRepartition, raw?.repartitionBytes],
    ['candidate dependency audit', candidate?.evidencePins?.dependencyAudit, raw?.dependencyAuditBytes],
    ['candidate topology audit', candidate?.evidencePins?.topologyAudit, raw?.topologyAuditBytes],
    ['ownership-audit candidate', ownershipAudit?.candidateIndex, raw?.candidateBytes],
    ['ownership-audit repartition', ownershipAudit?.ownershipRepartition, raw?.repartitionBytes],
    ['ownership-audit dependency', ownershipAudit?.dependencyAudit, raw?.dependencyAuditBytes],
    ['ownership-audit topology', ownershipAudit?.topologyAudit, raw?.topologyAuditBytes],
  ]) if (!artifactPinMatches(pin, bytes)) errors.push(`structural proxy ${label} byte/hash pin is missing or stale`)
  if (projectionAudit?.schema !== 'IOM_UNOWNED_STRUCTURAL_PROXY_PROJECTION_AUDIT' || projectionAudit?.version !== 2 ||
    projectionAudit?.ready !== false || projectionAudit?.activationApproved !== false ||
    projectionAudit?.strongCoverage !== true || !allThresholdsPassed(projectionAudit?.thresholdResults)) {
    errors.push('structural proxy projection audit lacks strong multi-angle coverage or is not fail-closed v2 evidence')
  }
  const pins = [
    ['candidate index', projectionAudit?.evidencePins?.candidateIndex, raw?.candidateBytes],
    ['ownership repartition', projectionAudit?.evidencePins?.ownershipRepartition, raw?.repartitionBytes],
    ['ownership audit', projectionAudit?.evidencePins?.ownershipAudit, raw?.ownershipAuditBytes],
    ['dependency audit', projectionAudit?.evidencePins?.dependencyAudit, raw?.dependencyAuditBytes],
    ['topology audit', projectionAudit?.evidencePins?.topologyAudit, raw?.topologyAuditBytes],
  ]
  for (const [label, pin, bytes] of pins) {
    if (!artifactPinMatches(pin, bytes)) errors.push(`structural proxy projection ${label} pin is missing or stale`)
  }
  const selectedPaths = sortedUnique(candidate?.selectionPolicy?.sourceNodePaths || [])
  if (selectedPaths.length === 0 || (candidate?.selectionPolicy?.sourceNodePathsSha256 !== undefined &&
    candidate.selectionPolicy.sourceNodePathsSha256 !== stringListSha256(selectedPaths))) {
    errors.push('structural proxy whole-path selection is missing or its optional digest is stale')
  }
  const originalStaticByVariant = Object.fromEntries(WHOLE_LAYER_VARIANTS.map((variant) => [variant,
    (unownedPlan?.staticPackages || []).flatMap((pkg) => pkg?.variants?.[variant]?.sourceUnitIds || []).sort()]))
  const variants = {}
  for (const variant of WHOLE_LAYER_VARIANTS) {
    const proxy = repartition?.variants?.[variant]?.proxy
    const detail = repartition?.variants?.[variant]?.detailComplement
    const selection = candidate?.variants?.[variant]
    const expected = unitsForWholePaths(contract, variant, selectedPaths)
    const proxyPaths = sortedUnique(proxy?.sourcePaths || [])
    const proxyIds = [...(proxy?.sourceUnitIds || [])].sort()
    const originalStatic = originalStaticByVariant[variant]
    const originalSet = new Set(originalStatic)
    const expectedProxyIds = expected.sourceUnitIds.filter((id) => originalSet.has(id)).sort()
    const expectedDetailIds = originalStatic.filter((id) => !new Set(expectedProxyIds).has(id))
    if (expected.missingPaths.length || expected.sourceUnitIds.length !== expectedProxyIds.length) {
      errors.push(`${variant}: structural proxy selection is not an exact whole-path subset of the original static domain`)
    }
    if (!exactJson(proxyPaths, selectedPaths) || proxy?.sourcePathsSha256 !== stringListSha256(proxyPaths) ||
      !exactJson(proxyIds, expectedProxyIds) || proxy?.sourceUnitIdsSha256 !== stringListSha256(proxyIds) ||
      proxy?.sourceUnitCount !== proxyIds.length) {
      errors.push(`${variant}: structural proxy repartition whole-path/unit identity is stale`)
    }
    const detailIds = [...(detail?.sourceUnitIds || [])].sort()
    if (!exactJson(detailIds, expectedDetailIds) || detail?.sourceUnitIdsSha256 !== stringListSha256(detailIds) ||
      detail?.sourceUnitCount !== detailIds.length) {
      errors.push(`${variant}: structural proxy detail complement is not the exact original-static subtraction`)
    }
    const conservation = repartition?.variants?.[variant]?.conservation
    if (conservation?.wholeStaticUnitCount !== originalStatic.length || conservation?.overlapCount !== 0 ||
      conservation?.omissionCount !== 0 || conservation?.duplicateCount !== 0 ||
      conservation?.repeatOverlapCount !== 0 || conservation?.fireOverlapCount !== 0) {
      errors.push(`${variant}: structural proxy repartition conservation evidence is stale`)
    }
    const asset = selection?.asset
    const assetUrl = asset?.url ?? asset?.path
    verifyPayloadBytes(asset, structuralShellReview?.payloadBytes?.[assetUrl], `structural-proxy/${variant}`, errors)
    if (asset?.sourcePathCount !== selectedPaths.length || asset?.sourcePathsSha256 !== stringListSha256(selectedPaths) ||
      asset?.textureCount !== 0 || asset?.imageCount !== 0) {
      errors.push(`${variant}: structural proxy asset path/material evidence is stale`)
    }
    const dependency = dependencyAudit?.variants?.[variant]
    if (dependency?.meshCount !== asset?.meshCount || dependency?.materialCount !== asset?.materialCount ||
      dependency?.textureCount !== 0 || dependency?.animationCount !== 0 ||
      dependency?.unreferencedNodeCount !== 0 || dependency?.unreferencedMeshCount !== 0 ||
      dependency?.unreferencedMaterialCount !== 0 || dependency?.unreferencedTextureCount !== 0) {
      errors.push(`${variant}: structural proxy dependency counts differ from the final asset`)
    }
    const topology = topologyAudit?.variants?.[variant]
    if (topology?.expandedTriangles !== asset?.expandedTriangles || topology?.expandedTriangles > 150_000 ||
      topology?.zeroAreaTriangles !== 0 || topology?.representedSourcePathCount !== selectedPaths.length ||
      topology?.representedSourcePathsSha256 !== stringListSha256(selectedPaths) ||
      topology?.allMaterialsDoubleSided !== true || topology?.finitePositionsAndNormals !== true) {
      errors.push(`${variant}: structural proxy topology/path evidence differs from the final asset`)
    }
    const projectionPin = projectionAudit?.evidencePins?.finalProxyGlbs?.[variant]
    if (!isRecord(projectionPin) || projectionPin.bytes !== asset?.bytes || projectionPin.sha256 !== asset?.sha256) {
      errors.push(`${variant}: projection audit does not pin the final structural proxy GLB`)
    }
    variants[variant] = {
      sourcePaths: proxyPaths,
      sourcePathsSha256: stringListSha256(proxyPaths),
      sourceUnitIds: proxyIds,
      sourceUnitIdsSha256: stringListSha256(proxyIds),
      sourceUnitCount: proxyIds.length,
      detailComplementSourceUnitCount: detailIds.length,
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    variants,
    blockers: candidate?.blockers || [],
    candidateSha256: Buffer.isBuffer(raw?.candidateBytes) ? sha256(raw.candidateBytes) : null,
    repartitionSha256: Buffer.isBuffer(raw?.repartitionBytes) ? sha256(raw.repartitionBytes) : null,
    projectionAuditSha256: Buffer.isBuffer(raw?.projectionAuditBytes) ? sha256(raw.projectionAuditBytes) : null,
  }
}

function planStructuralRecord(plan) {
  return plan?.structuralProxy ?? plan?.shellCandidate
}

export function validateShellAwarePlanEvidence(shellAwarePlanEvidence, contract, contractBytes, unownedPlan,
  unownedPlanBytes, structuralShellReview) {
  const errors = []
  const plan = shellAwarePlanEvidence?.value
  if (!shellAwarePlanEvidence || !Buffer.isBuffer(shellAwarePlanEvidence?.bytes)) {
    errors.push('shell-aware partition plan v2 bytes are required')
    return { valid: false, errors, schema: null, version: null }
  }
  if (plan?.schema !== 'IOM_UNOWNED_STATIC_PARTITION_PLAN' || plan?.version !== 2 || plan?.ready !== false ||
    !exactDisabledArtifact(plan) || plan?.owner !== UNOWNED || plan?.atomicOwnershipUnit !== 'mesh-primitive-instance') {
    errors.push('shell-aware partition plan is not an exactly disabled unowned plan v2')
  }
  if (plan?.wholeLayerCoverageDigestSha256 !== contract?.coverageDigestSha256) {
    errors.push('shell-aware partition plan whole-layer coverage digest is stale')
  }
  const digestInput = structuredClone(plan || {})
  delete digestInput.planDigestSha256
  if (plan?.planDigestSha256 !== stableSha256(digestInput, 9)) errors.push('shell-aware partition plan digest is stale')
  const evidencePins = plan?.evidencePins
  if (!artifactPinMatches(evidencePins?.sourcePartitionPlan, unownedPlanBytes) ||
    evidencePins?.sourcePartitionPlan?.planDigestSha256 !== unownedPlan?.planDigestSha256) {
    errors.push('shell-aware plan source v1 partition byte/hash/digest pin is stale')
  }
  if (!artifactPinMatches(evidencePins?.wholeLayerContract, contractBytes) ||
    evidencePins?.wholeLayerContract?.coverageDigestSha256 !== contract?.coverageDigestSha256) {
    errors.push('shell-aware plan whole-layer contract byte/hash/digest pin is stale')
  }
  const raw = structuralShellReview?.raw
  for (const [key, bytes, label] of [
    ['shellCandidateIndex', raw?.candidateBytes, 'structural candidate'],
    ['ownershipRepartition', raw?.repartitionBytes, 'ownership repartition'],
    ['ownershipAudit', raw?.ownershipAuditBytes, 'ownership audit'],
    ['dependencyAudit', raw?.dependencyAuditBytes, 'dependency audit'],
    ['topologyAudit', raw?.topologyAuditBytes, 'topology audit'],
    ['projectionAudit', raw?.projectionAuditBytes, 'projection audit'],
  ]) {
    if (!artifactPinMatches(evidencePins?.[key], bytes)) errors.push(`shell-aware plan ${label} byte/hash pin is missing or stale`)
  }
  const structural = planStructuralRecord(plan)
  if (structural?.sourceSchema !== raw?.candidate?.schema || structural?.sourceVersion !== raw?.candidate?.version ||
    structural?.repartitionSchema !== raw?.repartition?.schema || structural?.repartitionVersion !== raw?.repartition?.version) {
    errors.push('shell-aware plan structural candidate/repartition schema pins are stale')
  }
  const plannedPackages = physicalUnownedPlanPackages(plan)
  if (!Array.isArray(plan?.staticPackages) || plan.staticPackages.length === 0 ||
    !plannedPackages.every((pkg) => pkg?.enabled === false && pkg?.owner === UNOWNED)) {
    errors.push('shell-aware plan physical package set is missing or not fail-closed')
  }
  const packageIds = plannedPackages.map((pkg) => pkg?.id)
  if (packageIds.some((id) => typeof id !== 'string' || !id) || new Set(packageIds).size !== packageIds.length) {
    errors.push('shell-aware plan physical package IDs are missing or duplicated')
  }
  if (plan?.staticPackagesDigestSha256 !== stableSha256(plan?.staticPackages || [], 9)) {
    errors.push('shell-aware plan static-package digest is stale')
  }
  const baseStatic = Object.fromEntries(WHOLE_LAYER_VARIANTS.map((variant) => [variant,
    (unownedPlan?.staticPackages || []).flatMap((pkg) => pkg?.variants?.[variant]?.sourceUnitIds || []).sort()]))
  for (const variant of WHOLE_LAYER_VARIANTS) {
    const proxyIds = structuralShellReview?.variants?.[variant]?.sourceUnitIds || []
    const proxySet = new Set(proxyIds)
    const expectedDetail = baseStatic[variant].filter((id) => !proxySet.has(id))
    const detailIds = (plan?.staticPackages || []).flatMap((pkg) => pkg?.variants?.[variant]?.sourceUnitIds || []).sort()
    const structuralIds = structural?.variants?.[variant]?.sourceUnitIds || []
    if (!exactSetEqual(new Set(structuralIds), new Set(proxyIds)) || structuralIds.length !== proxyIds.length) {
      errors.push(`${variant}: shell-aware plan structural proxy claim differs from the pinned repartition`)
    }
    if (!exactJson(detailIds, expectedDetail)) errors.push(`${variant}: shell-aware plan detail packages are not the exact proxy subtraction`)
    const detail = plan?.detailComplement?.variants?.[variant]
    if (detail?.atomicUnitCount !== expectedDetail.length || detail?.sourceUnitIdsSha256 !== stringListSha256(expectedDetail) ||
      detail?.requiredPayloadInputUnitIdsSha256 !== stringListSha256(expectedDetail)) {
      errors.push(`${variant}: shell-aware plan detail complement evidence is stale`)
    }
    const conservation = plan?.conservation?.variants?.[variant]
    const allUnowned = contract?.variants?.[variant]?.inventory?.units?.filter((unit) => unit.owner === UNOWNED).map((unit) => unit.id) || []
    const repeatIds = (plan?.repeatCandidate?.variants?.[variant]?.batches || []).flatMap((batch) => batch.sourceUnitIds || [])
    const fireIds = plan?.fireHoseMigration?.variants?.[variant]?.sourceUnitIds ||
      plan?.fireHoseMigration?.variants?.[variant]?.units?.map((unit) => unit.id) || []
    const logicalUnion = [...repeatIds, ...fireIds, ...proxyIds, ...detailIds]
    const occurrences = new Map()
    for (const id of logicalUnion) occurrences.set(id, (occurrences.get(id) || 0) + 1)
    if (!exactSetEqual(new Set(logicalUnion), new Set(allUnowned)) ||
      [...occurrences.values()].some((count) => count !== 1) || conservation?.multiplicityOne !== true ||
      conservation?.omittedAtomicUnits !== 0 || conservation?.overlapAtomicUnits !== 0) {
      errors.push(`${variant}: shell-aware plan whole-unowned multiplicity-one conservation failed`)
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    schema: plan?.schema ?? null,
    version: plan?.version ?? null,
    sha256: shellAwarePlanEvidence.sha256,
    bytes: shellAwarePlanEvidence.bytes.length,
    planDigestSha256: plan?.planDigestSha256 ?? null,
  }
}

export function validateStructuralMaterialFidelity({
  contract,
  structuralShellReview,
  shellAwarePlan,
  nearLod0Claims,
}) {
  const errors = []
  const candidateMaterial = structuralShellReview?.raw?.candidate?.safety?.materialFidelity ??
    structuralShellReview?.materialFidelity
  const repartitionMaterial = structuralShellReview?.raw?.repartition?.compositionGuard?.materialFidelity
  const planMaterial = shellAwarePlan?.materialFidelity ?? shellAwarePlan?.compositionGuard?.materialFidelity ??
    planStructuralRecord(shellAwarePlan)?.materialFidelity
  const textureFree = candidateMaterial?.proxyTextureCount === 0 && candidateMaterial?.proxyImageCount === 0
  if (!Number.isSafeInteger(candidateMaterial?.proxyTextureCount) || candidateMaterial.proxyTextureCount < 0 ||
    !Number.isSafeInteger(candidateMaterial?.proxyImageCount) || candidateMaterial.proxyImageCount < 0) {
    errors.push('structural proxy material texture/image counts are missing or invalid')
  }
  const variants = {}
  for (const variant of WHOLE_LAYER_VARIANTS) {
    const paths = structuralShellReview?.variants?.[variant]?.sourcePaths || []
    const expected = unitsForWholePaths(contract, variant, paths)
    const nearIds = (nearLod0Claims?.[variant] || []).flatMap((claim) => claim?.sourceUnitIds || [])
    const nearSet = new Set(nearIds)
    const missingWholePaths = []
    for (const path of paths) {
      const ids = expected.byPath.get(path) || []
      if (ids.length === 0 || ids.some((id) => !nearSet.has(id))) missingWholePaths.push(path)
    }
    const duplicateNearIds = [...nearIds.reduce((map, id) => map.set(id, (map.get(id) || 0) + 1), new Map())]
      .filter(([, count]) => count !== 1).map(([id]) => id)
    if (textureFree && missingWholePaths.length) {
      errors.push(`${variant}: texture-free structural proxy is the sole near owner for ${missingWholePaths.length} claimed whole paths`)
    }
    if (duplicateNearIds.length) errors.push(`${variant}: structural near-LOD0 ownership is duplicated`)
    variants[variant] = {
      claimedWholePathCount: paths.length,
      requiredSourceUnitCount: expected.sourceUnitIds.length,
      nearLod0SourceUnitCount: new Set(nearIds).size,
      missingWholePathCount: missingWholePaths.length,
      missingWholePathSample: missingWholePaths.slice(0, 20),
      nearLod0SourceUnitIdsSha256: stringListSha256(nearIds),
    }
  }
  if (textureFree) {
    if (candidateMaterial?.nearLod0Required !== true) {
      errors.push('texture-free structural candidate does not declare that material-preserving near LOD0 is required')
    }
    if (repartitionMaterial?.nearLod0Required !== true) {
      errors.push('structural repartition does not preserve the near-LOD0 material-fidelity requirement')
    }
    if (planMaterial?.nearLod0Required !== true || planMaterial?.nearLod0PackagePresent !== true ||
      planMaterial?.materialFidelityReady !== true || planMaterial?.explicitReplacementSemanticsValidated !== true) {
      errors.push('shell-aware plan lacks explicit material-preserving near-LOD0 replacement semantics')
    }
  } else if (candidateMaterial?.materialFidelityReady !== true) {
    errors.push('structural proxy material fidelity has not been approved')
  }
  return {
    valid: errors.length === 0,
    errors,
    textureFree,
    variants,
    explicitReplacementSemanticsValidated: planMaterial?.explicitReplacementSemanticsValidated === true,
  }
}

export function validatePhysicalResidentWindow(residentWindowReview, shellAwarePlanEvidence, unownedPayloadCandidate) {
  const errors = []
  const raw = residentWindowReview?.raw
  const plan = shellAwarePlanEvidence?.value
  if (!residentWindowReview || !raw) {
    errors.push('physical resident-window evidence is required in final evidence mode')
    return { valid: false, errors, accepted: false, blockers: ['Generate physical resident-window evidence from the exact v2 plan and payload audit.'] }
  }
  if (raw?.schema !== 'IOM_UNOWNED_STATIC_RESIDENT_WINDOW_PLAN' || raw?.version !== 1 ||
    raw?.enabled !== false || raw?.activationApproved !== false || raw?.releaseGatePassed !== false) {
    errors.push('resident-window artifact schema/state is not fail-closed')
  }
  if (raw?.sourcePlan?.version !== 2 || !artifactPinMatches(raw?.sourcePlan, shellAwarePlanEvidence?.bytes) ||
    raw?.sourcePlan?.planDigestSha256 !== plan?.planDigestSha256) {
    errors.push('resident-window source plan v2 byte/hash/digest pin is stale')
  }
  if (![
    'physical-payload-audit',
    'physical-emitted-payloads',
    'physical-emitted-payloads-shared-texture-registry',
  ].includes(raw?.metricEvidenceMode)) {
    errors.push('resident-window metrics are planning proxies rather than physical payload-audit evidence')
  }
  if (raw?.packageCount !== physicalUnownedPlanPackages(plan).length) {
    errors.push('resident-window package count differs from the complete shell-aware physical package set')
  }
  const payloadEvidence = raw?.payloadEvidence
  if (!artifactPinMatches(payloadEvidence?.index, unownedPayloadCandidate?.indexBytes) ||
    !artifactPinMatches(payloadEvidence?.audit, unownedPayloadCandidate?.auditBytes)) {
    errors.push('resident-window complete static payload index/audit pins are missing or stale')
  }
  if (raw?.metricEvidenceMode === 'physical-emitted-payloads-shared-texture-registry') {
    const qa = residentWindowReview?.sharedTextureBrowserQa
    if (!artifactPinMatches(payloadEvidence?.sharedTextureBrowserQa, qa?.bytes)) {
      errors.push('resident-window shared-texture browser-QA pin is missing or stale')
    }
    if (qa?.value?.schema !== 'IOM_UNOWNED_STATIC_SHARED_TEXTURE_BROWSER_QA' ||
      qa?.value?.version !== 1 || qa?.value?.passed !== true ||
      qa?.value?.enabled !== false || qa?.value?.activationApproved !== false ||
      qa?.value?.productionReferenced !== false ||
      !artifactPinMatches(qa?.value?.candidateIndex, unownedPayloadCandidate?.indexBytes) ||
      !artifactPinMatches(qa?.value?.candidateAudit, unownedPayloadCandidate?.auditBytes) ||
      !(qa?.value?.result?.acquisitions?.[1]?.sharedTextures > 0) ||
      qa?.value?.result?.afterRelease?.entries !== 0 ||
      qa?.value?.result?.afterRelease?.references !== 0) {
      errors.push('resident-window shared-texture browser QA did not prove compatible reuse and complete release')
    }
  }
  if (raw?.spatialPlanningGatePassed !== true) errors.push('resident-window spatial planning gate has not passed')
  for (const variant of WHOLE_LAYER_VARIANTS) {
    if (raw?.variants?.[variant]?.entry?.budget?.passed !== true ||
      raw?.variants?.[variant]?.exitHysteresis?.budget?.passed !== true) {
      errors.push(`${variant}: physical resident entry/exit-hysteresis budget has not passed`)
    }
  }
  const digestInput = structuredClone(raw || {})
  delete digestInput.evidenceDigestSha256
  const expectedDigest = sha256(`${JSON.stringify(digestInput, null, 2)}\n`)
  if (raw?.evidenceDigestSha256 !== expectedDigest) errors.push('resident-window evidence digest is stale')
  return {
    ...residentWindowReview,
    valid: errors.length === 0,
    accepted: errors.length === 0,
    completePayloadEvidence: artifactPinMatches(payloadEvidence?.index, unownedPayloadCandidate?.indexBytes) &&
      artifactPinMatches(payloadEvidence?.audit, unownedPayloadCandidate?.auditBytes),
    errors,
  }
}

function blocker(code, description, source = 'phase-a-gate') {
  return { code, source, description }
}

export function evaluatePhaseACompleteCandidate({
  finalMode = false,
  contract,
  contractBytes,
  ownerCandidates,
  migration,
  migrationBytes,
  unownedPlan,
  unownedPlanBytes,
  repeatCandidate,
  repeatSpatialCandidate = null,
  shellAwarePlanEvidence = null,
  unownedPayloadCandidate = null,
  commonRigBytes,
  groundRigBytes,
  structuralShellReview = null,
  residentWindowReview = null,
}) {
  const errors = []
  const nonGroundCandidates = (ownerCandidates || []).filter((candidate) => candidate?.index?.owner?.nodeName !== GROUND)
  const groundCandidate = (ownerCandidates || []).find((candidate) => candidate?.index?.owner?.nodeName === GROUND)
  if (nonGroundCandidates.length !== 4 || !groundCandidate || ownerCandidates?.length !== 5) {
    errors.push('exactly five distinct animated-owner package candidates are required (four production-source owners plus corrected Ground)')
  }
  const logical = composeWholeLayerOwnershipPlan({
    contract,
    contractBytes,
    ownerCandidates: nonGroundCandidates,
    groundCandidate,
    migration,
    migrationBytes,
    unownedPlan,
    unownedPlanBytes,
  })
  if (!logical.review.ownershipPlanComplete) errors.push(...logical.review.errors.map((error) => `logical composition: ${error}`))

  const ownerPayloads = validateOwnerPayloads(ownerCandidates, logical.plan)
  errors.push(...ownerPayloads.errors)
  const structuralProxy = finalMode
    ? validateStructuralProxyEvidence(structuralShellReview, contract, unownedPlan)
    : null
  if (structuralProxy) errors.push(...structuralProxy.errors.map((error) => `structural proxy: ${error}`))
  const shellAwarePlan = finalMode
    ? validateShellAwarePlanEvidence(shellAwarePlanEvidence, contract, contractBytes, unownedPlan,
      unownedPlanBytes, structuralShellReview)
    : null
  if (shellAwarePlan) errors.push(...shellAwarePlan.errors.map((error) => `shell-aware plan: ${error}`))
  const physicalUnownedPlan = finalMode ? shellAwarePlanEvidence?.value : unownedPlan
  const physicalUnownedPlanBytes = finalMode ? shellAwarePlanEvidence?.bytes : unownedPlanBytes
  const repeatPayloads = finalMode
    ? validateRepeatSpatialPayloads(repeatSpatialCandidate, unownedPlan, logical.plan)
    : validateRepeatPayloads(repeatCandidate, unownedPlan, logical.plan)
  errors.push(...repeatPayloads.errors)
  const unownedPayloads = validateUnownedStaticPayloads(unownedPayloadCandidate, physicalUnownedPlan, physicalUnownedPlanBytes)
  errors.push(...unownedPayloads.errors)
  const materialFidelity = finalMode ? validateStructuralMaterialFidelity({
    contract,
    structuralShellReview,
    shellAwarePlan: physicalUnownedPlan,
    nearLod0Claims: unownedPayloads.nearLod0Claims,
  }) : null
  if (materialFidelity) errors.push(...materialFidelity.errors.map((error) => `material fidelity: ${error}`))
  const physicalResidentWindow = finalMode
    ? validatePhysicalResidentWindow(residentWindowReview, shellAwarePlanEvidence, unownedPayloadCandidate)
    : residentWindowReview
  if (finalMode) errors.push(...(physicalResidentWindow?.errors || []).map((error) => `resident window: ${error}`))
  const combinedRig = buildCombinedPersistentRig({ commonRigBytes, groundRigBytes })
  errors.push(...combinedRig.errors.map((error) => `combined rig: ${error}`))
  const commonRigSha256 = Buffer.isBuffer(commonRigBytes) ? sha256(commonRigBytes) : null
  const groundRigSha256 = Buffer.isBuffer(groundRigBytes) ? sha256(groundRigBytes) : null
  for (const candidate of nonGroundCandidates) {
    if (candidate?.index?.rig?.sha256 !== commonRigSha256) {
      errors.push(`${candidate?.index?.owner?.nodeName || 'non-Ground owner'}: candidate does not pin the supplied common rig`)
    }
  }
  if (groundCandidate?.index?.rig?.sha256 !== groundRigSha256) {
    errors.push('Ground candidate does not pin the supplied Ground-corrected rig')
  }
  const candidateRigPinsValid = nonGroundCandidates.length === 4 &&
    nonGroundCandidates.every((candidate) => candidate?.index?.rig?.sha256 === commonRigSha256) &&
    groundCandidate?.index?.rig?.sha256 === groundRigSha256

  const coverage = {}
  for (const variant of WHOLE_LAYER_VARIANTS) {
    const expectedIds = contract?.variants?.[variant]?.inventory?.units?.map((unit) => unit.id) || []
    const physicalClaims = [
      ...ownerPayloads.claims[variant],
      repeatPayloads.claims[variant],
      ...unownedPayloads.claims[variant],
    ].filter(Boolean)
    const exact = occurrenceReview(expectedIds, physicalClaims)
    const ownerUnits = ownerPayloads.claims[variant].flatMap((claim) => claim.sourceUnitIds)
    const repeatUnits = repeatPayloads.claims[variant]?.sourceUnitIds || []
    const staticUnits = unownedPayloads.claims[variant].flatMap((claim) => claim.sourceUnitIds)
    coverage[variant] = {
      ...exact,
      physicalPayloads: ownerPayloads.variants[variant].packagePayloads +
        (repeatPayloads.variants[variant]?.packagePayloads ?? (repeatPayloads.variants[variant]?.verified ? 1 : 0)) +
        (unownedPayloads.variants[variant]?.packagePayloads || 0),
      verifiedPayloadBytes: ownerPayloads.variants[variant].bytes +
        (repeatPayloads.variants[variant]?.bytes || 0) +
        (unownedPayloads.variants[variant]?.bytes || 0),
      partitions: {
        fiveOwnerPayloadAtomicUnits: ownerUnits.length,
        repeatPayloadAtomicUnits: repeatUnits.length,
        unownedStaticPayloadAtomicUnits: staticUnits.length,
      },
    }
  }

  const payloadCoverageComplete = ownerPayloads.valid && repeatPayloads.valid && unownedPayloads.valid &&
    WHOLE_LAYER_VARIANTS.every((variant) => coverage[variant].valid)
  const structuralShellOverlap = Object.fromEntries(WHOLE_LAYER_VARIANTS.map((variant) => {
    const shellIds = structuralShellReview?.variants?.[variant]?.sourceUnitIds || []
    const plannedStaticIds = new Set((physicalUnownedPlan?.staticPackages || []).flatMap((pkg) =>
      pkg.variants?.[variant]?.sourceUnitIds || []))
    const emittedStaticIds = new Set(unownedPayloads.claims[variant].flatMap((claim) => claim.sourceUnitIds))
    const overlap = [...new Set(shellIds)].filter((id) => plannedStaticIds.has(id)).sort()
    const emittedOverlap = overlap.filter((id) => emittedStaticIds.has(id))
    return [variant, {
      shellAtomicUnits: new Set(shellIds).size,
      plannedDetailOverlapCount: overlap.length,
      emittedStaticPayloadOverlapCount: emittedOverlap.length,
      overlapSourceUnitIdsSha256: stringListSha256(overlap),
      overlapSample: overlap.slice(0, 20),
    }]
  }))
  const noStructuralShellPayloadOverlap = WHOLE_LAYER_VARIANTS.every((variant) =>
    structuralShellOverlap[variant].plannedDetailOverlapCount === 0)
  const structuralShellApproved = structuralShellReview?.accepted === true &&
    structuralShellReview?.activationApproved === true && noStructuralShellPayloadOverlap
  const residentWindowAccepted = physicalResidentWindow?.accepted === true
  const activationBlockers = []
  const resolvedPreconditions = []
  if (!payloadCoverageComplete) activationBlockers.push(blocker(
    'PAYLOAD_COVERAGE_INCOMPLETE',
    'Every source atomic unit must resolve exactly once to a SHA/byte-verified physical payload.',
  ))
  if (!combinedRig.valid || !candidateRigPinsValid) activationBlockers.push(blocker(
    'COMBINED_RIG_MISSING_OR_INVALID',
    'One mesh-free persistent rig must contain all five owner anchors plus an identity __unowned__ anchor while preserving the four animation channels exactly.',
  ))
  if (!structuralShellApproved) activationBlockers.push(blocker(
    'UNOWNED_STRUCTURAL_SHELL_NOT_APPROVED',
    'The unowned structural shell requires exact ownership audit and same-camera multi-angle visual approval before far-field substitution.',
    'unowned-structural-shell',
  ))
  if (!noStructuralShellPayloadOverlap) activationBlockers.push(blocker(
    'UNOWNED_SHELL_DETAIL_OWNERSHIP_OVERLAP',
    `The proposed always-resident shell overlaps ${structuralShellOverlap.web.plannedDetailOverlapCount} Web and ${structuralShellOverlap.quest.plannedDetailOverlapCount} Quest atomic units with the unrepartitioned 2,843-unit static detail set; repartition detail ownership or define an audited atomic replacement contract before composition.`,
    'unowned-structural-shell',
  ))
  if (finalMode && materialFidelity?.valid !== true) activationBlockers.push(blocker(
    'TEXTURE_FREE_PROXY_SOLE_OWNER',
    'A texture-free structural proxy cannot become the sole owner of its claimed whole paths. Exact material-preserving near-LOD0 packages and mutually exclusive proxy/near replacement semantics are required.',
    'structural-material-fidelity',
  ))
  for (const owner of ownerPayloads.owners) {
    for (const description of owner.blockers || []) {
      if (logical.review.migration.valid && description.includes('Six detached instanced fire-hose material batches')) {
        resolvedPreconditions.push({
          code: 'FIRE_OWNERSHIP_MIGRATION_COMPOSED',
          source: owner.owner,
          description,
        })
      } else activationBlockers.push(blocker('OWNER_CANDIDATE_ACTIVATION_BLOCKER', description, owner.owner))
    }
  }
  for (const description of repeatPayloads.blockers || []) {
    if (payloadCoverageComplete && description.includes('isolated family payload')) resolvedPreconditions.push({
      code: 'REPEAT_GLOBAL_OWNERSHIP_COMPOSED',
      source: 'repeat-candidate',
      description,
    })
    else activationBlockers.push(blocker('REPEAT_CANDIDATE_ACTIVATION_BLOCKER', description, 'repeat-candidate'))
  }
  for (const description of unownedPayloads.blockers || []) activationBlockers.push(blocker(
    'UNOWNED_PAYLOAD_ACTIVATION_BLOCKER', description, 'unowned-static-payloads',
  ))
  for (const description of structuralShellReview?.blockers || []) {
    if (payloadCoverageComplete && description.includes('does not yet have emitted release payload GLBs')) resolvedPreconditions.push({
      code: 'UNOWNED_STATIC_PAYLOADS_EMITTED',
      source: 'unowned-structural-shell',
      description,
    })
    else if (materialFidelity?.valid === true && (
      description.includes('Texture-free proxy cannot replace close-range source PBR materials') ||
      description.includes('Mutually exclusive near-LOD0 packages and explicit replacement semantics do not exist')
    )) resolvedPreconditions.push({
      code: 'STRUCTURAL_NEAR_LOD0_MATERIAL_CONTRACT_COMPOSED',
      source: 'unowned-structural-shell',
      description,
    })
    else activationBlockers.push(blocker('UNOWNED_STRUCTURAL_SHELL_BLOCKER', description, 'unowned-structural-shell'))
  }
  for (const description of physicalResidentWindow?.blockers || []) activationBlockers.push(blocker(
    'RESIDENT_WINDOW_EVIDENCE_BLOCKER', description, 'resident-window',
  ))
  if (!residentWindowAccepted) activationBlockers.push(blocker(
    'RESIDENT_WINDOW_AND_TRANSITION_PEAK_UNPROVEN',
    'A spatial resident-window, request concurrency, eviction policy, and load-before-retire transition peak must be proven against runtime hard limits.',
    'resident-window',
  ))
  if (!repeatPayloads.physicalHardwareAcceptance || !repeatPayloads.browserAcceptanceEvidence) activationBlockers.push(blocker(
    'PHYSICAL_HARDWARE_ACCEPTANCE_MISSING',
    'Headless SwiftShader evidence is diagnostic only; desktop Web GPU and Quest-class FPS/memory acceptance remain required.',
    'hardware-qa',
  ))
  if (finalMode && repeatPayloads.wholeLayerCombinedBudget !== true) activationBlockers.push(blocker(
    'REPEAT_WHOLE_LAYER_COMBINED_BUDGET_UNPROVEN',
    'The repeat-spatial isolated-family window passes, but its whole-layer combined resident and transition budget is intentionally still unproven.',
    'repeat-spatial-v2',
  ))
  activationBlockers.push(blocker(
    'FULL_LAYER_BROWSER_PARITY_NOT_APPROVED',
    'The composed five-owner + repeat + unowned payload layer still requires same-camera exterior/interior parity, normals/front-face, transparency, picking, hide/isolate, and transition QA.',
    'full-layer-qa',
  ))
  activationBlockers.push(blocker(
    'SHARED_TEXTURE_NETWORK_DUPLICATION_UNRESOLVED',
    'Package-local embedded textures still duplicate network and decoded memory across the complete layer.',
    'texture-residency',
  ))
  activationBlockers.push(blocker(
    'RUNTIME_MANIFEST_INTENTIONALLY_NOT_EMITTED',
    'This gate never emits a runtime manifest and never changes the production monolith route.',
  ))

  const blockerMap = new Map()
  for (const entry of activationBlockers) {
    const key = `${entry.code}:${entry.source}:${entry.description}`
    blockerMap.set(key, entry)
  }
  const blockers = [...blockerMap.values()]
  const finalEvidenceComplete = !finalMode || (structuralProxy?.valid === true && shellAwarePlan?.valid === true &&
    materialFidelity?.valid === true && physicalResidentWindow?.valid === true)
  const integrationEvidenceComplete = logical.review.ownershipPlanComplete && payloadCoverageComplete &&
    combinedRig.valid && candidateRigPinsValid && finalEvidenceComplete
  const candidate = {
    schema: PHASE_A_CANDIDATE_SCHEMA,
    version: PHASE_A_VERSION,
    modelId: contract?.modelId ?? null,
    enabled: false,
    activationApproved: false,
    productionModified: false,
    productionRoutingChanged: false,
    runtimeManifestEmitted: false,
    scope: 'disabled-evidence-only-no-runtime-route',
    wholeLayerCoverageDigestSha256: contract?.coverageDigestSha256 ?? null,
    inputs: {
      contractSha256: contractBytes ? sha256(contractBytes) : null,
      migrationSha256: migrationBytes ? sha256(migrationBytes) : null,
      unownedPlanSha256: unownedPlanBytes ? sha256(unownedPlanBytes) : null,
      ownerCandidateIndices: ownerPayloads.owners.map((owner) => ({ owner: owner.owner, sha256: owner.indexSha256 })),
      repeatManifestSha256: repeatCandidate?.manifestBytes ? sha256(repeatCandidate.manifestBytes) : null,
      repeatReportSha256: repeatCandidate?.reportBytes ? sha256(repeatCandidate.reportBytes) : null,
      repeatSpatialIndexSha256: repeatPayloads.indexSha256 ?? null,
      repeatSpatialAuditSha256: repeatPayloads.auditSha256 ?? null,
      shellAwarePlanSha256: shellAwarePlanEvidence?.sha256 ?? null,
      structuralProxyCandidateSha256: structuralProxy?.candidateSha256 ?? null,
      structuralProxyRepartitionSha256: structuralProxy?.repartitionSha256 ?? null,
      structuralProxyProjectionAuditSha256: structuralProxy?.projectionAuditSha256 ?? null,
      unownedPayloadIndexSha256: unownedPayloads.indexSha256 ?? null,
      unownedPayloadAuditSha256: unownedPayloads.auditSha256 ?? null,
    },
    combinedRig: combinedRig.evidence?.output ? {
      url: 'combined-persistent-rig.glb',
      ...combinedRig.evidence.output,
    } : null,
    variants: Object.fromEntries(WHOLE_LAYER_VARIANTS.map((variant) => [variant, {
      expectedAtomicUnits: coverage[variant].expectedAtomicUnits,
      physicallyClaimedUniqueAtomicUnits: coverage[variant].physicallyClaimedUniqueAtomicUnits,
      physicalPayloads: coverage[variant].physicalPayloads,
      verifiedPayloadBytes: coverage[variant].verifiedPayloadBytes,
      sourceUnitIdsSha256: coverage[variant].sourceUnitIdsSha256,
      partitions: coverage[variant].partitions,
    }])),
  }
  candidate.candidateDigestSha256 = sha256(JSON.stringify(candidate))
  const structuralReviewForOutput = finalMode ? structuralProxy : structuralShellReview
  const structuralSummary = structuralReviewForOutput ? Object.fromEntries(Object.entries(structuralReviewForOutput)
    .filter(([key]) => !['raw', 'payloadBytes'].includes(key))) : null
  const residentSummary = physicalResidentWindow ? Object.fromEntries(Object.entries(physicalResidentWindow)
    .filter(([key]) => !['raw', 'bytes'].includes(key))) : null
  const review = {
    schema: PHASE_A_REVIEW_SCHEMA,
    version: PHASE_A_VERSION,
    status: integrationEvidenceComplete ? 'payload-integration-complete-activation-blocked' : 'payload-integration-incomplete-fail-closed',
    integrationEvidenceComplete,
    logicalOwnershipComplete: logical.review.ownershipPlanComplete,
    payloadCoverageComplete,
    combinedRigComplete: combinedRig.valid && candidateRigPinsValid,
    finalEvidenceMode: finalMode,
    finalEvidenceComplete,
    candidateRigPinsValid,
    releaseReady: false,
    activationApproved: false,
    runtimeManifestEmitted: false,
    productionModified: false,
    productionRoutingChanged: false,
    errors,
    logicalReview: logical.review,
    ownerPayloads,
    repeatPayloads,
    unownedPayloads,
    combinedRig: combinedRig.evidence,
    structuralShell: {
      ...structuralSummary,
      activationApproved: structuralShellReview?.activationApproved === true,
      noStaticPayloadOverlap: noStructuralShellPayloadOverlap,
      overlap: structuralShellOverlap,
    },
    shellAwarePlan,
    materialFidelity,
    residentWindow: residentSummary,
    coverage,
    resolvedPreconditions,
    activationBlockers: blockers,
  }
  return { candidate, review, combinedRigBytes: combinedRig.bytes }
}

export function phaseAStableEvidenceDigest(candidate, review) {
  return createHash('sha256').update(JSON.stringify({
    candidate,
    review: {
      status: review.status,
      integrationEvidenceComplete: review.integrationEvidenceComplete,
      logicalOwnershipComplete: review.logicalOwnershipComplete,
      payloadCoverageComplete: review.payloadCoverageComplete,
      combinedRigComplete: review.combinedRigComplete,
      finalEvidenceMode: review.finalEvidenceMode,
      finalEvidenceComplete: review.finalEvidenceComplete,
      materialFidelity: review.materialFidelity,
      coverage: review.coverage,
      activationBlockers: review.activationBlockers,
    },
  })).digest('hex')
}
