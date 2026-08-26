import { getCurrentUser } from './api'
import { isCrmDemoMode } from './demoMode'
import { DEMO_KEYS, demoRead, demoWrite } from './demoStore'
import { getSupabase, useLiveCrmBackend } from './supabaseClient'
import { ALL_DEMO_BLOG_POSTS } from '../blog/posts'
import { mergeCatalogTranslations } from '../blog/catalogTranslations'
import {
  mergeTranslationsFromRows,
  rowToPost,
  slugifyTitle,
  translationFieldsFromPost,
  type BlogAudience,
  type BlogCommentAdmin,
  type BlogCommentStatus,
  type BlogContentLocale,
  type BlogPost,
  type BlogPostInput,
  type BlogPostStatus,
  type BlogPostTranslationFields,
  type BlogPostTranslations,
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

async function fetchTranslationsForPosts(
  postIds: string[],
  includeBody = true,
): Promise<Map<string, BlogPostTranslations>> {
  const map = new Map<string, BlogPostTranslations>()
  if (!postIds.length || !useLiveCrmBackend()) return map
  const supabase = getSupabase()!
  const query = includeBody
    ? supabase
        .from('blog_post_translations')
        .select('post_id, locale, title, excerpt, body, seo_title, seo_description')
    : supabase
        .from('blog_post_translations')
        .select('post_id, locale, title, excerpt, seo_title, seo_description')
  const { data, error } = await query.in('post_id', postIds)
  if (error) {
    if (isMissingRelation(error)) return map
    throw new Error(error.message)
  }
  for (const raw of (data as unknown as Record<string, unknown>[] | null) || []) {
    const row = raw
    const postId = String(row.post_id)
    const locale = String(row.locale ?? '')
    if (!locale) continue
    const prev = map.get(postId) ?? {}
    const merged = mergeTranslationsFromRows(
      {
        id: postId,
        slug: '',
        title: '',
        excerpt: '',
        body: '',
        cover_image_url: '',
        status: 'draft',
        published_at: null,
        seo_title: '',
        seo_description: '',
        author_name: '',
        tags: [],
        owner_id: null,
        created_at: '',
        updated_at: '',
        translations: prev,
      },
      [row],
    )
    map.set(postId, merged.translations ?? prev)
  }
  return map
}

function withDemoTranslations(post: BlogPost): BlogPost {
  const translations: BlogPostTranslations = {
    en: translationFieldsFromPost(post),
    ...(post.translations ?? {}),
  }
  if (!translations.en) translations.en = translationFieldsFromPost(post)
  return { ...post, translations }
}

function resolveTranslationsForSave(input: BlogPostInput): {
  en: BlogPostTranslationFields
  translations: BlogPostTranslations
} {
  const locale: BlogContentLocale = input.contentLocale ?? 'en'
  const current: BlogPostTranslationFields = {
    title: input.title,
    excerpt: input.excerpt,
    body: input.body,
    seo_title: input.seo_title,
    seo_description: input.seo_description,
  }
  const translations: BlogPostTranslations = { ...(input.translations ?? {}) }
  translations[locale] = current
  if (!translations.en) {
    translations.en = locale === 'en' ? current : emptyOrFromInput(input)
  }
  if (locale === 'en') {
    translations.en = current
  }
  const en = translations.en ?? current
  return { en, translations }
}

function emptyOrFromInput(input: BlogPostInput): BlogPostTranslationFields {
  return {
    title: input.title,
    excerpt: input.excerpt,
    body: input.body,
    seo_title: input.seo_title,
    seo_description: input.seo_description,
  }
}

async function upsertTranslations(
  postId: string,
  translations: BlogPostTranslations,
): Promise<void> {
  if (!useLiveCrmBackend()) return
  const supabase = getSupabase()!
  const rows = Object.entries(translations)
    .filter(([, fields]) => fields && (fields.title.trim() || fields.body.trim() || fields.excerpt.trim()))
    .map(([locale, fields]) => ({
      post_id: postId,
      locale,
      title: fields!.title,
      excerpt: fields!.excerpt,
      body: fields!.body,
      seo_title: fields!.seo_title,
      seo_description: fields!.seo_description,
    }))
  if (!rows.length) return
  const { error } = await supabase.from('blog_post_translations').upsert(rows, {
    onConflict: 'post_id,locale',
  })
  if (error) {
    if (isMissingRelation(error)) return
    throw new Error(error.message)
  }
}

export async function listBlogPosts(): Promise<BlogPost[]> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data, error } = await supabase
      .from('blog_posts')
      .select(
        'id, slug, title, excerpt, cover_image_url, status, published_at, seo_title, seo_description, author_name, tags, owner_id, created_at, updated_at',
      )
      .order('updated_at', { ascending: false })
    if (error) throw new Error(error.message)
    const posts = (data || []).map((r) => rowToPost(r as Record<string, unknown>))
    const trMap = await fetchTranslationsForPosts(posts.map((p) => p.id), false)
    return posts.map((p) => {
      const translations = trMap.get(p.id)
      const withDb = !translations
        ? { ...p, translations: { en: translationFieldsFromPost(p) } }
        : mergeTranslationsFromRows(p, Object.entries(translations).map(([locale, fields]) => ({
            locale,
            ...fields,
          })))
      return mergeCatalogTranslations(withDb)
    })
  }
  return demoRead<BlogPost[]>(DEMO_KEYS.blogPosts, [])
    .map(withDemoTranslations)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
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
    if (!data) return null
    const post = rowToPost(data as Record<string, unknown>)
    const trMap = await fetchTranslationsForPosts([id])
    const translations = trMap.get(id)
    const withDb = !translations
      ? { ...post, translations: { en: translationFieldsFromPost(post) } }
      : mergeTranslationsFromRows(
          post,
          Object.entries(translations).map(([locale, fields]) => ({ locale, ...fields })),
        )
    return mergeCatalogTranslations(withDb)
  }
  const found = demoRead<BlogPost[]>(DEMO_KEYS.blogPosts, []).find((p) => p.id === id)
  return found ? withDemoTranslations(found) : null
}

