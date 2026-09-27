-- Patch the already-deployed definition without duplicating its long, audited
-- body. Fresh databases get the corrected name in the preceding migration.
do $migration$
declare definition text;
begin
  select pg_get_functiondef(p.oid) into definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='finn_analyze_money_v3'
    and p.pronargs=4;
  if definition is null then raise exception 'finn_analyze_money_v3_not_found'; end if;
  definition:=replace(definition,'search_text text := p_filters->>''text'';',
    'search_query text := p_filters->>''text'';');
  definition:=replace(definition,
    '(search_text is null or e.search_vector @@ websearch_to_tsquery(''simple'',search_text))',
    '(search_query is null or e.search_vector @@ websearch_to_tsquery(''simple'',search_query))');
  execute definition;
end $migration$;
