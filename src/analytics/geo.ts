/** Approximate country centroids (ISO 3166-1 alpha-2) for globe pins when lat/lon missing. */
export const COUNTRY_CENTROIDS: Record<string, { lat: number; lon: number; name: string }> = {
  US: { lat: 39.8, lon: -98.5, name: 'United States' },
  CA: { lat: 56.1, lon: -106.3, name: 'Canada' },
  MX: { lat: 23.6, lon: -102.5, name: 'Mexico' },
  BR: { lat: -14.2, lon: -51.9, name: 'Brazil' },
  AR: { lat: -38.4, lon: -63.6, name: 'Argentina' },
  GB: { lat: 55.4, lon: -3.4, name: 'United Kingdom' },
  IE: { lat: 53.1, lon: -8.2, name: 'Ireland' },
  FR: { lat: 46.2, lon: 2.2, name: 'France' },
  DE: { lat: 51.2, lon: 10.4, name: 'Germany' },
  NL: { lat: 52.1, lon: 5.3, name: 'Netherlands' },
  BE: { lat: 50.5, lon: 4.5, name: 'Belgium' },
  ES: { lat: 40.5, lon: -3.7, name: 'Spain' },
  PT: { lat: 39.4, lon: -8.2, name: 'Portugal' },
  IT: { lat: 41.9, lon: 12.6, name: 'Italy' },
  CH: { lat: 46.8, lon: 8.2, name: 'Switzerland' },
  AT: { lat: 47.5, lon: 14.5, name: 'Austria' },
  PL: { lat: 51.9, lon: 19.1, name: 'Poland' },
  CZ: { lat: 49.8, lon: 15.5, name: 'Czechia' },
  SE: { lat: 60.1, lon: 18.6, name: 'Sweden' },
  NO: { lat: 60.5, lon: 8.5, name: 'Norway' },
  DK: { lat: 56.3, lon: 9.5, name: 'Denmark' },
  FI: { lat: 61.9, lon: 25.7, name: 'Finland' },
  RS: { lat: 44.0, lon: 21.0, name: 'Serbia' },
  HR: { lat: 45.1, lon: 15.2, name: 'Croatia' },
  BA: { lat: 43.9, lon: 17.7, name: 'Bosnia and Herzegovina' },
  SI: { lat: 46.1, lon: 14.8, name: 'Slovenia' },
  ME: { lat: 42.7, lon: 19.4, name: 'Montenegro' },
  MK: { lat: 41.6, lon: 21.7, name: 'North Macedonia' },
  AL: { lat: 41.2, lon: 20.2, name: 'Albania' },
  GR: { lat: 39.1, lon: 21.8, name: 'Greece' },
  RO: { lat: 45.9, lon: 24.9, name: 'Romania' },
  BG: { lat: 42.7, lon: 25.5, name: 'Bulgaria' },
  HU: { lat: 47.2, lon: 19.5, name: 'Hungary' },
  UA: { lat: 48.4, lon: 31.2, name: 'Ukraine' },
  TR: { lat: 38.96, lon: 35.2, name: 'Turkey' },
  RU: { lat: 61.5, lon: 105.3, name: 'Russia' },
  IL: { lat: 31.0, lon: 34.9, name: 'Israel' },
  AE: { lat: 23.4, lon: 53.8, name: 'United Arab Emirates' },
  SA: { lat: 23.9, lon: 45.1, name: 'Saudi Arabia' },
  IN: { lat: 20.6, lon: 78.9, name: 'India' },
  CN: { lat: 35.9, lon: 104.2, name: 'China' },
  JP: { lat: 36.2, lon: 138.3, name: 'Japan' },
  KR: { lat: 35.9, lon: 127.8, name: 'South Korea' },
  TW: { lat: 23.7, lon: 121.0, name: 'Taiwan' },
  SG: { lat: 1.35, lon: 103.8, name: 'Singapore' },
  HK: { lat: 22.3, lon: 114.2, name: 'Hong Kong' },
  TH: { lat: 15.9, lon: 100.9, name: 'Thailand' },
  VN: { lat: 14.1, lon: 108.3, name: 'Vietnam' },
  ID: { lat: -0.8, lon: 113.9, name: 'Indonesia' },
  MY: { lat: 4.2, lon: 101.9, name: 'Malaysia' },
  PH: { lat: 12.9, lon: 121.8, name: 'Philippines' },
  AU: { lat: -25.3, lon: 133.8, name: 'Australia' },
  NZ: { lat: -40.9, lon: 174.9, name: 'New Zealand' },
  ZA: { lat: -30.6, lon: 22.9, name: 'South Africa' },
  EG: { lat: 26.8, lon: 30.8, name: 'Egypt' },
  NG: { lat: 9.1, lon: 8.7, name: 'Nigeria' },
  KE: { lat: -0.0, lon: 37.9, name: 'Kenya' },
  CL: { lat: -35.7, lon: -71.5, name: 'Chile' },
  CO: { lat: 4.6, lon: -74.3, name: 'Colombia' },
  PE: { lat: -9.2, lon: -75.0, name: 'Peru' },
}

export function resolveCoords(
  country: string,
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): { lat: number; lon: number } | null {
  if (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    return { lat: latitude, lon: longitude }
  }
  const code = country.trim().toUpperCase()
  const hit = COUNTRY_CENTROIDS[code]
  if (!hit) return null
  return { lat: hit.lat, lon: hit.lon }
}

export function countryLabel(code: string): string {
  const c = code.trim().toUpperCase()
  return COUNTRY_CENTROIDS[c]?.name ?? (c || 'Unknown')
}
