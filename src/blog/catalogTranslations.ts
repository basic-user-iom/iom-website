import { SAMPLE_PUBLISHED_POSTS } from './samplePosts'
import {
  BLOG_CONTENT_LOCALES,
  isTranslationFilled,
  translationFieldsFromPost,
  type BlogPost,
  type BlogPostTranslations,
} from './types'

/**
 * Fill missing locales from the demo catalog pack.
 * Useful until `blog_translations_content.sql` is applied in Supabase,
 * and as a soft fallback when a locale row is empty.
 */
export function mergeCatalogTranslations(post: BlogPost): BlogPost {
  const sample = SAMPLE_PUBLISHED_POSTS.find((p) => p.slug === post.slug)
  if (!sample?.translations) {
    return {
      ...post,
      translations: post.translations ?? { en: translationFieldsFromPost(post) },
    }
  }
  const translations: BlogPostTranslations = {
    ...sample.translations,
    ...(post.translations ?? {}),
  }
  for (const locale of BLOG_CONTENT_LOCALES) {
    const db = post.translations?.[locale]
    const catalog = sample.translations[locale]
    if (isTranslationFilled(db)) {
      translations[locale] = db!
    } else if (isTranslationFilled(catalog)) {
      translations[locale] = catalog!
    }
  }
  if (!translations.en) translations.en = translationFieldsFromPost(post)
  return { ...post, translations }
}
