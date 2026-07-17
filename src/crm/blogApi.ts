import { getCurrentUser } from './api'
import { isCrmDemoMode } from './demoMode'
import { DEMO_KEYS, demoRead, demoWrite } from './demoStore'
import { getSupabase, useLiveCrmBackend } from './supabaseClient'
import {
  rowToPost,
  slugifyTitle,
  type BlogAudience,
  type BlogCommentAdmin,
  type BlogCommentStatus,
  type BlogPost,
  type BlogPostInput,
} from '../blog/types'

function uid(): string {
  return crypto.randomUUID()
}

function nowIso(): string {
  return new Date().toISOString()
}

function isMissingRelation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /relation|does not exist|schema cache|Could not find the table/i.test(msg)
}

export function isBlogSchemaMissing(err: unknown): boolean {
  return isMissingRelation(err)
}

function rowToComment(row: Record<string, unknown>): BlogCommentAdmin {
  return {
    id: String(row.id),
    post_id: String(row.post_id),
    parent_id: row.parent_id ? String(row.parent_id) : null,
    author_name: String(row.author_name ?? ''),
    author_email: String(row.author_email ?? ''),
    body: String(row.body ?? ''),
    created_at: String(row.created_at ?? ''),
    status: (row.status as BlogCommentStatus) || 'pending_moderation',
    email_verified_at: row.email_verified_at ? String(row.email_verified_at) : null,
    marketing_opt_in: Boolean(row.marketing_opt_in),
    verify_expires_at: row.verify_expires_at ? String(row.verify_expires_at) : null,
  }
}

function rowToAudience(row: Record<string, unknown>): BlogAudience {
  return {
    id: String(row.id),
    email: String(row.email ?? ''),
    name: String(row.name ?? ''),
    source: row.source === 'manual' ? 'manual' : 'comment',
    marketing_opt_in: Boolean(row.marketing_opt_in),
    verified_at: row.verified_at ? String(row.verified_at) : null,
    last_comment_at: row.last_comment_at ? String(row.last_comment_at) : null,
    notes: String(row.notes ?? ''),
    created_at: String(row.created_at ?? ''),
  }
}

/* ── Posts ─────────────────────────────────────────────── */

export async function listBlogPosts(): Promise<BlogPost[]> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data || []).map((r) => rowToPost(r as Record<string, unknown>))
  }
  return demoRead<BlogPost[]>(DEMO_KEYS.blogPosts, []).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )
}

export async function getBlogPost(id: string): Promise<BlogPost | null> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? rowToPost(data as Record<string, unknown>) : null
  }
  return demoRead<BlogPost[]>(DEMO_KEYS.blogPosts, []).find((p) => p.id === id) ?? null
}

export async function createBlogPost(input: BlogPostInput): Promise<BlogPost> {
  const slug = (input.slug || slugifyTitle(input.title)).trim()
  const stamp = nowIso()
  const publishedAt =
    input.status === 'published' ? input.published_at || stamp : input.published_at || null

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const user = await getCurrentUser()
    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        slug,
        title: input.title,
        excerpt: input.excerpt,
        body: input.body,
        cover_image_url: input.cover_image_url,
        status: input.status,
        published_at: publishedAt,
        seo_title: input.seo_title,
        seo_description: input.seo_description,
        author_name: input.author_name || 'IOM',
        tags: input.tags,
        owner_id: user?.id ?? null,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return rowToPost(data as Record<string, unknown>)
  }

  const post: BlogPost = {
    id: uid(),
    slug,
    title: input.title,
    excerpt: input.excerpt,
    body: input.body,
    cover_image_url: input.cover_image_url,
    status: input.status,
    published_at: publishedAt,
    seo_title: input.seo_title,
    seo_description: input.seo_description,
    author_name: input.author_name || 'IOM',
    tags: input.tags,
    owner_id: null,
    created_at: stamp,
    updated_at: stamp,
  }
  const all = demoRead<BlogPost[]>(DEMO_KEYS.blogPosts, [])
  demoWrite(DEMO_KEYS.blogPosts, [post, ...all])
  return post
}

