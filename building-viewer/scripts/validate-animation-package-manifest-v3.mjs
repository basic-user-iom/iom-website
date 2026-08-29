/**
 * Dormant animation-aware package manifest v3 contract.
 *
 * One persistent shell covers unloaded far detail. Per-detail HLOD is optional;
 * regional HLOD packages are separate, streamed payloads. All payload bytes are
 * content-pinned before this format may be enabled.
 */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ANIMATION_PACKAGE_MANIFEST_VERSION = 3
export const ANIMATION_PACKAGE_HARD_LIMITS = Object.freeze({
  maxDetailTriangles: 250_000,
  maxAlwaysResidentShellTriangles: 150_000,
  maxResident: Object.freeze({
    web: Object.freeze({ triangles: 2_000_000, draws: 1_200, bytes: 512 * 1024 * 1024, encodedTextureBytes: 256 * 1024 * 1024, gpuTextureBytes: 768 * 1024 * 1024 }),
    quest: Object.freeze({ triangles: 800_000, draws: 500, bytes: 256 * 1024 * 1024, encodedTextureBytes: 64 * 1024 * 1024, gpuTextureBytes: 192 * 1024 * 1024 }),
  }),
  maxTransitionPeak: Object.freeze({
    web: Object.freeze({ triangles: 2_500_000, draws: 1_600, bytes: 768 * 1024 * 1024, encodedTextureBytes: 384 * 1024 * 1024, gpuTextureBytes: 1024 * 1024 * 1024 }),
    quest: Object.freeze({ triangles: 1_000_000, draws: 650, bytes: 384 * 1024 * 1024, encodedTextureBytes: 96 * 1024 * 1024, gpuTextureBytes: 256 * 1024 * 1024 }),
  }),
})

const VARIANTS = ['web', 'quest']
const LEVELS = ['lod0', 'hlod']
const RESOURCE_KEYS = ['triangles', 'draws', 'bytes', 'encodedTextureBytes', 'gpuTextureBytes']
const REQUIRED_ATTRIBUTES = ['POSITION']
const KNOWN_ATTRIBUTES = new Set([
  'POSITION', 'NORMAL', 'TEXCOORD_0', 'TEXCOORD_1', 'TEXCOORD_2', 'TEXCOORD_3',
  'TANGENT', 'COLOR_0',
])
const SHA256 = /^[a-fA-F0-9]{64}$/
const EPSILON = 1e-8
const LOSSLESS_ROLES = new Set(['fire-safety', 'building-connection'])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function positiveInteger(value, allowZero = false) {
  return Number.isSafeInteger(value) && value >= (allowZero ? 0 : 1)
}

function finiteTuple(value, length) {
  return Array.isArray(value) && value.length === length && value.every((item) => typeof item === 'number' && Number.isFinite(item))
}

function emptyEstimate() {
  return { triangles: 0, draws: 0, bytes: 0, encodedTextureBytes: 0, gpuTextureBytes: 0 }
}

function addEstimate(a, b) {
  return Object.fromEntries(RESOURCE_KEYS.map((key) => [key, a[key] + b[key]]))
}

function exceeded(value, limit) {
  return RESOURCE_KEYS.find((key) => value[key] > limit[key]) ?? null
}

function observedValue(values, url) {
  if (values instanceof Map) return values.get(url)
  if (isRecord(values)) return values[url]
  return undefined
}

function stringListSha256(values) {
  return createHash('sha256').update(JSON.stringify([...values].sort())).digest('hex')
}

