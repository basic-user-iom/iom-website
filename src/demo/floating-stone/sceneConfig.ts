export type ThemeMode = 'night' | 'day'

export type PointerState = {
  nx: number
  ny: number
  enabled: boolean
}

/** Public URL after copying/optimizing the Meshy GLB. */
export const STONE_URL = '/models/stone.glb'

/** Max axis length of the centered stone, in world units. */
export const STONE_TARGET_SIZE = 2.18

/** Half-extents of the scaled stone (from the Meshy GLB bounds). */
export const STONE_HALF = { x: 1.09, y: 0.457, z: 0.526 }

/** Extra gap beyond each probe’s visual radius so they skim the outer surface. */
export const PROBE_CLEARANCE = 0.055

/**
 * Night LightOrb glow mesh peaks at ~1.28× with a small pulse — pad must cover that shell,
 * not only the glass radius (`orb.size`).
 */
export const NIGHT_ORB_GLOW_SCALE = 1.28 * 1.025

/** Slightly larger air gap for soft additive night glow vs hard day metal spheres. */
export const NIGHT_PROBE_CLEARANCE = 0.072

/** Center-to-surface pad for a probe (visual shell + clearance). */
export function probePad(size: number, theme: ThemeMode): number {
  if (theme === 'night') return size * NIGHT_ORB_GLOW_SCALE + NIGHT_PROBE_CLEARANCE
  return size + PROBE_CLEARANCE
}

/**
 * Probe radius smoothing against the bumpy mesh.
 * Keep rates gentle — expandLerp ≫ settle reads as jitter on stratified rock.
 */
export const PROBE_FOLLOW = {
  lookaheadSteps: 3,
  lookaheadSpan: 0.22,
  /** Outward radius chase (keep modest). */
  expandLerp: 4.2,
  /** Inward radius chase into valleys. */
  settleLerp: 2.4,
  /** World-position smoothing after radius is applied. */
  posLerp: 7,
  /**
   * Extra clearance vs raw surfaceDist (replaces pad/dir·N which spiked on grazing faces).
   */
  padScale: 1.45,
}

/**
 * One probe drifts toward the cursor hit on the stone (fine pointer only).
 * While following: slide on the outer shell (smooth direction, hard radius) so fast
 * mouse moves cannot chord through the mesh.
 */
export const PROBE_ATTRACT = {
  engage: 3.2,
  release: 2.2,
  /** Angular chase while locked (direction only). */
  chase: 6.5,
  strength: 1,
}

/** Invisible shadow-catcher height. Keep below the stone’s lowest float. */
export const GROUND_Y = -1.12

export const CAMERA = {
  position: [0, 0.32, 4.85] as const,
  fov: 28,
  lookAt: [0, 0.05, 0] as const,
}

/** World-space camera shift from pointer. Increase for a stronger parallax. */
export const CAMERA_PARALLAX = 0.16

/**
 * Stone motion. Speeds are in radians (or cycles) per second.
 * Raise LEVITATION_AMPLITUDE for a more obvious hover.
 */
export const STONE_MOTION = {
  levitationAmplitude: 0.055,
  levitationSpeed: 0.42,
  idleRotationSpeed: 0.045,
  idleSway: 0.012,
  mouseRotateX: 0.2,
  mouseRotateY: 0.32,
  mouseRotateZ: 0.04,
  mouseLerp: 3.2,
  /** When gyro orbit is engaged, damp idle Y spin so arcball reads clearly. */
  gyroIdleSpinScale: 0.22,
}

export function stoneFloatY(elapsed: number, reducedMotion: boolean): number {
  const amp = STONE_MOTION.levitationAmplitude * (reducedMotion ? 0.28 : 1)
  return Math.sin(elapsed * STONE_MOTION.levitationSpeed) * amp
}

export const NIGHT = {
  background: '#07080a',
  ambient: 0.2,
  hemisphereSky: '#243044',
  hemisphereGround: '#0a0908',
  hemisphere: 0.32,
  fogNear: 7.5,
  fogFar: 18,
  exposure: 1.04,
}

export const DAY = {
  /** Cooler gallery grey — less warm fill wash. */
  background: '#e6e8ec',
  ambient: 0.18,
  hemisphereSky: '#d8dee8',
  hemisphereGround: '#9a968e',
  hemisphere: 0.28,
  /** Hard key; fill cut so form shadows read. */
  sunIntensity: 2.85,
  /** Side-raked for longer form shadows (lower elevation). */
  sunPosition: [7.8, 4.4, 2.2] as const,
  envIntensity: 0.28,
  exposure: 1.06,
  shadowOpacity: 0.38,
  /** Subtle cool rim opposite the key. */
  rimIntensity: 0.22,
  rimPosition: [-5.2, 2.8, -4.6] as const,
  rimColor: '#a8c0e0',
}

/**
 * Probe headings around the stone. Radius follows a smoothed outer envelope.
 * `latitude` is the inspection band (0 = waist, + = top ridge, − = underside).
 */
export const ORBITING_SPHERES = [
  {
    speed: 0.155,
    phase: 0.2,
    latitude: 0.14,
    scan: 0.1,
    scanSpeed: 0.62,
    size: 0.042,
    nightColor: '#00e5ff',
    dayColor: '#d7dbe1',
    nightLight: 2.8,
    lightDistance: 2.2,
  },
  {
    speed: -0.12,
    phase: 2.18,
    latitude: -0.42,
    scan: 0.12,
    scanSpeed: 0.48,
    size: 0.036,
    nightColor: '#78b4ff',
    dayColor: '#c6b48a',
    nightLight: 2.2,
    lightDistance: 2,
  },
  {
    speed: 0.09,
    phase: 4.05,
    latitude: 0.78,
    scan: 0.14,
    scanSpeed: 0.4,
    size: 0.048,
    nightColor: '#ffc9a0',
    dayColor: '#9aa1aa',
    nightLight: 2.4,
    lightDistance: 2.1,
  },
] as const

export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Fine pointer + non-touch: enable parallax. Coarse/mobile: idle only. */
export function canUsePointerParallax(): boolean {
  const fine = window.matchMedia('(pointer: fine)').matches
  const hover = window.matchMedia('(hover: hover)').matches
  const coarse = window.matchMedia('(pointer: coarse)').matches
  return fine && hover && !coarse
}
