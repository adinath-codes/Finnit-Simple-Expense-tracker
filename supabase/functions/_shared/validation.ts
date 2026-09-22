import {
  AMOUNT_ROLES,
  CURRENCIES,
  DIRECTIONS,
  SPLIT_METHODS,
  type AmountComponent,
  type CaptureInput,
  type EvidenceClaim,
  type Extraction,
  type Transaction,
  type TransactionAllocation,
  type TransactionContext,
  type TransactionParticipant,
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
function signedMinor(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^-?\d{1,16}$/.test(value) ||
    BigInt(value) < -9007199254740991n ||
    BigInt(value) > 9007199254740991n
  ) throw new ApiError(400, "invalid_amount");
  return BigInt(value).toString();
}
function probability(value: unknown) {
  if (
    typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1
  ) throw new ApiError(400, "invalid_confidence");
  return value;
}
function evidenceClaim(value: unknown): EvidenceClaim {
  const claim = object(value);
  const start = Number(claim.start), end = Number(claim.end);
  const valueText = text(claim.text, 500);
  if (
    !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start ||
    end - start !== valueText.length
  ) throw new ApiError(400, "invalid_evidence");
  return { text: valueText, start, end };
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
    ...(v.approximate_place === undefined
      ? {}
      : { approximate_place: text(v.approximate_place, 160).trim() }),
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
    const primaryAmountRole = t.primary_amount_role === undefined
      ? "personal_total"
      : t.primary_amount_role as Transaction["primary_amount_role"];
    if (!AMOUNT_ROLES.includes(primaryAmountRole as never))
      throw new ApiError(400, "invalid_amount_role");
    const groupTotal = t.group_total_minor === undefined
      ? amount
      : minor(t.group_total_minor);
    const userShare = t.user_share_minor === undefined
      ? amount
      : minor(t.user_share_minor);
    const paidByUser = t.paid_by_user_minor === undefined
      ? (t.cash_flow === "out" ? amount : null)
      : minor(t.paid_by_user_minor);
    const splitMethod = t.split_method === undefined
      ? "not_applicable"
      : t.split_method as Transaction["split_method"];
    if (!SPLIT_METHODS.includes(splitMethod as never))
      throw new ApiError(400, "invalid_split_method");
    const participantCount = t.participant_count === undefined || t.participant_count === null
      ? null
      : Number(t.participant_count);
    if (
      participantCount !== null &&
      (!Number.isInteger(participantCount) || participantCount < 1 || participantCount > 100000)
    ) throw new ApiError(400, "invalid_participant_count");
    const fieldConfidence = t.field_confidence === undefined
      ? { transaction: t.confidence }
      : object(t.field_confidence);
    for (const value of Object.values(fieldConfidence)) probability(value);
    const fieldEvidence = t.field_evidence === undefined ? {} : object(t.field_evidence);
    for (const value of Object.values(fieldEvidence)) evidenceClaim(value);
    const allocationStatus = t.allocation_status === undefined
      ? (userShare !== null ? "complete" : "unknown")
      : t.allocation_status;
    if (!["complete", "partial", "unknown", "not_applicable"].includes(allocationStatus as string))
      throw new ApiError(400, "invalid_allocation_status");
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
      ...(t.receipt_line_kind === undefined
        ? {}
        : { receipt_line_kind: t.receipt_line_kind as Transaction["receipt_line_kind"] }),
      primary_amount_role: primaryAmountRole,
      group_total_minor: groupTotal,
      user_share_minor: userShare,
      paid_by_user_minor: paidByUser,
      split_method: splitMethod,
      participant_count: participantCount,
      quantity_unit: t.quantity_unit === undefined || t.quantity_unit === null
        ? null
        : text(t.quantity_unit, 40).trim(),
      merchant_text: t.merchant_text === undefined || t.merchant_text === null
        ? null
        : text(t.merchant_text, 160).trim(),
      field_confidence: fieldConfidence as Record<string, number>,
      field_evidence: fieldEvidence as Record<string, EvidenceClaim>,
      allocation_status: allocationStatus as Transaction["allocation_status"],
      breakdown_approximate: t.breakdown_approximate === true,
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
  const transactionOrdinal = (value: unknown) => {
    const ordinal = Number(value);
    if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal >= transactions.length)
      throw new ApiError(400, "invalid_transaction_ordinal");
    return ordinal;
  };
  const participants: TransactionParticipant[] = v.participants === undefined
    ? []
    : (() => {
      if (!Array.isArray(v.participants) || v.participants.length > 100)
        throw new ApiError(400, "invalid_participants");
      return v.participants.map((raw) => {
        const p = object(raw);
        if (
          !["self", "known_person", "anonymous_group", "unknown"].includes(p.party_kind as string) ||
          !["participant", "payer", "beneficiary", "debtor", "creditor"].includes(p.role as string)
        ) throw new ApiError(400, "invalid_participant");
        const count = Number(p.participant_count);
        if (!Number.isInteger(count) || count < 1 || count > 100000)
          throw new ApiError(400, "invalid_participant_count");
        const method = p.split_method as TransactionParticipant["split_method"];
        if (!SPLIT_METHODS.includes(method as never))
          throw new ApiError(400, "invalid_split_method");
        return {
          transaction_ordinal: transactionOrdinal(p.transaction_ordinal),
          party_kind: p.party_kind as TransactionParticipant["party_kind"],
          display_name: p.display_name === null ? null : text(p.display_name, 100).trim(),
          participant_count: count,
          role: p.role as TransactionParticipant["role"],
          share_minor: minor(p.share_minor),
          share_percentage: p.share_percentage === null ? null : probability(p.share_percentage),
          split_method: method,
          confidence: probability(p.confidence),
          evidence: p.evidence === null ? null : evidenceClaim(p.evidence),
          needs_review: p.needs_review === true,
        };
      });
    })();
  const transactionContexts: TransactionContext[] = v.transaction_contexts === undefined
    ? []
    : (() => {
      if (!Array.isArray(v.transaction_contexts) || v.transaction_contexts.length > 100)
        throw new ApiError(400, "invalid_transaction_contexts");
      return v.transaction_contexts.map((raw) => {
        const c = object(raw);
        return {
          transaction_ordinal: transactionOrdinal(c.transaction_ordinal),
          name: text(c.name, 100).trim(),
          confidence: probability(c.confidence),
          evidence: evidenceClaim(c.evidence),
          needs_review: c.needs_review === true,
        };
      });
    })();
  const allocations: TransactionAllocation[] = v.allocations === undefined
    ? []
    : (() => {
      if (!Array.isArray(v.allocations) || v.allocations.length > 200)
        throw new ApiError(400, "invalid_allocations");
      return v.allocations.map((raw) => {
        const a = object(raw);
        if (![
          "share", "paid", "owed_to_user", "owed_by_user",
          "reimbursed_to_user", "reimbursed_by_user",
        ].includes(a.allocation_type as string)) throw new ApiError(400, "invalid_allocation");
        const participantOrdinal = a.participant_ordinal === null
          ? null
          : Number(a.participant_ordinal);
        if (
          participantOrdinal !== null &&
          (!Number.isInteger(participantOrdinal) || participantOrdinal < 0 || participantOrdinal >= participants.length)
        ) throw new ApiError(400, "invalid_participant_ordinal");
        const allocationTransaction = transactionOrdinal(a.transaction_ordinal);
        if (
          participantOrdinal !== null &&
          participants[participantOrdinal].transaction_ordinal !== allocationTransaction
        ) throw new ApiError(400, "participant_transaction_mismatch");
        return {
          transaction_ordinal: allocationTransaction,
          participant_ordinal: participantOrdinal,
          allocation_type: a.allocation_type as TransactionAllocation["allocation_type"],
          amount_minor: minor(a.amount_minor)!,
          confidence: probability(a.confidence),
          evidence: a.evidence === null ? null : evidenceClaim(a.evidence),
          needs_review: a.needs_review === true,
        };
      });
    })();
  const amountComponents: AmountComponent[] = v.amount_components === undefined
    ? []
    : (() => {
      if (!Array.isArray(v.amount_components) || v.amount_components.length > 200)
        throw new ApiError(400, "invalid_amount_components");
      return v.amount_components.map((raw) => {
        const component = object(raw);
        const quantity = Number(component.quantity), ordinal = Number(component.ordinal);
        if (
          !Number.isInteger(quantity) || quantity < 1 || quantity > 100000 ||
          !Number.isInteger(ordinal) || ordinal < 0 || ordinal > 199
        ) throw new ApiError(400, "invalid_component_quantity");
        const unit = minor(component.unit_price_minor)!;
        const total = signedMinor(component.line_total_minor);
        const role = component.semantic_role as AmountComponent["semantic_role"];
        if (!["item", "tax", "tip", "fee", "discount"].includes(role))
          throw new ApiError(400, "invalid_component_role");
        const expected = BigInt(unit) * BigInt(quantity) * (role === "discount" ? -1n : 1n);
        if (BigInt(total) !== expected) throw new ApiError(400, "component_total_mismatch");
        return {
          transaction_ordinal: transactionOrdinal(component.transaction_ordinal),
          ordinal,
          label: text(component.label, 160).trim(),
          quantity,
          unit_price_minor: unit,
          line_total_minor: total,
          semantic_role: role,
          confidence: probability(component.confidence),
          evidence: evidenceClaim(component.evidence),
          needs_review: component.needs_review === true,
        };
      });
    })();
  return {
    transactions,
    people,
    contexts: names(v.contexts),
    unresolved: names(v.unresolved),
    schema_version: v.schema_version === undefined ? 1 : Number(v.schema_version),
    ...(v.interpretation_summary === undefined
      ? {}
      : { interpretation_summary: text(v.interpretation_summary, 300).trim() }),
    participants,
    transaction_contexts: transactionContexts,
    allocations,
    amount_components: amountComponents,
  };
}
