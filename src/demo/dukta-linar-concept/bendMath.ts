import { getIncisedWidthForRadiusMm } from './linarData'
import {
  makeSerpentinePathLookup,
  type SerpentinePathLookup,
} from './serpentinePath'
import type { LinarBendDirection, LinarConfig } from './types'

/** 2800 × 1200 mm visualization/display panel. Bending is across the 1200 mm width. */
export const PANEL_HEIGHT_M = 2.8
export const PANEL_WIDTH_M = 1.2
export const PANEL_SIZE_MM = { height: 2800, width: 1200 } as const
/** Visual separation between the panel rear face and an enabled backing. */
export const BACKING_RENDER_OFFSET_M = 0.0012

/** Circular-saw path radius in the cutting diagram — never the panel bending radius. */
export const SAW_PATH_RADIUS_MM = 62.5

export const REST_BEND = 0
export const INTRO_PEAK_BEND = 55

export const MAX_SLATS = 300
export const MAX_BRIDGE_ROWS = 80

/** Visual-only cylinder when no physical sample exists. Never labelled as tested. */
export const VISUAL_FALLBACK_RADIUS_MM = 180

/**
 * Width of the C1 handover between full-support bending and the tighter
 * half-circumference zone. This is a controller transition, not product data.
 */
const ACTIVE_WIDTH_TRANSITION_FRACTION = 0.08

export type SlatSpec = {
  originalX: number
  width: number
  index: number
}

export type BridgeSeg = {
  originalX: number
  localY: number
  height: number
  /** Portion of the source 60 mm bridge profile retained after edge clipping. */
  profileStart: number
  profileEnd: number
  column: number
  row: number
}

export type PanelLayout = {
  slats: SlatSpec[]
  slatCount: number
  usedWidthM: number
  incisedWidthM: number
  incisedX0: number
  incisedX1: number
  solidSideWidthM: number
  slatWidthM: number
  cutWidthM: number
  /** Distance between two continuous full-height slats. */
  pitchM: number
  thicknessM: number
  incisedY0: number
  incisedY1: number
  incisedHeightM: number
}

export type BendState = {
  control: number
  percent: number
  direction: LinarBendDirection
  directionSign: -1 | 0 | 1
  selectedRadiusMm: number | null
  radiusM: number
  alpha: number
  activeWidthM: number
  arcLen: number
  leftFlat: number
  validated: boolean
  secondaryCurveAmount: number
  secondaryCurveRenderedTurnRad: number
  secondaryCurveSafetyLimited: boolean
  compoundCurve: SerpentinePathLookup | null
}

export function mmToM(mm: number): number {
  return mm / 1000
}

/** Furthest normal offset rendered for the panel surface/backing pair. */
export function maxRenderedNormalOffsetM(thicknessM: number, hasBacking: boolean): number {
  return Math.max(0, thicknessM) * 0.5 + (hasBacking ? BACKING_RENDER_OFFSET_M : 0)
}

/**
 * Piecewise-polynomial smooth minimum.
 *
 * Outside the narrow transition band it is exactly `min(a, b)`. Inside the
 * band its value and first derivative are continuous, while never exceeding
 * either input. The C-bend still derives its angle from `width / radius`, so
 * both tangent joins remain analytic rather than being position-blended.
 */
export function smoothActiveBendWidthM(
  bendableWidthM: number,
  halfCircumferenceM: number,
): number {
  const support = Math.max(0, bendableWidthM)
  const circumference = Math.max(0, halfCircumferenceM)
  if (support <= 0 || circumference <= 0) return 0

  const transitionWidth = support * ACTIVE_WIDTH_TRANSITION_FRACTION
  if (transitionWidth <= 0.000001) return Math.min(support, circumference)

  const blend = Math.max(
    0,
    Math.min(1, 0.5 + (circumference - support) / (2 * transitionWidth)),
  )
  return (
    circumference * (1 - blend) +
    support * blend -
    transitionWidth * blend * (1 - blend)
  )
}

