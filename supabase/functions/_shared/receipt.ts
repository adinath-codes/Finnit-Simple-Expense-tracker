import {
  CURRENCIES,
  type Extraction,
  RECEIPT_LINE_KINDS,
  type ReceiptLine,
  type ReceiptLineKind,
  type ReceiptScanRequest,
  type Transaction,
} from "./contracts.ts";
import { ApiError, object, text } from "./validation.ts";

export const MAX_RECEIPT_LINES = 100;
export const RECEIPT_CONFIDENCE_THRESHOLD = 0.85;

export function receiptJsonSchema(categoryIds: string[]) {
  const nullableText = { type: ["string", "null"] };
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "merchant_name",
      "purchase_date_text",
      "currency_code",
      "line_items",
      "subtotal_text",
      "total_text",
      "truncated",
    ],
    properties: {
      merchant_name: nullableText,
      purchase_date_text: nullableText,
      currency_code: nullableText,
      line_items: {
        // Gemini's current REST grammar rejects maxItems=100 for this nested
        // object schema. The prompt and mandatory server validator still cap
        // accepted rows at MAX_RECEIPT_LINES.
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "kind",
            "description",
            "quantity",
            "unit_price_text",
            "amount_text",
            "category_id",
            "confidence",
            "uncertain",
            "evidence_text",
          ],
          properties: {
            kind: { type: "string", enum: ["item", "tax", "tip", "fee", "discount"] },
            description: { type: "string" },
            quantity: { type: ["integer", "null"], minimum: 1, maximum: 100000 },
            unit_price_text: nullableText,
            amount_text: { type: "string" },
            category_id: { type: "string", enum: categoryIds },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            uncertain: { type: "boolean" },
            evidence_text: { type: "string" },
          },
        },
      },
      subtotal_text: nullableText,
      total_text: nullableText,
      truncated: { type: "boolean" },
    },
  };
}

export type RawReceiptLine = {
  kind: ReceiptLineKind;
  description: string;
  quantity: number | null;
  unit_price_text: string | null;
  amount_text: string;
  category_id: string;
  confidence: number;
  uncertain: boolean;
  evidence_text: string;
};

export type RawReceiptModel = {
  merchant_name: string | null;
  purchase_date_text: string | null;
  currency_code: string | null;
  line_items: RawReceiptLine[];
  subtotal_text: string | null;
  total_text: string | null;
  truncated: boolean;
};

export type ValidatedReceipt = {
  merchant_name: string | null;
  purchase_date_text: string | null;
  currency: string;
  printed_subtotal_minor: string | null;
  printed_total_minor: string | null;
  confidence: number;
  needs_review: boolean;
  truncated: boolean;
  status: "complete" | "needs_review";
  lines: ReceiptLine[];
  extraction: Extraction;
  reconciled: boolean;
};

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  if (Object.keys(value).some((key) => !keys.includes(key))) {
    throw new ApiError(422, "unexpected_receipt_field");
  }
}

