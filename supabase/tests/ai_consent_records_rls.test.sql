begin;

select plan(10);

insert into auth.users(
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('c1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'consent-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('c2000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'consent-b@example.test', '', now(), '{}', '{}', now(), now());

insert into public.ai_consent_records(
  user_id, policy_version, decision, provider, data_categories
) values (
  'c2000000-0000-4000-8000-000000000002',
  '2026-09-28',
  'granted',
  'Google Gemini',
  array['financial notes', 'receipt images', 'financial context']
);

select ok(
  not has_table_privilege('anon', 'public.ai_consent_records', 'select,insert,update,delete'),
  'signed-out clients have no consent-table privileges'
);
select ok(
  has_table_privilege('authenticated', 'public.ai_consent_records', 'select,insert,update')
    and not has_table_privilege('authenticated', 'public.ai_consent_records', 'delete'),
  'signed-in clients can record choices but cannot erase the audit row'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$insert into public.ai_consent_records(
      user_id, policy_version, decision, provider, data_categories
    ) values (
      'c1000000-0000-4000-8000-000000000001',
      '2026-09-28',
      'declined',
      'Google Gemini',
      array['financial notes', 'receipt images', 'financial context']
    )$$,
  'a user can record their own explicit choice'
);
select is(
  (select decision from public.ai_consent_records where policy_version = '2026-09-28'),
  'declined',
  'a user can read their own current-version choice'
);
select is(
  (select count(*)::integer from public.ai_consent_records),
  1,
  'another account consent row is invisible'
);
select throws_ok(
  $$insert into public.ai_consent_records(
      user_id, policy_version, decision, provider, data_categories
    ) values (
      'c2000000-0000-4000-8000-000000000002',
      'another-version',
      'granted',
      'Google Gemini',
      array['financial notes']
    )$$,
  '42501',
  null,
  'a user cannot grant consent for another account'
);
select lives_ok(
  $$update public.ai_consent_records
      set decision = 'granted', decided_at = now(), updated_at = now()
      where user_id = 'c1000000-0000-4000-8000-000000000001'
        and policy_version = '2026-09-28'$$,
  'a user can change their own choice'
);
select is(
  (select decision from public.ai_consent_records where policy_version = '2026-09-28'),
  'granted',
  'the changed choice is stored'
);
select throws_ok(
  $$update public.ai_consent_records
      set user_id = 'c2000000-0000-4000-8000-000000000002'
      where user_id = 'c1000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a user cannot reassign a consent row to another account'
);
select throws_ok(
  $$delete from public.ai_consent_records
      where user_id = 'c1000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'clients cannot delete the versioned choice record'
);

select * from finish();
rollback;