export function slatLayout(config: LinarConfig): PanelLayout {
  // The reference diagrams label cut / web / cut (4/4/4 or 5/3/5).
  // Each pitch is one continuous web followed by one cell that alternates
  // between a true opening and recessed bridge wood along the panel height.
  const pitchMm = config.cutWidthMm + config.slatWidthMm
  const pitchM = mmToM(pitchMm)
  const slatWidthM = mmToM(config.slatWidthMm)
  const cutWidthM = mmToM(config.cutWidthMm)
  const thicknessM = mmToM(config.thicknessMm)
  const coverage = Math.min(12, Math.max(1, config.incisedTwelfths)) / 12
  const requestedIncisedWidthM = PANEL_WIDTH_M * coverage
  // Keep every incision cell at its true configured pitch. The visible span
  // runs from the outside face of the first continuous slat to the outside
  // face of the last, so N slats occupy N pitches minus one cut width. This
  // makes the solid sides meet those boundary slats without a seam or void.
  const maxCountForPanel = Math.floor((PANEL_WIDTH_M + cutWidthM) / pitchM)
  const rawCount = Math.round((requestedIncisedWidthM + cutWidthM) / pitchM)
  const slatCount = Math.max(8, Math.min(MAX_SLATS, rawCount))
  const boundedSlatCount = Math.min(slatCount, maxCountForPanel)
  const usedWidth = boundedSlatCount * pitchM - cutWidthM
  const origin = -((boundedSlatCount - 1) * pitchM) / 2

  const slats: SlatSpec[] = []
  for (let i = 0; i < boundedSlatCount; i += 1) {
    slats.push({ originalX: origin + i * pitchM, width: slatWidthM, index: i })
  }

  // Coverage is distributed across the panel width: the incised pattern is
  // a centred, full-height strip and the remaining material forms two solid
  // vertical side zones. This matches the physical partial-incision layout.
  const incisedWidthM = usedWidth
  const incisedX0 = -incisedWidthM * 0.5
  const incisedX1 = incisedWidthM * 0.5
  const solidSideWidthM = Math.max(0, (PANEL_WIDTH_M - incisedWidthM) * 0.5)
  const incisedHeightM = PANEL_HEIGHT_M
  const incisedY0 = 0
  const incisedY1 = PANEL_HEIGHT_M

  return {
    slats,
    slatCount: boundedSlatCount,
    usedWidthM: usedWidth,
    incisedWidthM,
    incisedX0,
    incisedX1,
    solidSideWidthM,
    slatWidthM,
    cutWidthM,
    pitchM,
    thicknessM,
    incisedY0,
    incisedY1,
    incisedHeightM,
  }
}

/**
 * Build the darker local bridge spines between the continuous light slats.
 *
 * The official diagram uses two coherent vertical phases across the panel.
 * Each bridge remains an independent local mesh occupying only one cut cell;
 * during a bridge interval it touches the two neighbouring continuous slats,
 * while the complementary cells remain true openings.
 */
