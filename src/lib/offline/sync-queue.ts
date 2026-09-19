import { AppState } from "react-native";
import { BackendError, callBackend } from "@/lib/ai/api";
import {
  currentUserId,
  getSupabase,
  isBackendConfigured,
} from "@/lib/supabase/client";
import type { SavedEntry } from "@/lib/supabase/database.types";
import { changeJournalCache, readJournalCache } from "./database";

const running = new Map<string, Promise<void>>();
export function syncJournal(userId: string): Promise<void> {
  const active = running.get(userId);
  if (active) return active;
  const run = (async () => {
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
      try {
        const { entry } = await callBackend<{ entry: SavedEntry }>(
          job.endpoint,
          job.payload,
          userId,
        );
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
              local.input = { ...local.input, raw_text: entry.raw_text };
            }
          }
        });
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
        });
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
