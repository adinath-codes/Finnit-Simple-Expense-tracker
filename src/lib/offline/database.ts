import type { JournalCache } from "@/types/sync";
import { persistentCacheStore } from "./persistent-store";

// One document per account makes local entry + outbox changes a single durable
// write. Never acknowledge a note until setItem succeeds. This is not encryption.
const locks = new Map<string, Promise<unknown>>();
const listeners = new Set<{ userId?: string; listener: () => void }>();
const snapshots = new Map<string, JournalCache>();

async function read(userId: string): Promise<JournalCache> {
  const existing = snapshots.get(userId);
  if (existing) return existing;
  const loaded = await persistentCacheStore.read(userId);
  snapshots.set(userId, loaded);
  return loaded;
}
export async function readJournalCache(userId: string) {
  await locks.get(userId)?.catch(() => undefined);
  return read(userId);
}
export async function deleteJournalCache(userId: string) {
  await locks.get(userId)?.catch(() => undefined);
  await persistentCacheStore.delete(userId);
  snapshots.delete(userId);
  notify(userId);
}

function notify(userId: string) {
  for (const subscription of listeners) {
    if (subscription.userId && subscription.userId !== userId) continue;
    try {
      subscription.listener();
    } catch {
      /* Cache deletion is authoritative even if a subscriber fails. */
    }
  }
}
export function changeJournalCache<T>(
  userId: string,
  change: (cache: JournalCache) => T,
): Promise<T> {
  const pending = (locks.get(userId) ?? Promise.resolve())
    .catch(() => undefined)
    .then(async () => {
      const current = await read(userId);
      const cache = JSON.parse(JSON.stringify(current)) as JournalCache;
      const result = change(cache);
      cache.metadata.contentVersion = contentChanged(current, cache)
        ? current.metadata.contentVersion + 1
        : current.metadata.contentVersion;
      shareUnchanged(current, cache);
      await persistentCacheStore.write(userId, current, cache);
      snapshots.set(userId, cache);
      for (const subscription of listeners) {
        if (subscription.userId && subscription.userId !== userId) continue;
        try {
          subscription.listener();
        } catch {
          /* A subscriber cannot undo a durable save. */
        }
      }
      return result;
    });
  locks.set(userId, pending);
  void pending
    .finally(() => {
      if (locks.get(userId) === pending) locks.delete(userId);
    })
    .catch(() => undefined);
  return pending;
}

function contentChanged(before: JournalCache, after: JournalCache) {
  return JSON.stringify({
    entries: before.entries,
    receipts: before.receipts,
    settings: before.local.settings,
    presets: before.local.presets,
    goals: before.local.goals,
  }) !== JSON.stringify({
    entries: after.entries,
    receipts: after.receipts,
    settings: after.local.settings,
    presets: after.local.presets,
    goals: after.local.goals,
  });
}

function shareRecord<T>(before: Record<string, T>, after: Record<string, T>) {
  for (const [id, value] of Object.entries(after)) {
    if (before[id] && JSON.stringify(before[id]) === JSON.stringify(value)) {
      after[id] = before[id];
    }
  }
}

function shareArray<T extends { id: string }>(before: T[], after: T[]) {
  const previous = new Map(before.map((value) => [value.id, value]));
  return after.map((value) => {
    const candidate = previous.get(value.id);
    return candidate && JSON.stringify(candidate) === JSON.stringify(value)
      ? candidate
      : value;
  });
}

/** Preserve references for unchanged entities so React memoization stays useful. */
function shareUnchanged(before: JournalCache, after: JournalCache) {
  shareRecord(before.entries, after.entries);
  shareRecord(before.receipts, after.receipts);
  after.jobs = shareArray(before.jobs, after.jobs);
  after.local.presets = shareArray(before.local.presets, after.local.presets);
  after.local.goals = shareArray(before.local.goals, after.local.goals);
  if (JSON.stringify(before.local.settings) === JSON.stringify(after.local.settings)) {
    after.local.settings = before.local.settings;
  }
}
export function subscribeJournalCache(listener: () => void, userId?: string) {
  const subscription = { userId, listener };
  listeners.add(subscription);
  return () => {
    listeners.delete(subscription);
  };
}
