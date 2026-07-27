-- Blog post translations (one parent post, many locales)
-- Apply in Supabase SQL editor after blog_migration.sql (idempotent).

create table if not exists public.blog_post_translations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts (id) on delete cascade,
  locale text not null
    check (locale in ('en', 'de', 'fr', 'nl', 'it', 'es')),
  title text not null default '',
  excerpt text not null default '',
  body text not null default '',
  seo_title text not null default '',
  seo_description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_post_translations_post_locale_uidx unique (post_id, locale)
);

create index if not exists blog_post_translations_locale_idx
  on public.blog_post_translations (locale);

drop trigger if exists blog_post_translations_updated_at on public.blog_post_translations;
create trigger blog_post_translations_updated_at
  before update on public.blog_post_translations
  for each row execute function public.crm_set_updated_at();

-- Backfill EN from existing post content (skip rows that already have en)
insert into public.blog_post_translations (
  post_id, locale, title, excerpt, body, seo_title, seo_description
)
select
  p.id,
  'en',
  p.title,
  p.excerpt,
  p.body,
  p.seo_title,
  p.seo_description
from public.blog_posts p
where not exists (
  select 1
  from public.blog_post_translations t
  where t.post_id = p.id and t.locale = 'en'
);

alter table public.blog_post_translations enable row level security;

do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'blog_post_translations'
  loop
    execute format('drop policy if exists %I on public.blog_post_translations', r.policyname);
  end loop;
end
$$;

-- Public can read translations for published parents only
create policy "blog_translations_anon_select_published"
  on public.blog_post_translations for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.blog_posts p
      where p.id = post_id and p.status = 'published'
    )
  );

-- Staff: full access
create policy "blog_translations_auth_all"
  on public.blog_post_translations for all
  to authenticated
  using (true)
  with check (true);

grant select on public.blog_post_translations to anon, authenticated;
grant select, insert, update, delete on public.blog_post_translations to authenticated;
