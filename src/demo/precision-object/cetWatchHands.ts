/**
 * CET analog mapping for Watch.glb.
 *
 * Bones rotate about local +X (hour Bone.001_01, minute Bone.002_02,
 * seconds Bone.003_03). Clockwise on the yellow dial is increasing X.
 *
 * DEFAULT_HAND_CALIBRATION is the 00:00 pose (all hands on printed 12).
 * Live ticking adds wall-clock turns from that alignment. Do not rotate the
 * model/wrapper to “fix” this — hands only. Sub-dials Bone.004–006 stay parked.
 *
 * Three.js GLTFLoader strips dots in node names (`Bone.001_01` → `Bone001_01`).
 */
export const BERLIN_TZ = 'Europe/Berlin'
export const LOCAL_TZ = 'local'

/** Compact picker ids. `local` resolves to the browser IANA zone. */
export const WATCH_TIME_ZONES = [
  { id: BERLIN_TZ, label: 'Berlin' },
  { id: 'UTC', label: 'UTC' },
  { id: 'America/New_York', label: 'New York' },
  { id: 'Europe/London', label: 'London' },
  { id: 'Asia/Tokyo', label: 'Tokyo' },
  { id: 'Asia/Dubai', label: 'Dubai' },
  { id: LOCAL_TZ, label: 'Local' },
] as const

/** Shared IANA zone for analog hands. Default Europe/Berlin (CET/CEST). */
let activeTimeZone = BERLIN_TZ

export function resolveTimeZone(timeZone: string): string {
  const raw = timeZone.trim() || BERLIN_TZ
  if (raw === LOCAL_TZ) {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || BERLIN_TZ
    } catch {
      return BERLIN_TZ
    }
  }
  return raw
}

export function getTimeZone(): string {
  return activeTimeZone
}

export function setTimeZone(timeZone: string): void {
  const next = resolveTimeZone(timeZone)
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: next }).format(new Date())
    activeTimeZone = next
  } catch {
    activeTimeZone = BERLIN_TZ
  }
}

export const WATCH_HAND_BONES = {
  hour: ['Bone.001_01', 'Bone001_01'],
  minute: ['Bone.002_02', 'Bone002_02'],
  second: ['Bone.003_03', 'Bone003_03'],
} as const

/**
 * Winding crown (knurled middle stem at 3 o'clock). Bone.007_07 / Bone.009_09
 * are the chrono pushers — do not rotate those. GLTFLoader may strip dots.
 * Bone.008 origin is in the case; spin around origin → crown centroid, not local Y.
 */
export const WATCH_CROWN_BONES = ['Bone.008_08', 'Bone008_08'] as const

/**
 * Printed 12 o'clock about local X — measured at 00:00 with all hands on 12.
 * Live analog time adds clockwise turns from this pose; per-hand offsets
 * compensate bone/mesh rest (hour and seconds do not share the minute bind).
 */
export const DEFAULT_TWELVE_X_DEG = -20.4
export const TWELVE_X_RAD = (DEFAULT_TWELVE_X_DEG * Math.PI) / 180

export type HandCalibration = {
  twelveXDeg: number
  hourOffsetDeg: number
  minuteOffsetDeg: number
  secondOffsetDeg: number
}

export const DEFAULT_HAND_CALIBRATION: HandCalibration = {
  twelveXDeg: DEFAULT_TWELVE_X_DEG,
  hourOffsetDeg: -34,
  minuteOffsetDeg: 0,
  secondOffsetDeg: 144.6,
}

const HAND_DEG_MIN = -180
const HAND_DEG_MAX = 180

export function clampHandDeg(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(HAND_DEG_MAX, Math.max(HAND_DEG_MIN, value))
}

