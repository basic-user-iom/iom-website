/**
 * Update published 3d-viewer blog row from catalog (service role).
 * Prefer: npx vercel env run -e production -- npx tsx scripts/sync-3d-viewer-blog.mjs
 */
import { readFileSync, unlinkSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SLUG = '3d-viewer'

function loadEnvFile(path) {
  const env = {}
  if (!existsSync(path)) return env
  try {
    const raw = readFileSync(path, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!m) continue
      let value = m[2]
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (value === '[SENSITIVE]' || value === 'Encrypted') continue
      env[m[1]] = value
    }
  } catch {
    /* ignore */
  }
  return env
}

const fileEnv = {
  ...loadEnvFile(join(ROOT, '.env')),
  ...loadEnvFile(join(ROOT, '.env.vercel.tmp')),
}
const env = { ...fileEnv, ...process.env }

const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY
if (!url || !serviceKey || url === '[SENSITIVE]' || serviceKey.length < 40) {
  console.error('Missing usable Supabase URL / service role key')
  console.error('url ok?', Boolean(url && url.startsWith('http')), 'service len', (serviceKey || '').length)
  process.exit(1)
}

const { ALL_DEMO_BLOG_POSTS } = await import(
  pathToFileURL(join(ROOT, 'src/blog/posts/index.ts')).href
)

const post = ALL_DEMO_BLOG_POSTS.find((p) => p.slug === SLUG)
if (!post) {
  console.error(`${SLUG} not found in catalog`)
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: existing, error: findErr } = await supabase
  .from('blog_posts')
  .select('id,slug,status,published_at')
  .eq('slug', SLUG)
  .maybeSingle()

if (findErr) {
  console.error('Find failed:', findErr.message)
  process.exit(1)
}

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

if (existing) {
  const { error } = await supabase
    .from('blog_posts')
    .update({
      ...row,
      status: existing.status,
      published_at: post.published_at || existing.published_at,
    })
    .eq('id', existing.id)
  if (error) {
    console.error('Update failed:', error.message)
    process.exit(1)
  }
  console.log('Updated', SLUG, existing.status)
} else {
  const { error } = await supabase.from('blog_posts').insert({
    ...row,
    status: 'published',
    published_at: post.published_at || new Date().toISOString(),
  })
  if (error) {
    console.error('Insert failed:', error.message)
    process.exit(1)
  }
  console.log('Created published', SLUG)
}

console.log('has v3.19.2?', /v3\.19\.2/.test(row.body))
console.log('has Streets GL?', /Streets GL/.test(row.body))
console.log('has Setup download?', /3D-Viewer-Setup-3\.19\.2/.test(row.body))

for (const tmp of [join(ROOT, '.env.vercel.tmp')]) {
  try {
    if (existsSync(tmp)) unlinkSync(tmp)
  } catch {
    /* ignore */
  }
}
