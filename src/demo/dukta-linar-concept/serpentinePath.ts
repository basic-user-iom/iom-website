export type SerpentinePathLookup = {
  x: Float32Array
  z: Float32Array
  tangent: Float32Array
  steps: number
  startTangent: number
  endTangent: number
}

type SerpentinePathOptions = {
  panelWidthM: number
  activeWidthM: number
  radiusM: number
  bendAngleRad: number
  directionSign: -1 | 1
  progression: number
}

/**
 * The endpoint allocates most of the panel length to three equal straight
 * runs. Two compact arc zones form the opposing hairpins between those runs.
 * At a PI bend angle each arc turns exactly 180 degrees.
 */
const HAIRPIN_ARC_FRACTION = 0.16
const LEG_FRACTION = (1 - HAIRPIN_ARC_FRACTION * 2) / 3
const SERPENTINE_PATH_STEPS = 600

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function smoothstep(value: number): number {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
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
  bendAngleRad: number,
  directionSign: -1 | 1,
): number {
  const firstLegEnd = LEG_FRACTION
  const firstHairpinEnd = firstLegEnd + HAIRPIN_ARC_FRACTION
  const middleLegEnd = firstHairpinEnd + LEG_FRACTION
  const secondHairpinEnd = middleLegEnd + HAIRPIN_ARC_FRACTION

  if (u <= firstLegEnd) return 0
  if (u < firstHairpinEnd) {
    const local = (u - firstLegEnd) / HAIRPIN_ARC_FRACTION
    return directionSign * bendAngleRad * local
  }
  if (u <= middleLegEnd) return directionSign * bendAngleRad
  if (u < secondHairpinEnd) {
    const local = (u - middleLegEnd) / HAIRPIN_ARC_FRACTION
    return directionSign * bendAngleRad * (1 - local)
  }
  return 0
}

/**
 * Builds an arc-length centreline for the advanced S preview.
 *
 * Progression blends tangent fields rather than Cartesian points, so panel
 * length stays constant and lamella orientation changes continuously. The
 * primary C path is reproduced at progression zero; the endpoint is a true
 * three-leg serpentine with two opposing semicircular turns.
 */
export function makeSerpentinePathLookup({
  panelWidthM,
  activeWidthM,
  radiusM,
  bendAngleRad,
  directionSign,
  progression,
}: SerpentinePathOptions): SerpentinePathLookup {
  const steps = SERPENTINE_PATH_STEPS
  const x = new Float32Array(steps + 1)
  const z = new Float32Array(steps + 1)
  const tangent = new Float32Array(steps + 1)
  const blend = smoothstep(progression)
  const stepLength = panelWidthM / steps

  const tangentAt = (u: number): number => {
    const primary = primaryTangentAt(
      u,
      panelWidthM,
      activeWidthM,
      radiusM,
      bendAngleRad,
      directionSign,
    )
    const serpentine = serpentineTangentAt(u, bendAngleRad, directionSign)
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
  }
}