export function wrapHandDeg(value: number): number {
  if (!Number.isFinite(value)) return 0
  let next = value
  while (next > HAND_DEG_MAX) next -= 360
  while (next < HAND_DEG_MIN) next += 360
  return next
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

let handCalibration: HandCalibration = { ...DEFAULT_HAND_CALIBRATION }

export function getHandCalibration(): HandCalibration {
  return { ...handCalibration }
}

export function setHandCalibration(next?: Partial<HandCalibration> | null): HandCalibration {
  const merged = { ...DEFAULT_HAND_CALIBRATION, ...handCalibration, ...next }
  handCalibration = {
    twelveXDeg: clampHandDeg(merged.twelveXDeg, DEFAULT_HAND_CALIBRATION.twelveXDeg),
    hourOffsetDeg: clampHandDeg(merged.hourOffsetDeg),
    minuteOffsetDeg: clampHandDeg(merged.minuteOffsetDeg),
    secondOffsetDeg: clampHandDeg(merged.secondOffsetDeg),
  }
  return getHandCalibration()
}

/** Zone-change hand tween. Live ticking does not use this. */
export const ZONE_HAND_TWEEN_SEC = 1.15

/** Seconds may add at most one extra full turn on a zone change. */
export const ZONE_SECONDS_EXTRA_TURNS = 1

/** Clockwise on the dial is increasing local X. */
export const CLOCKWISE_SIGN = 1

export type BerlinCivilTime = {
  hour: number
  minute: number
  second: number
  millisecond: number
}

export type AnalogHandRadians = {
  hour: number
  minute: number
  second: number
}

function partNumber(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const raw = parts.find((part) => part.type === type)?.value ?? '0'
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : 0
}

/**
 * Wall hours 0–23 in `timeZone`. Prefer UTC fields after applying the zone
 * offset — never `getHours()` on that shifted Date (host CEST + Berlin CEST
 * would read 13:56 at 11:56). `hour12: false` must be set: `hourCycle: 'h23'`
 * alone is ignored in some engines, and `hour: 'numeric'` can follow a 1–12
 * cycle (11:56 → "12" → analog almost 1 / “13h”).
 */
function zoneOffsetMs(at: Date, timeZone: string): number | null {
  try {
    const name =
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'longOffset',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
        .formatToParts(at)
        .find((part) => part.type === 'timeZoneName')?.value ?? ''
    const trimmed = name.trim()
    if (/^(GMT|UTC)$/i.test(trimmed)) return 0
    const match = trimmed.match(/([+-])(\d{1,2})(?::?(\d{2}))?/)
    if (!match) return null
    const sign = match[1] === '-' ? -1 : 1
    return sign * (Number(match[2]) * 60 + Number(match[3] || 0)) * 60_000
  } catch {
    return null
  }
}

function civilFromHourParts(at: Date, timeZone: string): BerlinCivilTime {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(at)
  let hour = partNumber(parts, 'hour')
  if (hour === 24) hour = 0
  return {
    hour,
    minute: partNumber(parts, 'minute'),
    second: partNumber(parts, 'second'),
    millisecond: at.getMilliseconds(),
  }
}

/** Wall-clock in the active IANA zone (default Europe/Berlin). */
export function berlinCivilTime(at: Date = new Date()): BerlinCivilTime {
  const timeZone = activeTimeZone
  const offsetMs = zoneOffsetMs(at, timeZone)
  if (offsetMs != null) {
    const shifted = new Date(at.getTime() + offsetMs)
    return {
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
      second: shifted.getUTCSeconds(),
      millisecond: shifted.getUTCMilliseconds(),
    }
  }
  return civilFromHourParts(at, timeZone)
}

/** Local-X radians: absolute clockwise turns from printed 12 (not bind 12:10). */
function handXFromTwelve(clockwiseTurns: number, offsetDeg: number): number {
  return (
    degToRad(handCalibration.twelveXDeg) +
    CLOCKWISE_SIGN * clockwiseTurns * Math.PI * 2 +
    degToRad(offsetDeg)
  )
}

/** 0–23 (or h24’s 24) → 0–11 analog hours. Never +1, never `|| 12`. */
export function analogHour12(hour24: number): number {
  const hour = hour24 === 24 ? 0 : hour24
  return ((hour % 24) + 24) % 24 % 12
}

/**
 * Local-X radians from printed 12 o'clock, clockwise, continuous hour/minute.
 * Uses wall-clock parts only — do not subtract the GLB bind pose (12:10).
 */
export function analogHandRadians(time: BerlinCivilTime): AnalogHandRadians {
  const wallSecond = time.second + time.millisecond / 1000
  const wallMinute = time.minute + wallSecond / 60
  const wallHour = analogHour12(time.hour) + wallMinute / 60
  return {
    hour: handXFromTwelve(wallHour / 12, handCalibration.hourOffsetDeg),
    minute: handXFromTwelve(wallMinute / 60, handCalibration.minuteOffsetDeg),
    second: handXFromTwelve(wallSecond / 60, handCalibration.secondOffsetDeg),
  }
}

/** Signed delta in (−π, π] — shortest dial arc. */
export function shortestSignedDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta <= -Math.PI) delta += Math.PI * 2
  return delta
}

/**
 * Zone-change deltas from the currently displayed angles to a new civil time.
 * Hour and minute take the shortest arc. Seconds take the shortest arc plus at
 * most one extra full turn in the same direction so the set doesn't look frantic.
 */
export function zoneHandDeltas(from: AnalogHandRadians, to: AnalogHandRadians): AnalogHandRadians {
  const hour = shortestSignedDelta(from.hour, to.hour)
  const minute = shortestSignedDelta(from.minute, to.minute)
  let second = shortestSignedDelta(from.second, to.second)
  const sign =
    second !== 0 ? Math.sign(second) : minute !== 0 ? Math.sign(minute) : hour !== 0 ? Math.sign(hour) : 1
  second += sign * Math.PI * 2 * ZONE_SECONDS_EXTRA_TURNS
  return { hour, minute, second }
}

/** Extra crown turns so a 1h zone change still looks like a winding, not a twitch. */
export const CROWN_WIND_GAIN = 1.35

/**
 * Signed radians for the winding crown during a zone sweep.
 * Applied about the bind-pose stem (origin → crown centroid), not local Y.
 */
export function crownWindDelta(deltas: AnalogHandRadians): number {
  const travel = Math.abs(deltas.hour) + Math.abs(deltas.minute) + Math.abs(deltas.second)
  if (travel < 1e-6) return 0
  const sign =
    deltas.minute !== 0
      ? Math.sign(deltas.minute)
      : deltas.hour !== 0
        ? Math.sign(deltas.hour)
        : Math.sign(deltas.second) || 1
  return sign * travel * CROWN_WIND_GAIN
}
