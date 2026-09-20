-- Account metadata is separate from financial entries. Clients may read/write
-- only their own rows through RLS; the mobile outbox writes locally first.
create table public.user_settings (
  user_id uuid primary key references auth.users on delete cascade,
  currency text not null references public.currencies(code),
  location_enabled boolean not null default false,
  reminders_enabled boolean not null default false,
  reminder_frequency text not null check (length(reminder_frequency) between 1 and 60),
  reminder_time text not null check (length(reminder_time) between 1 and 30),
  back_tap_quick_add boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_presets (
  user_id uuid not null references auth.users on delete cascade,
  id text not null check (length(id) between 1 and 100),
  name text not null check (length(name) between 1 and 100),
  note text not null check (length(note) between 1 and 4000),
  amount_minor bigint not null check (amount_minor between 1 and 9007199254740991),
  category_id text not null references public.categories(id)
    check (category_id in ('food', 'transport', 'shopping', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index user_presets_updated_idx on public.user_presets(user_id, updated_at desc, id);

alter table public.user_settings enable row level security;
alter table public.user_presets enable row level security;

create policy user_settings_owner on public.user_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy user_presets_owner on public.user_presets
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.user_settings, public.user_presets from anon, authenticated;
grant select, insert, update, delete on public.user_settings, public.user_presets to authenticated;
grant all on public.user_settings, public.user_presets to service_role;
