-- This platform-installed event-trigger helper is not an application RPC.
-- Keep it unreachable through the exposed Data API even if a platform update
-- recreates it with default EXECUTE grants.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable()
      from public, anon, authenticated;
  end if;
end
$$;
