import type { EntryItem, JournalEntry } from "@/types/domain";

export function itemAccountingAmount(item: EntryItem) {
  return item.accountingAmountMinor === undefined
    ? item.amountMinor
    : item.accountingAmountMinor ?? 0;
}

export function entryTotal(entry: JournalEntry) {
  if (entry.accountingTotalMinor !== undefined)
    return entry.accountingTotalMinor;
  return entry.items.reduce(
    (total, item) => total + itemAccountingAmount(item),
    0,
  );
}

/** Presentation only. Provisional/group totals never feed entryTotal. */
export function entryDisplayAmount(
  entry: JournalEntry,
  fallbackCurrency: string,
): {
  amountMinor: number;
  currency: string;
  scope: "personal_total" | "user_share" | "group_total";
  provisional: boolean;
  needsReview: boolean;
} | null {
  if (entry.amountPreview) {
    return {
      ...entry.amountPreview,
      provisional: true,
      needsReview: entry.amountPreview.needsReview,
    };
  }
  const currencies = new Set(
    entry.items.map((item) => item.currency ?? fallbackCurrency),
  );
  if (currencies.size > 1) return null;
  const total = entryTotal(entry);
  if (total !== 0) {
    return {
      amountMinor: total,
      currency: currencies.values().next().value ?? fallbackCurrency,
      scope: entry.items.some((item) => item.primaryAmountRole === "user_share")
        ? "user_share"
        : "personal_total",
      provisional: false,
      needsReview: entry.status === "review",
    };
  }
  if (
    entry.items.length &&
    entry.items.every((item) =>
      item.groupTotalMinor !== null && item.groupTotalMinor !== undefined &&
      (item.userShareMinor === null || item.userShareMinor === undefined)
    )
  ) {
    return {
      amountMinor: entry.items.reduce(
        (sum, item) => sum + (item.groupTotalMinor ?? 0),
        0,
      ),
      currency: currencies.values().next().value ?? fallbackCurrency,
      scope: "group_total",
      provisional: false,
      needsReview: entry.status === "review",
    };
  }
  return null;
}
