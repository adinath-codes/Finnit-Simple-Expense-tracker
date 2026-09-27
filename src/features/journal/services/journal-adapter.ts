import type { JournalEntry, Category } from "../../../types/domain.ts";
import type {
  CachedEntry,
  CachedReceipt,
  JournalCache,
} from "../../../types/sync.ts";
import type { Extraction, Transaction } from "../../../lib/supabase/database.types.ts";
import {
  deriveAllocationRows,
  deriveAmountBreakdown,
  deriveReceiptAmountBreakdown,
} from "../../entries/services/breakdown-service.ts";

type ReceiptSummaryLine = {
  kind?: string;
  description: string;
};

const textViews = new WeakMap<CachedEntry, Map<string, JournalEntry>>();
const receiptViews = new WeakMap<CachedReceipt, Map<string, JournalEntry>>();

function cachedView<T extends object>(
  owner: T,
  sync: ReturnType<typeof syncMetadata>,
  cache: WeakMap<T, Map<string, JournalEntry>>,
  build: () => JournalEntry,
) {
  const key = JSON.stringify(sync);
  const views = cache.get(owner) ?? new Map<string, JournalEntry>();
  cache.set(owner, views);
  const existing = views.get(key);
  if (existing) return existing;
  if (views.size >= 4) views.clear();
  const result = build();
  views.set(key, result);
  return result;
}

export function receiptJournalText(
  merchantName: string | null | undefined,
  lines: ReceiptSummaryLine[],
) {
  const merchant = merchantName?.trim();
  if (merchant) return `Purchase from ${merchant}`;

  const items = lines
    .filter((line) => line.kind === "item")
    .map((line) => line.description.trim())
    .filter(Boolean);
  if (!items.length) return "Scanned receipt";

  const visible = items.slice(0, 2).join(", ");
  const remaining = items.length - 2;
  return `Purchased ${visible}${remaining > 0 ? ` + ${remaining} more` : ""}`;
}

export function receiptDisplayTotal(
  entry: JournalEntry,
  fallbackCurrency: string,
) {
  if (
    !entry.receipt ||
    (entry.receipt.status !== "complete" && entry.receipt.status !== "needs_review")
  ) return null;

  return {
    amountMinor: entry.receipt.printedTotalMinor ??
      entry.items.reduce((sum, item) => sum + item.amountMinor, 0),
    currency: entry.items[0]?.currency ?? fallbackCurrency,
  };
}

export function uiCategory(value: string): Category {
  const root = value.split(".")[0];
  return root === "food" || root === "transport" || root === "shopping"
    ? root
    : "other";
}

