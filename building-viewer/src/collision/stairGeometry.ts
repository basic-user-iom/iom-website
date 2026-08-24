import { BufferAttribute, BufferGeometry, Vector2 } from 'three'

const MIN_SUPPORT_UP_DOT = 0.55
const MIN_DIRECTION_CORRELATION = 0.58
const MIN_AXIS_ANISOTROPY = 0.16
const MIN_DIRECTION_CONFIDENCE = 0.35
const MAX_DIRECTION_SAMPLES = 24_000

export type StairSupportAnalysis = {
  usable: boolean
  topFacingTriangles: number
  projectedArea: number
  footprintArea: number
  coverage: number
  verticalSpan: number
}

export type StairAscent = {
  /** Unit XZ direction from the low end of the flight to the high end. */
  axis: Vector2
  /** Unit XZ direction across the flight. */
  side: Vector2
  runMin: number
  runMax: number
  sideMin: number
  sideMax: number
  minY: number
  maxY: number
  confidence: number
  correlation: number
  anisotropy: number
  sampleCount: number
}

type Sample = { x: number; y: number; z: number }

function forEachTriangle(
  geometry: BufferGeometry,
  visit: (
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx: number,
    cy: number,
    cz: number,
  ) => void,
): void {
  const position = geometry.getAttribute('position')
  if (!position) return
  const index = geometry.getIndex()
  const count = index ? index.count : position.count
  for (let i = 0; i + 2 < count; i += 3) {
    const ia = index ? index.getX(i) : i
    const ib = index ? index.getX(i + 1) : i + 1
    const ic = index ? index.getX(i + 2) : i + 2
    visit(
      position.getX(ia),
      position.getY(ia),
      position.getZ(ia),
      position.getX(ib),
      position.getY(ib),
      position.getZ(ib),
      position.getX(ic),
      position.getY(ic),
      position.getZ(ic),
    )
  }
}

/**
 * Detect authored tread/ramp faces that can support a player. A single top cap
 * on a solid CAD stair volume is intentionally not enough: usable stair
 * support must also be distributed through a meaningful part of the rise.
 */
export function analyzeStairSupport(geometry: BufferGeometry): StairSupportAnalysis {
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox
  if (!bounds || bounds.isEmpty()) {
    return {
      usable: false,
      topFacingTriangles: 0,
      projectedArea: 0,
      footprintArea: 0,
      coverage: 0,
      verticalSpan: 0,
    }
  }

  let topFacingTriangles = 0
  let projectedArea = 0
  let supportMinY = Infinity
  let supportMaxY = -Infinity

  forEachTriangle(geometry, (ax, ay, az, bx, by, bz, cx, cy, cz) => {
    const abx = bx - ax
    const aby = by - ay
    const abz = bz - az
    const acx = cx - ax
    const acy = cy - ay
    const acz = cz - az
    const nx = aby * acz - abz * acy
    const ny = abz * acx - abx * acz
    const nz = abx * acy - aby * acx
    const normalLength = Math.hypot(nx, ny, nz)
    // CollisionWorld raycasts use a front-sided material. Downward-wound
    // undersides therefore are not usable ground, even if geometrically flat.
    if (normalLength <= 1e-9 || ny / normalLength < MIN_SUPPORT_UP_DOT) return

    topFacingTriangles += 1
    projectedArea += ny * 0.5
    const centroidY = (ay + by + cy) / 3
    supportMinY = Math.min(supportMinY, centroidY)
    supportMaxY = Math.max(supportMaxY, centroidY)
  })

  const dx = Math.max(0, bounds.max.x - bounds.min.x)
  const dz = Math.max(0, bounds.max.z - bounds.min.z)
  const rise = Math.max(0, bounds.max.y - bounds.min.y)
  const footprintArea = dx * dz
  const coverage = footprintArea > 1e-8 ? projectedArea / footprintArea : 0
  const verticalSpan = Number.isFinite(supportMinY) ? supportMaxY - supportMinY : 0
  const enoughArea = projectedArea >= Math.max(0.04, footprintArea * 0.08)
  const distributedThroughRise = verticalSpan >= Math.max(0.06, rise * 0.14)

  return {
    usable:
      topFacingTriangles >= 2 &&
      enoughArea &&
      coverage >= 0.08 &&
      distributedThroughRise,
    topFacingTriangles,
    projectedArea,
    footprintArea,
    coverage,
    verticalSpan,
  }
}

