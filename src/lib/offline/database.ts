import AsyncStorage from "@react-native-async-storage/async-storage";
import type { JournalCache } from "@/types/sync";

// One document per account makes local entry + outbox changes a single durable
// write. Never acknowledge a note until setItem succeeds. This is not encryption.
const locks = new Map<string, Promise<unknown>>();
const listeners = new Set<() => void>();
const key = (userId: string) => `finn.journal.v1.${userId}`;
const empty = (): JournalCache => ({ version: 1, entries: {}, jobs: [] });
async function read(userId: string): Promise<JournalCache> {
  const raw = await AsyncStorage.getItem(key(userId));
  if (!raw) return empty();
  const cache = JSON.parse(raw) as JournalCache;
  if (cache.version !== 1 || !cache.entries || !Array.isArray(cache.jobs))
    throw new Error("Journal cache requires recovery.");
  return cache;
}
export async function readJournalCache(userId: string) {
  await locks.get(userId)?.catch(() => undefined);
  return read(userId);
}
export async function deleteJournalCache(userId: string) {
  await locks.get(userId)?.catch(() => undefined);
  await AsyncStorage.removeItem(key(userId));
  for (const listener of listeners) listener();
}
export function changeJournalCache<T>(
  userId: string,
  change: (cache: JournalCache) => T,
): Promise<T> {
  const pending = (locks.get(userId) ?? Promise.resolve())
    .catch(() => undefined)
    .then(async () => {
      const cache = await read(userId);
      const result = change(cache);
      await AsyncStorage.setItem(key(userId), JSON.stringify(cache));
      for (const listener of listeners) {
        try {
          listener();
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
export function subscribeJournalCache(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
