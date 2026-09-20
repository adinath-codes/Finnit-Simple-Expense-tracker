-- Receipt images are transient request inputs only. Supabase persists the
-- extracted receipt text and financial structure, never image bytes or image
-- identifiers. Before applying this migration to a project that already used
-- receipt-images, empty and delete that bucket through the Storage API so the
-- physical objects are deleted rather than orphaned by direct SQL.

drop policy if exists receipt_images_owner_insert on storage.objects;
drop policy if exists receipt_images_owner_read on storage.objects;
drop policy if exists receipt_images_owner_delete on storage.objects;

create or replace function public.finn_entry_document(p_user uuid,p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',e.id,'source_type',e.source_type,'raw_text',e.raw_text,
 'original_text',e.original_text,'captured_at',e.captured_at,'occurred_on',e.occurred_on,
 'timezone',e.timezone,'currency',e.currency,'revision',e.revision,'extraction',e.extraction,
 'deleted_at',e.deleted_at,
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

create or replace function public.finn_commit_receipt(
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
   aid,p_user,eid,p_receipt->>'status',p_receipt->>'merchant_name',
   p_receipt->>'purchase_date_text',(p_receipt->>'printed_subtotal_minor')::bigint,
   (p_receipt->>'printed_total_minor')::bigint,p_receipt->>'currency',
   (p_receipt->>'confidence')::numeric,(p_receipt->>'needs_review')::boolean,
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

alter table public.receipt_attachments
  drop column if exists object_path,
  drop column if exists sha256,
  drop column if exists mime_type,
  drop column if exists byte_size,
  drop column if exists width,
  drop column if exists height;

update public.journal_entries
set capture_request = capture_request
  - 'object_path' - 'sha256' - 'mime_type' - 'byte_size' - 'width' - 'height'
where source_type = 'receipt';

update finn_private.mutations
set request = case
      when jsonb_typeof(request->'request') = 'object'
      then jsonb_set(
        request,
        '{request}',
        (request->'request')
          - 'object_path' - 'sha256' - 'mime_type' - 'byte_size' - 'width' - 'height'
      )
      else request
    end,
    response = case
      when jsonb_typeof(response->'receipt') = 'object'
      then jsonb_set(
        response,
        '{receipt}',
        (response->'receipt')
          - 'object_path' - 'sha256' - 'mime_type' - 'byte_size' - 'width' - 'height'
      )
      else response
    end;
