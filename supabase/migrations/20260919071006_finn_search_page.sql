-- Search landing and cursor pagination. No journal rows are sent to Gemini.
-- A serialized per-user counter detects concurrent commits, corrections and
-- deletions; timestamps alone can miss a late-committing older transaction.
create table public.journal_search_revisions (
 user_id uuid primary key references auth.users on delete cascade,
 revision bigint not null default 0
);
alter table public.journal_search_revisions enable row level security;
create policy own_search_revision on public.journal_search_revisions for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.journal_search_revisions from public,anon,authenticated;
grant select on public.journal_search_revisions to authenticated;
grant all on public.journal_search_revisions to service_role;
insert into public.journal_search_revisions(user_id,revision) select distinct user_id,1 from public.journal_entries;
create function public.finn_bump_search_revision()
returns trigger language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 owner_id:=case when TG_OP='DELETE' then old.user_id else new.user_id end;
 -- Account erasure may have already removed the parent row.
 if exists(select 1 from auth.users where id=owner_id) then
  insert into public.journal_search_revisions(user_id,revision) values(owner_id,1)
  on conflict(user_id) do update set revision=public.journal_search_revisions.revision+1;
 end if;
 return null;
end $$;
revoke all on function public.finn_bump_search_revision() from public,anon,authenticated;
create trigger journal_search_revision after insert or update or delete on public.journal_entries
 for each row execute function public.finn_bump_search_revision();
create index transactions_search_cursor_idx on public.transactions(user_id,occurred_on desc,entry_id desc,id desc);
create index transactions_entry_cursor_idx on public.transactions(user_id,entry_id,occurred_on desc,id desc);

