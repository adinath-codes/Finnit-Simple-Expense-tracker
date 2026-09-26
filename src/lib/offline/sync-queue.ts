import { AppState } from "react-native";
import { File } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import { fetch as expoFetch } from "expo/fetch";
import { BackendError, callBackend } from "@/lib/ai/api";
import {
  EntryEventDecoder,
  legacyEntryResponse,
} from "@/lib/ai/entry-stream";
import { notifyAiQuotaReached } from "@/features/support/services/quota-events";
import {
  deletePresetForAccountRemote,
  syncPresetForAccount,
} from "@/features/presets/services/presets-service";
import { syncSettingsForAccount } from "@/features/settings/services/settings-service";
import {
  currentUserId,
  getSupabase,
  isBackendConfigured,
} from "@/lib/supabase/client";
import type {
  EntryParseEvent,
  ReceiptScanEvent,
  ReceiptScanRequest,
  SavedEntry,
} from "@/lib/supabase/database.types";
import type { SyncJob } from "@/types/sync";
import type { Preferences, Preset } from "@/types/domain";
import {
  changeJournalCacheTargeted,
  readJournalCache,
} from "./database";
import { invalidateRefresh } from "./refresh-coordinator";
import {
  captureOperationalError,
  recordOperation,
} from "@/lib/observability/sentry";
import {
  ANALYTICS_EVENTS,
  captureAnalytics,
} from "@/lib/analytics/analytics";

type SyncLane = "text" | "receipt" | "account";
const SYNC_LANES: SyncLane[] = ["text", "receipt", "account"];
const running = new Map<string, Promise<void>>();
const preparing = new Map<string, Promise<void>>();
const CONFLICT_CODE = "revision_or_idempotency_conflict";

function laneKey(userId: string, lane: SyncLane) {
  return `${userId}:${lane}`;
}

function laneFor(job: SyncJob, cache: Awaited<ReturnType<typeof readJournalCache>>): SyncLane {
  if (
    job.endpoint === "sync-settings" ||
    job.endpoint === "sync-preset" ||
    job.endpoint === "delete-preset"
  ) return "account";
  if (job.endpoint === "scan-receipt" || cache.receipts[job.entryId]) {
    return "receipt";
  }
  return "text";
}

async function backendSession(userId: string) {
  const db = getSupabase();
  let { data: { session }, error } = await db.auth.getSession();
  if (error) throw new BackendError("session_unavailable", 503, true);
  if (session && (session.expires_at ?? 0) * 1000 < Date.now() + 60000) {
    const refreshed = await db.auth.refreshSession();
    if (refreshed.error)
      throw new BackendError("session_refresh_failed", 401, true);
    session = refreshed.data.session;
  }
  if (!session || session.user.id !== userId)
    throw new BackendError("sign_in_required", 401, false);
  return session;
}

