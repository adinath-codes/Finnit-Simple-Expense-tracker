-- Transaction semantics V2: keep grounded stated amounts while separating the
-- user's economic share, group total, cash paid, participants, contexts, and
-- exact arithmetic components. Existing V1 columns remain readable.

alter table public.categories
  add column parent_id text references public.categories(id),
  add column is_active boolean not null default true,
  add column sort_order integer not null default 0;

create index categories_parent_idx on public.categories(parent_id) where parent_id is not null;

insert into public.categories(id,name,parent_id,sort_order) values
  ('food.dining','Dining out','food',10),
  ('food.groceries','Groceries','food',20),
  ('food.delivery','Food delivery','food',30),
  ('transport.ride_hailing','Ride hailing','transport',10),
  ('transport.public','Public transport','transport',20),
  ('transport.fuel','Fuel','transport',30),
  ('shopping.clothing','Clothing','shopping',10),
  ('shopping.electronics','Electronics','shopping',20),
  ('shopping.household','Household','shopping',30),
  ('bills.utilities','Utilities','bills',10),
  ('bills.rent','Rent','bills',20),
  ('health.medicine','Medicine','health',10),
  ('health.care','Healthcare','health',20),
  ('travel.lodging','Lodging','travel',10),
  ('travel.transit','Travel transport','travel',20),
  ('work.software','Work software','work',10),
  ('work.supplies','Work supplies','work',20)
on conflict(id) do update set
  name=excluded.name,parent_id=excluded.parent_id,sort_order=excluded.sort_order,is_active=true;

update public.merchants set default_category_id='transport.ride_hailing'
where user_id is null and canonical_name in ('Uber','Ola','Rapido');
update public.merchants set default_category_id='food.delivery'
where user_id is null and canonical_name in ('Swiggy','Zomato');
update public.merchants set default_category_id='food.dining'
where user_id is null and canonical_name='Starbucks';
update public.merchants set default_category_id='work.software'
where user_id is null and canonical_name='Figma';

alter table public.journal_entries
  add column extraction_status text not null default 'complete',
  add column extraction_schema_version integer not null default 1,
  add column prompt_version text,
  add column input_hash text,
  add column catalog_version text,
  add column interpretation_summary text,
  add column last_extracted_at timestamptz;

alter table public.journal_entries
  add constraint journal_entries_extraction_status_check
    check(extraction_status in ('pending','complete','needs_review','failed')),
  add constraint journal_entries_extraction_schema_check
    check(extraction_schema_version between 1 and 1000),
  add constraint journal_entries_input_hash_check
    check(input_hash is null or input_hash ~ '^[0-9a-f]{64}$'),
  add constraint journal_entries_interpretation_summary_check
    check(interpretation_summary is null or length(interpretation_summary) between 1 and 300);

alter table public.transactions
  add column primary_amount_role text not null default 'legacy_unclassified',
  add column group_total_minor bigint,
  add column user_share_minor bigint,
  add column paid_by_user_minor bigint,
  add column split_method text not null default 'unknown',
  add column participant_count integer,
  add column quantity_unit text,
  add column merchant_text text,
  add column field_confidence jsonb not null default '{}',
  add column field_evidence jsonb not null default '{}',
  add column allocation_status text not null default 'unknown';

alter table public.transactions
  add constraint transactions_primary_amount_role_check check(primary_amount_role in (
    'personal_total','group_total','user_share','paid_by_user','reimbursement',
    'amount_owed','tax','tip','discount','legacy_unclassified','unknown'
  )),
  add constraint transactions_group_total_check
    check(group_total_minor between -9007199254740991 and 9007199254740991),
  add constraint transactions_user_share_check
    check(user_share_minor between -9007199254740991 and 9007199254740991),
  add constraint transactions_paid_by_user_check
    check(paid_by_user_minor between -9007199254740991 and 9007199254740991),
  add constraint transactions_split_method_check check(split_method in (
    'not_applicable','exact','equal','percentage','weighted','unknown'
  )),
  add constraint transactions_participant_count_check
    check(participant_count is null or participant_count between 1 and 100000),
  add constraint transactions_quantity_unit_check
    check(quantity_unit is null or length(quantity_unit) between 1 and 40),
  add constraint transactions_merchant_text_check
    check(merchant_text is null or length(merchant_text) between 1 and 160),
  add constraint transactions_allocation_status_check check(allocation_status in (
    'complete','partial','unknown','not_applicable'
  ));

create unique index transactions_user_id_id_uidx on public.transactions(user_id,id);
create index transactions_user_share_date_idx
  on public.transactions(user_id,occurred_on,user_share_minor)
  where user_share_minor is not null and not needs_review;
create index transactions_group_total_date_idx
  on public.transactions(user_id,occurred_on,group_total_minor)
  where group_total_minor is not null and not needs_review;
create index transactions_paid_by_user_date_idx
  on public.transactions(user_id,occurred_on,paid_by_user_minor)
  where paid_by_user_minor is not null and not needs_review;

