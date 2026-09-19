/** Authenticated SQL totals and financial insight reads. */
import { getSupabase } from "@/lib/supabase/client";
import { searchJournal } from "@/features/ask/services/ask-service";

export function spendingSummary(startDate: string, endDate: string) {
  return searchJournal({
    filters: {
      operation: "sum",
      direction: "expense",
      start_date: startDate,
      end_date: endDate,
      category_id: null,
      merchant_id: null,
      person: null,
      context: null,
      text: null,
      currency: null,
    },
    limit: 20,
  });
}
export async function financialInsight(
  view:
    | "spending_by_category"
    | "spending_by_merchant"
    | "spending_by_person"
    | "spending_by_context"
    | "monthly_comparison"
    | "recurring_candidates"
    | "lending_balances",
  offset = 0,
) {
  const { data, error } = await getSupabase()
    .from(view)
    .select("*")
    .order("user_id")
    .range(offset, offset + 99);
  if (error) throw error;
  return data;
}
