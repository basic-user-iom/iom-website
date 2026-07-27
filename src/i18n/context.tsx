import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { uiDictionaries } from './ui'
import { localePath, parseLocalePath } from './routing'
import {
  DEFAULT_SITE_LANG,
  SITE_LOCALE_TAGS,
  type SiteLang,
} from './types'

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

export function SiteI18nProvider({
  lang,
  children,
}: {
  lang: SiteLang
  children: ReactNode
}) {
  const t = useCallback(
    (key: string, vars?: TranslateVars) => {
      const dict = uiDictionaries[lang] ?? uiDictionaries.en
      const raw = dict[key] ?? uiDictionaries.en[key] ?? key
      return format(raw, vars)
    },
    [lang],
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
      t: (key, vars) => format(uiDictionaries.en[key] ?? key, vars),
      href: (path) => localePath(DEFAULT_SITE_LANG, path),
    }
  }
  return ctx
}

export function useSiteLangFromPath(pathname: string): SiteLang {
  return parseLocalePath(pathname).lang
}
