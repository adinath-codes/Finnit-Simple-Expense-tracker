import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

export type AskCacheRecord<T> = {
  key: string;
  revision: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  lastAccessedAt: number;
};

const storageKey = (userId: string) => `finn.ask-cache.v1.${userId}`;

export async function askCacheKey(value: unknown) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    JSON.stringify(value),
  );
}

async function records<T>(userId: string): Promise<AskCacheRecord<T>[]> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function readAskResultCache<T>(
  userId: string,
  key: string,
  revision: string,
): Promise<T | null> {
  const now = Date.now();
  const all = await records<T>(userId);
  const found = all.find((item) =>
    item.key === key && item.revision === revision && item.expiresAt > now
  );
  if (!found) return null;
  found.lastAccessedAt = now;
  await AsyncStorage.setItem(
    storageKey(userId),
    JSON.stringify(all.filter((item) => item.expiresAt > now).slice(-50)),
  );
  return found.value;
}

export async function writeAskResultCache<T>(
  userId: string,
  key: string,
  revision: string,
  value: T,
  ttlMs = 24 * 60 * 60 * 1000,
) {
  const now = Date.now();
  const all = (await records<T>(userId)).filter((item) =>
    item.key !== key && item.expiresAt > now
  );
  all.push({
    key, revision, value, createdAt: now,
    expiresAt: now + ttlMs, lastAccessedAt: now,
  });
  all.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(all.slice(-50)));
}

export async function clearAskResultCache(userId: string) {
  await AsyncStorage.removeItem(storageKey(userId));
}
