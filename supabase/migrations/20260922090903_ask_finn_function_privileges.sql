-- Supabase installs this event-trigger helper with PUBLIC EXECUTE on some
-- projects. The Ask Finn read role must have no callable public routines.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public;
  end if;
end $$;