export async function createBlogPost(input: BlogPostInput): Promise<BlogPost> {
  const slug = (input.slug || slugifyTitle(input.title)).trim()
  const stamp = nowIso()
  const publishedAt =
    input.status === 'published' ? input.published_at || stamp : input.published_at || null
  const { en, translations } = resolveTranslationsForSave(input)

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const user = await getCurrentUser()
    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        slug,
        title: en.title,
        excerpt: en.excerpt,
        body: en.body,
        cover_image_url: input.cover_image_url,
        status: input.status,
        published_at: publishedAt,
        seo_title: en.seo_title,
        seo_description: en.seo_description,
        author_name: input.author_name || 'IOM',
        tags: input.tags,
        owner_id: user?.id ?? null,
      })
      .select('*')
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Create returned no row — check you are signed in to live CRM.')
    const post = rowToPost(data as Record<string, unknown>)
    await upsertTranslations(post.id, translations)
    return { ...post, translations }
  }

  const post: BlogPost = {
    id: uid(),
    slug,
    title: en.title,
    excerpt: en.excerpt,
    body: en.body,
    cover_image_url: input.cover_image_url,
    status: input.status,
    published_at: publishedAt,
    seo_title: en.seo_title,
    seo_description: en.seo_description,
    author_name: input.author_name || 'IOM',
    tags: input.tags,
    owner_id: null,
    created_at: stamp,
    updated_at: stamp,
    translations,
  }
  const all = demoRead<BlogPost[]>(DEMO_KEYS.blogPosts, [])
  demoWrite(DEMO_KEYS.blogPosts, [post, ...all])
  return post
}

