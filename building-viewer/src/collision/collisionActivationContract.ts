import type { CollisionBuildReport } from './buildCollisionChunks'

export const COLLISION_ACTIVATION_CONTRACT_VERSION = 1 as const
export const COLLISION_COVERAGE_REPORT_VERSION = 1 as const

const SHA256 = /^[a-fA-F0-9]{64}$/
const RATIO_EPSILON = 1e-9

export type CollisionVec3 = [number, number, number]

/**
 * Cheap values produced by the live collision chunk builder. These values are
 * exact pins, not budgets: a different proxy must not silently inherit an
 * already-approved coverage report.
 */
export type CollisionRuntimeMetricPin = {
  triangles: number
  chunks: number
  boundsMin: CollisionVec3
  boundsMax: CollisionVec3
  preferredColliderMeshes: number
}

export type CollisionPinnedAsset = {
  url: string
  sha256: string
  bytes: number
}

export type CollisionRequiredProbe = {
  id: string
  minUpDot: number
  maxVerticalErrorMeters: number
}

export type CollisionRequiredStair = {
  id: string
  minHorizontalTriangles: number
  minSupportCoverageRatio: number
  minVerticalSpanMeters: number
}

export type CollisionActivationContractV1 = {
  version: typeof COLLISION_ACTIVATION_CONTRACT_VERSION
  modelId: string
  collision: CollisionPinnedAsset & { runtime: CollisionRuntimeMetricPin }
  coverageReport: CollisionPinnedAsset
  requirements: {
    spawnProbeId: string
    minHorizontalCoverageRatio: number
    minHorizontalCoveredCells: number
    minElevationBands: number
    minElevationSeparationMeters: number
    requiredProbes: CollisionRequiredProbe[]
    requiredStairs: CollisionRequiredStair[]
  }
}

export type CollisionCoverageBand = {
  id: string
  minY: number
  maxY: number
  requiredCells: number
  coveredCells: number
}

export type CollisionSupportProbeResult = {
  id: string
  kind: 'spawn' | 'walk' | 'stair-bottom' | 'stair-top' | 'landing'
  point: CollisionVec3
  supported: boolean
  hitPoint: CollisionVec3 | null
  upDot: number | null
  verticalErrorMeters: number | null
}

export type CollisionNamedStairResult = {
  id: string
  present: boolean
  horizontalTriangles: number
  supportCoverageRatio: number
  minY: number | null
  maxY: number | null
}

/**
 * Build-time evidence. The report bytes are independently pinned by the
 * activation contract, and the report is bound to the same collision SHA and
 * exact runtime metrics as the GLB.
 */
export type CollisionCoverageReportV1 = {
  version: typeof COLLISION_COVERAGE_REPORT_VERSION
  modelId: string
  collision: {
    sha256: string
    bytes: number
    runtime: CollisionRuntimeMetricPin
  }
  spawnSupport: CollisionSupportProbeResult
  broadHorizontalCoverage: {
    requiredCells: number
    coveredCells: number
    missingCells: number
    ratio: number
    elevationBands: CollisionCoverageBand[]
  }
  probes: CollisionSupportProbeResult[]
  namedStairs: CollisionNamedStairResult[]
}

export type CollisionActivationEvidence = {
  collisionSha256: string
  collisionBytes: number
  coverageReportSha256: string
  coverageReportBytes: number
  runtime: CollisionRuntimeMetricPin
}

export type CollisionActivationValidation = {
  valid: boolean
  errors: string[]
  summary: {
    triangles: number
    chunks: number
    horizontalCoverageRatio: number
    coveredElevationBands: number
    validatedProbes: number
    validatedStairs: number
  } | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function safeInteger(value: unknown, minimum = 0): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function finiteRatio(value: unknown): value is number {
  return finiteNumber(value) && value >= 0 && value <= 1
}

function finiteVec3(value: unknown): value is CollisionVec3 {
  return Array.isArray(value) && value.length === 3 && value.every(finiteNumber)
}

function validateSha256(value: unknown, path: string, errors: string[]): value is string {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    errors.push(`${path}: must be exactly 64 hexadecimal SHA-256 characters`)
    return false
  }
  return true
}