create table public.transaction_participants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  transaction_id uuid not null,
  source_ordinal integer not null check(source_ordinal between -1 and 199),
  person_id uuid,
  party_kind text not null check(party_kind in ('self','known_person','anonymous_group','unknown')),
  display_name text check(display_name is null or length(display_name) between 1 and 100),
  participant_count integer not null check(participant_count between 1 and 100000),
  role text not null check(role in ('participant','payer','beneficiary','debtor','creditor')),
  share_minor bigint check(share_minor between 0 and 9007199254740991),
  share_percentage numeric(9,8) check(share_percentage between 0 and 1),
  split_method text not null check(split_method in (
    'not_applicable','exact','equal','percentage','weighted','unknown'
  )),
  confidence numeric(4,3) not null check(confidence between 0 and 1),
  evidence jsonb,
  needs_review boolean not null,
  unique(user_id,id),
  unique(user_id,transaction_id,source_ordinal),
  foreign key(user_id,transaction_id) references public.transactions(user_id,id) on delete cascade,
  foreign key(user_id,person_id) references public.people(user_id,id)
);

create index transaction_participants_transaction_idx
  on public.transaction_participants(user_id,transaction_id);
create index transaction_participants_person_idx
  on public.transaction_participants(user_id,person_id,transaction_id)
  where person_id is not null;
create index transaction_participants_role_idx
  on public.transaction_participants(user_id,role,transaction_id);

create table public.transaction_contexts (
  user_id uuid not null references auth.users on delete cascade,
  transaction_id uuid not null,
  context_id uuid not null,
  confidence numeric(4,3) not null check(confidence between 0 and 1),
  evidence jsonb not null,
  needs_review boolean not null,
  primary key(user_id,transaction_id,context_id),
  foreign key(user_id,transaction_id) references public.transactions(user_id,id) on delete cascade,
  foreign key(user_id,context_id) references public.contexts(user_id,id) on delete cascade
);

create index transaction_contexts_context_idx
  on public.transaction_contexts(user_id,context_id,transaction_id);

create table public.transaction_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  transaction_id uuid not null,
  participant_id uuid,
  allocation_type text not null check(allocation_type in (
    'share','paid','owed_to_user','owed_by_user','reimbursed_to_user','reimbursed_by_user'
  )),
  amount_minor bigint not null check(amount_minor between 0 and 9007199254740991),
  confidence numeric(4,3) not null check(confidence between 0 and 1),
  evidence jsonb,
  needs_review boolean not null,
  foreign key(user_id,transaction_id) references public.transactions(user_id,id) on delete cascade,
  foreign key(user_id,participant_id) references public.transaction_participants(user_id,id) on delete cascade
);

create index transaction_allocations_type_idx
  on public.transaction_allocations(user_id,allocation_type,transaction_id);
create index transaction_allocations_participant_idx
  on public.transaction_allocations(user_id,participant_id)
  where participant_id is not null;

create table public.transaction_amount_components (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  transaction_id uuid not null,
  ordinal integer not null check(ordinal between 0 and 199),
  label text not null check(length(label) between 1 and 160),
  quantity integer not null check(quantity between 1 and 100000),
  unit_price_minor bigint not null check(unit_price_minor between 0 and 9007199254740991),
  line_total_minor bigint not null check(line_total_minor between -9007199254740991 and 9007199254740991),
  semantic_role text not null check(semantic_role in ('item','tax','tip','fee','discount')),
  confidence numeric(4,3) not null check(confidence between 0 and 1),
  evidence jsonb not null,
  needs_review boolean not null,
  unique(user_id,transaction_id,ordinal),
  foreign key(user_id,transaction_id) references public.transactions(user_id,id) on delete cascade,
  check(line_total_minor = unit_price_minor::numeric * quantity *
    case when semantic_role='discount' then -1 else 1 end)
);

create index transaction_amount_components_transaction_idx
  on public.transaction_amount_components(user_id,transaction_id,ordinal);

alter table public.transaction_participants enable row level security;
alter table public.transaction_contexts enable row level security;
alter table public.transaction_allocations enable row level security;
alter table public.transaction_amount_components enable row level security;

create policy owner_read on public.transaction_participants for select to authenticated
  using(user_id=(select auth.uid()));
create policy owner_read on public.transaction_contexts for select to authenticated
  using(user_id=(select auth.uid()));
create policy owner_read on public.transaction_allocations for select to authenticated
  using(user_id=(select auth.uid()));
create policy owner_read on public.transaction_amount_components for select to authenticated
  using(user_id=(select auth.uid()));

revoke all on public.transaction_participants,public.transaction_contexts,
  public.transaction_allocations,public.transaction_amount_components from public,anon,authenticated;
grant select on public.transaction_participants,public.transaction_contexts,
  public.transaction_allocations,public.transaction_amount_components to authenticated;
grant all on public.transaction_participants,public.transaction_contexts,
  public.transaction_allocations,public.transaction_amount_components to service_role;

