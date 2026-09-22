/** Authenticated SQL totals and financial insight reads. */
import { getSupabase } from "@/lib/supabase/client";
import { searchJournal } from "@/features/ask/services/ask-service";
import type { Category, JournalEntry } from "@/types/domain";
import type { PeriodSummary, SummaryPeriod } from "../types/summary.types";

const emptyCategoryTotals = (): Record<Category, number> => ({
  food: 0,
  transport: 0,
  shopping: 0,
  other: 0,
});

function localDate(date: string) {
  return new Date(`${date}T12:00:00`);
}

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function shiftDay(date: string, amount: number) {
  const shifted = localDate(date);
  shifted.setDate(shifted.getDate() + amount);
  return dateKey(shifted);
}

export function weekRange(date: string) {
  const anchor = localDate(date);
  const mondayOffset = (anchor.getDay() + 6) % 7;
  return {
    startDate: shiftDay(date, -mondayOffset),
    endDate: shiftDay(date, 6 - mondayOffset),
  };
}

export function monthRange(date: string) {
  const anchor = localDate(date);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  return {
    startDate: dateKey(new Date(year, month, 1, 12)),
    endDate: dateKey(new Date(year, month + 1, 0, 12)),
  };
}

export function latestCompletedWeekAnchor(today: string) {
  return shiftDay(weekRange(today).startDate, -1);
}

export function latestCompletedMonthAnchor(today: string) {
  const start = localDate(monthRange(today).startDate);
  start.setDate(0);
  return dateKey(start);
}

function rangeLabel(period: SummaryPeriod, startDate: string, endDate: string) {
  if (period === "month") {
    return localDate(startDate).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }

  const start = localDate(startDate);
  const end = localDate(endDate);
  const sameMonth = start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(start.getFullYear() !== end.getFullYear() ? { year: "numeric" } : {}),
  });
  const endLabel = end.toLocaleDateString("en-US", {
    ...(sameMonth ? {} : { month: "short" }),
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

export function buildPeriodSummary({
  period,
  anchorDate,
  entries,
  today,
}: {
  period: SummaryPeriod;
  anchorDate: string;
  entries: JournalEntry[];
  today: string;
}): PeriodSummary {
  const range = period === "week" ? weekRange(anchorDate) : monthRange(anchorDate);
  const categoryTotals = emptyCategoryTotals();

  for (const entry of entries) {
    if (entry.date < range.startDate || entry.date > range.endDate || entry.date > today) {
      continue;
    }
    for (const item of entry.items) {
      categoryTotals[item.category] += item.amountMinor;
    }
  }

  return {
    period,
    ...range,
    label: rangeLabel(period, range.startDate, range.endDate),
    totalMinor: Object.values(categoryTotals).reduce(
      (total, amount) => total + amount,
      0,
    ),
    categoryTotals,
  };
}

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
