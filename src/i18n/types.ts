/** Public marketing-site locales (no Serbian). */
export type SiteLang = 'en' | 'de' | 'fr' | 'nl' | 'it' | 'es'

export const SITE_LANGS: readonly SiteLang[] = [
  'en',
  'de',
  'fr',
  'nl',
  'it',
  'es',
] as const

export const DEFAULT_SITE_LANG: SiteLang = 'en'

/** BCP 47 tags for `<html lang>` / `og:locale`. */
export const SITE_LOCALE_TAGS: Record<SiteLang, string> = {
  en: 'en',
  de: 'de',
  fr: 'fr',
  nl: 'nl',
  it: 'it',
  es: 'es',
}

export const SITE_LANG_LABELS: Record<SiteLang, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  nl: 'Nederlands',
  it: 'Italiano',
  es: 'Español',
}

export type Dict = Record<string, string>
