import { randomUUID } from "expo-crypto";
import {
  currentUserId,
  getSupabase,
  isBackendConfigured,
} from "@/lib/supabase/client";
import {
  changeJournalCache,
  changeJournalCacheTargeted,
  readJournalCache,
  subscribeJournalCache,
} from "@/lib/offline/database";
import { syncJournal } from "@/lib/offline/sync-queue";
import type {
  CaptureInput,
  JournalSyncRpcPage,
  PresetCaptureInput,
  SavedEntry,
} from "@/lib/supabase/database.types";
import { capture } from "../../../../supabase/functions/_shared/validation";
import { pendingExtraction } from "../../../../supabase/functions/_shared/pending-entry";
import { presetExtraction } from "../../../../supabase/functions/_shared/preset";
import { refreshRemoteReceipts } from "@/features/camera/services/receipt-service";
import { recordCacheMetric } from "@/lib/offline/cache-metrics";
import { mergeRemoteEntry } from "./journal-sync-merge";
import { notifyFirstJournalEntryLogged } from "@/features/notifications/services/entry-events";

export function createCaptureInput(
  rawText: string,
  currency = "INR",
  selectedDate?: string,
  approximatePlace?: string | null,
): CaptureInput {
  return capture({
    id: randomUUID(),
    raw_text: rawText,
    captured_at: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    currency,
    selected_date: selectedDate,
    ...(approximatePlace ? { approximate_place: approximatePlace } : {}),
  });
}
/** Keep this input/id when retrying. Resolve ONLY after note and queue are durable. */
export async function captureJournalNote(value: CaptureInput) {
  const input = capture(value);
  const userId = await currentUserId();
  let firstJournalItem = false;
  const saved = await changeJournalCacheTargeted(userId, {
    entryIds: [input.id],
    jobs: true,
    affectsContent: true,
  }, (cache) => {
    const existing = cache.entries[input.id];
    if (existing) {
      if (JSON.stringify(existing.input) !== JSON.stringify(input))
        throw new Error("Capture ID already belongs to a different note.");
      return existing;
    }
    firstJournalItem =
      Object.values(cache.entries).every((entry) => entry.deleted) &&
      Object.values(cache.receipts).every((receipt) => receipt.deleted);
    const local = {
      input,
      extraction: pendingExtraction(input),
      sync: "pending" as const,
    };
    cache.entries[input.id] = local;
    cache.jobs.push({
      id: input.id,
      userId,
      entryId: input.id,
      endpoint: "parse-entry",
      payload: input,
      state: "pending",
      attempts: 0,
      nextAttemptAt: 0,
    });
    return local;
  });
  if (firstJournalItem) notifyFirstJournalEntryLogged(userId);
  void syncJournal(userId).catch(() => undefined);
  return saved;
}

/** Save a trusted preset snapshot and its deterministic structure before sync. */
export async function capturePresetJournalNote(value: PresetCaptureInput) {
  const input = capture(value.input);
  const userId = await currentUserId();
  let firstJournalItem = false;
  const saved = await changeJournalCacheTargeted(userId, {
    entryIds: [input.id],
    jobs: true,
    affectsContent: true,
  }, (cache) => {
    const existing = cache.entries[input.id];
    if (existing) return existing;
    firstJournalItem =
      Object.values(cache.entries).every((entry) => entry.deleted) &&
      Object.values(cache.receipts).every((receipt) => receipt.deleted);
    const local = {
      input,
      extraction: presetExtraction(value.preset, input),
      sync: "pending" as const,
    };
    cache.entries[input.id] = local;
    cache.jobs.push({
      id: input.id,
      userId,
      entryId: input.id,
      endpoint: "apply-preset",
      payload: value,
      state: "pending",
      attempts: 0,
      nextAttemptAt: 0,
    });
    return local;
  });
  if (firstJournalItem) notifyFirstJournalEntryLogged(userId);
  void syncJournal(userId).catch(() => undefined);
  return saved;
}
export async function listLocalJournal(userId?: string) {
  const cache = await readJournalCache(userId ?? await currentUserId());
  return Object.values(cache.entries)
    .filter((entry) => !entry.deleted)
    .sort((a, b) => b.input.captured_at.localeCompare(a.input.captured_at));
}
export async function listPendingJournalChanges() {
  return (await readJournalCache(await currentUserId())).jobs;
}

export function subscribePendingJournalChangeCount(
  listener: (count: number) => void,
) {
  if (!isBackendConfigured()) {
    listener(0);
    return () => undefined;
  }

  let active = true;
  const refresh = () => {
    void listPendingJournalChanges()
      .then((jobs) => {
        if (active) {
          listener(jobs.filter((job) => job.state !== "blocked").length);
        }
      })
      .catch(() => {
        if (active) listener(0);
      });
  };

  refresh();
  const unsubscribe = subscribeJournalCache(refresh);
  return () => {
    active = false;
    unsubscribe();
  };
}

