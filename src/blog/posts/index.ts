import type { BlogPost } from '../types'
import { GENERATED_DEMO_BLOG_POSTS } from './demoPostCatalog'
import { VOLUME_LIGHTING_BLOG_POST } from './volumeLightingPost'

/** All demo-card blog posts for local / empty-DB review. */
export const ALL_DEMO_BLOG_POSTS: BlogPost[] = [
  VOLUME_LIGHTING_BLOG_POST,
  ...GENERATED_DEMO_BLOG_POSTS,
].sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)))

export { VOLUME_LIGHTING_BLOG_POST, GENERATED_DEMO_BLOG_POSTS }
