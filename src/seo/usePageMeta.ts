import { useEffect } from 'react'
import { pageMetaForPath } from './pageMeta'
import { structuredDataScripts } from './structuredData'
import { SITE_NAME } from './siteConfig'

const JSON_LD_ATTR = 'data-iom-seo-jsonld'

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
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
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

/** Apply SEO meta tags and structured data for the current SPA route. */
export function applyPageMeta(pathname: string) {
  const meta = pageMetaForPath(pathname)

  document.title = meta.title

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
  if (meta.ogImage) upsertMeta('property', 'og:image', meta.ogImage)

  upsertMeta('name', 'twitter:card', 'summary_large_image')
  upsertMeta('name', 'twitter:title', meta.title)
  upsertMeta('name', 'twitter:description', meta.description)
  if (meta.ogImage) upsertMeta('name', 'twitter:image', meta.ogImage)

  injectJsonLd(pathname)
}

export function usePageMeta(pathname: string) {
  useEffect(() => {
    applyPageMeta(pathname)
  }, [pathname])
}