async function parseTextEntry(job: SyncJob, userId: string): Promise<SavedEntry> {
  const session = await backendSession(userId);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  const startedAt = Date.now();
  try {
    const response = await expoFetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/parse-entry`,
      {
        method: "POST",
        headers: {
          Accept: "application/x-ndjson",
          "Content-Type": "application/json",
          apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(job.payload),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      let body: { error?: { code?: string; retryable?: boolean } } = {};
      try { body = await response.json(); } catch { /* invalid response */ }
      if (body.error?.code === "ai_quota_exhausted") notifyAiQuotaReached();
      throw new BackendError(
        body.error?.code ?? "entry_parse_failed",
        response.status,
        body.error?.retryable ?? response.status >= 500,
      );
    }

    // A new client may briefly talk to an older deployment.
    if (!response.headers.get("content-type")?.includes("application/x-ndjson")) {
      let legacy: unknown;
      try { legacy = await response.json(); }
      catch { throw new BackendError("invalid_backend_response", 502, true); }
      try {
        return legacyEntryResponse(legacy, job.entryId);
      } catch {
        throw new BackendError("invalid_backend_response", 502, true);
      }
    }

    const eventDecoder = new EntryEventDecoder();
    let finalEntry: SavedEntry | null = null;
    const processEvent = async (event: EntryParseEvent) => {
      if (event.type === "amount_preview") {
        if (
          event.entry_id !== job.entryId ||
          !/^\d{1,16}$/.test(event.preview.amount_minor) ||
          !["personal_total", "user_share", "group_total"].includes(event.preview.scope)
        ) throw new BackendError("invalid_entry_stream", 502, true);
        await changeJournalCacheTargeted(userId, {
          entryIds: [job.entryId],
        }, (state) => {
          const current = state.entries[job.entryId];
          if (!current || current.deleted) return;
          current.amountPreview = event.preview;
        });
        recordOperation("sync.parse-entry.preview", "succeeded", {
          duration_ms: Date.now() - startedAt,
        });
      } else if (event.type === "final") {
        if (event.entry.id !== job.entryId) {
          throw new BackendError("invalid_entry_stream", 502, true);
        }
        finalEntry = event.entry;
      } else {
        if (event.code === "ai_quota_exhausted") notifyAiQuotaReached();
        throw new BackendError(event.code, 422, event.retryable);
      }
    };
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        let events: EntryParseEvent[];
        try {
          events = eventDecoder.push(decoder.decode(value, { stream: !done }), done);
        } catch {
          throw new BackendError("invalid_entry_stream", 502, true);
        }
        for (const event of events) await processEvent(event);
        if (done) break;
      }
    } else {
      let events: EntryParseEvent[];
      try { events = eventDecoder.push(await response.text(), true); }
      catch { throw new BackendError("invalid_entry_stream", 502, true); }
      for (const event of events) await processEvent(event);
    }
    if (!finalEntry) throw new BackendError("incomplete_entry_stream", 502, true);
    return finalEntry;
  } finally {
    clearTimeout(timeout);
  }
}

async function scanReceipt(job: SyncJob, userId: string) {
  const request = job.payload as ReceiptScanRequest;
  const cache = await readJournalCache(userId);
  const receipt = cache.receipts[job.entryId];
  if (!receipt) return;
  if (!receipt.localUri) throw new BackendError("receipt_file_missing", 410, false);
  const file = new File(receipt.localUri);
  if (!file.exists) throw new BackendError("receipt_file_missing", 410, false);

  await changeJournalCacheTargeted(userId, {
    receiptIds: [job.entryId],
  }, (state) => {
    const current = state.receipts[job.entryId];
    if (current) current.status = "scanning";
  });
  const session = await backendSession(userId);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const form = new FormData();
    form.append("request", JSON.stringify(request));
    form.append("image", file);
    const response = await expoFetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/scan-receipt`,
      {
        method: "POST",
        headers: {
          Accept: "application/x-ndjson",
          apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: form,
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      let body: { error?: { code?: string; retryable?: boolean } } = {};
      try { body = await response.json(); } catch { /* invalid response */ }
      if (body.error?.code === "ai_quota_exhausted") notifyAiQuotaReached();
      throw new BackendError(
        body.error?.code ?? "receipt_scan_failed",
        response.status,
        body.error?.retryable ?? response.status >= 500,
      );
    }
    let buffer = "";
    let finalSeen = false;
    const processLine = async (line: string) => {
      if (!line.trim()) return;
      let event: ReceiptScanEvent;
      try { event = JSON.parse(line) as ReceiptScanEvent; }
      catch { throw new BackendError("invalid_receipt_stream", 502, true); }
      if (event.type === "item") {
        await changeJournalCacheTargeted(userId, {
          receiptIds: [job.entryId],
          affectsContent: true,
        }, (state) => {
          const current = state.receipts[job.entryId];
          if (!current || current.deleted) return;
          const next = current.lines.filter(
            (candidate) => candidate.ordinal !== event.line.ordinal,
          );
          next.push(event.line);
          current.lines = next.sort((a, b) => a.ordinal - b.ordinal);
        });
      } else if (event.type === "final") {
        finalSeen = true;
        await changeJournalCacheTargeted(userId, {
          receiptIds: [job.entryId],
          jobs: true,
          affectsContent: true,
        }, (state) => {
          const current = state.receipts[job.entryId];
          if (!current) return;
          current.lines = event.lines;
          current.attachment = { ...event.attachment, lines: event.lines };
          current.remote = event.entry;
          if (current.deleted) {
            const operationId = randomUUID();
            state.jobs.push({
              id: operationId,
              userId,
              entryId: job.entryId,
              endpoint: "correct-entry",
              payload: {
                action: "delete",
                operation_id: operationId,
                id: job.entryId,
                expected_revision: event.entry.revision,
              },
              state: "pending",
              attempts: 0,
              nextAttemptAt: 0,
            });
            return;
          }
          current.status = event.attachment.needs_review
            ? "needs_review"
            : "complete";
          current.error = undefined;
        });
      } else {
        if (event.code === "ai_quota_exhausted") notifyAiQuotaReached();
        throw new BackendError(event.code, 422, event.retryable);
      }
    };
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) await processLine(line);
        if (done) break;
      }
    } else buffer = await response.text();
    if (buffer.trim()) await processLine(buffer);
    if (!finalSeen)
      throw new BackendError("incomplete_receipt_stream", 502, true);
    await changeJournalCacheTargeted(userId, {
      receiptIds: [job.entryId],
      jobs: true,
    }, (state) => {
      state.jobs = state.jobs.filter((candidate) => candidate.id !== job.id);
      const current = state.receipts[job.entryId];
      if (current) current.localUri = undefined;
    });
    if (file.exists) file.delete();
  } finally {
    clearTimeout(timeout);
  }
}

