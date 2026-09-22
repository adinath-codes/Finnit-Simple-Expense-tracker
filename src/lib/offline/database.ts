import AsyncStorage from "@react-native-async-storage/async-storage";
import type { JournalCache } from "@/types/sync";
import {
  emptyJournalCache,
  journalCacheKey,
  legacyJournalCacheKey,
  previousJournalCacheKey,
  normalizeJournalCache,
} from "./cache-schema";

// One document per account makes local entry + outbox changes a single durable
// write. Never acknowledge a note until setItem succeeds. This is not encryption.
const locks = new Map<string, Promise<unknown>>();
const listeners = new Set<{ userId?: string; listener: () => void }>();
async function read(userId: string): Promise<JournalCache> {
  const current = await AsyncStorage.getItem(journalCacheKey(userId));
  if (current) return normalizeJournalCache(JSON.parse(current));
  const previousKey = previousJournalCacheKey(userId);
  const legacyKey = legacyJournalCacheKey(userId);
  const legacy = await AsyncStorage.getItem(previousKey) ??
    await AsyncStorage.getItem(legacyKey);
  if (!legacy) return emptyJournalCache();
  const migrated = normalizeJournalCache(JSON.parse(legacy));
  await AsyncStorage.setItem(journalCacheKey(userId), JSON.stringify(migrated));
  await AsyncStorage.multiRemove([previousKey, legacyKey]);
  return migrated;
}
export async function readJournalCache(userId: string) {
  await locks.get(userId)?.catch(() => undefined);
  return read(userId);
}
export async function deleteJournalCache(userId: string) {
  await locks.get(userId)?.catch(() => undefined);
  await AsyncStorage.multiRemove([
    journalCacheKey(userId),
    previousJournalCacheKey(userId),
    legacyJournalCacheKey(userId),
  ]);
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
      const cache = await read(userId);
      const result = change(cache);
      await AsyncStorage.setItem(journalCacheKey(userId), JSON.stringify(cache));
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
export function subscribeJournalCache(listener: () => void, userId?: string) {
  const subscription = { userId, listener };
  listeners.add(subscription);
  return () => {
    listeners.delete(subscription);
  };
}