function validateStringArray(value, path, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${path}: must be a non-empty array`)
    return []
  }
  const seen = new Set()
  const result = []
  value.forEach((entry, index) => {
    if (!isString(entry)) errors.push(`${path}[${index}]: must be a non-empty string`)
    else if (seen.has(entry)) errors.push(`${path}[${index}]: duplicates "${entry}"`)
    else {
      seen.add(entry)
      result.push(entry)
    }
  })
  return result
}

function validateHash(url, sha256, path, errors, options, bytes) {
  if (!isString(url)) errors.push(`${path}.url: must be a non-empty string`)
  if (typeof sha256 !== 'string' || !SHA256.test(sha256)) {
    errors.push(`${path}.sha256: must be exactly 64 hexadecimal SHA-256 characters`)
  }
  if (!isString(url)) return
  const observedHash = observedValue(options.observedHashes, url)
  if (options.requireHashVerification && observedHash === undefined) {
    errors.push(`${path}.sha256: cannot verify ${url}; no observed hash was supplied`)
  } else if (observedHash !== undefined && SHA256.test(sha256) && observedHash.toLowerCase() !== sha256.toLowerCase()) {
    errors.push(`${path}.sha256: is stale for ${url}; expected ${observedHash.toLowerCase()}`)
  }
  if (bytes !== undefined) {
    const observedBytes = observedValue(options.observedBytes, url)
    if (options.requireHashVerification && observedBytes === undefined) {
      errors.push(`${path}.bytes: cannot verify ${url}; no observed byte count was supplied`)
    } else if (observedBytes !== undefined && observedBytes !== bytes) {
      errors.push(`${path}.bytes: is stale for ${url}; expected ${observedBytes}`)
    }
  }
}

function validateEstimate(value, path, errors) {
  if (!isRecord(value)) {
    errors.push(`${path}: must declare triangles, draws, bytes, encodedTextureBytes and gpuTextureBytes`)
    return null
  }
  for (const key of RESOURCE_KEYS) {
    const mayBeZero = key === 'encodedTextureBytes' || key === 'gpuTextureBytes'
    if (!positiveInteger(value[key], mayBeZero)) {
      errors.push(`${path}.${key}: must be a safe integer >= ${mayBeZero ? 0 : 1}`)
    }
  }
  return RESOURCE_KEYS.every((key) =>
    positiveInteger(value[key], key === 'encodedTextureBytes' || key === 'gpuTextureBytes'),
  ) ? value : null
}

function validateAffine(transform, path, errors) {
  if (!isRecord(transform) || transform.space !== 'owner-local' || !finiteTuple(transform.matrix, 16)) {
    errors.push(`${path}: must declare an owner-local affine matrix`)
    return
  }
  const m = transform.matrix
  if (Math.abs(m[3]) > EPSILON || Math.abs(m[7]) > EPSILON || Math.abs(m[11]) > EPSILON || Math.abs(m[15] - 1) > EPSILON) {
    errors.push(`${path}.matrix: must be an affine column-major matrix`)
  }
  const determinant =
    m[0] * (m[5] * m[10] - m[9] * m[6]) -
    m[4] * (m[1] * m[10] - m[9] * m[2]) +
    m[8] * (m[1] * m[6] - m[5] * m[2])
  if (Math.abs(determinant) <= EPSILON) errors.push(`${path}.matrix: must be invertible`)
}

function validateBounds(bounds, path, errors) {
  if (!isRecord(bounds) || bounds.space !== 'owner-local' || !finiteTuple(bounds.min, 3) || !finiteTuple(bounds.max, 3)) {
    errors.push(`${path}: must contain finite owner-local min/max`)
    return
  }
  for (let axis = 0; axis < 3; axis += 1) {
    if (bounds.max[axis] <= bounds.min[axis]) errors.push(`${path}: max[${axis}] must be greater than min[${axis}]`)
  }
}

function boundsContain(container, candidate, epsilon = 1e-6) {
  if (
    !isRecord(container) || !finiteTuple(container.min, 3) || !finiteTuple(container.max, 3) ||
    !isRecord(candidate) || !finiteTuple(candidate.min, 3) || !finiteTuple(candidate.max, 3)
  ) return false
  return candidate.min.every((value, axis) => value >= container.min[axis] - epsilon) &&
    candidate.max.every((value, axis) => value <= container.max[axis] + epsilon)
}

export function validateAnimationPackageManifestV3(manifest, options = {}) {
  const errors = []
  const emptySummary = {
    packageCount: 0,
    ownerCount: 0,
    alwaysResidentShellTriangles: { web: 0, quest: 0 },
    resident: { web: emptyEstimate(), quest: emptyEstimate() },
  }
  if (!isRecord(manifest)) return { valid: false, errors: ['manifest: must be a JSON object'], summary: emptySummary }
  if (manifest.version !== 3) errors.push('version: must equal 3')
  if (typeof manifest.enabled !== 'boolean') errors.push('enabled: must be a boolean')
  if (!isString(manifest.modelId)) errors.push('modelId: must be a non-empty string')
  if (manifest.units !== 'meters') errors.push('units: must equal "meters"')

  const source = manifest.source
  if (!isRecord(source)) errors.push('source: must be an object')
  const sourceVariants = isRecord(source) ? source.variants : null
  for (const variant of VARIANTS) {
    const asset = isRecord(sourceVariants) ? sourceVariants[variant] : null
    if (!isRecord(asset)) errors.push(`source.variants.${variant}: must be an object`)
    else validateHash(asset.url, asset.sha256, `source.variants.${variant}`, errors, options)
  }
  if (!isRecord(source) || typeof source.animationDurationSeconds !== 'number' || !Number.isFinite(source.animationDurationSeconds) || source.animationDurationSeconds <= 0) {
    errors.push('source.animationDurationSeconds: must be a finite number > 0')
  }

  const rigAsset = manifest.rig
  if (!isRecord(rigAsset)) errors.push('rig: must be an object')
  else {
    validateHash(rigAsset.url, rigAsset.sha256, 'rig', errors, options, rigAsset.bytes)
    if (typeof rigAsset.animationDurationSeconds !== 'number' || !Number.isFinite(rigAsset.animationDurationSeconds) || rigAsset.animationDurationSeconds <= 0) {
      errors.push('rig.animationDurationSeconds: must be a finite number > 0')
    }
  }
  if (
    isRecord(manifest.source) &&
    isRecord(manifest.rig) &&
    Number.isFinite(manifest.source.animationDurationSeconds) &&
    Number.isFinite(manifest.rig.animationDurationSeconds) &&
    Math.abs(manifest.source.animationDurationSeconds - manifest.rig.animationDurationSeconds) > 1e-6
  ) {
    errors.push('rig.animationDurationSeconds: must match source.animationDurationSeconds')
  }
  const sourceOwnership = isRecord(manifest.source) ? manifest.source.ownership : null
  for (const variant of VARIANTS) {
    const ownership = isRecord(sourceOwnership) ? sourceOwnership[variant] : null
    if (!isRecord(ownership) || ownership.mode !== 'disjoint-additive') {
      errors.push(`source.ownership.${variant}.mode: must equal disjoint-additive`)
    }
    if (!isRecord(ownership) || !positiveInteger(ownership.pathCount)) {
      errors.push(`source.ownership.${variant}.pathCount: must be a safe integer >= 1`)
    }
    if (!isRecord(ownership) || typeof ownership.pathsSha256 !== 'string' || !SHA256.test(ownership.pathsSha256)) {
      errors.push(`source.ownership.${variant}.pathsSha256: must be exactly 64 hexadecimal SHA-256 characters`)
    }
  }
  if (!isRecord(manifest.rig) || !positiveInteger(manifest.rig.bytes)) errors.push('rig.bytes: must be a safe integer >= 1')
  const clips = isRecord(manifest.rig) ? manifest.rig.clips : null
  const clipNames = new Set()
  if (!Array.isArray(clips) || clips.length === 0) errors.push('rig.clips: must declare every clip')
  else clips.forEach((clip, index) => {
    if (!isRecord(clip) || !isString(clip.name)) errors.push(`rig.clips[${index}].name: must be a non-empty string`)
    else if (clipNames.has(clip.name)) errors.push(`rig.clips[${index}].name: must be unique`)
    else clipNames.add(clip.name)
    if (!isRecord(clip) || typeof clip.durationSeconds !== 'number' || !Number.isFinite(clip.durationSeconds) || clip.durationSeconds <= 0) {
      errors.push(`rig.clips[${index}].durationSeconds: must be a finite number > 0`)
    }
  })

  const budgets = manifest.budgets
  const detailBudget = isRecord(budgets) ? budgets.maxDetailTriangles : null
  const shellBudget = isRecord(budgets) ? budgets.maxAlwaysResidentShellTriangles : null
  if (!positiveInteger(detailBudget) || detailBudget > ANIMATION_PACKAGE_HARD_LIMITS.maxDetailTriangles) {
    errors.push(`budgets.maxDetailTriangles: cannot exceed ${ANIMATION_PACKAGE_HARD_LIMITS.maxDetailTriangles}`)
  }
  if (!positiveInteger(shellBudget) || shellBudget > ANIMATION_PACKAGE_HARD_LIMITS.maxAlwaysResidentShellTriangles) {
    errors.push(`budgets.maxAlwaysResidentShellTriangles: cannot exceed ${ANIMATION_PACKAGE_HARD_LIMITS.maxAlwaysResidentShellTriangles}`)
  }
  const residentBudgets = {}
  const peakBudgets = {}
  for (const variant of VARIANTS) {
    const resident = validateEstimate(isRecord(budgets?.maxResident) ? budgets.maxResident[variant] : null, `budgets.maxResident.${variant}`, errors)
    const peak = validateEstimate(isRecord(budgets?.maxTransitionPeak) ? budgets.maxTransitionPeak[variant] : null, `budgets.maxTransitionPeak.${variant}`, errors)
    if (resident) {
      residentBudgets[variant] = resident
      const key = exceeded(resident, ANIMATION_PACKAGE_HARD_LIMITS.maxResident[variant])
      if (key) errors.push(`budgets.maxResident.${variant}.${key}: exceeds runtime hard limit`)
    }
    if (peak) {
      peakBudgets[variant] = peak
      const key = exceeded(peak, ANIMATION_PACKAGE_HARD_LIMITS.maxTransitionPeak[variant])
      if (key) errors.push(`budgets.maxTransitionPeak.${variant}.${key}: exceeds runtime hard limit`)
      if (resident) {
        const below = RESOURCE_KEYS.find((key) => peak[key] < resident[key])
        if (below) errors.push(`budgets.maxTransitionPeak.${variant}.${below}: must be at least resident budget`)
      }
    }
  }

  const ownerIds = new Set()
  const ownerNames = new Set()
  const owners = isRecord(manifest.rig) ? manifest.rig.owners : null
  if (!Array.isArray(owners) || owners.length === 0) errors.push('rig.owners: must contain at least one persistent rig owner')
  else owners.forEach((owner, index) => {
    const path = `rig.owners[${index}]`
    if (!isRecord(owner)) return errors.push(`${path}: must be an object`)
    if (!isString(owner.id)) errors.push(`${path}.id: must be a non-empty string`)
    else if (ownerIds.has(owner.id)) errors.push(`${path}.id: duplicates rig owner "${owner.id}"`)
    else ownerIds.add(owner.id)
    if (!isString(owner.nodeName)) errors.push(`${path}.nodeName: must be a non-empty string`)
    else if (ownerNames.has(owner.nodeName)) errors.push(`${path}.nodeName: duplicates owner node "${owner.nodeName}"`)
    else ownerNames.add(owner.nodeName)
    if (owner.persistent !== true) errors.push(`${path}.persistent: must equal true`)
  })

  const packagesById = new Map()
  const ownedSourcePaths = { web: new Set(), quest: new Set() }
  const payloadMetrics = new Map()
  const persistent = new Map()
  const shellTotals = { web: emptyEstimate(), quest: emptyEstimate() }
  let shellCount = 0
  const packages = manifest.packages
  if (!Array.isArray(packages) || packages.length === 0) errors.push('packages: must contain at least one package')
  else packages.forEach((pkg, index) => {
    const path = `packages[${index}]`
    if (!isRecord(pkg)) return errors.push(`${path}: must be an object`)
    if (!isString(pkg.id)) errors.push(`${path}.id: must be a non-empty string`)
    else if (packagesById.has(pkg.id)) errors.push(`${path}.id: duplicates package "${pkg.id}"`)
    else packagesById.set(pkg.id, pkg)
    if (!['detail', 'regional-hlod', 'always-resident-shell'].includes(pkg.kind)) errors.push(`${path}.kind: is invalid`)
    if (!['streamed', 'persistent-lossless'].includes(pkg.residency)) errors.push(`${path}.residency: is invalid`)
    if (pkg.kind === 'always-resident-shell') {
      shellCount += 1
      if (pkg.residency !== 'persistent-lossless') errors.push(`${path}.residency: shell must be persistent-lossless`)
      if (isString(pkg.id)) persistent.set(pkg.id, 'hlod')
    } else if (pkg.kind === 'detail' && pkg.residency === 'persistent-lossless' && isString(pkg.id)) {
      persistent.set(pkg.id, 'lod0')
    } else if (pkg.kind === 'regional-hlod') {
      errors.push(`${path}.kind: regional HLOD is disabled until atomic replacement ownership is implemented`)
    }
    if (!isString(pkg.ownerId) || !ownerIds.has(pkg.ownerId)) errors.push(`${path}.ownerId: references unknown or invalid rig owner`)
    validateAffine(pkg.transform, `${path}.transform`, errors)
    for (const variant of VARIANTS) {
      validateBounds(pkg.selectionBounds?.[variant], `${path}.selectionBounds.${variant}`, errors)
    }
    const semanticRoles = validateStringArray(pkg.semanticRoles, `${path}.semanticRoles`, errors)
    if (
      semanticRoles.some((role) => LOSSLESS_ROLES.has(role)) &&
      (pkg.kind !== 'detail' || pkg.residency !== 'persistent-lossless')
    ) {
      errors.push(`${path}.residency: fire-safety and building-connection roles require persistent-lossless detail`)
    }
    const attrs = validateStringArray(pkg.requiredAttributes, `${path}.requiredAttributes`, errors)
    for (const required of REQUIRED_ATTRIBUTES) if (!attrs.includes(required)) errors.push(`${path}.requiredAttributes: must include ${required}`)
    for (const attribute of attrs) if (!KNOWN_ATTRIBUTES.has(attribute)) errors.push(`${path}.requiredAttributes: contains unsupported ${attribute}`)
    for (const variant of VARIANTS) {
      const sourcePaths = validateStringArray(
        isRecord(pkg.sourcePaths) ? pkg.sourcePaths[variant] : null,
        `${path}.sourcePaths.${variant}`,
        errors,
      )
      for (const sourcePath of sourcePaths) {
        if (ownedSourcePaths[variant].has(sourcePath)) errors.push(`${path}.sourcePaths.${variant}: duplicates global source ownership ${sourcePath}`)
        else ownedSourcePaths[variant].add(sourcePath)
      }
    }
    if (pkg.streaming !== undefined && !isRecord(pkg.streaming)) errors.push(`${path}.streaming: must be an object`)
    else if (isRecord(pkg.streaming)) {
      for (const key of ['lod0MarginMeters', 'lod0ExitMarginMeters', 'hlodMarginMeters', 'hlodExitMarginMeters']) {
        const value = pkg.streaming[key]
        if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
          errors.push(`${path}.streaming.${key}: must be finite and non-negative`)
        }
      }
      if (
        Number.isFinite(pkg.streaming.lod0MarginMeters) &&
        Number.isFinite(pkg.streaming.lod0ExitMarginMeters) &&
        pkg.streaming.lod0ExitMarginMeters < pkg.streaming.lod0MarginMeters
      ) errors.push(`${path}.streaming.lod0ExitMarginMeters: must be at least lod0MarginMeters`)
      if (
        Number.isFinite(pkg.streaming.hlodMarginMeters) &&
        Number.isFinite(pkg.streaming.hlodExitMarginMeters) &&
        pkg.streaming.hlodExitMarginMeters < pkg.streaming.hlodMarginMeters
      ) errors.push(`${path}.streaming.hlodExitMarginMeters: must be at least hlodMarginMeters`)
    }

    const metrics = { web: {}, quest: {} }
    for (const variant of VARIANTS) {
      const payloads = isRecord(pkg.variants) ? pkg.variants[variant] : null
      if (!isRecord(payloads)) {
        errors.push(`${path}.variants.${variant}: must be present`)
        continue
      }
      for (const level of LEVELS) {
        const payload = payloads[level]
        if (payload === undefined) continue
        const payloadPath = `${path}.variants.${variant}.${level}`
        if (!isRecord(payload)) {
          errors.push(`${payloadPath}: must be an object`)
          continue
        }
        validateBounds(payload.bounds, `${payloadPath}.bounds`, errors)
        if (
          isRecord(pkg.selectionBounds?.[variant]) &&
          isRecord(payload.bounds) &&
          !boundsContain(pkg.selectionBounds[variant], payload.bounds)
        ) {
          errors.push(`${payloadPath}.bounds: must be contained by selectionBounds.${variant}`)
        }
        const estimate = validateEstimate(payload.estimates, `${payloadPath}.estimates`, errors)
        validateHash(payload.url, payload.sha256, payloadPath, errors, options, estimate?.bytes)
        if (!estimate) continue
        metrics[variant][level] = estimate
        if (pkg.kind !== 'always-resident-shell' && estimate.triangles > detailBudget) {
          errors.push(`${payloadPath}.estimates.triangles: exceeds detail-package limit ${detailBudget}`)
        }
        if (pkg.kind === 'always-resident-shell' && level === 'hlod') shellTotals[variant] = addEstimate(shellTotals[variant], estimate)
        if (peakBudgets[variant]) {
          const key = exceeded(estimate, peakBudgets[variant])
          if (key) errors.push(`${payloadPath}.estimates.${key}: exceeds transition peak budget`)
        }
      }
      const lod0 = metrics[variant].lod0
      const hlod = metrics[variant].hlod
      if (pkg.kind === 'always-resident-shell') {
        if (!hlod) errors.push(`${path}.variants.${variant}.hlod: shell requires HLOD`)
        if (lod0) errors.push(`${path}.variants.${variant}.lod0: shell must not duplicate LOD0`)
      } else if (pkg.kind === 'regional-hlod') {
        if (!hlod) errors.push(`${path}.variants.${variant}.hlod: regional HLOD requires HLOD`)
        if (lod0) errors.push(`${path}.variants.${variant}.lod0: regional HLOD must not contain LOD0`)
      } else {
        if (!lod0) errors.push(`${path}.variants.${variant}.lod0: detail requires LOD0`)
        if (pkg.residency === 'persistent-lossless' && hlod) errors.push(`${path}.variants.${variant}.hlod: persistent-lossless detail must not duplicate HLOD`)
        if (lod0 && hlod && hlod.triangles > lod0.triangles) errors.push(`${path}.variants.${variant}.hlod.estimates.triangles: must not exceed LOD0`)
        if (lod0 && hlod && hlod.draws > lod0.draws) errors.push(`${path}.variants.${variant}.hlod.estimates.draws: must not exceed LOD0`)
        if (lod0 && hlod) {
          const lod0Margin = Number.isFinite(pkg.streaming?.lod0MarginMeters) ? pkg.streaming.lod0MarginMeters : 1.5
          const lod0ExitMargin = Number.isFinite(pkg.streaming?.lod0ExitMarginMeters)
            ? pkg.streaming.lod0ExitMarginMeters
            : lod0Margin + 2
          const hlodMargin = Number.isFinite(pkg.streaming?.hlodMarginMeters)
            ? pkg.streaming.hlodMarginMeters
            : lod0ExitMargin
          if (hlodMargin < lod0ExitMargin) {
            errors.push(`${path}.streaming.hlodMarginMeters: must be at least the effective lod0ExitMarginMeters when HLOD exists`)
          }
        }
      }
    }
    if (isString(pkg.id)) payloadMetrics.set(pkg.id, metrics)
  })

  if (shellCount !== 1) errors.push('packages: must contain exactly one always-resident-shell package')
  for (const variant of VARIANTS) {
    const ownership = isRecord(sourceOwnership) ? sourceOwnership[variant] : null
    if (isRecord(ownership) && positiveInteger(ownership.pathCount)) {
      if (ownedSourcePaths[variant].size !== ownership.pathCount) {
        errors.push(`source.ownership.${variant}.pathCount: does not match ${ownedSourcePaths[variant].size} globally disjoint package paths`)
      }
      const observedOwnershipHash = stringListSha256(ownedSourcePaths[variant])
      if (SHA256.test(ownership.pathsSha256) && observedOwnershipHash !== ownership.pathsSha256.toLowerCase()) {
        errors.push(`source.ownership.${variant}.pathsSha256: does not match declared package sourcePaths (${observedOwnershipHash})`)
      }
    }
  }
  for (const variant of VARIANTS) {
    if (shellTotals[variant].triangles > shellBudget) {
      errors.push(`packages.${variant}.alwaysResidentShell: ${shellTotals[variant].triangles} triangles exceeds ${shellBudget}`)
    }
  }

  const residentSummary = { web: emptyEstimate(), quest: emptyEstimate() }
  for (const variant of VARIANTS) {
    const entries = isRecord(manifest.residentSets) ? manifest.residentSets[variant] : null
    const selected = new Set()
    if (!Array.isArray(entries) || entries.length === 0) {
      errors.push(`residentSets.${variant}: must be a non-empty array`)
      continue
    }
    entries.forEach((entry, index) => {
      const path = `residentSets.${variant}[${index}]`
      if (!isRecord(entry) || !isString(entry.packageId) || !LEVELS.includes(entry.level)) {
        errors.push(`${path}: must reference one package and level`)
        return
      }
      if (selected.has(entry.packageId)) errors.push(`${path}.packageId: duplicates resident package`)
      selected.add(entry.packageId)
      if (!packagesById.has(entry.packageId)) {
        errors.push(`${path}.packageId: references unknown package`)
        return
      }
      const requiredLevel = persistent.get(entry.packageId)
      if (requiredLevel && entry.level !== requiredLevel) errors.push(`${path}.level: persistent package must select ${requiredLevel}`)
      const estimate = payloadMetrics.get(entry.packageId)?.[variant]?.[entry.level]
      if (!estimate) errors.push(`${path}.level: payload is unavailable for this variant`)
      else residentSummary[variant] = addEstimate(residentSummary[variant], estimate)
    })
    for (const packageId of persistent.keys()) {
      if (!selected.has(packageId)) errors.push(`residentSets.${variant}: must include persistent package ${packageId}`)
    }
    if (residentBudgets[variant]) {
      const key = exceeded(residentSummary[variant], residentBudgets[variant])
      if (key) errors.push(`residentSets.${variant}.${key}: ${residentSummary[variant][key]} exceeds ${residentBudgets[variant][key]}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      packageCount: packagesById.size,
      ownerCount: ownerIds.size,
      alwaysResidentShellTriangles: { web: shellTotals.web.triangles, quest: shellTotals.quest.triangles },
      resident: residentSummary,
    },
  }
}

