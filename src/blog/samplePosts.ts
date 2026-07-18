import type { BlogPost } from './types'
import { ALL_DEMO_BLOG_POSTS } from './posts'

/** Shown on /blog when Supabase has no published posts (local review / empty DB). */
export const SAMPLE_PUBLISHED_POSTS: BlogPost[] = ALL_DEMO_BLOG_POSTS

export function isSampleBlogPostId(id: string): boolean {
  return id.startsWith('sample-')
}
