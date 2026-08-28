export type SerpentinePathLookup = {
  x: Float32Array
  z: Float32Array
  tangent: Float32Array
  steps: number
  startTangent: number
  endTangent: number
  requestedBendAngleRad: number
  renderedBendAngleRad: number
  visualSafetyLimited: boolean
}

type SerpentinePathOptions = {
  panelWidthM: number
  activeWidthM: number
  serpentineWidthM: number
  radiusM: number
  bendAngleRad: number
  directionSign: -1 | 1
  progression: number
  maxNormalOffsetM?: number
}

const SERPENTINE_PATH_STEPS = 600
// This is a render-stability margin, not manufacturing data. Keeping the
// offset-curve Jacobian comfortably above zero prevents the visible panel
// surface and optional backing from folding through their own centreline when
// the complete S target is compressed into a narrow partial-incision strip.
const MAX_RENDERED_OFFSET_CURVATURE_PRODUCT = 0.4

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function smoothstep(value: number): number {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

/**
 * Maximum visual tangent amplitude that keeps the furthest rendered offset
 * regular.
 *
 * For theta(s) = turn * sin^2(PI s / supportWidth), peak curvature is
 *   PI * turn / supportWidth.
 * Limiting |curvature * offset| leaves a generous visual-only margin before
 * an offset surface can reverse orientation. It is deliberately not exposed
 * as a physical or certified bending limit.
 */
function safeRenderedSerpentineTurnRad(
  requestedTurnRad: number,
  serpentineWidthM: number,
  maxNormalOffsetM: number,
): number {
  const requested = Math.max(0, requestedTurnRad)
  const supportWidth = Math.max(0, serpentineWidthM)
  const offset = Number.isFinite(maxNormalOffsetM) ? Math.max(0, maxNormalOffsetM) : 0
  if (requested <= 0 || supportWidth <= 0 || offset <= 0.0000001) return requested

  const turnLimitRad =
    (MAX_RENDERED_OFFSET_CURVATURE_PRODUCT * supportWidth) /
    (Math.PI * offset)
  return Math.min(requested, Math.max(0, turnLimitRad))
}

function primaryTangentAt(
  u: number,
  panelWidthM: number,
  activeWidthM: number,
  radiusM: number,
  bendAngleRad: number,
  directionSign: -1 | 1,
): number {
  const distance = clamp01(u) * panelWidthM
  const leftFlat = Math.max(0, (panelWidthM - activeWidthM) * 0.5)
  if (distance <= leftFlat) return (-bendAngleRad * 0.5) * directionSign
  if (distance >= leftFlat + activeWidthM) {
    return (bendAngleRad * 0.5) * directionSign
  }

  const localAngle =
    -bendAngleRad * 0.5 + (distance - leftFlat) / Math.max(radiusM, 0.000001)
  return localAngle * directionSign
}

function serpentineTangentAt(
  u: number,
  panelWidthM: number,
  serpentineWidthM: number,
  renderedTurnRad: number,
  directionSign: -1 | 1,
): number {
  const distance = clamp01(u) * panelWidthM
  const safeWidth = Math.max(0, Math.min(panelWidthM, serpentineWidthM))
  const leftFlat = (panelWidthM - safeWidth) * 0.5
  if (safeWidth <= 0 || distance <= leftFlat || distance >= leftFlat + safeWidth) return 0

  const localU = (distance - leftFlat) / safeWidth
  const smoothTurn = 0.5 - 0.5 * Math.cos(2 * Math.PI * localU)
  return directionSign * renderedTurnRad * smoothTurn
}

/**
 * Builds an arc-length centreline for the advanced S preview.
 *
 * Progression blends tangent fields rather than Cartesian points, so panel
 * length stays constant and lamella orientation changes continuously. The
 * primary C path is reproduced at progression zero; the endpoint uses a
 * whole-span sinusoidal-curvature field with no finite straight interval.
 */
export function makeSerpentinePathLookup({
  panelWidthM,
  activeWidthM,
  serpentineWidthM,
  radiusM,
  bendAngleRad,
  directionSign,
  progression,
  maxNormalOffsetM = 0,
}: SerpentinePathOptions): SerpentinePathLookup {
  const steps = SERPENTINE_PATH_STEPS
  const x = new Float32Array(steps + 1)
  const z = new Float32Array(steps + 1)
  const tangent = new Float32Array(steps + 1)
  const blend = smoothstep(progression)
  const stepLength = panelWidthM / steps
  const safeSerpentineWidthM = Math.max(0, Math.min(panelWidthM, serpentineWidthM))
  const renderedBendAngleRad = safeRenderedSerpentineTurnRad(
    bendAngleRad,
    safeSerpentineWidthM,
    maxNormalOffsetM,
  )
  const visualSafetyLimited = renderedBendAngleRad < bendAngleRad - 0.000001

  const tangentAt = (u: number): number => {
    const primary = primaryTangentAt(
      u,
      panelWidthM,
      activeWidthM,
      radiusM,
      bendAngleRad,
      directionSign,
    )
    const serpentine = serpentineTangentAt(
      u,
      panelWidthM,
      safeSerpentineWidthM,
      renderedBendAngleRad,
      directionSign,
    )
    return primary + (serpentine - primary) * blend
  }

  for (let i = 0; i <= steps; i += 1) {
    tangent[i] = tangentAt(i / steps)
  }

  for (let i = 1; i <= steps; i += 1) {
    const u0 = (i - 1) / steps
    const um = (i - 0.5) / steps
    const u1 = i / steps
    const p0 = tangentAt(u0)
    const pm = tangentAt(um)
    const p1 = tangentAt(u1)
    x[i] =
      x[i - 1] +
      (stepLength / 6) * (Math.cos(p0) + 4 * Math.cos(pm) + Math.cos(p1))
    z[i] =
      z[i - 1] +
      (stepLength / 6) * (Math.sin(p0) + 4 * Math.sin(pm) + Math.sin(p1))
  }

  // Keep every morph state on its endpoint chord. The old mounted-only chord
  // correction made the same physical S use a different orientation on the
  // floor, wall and ceiling. Rotating the lookup itself keeps its arc length
  // and curvature intact, gives repeated modules a stable baseline, and makes
  // the two endpoint anchors share one host-normal coordinate at the S target.
  const chordAngle = Math.atan2(z[steps] - z[0], x[steps] - x[0])
  const chordCos = Math.cos(chordAngle)
  const chordSin = Math.sin(chordAngle)
  for (let i = 0; i <= steps; i += 1) {
    const originalX = x[i]
    const originalZ = z[i]
    x[i] = chordCos * originalX + chordSin * originalZ
    z[i] = -chordSin * originalX + chordCos * originalZ
    tangent[i] -= chordAngle
  }

  const centreIndex = steps / 2
  const centreX = x[centreIndex]
  const centreZ = z[centreIndex]
  for (let i = 0; i <= steps; i += 1) {
    x[i] -= centreX
    z[i] -= centreZ
  }

  return {
    x,
    z,
    tangent,
    steps,
    startTangent: tangent[0],
    endTangent: tangent[steps],
    requestedBendAngleRad: bendAngleRad,
    renderedBendAngleRad,
    visualSafetyLimited,
  }
}
