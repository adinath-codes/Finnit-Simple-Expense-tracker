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
};
export type Extraction = {
  transactions: Transaction[];
  people: string[];
  contexts: string[];
  unresolved: string[];
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
export type Catalog = {
  categories: { id: string; name: string }[];
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
  operation: "sum" | "list";
  direction: Direction | null;
  start_date: string;
  end_date: string; // exclusive
  merchant_id: string | null;
  category_id: string | null;
  person: string | null;
  context: string | null;
  text: string | null;
  currency: string | null;
};
export type SavedEntry = Omit<CaptureInput, "raw_text"> & {
  source_type?: "text" | "receipt";
  raw_text: string | null;
  occurred_on: string;
  original_text: string | null;
  revision: number;
  deleted_at: string | null;
  extraction: Extraction;
  receipt?: ReceiptAttachment | null;
};

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
