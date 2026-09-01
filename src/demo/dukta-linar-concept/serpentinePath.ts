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
  /** Smallest local radius of the authored centreline, in millimetres. */
  minimumLocalRadiusMm: number | null
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
const CURVATURE_EPSILON_PER_M = 1e-9
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
 * Exact peak curvature of the tangent field used to integrate the centreline.
 *
 * The lookup parameter is arc length, so planar centreline curvature is
 * `|d theta / ds|`. The primary field contributes a constant `1 / radius`
 * inside its active span. The S target contributes
 * `turn * PI / width * sin(2 PI u)` inside its support. Progression blends
 * those derivatives by the same smoothstep used for the rendered path.
 *
 * Each smooth interval is therefore a constant plus one sine. Its absolute
 * maximum can occur only at an interval edge or at the sine extrema. Evaluating
 * those finite candidates also retains the one-sided curvature at the C-bend's
 * tangent-continuous joins, without finite-difference noise or sample-density
 * dependence.
 */
function minimumLocalRadiusMmForTangentField({
  panelWidthM,
  activeWidthM,
  serpentineWidthM,
  radiusM,
  progression,
  renderedTurnRad,
}: {
  panelWidthM: number
  activeWidthM: number
  serpentineWidthM: number
  radiusM: number
  progression: number
  renderedTurnRad: number
}): number | null {
  const panelWidth = Math.max(0, panelWidthM)
  if (panelWidth <= 0) return null

  const blend = smoothstep(progression)
  const primaryWidth = Math.max(0, activeWidthM)
  const primaryLeft = (panelWidth - primaryWidth) * 0.5
  const primaryRight = primaryLeft + primaryWidth
  const primaryCurvature =
    primaryWidth > 0 ? (1 - blend) / Math.max(radiusM, 0.000001) : 0

  const serpentineWidth = Math.max(0, Math.min(panelWidth, serpentineWidthM))
  const serpentineLeft = (panelWidth - serpentineWidth) * 0.5
  const serpentineRight = serpentineLeft + serpentineWidth
  const serpentineCurvatureAmplitude =
    serpentineWidth > 0
      ? (blend * Math.max(0, renderedTurnRad) * Math.PI) / serpentineWidth
      : 0

  const breakpoints = [
    0,
    panelWidth,
    Math.max(0, Math.min(panelWidth, primaryLeft)),
    Math.max(0, Math.min(panelWidth, primaryRight)),
    serpentineLeft,
    serpentineRight,
  ]
    .sort((a, b) => a - b)
    .filter((value, index, values) => index === 0 || value - values[index - 1] > 1e-12)

  let maximumCurvature = 0
  for (let intervalIndex = 0; intervalIndex < breakpoints.length - 1; intervalIndex += 1) {
    const intervalStart = breakpoints[intervalIndex]
    const intervalEnd = breakpoints[intervalIndex + 1]
    if (intervalEnd - intervalStart <= 1e-12) continue

    const midpoint = (intervalStart + intervalEnd) * 0.5
    const hasPrimaryCurvature = midpoint > primaryLeft && midpoint < primaryRight
    const hasSerpentineCurvature =
      midpoint > serpentineLeft && midpoint < serpentineRight
    const constantCurvature = hasPrimaryCurvature ? primaryCurvature : 0

    const evaluate = (distanceM: number) => {
      const serpentineCurvature = hasSerpentineCurvature
        ? serpentineCurvatureAmplitude *
          Math.sin((2 * Math.PI * (distanceM - serpentineLeft)) / serpentineWidth)
        : 0
      maximumCurvature = Math.max(
        maximumCurvature,
        Math.abs(constantCurvature + serpentineCurvature),
      )
    }

    // These endpoint evaluations are the limits from within this smooth
    // interval. That matters at the primary C-bend joins, where curvature has
    // a finite step even though position and tangent remain continuous.
    evaluate(intervalStart)
    evaluate(intervalEnd)

    if (hasSerpentineCurvature) {
      const positivePeak = serpentineLeft + serpentineWidth * 0.25
      const negativePeak = serpentineLeft + serpentineWidth * 0.75
      if (positivePeak >= intervalStart && positivePeak <= intervalEnd) {
        evaluate(positivePeak)
      }
      if (negativePeak >= intervalStart && negativePeak <= intervalEnd) {
        evaluate(negativePeak)
      }
    }
  }

  return maximumCurvature > CURVATURE_EPSILON_PER_M
    ? 1000 / maximumCurvature
    : null
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
  const minimumLocalRadiusMm = minimumLocalRadiusMmForTangentField({
    panelWidthM,
    activeWidthM,
    serpentineWidthM: safeSerpentineWidthM,
    radiusM,
    progression,
    renderedTurnRad: renderedBendAngleRad,
  })

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
    minimumLocalRadiusMm,
  }
}
