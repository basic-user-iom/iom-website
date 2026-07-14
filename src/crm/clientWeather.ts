/** Open-Meteo geocoding + forecast (no API key). */

export interface ClientGeo {
  lat: number
  lon: number
  name: string
  country: string
  timezone: string
}

export type MoonPhaseKey =
  | 'new'
  | 'waxingCrescent'
  | 'firstQuarter'
  | 'waxingGibbous'
  | 'full'
  | 'waningGibbous'
  | 'lastQuarter'
  | 'waningCrescent'

export interface ClientWeather {
  temperatureC: number
  weatherCode: number
  conditionKey: WeatherConditionKey
  /** Open-Meteo current.is_day (1 = day). Used for sun/moon icon variants. */
  isDay: boolean
  sunriseIso: string | null
  sunsetIso: string | null
  /** Illuminated-cycle fraction 0..1 (0/1 = new, 0.5 = full). */
  moonPhaseFraction: number
  moonPhaseKey: MoonPhaseKey
  /** YYYY-MM-DD in the client's timezone used for tonight's phase. */
  moonPhaseLocalDate: string
  fetchedAt: number
  placeLabel: string
  lat: number
  lon: number
  timezone: string
}

export type WeatherConditionKey =
  | 'clear'
  | 'mainlyClear'
  | 'partlyCloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'showers'
  | 'snowShowers'
  | 'thunderstorm'
  | 'unknown'

const GEO_CACHE = new Map<string, { at: number; value: ClientGeo | null }>()
const WEATHER_CACHE = new Map<string, { at: number; value: ClientWeather | null }>()
const GEO_TTL_MS = 24 * 60 * 60 * 1000
const WEATHER_TTL_MS = 30 * 60 * 1000

function cacheGet<T>(
  map: Map<string, { at: number; value: T }>,
  key: string,
  ttl: number,
): T | undefined {
  const hit = map.get(key)
  if (!hit) return undefined
  if (Date.now() - hit.at > ttl) {
    map.delete(key)
    return undefined
  }
  return hit.value
}

function cacheSet<T>(map: Map<string, { at: number; value: T }>, key: string, value: T) {
  map.set(key, { at: Date.now(), value })
}

export function wmoToConditionKey(code: number): WeatherConditionKey {
  if (code === 0) return 'clear'
  if (code === 1) return 'mainlyClear'
  if (code === 2) return 'partlyCloudy'
  if (code === 3) return 'overcast'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if (code >= 61 && code <= 67) return 'rain'
  if (code >= 71 && code <= 77) return 'snow'
  if (code >= 80 && code <= 82) return 'showers'
  if (code === 85 || code === 86) return 'snowShowers'
  if (code >= 95 && code <= 99) return 'thunderstorm'
  return 'unknown'
}

export interface CitySuggestion {
  /** Stable list key from Open-Meteo id or lat/lon fallback */
  id: string
  name: string
  country: string
  countryCode: string
  admin1: string
  lat: number
  lon: number
  timezone: string
  /** One-line label for autocomplete rows */
  label: string
}

type OpenMeteoGeoResult = {
  id?: number
  latitude: number
  longitude: number
  name: string
  country?: string
  country_code?: string
  admin1?: string
  timezone?: string
}

function toCitySuggestion(r: OpenMeteoGeoResult): CitySuggestion {
  const country = r.country || r.country_code || ''
  const admin1 = r.admin1 || ''
  const parts = [r.name, admin1, country].filter(Boolean)
  return {
    id: r.id != null ? String(r.id) : `${r.name}-${r.latitude},${r.longitude}`,
    name: r.name,
    country,
    countryCode: (r.country_code || '').toUpperCase(),
    admin1,
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone || '',
    label: parts.join(', '),
  }
}

const CITY_SEARCH_CACHE = new Map<string, { at: number; value: CitySuggestion[] }>()

/**
 * Typeahead city search via Open-Meteo Geocoding API (no API key).
 * Returns multiple matches with timezone + coordinates when available.
 */
export async function searchCitySuggestions(
  query: string,
  opts?: { language?: string; count?: number; signal?: AbortSignal },
): Promise<CitySuggestion[]> {
  const name = query.trim()
  if (name.length < 2) return []

  const language = opts?.language === 'sr' ? 'sr' : 'en'
  const count = Math.min(Math.max(opts?.count ?? 8, 1), 20)
  const key = `${language}:${count}:${name.toLowerCase()}`
  const hit = cacheGet(CITY_SEARCH_CACHE, key, GEO_TTL_MS)
  if (hit !== undefined) return hit

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', name)
  url.searchParams.set('count', String(count))
  url.searchParams.set('language', language)
  url.searchParams.set('format', 'json')

  try {
    const res = await fetch(url.toString(), { signal: opts?.signal })
    if (!res.ok) return []
    const data = (await res.json()) as { results?: OpenMeteoGeoResult[] }
    const results = (data.results ?? []).map(toCitySuggestion)
    if (!opts?.signal?.aborted) cacheSet(CITY_SEARCH_CACHE, key, results)
    return results
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    return []
  }
}

