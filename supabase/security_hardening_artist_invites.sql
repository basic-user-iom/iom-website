-- SEC-002: Stop anonymous/authenticated table scans of artist_globe_invites.
-- Invite lookup and claim go through narrow security-definer RPCs only.
-- Run in Supabase → SQL Editor after artist_globe_migration.sql.

revoke select on public.artist_globe_invites from anon, authenticated;

drop policy if exists "artist_globe_invites_public_select" on public.artist_globe_invites;

-- Token lookup for the claim UI (exact token only; no list/enumerate).
create or replace function public.artist_globe_get_invite(invite_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.artist_globe_invites%rowtype;
  art public.artist_globe_artists%rowtype;
begin
  if invite_token is null or length(trim(invite_token)) < 16 then
    return null;
  end if;

  select * into inv
  from public.artist_globe_invites
  where token = trim(invite_token);

  if not found then
    return null;
  end if;

  select * into art
  from public.artist_globe_artists
  where id = inv.artist_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'invite', jsonb_build_object(
      'id', inv.id,
      'token', inv.token,
      'artist_id', inv.artist_id,
      'submission_id', inv.submission_id,
      -- Email only for unused, unexpired invites (needed for signup).
      'email', case
        when inv.used_at is null and inv.expires_at >= now() then inv.email
        else null
      end,
      'expires_at', inv.expires_at,
      'used_at', inv.used_at
    ),
    'artist', jsonb_build_object(
      'id', art.id,
      'slug', art.slug,
      'display_name', art.display_name,
      'email', case
        when inv.used_at is null and inv.expires_at >= now() then art.email
        else null
      end,
      'category', art.category,
      'tags', art.tags,
      'bio', art.bio,
      'links', art.links,
      'city', art.city,
      'country', art.country,
      'lat', art.lat,
      'lon', art.lon,
      'timezone', art.timezone,
      'avatar_url', art.avatar_url,
      'portfolio', art.portfolio,
      'status', art.status,
      'auth_user_id', art.auth_user_id
    )
  );
end;
$$;

revoke all on function public.artist_globe_get_invite(text) from public;
grant execute on function public.artist_globe_get_invite(text) to anon, authenticated;
