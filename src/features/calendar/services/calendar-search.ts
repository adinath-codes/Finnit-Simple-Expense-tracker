import type { JournalEntry } from "../../../types/domain.ts";

function searchableText(entry: JournalEntry) {
  return [
    entry.note,
    entry.merchant,
    entry.category,
    ...entry.items.flatMap((item) => [item.name, item.category, item.categoryId ?? ""]),
  ]
    .join(" ")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase();
}

export function searchCalendarMonth({
  entries,
  month,
  query,
  today,
}: {
  entries: JournalEntry[];
  month: Date;
  query: string;
  today: string;
}) {
  const terms = query
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!terms.length) return [];

  const monthKey = [
    month.getFullYear(),
    String(month.getMonth() + 1).padStart(2, "0"),
  ].join("-");

  return entries
    .map((entry, sourceOrder) => ({ entry, sourceOrder }))
    .filter(({ entry }) =>
      entry.date.slice(0, 7) === monthKey &&
      entry.date <= today &&
      terms.every((term) => searchableText(entry).includes(term))
    )
    .sort((left, right) =>
      right.entry.date.localeCompare(left.entry.date) ||
      right.entry.time.localeCompare(left.entry.time) ||
      left.sourceOrder - right.sourceOrder
    )
    .map(({ entry }) => entry);
}
