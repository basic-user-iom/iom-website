import { useEffect } from 'react'
import type { SiteLang } from '../i18n'
import { SITE_LANGS, SITE_LOCALE_TAGS, localePath } from '../i18n'
import { pageMetaForPath } from './pageMeta'
import { structuredDataScripts } from './structuredData'
import { SITE_NAME, SITE_ORIGIN } from './siteConfig'

const JSON_LD_ATTR = 'data-iom-seo-jsonld'
const HREFLANG_ATTR = 'data-iom-hreflang'

function upsertMeta(
  attr: 'name' | 'property',
  key: string,
  content: string | undefined,
) {
  if (!content) return
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

function upsertLink(rel: string, href: string | undefined) {
  if (!href) return
  let el = document.head.querySelector(`link[rel="${rel}"]:not([${HREFLANG_ATTR}])`) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    document.head.appendChild(el)
  }
  el.href = href
}

function clearJsonLd() {
  document.head.querySelectorAll(`script[${JSON_LD_ATTR}]`).forEach((node) => node.remove())
}

function injectJsonLd(pathname: string) {
  clearJsonLd()
  for (const data of structuredDataScripts(pathname)) {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute(JSON_LD_ATTR, 'true')
    script.textContent = JSON.stringify(data)
    document.head.appendChild(script)
  }
}

function clearHreflang() {
  document.head.querySelectorAll(`link[${HREFLANG_ATTR}]`).forEach((node) => node.remove())
}

function injectHreflang(pathname: string) {
  clearHreflang()
  // Market pages + blog get alternates
  const p = pathname.replace(/\/+$/, '') || '/'
  const eligible =
    p === '/' ||
    p === '/case-studies' ||
    p.startsWith('/case-studies/') ||
    p === '/blog' ||
    p.startsWith('/blog/')
  if (!eligible) return

  for (const lang of SITE_LANGS) {
    const hrefPath = localePath(lang, p)
    const href = `${SITE_ORIGIN}${hrefPath === '/' ? '/' : hrefPath}`
    const link = document.createElement('link')
    link.rel = 'alternate'
    link.hreflang = SITE_LOCALE_TAGS[lang]
    link.href = href
    link.setAttribute(HREFLANG_ATTR, 'true')
    document.head.appendChild(link)
  }

  const xDefault = document.createElement('link')
  xDefault.rel = 'alternate'
  xDefault.hreflang = 'x-default'
  xDefault.href = `${SITE_ORIGIN}${p === '/' ? '/' : p}`
  xDefault.setAttribute(HREFLANG_ATTR, 'true')
  document.head.appendChild(xDefault)
}

/** Apply SEO meta tags and structured data for the current SPA route. */
export function applyPageMeta(pathname: string, lang: SiteLang = 'en') {
  const meta = pageMetaForPath(pathname, lang)

  document.title = meta.title
  document.documentElement.lang = SITE_LOCALE_TAGS[lang]

  upsertMeta('name', 'description', meta.description)
  upsertMeta('name', 'robots', meta.robots ?? 'index, follow')
  if (meta.keywords?.length) {
    upsertMeta('name', 'keywords', meta.keywords.join(', '))
  }

  upsertLink('canonical', meta.canonical)

  upsertMeta('property', 'og:type', 'website')
  upsertMeta('property', 'og:site_name', SITE_NAME)
  upsertMeta('property', 'og:title', meta.title)
  upsertMeta('property', 'og:description', meta.description)
  upsertMeta('property', 'og:url', meta.canonical)
  upsertMeta('property', 'og:locale', SITE_LOCALE_TAGS[lang].replace('-', '_'))
  if (meta.ogImage) upsertMeta('property', 'og:image', meta.ogImage)

  upsertMeta('name', 'twitter:card', 'summary_large_image')
  upsertMeta('name', 'twitter:title', meta.title)
  upsertMeta('name', 'twitter:description', meta.description)
  if (meta.ogImage) upsertMeta('name', 'twitter:image', meta.ogImage)

  injectHreflang(pathname)
  injectJsonLd(pathname)
}

export function usePageMeta(pathname: string, lang: SiteLang = 'en') {
  useEffect(() => {
    applyPageMeta(pathname, lang)
  }, [pathname, lang])
}
