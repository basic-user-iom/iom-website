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
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" />`
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

    const figureMatch = line
      .trim()
      .match(/^!\[([^\]]*)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)$/)
    if (figureMatch && safeUrl(figureMatch[2])) {
      closeLists()
      const alt = escapeHtml(figureMatch[1])
      const src = escapeHtml(figureMatch[2])
      html.push(
        `<figure class="blog-figure"><img src="${src}" alt="${alt}" loading="lazy" />${
          figureMatch[1] ? `<figcaption>${alt}</figcaption>` : ''
        }</figure>`,
      )
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
