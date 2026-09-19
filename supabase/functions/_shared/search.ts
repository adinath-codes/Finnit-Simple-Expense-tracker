import {
  CURRENCIES,
  DIRECTIONS,
  type Catalog,
  type SearchPlan,
} from "./contracts.ts";
import { date, currency, object, text, ApiError } from "./validation.ts";
import { monthStart, shiftDay } from "./dates.ts";
import { contains, normalize } from "./parser.ts";

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
      /\b(how much|what is|what was|what are|did i|have i|do i|i|spent|spend|spending|cost|show|list|my|on|at|with|in|for|the|this|and|total|of|expense|expenses|income|transfer|lent|borrowed|repayment)\b/gi,
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
    /\b(compare|most|least|owes|subscriptions|except|excluding|not|without|over|under|more than|less than|at least|at most|greater than)\b/i.test(
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
