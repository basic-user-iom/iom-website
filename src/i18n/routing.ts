import {
  DEFAULT_SITE_LANG,
  SITE_LANGS,
  type SiteLang,
} from './types'

const LANG_SET = new Set<string>(SITE_LANGS)

/** Paths that must never receive a locale prefix (static demos, apps, APIs). */
const NEVER_PREFIX = [
  '/demos',
  '/assets',
  '/api',
  '/client-login',
  '/crm-demo',
  '/r/',
  '/demo/',
  '/tools/',
  '/artist-globe',
]

export function isSiteLang(value: string): value is SiteLang {
  return LANG_SET.has(value)
}

export function normalizePathname(pathname: string): string {
  const p = pathname.replace(/\/+$/, '') || '/'
  return p.startsWith('/') ? p : `/${p}`
}

/**
 * Split a pathname into locale + path without the locale prefix.
 * English has no prefix (`/` stays `/`).
 */
export function parseLocalePath(pathname: string): {
  lang: SiteLang
  path: string
} {
  const raw = normalizePathname(pathname)
  const parts = raw.split('/').filter(Boolean)
  const first = parts[0]

  if (first && isSiteLang(first) && first !== DEFAULT_SITE_LANG) {
    const rest = '/' + parts.slice(1).join('/')
    return { lang: first, path: rest === '/' ? '/' : normalizePathname(rest) }
  }

  return { lang: DEFAULT_SITE_LANG, path: raw }
}

export function shouldSkipLocalePrefix(path: string): boolean {
  const p = normalizePathname(path)
  return NEVER_PREFIX.some(
    (prefix) => p === prefix || p.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`) || p.startsWith(prefix),
  )
}

/**
 * Build a locale-aware internal path.
 * External URLs and never-prefix paths are returned unchanged.
 */
export function localePath(lang: SiteLang, path: string): string {
  if (/^https?:\/\//i.test(path) || path.startsWith('mailto:')) return path

  const hashIndex = path.indexOf('#')
  const queryIndex = path.indexOf('?')
  let cut = path.length
  if (hashIndex >= 0) cut = Math.min(cut, hashIndex)
  if (queryIndex >= 0) cut = Math.min(cut, queryIndex)

  const pathname = path.slice(0, cut) || '/'
  const suffix = path.slice(cut)

  if (shouldSkipLocalePrefix(pathname)) {
    return `${normalizePathname(pathname) === '/' ? '/' : normalizePathname(pathname)}${suffix}`
  }

  const clean = normalizePathname(pathname)
  if (lang === DEFAULT_SITE_LANG) {
    return `${clean === '/' ? '/' : clean}${suffix}`
  }

  if (clean === '/') return `/${lang}${suffix || ''}`
  return `/${lang}${clean}${suffix}`
}

/** Swap locale on the current URL while preserving stripped path + hash + query. */
export function switchLocaleUrl(
  lang: SiteLang,
  currentPathname: string,
  search = '',
  hash = '',
): string {
  const { path } = parseLocalePath(currentPathname)
  const base = localePath(lang, path)
  return `${base}${search}${hash}`
}
