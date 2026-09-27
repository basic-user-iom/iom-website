import type { BlogContentLocale, BlogPost, BlogPostTranslationFields } from '../types'
import metadata from './robot-cell/metadata.json'
import en from './robot-cell/en.md?raw'
import de from './robot-cell/de.md?raw'
import fr from './robot-cell/fr.md?raw'
import nl from './robot-cell/nl.md?raw'
import it from './robot-cell/it.md?raw'
import es from './robot-cell/es.md?raw'

const bodies = { en, de, fr, nl, it, es }
const translations = Object.fromEntries(
  (Object.keys(bodies) as BlogContentLocale[]).map(locale => [
    locale, { ...metadata.locales[locale], body: bodies[locale].trim() },
  ]),
) as Record<BlogContentLocale, BlogPostTranslationFields>

/** Published editorial maintained alongside the demo; CMS posts keep precedence. */
export const ROBOT_CELL_BLOG_POST: BlogPost = {
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
