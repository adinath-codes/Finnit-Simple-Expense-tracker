-- Revision-aware delta sync and private bounded caches. Existing clients remain
-- compatible: the journal tables and the legacy read paths are unchanged.

create table finn_private.journal_sync_changes (
  user_id uuid not null references auth.users on delete cascade,
  revision bigint not null,
  entry_id uuid not null,
  changed_at timestamptz not null default now(),
  primary key (user_id, revision, entry_id)
);
create index journal_sync_changes_retention_idx
  on finn_private.journal_sync_changes(user_id, changed_at, revision);

create table finn_private.journal_sync_state (
  user_id uuid primary key references auth.users on delete cascade,
  floor_revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table finn_private.journal_sync_changes enable row level security;
alter table finn_private.journal_sync_state enable row level security;
revoke all on finn_private.journal_sync_changes, finn_private.journal_sync_state
  from public, anon, authenticated;
grant all on finn_private.journal_sync_changes, finn_private.journal_sync_state
  to service_role;

-- One trigger owns both the search revision and the delta-sync record so they
-- can never disagree. Account deletion intentionally produces no new record.
create or replace function public.finn_bump_search_revision()
returns trigger language plpgsql security definer set search_path='' as $$
declare owner_id uuid; next_revision bigint; changed_entry uuid;
begin
  owner_id := case when TG_OP='DELETE' then old.user_id else new.user_id end;
  changed_entry := case when TG_OP='DELETE' then old.id else new.id end;
  if exists(select 1 from auth.users where id=owner_id) then
    insert into public.journal_search_revisions(user_id,revision)
      values(owner_id,1)
    on conflict(user_id) do update
      set revision=public.journal_search_revisions.revision+1
    returning revision into next_revision;
    insert into finn_private.journal_sync_changes(user_id,revision,entry_id)
      values(owner_id,next_revision,changed_entry)
    on conflict do nothing;
  end if;
  return null;
end; $$;
revoke all on function public.finn_bump_search_revision()
  from public,anon,authenticated;

-- Delta clients need the immutable capture descriptor to reconstruct the exact
-- local request, including a selected reference date, without guessing.
create or replace function public.finn_entry_document(p_user uuid,p_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'id',e.id,'source_type',e.source_type,'raw_text',e.raw_text,
    'original_text',e.original_text,'captured_at',e.captured_at,
    'occurred_on',e.occurred_on,'timezone',e.timezone,'currency',e.currency,
    'revision',e.revision,'extraction',e.extraction,
    'extraction_status',e.extraction_status,
    'extraction_schema_version',e.extraction_schema_version,
    'interpretation_summary',e.interpretation_summary,
    'deleted_at',e.deleted_at,'capture_request',e.capture_request,
    'receipt',case when a.id is null then null else jsonb_build_object(
      'id',a.id,'status',a.status,'merchant_name',a.merchant_name,
      'purchase_date_text',a.purchase_date_text,
      'printed_subtotal_minor',a.printed_subtotal_minor::text,
      'printed_total_minor',a.printed_total_minor::text,
      'currency',a.currency,'confidence',a.confidence,
      'needs_review',a.needs_review,'truncated',a.truncated,'model',a.model,
      'lines',coalesce((select jsonb_agg(jsonb_build_object(
        'id',l.id,'ordinal',l.ordinal,'kind',l.kind,
        'description',l.description,'quantity',l.quantity,
        'unit_price_minor',l.unit_price_minor::text,
        'amount_minor',l.amount_minor::text,'currency',l.currency,
        'category_id',l.category_id,'confidence',l.confidence,
        'needs_review',l.needs_review,'evidence_text',l.evidence_text,
        'provisional',false) order by l.ordinal)
        from public.receipt_line_items l
        where l.user_id=e.user_id and l.entry_id=e.id),'[]'::jsonb)
    ) end
  )
  from public.journal_entries e
  left join public.receipt_attachments a
    on a.user_id=e.user_id and a.entry_id=e.id
  where e.user_id=p_user and e.id=p_id;
$$;
revoke all on function public.finn_entry_document(uuid,uuid)
  from public,anon,authenticated;

-- Pruning records the greatest removed revision. A device behind that floor is
-- explicitly told to bootstrap instead of silently accepting an incomplete delta.
create function public.finn_prune_sync_changes(p_user uuid)
returns bigint language plpgsql security definer set search_path='' as $$
declare removed_through bigint; count_boundary bigint;
begin
  if p_user is null then raise exception 'invalid_user'; end if;
  select revision into count_boundary
  from finn_private.journal_sync_changes
  where user_id=p_user
  order by revision desc,entry_id desc
  offset 9999 limit 1;

  with removed as (
    delete from finn_private.journal_sync_changes
    where user_id=p_user and (
      changed_at < now()-interval '90 days'
      or (count_boundary is not null and revision<count_boundary)
    )
    returning revision
  ) select max(revision) into removed_through from removed;

  if removed_through is not null then
    insert into finn_private.journal_sync_state(user_id,floor_revision,updated_at)
      values(p_user,removed_through,now())
    on conflict(user_id) do update set
      floor_revision=greatest(
        finn_private.journal_sync_state.floor_revision,
        excluded.floor_revision
      ), updated_at=now();
  end if;
  return coalesce((select floor_revision from finn_private.journal_sync_state
    where user_id=p_user),0);
end; $$;
revoke all on function public.finn_prune_sync_changes(uuid)
  from public,anon,authenticated;
grant execute on function public.finn_prune_sync_changes(uuid) to service_role;

-- Bootstrap pages use entry IDs. Delta pages use (change revision, entry ID).
-- Documents are resolved at read time; if an entry changes after the fixed
-- snapshot, the newer document is safe to return and is delivered again by the
-- next delta because its later change revision remains above the checkpoint.
create function public.finn_sync_journal(
  p_after_revision text default null,
  p_snapshot_revision text default null,
  p_cursor jsonb default null,
  p_limit integer default 200
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid := (select auth.uid());
  current_revision bigint; after_revision bigint; snapshot_revision bigint;
  floor_revision bigint; cursor_revision bigint; cursor_entry uuid;
  rows jsonb; next_cursor jsonb; has_more boolean; bootstrap boolean;
begin
  if owner_id is null then raise exception 'unauthorized'; end if;
  if p_limit is null or p_limit not between 1 and 200 then
    raise exception 'invalid_limit';
  end if;
  if p_after_revision is not null and p_after_revision !~ '^\d{1,19}$' then
    raise exception 'invalid_revision';
  end if;
  if p_snapshot_revision is not null and p_snapshot_revision !~ '^\d{1,19}$' then
    raise exception 'invalid_revision';
  end if;

  select coalesce((select revision from public.journal_search_revisions
    where user_id=owner_id),0) into current_revision;
  after_revision := case when p_after_revision is null then null
    else p_after_revision::bigint end;
  snapshot_revision := coalesce(p_snapshot_revision::bigint,current_revision);
  if snapshot_revision>current_revision then raise exception 'invalid_snapshot'; end if;

  floor_revision := public.finn_prune_sync_changes(owner_id);
  if after_revision is not null and after_revision<floor_revision then
    return jsonb_build_object(
      'snapshot_revision',current_revision::text,'changes','[]'::jsonb,
      'next_cursor',null,'reset_required',true,'bootstrap',false
    );
  end if;

  bootstrap := after_revision is null;
  if bootstrap then
    if p_cursor is not null then
      cursor_entry := nullif(p_cursor->>'entry_id','')::uuid;
    end if;
    with candidates as materialized (
      select id from public.journal_entries
      where user_id=owner_id and (cursor_entry is null or id>cursor_entry)
      order by id limit p_limit+1
    ), page as (
      select id,row_number() over(order by id) ordinal from candidates
      order by id limit p_limit
    )
    select
      coalesce(jsonb_agg(public.finn_entry_document(owner_id,id)
        order by ordinal),'[]'::jsonb),
      (select count(*)>p_limit from candidates),
      (select case when (select count(*)>p_limit from candidates)
        then jsonb_build_object('entry_id',id) else null end
       from page order by ordinal desc limit 1)
    into rows,has_more,next_cursor from page;
  else
    if p_cursor is not null then
      if coalesce(p_cursor->>'revision','') !~ '^\d{1,19}$' then
        raise exception 'invalid_cursor';
      end if;
      cursor_revision := (p_cursor->>'revision')::bigint;
      cursor_entry := (p_cursor->>'entry_id')::uuid;
    end if;
    with latest as materialized (
      select entry_id,max(revision) revision
      from finn_private.journal_sync_changes
      where user_id=owner_id and revision>after_revision
        and revision<=snapshot_revision
      group by entry_id
    ), candidates as materialized (
      select entry_id,revision from latest
      where cursor_revision is null
        or (revision,entry_id)>(cursor_revision,cursor_entry)
      order by revision,entry_id limit p_limit+1
    ), page as (
      select entry_id,revision,row_number() over(order by revision,entry_id) ordinal
      from candidates order by revision,entry_id limit p_limit
    )
    select
      coalesce(jsonb_agg(public.finn_entry_document(owner_id,entry_id)
        order by ordinal),'[]'::jsonb),
      (select count(*)>p_limit from candidates),
      (select case when (select count(*)>p_limit from candidates)
        then jsonb_build_object('revision',revision::text,'entry_id',entry_id)
        else null end from page order by ordinal desc limit 1)
    into rows,has_more,next_cursor from page;
  end if;

  return jsonb_build_object(
    'snapshot_revision',snapshot_revision::text,
    'changes',coalesce(rows,'[]'::jsonb),
    'next_cursor',case when has_more then next_cursor else null end,
    'reset_required',false,'bootstrap',bootstrap
  );
end; $$;
revoke all on function public.finn_sync_journal(text,text,jsonb,integer)
  from public,anon;
grant execute on function public.finn_sync_journal(text,text,jsonb,integer)
  to authenticated,service_role;

-- Private bounded caches for validated advanced SQL plans and safe explanations.
create table finn_private.ask_sql_plan_cache (
  user_id uuid not null references auth.users on delete cascade,
  cache_key text not null check(length(cache_key)=64),
  plan jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '1 day',
  primary key(user_id,cache_key)
);
create table finn_private.ask_explanation_cache (
  user_id uuid not null references auth.users on delete cascade,
  cache_key text not null check(length(cache_key)=64),
  explanation text not null check(length(explanation) between 1 and 700),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '1 day',
  primary key(user_id,cache_key)
);
alter table finn_private.ask_sql_plan_cache enable row level security;
alter table finn_private.ask_explanation_cache enable row level security;
revoke all on finn_private.ask_sql_plan_cache,finn_private.ask_explanation_cache
  from public,anon,authenticated;
grant all on finn_private.ask_sql_plan_cache,finn_private.ask_explanation_cache
  to service_role;

create function public.finn_get_ask_sql_plan(p_user uuid,p_key text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if length(p_key)<>64 then return null; end if;
  return (select plan from finn_private.ask_sql_plan_cache
    where user_id=p_user and cache_key=p_key and expires_at>now());
end; $$;
create function public.finn_cache_ask_sql_plan(p_user uuid,p_key text,p_plan jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
  if length(p_key)<>64 or p_plan is null then raise exception 'invalid_cache'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,41));
  delete from finn_private.ask_sql_plan_cache where user_id=p_user and
    (expires_at<=now() or cache_key in (select cache_key
      from finn_private.ask_sql_plan_cache where user_id=p_user
      order by created_at desc offset 29));
  insert into finn_private.ask_sql_plan_cache(user_id,cache_key,plan)
    values(p_user,p_key,p_plan)
  on conflict(user_id,cache_key) do update set
    plan=excluded.plan,created_at=now(),expires_at=now()+interval '1 day';
end; $$;
create function public.finn_get_ask_explanation(p_user uuid,p_key text)
returns text language plpgsql stable security definer set search_path='' as $$
begin
  if length(p_key)<>64 then return null; end if;
  return (select explanation from finn_private.ask_explanation_cache
    where user_id=p_user and cache_key=p_key and expires_at>now());
end; $$;
create function public.finn_cache_ask_explanation(
  p_user uuid,p_key text,p_explanation text
) returns void language plpgsql security definer set search_path='' as $$
begin
  if length(p_key)<>64 or length(p_explanation) not between 1 and 700
    or p_explanation ~ '[0-9₹$€£¥]'
    then raise exception 'invalid_cache'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,42));
  delete from finn_private.ask_explanation_cache where user_id=p_user and
    (expires_at<=now() or cache_key in (select cache_key
      from finn_private.ask_explanation_cache where user_id=p_user
      order by created_at desc offset 29));
  insert into finn_private.ask_explanation_cache(user_id,cache_key,explanation)
    values(p_user,p_key,p_explanation)
  on conflict(user_id,cache_key) do update set
    explanation=excluded.explanation,created_at=now(),
    expires_at=now()+interval '1 day';
