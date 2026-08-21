export type Locale = 'en' | 'de'

export type LocalizedString = Record<Locale, string>

export const LOCALES: { id: Locale; label: string; short: string }[] = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'de', label: 'Deutsch', short: 'DE' },
]

export function pickLocale(value: LocalizedString, locale: Locale): string {
  return value[locale]
}

export const LOCALE_STORAGE_KEY = 'dukta-locale'

export function detectLocale(): Locale {
  try {
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get('lang')
    if (fromQuery === 'de' || fromQuery === 'en') return fromQuery
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored === 'de' || stored === 'en') return stored
    const nav = navigator.language.toLowerCase()
    if (nav.startsWith('de')) return 'de'
  } catch {
    /* ignore */
  }
  return 'en'
}

export function persistLocale(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    const url = new URL(window.location.href)
    url.searchParams.set('lang', locale)
    window.history.replaceState({}, '', url.toString())
  } catch {
    /* ignore */
  }
  document.documentElement.lang = locale === 'de' ? 'de' : 'en'
}
