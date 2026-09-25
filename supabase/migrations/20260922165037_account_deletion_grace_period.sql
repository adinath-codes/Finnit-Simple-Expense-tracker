-- Account deletion is a recoverable request for 30 days, then a server-only
-- worker permanently deletes the Auth user and lets owner FKs cascade.
create table finn_private.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default clock_timestamp(),
  delete_after timestamptz not null,
  last_attempt_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  check (delete_after > requested_at)
);

create index account_deletion_requests_due_idx
  on finn_private.account_deletion_requests(delete_after, last_attempt_at);

alter table finn_private.account_deletion_requests enable row level security;
revoke all on finn_private.account_deletion_requests
  from public, anon, authenticated;
grant all on finn_private.account_deletion_requests to service_role;

create or replace function public.finn_request_account_deletion(p_user uuid)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare scheduled_at timestamptz;
begin
  insert into finn_private.account_deletion_requests(
    user_id,
    requested_at,
    delete_after
  ) values (
    p_user,
    clock_timestamp(),
    clock_timestamp() + interval '30 days'
  )
  on conflict (user_id) do nothing;

  select request.delete_after into scheduled_at
    from finn_private.account_deletion_requests request
   where request.user_id = p_user;

  if scheduled_at is null then
    raise exception 'account_deletion_request_failed';
  end if;
  return scheduled_at;
end;
$$;

create or replace function public.finn_cancel_account_deletion(p_user uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare scheduled_at timestamptz;
begin
  select request.delete_after into scheduled_at
    from finn_private.account_deletion_requests request
   where request.user_id = p_user
   for update;

  if scheduled_at is null then return 'none'; end if;
  if scheduled_at <= clock_timestamp() then return 'expired'; end if;

  delete from finn_private.account_deletion_requests
   where user_id = p_user;
  return 'cancelled';
end;
$$;

create or replace function finn_private.finn_purge_expired_accounts(
  p_limit integer default 100
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target record;
  purged integer := 0;
begin
  for target in
    select request.user_id
      from finn_private.account_deletion_requests request
     where request.delete_after <= clock_timestamp()
       and (
         request.last_attempt_at is null or
         request.last_attempt_at < clock_timestamp() - interval '15 minutes'
       )
     order by request.delete_after, request.user_id
     limit least(greatest(coalesce(p_limit, 100), 1), 100)
     for update skip locked
  loop
    update finn_private.account_deletion_requests
       set last_attempt_at = clock_timestamp(),
           attempt_count = attempt_count + 1
     where user_id = target.user_id;
    begin
      delete from auth.users where id = target.user_id;
      if found then purged := purged + 1; end if;
    exception when others then
      -- Keep the request for the next bounded retry. Cron records the run while
      -- avoiding one malformed account blocking every other due deletion.
      null;
    end;
  end loop;
  return purged;
end;
$$;

revoke all on function public.finn_request_account_deletion(uuid),
  public.finn_cancel_account_deletion(uuid)
  from public, anon, authenticated;
grant execute on function public.finn_request_account_deletion(uuid),
  public.finn_cancel_account_deletion(uuid)
  to service_role;

revoke all on function finn_private.finn_purge_expired_accounts(integer)
  from public, anon, authenticated, service_role;

create extension if not exists pg_cron;
select cron.schedule(
  'finn-purge-expired-accounts',
  '17 * * * *',
  $job$select finn_private.finn_purge_expired_accounts(100);$job$
);
