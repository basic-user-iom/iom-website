/**
 * Write scripts/data/3d-viewer-blog-payload.json from the demo catalog.
 * Run after blog:generate-posts when 3d-viewer editorial changes.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_DEMO_BLOG_POSTS } from '../src/blog/posts/index.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, 'data')
const outPath = join(outDir, '3d-viewer-blog-payload.json')

const post = ALL_DEMO_BLOG_POSTS.find((p) => p.slug === '3d-viewer')
if (!post) {
  console.error('3d-viewer not found in catalog')
  process.exit(1)
}

const payload = {
  slug: post.slug,
  title: post.title,
  excerpt: post.excerpt,
  body: post.body,
  cover_image_url: post.cover_image_url,
  seo_title: post.seo_title,
  seo_description: post.seo_description,
  author_name: post.author_name || 'IOM',
  tags: post.tags || [],
  published_at: post.published_at,
}

mkdirSync(outDir, { recursive: true })
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`)
console.log('Wrote', outPath)
console.log(payload.seo_title)
console.log('has v3.19.2?', /v3\.19\.2/.test(payload.body))
