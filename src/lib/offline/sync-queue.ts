import { AppState } from "react-native";
import { File } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import { fetch as expoFetch } from "expo/fetch";
import { BackendError, callBackend } from "@/lib/ai/api";
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
  ReceiptScanEvent,
  ReceiptScanRequest,
  SavedEntry,
} from "@/lib/supabase/database.types";
import type { SyncJob } from "@/types/sync";
import type { Preferences, Preset } from "@/types/domain";
import { changeJournalCache, readJournalCache } from "./database";
import { invalidateRefresh } from "./refresh-coordinator";

const running = new Map<string, Promise<void>>();

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

async function scanReceipt(job: SyncJob, userId: string) {
  const request = job.payload as ReceiptScanRequest;
  const cache = await readJournalCache(userId);
  const receipt = cache.receipts[job.entryId];
  if (!receipt) return;
  if (!receipt.localUri) throw new BackendError("receipt_file_missing", 410, false);
  const file = new File(receipt.localUri);
  if (!file.exists) throw new BackendError("receipt_file_missing", 410, false);

  await changeJournalCache(userId, (state) => {
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
        await changeJournalCache(userId, (state) => {
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
        await changeJournalCache(userId, (state) => {
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
    await changeJournalCache(userId, (state) => {
      state.jobs = state.jobs.filter((candidate) => candidate.id !== job.id);
      const current = state.receipts[job.entryId];
      if (current) current.localUri = undefined;
    });
    if (file.exists) file.delete();
  } finally {
    clearTimeout(timeout);
  }
}

export function syncJournal(userId: string): Promise<void> {
  const active = running.get(userId);
  if (active) return active;
  const run = (async () => {
    // A process death can strand a durably marked running job. A new worker
    // owns no in-flight requests yet, so all such jobs are safe to requeue.
    await changeJournalCache(userId, (state) => {
      for (const job of state.jobs) {
        if (job.state === "running") job.state = "pending";
      }
    });
    while (true) {
      if ((await currentUserId()) !== userId) return;
      const cache = await readJournalCache(userId);
      // Preserve per-entry order: a failed create/correction blocks later writes
      // for that entry, while other notes can still synchronize.
      const job = cache.jobs.find(
        (candidate, index) =>
          candidate.state === "pending" &&
          candidate.nextAttemptAt <= Date.now() &&
          !cache.jobs
            .slice(0, index)
            .some((earlier) => earlier.entryId === candidate.entryId),
      );
      if (!job) return;
      await changeJournalCache(userId, (state) => {
        const queued = state.jobs.find((candidate) => candidate.id === job.id);
        if (queued) queued.state = "running";
      });
      try {
        if (job.endpoint === "scan-receipt") {
          await scanReceipt(job, userId);
          await changeJournalCache(userId, (state) => {
            state.jobs = state.jobs.filter((candidate) => candidate.id !== job.id);
          });
          await invalidateRefresh(userId, "journal");
          continue;
        }
        if (job.endpoint === "sync-settings") {
          await syncSettingsForAccount(
            userId,
            (job.payload as { settings: Preferences }).settings,
          );
          await changeJournalCache(userId, (state) => {
            state.jobs = state.jobs.filter((candidate) => candidate.id !== job.id);
          });
          await invalidateRefresh(userId, "settings");
          continue;
        }
        if (job.endpoint === "sync-preset") {
          await syncPresetForAccount(
            userId,
            (job.payload as { preset: Preset }).preset,
          );
          await changeJournalCache(userId, (state) => {
            state.jobs = state.jobs.filter((candidate) => candidate.id !== job.id);
          });
          await invalidateRefresh(userId, "presets");
          continue;
        }
        if (job.endpoint === "delete-preset") {
          await deletePresetForAccountRemote(
            userId,
            (job.payload as { presetId: string }).presetId,
          );
          await changeJournalCache(userId, (state) => {
            state.jobs = state.jobs.filter((candidate) => candidate.id !== job.id);
          });
          await invalidateRefresh(userId, "presets");
          continue;
        }
        const { entry } = await callBackend<{ entry: SavedEntry }>(
          job.endpoint,
          job.payload,
          userId,
        );
        let localReceiptImage: string | undefined;
        await changeJournalCache(userId, (state) => {
          state.jobs = state.jobs.filter((j) => j.id !== job.id);
          const local = state.entries[job.entryId];
          if (local) {
            local.remote = entry;
            // Do not replace a newer optimistic edit with an older response.
            if (!state.jobs.some((j) => j.entryId === job.entryId)) {
              local.extraction = entry.extraction;
              local.sync = "synced";
              local.deleted = !!entry.deleted_at;
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
      } catch (error) {
        const permanent = error instanceof BackendError && !error.retryable;
        await changeJournalCache(userId, (state) => {
          const queued = state.jobs.find((j) => j.id === job.id);
          if (!queued) return;
          queued.attempts += 1;
          queued.state = permanent ? "blocked" : "pending";
          queued.error =
            error instanceof BackendError
              ? error.code
              : "connection_unavailable";
          queued.nextAttemptAt =
            Date.now() +
            Math.min(300000, 1000 * 2 ** Math.min(queued.attempts, 8));
          if (state.entries[job.entryId])
            state.entries[job.entryId].sync = permanent ? "blocked" : "pending";
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
            receipt.status = permanent ? "failed" : "queued";
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
  running.set(userId, run);
  void run.finally(() => running.delete(userId)).catch(() => undefined);
  return run;
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
