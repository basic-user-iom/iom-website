-- Preview only: ijjnstbwvuwwznfagxut (iom-website-preview).
-- A read-only database query for GitHub Actions; exposes no application data.
begin;

create or replace function public.iom_preview_health()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'ok', true,
    'checked_at', pg_catalog.statement_timestamp()
  );
$$;

revoke all on function public.iom_preview_health() from public;
grant execute on function public.iom_preview_health() to anon, authenticated;
comment on function public.iom_preview_health() is
  'Read-only preview health check: no table access and no writes.';

notify pgrst, 'reload schema';
commit;