end; $$;
revoke all on function public.finn_get_ask_sql_plan(uuid,text),
  public.finn_cache_ask_sql_plan(uuid,text,jsonb),
  public.finn_get_ask_explanation(uuid,text),
  public.finn_cache_ask_explanation(uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.finn_get_ask_sql_plan(uuid,text),
  public.finn_cache_ask_sql_plan(uuid,text,jsonb),
  public.finn_get_ask_explanation(uuid,text),
  public.finn_cache_ask_explanation(uuid,text,text) to service_role;

-- A transactionally versioned full catalog removes six reads before each model
-- call without changing the data supplied to validation or Gemini.
create table finn_private.catalog_global_revision (
  singleton boolean primary key default true check(singleton),
  revision bigint not null default 1
);
insert into finn_private.catalog_global_revision(singleton,revision)
values(true,1) on conflict do nothing;
create table finn_private.catalog_user_revisions (
  user_id uuid primary key references auth.users on delete cascade,
  revision bigint not null default 1
);
create table finn_private.catalog_cache (
  user_id uuid primary key references auth.users on delete cascade,
  global_revision bigint not null,
  user_revision bigint not null,
  document jsonb not null,
  updated_at timestamptz not null default now()
);
alter table finn_private.catalog_global_revision enable row level security;
alter table finn_private.catalog_user_revisions enable row level security;
alter table finn_private.catalog_cache enable row level security;
revoke all on finn_private.catalog_global_revision,
  finn_private.catalog_user_revisions,finn_private.catalog_cache
  from public,anon,authenticated;
grant all on finn_private.catalog_global_revision,
  finn_private.catalog_user_revisions,finn_private.catalog_cache to service_role;

create function public.finn_bump_catalog_revision()
returns trigger language plpgsql security definer set search_path='' as $$
declare owner_id uuid; previous_owner uuid;
begin
  if TG_TABLE_NAME='categories' then
    update finn_private.catalog_global_revision set revision=revision+1
      where singleton;
    delete from finn_private.catalog_cache;
    return null;
  end if;

  if TG_OP='INSERT' then
    owner_id := new.user_id;
  elsif TG_OP='DELETE' then
    owner_id := old.user_id;
  else
    owner_id := new.user_id;
    previous_owner := old.user_id;
  end if;

  if TG_TABLE_NAME in ('merchants','merchant_aliases') then
    if owner_id is null or (TG_OP='UPDATE' and previous_owner is null) then
      update finn_private.catalog_global_revision set revision=revision+1
        where singleton;
      delete from finn_private.catalog_cache;
      return null;
    end if;
  end if;

  -- Auth deletion cascades through these tables after the principal disappears.
  -- Do not recreate a revision row for an account being erased.
  if owner_id is not null
    and exists(select 1 from auth.users where id=owner_id) then
    insert into finn_private.catalog_user_revisions(user_id,revision)
      values(owner_id,1)
    on conflict(user_id) do update set
      revision=finn_private.catalog_user_revisions.revision+1;
    delete from finn_private.catalog_cache where user_id=owner_id;
  end if;
  if TG_OP='UPDATE' and previous_owner is not null
    and previous_owner is distinct from owner_id
    and exists(select 1 from auth.users where id=previous_owner) then
    insert into finn_private.catalog_user_revisions(user_id,revision)
      values(previous_owner,1)
    on conflict(user_id) do update set
      revision=finn_private.catalog_user_revisions.revision+1;
    delete from finn_private.catalog_cache where user_id=previous_owner;
  end if;
  return null;
end; $$;
revoke all on function public.finn_bump_catalog_revision()
  from public,anon,authenticated;

create trigger categories_catalog_revision after insert or update or delete
  on public.categories for each row execute function public.finn_bump_catalog_revision();
create trigger merchants_catalog_revision after insert or update or delete
  on public.merchants for each row execute function public.finn_bump_catalog_revision();
create trigger aliases_catalog_revision after insert or update or delete
  on public.merchant_aliases for each row execute function public.finn_bump_catalog_revision();
create trigger rules_catalog_revision after insert or update or delete
  on public.category_rules for each row execute function public.finn_bump_catalog_revision();
create trigger people_catalog_revision after insert or update or delete
  on public.people for each row execute function public.finn_bump_catalog_revision();
create trigger contexts_catalog_revision after insert or update or delete
  on public.contexts for each row execute function public.finn_bump_catalog_revision();

create function public.finn_catalog_document(p_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare global_rev bigint; user_rev bigint; cached jsonb; result jsonb;
begin
  if p_user is null or not exists(select 1 from auth.users where id=p_user)
    then raise exception 'invalid_user'; end if;
  select revision into global_rev from finn_private.catalog_global_revision
    where singleton;
  select coalesce((select revision from finn_private.catalog_user_revisions
    where user_id=p_user),0) into user_rev;
  select document into cached from finn_private.catalog_cache
    where user_id=p_user and global_revision=global_rev
      and user_revision=user_rev;
  if cached is not null then
    return cached||jsonb_build_object('_cache_hit',true);
  end if;

  if (select count(*) from public.categories)>5000
    or (select count(*) from public.merchants
      where user_id is null or user_id=p_user)>5000
    or (select count(*) from public.merchant_aliases
      where user_id is null or user_id=p_user)>5000
    or (select count(*) from public.category_rules where user_id=p_user)>5000
    or (select count(*) from public.people where user_id=p_user)>5000
    or (select count(*) from public.contexts where user_id=p_user)>5000
    then raise exception 'catalog_limit_reached'; end if;

  select jsonb_build_object(
    'categories',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'name',name,'parent_id',parent_id) order by id)
      from public.categories),'[]'::jsonb),
    'merchants',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'canonical_name',canonical_name,
      'default_category_id',default_category_id,'user_id',user_id)
      order by id) from public.merchants
      where user_id is null or user_id=p_user),'[]'::jsonb),
    'aliases',coalesce((select jsonb_agg(jsonb_build_object(
      'alias',alias,'merchant_id',merchant_id,'user_id',user_id)
      order by id) from public.merchant_aliases
      where user_id is null or user_id=p_user),'[]'::jsonb),
    'rules',coalesce((select jsonb_agg(jsonb_build_object(
      'merchant_key',merchant_key,'category_id',category_id)
      order by merchant_key) from public.category_rules
      where user_id=p_user),'[]'::jsonb),
    'people',coalesce((select jsonb_agg(jsonb_build_object('name',name)
      order by name) from public.people where user_id=p_user),'[]'::jsonb),
    'contexts',coalesce((select jsonb_agg(jsonb_build_object('name',name)
      order by name) from public.contexts where user_id=p_user),'[]'::jsonb),
    'global_revision',global_rev::text,'user_revision',user_rev::text
  ) into result;
  insert into finn_private.catalog_cache(
    user_id,global_revision,user_revision,document,updated_at
  ) values(p_user,global_rev,user_rev,result,now())
  on conflict(user_id) do update set
    global_revision=excluded.global_revision,
    user_revision=excluded.user_revision,
    document=excluded.document,updated_at=now();
  return result||jsonb_build_object('_cache_hit',false);
