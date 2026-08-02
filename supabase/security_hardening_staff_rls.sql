-- SEC-001 phase 1: staff-only CRM / blog-admin / analytics access.
-- Run in Supabase → SQL Editor (as project owner) AFTER issuing any client accounts.
--
-- What this does:
-- 1) Seeds crm_staff_profiles from existing @iobjectm.com Auth users
-- 2) Adds public.is_crm_staff() (security definer)
-- 3) Replaces authenticated-all policies with staff-gated ones
-- 4) Removes arbitrary self-insert into crm_staff_profiles
--
-- Staff = row in crm_staff_profiles OR JWT email ending in @iobjectm.com

-- ── 0) Bootstrap staff directory from Auth ─────────────────────────────────
insert into public.crm_staff_profiles (id, email, display_name, updated_at)
select
  u.id,
  coalesce(u.email, ''),
  split_part(coalesce(u.email, 'staff'), '@', 1),
  now()
from auth.users u
where lower(coalesce(u.email, '')) like '%@iobjectm.com'
on conflict (id) do update
set
  email = excluded.email,
  updated_at = now();

-- ── 1) Helper ──────────────────────────────────────────────────────────────
create or replace function public.is_crm_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      exists (
        select 1
        from public.crm_staff_profiles p
        where p.id = auth.uid()
      )
      or lower(coalesce(auth.jwt() ->> 'email', '')) like '%@iobjectm.com'
    );
$$;

revoke all on function public.is_crm_staff() from public;
grant execute on function public.is_crm_staff() to authenticated;

-- ── 2) Core CRM tables ─────────────────────────────────────────────────────
drop policy if exists "crm_leads_auth_all" on public.crm_leads;
create policy "crm_leads_staff_all"
  on public.crm_leads for all
  to authenticated
  using (public.is_crm_staff())
  with check (public.is_crm_staff());

drop policy if exists "crm_activities_auth_all" on public.crm_activities;
create policy "crm_activities_staff_all"
  on public.crm_activities for all
  to authenticated
  using (public.is_crm_staff())
  with check (public.is_crm_staff());

drop policy if exists "crm_lead_messages_auth_all" on public.crm_lead_messages;
create policy "crm_lead_messages_staff_all"
  on public.crm_lead_messages for all
  to authenticated
  using (public.is_crm_staff())
  with check (public.is_crm_staff());

drop policy if exists "crm_projects_auth_all" on public.crm_projects;
create policy "crm_projects_staff_all"
  on public.crm_projects for all
  to authenticated
  using (public.is_crm_staff())
  with check (public.is_crm_staff());

-- Notes / links (tables may not exist on every project — wrap safely)
do $$
begin
  if to_regclass('public.crm_research_notes') is not null then
    execute 'drop policy if exists crm_research_notes_authenticated_all on public.crm_research_notes';
    execute $p$
      create policy crm_research_notes_staff_all
        on public.crm_research_notes for all
        to authenticated
        using (public.is_crm_staff())
        with check (public.is_crm_staff())
    $p$;
  end if;

  if to_regclass('public.crm_useful_links') is not null then
    execute 'drop policy if exists crm_useful_links_authenticated_all on public.crm_useful_links';
    execute $p$
      create policy crm_useful_links_staff_all
        on public.crm_useful_links for all
        to authenticated
        using (public.is_crm_staff())
        with check (public.is_crm_staff())
    $p$;
  end if;
end
$$;

-- Recordings: keep owner scope, require staff
do $$
begin
  if to_regclass('public.crm_recordings') is not null then
    execute 'drop policy if exists "crm_recordings_select_own" on public.crm_recordings';
    execute 'drop policy if exists "crm_recordings_insert_own" on public.crm_recordings';
    execute 'drop policy if exists "crm_recordings_update_own" on public.crm_recordings';
    execute 'drop policy if exists "crm_recordings_delete_own" on public.crm_recordings';

    execute $p$
      create policy "crm_recordings_staff_select_own"
        on public.crm_recordings for select
        to authenticated
        using (public.is_crm_staff() and owner_id = auth.uid())
    $p$;
    execute $p$
      create policy "crm_recordings_staff_insert_own"
        on public.crm_recordings for insert
        to authenticated
        with check (public.is_crm_staff() and owner_id = auth.uid())
    $p$;
    execute $p$
      create policy "crm_recordings_staff_update_own"
        on public.crm_recordings for update
        to authenticated
        using (public.is_crm_staff() and owner_id = auth.uid())
        with check (public.is_crm_staff() and owner_id = auth.uid())
    $p$;
    execute $p$
      create policy "crm_recordings_staff_delete_own"
        on public.crm_recordings for delete
        to authenticated
        using (public.is_crm_staff() and owner_id = auth.uid())
    $p$;
  end if;
