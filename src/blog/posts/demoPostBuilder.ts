import type { BlogContentLocale, BlogPost, BlogPostTranslations } from '../types'
import { translationFieldsFromPost } from '../types'
import { BLOG_BUILDER_CHROME } from './locales/chrome'
import type { DemoPostLocaleOverlay, DemoPostLocalePack } from './locales/types'

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
  /** Override the default “What you see” intro above viewA/viewB. */
  whatYouSeeIntro?: string
  /**
   * Optional local blog video (under /assets/blog/<id>/). Prefer this over
   * heroRecordingSlug for public posts — avoids multi‑10MB /r/ embeds.
   */
  heroVideoFile?: string
  heroVideoCaption?: string
  /**
   * CRM recording share slug — rendered as an iframe embed at the top of the
   * body (replaces the cover image when set).
   */
  heroRecordingSlug?: string
  alsoCan: string[]
  howWorks: string
  /**
   * Optional release / changelog block rendered after “How it works”.
   * Prefer short, user-facing bullets — not marketing fluff.
   */
  whatsNew?: {
    heading: string
    body: string
  }
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

/**
 * Bump when recapturing blog stills. Vercel serves /assets/* with
 * max-age=1y immutable — same path keeps old bytes in the browser.
 */
export const BLOG_ASSET_CACHE_V = '20260722a'

export function mergeDemoPostOverlay(
  base: DemoPostSpec,
  overlay?: DemoPostLocaleOverlay | null,
): DemoPostSpec {
  if (!overlay) return base
  const merged: DemoPostSpec = {
    ...base,
    ...overlay,
    viewA: { ...base.viewA, ...(overlay.viewA ?? {}) },
    viewB: { ...base.viewB, ...(overlay.viewB ?? {}) },
    viewC:
      base.viewC || overlay.viewC
        ? { ...(base.viewC ?? { file: 'view-c.jpg', caption: '' }), ...(overlay.viewC ?? {}) }
        : undefined,
    whatsNew:
      overlay.whatsNew || base.whatsNew
        ? { ...(base.whatsNew ?? { heading: '', body: '' }), ...(overlay.whatsNew ?? {}) }
        : undefined,
    tourBridge:
      overlay.tourBridge || base.tourBridge
        ? {
            ...(base.tourBridge ?? { step: 2 as const, stepLabel: '', body: '' }),
            ...(overlay.tourBridge ?? {}),
          }
        : undefined,
    glossary: overlay.glossary ?? base.glossary,
    whyBullets: overlay.whyBullets ?? base.whyBullets,
    trySteps: overlay.trySteps ?? base.trySteps,
    requirements: overlay.requirements ?? base.requirements,
    alsoCan: overlay.alsoCan ?? base.alsoCan,
    faq: overlay.faq ?? base.faq,
    reading: overlay.reading ?? base.reading,
    related: overlay.related ?? base.related,
  }

  // EN catalog often omits excerpt (falls back to hook.slice). Locale overlays usually
  // omit it too — without this, spread keeps the English excerpt on list cards.
  if (overlay.excerpt === undefined) {
    const fromSeo = overlay.seo_description?.trim()
    const fromHook = (overlay.hook ?? merged.hook ?? '').trim()
    merged.excerpt = (fromSeo || fromHook).slice(0, 180)
  }
  if (overlay.seo_description === undefined) {
    merged.seo_description = merged.excerpt
  }
  if (overlay.seo_title === undefined && merged.pageTitle) {
    merged.seo_title = `${merged.pageTitle} — IOM`
  }

  return merged
}

export function buildDemoBlogPost(
  spec: DemoPostSpec,
  locale: BlogContentLocale = 'en',
): BlogPost {
  const chrome = BLOG_BUILDER_CHROME[locale] ?? BLOG_BUILDER_CHROME.en
  const sectionLink = SECTION_ANCHOR[spec.section]
  const sectionLabel = chrome.sectionLabel[spec.section]
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
  const hasHeroVideo = Boolean(spec.heroVideoFile?.trim())
  const hasHeroRecording = !hasHeroVideo && Boolean(spec.heroRecordingSlug?.trim())
  const whatYouSeeIntro =
    spec.whatYouSeeIntro?.trim() ||
    (spec.viewC ? chrome.whatYouSeeTour : chrome.whatYouSeeDefault)
  const viewCBlock = spec.viewC
    ? `\n![${spec.viewC.caption}](${asset(spec.viewC.file)})\n`
    : ''
  const heroVideoBlock = hasHeroVideo
    ? `![${(spec.heroVideoCaption || 'Walkthrough').trim()}](${asset(spec.heroVideoFile!.trim())})\n\n`
    : ''
  const heroRecordingBlock = hasHeroRecording
    ? `/r/${spec.heroRecordingSlug!.trim()}?embed=1\n\n`
    : ''

  const tourBridgeBlock = spec.tourBridge
    ? `
${chrome.tourBridgeHeading}

${spec.tourBridge.body}

![${spec.tourBridge.stepLabel}](${asset('tour-bridge.jpg')})

${chrome.openPanorama}(https://iobjectm.com/demos/panorama-360/)** — **${chrome.playGuidedTour}**, Step ${spec.tourBridge.step} ([${chrome.visitorPreview}](https://iobjectm.com/demos/panorama-360/?mode=preview)).
`
    : ''

  const body = `${heroVideoBlock}${heroRecordingBlock}${spec.hook}

${chrome.livesIn(sectionLabel, sectionLink, spec.title)} ${spec.coverNote}

${chrome.openDemoHeading}

${chrome.launch(spec.demoLabel)}(${spec.demoUrl})**

${chrome.noInstall}
${tourBridgeBlock}
${chrome.whyHeading}

${why}

${chrome.typicalUses} ${spec.whyUses}

${chrome.beginnerHeading}

${spec.beginner}

${chrome.glossaryHeading}

${glossary}

${chrome.tryHeading}

${trySteps}

${chrome.requirementsHeading}

${requirements}

${chrome.whatYouSeeHeading}

${whatYouSeeIntro}

![${spec.viewA.caption}](${asset(spec.viewA.file)})

![${spec.viewB.caption}](${asset(spec.viewB.file)})
${viewCBlock}
${chrome.alsoInBuild}

${also}

${chrome.howWorksHeading}

${spec.howWorks}
${
  spec.whatsNew?.heading && spec.whatsNew?.body
    ? `
## ${spec.whatsNew.heading}

${spec.whatsNew.body}
`
    : ''
}
${chrome.faqHeading}

${faq}

${chrome.readingHeading}

${reading}

${chrome.relatedHeading}

${chrome.relatedBrowse(sectionLabel, sectionLink, related)}`

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

const CONTENT_LOCALES: BlogContentLocale[] = ['de', 'fr', 'nl', 'it', 'es']

/** Build EN post plus translated bodies from locale overlay packs. */
export function buildDemoBlogPostWithTranslations(
  spec: DemoPostSpec,
  packs: Partial<Record<BlogContentLocale, DemoPostLocalePack>>,
): BlogPost {
  const enPost = buildDemoBlogPost(spec, 'en')
  const translations: BlogPostTranslations = {
    en: translationFieldsFromPost(enPost),
  }

  for (const locale of CONTENT_LOCALES) {
    const overlay = packs[locale]?.[spec.id]
    if (!overlay) continue
    const localized = buildDemoBlogPost(mergeDemoPostOverlay(spec, overlay), locale)
    translations[locale] = translationFieldsFromPost(localized)
  }

  return { ...enPost, translations }
}
