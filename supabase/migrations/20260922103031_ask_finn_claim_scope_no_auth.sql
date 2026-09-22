-- Managed auth schemas do not retain custom-role USAGE grants. Scope the
-- restricted reader from the transaction-local verified subject instead.
create function ask_read.current_user_id() returns uuid
language sql stable security invoker set search_path='' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
revoke all on function ask_read.current_user_id() from public,anon,authenticated;
grant execute on function ask_read.current_user_id() to finn_ask_reader;

drop policy finn_ask_owner on public.transactions;
drop policy finn_ask_owner on public.journal_entries;
drop policy finn_ask_owner on public.transaction_allocations;
drop policy finn_ask_owner on public.transaction_participants;
drop policy finn_ask_owner on public.transaction_contexts;
drop policy finn_ask_owner on public.people;
drop policy finn_ask_owner on public.contexts;
drop policy finn_ask_merchant on public.merchants;
drop policy finn_ask_category on public.categories;
drop policy finn_ask_revision on public.journal_search_revisions;

create policy finn_ask_owner on public.transactions for select to finn_ask_reader
  using (user_id = (select ask_read.current_user_id()));
create policy finn_ask_owner on public.journal_entries for select to finn_ask_reader
  using (user_id = (select ask_read.current_user_id()));
create policy finn_ask_owner on public.transaction_allocations for select to finn_ask_reader
  using (user_id = (select ask_read.current_user_id()));
create policy finn_ask_owner on public.transaction_participants for select to finn_ask_reader
  using (user_id = (select ask_read.current_user_id()));
create policy finn_ask_owner on public.transaction_contexts for select to finn_ask_reader
  using (user_id = (select ask_read.current_user_id()));
create policy finn_ask_owner on public.people for select to finn_ask_reader
  using (user_id = (select ask_read.current_user_id()));
create policy finn_ask_owner on public.contexts for select to finn_ask_reader
  using (user_id = (select ask_read.current_user_id()));
create policy finn_ask_merchant on public.merchants for select to finn_ask_reader
  using (user_id is null or user_id = (select ask_read.current_user_id()));
create policy finn_ask_category on public.categories for select to finn_ask_reader using (true);
create policy finn_ask_revision on public.journal_search_revisions for select to finn_ask_reader
  using (user_id = (select ask_read.current_user_id()));


create or replace view ask_read.transactions with (security_invoker=true,security_barrier=true) as
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
where t.user_id=(select ask_read.current_user_id()) and e.deleted_at is null
  and t.occurred_on>=nullif(current_setting('finn.ask_start',true),'')::date
  and t.occurred_on<nullif(current_setting('finn.ask_end',true),'')::date
  and (nullif(current_setting('finn.ask_end',true),'')::date
      - nullif(current_setting('finn.ask_start',true),'')::date) between 1 and 3660;

