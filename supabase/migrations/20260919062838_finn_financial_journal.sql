-- Finn text capture backend. Apply to the intended Finn project; no remote changes
-- are made by generating this file. Mutations go through authenticated Edge APIs.
create schema if not exists finn_private;
revoke all on schema finn_private from public, anon, authenticated;
grant usage on schema finn_private to service_role;

create table public.currencies (
  code text primary key check (code ~ '^[A-Z]{3}$'),
  minor_digits smallint not null check (minor_digits between 0 and 3)
);
insert into public.currencies values
 ('INR',2),('USD',2),('EUR',2),('GBP',2),('JPY',0),('KRW',0),('KWD',3),
 ('BHD',3),('OMR',3),('AED',2),('SAR',2),('CAD',2),('AUD',2),('SGD',2),
 ('CHF',2),('CNY',2),('HKD',2),('NZD',2),('THB',2),('MYR',2),('IDR',2),('PHP',2),('VND',0);
create table public.categories (id text primary key, name text not null unique);
insert into public.categories values
 ('food','Food & Drinks'),('transport','Transport'),('shopping','Shopping'),
 ('bills','Bills'),('entertainment','Entertainment'),('health','Health'),
 ('education','Education'),('travel','Travel'),('software','Software'),
 ('subscriptions','Subscriptions'),('work','Work / Projects'),('income','Income'),
 ('transfer','Transfer'),('debt','Debt / Repayment'),('other','Other');
create table public.merchants (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade,
 canonical_name text not null check (length(canonical_name) between 1 and 100),
 normalized_name text generated always as (lower(trim(canonical_name))) stored,
 default_category_id text not null references public.categories,
 unique nulls not distinct (user_id, normalized_name)
);
create index merchants_category_idx on public.merchants(default_category_id);
insert into public.merchants(canonical_name,default_category_id) values
 ('Uber','transport'),('Ola','transport'),('Rapido','transport'),('Swiggy','food'),
 ('Zomato','food'),('Starbucks','food'),('Netflix','subscriptions'),('Spotify','subscriptions'),
 ('Figma','software'),('Amazon','shopping');
create table public.merchant_aliases (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade,
 alias text not null check (length(alias) between 1 and 100),
 merchant_id uuid not null references public.merchants on delete cascade,
 unique nulls not distinct (user_id, alias)
);
create index merchant_aliases_merchant_idx on public.merchant_aliases(merchant_id);
insert into public.merchant_aliases(alias,merchant_id)
 select a.alias,m.id from (values ('uber','Uber'),('uber trip','Uber'),('uber india','Uber'),
 ('ola','Ola'),('rapido','Rapido'),('swiggy','Swiggy'),('zomato','Zomato'),
 ('starbucks','Starbucks'),('netflix','Netflix'),('spotify','Spotify'),('figma','Figma'),('amazon','Amazon')) a(alias,name)
 join public.merchants m on m.canonical_name=a.name and m.user_id is null;
