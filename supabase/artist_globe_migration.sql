-- Artist Globe demo schema (extractable to iomglobeart.com later)
-- Apply in Supabase SQL editor after schema.sql

create extension if not exists "pgcrypto";

create table if not exists public.artist_globe_submissions (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  category text not null check (category in (
    'photographer', 'painter', 'sculptor', 'illustrator', 'digital',
    'installation', 'filmmaker', 'sound', 'conceptual', 'visual_artist'
  )),
  tags text[] not null default '{}',
  bio text not null default '' check (char_length(bio) <= 2000),
  links jsonb not null default '{}'::jsonb,
  city text not null default '' check (char_length(city) <= 120),
  country text not null default '' check (char_length(country) <= 120),
  lat double precision not null,
  lon double precision not null,
  timezone text not null default 'UTC' check (char_length(timezone) <= 64),
  avatar_url text not null default '' check (char_length(avatar_url) <= 1024),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reject_reason text not null default '' check (char_length(reject_reason) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists artist_globe_submissions_status_idx
  on public.artist_globe_submissions (status, created_at desc);

create table if not exists public.artist_globe_artists (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(slug) between 1 and 64),
  display_name text not null check (char_length(display_name) between 1 and 120),
  email text check (email is null or char_length(email) between 3 and 254),
  category text not null check (category in (
    'photographer', 'painter', 'sculptor', 'illustrator', 'digital',
    'installation', 'filmmaker', 'sound', 'conceptual', 'visual_artist'
  )),
  tags text[] not null default '{}',
  bio text not null default '' check (char_length(bio) <= 2000),
  links jsonb not null default '{}'::jsonb,
  city text not null default '' check (char_length(city) <= 120),
  country text not null default '' check (char_length(country) <= 120),
  lat double precision not null,
  lon double precision not null,
  timezone text not null default 'UTC' check (char_length(timezone) <= 64),
  avatar_url text not null default '' check (char_length(avatar_url) <= 1024),
  portfolio jsonb not null default '[]'::jsonb,
  status text not null default 'live' check (status in ('live', 'hidden')),
  auth_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists artist_globe_artists_auth_user_uidx
  on public.artist_globe_artists (auth_user_id)
  where auth_user_id is not null;

create index if not exists artist_globe_artists_status_idx
  on public.artist_globe_artists (status);

create table if not exists public.artist_globe_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (char_length(token) between 16 and 128),
  artist_id uuid not null references public.artist_globe_artists (id) on delete cascade,
  submission_id uuid references public.artist_globe_submissions (id) on delete set null,
  email text not null check (char_length(email) between 3 and 254),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists artist_globe_invites_token_idx
  on public.artist_globe_invites (token);

alter table public.artist_globe_submissions enable row level security;
alter table public.artist_globe_artists enable row level security;
alter table public.artist_globe_invites enable row level security;

-- Public: submit
drop policy if exists "artist_globe_submissions_anon_insert" on public.artist_globe_submissions;
create policy "artist_globe_submissions_anon_insert"
  on public.artist_globe_submissions for insert
  to anon, authenticated
  with check (status = 'pending');

-- Public: read live artists
drop policy if exists "artist_globe_artists_public_select_live" on public.artist_globe_artists;
create policy "artist_globe_artists_public_select_live"
  on public.artist_globe_artists for select
  to anon, authenticated
  using (status = 'live' or auth.uid() = auth_user_id);

-- Artist updates own profile
drop policy if exists "artist_globe_artists_owner_update" on public.artist_globe_artists;
create policy "artist_globe_artists_owner_update"
  on public.artist_globe_artists for update
  to authenticated
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

-- Public can read invites by token (needed to claim)
drop policy if exists "artist_globe_invites_public_select" on public.artist_globe_invites;
create policy "artist_globe_invites_public_select"
  on public.artist_globe_invites for select
  to anon, authenticated
  using (true);

grant insert on public.artist_globe_submissions to anon, authenticated;
grant select on public.artist_globe_artists to anon, authenticated;
grant update on public.artist_globe_artists to authenticated;
grant select on public.artist_globe_invites to anon, authenticated;

-- Claim invite after signup (links auth user to artist row)
create or replace function public.artist_globe_claim_invite(
  invite_token text,
  claim_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.artist_globe_invites%rowtype;
begin
  if claim_user_id is null or claim_user_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;

  select * into inv
  from public.artist_globe_invites
  where token = invite_token
  for update;

  if not found then
    raise exception 'Invite not found';
  end if;
  if inv.used_at is not null then
    raise exception 'Invite already used';
  end if;
  if inv.expires_at < now() then
    raise exception 'Invite expired';
  end if;

  update public.artist_globe_artists
  set auth_user_id = claim_user_id,
      email = inv.email,
      updated_at = now()
  where id = inv.artist_id;

  update public.artist_globe_invites
  set used_at = now()
  where id = inv.id;
end;
$$;

grant execute on function public.artist_globe_claim_invite(text, uuid) to authenticated;

-- Note: admin approve/reject/list use Vercel API + service role (see api/artist-globe-admin.js)
