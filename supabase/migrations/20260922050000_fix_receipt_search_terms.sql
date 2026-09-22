-- PostgreSQL parses `||` before `->>` in these PL/pgSQL assignments unless
-- the JSON extraction is grouped. Repair both deployed receipt writers
-- without changing their signatures, permissions, or surrounding behavior.
do $$
declare
  routine record;
  original_definition text;
  corrected_definition text;
begin
  for routine in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('finn_commit_receipt', 'finn_correct_receipt')
  loop
    original_definition := pg_get_functiondef(routine.oid);
    corrected_definition := replace(
      original_definition,
      'search_terms:=search_terms||'' ''||line->>''description'';',
      'search_terms:=search_terms||'' ''||(line->>''description'');'
    );
    if corrected_definition = original_definition then
      raise exception 'receipt_search_expression_not_found: %', routine.proname;
    end if;
    execute corrected_definition;
  end loop;
end $$;
