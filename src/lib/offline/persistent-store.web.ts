import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  emptyJournalCache,
  journalCacheKey,
  legacyJournalCacheKey,
  normalizeJournalCache,
  previousJournalCacheKey,
} from "./cache-schema";
import type { PersistentCacheStore } from "./persistent-store.types";

async function read(userId: string) {
  const current = await AsyncStorage.getItem(journalCacheKey(userId));
  if (current) return normalizeJournalCache(JSON.parse(current));
  const legacy = await AsyncStorage.getItem(previousJournalCacheKey(userId)) ??
    await AsyncStorage.getItem(legacyJournalCacheKey(userId));
  if (!legacy) return emptyJournalCache();
  const migrated = normalizeJournalCache(JSON.parse(legacy));
  await AsyncStorage.setItem(journalCacheKey(userId), JSON.stringify(migrated));
  await AsyncStorage.multiRemove([
    previousJournalCacheKey(userId), legacyJournalCacheKey(userId),
  ]);
  return migrated;
}

export const persistentCacheStore: PersistentCacheStore = {
  read,
  async write(userId, _previous, next, _targets) {
    await AsyncStorage.setItem(journalCacheKey(userId), JSON.stringify(next));
  },
  async delete(userId) {
    await AsyncStorage.multiRemove([
      journalCacheKey(userId), previousJournalCacheKey(userId),
      legacyJournalCacheKey(userId), `finn.ask-cache.v1.${userId}`,
    ]);
  },
};
