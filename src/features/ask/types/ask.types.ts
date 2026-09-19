import type { SearchPlan } from "@/lib/supabase/database.types";
export type MoneyTotal = {
  currency: string;
  total_minor: string;
  confirmed_count: number;
  review_count: number;
};
export type SearchCursor = { day: string; entry_id: string; id: string };
export type SearchItem = {
  id: string;
  entry_id: string;
  description: string;
  raw_text: string;
  occurred_on: string;
  amount_minor: string | null;
  currency: string;
  direction: string;
  cash_flow: string;
  quantity: number | null;
  unit_price_minor: string | null;
  category_id: string;
  category_name: string;
  merchant_id: string | null;
  merchant_name: string | null;
  amount_status: "confirmed" | "missing" | "estimated";
  needs_review: boolean;
};
export type SearchResult = {
  needs_filters?: boolean;
  suggested_filters?: SearchPlan;
  applied_filters?: SearchPlan;
  totals?: MoneyTotal[];
  matching_count?: number;
  transactions?: SearchItem[];
  categories?: { currency: string; category_id: string; total_minor: string }[];
  merchants?: {
    currency: string;
    merchant_id: string | null;
    total_minor: string;
  }[];
  filter_labels?: { merchant: string | null; category: string | null };
  interpretation?:
    | "deterministic"
    | "structured_model"
    | "cached_model"
    | "explicit_filters";
  next_cursor?: SearchCursor | null;
  has_more?: boolean;
  revision?: string;
  stale?: boolean;
  limit?: number;
};
export type ActiveContext = {
  id: string;
  name: string;
  last_activity: string;
  entry_count: number;
  totals: MoneyTotal[];
};
export type ContextResult = {
  start_date: string;
  end_date: string;
  contexts: ActiveContext[];
};
export type SearchRequest = (
  | {
      query: string;
      timezone: string;
      selected_range?: { start_date: string; end_date: string };
    }
  | { filters: SearchPlan }
) & {
  limit?: number;
  offset?: number;
  cursor?: SearchCursor;
  revision?: string;
};
