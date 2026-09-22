import type { JournalEntry } from "@/types/domain";
export function entryTotal(entry: JournalEntry) {
  if (entry.accountingTotalMinor !== undefined)
    return entry.accountingTotalMinor;
  return entry.items.reduce(
    (total, item) => total + item.amountMinor,
    0,
  );
}
/** A deterministic demo helper; no AI inference or network work occurs here. */
export function amountFromNote(note: string) {
  const match = note.match(
    /(?:^|\s)(?:₹|rs\.?\s*)?(\d[\d,]*(?:\.\d{1,2})?)\s*$/i,
  );
  return match ? Math.round(Number(match[1].replaceAll(",", "")) * 100) : 0;
}
