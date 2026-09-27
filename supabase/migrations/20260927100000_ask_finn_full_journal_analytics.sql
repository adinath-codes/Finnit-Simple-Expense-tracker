-- Deterministic, RLS-scoped analytics for Ask Finn. All monetary arithmetic is
-- performed on confirmed stored minor-unit values and currencies never mix.
create or replace function public.finn_analyze_money_v3(
  p_filters jsonb,
  p_limit integer default 20,
  p_cursor jsonb default null,
  p_revision text default null
) returns jsonb
language plpgsql stable security invoker set search_path=''
as $$
declare
  owner_id uuid := auth.uid();
  current_revision text;
  operation text := p_filters->>'operation';
  requested_metric text := coalesce(p_filters->>'metric','user_share');
  group_dimension text := coalesce(p_filters->'group_by'->>0,
    case when p_filters->>'operation'='rank' then 'entry' else 'all' end);
  sort_direction text := coalesce(p_filters->>'sort_direction','desc');
  answer_limit integer := coalesce((p_filters->>'result_limit')::integer,5);
  date_start date := (p_filters->>'start_date')::date;
  date_end date := (p_filters->>'end_date')::date;
  comparison_start date := (p_filters->>'comparison_start_date')::date;
  comparison_end date := (p_filters->>'comparison_end_date')::date;
  requested_direction text := p_filters->>'direction';
  requested_currency text := p_filters->>'currency';
  search_query text := p_filters->>'text';
  participant_scope text := coalesce(p_filters->>'participant_scope','any');
  people_match text := coalesce(p_filters->>'people_match','any');
  contexts_match text := coalesce(p_filters->>'contexts_match','any');
  included_categories text[] := coalesce(array(select jsonb_array_elements_text(
    coalesce(p_filters->'category_ids','[]'::jsonb))),array[]::text[]);
  excluded_categories text[] := coalesce(array(select jsonb_array_elements_text(
    coalesce(p_filters->'exclude_category_ids','[]'::jsonb))),array[]::text[]);
  included_merchants uuid[] := coalesce(array(select jsonb_array_elements_text(
    coalesce(p_filters->'merchant_ids','[]'::jsonb))::uuid),array[]::uuid[]);
  excluded_merchants uuid[] := coalesce(array(select jsonb_array_elements_text(
    coalesce(p_filters->'exclude_merchant_ids','[]'::jsonb))::uuid),array[]::uuid[]);
  requested_people text[] := coalesce(array(select lower(trim(jsonb_array_elements_text(
    coalesce(p_filters->'people','[]'::jsonb))))),array[]::text[]);
  requested_contexts text[] := coalesce(array(select lower(trim(jsonb_array_elements_text(
    coalesce(p_filters->'contexts','[]'::jsonb))))),array[]::text[]);
  response jsonb;
