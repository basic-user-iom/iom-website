import type { BlogPost } from './types'

/** Shown on /blog when Supabase has no published posts (local review / empty DB). */
export const SAMPLE_PUBLISHED_POSTS: BlogPost[] = [
  {
    id: 'sample-blog-360-showrooms',
    slug: 'browser-360-showrooms-that-convert',
    title: 'Browser 360° showrooms that convert',
    excerpt:
      'How immersive panoramas turn trade-booth curiosity into qualified leads — without an app install.',
    body: `# Browser 360° showrooms that convert

Trade visitors remember experiences. A guided [360° panorama](/demos/panorama-360/) lets them walk a booth, product line, or venue from any device.

## What works

- Clear **call-to-action** hotspots that open contact or brochure links
- Short narration or captions — not a wall of text
- Fast loads on mid-range phones

## Internal next steps

Explore our [interactive work](/#interactive) or [get in touch](/#contact) if you want a showroom scoped for your next event.`,
    cover_image_url: '',
    status: 'published',
    published_at: '2026-07-12T11:00:00.000Z',
    seo_title: 'Browser 360° showrooms that convert — IOM',
    seo_description:
      'Immersive panorama showrooms for trade events: guided tours, lead capture, and WebGL delivery without apps.',
    author_name: 'IOM',
    tags: ['360', 'showroom', 'lead capture'],
    owner_id: null,
    created_at: '2026-07-11T09:00:00.000Z',
    updated_at: '2026-07-12T11:00:00.000Z',
  },
  {
    id: 'sample-blog-case-copper',
    slug: 'case-study-guided-museum-companion',
    title: 'Case study: guided museum companion',
    excerpt:
      'How a spatial web companion helped extend museum visits beyond the gallery floor.',
    body: `## The brief

A museum partner needed a **browser companion** visitors could open on their phones — waypoints, short stories, and a calm visual language.

## What we shipped

- Photogrammetry-backed spaces previewed in WebGL
- A lightweight path UI inspired by our [raven path](/demos/raven-path/) experiments
- Analytics hooks so the team could see which stops held attention

See more [immersive projects](/#immersive) or [contact IOM](/#contact).`,
    cover_image_url: '',
    status: 'published',
    published_at: '2026-07-05T15:00:00.000Z',
    seo_title: 'Case study: guided museum companion — IOM',
    seo_description:
      'How a browser-based guided companion extended museum visits with spatial storytelling and WebGL.',
    author_name: 'IOM',
    tags: ['case study', 'museum', 'WebGL'],
    owner_id: null,
    created_at: '2026-07-03T10:00:00.000Z',
    updated_at: '2026-07-05T15:00:00.000Z',
  },
]

export function isSampleBlogPostId(id: string): boolean {
  return id.startsWith('sample-')
}
