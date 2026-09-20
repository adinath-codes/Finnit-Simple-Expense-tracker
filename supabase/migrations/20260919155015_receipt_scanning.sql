-- Extracted receipt metadata and normalized receipt lines. Source images are
-- transient Edge Function inputs and are never stored in Postgres or Storage.
alter table public.journal_entries add column source_type text not null default 'text';
alter table public.journal_entries drop constraint journal_entries_original_text_check;
alter table public.journal_entries drop constraint journal_entries_raw_text_check;
alter table public.journal_entries alter column original_text drop not null;
alter table public.journal_entries alter column raw_text drop not null;
alter table public.journal_entries add constraint journal_entries_source_check check (
  (source_type='text' and original_text is not null and length(original_text) between 1 and 4000
    and raw_text is not null and length(raw_text) between 1 and 4000)
  or
  (source_type='receipt' and original_text is null and raw_text is null)
);
alter table public.journal_entries add constraint journal_entries_source_type_check
  check (source_type in ('text','receipt'));

create table public.receipt_attachments (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  entry_id uuid not null,
  status text not null check (status in ('complete','needs_review','failed')),
  merchant_name text check (merchant_name is null or length(merchant_name) between 1 and 160),
  purchase_date_text text check (purchase_date_text is null or length(purchase_date_text) between 1 and 100),
  printed_subtotal_minor bigint check (printed_subtotal_minor between 0 and 9007199254740991),
  printed_total_minor bigint check (printed_total_minor between 0 and 9007199254740991),
  currency text not null references public.currencies,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  needs_review boolean not null,
  truncated boolean not null default false,
  model text not null check (length(model) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,id),
  unique(user_id,entry_id),
  foreign key(user_id,entry_id) references public.journal_entries(user_id,id) on delete cascade
);
create index receipt_attachments_entry_idx on public.receipt_attachments(user_id,entry_id);

create table public.receipt_line_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  entry_id uuid not null,
  ordinal integer not null check (ordinal between 0 and 99),
  kind text not null check (kind in ('item','tax','tip','fee','discount')),
  description text not null check (length(description) between 1 and 500),
  quantity integer check (quantity between 1 and 100000),
  unit_price_minor bigint check (unit_price_minor between 0 and 9007199254740991),
  amount_minor bigint not null check (amount_minor between -9007199254740991 and 9007199254740991),
  currency text not null references public.currencies,
  category_id text not null references public.categories,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  needs_review boolean not null,
  evidence_text text not null check (length(evidence_text) between 1 and 500),
  created_at timestamptz not null default now(),
  unique(user_id,entry_id,ordinal),
  foreign key(user_id,entry_id) references public.journal_entries(user_id,id) on delete cascade,
  check ((kind='discount' and amount_minor<=0) or (kind<>'discount' and amount_minor>=0)),
  check (unit_price_minor is null or quantity is not null)
);
create index receipt_line_items_entry_idx on public.receipt_line_items(user_id,entry_id,ordinal);
create index receipt_line_items_category_idx on public.receipt_line_items(category_id);

-- Receipt discounts are the only negative expense transactions. Other capture
-- paths continue to validate unsigned money before reaching this constraint.
alter table public.transactions drop constraint transactions_amount_minor_check;
alter table public.transactions add column receipt_line_kind text;
alter table public.transactions add constraint transactions_amount_minor_check
  check(amount_minor between -9007199254740991 and 9007199254740991);
alter table public.transactions add constraint transactions_receipt_line_kind_check check (
  receipt_line_kind is null or receipt_line_kind in ('item','tax','tip','fee','discount','receipt_total')
);
alter table public.transactions add constraint transactions_receipt_discount_check check (
  receipt_line_kind<>'discount' or (direction='expense' and amount_minor<=0)
);

alter table public.receipt_attachments enable row level security;
alter table public.receipt_line_items enable row level security;
create policy receipt_attachments_owner_read on public.receipt_attachments
  for select to authenticated using (user_id=(select auth.uid()));
create policy receipt_line_items_owner_read on public.receipt_line_items
  for select to authenticated using (user_id=(select auth.uid()));
revoke all on public.receipt_attachments,public.receipt_line_items from public,anon,authenticated;
grant select on public.receipt_attachments,public.receipt_line_items to authenticated;
grant all on public.receipt_attachments,public.receipt_line_items to service_role;

