-- The restricted reader's RLS policies call auth.uid(). Supabase may reset
-- grants on the managed auth schema while deploying platform components, so
-- keep this dependency explicit immediately before enabling the route.
grant usage on schema auth to finn_ask_reader;
grant execute on function auth.uid() to finn_ask_reader;
