-- Widen blog_posts.status for CRM review workflow:
-- pending_review | draft | published | hidden
-- Anon RLS stays published-only (unchanged).

alter table public.blog_posts
  drop constraint if exists blog_posts_status_check;

alter table public.blog_posts
  add constraint blog_posts_status_check
  check (status in ('draft', 'pending_review', 'published', 'hidden'));
