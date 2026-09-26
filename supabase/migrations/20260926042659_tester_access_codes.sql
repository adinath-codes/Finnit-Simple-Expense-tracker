-- Capacity-limited tester codes live outside the exposed public schema. Only
-- authenticated Edge Functions using the service role can reserve or complete
-- a redemption. Codes are stored as SHA-256 digests, never as reusable text.
create table finn_private.testing_access_codes (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  code_hint text not null check (char_length(code_hint) between 2 and 12),
  max_redemptions integer not null check (max_redemptions between 1 and 10000),
  premium_days integer not null check (premium_days between 1 and 3650),
  enabled boolean not null default true,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > starts_at)
);

create table finn_private.testing_access_code_redemptions (
  code_id text not null references finn_private.testing_access_codes(id)
    on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'granted')),
  premium_expires_at timestamptz,
  created_at timestamptz not null default now(),
  last_attempt_at timestamptz not null default now(),
  granted_at timestamptz,
  primary key (code_id, user_id),
  check (
    (status = 'pending' and granted_at is null)
    or (status = 'granted' and granted_at is not null
      and premium_expires_at is not null)
  )
);

create index testing_access_code_redemptions_user
  on finn_private.testing_access_code_redemptions(user_id, created_at desc);

alter table finn_private.testing_access_codes enable row level security;
alter table finn_private.testing_access_code_redemptions enable row level security;

revoke all on table finn_private.testing_access_codes,
  finn_private.testing_access_code_redemptions
  from public, anon, authenticated;
grant all on table finn_private.testing_access_codes,
  finn_private.testing_access_code_redemptions
  to service_role;

-- The code row is locked while capacity is checked and the pending redemption
-- is inserted. This makes max_redemptions exact even under concurrent requests.
-- Pending attempts older than fifteen minutes stop occupying capacity so a
-- failed RevenueCat request cannot permanently burn a tester slot.
create function public.finn_reserve_testing_access_code(
  p_user uuid,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  code_record finn_private.testing_access_codes;
  existing finn_private.testing_access_code_redemptions;
  has_existing boolean := false;
  occupied integer;
begin
  if p_user is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_testing_access_code_request';
  end if;

  select * into code_record
  from finn_private.testing_access_codes code
  where code.code_hash = p_code_hash
  for update;

  if not found
    or not code_record.enabled
    or code_record.starts_at > now()
    or (code_record.expires_at is not null and code_record.expires_at <= now())
  then
    return jsonb_build_object('result', 'invalid');
  end if;

  select * into existing
  from finn_private.testing_access_code_redemptions redemption
  where redemption.code_id = code_record.id
    and redemption.user_id = p_user;
  has_existing := found;

  if has_existing and existing.status = 'granted' then
    return jsonb_build_object(
      'result', 'already_granted',
      'code_id', code_record.id,
      'premium_days', code_record.premium_days,
      'premium_expires_at', existing.premium_expires_at
    );
  end if;

  if has_existing
    and existing.last_attempt_at > now() - interval '15 minutes'
  then
    update finn_private.testing_access_code_redemptions
    set last_attempt_at = now()
    where code_id = code_record.id and user_id = p_user;

    return jsonb_build_object(
      'result', 'reserved',
      'code_id', code_record.id,
      'premium_days', code_record.premium_days
    );
  end if;

  select count(*)::integer into occupied
  from finn_private.testing_access_code_redemptions redemption
  where redemption.code_id = code_record.id
    and (
      redemption.status = 'granted'
      or redemption.last_attempt_at > now() - interval '15 minutes'
    );

  if occupied >= code_record.max_redemptions then
    return jsonb_build_object('result', 'full');
  end if;

  if has_existing then
    update finn_private.testing_access_code_redemptions
    set last_attempt_at = now()
    where code_id = code_record.id and user_id = p_user;

    return jsonb_build_object(
      'result', 'reserved',
      'code_id', code_record.id,
      'premium_days', code_record.premium_days
    );
  end if;

  insert into finn_private.testing_access_code_redemptions (
    code_id, user_id, status
  ) values (
    code_record.id, p_user, 'pending'
  );

  return jsonb_build_object(
    'result', 'reserved',
    'code_id', code_record.id,
    'premium_days', code_record.premium_days
  );
end
$$;

create function public.finn_complete_testing_access_code(
  p_user uuid,
  p_code_id text,
  p_premium_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user is null
    or p_code_id = ''
    or p_premium_expires_at is null
    or p_premium_expires_at <= now()
  then
    raise exception 'invalid_testing_access_code_completion';
  end if;

  update finn_private.testing_access_code_redemptions
  set status = 'granted',
      premium_expires_at = p_premium_expires_at,
      granted_at = coalesce(granted_at, now()),
      last_attempt_at = now()
  where code_id = p_code_id and user_id = p_user;

  if not found then
    raise exception 'testing_access_code_reservation_not_found';
  end if;
end
$$;

revoke all on function public.finn_reserve_testing_access_code(uuid, text)
  from public, anon, authenticated;
revoke all on function public.finn_complete_testing_access_code(
  uuid, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.finn_reserve_testing_access_code(uuid, text)
  to service_role;
grant execute on function public.finn_complete_testing_access_code(
  uuid, text, timestamptz
) to service_role;

-- Initial tester cohort: FINN-TEST-6D1773036ECD, 25 unique accounts, 30 days.
-- The repository contains only its normalized SHA-256 digest.
insert into finn_private.testing_access_codes (
  id, code_hash, code_hint, max_redemptions, premium_days
) values (
  'early-testers-2026',
  '4f547e1d4c31d63082cb49a2eb584868398a9d9d84085214d192a4b45fb5fa6a',
  '...6ECD',
  25,
  30
);
