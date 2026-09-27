/** Wire money is a decimal integer string. No floating point or implicit FX. */
export { CURRENCIES } from "./currencies.ts";
export const DIRECTIONS = [
  "expense",
  "income",
  "transfer",
  "lent",
  "borrowed",
  "repayment",
] as const;
export type Direction = (typeof DIRECTIONS)[number];
export type CategorySource =
  | "merchant_rule"
  | "keyword_rule"
  | "user_correction"
  | "llm_fallback"
  | "unresolved";
export const AMOUNT_ROLES = [
  "personal_total",
  "group_total",
  "user_share",
  "paid_by_user",
  "reimbursement",
  "amount_owed",
  "tax",
  "tip",
  "discount",
  "legacy_unclassified",
  "unknown",
] as const;
export type AmountRole = (typeof AMOUNT_ROLES)[number];
export const SPLIT_METHODS = [
  "not_applicable",
  "exact",
  "equal",
  "percentage",
  "weighted",
  "unknown",
] as const;
export type SplitMethod = (typeof SPLIT_METHODS)[number];
export type EvidenceClaim = {
  text: string;
  start: number;
  end: number;
};
export type TransactionParticipant = {
  transaction_ordinal: number;
  party_kind: "self" | "known_person" | "anonymous_group" | "unknown";
  display_name: string | null;
  participant_count: number;
  role: "participant" | "payer" | "beneficiary" | "debtor" | "creditor";
  share_minor: string | null;
  share_percentage: number | null;
  split_method: SplitMethod;
  confidence: number;
  evidence: EvidenceClaim | null;
  needs_review: boolean;
};
export type TransactionContext = {
  transaction_ordinal: number;
  name: string;
  confidence: number;
  evidence: EvidenceClaim;
  needs_review: boolean;
};
export type TransactionAllocation = {
  transaction_ordinal: number;
  participant_ordinal: number | null;
  allocation_type:
    | "share"
    | "paid"
    | "owed_to_user"
    | "owed_by_user"
    | "reimbursed_to_user"
    | "reimbursed_by_user";
  amount_minor: string;
  confidence: number;
  evidence: EvidenceClaim | null;
  needs_review: boolean;
};
export type AmountComponent = {
  transaction_ordinal: number;
  ordinal: number;
  label: string;
  quantity: number;
  unit_price_minor: string;
  line_total_minor: string;
  semantic_role: "item" | "tax" | "tip" | "fee" | "discount";
  confidence: number;
  evidence: EvidenceClaim;
  needs_review: boolean;
};
export type Transaction = {
  id?: string;
  description: string;
  amount_minor: string | null;
  currency: string;
  direction: Direction;
  cash_flow: "in" | "out" | "internal" | "unknown";
  amount_status: "confirmed" | "missing" | "estimated";
  category_id: string;
  category_source: CategorySource;
  merchant_id: string | null;
  occurred_on: string;
  quantity: number | null;
  unit_price_minor: string | null;
  confidence: number;
  needs_review: boolean;
  unresolved: string[];
  person: string | null;
  evidence: string | null;
  receipt_line_kind?: ReceiptLineKind | "receipt_total" | null;
  /** `amount_minor` is the exact primary stated amount, scoped by this role. */
  primary_amount_role?: AmountRole;
  group_total_minor?: string | null;
  user_share_minor?: string | null;
  paid_by_user_minor?: string | null;
  split_method?: SplitMethod;
  participant_count?: number | null;
  quantity_unit?: string | null;
  merchant_text?: string | null;
  field_confidence?: Record<string, number>;
  field_evidence?: Record<string, EvidenceClaim>;
  allocation_status?: "complete" | "partial" | "unknown" | "not_applicable";
  /** True when the displayed multiplier/share breakdown was inferred. */
  breakdown_approximate?: boolean;
};
export type Extraction = {
  transactions: Transaction[];
  people: string[];
  contexts: string[];
  unresolved: string[];
  schema_version?: number;
  interpretation_summary?: string;
  participants?: TransactionParticipant[];
  transaction_contexts?: TransactionContext[];
  allocations?: TransactionAllocation[];
  amount_components?: AmountComponent[];
};
export type CaptureInput = {
  id: string;
  raw_text: string;
  captured_at: string;
  timezone: string;
  currency: string;
  selected_date?: string;
  /** Coarse city/region/country label; never coordinates or a street address. */
  approximate_place?: string;
};
export type PresetSnapshot = {
  id: string;
  name: string;
  note: string;
  amount_minor: string;
  category_id: "food" | "transport" | "shopping" | "other";
};
export type PresetCaptureInput = {
  input: CaptureInput;
  preset: PresetSnapshot;
};
export type JournalSyncRequest = {
  afterRevision?: string;
  snapshotRevision?: string;
  cursor?: unknown;
  limit?: number;
};
export type JournalSyncPage = {
  snapshotRevision: string;
  changes: SavedEntry[];
  nextCursor: unknown | null;
  resetRequired: boolean;
  bootstrap: boolean;
};
/** PostgREST preserves the SQL RPC's snake_case JSON keys on the wire. */
export type JournalSyncRpcPage = {
  snapshot_revision: string;
  changes: SavedEntry[];
  next_cursor: { entry_id: string; revision?: string } | null;
  reset_required: boolean;
  bootstrap: boolean;
};
export type Catalog = {
  categories: { id: string; name: string; parent_id?: string | null }[];
  merchants: {
    id: string;
    canonical_name: string;
    default_category_id: string;
    user_id: string | null;
  }[];
  aliases: { alias: string; merchant_id: string; user_id: string | null }[];
  rules: { merchant_key: string; category_id: string }[];
  people: { name: string }[];
  contexts: { name: string }[];
};
export type SearchPlan = {
  operation: "sum" | "list" | "count" | "average" | "rank" | "breakdown" | "compare";
  direction: Direction | null;
  start_date: string;
  end_date: string; // exclusive
  merchant_id: string | null;
  category_id: string | null;
  merchant_ids?: string[];
  exclude_merchant_ids?: string[];
  category_ids?: string[];
  exclude_category_ids?: string[];
  person: string | null;
  context: string | null;
  people?: string[];
  contexts?: string[];
  people_match?: "any" | "all";
  contexts_match?: "any" | "all";
  text: string | null;
  currency: string | null;
  metric?:
    | "stated_amount"
    | "user_share"
    | "group_total"
    | "paid_by_user"
    | "owed_to_user"
    | "user_owes"
    | "reimbursed"
    | "gross_spend";
  group_by?: Array<
    "entry" | "day" | "week" | "month" | "category" | "merchant" | "context" | "participant"
  >;
  sort_direction?: "asc" | "desc";
  result_limit?: number;
  comparison_start_date?: string | null;
  comparison_end_date?: string | null;
  participant_scope?: "any" | "self_only" | "with_others";
  split_view?: "none" | "self_vs_others" | "by_participant";
  include_sources?: boolean;
  review_policy?: "exclude_unconfirmed" | "include_review_rows";
};
export type SavedEntry = Omit<CaptureInput, "raw_text"> & {
  source_type?: "text" | "receipt";
  raw_text: string | null;
  occurred_on: string;
  original_text: string | null;
  revision: number;
  deleted_at: string | null;
  extraction: Extraction;
  extraction_status?: "pending" | "complete" | "needs_review" | "failed";
  extraction_schema_version?: number;
  interpretation_summary?: string | null;
  receipt?: ReceiptAttachment | null;
  capture_request?: CaptureInput | ReceiptScanRequest;
};