async function prepareQueue(userId: string) {
  const active = preparing.get(userId);
  if (active) return active;
  if (SYNC_LANES.some((lane) => running.has(laneKey(userId, lane)))) return;
  const task = readJournalCache(userId).then((snapshot) => {
    const recoverable = snapshot.jobs.filter((job) => job.state === "running");
    if (!recoverable.length) return;
    const entryIds = [...new Set(recoverable.map((job) => job.entryId))];
    return changeJournalCacheTargeted(userId, {
      entryIds,
      receiptIds: entryIds,
      jobs: true,
    }, (state) => {
    // A process death can strand a durably marked running job. Explicitly
    // blocked failures stay blocked until the user retries them.
    for (const job of state.jobs) {
      if (job.state === "running") {
        job.state = "pending";
        if (state.entries[job.entryId]) state.entries[job.entryId].sync = "pending";
        const receipt = state.receipts[job.entryId];
        if (receipt?.status === "failed") receipt.status = "queued";
      }
    }
    });
  });
  preparing.set(userId, task);
  void task.finally(() => preparing.delete(userId)).catch(() => undefined);
  return task;
}

async function runLane(userId: string, lane: SyncLane) {
  const key = laneKey(userId, lane);
  const active = running.get(key);
  if (active) return active;
  const run = (async () => {
    while (true) {
      if ((await currentUserId()) !== userId) return;
      const cache = await readJournalCache(userId);
      // Per-entry ordering remains global even though independent resource
      // lanes now make progress concurrently.
      const job = cache.jobs.find(
        (candidate, index) =>
          laneFor(candidate, cache) === lane &&
          candidate.state === "pending" &&
          candidate.nextAttemptAt <= Date.now() &&
          !cache.jobs.slice(0, index).some(
            (earlier) => earlier.entryId === candidate.entryId,
          ),
      );
      if (!job) return;
      await changeJournalCacheTargeted(userId, { jobs: true }, (state) => {
        const queued = state.jobs.find((candidate) => candidate.id === job.id);
        if (queued) {
          queued.state = "running";
          delete queued.error;
        }
      });
      recordOperation("sync.job", "started", {
        endpoint: job.endpoint,
        lane,
        attempt: job.attempts + 1,
      });
      const syncStartedAt = Date.now();
      const recordSyncSuccess = () => {
        recordOperation("sync.job", "succeeded", { endpoint: job.endpoint, lane });
        captureAnalytics(ANALYTICS_EVENTS.syncJobCompleted, {
          endpoint: job.endpoint,
          attempt: job.attempts + 1,
          duration_ms: Date.now() - syncStartedAt,
        });
      };
      try {
        if (job.endpoint === "scan-receipt") {
          await scanReceipt(job, userId);
          await changeJournalCacheTargeted(userId, { jobs: true }, (state) => {
            state.jobs = state.jobs.filter((candidate) => candidate.id !== job.id);
          });
          await invalidateRefresh(userId, "journal");
          recordSyncSuccess();
          continue;
        }
        if (job.endpoint === "sync-settings") {
          await syncSettingsForAccount(
            userId,
            (job.payload as { settings: Preferences }).settings,
          );
          await changeJournalCacheTargeted(userId, { jobs: true }, (state) => {
            state.jobs = state.jobs.filter((candidate) => candidate.id !== job.id);
          });
          await invalidateRefresh(userId, "settings");
          recordSyncSuccess();
          continue;
        }
        if (job.endpoint === "sync-preset") {
          await syncPresetForAccount(
            userId,
            (job.payload as { preset: Preset }).preset,
          );
          await changeJournalCacheTargeted(userId, { jobs: true }, (state) => {
            state.jobs = state.jobs.filter((candidate) => candidate.id !== job.id);
          });
          await invalidateRefresh(userId, "presets");
          recordSyncSuccess();
          continue;
        }
        if (job.endpoint === "delete-preset") {
          await deletePresetForAccountRemote(
            userId,
            (job.payload as { presetId: string }).presetId,
          );
          await changeJournalCacheTargeted(userId, { jobs: true }, (state) => {
            state.jobs = state.jobs.filter((candidate) => candidate.id !== job.id);
          });
          await invalidateRefresh(userId, "presets");
          recordSyncSuccess();
          continue;
        }
        const entry = job.endpoint === "parse-entry"
          ? await parseTextEntry(job, userId)
          : (await callBackend<{ entry: SavedEntry }>(
              job.endpoint,
              job.payload,
              userId,
            )).entry;
        let localReceiptImage: string | undefined;
        await changeJournalCacheTargeted(userId, {
          entryIds: [job.entryId],
          receiptIds: [job.entryId],
          jobs: true,
          affectsContent: true,
        }, (state) => {
          state.jobs = state.jobs.filter((j) => j.id !== job.id);
          const local = state.entries[job.entryId];
          if (local) {
            local.remote = entry;
            // Do not replace a newer optimistic edit with an older response.
            if (!state.jobs.some((j) => j.entryId === job.entryId)) {
              local.extraction = entry.extraction;
              local.sync = "synced";
              local.deleted = !!entry.deleted_at;
              delete local.amountPreview;
              delete local.remoteShadow;
              local.input = {
                ...local.input,
                raw_text: entry.raw_text ?? local.input.raw_text,
              };
            }
          }
          const receipt = state.receipts[job.entryId];
          if (receipt) {
            receipt.remote = entry;
            if (!state.jobs.some((j) => j.entryId === job.entryId)) {
              delete receipt.remoteShadow;
            }
            if (entry.receipt) {
              localReceiptImage = receipt.localUri;
              receipt.localUri = undefined;
              receipt.attachment = entry.receipt;
              receipt.lines = entry.receipt.lines;
              receipt.status = entry.receipt.needs_review
                ? "needs_review"
                : "complete";
              receipt.error = undefined;
            }
          }
        });
        if (localReceiptImage) {
          const local = new File(localReceiptImage);
          if (local.exists) local.delete();
        }
        await invalidateRefresh(userId, "journal");
        recordSyncSuccess();
      } catch (error) {
        const permanent = error instanceof BackendError && !error.retryable;
        const conflict = error instanceof BackendError &&
          error.code === CONFLICT_CODE;
        recordOperation("sync.job", conflict || permanent ? "failed" : "deferred", {
          endpoint: job.endpoint,
          lane,
          attempt: job.attempts + 1,
          code: error instanceof BackendError ? error.code : "connection_unavailable",
        });
        captureAnalytics(
          conflict || permanent
            ? ANALYTICS_EVENTS.syncJobFailed
            : ANALYTICS_EVENTS.syncJobDeferred,
          {
            endpoint: job.endpoint,
            attempt: job.attempts + 1,
            failure_type:
              error instanceof BackendError ? error.code : "connection_unavailable",
            duration_ms: Date.now() - syncStartedAt,
          },
        );
        if (
          permanent &&
          (!(error instanceof BackendError) ||
            error.code !== "revision_or_idempotency_conflict")
        ) {
          captureOperationalError(error, {
            operation: "sync.job",
            tags: {
              surface: "background_sync",
              endpoint: job.endpoint,
              code: error instanceof BackendError ? error.code : "unknown",
              permanent,
            },
          });
        }
        await changeJournalCacheTargeted(userId, {
          entryIds: [job.entryId],
          receiptIds: [job.entryId],
          jobs: true,
        }, (state) => {
          const queued = state.jobs.find((j) => j.id === job.id);
          if (!queued) return;
          queued.attempts += 1;
          queued.state = conflict || permanent ? "blocked" : "pending";
          queued.error =
            error instanceof BackendError
              ? error.code
              : "connection_unavailable";
          queued.nextAttemptAt =
            permanent
              ? 0
              : Date.now() +
                Math.min(300000, 1000 * 2 ** Math.min(queued.attempts, 8));
          if (state.entries[job.entryId])
            state.entries[job.entryId].sync = conflict || permanent
              ? "blocked"
              : "pending";
          const receipt = state.receipts[job.entryId];
          if (receipt) {
            // A remote delete rejection still belongs to the user: keep its
            // correction job so the journal can offer retry/conflict recovery.
            // A deleted local-only scan can be cleaned up because no remote
            // entry ever existed to reconcile.
            if (receipt.deleted && permanent && job.endpoint !== "correct-entry") {
              state.jobs = state.jobs.filter((candidate) => candidate.id !== job.id);
              if (receipt.localUri) {
                const local = new File(receipt.localUri);
                if (local.exists) local.delete();
              }
              delete state.receipts[job.entryId];
              return;
            }
            receipt.status = conflict || permanent ? "failed" : "queued";
            receipt.error = queued.error;
          }
        });
        if (error instanceof BackendError &&
          error.code === "revision_or_idempotency_conflict") {
          await invalidateRefresh(userId, "journal");
        }
        if (!permanent) return;
      }
    }
  })();
  running.set(key, run);
  void run.finally(() => running.delete(key)).catch(() => undefined);
  return run;
}

/** Run independent text, receipt and account-metadata queues concurrently. */
export async function syncJournal(userId: string): Promise<void> {
  await prepareQueue(userId);
  await Promise.all(SYNC_LANES.map((lane) => runLane(userId, lane)));
}
/** Mount once with authenticated app providers; return value cleans up listeners. */
export function startJournalSync() {
  if (!isBackendConfigured()) return () => undefined;
  const db = getSupabase();
  const tick = () => {
    void currentUserId()
      .then(syncJournal)
      .catch(() => undefined);
  };
  const onState = (state: string) => {
    if (state === "active") {
      db.auth.startAutoRefresh();
      tick();
    } else db.auth.stopAutoRefresh();
  };
  const listener = AppState.addEventListener("change", onState);
  const {
    data: { subscription },
  } = db.auth.onAuthStateChange(() => {
    setTimeout(tick, 0);
  });
  const timer = setInterval(() => {
    if (AppState.currentState === "active") tick();
  }, 30000);
  onState(AppState.currentState);
  return () => {
    clearInterval(timer);
    listener.remove();
    subscription.unsubscribe();
    db.auth.stopAutoRefresh();
  };
}