function receiptExtraction(
  lines: ReceiptLine[],
  total: string | null,
  currency: string,
  occurred: string,
  categorySource: "llm_fallback" | "user_correction",
) {
  const sum = lines.reduce((current, line) => current + BigInt(line.amount_minor), 0n);
  const reconciled = total !== null && sum === BigInt(total);
  let transactions: Transaction[];
  if (total !== null && !reconciled) {
    transactions = [{
      description: "Receipt total",
      amount_minor: total,
      currency,
      direction: "expense",
      cash_flow: "out",
      amount_status: "confirmed",
      category_id: "other",
      category_source: categorySource,
      merchant_id: null,
      occurred_on: occurred,
      quantity: null,
      unit_price_minor: null,
      confidence: 1,
      needs_review: false,
      unresolved: [],
      person: null,
      evidence: total,
      receipt_line_kind: "receipt_total",
      primary_amount_role: "personal_total",
      group_total_minor: total,
      user_share_minor: total,
      paid_by_user_minor: total,
      split_method: "not_applicable",
      participant_count: 1,
      quantity_unit: null,
      merchant_text: null,
      field_confidence: { amount: 1, allocation: 1 },
      field_evidence: {},
      allocation_status: "complete",
    }];
  } else {
    transactions = lines.map((line): Transaction => {
      const exactUnit = line.kind !== "discount" && line.unit_price_minor !== null &&
        line.quantity !== null &&
        BigInt(line.unit_price_minor) * BigInt(line.quantity) === BigInt(line.amount_minor);
      return ({
        description: line.description,
        amount_minor: line.amount_minor,
        currency,
        direction: "expense",
        cash_flow: "out",
        amount_status: "confirmed",
        category_id: line.category_id,
        category_source: categorySource,
        merchant_id: null,
        occurred_on: occurred,
        quantity: line.quantity,
        unit_price_minor: exactUnit ? line.unit_price_minor : null,
        confidence: line.confidence,
        // A missing printed total makes the receipt entry reviewable, but a
        // reliable printed line can still contribute to confirmed aggregates.
        // Only the uncertain line itself is excluded from those aggregates.
        needs_review: line.needs_review,
        unresolved: line.needs_review ? ["receipt_review"] : [],
        person: null,
        evidence: line.evidence_text,
        receipt_line_kind: line.kind,
        primary_amount_role: line.kind === "tax"
          ? "tax"
          : line.kind === "tip"
            ? "tip"
            : line.kind === "discount"
              ? "discount"
              : "personal_total",
        group_total_minor: line.amount_minor,
        user_share_minor: line.amount_minor,
        paid_by_user_minor: line.amount_minor,
        split_method: "not_applicable",
        participant_count: 1,
        quantity_unit: line.quantity === null ? null : "items",
        merchant_text: null,
        field_confidence: {
          amount: line.confidence,
          category: line.confidence,
          allocation: 1,
        },
        field_evidence: {},
        allocation_status: "complete",
      });
    });
  }
  return {
    reconciled,
    extraction: {
      transactions,
      people: [],
      contexts: [],
      unresolved: lines.some((line) => line.needs_review) || !reconciled ? ["receipt_review"] : [],
      schema_version: 2,
      interpretation_summary: reconciled
        ? "The receipt lines reconcile with the recorded total."
        : "The visible receipt lines were kept, but the printed total needs review.",
      participants: [],
      transaction_contexts: [],
      allocations: [],
      amount_components: [],
    } satisfies Extraction,
  };
}

function normalizedMinor(value: unknown, allowNegative: boolean): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^-?\d{1,16}$/.test(value)) {
    throw new ApiError(400, "invalid_receipt_amount");
  }
  const amount = BigInt(value);
  if (
    (!allowNegative && amount < 0n) || amount < -9007199254740991n || amount > 9007199254740991n
  ) {
    throw new ApiError(400, "invalid_receipt_amount");
  }
  return amount.toString();
}

/** Validate user-edited normalized rows without another model call. */
export function validateReceiptCorrectionLines(
  value: unknown,
  currency: string,
  categoryIds: string[],
): ReceiptLine[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_RECEIPT_LINES) {
    throw new ApiError(400, "invalid_receipt_lines");
  }
  return value.map((candidate, ordinal) => {
    const line = object(candidate);
    exactKeys(line, [
      "id",
      "ordinal",
      "kind",
      "description",
      "quantity",
      "unit_price_minor",
      "amount_minor",
      "currency",
      "category_id",
      "confidence",
      "needs_review",
      "evidence_text",
      "provisional",
    ]);
    const kind = line.kind as ReceiptLineKind;
    if (!RECEIPT_LINE_KINDS.includes(kind)) {
      throw new ApiError(400, "invalid_receipt_line_kind");
    }
    const categoryId = text(line.category_id, 50);
    if (!categoryIds.includes(categoryId)) throw new ApiError(400, "invalid_receipt_category");
    const quantity = line.quantity === null ? null : Number(line.quantity);
    if (quantity !== null && (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000)) {
      throw new ApiError(400, "invalid_receipt_quantity");
    }
    const unit = normalizedMinor(line.unit_price_minor, false);
    let amount = normalizedMinor(line.amount_minor, true)!;
    if (kind === "discount") amount = (-BigInt(amount.replace("-", ""))).toString();
    else if (BigInt(amount) < 0n) throw new ApiError(400, "invalid_negative_receipt_line");
    if (unit !== null && quantity === null) throw new ApiError(400, "invalid_receipt_unit_price");
    if (typeof line.confidence !== "number" || line.confidence < 0 || line.confidence > 1) {
      throw new ApiError(400, "invalid_receipt_confidence");
    }
    if (typeof line.needs_review !== "boolean") throw new ApiError(400, "invalid_review");
    const description = text(line.description, 500).trim();
    const evidence = text(line.evidence_text, 500).trim();
    if (!description || !evidence) throw new ApiError(400, "invalid_receipt_text");
    return {
      ordinal,
      kind,
      description,
      quantity,
      unit_price_minor: unit,
      amount_minor: amount,
      currency,
      category_id: categoryId,
      confidence: line.confidence,
      needs_review: line.needs_review ||
        (unit !== null &&
          BigInt(unit) * BigInt(quantity!) !==
            (kind === "discount" ? -BigInt(amount) : BigInt(amount))),
      evidence_text: evidence,
      provisional: false,
    };
  });
}