export async function geocodeClientLocation(
  city: string,
  country: string,
): Promise<ClientGeo | null> {
  const q = [city.trim(), country.trim()].filter(Boolean).join(', ')
  if (!q) return null
  const key = q.toLowerCase()
  const cached = cacheGet(GEO_CACHE, key, GEO_TTL_MS)
  if (cached !== undefined) return cached

  try {
    const results = await searchCitySuggestions(city.trim() || q, { count: 5, language: 'en' })
    if (results.length === 0) {
      cacheSet(GEO_CACHE, key, null)
      return null
    }

    const countryNeedle = country.trim().toLowerCase()
    const match =
      (countryNeedle
        ? results.find((r) => {
            const c = r.country.toLowerCase()
            const code = r.countryCode.toLowerCase()
            return (
              c === countryNeedle ||
              code === countryNeedle ||
              c.includes(countryNeedle) ||
              countryNeedle.includes(c)
            )
          })
        : null) ?? results[0]

    const geo: ClientGeo = {
      lat: match.lat,
      lon: match.lon,
      name: match.name,
      country: match.country || match.countryCode || country.trim(),
      timezone: match.timezone || '',
    }
    cacheSet(GEO_CACHE, key, geo)
    return geo
  } catch {
    cacheSet(GEO_CACHE, key, null)
    return null
  }
}

/** Mean synodic month (days). */
const SYNODIC_MONTH = 29.530588853
/** Reference new moon: 2000-01-06 18:14 UTC (Julian day). */
const REF_NEW_MOON_JD = 2451550.1

function julianDayUtc(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5
}

/** Calendar YYYY-MM-DD in an IANA timezone (falls back to UTC). */
export function localCalendarDate(timeZone: string, now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now)
    const y = parts.find((p) => p.type === 'year')?.value
    const m = parts.find((p) => p.type === 'month')?.value
    const d = parts.find((p) => p.type === 'day')?.value
    if (y && m && d) return `${y}-${m}-${d}`
  } catch {
    /* fall through */
  }
  return now.toISOString().slice(0, 10)
}

/**
 * Instant representing "tonight" on a local calendar date — 21:00 in that
 * timezone (DST-aware via iterative offset resolution).
 */
export function localTonightInstant(localDate: string, timeZone: string): Date {
  const guess = new Date(`${localDate}T21:00:00.000Z`)
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      timeZoneName: 'longOffset',
    })
    const offsetPart = fmt
      .formatToParts(guess)
      .find((p) => p.type === 'timeZoneName')?.value
    const m = offsetPart?.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/)
    if (!m) return guess
    const sign = m[1] === '-' ? -1 : 1
    const hours = Number(m[2])
    const mins = Number(m[3] || '0')
    const offsetMin = sign * (hours * 60 + mins)
    return new Date(Date.parse(`${localDate}T21:00:00.000Z`) - offsetMin * 60_000)
  } catch {
    return guess
  }
}

/** Lunar cycle fraction 0..1 (0 = new, 0.5 = full). Open-Meteo-compatible scale. */
export function computeMoonPhaseFraction(date: Date): number {
  const jd = julianDayUtc(date)
  const age = ((jd - REF_NEW_MOON_JD) / SYNODIC_MONTH) % 1
  return age < 0 ? age + 1 : age
}

export function moonPhaseKeyFromFraction(fraction: number): MoonPhaseKey {
  const x = ((fraction % 1) + 1) % 1
  if (x < 0.0625 || x >= 0.9375) return 'new'
  if (x < 0.1875) return 'waxingCrescent'
  if (x < 0.3125) return 'firstQuarter'
  if (x < 0.4375) return 'waxingGibbous'
  if (x < 0.5625) return 'full'
  if (x < 0.6875) return 'waningGibbous'
  if (x < 0.8125) return 'lastQuarter'
  return 'waningCrescent'
}

export function moonPhaseForTimezone(
  timeZone: string,
  now = new Date(),
): { fraction: number; key: MoonPhaseKey; localDate: string } {
  const localDate = localCalendarDate(timeZone, now)
  const tonight = localTonightInstant(localDate, timeZone)
  const fraction = computeMoonPhaseFraction(tonight)
  return { fraction, key: moonPhaseKeyFromFraction(fraction), localDate }
}