export function bridgeSegsFor(
  config: LinarConfig,
  bridgeLengthMm: number,
  layout: PanelLayout,
): BridgeSeg[] {
  const incisionM = mmToM(config.incisionLengthMm)
  const bridgeM = mmToM(bridgeLengthMm)
  if (incisionM <= 0 || bridgeM <= 0 || layout.incisedHeightM <= 0) return []

  const segs: BridgeSeg[] = []
  const cols = layout.slatCount - 1
  const repeatM = incisionM + bridgeM
  const repeatCount = Math.min(
    MAX_BRIDGE_ROWS,
    Math.ceil(layout.incisedHeightM / repeatM) + 2,
  )

  for (let col = 0; col < cols; col += 1) {
    const a = layout.slats[col]
    const b = layout.slats[col + 1]
    const originalX = (a.originalX + b.originalX) * 0.5

    // Adjacent bridge spines alternate between two exact phases. With the
    // 100 mm reference (40 mm incision + 60 mm bridge), one column has a
    // 60 mm central bridge while its neighbour has two clipped 30 mm bridge
    // halves at the repeat boundaries. This reproduces the supplied diagram.
    const regularPhase = (col % 2) * repeatM * 0.5
    const phase = regularPhase

    for (let k = -1; k <= repeatCount; k += 1) {
      const center = layout.incisedY0 + phase + k * repeatM
      const unclippedHeight = bridgeM
      const unclippedStart = center - unclippedHeight * 0.5
      const start = Math.max(layout.incisedY0, unclippedStart)
      const end = Math.min(layout.incisedY1, center + unclippedHeight * 0.5)
      const height = end - start
      if (height <= 0.00035) continue
      segs.push({
        originalX,
        localY: (start + end) * 0.5,
        height,
        // Retain the source-profile range so a boundary half remains a true
        // half of the curved 60 mm bridge instead of a full lobe compressed
        // into the clipped height.
        profileStart: Math.max(0, Math.min(1, (start - unclippedStart) / unclippedHeight)),
        profileEnd: Math.max(0, Math.min(1, (end - unclippedStart) / unclippedHeight)),
        column: col,
        row: k + 1,
      })
    }
  }
  return segs
}

export function makeBendState(
  control: number,
  panelWidthM: number,
  referenceRadiusMm: number | null,
  bendableWidthM = panelWidthM,
  secondaryCurveAmount = 0,
  secondaryCurveMaxNormalOffsetM = 0,
): BendState {
  const clampedControl = Math.max(-100, Math.min(100, control))
  const t = Math.abs(clampedControl) / 100
  const clampedSecondaryCurveAmount = Math.max(
    0,
    Math.min(100, secondaryCurveAmount),
  )
  const validated = referenceRadiusMm != null && referenceRadiusMm > 0
  const minimumRadiusMm = validated ? referenceRadiusMm : VISUAL_FALLBACK_RADIUS_MM
  const direction: LinarBendDirection =
    t <= 0.000001 ? 'flat' : clampedControl < 0 ? 'left' : 'right'
  const directionSign: -1 | 0 | 1 = direction === 'flat' ? 0 : direction === 'left' ? -1 : 1

  if (directionSign === 0) {
    return {
      control: 0,
      percent: 0,
      direction,
      directionSign,
      selectedRadiusMm: null,
      radiusM: mmToM(minimumRadiusMm),
      alpha: 0,
      activeWidthM: 0,
      arcLen: 0,
      leftFlat: panelWidthM * 0.5,
      validated,
      secondaryCurveAmount: clampedSecondaryCurveAmount,
      secondaryCurveRenderedTurnRad: 0,
      secondaryCurveSafetyLimited: false,
      compoundCurve: null,
    }
  }

  // Slider distance represents curvature, not an invented radius range.
  // Therefore the existing table minimum is reached only at either endpoint,
  // while radius grows continuously toward infinity at the centred flat pose.
  const selectedRadiusMm = minimumRadiusMm / t
  const radiusM = mmToM(selectedRadiusMm)
  // The complete incised width participates at large radii. When a tighter
  // radius can form a half-circle in less material, the active zone reduces
  // progressively according to the existing documented width = pi * R rule.
  // Keep the active arc at or below πR. A compact polynomial smooth-min
  // removes the velocity knee at the full-width/half-circumference handover.
  // Angle is still derived from the resulting arc length, so the straight
  // extensions retain exact positional and tangent continuity.
  const halfCircumferenceM = mmToM(getIncisedWidthForRadiusMm(selectedRadiusMm))
  const activeWidthM = smoothActiveBendWidthM(bendableWidthM, halfCircumferenceM)
  const alpha = Math.min(Math.PI, activeWidthM / Math.max(radiusM, 0.000001))
  const arcLen = activeWidthM
  const leftFlat = Math.max(0, (panelWidthM - arcLen) * 0.5)
  const compoundCurve =
    clampedSecondaryCurveAmount > 0 && activeWidthM > 0
      ? makeSerpentinePathLookup({
          panelWidthM,
          activeWidthM,
          // The advanced target is confined to the actual incised strip.
          // Solid side zones remain straight tangent extensions when coverage
          // is partial instead of being silently treated as flexible material.
          serpentineWidthM: bendableWidthM,
          radiusM,
          bendAngleRad: alpha,
          directionSign,
          progression: clampedSecondaryCurveAmount / 100,
          maxNormalOffsetM: secondaryCurveMaxNormalOffsetM,
        })
      : null
  return {
    control: clampedControl,
    percent: t * 100,
    direction,
    directionSign,
    selectedRadiusMm,
    radiusM,
    alpha,
    activeWidthM,
    arcLen,
    leftFlat,
    validated,
    secondaryCurveAmount: clampedSecondaryCurveAmount,
    secondaryCurveRenderedTurnRad: compoundCurve?.renderedBendAngleRad ?? 0,
    secondaryCurveSafetyLimited: compoundCurve?.visualSafetyLimited ?? false,
    compoundCurve,
  }
}

