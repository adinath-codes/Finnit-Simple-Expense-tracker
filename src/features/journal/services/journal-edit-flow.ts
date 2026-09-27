import type { SavedEntry } from "@/lib/supabase/database.types";
import type { CachedEntry, DeleteInput, JournalCache } from "@/types/sync";

export type EntryTextSaveMode = "recalculate" | "preserve";
export type JournalEditChange = "unchanged" | "delete" | "changed";

export function classifyJournalEdit(
  originalNote: string,
  draft: string,
): JournalEditChange {
  const note = draft.trim();
  if (!note) return "delete";
  return note === originalNote.trim() ? "unchanged" : "changed";
}

export function planEntryTextSave(
  entry: CachedEntry,
  draft: string,
  mode: EntryTextSaveMode,
) {
  const input = { ...entry.input, raw_text: draft.trim() };
  return mode === "preserve"
    ? { input, extraction: entry.extraction }
    : { input, extraction: undefined };
}

function deleteJob(
  userId: string,
  entryId: string,
  revision: number,
  operationId: string,
) {
  const payload: DeleteInput = {
    action: "delete",
    operation_id: operationId,
    id: entryId,
    expected_revision: revision,
  };
  return {
    id: operationId,
    userId,
    entryId,
    endpoint: "correct-entry" as const,
    payload,
    state: "pending" as const,
    attempts: 0,
    nextAttemptAt: 0,
  };
}

/**
 * Apply a delete intent even while an entry is waiting to retry. Jobs that
 * have never reached the backend can be cancelled. A running or previously
 * attempted job is retained because its remote outcome may be unknown; the
 * entry is hidden immediately and deletion follows once that outcome lands.
 */
export function applyJournalEntryDeletion(
  cache: JournalCache,
  entryId: string,
  userId: string,
  operationId: string,
) {
  const entry = cache.entries[entryId];
  if (!entry) return;

  const uncertainJobs = cache.jobs.filter((job) =>
    job.entryId === entryId &&
    (job.state === "running" || (job.state === "pending" && job.attempts > 0)),
  );
  cache.jobs = cache.jobs.filter((job) =>
    job.entryId !== entryId || uncertainJobs.some((candidate) => candidate.id === job.id),
  );

  entry.deleted = true;
  entry.sync = "pending";
  delete entry.amountPreview;

  if (uncertainJobs.length) return;

  const remote = entry.remoteShadow ?? entry.remote;
  if (!remote || remote.deleted_at) {
    delete cache.entries[entryId];
    return;
  }
  entry.remote = remote;
  delete entry.remoteShadow;
  cache.jobs.push(deleteJob(userId, entryId, remote.revision, operationId));
}

/** Queue the requested delete after an in-flight create/edit reveals its revision. */
export function followDeletedEntryAfterSync(
  cache: JournalCache,
  entryId: string,
  userId: string,
  remote: SavedEntry,
  operationId: string,
) {
  const entry = cache.entries[entryId];
  if (!entry?.deleted || remote.deleted_at ||
      cache.jobs.some((job) => job.entryId === entryId)) return false;
  entry.remote = remote;
  entry.sync = "pending";
  cache.jobs.push(deleteJob(userId, entryId, remote.revision, operationId));
  return true;
}
