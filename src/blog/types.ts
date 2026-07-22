export type BlogPostStatus = 'draft' | 'pending_review' | 'published' | 'hidden'

const BLOG_POST_STATUSES: BlogPostStatus[] = ['draft', 'pending_review', 'published', 'hidden']

export function normalizeBlogPostStatus(value: unknown): BlogPostStatus {
  const s = String(value || '')
  return (BLOG_POST_STATUSES as string[]).includes(s) ? (s as BlogPostStatus) : 'draft'
}

export type BlogCommentStatus =
  | 'pending_verify'
  | 'pending_moderation'
  | 'approved'
  | 'rejected'
  | 'spam'

export interface BlogPost {
  id: string
  slug: string
  title: string
  excerpt: string
  body: string
  cover_image_url: string
  status: BlogPostStatus
  published_at: string | null
  seo_title: string
  seo_description: string
  author_name: string
  tags: string[]
  owner_id: string | null
  created_at: string
  updated_at: string
}

export type BlogPostInput = {
  slug: string
  title: string
  excerpt: string
  body: string
  cover_image_url: string
  status: BlogPostStatus
  published_at?: string | null
  seo_title: string
  seo_description: string
  author_name: string
  tags: string[]
}

export interface BlogCommentPublic {
  id: string
  post_id: string
  parent_id: string | null
  author_name: string
  body: string
  created_at: string
}

export interface BlogCommentAdmin extends BlogCommentPublic {
  author_email: string
  status: BlogCommentStatus
  email_verified_at: string | null
  marketing_opt_in: boolean
  verify_expires_at: string | null
}

export interface BlogAudience {
  id: string
  email: string
  name: string
  source: 'comment' | 'manual'
  marketing_opt_in: boolean
  verified_at: string | null
  last_comment_at: string | null
  notes: string
  created_at: string
}

export function slugifyTitle(title: string): string {
  return (
    String(title || '')
      .toLowerCase()
      .trim()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'post'
  )
}

