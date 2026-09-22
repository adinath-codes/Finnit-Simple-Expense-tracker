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