create or replace function public.finn_entry_document(p_user uuid,p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',e.id,'source_type',e.source_type,'raw_text',e.raw_text,
 'original_text',e.original_text,'captured_at',e.captured_at,'occurred_on',e.occurred_on,
 'timezone',e.timezone,'currency',e.currency,'revision',e.revision,'extraction',e.extraction,
 'deleted_at',e.deleted_at,
 'receipt',case when a.id is null then null else jsonb_build_object(
   'id',a.id,'status',a.status,'merchant_name',a.merchant_name,
   'purchase_date_text',a.purchase_date_text,
   'printed_subtotal_minor',a.printed_subtotal_minor::text,'printed_total_minor',a.printed_total_minor::text,
   'currency',a.currency,'confidence',a.confidence,'needs_review',a.needs_review,
   'truncated',a.truncated,'model',a.model,
   'lines',coalesce((select jsonb_agg(jsonb_build_object(
     'id',l.id,'ordinal',l.ordinal,'kind',l.kind,'description',l.description,
     'quantity',l.quantity,'unit_price_minor',l.unit_price_minor::text,
     'amount_minor',l.amount_minor::text,'currency',l.currency,'category_id',l.category_id,
     'confidence',l.confidence,'needs_review',l.needs_review,'evidence_text',l.evidence_text,
     'provisional',false) order by l.ordinal)
     from public.receipt_line_items l where l.user_id=e.user_id and l.entry_id=e.id),'[]'::jsonb)
 ) end)
 from public.journal_entries e
 left join public.receipt_attachments a on a.user_id=e.user_id and a.entry_id=e.id
 where e.user_id=p_user and e.id=p_id;
$$;

