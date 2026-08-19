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
 * Printed 12 o'clock about local X for hour and seconds, added on the bind rest
 * pose. After the dial-plane wrapper flip, bind rest is already printed 12, so
 * this starts at 0. Minutes use `minuteOffsetDeg` alone as that extra 12.
 */
export const DEFAULT_TWELVE_X_DEG = 0
export const TWELVE_X_RAD = (DEFAULT_TWELVE_X_DEG * Math.PI) / 180

export type HandCalibration = {
  twelveXDeg: number
  hourOffsetDeg: number
  minuteOffsetDeg: number
  secondOffsetDeg: number
}

export const DEFAULT_HAND_CALIBRATION: HandCalibration = {
  twelveXDeg: DEFAULT_TWELVE_X_DEG,
  hourOffsetDeg: 0,
  minuteOffsetDeg: 0,
  secondOffsetDeg: 0,
}

/** Slider / storage range. */
export const HAND_DEG_MIN = -180
export const HAND_DEG_MAX = 180

export function clampHandDeg(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(HAND_DEG_MAX, Math.max(HAND_DEG_MIN, value))
}

/** Undo a dropped-minus persist (`20.4` vs baked `−20.4`). */
export function restoreHandDegSign(value: number, baked: number): number {
  const n = clampHandDeg(value, baked)
  if (baked < 0 && n > 0 && Math.abs(n + baked) < 0.2) return baked
  return n
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
    twelveXDeg: restoreHandDegSign(merged.twelveXDeg, DEFAULT_HAND_CALIBRATION.twelveXDeg),
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

/**
 * After the wrapper 180° flip, local +X is clockwise on the printed face.
 * Negative sent 11h from 12 CCW onto 1 o'clock (23:23 read as ~1:23).
 */
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
  const fromParts = civilFromHourParts(at, timeZone)
  const offsetMs = zoneOffsetMs(at, timeZone)
  if (offsetMs == null) return fromParts
  const shifted = new Date(at.getTime() + offsetMs)
  const fromOffset = {
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
  }
  // Prefer Intl hour/minute/second so analog and the Zone digital stay on the
  // same civil clock as the taskbar. Keep milliseconds from the UTC shift.
  return { ...fromParts, millisecond: fromOffset.millisecond }
}

/** `HH:MM:SS` in the active zone — same civil parts the analog hands use. */
export function formatCivilHms(time: BerlinCivilTime = berlinCivilTime()): string {
  const pad = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, '0')
  return `${pad(time.hour)}:${pad(time.minute)}:${pad(time.second)}`
}

/**
 * Local-X radians from a midnight bone pose.
 *
 * Hour and seconds: midnight is bind rest + `twelveXDeg + offset`.
 * Minutes: `minuteOffsetDeg` only (do not add `twelveXDeg` again).
 */
function handXFromTwelve(
  clockwiseTurns: number,
  offsetDeg: number,
  fromPrintedTwelve: boolean,
): number {
  const midnightZero =
    (fromPrintedTwelve ? degToRad(handCalibration.twelveXDeg) : 0) + degToRad(offsetDeg)
  return midnightZero + CLOCKWISE_SIGN * clockwiseTurns * Math.PI * 2
}

/** 0–23 (or h24’s 24) → 0–11 analog hours. 23 → 11, never 23h on a 12-hour dial. */
export function analogHour12(hour24: number): number {
  const hour = hour24 === 24 ? 0 : hour24
  return ((hour % 12) + 12) % 12
}

/**
 * Local-X radians from printed 12 o'clock, clockwise, continuous hour/minute.
 * Hour: `(hours % 12 + minutes/60 + seconds/3600) * 30°`.
 * Minute: `(minutes + seconds/60) * 6°`. Second: `seconds * 6°`.
 * Same CLOCKWISE_SIGN on all three. 00:00 calibration is zero.
 * Minutes do not add `twelveXDeg`. Seconds use `secondOffsetDeg` as rest only.
 */
export function analogHandRadians(time: BerlinCivilTime): AnalogHandRadians {
  const wallSecond = time.second + time.millisecond / 1000
  const wallMinute = time.minute + wallSecond / 60
  const wallHour = analogHour12(time.hour) + wallMinute / 60
  return {
    hour: handXFromTwelve(wallHour / 12, handCalibration.hourOffsetDeg, true),
    minute: handXFromTwelve(wallMinute / 60, handCalibration.minuteOffsetDeg, false),
    second: handXFromTwelve(wallSecond / 60, handCalibration.secondOffsetDeg, true),
  }
}

/** Dial reading implied by a civil time (0=12, 1=1 o'clock, 59 minutes, …). */
export function analogClockMarks(time: BerlinCivilTime): {
  hour: number
  minute: number
  second: number
} {
  const wallSecond = time.second + time.millisecond / 1000
  const wallMinute = time.minute + wallSecond / 60
  return {
    hour: analogHour12(time.hour) + wallMinute / 60,
    minute: wallMinute,
    second: wallSecond,
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
