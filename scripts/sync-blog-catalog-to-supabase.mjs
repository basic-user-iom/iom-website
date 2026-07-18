/**
 * Push ALL_DEMO_BLOG_POSTS into live Supabase blog_posts (update by slug / insert).
 * Usage: node --experimental-strip-types scripts/sync-blog-catalog-to-supabase.mjs
 * Or:   npx tsx scripts/sync-blog-catalog-to-supabase.mjs
 *
 * Needs .env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 * and CRM_SYNC_EMAIL / CRM_SYNC_PASSWORD (staff login) or prompts via env.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function loadEnv() {
  const env = {}
  try {
    const raw = readFileSync(join(ROOT, '.env'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!m) continue
      env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  } catch {
    /* ignore */
  }
  return env
}

const env = { ...loadEnv(), ...process.env }
const url = env.VITE_SUPABASE_URL
const anon = env.VITE_SUPABASE_ANON_KEY
const email = env.CRM_SYNC_EMAIL || env.IOM_CRM_EMAIL
const password = env.CRM_SYNC_PASSWORD || env.IOM_CRM_PASSWORD

if (!url || !anon) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}
if (!email || !password) {
  console.error('Set CRM_SYNC_EMAIL and CRM_SYNC_PASSWORD (staff account) to sync.')
  process.exit(1)
}

const { ALL_DEMO_BLOG_POSTS } = await import(
  pathToFileURL(join(ROOT, 'src/blog/posts/index.ts')).href
)

const supabase = createClient(url, anon)
const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email,
  password,
})
if (authErr) {
  console.error('Auth failed:', authErr.message)
  process.exit(1)
}
console.log('Signed in as', auth.user?.email)

const { data: existing, error: listErr } = await supabase
  .from('blog_posts')
  .select('id,slug,status,published_at,cover_image_url,updated_at')
  .order('updated_at', { ascending: false })
if (listErr) {
  console.error('List failed:', listErr.message)
  process.exit(1)
}

const bySlug = new Map((existing || []).map((r) => [r.slug, r]))
let created = 0
let updated = 0
let failed = 0

for (const post of ALL_DEMO_BLOG_POSTS) {
  const cur = bySlug.get(post.slug)
  const row = {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    body: post.body,
    cover_image_url: post.cover_image_url,
    seo_title: post.seo_title,
    seo_description: post.seo_description,
    author_name: post.author_name || 'IOM',
    tags: post.tags || [],
  }
  if (cur) {
    const { error } = await supabase
      .from('blog_posts')
      .update({
        ...row,
        status: cur.status,
        published_at: cur.published_at,
      })
      .eq('id', cur.id)
    if (error) {
      console.error('UPDATE FAIL', post.slug, error.message)
      failed++
    } else {
      console.log('updated', post.slug, '→', post.cover_image_url)
      updated++
    }
  } else {
    const { error } = await supabase.from('blog_posts').insert({
      ...row,
      status: 'pending_review',
      published_at: null,
      owner_id: auth.user.id,
    })
    if (error) {
      console.error('INSERT FAIL', post.slug, error.message)
      failed++
    } else {
      console.log('created', post.slug)
      created++
    }
  }
}

console.log({ created, updated, failed, catalog: ALL_DEMO_BLOG_POSTS.length })
if (failed) process.exit(1)

const { data: spout } = await supabase
  .from('blog_posts')
  .select('slug,cover_image_url,excerpt')
  .eq('slug', 'spout')
  .maybeSingle()
console.log('spout check:', spout)
