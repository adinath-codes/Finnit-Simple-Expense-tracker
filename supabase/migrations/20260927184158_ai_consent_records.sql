-- A user's legal-account checkbox is not permission to transmit financial data
-- to an external AI provider. Keep an explicit, versioned, owner-scoped choice.
create table public.ai_consent_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null
    check (length(policy_version) between 1 and 64),
  decision text not null
    check (decision in ('granted', 'declined')),
  provider text not null
    check (provider = 'Google Gemini'),
  data_categories text[] not null
    check (
      cardinality(data_categories) = 3 and
      data_categories @> array[
        'financial notes',
        'receipt images',
        'financial context'
      ]::text[]
    ),
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, policy_version)
);

alter table public.ai_consent_records enable row level security;

revoke all on table public.ai_consent_records from anon, authenticated;
grant select, insert, update on table public.ai_consent_records to authenticated;
grant all on table public.ai_consent_records to service_role;

create policy ai_consent_records_owner_select
  on public.ai_consent_records for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy ai_consent_records_owner_insert
  on public.ai_consent_records for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy ai_consent_records_owner_update
  on public.ai_consent_records for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
