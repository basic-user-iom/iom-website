/**
 * Curated useful links for the CRM Links tab.
 * Categories = format (stable). Tags = topic (flexible). Keep a short “why” note on every entry.
 */
export type LinkCategory = 'youtube' | 'webpage' | 'forum' | 'blog'

export type UsefulLink = {
  id: string
  title: string
  url: string
  /** Format bucket — YouTube, webpage, forum, blog post */
  category: LinkCategory
  /** One short line: why this link is worth keeping */
  note: string
  /** Optional topic tags for search / later filtering */
  tags?: string[]
}

export const LINK_CATEGORIES: LinkCategory[] = [
  'youtube',
  'webpage',
  'forum',
  'blog',
]

/** Staff CRM — real shared library (edit here to add entries). */
export const USEFUL_LINKS: UsefulLink[] = [
  {
    id: 'ai-search-youtube',
    title: 'AI Search',
    url: 'https://www.youtube.com/@theAIsearch/videos',
    category: 'youtube',
    note: 'AI tools and product walkthroughs — good scan channel for new search / agent workflows.',
    tags: ['ai', 'tools'],
  },
  {
    id: 'threejs-docs',
    title: 'three.js docs',
    url: 'https://threejs.org/docs/',
    category: 'webpage',
    note: 'Official API reference — first stop for renderer, materials, loaders, and TSL nodes.',
    tags: ['threejs', 'docs'],
  },
  {
    id: 'threejs-examples',
    title: 'three.js examples',
    url: 'https://threejs.org/examples/',
    category: 'webpage',
    note: 'Live demos + source — fastest way to steal a working WebGL / WebGPU setup.',
    tags: ['threejs', 'webgpu'],
  },
  {
    id: 'threejs-webgpu-manual',
    title: 'WebGPURenderer manual',
    url: 'https://threejs.org/manual/en/webgpurenderer.html',
    category: 'webpage',
    note: 'Official guide to WebGPURenderer — how three.js targets WebGPU with WebGL 2 fallback.',
    tags: ['threejs', 'webgpu'],
  },
  {
    id: 'mdn-webgpu',
    title: 'MDN — WebGPU API',
    url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API',
    category: 'webpage',
    note: 'Browser-level WebGPU reference when you need to go below three.js abstractions.',
    tags: ['webgpu', 'docs'],
  },
  {
    id: 'threejs-discourse',
    title: 'three.js forum',
    url: 'https://discourse.threejs.org/',
    category: 'forum',
    note: 'Main community Q&A — shaders, performance, loaders, and WebGPU migration threads.',
    tags: ['threejs', 'community'],
  },
  {
    id: 'threejs-webgpu-tsl-intro',
    title: 'Intro to WebGPU and TSL',
    url: 'https://discourse.threejs.org/t/three-js-introduction-to-webgpu-and-tsl/78205',
    category: 'forum',
    note: 'Forum resource thread on TSL + WebGPU, with maintainer clarifications.',
    tags: ['threejs', 'webgpu', 'tsl'],
  },
  {
    id: 'utsubo-webgpu-migration',
    title: 'WebGPU + three.js migration checklist',
    url: 'https://www.utsubo.com/blog/webgpu-threejs-migration-guide',
    category: 'blog',
    note: '2026 migration checklist — renderer swap, TSL, R3F notes, and common failure modes.',
    tags: ['threejs', 'webgpu'],
  },
]

/**
 * Public CRM demo — sample library so visitors can try filters/search.
 * Uses public URLs; notes read as sample bookmarks (not the live staff list).
 */
export const DEMO_USEFUL_LINKS: UsefulLink[] = [
  {
    id: 'demo-ai-search',
    title: 'AI Search',
    url: 'https://www.youtube.com/@theAIsearch/videos',
    category: 'youtube',
    note: 'Sample YouTube bookmark — AI tools channel for scanning new product walkthroughs.',
    tags: ['ai', 'tools', 'sample'],
  },
  {
    id: 'demo-threejs-docs',
    title: 'three.js docs',
    url: 'https://threejs.org/docs/',
    category: 'webpage',
    note: 'Sample webpage — official API docs (renderer, materials, loaders, TSL).',
    tags: ['threejs', 'docs', 'sample'],
  },
  {
    id: 'demo-threejs-examples',
    title: 'three.js examples',
    url: 'https://threejs.org/examples/',
    category: 'webpage',
    note: 'Sample webpage — live demos with source for WebGL / WebGPU patterns.',
    tags: ['threejs', 'webgpu', 'sample'],
  },
  {
    id: 'demo-mdn-webgpu',
    title: 'MDN — WebGPU API',
    url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API',
    category: 'webpage',
    note: 'Sample webpage — browser WebGPU reference below the three.js layer.',
    tags: ['webgpu', 'docs', 'sample'],
  },
  {
    id: 'demo-threejs-forum',
    title: 'three.js forum',
    url: 'https://discourse.threejs.org/',
    category: 'forum',
    note: 'Sample forum — community Q&A for shaders, performance, and migrations.',
    tags: ['threejs', 'community', 'sample'],
  },
  {
    id: 'demo-tsl-thread',
    title: 'Intro to WebGPU and TSL',
    url: 'https://discourse.threejs.org/t/three-js-introduction-to-webgpu-and-tsl/78205',
    category: 'forum',
    note: 'Sample forum thread — TSL + WebGPU with maintainer clarifications.',
    tags: ['threejs', 'webgpu', 'tsl', 'sample'],
  },
  {
    id: 'demo-migration-blog',
    title: 'WebGPU + three.js migration checklist',
    url: 'https://www.utsubo.com/blog/webgpu-threejs-migration-guide',
    category: 'blog',
    note: 'Sample blog post — 2026 migration checklist and common failure modes.',
    tags: ['threejs', 'webgpu', 'sample'],
  },
]

export function usefulLinksForMode(demo: boolean): UsefulLink[] {
  return demo ? DEMO_USEFUL_LINKS : USEFUL_LINKS
}
