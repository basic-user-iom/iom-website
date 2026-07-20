-- CRM screen recordings: private storage + metadata + share unlock RPC
-- Run in Supabase SQL Editor after schema.sql.

create extension if not exists "pgcrypto";

create table if not exists public.crm_recordings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled recording',
  storage_path text not null,
  mime_type text not null default 'video/webm',
  duration_ms integer,
  file_size bigint,
  share_slug text not null unique,
  password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_recordings_owner_idx
  on public.crm_recordings (owner_id, created_at desc);

create index if not exists crm_recordings_slug_idx
  on public.crm_recordings (share_slug);

alter table public.crm_recordings enable row level security;

drop policy if exists "crm_recordings_select_own" on public.crm_recordings;
create policy "crm_recordings_select_own"
  on public.crm_recordings for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "crm_recordings_insert_own" on public.crm_recordings;
create policy "crm_recordings_insert_own"
  on public.crm_recordings for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "crm_recordings_update_own" on public.crm_recordings;
create policy "crm_recordings_update_own"
  on public.crm_recordings for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "crm_recordings_delete_own" on public.crm_recordings;
create policy "crm_recordings_delete_own"
  on public.crm_recordings for delete
  to authenticated
  using (owner_id = auth.uid());

-- Public metadata lookup by slug (no password hash, no storage path)
create or replace function public.crm_recording_share_meta(p_slug text)
returns table (
  id uuid,
  title text,
  mime_type text,
  duration_ms integer,
  has_password boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    r.id,
    r.title,
    r.mime_type,
    r.duration_ms,
    (r.password_hash is not null and length(r.password_hash) > 0) as has_password,
    r.created_at
  from public.crm_recordings r
  where r.share_slug = p_slug
  limit 1;
$$;

revoke all on function public.crm_recording_share_meta(text) from public;
grant execute on function public.crm_recording_share_meta(text) to anon, authenticated;

-- Verify password; returns storage_path only on success (service role / unlock API uses this)
create or replace function public.crm_recording_unlock(
  p_slug text,
  p_password text
)
returns table (
  id uuid,
  title text,
  mime_type text,
  storage_path text,
  duration_ms integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.crm_recordings%rowtype;
  expected text;
begin
  select * into r from public.crm_recordings where share_slug = p_slug limit 1;
  if not found then
    return;
  end if;

  if r.password_hash is null or length(r.password_hash) = 0 then
    return query select r.id, r.title, r.mime_type, r.storage_path, r.duration_ms;
    return;
  end if;

  expected := encode(
    digest(
      convert_to(
        coalesce(p_password, '') || ':' || r.id::text || ':iom-rec',
        'utf8'
      ),
      'sha256'
    ),
    'hex'
  );

  if expected = r.password_hash then
    return query select r.id, r.title, r.mime_type, r.storage_path, r.duration_ms;
  end if;
end;
$$;

revoke all on function public.crm_recording_unlock(text, text) from public;
grant execute on function public.crm_recording_unlock(text, text) to anon, authenticated, service_role;

-- Private video/screenshot bucket (500 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'crm-screen-recordings',
  'crm-screen-recordings',
  false,
  524288000,
  array[
    'video/webm',
    'video/mp4',
    'video/quicktime',
    'audio/webm',
    'audio/mpeg',
    'audio/wav',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "crm_recordings_storage_select_own" on storage.objects;
create policy "crm_recordings_storage_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'crm-screen-recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "crm_recordings_storage_insert_own" on storage.objects;
create policy "crm_recordings_storage_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'crm-screen-recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "crm_recordings_storage_update_own" on storage.objects;
create policy "crm_recordings_storage_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'crm-screen-recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'crm-screen-recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "crm_recordings_storage_delete_own" on storage.objects;
create policy "crm_recordings_storage_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'crm-screen-recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