end
$$;

-- ── 3) Staff profiles: no self-enroll ───────────────────────────────────────
drop policy if exists "crm_staff_profiles_select_auth" on public.crm_staff_profiles;
drop policy if exists "crm_staff_profiles_insert_own" on public.crm_staff_profiles;
drop policy if exists "crm_staff_profiles_update_own" on public.crm_staff_profiles;

create policy "crm_staff_profiles_staff_select"
  on public.crm_staff_profiles for select
  to authenticated
  using (public.is_crm_staff());

create policy "crm_staff_profiles_staff_update_own"
  on public.crm_staff_profiles for update
  to authenticated
  using (public.is_crm_staff() and id = auth.uid())
  with check (public.is_crm_staff() and id = auth.uid());

-- Inserts: service role / SQL Editor only (no authenticated insert grant)
revoke insert on public.crm_staff_profiles from authenticated;
grant select, update on public.crm_staff_profiles to authenticated;

-- ── 4) Avatar storage: staff only ──────────────────────────────────────────
drop policy if exists "crm_user_avatars_auth_insert" on storage.objects;
create policy "crm_user_avatars_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'crm-user-avatars'
    and public.is_crm_staff()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "crm_user_avatars_auth_update" on storage.objects;
create policy "crm_user_avatars_auth_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'crm-user-avatars'
    and public.is_crm_staff()
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'crm-user-avatars'
    and public.is_crm_staff()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "crm_user_avatars_auth_delete" on storage.objects;
create policy "crm_user_avatars_auth_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'crm-user-avatars'
    and public.is_crm_staff()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 5) Blog administration ─────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.blog_posts') is not null then
    execute 'drop policy if exists "blog_posts_auth_all" on public.blog_posts';
    execute $p$
      create policy "blog_posts_staff_all"
        on public.blog_posts for all
        to authenticated
        using (public.is_crm_staff())
        with check (public.is_crm_staff())
    $p$;
  end if;

  if to_regclass('public.blog_comments') is not null then
    execute 'drop policy if exists "blog_comments_auth_all" on public.blog_comments';
    execute $p$
      create policy "blog_comments_staff_all"
        on public.blog_comments for all
        to authenticated
        using (public.is_crm_staff())
        with check (public.is_crm_staff())
    $p$;
  end if;

  if to_regclass('public.blog_audience') is not null then
    execute 'drop policy if exists "blog_audience_auth_all" on public.blog_audience';
    execute $p$
      create policy "blog_audience_staff_all"
        on public.blog_audience for all
        to authenticated
        using (public.is_crm_staff())
        with check (public.is_crm_staff())
    $p$;
  end if;

  if to_regclass('public.blog_post_translations') is not null then
    execute 'drop policy if exists "blog_translations_auth_all" on public.blog_post_translations';
    execute $p$
      create policy "blog_translations_staff_all"
        on public.blog_post_translations for all
        to authenticated
        using (public.is_crm_staff())
        with check (public.is_crm_staff())
    $p$;
  end if;
end
$$;

-- Keep published blog SELECT policies for anon/authenticated unchanged.

-- ── 6) Analytics reads ─────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.site_analytics_events') is not null then
    execute 'drop policy if exists "site_analytics_auth_select" on public.site_analytics_events';
    execute $p$
      create policy "site_analytics_staff_select"
        on public.site_analytics_events for select
        to authenticated
        using (public.is_crm_staff())
    $p$;
  end if;
end
$$;

-- Prefer invoker security so event RLS applies to the daily view
do $$
begin
  if to_regclass('public.site_analytics_daily') is not null then
    begin
      execute 'alter view public.site_analytics_daily set (security_invoker = true)';
    exception
      when others then
        -- Older Postgres / view ownership quirks: leave view as-is
        null;
    end;
  end if;
end
$$;

-- Sanity check (run manually after apply):
-- select id, email from public.crm_staff_profiles order by email;
-- select public.is_crm_staff(); -- while signed in as staff → true