-- Only small relevant catalogs cross the Edge boundary. Exact IDs/names are used
-- for explicit filters; natural-language requests receive literal matches only.
create function public.finn_search_catalog(p_query text default '',p_filters jsonb default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; q text:=' '||lower(regexp_replace(p_query,'[^[:alnum:]]+',' ','g'))||' ';
begin
 if auth.uid() is null or length(p_query)>500 then raise exception 'invalid_request'; end if;
 with ms as materialized (
 select m.id,m.canonical_name,m.default_category_id,m.user_id from public.merchants m
 where (m.user_id is null or m.user_id=(select auth.uid())) and
 ((p_filters is not null and m.id::text=p_filters->>'merchant_id') or
 (p_filters is null and (position(' '||lower(regexp_replace(m.canonical_name,'[^[:alnum:]]+',' ','g'))||' ' in q)>0
 or exists(select 1 from public.merchant_aliases a where a.merchant_id=m.id and (a.user_id is null or a.user_id=(select auth.uid())) and position(' '||lower(a.alias)||' ' in q)>0))))
 order by m.user_id nulls last,m.canonical_name limit 51
 ), ps as (
 select name from public.people where user_id=(select auth.uid()) and
 ((p_filters is not null and normalized_name=lower(trim(p_filters->>'person'))) or
 (p_filters is null and position(' '||lower(regexp_replace(name,'[^[:alnum:]]+',' ','g'))||' ' in q)>0)) order by name limit 51
 ), cs as (
 select name from public.contexts where user_id=(select auth.uid()) and
 ((p_filters is not null and normalized_name=lower(trim(p_filters->>'context'))) or
 (p_filters is null and position(' '||lower(regexp_replace(name,'[^[:alnum:]]+',' ','g'))||' ' in q)>0)) order by name limit 51
 ) select jsonb_build_object(
 'categories',(select jsonb_agg(to_jsonb(c) order by id) from public.categories c),
 'merchants',coalesce((select jsonb_agg(to_jsonb(ms)) from ms),'[]'::jsonb),
 'aliases',coalesce((select jsonb_agg(to_jsonb(a)) from (select alias,merchant_id,user_id from public.merchant_aliases where merchant_id in (select id from ms) limit 200) a),'[]'::jsonb),
 'people',coalesce((select jsonb_agg(to_jsonb(ps)) from ps),'[]'::jsonb),
 'contexts',coalesce((select jsonb_agg(to_jsonb(cs)) from cs),'[]'::jsonb),'rules','[]'::jsonb) into result;
 if jsonb_array_length(result->'merchants')>50 or jsonb_array_length(result->'people')>50 or jsonb_array_length(result->'contexts')>50 then raise exception 'query_too_broad'; end if;
 return result;
end $$;

-- Contexts active within a bounded window; totals describe that visible window,
-- not a guessed lifetime trip total. At most six context cards leave the DB.
create function public.finn_active_contexts(p_start date,p_end date)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or p_start is null or p_end is null or p_end<=p_start or p_end-p_start>93 then raise exception 'invalid_range'; end if;
 with active as materialized (
 select ec.context_id,max(t.occurred_on) last_activity,count(distinct t.entry_id) entry_count
 from public.transactions t join public.journal_entries e on e.id=t.entry_id and e.user_id=t.user_id
 join public.entry_contexts ec on ec.user_id=t.user_id and ec.entry_id=t.entry_id
 where t.user_id=(select auth.uid()) and e.deleted_at is null and t.direction='expense' and t.occurred_on>=p_start and t.occurred_on<p_end
 group by ec.context_id order by last_activity desc,ec.context_id limit 6
 ), amounts as (
 select ec.context_id,t.currency,
 coalesce(sum(t.amount_minor) filter(where t.amount_status='confirmed' and not t.needs_review),0)::text total_minor,
 count(*) filter(where t.amount_status='confirmed' and not t.needs_review) confirmed_count,
 count(*) filter(where t.amount_status<>'confirmed' or t.needs_review) review_count
 from active a join public.entry_contexts ec on ec.context_id=a.context_id and ec.user_id=(select auth.uid())
 join public.transactions t on t.user_id=ec.user_id and t.entry_id=ec.entry_id
 join public.journal_entries e on e.id=t.entry_id and e.user_id=t.user_id
 where e.deleted_at is null and t.direction='expense' and t.occurred_on>=p_start and t.occurred_on<p_end
 group by ec.context_id,t.currency
 ) select jsonb_build_object('start_date',p_start,'end_date',p_end,'contexts',coalesce(jsonb_agg(jsonb_build_object(
 'id',a.context_id,'name',c.name,'last_activity',a.last_activity,'entry_count',a.entry_count,
 'totals',(select jsonb_agg(jsonb_build_object('currency',currency,'total_minor',total_minor,'confirmed_count',confirmed_count,'review_count',review_count) order by currency) from amounts where context_id=a.context_id)
 ) order by a.last_activity desc,a.context_id),'[]'::jsonb)) into result
 from active a join public.contexts c on c.id=a.context_id and c.user_id=(select auth.uid());
 return result;
end $$;

-- First page calculates the full SQL answer once. Further pages use indexed
-- keyset retrieval and never rerun the model, totals or breakdown aggregations.
-- A journal revision watermark makes changed/deleted records restart the search
-- rather than silently mixing totals and pages from different journal versions.
create function public.finn_search_page(p_filters jsonb,p_limit integer default 20,p_cursor jsonb default null,p_revision text default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
 r text; result jsonb; rows jsonb; decorated jsonb; last_row jsonb;
 ds date:=(p_filters->>'start_date')::date; de date:=(p_filters->>'end_date')::date;
 dir text:=p_filters->>'direction'; cat text:=p_filters->>'category_id'; merchant uuid:=(p_filters->>'merchant_id')::uuid;
 person text:=p_filters->>'person'; context_name text:=p_filters->>'context'; query text:=p_filters->>'text'; cur text:=p_filters->>'currency';
 has_more boolean;
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 if dir is not null and dir not in ('expense','income','transfer','lent','borrowed','repayment') then raise exception 'invalid_direction'; end if;
 if ds is null or de is null or de<=ds or de-ds>3660 or p_limit is null or p_limit not between 1 and 30 then raise exception 'invalid_range'; end if;
 select coalesce((select revision::text from public.journal_search_revisions where user_id=(select auth.uid())),'0') into r;
 if p_cursor is not null and (p_revision is null or p_revision<>r) then return jsonb_build_object('stale',true); end if;
 if p_cursor is null then
  with matched as materialized (
   select t.currency,t.amount_minor,t.amount_status,t.needs_review
   from public.transactions t join public.journal_entries e on e.id=t.entry_id and e.user_id=t.user_id
  where t.user_id=(select auth.uid()) and e.deleted_at is null and t.occurred_on>=ds and t.occurred_on<de
   and (dir is null or t.direction=dir) and (cat is null or t.category_id=cat)
   and (merchant is null or t.merchant_id=merchant) and (cur is null or t.currency=cur)
   and (person is null or exists(select 1 from public.entry_people ep join public.people p on p.id=ep.person_id and p.user_id=ep.user_id where ep.user_id=t.user_id and ep.entry_id=t.entry_id and p.normalized_name=lower(trim(person))))
   and (context_name is null or exists(select 1 from public.entry_contexts ec join public.contexts c on c.id=ec.context_id and c.user_id=ec.user_id where ec.user_id=t.user_id and ec.entry_id=t.entry_id and c.normalized_name=lower(trim(context_name))))
   and (query is null or e.search_vector @@ websearch_to_tsquery('simple',query))
  ), totals as (
   select currency,coalesce(sum(amount_minor) filter(where amount_status='confirmed' and not needs_review),0)::text total_minor,
    count(*) filter(where amount_status='confirmed' and not needs_review) confirmed_count,
    count(*) filter(where amount_status<>'confirmed' or needs_review) review_count
   from matched group by currency
  ) select jsonb_build_object('totals',coalesce((select jsonb_agg(to_jsonb(totals) order by currency) from totals),'[]'::jsonb),
   'matching_count',(select count(*) from matched)) into result;
 else result:='{}'::jsonb;
 end if;
 select coalesce(jsonb_agg(to_jsonb(page) order by page.occurred_on desc,page.entry_id desc,page.id desc),'[]'::jsonb) into rows from (
  select t.id,t.entry_id,t.description,t.amount_minor::text amount_minor,t.currency,t.direction,t.cash_flow,
   t.category_id,c.name category_name,t.merchant_id,m.canonical_name merchant_name,t.occurred_on,
   t.amount_status,t.quantity,t.unit_price_minor::text unit_price_minor,t.needs_review,e.raw_text
  from public.transactions t join public.journal_entries e on e.id=t.entry_id and e.user_id=t.user_id
  join public.categories c on c.id=t.category_id left join public.merchants m on m.id=t.merchant_id
  where t.user_id=(select auth.uid()) and e.deleted_at is null and t.occurred_on>=ds and t.occurred_on<de
   and (dir is null or t.direction=dir) and (cat is null or t.category_id=cat)
   and (merchant is null or t.merchant_id=merchant) and (cur is null or t.currency=cur)
   and (person is null or exists(select 1 from public.entry_people ep join public.people p on p.id=ep.person_id and p.user_id=ep.user_id where ep.user_id=t.user_id and ep.entry_id=t.entry_id and p.normalized_name=lower(trim(person))))
   and (context_name is null or exists(select 1 from public.entry_contexts ec join public.contexts c on c.id=ec.context_id and c.user_id=ec.user_id where ec.user_id=t.user_id and ec.entry_id=t.entry_id and c.normalized_name=lower(trim(context_name))))
   and (query is null or e.search_vector @@ websearch_to_tsquery('simple',query))
   and (p_cursor is null or (t.occurred_on,t.entry_id,t.id)<((p_cursor->>'day')::date,(p_cursor->>'entry_id')::uuid,(p_cursor->>'id')::uuid))
  order by t.occurred_on desc,t.entry_id desc,t.id desc limit p_limit+1
 ) page;
 has_more:=jsonb_array_length(rows)>p_limit;
 select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) into decorated from jsonb_array_elements(rows) with ordinality a(value,ord) where ord<=p_limit;
 last_row:=decorated->(jsonb_array_length(decorated)-1);
 return (result-'transactions'-'offset')||jsonb_build_object('transactions',decorated,'revision',r,'has_more',has_more,'limit',p_limit,
 'next_cursor',case when has_more then jsonb_build_object('day',last_row->>'occurred_on','entry_id',last_row->>'entry_id','id',last_row->>'id') else null end);
end $$;

-- A bounded, per-user interpretation cache stores filters, not journal history.
create table public.search_plan_cache (
 user_id uuid not null references auth.users on delete cascade,
 cache_key text not null check(length(cache_key)=64), plan jsonb not null,
 created_at timestamptz not null default now(), expires_at timestamptz not null default(now()+interval '1 day'),
 primary key(user_id,cache_key)
);
alter table public.search_plan_cache enable row level security;
create policy own_search_plans on public.search_plan_cache for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.search_plan_cache from anon,authenticated;
grant select on public.search_plan_cache to authenticated;
grant all on public.search_plan_cache to service_role;
create function public.finn_cache_search_plan(p_user uuid,p_key text,p_plan jsonb)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 delete from public.search_plan_cache where user_id=p_user and (expires_at<now() or cache_key in
 (select cache_key from public.search_plan_cache where user_id=p_user order by created_at desc offset 29));
 insert into public.search_plan_cache(user_id,cache_key,plan) values(p_user,p_key,p_plan)
 on conflict(user_id,cache_key) do update set plan=excluded.plan,created_at=now(),expires_at=now()+interval '1 day';
end $$;
revoke all on function public.finn_cache_search_plan(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.finn_cache_search_plan(uuid,text,jsonb) to service_role;
revoke all on function public.finn_search_catalog(text,jsonb),public.finn_active_contexts(date,date),public.finn_search_page(jsonb,integer,jsonb,text) from public,anon;
grant execute on function public.finn_search_catalog(text,jsonb),public.finn_active_contexts(date,date),public.finn_search_page(jsonb,integer,jsonb,text) to authenticated;
