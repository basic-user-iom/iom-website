import type { LinarConfig, LinarDataSource, LinarMaterialId, LinarPattern, LinarStatus } from './types'
import { DEFAULT_LINAR_CONFIG } from './types'

export type LinarSample = {
  pattern: Extract<LinarPattern, 'regular'>
  material: LinarMaterialId
  thicknessMm: number
  cutWidthMm: number
  slatWidthMm: number
  minimumRadiusMm: number
  bridgeLengthMm: number
  incisionLengthMm: number
  referenceOpenAreaPercent: number
  status: Extract<LinarStatus, 'Standard' | 'Possible'>
}

const SAMPLES: readonly LinarSample[] = [
  {
    pattern: 'regular',
    material: 'plywood',
    thicknessMm: 4,
    cutWidthMm: 2,
    slatWidthMm: 2,
    minimumRadiusMm: 15,
    bridgeLengthMm: 20,
    incisionLengthMm: 42,
    referenceOpenAreaPercent: 36,
    status: 'Possible',
  },
  {
    pattern: 'regular',
    material: 'plywood',
    thicknessMm: 6,
    cutWidthMm: 2,
    slatWidthMm: 2,
    minimumRadiusMm: 20,
    bridgeLengthMm: 42,
    incisionLengthMm: 68,
    referenceOpenAreaPercent: 34,
    status: 'Possible',
  },
  {
    pattern: 'regular',
    material: 'mdf',
    thicknessMm: 4,
    cutWidthMm: 2,
    slatWidthMm: 2,
    minimumRadiusMm: 20,
    bridgeLengthMm: 32,
    incisionLengthMm: 73,
    referenceOpenAreaPercent: 35,
    status: 'Possible',
  },
  {
    pattern: 'regular',
    material: 'mdf',
    thicknessMm: 6,
    cutWidthMm: 2,
    slatWidthMm: 2,
    minimumRadiusMm: 30,
    bridgeLengthMm: 32,
    incisionLengthMm: 45,
    referenceOpenAreaPercent: 30,
    status: 'Possible',
  },
  {
    pattern: 'regular',
    material: 'plywood',
    thicknessMm: 6,
    cutWidthMm: 3,
    slatWidthMm: 3,
    minimumRadiusMm: 20,
    bridgeLengthMm: 45,
    incisionLengthMm: 89,
    referenceOpenAreaPercent: 32,
    status: 'Possible',
  },
  {
    pattern: 'regular',
    material: 'plywood',
    thicknessMm: 10,
    cutWidthMm: 3,
    slatWidthMm: 3,
    minimumRadiusMm: 40,
    bridgeLengthMm: 67,
    incisionLengthMm: 67,
    referenceOpenAreaPercent: 25,
    status: 'Possible',
  },
  {
    pattern: 'regular',
    material: 'plywood',
    thicknessMm: 9,
    cutWidthMm: 4,
    slatWidthMm: 4,
    minimumRadiusMm: 50,
    bridgeLengthMm: 63,
    incisionLengthMm: 70,
    referenceOpenAreaPercent: 27,
    status: 'Standard',
  },
  {
    pattern: 'regular',
    material: 'plywood',
    thicknessMm: 12,
    cutWidthMm: 4,
    slatWidthMm: 4,
    minimumRadiusMm: 60,
    bridgeLengthMm: 63,
    incisionLengthMm: 70,
    referenceOpenAreaPercent: 27,
    status: 'Standard',
  },
  {
    pattern: 'regular',
    material: 'mdf',
    thicknessMm: 8,
    cutWidthMm: 4,
    slatWidthMm: 4,
    minimumRadiusMm: 60,
    bridgeLengthMm: 62,
    incisionLengthMm: 73,
    referenceOpenAreaPercent: 29,
    status: 'Standard',
  },
  {
    pattern: 'regular',
    material: 'mdf',
    thicknessMm: 10,
    cutWidthMm: 4,
    slatWidthMm: 4,
    minimumRadiusMm: 70,
    bridgeLengthMm: 66,
    incisionLengthMm: 66,
    referenceOpenAreaPercent: 25,
    status: 'Standard',
  },
  {
    pattern: 'regular',
    material: 'three-layer-spruce',
    thicknessMm: 13,
    cutWidthMm: 4,
    slatWidthMm: 4,
    minimumRadiusMm: 90,
    bridgeLengthMm: 65,
    incisionLengthMm: 70,
    referenceOpenAreaPercent: 26,
    status: 'Standard',
  },
  {
    pattern: 'regular',
    material: 'mdf',
    thicknessMm: 8,
    cutWidthMm: 5,
    slatWidthMm: 5,
    minimumRadiusMm: 110,
    bridgeLengthMm: 55,
    incisionLengthMm: 60,
    referenceOpenAreaPercent: 26,
    status: 'Possible',
  },
]

