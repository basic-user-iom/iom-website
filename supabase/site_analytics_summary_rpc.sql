-- Staff-only analytics summary for the CRM SEO tab.
-- Returns a small JSON payload instead of downloading thousands of raw event rows
-- (that loop was the Free-plan egress spike).
--
-- Run in Supabase → SQL Editor on Production (and Preview). Safe to re-run.
-- Requires: site_analytics_events + geo + engagement columns, public.is_crm_staff().

create or replace function public.site_analytics_summary(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_crm_staff() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'invalid_range' using errcode = '22023';
  end if;

  if p_to - p_from > interval '120 days' then
    raise exception 'invalid_range' using errcode = '22023';
  end if;

  perform set_config('statement_timeout', '15000', true);

  with base as (
    select
      e.session_id,
      e.path,
      e.referrer,
      e.device_type,
      e.created_at,
      coalesce(e.country, '') as country,
      coalesce(e.city, '') as city,
      e.latitude,
      e.longitude,
      coalesce(nullif(e.event_type, ''), 'pageview') as event_type,
      coalesce(e.is_bot, false) as is_bot,
      coalesce(e.utm_source, '') as utm_source,
      coalesce(e.utm_medium, '') as utm_medium,
      coalesce(e.utm_term, '') as utm_term,
      coalesce(e.search_keyword, '') as search_keyword,
      e.duration_ms,
      coalesce(e.link_url, '') as link_url,
      coalesce(e.link_label, '') as link_label
    from public.site_analytics_events e
    where e.created_at >= p_from
      and e.created_at <= p_to
  ),
  with_ref as (
    select
      b.*,
      case
        when btrim(b.referrer) = '' then 'direct'
        when b.referrer ~* '^https?://' then
          coalesce(
            nullif(
              regexp_replace(
                split_part(split_part(split_part(b.referrer, '://', 2), '/', 1), ':', 1),
                '^www\.',
                '',
                'i'
              ),
              ''
            ),
            'direct'
          )
        else left(b.referrer, 80)
      end as ref_host
    from base b
  ),
  pageviews as (
    select * from with_ref where event_type = 'pageview'
  ),
  stats as (
    select *
    from pageviews
    where not is_bot
       or not exists (select 1 from pageviews p where not p.is_bot)
  ),
  session_pages as (
    select session_id, count(*)::int as pages
    from stats
    group by session_id
  ),
  metrics as (
    select
      (select count(*)::int from stats) as pageviews,
      (select count(*)::int from session_pages) as visitors,
      (select count(*)::int from session_pages where pages = 1) as bounce_sessions,
      (select count(distinct session_id)::int from pageviews where not is_bot) as human_visitors,
      (select count(distinct session_id)::int from pageviews where is_bot) as bot_visitors,
      (
        select count(distinct session_id)::int
        from stats
        where created_at >= now() - interval '30 minutes'
      ) as live_visitors,
      (
        select coalesce(round(avg(duration_ms) filter (
          where duration_ms is not null and duration_ms > 0
        ) / 1000.0)::int, 0)
        from with_ref
        where event_type = 'engage' and not is_bot
      ) as avg_time_sec
  )
  select jsonb_build_object(
    'pageviews', m.pageviews,
    'visitors', m.visitors,
    'bounceRate', case
      when m.visitors = 0 then 0
      else round((m.bounce_sessions::numeric / m.visitors) * 100)::int
    end,
    'avgPagesPerSession', case
      when m.visitors = 0 then 0
      else round((m.pageviews::numeric / m.visitors) * 10) / 10.0
    end,
    'avgTimeOnPageSec', m.avg_time_sec,
    'humanVisitors', m.human_visitors,
    'botVisitors', m.bot_visitors,
    'liveVisitors', m.live_visitors,
    'topPages', (
      select coalesce(
        jsonb_agg(jsonb_build_object('path', t.path, 'views', t.views) order by t.views desc),
        '[]'::jsonb
      )
      from (
        select path, count(*)::int as views
        from stats
        group by path
        order by views desc
        limit 8
      ) t
    ),
    'topReferrers', (
      select coalesce(
        jsonb_agg(jsonb_build_object('referrer', t.ref_host, 'views', t.views) order by t.views desc),
        '[]'::jsonb
      )
      from (
        select ref_host, count(*)::int as views
        from stats
        group by ref_host
        order by views desc
        limit 6
      ) t
    ),
    'topSources', (
      select coalesce(
        jsonb_agg(jsonb_build_object('source', t.source, 'views', t.views) order by t.views desc),
        '[]'::jsonb
      )
      from (
        select
          case
            when btrim(utm_source) <> '' or btrim(utm_medium) <> '' then
              concat(
                coalesce(nullif(btrim(utm_source), ''), '(direct)'),
                ' / ',
                coalesce(nullif(btrim(utm_medium), ''), '(none)')
              )
            when ref_host = 'direct' then 'direct / none'
            when ref_host ilike '%google.%' then 'google / organic'
            when ref_host ilike '%bing.%' then 'bing / organic'
            when ref_host ilike '%duckduckgo.%' then 'duckduckgo / organic'
            when ref_host ilike '%linkedin.%'
              or ref_host ilike '%twitter.%'
              or ref_host ilike '%x.com%'
              or ref_host ilike '%facebook.%'
              then concat(ref_host, ' / social')
            when ref_host ilike '%github.%' then 'github / referral'
            else concat(ref_host, ' / referral')
          end as source,
          count(*)::int as views
        from stats
        group by 1
        order by views desc
        limit 6
      ) t
    ),
    'topKeywords', (
      select coalesce(
        jsonb_agg(jsonb_build_object('keyword', t.keyword, 'views', t.views) order by t.views desc),
        '[]'::jsonb
      )
      from (
        select lower(btrim(coalesce(nullif(search_keyword, ''), utm_term))) as keyword,
          count(*)::int as views
        from stats
        where btrim(coalesce(nullif(search_keyword, ''), utm_term)) <> ''
        group by 1
        order by views desc
        limit 8
      ) t
    ),
    'topLinks', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('url', t.url, 'label', t.label, 'clicks', t.clicks)
          order by t.clicks desc
        ),
        '[]'::jsonb
      )
      from (
        select
          btrim(link_url) as url,
          left(
            max(coalesce(nullif(btrim(link_label), ''), btrim(link_url))),
            80
          ) as label,
          count(*)::int as clicks
        from with_ref
        where event_type = 'click'
          and not is_bot
          and btrim(link_url) <> ''
        group by 1
        order by clicks desc
        limit 8
      ) t
    ),
    'deviceBreakdown', (
      select coalesce(
        jsonb_agg(jsonb_build_object('device', t.device_type, 'views', t.views) order by t.views desc),
        '[]'::jsonb
      )
      from (
        select device_type, count(*)::int as views
        from stats
        group by device_type
        order by views desc
        limit 4
      ) t
    ),
    'topCountries', (
      select coalesce(
        jsonb_agg(jsonb_build_object('country', t.country, 'views', t.views) order by t.views desc),
        '[]'::jsonb
      )
      from (
        select upper(btrim(country)) as country, count(*)::int as views
        from stats
        where btrim(country) <> ''
        group by 1
        order by views desc
        limit 8
      ) t
    ),
    'geoPoints', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'lat', t.lat,
            'lon', t.lon,
            'country', t.country,
            'city', t.city,
            'visitors', t.visitors,
            'live', t.live
          )
          order by t.visitors desc
        ),
        '[]'::jsonb
      )
      from (
        select
          case
            when latitude is not null and longitude is not null
              then round(latitude::numeric, 2)::double precision
            else null
          end as lat,
          case
            when latitude is not null and longitude is not null
              then round(longitude::numeric, 2)::double precision
            else null
          end as lon,
          upper(btrim(country)) as country,
          btrim(city) as city,
          count(distinct session_id)::int as visitors,
          bool_or(created_at >= now() - interval '30 minutes') as live
        from stats
        where btrim(country) <> ''
           or (latitude is not null and longitude is not null)
        group by 1, 2, 3, 4
        order by visitors desc
        limit 80
      ) t
    ),
    'daily', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'day', to_char(g.d, 'YYYY-MM-DD'),
            'pageviews', coalesce(s.pageviews, 0),
            'visitors', coalesce(s.visitors, 0)
          )
          order by g.d
        ),
        '[]'::jsonb
      )
      from generate_series(
        ((p_from at time zone 'utc')::date)::timestamp,
        ((p_to at time zone 'utc')::date)::timestamp,
        interval '1 day'
      ) as g(d)
      left join (
        select
          (created_at at time zone 'utc')::date as day,
          count(*)::int as pageviews,
          count(distinct session_id)::int as visitors
        from stats
        group by 1
      ) s on s.day = g.d::date
    )
  )
  into result
  from metrics m;

  return coalesce(result, '{}'::jsonb);
end;
$$;

revoke all on function public.site_analytics_summary(timestamptz, timestamptz) from public;
revoke all on function public.site_analytics_summary(timestamptz, timestamptz) from anon;
grant execute on function public.site_analytics_summary(timestamptz, timestamptz) to authenticated;

comment on function public.site_analytics_summary(timestamptz, timestamptz) is
  'CRM SEO dashboard aggregate. Staff-only. Keeps analytics egress tiny.';
