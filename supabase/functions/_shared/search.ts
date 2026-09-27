import { type Catalog, CURRENCIES, DIRECTIONS, type SearchPlan } from "./contracts.ts";
import { ApiError, currency, date, object, text } from "./validation.ts";
import { monthStart, shiftDay } from "./dates.ts";
import { contains, normalize } from "./text.ts";

const OPERATIONS = ["sum", "list", "count", "average", "rank", "breakdown", "compare"] as const;
const METRICS = [
  "stated_amount",
  "user_share",
  "group_total",
  "paid_by_user",
  "owed_to_user",
  "user_owes",
  "reimbursed",
  "gross_spend",
] as const;
const GROUPINGS = [
  "entry",
  "day",
  "week",
  "month",
  "category",
  "merchant",
  "context",
  "participant",
] as const;

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function stringArray(value: unknown, limit: number, code: string) {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) || value.length > limit || value.some((item) => typeof item !== "string")
  ) {
    throw new ApiError(400, code);
  }
  return unique(value as string[]);
}

export function validatePlan(value: unknown, catalog: Catalog): SearchPlan {
  const p = object(value);
  const allowed = [
    "operation",
    "direction",
    "start_date",
    "end_date",
    "merchant_id",
    "category_id",
    "merchant_ids",
    "exclude_merchant_ids",
    "category_ids",
    "exclude_category_ids",
    "person",
    "context",
    "people",
    "contexts",
    "people_match",
    "contexts_match",
    "text",
    "currency",
    "metric",
    "group_by",
    "sort_direction",
    "result_limit",
    "comparison_start_date",
    "comparison_end_date",
    "participant_scope",
    "split_view",
    "include_sources",
    "review_policy",
  ];
  if (Object.keys(p).some((key) => !allowed.includes(key))) {
    throw new ApiError(400, "unsupported_filter");
  }
  if (
    !OPERATIONS.includes(p.operation as never) ||
    (p.direction !== null && !DIRECTIONS.includes(p.direction as never))
  ) {
    throw new ApiError(400, "invalid_operation");
  }

  const start = date(p.start_date), end = date(p.end_date);
  if (end <= start || Date.parse(end) - Date.parse(start) > 3660 * 86400000) {
    throw new ApiError(400, "invalid_range");
  }

  const merchantIds = unique([
    ...(p.merchant_id === null || p.merchant_id === undefined ? [] : [String(p.merchant_id)]),
    ...stringArray(p.merchant_ids, 20, "invalid_merchant"),
  ]);
  const excludedMerchantIds = stringArray(p.exclude_merchant_ids, 20, "invalid_merchant");
  if (
    [...merchantIds, ...excludedMerchantIds].some((id) =>
      !catalog.merchants.some((m) => m.id === id)
    )
  ) {
    throw new ApiError(400, "invalid_merchant");
  }

  const categoryIds = unique([
    ...(p.category_id === null || p.category_id === undefined ? [] : [String(p.category_id)]),
    ...stringArray(p.category_ids, 20, "invalid_category"),
  ]);
  const excludedCategoryIds = stringArray(p.exclude_category_ids, 20, "invalid_category");
  if (
    [...categoryIds, ...excludedCategoryIds].some((id) =>
      !catalog.categories.some((c) => c.id === id)
    )
  ) {
    throw new ApiError(400, "invalid_category");
  }

  const people = unique([
    ...(p.person === null || p.person === undefined ? [] : [text(p.person, 100)]),
    ...stringArray(p.people, 20, "unknown_person").map((item) => text(item, 100)),
  ]);
  const contexts = unique([
    ...(p.context === null || p.context === undefined ? [] : [text(p.context, 100)]),
    ...stringArray(p.contexts, 20, "unknown_context").map((item) => text(item, 100)),
  ]);
  if (
    people.some((name) =>
      !catalog.people.some((candidate) => normalize(candidate.name) === normalize(name))
    )
  ) {
    throw new ApiError(400, "unknown_person");
  }
  if (
    contexts.some((name) =>
      !catalog.contexts.some((candidate) => normalize(candidate.name) === normalize(name))
    )
  ) {
    throw new ApiError(400, "unknown_context");
  }

  const groupBy = p.group_by === undefined ? [] : p.group_by;
  if (
    !Array.isArray(groupBy) || groupBy.length > 1 ||
    groupBy.some((item) => !GROUPINGS.includes(item as never))
  ) {
    throw new ApiError(400, "invalid_grouping");
  }
  const operation = p.operation as SearchPlan["operation"];
  const sortDirection = p.sort_direction ?? "desc";
  if (!["asc", "desc"].includes(sortDirection as string)) {
    throw new ApiError(400, "invalid_sort_direction");
  }
  const resultLimit = p.result_limit ?? (operation === "rank" ? 1 : 5);
  if (!Number.isInteger(resultLimit) || Number(resultLimit) < 1 || Number(resultLimit) > 20) {
    throw new ApiError(400, "invalid_result_limit");
  }

  let comparisonStart: string | null = null, comparisonEnd: string | null = null;
  if (operation === "compare" || p.comparison_start_date != null || p.comparison_end_date != null) {
    if (p.comparison_start_date == null || p.comparison_end_date == null) {
      throw new ApiError(400, "invalid_comparison_range");
    }
    comparisonStart = date(p.comparison_start_date);
    comparisonEnd = date(p.comparison_end_date);
    if (
      comparisonEnd <= comparisonStart ||
      Date.parse(comparisonEnd) - Date.parse(comparisonStart) > 3660 * 86400000
    ) {
      throw new ApiError(400, "invalid_comparison_range");
    }
  }
  const peopleMatch = p.people_match ?? "any";
  const contextsMatch = p.contexts_match ?? "any";
  if (
    !["any", "all"].includes(peopleMatch as string) ||
    !["any", "all"].includes(contextsMatch as string)
  ) {
    throw new ApiError(400, "invalid_entity_match");
  }
  const metric = p.metric === undefined ? "user_share" : p.metric;
  if (!METRICS.includes(metric as never)) throw new ApiError(400, "invalid_metric");
  const participantScope = p.participant_scope ?? "any";
  if (!["any", "self_only", "with_others"].includes(participantScope as string)) {
    throw new ApiError(400, "invalid_participant_scope");
  }
  const splitView = p.split_view ?? "none";
  if (!["none", "self_vs_others", "by_participant"].includes(splitView as string)) {
    throw new ApiError(400, "invalid_split_view");
  }
  const reviewPolicy = p.review_policy ?? "exclude_unconfirmed";
  if (!["exclude_unconfirmed", "include_review_rows"].includes(reviewPolicy as string)) {
    throw new ApiError(400, "invalid_review_policy");
  }
  if (p.include_sources !== undefined && typeof p.include_sources !== "boolean") {
    throw new ApiError(400, "invalid_include_sources");
  }

  return {
    operation,
    direction: p.direction as SearchPlan["direction"],
    start_date: start,
    end_date: end,
    merchant_id: merchantIds[0] ?? null,
    category_id: categoryIds[0] ?? null,
    merchant_ids: merchantIds,
    exclude_merchant_ids: excludedMerchantIds,
    category_ids: categoryIds,
    exclude_category_ids: excludedCategoryIds,
    person: people[0] ?? null,
    context: contexts[0] ?? null,
    people,
    contexts,
    people_match: peopleMatch as SearchPlan["people_match"],
    contexts_match: contextsMatch as SearchPlan["contexts_match"],
    text: p.text === null || p.text === undefined ? null : text(p.text, 500),
    currency: p.currency === null || p.currency === undefined ? null : currency(p.currency),
    metric: metric as SearchPlan["metric"],
    group_by: (operation === "rank" && groupBy.length === 0 ? ["entry"] : groupBy) as SearchPlan[
      "group_by"
    ],
    sort_direction: sortDirection as SearchPlan["sort_direction"],
    result_limit: Number(resultLimit),
    comparison_start_date: comparisonStart,
    comparison_end_date: comparisonEnd,
    participant_scope: participantScope as SearchPlan["participant_scope"],
    split_view: splitView as SearchPlan["split_view"],
    include_sources: p.include_sources === true,
    review_policy: reviewPolicy as SearchPlan["review_policy"],
  };
}

