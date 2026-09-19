-- One minimal, owner-scoped onboarding record. The raw answers stay bounded and
-- the columns Finn uses at runtime are constrained independently.
create table public.user_onboarding (
  user_id uuid primary key references auth.users on delete cascade,
  flow_version text not null check (length(flow_version) between 1 and 40),
  status text not null check (status in ('in_progress', 'completed')),
  current_step_id text not null check (length(current_step_id) between 1 and 60),
  answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 4096),
  primary_goal text check (
    primary_goal is null or primary_goal in ('remember', 'effortless', 'patterns', 'context')
  ),
  tracking_friction text check (
    tracking_friction is null or tracking_friction in (
      'too-many-fields', 'forget', 'missing-context', 'feels-like-work'
    )
  ),
  base_currency text references public.currencies(code),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'completed') = (completed_at is not null))
);

alter table public.user_onboarding enable row level security;

create policy user_onboarding_select_own
on public.user_onboarding
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy user_onboarding_insert_own
on public.user_onboarding
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy user_onboarding_update_own
on public.user_onboarding
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy user_onboarding_delete_own
on public.user_onboarding
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.user_onboarding from anon, authenticated;
grant select, insert, update, delete on public.user_onboarding to authenticated;
grant all on public.user_onboarding to service_role;
