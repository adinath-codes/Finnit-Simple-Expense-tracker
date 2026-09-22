import type { SearchResult } from "../types/ask.types.ts";

/** Persist only complete factual pages, never a clarification or stale response. */
export function canStoreAskResult(
  result: SearchResult,
): result is SearchResult & { revision: string } {
  return typeof result.revision === "string" && /^\d{1,19}$/.test(result.revision) &&
    !result.stale && !result.needs_filters &&
    (!!result.applied_filters || !!result.sql_session_id);
}

export function canReuseAskResult(
  result: SearchResult | null,
  revision: string,
): result is SearchResult & { revision: string } {
  return !!result && canStoreAskResult(result) && result.revision === revision;
}
