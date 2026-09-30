-- The V2 child-normalization trigger used `context_id` as both a local
-- PL/pgSQL variable and a column name in an ON CONFLICT target. PostgreSQL
-- rejects contextual entries as ambiguous before their structured breakdown
-- can be committed. Give the local value an unambiguous name.
create or replace function public.finn_transaction_v2_children()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
  extraction jsonb; item jsonb; ord bigint; transaction_context_id uuid; person_id uuid;
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
      on conflict(user_id,normalized_name) do update set name=excluded.name
      returning id into transaction_context_id;
    insert into public.transaction_contexts(
      user_id,transaction_id,context_id,confidence,evidence,needs_review
    ) values(
      new.user_id,new.id,transaction_context_id,(item->>'confidence')::numeric,
      item->'evidence',coalesce((item->>'needs_review')::boolean,false)
    ) on conflict(user_id,transaction_id,context_id) do update set
      confidence=excluded.confidence,evidence=excluded.evidence,
      needs_review=excluded.needs_review;
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