begin
  if owner_id is null then raise exception 'unauthorized'; end if;
  if operation not in ('sum','list','count','average','rank','breakdown','compare')
    then raise exception 'invalid_operation'; end if;
  if requested_metric not in ('stated_amount','user_share','group_total','paid_by_user',
      'owed_to_user','user_owes','reimbursed','gross_spend')
    then raise exception 'invalid_metric'; end if;
  if group_dimension not in ('all','entry','day','week','month','category','merchant','context','participant')
    then raise exception 'invalid_grouping'; end if;
  if sort_direction not in ('asc','desc') or answer_limit not between 1 and 20
    then raise exception 'invalid_sort'; end if;
  if requested_direction is not null and requested_direction not in
    ('expense','income','transfer','lent','borrowed','repayment')
    then raise exception 'invalid_direction'; end if;
  if participant_scope not in ('any','self_only','with_others') or
     people_match not in ('any','all') or contexts_match not in ('any','all')
    then raise exception 'invalid_scope'; end if;
  if date_start is null or date_end is null or date_end<=date_start or date_end-date_start>3660
     or p_limit not between 1 and 30 then raise exception 'invalid_range'; end if;
  if operation='compare' and (comparison_start is null or comparison_end is null or
     comparison_end<=comparison_start or comparison_end-comparison_start>3660)
    then raise exception 'invalid_comparison_range'; end if;

  select coalesce((select revision::text from public.journal_search_revisions
    where user_id=owner_id),'0') into current_revision;
  if p_cursor is not null and (p_revision is null or p_revision<>current_revision)
    then return jsonb_build_object('stale',true); end if;

  with recursive
  include_category_scope(id) as (
    select unnest(included_categories)
    union
    select c.id from public.categories c join include_category_scope s on c.parent_id=s.id
  ),
  exclude_category_scope(id) as (
    select unnest(excluded_categories)
    union
    select c.id from public.categories c join exclude_category_scope s on c.parent_id=s.id
  ),
  base as materialized (
    select t.id,t.entry_id,t.description,t.amount_minor,t.currency,t.direction,t.cash_flow,
      t.category_id,c.name category_name,t.merchant_id,
      coalesce(m.canonical_name,ra.merchant_name) merchant_name,t.occurred_on,
      t.amount_status,t.quantity,t.quantity_unit,t.unit_price_minor,t.primary_amount_role,
      t.group_total_minor,t.user_share_minor,t.paid_by_user_minor,t.split_method,
      t.participant_count,t.allocation_status,t.needs_review,t.unresolved,
      coalesce(e.raw_text,ra.merchant_name,'Receipt') raw_text,
      case when t.occurred_on>=date_start and t.occurred_on<date_end
        then 'primary' else 'comparison' end period_name,
      case requested_metric
        when 'stated_amount' then t.amount_minor
        when 'user_share' then t.user_share_minor
        when 'group_total' then t.group_total_minor
        when 'paid_by_user' then t.paid_by_user_minor
        when 'owed_to_user' then allocations.owed_to_user
        when 'user_owes' then allocations.user_owes
        when 'reimbursed' then allocations.reimbursed
        when 'gross_spend' then coalesce(t.group_total_minor,t.amount_minor)
      end metric_minor,
      case requested_metric
        when 'stated_amount' then t.amount_minor is not null and t.amount_status='confirmed'
        when 'user_share' then t.user_share_minor is not null and
          not (t.unresolved ?| array['user_share','split_rounding'])
        when 'group_total' then t.group_total_minor is not null and not (t.unresolved ? 'group_total')
        when 'paid_by_user' then t.paid_by_user_minor is not null and not (t.unresolved ? 'payer')
        when 'owed_to_user' then allocations.owed_to_user is not null and not allocations.owed_to_user_review
        when 'user_owes' then allocations.user_owes is not null and not allocations.user_owes_review
        when 'reimbursed' then allocations.reimbursed is not null and not allocations.reimbursed_review
        when 'gross_spend' then coalesce(t.group_total_minor,t.amount_minor) is not null and
          (t.group_total_minor is not null or t.amount_status='confirmed')
      end metric_confirmed
    from public.transactions t
    join public.journal_entries e on e.user_id=t.user_id and e.id=t.entry_id
    join public.categories c on c.id=t.category_id
    left join public.merchants m on m.id=t.merchant_id
    left join public.receipt_attachments ra on ra.user_id=e.user_id and ra.entry_id=e.id
    left join lateral (
      select
        sum(a.amount_minor) filter(where a.allocation_type='owed_to_user') owed_to_user,
        coalesce(bool_or(a.needs_review) filter(where a.allocation_type='owed_to_user'),false) owed_to_user_review,
        sum(a.amount_minor) filter(where a.allocation_type='owed_by_user') user_owes,
        coalesce(bool_or(a.needs_review) filter(where a.allocation_type='owed_by_user'),false) user_owes_review,
        sum(a.amount_minor) filter(where a.allocation_type in ('reimbursed_to_user','reimbursed_by_user')) reimbursed,
        coalesce(bool_or(a.needs_review) filter(where a.allocation_type in ('reimbursed_to_user','reimbursed_by_user')),false) reimbursed_review
      from public.transaction_allocations a
      where a.user_id=t.user_id and a.transaction_id=t.id
    ) allocations on true
    where t.user_id=owner_id and e.deleted_at is null
      and ((t.occurred_on>=date_start and t.occurred_on<date_end) or
        (operation='compare' and t.occurred_on>=comparison_start and t.occurred_on<comparison_end))
      and (requested_direction is null or t.direction=requested_direction)
      and (cardinality(included_categories)=0 or t.category_id in (select id from include_category_scope))
      and (cardinality(excluded_categories)=0 or t.category_id not in (select id from exclude_category_scope))
      and (cardinality(included_merchants)=0 or t.merchant_id=any(included_merchants))
      and (cardinality(excluded_merchants)=0 or t.merchant_id is null or not t.merchant_id=any(excluded_merchants))
      and (requested_currency is null or t.currency=requested_currency)
      and (participant_scope='any' or
        (participant_scope='with_others' and exists(select 1 from public.transaction_participants tp
          where tp.user_id=t.user_id and tp.transaction_id=t.id and tp.party_kind<>'self')) or
        (participant_scope='self_only' and not exists(select 1 from public.transaction_participants tp
          where tp.user_id=t.user_id and tp.transaction_id=t.id and tp.party_kind<>'self')))
      and (cardinality(requested_people)=0 or
        (people_match='any' and exists(select 1 from public.transaction_participants tp
          left join public.people p on p.user_id=tp.user_id and p.id=tp.person_id
          where tp.user_id=t.user_id and tp.transaction_id=t.id
            and lower(trim(coalesce(p.name,tp.display_name,'')))=any(requested_people))) or
        (people_match='all' and not exists(select 1 from unnest(requested_people) wanted
          where not exists(select 1 from public.transaction_participants tp
            left join public.people p on p.user_id=tp.user_id and p.id=tp.person_id
            where tp.user_id=t.user_id and tp.transaction_id=t.id
              and lower(trim(coalesce(p.name,tp.display_name,'')))=wanted))))
      and (cardinality(requested_contexts)=0 or
        (contexts_match='any' and exists(select 1 from public.transaction_contexts tc
          join public.contexts cx on cx.user_id=tc.user_id and cx.id=tc.context_id
          where tc.user_id=t.user_id and tc.transaction_id=t.id and cx.normalized_name=any(requested_contexts))) or
        (contexts_match='all' and not exists(select 1 from unnest(requested_contexts) wanted
          where not exists(select 1 from public.transaction_contexts tc
            join public.contexts cx on cx.user_id=tc.user_id and cx.id=tc.context_id
            where tc.user_id=t.user_id and tc.transaction_id=t.id and cx.normalized_name=wanted))))
      and (search_query is null or e.search_vector @@ websearch_to_tsquery('simple',search_query))
      and (requested_metric not in ('owed_to_user','user_owes','reimbursed') or
        case requested_metric when 'owed_to_user' then allocations.owed_to_user
          when 'user_owes' then allocations.user_owes
          when 'reimbursed' then allocations.reimbursed end is not null)
  ),
  expanded as materialized (
    select b.*,dimension.group_key,dimension.label,dimension.value_date,
      case when group_dimension='participant' and requested_metric in
        ('owed_to_user','user_owes','reimbursed')
        then dimension.participant_metric else b.metric_minor end effective_minor,
      case when group_dimension='participant' and requested_metric in
        ('owed_to_user','user_owes','reimbursed')
        then dimension.participant_confirmed else b.metric_confirmed end effective_confirmed
    from base b
    join lateral (
      select * from (
        select
          case group_dimension
            when 'all' then 'all'
            when 'entry' then b.id::text
            when 'day' then b.occurred_on::text
            when 'week' then date_trunc('week',b.occurred_on)::date::text
            when 'month' then date_trunc('month',b.occurred_on)::date::text
            when 'category' then b.category_id
            when 'merchant' then coalesce(b.merchant_id::text,'unassigned')
          end group_key,
          case group_dimension
            when 'all' then 'Total'
            when 'entry' then b.description
            when 'day' then b.occurred_on::text
            when 'week' then date_trunc('week',b.occurred_on)::date::text
            when 'month' then to_char(date_trunc('month',b.occurred_on),'YYYY-MM')
            when 'category' then b.category_name
            when 'merchant' then coalesce(b.merchant_name,'Unknown merchant')
          end label,
          case group_dimension
            when 'entry' then b.occurred_on
            when 'day' then b.occurred_on
            when 'week' then date_trunc('week',b.occurred_on)::date
            when 'month' then date_trunc('month',b.occurred_on)::date
          end value_date,
          null::bigint participant_metric,true participant_confirmed
        where group_dimension in ('all','entry','day','week','month','category','merchant')
        union all
        select cx.id::text,cx.name,null::date,null::bigint,true
        from public.transaction_contexts tc join public.contexts cx
          on cx.user_id=tc.user_id and cx.id=tc.context_id
        where group_dimension='context' and tc.user_id=owner_id and tc.transaction_id=b.id
        union all
        select coalesce(tp.person_id::text,lower(trim(tp.display_name)),tp.id::text),
          coalesce(p.name,tp.display_name,
            case when tp.party_kind='self' then 'You' else 'Unknown participant' end),null::date,
          (select sum(a.amount_minor) from public.transaction_allocations a
            where a.user_id=tp.user_id and a.transaction_id=tp.transaction_id and a.participant_id=tp.id
              and ((requested_metric='owed_to_user' and a.allocation_type='owed_to_user') or
                (requested_metric='user_owes' and a.allocation_type='owed_by_user') or
                (requested_metric='reimbursed' and a.allocation_type in ('reimbursed_to_user','reimbursed_by_user')) or
                (requested_metric not in ('owed_to_user','user_owes','reimbursed') and a.allocation_type='share'))),
          exists(select 1 from public.transaction_allocations a
            where a.user_id=tp.user_id and a.transaction_id=tp.transaction_id and a.participant_id=tp.id
              and ((requested_metric='owed_to_user' and a.allocation_type='owed_to_user') or
                (requested_metric='user_owes' and a.allocation_type='owed_by_user') or
                (requested_metric='reimbursed' and a.allocation_type in ('reimbursed_to_user','reimbursed_by_user')) or
                (requested_metric not in ('owed_to_user','user_owes','reimbursed') and a.allocation_type='share')))
          and not exists(select 1 from public.transaction_allocations a
            where a.user_id=tp.user_id and a.transaction_id=tp.transaction_id and a.participant_id=tp.id
              and a.needs_review and ((requested_metric='owed_to_user' and a.allocation_type='owed_to_user') or
                (requested_metric='user_owes' and a.allocation_type='owed_by_user') or
                (requested_metric='reimbursed' and a.allocation_type in ('reimbursed_to_user','reimbursed_by_user')) or
                (requested_metric not in ('owed_to_user','user_owes','reimbursed') and a.allocation_type='share')))
        from public.transaction_participants tp
        left join public.people p on p.user_id=tp.user_id and p.id=tp.person_id
        where group_dimension='participant' and tp.user_id=owner_id and tp.transaction_id=b.id
          and tp.party_kind<>'self'
      ) possible where group_key is not null
    ) dimension on true
  ),
  grouped as (
    select period_name,group_key,label,value_date,currency,
      coalesce(sum(effective_minor) filter(where effective_confirmed),0) total_minor,
      count(distinct id) filter(where effective_confirmed) confirmed_count,
      count(distinct id) filter(where not coalesce(effective_confirmed,false)) review_count,
      count(distinct id) value_count
    from expanded group by period_name,group_key,label,value_date,currency
  ),
  count_groups as (
    select group_key,label,value_date,count(distinct id) value_count,
      row_number() over(order by count(distinct id) desc,label asc,group_key asc) rank_number
    from expanded where period_name='primary'
    group by group_key,label,value_date
  ),
  ranked as (
    select grouped.*,row_number() over(partition by period_name,currency order by
      case when sort_direction='desc' then total_minor end desc nulls last,
      case when sort_direction='asc' then total_minor end asc nulls last,
      label asc,group_key asc) rank_number,
      dense_rank() over(partition by period_name,currency order by
        case when sort_direction='desc' then total_minor end desc nulls last,
        case when sort_direction='asc' then total_minor end asc nulls last) value_rank
    from grouped where confirmed_count>0
  ),
  period_totals as (
    select period_name,currency,coalesce(sum(effective_minor) filter(where effective_confirmed),0) total_minor,
      count(distinct id) filter(where effective_confirmed) confirmed_count,
      count(distinct id) filter(where not coalesce(effective_confirmed,false)) review_count
    from expanded group by period_name,currency
  ),
  comparisons as (
    select coalesce(primary_values.currency,comparison_values.currency) currency,
      coalesce(primary_values.total_minor,0) primary_minor,
      coalesce(comparison_values.total_minor,0) comparison_minor,
      coalesce(primary_values.confirmed_count,0) primary_confirmed_count,
      coalesce(comparison_values.confirmed_count,0) comparison_confirmed_count
    from (select * from period_totals where period_name='primary') primary_values
    full join (select * from period_totals where period_name='comparison') comparison_values using(currency)
  ),
  answer_rows as (
    select row_data,sort_order from (
      select jsonb_build_object('label','Total','currency',currency,
        'value_minor',total_minor::text) row_data,currency sort_order
      from period_totals where operation='sum' and period_name='primary'
      union all
      select jsonb_build_object('label','Purchases',
        'value_count',(select count(distinct id) from expanded where period_name='primary')),
        'count'
      where operation='count' and group_dimension='all'
      union all
      select jsonb_build_object('label',label,'value_count',value_count),
        lpad(rank_number::text,4,'0')
      from count_groups where operation='count' and group_dimension<>'all'
        and rank_number<=answer_limit
      union all
      select jsonb_build_object('label',case when group_dimension='entry' then 'Average purchase' else label end,
        'currency',currency,'value_minor',round(total_minor::numeric/nullif(confirmed_count,0))::bigint::text,
        'value_count',confirmed_count,'rounded',(total_minor % nullif(confirmed_count,0))<>0),
        coalesce(label,'')||currency
      from ranked where operation='average' and period_name='primary' and confirmed_count>0
        and (group_dimension<>'entry' or rank_number=1) and rank_number<=answer_limit
      union all
      select jsonb_build_object('label',label,'currency',currency,'value_minor',total_minor::text,
        'value_count',value_count,'value_date',value_date,'rounded',false),
        lpad(rank_number::text,4,'0')||currency
      from ranked where operation in ('rank','breakdown') and period_name='primary'
        and ((operation='rank' and value_rank<=answer_limit) or
          (operation='breakdown' and rank_number<=answer_limit))
      union all
      select jsonb_build_object('label','Compared period','currency',currency,
        'primary_minor',primary_minor::text,'comparison_minor',comparison_minor::text,
        'delta_minor',(primary_minor-comparison_minor)::text,
        'change_percent',case when comparison_minor<>0
          then round((primary_minor-comparison_minor)::numeric*10000/comparison_minor)/100 else null end,
        'start_date',date_start,'end_date',date_end,
        'comparison_start_date',comparison_start,'comparison_end_date',comparison_end),currency
      from comparisons where operation='compare'
        and (primary_confirmed_count>0 or comparison_confirmed_count>0)
    ) answers
  ),
  included_rank_groups as (
    select group_key,currency from ranked where operation='rank' and period_name='primary'
      and value_rank<=answer_limit
  ),
  source_candidates as materialized (
    select distinct on (e.id) e.* from expanded e
    where (operation in ('list','count') or e.effective_confirmed)
      and (operation<>'rank' or exists(select 1 from included_rank_groups g
        where g.group_key=e.group_key and g.currency=e.currency))
  ),
  source_page as (
    select s.* from source_candidates s
    where p_cursor is null or (s.occurred_on,s.entry_id,s.id)<
      ((p_cursor->>'day')::date,(p_cursor->>'entry_id')::uuid,(p_cursor->>'id')::uuid)
    order by s.occurred_on desc,s.entry_id desc,s.id desc limit p_limit+1
  ),
  page_rows as (
    select jsonb_build_object(
      'id',s.id,'entry_id',s.entry_id,'description',s.description,
      'amount_minor',s.amount_minor::text,'currency',s.currency,'direction',s.direction,
      'cash_flow',s.cash_flow,'category_id',s.category_id,'category_name',s.category_name,
      'merchant_id',s.merchant_id,'merchant_name',s.merchant_name,'occurred_on',s.occurred_on,
      'amount_status',s.amount_status,'quantity',s.quantity,'quantity_unit',s.quantity_unit,
      'unit_price_minor',s.unit_price_minor::text,'primary_amount_role',s.primary_amount_role,
      'group_total_minor',s.group_total_minor::text,'user_share_minor',s.user_share_minor::text,
      'paid_by_user_minor',s.paid_by_user_minor::text,'split_method',s.split_method,
      'participant_count',s.participant_count,'allocation_status',s.allocation_status,
      'needs_review',s.needs_review,'metric_minor',s.metric_minor::text,
      'metric_confirmed',s.metric_confirmed,'raw_text',s.raw_text,
      'participants',coalesce((select jsonb_agg(jsonb_build_object(
        'display_name',coalesce(p.name,tp.display_name),'party_kind',tp.party_kind,
        'participant_count',tp.participant_count,'role',tp.role,'share_minor',tp.share_minor::text,
        'split_method',tp.split_method,'needs_review',tp.needs_review) order by tp.source_ordinal)
        from public.transaction_participants tp left join public.people p
          on p.user_id=tp.user_id and p.id=tp.person_id
        where tp.user_id=owner_id and tp.transaction_id=s.id),'[]'::jsonb),
      'contexts',coalesce((select jsonb_agg(jsonb_build_object('name',cx.name,
        'needs_review',tc.needs_review) order by cx.name)
        from public.transaction_contexts tc join public.contexts cx
          on cx.user_id=tc.user_id and cx.id=tc.context_id
        where tc.user_id=owner_id and tc.transaction_id=s.id),'[]'::jsonb)
    ) row_data,row_number() over(order by s.occurred_on desc,s.entry_id desc,s.id desc) row_number,
      s.occurred_on,s.entry_id,s.id
    from source_page s
  ),
  primary_counts as (
    select count(distinct id) matching_count,
      count(distinct id) filter(where metric_confirmed) known_count,
      count(distinct id) filter(where not coalesce(metric_confirmed,false)) review_count
    from base where period_name='primary' or operation='compare'
  ),
  primary_totals as (
    select currency,coalesce(sum(metric_minor) filter(where metric_confirmed),0)::text total_minor,
      count(*) filter(where metric_confirmed) confirmed_count,
      count(*) filter(where not coalesce(metric_confirmed,false)) review_count
    from base where period_name='primary' group by currency
  ),
  page_meta as (
    select count(*)>p_limit has_more,
      (select occurred_on from page_rows where row_number=least(p_limit,(select count(*) from page_rows))) last_day,
      (select entry_id from page_rows where row_number=least(p_limit,(select count(*) from page_rows))) last_entry,
      (select id from page_rows where row_number=least(p_limit,(select count(*) from page_rows))) last_id
    from page_rows
  )
  select jsonb_build_object(
    'advanced_answer',jsonb_build_object(
      'kind',case operation when 'compare' then 'comparison' else operation end,
      'label',case operation
        when 'rank' then case sort_direction when 'asc' then 'Lowest' else 'Highest' end
        when 'breakdown' then 'Breakdown' when 'average' then 'Average'
        when 'count' then 'Count' when 'compare' then 'Comparison'
        when 'sum' then 'Total' else 'Matching purchases' end,
      'rows',coalesce((select jsonb_agg(row_data order by sort_order) from answer_rows),'[]'::jsonb),
      'start_date',date_start,'end_date',date_end),
    'totals',coalesce((select jsonb_agg(to_jsonb(primary_totals) order by currency) from primary_totals),'[]'::jsonb),
    'matching_count',(select matching_count from primary_counts),
    'evidence_count',(select count(*) from source_candidates),
    'known_split_count',(select known_count from primary_counts),
    'unknown_split_count',(select review_count from primary_counts),
    'transactions',coalesce((select jsonb_agg(row_data order by row_number) from page_rows where row_number<=p_limit),'[]'::jsonb),
    'revision',current_revision,'has_more',(select has_more from page_meta),'limit',p_limit,
    'metric',requested_metric,
    'next_cursor',case when (select has_more from page_meta) then jsonb_build_object(
      'day',(select last_day from page_meta),'entry_id',(select last_entry from page_meta),
      'id',(select last_id from page_meta)) else null end
  ) into response;
  return response;
end $$;

revoke all on function public.finn_analyze_money_v3(jsonb,integer,jsonb,text)
  from public,anon;
grant execute on function public.finn_analyze_money_v3(jsonb,integer,jsonb,text)
  to authenticated,service_role;
