import { currentUserId, getSupabase } from "@/lib/supabase/client";

export type CacheMetricName =
  | "delta_sync"
  | "refresh"
  | "ask_result"
  | "ask_sql_plan"
  | "ask_explanation"
  | "catalog"
  | "summary"
  | "sqlite";
type LatencyBucket = "lt_25" | "lt_100" | "lt_500" | "lt_2000" | "gte_2000";
type Counter = {
  cache: CacheMetricName;
  latency_bucket: LatencyBucket;
  hits: number;
  misses: number;
  rows: number;
  bytes: number;
};

const buffers = new Map<string, Map<string, Counter>>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function latencyBucket(milliseconds: number): LatencyBucket {
  if (milliseconds < 25) return "lt_25";
  if (milliseconds < 100) return "lt_100";
  if (milliseconds < 500) return "lt_500";
  if (milliseconds < 2000) return "lt_2000";
  return "gte_2000";
}

/** Aggregate only bounded counters; financial contents never enter this buffer. */
export function recordCacheMetric(
  userId: string,
  cache: CacheMetricName,
  value: { hit: boolean; durationMs: number; rows?: number; bytes?: number },
) {
  const bucket = latencyBucket(Math.max(0, value.durationMs));
  const account = buffers.get(userId) ?? new Map<string, Counter>();
  buffers.set(userId, account);
  const key = `${cache}:${bucket}`;
  const counter = account.get(key) ?? {
    cache, latency_bucket: bucket, hits: 0, misses: 0, rows: 0, bytes: 0,
  };
  const countField = value.hit ? "hits" : "misses";
  counter[countField] = Math.min(100_000, counter[countField] + 1);
  counter.rows = Math.min(1_000_000, counter.rows + Math.max(0, value.rows ?? 0));
  counter.bytes = Math.min(1_000_000_000, counter.bytes + Math.max(0, value.bytes ?? 0));
  account.set(key, counter);
  if (account.size >= 10) void flushCacheMetrics(userId);
  else if (!timers.has(userId)) {
    timers.set(userId, setTimeout(() => {
      timers.delete(userId);
      void flushCacheMetrics(userId);
    }, 60_000));
  }
}

export async function flushCacheMetrics(userId: string) {
  const timer = timers.get(userId);
  if (timer) clearTimeout(timer);
  timers.delete(userId);
  const account = buffers.get(userId);
  if (!account?.size) return;
  const metrics = [...account.values()].slice(0, 20);
  for (const metric of metrics) account.delete(`${metric.cache}:${metric.latency_bucket}`);
  // Metrics contain no financial payloads, but still belong to the account
  // that produced them. Never submit an old buffer under a new session.
  try {
    if (await currentUserId() !== userId) return;
  } catch {
    return;
  }
  try {
    const { error } = await getSupabase().rpc("finn_record_cache_metrics", {
      p_metrics: metrics,
    });
    if (error) throw error;
  } catch {
    // Best effort only: merge the bounded counters back for a later flush.
    for (const metric of metrics) {
      const key = `${metric.cache}:${metric.latency_bucket}`;
      const current = account.get(key);
      if (!current) account.set(key, metric);
      else {
        current.hits = Math.min(100_000, current.hits + metric.hits);
        current.misses = Math.min(100_000, current.misses + metric.misses);
        current.rows = Math.min(1_000_000, current.rows + metric.rows);
        current.bytes = Math.min(1_000_000_000, current.bytes + metric.bytes);
      }
    }
  }
}
