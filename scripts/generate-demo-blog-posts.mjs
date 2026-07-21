/**
 * Merge editorial overrides → src/blog/posts/demoPostCatalog.ts
 * Usage: node scripts/generate-demo-blog-posts.mjs
 */
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEMO_BLOG_OVERRIDES } from './lib/demo-blog-overrides.mjs'
import { DEMO_BLOG_OVERRIDES_EXPERIMENTS } from './lib/demo-blog-overrides-experiments.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '..', 'src', 'blog', 'posts', 'demoPostCatalog.ts')

const OVERRIDES = { ...DEMO_BLOG_OVERRIDES, ...DEMO_BLOG_OVERRIDES_EXPERIMENTS }

/** section + fallback url/tags when override omits them */
const META = {
  '3d-viewer': { section: 'software', url: 'https://3dbviewer.com/', tags: ['software', 'three.js', 'product', 'hdr', 'osm'] },
  'streets-gl-bridge': { section: 'software', url: '/demos/streets-gl/', tags: ['software', 'maps', 'osm'] },
  'panorama-360-tour': { section: 'software', url: '/demos/panorama-360/', tags: ['software', '360', 'webgpu'] },
  'crm-demo': { section: 'software', url: '/crm-demo', tags: ['software', 'crm'] },
  'image-prep': { section: 'software', url: '/tools/image-prep', tags: ['software', 'photos'] },
  'raven-path': { section: '3d', url: '/demos/raven-path/', tags: ['3d', 'animation', 'three.js', 'import', 'export'] },
  'artist-globe': { section: '3d', url: '/artist-globe', tags: ['3d', 'webgl', 'globe'] },
  'ssr-denoise': { section: '3d', url: '/demos/ssr-denoise/', tags: ['3d', 'webgpu', 'ssr'] },
  'iom-three': { section: '3d', url: '/demos/dreams-iom/', tags: ['3d', 'webgl', 'narrative'] },
  'threejs-ocean': { section: '3d', url: '/demos/ocean/', tags: ['3d', 'webgl', 'ocean'] },
  'panorama-suite': {
    section: '360',
    url: '/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6',
    tags: ['360', 'tour', 'webgpu'],
  },
  'css3d-sprites': { section: 'experiments', url: '/demos/css3d-sprites/', tags: ['experiments', 'css3d'] },
  'compute-particles': { section: 'experiments', url: '/demos/compute-particles/', tags: ['experiments', 'webgpu'] },
  'webgpu-spotlight': { section: 'experiments', url: '/demos/webgpu-spotlight/', tags: ['experiments', 'webgpu'] },
  'webgpu-compute-birds': {
    section: 'experiments',
    url: '/demos/webgpu-compute-birds/',
    tags: ['experiments', 'webgpu'],
  },
  'webgpu-parallax-uv': {
    section: 'experiments',
    url: '/demos/webgpu-parallax-uv/',
    tags: ['experiments', 'webgpu'],
  },
  'webgpu-tsl-raging-sea': {
    section: 'experiments',
    url: '/demos/webgpu-tsl-raging-sea/',
    tags: ['experiments', 'webgpu', 'tsl'],
  },
  'webgpu-tsl-linked-particles': {
    section: 'experiments',
    url: '/demos/webgpu-tsl-linked-particles/',
    tags: ['experiments', 'webgpu', 'tsl'],
  },
  'webgpu-custom-fog-scattering': {
    section: 'experiments',
    url: '/demos/webgpu-custom-fog-scattering/',
    tags: ['experiments', 'webgpu'],
  },
  'webgpu-modifier-curve': {
    section: 'experiments',
    url: '/demos/webgpu-modifier-curve/',
    tags: ['experiments', 'webgpu'],
  },
  'webgpu-particles': { section: 'experiments', url: '/demos/webgpu-particles/', tags: ['experiments', 'webgpu'] },
  'buffergeometry-drawrange': {
    section: 'experiments',
    url: '/demos/buffergeometry-drawrange/',
    tags: ['experiments', 'webgl'],
  },
  'spline-editor': { section: 'experiments', url: '/demos/spline-editor/', tags: ['experiments', 'webgl'] },
  'terrain-sandbox': { section: 'experiments', url: '/demos/terrain-sandbox/', tags: ['experiments', 'webgl'] },
  'procedural-gl': { section: 'experiments', url: '/demos/procedural-gl/', tags: ['experiments', 'terrain'] },
  spout: { section: 'experiments', url: '/demos/spout/', tags: ['experiments', 'shader'] },
}