-- Receipt entries have no invented note text. Search result cards use the
-- owner-scoped merchant metadata instead.
create or replace function public.finn_search_page(
  p_filters jsonb,p_limit integer default 20,p_cursor jsonb default null,p_revision text default null
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
 r text; result jsonb; rows jsonb; decorated jsonb; last_row jsonb;
 ds date:=(p_filters->>'start_date')::date; de date:=(p_filters->>'end_date')::date;
 dir text:=p_filters->>'direction'; cat text:=p_filters->>'category_id';
 merchant uuid:=(p_filters->>'merchant_id')::uuid; person text:=p_filters->>'person';
 context_name text:=p_filters->>'context'; query text:=p_filters->>'text';
 cur text:=p_filters->>'currency'; has_more boolean;
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 if dir is not null and dir not in ('expense','income','transfer','lent','borrowed','repayment')
   then raise exception 'invalid_direction'; end if;
 if ds is null or de is null or de<=ds or de-ds>3660 or p_limit is null or p_limit not between 1 and 30
   then raise exception 'invalid_range'; end if;
 select coalesce((select revision::text from public.journal_search_revisions
   where user_id=(select auth.uid())),'0') into r;
 if p_cursor is not null and (p_revision is null or p_revision<>r)
   then return jsonb_build_object('stale',true); end if;
 if p_cursor is null then
  with matched as materialized (
   select t.currency,t.amount_minor,t.amount_status,t.needs_review
   from public.transactions t join public.journal_entries e
     on e.id=t.entry_id and e.user_id=t.user_id
   where t.user_id=(select auth.uid()) and e.deleted_at is null
    and t.occurred_on>=ds and t.occurred_on<de
    and (dir is null or t.direction=dir) and (cat is null or t.category_id=cat)
    and (merchant is null or t.merchant_id=merchant) and (cur is null or t.currency=cur)
    and (person is null or exists(select 1 from public.entry_people ep
      join public.people p on p.id=ep.person_id and p.user_id=ep.user_id
      where ep.user_id=t.user_id and ep.entry_id=t.entry_id
      and p.normalized_name=lower(trim(person))))
    and (context_name is null or exists(select 1 from public.entry_contexts ec
      join public.contexts c on c.id=ec.context_id and c.user_id=ec.user_id
      where ec.user_id=t.user_id and ec.entry_id=t.entry_id
      and c.normalized_name=lower(trim(context_name))))
    and (query is null or e.search_vector @@ websearch_to_tsquery('simple',query))
  ), totals as (
   select currency,
    coalesce(sum(amount_minor) filter(where amount_status='confirmed' and not needs_review),0)::text total_minor,
    count(*) filter(where amount_status='confirmed' and not needs_review) confirmed_count,
    count(*) filter(where amount_status<>'confirmed' or needs_review) review_count
   from matched group by currency
  ) select jsonb_build_object(
    'totals',coalesce((select jsonb_agg(to_jsonb(totals) order by currency) from totals),'[]'::jsonb),
    'matching_count',(select count(*) from matched)) into result;
 else result:='{}'::jsonb;
 end if;
 select coalesce(jsonb_agg(to_jsonb(page) order by page.occurred_on desc,page.entry_id desc,page.id desc),'[]'::jsonb)
 into rows from (
  select t.id,t.entry_id,t.description,t.amount_minor::text amount_minor,t.currency,
   t.direction,t.cash_flow,t.category_id,c.name category_name,t.merchant_id,
   coalesce(m.canonical_name,a.merchant_name) merchant_name,t.occurred_on,
   t.amount_status,t.quantity,t.unit_price_minor::text unit_price_minor,t.needs_review,
   coalesce(e.raw_text,a.merchant_name,'Receipt') raw_text
  from public.transactions t
  join public.journal_entries e on e.id=t.entry_id and e.user_id=t.user_id
  join public.categories c on c.id=t.category_id
  left join public.merchants m on m.id=t.merchant_id
  left join public.receipt_attachments a on a.entry_id=e.id and a.user_id=e.user_id
  where t.user_id=(select auth.uid()) and e.deleted_at is null
   and t.occurred_on>=ds and t.occurred_on<de
   and (dir is null or t.direction=dir) and (cat is null or t.category_id=cat)
   and (merchant is null or t.merchant_id=merchant) and (cur is null or t.currency=cur)
   and (person is null or exists(select 1 from public.entry_people ep
    join public.people p on p.id=ep.person_id and p.user_id=ep.user_id
    where ep.user_id=t.user_id and ep.entry_id=t.entry_id
    and p.normalized_name=lower(trim(person))))
   and (context_name is null or exists(select 1 from public.entry_contexts ec
    join public.contexts c on c.id=ec.context_id and c.user_id=ec.user_id
    where ec.user_id=t.user_id and ec.entry_id=t.entry_id
    and c.normalized_name=lower(trim(context_name))))
   and (query is null or e.search_vector @@ websearch_to_tsquery('simple',query))
   and (p_cursor is null or (t.occurred_on,t.entry_id,t.id)<
    ((p_cursor->>'day')::date,(p_cursor->>'entry_id')::uuid,(p_cursor->>'id')::uuid))
  order by t.occurred_on desc,t.entry_id desc,t.id desc limit p_limit+1
 ) page;
 has_more:=jsonb_array_length(rows)>p_limit;
 select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) into decorated
  from jsonb_array_elements(rows) with ordinality a(value,ord) where ord<=p_limit;
 last_row:=decorated->(jsonb_array_length(decorated)-1);
 return (result-'transactions'-'offset')||jsonb_build_object(
  'transactions',decorated,'revision',r,'has_more',has_more,'limit',p_limit,
  'next_cursor',case when has_more then jsonb_build_object('day',last_row->>'occurred_on',
   'entry_id',last_row->>'entry_id','id',last_row->>'id') else null end);
end $$;

