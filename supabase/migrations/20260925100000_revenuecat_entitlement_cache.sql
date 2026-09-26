-- Keep RevenueCat off latency-sensitive financial requests. Webhooks and the
-- authenticated reconciliation endpoint refresh this private snapshot; capture
-- functions only perform the local database check below.
create table finn_private.revenuecat_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  entitlement_id text not null,
  active boolean not null,
  expires_at timestamptz,
  checked_at timestamptz not null default now(),
  source text not null check (source in ('reconciliation', 'webhook')),
  last_event_id text
);

alter table finn_private.revenuecat_entitlements enable row level security;

create function public.finn_has_premium_entitlement(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select entitlement.active
      and (entitlement.expires_at is null or entitlement.expires_at > now())
    from finn_private.revenuecat_entitlements entitlement
    where entitlement.user_id = p_user
  ), false)
$$;

create function public.finn_set_revenuecat_entitlement(
  p_user uuid,
  p_entitlement_id text,
  p_active boolean,
  p_expires_at timestamptz,
  p_source text,
  p_event_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_entitlement_id = '' or p_source not in ('reconciliation', 'webhook') then
    raise exception 'invalid_revenuecat_entitlement';
  end if;

  insert into finn_private.revenuecat_entitlements (
    user_id, entitlement_id, active, expires_at, checked_at, source, last_event_id
  ) values (
    p_user, p_entitlement_id, p_active, p_expires_at, now(), p_source, p_event_id
  )
  on conflict (user_id) do update set
    entitlement_id = excluded.entitlement_id,
    active = excluded.active,
    expires_at = excluded.expires_at,
    checked_at = excluded.checked_at,
    source = excluded.source,
    last_event_id = coalesce(excluded.last_event_id,
      finn_private.revenuecat_entitlements.last_event_id);
end
$$;

revoke all on table finn_private.revenuecat_entitlements from public, anon, authenticated;
revoke all on function public.finn_has_premium_entitlement(uuid) from public, anon, authenticated;
revoke all on function public.finn_set_revenuecat_entitlement(
  uuid,text,boolean,timestamptz,text,text
) from public, anon, authenticated;

grant execute on function public.finn_has_premium_entitlement(uuid) to service_role;
grant execute on function public.finn_set_revenuecat_entitlement(
  uuid,text,boolean,timestamptz,text,text
) to service_role;
