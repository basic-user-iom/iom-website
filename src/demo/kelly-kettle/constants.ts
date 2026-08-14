/** Verified published product figures. Smaller details below are visual estimates. */
export const VERIFIED = {
  height: 0.33,
  bodyWidth: 0.155,
  baseWidth: 0.185,
  capacityLitres: 1.6,
  weightKg: 1.16,
} as const

export const BODY_R = VERIFIED.bodyWidth / 2
export const BASE_R = VERIFIED.baseWidth / 2
export const TOTAL_H = VERIFIED.height

/** Visual estimates from the supplied product photograph — not technical specifications. */
export const BASE_H = 0.07
export const SEAT_Y = 0.062
export const KETTLE_H = TOTAL_H - SEAT_Y
export const WALL = 0.0016
export const CHIMNEY_TOP_R = 0.0295
export const CHIMNEY_BOT_R = 0.034
export const SPOUT_ANGLE = (40 * Math.PI) / 180
export const SPOUT_Y = 0.8 * KETTLE_H
export const SPOUT_LEN = 0.024
export const SPOUT_R = 0.0148
export const WATER_TOP_Y = SPOUT_Y - 0.01
/** Near the start of the upper shoulder. */
export const HANDLE_Y = 0.7 * KETTLE_H
export const HANDLE_WIRE_R = 0.00175
export const HANDLE_GRIP_LEN = 0.09
export const HANDLE_GRIP_R = 0.01
export const CHAIN_Y = 0.4 * KETTLE_H
export const CHAIN_LINKS = 30
export const CUT_ANGLE = 1.05
/** Circular air opening in the lower fire-base wall (one hole only). */
export const AIR_HOLE_Y = 0.024
export const AIR_HOLE_R = 0.0096
export const AIR_HOLE_PHI = 0
export const MAX_EMBER_PARTICLES = 18

export const COLORS = {
  bg: 0xf3efe6,
  floor: 0xe7e1d4,
  ink: 0x2c2a26,
  steel: 0xb7bec4,
  steelBase: 0xa8aeb3,
  soot: 0x2a2622,
  whistle: 0x16b52c,
  whistleDark: 0x2a5c32,
  water: 0x4aa0b8,
  coolAir: 0x6d8aa8,
  hotAir: 0xe08a32,
  flame: 0xff6a24,
  ember: 0xff3a12,
  wood: 0xe2d3b5,
  woodDark: 0x3a2a1c,
  tinder: 0x4a3424,
} as const

export const MAX_PARTICLES = 140
export const DEFAULT_PARTICLES = 110
export const MOBILE_PARTICLES = 70
export const PIXEL_RATIO_CAP = 1.5
