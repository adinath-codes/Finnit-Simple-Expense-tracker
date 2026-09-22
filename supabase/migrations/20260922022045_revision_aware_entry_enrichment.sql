-- An enrichment claim belongs to a particular deterministic interpretation,
-- so editing a note can request one new model pass without reopening old claims.
alter table public.journal_entries
  add column llm_attempted_revision integer;

update public.journal_entries
set llm_attempted_revision = 1
where llm_attempted;

create or replace function public.finn_claim_enrichment(
  p_user uuid, p_id uuid, p_revision integer
) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  update public.journal_entries
  set llm_attempted = true, llm_attempted_revision = p_revision
  where user_id = p_user and id = p_id and revision = p_revision
    and llm_attempted_revision is distinct from p_revision
    and deleted_at is null;
  return found;
end $$;

-- Edge Functions use this only to reject conflicting operation IDs and return
-- completed retries before consuming another request or AI quota reservation.
create function public.finn_mutation_document(p_user uuid, p_operation_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('request', request, 'response', response)
  from finn_private.mutations
  where user_id = p_user and operation_id = p_operation_id;
$$;

revoke all on function public.finn_mutation_document(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.finn_mutation_document(uuid, uuid)
  to service_role;
