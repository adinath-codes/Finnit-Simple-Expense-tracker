import type { Category, JournalEntry } from "../../../types/domain.ts";
import { itemAccountingAmount } from "../../../utils/amounts.ts";
import type { CalendarCategoryItem } from "../types/calendar.types.ts";

export function buildCalendarCategoryItems({
  category,
  entries,
  month,
  today,
}: {
  category: Category;
  entries: JournalEntry[];
  month: Date;
  today: string;
}): CalendarCategoryItem[] {
  const monthKey = [
    month.getFullYear(),
    String(month.getMonth() + 1).padStart(2, "0"),
  ].join("-");
  const rows: (CalendarCategoryItem & { sourceOrder: number })[] = [];
  let sourceOrder = 0;

  for (const entry of entries) {
    if (entry.date.slice(0, 7) !== monthKey || entry.date > today) {
      continue;
    }

    for (const item of entry.items) {
      if (item.category !== category) continue;
      rows.push({
        id: `${entry.id}:${item.id}`,
        entryId: entry.id,
        date: entry.date,
        message: entry.note,
        amountMinor: itemAccountingAmount(item),
        amountNeedsReview:
          item.accountingAmountMinor === null || item.amountMissing === true,
        sourceOrder,
      });
      sourceOrder += 1;
    }
  }

  return rows
    .sort((left, right) =>
      right.date.localeCompare(left.date) || left.sourceOrder - right.sourceOrder,
    )
    .map(({ sourceOrder: _sourceOrder, ...row }) => row);
}
