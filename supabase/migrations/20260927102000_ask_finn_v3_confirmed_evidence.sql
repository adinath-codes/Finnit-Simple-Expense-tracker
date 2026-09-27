-- Apply the confirmed-evidence fixes to the already deployed function. The
-- preceding source migration contains the complete corrected definition for
-- fresh environments.
do $migration$
declare definition text;
begin
  select pg_get_functiondef(p.oid) into definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='finn_analyze_money_v3' and p.pronargs=4;
  if definition is null then raise exception 'finn_analyze_money_v3_not_found'; end if;

  definition:=replace(definition,
    'then dimension.participant_confirmed else b.metric_confirmed end effective_confirmed',
    'then dimension.participant_metric is not null and dimension.participant_confirmed else b.metric_confirmed end effective_confirmed');
  definition:=replace(definition,
    'and (search_query is null or e.search_vector @@ websearch_to_tsquery(''simple'',search_query))' || chr(10) || '  ),',
    'and (search_query is null or e.search_vector @@ websearch_to_tsquery(''simple'',search_query))' || chr(10) ||
    '      and (requested_metric not in (''owed_to_user'',''user_owes'',''reimbursed'') or' || chr(10) ||
    '        case requested_metric when ''owed_to_user'' then allocations.owed_to_user' || chr(10) ||
    '          when ''user_owes'' then allocations.user_owes' || chr(10) ||
    '          when ''reimbursed'' then allocations.reimbursed end is not null)' || chr(10) || '  ),');
  definition:=replace(definition,
    'from grouped' || chr(10) || '  ),' || chr(10) || '  period_totals as (',
    'from grouped where confirmed_count>0' || chr(10) || '  ),' || chr(10) || '  period_totals as (');
  definition:=replace(definition,
    'coalesce(comparison_values.total_minor,0) comparison_minor',
    'coalesce(comparison_values.total_minor,0) comparison_minor,' || chr(10) ||
    '      coalesce(primary_values.confirmed_count,0) primary_confirmed_count,' || chr(10) ||
    '      coalesce(comparison_values.confirmed_count,0) comparison_confirmed_count');
  definition:=replace(definition,
    'from comparisons where operation=''compare''',
    'from comparisons where operation=''compare''' || chr(10) ||
    '        and (primary_confirmed_count>0 or comparison_confirmed_count>0)');
  if position('dimension.participant_metric is not null and dimension.participant_confirmed' in definition)=0
    or position('from grouped where confirmed_count>0' in definition)=0
    or position('primary_confirmed_count>0 or comparison_confirmed_count>0' in definition)=0
    or position('requested_metric not in (''owed_to_user'',''user_owes'',''reimbursed'')' in definition)=0
    then raise exception 'finn_analyze_money_v3_patch_failed'; end if;
  execute definition;
end $migration$;
