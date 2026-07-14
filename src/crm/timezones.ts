/** Common IANA zones for lead timezone picker (searchable). */
export const COMMON_TIMEZONES: { value: string; label: string; region: string }[] = [
  { value: 'Europe/Belgrade', label: 'Belgrade', region: 'Europe' },
  { value: 'Europe/Zagreb', label: 'Zagreb', region: 'Europe' },
  { value: 'Europe/Sarajevo', label: 'Sarajevo', region: 'Europe' },
  { value: 'Europe/Podgorica', label: 'Podgorica', region: 'Europe' },
  { value: 'Europe/Skopje', label: 'Skopje', region: 'Europe' },
  { value: 'Europe/Ljubljana', label: 'Ljubljana', region: 'Europe' },
  { value: 'Europe/Vienna', label: 'Vienna', region: 'Europe' },
  { value: 'Europe/Berlin', label: 'Berlin', region: 'Europe' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam', region: 'Europe' },
  { value: 'Europe/Brussels', label: 'Brussels', region: 'Europe' },
  { value: 'Europe/Paris', label: 'Paris', region: 'Europe' },
  { value: 'Europe/London', label: 'London', region: 'Europe' },
  { value: 'Europe/Dublin', label: 'Dublin', region: 'Europe' },
  { value: 'Europe/Madrid', label: 'Madrid', region: 'Europe' },
  { value: 'Europe/Rome', label: 'Rome', region: 'Europe' },
  { value: 'Europe/Athens', label: 'Athens', region: 'Europe' },
  { value: 'Europe/Bucharest', label: 'Bucharest', region: 'Europe' },
  { value: 'Europe/Sofia', label: 'Sofia', region: 'Europe' },
  { value: 'Europe/Istanbul', label: 'Istanbul', region: 'Europe' },
  { value: 'Europe/Warsaw', label: 'Warsaw', region: 'Europe' },
  { value: 'Europe/Prague', label: 'Prague', region: 'Europe' },
  { value: 'Europe/Budapest', label: 'Budapest', region: 'Europe' },
  { value: 'Europe/Zurich', label: 'Zurich', region: 'Europe' },
  { value: 'Europe/Stockholm', label: 'Stockholm', region: 'Europe' },
  { value: 'Europe/Oslo', label: 'Oslo', region: 'Europe' },
  { value: 'Europe/Copenhagen', label: 'Copenhagen', region: 'Europe' },
  { value: 'Europe/Helsinki', label: 'Helsinki', region: 'Europe' },
  { value: 'Europe/Moscow', label: 'Moscow', region: 'Europe' },
  { value: 'Europe/Kyiv', label: 'Kyiv', region: 'Europe' },
  { value: 'Atlantic/Reykjavik', label: 'Reykjavik', region: 'Atlantic' },
  { value: 'Africa/Cairo', label: 'Cairo', region: 'Africa' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg', region: 'Africa' },
  { value: 'Africa/Lagos', label: 'Lagos', region: 'Africa' },
  { value: 'Africa/Nairobi', label: 'Nairobi', region: 'Africa' },
  { value: 'Asia/Dubai', label: 'Dubai', region: 'Asia' },
  { value: 'Asia/Riyadh', label: 'Riyadh', region: 'Asia' },
  { value: 'Asia/Jerusalem', label: 'Jerusalem', region: 'Asia' },
  { value: 'Asia/Tel_Aviv', label: 'Tel Aviv', region: 'Asia' },
  { value: 'Asia/Singapore', label: 'Singapore', region: 'Asia' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong', region: 'Asia' },
  { value: 'Asia/Shanghai', label: 'Shanghai', region: 'Asia' },
  { value: 'Asia/Tokyo', label: 'Tokyo', region: 'Asia' },
  { value: 'Asia/Seoul', label: 'Seoul', region: 'Asia' },
  { value: 'Asia/Kolkata', label: 'Kolkata', region: 'Asia' },
  { value: 'Asia/Bangkok', label: 'Bangkok', region: 'Asia' },
  { value: 'Asia/Jakarta', label: 'Jakarta', region: 'Asia' },
  { value: 'Australia/Sydney', label: 'Sydney', region: 'Australia' },
  { value: 'Australia/Melbourne', label: 'Melbourne', region: 'Australia' },
  { value: 'Pacific/Auckland', label: 'Auckland', region: 'Pacific' },
  { value: 'America/New_York', label: 'New York', region: 'Americas' },
  { value: 'America/Chicago', label: 'Chicago', region: 'Americas' },
  { value: 'America/Denver', label: 'Denver', region: 'Americas' },
  { value: 'America/Los_Angeles', label: 'Los Angeles', region: 'Americas' },
  { value: 'America/Toronto', label: 'Toronto', region: 'Americas' },
  { value: 'America/Vancouver', label: 'Vancouver', region: 'Americas' },
  { value: 'America/Mexico_City', label: 'Mexico City', region: 'Americas' },
  { value: 'America/Sao_Paulo', label: 'São Paulo', region: 'Americas' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires', region: 'Americas' },
  { value: 'America/Bogota', label: 'Bogotá', region: 'Americas' },
  { value: 'UTC', label: 'UTC', region: 'UTC' },
]

/** City name → suggested IANA timezone (best-effort defaults). */
const CITY_TZ_HINTS: Record<string, string> = {
  belgrade: 'Europe/Belgrade',
  beograd: 'Europe/Belgrade',
  zagreb: 'Europe/Zagreb',
  sarajevo: 'Europe/Sarajevo',
  podgorica: 'Europe/Podgorica',
  skopje: 'Europe/Skopje',
  ljubljana: 'Europe/Ljubljana',
  vienna: 'Europe/Vienna',
  wien: 'Europe/Vienna',
  berlin: 'Europe/Berlin',
  amsterdam: 'Europe/Amsterdam',
  brussels: 'Europe/Brussels',
  paris: 'Europe/Paris',
  london: 'Europe/London',
  dublin: 'Europe/Dublin',
  madrid: 'Europe/Madrid',
  rome: 'Europe/Rome',
  roma: 'Europe/Rome',
  athens: 'Europe/Athens',
  bucharest: 'Europe/Bucharest',
  sofia: 'Europe/Sofia',
  istanbul: 'Europe/Istanbul',
  warsaw: 'Europe/Warsaw',
  prague: 'Europe/Prague',
  budapest: 'Europe/Budapest',
  zurich: 'Europe/Zurich',
  stockholm: 'Europe/Stockholm',
  oslo: 'Europe/Oslo',
  copenhagen: 'Europe/Copenhagen',
  helsinki: 'Europe/Helsinki',
  moscow: 'Europe/Moscow',
  kyiv: 'Europe/Kyiv',
  kiev: 'Europe/Kyiv',
  dubai: 'Asia/Dubai',
  singapore: 'Asia/Singapore',
  tokyo: 'Asia/Tokyo',
  sydney: 'Australia/Sydney',
  melbourne: 'Australia/Melbourne',
  'new york': 'America/New_York',
  chicago: 'America/Chicago',
  'los angeles': 'America/Los_Angeles',
  toronto: 'America/Toronto',
  vancouver: 'America/Vancouver',
}

export function suggestTimezoneFromCity(city: string): string | null {
  const key = city.trim().toLowerCase()
  if (!key) return null
  if (CITY_TZ_HINTS[key]) return CITY_TZ_HINTS[key]
  const hit = COMMON_TIMEZONES.find(
    (z) => z.label.toLowerCase() === key || z.value.toLowerCase().includes(key.replace(/\s+/g, '_')),
  )
  return hit?.value ?? null
}

export function isValidIanaTimezone(tz: string): boolean {
  if (!tz.trim()) return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function filterTimezones(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return COMMON_TIMEZONES
  return COMMON_TIMEZONES.filter(
    (z) =>
      z.value.toLowerCase().includes(q) ||
      z.label.toLowerCase().includes(q) ||
      z.region.toLowerCase().includes(q),
  )
}
