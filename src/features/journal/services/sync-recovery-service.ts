import { randomUUID } from "expo-crypto";
import { retryReceipt, refreshRemoteReceipts } from "@/features/camera/services/receipt-service";
import { currentUserId, getSupabase } from "@/lib/supabase/client";
import { changeJournalCache, readJournalCache } from "@/lib/offline/database";
import { syncJournal } from "@/lib/offline/sync-queue";
import type {
  CorrectionInput,
  AIEntryCorrectionInput,
  DeleteInput,
  ReparseInput,
} from "@/types/sync";
import type { ReceiptCorrectionInput } from "@/lib/supabase/database.types";
import { refreshJournal } from "./journal-service";

const CONFLICT_CODE = "revision_or_idempotency_conflict";

type RevisionedPayload = CorrectionInput | AIEntryCorrectionInput | ReparseInput | DeleteInput | ReceiptCorrectionInput;

function isRevisionedPayload(value: unknown): value is RevisionedPayload {
  return !!value && typeof value === "object" &&
    "operation_id" in value && "expected_revision" in value;
}

export async function retryEntrySync(entryId: string) {
  const userId = await currentUserId();
  const before = await readJournalCache(userId);
  const failedReceipt = before.receipts[entryId]?.status === "failed" &&
    !before.jobs.some((job) => job.entryId === entryId);
  if (failedReceipt) return retryReceipt(entryId);

  let retried = false;
  await changeJournalCache(userId, (cache) => {
    for (const job of cache.jobs) {
      if (
        job.entryId !== entryId || job.state !== "blocked" ||
        (job.endpoint === "correct-entry" && job.error === CONFLICT_CODE)
      ) continue;
      retried = true;
      job.state = "pending";
      job.attempts = 0;
      job.nextAttemptAt = 0;
      job.error = undefined;
    }
    const entry = cache.entries[entryId];
    if (entry && retried) entry.sync = "pending";
    const receipt = cache.receipts[entryId];
    if (receipt && retried) {
      receipt.error = undefined;
      if (receipt.status === "failed") receipt.status = "queued";
    }
  });
  if (!retried) throw new Error("This sync issue needs a version choice.");
  return syncJournal(userId);
}

export async function keepLocalEntryVersion(entryId: string) {
  const userId = await currentUserId();
  const { data, error } = await getSupabase()
    .from("journal_entries")
    .select("revision,deleted_at")
    .eq("user_id", userId)
    .eq("id", entryId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.deleted_at) {
    throw new Error("This entry was removed elsewhere. Use the synced version to finish resolving it.");
  }

  await changeJournalCache(userId, (cache) => {
    const job = cache.jobs.find(
      (candidate) => candidate.entryId === entryId &&
        candidate.endpoint === "correct-entry" &&
        candidate.state === "blocked" &&
        candidate.error === CONFLICT_CODE,
    );
    if (!job || !isRevisionedPayload(job.payload)) {
      throw new Error("This entry no longer has a version conflict.");
    }
    const operationId = randomUUID();
    job.id = operationId;
    job.payload = {
      ...job.payload,
      operation_id: operationId,
      expected_revision: data.revision,
    };
    job.state = "pending";
    job.attempts = 0;
    job.nextAttemptAt = 0;
    job.error = undefined;

    const entry = cache.entries[entryId];
    if (entry) {
      entry.sync = "pending";
      if (entry.remote) entry.remote = { ...entry.remote, revision: data.revision };
    }
    const receipt = cache.receipts[entryId];
    if (receipt) {
      receipt.error = undefined;
      if (receipt.remote) receipt.remote = { ...receipt.remote, revision: data.revision };
    }
  });
  return syncJournal(userId);
}

export async function acceptRemoteEntryVersion(entryId: string) {
  const userId = await currentUserId();
  const cache = await readJournalCache(userId);
  const isReceipt = !!cache.receipts[entryId];
  const conflict = cache.jobs.find(
    (job) => job.entryId === entryId && job.endpoint === "correct-entry" &&
      job.state === "blocked" && job.error === CONFLICT_CODE,
  );
  if (!conflict) throw new Error("This entry no longer has a version conflict.");
  const wasEntryDeleted = cache.entries[entryId]?.deleted;
  const wasReceiptDeleted = cache.receipts[entryId]?.deleted;

  await changeJournalCache(userId, (state) => {
    state.jobs = state.jobs.filter((job) => !(job.entryId === entryId &&
      job.endpoint === "correct-entry" && job.state === "blocked" &&
      job.error === CONFLICT_CODE));
    const entry = state.entries[entryId];
    if (entry) entry.deleted = false;
    const receipt = state.receipts[entryId];
    if (receipt) receipt.deleted = false;
  });

  try {
    if (isReceipt) await refreshRemoteReceipts();
    else await refreshJournal();
  } catch (error) {
    // Do not lose the user's unresolved choice if the remote refresh itself
    // fails. Restoring the blocked job makes the resolution action available
    // again after connectivity recovers.
    await changeJournalCache(userId, (state) => {
      if (!state.jobs.some((job) => job.id === conflict.id)) {
        state.jobs.push(conflict);
      }
      const entry = state.entries[entryId];
      if (entry) entry.deleted = wasEntryDeleted;
      const receipt = state.receipts[entryId];
      if (receipt) receipt.deleted = wasReceiptDeleted;
    });
    throw error;
  }
}