export async function updateBlogPost(id: string, input: BlogPostInput): Promise<BlogPost> {
  const slug = (input.slug || slugifyTitle(input.title)).trim()
  const stamp = nowIso()

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const existing = await getBlogPost(id)
    let publishedAt = input.published_at ?? existing?.published_at ?? null
    if (input.status === 'published' && !publishedAt) publishedAt = stamp
    if (input.status === 'draft') {
      /* keep published_at history if was published before */
    }

    const { data, error } = await supabase
      .from('blog_posts')
      .update({
        slug,
        title: input.title,
        excerpt: input.excerpt,
        body: input.body,
        cover_image_url: input.cover_image_url,
        status: input.status,
        published_at: publishedAt,
        seo_title: input.seo_title,
        seo_description: input.seo_description,
        author_name: input.author_name || 'IOM',
        tags: input.tags,
      })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return rowToPost(data as Record<string, unknown>)
  }

  const all = demoRead<BlogPost[]>(DEMO_KEYS.blogPosts, [])
  const idx = all.findIndex((p) => p.id === id)
  if (idx < 0) throw new Error('Post not found')
  let publishedAt = input.published_at ?? all[idx].published_at
  if (input.status === 'published' && !publishedAt) publishedAt = stamp
  const next: BlogPost = {
    ...all[idx],
    slug,
    title: input.title,
    excerpt: input.excerpt,
    body: input.body,
    cover_image_url: input.cover_image_url,
    status: input.status,
    published_at: publishedAt,
    seo_title: input.seo_title,
    seo_description: input.seo_description,
    author_name: input.author_name || 'IOM',
    tags: input.tags,
    updated_at: stamp,
  }
  all[idx] = next
  demoWrite(DEMO_KEYS.blogPosts, all)
  return next
}

export async function deleteBlogPost(id: string): Promise<void> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { error } = await supabase.from('blog_posts').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return
  }
  demoWrite(
    DEMO_KEYS.blogPosts,
    demoRead<BlogPost[]>(DEMO_KEYS.blogPosts, []).filter((p) => p.id !== id),
  )
  demoWrite(
    DEMO_KEYS.blogComments,
    demoRead<BlogCommentAdmin[]>(DEMO_KEYS.blogComments, []).filter((c) => c.post_id !== id),
  )
}

/* ── Comments ──────────────────────────────────────────── */

export async function listBlogComments(filters?: {
  status?: BlogCommentStatus | 'all'
  postId?: string
}): Promise<BlogCommentAdmin[]> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    let q = supabase.from('blog_comments').select('*').order('created_at', { ascending: false })
    if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status)
    if (filters?.postId) q = q.eq('post_id', filters.postId)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return (data || []).map((r) => rowToComment(r as Record<string, unknown>))
  }

  let rows = demoRead<BlogCommentAdmin[]>(DEMO_KEYS.blogComments, [])
  if (filters?.status && filters.status !== 'all') {
    rows = rows.filter((c) => c.status === filters.status)
  }
  if (filters?.postId) rows = rows.filter((c) => c.post_id === filters.postId)
  return rows.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}

export async function setBlogCommentStatus(
  id: string,
  status: BlogCommentStatus,
): Promise<void> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { error } = await supabase.from('blog_comments').update({ status }).eq('id', id)
    if (error) throw new Error(error.message)
    return
  }
  const all = demoRead<BlogCommentAdmin[]>(DEMO_KEYS.blogComments, [])
  const idx = all.findIndex((c) => c.id === id)
  if (idx < 0) return
  all[idx] = { ...all[idx], status }
  demoWrite(DEMO_KEYS.blogComments, all)
}

/* ── Audience ──────────────────────────────────────────── */