function validatePinnedAsset(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path}: must be a pinned asset object`)
    return
  }
  if (!nonEmptyString(value.url)) errors.push(`${path}.url: must be a non-empty string`)
  validateSha256(value.sha256, `${path}.sha256`, errors)
  if (!safeInteger(value.bytes, 1)) errors.push(`${path}.bytes: must be a positive safe integer`)
}

function validateRuntimeMetricShape(
  value: unknown,
  path: string,
  errors: string[],
): value is CollisionRuntimeMetricPin {
  const errorCount = errors.length
  if (!isRecord(value)) {
    errors.push(`${path}: must contain exact collision runtime metrics`)
    return false
  }
  if (!safeInteger(value.triangles, 1)) errors.push(`${path}.triangles: must be a positive safe integer`)
  if (!safeInteger(value.chunks, 1)) errors.push(`${path}.chunks: must be a positive safe integer`)
  if (!safeInteger(value.preferredColliderMeshes, 1)) {
    errors.push(`${path}.preferredColliderMeshes: must be a positive safe integer`)
  }
  const boundsMin = value.boundsMin
  const boundsMax = value.boundsMax
  const minOk = finiteVec3(boundsMin)
  const maxOk = finiteVec3(boundsMax)
  if (!minOk) errors.push(`${path}.boundsMin: must be a finite vec3`)
  if (!maxOk) errors.push(`${path}.boundsMax: must be a finite vec3`)
  if (minOk && maxOk) {
    for (let axis = 0; axis < 3; axis += 1) {
      if (boundsMax[axis]! < boundsMin[axis]!) {
        errors.push(`${path}: boundsMax[${axis}] must be at least boundsMin[${axis}]`)
      }
    }
  }
  return errors.length === errorCount
}

function compareRuntimeMetrics(
  actual: CollisionRuntimeMetricPin,
  expected: CollisionRuntimeMetricPin,
  path: string,
  errors: string[],
): void {
  for (const key of ['triangles', 'chunks', 'preferredColliderMeshes'] as const) {
    if (actual[key] !== expected[key]) {
      errors.push(`${path}.${key}: exact pin mismatch (${actual[key]} != ${expected[key]})`)
    }
  }
  for (const key of ['boundsMin', 'boundsMax'] as const) {
    for (let axis = 0; axis < 3; axis += 1) {
      if (actual[key][axis] !== expected[key][axis]) {
        errors.push(
          `${path}.${key}[${axis}]: exact pin mismatch (${actual[key][axis]} != ${expected[key][axis]})`,
        )
      }
    }
  }
}

/** Convert the live chunk-builder report to the exact, manifest-safe pin. */
export function collisionRuntimeMetricsFromReport(
  report: CollisionBuildReport,
): CollisionRuntimeMetricPin | null {
  if (!report.boundsMin || !report.boundsMax) return null
  return {
    triangles: report.triangles,
    chunks: report.chunks,
    boundsMin: [...report.boundsMin],
    boundsMax: [...report.boundsMax],
    preferredColliderMeshes: report.preferredColliders ? report.sourceMeshes : 0,
  }
}

/** Runtime-only exact comparison after the collision GLB has been parsed. */
export function validateCollisionRuntimeMetricPin(
  report: CollisionBuildReport,
  expected: CollisionRuntimeMetricPin,
): string[] {
  const errors: string[] = []
  if (!validateRuntimeMetricShape(expected, 'collision.runtime', errors)) return errors
  const actual = collisionRuntimeMetricsFromReport(report)
  if (!actual) {
    errors.push('collision.runtime: live collision has empty bounds')
    return errors
  }
  const actualShapeErrors: string[] = []
  if (!validateRuntimeMetricShape(actual, 'collision.runtime.actual', actualShapeErrors)) {
    errors.push(...actualShapeErrors)
    return errors
  }
  compareRuntimeMetrics(actual, expected, 'collision.runtime', errors)
  return errors
}

function validateProbeResult(
  value: unknown,
  path: string,
  errors: string[],
): value is CollisionSupportProbeResult {
  if (!isRecord(value)) {
    errors.push(`${path}: must be a support probe result`)
    return false
  }
  if (!nonEmptyString(value.id)) errors.push(`${path}.id: must be a non-empty string`)
  if (!['spawn', 'walk', 'stair-bottom', 'stair-top', 'landing'].includes(String(value.kind))) {
    errors.push(`${path}.kind: is not a supported probe kind`)
  }
  if (!finiteVec3(value.point)) errors.push(`${path}.point: must be a finite vec3`)
  if (typeof value.supported !== 'boolean') errors.push(`${path}.supported: must be boolean`)
  if (value.hitPoint !== null && !finiteVec3(value.hitPoint)) {
    errors.push(`${path}.hitPoint: must be a finite vec3 or null`)
  }
  if (value.upDot !== null && !finiteRatio(value.upDot)) {
    errors.push(`${path}.upDot: must be a ratio or null`)
  }
  if (value.verticalErrorMeters !== null && (!finiteNumber(value.verticalErrorMeters) || value.verticalErrorMeters < 0)) {
    errors.push(`${path}.verticalErrorMeters: must be a non-negative number or null`)
  }
  return nonEmptyString(value.id)
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) repeated.add(value)
    seen.add(value)
  }
  return [...repeated]
}

function validateRequirements(value: unknown, errors: string[]): void {
  const path = 'contract.requirements'
  if (!isRecord(value)) {
    errors.push(`${path}: must be an activation requirements object`)
    return
  }
  if (!nonEmptyString(value.spawnProbeId)) errors.push(`${path}.spawnProbeId: must be a non-empty string`)
  if (!finiteRatio(value.minHorizontalCoverageRatio) || value.minHorizontalCoverageRatio <= 0) {
    errors.push(`${path}.minHorizontalCoverageRatio: must be within (0, 1]`)
  }
  if (!safeInteger(value.minHorizontalCoveredCells, 1)) {
    errors.push(`${path}.minHorizontalCoveredCells: must be a positive safe integer`)
  }
  if (!safeInteger(value.minElevationBands, 2)) {
    errors.push(`${path}.minElevationBands: must be at least 2; a single plane is not activation-safe`)
  }
  if (!finiteNumber(value.minElevationSeparationMeters) || value.minElevationSeparationMeters <= 0) {
    errors.push(`${path}.minElevationSeparationMeters: must be greater than zero`)
  }

  if (!Array.isArray(value.requiredProbes) || value.requiredProbes.length < 2) {
    errors.push(`${path}.requiredProbes: must contain at least spawn plus one independent support probe`)
  } else {
    const ids: string[] = []
    value.requiredProbes.forEach((probe, index) => {
      const probePath = `${path}.requiredProbes[${index}]`
      if (!isRecord(probe)) {
        errors.push(`${probePath}: must be a probe requirement`)
        return
      }
      if (!nonEmptyString(probe.id)) errors.push(`${probePath}.id: must be a non-empty string`)
      else ids.push(probe.id)
      if (!finiteRatio(probe.minUpDot) || probe.minUpDot <= 0) {
        errors.push(`${probePath}.minUpDot: must be within (0, 1]`)
      }
      if (!finiteNumber(probe.maxVerticalErrorMeters) || probe.maxVerticalErrorMeters < 0) {
        errors.push(`${probePath}.maxVerticalErrorMeters: must be non-negative`)
      }
    })
    for (const id of duplicates(ids)) errors.push(`${path}.requiredProbes: duplicate id "${id}"`)
    if (nonEmptyString(value.spawnProbeId) && !ids.includes(value.spawnProbeId)) {
      errors.push(`${path}.spawnProbeId: must also appear in requiredProbes`)
    }
  }

  if (!Array.isArray(value.requiredStairs) || value.requiredStairs.length === 0) {
    errors.push(`${path}.requiredStairs: must contain at least one named stair; a flat plane cannot satisfy full activation`)
  } else {
    const ids: string[] = []
    value.requiredStairs.forEach((stair, index) => {
      const stairPath = `${path}.requiredStairs[${index}]`
      if (!isRecord(stair)) {
        errors.push(`${stairPath}: must be a stair requirement`)
        return
      }
      if (!nonEmptyString(stair.id)) errors.push(`${stairPath}.id: must be a non-empty string`)
      else ids.push(stair.id)
      if (!safeInteger(stair.minHorizontalTriangles, 2)) {
        errors.push(`${stairPath}.minHorizontalTriangles: must be at least 2`)
      }
      if (!finiteRatio(stair.minSupportCoverageRatio) || stair.minSupportCoverageRatio <= 0) {
        errors.push(`${stairPath}.minSupportCoverageRatio: must be within (0, 1]`)
      }
      if (!finiteNumber(stair.minVerticalSpanMeters) || stair.minVerticalSpanMeters <= 0) {
        errors.push(`${stairPath}.minVerticalSpanMeters: must be greater than zero`)
      }
    })
    for (const id of duplicates(ids)) errors.push(`${path}.requiredStairs: duplicate id "${id}"`)
  }
}

function validateContractShape(value: unknown, errors: string[]): value is CollisionActivationContractV1 {
  if (!isRecord(value)) {
    errors.push('contract: must be an object')
    return false
  }
  if (value.version !== COLLISION_ACTIVATION_CONTRACT_VERSION) {
    errors.push(`contract.version: must equal ${COLLISION_ACTIVATION_CONTRACT_VERSION}`)
  }
  if (!nonEmptyString(value.modelId)) errors.push('contract.modelId: must be a non-empty string')
  validatePinnedAsset(value.collision, 'contract.collision', errors)
  if (isRecord(value.collision)) {
    validateRuntimeMetricShape(value.collision.runtime, 'contract.collision.runtime', errors)
  }
  validatePinnedAsset(value.coverageReport, 'contract.coverageReport', errors)
  validateRequirements(value.requirements, errors)
  return errors.length === 0
}

function validateCoverageShape(value: unknown, errors: string[]): value is CollisionCoverageReportV1 {
  if (!isRecord(value)) {
    errors.push('coverage: must be an object')
    return false
  }
  if (value.version !== COLLISION_COVERAGE_REPORT_VERSION) {
    errors.push(`coverage.version: must equal ${COLLISION_COVERAGE_REPORT_VERSION}`)
  }
  if (!nonEmptyString(value.modelId)) errors.push('coverage.modelId: must be a non-empty string')
  if (!isRecord(value.collision)) errors.push('coverage.collision: must bind the measured collision asset')
  else {
    validateSha256(value.collision.sha256, 'coverage.collision.sha256', errors)
    if (!safeInteger(value.collision.bytes, 1)) {
      errors.push('coverage.collision.bytes: must be a positive safe integer')
    }
    validateRuntimeMetricShape(value.collision.runtime, 'coverage.collision.runtime', errors)
  }
  validateProbeResult(value.spawnSupport, 'coverage.spawnSupport', errors)

  if (!isRecord(value.broadHorizontalCoverage)) {
    errors.push('coverage.broadHorizontalCoverage: must be present')
  } else {
    const coverage = value.broadHorizontalCoverage
    if (!safeInteger(coverage.requiredCells, 1)) {
      errors.push('coverage.broadHorizontalCoverage.requiredCells: must be positive')
    }
    if (!safeInteger(coverage.coveredCells, 0)) {
      errors.push('coverage.broadHorizontalCoverage.coveredCells: must be a non-negative integer')
    }
    if (!safeInteger(coverage.missingCells, 0)) {
      errors.push('coverage.broadHorizontalCoverage.missingCells: must be a non-negative integer')
    }
    if (!finiteRatio(coverage.ratio)) {
      errors.push('coverage.broadHorizontalCoverage.ratio: must be within [0, 1]')
    }
    if (!Array.isArray(coverage.elevationBands) || coverage.elevationBands.length === 0) {
      errors.push('coverage.broadHorizontalCoverage.elevationBands: must be non-empty')
    } else {
      const ids: string[] = []
      coverage.elevationBands.forEach((band, index) => {
        const bandPath = `coverage.broadHorizontalCoverage.elevationBands[${index}]`
        if (!isRecord(band)) {
          errors.push(`${bandPath}: must be a coverage band`)
          return
        }
        if (!nonEmptyString(band.id)) errors.push(`${bandPath}.id: must be a non-empty string`)
        else ids.push(band.id)
        if (!finiteNumber(band.minY) || !finiteNumber(band.maxY) || band.maxY < band.minY) {
          errors.push(`${bandPath}: minY/maxY must be finite and ordered`)
        }
        if (!safeInteger(band.requiredCells, 1)) errors.push(`${bandPath}.requiredCells: must be positive`)
        if (!safeInteger(band.coveredCells, 0)) errors.push(`${bandPath}.coveredCells: must be non-negative`)
        if (safeInteger(band.requiredCells, 1) && safeInteger(band.coveredCells, 0) && band.coveredCells > band.requiredCells) {
          errors.push(`${bandPath}.coveredCells: cannot exceed requiredCells`)
        }
      })
      for (const id of duplicates(ids)) {
        errors.push(`coverage.broadHorizontalCoverage.elevationBands: duplicate id "${id}"`)
      }
    }
  }

  if (!Array.isArray(value.probes)) errors.push('coverage.probes: must be an array')
  else {
    const ids: string[] = []
    value.probes.forEach((probe, index) => {
      if (validateProbeResult(probe, `coverage.probes[${index}]`, errors)) ids.push(probe.id)
    })
    for (const id of duplicates(ids)) errors.push(`coverage.probes: duplicate id "${id}"`)
  }
  if (!Array.isArray(value.namedStairs)) errors.push('coverage.namedStairs: must be an array')
  else {
    const ids: string[] = []
    value.namedStairs.forEach((stair, index) => {
      const path = `coverage.namedStairs[${index}]`
      if (!isRecord(stair)) {
        errors.push(`${path}: must be a named stair result`)
        return
      }
      if (!nonEmptyString(stair.id)) errors.push(`${path}.id: must be a non-empty string`)
      else ids.push(stair.id)
      if (typeof stair.present !== 'boolean') errors.push(`${path}.present: must be boolean`)
      if (!safeInteger(stair.horizontalTriangles, 0)) errors.push(`${path}.horizontalTriangles: must be non-negative`)
      if (!finiteRatio(stair.supportCoverageRatio)) errors.push(`${path}.supportCoverageRatio: must be within [0, 1]`)
      if (stair.minY !== null && !finiteNumber(stair.minY)) errors.push(`${path}.minY: must be finite or null`)
      if (stair.maxY !== null && !finiteNumber(stair.maxY)) errors.push(`${path}.maxY: must be finite or null`)
      if (finiteNumber(stair.minY) && finiteNumber(stair.maxY) && stair.maxY < stair.minY) {
        errors.push(`${path}: maxY must be at least minY`)
      }
    })
    for (const id of duplicates(ids)) errors.push(`coverage.namedStairs: duplicate id "${id}"`)
  }
  return errors.length === 0
}

function observedPinsMatch(
  contract: CollisionActivationContractV1,
  evidence: CollisionActivationEvidence,
  errors: string[],
): void {
  if (!validateSha256(evidence.collisionSha256, 'evidence.collisionSha256', errors)) return
  if (!validateSha256(evidence.coverageReportSha256, 'evidence.coverageReportSha256', errors)) return
  if (!safeInteger(evidence.collisionBytes, 1)) errors.push('evidence.collisionBytes: must be positive')
  if (!safeInteger(evidence.coverageReportBytes, 1)) errors.push('evidence.coverageReportBytes: must be positive')
  if (evidence.collisionSha256.toLowerCase() !== contract.collision.sha256.toLowerCase()) {
    errors.push('evidence.collisionSha256: does not match the activation pin')
  }
  if (evidence.collisionBytes !== contract.collision.bytes) {
    errors.push('evidence.collisionBytes: does not match the activation pin')
  }
  if (evidence.coverageReportSha256.toLowerCase() !== contract.coverageReport.sha256.toLowerCase()) {
    errors.push('evidence.coverageReportSha256: does not match the activation pin')
  }
  if (evidence.coverageReportBytes !== contract.coverageReport.bytes) {
    errors.push('evidence.coverageReportBytes: does not match the activation pin')
  }
  const shapeErrors: string[] = []
  if (validateRuntimeMetricShape(evidence.runtime, 'evidence.runtime', shapeErrors)) {
    compareRuntimeMetrics(evidence.runtime, contract.collision.runtime, 'evidence.runtime', errors)
  } else errors.push(...shapeErrors)
}

function enforceCoverage(
  contract: CollisionActivationContractV1,
  report: CollisionCoverageReportV1,
  errors: string[],
): CollisionActivationValidation['summary'] {
  if (report.modelId !== contract.modelId) errors.push('coverage.modelId: does not match contract.modelId')
  if (report.collision.sha256.toLowerCase() !== contract.collision.sha256.toLowerCase()) {
    errors.push('coverage.collision.sha256: report is tied to a different collision GLB')
  }
  if (report.collision.bytes !== contract.collision.bytes) {
    errors.push('coverage.collision.bytes: report is tied to different collision bytes')
  }
  compareRuntimeMetrics(report.collision.runtime, contract.collision.runtime, 'coverage.collision.runtime', errors)

  const coverage = report.broadHorizontalCoverage
  if (coverage.coveredCells + coverage.missingCells !== coverage.requiredCells) {
    errors.push('coverage.broadHorizontalCoverage: coveredCells + missingCells must equal requiredCells')
  }
  const bandRequiredCells = coverage.elevationBands.reduce((sum, band) => sum + band.requiredCells, 0)
  const bandCoveredCells = coverage.elevationBands.reduce((sum, band) => sum + band.coveredCells, 0)
  if (bandRequiredCells !== coverage.requiredCells || bandCoveredCells !== coverage.coveredCells) {
    errors.push('coverage.broadHorizontalCoverage: elevation-band cell totals must match overall totals')
  }
  const computedRatio = coverage.requiredCells > 0 ? coverage.coveredCells / coverage.requiredCells : 0
  if (Math.abs(computedRatio - coverage.ratio) > RATIO_EPSILON) {
    errors.push('coverage.broadHorizontalCoverage.ratio: does not match cell counts')
  }
  if (coverage.coveredCells < contract.requirements.minHorizontalCoveredCells) {
    errors.push('coverage.broadHorizontalCoverage.coveredCells: below activation minimum')
  }
  if (coverage.ratio + RATIO_EPSILON < contract.requirements.minHorizontalCoverageRatio) {
    errors.push('coverage.broadHorizontalCoverage.ratio: below activation minimum')
  }

  const eligibleBands = coverage.elevationBands.filter((band) => {
    if (band.requiredCells < 1) return false
    return band.coveredCells / band.requiredCells + RATIO_EPSILON >= contract.requirements.minHorizontalCoverageRatio
  })
  if (eligibleBands.length < contract.requirements.minElevationBands) {
    errors.push(
      `coverage.broadHorizontalCoverage.elevationBands: ${eligibleBands.length} qualifying band(s); ` +
      `${contract.requirements.minElevationBands} required`,
    )
  }
  const centers = eligibleBands.map((band) => (band.minY + band.maxY) / 2)
  const elevationSpread = centers.length > 1 ? Math.max(...centers) - Math.min(...centers) : 0
  if (elevationSpread < contract.requirements.minElevationSeparationMeters) {
    errors.push('coverage.broadHorizontalCoverage.elevationBands: insufficient vertical separation')
  }

  const probes = new Map(report.probes.map((probe) => [probe.id, probe]))
  const spawn = report.spawnSupport
  if (spawn.id !== contract.requirements.spawnProbeId || spawn.kind !== 'spawn') {
    errors.push('coverage.spawnSupport: must match the required spawn probe id and kind')
  }
  if (!spawn.supported) errors.push('coverage.spawnSupport: spawn is not supported')
  const spawnInList = probes.get(contract.requirements.spawnProbeId)
  if (!spawnInList || spawnInList.kind !== 'spawn') {
    errors.push('coverage.probes: must include the spawn support probe')
  }

  let validatedProbes = 0
  for (const requirement of contract.requirements.requiredProbes) {
    const probe = probes.get(requirement.id)
    if (!probe) {
      errors.push(`coverage.probes: required probe "${requirement.id}" is missing`)
      continue
    }
    if (!probe.supported || probe.hitPoint === null) {
      errors.push(`coverage.probes.${requirement.id}: has no collision support`)
      continue
    }
    if (probe.upDot === null || probe.upDot < requirement.minUpDot) {
      errors.push(`coverage.probes.${requirement.id}: surface is not walkable enough`)
      continue
    }
    if (
      probe.verticalErrorMeters === null ||
      probe.verticalErrorMeters > requirement.maxVerticalErrorMeters
    ) {
      errors.push(`coverage.probes.${requirement.id}: vertical support error is too large`)
      continue
    }
    validatedProbes += 1
  }

  const stairs = new Map(report.namedStairs.map((stair) => [stair.id, stair]))
  let validatedStairs = 0
  for (const requirement of contract.requirements.requiredStairs) {
    const stair = stairs.get(requirement.id)
    if (!stair || !stair.present) {
      errors.push(`coverage.namedStairs: required stair "${requirement.id}" is missing`)
      continue
    }
    if (stair.horizontalTriangles < requirement.minHorizontalTriangles) {
      errors.push(`coverage.namedStairs.${requirement.id}: too few horizontal support triangles`)
      continue
    }
    if (stair.supportCoverageRatio + RATIO_EPSILON < requirement.minSupportCoverageRatio) {
      errors.push(`coverage.namedStairs.${requirement.id}: support coverage is below minimum`)
      continue
    }
    const verticalSpan = stair.minY !== null && stair.maxY !== null ? stair.maxY - stair.minY : 0
    if (verticalSpan < requirement.minVerticalSpanMeters) {
      errors.push(`coverage.namedStairs.${requirement.id}: vertical span is below minimum`)
      continue
    }
    validatedStairs += 1
  }

  return {
    triangles: report.collision.runtime.triangles,
    chunks: report.collision.runtime.chunks,
    horizontalCoverageRatio: coverage.ratio,
    coveredElevationBands: eligibleBands.length,
    validatedProbes,
    validatedStairs,
  }
}

/**
 * Fail-closed full activation gate. Callers must supply hashes/byte lengths
 * measured from the exact GLB and coverage-report bytes, plus metrics measured
 * from the parsed collision root.
 */
export function validateCollisionActivationEvidence(
  contractValue: unknown,
  reportValue: unknown,
  evidence: CollisionActivationEvidence,
): CollisionActivationValidation {
  const errors: string[] = []
  const contractOk = validateContractShape(contractValue, errors)
  const reportOk = validateCoverageShape(reportValue, errors)
  if (!contractOk || !reportOk) return { valid: false, errors, summary: null }

  const contract = contractValue
  const report = reportValue
  observedPinsMatch(contract, evidence, errors)
  const summary = enforceCoverage(contract, report, errors)
  return { valid: errors.length === 0, errors, summary }
}

export function assertCollisionActivationEvidence(
  contract: unknown,
  report: unknown,
  evidence: CollisionActivationEvidence,
): CollisionActivationValidation['summary'] {
  const result = validateCollisionActivationEvidence(contract, report, evidence)
  if (!result.valid || !result.summary) {
    throw new Error(`Collision activation contract rejected:\n${result.errors.map((error) => `- ${error}`).join('\n')}`)
  }
  return result.summary
}