export async function updateBlogPost(id: string, input: BlogPostInput): Promise<BlogPost> {
  const slug = (input.slug || slugifyTitle(input.title)).trim()
  const stamp = nowIso()
  const { en, translations } = resolveTranslationsForSave(input)

  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const existing = await getBlogPost(id)
    let publishedAt = input.published_at ?? existing?.published_at ?? null
    if (input.status === 'published' && !publishedAt) publishedAt = stamp

    const { data, error } = await supabase
      .from('blog_posts')
      .update({
        slug,
        title: en.title,
        excerpt: en.excerpt,
        body: en.body,
        cover_image_url: input.cover_image_url,
        status: input.status,
        published_at: publishedAt,
        seo_title: en.seo_title,
        seo_description: en.seo_description,
        author_name: input.author_name || 'IOM',
        tags: input.tags,
      })
      .eq('id', id)
      .select('*')
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) {
      throw new Error(
        'Update returned no row — check you are signed in to live CRM and the post still exists.',
      )
    }
    await upsertTranslations(id, translations)
    return { ...rowToPost(data as Record<string, unknown>), translations }
  }

  const all = demoRead<BlogPost[]>(DEMO_KEYS.blogPosts, [])
  const idx = all.findIndex((p) => p.id === id)
  if (idx < 0) throw new Error('Post not found')
  let publishedAt = input.published_at ?? all[idx].published_at
  if (input.status === 'published' && !publishedAt) publishedAt = stamp
  const next: BlogPost = {
    ...all[idx],
    slug,
    title: en.title,
    excerpt: en.excerpt,
    body: en.body,
    cover_image_url: input.cover_image_url,
    status: input.status,
    published_at: publishedAt,
    seo_title: en.seo_title,
    seo_description: en.seo_description,
    author_name: input.author_name || 'IOM',
    tags: input.tags,
    updated_at: stamp,
    translations: {
      ...(all[idx].translations ?? {}),
      ...translations,
    },
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

/** Quick status change without opening the full editor. Keeps published_at history. */
export async function setBlogPostStatus(id: string, status: BlogPostStatus): Promise<BlogPost> {
  const stamp = nowIso()
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { data: existing, error: loadErr } = await supabase
      .from('blog_posts')
      .select('id, published_at')
      .eq('id', id)
      .maybeSingle()
    if (loadErr) throw new Error(loadErr.message)
    if (!existing) throw new Error('Post not found')
    const currentPublished =
      typeof existing.published_at === 'string' ? existing.published_at : null
    const publishedAt =
      status === 'published' ? currentPublished || stamp : currentPublished
    const { data, error } = await supabase
      .from('blog_posts')
      .update({ status, published_at: publishedAt, updated_at: stamp })
      .eq('id', id)
      .select(
        'id, slug, title, excerpt, cover_image_url, status, published_at, seo_title, seo_description, author_name, tags, owner_id, created_at, updated_at',
      )
      .single()
    if (error) throw new Error(error.message)
    return rowToPost(data as Record<string, unknown>)
  }

  const existing = await getBlogPost(id)
  if (!existing) throw new Error('Post not found')
  let publishedAt = existing.published_at
  if (status === 'published' && !publishedAt) publishedAt = stamp

  const input: BlogPostInput = {
    slug: existing.slug,
    title: existing.title,
    excerpt: existing.excerpt,
    body: existing.body,
    cover_image_url: existing.cover_image_url,
    status,
    published_at: publishedAt,
    seo_title: existing.seo_title,
    seo_description: existing.seo_description,
    author_name: existing.author_name,
    tags: existing.tags,
    contentLocale: 'en',
    translations: existing.translations ?? { en: translationFieldsFromPost(existing) },
  }
  return updateBlogPost(id, input)
}

function catalogToInput(post: BlogPost): BlogPostInput {
  const translations = post.translations ?? { en: translationFieldsFromPost(post) }
  if (!translations.en) translations.en = translationFieldsFromPost(post)
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    body: post.body,
    cover_image_url: post.cover_image_url,
    status: 'pending_review',
    published_at: null,
    seo_title: post.seo_title,
    seo_description: post.seo_description,
    author_name: post.author_name || 'IOM',
    tags: post.tags,
    contentLocale: 'en',
    translations,
  }
}

/**
 * Insert missing catalog posts as pending_review.
 * When `updateExisting` is true (manual “Sync catalog”), also refresh body/SEO
 * for catalog slugs that already exist (keeps status + published_at).
 * Auto-import must pass `updateExisting: false` so CRM edits are not wiped.
 */
export async function importCatalogBlogPosts(opts?: {
  updateExisting?: boolean
}): Promise<{
  created: number
  skipped: number
  updated: number
}> {
  const updateExisting = opts?.updateExisting !== false
  const existing = await listBlogPosts()
  const bySlug = new Map(existing.map((p) => [p.slug, p]))
  let created = 0
  let updated = 0
  let skipped = 0
  for (const post of ALL_DEMO_BLOG_POSTS) {
    const current = bySlug.get(post.slug)
    if (current) {
      if (!updateExisting) {
        skipped++
        continue
      }
      const next = catalogToInput(post)
      await updateBlogPost(current.id, {
        ...next,
        status: current.status,
        published_at: current.published_at,
      })
      updated++
      continue
    }
    await createBlogPost(catalogToInput(post))
    bySlug.set(post.slug, post)
    created++
  }
  return { created, skipped, updated }
}

export function catalogImportMissingCount(posts: BlogPost[]): number {
  const have = new Set(posts.map((p) => p.slug))
  return ALL_DEMO_BLOG_POSTS.filter((p) => !have.has(p.slug)).length
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

export async function deleteBlogAudience(id: string): Promise<void> {
  if (useLiveCrmBackend()) {
    const supabase = getSupabase()!
    const { error } = await supabase.from('blog_audience').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return
  }
  const all = demoRead<BlogAudience[]>(DEMO_KEYS.blogAudience, [])
  demoWrite(
    DEMO_KEYS.blogAudience,
    all.filter((a) => a.id !== id),
  )
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