export function reconcileReceiptCorrection(
  lines: ReceiptLine[],
  total: string | null,
  currency: string,
  occurred: string,
) {
  return receiptExtraction(lines, total, currency, occurred, "user_correction");
}

function nullableText(value: unknown, maximum: number): string | null {
  if (value === null) return null;
  const normalized = text(value, maximum).trim();
  return normalized || null;
}

/** Parse only visibly printed decimal money. No floats and no inferred FX. */
export function receiptMoney(value: unknown, currency: string): string | null {
  if (value === null) return null;
  const digits = CURRENCIES[currency];
  if (digits === undefined) throw new ApiError(400, "unsupported_currency");
  let source = text(value, 80).trim();
  let negative = false;
  if (/^\(.*\)$/.test(source)) {
    negative = true;
    source = source.slice(1, -1).trim();
  }
  source = source
    .replace(new RegExp(`\\b${currency}\\b`, "ig"), "")
    .replace(/[₹$€£¥₩]/g, "")
    .replaceAll("د.إ", "")
    .replaceAll("ر.س", "")
    .replace(/\s/g, "")
    .trim();
  if (source.startsWith("-")) {
    negative = true;
    source = source.slice(1);
  } else if (source.startsWith("+")) source = source.slice(1);
  // Commas are accepted only as thousands separators. Locale-ambiguous decimal
  // commas stay reviewable rather than being silently converted.
  if (source.includes(",") && !/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(source)) {
    throw new ApiError(422, "ambiguous_receipt_amount");
  }
  source = source.replaceAll(",", "");
  if (!/^\d+(?:\.\d+)?$/.test(source)) {
    throw new ApiError(422, "invalid_receipt_amount");
  }
  const [whole, fraction = ""] = source.split(".");
  if (fraction.length > digits) {
    throw new ApiError(422, "invalid_receipt_precision");
  }
  const scale = 10n ** BigInt(digits);
  const minor = BigInt(whole) * scale +
    BigInt((fraction + "0".repeat(digits)).slice(0, digits) || "0");
  if (minor > 9007199254740991n) {
    throw new ApiError(422, "invalid_receipt_amount");
  }
  return `${negative ? "-" : ""}${minor}`;
}

