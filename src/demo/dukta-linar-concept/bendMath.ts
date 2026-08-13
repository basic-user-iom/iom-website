/** Conceptual bend mapping for a standing LINAR-style panel. Not a manufacturing model. */

/** 2800 × 1200 mm panel, standing tall, bending across the 1200 mm width. */
export const PANEL_HEIGHT = 2.8
export const PANEL_WIDTH = 1.2
export const PANEL_THICKNESS = 0.012

/** ~128 vertical elements over 1200 mm — suggests 4 mm cut / 4 mm bar without claiming exact kerf. */
export const SLAT_COUNT = 128
export const SLAT_PITCH = PANEL_WIDTH / SLAT_COUNT
/** Open area in the 20–40% product range. */
export const GAP_RATIO = 0.36
export const SLAT_WIDTH = SLAT_PITCH * (1 - GAP_RATIO)

/** Strongly curved at 100, still short of self-intersection. */
export const MAX_BEND_ANGLE = Math.PI * 0.52

export const REST_BEND = 20
export const INTRO_PEAK_BEND = 35

export function clampBend(value: number): number {
  return Math.min(100, Math.max(0, value))
}

export function bendToAngle(bendPercent: number): number {
  return (clampBend(bendPercent) / 100) * MAX_BEND_ANGLE
}

export type CurvedPose = {
  x: number
  z: number
  theta: number
}

/**
 * Map a flat horizontal position onto a circular arc.
 * `originalX` is centred: −panelWidth/2 … +panelWidth/2.
 * Always computed from the flat pose — never incrementally.
 */
export function curveElement(
  originalX: number,
  panelWidth: number,
  bendAngle: number,
): CurvedPose {
  if (Math.abs(bendAngle) < 0.0001) {
    return { x: originalX, z: 0, theta: 0 }
  }

  const normalizedX = originalX / panelWidth
  const theta = normalizedX * bendAngle
  const radius = panelWidth / bendAngle

  return {
    x: radius * Math.sin(theta),
    z: radius * (1 - Math.cos(theta)),
    theta,
  }
}

export function slatOriginalX(index: number, count = SLAT_COUNT, width = PANEL_WIDTH): number {
  const pitch = width / count
  return -width / 2 + pitch * (index + 0.5)
}
