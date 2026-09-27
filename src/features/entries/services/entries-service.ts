/** Durable explicit correction (including transaction splits) and deletion. */
import { randomUUID } from "expo-crypto";
import { currentUserId } from "@/lib/supabase/client";
import { changeJournalCache } from "@/lib/offline/database";
import { syncJournal } from "@/lib/offline/sync-queue";
import type { CaptureInput, Extraction } from "@/lib/supabase/database.types";
import type {
  AIEntryCorrectionInput,
  CorrectionInput,
  ReparseInput,
} from "@/types/sync";
import { capture } from "../../../../supabase/functions/_shared/validation";
import { pendingExtraction } from "../../../../supabase/functions/_shared/pending-entry";
import { applyJournalEntryDeletion } from "@/features/journal/services/journal-edit-flow";

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

/** A text edit is a new interpretation, not a manual financial correction. */
export async function reparseJournalEntry(value: CaptureInput) {
  const input = capture(value);
  const userId = await currentUserId();
  await changeJournalCache(userId, (cache) => {
    const entry = cache.entries[input.id];
    if (!entry?.remote || cache.jobs.some((job) => job.entryId === input.id))
      throw new Error("Wait for this note to sync before saving another edit.");
    const operationId = randomUUID();
    const payload: ReparseInput = {
      action: "reparse",
      operation_id: operationId,
      expected_revision: entry.remote.revision,
      id: input.id,
      input,
    };
    entry.input = input;
    entry.extraction = pendingExtraction(input);
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
/** Queue a Gemini-authored structured revision without replacing the current
 * local breakdown while the request is offline or in flight. */
export async function correctJournalEntryWithFinn(id: string, value: string) {
  const instruction = value.trim();
  if (!instruction || instruction.length > 500) {
    throw new Error("Tell Finn what to change in 500 characters or fewer.");
  }
  const userId = await currentUserId();
  await changeJournalCache(userId, (cache) => {
    const entry = cache.entries[id];
    if (!entry?.remote) {
      throw new Error("Let this note finish its first sync before asking Finn to revise it.");
    }
    if (cache.jobs.some((job) => job.entryId === id)) {
      throw new Error("Wait for the current change to finish syncing.");
    }
    const operationId = randomUUID();
    const payload: AIEntryCorrectionInput = {
      action: "ai_correct",
      operation_id: operationId,
      id,
      expected_revision: entry.remote.revision,
      instruction,
    };
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
export async function deleteJournalEntry(id: string) {
  const userId = await currentUserId();
  await changeJournalCache(userId, (cache) => {
    applyJournalEntryDeletion(cache, id, userId, randomUUID());
  });
  void syncJournal(userId).catch(() => undefined);
}
