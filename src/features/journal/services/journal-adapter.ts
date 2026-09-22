import type { JournalEntry, Category } from "../../../types/domain.ts";
import type {
  CachedEntry,
  CachedReceipt,
  JournalCache,
} from "../../../types/sync.ts";
import type { Extraction, Transaction } from "../../../lib/supabase/database.types.ts";

export function uiCategory(value: string): Category {
  return value === "food" || value === "transport" || value === "shopping"
    ? value
    : "other";
}

function syncMetadata(
  cache: JournalCache,
  entryId: string,
  fallback: "pending" | "synced" | "blocked" = "synced",
) {
  const job = cache.jobs.find((candidate) => candidate.entryId === entryId);
  return job
    ? {
        syncState: job.state === "blocked" ? "blocked" as const : "pending" as const,
        ...(job.error ? { syncError: job.error } : {}),
        ...(job.state === "blocked"
          ? {
              syncIssue:
                job.endpoint === "correct-entry" &&
                job.error === "revision_or_idempotency_conflict"
                  ? "conflict" as const
                  : "failed" as const,
            }
          : {}),
      }
    : {
        syncState: fallback,
        ...(fallback === "blocked" ? { syncIssue: "failed" as const } : {}),
      };
}

export function textJournalEntry(
  entry: CachedEntry,
  sync?: ReturnType<typeof syncMetadata>,
): JournalEntry {
  const transactions = entry.extraction.transactions;
  const first = transactions[0];
  return {
    id: entry.input.id,
    date: first?.occurred_on ?? entry.input.selected_date ?? entry.input.captured_at.slice(0, 10),
    note: entry.input.raw_text,
    merchant: "Your note",
    category: uiCategory(first?.category_id ?? "other"),
    status: transactions.some((transaction) => transaction.needs_review)
      ? "review"
      : "ready",
    time: new Date(entry.input.captured_at).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
    items: transactions.map((transaction, index) => ({
      id: transaction.id ?? `${entry.input.id}-${index}`,
      name: transaction.description,
      quantity: transaction.quantity ?? 1,
      amountMinor: Number(transaction.amount_minor ?? 0),
      unitPriceMinor: transaction.unit_price_minor === null
        ? null
        : Number(transaction.unit_price_minor),
      amountMissing: transaction.amount_minor === null,
      category: uiCategory(transaction.category_id),
      categoryId: transaction.category_id,
      confidence: transaction.confidence,
      needsReview: transaction.needs_review,
    })),
    thought: entry.sync === "synced"
      ? "Finn parsed this note and saved its financial details."
      : entry.sync === "blocked"
        ? "This note is saved on this device and needs your attention before it can sync."
        : "This note is saved on this device and will sync automatically.",
    sources: [
      { title: "Your original note", detail: entry.input.raw_text, icon: "note" },
      ...(entry.input.approximate_place
        ? [{
            title: "Approximate place",
            detail: entry.input.approximate_place,
            icon: "location" as const,
          }]
        : []),
    ],
    ...(sync ?? { syncState: entry.sync }),
  };
}

