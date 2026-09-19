import {
  CURRENCIES,
  DIRECTIONS,
  type CaptureInput,
  type Extraction,
  type Transaction,
} from "./contracts.ts";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message = code,
  ) {
    super(message);
  }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError(400, "invalid_object");
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 4000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new ApiError(400, "invalid_text");
  return value;
}
export function uuid(value: unknown): string {
  const id = text(value, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    throw new ApiError(400, "invalid_id");
  return id;
}
export function date(value: unknown): string {
  const s = text(value, 10);
  if (
    !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s
  )
    throw new ApiError(400, "invalid_date");
  return s;
}
export function currency(value: unknown): string {
  if (typeof value !== "string" || !Object.hasOwn(CURRENCIES, value))
    throw new ApiError(400, "unsupported_currency");
  return value;
}
export function minor(value: unknown): string | null {
  if (value === null) return null;
  if (
    typeof value !== "string" ||
    !/^\d{1,16}$/.test(value) ||
    BigInt(value) > 9007199254740991n
  )
    throw new ApiError(400, "invalid_amount");
  return BigInt(value).toString();
}
export function names(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 20)
    throw new ApiError(400, "invalid_names");
  return [...new Set(value.map((v) => text(v, 100).trim()))];
}
export function capture(value: unknown): CaptureInput {
  const v = object(value);
  const captured = text(v.captured_at, 40);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      captured,
    ) ||
    !Number.isFinite(Date.parse(captured))
  )
    throw new ApiError(400, "invalid_timestamp");
  date(captured.slice(0, 10));
  const timezone = text(v.timezone, 80);
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
  } catch {
    throw new ApiError(400, "invalid_timezone");
  }
  return {
    id: uuid(v.id),
    raw_text: text(v.raw_text),
    currency: currency(v.currency),
    timezone,
    captured_at: new Date(captured).toISOString(),
    ...(v.selected_date ? { selected_date: date(v.selected_date) } : {}),
  };
}
export function extraction(
  value: unknown,
  categoryIds: string[],
  merchantIds: string[],
): Extraction {
  const v = object(value);
  if (
    !Array.isArray(v.transactions) ||
    !v.transactions.length ||
    v.transactions.length > 30
  )
    throw new ApiError(400, "invalid_transactions");
  const transactions = v.transactions.map((raw): Transaction => {
    const t = object(raw);
    if (
      !DIRECTIONS.includes(t.direction as never) ||
      !["in", "out", "internal", "unknown"].includes(t.cash_flow as string)
    )
      throw new ApiError(400, "invalid_direction");
    if (
      !categoryIds.includes(t.category_id as string) ||
      (t.merchant_id !== null && !merchantIds.includes(t.merchant_id as string))
    )
      throw new ApiError(400, "invalid_reference");
    if (
      !["confirmed", "missing", "estimated"].includes(t.amount_status as string)
    )
      throw new ApiError(400, "invalid_amount_status");
    if (
      ![
        "merchant_rule",
        "keyword_rule",
        "user_correction",
        "llm_fallback",
        "unresolved",
      ].includes(t.category_source as string)
    )
      throw new ApiError(400, "invalid_category_source");
    const amount = minor(t.amount_minor);
    if ((t.amount_status === "missing") !== (amount === null))
      throw new ApiError(400, "amount_status_mismatch");
    if (
      t.quantity !== null &&
      (!Number.isInteger(t.quantity) ||
        Number(t.quantity) < 1 ||
        Number(t.quantity) > 100000)
    )
      throw new ApiError(400, "invalid_quantity");
    const unit = minor(t.unit_price_minor);
    if (
      unit !== null &&
      (t.quantity === null ||
        amount === null ||
        BigInt(unit) * BigInt(Number(t.quantity)) !== BigInt(amount))
    )
      throw new ApiError(400, "unit_total_mismatch");
    if (
      typeof t.confidence !== "number" ||
      !Number.isFinite(t.confidence) ||
      t.confidence < 0 ||
      t.confidence > 1
    )
      throw new ApiError(400, "invalid_confidence");
    if (typeof t.needs_review !== "boolean")
      throw new ApiError(400, "invalid_review");
    return {
      description: text(t.description, 4000),
      amount_minor: amount,
      currency: currency(t.currency),
      direction: t.direction as Transaction["direction"],
      cash_flow: t.cash_flow as Transaction["cash_flow"],
      amount_status: t.amount_status as Transaction["amount_status"],
      category_id: t.category_id as string,
      category_source: t.category_source as Transaction["category_source"],
      merchant_id: t.merchant_id as string | null,
      occurred_on: date(t.occurred_on),
      quantity: t.quantity as number | null,
      unit_price_minor: unit,
      confidence: t.confidence,
      needs_review: t.needs_review,
      unresolved: names(t.unresolved),
      person: t.person === null ? null : text(t.person, 100),
      evidence: t.evidence === null ? null : text(t.evidence, 100),
    };
  });
  const people = names(v.people);
  for (const transaction of transactions) {
    if (transaction.person && !people.includes(transaction.person))
      throw new ApiError(400, "person_not_linked");
    const expectedFlow = {
      expense: "out",
      income: "in",
      transfer: "internal",
      lent: "out",
      borrowed: "in",
    };
    if (
      transaction.direction !== "repayment" &&
      transaction.cash_flow !== expectedFlow[transaction.direction]
    )
      throw new ApiError(400, "direction_flow_mismatch");
    if (
      ["lent", "borrowed", "repayment"].includes(transaction.direction) &&
      (!transaction.person || transaction.cash_flow === "unknown")
    ) {
      transaction.needs_review = true;
    }
  }
  return {
    transactions,
    people,
    contexts: names(v.contexts),
    unresolved: names(v.unresolved),
  };
}
