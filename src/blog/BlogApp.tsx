import { useEffect, useMemo, useState } from 'react'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { localePath, parseLocalePath, useSiteI18n, type SiteLang } from '../i18n'
import { applyPageMeta } from '../seo/usePageMeta'
import { SITE_NAME, SITE_ORIGIN } from '../seo/siteConfig'
import { fetchPublishedPostBySlug, fetchPublishedPosts } from './publicApi'
import { BLOG_PUBLIC_ENABLED } from './publicFlags'
import { BlogComments } from './BlogComments'
import {
  formatBlogDate,
  isBlogContentLocale,
  isBlogPath,
  renderBlogMarkdown,
  type BlogContentLocale,
  type BlogPost,
} from './types'
import './blog.css'

function navigate(to: string) {
  window.history.pushState({}, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function parseBlogRoute(pathname: string): {
  kind: 'index' | 'post' | 'verify'
  slug?: string
} {
  const { path } = parseLocalePath(pathname)
  const p = path.replace(/\/+$/, '') || '/'
  if (p === '/blog') return { kind: 'index' }
  if (p === '/blog/verify') return { kind: 'verify' }
  const m = p.match(/^\/blog\/([^/]+)$/)
  if (m) return { kind: 'post', slug: decodeURIComponent(m[1]) }
  return { kind: 'index' }
}

function siteLangToBlogLocale(lang: SiteLang): BlogContentLocale {
  return isBlogContentLocale(lang) ? lang : 'en'
}

function BlogComingSoon() {
  const { t, href, lang } = useSiteI18n()
  useEffect(() => {
    applyPageMeta('/blog', lang)
  }, [lang])

  return (
    <div className="blog-page">
      <div className="blog-page-inner">
        <header className="blog-hero">
          <span className="blog-hero-index" aria-hidden="true">
            07
          </span>
          <div>
            <p className="blog-eyebrow">{t('blog.eyebrow')}</p>
            <h1 className="blog-title">{t('blog.title')}</h1>
            <p className="blog-lead">{t('blog.comingSoonLead')}</p>
            <p className="blog-coming-soon" role="status">
              {t('blog.comingSoon')}
            </p>
            <div className="blog-coming-actions">
              <a className="btn btn-primary" href={href('/#contact')}>
                {t('blog.contact')}
              </a>
              <a className="btn btn-ghost" href={href('/#3d')}>
                {t('blog.seeWork')}
              </a>
            </div>
          </div>
        </header>
      </div>
    </div>
  )
}

function BlogIndex() {
  const { t, href, lang } = useSiteI18n()
  const locale = siteLangToBlogLocale(lang)
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const rows = await fetchPublishedPosts(locale)
        if (!cancelled) setPosts(rows)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('blog.loadError'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [locale, t])

  useEffect(() => {
    applyPageMeta('/blog', lang)
  }, [lang])

  return (
    <div className="blog-page">
      <div className="blog-page-inner">
        <header className="blog-hero">
          <span className="blog-hero-index" aria-hidden="true">
            07
          </span>
          <div>
            <p className="blog-eyebrow">{t('blog.eyebrow')}</p>
            <h1 className="blog-title">{t('blog.title')}</h1>
            <p className="blog-lead">{t('blog.lead')}</p>
          </div>
        </header>

        {loading && <p className="blog-status">{t('blog.loading')}</p>}
        {error && (
          <p className="blog-status blog-status--error" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && posts.length === 0 && (
          <p className="blog-status">{t('blog.empty')}</p>
        )}

        <ul className="blog-post-list">
          {posts.map((post, i) => {
            const postHref = href(`/blog/${encodeURIComponent(post.slug)}`)
            return (
              <li key={post.id}>
                <a
                  className="blog-post-card"
                  href={postHref}
                  onClick={(e) => {
                    e.preventDefault()
                    navigate(postHref)
                  }}
                >
                  {post.cover_image_url ? (
                    <img
                      className="blog-post-card-cover"
                      src={post.cover_image_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      sizes="(max-width: 720px) 100vw, 360px"
                    />
                  ) : (
                    <div className="blog-post-card-cover blog-post-card-cover--empty" aria-hidden>
                      <span className="blog-post-card-glyph">
                        {t('blog.journalGlyph', { n: String(i + 1).padStart(2, '0') })}
                      </span>
                    </div>
                  )}
                  <div className="blog-post-card-body">
                    <time dateTime={post.published_at || undefined}>
                      {formatBlogDate(post.published_at, lang)}
                    </time>
                    <h2>{post.title}</h2>
                    <p>{post.excerpt}</p>
                    {post.tags.length > 0 && (
                      <ul className="blog-tags">
                        {post.tags.map((tag) => (
                          <li key={tag}>{tag}</li>
                        ))}
                      </ul>
                    )}
                    <div className="blog-card-footer">
                      <span className="blog-card-link">
                        {t('blog.read')} <span aria-hidden="true">→</span>
                      </span>
                    </div>
                  </div>
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function BlogPostPage({ slug }: { slug: string }) {
  const { t, href, lang } = useSiteI18n()
  const locale = siteLangToBlogLocale(lang)
  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [commentKey, setCommentKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const row = await fetchPublishedPostBySlug(slug, locale)
        if (!cancelled) {
          setPost(row)
          if (!row) setError(t('blog.notFound'))
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('blog.postLoadError'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, locale, t])

  useEffect(() => {
    if (!post) return
    const title = post.seo_title || `${post.title} — ${SITE_NAME}`
    const description = post.seo_description || post.excerpt || post.title
    document.title = title
    const desc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null
    if (desc) desc.content = description
    const canonicalPath = localePath(lang, `/blog/${post.slug}`)
    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (canonical) canonical.href = `${SITE_ORIGIN}${canonicalPath}`

    document.head.querySelectorAll('script[data-iom-blog-jsonld]').forEach((n) => n.remove())
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute('data-iom-blog-jsonld', 'true')
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description,
      inLanguage: lang,
      image: post.cover_image_url || undefined,
      datePublished: post.published_at || undefined,
      dateModified: post.updated_at || undefined,
      author: { '@type': 'Organization', name: post.author_name || 'IOM' },
      publisher: {
        '@type': 'Organization',
        name: 'IOM',
        url: SITE_ORIGIN,
      },
      mainEntityOfPage: `${SITE_ORIGIN}${canonicalPath}`,
    })
    document.head.appendChild(script)
    return () => {
      document.head.querySelectorAll('script[data-iom-blog-jsonld]').forEach((n) => n.remove())
    }
  }, [post, lang])

  const html = useMemo(() => (post ? renderBlogMarkdown(post.body) : ''), [post])
  const indexHref = href('/blog')

  if (loading) {
    return (
      <div className="blog-page">
        <div className="blog-page-inner">
          <p className="blog-status">{t('blog.loadingPost')}</p>
        </div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="blog-page">
        <div className="blog-page-inner">
          <p className="blog-status blog-status--error">{error || t('blog.notFound')}</p>
          <a
            href={indexHref}
            className="blog-back"
            onClick={(e) => {
              e.preventDefault()
              navigate(indexHref)
            }}
          >
            {t('blog.allPosts')}
          </a>
        </div>
      </div>
    )
  }

  return (
    <article className="blog-page blog-article">
      <div className="blog-page-inner">
        <a
          href={indexHref}
          className="blog-back"
          onClick={(e) => {
            e.preventDefault()
            navigate(indexHref)
          }}
        >
          {t('blog.allPosts')}
        </a>
        <header className="blog-article-header">
          <time dateTime={post.published_at || undefined}>{formatBlogDate(post.published_at, lang)}</time>
          <h1>{post.title}</h1>
          <p className="blog-article-byline">
            <span>{post.author_name || 'IOM'}</span>
            {post.excerpt ? ` — ${post.excerpt}` : ''}
          </p>
          {post.tags.length > 0 && (
            <ul className="blog-tags">
              {post.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          )}
        </header>
        {post.cover_image_url && (
          <img
            className="blog-article-cover"
            src={post.cover_image_url}
            alt=""
            decoding="async"
            fetchPriority="high"
          />
        )}
        <div className="blog-prose" dangerouslySetInnerHTML={{ __html: html }} />
        <aside className="blog-cta">
          <p>
            Exploring immersive web, 360°, or interactive 3D for your project?
            <br />
            {slug === '3d-viewer' ? (
              <a href={href('/case-studies/3d-viewer')}>Process case study</a>
            ) : null}
            {slug === 'panorama-suite' || slug === 'panorama-360-tour' ? (
              <a href={href('/case-studies/black-witness')}>Process case study</a>
            ) : null}
            <a href={href('/#contact')}>Talk to IOM</a>
            <a href={href('/#3d')}>See our work</a>
          </p>
        </aside>
        <BlogComments
          key={commentKey}
          postId={post.id}
          onSubmitted={() => setCommentKey((k) => k + 1)}
        />
      </div>
    </article>
  )
}

function BlogVerifyPage() {
  const { t, href, lang } = useSiteI18n()
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const ok = params.get('ok') === '1'
  const error = params.get('error')
  const slug = params.get('slug')
  const status = params.get('status')
  const token = params.get('token')

  const [busy, setBusy] = useState(Boolean(token) && !ok && !error)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    applyPageMeta('/blog/verify', lang)
    if (!token || ok || error) return
    let cancelled = false
    ;(async () => {
      const { verifyBlogCommentToken } = await import('./publicApi')
      const result = await verifyBlogCommentToken(token)
      if (cancelled) return
      setBusy(false)
      if (result.ok) {
        const q = new URLSearchParams({
          ok: '1',
          status: result.status || 'pending_moderation',
        })
        if (result.slug) q.set('slug', result.slug)
        navigate(href(`/blog/verify?${q.toString()}`))
      } else {
        setMsg(result.error || 'Verification failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, ok, error, href, lang])

  let body = ''
  if (busy) body = 'Confirming your email…'
  else if (msg) body = msg
  else if (error === 'expired') body = 'This confirmation link has expired. Please comment again.'
  else if (error === 'invalid') body = 'This confirmation link is invalid or already used.'
  else if (error) body = 'Something went wrong confirming your email.'
  else if (ok && status === 'approved') body = 'Email confirmed — your comment is live.'
  else if (ok) body = 'Email confirmed — your comment is awaiting moderation. Thank you.'
  else body = 'Open the link from your email to confirm your comment.'

  return (
    <div className="blog-page">
      <div className="blog-page-inner blog-verify">
        <p className="blog-eyebrow">{t('blog.eyebrow')}</p>
        <h1>Comment confirmation</h1>
        <p className="blog-status">{body}</p>
        {slug ? (
          <a
            href={href(`/blog/${encodeURIComponent(slug)}`)}
            className="blog-back"
            onClick={(e) => {
              e.preventDefault()
              navigate(href(`/blog/${encodeURIComponent(slug)}`))
            }}
          >
            {t('blog.backArticle')}
          </a>
        ) : (
          <a
            href={href('/blog')}
            className="blog-back"
            onClick={(e) => {
              e.preventDefault()
              navigate(href('/blog'))
            }}
          >
            {t('blog.backBlog')}
          </a>
        )}
      </div>
    </div>
  )
}

export function BlogApp({ path: pathProp }: { path?: string } = {}) {
  const [pathState, setPath] = useState(
    () => pathProp ?? (window.location.pathname.replace(/\/+$/, '') || '/'),
  )

  useEffect(() => {
    if (pathProp) {
      setPath(pathProp)
      return
    }
    const sync = () => setPath(window.location.pathname.replace(/\/+$/, '') || '/')
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [pathProp])

  const path = pathProp ?? pathState
  const route = parseBlogRoute(path)

  return (
    <>
      <Header />
      <main id="main-content" className="blog-main">
        {!BLOG_PUBLIC_ENABLED ? (
          <BlogComingSoon />
        ) : (
          <>
            {route.kind === 'index' && <BlogIndex />}
            {route.kind === 'post' && route.slug && <BlogPostPage slug={route.slug} />}
            {route.kind === 'verify' && <BlogVerifyPage />}
          </>
        )}
      </main>
      <Footer />
    </>
  )
}

export { isBlogPath }
