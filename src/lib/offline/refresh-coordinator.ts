import { changeJournalCache, readJournalCache } from "./database";
import { recordCacheMetric } from "./cache-metrics";

export type RefreshResource = "journal" | "settings" | "presets" | "contexts";

const running = new Map<string, { promise: Promise<boolean>; forced: boolean }>();
const invalidationEpochs = new Map<string, number>();

export async function refreshWithPolicy(
  userId: string,
  resource: RefreshResource,
  maxAgeMs: number,
  operation: () => Promise<unknown>,
  force = false,
): Promise<boolean> {
  const key = `${userId}:${resource}`;
  const active = running.get(key);
  if (active) {
    // A write, reconnect or manual refresh cannot be swallowed by an older
    // freshness-window check that was already in flight.
    return force && !active.forced
      ? active.promise.then(() => refreshWithPolicy(userId, resource, maxAgeMs, operation, true))
      : active.promise;
  }
  const startedEpoch = invalidationEpochs.get(key) ?? 0;
  const request = (async () => {
    const startedAt = Date.now();
    const cache = await readJournalCache(userId);
    if (
      !force &&
      Date.now() - cache.metadata.validatedAt[resource] < maxAgeMs
    ) {
      recordCacheMetric(userId, "refresh", {
        hit: true, durationMs: Date.now() - startedAt,
      });
      return false;
    }
    await operation();
    if ((invalidationEpochs.get(key) ?? 0) === startedEpoch) {
      await changeJournalCache(userId, (current) => {
        current.metadata.validatedAt[resource] = Date.now();
      });
    }
    recordCacheMetric(userId, "refresh", {
      hit: false, durationMs: Date.now() - startedAt,
    });
    return true;
  })().finally(() => running.delete(key));
  running.set(key, { promise: request, forced: force });
  return request;
}

export function invalidateRefresh(userId: string, resource: RefreshResource) {
  const key = `${userId}:${resource}`;
  invalidationEpochs.set(key, (invalidationEpochs.get(key) ?? 0) + 1);
  return changeJournalCache(userId, (cache) => {
    cache.metadata.validatedAt[resource] = 0;
  });
}
