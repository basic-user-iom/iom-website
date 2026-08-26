import { getBlogSupabase, isBlogSupabaseReady } from './supabaseClient'
import { SAMPLE_PUBLISHED_POSTS } from './samplePosts'
import { mergeCatalogTranslations } from './catalogTranslations'
import {
  applyBlogLocale,
  isBlogContentLocale,
  mergeTranslationsFromRows,
  rowToPost,
  translationFieldsFromPost,
  type BlogCommentPublic,
  type BlogContentLocale,
  type BlogPost,
} from './types'

export { isBlogSupabaseReady }

function withTimeout<T>(promiseLike: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    Promise.resolve(promiseLike).then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

async function attachTranslations(
  posts: BlogPost[],
  opts?: { includeBody?: boolean },
): Promise<BlogPost[]> {
  const supabase = getBlogSupabase()
  if (!supabase || !posts.length) {
    return posts.map((p) => mergeCatalogTranslations(p))
  }
  const cols = opts?.includeBody
    ? 'post_id, locale, title, excerpt, body, seo_title, seo_description'
    : 'post_id, locale, title, excerpt, seo_title, seo_description'
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('blog_post_translations')
        .select(cols)
        .in(
          'post_id',
          posts.map((p) => p.id),
        ),
      4000,
    )
    if (error) throw error
    const byPost = new Map<string, Record<string, unknown>[]>()
    for (const row of data || []) {
      const postId = String((row as { post_id: string }).post_id)
      const list = byPost.get(postId) ?? []
      list.push(row as Record<string, unknown>)
      byPost.set(postId, list)
    }
    return posts.map((p) => {
      const rows = byPost.get(p.id)
      const withDb = rows?.length
        ? mergeTranslationsFromRows(p, rows)
        : { ...p, translations: { en: translationFieldsFromPost(p) } }
      return mergeCatalogTranslations(withDb)
    })
  } catch {
    return posts.map((p) => mergeCatalogTranslations(p))
  }
}

function localizeList(posts: BlogPost[], locale: BlogContentLocale): BlogPost[] {
  return posts.map((p) => applyBlogLocale(p, locale))
}

export async function fetchPublishedPosts(
  locale: BlogContentLocale = 'en',
): Promise<BlogPost[]> {
  const lang = isBlogContentLocale(locale) ? locale : 'en'
  const supabase = getBlogSupabase()
  if (!supabase) return localizeList(SAMPLE_PUBLISHED_POSTS, lang)

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('blog_posts')
        .select(
          'id, slug, title, excerpt, cover_image_url, status, published_at, seo_title, seo_description, author_name, tags, owner_id, created_at, updated_at',
        )
        .eq('status', 'published')
        .order('published_at', { ascending: false }),
      4000,
    )
    if (error) throw error
    const posts = (data || []).map((r: Record<string, unknown>) => rowToPost(r))
    const withTr = await attachTranslations(posts)
    return localizeList(withTr, lang)
  } catch {
    return localizeList(SAMPLE_PUBLISHED_POSTS, lang)
  }
}

export async function fetchPublishedPostBySlug(
  slug: string,
  locale: BlogContentLocale = 'en',
): Promise<BlogPost | null> {
  const lang = isBlogContentLocale(locale) ? locale : 'en'
  const supabase = getBlogSupabase()
  if (supabase) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('blog_posts')
          .select('*')
          .eq('status', 'published')
          .eq('slug', slug)
          .maybeSingle(),
        4000,
      )
      if (error) throw error
      if (data) {
        const post = rowToPost(data as Record<string, unknown>)
        const [withTr] = await attachTranslations([post], { includeBody: true })
        return applyBlogLocale(withTr ?? post, lang)
      }
      return null
    } catch {
      /* fall through to samples when Supabase errors */
    }
  }

  const sample = SAMPLE_PUBLISHED_POSTS.find((p) => p.slug === slug)
  return sample ? applyBlogLocale(sample, lang) : null
}

export async function fetchPublicComments(postId: string): Promise<BlogCommentPublic[]> {
  const supabase = getBlogSupabase()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('blog_comments_public')
    .select('id, post_id, parent_id, author_name, body, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []).map((r) => ({
    id: String(r.id),
    post_id: String(r.post_id),
    parent_id: r.parent_id ? String(r.parent_id) : null,
    author_name: String(r.author_name ?? ''),
    body: String(r.body ?? ''),
    created_at: String(r.created_at ?? ''),
  }))
}

export async function submitBlogComment(input: {
  postId: string
  parentId?: string | null
  name: string
  email: string
  body: string
  marketingOptIn?: boolean
  botcheck?: string
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await fetch('/api/blog-comment-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      postId: input.postId,
      parentId: input.parentId || null,
      name: input.name,
      email: input.email,
      body: input.body,
      marketingOptIn: Boolean(input.marketingOptIn),
      botcheck: input.botcheck || '',
    }),
  })
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    message?: string
    error?: string
  }
  if (!res.ok) {
    return { ok: false, error: json.error || `Request failed (${res.status})` }
  }
  return { ok: true, message: json.message || 'Check your email to confirm your comment.' }
}

export async function verifyBlogCommentToken(
  token: string,
): Promise<{ ok: boolean; status?: string; slug?: string; message?: string; error?: string }> {
  const res = await fetch('/api/blog-comment-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ token }),
  })
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    status?: string
    slug?: string
    message?: string
    error?: string
  }
  if (!res.ok) {
    return { ok: false, error: json.error || `Verification failed (${res.status})` }
  }
  return {
    ok: true,
    status: json.status,
    slug: json.slug,
    message: json.message,
  }
}

