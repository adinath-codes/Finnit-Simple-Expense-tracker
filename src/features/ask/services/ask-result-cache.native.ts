import * as Crypto from "expo-crypto";
import { getOfflineDatabase } from "@/lib/offline/sqlite.native";

export async function askCacheKey(value: unknown) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    JSON.stringify(value),
  );
}

export async function readAskResultCache<T>(
  userId: string,
  key: string,
  revision: string,
): Promise<T | null> {
  const db = await getOfflineDatabase();
  const now = Date.now();
  await db.runAsync(
    "DELETE FROM ask_result_cache WHERE user_id=? AND expires_at<=?",
    userId, now,
  );
  const row = await db.getFirstAsync<{ payload: string }>(
    `SELECT payload FROM ask_result_cache
     WHERE user_id=? AND cache_key=? AND revision=? AND expires_at>?`,
    userId, key, revision, now,
  );
  if (!row) return null;
  await db.runAsync(
    `UPDATE ask_result_cache SET last_accessed_at=?
     WHERE user_id=? AND cache_key=?`,
    now, userId, key,
  );
  try {
    return JSON.parse(row.payload) as T;
  } catch {
    await db.runAsync(
      "DELETE FROM ask_result_cache WHERE user_id=? AND cache_key=?",
      userId, key,
    );
    return null;
  }
}

export async function writeAskResultCache<T>(
  userId: string,
  key: string,
  revision: string,
  value: T,
  ttlMs = 24 * 60 * 60 * 1000,
) {
  const db = await getOfflineDatabase();
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `INSERT INTO ask_result_cache(
        user_id,cache_key,revision,payload,created_at,expires_at,last_accessed_at
       ) VALUES(?,?,?,?,?,?,?)
       ON CONFLICT(user_id,cache_key) DO UPDATE SET
        revision=excluded.revision,payload=excluded.payload,
        created_at=excluded.created_at,expires_at=excluded.expires_at,
        last_accessed_at=excluded.last_accessed_at`,
      userId, key, revision, JSON.stringify(value), now, now + ttlMs, now,
    );
    await transaction.runAsync(
      `DELETE FROM ask_result_cache WHERE user_id=? AND cache_key IN (
        SELECT cache_key FROM ask_result_cache WHERE user_id=?
        ORDER BY last_accessed_at DESC LIMIT -1 OFFSET 50
      )`,
      userId, userId,
    );
  });
}

export async function clearAskResultCache(userId: string) {
  await (await getOfflineDatabase()).runAsync(
    "DELETE FROM ask_result_cache WHERE user_id=?", userId,
  );
}
