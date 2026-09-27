-- A failed AI operation has no committed interpretation to preserve. Allow the
-- same immutable task/input to retry after a schema, prompt, or model upgrade,
-- while keeping completed, in-flight, and changed-input idempotency strict.
create or replace function public.finn_claim_ai_operation(
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
       current_op.entry_revision<>p_entry_revision or current_op.input_hash<>p_input_hash
      then raise exception 'idempotency_conflict'; end if;
    if current_op.schema_version<>p_schema_version or
       current_op.prompt_version<>p_prompt_version or
       current_op.model_version<>p_model_version then
      if current_op.status<>'failed' then raise exception 'idempotency_conflict'; end if;
      delete from finn_private.ai_operations
        where user_id=p_user and operation_id=p_operation_id;
    else
      if current_op.status='complete' then return 'complete'; end if;
      if current_op.status='in_progress' and current_op.updated_at>now()-interval '2 minutes'
        then return 'in_progress'; end if;
      update finn_private.ai_operations set status='in_progress',validation_code=null,
        started_at=now(),updated_at=now(),completed_at=null
        where user_id=p_user and operation_id=p_operation_id;
      return 'claimed';
    end if;
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

revoke all on function public.finn_claim_ai_operation(
  uuid,uuid,text,uuid,integer,text,integer,text,text
) from public,anon,authenticated;
grant execute on function public.finn_claim_ai_operation(
  uuid,uuid,text,uuid,integer,text,integer,text,text
) to service_role;