export async function listBlogAudience(filters?: {
  search?: string
  marketingOnly?: boolean
}): Promise<BlogAudience[]> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('blog_audience')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    let rows = (data || []).map((r) => rowToAudience(r as Record<string, unknown>))
    if (filters?.marketingOnly) rows = rows.filter((r) => r.marketing_opt_in)
    const q = filters?.search?.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (r) => r.email.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
      )
    }
    return rows
  }

  let rows = demoRead<BlogAudience[]>(DEMO_KEYS.blogAudience, [])
  if (filters?.marketingOnly) rows = rows.filter((r) => r.marketing_opt_in)
  const q = filters?.search?.trim().toLowerCase()
  if (q) {
    rows = rows.filter(
      (r) => r.email.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
    )
  }
  return rows.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}

export async function updateBlogAudienceNotes(id: string, notes: string): Promise<void> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { error } = await supabase.from('blog_audience').update({ notes }).eq('id', id)
    if (error) throw new Error(error.message)
    return
  }
  const all = demoRead<BlogAudience[]>(DEMO_KEYS.blogAudience, [])
  const idx = all.findIndex((a) => a.id === id)
  if (idx < 0) return
  all[idx] = { ...all[idx], notes }
  demoWrite(DEMO_KEYS.blogAudience, all)
}

export async function addBlogAudienceManual(input: {
  email: string
  name: string
  marketing_opt_in: boolean
  notes?: string
}): Promise<BlogAudience> {
  const email = input.email.trim().toLowerCase()
  const stamp = nowIso()

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('blog_audience')
      .insert({
        email,
        name: input.name.trim(),
        source: 'manual',
        marketing_opt_in: input.marketing_opt_in,
        verified_at: stamp,
        notes: input.notes || '',
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return rowToAudience(data as Record<string, unknown>)
  }

  const row: BlogAudience = {
    id: uid(),
    email,
    name: input.name.trim(),
    source: 'manual',
    marketing_opt_in: input.marketing_opt_in,
    verified_at: stamp,
    last_comment_at: null,
    notes: input.notes || '',
    created_at: stamp,
  }
  const all = demoRead<BlogAudience[]>(DEMO_KEYS.blogAudience, [])
  demoWrite(DEMO_KEYS.blogAudience, [row, ...all])
  return row
}

/** Demo sandbox helper — simulate a verified comment without SMTP. */
export async function demoAddPendingComment(input: {
  postId: string
  parentId?: string | null
  name: string
  email: string
  body: string
  marketingOptIn?: boolean
}): Promise<BlogCommentAdmin> {
  if (!isCrmDemoMode()) throw new Error('Demo-only')
  const stamp = nowIso()
  const comment: BlogCommentAdmin = {
    id: uid(),
    post_id: input.postId,
    parent_id: input.parentId || null,
    author_name: input.name,
    author_email: input.email.toLowerCase(),
    body: input.body,
    created_at: stamp,
    status: 'pending_moderation',
    email_verified_at: stamp,
    marketing_opt_in: Boolean(input.marketingOptIn),
    verify_expires_at: null,
  }
  const all = demoRead<BlogCommentAdmin[]>(DEMO_KEYS.blogComments, [])
  demoWrite(DEMO_KEYS.blogComments, [comment, ...all])

  const audience = demoRead<BlogAudience[]>(DEMO_KEYS.blogAudience, [])
  const existing = audience.find((a) => a.email === comment.author_email)
  if (existing) {
    existing.name = comment.author_name || existing.name
    existing.last_comment_at = stamp
    existing.marketing_opt_in = existing.marketing_opt_in || comment.marketing_opt_in
    demoWrite(DEMO_KEYS.blogAudience, audience)
  } else {
    audience.unshift({
      id: uid(),
      email: comment.author_email,
      name: comment.author_name,
      source: 'comment',
      marketing_opt_in: comment.marketing_opt_in,
      verified_at: stamp,
      last_comment_at: stamp,
      notes: '',
      created_at: stamp,
    })
    demoWrite(DEMO_KEYS.blogAudience, audience)
  }
  return comment
}
