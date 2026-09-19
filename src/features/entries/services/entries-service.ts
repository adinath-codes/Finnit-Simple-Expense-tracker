/** Durable explicit correction (including transaction splits) and deletion. */
import { randomUUID } from "expo-crypto";
import { currentUserId } from "@/lib/supabase/client";
import { changeJournalCache } from "@/lib/offline/database";
import { syncJournal } from "@/lib/offline/sync-queue";
import type { CaptureInput, Extraction } from "@/lib/supabase/database.types";
import type { CorrectionInput, DeleteInput } from "@/types/sync";

/** Explicit edits use an immutable request ID and a known remote revision. A
 * conflict is kept in the outbox for review, never silently force-overwritten. */
export async function correctJournalEntry(
  input: CaptureInput,
  extraction: Extraction,
  rememberRule?: CorrectionInput["remember_rule"],
) {
  const userId = await currentUserId();
  await changeJournalCache(userId, (cache) => {
    const entry = cache.entries[input.id];
    if (!entry?.remote || cache.jobs.some((j) => j.entryId === input.id))
      throw new Error(
        "Wait for this note to sync before saving another correction.",
      );
    const operationId = randomUUID();
    const payload: CorrectionInput = {
      action: "correct",
      operation_id: operationId,
      expected_revision: entry.remote.revision,
      input,
      extraction,
      remember_rule: rememberRule,
    };
    entry.input = input;
    entry.extraction = extraction;
    entry.sync = "pending";
    cache.jobs.push({
      id: operationId,
      userId,
      entryId: input.id,
      endpoint: "correct-entry",
      payload,
      state: "pending",
      attempts: 0,
      nextAttemptAt: 0,
    });
  });
  void syncJournal(userId).catch(() => undefined);
}
export async function deleteJournalEntry(id: string) {
  const userId = await currentUserId();
  await changeJournalCache(userId, (cache) => {
    const entry = cache.entries[id];
    if (!entry?.remote || cache.jobs.some((j) => j.entryId === id))
      throw new Error("Wait for this note to sync before deleting it.");
    const operationId = randomUUID();
    const payload: DeleteInput = {
      action: "delete",
      operation_id: operationId,
      id,
      expected_revision: entry.remote.revision,
    };
    entry.deleted = true;
    entry.sync = "pending";
    cache.jobs.push({
      id: operationId,
      userId,
      entryId: id,
      endpoint: "correct-entry",
      payload,
      state: "pending",
      attempts: 0,
      nextAttemptAt: 0,
    });
  });
  void syncJournal(userId).catch(() => undefined);
}