export class AnimationPackageManifestV3Error extends Error {
  constructor(errors) {
    super(`Animation package manifest v3 failed:\n${errors.map((error) => `- ${error}`).join('\n')}`)
    this.name = 'AnimationPackageManifestV3Error'
    this.errors = errors
  }
}

export function assertAnimationPackageManifestV3(manifest, options = {}) {
  const result = validateAnimationPackageManifestV3(manifest, options)
  if (!result.valid) throw new AnimationPackageManifestV3Error(result.errors)
  return result.summary
}

async function sha256File(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

export function localAssetPath(url, manifestPath, assetRoot) {
  if (/^[a-z]+:\/\//i.test(url) || url.startsWith('__')) throw new Error(`cannot verify non-local asset URL: ${url}`)
  let base
  let assetPath
  if (url.startsWith('/')) {
    if (!assetRoot) throw new Error(`--asset-root is required to verify absolute asset URL: ${url}`)
    base = resolve(assetRoot)
    assetPath = resolve(base, url.replace(/^[/\\]+/, ''))
  } else {
    base = resolve(dirname(manifestPath))
    assetPath = resolve(base, url)
  }
  const descendant = relative(base, assetPath)
  if (descendant === '..' || descendant.startsWith(`..\\`) || descendant.startsWith('../') || isAbsolute(descendant)) {
    throw new Error(`asset URL escapes its verification root: ${url}`)
  }
  return assetPath
}

export async function validateAnimationPackageManifestV3File(manifestPath, { assetRoot, contractOnly = false } = {}) {
  const resolvedManifest = resolve(manifestPath)
  const manifest = JSON.parse(await readFile(resolvedManifest, 'utf8'))
  if (contractOnly) return validateAnimationPackageManifestV3(manifest)
  const observedHashes = {}
  const observedBytes = {}
  const assets = [manifest.source?.variants?.web, manifest.source?.variants?.quest, manifest.rig]
  for (const pkg of manifest.packages ?? []) {
    for (const variant of VARIANTS) for (const level of LEVELS) {
      const payload = pkg?.variants?.[variant]?.[level]
      if (payload) assets.push(payload)
    }
  }
  for (const asset of assets) {
    if (!isString(asset?.url)) continue
    const path = localAssetPath(asset.url, resolvedManifest, assetRoot)
    observedHashes[asset.url] = await sha256File(path)
    observedBytes[asset.url] = (await stat(path)).size
  }
  return validateAnimationPackageManifestV3(manifest, {
    observedHashes,
    observedBytes,
    requireHashVerification: true,
  })
}

function parseCliArgs(argv) {
  let manifestPath = null
  let assetRoot = null
  let contractOnly = false
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--asset-root') {
      assetRoot = argv[++index]
      if (!assetRoot) throw new Error('--asset-root requires a path')
    } else if (value === '--contract-only') contractOnly = true
    else if (!manifestPath) manifestPath = value
    else throw new Error(`unknown argument: ${value}`)
  }
  if (!manifestPath) throw new Error('usage: validate-animation-package-manifest-v3.mjs <manifest.json> [--asset-root <path>] [--contract-only]')
  return { manifestPath, assetRoot, contractOnly }
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) {
  try {
    const args = parseCliArgs(process.argv)
    const result = await validateAnimationPackageManifestV3File(args.manifestPath, args)
    if (!result.valid) {
      console.error(result.errors.map((error) => `ERROR ${error}`).join('\n'))
      process.exitCode = 1
    } else {
      console.log(
        `Animation package manifest v3 valid: ${result.summary.packageCount} packages, ` +
        `${result.summary.ownerCount} owners, resident ` +
        `${result.summary.resident.web.triangles.toLocaleString('en-US')} Web / ` +
        `${result.summary.resident.quest.triangles.toLocaleString('en-US')} Quest triangles`,
      )
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
