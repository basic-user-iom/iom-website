/** Static article HTML gives crawlers and link previews the same six-language story as React. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { build } from 'esbuild'

const SITE = 'https://iobjectm.com'
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const parseJson = file => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
const route = (locale, slug) => `${locale === 'en' ? '' : '/' + locale}/blog/${slug}`
const ogLocale = { en:'en_US', de:'de_DE', fr:'fr_FR', nl:'nl_NL', it:'it_IT', es:'es_ES' }

export async function emitSolarSystemBlog(root, outDir) {
  const source = resolve(root, 'src/blog/posts/solar-system')
  const meta = parseJson(resolve(source, 'metadata.json'))
  const shell = readFileSync(resolve(outDir, 'index.html'), 'utf8')
  const compiled = await build({
    entryPoints: [resolve(root, 'src/blog/types.ts')], bundle: true,
    write: false, format: 'esm', platform: 'node', logLevel: 'silent',
  })
  const { renderBlogMarkdown } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'))
  const alternates = Object.keys(meta.locales).map(locale =>
    `<link data-iom-hreflang="true" rel="alternate" hreflang="${locale}" href="${SITE}${route(locale, meta.slug)}" />`).join('\n')
    + `\n<link data-iom-hreflang="true" rel="alternate" hreflang="x-default" href="${SITE}${route('en', meta.slug)}" />`
  for (const [locale, content] of Object.entries(meta.locales)) {
    const canonical = SITE + route(locale, meta.slug)
    const image = SITE + meta.cover_image_url
    const jsonld = JSON.stringify({
      '@context':'https://schema.org', '@type':'Article', headline:content.title,
      description:content.seo_description, inLanguage:locale, image,
      datePublished:meta.published_at, dateModified:meta.published_at,
      author:{'@type':'Organization',name:meta.author_name},
      publisher:{'@type':'Organization',name:'IOM',url:SITE}, mainEntityOfPage:canonical,
    }).replace(/</g,'\\u003c')
    let html = shell
      .replace(/<html\b[^>]*>/i, `<html lang="${locale}">`)
      .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escape(content.seo_title)}</title>`)
      .replace(/<meta\b[^>]*(?:name|property)="(?:description|keywords|og:[^"]+|twitter:[^"]+)"[^>]*>/gi, '')
      .replace(/<link\b[^>]*rel="(?:canonical|alternate)"[^>]*>/gi, '')
      .replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<link\b[^>]*href="\/assets\/posters\/hero-ravens[^>]*>/gi,'')
    const head = `
<style data-solar-blog-styles>${readFileSync(resolve(root,'src/blog/blog.css'),'utf8')}</style>
<meta name="description" content="${escape(content.seo_description)}" />
<link rel="canonical" href="${canonical}" />
${alternates}
<meta property="og:type" content="article" />
<meta property="og:site_name" content="IOM" />
<meta property="og:locale" content="${ogLocale[locale]}" />
<meta property="og:title" content="${escape(content.seo_title)}" />
<meta property="og:description" content="${escape(content.seo_description)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:alt" content="${escape(content.title)}" />
<meta property="article:published_time" content="${meta.published_at}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escape(content.seo_title)}" />
<meta name="twitter:description" content="${escape(content.seo_description)}" />
<meta name="twitter:image" content="${image}" />
<script type="application/ld+json" data-iom-blog-jsonld="true">${jsonld}</script>`
    const body = readFileSync(resolve(source, `${locale}.md`), 'utf8').trim()
    const navigation = Object.keys(meta.locales).map(lang => `<a hreflang="${lang}" href="${route(lang,meta.slug)}">${lang.toUpperCase()}</a>`).join(' · ')
    const snapshot = `<main><article class="blog-page blog-article"><div class="blog-page-inner"><nav>${navigation}</nav><header class="blog-article-header"><time datetime="${meta.published_at}">${new Intl.DateTimeFormat(locale,{dateStyle:'long',timeZone:'UTC'}).format(new Date(meta.published_at))}</time><h1>${escape(content.title)}</h1><p>${escape(content.excerpt)}</p></header><img class="blog-article-cover" src="${escape(meta.cover_image_url)}" alt="" fetchpriority="high" /><div class="blog-prose">${renderBlogMarkdown(body)}</div></div></article></main>`
    const bodyScripts = (shell.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1].match(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g) || []).join('\n')
    html = html.replace('</head>', head + '\n</head>').replace(/<body[^>]*>[\s\S]*?<\/body>/i, `<body><div id="root">${snapshot}</div>${bodyScripts}</body>`)
    const destination = resolve(outDir, route(locale,meta.slug).slice(1), 'index.html')
    mkdirSync(dirname(destination),{recursive:true});writeFileSync(destination,html)
  }
  // The published editorial is available even when the CMS has no matching row.
  // Add all locale URLs to the built sitemap without changing other projects' entries.
  const sitemapPath = resolve(outDir,'sitemap.xml')
  let sitemap = readFileSync(sitemapPath,'utf8')
  const additions = Object.keys(meta.locales).filter(locale=>!sitemap.includes(`<loc>${SITE}${route(locale,meta.slug)}/</loc>`)).map(locale=>
    `<url><loc>${SITE}${route(locale,meta.slug)}/</loc><lastmod>${meta.published_at.slice(0,10)}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority>${Object.keys(meta.locales).map(lang=>`<xhtml:link rel="alternate" hreflang="${lang}" href="${SITE}${route(lang,meta.slug)}/"/>`).join('')}</url>`).join('\n')
  sitemap=sitemap.replace('</urlset>',additions+'\n</urlset>');writeFileSync(sitemapPath,sitemap)
  console.log('Solar System blog: 6 localized article pages, sharing metadata and sitemap entries.')
}

export function solarSystemBlogPages() {
  let root, outDir
  return {
    name:'solar-system-blog-pages', apply:'build',
    configResolved(config) { root=config.root;outDir=resolve(root,config.build.outDir) },
    async closeBundle() { await emitSolarSystemBlog(root,outDir) },
  }
}
