-- A separate login is provisioned with a password outside migrations. It is
-- intentionally not a member of authenticated or service_role.
create role finn_ask_reader login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create schema ask_read;
revoke all on schema ask_read from public, anon, authenticated;
grant usage on schema ask_read to finn_ask_reader;

-- Security-invoker views keep the caller's RLS policies in force. Every view
-- also requires a transaction-local date window set by the Edge Function.
create policy finn_ask_owner on public.transactions for select to finn_ask_reader
  using (user_id = (select auth.uid()));
create policy finn_ask_owner on public.journal_entries for select to finn_ask_reader
  using (user_id = (select auth.uid()));
create policy finn_ask_owner on public.transaction_allocations for select to finn_ask_reader
  using (user_id = (select auth.uid()));
create policy finn_ask_owner on public.transaction_participants for select to finn_ask_reader
  using (user_id = (select auth.uid()));
create policy finn_ask_owner on public.transaction_contexts for select to finn_ask_reader
  using (user_id = (select auth.uid()));
create policy finn_ask_owner on public.people for select to finn_ask_reader
  using (user_id = (select auth.uid()));
create policy finn_ask_owner on public.contexts for select to finn_ask_reader
  using (user_id = (select auth.uid()));
create policy finn_ask_merchant on public.merchants for select to finn_ask_reader
  using (user_id is null or user_id = (select auth.uid()));
create policy finn_ask_category on public.categories for select to finn_ask_reader using (true);
create policy finn_ask_revision on public.journal_search_revisions for select to finn_ask_reader
  using (user_id = (select auth.uid()));

grant select (id,user_id,entry_id,description,currency,direction,cash_flow,category_id,
  merchant_id,occurred_on,amount_minor,amount_status,user_share_minor,group_total_minor,
  paid_by_user_minor,unresolved) on public.transactions to finn_ask_reader;
grant select (id,user_id,raw_text,search_text,deleted_at) on public.journal_entries to finn_ask_reader;
grant select (user_id,transaction_id,allocation_type,amount_minor,needs_review)
  on public.transaction_allocations to finn_ask_reader;
grant select (user_id,transaction_id,person_id,display_name,source_ordinal)
  on public.transaction_participants to finn_ask_reader;
grant select (user_id,transaction_id,context_id) on public.transaction_contexts to finn_ask_reader;
grant select (id,user_id,name) on public.people to finn_ask_reader;
grant select (id,user_id,name) on public.contexts to finn_ask_reader;
grant select (id,name) on public.categories to finn_ask_reader;
grant select (id,user_id,canonical_name) on public.merchants to finn_ask_reader;
grant select (user_id,revision) on public.journal_search_revisions to finn_ask_reader;
grant usage on schema public to finn_ask_reader;
grant usage on schema auth to finn_ask_reader;
grant execute on function auth.uid() to finn_ask_reader;

create view ask_read.transactions with (security_invoker=true,security_barrier=true) as
select
  t.id, t.entry_id, t.occurred_on, t.currency, t.direction, t.cash_flow,
  t.category_id, c.name as category_name, t.merchant_id,
  m.canonical_name as merchant_name, t.description, e.raw_text,
  e.search_text,
  coalesce((select string_agg(coalesce(p.name,tp.display_name),' ' order by tp.source_ordinal)
    from public.transaction_participants tp
    left join public.people p on p.id=tp.person_id and p.user_id=tp.user_id
    where tp.user_id=t.user_id and tp.transaction_id=t.id),'') as person_names,
  coalesce((select string_agg(cx.name,' ' order by cx.name)
    from public.transaction_contexts tc
    join public.contexts cx on cx.id=tc.context_id and cx.user_id=tc.user_id
    where tc.user_id=t.user_id and tc.transaction_id=t.id),'') as context_names,
  case when t.amount_status='confirmed' then t.amount_minor end as stated_amount_minor,
  case when t.user_share_minor is not null
    and not (t.unresolved ?| array['user_share','split_rounding'])
    then t.user_share_minor end as user_share_minor,
  t.group_total_minor,
  case when t.paid_by_user_minor is not null and not (t.unresolved ? 'payer')
    then t.paid_by_user_minor end as paid_by_user_minor,
  case when a.owed_to_user is not null and not coalesce(a.owed_to_user_review,false)
    then a.owed_to_user end as owed_to_user_minor,
  case when a.user_owes is not null and not coalesce(a.user_owes_review,false)
    then a.user_owes end as user_owes_minor,
  case when a.reimbursed is not null and not coalesce(a.reimbursed_review,false)
    then a.reimbursed end as reimbursed_minor,
  case when t.group_total_minor is not null then t.group_total_minor
    when t.amount_status='confirmed' then t.amount_minor end as gross_spend_minor