export async function fetchClientWeather(opts: {
  lat: number
  lon: number
  timezone: string
  placeLabel: string
}): Promise<ClientWeather | null> {
  const tz = opts.timezone.trim() || 'auto'
  const key = `${opts.lat.toFixed(3)},${opts.lon.toFixed(3)},${tz}`
  const cached = cacheGet(WEATHER_CACHE, key, WEATHER_TTL_MS)
  if (cached !== undefined) return cached

  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(opts.lat))
  url.searchParams.set('longitude', String(opts.lon))
  url.searchParams.set('current', 'temperature_2m,weather_code,is_day')
  url.searchParams.set('daily', 'sunrise,sunset')
  url.searchParams.set('forecast_days', '1')
  url.searchParams.set('timezone', tz)

  try {
    const res = await fetch(url.toString())
    if (!res.ok) {
      cacheSet(WEATHER_CACHE, key, null)
      return null
    }
    const data = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number; is_day?: number }
      daily?: {
        sunrise?: string[]
        sunset?: string[]
        moon_phase?: number[]
        time?: string[]
      }
      timezone?: string
    }
    const code = data.current?.weather_code ?? -1
    const sunriseIso = data.daily?.sunrise?.[0] ?? null
    const sunsetIso = data.daily?.sunset?.[0] ?? null
    const resolvedTz = data.timezone || tz
    const apiIsDay = data.current?.is_day

    // Prefer Open-Meteo daily moon_phase when the API exposes it; otherwise
    // compute from the client's local calendar date (astronomy, no paid API).
    const computed = moonPhaseForTimezone(resolvedTz === 'auto' ? 'UTC' : resolvedTz)
    const apiPhase = data.daily?.moon_phase?.[0]
    const moonPhaseFraction =
      typeof apiPhase === 'number' && Number.isFinite(apiPhase)
        ? ((apiPhase % 1) + 1) % 1
        : computed.fraction
    const moonPhaseLocalDate = data.daily?.time?.[0] || computed.localDate
    const moonPhaseKey = moonPhaseKeyFromFraction(moonPhaseFraction)

    const weather: ClientWeather = {
      temperatureC: data.current?.temperature_2m ?? NaN,
      weatherCode: code,
      conditionKey: wmoToConditionKey(code),
      isDay:
        typeof apiIsDay === 'number'
          ? apiIsDay === 1
          : inferIsDayFromSun(sunriseIso, sunsetIso, resolvedTz),
      sunriseIso,
      sunsetIso,
      moonPhaseFraction,
      moonPhaseKey,
      moonPhaseLocalDate,
      fetchedAt: Date.now(),
      placeLabel: opts.placeLabel,
      lat: opts.lat,
      lon: opts.lon,
      timezone: resolvedTz,
    }
    if (Number.isNaN(weather.temperatureC)) {
      cacheSet(WEATHER_CACHE, key, null)
      return null
    }
    cacheSet(WEATHER_CACHE, key, weather)
    return weather
  } catch {
    cacheSet(WEATHER_CACHE, key, null)
    return null
  }
}

export function formatClientLocalTime(
  date: Date,
  timeZone: string,
  locale: string,
  opts: Intl.DateTimeFormatOptions,
): string {
  try {
    return new Intl.DateTimeFormat(locale, { ...opts, timeZone }).format(date)
  } catch {
    return new Intl.DateTimeFormat(locale, opts).format(date)
  }
}

/** Fallback when Open-Meteo is_day is missing: compare client-local HH:MM to sunrise/sunset. */
export function inferIsDayFromSun(
  sunriseIso: string | null,
  sunsetIso: string | null,
  timeZone?: string,
  now = new Date(),
): boolean {
  const rise = sunriseIso?.match(/T(\d{2}):(\d{2})/)
  const set = sunsetIso?.match(/T(\d{2}):(\d{2})/)
  if (!rise || !set) return true
  let nowMin: number
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(now)
      const hour = Number(parts.find((p) => p.type === 'hour')?.value)
      const minute = Number(parts.find((p) => p.type === 'minute')?.value)
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return true
      nowMin = hour * 60 + minute
    } catch {
      nowMin = now.getHours() * 60 + now.getMinutes()
    }
  } else {
    nowMin = now.getHours() * 60 + now.getMinutes()
  }
  const riseMin = Number(rise[1]) * 60 + Number(rise[2])
  const setMin = Number(set[1]) * 60 + Number(set[2])
  if (riseMin <= setMin) return nowMin >= riseMin && nowMin < setMin
  return nowMin >= riseMin || nowMin < setMin
}

/**
 * Open-Meteo daily sunrise/sunset are wall-clock ISO in the requested timezone
 * (often without Z). Prefer the HH:MM portion so we do not re-shift the zone.
 */

export function formatSunClock(
  isoLocal: string | null,
  _timeZone: string,
  _locale: string,
): string {
  if (!isoLocal) return '—'
  const m = isoLocal.match(/T(\d{2}):(\d{2})/)
  if (m) return `${m[1]}:${m[2]}`
  try {
    const d = new Date(isoLocal)
    if (!Number.isNaN(d.getTime())) {
      return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
    }
  } catch {
    /* fall through */
  }
  return isoLocal
}