const TOP_CUT_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [4, 1.0],
  [5, 1.182],
  [10, 2.092],
  [15, 3.0],
]

export const BOTTOM_CUT_DEPTH_MM = 3
export const VISUAL_BRIDGE_FALLBACK_MM = 60
export const CONSERVATIVE_RADIUS_NOTE_MM = 120
export const PARTNER_CONFIRMATION_NOTE =
  'Effective dimensions, values and manufacturability must be confirmed with the responsible manufacturing partner.'
export const CONCEPT_DISCLAIMER =
  'Conceptual visualisation only. Panel behaviour, bending limits and manufacturability must be validated by dukta.'
export const JANUS_THICKNESS_NOTE = 'Panels above 15 mm require the double-sided Janus type.'
export const RADIUS_UNAVAILABLE_NOTE = 'Radius reference not available for this combination.'
export const IRREGULAR_CONFIRMATION_NOTE = 'Visual variation — manufacturer confirmation required.'

export function clampThicknessMm(thicknessMm: number): number {
  return Math.min(15, Math.max(4, thicknessMm))
}

/**
 * Top cutting depth into the panel (mm).
 *
 * Anchor values are the authoritative UI reference because they are rounded
 * manufacturing figures. Interpolation between anchors can be replaced if dukta
 * later provides a final manufacturing formula.
 *
 * The supplied figures are close to topCutDepth = (2 × thickness + 3) / 11,
 * but that trend is not used as the displayed source of truth.
 */
export function getTopCutDepthMm(thicknessMm: number): number {
  const t = clampThicknessMm(thicknessMm)
  for (const [anchor, depth] of TOP_CUT_ANCHORS) {
    if (t === anchor) return depth
  }
  for (let i = 0; i < TOP_CUT_ANCHORS.length - 1; i += 1) {
    const [t0, d0] = TOP_CUT_ANCHORS[i]
    const [t1, d1] = TOP_CUT_ANCHORS[i + 1]
    if (t >= t0 && t <= t1) {
      const mix = (t - t0) / (t1 - t0)
      return d0 + (d1 - d0) * mix
    }
  }
  return t < 4 ? 1 : 3
}

export function getBottomCutDepthMm(): number {
  return BOTTOM_CUT_DEPTH_MM
}

/** Incised area width = circumference / 2 = π × bending radius. */
export function getIncisedWidthForRadiusMm(radiusMm: number): number {
  return Math.PI * radiusMm
}

export function incisedAreaCoverageFraction(twelfths: number): number {
  return Math.min(12, Math.max(1, twelfths)) / 12
}

export function findExactSample(config: LinarConfig): LinarSample | null {
  if (config.pattern !== 'regular') return null
  return (
    SAMPLES.find(
      (sample) =>
        sample.material === config.material &&
        sample.thicknessMm === config.thicknessMm &&
        sample.cutWidthMm === config.cutWidthMm &&
        sample.slatWidthMm === config.slatWidthMm &&
        sample.incisionLengthMm === config.incisionLengthMm,
    ) ?? null
  )
}

export function findGeometrySample(config: LinarConfig): LinarSample | null {
  if (config.pattern !== 'regular') return null
  return (
    SAMPLES.find(
      (sample) =>
        sample.material === config.material &&
        sample.thicknessMm === config.thicknessMm &&
        sample.cutWidthMm === config.cutWidthMm &&
        sample.slatWidthMm === config.slatWidthMm,
    ) ?? null
  )
}

type BridgeInput = {
  material: LinarMaterialId
  thicknessMm: number
  cutWidthMm: number
  slatWidthMm: number
  incisionLengthMm: number
  pattern: LinarPattern
}

/**
 * Bridge length lookup.
 *
 * Pablo confirmed bridge length should eventually be calculated from panel
 * thickness, top cutting depth and bottom cutting depth. No final formula has
 * been supplied, so this function:
 * 1. returns the physical-sample value when an exact validated sample exists;
 * 2. otherwise uses a provisional 60 mm visual fallback for preview geometry;
 * 3. never labels the fallback as tested.
 *
 * Replace the fallback branch when dukta provides the manufacturing formula.
 */
