import type { BlogPost } from './types'
import { SOLAR_SYSTEM_BLOG_POST } from './posts/solarSystemPost'

/** Explicit publications, not the wider sample/demo fallback catalog. */
export const SITE_PUBLISHED_POSTS: readonly BlogPost[] = [SOLAR_SYSTEM_BLOG_POST]

export function mergeSitePublishedPosts(databasePosts: BlogPost[]): BlogPost[] {
  const databaseSlugs = new Set(databasePosts.map(post => post.slug))
  return [
    ...databasePosts,
    ...SITE_PUBLISHED_POSTS.filter(post => !databaseSlugs.has(post.slug)),
  ].sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)))
}

export function isSitePublishedPost(post: BlogPost): boolean {
  return SITE_PUBLISHED_POSTS.some(item => item.id === post.id)
}