create table public.category_rules (
 user_id uuid not null references auth.users on delete cascade,
 merchant_key text not null check (length(merchant_key) between 1 and 100),
 category_id text not null references public.categories,
 updated_at timestamptz not null default now(), primary key(user_id,merchant_key)
);
create index category_rules_category_idx on public.category_rules(category_id);
create table public.journal_entries (
 id uuid primary key, user_id uuid not null references auth.users on delete cascade,
 original_text text not null check (length(original_text) between 1 and 4000),
 raw_text text not null check (length(raw_text) between 1 and 4000),
 capture_request jsonb not null, captured_at timestamptz not null, occurred_at timestamptz not null,
 occurred_on date not null, timezone text not null,
 currency text not null references public.currencies,
 extraction jsonb not null, revision integer not null default 1 check(revision > 0),
 llm_attempted boolean not null default false,
 search_text text not null default '',
 search_vector tsvector generated always as (to_tsvector('simple',search_text)) stored,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, unique(user_id,id)
);
create index journal_user_day_idx on public.journal_entries(user_id,occurred_on desc,id);
create index journal_currency_idx on public.journal_entries(currency);
create index journal_search_idx on public.journal_entries using gin(search_vector);
create table public.people (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 name text not null check (length(name) between 1 and 100),
 normalized_name text generated always as (lower(trim(name))) stored,
 unique(user_id,normalized_name), unique(user_id,id)
);
create table public.contexts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 name text not null check (length(name) between 1 and 100),
 normalized_name text generated always as (lower(trim(name))) stored,
 unique(user_id,normalized_name), unique(user_id,id)
);
create table public.entry_people (
 user_id uuid not null, entry_id uuid not null, person_id uuid not null,
 primary key(user_id,entry_id,person_id),
 foreign key(user_id,entry_id) references public.journal_entries(user_id,id) on delete cascade,
 foreign key(user_id,person_id) references public.people(user_id,id) on delete cascade
);
create index entry_people_person_idx on public.entry_people(user_id,person_id,entry_id);
create table public.entry_contexts (
 user_id uuid not null, entry_id uuid not null, context_id uuid not null,
 primary key(user_id,entry_id,context_id),
 foreign key(user_id,entry_id) references public.journal_entries(user_id,id) on delete cascade,
 foreign key(user_id,context_id) references public.contexts(user_id,id) on delete cascade
);
create index entry_contexts_context_idx on public.entry_contexts(user_id,context_id,entry_id);
create table public.transactions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null,
 entry_id uuid not null, ordinal integer not null,
 description text not null,
 amount_minor bigint check(amount_minor between 0 and 9007199254740991),
 currency text not null references public.currencies,
 direction text not null check(direction in ('expense','income','transfer','lent','borrowed','repayment')),
 cash_flow text not null check(cash_flow in ('in','out','internal','unknown')),
 category_id text not null references public.categories,
 category_source text not null check(category_source in ('merchant_rule','keyword_rule','user_correction','llm_fallback','unresolved')),
 merchant_id uuid references public.merchants,
 person_id uuid,
 occurred_at timestamptz not null, occurred_on date not null,
 amount_status text not null check(amount_status in ('confirmed','missing','estimated')),
 quantity integer check(quantity between 1 and 100000),
 unit_price_minor bigint check(unit_price_minor between 0 and 9007199254740991),
 confidence numeric(4,3) not null check(confidence between 0 and 1),
 needs_review boolean not null, unresolved jsonb not null, evidence text,
 foreign key(user_id,entry_id) references public.journal_entries(user_id,id) on delete cascade,
 foreign key(user_id,person_id) references public.people(user_id,id),
 unique(user_id,entry_id,ordinal),
 check((amount_status='missing') = (amount_minor is null)),
 check(unit_price_minor is null or (quantity is not null and amount_minor is not null and amount_minor::numeric=unit_price_minor::numeric*quantity))
);
create index transactions_user_date_idx on public.transactions(user_id,occurred_at);
create index transactions_user_day_idx on public.transactions(user_id,occurred_on);
create index transactions_category_date_idx on public.transactions(user_id,category_id,occurred_on);
create index transactions_merchant_date_idx on public.transactions(user_id,merchant_id,occurred_on);
create index transactions_person_idx on public.transactions(user_id,person_id);
create index transactions_category_fk_idx on public.transactions(category_id);
create index transactions_merchant_fk_idx on public.transactions(merchant_id);
create index transactions_currency_fk_idx on public.transactions(currency);
create table public.extraction_audits (
 id uuid primary key default gen_random_uuid(), user_id uuid not null,
 entry_id uuid not null, revision integer not null, event text not null,
 payload jsonb not null, created_at timestamptz not null default now(),
 foreign key(user_id,entry_id) references public.journal_entries(user_id,id) on delete cascade
);
create index audits_entry_idx on public.extraction_audits(user_id,entry_id);
create table finn_private.usage_counters (
 user_id uuid not null references auth.users on delete cascade,
 bucket text not null, period text not null, requests integer not null default 0,
 primary key(user_id,bucket,period)
);
create table public.backend_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 event text not null, model text, input_tokens integer, output_tokens integer,
 estimated_cost_usd numeric(20,10), -- null unless operator supplied verified pricing
 metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create index backend_events_user_time_idx on public.backend_events(user_id,created_at);
create table finn_private.mutations (
 user_id uuid not null references auth.users on delete cascade,
 operation_id uuid not null, request jsonb not null, response jsonb not null,
 primary key(user_id,operation_id)
);