export function calculateBridgeLengthMm(config: BridgeInput): {
  valueMm: number
  source: LinarDataSource
  validated: boolean
} {
  const sample = findExactSample({
    ...DEFAULT_LINAR_CONFIG,
    material: config.material,
    thicknessMm: config.thicknessMm,
    cutWidthMm: config.cutWidthMm,
    slatWidthMm: config.slatWidthMm,
    incisionLengthMm: config.incisionLengthMm,
    pattern: config.pattern,
  })
  if (sample) {
    return { valueMm: sample.bridgeLengthMm, source: 'Physical sample', validated: true }
  }
  return {
    valueMm: VISUAL_BRIDGE_FALLBACK_MM,
    source: 'Visual reference',
    validated: false,
  }
}

export function calculateIncisedOpenAreaPercent(input: {
  cutWidthMm: number
  slatWidthMm: number
  incisionLengthMm: number
  bridgeLengthMm: number
}): number {
  const widthRatio = input.cutWidthMm / (input.cutWidthMm + input.slatWidthMm)
  const lengthRatio = input.incisionLengthMm / (input.incisionLengthMm + input.bridgeLengthMm)
  return widthRatio * lengthRatio * 100
}

export function calculateFullPanelOpenAreaPercent(
  incisedOpenAreaPercent: number,
  coverageFraction: number,
): number {
  return incisedOpenAreaPercent * coverageFraction
}

export type LinarTech = {
  status: LinarStatus
  topCutDepthMm: number
  bottomCutDepthMm: number
  bridgeLengthMm: number
  bridgeSource: LinarDataSource
  geometricIncisedOpenAreaPercent: number
  geometricFullPanelOpenAreaPercent: number
  referenceOpenAreaPercent: number | null
  displayedIncisedOpenAreaPercent: number
  displayedFullPanelOpenAreaPercent: number
  openAreaLabel: 'Reference' | 'Calculated'
  referenceMinimumRadiusMm: number | null
  radiusNote: string | null
  previewStatus: 'Validated sample' | 'Visual reference only'
  coverageFraction: number
  irregularNote: string | null
}

export function resolveLinarTech(config: LinarConfig): LinarTech {
  const coverageFraction = incisedAreaCoverageFraction(config.incisedTwelfths)
  const exact = findExactSample(config)
  const geometry = findGeometrySample(config)
  const irregular = config.pattern === 'irregular'
  const bridge = calculateBridgeLengthMm(config)
  const geometricIncised = calculateIncisedOpenAreaPercent({
    cutWidthMm: config.cutWidthMm,
    slatWidthMm: config.slatWidthMm,
    incisionLengthMm: config.incisionLengthMm,
    bridgeLengthMm: bridge.valueMm,
  })
  const geometricFull = calculateFullPanelOpenAreaPercent(geometricIncised, coverageFraction)

  const validated = Boolean(exact) && !irregular
  const referenceOpen = validated && exact ? exact.referenceOpenAreaPercent : null
  const referenceRadius = !irregular && geometry ? geometry.minimumRadiusMm : null

  let status: LinarStatus = 'Not tested'
  if (validated && exact) status = exact.status
  else if (irregular) status = 'Not tested'

  return {
    status,
    topCutDepthMm: getTopCutDepthMm(config.thicknessMm),
    bottomCutDepthMm: getBottomCutDepthMm(),
    bridgeLengthMm: bridge.valueMm,
    bridgeSource: bridge.source,
    geometricIncisedOpenAreaPercent: geometricIncised,
    geometricFullPanelOpenAreaPercent: geometricFull,
    referenceOpenAreaPercent: referenceOpen,
    displayedIncisedOpenAreaPercent: referenceOpen ?? geometricIncised,
    displayedFullPanelOpenAreaPercent:
      referenceOpen != null
        ? calculateFullPanelOpenAreaPercent(referenceOpen, coverageFraction)
        : geometricFull,
    openAreaLabel: referenceOpen != null ? 'Reference' : 'Calculated',
    referenceMinimumRadiusMm: referenceRadius,
    radiusNote: referenceRadius == null ? RADIUS_UNAVAILABLE_NOTE : null,
    previewStatus: validated ? 'Validated sample' : 'Visual reference only',
    coverageFraction,
    irregularNote: irregular ? IRREGULAR_CONFIRMATION_NOTE : null,
  }
}

export function suggestedIncisionLengthMm(config: LinarConfig): number | null {
  return findGeometrySample(config)?.incisionLengthMm ?? null
}
