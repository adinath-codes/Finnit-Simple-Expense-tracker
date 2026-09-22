/** Authenticated SQL totals and financial insight reads. */
import { getSupabase } from "@/lib/supabase/client";
import { searchJournal } from "@/features/ask/services/ask-service";
import type { Category, JournalEntry } from "@/types/domain";
import { entryTotal, itemAccountingAmount } from "@/utils/amounts";
import type { PeriodSummary, SummaryPeriod } from "../types/summary.types";
import { LruCache } from "@/lib/cache/lru";

const periodCache = new LruCache<PeriodSummary>(12);
type DayBreakdown = {
  entries: JournalEntry[];
  total: number;
  categoryValues: Record<Category, number>;
};
const dayBreakdownCache = new LruCache<DayBreakdown>(12);

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
      categoryTotals[item.category] += itemAccountingAmount(item);
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

export function cachedPeriodSummary({
  accountId,
  contentVersion,
  currency,
  ...input
}: Parameters<typeof buildPeriodSummary>[0] & {
  accountId: string;
  contentVersion: number;
  currency: string;
}) {
  const key = [
    accountId, contentVersion, currency, input.period, input.anchorDate, input.today,
  ].join(":");
  return periodCache.get(key) ?? periodCache.set(key, buildPeriodSummary(input));
}

export function cachedDayBreakdown({
  accountId,
  contentVersion,
  currency,
  selectedDate,
  entries,
}: {
  accountId: string;
  contentVersion: number;
  currency: string;
  selectedDate: string;
  entries: JournalEntry[];
}) {
  const key = [accountId, contentVersion, currency, selectedDate].join(":");
  const cached = dayBreakdownCache.get(key);
  if (cached) return cached;
  const selected = entries.filter((entry) => entry.date === selectedDate);
  const categoryValues = emptyCategoryTotals();
  let total = 0;
  for (const entry of selected) {
    total += entryTotal(entry);
    for (const item of entry.items) {
      categoryValues[item.category] += item.amountMinor;
    }
  }
  return dayBreakdownCache.set(key, { entries: selected, total, categoryValues });
}

export function clearSummaryCaches() {
  periodCache.clear();
  dayBreakdownCache.clear();
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
      metric: "user_share",
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