export function receiptJournalEntry(
  receipt: CachedReceipt,
  sync: ReturnType<typeof syncMetadata>,
): JournalEntry {
  const attachment = receipt.attachment;
  const merchant = attachment?.merchant_name ?? "Receipt";
  const transactions = receipt.remote?.extraction.transactions ?? [];
  const accountingTotal = transactions.reduce(
    (sum, transaction) =>
      transaction.needs_review || transaction.amount_minor === null
        ? sum
        : sum + Number(transaction.amount_minor),
    0,
  );
  return {
    id: receipt.request.entry_id,
    date: receipt.request.selected_date,
    note: merchant,
    merchant,
    category: uiCategory(receipt.lines[0]?.category_id ?? "other"),
    status: receipt.status === "complete" ? "ready" : "review",
    time: receipt.status === "complete" || receipt.status === "needs_review"
      ? `${receipt.lines.length} item${receipt.lines.length === 1 ? "" : "s"}`
      : "Just now",
    items: receipt.lines.map((line) => {
      return {
        id: line.id ?? `${receipt.request.entry_id}-${line.ordinal}`,
        name: line.description,
        quantity: line.quantity ?? 1,
        amountMinor: Number(line.amount_minor),
        unitPriceMinor: line.unit_price_minor === null
          ? null
          : Number(line.unit_price_minor),
        category: uiCategory(line.category_id),
        categoryId: line.category_id,
        kind: line.kind,
        confidence: line.confidence,
        needsReview: line.needs_review,
        provisional: line.provisional,
      };
    }),
    accountingTotalMinor: transactions.length ? accountingTotal : undefined,
    thought: {
      preparing: "Preparing a scan-quality copy of your receipt.",
      queued: "Saved offline. Finn will scan this receipt when a connection is available.",
      scanning: `Reading the receipt… ${receipt.lines.length} line${receipt.lines.length === 1 ? "" : "s"} found.`,
      needs_review: "Finn kept every visible line, but one or more details need review.",
      complete: "The printed lines reconcile with the receipt total.",
      failed: "The photo is still saved. Retry the scan or enter the details manually.",
    }[receipt.status],
    sources: [{
      title: "Receipt text",
      detail: attachment?.purchase_date_text
        ? `Printed date ${attachment.purchase_date_text}`
        : "Extracted by Finn · image not retained",
      icon: "note",
    }],
    receipt: {
      uri: receipt.localUri,
      width: receipt.width,
      height: receipt.height,
      status: receipt.status,
      error: receipt.error,
      itemCount: receipt.lines.length,
      printedTotalMinor: attachment?.printed_total_minor === null || !attachment
        ? null
        : Number(attachment.printed_total_minor),
      purchaseDateText: attachment?.purchase_date_text,
    },
    ...sync,
    ...(receipt.error && sync.syncState === "blocked"
      ? { syncError: receipt.error, syncIssue: "failed" as const }
      : {}),
  };
}

export function journalEntriesFromCache(cache: JournalCache) {
  return [
    ...Object.values(cache.entries)
      .filter((entry) =>
        !entry.deleted || cache.jobs.some(
          (job) => job.entryId === entry.input.id && job.state === "blocked",
        ),
      )
      .map((entry) => ({
        capturedAt: entry.input.captured_at,
        entry: textJournalEntry(entry, syncMetadata(cache, entry.input.id, entry.sync)),
      })),
    ...Object.values(cache.receipts)
      .filter((entry) =>
        !entry.deleted || cache.jobs.some(
          (job) => job.entryId === entry.request.entry_id && job.state === "blocked",
        ),
      )
      .map((entry) => ({
        capturedAt: entry.request.captured_at,
        entry: receiptJournalEntry(
          entry,
          syncMetadata(
            cache,
            entry.request.entry_id,
            entry.status === "failed"
              ? "blocked"
              : entry.remote
                ? "synced"
                : "pending",
          ),
        ),
      })),
  ].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    .map((value) => value.entry);
}

export function correctedTextExtraction(
  current: CachedEntry,
  edited: JournalEntry,
): Extraction {
  if (!current.extraction.transactions.length) {
    throw new Error("This note has no financial line to correct yet.");
  }
  const transactions: Transaction[] = edited.items.map((item, index) => {
    const original = current.extraction.transactions.find(
      (transaction) => transaction.id === item.id,
    ) ?? current.extraction.transactions[index];
    if (!original) throw new Error("This journal line no longer exists.");
    const amount = item.amountMissing
      ? null
      : String(Math.abs(item.amountMinor));
    const unitPrice = amount !== null && original.unit_price_minor !== null &&
        item.quantity > 1 &&
        Number(transactionUnitPrice(original) * item.quantity) === Math.abs(item.amountMinor)
      ? original.unit_price_minor
      : null;
    const uiOriginal = uiCategory(original.category_id);
    const categoryId = item.category === uiOriginal
      ? item.categoryId ?? original.category_id
      : item.category;
    return {
      ...original,
      description: item.name.trim(),
      amount_minor: amount,
      amount_status: amount === null ? "missing" : "confirmed",
      unit_price_minor: unitPrice,
      quantity: item.quantity,
      category_id: categoryId,
      category_source: "user_correction",
      needs_review: amount === null,
      unresolved: amount === null ? ["amount"] : [],
      evidence: null,
    };
  });
  return { ...current.extraction, transactions, unresolved: [] };
}

function transactionUnitPrice(transaction: Transaction) {
  return Number(transaction.unit_price_minor ?? 0);
}