export type EntryAmountPreview = {
  amount_minor: string;
  currency: string;
  scope: "personal_total" | "user_share" | "group_total";
  /** Every streamed value is provisional, even when Gemini is confident. */
  estimated: boolean;
  needs_review: boolean;
};
export type EntryParseEvent =
  | {
    type: "amount_preview";
    entry_id: string;
    preview: EntryAmountPreview;
  }
  | { type: "final"; entry: SavedEntry; cached: boolean }
  | { type: "warning"; code: string; retryable: boolean };

export const RECEIPT_LINE_KINDS = [
  "item",
  "tax",
  "tip",
  "fee",
  "discount",
] as const;
export type ReceiptLineKind = (typeof RECEIPT_LINE_KINDS)[number];
export type ReceiptScanStatus =
  | "preparing"
  | "queued"
  | "scanning"
  | "needs_review"
  | "complete"
  | "failed";
export type ReceiptScanRequest = {
  entry_id: string;
  attachment_id: string;
  captured_at: string;
  timezone: string;
  selected_date: string;
  default_currency: string;
};
export type ReceiptLine = {
  id?: string;
  ordinal: number;
  kind: ReceiptLineKind;
  description: string;
  quantity: number | null;
  unit_price_minor: string | null;
  amount_minor: string;
  currency: string;
  category_id: string;
  confidence: number;
  needs_review: boolean;
  evidence_text: string;
  provisional: boolean;
};
export type ReceiptAttachment = {
  id: string;
  status: "complete" | "needs_review" | "failed";
  merchant_name: string | null;
  purchase_date_text: string | null;
  printed_subtotal_minor: string | null;
  printed_total_minor: string | null;
  currency: string;
  confidence: number;
  needs_review: boolean;
  truncated: boolean;
  model: string;
  lines: ReceiptLine[];
};
export type ReceiptScanEvent =
  | { type: "item"; entry_id: string; line: ReceiptLine }
  | {
    type: "final";
    entry: SavedEntry;
    attachment: ReceiptAttachment;
    lines: ReceiptLine[];
  }
  | { type: "warning"; code: string; retryable: boolean };
export type ReceiptCorrectionInput = {
  action: "correct_receipt";
  operation_id: string;
  id: string;
  expected_revision: number;
  merchant_name: string | null;
  purchase_date_text: string | null;
  printed_subtotal_minor: string | null;
  printed_total_minor: string | null;
  currency: string;
  lines: ReceiptLine[];
};
export type ManualReceiptInput = Omit<ReceiptCorrectionInput, "action" | "expected_revision"> & {
  action: "create_receipt_manual";
  request: ReceiptScanRequest;
};