/** One-release fallback for servers that do not yet expose delta sync. */
async function refreshJournalLegacy(userId: string) {
  const db = getSupabase();
  let after: string | undefined;
  while (true) {
    let query = db
      .from("journal_entries")
      .select(
        "id,raw_text,original_text,captured_at,occurred_on,timezone,currency,revision,extraction,deleted_at,capture_request",
      )
      .eq("user_id", userId)
      .order("id")
      .limit(200);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw error;
    if (await currentUserId() !== userId) throw new Error("Account changed during sync.");
    await changeJournalCache(userId, (cache) => {
      for (const row of data) {
        if (row.original_text === null) continue;
        if (cache.jobs.some((j) => j.entryId === row.id)) continue;
        const entry = row as unknown as SavedEntry;
        if ((cache.entries[row.id]?.remote?.revision ?? 0) > entry.revision)
          continue;
        const input = capture({
          ...row.capture_request,
          raw_text: entry.raw_text,
        });
        cache.entries[row.id] = {
          input,
          extraction: entry.extraction,
          remote: entry,
          sync: "synced",
          deleted: !!entry.deleted_at,
        };
      }
    });
    if (data.length < 200) break;
    after = data[data.length - 1].id;
  }
  return listLocalJournal(userId);
}

async function refreshJournalDelta(userId: string, resetAttempted = false) {
  const startedAt = Date.now();
  const db = getSupabase();
  const initial = await readJournalCache(userId);
  const afterRevision = initial.metadata.lastServerRevision;
  let snapshotRevision: string | undefined;
  let cursor: JournalSyncRpcPage["next_cursor"] = null;
  let changed = 0;
  let responseBytes = 0;
  while (true) {
    const { data, error } = await db.rpc("finn_sync_journal", {
      p_after_revision: afterRevision,
      p_snapshot_revision: snapshotRevision ?? null,
      p_cursor: cursor,
      p_limit: 200,
    });
    if (error) throw error;
    if (await currentUserId() !== userId) throw new Error("Account changed during sync.");
    const page = data as JournalSyncRpcPage;
    responseBytes += JSON.stringify(data).length;
    if (
      !page || !/^\d{1,19}$/.test(page.snapshot_revision) ||
      !Array.isArray(page.changes)
    ) throw new Error("Invalid journal sync response.");
    if (page.reset_required) {
      if (resetAttempted) throw new Error("Journal sync could not reset safely.");
      await changeJournalCache(userId, (cache) => {
        cache.metadata.lastServerRevision = null;
      });
      return refreshJournalDelta(userId, true);
    }
    snapshotRevision ??= page.snapshot_revision;
    if (page.snapshot_revision !== snapshotRevision)
      throw new Error("Journal sync snapshot changed during pagination.");
    changed += page.changes.length;
    await changeJournalCache(userId, (cache) => {
      for (const entry of page.changes) mergeRemoteEntry(cache, entry);
    });
    cursor = page.next_cursor;
    if (!cursor) break;
  }
  await changeJournalCache(userId, (cache) => {
    cache.metadata.lastServerRevision = snapshotRevision ?? afterRevision ?? "0";
  });
  recordCacheMetric(userId, "delta_sync", {
    hit: changed === 0,
    durationMs: Date.now() - startedAt,
    rows: changed,
    bytes: responseBytes,
  });
  return changed;
}

/** Fetch only changed entry documents, falling back to the legacy full reads. */
export async function refreshJournal(userId?: string) {
  const ownerId = userId ?? await currentUserId();
  if (await currentUserId() !== ownerId) throw new Error("Account changed during sync.");
  try {
    await refreshJournalDelta(ownerId);
  } catch {
    if (await currentUserId() !== ownerId) throw new Error("Account changed during sync.");
    await Promise.all([
      refreshJournalLegacy(ownerId),
      refreshRemoteReceipts(ownerId),
    ]);
  }
  return listLocalJournal(ownerId);
}

/**
 * Hydrate an older server-backed range into process memory on demand. Native
 * persistence still applies the two-day offline window, so archive browsing
 * never expands the durable device cache.
 */
export async function refreshJournalRange(
  startDate: string,
  endDate: string,
  userId?: string,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
    throw new Error("Invalid journal date range.");
  }
  const ownerId = userId ?? await currentUserId();
  if (await currentUserId() !== ownerId) throw new Error("Account changed during sync.");
  const { data, error } = await getSupabase()
    .from("journal_entries")
    .select(
      "id,source_type,raw_text,original_text,captured_at,occurred_on,timezone,currency,revision,extraction,deleted_at,capture_request",
    )
    .eq("user_id", ownerId)
    .eq("source_type", "text")
    .gte("occurred_on", startDate)
    .lte("occurred_on", endDate)
    .order("id")
    .limit(1000);
  if (error) throw error;
  if (await currentUserId() !== ownerId) throw new Error("Account changed during sync.");
  await changeJournalCache(ownerId, (cache) => {
    for (const row of data) mergeRemoteEntry(cache, row as unknown as SavedEntry);
  });
  await refreshRemoteReceipts(ownerId, { startDate, endDate });
  return listLocalJournal(ownerId);
}
