-- Shared useful-links library for CRM (YouTube, webpages, forums, blog posts)
-- Run in Supabase → SQL Editor, then hard-refresh /client-login

create table if not exists public.crm_useful_links (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  url text not null default '',
  category text not null default 'webpage'
    check (category in ('youtube', 'webpage', 'forum', 'blog')),
  note text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_useful_links_created_at_idx
  on public.crm_useful_links (created_at asc);

create index if not exists crm_useful_links_category_idx
  on public.crm_useful_links (category);

alter table public.crm_useful_links enable row level security;

drop policy if exists crm_useful_links_authenticated_all on public.crm_useful_links;
create policy crm_useful_links_authenticated_all
  on public.crm_useful_links
  for all
  to authenticated
  using (true)
  with check (true);