function collectSamples(geometry: BufferGeometry): Sample[] {
  const position = geometry.getAttribute('position')
  if (!position) return []

  // CAD exports repeat vertices for triangle faces. Quantising prevents a
  // heavily tessellated side from overwhelming the actual flight profile.
  const stride = Math.max(1, Math.ceil(position.count / (MAX_DIRECTION_SAMPLES * 2)))
  const seen = new Set<string>()
  const samples: Sample[] = []
  for (let i = 0; i < position.count; i += stride) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
    const key = `${Math.round(x * 1000)}|${Math.round(y * 1000)}|${Math.round(z * 1000)}`
    if (seen.has(key)) continue
    seen.add(key)
    samples.push({ x, y, z })
    if (samples.length >= MAX_DIRECTION_SAMPLES) break
  }
  return samples
}

/**
 * Infer a single flight's ascent from its world-space upper envelope.
 *
 * The principal horizontal axis supplies the possible run direction; a
 * regression over per-bin maximum Y selects its sign. Symmetric boxes,
 * landings and U-shaped/multi-flight assemblies fail the confidence guard and
 * intentionally return null instead of receiving a guessed proxy.
 */
export function inferStairAscent(geometry: BufferGeometry): StairAscent | null {
  const samples = collectSamples(geometry)
  if (samples.length < 8) return null

  let meanX = 0
  let meanZ = 0
  let minY = Infinity
  let maxY = -Infinity
  for (const p of samples) {
    meanX += p.x
    meanZ += p.z
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  meanX /= samples.length
  meanZ /= samples.length
  if (maxY - minY < 0.18) return null

  let varX = 0
  let varZ = 0
  let covXZ = 0
  for (const p of samples) {
    const x = p.x - meanX
    const z = p.z - meanZ
    varX += x * x
    varZ += z * z
    covXZ += x * z
  }
  varX /= samples.length
  varZ /= samples.length
  covXZ /= samples.length

  const trace = varX + varZ
  const discriminant = Math.hypot(varX - varZ, 2 * covXZ)
  const lambdaMajor = (trace + discriminant) * 0.5
  const lambdaMinor = Math.max(0, (trace - discriminant) * 0.5)
  if (lambdaMajor <= 1e-8) return null
  const anisotropy = (lambdaMajor - lambdaMinor) / lambdaMajor
  if (anisotropy < MIN_AXIS_ANISOTROPY) return null

  // Stable eigenvector for the largest eigenvalue.
  let axisX = covXZ
  let axisZ = lambdaMajor - varX
  if (Math.hypot(axisX, axisZ) < 1e-8) {
    axisX = lambdaMajor - varZ
    axisZ = covXZ
  }
  const axisLength = Math.hypot(axisX, axisZ)
  if (axisLength < 1e-8) {
    axisX = varX >= varZ ? 1 : 0
    axisZ = varX >= varZ ? 0 : 1
  } else {
    axisX /= axisLength
    axisZ /= axisLength
  }

  let runMin = Infinity
  let runMax = -Infinity
  for (const p of samples) {
    const run = p.x * axisX + p.z * axisZ
    runMin = Math.min(runMin, run)
    runMax = Math.max(runMax, run)
  }
  const runSpan = runMax - runMin
  if (runSpan < 0.75) return null

  const binCount = Math.max(6, Math.min(32, Math.round(runSpan / 0.28)))
  const binMaxY = new Float64Array(binCount)
  const binRunAtMax = new Float64Array(binCount)
  const binUsed = new Uint8Array(binCount)
  binMaxY.fill(-Infinity)

  for (const p of samples) {
    const run = p.x * axisX + p.z * axisZ
    const normalized = Math.min(0.999999, Math.max(0, (run - runMin) / runSpan))
    const bin = Math.floor(normalized * binCount)
    if (p.y > binMaxY[bin]!) {
      binMaxY[bin] = p.y
      binRunAtMax[bin] = run
      binUsed[bin] = 1
    }
  }

  let usedBins = 0
  let meanRun = 0
  let meanTopY = 0
  for (let i = 0; i < binCount; i++) {
    if (!binUsed[i]) continue
    usedBins += 1
    meanRun += binRunAtMax[i]!
    meanTopY += binMaxY[i]!
  }
  if (usedBins < 4 || usedBins / binCount < 0.38) return null
  meanRun /= usedBins
  meanTopY /= usedBins

  let covariance = 0
  let runVariance = 0
  let yVariance = 0
  for (let i = 0; i < binCount; i++) {
    if (!binUsed[i]) continue
    const dr = binRunAtMax[i]! - meanRun
    const dy = binMaxY[i]! - meanTopY
    covariance += dr * dy
    runVariance += dr * dr
    yVariance += dy * dy
  }
  if (runVariance < 1e-8 || yVariance < 1e-8) return null
  const correlation = covariance / Math.sqrt(runVariance * yVariance)
  if (Math.abs(correlation) < MIN_DIRECTION_CORRELATION) return null

  const slope = covariance / runVariance
  const predictedRise = Math.abs(slope) * runSpan
  if (predictedRise < Math.max(0.14, (maxY - minY) * 0.14)) return null

  // Ensure the returned axis always points uphill.
  if (slope < 0) {
    axisX = -axisX
    axisZ = -axisZ
  }
  const sideX = -axisZ
  const sideZ = axisX
  runMin = Infinity
  runMax = -Infinity
  let sideMin = Infinity
  let sideMax = -Infinity
  for (const p of samples) {
    const run = p.x * axisX + p.z * axisZ
    const side = p.x * sideX + p.z * sideZ
    runMin = Math.min(runMin, run)
    runMax = Math.max(runMax, run)
    sideMin = Math.min(sideMin, side)
    sideMax = Math.max(sideMax, side)
  }

  if (sideMax - sideMin < 0.12) return null
  const binCoverage = usedBins / binCount
  const confidence = Math.abs(correlation) * binCoverage * (0.65 + anisotropy * 0.35)
  if (confidence < MIN_DIRECTION_CONFIDENCE) return null

  return {
    axis: new Vector2(axisX, axisZ),
    side: new Vector2(sideX, sideZ),
    runMin,
    runMax,
    sideMin,
    sideMax,
    minY,
    maxY,
    confidence,
    correlation: Math.abs(correlation),
    anisotropy,
    sampleCount: samples.length,
  }
}

function pushQuad(
  triangles: number[],
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  c: readonly [number, number, number],
  d: readonly [number, number, number],
): void {
  triangles.push(...a, ...b, ...c, ...a, ...c, ...d)
}

function worldPoint(
  ascent: StairAscent,
  run: number,
  side: number,
  y: number,
): [number, number, number] {
  return [
    ascent.axis.x * run + ascent.side.x * side,
    y,
    ascent.axis.y * run + ascent.side.y * side,
  ]
}

/** Build a stepped collision proxy using an already validated ascent. */
export function makeStairProxyGeometry(ascent: StairAscent): BufferGeometry | null {
  const runSpan = ascent.runMax - ascent.runMin
  const width = ascent.sideMax - ascent.sideMin
  const sourceRise = ascent.maxY - ascent.minY
  if (runSpan < 0.25 || width < 0.12 || sourceRise < 0.18) return null

  const y0 = ascent.minY - Math.min(0.55, 0.22 + sourceRise * 0.08)
  const y1 = ascent.maxY
  const rise = y1 - y0
  const steps = Math.max(5, Math.min(24, Math.round(rise / 0.17)))
  const triangles: number[] = []

  for (let i = 0; i < steps; i++) {
    const t0 = i / steps
    const t1 = (i + 1) / steps
    const run0 = ascent.runMin + t0 * runSpan
    const run1 = ascent.runMin + t1 * runSpan
    const lowY = y0 + t0 * rise
    const highY = y0 + t1 * rise

    // Upward winding for raycasts from above.
    pushQuad(
      triangles,
      worldPoint(ascent, run0, ascent.sideMin, highY),
      worldPoint(ascent, run0, ascent.sideMax, highY),
      worldPoint(ascent, run1, ascent.sideMax, highY),
      worldPoint(ascent, run1, ascent.sideMin, highY),
    )
    // Riser faces downhill, toward the player approaching this step.
    pushQuad(
      triangles,
      worldPoint(ascent, run0, ascent.sideMin, lowY),
      worldPoint(ascent, run0, ascent.sideMax, lowY),
      worldPoint(ascent, run0, ascent.sideMax, highY),
      worldPoint(ascent, run0, ascent.sideMin, highY),
    )
  }

  if (triangles.length < 18) return null
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(triangles), 3))
  geometry.computeBoundingBox()
  return geometry
}
