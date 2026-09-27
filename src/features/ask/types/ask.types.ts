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
  metric_minor?: string | null;
  metric_confirmed?: boolean;
  primary_amount_role?: string;
  group_total_minor?: string | null;
  user_share_minor?: string | null;
  paid_by_user_minor?: string | null;
  split_method?: string;
  participant_count?: number | null;
  quantity_unit?: string | null;
  amount_components?: {
    ordinal: number;
    label: string;
    quantity: number;
    unit_price_minor: string;
    line_total_minor: string;
    semantic_role: string;
    needs_review: boolean;
  }[];
  participants?: {
    display_name: string | null;
    party_kind: string;
    participant_count: number;
    role: string;
    share_minor: string | null;
    split_method: string;
    needs_review: boolean;
  }[];
  contexts?: { name: string; needs_review: boolean }[];
};
export type SearchResult = {
  reason?: string;
  needs_clarification?: boolean;
  clarification_reason?: "conflicting_filters" | "ambiguous_period" | "ambiguous_entity";
  unsupported_question?: boolean;
  unsupported_reason?:
    | "recurrence_status"
    | "prediction"
    | "external_data"
    | "missing_values"
    | "causal_inference"
    | "unsupported_calculation";
  advanced_answer?: {
    kind: "amount" | "date" | "count" | "comparison" | "list" | "sum" | "average" | "rank" | "breakdown";
    label: string;
    rows: {
      value_minor?: string;
      value_date?: string;
      value_count?: string;
      currency?: string;
      label?: string;
      primary_minor?: string;
      comparison_minor?: string;
      delta_minor?: string;
      change_percent?: number | null;
      start_date?: string;
      end_date?: string;
      comparison_start_date?: string;
      comparison_end_date?: string;
      rounded?: boolean;
    }[];
    start_date: string;
    end_date: string;
  };
  sql_session_id?: string;
  explanation?: string;
  needs_filters?: boolean;
  suggested_filters?: SearchPlan;
  applied_filters?: SearchPlan;
  totals?: MoneyTotal[];
  matching_count?: number;
  evidence_count?: number;
  known_split_count?: number;
  unknown_split_count?: number;
  metric?: SearchPlan["metric"];
  transactions?: SearchItem[];
  categories?: { currency: string; category_id: string; total_minor: string }[];
  merchants?: {
    currency: string;
    merchant_id: string | null;
    total_minor: string;
  }[];
  filter_labels?: {
    merchant: string | null;
    category: string | null;
    merchants?: { id: string; label: string }[];
    categories?: { id: string; label: string }[];
  };
  interpretation?:
    | "deterministic"
    | "structured_model"
    | "cached_model"
    | "explicit_filters"
    | "guarded_sql";
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
      default_currency?: string;
      selected_range?: { start_date: string; end_date: string };
    }
  | { filters: SearchPlan }
) & {
  limit?: number;
  offset?: number;
  cursor?: SearchCursor;
  revision?: string;
};
