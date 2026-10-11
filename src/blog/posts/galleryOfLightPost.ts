import type { BlogContentLocale, BlogPost, BlogPostTranslationFields } from '../types'
import metadata from './gallery-of-light/metadata.json'
import en from './gallery-of-light/en.md?raw'
import de from './gallery-of-light/de.md?raw'
import fr from './gallery-of-light/fr.md?raw'
import nl from './gallery-of-light/nl.md?raw'
import it from './gallery-of-light/it.md?raw'
import es from './gallery-of-light/es.md?raw'

const bodies = { en, de, fr, nl, it, es }
const translations = Object.fromEntries(
  (Object.keys(bodies) as BlogContentLocale[]).map(locale => [
    locale, { ...metadata.locales[locale], body: bodies[locale].trim() },
  ]),
) as Record<BlogContentLocale, BlogPostTranslationFields>

/** Published editorial maintained alongside the demo; CMS posts keep precedence. */
export const GALLERY_OF_LIGHT_BLOG_POST: BlogPost = {
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
