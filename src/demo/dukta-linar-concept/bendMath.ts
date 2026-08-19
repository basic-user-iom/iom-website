import type { LinarConfig } from './types'

/** 2800 × 1200 mm standing panel. Bending is across the 1200 mm width. */
export const PANEL_HEIGHT_M = 2.8
export const PANEL_WIDTH_M = 1.2
export const PANEL_SIZE_MM = { height: 2800, width: 1200 } as const

export const REST_BEND = 20
export const INTRO_PEAK_BEND = 35

export const MAX_SLATS = 300
export const MAX_BRIDGE_ROWS = 72

const VISUAL_FALLBACK_RADIUS_MM = 180
const MAX_SAFE_BEND_ANGLE = Math.PI * 0.52

export type SlatSpec = {
  originalX: number
  width: number
}

export type BridgeRowSpec = {
  localY: number
  height: number
}

export type SolidBandSpec = {
  localY: number
  height: number
}

export type PanelLayout = {
  slats: SlatSpec[]
  slatCount: number
  slatWidthM: number
  cutWidthM: number
  pitchM: number
  thicknessM: number
  incisedY0: number
  incisedY1: number
  incisedHeightM: number
  solidBands: SolidBandSpec[]
  irregular: boolean
}

function hash01(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function mmToM(mm: number): number {
  return mm / 1000
}

export function slatLayout(config: LinarConfig): PanelLayout {
  const pitchMm = config.cutWidthMm + config.slatWidthMm
  const pitchM = mmToM(pitchMm)
  const slatWidthM = mmToM(config.slatWidthMm)
  const cutWidthM = mmToM(config.cutWidthMm)
  const thicknessM = mmToM(config.thicknessMm)
  const rawCount = Math.round(PANEL_WIDTH_M / pitchM)
  const slatCount = Math.max(8, Math.min(MAX_SLATS, rawCount))
  const usedWidth = slatCount * pitchM
  const origin = -usedWidth / 2 + pitchM / 2

  const slats: SlatSpec[] = []
  for (let i = 0; i < slatCount; i += 1) {
    slats.push({ originalX: origin + i * pitchM, width: slatWidthM })
  }

  const coverage = Math.min(12, Math.max(1, config.incisedTwelfths)) / 12
  const incisedHeightM = PANEL_HEIGHT_M * coverage
  const incisedY0 = (PANEL_HEIGHT_M - incisedHeightM) / 2
  const incisedY1 = incisedY0 + incisedHeightM

  const solidBands: SolidBandSpec[] = []
  if (incisedY0 > 0.004) {
    solidBands.push({ localY: incisedY0 / 2, height: incisedY0 })
  }
  const bottomH = PANEL_HEIGHT_M - incisedY1
  if (bottomH > 0.004) {
    solidBands.push({ localY: incisedY1 + bottomH / 2, height: bottomH })
  }

  return {
    slats,
    slatCount,
    slatWidthM,
    cutWidthM,
    pitchM,
    thicknessM,
    incisedY0,
    incisedY1,
    incisedHeightM,
    solidBands,
    irregular: config.pattern === 'irregular',
  }
}

export function bridgeRowsFor(
  config: LinarConfig,
  bridgeLengthMm: number,
  layout: PanelLayout,
): BridgeRowSpec[] {
  const incisionM = mmToM(config.incisionLengthMm)
  const bridgeM = mmToM(bridgeLengthMm)
  const period = incisionM + bridgeM
  if (period <= 0 || layout.incisedHeightM <= 0) return []

  const rows: BridgeRowSpec[] = []
  const half = bridgeM / 2
  rows.push({ localY: layout.incisedY0, height: half })

  let cursor = layout.incisedY0 + half + incisionM + half
  let guard = 0
  while (cursor < layout.incisedY1 - half * 0.51 && guard < MAX_BRIDGE_ROWS - 2) {
    let y = cursor
    if (layout.irregular) {
      const jitter = (hash01(guard + 17) - 0.5) * incisionM * 0.28
      y += jitter
    }
    if (y > layout.incisedY0 + half && y < layout.incisedY1 - half) {
      rows.push({ localY: y, height: bridgeM })
    }
    cursor += period
    guard += 1
  }

  rows.push({ localY: layout.incisedY1, height: half })
  return rows.slice(0, MAX_BRIDGE_ROWS)
}

export function bendPercentToAngle(
  percent: number,
  panelWidthM: number,
  referenceRadiusMm: number | null,
): number {
  const t = Math.max(0, Math.min(100, percent)) / 100
  const radiusM = mmToM(referenceRadiusMm ?? VISUAL_FALLBACK_RADIUS_MM)
  const raw = panelWidthM / Math.max(radiusM, 0.02)
  const maxAngle = Math.min(raw, MAX_SAFE_BEND_ANGLE)
  return t * maxAngle
}

export function previewRadiusMm(
  percent: number,
  panelWidthM: number,
  referenceRadiusMm: number | null,
): number | null {
  const angle = bendPercentToAngle(percent, panelWidthM, referenceRadiusMm)
  if (angle < 0.02) return null
  return (panelWidthM / angle) * 1000
}

export function curveElement(
  originalX: number,
  angle: number,
  panelWidth: number,
  out: { x: number; z: number; rotY: number },
): void {
  if (angle < 1e-4) {
    out.x = originalX
    out.z = 0
    out.rotY = 0
    return
  }
  const radius = panelWidth / angle
  const theta = originalX / radius
  out.x = radius * Math.sin(theta)
  out.z = radius * (1 - Math.cos(theta))
  out.rotY = -theta
}