-- Atomic finalization after the model call. No external request occurs while
-- this function holds its short per-user advisory lock.
create function public.finn_commit_receipt(
  p_user uuid,p_request jsonb,p_receipt jsonb,p_lines jsonb,p_extraction jsonb,p_audit jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 eid uuid:=(p_request->>'entry_id')::uuid; aid uuid:=(p_request->>'attachment_id')::uuid;
 existing public.journal_entries; line jsonb; tx jsonb; idx integer:=0; day date;
 search_terms text; doc jsonb;
begin
 if p_user is null then raise exception 'unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into existing from public.journal_entries where id=eid for update;
 if found then
   if existing.user_id<>p_user then raise exception 'entry_conflict'; end if;
   if existing.source_type<>'receipt' or existing.capture_request<>p_request then
     raise exception 'idempotency_conflict';
   end if;
   return public.finn_entry_document(p_user,eid);
 end if;
 if jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'invalid_receipt_lines'; end if;
 if jsonb_array_length(p_extraction->'transactions') not between 1 and 100 then raise exception 'invalid_transactions'; end if;
 day:=(p_request->>'selected_date')::date;
 search_terms:=coalesce(p_receipt->>'merchant_name','Receipt');
 insert into public.journal_entries(
   id,user_id,source_type,original_text,raw_text,capture_request,captured_at,occurred_at,
   occurred_on,timezone,currency,extraction,search_text
 ) values(
   eid,p_user,'receipt',null,null,p_request,(p_request->>'captured_at')::timestamptz,
   (day::timestamp+interval '12 hours') at time zone (p_request->>'timezone'),day,
   p_request->>'timezone',p_receipt->>'currency',p_extraction,search_terms
 );
 insert into public.receipt_attachments(
   id,user_id,entry_id,status,merchant_name,purchase_date_text,
   printed_subtotal_minor,printed_total_minor,currency,confidence,needs_review,truncated,model
 ) values(
   aid,p_user,eid,p_receipt->>'status',p_receipt->>'merchant_name',p_receipt->>'purchase_date_text',
   (p_receipt->>'printed_subtotal_minor')::bigint,(p_receipt->>'printed_total_minor')::bigint,
   p_receipt->>'currency',(p_receipt->>'confidence')::numeric,(p_receipt->>'needs_review')::boolean,
   (p_receipt->>'truncated')::boolean,p_receipt->>'model'
 );
 for line in select value from jsonb_array_elements(p_lines) loop
   insert into public.receipt_line_items(
     user_id,entry_id,ordinal,kind,description,quantity,unit_price_minor,amount_minor,
     currency,category_id,confidence,needs_review,evidence_text
   ) values(
     p_user,eid,(line->>'ordinal')::integer,line->>'kind',line->>'description',
     (line->>'quantity')::integer,(line->>'unit_price_minor')::bigint,(line->>'amount_minor')::bigint,
     line->>'currency',line->>'category_id',(line->>'confidence')::numeric,
     (line->>'needs_review')::boolean,line->>'evidence_text'
   );
   search_terms:=search_terms||' '||line->>'description';
 end loop;
 for tx in select value from jsonb_array_elements(p_extraction->'transactions') loop
   insert into public.transactions(
     user_id,entry_id,ordinal,description,amount_minor,currency,direction,cash_flow,
     category_id,category_source,merchant_id,person_id,occurred_at,occurred_on,
     amount_status,quantity,unit_price_minor,confidence,needs_review,unresolved,evidence,
     receipt_line_kind
   ) values(
     p_user,eid,idx,tx->>'description',(tx->>'amount_minor')::bigint,tx->>'currency',
     'expense','out',tx->>'category_id',tx->>'category_source',null,null,
     (day::timestamp+interval '12 hours') at time zone (p_request->>'timezone'),day,
     tx->>'amount_status',(tx->>'quantity')::integer,(tx->>'unit_price_minor')::bigint,
     (tx->>'confidence')::numeric,(tx->>'needs_review')::boolean,tx->'unresolved',
     tx->>'evidence',tx->>'receipt_line_kind'
   );
   idx:=idx+1;
 end loop;
 update public.journal_entries set search_text=search_terms where user_id=p_user and id=eid;
 insert into public.extraction_audits(user_id,entry_id,revision,event,payload)
 values(p_user,eid,1,'receipt_extraction',p_audit);
 doc:=public.finn_entry_document(p_user,eid);
 return doc;
end $$;

revoke all on function public.finn_commit_receipt(uuid,jsonb,jsonb,jsonb,jsonb,jsonb)
  from public,anon,authenticated;
grant execute on function public.finn_commit_receipt(uuid,jsonb,jsonb,jsonb,jsonb,jsonb)
  to service_role;

-- Human corrections replace receipt lines and accounting transactions in one
-- revision-checked transaction. They never call the model again.
create function public.finn_correct_receipt(
  p_user uuid,p_id uuid,p_revision integer,p_operation_id uuid,
  p_attachment jsonb,p_lines jsonb,p_extraction jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  old finn_private.mutations; existing public.journal_entries; request jsonb;
  line jsonb; tx jsonb; idx integer:=0; next_revision integer; doc jsonb;
  search_terms text;
begin
  if p_user is null then raise exception 'unauthorized'; end if;
  request:=jsonb_build_object('receipt',p_id,'revision',p_revision,'attachment',p_attachment,
    'lines',p_lines,'extraction',p_extraction);
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  select * into old from finn_private.mutations
    where user_id=p_user and operation_id=p_operation_id;
  if found then
    if old.request<>request then raise exception 'idempotency_conflict'; end if;
    return old.response;
  end if;
  select * into existing from public.journal_entries where id=p_id for update;
  if not found or existing.user_id<>p_user or existing.source_type<>'receipt'
    then raise exception 'receipt_not_found'; end if;
  if existing.revision<>p_revision or existing.deleted_at is not null
    then raise exception 'revision_conflict'; end if;
  if jsonb_array_length(p_lines) not between 1 and 100
    then raise exception 'invalid_receipt_lines'; end if;
  if jsonb_array_length(p_extraction->'transactions') not between 1 and 100
    then raise exception 'invalid_transactions'; end if;
  next_revision:=p_revision+1;
  update public.receipt_attachments set
    merchant_name=p_attachment->>'merchant_name',
    purchase_date_text=p_attachment->>'purchase_date_text',
    printed_subtotal_minor=(p_attachment->>'printed_subtotal_minor')::bigint,
    printed_total_minor=(p_attachment->>'printed_total_minor')::bigint,
    currency=p_attachment->>'currency',status=p_attachment->>'status',
    needs_review=(p_attachment->>'needs_review')::boolean,updated_at=now()
  where user_id=p_user and entry_id=p_id;
  if not found then raise exception 'receipt_not_found'; end if;
  delete from public.receipt_line_items where user_id=p_user and entry_id=p_id;
  delete from public.transactions where user_id=p_user and entry_id=p_id;
  search_terms:=coalesce(p_attachment->>'merchant_name','Receipt');
  for line in select value from jsonb_array_elements(p_lines) loop
    insert into public.receipt_line_items(
      user_id,entry_id,ordinal,kind,description,quantity,unit_price_minor,amount_minor,
      currency,category_id,confidence,needs_review,evidence_text
    ) values(
      p_user,p_id,(line->>'ordinal')::integer,line->>'kind',line->>'description',
      (line->>'quantity')::integer,(line->>'unit_price_minor')::bigint,
      (line->>'amount_minor')::bigint,line->>'currency',line->>'category_id',
      (line->>'confidence')::numeric,(line->>'needs_review')::boolean,line->>'evidence_text'
    );
    search_terms:=search_terms||' '||line->>'description';
  end loop;
  for tx in select value from jsonb_array_elements(p_extraction->'transactions') loop
    insert into public.transactions(
      user_id,entry_id,ordinal,description,amount_minor,currency,direction,cash_flow,
      category_id,category_source,merchant_id,person_id,occurred_at,occurred_on,
      amount_status,quantity,unit_price_minor,confidence,needs_review,unresolved,evidence,
      receipt_line_kind
    ) values(
      p_user,p_id,idx,tx->>'description',(tx->>'amount_minor')::bigint,tx->>'currency',
      'expense','out',tx->>'category_id','user_correction',null,null,existing.occurred_at,
      existing.occurred_on,tx->>'amount_status',(tx->>'quantity')::integer,
      (tx->>'unit_price_minor')::bigint,(tx->>'confidence')::numeric,
      (tx->>'needs_review')::boolean,tx->'unresolved',tx->>'evidence',
      tx->>'receipt_line_kind'
    );
    idx:=idx+1;
  end loop;
  update public.journal_entries set currency=p_attachment->>'currency',
    extraction=p_extraction,search_text=search_terms,revision=next_revision,updated_at=now()
  where user_id=p_user and id=p_id;
  insert into public.extraction_audits(user_id,entry_id,revision,event,payload)
  values(p_user,p_id,next_revision,'receipt_correction',request);
  doc:=public.finn_entry_document(p_user,p_id);
  insert into finn_private.mutations values(p_user,p_operation_id,request,doc);
  return doc;
end $$;

revoke all on function public.finn_correct_receipt(uuid,uuid,integer,uuid,jsonb,jsonb,jsonb)
  from public,anon,authenticated;
grant execute on function public.finn_correct_receipt(uuid,uuid,integer,uuid,jsonb,jsonb,jsonb)
  to service_role;
