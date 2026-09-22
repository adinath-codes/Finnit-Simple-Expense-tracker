import {
  CURRENCIES,
  DIRECTIONS,
  type Catalog,
  type SearchPlan,
} from "./contracts.ts";
import { date, currency, object, text, ApiError } from "./validation.ts";
import { monthStart, shiftDay } from "./dates.ts";
import { contains, normalize } from "./text.ts";

export function validatePlan(value: unknown, catalog: Catalog): SearchPlan {
  const p = object(value);
  const allowed = [
    "operation",
    "direction",
    "start_date",
    "end_date",
    "merchant_id",
    "category_id",
    "person",
    "context",
    "text",
    "currency",
    "metric",
    "group_by",
    "participant_scope",
    "split_view",
    "include_sources",
    "review_policy",
  ];
  if (Object.keys(p).some((key) => !allowed.includes(key)))
    throw new ApiError(400, "unsupported_filter");
  if (
    !["sum", "list"].includes(p.operation as string) ||
    (p.direction !== null && !DIRECTIONS.includes(p.direction as never))
  )
    throw new ApiError(400, "invalid_operation");
  const start = date(p.start_date),
    end = date(p.end_date);
  if (end <= start || Date.parse(end) - Date.parse(start) > 3660 * 86400000)
    throw new ApiError(400, "invalid_range");
  if (
    p.merchant_id !== null &&
    !catalog.merchants.some((m) => m.id === p.merchant_id)
  )
    throw new ApiError(400, "invalid_merchant");
  if (
    p.category_id !== null &&
    !catalog.categories.some((c) => c.id === p.category_id)
  )
    throw new ApiError(400, "invalid_category");
  const person = p.person === null ? null : text(p.person, 100),
    context = p.context === null ? null : text(p.context, 100);
  if (
    person &&
    !catalog.people.some((n) => normalize(n.name) === normalize(person))
  )
    throw new ApiError(400, "unknown_person");
  if (
    context &&
    !catalog.contexts.some((n) => normalize(n.name) === normalize(context))
  )
    throw new ApiError(400, "unknown_context");
  const metrics = [
    "stated_amount",
    "user_share",
    "group_total",
    "paid_by_user",
    "owed_to_user",
    "user_owes",
    "reimbursed",
    "gross_spend",
  ] as const;
  const groupings = [
    "entry", "day", "week", "month", "category", "merchant", "context", "participant",
  ] as const;
  const metric = p.metric === undefined ? "user_share" : p.metric;
  if (!metrics.includes(metric as never)) throw new ApiError(400, "invalid_metric");
  const groupBy = p.group_by === undefined ? [] : p.group_by;
  if (
    !Array.isArray(groupBy) || groupBy.length > 8 ||
    groupBy.some((item) => !groupings.includes(item as never))
  ) throw new ApiError(400, "invalid_grouping");
  const participantScope = p.participant_scope ?? "any";
  if (!["any", "self_only", "with_others"].includes(participantScope as string))
    throw new ApiError(400, "invalid_participant_scope");
  const splitView = p.split_view ?? "none";
  if (!["none", "self_vs_others", "by_participant"].includes(splitView as string))
    throw new ApiError(400, "invalid_split_view");
  const reviewPolicy = p.review_policy ?? "exclude_unconfirmed";
  if (!["exclude_unconfirmed", "include_review_rows"].includes(reviewPolicy as string))
    throw new ApiError(400, "invalid_review_policy");
  if (p.include_sources !== undefined && typeof p.include_sources !== "boolean")
    throw new ApiError(400, "invalid_include_sources");
  return {
    operation: p.operation as SearchPlan["operation"],
    direction: p.direction as SearchPlan["direction"],
    start_date: start,
    end_date: end,
    merchant_id: p.merchant_id as string | null,
    category_id: p.category_id as string | null,
    person,
    context,
    text: p.text === null ? null : text(p.text, 500),
    currency: p.currency === null ? null : currency(p.currency),
    metric: metric as SearchPlan["metric"],
    group_by: groupBy as SearchPlan["group_by"],
    participant_scope: participantScope as SearchPlan["participant_scope"],
    split_view: splitView as SearchPlan["split_view"],
    include_sources: p.include_sources === true,
    review_policy: reviewPolicy as SearchPlan["review_policy"],
  };
}
export function parseSearch(
  query: string,
  reference: string,
  catalog: Catalog,
  selectedRange?: { start_date: string; end_date: string },
) {
  let remainder = query;
  let start = selectedRange?.start_date ?? monthStart(reference),
    end = selectedRange?.end_date ?? monthStart(reference, 1);
  const remove = (s: string) => {
    remainder = remainder.replaceAll(s, " ");
  };
  const time = query.match(
    /\b(last month|previous month|this month|last week|this week|yesterday|today)\b/i,
  )?.[0];
  if (time) {
    const lower = time.toLowerCase();
    remove(time);
    if (lower === "last month" || lower === "previous month") {
      start = monthStart(reference, -1);
      end = monthStart(reference);
    } else if (lower === "this month") {
      start = monthStart(reference);
      end = monthStart(reference, 1);
    } else if (lower === "today" || lower === "yesterday") {
      start = shiftDay(reference, lower === "today" ? 0 : -1);
      end = shiftDay(start, 1);
    } else {
      const weekday = new Date(`${reference}T12:00:00Z`).getUTCDay();
      start = shiftDay(
        reference,
        -((weekday + 6) % 7) - (lower === "last week" ? 7 : 0),
      );
      end = shiftDay(start, 7);
    }
  }
  const merchant = [...catalog.merchants]
    .sort(
      (a, b) =>
        Number(!!b.user_id) - Number(!!a.user_id) ||
        b.canonical_name.length - a.canonical_name.length,
    )
    .find(
      (m) =>
        contains(query, m.canonical_name) ||
        catalog.aliases.some(
          (a) => a.merchant_id === m.id && contains(query, a.alias),
        ),
    );
  if (merchant) {
    remainder = remainder.replace(
      new RegExp(
        merchant.canonical_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "ig",
      ),
      " ",
    );
    for (const alias of catalog.aliases.filter(
      (a) => a.merchant_id === merchant.id,
    ))
      if (contains(remainder, alias.alias))
        remainder = remainder.replace(
          new RegExp(alias.alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"),
          " ",
        );
  }
  const category = catalog.categories.find(
    (c) => contains(query, c.name) || contains(query, c.id),
  );
  if (category)
    remainder = remainder
      .replace(new RegExp(`\\b${category.id}\\b`, "ig"), " ")
      .replace(
        new RegExp(category.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"),
        " ",
      );
  const person = catalog.people.find((p) => contains(query, p.name));
  const context = catalog.contexts.find((c) => contains(query, c.name));
  for (const entity of [person, context])
    if (entity)
      remainder = remainder.replace(
        new RegExp(entity.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"),
        " ",
      );
  const directions = DIRECTIONS.filter((d) => contains(query, d));
  const direction = directions[0] ?? "expense";
  const currencies = Object.keys(CURRENCIES).filter((code) =>
    contains(query, code),
  );
  for (const code of currencies)
    remainder = remainder.replace(new RegExp(`\\b${code}\\b`, "gi"), " ");
  remainder = remainder
    .replace(
      /\b(how much|what is|what was|what are|did i|have i|do i|i|spent|spend|spending|cost|show|list|my|on|at|with|in|for|the|this|and|total|group|gross|share|split|pay|paid|owe|owed|owes|reimbursements?|reimbursed|of|expense|expenses|income|transfer|lent|borrowed|repayment)\b/gi,
      " ",
    )
    .replace(/[?!.]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  const plan: SearchPlan = {
    operation: /\b(show|list)\b/i.test(query) ? "list" : "sum",
    direction,
    start_date: start,
    end_date: end,
    merchant_id: merchant?.id ?? null,
    category_id: category?.id ?? null,
    person: person?.name ?? null,
    context: context?.name ?? null,
    text: remainder || null,
    currency: currencies[0] ?? null,
    metric: /\bgroup\s+total|total\s+(?:cost|bill)\b/i.test(query)
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
                : "user_share",
    group_by: /\b(?:breakdown|split)\b/i.test(query) ? ["entry"] : [],
    participant_scope: /\bwith\s+(?:friends?|family|others?|people|[A-Z][\p{L}-]+)\b/iu.test(query)
      ? "with_others"
      : "any",
    split_view: /\b(?:show\s+the\s+)?split\b/i.test(query) ? "self_vs_others" : "none",
    include_sources: /\b(?:show|list|source|breakdown)\b/i.test(query),
    review_policy: "exclude_unconfirmed",
  };
  const unsupportedOrComplex =
    /\b(compare|most|least|owes|subscriptions|semester|between|except|excluding|or|before|after|since|until|january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(
      query,
    );
  const matchedMerchants = catalog.merchants.filter(
    (m) =>
      contains(query, m.canonical_name) ||
      catalog.aliases.some(
        (a) => a.merchant_id === m.id && contains(query, a.alias),
      ),
  );
  const distinctMerchantNames = new Set(
    matchedMerchants.map((m) => normalize(m.canonical_name)),
  );
  // The plan supports one value per entity, never a silently narrowed union.
  const unsupported =
    /\b(compare|most|least|subscriptions|except|excluding|not|without|over|under|more than|less than|at least|at most|greater than)\b/i.test(
      query,
    ) ||
    directions.length > 1 ||
    currencies.length > 1 ||
    distinctMerchantNames.size > 1 ||
    catalog.people.filter((p) => contains(query, p.name)).length > 1 ||
    catalog.contexts.filter((c) => contains(query, c.name)).length > 1 ||
    catalog.categories.filter(
      (c) => contains(query, c.name) || contains(query, c.id),
    ).length > 1;
  // Simple residual keywords use indexed full-text search without an AI call.
  return {
    plan,
    unsupported,
    complex:
      unsupportedOrComplex ||
      /\b(last|previous|next|recent|latest|all time|year|days|weeks|months|earned|received|paid back)\b|[0-9₹$€£¥]/i.test(
        remainder,
      ) ||
      (!!remainder && /\b(how|what|which|why)\b/i.test(remainder)),
    periodRecognized: !!time,
    directionRecognized: directions.length > 0,
  };
}