from public.transactions t
join public.journal_entries e on e.id=t.entry_id and e.user_id=t.user_id
join public.categories c on c.id=t.category_id
left join public.merchants m on m.id=t.merchant_id
left join lateral (
  select
    sum(x.amount_minor) filter(where x.allocation_type='owed_to_user') owed_to_user,
    bool_or(x.needs_review) filter(where x.allocation_type='owed_to_user') owed_to_user_review,
    sum(x.amount_minor) filter(where x.allocation_type='owed_by_user') user_owes,
    bool_or(x.needs_review) filter(where x.allocation_type='owed_by_user') user_owes_review,
    sum(x.amount_minor) filter(where x.allocation_type in ('reimbursed_to_user','reimbursed_by_user')) reimbursed,
    bool_or(x.needs_review) filter(where x.allocation_type in ('reimbursed_to_user','reimbursed_by_user')) reimbursed_review
  from public.transaction_allocations x
  where x.user_id=t.user_id and x.transaction_id=t.id
) a on true
where t.user_id=(select auth.uid()) and e.deleted_at is null
  and t.occurred_on>=nullif(current_setting('finn.ask_start',true),'')::date
  and t.occurred_on<nullif(current_setting('finn.ask_end',true),'')::date
  and (nullif(current_setting('finn.ask_end',true),'')::date
      - nullif(current_setting('finn.ask_start',true),'')::date) between 1 and 3660;

revoke all on ask_read.transactions from public,anon,authenticated;
grant select on ask_read.transactions to finn_ask_reader;

-- Only the server-side Edge Function can store validated SQL for cursor pages.
create table finn_private.ask_sql_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  cohort_sql text not null,
  answer_kind text not null,
  answer_label text not null,
  answer_rows jsonb not null,
  matching_count integer not null,
  metric text not null,
  start_date date not null,
  end_date date not null,
  revision text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '15 minutes'
);
create index ask_sql_sessions_user_expiry on finn_private.ask_sql_sessions(user_id,expires_at);
alter table finn_private.ask_sql_sessions enable row level security;
revoke all on finn_private.ask_sql_sessions from public,anon,authenticated;
grant all on finn_private.ask_sql_sessions to service_role;

create function public.finn_store_ask_sql_session(
  p_user uuid,p_cohort_sql text,p_answer_kind text,p_answer_label text,
  p_answer_rows jsonb,p_matching_count integer,p_metric text,p_start date,p_end date,p_revision text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare session_id uuid;
begin
  delete from finn_private.ask_sql_sessions where user_id=p_user and expires_at<=now();
  insert into finn_private.ask_sql_sessions
    (user_id,cohort_sql,answer_kind,answer_label,answer_rows,matching_count,metric,start_date,end_date,revision)
  values (p_user,p_cohort_sql,p_answer_kind,p_answer_label,p_answer_rows,p_matching_count,p_metric,p_start,p_end,p_revision)
  returning id into session_id;
  return session_id;
end $$;
create function public.finn_get_ask_sql_session(p_user uuid,p_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select to_jsonb(s) from finn_private.ask_sql_sessions s
  where s.user_id=p_user and s.id=p_id and s.expires_at>now();
$$;
revoke all on function public.finn_store_ask_sql_session(uuid,text,text,text,jsonb,integer,text,date,date,text),
  public.finn_get_ask_sql_session(uuid,uuid) from public,anon,authenticated;
grant execute on function public.finn_store_ask_sql_session(uuid,text,text,text,jsonb,integer,text,date,date,text),
  public.finn_get_ask_sql_session(uuid,uuid) to service_role;

-- Public-function default EXECUTE would otherwise make the read role able to
-- invoke older mutating RPCs directly. Existing authenticated/service grants stay.
do $$
declare routine record;
begin
  for routine in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and left(p.proname,5)='finn_'
  loop
    execute format('revoke execute on function %s from public',routine.signature);
  end loop;
end $$;
alter default privileges in schema public revoke execute on functions from public;
