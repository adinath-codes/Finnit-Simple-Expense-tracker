import type { Category, JournalEntry } from "@/types/domain";
import { entryTotal, itemAccountingAmount } from "@/utils/amounts";
import { currencySymbol, money } from "@/utils/currency";
import type { CalendarMonth } from "../types/calendar.types";
import { LruCache } from "@/lib/cache/lru";

const monthCache = new LruCache<CalendarMonth>(12);

function dateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function monthStart(date: string) {
  return new Date(`${date.slice(0, 7)}-01T12:00:00`);
}

export function moveMonth(month: Date, offset: number) {
  return new Date(month.getFullYear(), month.getMonth() + offset, 1, 12);
}

export function isCurrentMonth(month: Date, today: string) {
  return dateKey(month.getFullYear(), month.getMonth(), 1).slice(0, 7) === today.slice(0, 7);
}

export function buildCalendarMonth({
  month,
  entries,
  selectedDate,
  today,
}: {
  month: Date;
  entries: JournalEntry[];
  selectedDate: string;
  today: string;
}): CalendarMonth {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const monthKey = dateKey(year, monthIndex, 1).slice(0, 7);
  const totalsByDate = new Map<string, number>();
  const categoryTotals: Record<Category, number> = {
    food: 0,
    transport: 0,
    shopping: 0,
    other: 0,
  };

  for (const entry of entries) {
    if (entry.date.slice(0, 7) !== monthKey || entry.date > today) {
      continue;
    }
    totalsByDate.set(
      entry.date,
      (totalsByDate.get(entry.date) ?? 0) + entryTotal(entry),
    );
    for (const item of entry.items) {
      categoryTotals[item.category] += itemAccountingAmount(item);
    }
  }

  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  const days = Array.from({ length: dayCount }, (_, index) => {
    const dayNumber = index + 1;
    const date = dateKey(year, monthIndex, dayNumber);
    return {
      date,
      dayNumber,
      totalMinor: totalsByDate.get(date) ?? 0,
      isToday: date === today,
      isSelected: date === selectedDate,
      isFuture: date > today,
    };
  });

  return {
    label: month.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
    leadingBlankCount: new Date(year, monthIndex, 1).getDay(),
    totalMinor: Object.values(categoryTotals).reduce(
      (total, value) => total + value,
      0,
    ),
    categoryTotals,
    days,
  };
}

export function cachedCalendarMonth({
  accountId,
  contentVersion,
  currency,
  ...input
}: Parameters<typeof buildCalendarMonth>[0] & {
  accountId: string;
  contentVersion: number;
  currency: string;
}) {
  const monthKey = `${input.month.getFullYear()}-${input.month.getMonth()}`;
  const key = [
    accountId, contentVersion, currency, monthKey, input.selectedDate, input.today,
  ].join(":");
  return monthCache.get(key) ?? monthCache.set(key, buildCalendarMonth(input));
}

export function clearCalendarCache() {
  monthCache.clear();
}

export function compactMoney(amountMinor: number, currency: string) {
  const amount = amountMinor / 100;
  if (Math.abs(amount) < 1000) return money(amountMinor, currency);

  const absoluteAmount = Math.abs(amount);
  const compact =
    absoluteAmount >= 10_000_000
      ? `${formatCompact(amount / 10_000_000)}Cr`
      : absoluteAmount >= 100_000
        ? `${formatCompact(amount / 100_000)}L`
        : `${formatCompact(amount / 1_000)}K`;
  return `${currencySymbol(currency)}${compact}`;
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: Math.abs(value) < 10 ? 1 : 0,
  }).format(value);
}