function esc(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
}

function emitSpec(id, o, meta) {
  const cardTitle = o.cardTitle || String(o.pageTitle).split('—')[0].trim()
  const demoUrl = o.demoUrl || meta.url
  const tags = o.tags || meta.tags
  const excerpt = o.excerpt || o.hook.slice(0, 180)
  const seo_title = o.seo_title || `${o.pageTitle} — IOM`
  const seo_description = o.seo_description || excerpt

  return `  {
    id: '${id}',
    slug: '${id}',
    title: ${JSON.stringify(cardTitle)},
    pageTitle: ${JSON.stringify(o.pageTitle)},
    section: '${meta.section}',
    tags: ${JSON.stringify(tags)},
    excerpt: ${JSON.stringify(excerpt)},
    seo_title: ${JSON.stringify(seo_title)},
    seo_description: ${JSON.stringify(seo_description)},
    demoUrl: ${JSON.stringify(demoUrl)},
    demoLabel: ${JSON.stringify(o.demoLabel)},
${o.heroRecordingSlug ? `    heroRecordingSlug: ${JSON.stringify(o.heroRecordingSlug)},\n` : ''}    hook: \`${esc(o.hook)}\`,
    coverNote: ${JSON.stringify(o.coverNote)},
${o.whatYouSeeIntro ? `    whatYouSeeIntro: ${JSON.stringify(o.whatYouSeeIntro)},\n` : ''}    whyBullets: ${JSON.stringify(o.whyBullets)},
    whyUses: ${JSON.stringify(o.whyUses)},
    beginner: \`${esc(o.beginner)}\`,
    glossary: ${JSON.stringify(o.glossary)},
    trySteps: ${JSON.stringify(o.trySteps)},
    requirements: ${JSON.stringify(o.requirements)},
    viewA: ${JSON.stringify(o.viewA)},
    viewB: ${JSON.stringify(o.viewB)},
${o.viewC ? `    viewC: ${JSON.stringify(o.viewC)},\n` : ''}    alsoCan: ${JSON.stringify(o.alsoCan)},
    howWorks: \`${esc(o.howWorks)}\`,
${
  o.tourBridge
    ? `    tourBridge: ${JSON.stringify(o.tourBridge)},\n`
    : ''
}    faq: ${JSON.stringify(o.faq)},
    reading: ${JSON.stringify(o.reading)},
    related: ${JSON.stringify(o.related)},
  }`
}

async function main() {
  const specs = []
  const missingMeta = []

  for (const id of Object.keys(OVERRIDES)) {
    const meta = META[id]
    if (!meta) {
      missingMeta.push(id)
      continue
    }
    specs.push(emitSpec(id, OVERRIDES[id], meta))
  }

  const file = `/* Auto-generated by scripts/generate-demo-blog-posts.mjs — edit scripts/lib/demo-blog-overrides*.mjs */
import type { DemoPostSpec } from './demoPostBuilder'
import { buildDemoBlogPost } from './demoPostBuilder'
import type { BlogPost } from '../types'

export const DEMO_POST_SPECS: DemoPostSpec[] = [
${specs.join(',\n')}
]

export const GENERATED_DEMO_BLOG_POSTS: BlogPost[] = DEMO_POST_SPECS.map(buildDemoBlogPost)
`

  await writeFile(outPath, file, 'utf8')
  console.log(`Wrote ${specs.length} specs → ${outPath}`)
  if (missingMeta.length) {
    console.error('Missing META for', missingMeta.join(', '))
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
