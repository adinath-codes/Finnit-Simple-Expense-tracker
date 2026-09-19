/** Wire money is a decimal integer string. No floating point or implicit FX. */
export const CURRENCIES: Record<string, number> = {
  INR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  KRW: 0,
  KWD: 3,
  BHD: 3,
  OMR: 3,
  AED: 2,
  SAR: 2,
  CAD: 2,
  AUD: 2,
  SGD: 2,
  CHF: 2,
  CNY: 2,
  HKD: 2,
  NZD: 2,
  THB: 2,
  MYR: 2,
  IDR: 2,
  PHP: 2,
  VND: 0,
};
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
export type SavedEntry = CaptureInput & {
  occurred_on: string;
  original_text: string;
  revision: number;
  deleted_at: string | null;
  extraction: Extraction;
};
