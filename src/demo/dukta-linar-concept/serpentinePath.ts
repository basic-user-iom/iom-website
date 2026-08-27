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

/**
 * The endpoint allocates most of the panel length to three equal straight
 * runs. Two compact variable-curvature zones form the opposing hairpins
 * between those runs. At a PI bend angle each zone turns exactly 180 degrees.
 */
const HAIRPIN_ARC_FRACTION = 0.16
const LEG_FRACTION = (1 - HAIRPIN_ARC_FRACTION * 2) / 3
// Each hairpin now eases through a short, clothoid-like curvature ramp before
// and after its near-constant-curvature centre.  This keeps curvature at zero
// where a turn meets a straight leg, instead of jumping instantly from zero to
// a circular-arc value.  The plateau prevents the transition from becoming a
// pinched smoothstep while preserving the approved three-leg proportions.
const HAIRPIN_CURVATURE_RAMP_FRACTION = 0.22
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
 * Normalised angle progress for one hairpin.
 *
 * Its derivative is a raised-cosine curvature ramp, a constant-curvature
 * centre and the mirrored ramp out.  Both curvature and its rate of change are
 * continuous at the joins, so the centreline meets each straight leg without
 * a visible kink, shelf or hard mechanical seam.
 */
function hairpinAngleProgress(value: number): number {
  const t = clamp01(value)
  const ramp = HAIRPIN_CURVATURE_RAMP_FRACTION
  const normalisation = 1 - ramp

  if (t < ramp) {
    const rampIntegral =
      t * 0.5 - (ramp / (2 * Math.PI)) * Math.sin((Math.PI * t) / ramp)
    return rampIntegral / normalisation
  }

  if (t <= 1 - ramp) {
    return (t - ramp * 0.5) / normalisation
  }

  return 1 - hairpinAngleProgress(1 - t)
}

/**
 * Maximum visual turn that keeps the furthest rendered offset regular.
 *
 * The raised-cosine hairpin has peak curvature
 *   turn / (hairpinLength * (1 - rampFraction)).
 * Limiting |curvature * offset| leaves a generous visual-only margin before
 * an offset surface can reverse orientation. It is deliberately not exposed
 * as a physical or certified bending limit.
 */
function safeRenderedHairpinTurnRad(
  requestedTurnRad: number,
  serpentineWidthM: number,
  maxNormalOffsetM: number,
): number {
  const requested = Math.max(0, requestedTurnRad)
  const supportWidth = Math.max(0, serpentineWidthM)
  const offset = Number.isFinite(maxNormalOffsetM) ? Math.max(0, maxNormalOffsetM) : 0
  if (requested <= 0 || supportWidth <= 0 || offset <= 0.0000001) return requested

  const hairpinLengthM = supportWidth * HAIRPIN_ARC_FRACTION
  const turnLimitRad =
    (MAX_RENDERED_OFFSET_CURVATURE_PRODUCT *
      hairpinLengthM *
      (1 - HAIRPIN_CURVATURE_RAMP_FRACTION)) /
    offset
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
  bendAngleRad: number,
  directionSign: -1 | 1,
): number {
  const distance = clamp01(u) * panelWidthM
  const safeWidth = Math.max(0, Math.min(panelWidthM, serpentineWidthM))
  const leftFlat = (panelWidthM - safeWidth) * 0.5
  if (safeWidth <= 0 || distance <= leftFlat || distance >= leftFlat + safeWidth) {
    return 0
  }
  const localU = (distance - leftFlat) / safeWidth
  const firstLegEnd = LEG_FRACTION
  const firstHairpinEnd = firstLegEnd + HAIRPIN_ARC_FRACTION
  const middleLegEnd = firstHairpinEnd + LEG_FRACTION
  const secondHairpinEnd = middleLegEnd + HAIRPIN_ARC_FRACTION

  if (localU <= firstLegEnd) return 0
  if (localU < firstHairpinEnd) {
    const local = (localU - firstLegEnd) / HAIRPIN_ARC_FRACTION
    return directionSign * bendAngleRad * hairpinAngleProgress(local)
  }
  if (localU <= middleLegEnd) return directionSign * bendAngleRad
  if (localU < secondHairpinEnd) {
    const local = (localU - middleLegEnd) / HAIRPIN_ARC_FRACTION
    return directionSign * bendAngleRad * (1 - hairpinAngleProgress(local))
  }
  return 0
}

/**
 * Builds an arc-length centreline for the advanced S preview.
 *
 * Progression blends tangent fields rather than Cartesian points, so panel
 * length stays constant and lamella orientation changes continuously. The
 * primary C path is reproduced at progression zero; the endpoint is a true
 * three-leg serpentine with two opposing, smoothly ramped 180° turns.
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
  const renderedBendAngleRad = safeRenderedHairpinTurnRad(
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