export function validateReceiptLine(
  value: unknown,
  ordinal: number,
  currency: string,
  categoryIds: string[],
  provisional: boolean,
): ReceiptLine {
  const raw = object(value);
  exactKeys(raw, [
    "kind",
    "description",
    "quantity",
    "unit_price_text",
    "amount_text",
    "category_id",
    "confidence",
    "uncertain",
    "evidence_text",
  ]);
  if (!RECEIPT_LINE_KINDS.includes(raw.kind as ReceiptLineKind)) {
    throw new ApiError(422, "invalid_receipt_line_kind");
  }
  if (!categoryIds.includes(raw.category_id as string)) {
    throw new ApiError(422, "invalid_receipt_category");
  }
  if (typeof raw.uncertain !== "boolean") {
    throw new ApiError(422, "invalid_receipt_uncertainty");
  }
  if (
    typeof raw.confidence !== "number" ||
    !Number.isFinite(raw.confidence) ||
    raw.confidence < 0 ||
    raw.confidence > 1
  ) throw new ApiError(422, "invalid_receipt_confidence");
  const quantity = raw.quantity === null ? null : Number(raw.quantity);
  if (
    quantity !== null &&
    (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000)
  ) throw new ApiError(422, "invalid_receipt_quantity");
  const description = text(raw.description, 500).trim();
  const evidence = text(raw.evidence_text, 500).trim();
  const amountText = text(raw.amount_text, 80).trim();
  if (!description || !evidence || !amountText) {
    throw new ApiError(422, "invalid_receipt_text");
  }
  if (
    !evidence.toLocaleLowerCase().includes(description.toLocaleLowerCase()) ||
    !evidence.includes(amountText)
  ) {
    throw new ApiError(422, "ungrounded_receipt_line");
  }
  let amount = receiptMoney(amountText, currency)!;
  const kind = raw.kind as ReceiptLineKind;
  if (kind === "discount") amount = (-BigInt(amount.replace("-", ""))).toString();
  else if (BigInt(amount) < 0n) throw new ApiError(422, "invalid_negative_receipt_line");
  const unit = receiptMoney(raw.unit_price_text, currency);
  let arithmeticReview = false;
  if (unit !== null) {
    if (BigInt(unit) < 0n || quantity === null) {
      throw new ApiError(422, "invalid_receipt_unit_price");
    }
    arithmeticReview =
      BigInt(unit) * BigInt(quantity) !== (kind === "discount" ? -BigInt(amount) : BigInt(amount));
  }
  const needsReview = raw.uncertain || raw.confidence < RECEIPT_CONFIDENCE_THRESHOLD ||
    arithmeticReview;
  return {
    ordinal,
    kind,
    description,
    quantity,
    unit_price_minor: unit,
    amount_minor: amount,
    currency,
    category_id: raw.category_id as string,
    confidence: raw.confidence,
    needs_review: needsReview,
    evidence_text: evidence,
    provisional,
  };
}

export function validateReceiptModel(
  value: unknown,
  request: ReceiptScanRequest,
  categoryIds: string[],
): ValidatedReceipt {
  const raw = object(value);
  exactKeys(raw, [
    "line_items",
    "merchant_name",
    "purchase_date_text",
    "currency_code",
    "subtotal_text",
    "total_text",
    "truncated",
  ]);
  if (
    !Array.isArray(raw.line_items) || raw.line_items.length < 1 ||
    raw.line_items.length > MAX_RECEIPT_LINES
  ) {
    throw new ApiError(422, "invalid_receipt_lines");
  }
  if (typeof raw.truncated !== "boolean") {
    throw new ApiError(422, "invalid_receipt_truncation");
  }
  const currency = raw.currency_code === null
    ? request.default_currency
    : text(raw.currency_code, 3).toUpperCase();
  if (CURRENCIES[currency] === undefined) {
    throw new ApiError(422, "unsupported_currency");
  }
  const lines = raw.line_items.map((line, index) =>
    validateReceiptLine(line, index, currency, categoryIds, false)
  );
  const subtotal = receiptMoney(raw.subtotal_text, currency);
  const total = receiptMoney(raw.total_text, currency);
  if (subtotal !== null && BigInt(subtotal) < 0n) {
    throw new ApiError(422, "invalid_receipt_subtotal");
  }
  if (total !== null && BigInt(total) < 0n) {
    throw new ApiError(422, "invalid_receipt_total");
  }
  const reconciliation = receiptExtraction(
    lines,
    total,
    currency,
    request.selected_date,
    "llm_fallback",
  );
  const reconciled = reconciliation.reconciled;
  const lineReview = lines.some((line) => line.needs_review);
  const needsReview = raw.truncated || lineReview || !reconciled;
  const confidence = lines.reduce((sum, line) => sum + line.confidence, 0) / lines.length;
  return {
    merchant_name: nullableText(raw.merchant_name, 160),
    purchase_date_text: nullableText(raw.purchase_date_text, 100),
    currency,
    printed_subtotal_minor: subtotal,
    printed_total_minor: total,
    confidence,
    needs_review: needsReview,
    truncated: raw.truncated,
    status: needsReview ? "needs_review" : "complete",
    lines,
    extraction: reconciliation.extraction,
    reconciled,
  };
}

/** Return complete line-item objects found in a valid partial structured JSON string. */
export function completedReceiptLineJson(partial: string): string[] {
  const property = partial.indexOf('"line_items"');
  if (property < 0) return [];
  const arrayStart = partial.indexOf("[", property);
  if (arrayStart < 0) return [];
  const results: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let index = arrayStart + 1; index < partial.length; index++) {
    const character = partial[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        results.push(partial.slice(start, index + 1));
        start = -1;
      }
    } else if (character === "]" && depth === 0) break;
  }
  return results;
}
