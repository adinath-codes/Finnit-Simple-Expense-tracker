import type { CachedEntry, CachedReceipt, JournalCache } from "../../types/sync.ts";
import { localDayKey, previousLocalDay } from "../../utils/dates.ts";

export { localDayKey, previousLocalDay };

function entryBelongsToWindow(entry: CachedEntry, retainedDays: Set<string>) {
  const transactionDays = entry.extraction.transactions
    .map((transaction) => transaction.occurred_on)
    .filter(Boolean);
  const days = transactionDays.length
    ? transactionDays
    : [entry.input.selected_date ?? entry.input.captured_at.slice(0, 10)];
  return days.some((day) => retainedDays.has(day));
}

function receiptBelongsToWindow(receipt: CachedReceipt, retainedDays: Set<string>) {
  return retainedDays.has(
    receipt.request.selected_date || receipt.request.captured_at.slice(0, 10),
  );
}

function entryNeedsDurableRecovery(entry: CachedEntry, hasJob: boolean) {
  return hasJob || entry.sync !== "synced" || !entry.remote || !!entry.remoteShadow;
}

function receiptNeedsDurableRecovery(receipt: CachedReceipt, hasJob: boolean) {
  return hasJob || !receipt.remote || !!receipt.remoteShadow || !!receipt.localUri ||
    receipt.status === "preparing" || receipt.status === "queued" ||
    receipt.status === "scanning" || receipt.status === "failed";
}

/**
 * Keep only today and yesterday as the completed offline journal window.
 * Pending work and conflicts are always retained, regardless of age, until the
 * authoritative sync path resolves them.
 */
export function retainOfflineJournalWindow(
  cache: JournalCache,
  today = localDayKey(),
): JournalCache {
  const retainedDays = new Set([today, previousLocalDay(today)]);
  const jobEntryIds = new Set(cache.jobs.map((job) => job.entryId));
  const entries = Object.fromEntries(
    Object.entries(cache.entries).filter(([, entry]) =>
      entryBelongsToWindow(entry, retainedDays) ||
      entryNeedsDurableRecovery(entry, jobEntryIds.has(entry.input.id)),
    ),
  );
  const receipts = Object.fromEntries(
    Object.entries(cache.receipts).filter(([, receipt]) =>
      receiptBelongsToWindow(receipt, retainedDays) ||
      receiptNeedsDurableRecovery(
        receipt,
        jobEntryIds.has(receipt.request.entry_id),
      ),
    ),
  );

  if (
    Object.keys(entries).length === Object.keys(cache.entries).length &&
    Object.keys(receipts).length === Object.keys(cache.receipts).length
  ) return cache;

  return { ...cache, entries, receipts };
}
