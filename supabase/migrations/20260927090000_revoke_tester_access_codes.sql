-- Permanently disable the legacy non-IAP Premium redemption mechanism.
-- Keep existing private redemption records for audit purposes, but remove the
-- callable RPCs and revoke every code that may have existed in a deployed DB.
do $$
begin
  if to_regclass('finn_private.testing_access_codes') is not null then
    execute 'update finn_private.testing_access_codes set enabled = false';
  end if;
end
$$;

drop function if exists public.finn_reserve_testing_access_code(uuid, text);
drop function if exists public.finn_complete_testing_access_code(
  uuid,
  text,
  timestamptz
);