-- Read access is RLS protected. No client can bypass validation or manufacture
-- extraction audits, quota reservations, or corrected financial records.
alter table public.currencies enable row level security;
alter table public.categories enable row level security;
alter table public.merchants enable row level security;
alter table public.merchant_aliases enable row level security;
create policy currencies_read on public.currencies for select to authenticated using(true);
create policy categories_read on public.categories for select to authenticated using(true);
create policy merchants_read on public.merchants for select to authenticated using(user_id is null or user_id=(select auth.uid()));
create policy aliases_read on public.merchant_aliases for select to authenticated using(user_id is null or user_id=(select auth.uid()));
do $$ declare t text; begin
 foreach t in array array['category_rules','journal_entries','people','contexts','entry_people','entry_contexts','transactions','extraction_audits','backend_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy owner_read on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
 end loop;
end $$;
alter table finn_private.usage_counters enable row level security;
alter table finn_private.mutations enable row level security;
revoke all on public.currencies,public.categories,public.merchants,public.merchant_aliases,
 public.category_rules,public.journal_entries,public.people,public.contexts,public.entry_people,
 public.entry_contexts,public.transactions,public.extraction_audits,public.backend_events from anon,authenticated;
grant select on public.currencies,public.categories,public.merchants,public.merchant_aliases,
 public.category_rules,public.journal_entries,public.people,public.contexts,public.entry_people,
 public.entry_contexts,public.transactions,public.extraction_audits,public.backend_events to authenticated;
grant all on all tables in schema finn_private to service_role;
grant all on public.currencies,public.categories,public.merchants,public.merchant_aliases,
 public.category_rules,public.journal_entries,public.people,public.contexts,public.entry_people,
 public.entry_contexts,public.transactions,public.extraction_audits,public.backend_events to service_role;

create function public.finn_entry_document(p_user uuid,p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',id,'raw_text',raw_text,'original_text',original_text,
 'captured_at',captured_at,'occurred_on',occurred_on,'timezone',timezone,'currency',currency,
 'revision',revision,'extraction',extraction,'deleted_at',deleted_at)
 from public.journal_entries where user_id=p_user and id=p_id;
$$;

-- An atomic write replaces normalized children and the cached document together.
-- Optimistic revisions prevent slow enrichment overwriting a human correction.
create function public.finn_commit_entry(p_user uuid,p_input jsonb,p_extraction jsonb,p_audit jsonb,
 p_expected_revision integer default null,p_operation_id uuid default null,p_rule jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 eid uuid := (p_input->>'id')::uuid; existing public.journal_entries;
 tx jsonb; item jsonb; nm text; pid uuid; mid uuid; idx integer:=0; doc jsonb;
 request jsonb := jsonb_build_object('input',p_input,'extraction',p_extraction,'revision',p_expected_revision,'rule',p_rule);
 previous finn_private.mutations; search_terms text; day date; rev integer;
begin
 if p_user is null then raise exception 'unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if p_operation_id is not null then
  select * into previous from finn_private.mutations where user_id=p_user and operation_id=p_operation_id;
  if found then
   if previous.request<>request then raise exception 'idempotency_conflict'; end if;
   return previous.response;
  end if;
 end if;
 select * into existing from public.journal_entries where id=eid for update;
 if found then
  if existing.user_id<>p_user then raise exception 'entry_conflict'; end if;
  if p_expected_revision is null then
   if existing.capture_request<>p_input then raise exception 'idempotency_conflict'; end if;
   return public.finn_entry_document(p_user,eid);
  end if;
  if existing.revision<>p_expected_revision or existing.deleted_at is not null then raise exception 'revision_conflict'; end if;
  rev:=existing.revision+1;
 else
  if p_expected_revision is not null then raise exception 'entry_not_found'; end if;
  rev:=1;
 end if;
 if jsonb_array_length(p_extraction->'transactions') not between 1 and 30 then raise exception 'invalid_transactions'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_input->>'timezone') then raise exception 'invalid_timezone'; end if;
 -- The journal follows the primary transaction's effective day, while capture
 -- timestamp and its reference date remain immutable in capture_request.
 day:=(p_extraction->'transactions'->0->>'occurred_on')::date;
 search_terms:=p_input->>'raw_text';
 if rev=1 then
  insert into public.journal_entries(id,user_id,original_text,raw_text,capture_request,captured_at,occurred_at,occurred_on,timezone,currency,extraction)
  values(eid,p_user,p_input->>'raw_text',p_input->>'raw_text',p_input,(p_input->>'captured_at')::timestamptz,
    (day::timestamp+interval '12 hours') at time zone (p_input->>'timezone'),day,p_input->>'timezone',p_input->>'currency',p_extraction);
 else
  update public.journal_entries set raw_text=p_input->>'raw_text',occurred_on=day,
   occurred_at=(day::timestamp+interval '12 hours') at time zone (p_input->>'timezone'),timezone=p_input->>'timezone',
   currency=p_input->>'currency',extraction=p_extraction,revision=rev,updated_at=now() where user_id=p_user and id=eid;
  delete from public.transactions where user_id=p_user and entry_id=eid;
  delete from public.entry_people where user_id=p_user and entry_id=eid;
  delete from public.entry_contexts where user_id=p_user and entry_id=eid;
 end if;
 for nm in select jsonb_array_elements_text(p_extraction->'people') loop
  insert into public.people(user_id,name) values(p_user,trim(nm)) on conflict(user_id,normalized_name) do update set name=excluded.name returning id into pid;
  insert into public.entry_people values(p_user,eid,pid) on conflict do nothing;
  search_terms:=search_terms||' '||nm;
 end loop;
 for nm in select jsonb_array_elements_text(p_extraction->'contexts') loop
  insert into public.contexts(user_id,name) values(p_user,trim(nm)) on conflict(user_id,normalized_name) do update set name=excluded.name returning id into pid;
  insert into public.entry_contexts values(p_user,eid,pid) on conflict do nothing;
  search_terms:=search_terms||' '||nm;
 end loop;
 for tx in select value from jsonb_array_elements(p_extraction->'transactions') loop
  mid:=(tx->>'merchant_id')::uuid; pid:=null;
  if mid is not null and not exists(select 1 from public.merchants where id=mid and (user_id is null or user_id=p_user)) then raise exception 'invalid_merchant'; end if;
  if tx->>'person' is not null then
   select id into pid from public.people where user_id=p_user and normalized_name=lower(trim(tx->>'person'));
   if pid is null then raise exception 'invalid_person'; end if;
  end if;
  insert into public.transactions(user_id,entry_id,ordinal,description,amount_minor,currency,direction,cash_flow,
   category_id,category_source,merchant_id,person_id,occurred_at,occurred_on,amount_status,quantity,unit_price_minor,confidence,needs_review,unresolved,evidence)
  values(p_user,eid,idx,tx->>'description',(tx->>'amount_minor')::bigint,tx->>'currency',tx->>'direction',tx->>'cash_flow',
   tx->>'category_id',tx->>'category_source',mid,pid,((tx->>'occurred_on')::date::timestamp+interval '12 hours') at time zone (p_input->>'timezone'),
   (tx->>'occurred_on')::date,tx->>'amount_status',(tx->>'quantity')::integer,(tx->>'unit_price_minor')::bigint,
   (tx->>'confidence')::numeric,(tx->>'needs_review')::boolean,tx->'unresolved',tx->>'evidence');
  idx:=idx+1;
  search_terms:=search_terms||' '||coalesce(tx->>'description','')||' '||coalesce((select name from public.categories where id=tx->>'category_id'),'')||' '||coalesce((select canonical_name from public.merchants where id=mid),'');
 end loop;
 update public.journal_entries set search_text=search_terms where user_id=p_user and id=eid;
 if p_rule is not null then
  insert into public.category_rules(user_id,merchant_key,category_id)
  values(p_user,p_rule->>'merchant_key',p_rule->>'category_id')
  on conflict(user_id,merchant_key) do update set category_id=excluded.category_id,updated_at=now();
 end if;
 insert into public.extraction_audits(user_id,entry_id,revision,event,payload)
 values(p_user,eid,rev,coalesce(p_audit->>'event','capture'),p_audit);
 doc:=public.finn_entry_document(p_user,eid);
 if p_operation_id is not null then insert into finn_private.mutations values(p_user,p_operation_id,request,doc); end if;
 return doc;
end $$;

create function public.finn_reserve_quota(p_user uuid,p_bucket text,p_daily integer,p_monthly integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare d text:=to_char(now() at time zone 'UTC','YYYY-MM-DD'); m text:=to_char(now() at time zone 'UTC','YYYY-MM'); dc integer; mc integer;
begin
 if p_user is null or p_daily<1 or p_monthly<1 then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select requests into dc from finn_private.usage_counters where user_id=p_user and bucket=p_bucket and period=d;
 select requests into mc from finn_private.usage_counters where user_id=p_user and bucket=p_bucket and period=m;
 if coalesce(dc,0)>=p_daily or coalesce(mc,0)>=p_monthly then return false; end if;
 insert into finn_private.usage_counters values(p_user,p_bucket,d,1),(p_user,p_bucket,m,1)
 on conflict(user_id,bucket,period) do update set requests=finn_private.usage_counters.requests+1;
 return true;
end $$;
create function public.finn_claim_enrichment(p_user uuid,p_id uuid,p_revision integer)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.journal_entries set llm_attempted=true where user_id=p_user and id=p_id and revision=p_revision and not llm_attempted and deleted_at is null;
 return found;
end $$;
create function public.finn_delete_entry(p_user uuid,p_id uuid,p_revision integer,p_operation_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare old finn_private.mutations; request jsonb:=jsonb_build_object('delete',p_id,'revision',p_revision); doc jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into old from finn_private.mutations where user_id=p_user and operation_id=p_operation_id;
 if found then
  if old.request<>request then raise exception 'idempotency_conflict'; end if;
  return old.response;
 end if;
 update public.journal_entries set deleted_at=now(),revision=revision+1,updated_at=now()
 where user_id=p_user and id=p_id and revision=p_revision and deleted_at is null;
 if not found then raise exception 'revision_conflict'; end if;
 doc:=public.finn_entry_document(p_user,p_id);
 insert into finn_private.mutations values(p_user,p_operation_id,request,doc);
 return doc;
end $$;

-- Every filter is a typed parameter. AI never supplies SQL or arithmetic.
create function public.finn_search(p_start date,p_end date,p_direction text default 'expense',
 p_category text default null,p_merchant uuid default null,p_person text default null,
 p_context text default null,p_text text default null,p_currency text default null,
 p_offset integer default 0,p_limit integer default 50)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>3660 or p_limit not between 1 and 100 or p_offset not between 0 and 100000 then raise exception 'invalid_range'; end if;
 if p_direction is not null and p_direction not in ('expense','income','transfer','lent','borrowed','repayment') then raise exception 'invalid_direction'; end if;
 with matched as materialized (
  select t.*, e.raw_text from public.transactions t join public.journal_entries e on e.id=t.entry_id and e.user_id=t.user_id
  where t.user_id=(select auth.uid()) and e.deleted_at is null and t.occurred_on>=p_start and t.occurred_on<p_end
   and (p_direction is null or t.direction=p_direction) and (p_category is null or t.category_id=p_category)
   and (p_merchant is null or t.merchant_id=p_merchant) and (p_currency is null or t.currency=p_currency)
   and (p_person is null or exists(select 1 from public.entry_people ep join public.people p on p.id=ep.person_id and p.user_id=ep.user_id where ep.user_id=t.user_id and ep.entry_id=t.entry_id and p.normalized_name=lower(trim(p_person))))
   and (p_context is null or exists(select 1 from public.entry_contexts ec join public.contexts c on c.id=ec.context_id and c.user_id=ec.user_id where ec.user_id=t.user_id and ec.entry_id=t.entry_id and c.normalized_name=lower(trim(p_context))))
   and (p_text is null or e.search_vector @@ websearch_to_tsquery('simple',p_text))
 ), totals as (
  select currency,coalesce(sum(amount_minor) filter(where amount_status='confirmed' and not needs_review),0)::text total_minor,
   count(*) filter(where amount_status='confirmed' and not needs_review) confirmed_count,
   count(*) filter(where amount_status<>'confirmed' or needs_review) review_count from matched group by currency
 ), categories as (
  select currency,category_id,sum(amount_minor)::text total_minor from matched where amount_status='confirmed' and not needs_review group by currency,category_id
 ), merchants as (
  select currency,merchant_id,sum(amount_minor)::text total_minor from matched where amount_status='confirmed' and not needs_review group by currency,merchant_id
 ), page as (select * from matched order by occurred_on desc,entry_id,id limit p_limit offset p_offset)
 select jsonb_build_object('totals',coalesce((select jsonb_agg(to_jsonb(totals)) from totals),'[]'::jsonb),
  'matching_count',(select count(*) from matched),'offset',p_offset,'limit',p_limit,
  'transactions',coalesce((select jsonb_agg(to_jsonb(page)||jsonb_build_object('amount_minor',amount_minor::text,'unit_price_minor',unit_price_minor::text)) from page),'[]'::jsonb),
  'categories',coalesce((select jsonb_agg(to_jsonb(categories)) from categories),'[]'::jsonb),
  'merchants',coalesce((select jsonb_agg(to_jsonb(merchants)) from merchants),'[]'::jsonb)) into result;
 return result;
end $$;

create view public.confirmed_transactions with (security_invoker=true) as
 select t.* from public.transactions t join public.journal_entries e on e.user_id=t.user_id and e.id=t.entry_id
 where e.deleted_at is null and t.amount_status='confirmed' and not t.needs_review;
create view public.spending_by_category with (security_invoker=true) as
 select user_id,currency,category_id,date_trunc('month',occurred_on::timestamp)::date as "month",sum(amount_minor)::text total_minor
 from public.confirmed_transactions where direction='expense' group by 1,2,3,4;
create view public.spending_by_merchant with (security_invoker=true) as
 select user_id,currency,merchant_id,date_trunc('month',occurred_on::timestamp)::date as "month",sum(amount_minor)::text total_minor
 from public.confirmed_transactions where direction='expense' group by 1,2,3,4;
create view public.spending_by_person with (security_invoker=true) as
 select t.user_id,t.currency,ep.person_id,date_trunc('month',t.occurred_on::timestamp)::date as "month",sum(t.amount_minor)::text total_minor
 from public.confirmed_transactions t join public.entry_people ep on ep.user_id=t.user_id and ep.entry_id=t.entry_id
 where t.direction='expense' group by 1,2,3,4;
create view public.spending_by_context with (security_invoker=true) as
 select t.user_id,t.currency,ec.context_id,date_trunc('month',t.occurred_on::timestamp)::date as "month",sum(t.amount_minor)::text total_minor
 from public.confirmed_transactions t join public.entry_contexts ec on ec.user_id=t.user_id and ec.entry_id=t.entry_id
 where t.direction='expense' group by 1,2,3,4;
create view public.monthly_comparison with (security_invoker=true) as
 with monthly as (
  select user_id,currency,date_trunc('month',occurred_on::timestamp)::date as "month",sum(amount_minor) total
  from public.confirmed_transactions where direction='expense' group by 1,2,3
 ) select a.user_id,a.currency,a."month",a.total::text total_minor,coalesce(b.total,0)::text previous_month_minor,
 (a.total-coalesce(b.total,0))::text difference_minor
 from monthly a left join monthly b on b.user_id=a.user_id and b.currency=a.currency and b."month"=(a."month"-interval '1 month')::date;
create view public.recurring_candidates with (security_invoker=true) as
 select user_id,currency,merchant_id,count(*) occurrences,min(occurred_on) first_date,max(occurred_on) last_date,
 min(amount_minor)::text minimum_minor,max(amount_minor)::text maximum_minor
 from public.confirmed_transactions where direction='expense' and merchant_id is not null
 group by user_id,currency,merchant_id having count(distinct date_trunc('month',occurred_on::timestamp))>=3;
-- Net receivable: positive means they owe the user; negative means user owes them.
-- Repayments without an explicit counterparty/cash-flow remain excluded.
create view public.lending_balances with (security_invoker=true) as
 select user_id,currency,person_id,sum(case when direction='lent' or (direction='repayment' and cash_flow='out')
 then amount_minor else -amount_minor end)::text net_receivable_minor
 from public.confirmed_transactions where person_id is not null and
 (direction in ('lent','borrowed') or (direction='repayment' and cash_flow in ('in','out')))
 group by user_id,currency,person_id;
grant select on public.confirmed_transactions,public.spending_by_category,public.spending_by_merchant,
 public.spending_by_person,public.spending_by_context,public.monthly_comparison,public.recurring_candidates,public.lending_balances to authenticated;

-- Explicitly revoke Postgres' default PUBLIC execution. No SECURITY DEFINER code.
revoke all on function public.finn_entry_document(uuid,uuid) from public,anon,authenticated;
revoke all on function public.finn_commit_entry(uuid,jsonb,jsonb,jsonb,integer,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.finn_reserve_quota(uuid,text,integer,integer) from public,anon,authenticated;
revoke all on function public.finn_claim_enrichment(uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.finn_delete_entry(uuid,uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.finn_search(date,date,text,text,uuid,text,text,text,text,integer,integer) from public,anon;
grant execute on function public.finn_entry_document(uuid,uuid),
 public.finn_commit_entry(uuid,jsonb,jsonb,jsonb,integer,uuid,jsonb),public.finn_reserve_quota(uuid,text,integer,integer),
 public.finn_claim_enrichment(uuid,uuid,integer),public.finn_delete_entry(uuid,uuid,integer,uuid) to service_role;
grant execute on function public.finn_search(date,date,text,text,uuid,text,text,text,text,integer,integer) to authenticated;
