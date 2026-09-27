begin;

select plan(20);

select ok(
  not coalesce((select prosecdef from pg_proc where oid =
    'public.finn_analyze_money_v3(jsonb,integer,jsonb,text)'::regprocedure), true),
  'analytics RPC is security invoker'
);
select ok(
  has_function_privilege('authenticated',
    'public.finn_analyze_money_v3(jsonb,integer,jsonb,text)', 'execute'),
  'authenticated users can execute the analytics RPC'
);

insert into auth.users(
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('a1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'ask-finn-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('b2000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'ask-finn-b@example.test', '', now(), '{}', '{}', now(), now());

insert into public.people(id, user_id, name) values
  ('a1000000-0000-4000-8000-000000000010', 'a1000000-0000-4000-8000-000000000001', 'Chris');
insert into public.contexts(id, user_id, name) values
  ('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000001', 'Friends');

insert into public.journal_entries(
  id, user_id, original_text, raw_text, capture_request, captured_at,
  occurred_at, occurred_on, timezone, currency, extraction, search_text
) values
  ('a1000000-0000-4000-8000-000000000101', 'a1000000-0000-4000-8000-000000000001', 'Lunch 10', 'Lunch 10', '{}', '2026-01-10 12:00Z', '2026-01-10 12:00Z', '2026-01-10', 'UTC', 'USD', '{}', 'Lunch'),
  ('a1000000-0000-4000-8000-000000000102', 'a1000000-0000-4000-8000-000000000001', 'Ride 30', 'Ride 30', '{}', '2026-01-11 12:00Z', '2026-01-11 12:00Z', '2026-01-11', 'UTC', 'USD', '{}', 'Ride'),
  ('a1000000-0000-4000-8000-000000000103', 'a1000000-0000-4000-8000-000000000001', 'Shoes 30', 'Shoes 30', '{}', '2026-01-12 12:00Z', '2026-01-12 12:00Z', '2026-01-12', 'UTC', 'USD', '{}', 'Shoes'),
  ('a1000000-0000-4000-8000-000000000104', 'a1000000-0000-4000-8000-000000000001', 'Coffee unknown', 'Coffee unknown', '{}', '2026-01-13 12:00Z', '2026-01-13 12:00Z', '2026-01-13', 'UTC', 'USD', '{}', 'Coffee'),
  ('a1000000-0000-4000-8000-000000000105', 'a1000000-0000-4000-8000-000000000001', 'Hotel euro', 'Hotel euro', '{}', '2026-01-14 12:00Z', '2026-01-14 12:00Z', '2026-01-14', 'UTC', 'EUR', '{}', 'Hotel'),
  ('a1000000-0000-4000-8000-000000000106', 'a1000000-0000-4000-8000-000000000001', 'December bill', 'December bill', '{}', '2025-12-15 12:00Z', '2025-12-15 12:00Z', '2025-12-15', 'UTC', 'USD', '{}', 'Bill'),
  ('a1000000-0000-4000-8000-000000000107', 'a1000000-0000-4000-8000-000000000001', 'Dinner with Chris', 'Dinner with Chris', '{}', '2026-01-15 12:00Z', '2026-01-15 12:00Z', '2026-01-15', 'UTC', 'USD', '{}', 'Dinner Chris Friends'),
  ('a1000000-0000-4000-8000-000000000108', 'a1000000-0000-4000-8000-000000000001', 'Snack 10.01', 'Snack 10.01', '{}', '2026-01-16 12:00Z', '2026-01-16 12:00Z', '2026-01-16', 'UTC', 'USD', '{}', 'Snack'),
  ('b2000000-0000-4000-8000-000000000109', 'b2000000-0000-4000-8000-000000000002', 'Private purchase', 'Private purchase', '{}', '2026-01-17 12:00Z', '2026-01-17 12:00Z', '2026-01-17', 'UTC', 'USD', '{}', 'Private');

insert into public.transactions(
  id, user_id, entry_id, ordinal, description, amount_minor, currency,
  direction, cash_flow, category_id, category_source, occurred_at, occurred_on,
  amount_status, confidence, needs_review, unresolved, primary_amount_role,
  group_total_minor, user_share_minor, paid_by_user_minor, split_method,
  participant_count, allocation_status
) values
  ('a1000000-0000-4000-8000-000000001101', 'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000101', 0, 'Lunch', 1000, 'USD', 'expense', 'out', 'food.dining', 'user_correction', '2026-01-10 12:00Z', '2026-01-10', 'confirmed', 1, false, '[]', 'personal_total', 1000, 1000, 1000, 'not_applicable', 1, 'not_applicable'),
  ('a1000000-0000-4000-8000-000000001102', 'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000102', 0, 'Ride', 3000, 'USD', 'expense', 'out', 'transport.ride_hailing', 'user_correction', '2026-01-11 12:00Z', '2026-01-11', 'confirmed', 1, false, '[]', 'personal_total', 3000, 3000, 3000, 'not_applicable', 1, 'not_applicable'),
  ('a1000000-0000-4000-8000-000000001103', 'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000103', 0, 'Shoes', 3000, 'USD', 'expense', 'out', 'shopping.clothing', 'user_correction', '2026-01-12 12:00Z', '2026-01-12', 'confirmed', 1, false, '[]', 'personal_total', 3000, 3000, 3000, 'not_applicable', 1, 'not_applicable'),
  ('a1000000-0000-4000-8000-000000001104', 'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000104', 0, 'Coffee', null, 'USD', 'expense', 'out', 'food.dining', 'user_correction', '2026-01-13 12:00Z', '2026-01-13', 'missing', 1, true, '["user_share"]', 'unknown', null, null, null, 'unknown', 1, 'unknown'),
  ('a1000000-0000-4000-8000-000000001105', 'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000105', 0, 'Hotel', 999900, 'EUR', 'expense', 'out', 'travel.lodging', 'user_correction', '2026-01-14 12:00Z', '2026-01-14', 'confirmed', 1, false, '[]', 'personal_total', 999900, 999900, 999900, 'not_applicable', 1, 'not_applicable'),
  ('a1000000-0000-4000-8000-000000001106', 'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000106', 0, 'December bill', 2000, 'USD', 'expense', 'out', 'bills.utilities', 'user_correction', '2025-12-15 12:00Z', '2025-12-15', 'confirmed', 1, false, '[]', 'personal_total', 2000, 2000, 2000, 'not_applicable', 1, 'not_applicable'),
  ('a1000000-0000-4000-8000-000000001107', 'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000107', 0, 'Dinner with Chris', 9000, 'USD', 'expense', 'out', 'transport.ride_hailing', 'user_correction', '2026-01-15 12:00Z', '2026-01-15', 'confirmed', 1, false, '[]', 'group_total', 9000, 3000, 9000, 'equal', 3, 'complete'),
  ('a1000000-0000-4000-8000-000000001108', 'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000108', 0, 'Snack', 1001, 'USD', 'expense', 'out', 'food.dining', 'user_correction', '2026-01-16 12:00Z', '2026-01-16', 'confirmed', 1, false, '[]', 'personal_total', 1001, 1001, 1001, 'not_applicable', 1, 'not_applicable'),
  ('a1000000-0000-4000-8000-000000001110', 'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000104', 1, 'Estimated snack', 500, 'USD', 'expense', 'out', 'food.dining', 'user_correction', '2026-01-13 12:01Z', '2026-01-13', 'estimated', 1, true, '["user_share"]', 'unknown', 500, 500, 500, 'unknown', 1, 'unknown'),
  ('b2000000-0000-4000-8000-000000001109', 'b2000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000109', 0, 'Private purchase', 777777, 'USD', 'expense', 'out', 'shopping.electronics', 'user_correction', '2026-01-17 12:00Z', '2026-01-17', 'confirmed', 1, false, '[]', 'personal_total', 777777, 777777, 777777, 'not_applicable', 1, 'not_applicable');

insert into public.transaction_participants(
  id, user_id, transaction_id, source_ordinal, person_id, party_kind,
  display_name, participant_count, role, share_minor, split_method,
  confidence, needs_review
) values
  ('a1000000-0000-4000-8000-000000002101', 'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000001107', 0, null, 'self', 'You', 1, 'payer', 3000, 'equal', 1, false),
  ('a1000000-0000-4000-8000-000000002102', 'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000001107', 1, 'a1000000-0000-4000-8000-000000000010', 'known_person', 'Chris', 1, 'debtor', 3000, 'equal', 1, false);
insert into public.transaction_allocations(
  id, user_id, transaction_id, participant_id, allocation_type,
  amount_minor, confidence, needs_review
) values
  ('a1000000-0000-4000-8000-000000003101', 'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000001107', 'a1000000-0000-4000-8000-000000002102', 'owed_to_user', 500, 1, false);
insert into public.transaction_contexts(
  user_id, transaction_id, context_id, confidence, evidence, needs_review
) values
  ('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000001107', 'a1000000-0000-4000-8000-000000000020', 1, '{}', false);

create temporary table ask_results(name text primary key, payload jsonb);
grant all on ask_results to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);

insert into ask_results values
  ('sum', public.finn_analyze_money_v3('{"operation":"sum","metric":"user_share","direction":"expense","start_date":"2026-01-01","end_date":"2026-02-01","currency":"USD"}', 20, null, null)),
  ('rank', public.finn_analyze_money_v3('{"operation":"rank","metric":"user_share","direction":"expense","group_by":["entry"],"sort_direction":"desc","result_limit":1,"start_date":"2026-01-01","end_date":"2026-02-01","currency":"USD"}', 20, null, null)),
  ('category', public.finn_analyze_money_v3('{"operation":"sum","metric":"user_share","direction":"expense","category_ids":["transport"],"start_date":"2026-01-01","end_date":"2026-02-01","currency":"USD"}', 20, null, null)),
  ('average', public.finn_analyze_money_v3('{"operation":"average","metric":"user_share","direction":"expense","group_by":["entry"],"start_date":"2026-01-01","end_date":"2026-02-01","currency":"USD"}', 20, null, null)),
  ('compare', public.finn_analyze_money_v3('{"operation":"compare","metric":"user_share","direction":"expense","start_date":"2026-01-01","end_date":"2026-02-01","comparison_start_date":"2025-12-01","comparison_end_date":"2026-01-01","currency":"USD"}', 20, null, null)),
  ('context', public.finn_analyze_money_v3('{"operation":"sum","metric":"user_share","direction":"expense","contexts":["Friends"],"contexts_match":"all","start_date":"2026-01-01","end_date":"2026-02-01","currency":"USD"}', 20, null, null)),
  ('people', public.finn_analyze_money_v3('{"operation":"count","metric":"user_share","direction":"expense","people":["Chris"],"people_match":"all","start_date":"2026-01-01","end_date":"2026-02-01","currency":"USD"}', 20, null, null)),
  ('debt', public.finn_analyze_money_v3('{"operation":"breakdown","metric":"owed_to_user","group_by":["participant"],"start_date":"2026-01-01","end_date":"2026-02-01","currency":"USD"}', 20, null, null)),
  ('page', public.finn_analyze_money_v3('{"operation":"list","metric":"user_share","direction":"expense","start_date":"2026-01-01","end_date":"2026-02-01","currency":"USD"}', 2, null, null));

select is((select payload->>'matching_count' from ask_results where name='sum'), '7',
  'count includes matching rows while preserving missing and estimated review rows');
select is((select payload->'totals'->0->>'total_minor' from ask_results where name='sum'), '11001',
  'sum uses only confirmed current-currency values');
select is((select payload->>'known_split_count' from ask_results where name='sum'), '5',
  'confirmed arithmetic count is exact');
select is((select payload->>'unknown_split_count' from ask_results where name='sum'), '2',
  'missing and estimated values are reported for review and excluded from arithmetic');
select ok(not exists(
  select 1 from ask_results r, jsonb_array_elements(r.payload->'transactions') tx
  where r.name='sum' and tx->>'currency'<>'USD'
), 'current-currency filter prevents mixed-currency answers and evidence');
select is((select jsonb_array_length(payload->'advanced_answer'->'rows')::text from ask_results where name='rank'), '3',
  'ranking retains all exact ties at the requested rank');
select is((select payload->>'evidence_count' from ask_results where name='rank'), '3',
  'ranking evidence contains only contributing winner transactions');
select is((select payload->'totals'->0->>'total_minor' from ask_results where name='category'), '6000',
  'parent category filters include descendants');
select is((select payload->'advanced_answer'->'rows'->0->>'value_minor' from ask_results where name='average'), '2200',
  'average rounds once to the currency minor unit');
select is((select payload->'advanced_answer'->'rows'->0->>'rounded' from ask_results where name='average'), 'true',
  'rounded averages are labeled');
select is((select payload->'advanced_answer'->'rows'->0->>'delta_minor' from ask_results where name='compare'), '9001',
  'comparison returns the exact current-minus-baseline delta');
select is((select payload->'advanced_answer'->'rows'->0->>'change_percent' from ask_results where name='compare'), '450.05',
  'comparison percentage is based on a nonzero exact baseline');
select is((select payload->'totals'->0->>'total_minor' from ask_results where name='context'), '3000',
  'context all-match filters are applied');
select is((select payload->'advanced_answer'->'rows'->0->>'value_count' from ask_results where name='people'), '1',
  'participant all-match filters are applied');
select is((select payload->'advanced_answer'->'rows'->0->>'value_minor' from ask_results where name='debt'), '500',
  'debt breakdown uses exact participant allocations');
select ok((select (payload->>'has_more')::boolean from ask_results where name='page'),
  'source evidence uses revision-safe keyset pagination');

insert into ask_results values ('stale', public.finn_analyze_money_v3(
  '{"operation":"list","metric":"user_share","direction":"expense","start_date":"2026-01-01","end_date":"2026-02-01","currency":"USD"}',
  2, (select payload->'next_cursor' from ask_results where name='page'), '-1'));
select ok((select (payload->>'stale')::boolean from ask_results where name='stale'),
  'stale revisions cannot mix evidence pages');

select set_config('request.jwt.claim.sub', 'b2000000-0000-4000-8000-000000000002', true);
insert into ask_results values ('other_user', public.finn_analyze_money_v3(
  '{"operation":"sum","metric":"user_share","direction":"expense","start_date":"2026-01-01","end_date":"2026-02-01","currency":"USD"}',
  20, null, null));
select is((select payload->>'matching_count' from ask_results where name='other_user'), '1',
  'security-invoker RLS isolates users in both directions');

select * from finish();
rollback;
