import type { BlogContentLocale, BlogPost, BlogPostTranslationFields } from '../types'
import metadata from './solar-system/metadata.json'
import en from './solar-system/en.md?raw'
import de from './solar-system/de.md?raw'
import fr from './solar-system/fr.md?raw'
import nl from './solar-system/nl.md?raw'
import it from './solar-system/it.md?raw'
import es from './solar-system/es.md?raw'

const bodies = { en, de, fr, nl, it, es }
const translations = Object.fromEntries(
  (Object.keys(bodies) as BlogContentLocale[]).map(locale => [
    locale, { ...metadata.locales[locale], body: bodies[locale].trim() },
  ]),
) as Record<BlogContentLocale, BlogPostTranslationFields>

/** Published editorial maintained alongside the demo; CMS posts keep precedence. */
export const SOLAR_SYSTEM_BLOG_POST: BlogPost = {
  id: metadata.id,
  slug: metadata.slug,
  ...translations.en,
  cover_image_url: metadata.cover_image_url,
  status: 'published',
  published_at: metadata.published_at,
  created_at: metadata.published_at,
  updated_at: metadata.published_at,
  author_name: metadata.author_name,
  tags: metadata.tags,
  owner_id: null,
  translations,
}