function syncMetadata(
  cache: JournalCache,
  entryId: string,
  fallback: "pending" | "synced" | "blocked" = "synced",
) {
  const job = cache.jobs.find((candidate) => candidate.entryId === entryId);
  const pendingAction = job?.endpoint === "correct-entry" &&
      "action" in job.payload && job.payload.action === "ai_correct"
    ? "ai_correct" as const
    : undefined;
  return job
    ? {
        syncState: job.state === "blocked" ? "blocked" as const : "pending" as const,
        ...(job.error ? { syncError: job.error } : {}),
        ...(pendingAction ? { pendingAction } : {}),
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
  const components = entry.extraction.amount_components ?? [];
  const allocationRows = deriveAllocationRows(entry.extraction, entry.input.id);
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
    items: transactions.map((transaction, index) => {
      const userShare = transaction.user_share_minor === undefined
        ? transaction.amount_minor
        : transaction.user_share_minor;
      return {
        id: transaction.id ?? `${entry.input.id}-${index}`,
        name: transaction.description,
        quantity: transaction.quantity ?? 1,
        amountMinor: Number(transaction.amount_minor ?? 0),
        accountingAmountMinor: userShare === null ? null : Number(userShare),
        currency: transaction.currency,
        unitPriceMinor: transaction.unit_price_minor === null
          ? null
          : Number(transaction.unit_price_minor),
        amountMissing: transaction.amount_minor === null,
        category: uiCategory(transaction.category_id),
        categoryId: transaction.category_id,
        confidence: transaction.confidence,
        needsReview: transaction.needs_review,
        primaryAmountRole: transaction.primary_amount_role,
        groupTotalMinor: transaction.group_total_minor === null ||
            transaction.group_total_minor === undefined
          ? null
          : Number(transaction.group_total_minor),
        userShareMinor: transaction.user_share_minor === null ||
            transaction.user_share_minor === undefined
          ? null
          : Number(transaction.user_share_minor),
        paidByUserMinor: transaction.paid_by_user_minor === null ||
            transaction.paid_by_user_minor === undefined
          ? null
          : Number(transaction.paid_by_user_minor),
        splitMethod: transaction.split_method,
        participantCount: transaction.participant_count,
        quantityUnit: transaction.quantity_unit,
        components: components
          .filter((component) => component.transaction_ordinal === index)
          .sort((a, b) => a.ordinal - b.ordinal)
          .map((component) => ({
            id: `${entry.input.id}-${index}-${component.ordinal}`,
            label: component.label,
            quantity: component.quantity,
            unitPriceMinor: Number(component.unit_price_minor),
            lineTotalMinor: Number(component.line_total_minor),
            semanticRole: component.semantic_role,
            evidence: component.evidence.text,
            needsReview: component.needs_review,
          })),
        breakdownApproximate: transaction.breakdown_approximate === true,
        allocationRows: allocationRows.filter((row) =>
          row.transactionId === (transaction.id ?? `${entry.input.id}-${index}`)
        ),
      };
    }),
    ...(entry.amountPreview
      ? {
          amountPreview: {
            amountMinor: Number(entry.amountPreview.amount_minor),
            currency: entry.amountPreview.currency,
            scope: entry.amountPreview.scope,
            estimated: entry.amountPreview.estimated,
            needsReview: entry.amountPreview.needs_review,
          },
        }
      : {}),
    amountBreakdown: deriveAmountBreakdown(entry.extraction, entry.input.id),
    allocationRows,
    thought: entry.sync === "synced"
      ? entry.extraction.interpretation_summary ||
        "Here’s what I picked up from this spending entry."
      : entry.sync === "blocked"
        ? "I’ve saved this spending note here, but I need your help before I can sync it."
        : entry.amountPreview
          ? "I found the amount and I’m finishing the spending breakdown."
        : "I’ve saved this spending note here and I’ll sync it automatically.",
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
  const merchantName = attachment?.merchant_name?.trim() || null;
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
    note: receiptJournalText(merchantName, receipt.lines),
    merchant: merchantName ?? "",
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
        currency: line.currency,
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
    amountBreakdown: deriveReceiptAmountBreakdown(
      receipt.lines,
      receipt.request.entry_id,
    ),
    accountingTotalMinor: transactions.length ? accountingTotal : undefined,
    thought: {
      preparing: "I’m getting this receipt ready so I can break down the spending.",
      queued: "I saved this receipt here and I’ll break it down when you’re back online.",
      scanning: `I’m reading the receipt now—${receipt.lines.length} line${receipt.lines.length === 1 ? "" : "s"} found so far.`,
      needs_review: "I kept every visible item, but a few spending details need a quick look.",
      complete: "Everything on this receipt adds up to the recorded total.",
      failed: "I still have the photo. Retry the scan or enter the spending details manually.",
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
        entry: (() => {
          const sync = syncMetadata(cache, entry.input.id, entry.sync);
          return cachedView(entry, sync, textViews, () => textJournalEntry(entry, sync));
        })(),
      })),
    ...Object.values(cache.receipts)
      .filter((entry) =>
        !entry.deleted || cache.jobs.some(
          (job) => job.entryId === entry.request.entry_id && job.state === "blocked",
        ),
      )
      .map((entry) => ({
        capturedAt: entry.request.captured_at,
        entry: (() => {
          const sync = syncMetadata(
            cache,
            entry.request.entry_id,
            entry.status === "failed"
              ? "blocked"
              : entry.remote
                ? "synced"
                : "pending",
          );
          return cachedView(entry, sync, receiptViews, () =>
            receiptJournalEntry(entry, sync));
        })(),
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
    const categoryId = item.categoryId ?? (
      item.category === uiCategory(original.category_id)
        ? original.category_id
        : item.category
    );
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
      primary_amount_role: "personal_total",
      group_total_minor: amount,
      user_share_minor: amount,
      paid_by_user_minor: original.cash_flow === "out" ? amount : null,
      split_method: "not_applicable",
      participant_count: 1,
      allocation_status: "not_applicable",
    };
  });
  const retainedComponents = (current.extraction.amount_components ?? []).filter(
    (component) => {
      const transaction = transactions[component.transaction_ordinal];
      if (!transaction?.amount_minor) return false;
      const total = (current.extraction.amount_components ?? [])
        .filter((candidate) =>
          candidate.transaction_ordinal === component.transaction_ordinal
        )
        .reduce((sum, candidate) => sum + BigInt(candidate.line_total_minor), 0n);
      return total === BigInt(transaction.amount_minor);
    },
  );
  return {
    ...current.extraction,
    transactions,
    amount_components: retainedComponents,
    interpretation_summary:
      "Got it—I updated this spending and kept only the parts that still add up to your new total.",
    unresolved: [],
  };
}

function transactionUnitPrice(transaction: Transaction) {
  return Number(transaction.unit_price_minor ?? 0);
}
