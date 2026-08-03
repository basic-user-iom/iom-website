import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ensureUiDictionary, getUiDictionary } from './ui/loadDictionary'
import { localePath, parseLocalePath } from './routing'
import {
  DEFAULT_SITE_LANG,
  SITE_LOCALE_TAGS,
  type SiteLang,
} from './types'
import type { Dict } from './types'

type TranslateVars = Record<string, string | number>

type SiteI18nValue = {
  lang: SiteLang
  t: (key: string, vars?: TranslateVars) => string
  href: (path: string) => string
}

const SiteI18nContext = createContext<SiteI18nValue | null>(null)

function format(template: string, vars?: TranslateVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`,
  )
}

function translate(dict: Dict, key: string, vars?: TranslateVars): string {
  const en = getUiDictionary('en')
  const raw = dict[key] ?? en[key] ?? key
  return format(raw, vars)
}

export function SiteI18nProvider({
  lang,
  children,
}: {
  lang: SiteLang
  children: ReactNode
}) {
  const [dict, setDict] = useState(() => getUiDictionary(lang))

  useEffect(() => {
    let cancelled = false
    setDict(getUiDictionary(lang))
    void ensureUiDictionary(lang).then((next) => {
      if (!cancelled) setDict(next)
    })
    return () => {
      cancelled = true
    }
  }, [lang])

  const t = useCallback(
    (key: string, vars?: TranslateVars) => translate(dict, key, vars),
    [dict],
  )

  const href = useCallback((path: string) => localePath(lang, path), [lang])

  useEffect(() => {
    document.documentElement.lang = SITE_LOCALE_TAGS[lang]
  }, [lang])

  const value = useMemo(() => ({ lang, t, href }), [lang, t, href])

  return <SiteI18nContext.Provider value={value}>{children}</SiteI18nContext.Provider>
}

export function useSiteI18nOptional(): SiteI18nValue | null {
  return useContext(SiteI18nContext)
}

export function useSiteI18n(): SiteI18nValue {
  const ctx = useContext(SiteI18nContext)
  if (!ctx) {
    // Safe fallback for routes mounted without provider (CRM, tools, etc.)
    return {
      lang: DEFAULT_SITE_LANG,
      t: (key, vars) => translate(getUiDictionary('en'), key, vars),
      href: (path) => localePath(DEFAULT_SITE_LANG, path),
    }
  }
  return ctx
}

export function useSiteLangFromPath(pathname: string): SiteLang {
  return parseLocalePath(pathname).lang
}
