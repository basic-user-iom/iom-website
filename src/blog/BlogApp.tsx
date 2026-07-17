import { useEffect, useMemo, useState } from 'react'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { applyPageMeta } from '../seo/usePageMeta'
import { SITE_NAME, SITE_ORIGIN } from '../seo/siteConfig'
import { fetchPublishedPostBySlug, fetchPublishedPosts } from './publicApi'
import { BLOG_PUBLIC_ENABLED } from './publicFlags'
import { BlogComments } from './BlogComments'
import {
  formatBlogDate,
  isBlogPath,
  renderBlogMarkdown,
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
  const p = pathname.replace(/\/+$/, '') || '/'
  if (p === '/blog') return { kind: 'index' }
  if (p === '/blog/verify') return { kind: 'verify' }
  const m = p.match(/^\/blog\/([^/]+)$/)
  if (m) return { kind: 'post', slug: decodeURIComponent(m[1]) }
  return { kind: 'index' }
}

function BlogComingSoon() {
  useEffect(() => {
    applyPageMeta('/blog')
  }, [])

  return (
    <div className="blog-page">
      <div className="blog-page-inner">
        <header className="blog-hero">
          <span className="blog-hero-index" aria-hidden="true">
            07
          </span>
          <div>
            <p className="blog-eyebrow">IOM Journal</p>
            <h1 className="blog-title">Blog</h1>
            <p className="blog-lead">
              Case studies, immersive media notes, and field articles are on the way — same craft as
              our demos, written for clients and collaborators.
            </p>
            <p className="blog-coming-soon" role="status">
              Coming soon
            </p>
            <div className="blog-coming-actions">
              <a className="btn btn-primary" href="/#contact">
                Contact
              </a>
              <a className="btn btn-ghost" href="/#3d">
                See our work
              </a>
            </div>
          </div>
        </header>
      </div>
    </div>
  )
}

function BlogIndex() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const rows = await fetchPublishedPosts()
        if (!cancelled) setPosts(rows)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load posts')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    applyPageMeta('/blog')
  }, [])

  return (
    <div className="blog-page">
      <div className="blog-page-inner">
        <header className="blog-hero">
          <span className="blog-hero-index" aria-hidden="true">
            07
          </span>
          <div>
            <p className="blog-eyebrow">IOM Journal</p>
            <h1 className="blog-title">Blog</h1>
            <p className="blog-lead">
              Case studies, immersive media notes, and field articles — the same craft as our demos,
              written for clients and collaborators.
            </p>
          </div>
        </header>

        {loading && <p className="blog-status">Loading posts…</p>}
        {error && (
          <p className="blog-status blog-status--error" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && posts.length === 0 && (
          <p className="blog-status">
            No published articles yet. Check back soon — or publish from the CRM Blog section.
          </p>
        )}

        <ul className="blog-post-list">
          {posts.map((post, i) => (
            <li key={post.id}>
              <a
                className="blog-post-card"
                href={`/blog/${encodeURIComponent(post.slug)}`}
                onClick={(e) => {
                  e.preventDefault()
                  navigate(`/blog/${encodeURIComponent(post.slug)}`)
                }}
              >
                {post.cover_image_url ? (
                  <img
                    className="blog-post-card-cover"
                    src={post.cover_image_url}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <div className="blog-post-card-cover blog-post-card-cover--empty" aria-hidden>
                    <span className="blog-post-card-glyph">
                      {String(i + 1).padStart(2, '0')} / journal
                    </span>
                  </div>
                )}
                <div className="blog-post-card-body">
                  <time dateTime={post.published_at || undefined}>
                    {formatBlogDate(post.published_at)}
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
                      Read <span aria-hidden="true">→</span>
                    </span>
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function BlogPostPage({ slug }: { slug: string }) {
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
        const row = await fetchPublishedPostBySlug(slug)
        if (!cancelled) {
          setPost(row)
          if (!row) setError('Post not found')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load post')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (!post) return
    const title = post.seo_title || `${post.title} — ${SITE_NAME}`
    const description = post.seo_description || post.excerpt || post.title
    document.title = title
    const desc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null
    if (desc) desc.content = description
    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (canonical) canonical.href = `${SITE_ORIGIN}/blog/${post.slug}`

    // Article JSON-LD
    document.head.querySelectorAll('script[data-iom-blog-jsonld]').forEach((n) => n.remove())
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute('data-iom-blog-jsonld', 'true')
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description,
      image: post.cover_image_url || undefined,
      datePublished: post.published_at || undefined,
      dateModified: post.updated_at || undefined,
      author: { '@type': 'Organization', name: post.author_name || 'IOM' },
      publisher: {
        '@type': 'Organization',
        name: 'IOM',
        url: SITE_ORIGIN,
      },
      mainEntityOfPage: `${SITE_ORIGIN}/blog/${post.slug}`,
    })
    document.head.appendChild(script)
    return () => {
      document.head.querySelectorAll('script[data-iom-blog-jsonld]').forEach((n) => n.remove())
    }
  }, [post])

  const html = useMemo(() => (post ? renderBlogMarkdown(post.body) : ''), [post])

  if (loading) {
    return (
      <div className="blog-page">
        <div className="blog-page-inner">
          <p className="blog-status">Loading…</p>
        </div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="blog-page">
        <div className="blog-page-inner">
          <p className="blog-status blog-status--error">{error || 'Post not found'}</p>
          <a
            href="/blog"
            className="blog-back"
            onClick={(e) => {
              e.preventDefault()
              navigate('/blog')
            }}
          >
            ← All posts
          </a>
        </div>
      </div>
    )
  }

  return (
    <article className="blog-page blog-article">
      <div className="blog-page-inner">
        <a
          href="/blog"
          className="blog-back"
          onClick={(e) => {
            e.preventDefault()
            navigate('/blog')
          }}
        >
          ← All posts
        </a>
        <header className="blog-article-header">
          <time dateTime={post.published_at || undefined}>{formatBlogDate(post.published_at)}</time>
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
          <img className="blog-article-cover" src={post.cover_image_url} alt="" />
        )}
        <div className="blog-prose" dangerouslySetInnerHTML={{ __html: html }} />
        <aside className="blog-cta">
          <p>
            Exploring immersive web, 360°, or interactive 3D for your project?
            <br />
            <a href="/#contact">Talk to IOM</a>
            <a href="/#3d">See our work</a>
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
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const ok = params.get('ok') === '1'
  const error = params.get('error')
  const slug = params.get('slug')
  const status = params.get('status')
  const token = params.get('token')

  const [busy, setBusy] = useState(Boolean(token) && !ok && !error)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    applyPageMeta('/blog/verify')
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
        navigate(`/blog/verify?${q.toString()}`)
      } else {
        setMsg(result.error || 'Verification failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, ok, error])

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
        <p className="blog-eyebrow">IOM Journal</p>
        <h1>Comment confirmation</h1>
        <p className="blog-status">{body}</p>
        {slug ? (
          <a
            href={`/blog/${encodeURIComponent(slug)}`}
            className="blog-back"
            onClick={(e) => {
              e.preventDefault()
              navigate(`/blog/${encodeURIComponent(slug)}`)
            }}
          >
            ← Back to article
          </a>
        ) : (
          <a
            href="/blog"
            className="blog-back"
            onClick={(e) => {
              e.preventDefault()
              navigate('/blog')
            }}
          >
            ← Blog
          </a>
        )}
      </div>
    </div>
  )
}

export function BlogApp() {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const sync = () => setPath(window.location.pathname)
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const route = parseBlogRoute(path)

  return (
    <>
      <Header />
      <main className="blog-main">
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
