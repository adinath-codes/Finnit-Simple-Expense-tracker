do $migration$
declare definition text;
begin
  select pg_get_functiondef(p.oid) into definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='finn_analyze_money_v3' and p.pronargs=4;
  if definition is null then raise exception 'finn_analyze_money_v3_not_found'; end if;
  definition:=replace(definition,
    '''matching_count'',(select matching_count from primary_counts),',
    '''matching_count'',(select matching_count from primary_counts),' || chr(10) ||
    '    ''evidence_count'',(select count(*) from source_candidates),');
  if position('''evidence_count'',(select count(*) from source_candidates)' in definition)=0
    then raise exception 'finn_analyze_money_v3_patch_failed'; end if;
  execute definition;
end $migration$;