export function rowToPost(row: Record<string, unknown>): BlogPost {
  return {
    id: String(row.id),
    slug: String(row.slug ?? ''),
    title: String(row.title ?? ''),
    excerpt: String(row.excerpt ?? ''),
    body: String(row.body ?? ''),
    cover_image_url: String(row.cover_image_url ?? ''),
    status: normalizeBlogPostStatus(row.status),
    published_at: row.published_at ? String(row.published_at) : null,
    seo_title: String(row.seo_title ?? ''),
    seo_description: String(row.seo_description ?? ''),
    author_name: String(row.author_name ?? 'IOM'),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    owner_id: row.owner_id ? String(row.owner_id) : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

/** CRM recording share slug — alphanumeric, typically 12 chars. */
const RECORDING_SLUG_RE = '[a-zA-Z0-9]{6,32}'

/**
 * Accept only first-party /r/{slug} recording embeds (relative or iobjectm.com).
 * Returns embed src path with ?embed=1, or null if unsafe.
 */
export function recordingEmbedSrcFromUrl(url: string): string | null {
  const trimmed = String(url || '').trim()
  const re = new RegExp(
    `^(?:https?:\\/\\/(?:www\\.)?iobjectm\\.com)?\\/r\\/(${RECORDING_SLUG_RE})(?:\\?[^\\s#]*)?(?:#.*)?$`,
    'i',
  )
  const m = trimmed.match(re)
  if (!m) return null
  return `/r/${m[1]}?embed=1`
}

function isBlogVideoUrl(url: string): boolean {
  return /\.(webm|mp4)(?:$|[?#])/i.test(url)
}

/** Prefer cover.jpg in the same blog asset folder as a video poster. */
function videoPosterFromSrc(src: string): string {
  try {
    const [pathPart, query = ''] = src.split('?')
    const replaced = pathPart.replace(/\/[^/]+\.(webm|mp4)$/i, '/cover.jpg')
    if (replaced === pathPart) return ''
    return query ? `${replaced}?${query}` : replaced
  } catch {
    return ''
  }
}

function videoEmbedHtml(src: string, alt = 'Walkthrough'): string {
  const safeSrc = escapeHtml(src)
  const safeAlt = escapeHtml(alt)
  const poster = videoPosterFromSrc(src)
  const posterAttr = poster ? ` poster="${escapeHtml(poster)}"` : ''
  return `<figure class="blog-figure blog-video-embed"><video src="${safeSrc}"${posterAttr} controls playsinline preload="none" title="${safeAlt}"></video>${
    alt ? `<figcaption>${safeAlt}</figcaption>` : ''
  }</figure>`
}

function recordingEmbedHtml(src: string, title = 'Recording'): string {
  const safeSrc = escapeHtml(src)
  const safeTitle = escapeHtml(title)
  return `<figure class="blog-figure blog-recording-embed"><iframe src="${safeSrc}" title="${safeTitle}" width="720" height="405" allow="autoplay; fullscreen" loading="lazy" style="border:0;width:100%;max-width:100%;aspect-ratio:16/9;height:auto"></iframe></figure>`
}

/** Parse a standalone CRM embed iframe line into a safe /r/…?embed=1 src. */
function recordingEmbedSrcFromIframe(line: string): string | null {
  const m = line
    .trim()
    .match(
      /^<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*(?:\/>|>\s*<\/iframe\s*>|>)\s*$/i,
    )
  if (!m) return null
  return recordingEmbedSrcFromUrl(m[1])
}

/** Minimal markdown → safe HTML (no external deps). */
export function renderBlogMarkdown(src: string): string {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let inUl = false
  let inOl = false
  let inCode = false
  let codeBuf: string[] = []

  const closeLists = () => {
    if (inUl) {
      html.push('</ul>')
      inUl = false
    }
    if (inOl) {
      html.push('</ol>')
      inOl = false
    }
  }

  const safeUrl = (url: string) => /^(https?:\/\/|\/)/.test(url)

  const inline = (text: string) => {
    let t = escapeHtml(text)
    t = t.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, (_m, alt, url) => {
      if (!safeUrl(url)) return escapeHtml(`![${alt}](${url})`)
      if (isBlogVideoUrl(url)) return videoEmbedHtml(url, alt || 'Walkthrough')
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />`
    })
    t = t.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g,
      (_m, label, url) => {
        // External + demo pages open in a new tab; site sections stay in-place.
        const newTab = /^(https?:\/\/|\/demos\/)/.test(url)
        const rel = newTab ? ' target="_blank" rel="noopener noreferrer"' : ''
        return `<a href="${url}"${rel}>${label}</a>`
      },
    )
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>')
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>')
    return t
  }

  for (const raw of lines) {
    if (raw.startsWith('```')) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
        codeBuf = []
        inCode = false
      } else {
        closeLists()
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeBuf.push(raw)
      continue
    }

    const line = raw.trimEnd()
    if (!line.trim()) {
      closeLists()
      continue
    }

    const recordingSrc =
      recordingEmbedSrcFromUrl(line.trim()) || recordingEmbedSrcFromIframe(line)
    if (recordingSrc) {
      closeLists()
      html.push(recordingEmbedHtml(recordingSrc))
      continue
    }

    const figureMatch = line
      .trim()
      .match(/^!\[([^\]]*)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)$/)
    if (figureMatch && safeUrl(figureMatch[2])) {
      closeLists()
      const alt = figureMatch[1] || ''
      const src = figureMatch[2]
      if (isBlogVideoUrl(src)) {
        html.push(videoEmbedHtml(src, alt || 'Walkthrough'))
      } else {
        html.push(
          `<figure class="blog-figure"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />${
            alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : ''
          }</figure>`,
        )
      }
      continue
    }

    if (/^###\s+/.test(line)) {
      closeLists()
      html.push(`<h3>${inline(line.replace(/^###\s+/, ''))}</h3>`)
      continue
    }
    if (/^##\s+/.test(line)) {
      closeLists()
      html.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`)
      continue
    }
    if (/^#\s+/.test(line)) {
      closeLists()
      html.push(`<h1>${inline(line.replace(/^#\s+/, ''))}</h1>`)
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      if (inOl) {
        html.push('</ol>')
        inOl = false
      }
      if (!inUl) {
        html.push('<ul>')
        inUl = true
      }
      html.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`)
      continue
    }
    if (/^\d+\.\s+/.test(line)) {
      if (inUl) {
        html.push('</ul>')
        inUl = false
      }
      if (!inOl) {
        html.push('<ol>')
        inOl = true
      }
      html.push(`<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`)
      continue
    }

    closeLists()
    html.push(`<p>${inline(line.trim())}</p>`)
  }

  if (inCode) {
    html.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
  }
  closeLists()
  return html.join('\n')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function formatBlogDate(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

export function isBlogPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/'
  return p === '/blog' || p.startsWith('/blog/')
}