create table finn_private.ai_operations (
  user_id uuid not null references auth.users on delete cascade,
  operation_id uuid not null,
  task text not null check(length(task) between 1 and 50),
  entry_id uuid not null,
  entry_revision integer not null check(entry_revision >= 0),
  input_hash text not null check(input_hash ~ '^[0-9a-f]{64}$'),
  schema_version integer not null check(schema_version between 1 and 1000),
  prompt_version text not null check(length(prompt_version) between 1 and 50),
  model_version text not null check(length(model_version) between 1 and 100),
  status text not null check(status in ('in_progress','complete','failed')),
  validation_code text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key(user_id,operation_id),
  unique(user_id,task,entry_id,entry_revision,input_hash,schema_version,prompt_version,model_version)
);
alter table finn_private.ai_operations enable row level security;
grant all on finn_private.ai_operations to service_role;

create function public.finn_claim_ai_operation(
  p_user uuid,p_operation_id uuid,p_task text,p_entry_id uuid,p_entry_revision integer,
  p_input_hash text,p_schema_version integer,p_prompt_version text,p_model_version text
) returns text language plpgsql security invoker set search_path='' as $$
declare current_op finn_private.ai_operations;
begin
  if p_user is null then raise exception 'unauthorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text||p_entry_id::text,0));
  select * into current_op from finn_private.ai_operations
    where user_id=p_user and operation_id=p_operation_id for update;
  if found then
    if current_op.task<>p_task or current_op.entry_id<>p_entry_id or
       current_op.entry_revision<>p_entry_revision or current_op.input_hash<>p_input_hash or
       current_op.schema_version<>p_schema_version or current_op.prompt_version<>p_prompt_version or
       current_op.model_version<>p_model_version then raise exception 'idempotency_conflict'; end if;
    if current_op.status='complete' then return 'complete'; end if;
    if current_op.status='in_progress' and current_op.updated_at>now()-interval '2 minutes'
      then return 'in_progress'; end if;
    update finn_private.ai_operations set status='in_progress',validation_code=null,
      started_at=now(),updated_at=now(),completed_at=null
      where user_id=p_user and operation_id=p_operation_id;
    return 'claimed';
  end if;
  select * into current_op from finn_private.ai_operations
    where user_id=p_user and task=p_task and entry_id=p_entry_id
      and entry_revision=p_entry_revision and input_hash=p_input_hash
      and schema_version=p_schema_version and prompt_version=p_prompt_version
      and model_version=p_model_version
    for update;
  if found then
    if current_op.status='complete' then return 'complete'; end if;
    if current_op.status='in_progress' and current_op.updated_at>now()-interval '2 minutes'
      then return 'in_progress'; end if;
    update finn_private.ai_operations set operation_id=p_operation_id,status='in_progress',
      validation_code=null,started_at=now(),updated_at=now(),completed_at=null
      where user_id=p_user and operation_id=current_op.operation_id;
    return 'claimed';
  end if;
  insert into finn_private.ai_operations(
    user_id,operation_id,task,entry_id,entry_revision,input_hash,schema_version,
    prompt_version,model_version,status
  ) values(
    p_user,p_operation_id,p_task,p_entry_id,p_entry_revision,p_input_hash,p_schema_version,
    p_prompt_version,p_model_version,'in_progress'
  );
  return 'claimed';
end $$;

create function public.finn_finish_ai_operation(
  p_user uuid,p_operation_id uuid,p_status text,p_validation_code text default null
) returns void language plpgsql security invoker set search_path='' as $$
begin
  if p_status not in ('complete','failed') then raise exception 'invalid_status'; end if;
  update finn_private.ai_operations set status=p_status,validation_code=p_validation_code,
    updated_at=now(),completed_at=case when p_status='complete' then now() else null end
    where user_id=p_user and operation_id=p_operation_id;
  if not found then raise exception 'operation_not_found'; end if;
end $$;

revoke all on function public.finn_claim_ai_operation(uuid,uuid,text,uuid,integer,text,integer,text,text)
  from public,anon,authenticated;
