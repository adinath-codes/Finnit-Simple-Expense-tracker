-- Ordinary accounts use the Edge Function defaults. Only support-approved
-- accounts receive a row here, so raising one user's monthly allowance cannot
-- change another user's limit.
create table finn_private.extra_ai_quota (
  user_id uuid primary key references auth.users(id) on delete cascade,
  extra_monthly_calls integer not null
    check (extra_monthly_calls between 1 and 10000),
  expires_at timestamptz not null,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Contact-support taps are stored even when no email provider is configured.
-- A single row per user prevents a loop from flooding the operator inbox/queue.
create table finn_private.ai_quota_support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'resolved')),
  request_count integer not null default 1 check (request_count between 1 and 1000000),
  created_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table finn_private.extra_ai_quota enable row level security;
alter table finn_private.ai_quota_support_requests enable row level security;
revoke all on finn_private.extra_ai_quota,
  finn_private.ai_quota_support_requests from public, anon, authenticated;
grant all on finn_private.extra_ai_quota,
  finn_private.ai_quota_support_requests to service_role;

-- Replace the original two-period limiter with a minute/day/month reservation.
-- Extra credits extend only the monthly allowance: the minute/day guards remain
-- fixed for every account and still stop accidental request loops.
drop function public.finn_reserve_quota(uuid, text, integer, integer);
create function public.finn_reserve_quota(
  p_user uuid,
  p_bucket text,
  p_minute integer,
  p_daily integer,
  p_monthly integer
)
returns boolean
language plpgsql
security invoker
set search_path=''
as $$
declare
  minute_period text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI');
  day_period text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD');
  month_period text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  minute_count integer;
  day_count integer;
  month_count integer;
  monthly_bonus integer := 0;
  effective_monthly integer;
begin
  if p_user is null
    or p_bucket not in ('api', 'ai')
    or p_minute < 1
    or p_daily < 1
    or p_monthly < 1
  then
    return false;
  end if;

  if p_bucket = 'ai' then
    select extra_monthly_calls
      into monthly_bonus
      from finn_private.extra_ai_quota
     where user_id = p_user
       and expires_at > now();
  end if;
  effective_monthly := least(p_monthly + coalesce(monthly_bonus, 0), 100000);

  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_bucket, 0));
  select requests into minute_count
    from finn_private.usage_counters
   where user_id = p_user and bucket = p_bucket and period = minute_period;
  select requests into day_count
    from finn_private.usage_counters
   where user_id = p_user and bucket = p_bucket and period = day_period;
  select requests into month_count
    from finn_private.usage_counters
   where user_id = p_user and bucket = p_bucket and period = month_period;

  if coalesce(minute_count, 0) >= p_minute
    or coalesce(day_count, 0) >= p_daily
    or coalesce(month_count, 0) >= effective_monthly
  then
    return false;
  end if;

  insert into finn_private.usage_counters(user_id, bucket, period, requests)
  values
    (p_user, p_bucket, minute_period, 1),
    (p_user, p_bucket, day_period, 1),
    (p_user, p_bucket, month_period, 1)
  on conflict(user_id, bucket, period)
  do update set requests = finn_private.usage_counters.requests + 1;
  return true;
end
$$;

create function public.finn_request_ai_quota_review(p_user uuid)
returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  request_id uuid;
  previous finn_private.ai_quota_support_requests;
begin
  if p_user is null then
    raise exception 'invalid_user';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':quota-support', 0));
  select * into previous
    from finn_private.ai_quota_support_requests
   where user_id = p_user;
  if found
    and previous.status = 'open'
    and previous.last_requested_at > now() - interval '1 hour'
  then
    return previous.id;
  end if;
  insert into finn_private.ai_quota_support_requests(user_id)
  values (p_user)
  on conflict(user_id) do update
    set status = 'open',
        request_count = least(
          finn_private.ai_quota_support_requests.request_count + 1,
          1000000
        ),
        last_requested_at = now(),
        resolved_at = null
  returning id into request_id;
  return request_id;
end
$$;

revoke all on function public.finn_reserve_quota(uuid, text, integer, integer, integer),
  public.finn_request_ai_quota_review(uuid) from public, anon, authenticated;
grant execute on function public.finn_reserve_quota(uuid, text, integer, integer, integer),
  public.finn_request_ai_quota_review(uuid) to service_role;
