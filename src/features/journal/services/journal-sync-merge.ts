import type { CaptureInput, ReceiptScanRequest, SavedEntry } from "../../../lib/supabase/database.types.ts";
import type { JournalCache } from "../../../types/sync.ts";
import { capture } from "../../../../supabase/functions/_shared/validation.ts";

function textInput(entry: SavedEntry): CaptureInput {
  const request = entry.capture_request;
  if (request && "raw_text" in request) {
    return capture({ ...request, raw_text: entry.raw_text });
  }
  return capture({
    id: entry.id,
    raw_text: entry.raw_text,
    captured_at: entry.captured_at,
    timezone: entry.timezone,
    currency: entry.currency,
    selected_date: entry.occurred_on,
  });
}

/** Apply a complete server document without replacing an optimistic local edit. */
export function mergeRemoteEntry(cache: JournalCache, entry: SavedEntry) {
  const pending = cache.jobs.some((job) => job.entryId === entry.id);
  if (entry.source_type === "receipt") {
    const current = cache.receipts[entry.id];
    if (pending && current) {
      current.remoteShadow = entry;
      return;
    }
    if ((current?.remote?.revision ?? 0) > entry.revision) return;
    const request = entry.capture_request as ReceiptScanRequest | undefined;
    if (!request || !("entry_id" in request) || !entry.receipt) {
      throw new Error("Incomplete receipt sync document.");
    }
    cache.receipts[entry.id] = {
      request,
      width: current?.width ?? 0,
      height: current?.height ?? 0,
      prepared: current?.prepared ?? true,
      ...(current?.localUri ? { localUri: current.localUri } : {}),
      status: entry.receipt.needs_review ? "needs_review" : "complete",
      lines: entry.receipt.lines,
      attachment: entry.receipt,
      remote: entry,
      deleted: !!entry.deleted_at,
    };
    return;
  }
  const current = cache.entries[entry.id];
  if (pending && current) {
    current.remoteShadow = entry;
    return;
  }
  if ((current?.remote?.revision ?? 0) > entry.revision) return;
  if (entry.raw_text === null) throw new Error("Incomplete text sync document.");
  cache.entries[entry.id] = {
    input: textInput(entry),
    extraction: entry.extraction,
    remote: entry,
    sync: "synced",
    deleted: !!entry.deleted_at,
  };
}
