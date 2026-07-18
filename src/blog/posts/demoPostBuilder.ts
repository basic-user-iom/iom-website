import type { BlogPost } from '../types'

export type DemoSection = 'software' | '3d' | '360' | 'experiments'

export type DemoPostSpec = {
  id: string
  slug: string
  /** Card / product name used in body */
  title: string
  /** Article title shown on /blog */
  pageTitle: string
  section: DemoSection
  tags: string[]
  excerpt: string
  seo_title: string
  seo_description: string
  demoUrl: string
  demoLabel: string
  hook: string
  coverNote: string
  whyBullets: string[]
  whyUses: string
  beginner: string
  glossary: { term: string; def: string }[]
  trySteps: string[]
  requirements: string[]
  viewA: { file: string; caption: string }
  viewB: { file: string; caption: string }
  /** Optional third in-body still (e.g. guided-tour step 4). */
  viewC?: { file: string; caption: string }
  alsoCan: string[]
  howWorks: string
  /**
   * Optional bridge to /demos/panorama-360/ guided-tour steps
   * (particles = 2, spout = 3, birds = 4). Image lives at tour-bridge.jpg.
   */
  tourBridge?: {
    step: 2 | 3 | 4
    stepLabel: string
    body: string
  }
  faq: { q: string; a: string }[]
  reading: { label: string; url: string }[]
  related: { label: string; url: string }[]
  published_at?: string
}

const SECTION_ANCHOR: Record<DemoSection, string> = {
  software: '/#software',
  '3d': '/#3d',
  '360': '/#360',
  experiments: '/#experiments',
}

const SECTION_LABEL: Record<DemoSection, string> = {
  software: 'Software',
  '3d': '3D',
  '360': '360 Tours',
  experiments: 'Experiments',
}

/**
 * Bump when recapturing blog stills. Vercel serves /assets/* with
 * max-age=1y immutable — same path keeps old bytes in the browser.
 */
export const BLOG_ASSET_CACHE_V = '20260719g'

export function buildDemoBlogPost(spec: DemoPostSpec): BlogPost {
  const sectionLink = SECTION_ANCHOR[spec.section]
  const sectionLabel = SECTION_LABEL[spec.section]
  const asset = (file: string) => `/assets/blog/${spec.id}/${file}?v=${BLOG_ASSET_CACHE_V}`

  const asBullet = (s: string) => {
    const t = String(s).trim()
    return t.startsWith('-') ? t : `- ${t}`
  }
  const glossary = spec.glossary.map((g) => `- **${g.term}** — ${g.def}`).join('\n')
  const why = spec.whyBullets.map(asBullet).join('\n')
  const trySteps = spec.trySteps.map((s, i) => `${i + 1}. ${s}`).join('\n')
  const requirements = spec.requirements.map(asBullet).join('\n')
  const also = spec.alsoCan.map(asBullet).join('\n')
  const faq = spec.faq.map((f) => `**${f.q}**  \n${f.a}`).join('\n\n')
  const reading = spec.reading.map((l) => `- [${l.label}](${l.url})`).join('\n')
  const related = spec.related.map((l) => `[${l.label}](${l.url})`).join(', ')
  const whatYouSeeIntro = spec.viewC
    ? 'The cover is guided-tour step 1; the stills below continue the same Black Witness walkthrough:'
    : 'Two more angles from the same experience. The cover image is the first view; these continue the walkthrough:'
  const viewCBlock = spec.viewC
    ? `\n![${spec.viewC.caption}](${asset(spec.viewC.file)})\n`
    : ''

  const body = `${spec.hook}

It lives in our [${sectionLabel} section](${sectionLink}) as **${spec.title}**. ${spec.coverNote}

## Open the live demo

**[→ Launch ${spec.demoLabel}](${spec.demoUrl})**

No install required for the in-browser builds. If a feature needs a newer GPU API, the page will say so instead of failing silently.
${
  spec.tourBridge
    ? `
## Also in the 360° guided tour

${spec.tourBridge.body}

![${spec.tourBridge.stepLabel}](${asset('tour-bridge.jpg')})

**[→ Open Panorama 360](https://iobjectm.com/demos/panorama-360/)** — click **Play guided tour**, then jump to Step ${spec.tourBridge.step} in the editor STEPS list (or watch the sequence in [visitor preview](https://iobjectm.com/demos/panorama-360/?mode=preview)).
`
    : ''
}
## Why this matters (even if you are not a developer)

${why}

Typical uses: ${spec.whyUses}

## For beginners — what is this, in plain words?

${spec.beginner}

**Quick glossary**

${glossary}

## Try this in about 60 seconds

${trySteps}

## Requirements and performance

${requirements}

## What you see

${whatYouSeeIntro}

![${spec.viewA.caption}](${asset(spec.viewA.file)})

![${spec.viewB.caption}](${asset(spec.viewB.file)})
${viewCBlock}
Also in this build:

${also}

## How it works

${spec.howWorks}

## FAQ

${faq}

## Tech stack and further reading

${reading}

## Related on IOM

Browse more in [${sectionLabel}](${sectionLink})${related ? `, plus ${related}` : ''}, or [contact us](/#contact) if you want something like this scoped for a client pitch.`

  const published = spec.published_at || '2026-07-18T14:00:00.000Z'

  return {
    id: `sample-blog-${spec.id}`,
    slug: spec.slug,
    title: spec.pageTitle,
    excerpt: spec.excerpt,
    body,
    cover_image_url: asset('cover.jpg'),
    status: 'published',
    published_at: published,
    seo_title: spec.seo_title,
    seo_description: spec.seo_description,
    author_name: 'IOM',
    tags: spec.tags,
    owner_id: null,
    created_at: '2026-07-18T12:00:00.000Z',
    updated_at: published,
  }
}
