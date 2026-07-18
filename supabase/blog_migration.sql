-- IOM Blog: posts, verified comments, audience list
-- Apply in Supabase SQL editor (idempotent / safe to re-run).

create extension if not exists "pgcrypto";

-- ── Posts ───────────────────────────────────────────────────────────────────
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null default '',
  excerpt text not null default '',
  body text not null default '',
  cover_image_url text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'published', 'hidden')),
  published_at timestamptz,
  seo_title text not null default '',
  seo_description text not null default '',
  author_name text not null default 'IOM',
  tags text[] not null default '{}'::text[],
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_slug_nonempty check (char_length(trim(slug)) > 0)
);

create unique index if not exists blog_posts_slug_uidx on public.blog_posts (slug);
create index if not exists blog_posts_status_published_idx
  on public.blog_posts (status, published_at desc nulls last);

create or replace function public.crm_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists blog_posts_updated_at on public.blog_posts;
create trigger blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.crm_set_updated_at();

-- ── Comments (emails never exposed to anon) ─────────────────────────────────
create table if not exists public.blog_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts (id) on delete cascade,
  parent_id uuid references public.blog_comments (id) on delete cascade,
  author_name text not null default '',
  author_email text not null default '',
  body text not null default '',
  status text not null default 'pending_verify'
    check (status in (
      'pending_verify',
      'pending_moderation',
      'approved',
      'rejected',
      'spam'
    )),
  verify_token_hash text,
  verify_expires_at timestamptz,
  email_verified_at timestamptz,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists blog_comments_post_idx
  on public.blog_comments (post_id, created_at asc);
create index if not exists blog_comments_status_idx
  on public.blog_comments (status, created_at desc);
create index if not exists blog_comments_email_idx
  on public.blog_comments (lower(author_email));
create index if not exists blog_comments_parent_idx
  on public.blog_comments (parent_id);

-- Safe public projection — no email / tokens.
-- Owner rights (not invoker) so anon can read via the view without table SELECT.
create or replace view public.blog_comments_public as
select
  id,
  post_id,
  parent_id,
  author_name,
  body,
  created_at
from public.blog_comments
where status = 'approved';

alter view public.blog_comments_public set (security_invoker = false);

-- ── Audience (CRM blog email list) ──────────────────────────────────────────
create table if not exists public.blog_audience (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null default '',
  source text not null default 'comment'
    check (source in ('comment', 'manual')),
  marketing_opt_in boolean not null default false,
  verified_at timestamptz,
  last_comment_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  constraint blog_audience_email_nonempty check (char_length(trim(email)) > 0)
);

create unique index if not exists blog_audience_email_uidx
  on public.blog_audience (lower(email));

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.blog_posts enable row level security;
alter table public.blog_comments enable row level security;
alter table public.blog_audience enable row level security;

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('blog_posts', 'blog_comments', 'blog_audience')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      r.policyname,
      r.schemaname,
      r.tablename
    );
  end loop;
end
$$;

-- Published posts: public read
create policy "blog_posts_anon_select_published"
  on public.blog_posts for select
  to anon, authenticated
  using (status = 'published');

-- Staff: full post access
create policy "blog_posts_auth_all"
  on public.blog_posts for all
  to authenticated
  using (true)
  with check (true);

-- Comments: no anon access to base table (use view + API)
create policy "blog_comments_auth_all"
  on public.blog_comments for all
  to authenticated
  using (true)
  with check (true);

-- Audience: staff only
create policy "blog_audience_auth_all"
  on public.blog_audience for all
  to authenticated
  using (true)
  with check (true);

grant select on public.blog_posts to anon, authenticated;
grant select, insert, update, delete on public.blog_posts to authenticated;

grant select, insert, update, delete on public.blog_comments to authenticated;
-- Anon cannot read blog_comments directly
revoke all on public.blog_comments from anon;

grant select on public.blog_comments_public to anon, authenticated;

grant select, insert, update, delete on public.blog_audience to authenticated;
revoke all on public.blog_audience from anon;
