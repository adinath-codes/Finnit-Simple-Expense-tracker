import { CURRENCIES, type CaptureInput, type Extraction, type PresetSnapshot } from "./contracts.ts";
import { localDay } from "./dates.ts";

const CATEGORY_LABELS = {
  food: "food",
  transport: "transport",
  shopping: "shopping",
  other: "other expense",
} as const;

export function formatPresetAmount(amountMinor: string, currency: string) {
  const digits = CURRENCIES[currency];
  if (digits === undefined) throw new Error("unsupported_currency");
  const value = BigInt(amountMinor);
  if (digits === 0) return value.toString();
  const scale = 10n ** BigInt(digits);
  const fraction = (value % scale).toString().padStart(digits, "0");
  return `${value / scale}.${fraction}`;
}

export function presetCaptureText(snapshot: PresetSnapshot, currency: string) {
  const note = snapshot.note.trim() || snapshot.name.trim();
  return `${note} · ${formatPresetAmount(snapshot.amount_minor, currency)} ${
    CATEGORY_LABELS[snapshot.category_id]
  }`;
}

export function presetExtraction(
  snapshot: PresetSnapshot,
  input: CaptureInput,
): Extraction {
  const note = snapshot.note.trim() || snapshot.name.trim();
  const occurredOn = input.selected_date ?? localDay(input.captured_at, input.timezone);
  return {
    transactions: [{
      description: note,
      amount_minor: snapshot.amount_minor,
      currency: input.currency,
      direction: "expense",
      cash_flow: "out",
      amount_status: "confirmed",
      category_id: snapshot.category_id,
      category_source: "user_correction",
      merchant_id: null,
      occurred_on: occurredOn,
      quantity: null,
      unit_price_minor: null,
      confidence: 1,
      needs_review: false,
      unresolved: [],
      person: null,
      evidence: null,
      primary_amount_role: "personal_total",
      group_total_minor: snapshot.amount_minor,
      user_share_minor: snapshot.amount_minor,
      paid_by_user_minor: snapshot.amount_minor,
      split_method: "not_applicable",
      participant_count: 1,
      quantity_unit: null,
      merchant_text: null,
      field_confidence: { transaction: 1, amount: 1, category: 1 },
      field_evidence: {},
      allocation_status: "complete",
      breakdown_approximate: false,
    }],
    people: [],
    contexts: [],
    unresolved: [],
    schema_version: 3,
    interpretation_summary: "Added from a user-approved saved entry.",
    participants: [],
    transaction_contexts: [],
    allocations: [],
    amount_components: [],
  };
}