end; $$;
revoke all on function public.finn_catalog_document(uuid)
  from public,anon,authenticated;
grant execute on function public.finn_catalog_document(uuid) to service_role;

-- Sanitized aggregate metrics. Only closed enum names and bounded numbers are
-- accepted; no free-form text, questions, answers, notes or amounts are stored.
create function public.finn_record_cache_metrics(p_metrics jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare owner_id uuid := (select auth.uid()); item jsonb; cache_name text;
  hits integer; misses integer; rows_count integer; bytes_count integer;
  latency_bucket text;
begin
  if owner_id is null or jsonb_typeof(p_metrics)<>'array'
    or jsonb_array_length(p_metrics)>20 then raise exception 'invalid_metrics'; end if;
  for item in select value from jsonb_array_elements(p_metrics) loop
    if jsonb_typeof(item)<>'object' then raise exception 'invalid_metrics'; end if;
    cache_name := item->>'cache';
    if cache_name is null or cache_name not in ('delta_sync','refresh','ask_result','ask_sql_plan',
      'ask_explanation','catalog','summary','sqlite')
      then raise exception 'invalid_metrics'; end if;
    hits := coalesce((item->>'hits')::integer,0);
    misses := coalesce((item->>'misses')::integer,0);
    rows_count := coalesce((item->>'rows')::integer,0);
    bytes_count := coalesce((item->>'bytes')::integer,0);
    latency_bucket := item->>'latency_bucket';
    if hits not between 0 and 100000 or misses not between 0 and 100000
      or rows_count not between 0 and 1000000
      or bytes_count not between 0 and 1000000000
      or latency_bucket is null
      or latency_bucket not in ('lt_25','lt_100','lt_500','lt_2000','gte_2000')
      then raise exception 'invalid_metrics'; end if;
    insert into public.backend_events(user_id,event,metadata) values(
      owner_id,'cache_metrics',jsonb_build_object(
        'cache',cache_name,'hits',hits,'misses',misses,'rows',rows_count,
        'bytes',bytes_count,'latency_bucket',latency_bucket
      )
    );
  end loop;
end; $$;
revoke all on function public.finn_record_cache_metrics(jsonb) from public,anon;
grant execute on function public.finn_record_cache_metrics(jsonb) to authenticated;

-- The revision row carries no financial contents and is already owner-readable.
-- Realtime uses it only as an invalidation signal.
alter table public.journal_search_revisions replica identity full;
do $$ begin
  if not exists(select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public'
      and tablename='journal_search_revisions') then
    alter publication supabase_realtime add table public.journal_search_revisions;
  end if;
end; $$;
