import { getBlogSupabase, isBlogSupabaseReady } from './supabaseClient'
import { SAMPLE_PUBLISHED_POSTS } from './samplePosts'
import { rowToPost, type BlogCommentPublic, type BlogPost } from './types'

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

export async function fetchPublishedPosts(): Promise<BlogPost[]> {
  const supabase = getBlogSupabase()
  if (!supabase) return SAMPLE_PUBLISHED_POSTS

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('blog_posts')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false }),
      4000,
    )
    if (error) throw error
    // Successful query: only CRM-published posts (empty list while reviewing is correct)
    return (data || []).map((r: Record<string, unknown>) => rowToPost(r))
  } catch {
    return SAMPLE_PUBLISHED_POSTS
  }
}

export async function fetchPublishedPostBySlug(slug: string): Promise<BlogPost | null> {
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
      if (data) return rowToPost(data as Record<string, unknown>)
      // Successful query, slug not published — do not fall back to samples
      return null
    } catch {
      /* fall through to samples when Supabase errors */
    }
  }

  return SAMPLE_PUBLISHED_POSTS.find((p) => p.slug === slug) ?? null
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