function priorEqualRange(start: string, end: string) {
  const days = Math.round(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000,
  );
  return { start: shiftDay(start, -days), end: start };
}

function explicitlyExcluded(query: string, names: string[]) {
  return names.some((name) =>
    new RegExp(
      `\\b(?:except|excluding|without|but\\s+not)\\b[^,.?]{0,32}\\b${
        name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      }\\b`,
      "i",
    ).test(query)
  );
}

export function parseSearch(
  query: string,
  reference: string,
  catalog: Catalog,
  selectedRange?: { start_date: string; end_date: string },
) {
  let remainder = query;
  let start = selectedRange?.start_date ?? monthStart(reference);
  let end = selectedRange?.end_date ?? monthStart(reference, 1);
  const comparing = /\b(compare|versus|vs\.?|compared\s+(?:with|to)|change(?:d)?\s+from)\b/i.test(
    query,
  );
  let comparison: { start: string; end: string } | null = null;
  const remove = (value: string) => {
    remainder = remainder.replaceAll(value, " ");
  };
  const time = query.match(
    /\b(last month|previous month|this month|last week|this week|yesterday|today)\b/i,
  )?.[0];
  if (time) {
    const lower = time.toLowerCase();
    remove(time);
    let recognizedStart: string, recognizedEnd: string;
    if (lower === "last month" || lower === "previous month") {
      recognizedStart = monthStart(reference, -1);
      recognizedEnd = monthStart(reference);
    } else if (lower === "this month") {
      recognizedStart = monthStart(reference);
      recognizedEnd = monthStart(reference, 1);
    } else if (lower === "today" || lower === "yesterday") {
      recognizedStart = shiftDay(reference, lower === "today" ? 0 : -1);
      recognizedEnd = shiftDay(recognizedStart, 1);
    } else {
      const weekday = new Date(`${reference}T12:00:00Z`).getUTCDay();
      recognizedStart = shiftDay(reference, -((weekday + 6) % 7) - (lower === "last week" ? 7 : 0));
      recognizedEnd = shiftDay(recognizedStart, 7);
    }
    if (comparing && /last|previous/.test(lower)) {
      comparison = { start: recognizedStart, end: recognizedEnd };
    } else {
      start = recognizedStart;
      end = recognizedEnd;
    }
  }
  if (comparing && !comparison) comparison = priorEqualRange(start, end);

  const matchedMerchants = [...catalog.merchants]
    .filter((m) =>
      contains(query, m.canonical_name) ||
      catalog.aliases.some((a) => a.merchant_id === m.id && contains(query, a.alias))
    )
    .sort((a, b) =>
      Number(!!b.user_id) - Number(!!a.user_id) || b.canonical_name.length - a.canonical_name.length
    );
  const categoryMatchStrength = (candidate: Catalog["categories"][number]) =>
    contains(query, candidate.name) ? 2 : contains(query, candidate.id) ? 1 : 0;
  const matchedCategories = catalog.categories
    .filter((candidate) => categoryMatchStrength(candidate) > 0)
    .filter((candidate, _index, matches) =>
      !matches.some((specific) =>
        specific.id !== candidate.id && categoryMatchStrength(specific) === 2 &&
        (contains(specific.name, candidate.name) || contains(specific.name, candidate.id))
      )
    )
    .sort((a, b) =>
      categoryMatchStrength(b) - categoryMatchStrength(a) ||
      Math.max(b.name.length, b.id.length) - Math.max(a.name.length, a.id.length)
    );
  const matchedPeople = catalog.people.filter((p) => contains(query, p.name));
  const matchedContexts = catalog.contexts.filter((c) => contains(query, c.name));
  const excludedMerchants = matchedMerchants.filter((merchant) =>
    explicitlyExcluded(
      query,
      [
        merchant.canonical_name,
        ...catalog.aliases.filter((alias) => alias.merchant_id === merchant.id).map((alias) =>
          alias.alias
        ),
      ],
    )
  );
  const includedMerchants = matchedMerchants.filter((merchant) =>
    !excludedMerchants.includes(merchant)
  );
  const excludedCategories = matchedCategories.filter((category) =>
    explicitlyExcluded(query, [category.id, category.name])
  );
  const includedCategories = matchedCategories.filter((category) =>
    !excludedCategories.includes(category)
  );
  for (const merchant of matchedMerchants) {
    for (
      const name of [
        merchant.canonical_name,
        ...catalog.aliases.filter((a) => a.merchant_id === merchant.id).map((a) => a.alias),
      ]
    ) {
      remainder = remainder.replace(
        new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"),
        " ",
      );
    }
  }
  for (const category of matchedCategories) {
    for (const name of [category.name, category.id]) {
      remainder = remainder.replace(
        new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "ig"),
        " ",
      );
    }
  }
  for (const entity of [...matchedPeople, ...matchedContexts]) {
    remainder = remainder.replace(
      new RegExp(entity.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"),
      " ",
    );
  }

  const directions = DIRECTIONS.filter((direction) => contains(query, direction));
  const currencies = Object.keys(CURRENCIES).filter((code) => contains(query, code));
  for (const code of currencies) {
    remainder = remainder.replace(new RegExp(`\\b${code}\\b`, "gi"), " ");
  }

  const metric: NonNullable<SearchPlan["metric"]> =
    /\bgroup\s+total|total\s+(?:cost|bill)\b/i.test(query)
      ? "group_total"
      : /\b(?:did\s+i|i)\s+pay|paid\s+by\s+me\b/i.test(query)
      ? "paid_by_user"
      : /\b(?:owed?\s+to\s+me|owes?\s+me)\b/i.test(query)
      ? "owed_to_user"
      : /\b(?:do\s+i\s+owe|i\s+owe)\b/i.test(query)
      ? "user_owes"
      : /\breimburs/i.test(query)
      ? "reimbursed"
      : /\bgross\s+spend\b/i.test(query)
      ? "gross_spend"
      : "user_share";
  const debtMetric = ["owed_to_user", "user_owes", "reimbursed"].includes(metric);
  const operation: SearchPlan["operation"] = comparing
    ? "compare"
    : debtMetric && /\bwho\b/i.test(query)
    ? "breakdown"
    : /\b(how many|number of|count)\b/i.test(query)
    ? "count"
    : /\b(average|avg|mean)\b/i.test(query)
    ? "average"
    : /\b(most|least|highest|lowest|largest|smallest|biggest|cheapest|expensive|top)\b/i.test(query)
    ? "rank"
    : /\b(breakdown|by category|by merchant|by person|by participant|by context|where did i spend|where.*money)\b/i
        .test(query)
    ? "breakdown"
    : /\b(show|list|which purchases?|what purchases?)\b/i.test(query)
    ? "list"
    : "sum";
  let groupBy: NonNullable<SearchPlan["group_by"]> = [];
  if (/\bweek\b/i.test(query) && ["rank", "breakdown"].includes(operation)) groupBy = ["week"];
  else if (/\bday\b/i.test(query) && ["rank", "breakdown"].includes(operation)) groupBy = ["day"];
  else if (
    /\bmonth\b/i.test(query) && /\bmost|least|highest|lowest|breakdown|by\b/i.test(query) && !time
  ) groupBy = ["month"];
  else if (/\bcategory|where did i spend|where.*money\b/i.test(query)) groupBy = ["category"];
  else if (/\bmerchant|store|shop|restaurant\b/i.test(query)) groupBy = ["merchant"];
  else if (/\bcontext|trip|project|event\b/i.test(query) && operation !== "sum") {
    groupBy = ["context"];
  } else if (/\bwho|person|people|participant\b/i.test(query) || debtMetric) {
    groupBy = ["participant"];
  } else if (operation === "rank") groupBy = ["entry"];
  if (operation === "breakdown" && groupBy.length === 0) groupBy = ["category"];

  remainder = remainder
    .replace(
      /\b(compare|versus|vs|compared|with|to|change|changed|from|except|excluding|without|but not|single|how much|how many|number of|count|average|avg|mean|most|least|highest|lowest|largest|smallest|biggest|cheapest|expensive|top|what is|what was|what are|which|did i|have i|do i|i|me|spent|spend|spending|purchases?|transactions?|cost|show|list|my|on|at|in|for|the|this|and|total|group|gross|share|split|pay|paid|owe|owed|owes|reimbursements?|reimbursed|of|expense|expenses|income|transfer|lent|borrowed|repayment|category|merchant|store|shop|restaurant|week|day|month|where|money|breakdown|by|person|people|participant|who|context)\b/gi,
      " ",
    )
    .replace(/[?!.]/g, " ").trim().replace(/\s+/g, " ");

  const plan: SearchPlan = {
    operation,
    direction: debtMetric ? null : directions[0] ?? "expense",
    start_date: start,
    end_date: end,
    merchant_id: includedMerchants[0]?.id ?? null,
    category_id: includedCategories[0]?.id ?? null,
    merchant_ids: includedMerchants.map((item) => item.id),
    exclude_merchant_ids: excludedMerchants.map((item) => item.id),
    category_ids: includedCategories.map((item) => item.id),
    exclude_category_ids: excludedCategories.map((item) => item.id),
    person: matchedPeople[0]?.name ?? null,
    context: matchedContexts[0]?.name ?? null,
    people: matchedPeople.map((item) => item.name),
    contexts: matchedContexts.map((item) => item.name),
    people_match: /\b(all of|both)\b/i.test(query) ? "all" : "any",
    contexts_match: /\b(all of|both)\b/i.test(query) ? "all" : "any",
    text: remainder || null,
    currency: currencies[0] ?? null,
    metric,
    group_by: groupBy,
    sort_direction: /\b(least|lowest|smallest|cheapest)\b/i.test(query) ? "asc" : "desc",
    result_limit: operation === "rank" ? 1 : 5,
    comparison_start_date: comparison?.start ?? null,
    comparison_end_date: comparison?.end ?? null,
    participant_scope: /\bwith\s+(?:friends?|family|others?|people)\b/iu.test(query)
      ? "with_others"
      : "any",
    split_view: /\b(?:show\s+the\s+)?split\b/i.test(query) ? "self_vs_others" : "none",
    include_sources: true,
    review_policy: "exclude_unconfirmed",
  };

  const unsupportedReason =
    /\b(currently active|active subscriptions?|which subscriptions? (?:are|is) active|cancel(?:led)? subscriptions?)\b/i
        .test(query)
      ? "recurrence_status"
      : /\b(predict|forecast|will i|next month|next year|future)\b/i.test(query)
      ? "prediction"
      : /\b(why|reason|cause|because)\b/i.test(query)
      ? "causal_inference"
      : /\b(exchange rate|convert|converted|inflation|stock|weather|market price)\b/i.test(query)
      ? "external_data"
      : /\bmissing amount|unknown amount|guess|estimate the missing\b/i.test(query)
      ? "missing_values"
      : null;
  const unsupported = currencies.length > 1 || directions.length > 1;
  return {
    plan,
    unsupported,
    unsupportedReason,
    complex: !unsupportedReason && !unsupported && !!remainder,
    periodRecognized: !!time,
    directionRecognized: directions.length > 0,
  };
}