export function bendPercentToAngle(
  control: number,
  panelWidthM: number,
  referenceRadiusMm: number | null,
): number {
  const state = makeBendState(control, panelWidthM, referenceRadiusMm)
  return state.alpha * state.directionSign
}

/** Rendered cylinder radius in mm, or null when the pose is treated as flat. */
export function previewRadiusMm(
  control: number,
  panelWidthM: number,
  referenceRadiusMm: number | null,
): number | null {
  return makeBendState(control, panelWidthM, referenceRadiusMm).selectedRadiusMm
}

export function curveElement(
  originalX: number,
  state: BendState,
  panelWidth: number,
  out: { x: number; z: number; rotY: number },
): void {
  if (state.alpha < 1e-4) {
    out.x = originalX
    out.z = 0
    out.rotY = 0
    return
  }

  if (state.compoundCurve) {
    const { compoundCurve } = state
    const u = Math.max(0, Math.min(1, originalX / panelWidth + 0.5))
    const sample = u * compoundCurve.steps
    const index = Math.min(compoundCurve.steps - 1, Math.floor(sample))
    const fraction = sample - index
    out.x =
      compoundCurve.x[index] +
      (compoundCurve.x[index + 1] - compoundCurve.x[index]) * fraction
    out.z =
      compoundCurve.z[index] +
      (compoundCurve.z[index + 1] - compoundCurve.z[index]) * fraction
    const tangent =
      compoundCurve.tangent[index] +
      (compoundCurve.tangent[index + 1] - compoundCurve.tangent[index]) * fraction
    out.rotY = -tangent
    return
  }

  const { radiusM: r, alpha, leftFlat, arcLen, directionSign } = state
  const s = originalX + panelWidth / 2
  const theta0 = -alpha / 2
  const theta1 = alpha / 2

  if (s <= leftFlat) {
    const dist = leftFlat - s
    const jx = r * Math.sin(theta0)
    const jz = r * (1 - Math.cos(theta0))
    const tx = Math.cos(theta0)
    const tz = Math.sin(theta0)
    out.x = jx - dist * tx
    out.z = (jz - dist * tz) * directionSign
    out.rotY = -theta0 * directionSign
    return
  }

  if (s >= leftFlat + arcLen) {
    const dist = s - (leftFlat + arcLen)
    const jx = r * Math.sin(theta1)
    const jz = r * (1 - Math.cos(theta1))
    const tx = Math.cos(theta1)
    const tz = Math.sin(theta1)
    out.x = jx + dist * tx
    out.z = (jz + dist * tz) * directionSign
    out.rotY = -theta1 * directionSign
    return
  }

  const theta = theta0 + (s - leftFlat) / r
  out.x = r * Math.sin(theta)
  out.z = r * (1 - Math.cos(theta)) * directionSign
  out.rotY = -theta * directionSign
}