revoke all on function public.finn_finish_ai_operation(uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.finn_claim_ai_operation(uuid,uuid,text,uuid,integer,text,integer,text,text),
  public.finn_finish_ai_operation(uuid,uuid,text,text) to service_role;

create function public.finn_entry_v2_metadata()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  new.extraction_schema_version:=coalesce((new.extraction->>'schema_version')::integer,1);
  new.interpretation_summary:=nullif(new.extraction->>'interpretation_summary','');
  new.extraction_status:=case
    when new.extraction->'unresolved' ? 'gemini_pending' then 'pending'
    when exists(select 1 from jsonb_array_elements(new.extraction->'transactions') t
      where coalesce((t->>'needs_review')::boolean,false)) then 'needs_review'
    else 'complete' end;
  if new.extraction_status in ('complete','needs_review') then new.last_extracted_at:=now(); end if;
  return new;
end $$;

create trigger journal_entries_v2_metadata
before insert or update of extraction on public.journal_entries
for each row execute function public.finn_entry_v2_metadata();

create function public.finn_transaction_v2_before()
returns trigger language plpgsql security invoker set search_path='' as $$
declare extraction jsonb; tx jsonb;
begin
  select e.extraction into extraction from public.journal_entries e
    where e.user_id=new.user_id and e.id=new.entry_id;
  tx:=extraction->'transactions'->new.ordinal;
  if tx is null then return new; end if;
  new.primary_amount_role:=coalesce(tx->>'primary_amount_role','personal_total');
  new.group_total_minor:=case when tx ? 'group_total_minor'
    then (tx->>'group_total_minor')::bigint else new.amount_minor end;
  new.user_share_minor:=case when tx ? 'user_share_minor'
    then (tx->>'user_share_minor')::bigint else new.amount_minor end;
  new.paid_by_user_minor:=case when tx ? 'paid_by_user_minor'
    then (tx->>'paid_by_user_minor')::bigint
    when new.cash_flow='out' then new.amount_minor else null end;
  new.split_method:=coalesce(tx->>'split_method','not_applicable');
  new.participant_count:=case when tx ? 'participant_count'
    then (tx->>'participant_count')::integer else 1 end;
  new.quantity_unit:=nullif(tx->>'quantity_unit','');
  new.merchant_text:=nullif(tx->>'merchant_text','');
  new.field_confidence:=coalesce(tx->'field_confidence','{}'::jsonb);
  new.field_evidence:=coalesce(tx->'field_evidence','{}'::jsonb);
  new.allocation_status:=coalesce(tx->>'allocation_status','not_applicable');
  return new;
end $$;

create function public.finn_transaction_v2_children()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
  extraction jsonb; item jsonb; ord bigint; context_id uuid; person_id uuid;
  participant_id uuid; participant_source integer; self_participant uuid;
begin
  select e.extraction into extraction from public.journal_entries e
    where e.user_id=new.user_id and e.id=new.entry_id;

  delete from public.transaction_allocations
    where user_id=new.user_id and transaction_id=new.id;
  delete from public.transaction_participants
    where user_id=new.user_id and transaction_id=new.id;
  delete from public.transaction_contexts
    where user_id=new.user_id and transaction_id=new.id;
  delete from public.transaction_amount_components
    where user_id=new.user_id and transaction_id=new.id;

  for item in select value from jsonb_array_elements(
    coalesce(extraction->'transaction_contexts','[]'::jsonb)
  ) where (value->>'transaction_ordinal')::integer=new.ordinal loop
    insert into public.contexts(user_id,name) values(new.user_id,trim(item->>'name'))
      on conflict(user_id,normalized_name) do update set name=excluded.name returning id into context_id;
    insert into public.transaction_contexts(
      user_id,transaction_id,context_id,confidence,evidence,needs_review
    ) values(
      new.user_id,new.id,context_id,(item->>'confidence')::numeric,item->'evidence',
      coalesce((item->>'needs_review')::boolean,false)
    ) on conflict(user_id,transaction_id,context_id) do update set
      confidence=excluded.confidence,evidence=excluded.evidence,needs_review=excluded.needs_review;
  end loop;

  for item,ord in select value,ordinality-1 from jsonb_array_elements(
    coalesce(extraction->'participants','[]'::jsonb)
  ) with ordinality where (value->>'transaction_ordinal')::integer=new.ordinal loop
    person_id:=null;
    if item->>'party_kind'='known_person' and nullif(item->>'display_name','') is not null then
      insert into public.people(user_id,name) values(new.user_id,trim(item->>'display_name'))
        on conflict(user_id,normalized_name) do update set name=excluded.name returning id into person_id;
    end if;
    insert into public.transaction_participants(
      user_id,transaction_id,source_ordinal,person_id,party_kind,display_name,
      participant_count,role,share_minor,share_percentage,split_method,
      confidence,evidence,needs_review
    ) values(
      new.user_id,new.id,ord::integer,person_id,item->>'party_kind',item->>'display_name',
      (item->>'participant_count')::integer,item->>'role',(item->>'share_minor')::bigint,
      (item->>'share_percentage')::numeric,item->>'split_method',(item->>'confidence')::numeric,
      item->'evidence',coalesce((item->>'needs_review')::boolean,false)
    );
  end loop;

  if not exists(select 1 from public.transaction_participants p
    where p.user_id=new.user_id and p.transaction_id=new.id and p.party_kind='self') and
    (new.user_share_minor is not null or new.paid_by_user_minor is not null) then
    insert into public.transaction_participants(
      user_id,transaction_id,source_ordinal,party_kind,display_name,participant_count,
      role,share_minor,share_percentage,split_method,confidence,evidence,needs_review
    ) values(
      new.user_id,new.id,-1,'self','You',1,'participant',abs(new.user_share_minor),null,
      new.split_method,1,null,false
    ) returning id into self_participant;
  else
    select p.id into self_participant from public.transaction_participants p
      where p.user_id=new.user_id and p.transaction_id=new.id and p.party_kind='self'
      order by p.source_ordinal limit 1;
  end if;

  for item in select value from jsonb_array_elements(
    coalesce(extraction->'allocations','[]'::jsonb)
  ) where (value->>'transaction_ordinal')::integer=new.ordinal loop
    participant_source:=(item->>'participant_ordinal')::integer;
    participant_id:=null;
    if participant_source is not null then
      select p.id into participant_id from public.transaction_participants p
        where p.user_id=new.user_id and p.transaction_id=new.id
          and p.source_ordinal=participant_source;
    end if;
    insert into public.transaction_allocations(
      user_id,transaction_id,participant_id,allocation_type,amount_minor,
      confidence,evidence,needs_review
    ) values(
      new.user_id,new.id,participant_id,item->>'allocation_type',
      (item->>'amount_minor')::bigint,(item->>'confidence')::numeric,item->'evidence',
      coalesce((item->>'needs_review')::boolean,false)
    );
  end loop;

  if new.user_share_minor is not null and not exists(
    select 1 from public.transaction_allocations a where a.user_id=new.user_id
      and a.transaction_id=new.id and a.allocation_type='share'
  ) then
    insert into public.transaction_allocations(
      user_id,transaction_id,participant_id,allocation_type,amount_minor,confidence,evidence,needs_review
    ) values(new.user_id,new.id,self_participant,'share',abs(new.user_share_minor),1,
      new.field_evidence->'amount',false);
  end if;
  if new.paid_by_user_minor is not null and not exists(
    select 1 from public.transaction_allocations a where a.user_id=new.user_id
      and a.transaction_id=new.id and a.allocation_type='paid'
  ) then
    insert into public.transaction_allocations(
      user_id,transaction_id,participant_id,allocation_type,amount_minor,confidence,evidence,needs_review
    ) values(new.user_id,new.id,self_participant,'paid',abs(new.paid_by_user_minor),1,
      new.field_evidence->'amount',false);
  end if;

  for item in select value from jsonb_array_elements(
    coalesce(extraction->'amount_components','[]'::jsonb)
  ) where (value->>'transaction_ordinal')::integer=new.ordinal loop
    insert into public.transaction_amount_components(
      user_id,transaction_id,ordinal,label,quantity,unit_price_minor,line_total_minor,
      semantic_role,confidence,evidence,needs_review
    ) values(
      new.user_id,new.id,(item->>'ordinal')::integer,item->>'label',
      (item->>'quantity')::integer,(item->>'unit_price_minor')::bigint,
      (item->>'line_total_minor')::bigint,item->>'semantic_role',
      (item->>'confidence')::numeric,item->'evidence',
      coalesce((item->>'needs_review')::boolean,false)
    );
  end loop;
  return null;
end $$;

create trigger transactions_v2_before
before insert or update on public.transactions
for each row execute function public.finn_transaction_v2_before();
create trigger transactions_v2_children
after insert or update on public.transactions
for each row execute function public.finn_transaction_v2_children();

create function public.finn_entry_v2_resync()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if old.extraction is distinct from new.extraction then
    update public.transactions set description=description
      where user_id=new.user_id and entry_id=new.id;
  end if;
  return null;
end $$;

create trigger journal_entries_v2_resync
after update of extraction on public.journal_entries
for each row execute function public.finn_entry_v2_resync();

-- Populate V2 semantics and normalized children for pre-existing V1 rows.
update public.transactions set description=description;

revoke all on function public.finn_entry_v2_metadata(),public.finn_transaction_v2_before(),
  public.finn_transaction_v2_children(),public.finn_entry_v2_resync()
  from public,anon,authenticated;

create or replace function public.finn_entry_document(p_user uuid,p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',e.id,'source_type',e.source_type,'raw_text',e.raw_text,
 'original_text',e.original_text,'captured_at',e.captured_at,'occurred_on',e.occurred_on,
 'timezone',e.timezone,'currency',e.currency,'revision',e.revision,'extraction',e.extraction,
 'extraction_status',e.extraction_status,'extraction_schema_version',e.extraction_schema_version,
 'interpretation_summary',e.interpretation_summary,'deleted_at',e.deleted_at,
 'receipt',case when a.id is null then null else jsonb_build_object(
   'id',a.id,'status',a.status,'merchant_name',a.merchant_name,
   'purchase_date_text',a.purchase_date_text,
   'printed_subtotal_minor',a.printed_subtotal_minor::text,
   'printed_total_minor',a.printed_total_minor::text,
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

-- Query the normalized transaction semantics. Gemini may choose the metric and
-- filters, but PostgreSQL remains authoritative for arithmetic and exclusions.
create function public.finn_search_page_v2(
  p_filters jsonb,p_limit integer default 20,p_cursor jsonb default null,p_revision text default null
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  r text; result jsonb; rows jsonb; decorated jsonb; last_row jsonb;
  ds date:=(p_filters->>'start_date')::date; de date:=(p_filters->>'end_date')::date;
  dir text:=p_filters->>'direction'; cat text:=p_filters->>'category_id';
  merchant uuid:=(p_filters->>'merchant_id')::uuid; person text:=p_filters->>'person';
  context_name text:=p_filters->>'context'; query text:=p_filters->>'text';
  cur text:=p_filters->>'currency'; requested_metric text:=coalesce(p_filters->>'metric','user_share');
  participant_scope text:=coalesce(p_filters->>'participant_scope','any');
  has_more boolean;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if requested_metric not in (
    'stated_amount','user_share','group_total','paid_by_user','owed_to_user',
    'user_owes','reimbursed','gross_spend'
  ) then raise exception 'invalid_metric'; end if;
  if participant_scope not in ('any','self_only','with_others')
    then raise exception 'invalid_participant_scope'; end if;
  if dir is not null and dir not in ('expense','income','transfer','lent','borrowed','repayment')
    then raise exception 'invalid_direction'; end if;
  if ds is null or de is null or de<=ds or de-ds>3660 or p_limit is null or p_limit not between 1 and 30
    then raise exception 'invalid_range'; end if;
  select coalesce((select revision::text from public.journal_search_revisions
    where user_id=(select auth.uid())),'0') into r;
  if p_cursor is not null and (p_revision is null or p_revision<>r)
    then return jsonb_build_object('stale',true); end if;

  if p_cursor is null then
    with recursive category_scope(id) as (
      select cat where cat is not null
      union all
      select c.id from public.categories c join category_scope s on c.parent_id=s.id
    ), matched as materialized (
      select t.currency,
        case requested_metric
          when 'stated_amount' then t.amount_minor
          when 'user_share' then t.user_share_minor
          when 'group_total' then t.group_total_minor
          when 'paid_by_user' then t.paid_by_user_minor
          when 'owed_to_user' then allocation.owed_to_user
          when 'user_owes' then allocation.user_owes
          when 'reimbursed' then allocation.reimbursed
          when 'gross_spend' then coalesce(t.group_total_minor,t.amount_minor)
        end metric_minor,
        case requested_metric
          when 'stated_amount' then t.amount_minor is not null and t.amount_status='confirmed'
          when 'user_share' then t.user_share_minor is not null and
            not (t.unresolved ?| array['user_share','split_rounding'])
          when 'group_total' then t.group_total_minor is not null
          when 'paid_by_user' then t.paid_by_user_minor is not null and not (t.unresolved ? 'payer')
          when 'owed_to_user' then allocation.owed_to_user is not null and not allocation.owed_to_user_review
          when 'user_owes' then allocation.user_owes is not null and not allocation.user_owes_review
          when 'reimbursed' then allocation.reimbursed is not null and not allocation.reimbursed_review
          when 'gross_spend' then coalesce(t.group_total_minor,t.amount_minor) is not null and
            (t.group_total_minor is not null or t.amount_status='confirmed')
        end metric_confirmed
      from public.transactions t
      join public.journal_entries e on e.id=t.entry_id and e.user_id=t.user_id
      left join lateral (
        select
          sum(a.amount_minor) filter(where a.allocation_type='owed_to_user') owed_to_user,
          bool_or(a.needs_review) filter(where a.allocation_type='owed_to_user') owed_to_user_review,
          sum(a.amount_minor) filter(where a.allocation_type='owed_by_user') user_owes,
          bool_or(a.needs_review) filter(where a.allocation_type='owed_by_user') user_owes_review,
          sum(a.amount_minor) filter(where a.allocation_type in ('reimbursed_to_user','reimbursed_by_user')) reimbursed,
          bool_or(a.needs_review) filter(where a.allocation_type in ('reimbursed_to_user','reimbursed_by_user')) reimbursed_review
        from public.transaction_allocations a
        where a.user_id=t.user_id and a.transaction_id=t.id
      ) allocation on true
      where t.user_id=(select auth.uid()) and e.deleted_at is null
        and t.occurred_on>=ds and t.occurred_on<de
        and (dir is null or t.direction=dir)
        and (cat is null or t.category_id in (select id from category_scope))
        and (merchant is null or t.merchant_id=merchant) and (cur is null or t.currency=cur)
        and (participant_scope='any' or
          (participant_scope='with_others' and exists(
            select 1 from public.transaction_participants tp where tp.user_id=t.user_id
              and tp.transaction_id=t.id and tp.party_kind<>'self'
          )) or
          (participant_scope='self_only' and not exists(
            select 1 from public.transaction_participants tp where tp.user_id=t.user_id
              and tp.transaction_id=t.id and tp.party_kind<>'self'
          )))
        and (person is null or exists(
          select 1 from public.transaction_participants tp
          left join public.people p on p.user_id=tp.user_id and p.id=tp.person_id
          where tp.user_id=t.user_id and tp.transaction_id=t.id
            and lower(trim(coalesce(p.name,tp.display_name,'')))=lower(trim(person))
        ) or (not exists(
          select 1 from public.transaction_participants tp
          where tp.user_id=t.user_id and tp.transaction_id=t.id
        ) and exists(
          select 1 from public.entry_people ep join public.people p
            on p.id=ep.person_id and p.user_id=ep.user_id
          where ep.user_id=t.user_id and ep.entry_id=t.entry_id
            and p.normalized_name=lower(trim(person))
        )))
        and (context_name is null or exists(
          select 1 from public.transaction_contexts tc join public.contexts c
            on c.id=tc.context_id and c.user_id=tc.user_id
          where tc.user_id=t.user_id and tc.transaction_id=t.id
            and c.normalized_name=lower(trim(context_name))
        ) or (not exists(
          select 1 from public.transaction_contexts tc
          where tc.user_id=t.user_id and tc.transaction_id=t.id
        ) and exists(
          select 1 from public.entry_contexts ec join public.contexts c
            on c.id=ec.context_id and c.user_id=ec.user_id
          where ec.user_id=t.user_id and ec.entry_id=t.entry_id
            and c.normalized_name=lower(trim(context_name))
        )))
        and (query is null or e.search_vector @@ websearch_to_tsquery('simple',query))
    ), totals as (
      select currency,
        coalesce(sum(metric_minor) filter(where metric_confirmed),0)::text total_minor,
        count(*) filter(where metric_confirmed) confirmed_count,
        count(*) filter(where not coalesce(metric_confirmed,false)) review_count
      from matched group by currency
    ) select jsonb_build_object(
      'totals',coalesce((select jsonb_agg(to_jsonb(totals) order by currency) from totals),'[]'::jsonb),
      'matching_count',(select count(*) from matched),
      'known_split_count',(select count(*) from matched where metric_confirmed),
      'unknown_split_count',(select count(*) from matched where not coalesce(metric_confirmed,false))
    ) into result;
  else result:='{}'::jsonb;
  end if;

  with recursive category_scope(id) as (
    select cat where cat is not null
    union all
    select c.id from public.categories c join category_scope s on c.parent_id=s.id
  )
  select coalesce(jsonb_agg(to_jsonb(page) order by page.occurred_on desc,page.entry_id desc,page.id desc),'[]'::jsonb)
  into rows from (
    select t.id,t.entry_id,t.description,t.amount_minor::text amount_minor,t.currency,
      t.direction,t.cash_flow,t.category_id,c.name category_name,t.merchant_id,
      coalesce(m.canonical_name,a.merchant_name) merchant_name,t.occurred_on,
      t.amount_status,t.quantity,t.quantity_unit,t.unit_price_minor::text unit_price_minor,
      t.primary_amount_role,t.group_total_minor::text group_total_minor,
      t.user_share_minor::text user_share_minor,t.paid_by_user_minor::text paid_by_user_minor,
      t.split_method,t.participant_count,t.allocation_status,t.needs_review,
      case requested_metric
        when 'stated_amount' then t.amount_minor
        when 'user_share' then t.user_share_minor
        when 'group_total' then t.group_total_minor
        when 'paid_by_user' then t.paid_by_user_minor
        when 'owed_to_user' then allocation.owed_to_user
        when 'user_owes' then allocation.user_owes
        when 'reimbursed' then allocation.reimbursed
        when 'gross_spend' then coalesce(t.group_total_minor,t.amount_minor)
      end::text metric_minor,
      case requested_metric
        when 'stated_amount' then t.amount_minor is not null and t.amount_status='confirmed'
        when 'user_share' then t.user_share_minor is not null and
          not (t.unresolved ?| array['user_share','split_rounding'])
        when 'group_total' then t.group_total_minor is not null
        when 'paid_by_user' then t.paid_by_user_minor is not null and not (t.unresolved ? 'payer')
        when 'owed_to_user' then allocation.owed_to_user is not null
        when 'user_owes' then allocation.user_owes is not null
        when 'reimbursed' then allocation.reimbursed is not null
        when 'gross_spend' then coalesce(t.group_total_minor,t.amount_minor) is not null and
          (t.group_total_minor is not null or t.amount_status='confirmed')
      end metric_confirmed,
      coalesce(e.raw_text,a.merchant_name,'Receipt') raw_text,
      coalesce((select jsonb_agg(jsonb_build_object(
        'ordinal',ac.ordinal,'label',ac.label,'quantity',ac.quantity,
        'unit_price_minor',ac.unit_price_minor::text,'line_total_minor',ac.line_total_minor::text,
        'semantic_role',ac.semantic_role,'needs_review',ac.needs_review
      ) order by ac.ordinal) from public.transaction_amount_components ac
        where ac.user_id=t.user_id and ac.transaction_id=t.id),'[]'::jsonb) amount_components,
      coalesce((select jsonb_agg(jsonb_build_object(
        'display_name',coalesce(p.name,tp.display_name),'party_kind',tp.party_kind,
        'participant_count',tp.participant_count,'role',tp.role,'share_minor',tp.share_minor::text,
        'split_method',tp.split_method,'needs_review',tp.needs_review
      ) order by tp.source_ordinal) from public.transaction_participants tp
        left join public.people p on p.user_id=tp.user_id and p.id=tp.person_id
        where tp.user_id=t.user_id and tp.transaction_id=t.id),'[]'::jsonb) participants,
      coalesce((select jsonb_agg(jsonb_build_object('name',cx.name,'needs_review',tc.needs_review)
        order by cx.name) from public.transaction_contexts tc join public.contexts cx
          on cx.user_id=tc.user_id and cx.id=tc.context_id
        where tc.user_id=t.user_id and tc.transaction_id=t.id),'[]'::jsonb) contexts
    from public.transactions t
    join public.journal_entries e on e.id=t.entry_id and e.user_id=t.user_id
    join public.categories c on c.id=t.category_id
    left join public.merchants m on m.id=t.merchant_id
    left join public.receipt_attachments a on a.entry_id=e.id and a.user_id=e.user_id
    left join lateral (
      select
        sum(ta.amount_minor) filter(where ta.allocation_type='owed_to_user') owed_to_user,
        sum(ta.amount_minor) filter(where ta.allocation_type='owed_by_user') user_owes,
        sum(ta.amount_minor) filter(where ta.allocation_type in ('reimbursed_to_user','reimbursed_by_user')) reimbursed
      from public.transaction_allocations ta
      where ta.user_id=t.user_id and ta.transaction_id=t.id and not ta.needs_review
    ) allocation on true
    where t.user_id=(select auth.uid()) and e.deleted_at is null
      and t.occurred_on>=ds and t.occurred_on<de
      and (dir is null or t.direction=dir)
      and (cat is null or t.category_id in (select id from category_scope))
      and (merchant is null or t.merchant_id=merchant) and (cur is null or t.currency=cur)
      and (participant_scope='any' or
        (participant_scope='with_others' and exists(select 1 from public.transaction_participants tp
          where tp.user_id=t.user_id and tp.transaction_id=t.id and tp.party_kind<>'self')) or
        (participant_scope='self_only' and not exists(select 1 from public.transaction_participants tp
          where tp.user_id=t.user_id and tp.transaction_id=t.id and tp.party_kind<>'self')))
      and (person is null or exists(select 1 from public.transaction_participants tp
        left join public.people p on p.user_id=tp.user_id and p.id=tp.person_id
        where tp.user_id=t.user_id and tp.transaction_id=t.id
          and lower(trim(coalesce(p.name,tp.display_name,'')))=lower(trim(person)))
        or (not exists(select 1 from public.transaction_participants tp
          where tp.user_id=t.user_id and tp.transaction_id=t.id) and exists(
          select 1 from public.entry_people ep join public.people p
            on p.id=ep.person_id and p.user_id=ep.user_id
          where ep.user_id=t.user_id and ep.entry_id=t.entry_id
            and p.normalized_name=lower(trim(person)))))
      and (context_name is null or exists(select 1 from public.transaction_contexts tc
        join public.contexts cx on cx.id=tc.context_id and cx.user_id=tc.user_id
        where tc.user_id=t.user_id and tc.transaction_id=t.id
          and cx.normalized_name=lower(trim(context_name)))
        or (not exists(select 1 from public.transaction_contexts tc
          where tc.user_id=t.user_id and tc.transaction_id=t.id) and exists(
          select 1 from public.entry_contexts ec join public.contexts cx
            on cx.id=ec.context_id and cx.user_id=ec.user_id
          where ec.user_id=t.user_id and ec.entry_id=t.entry_id
            and cx.normalized_name=lower(trim(context_name)))))
      and (query is null or e.search_vector @@ websearch_to_tsquery('simple',query))
      and (p_cursor is null or (t.occurred_on,t.entry_id,t.id)<
        ((p_cursor->>'day')::date,(p_cursor->>'entry_id')::uuid,(p_cursor->>'id')::uuid))
    order by t.occurred_on desc,t.entry_id desc,t.id desc limit p_limit+1
  ) page;
  has_more:=jsonb_array_length(rows)>p_limit;
  select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) into decorated
    from jsonb_array_elements(rows) with ordinality a(value,ord) where ord<=p_limit;
  last_row:=decorated->(jsonb_array_length(decorated)-1);
  return result||jsonb_build_object(
    'transactions',decorated,'revision',r,'has_more',has_more,'limit',p_limit,
    'metric',requested_metric,
    'next_cursor',case when has_more then jsonb_build_object('day',last_row->>'occurred_on',
      'entry_id',last_row->>'entry_id','id',last_row->>'id') else null end);
end $$;

revoke all on function public.finn_search_page_v2(jsonb,integer,jsonb,text)
  from public,anon;
grant execute on function public.finn_search_page_v2(jsonb,integer,jsonb,text)
  to authenticated,service_role;
