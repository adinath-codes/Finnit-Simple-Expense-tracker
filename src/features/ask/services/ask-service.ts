import { callBackend } from "@/lib/ai/api";
import type {
  ContextResult,
  SearchRequest,
  SearchResult,
} from "../types/ask.types";
export type { SearchResult } from "../types/ask.types";
export const SEARCH_PAGE_SIZE = 5;
/** Only an explicit submit interprets a query. More pages reuse validated filters. */
export function searchJournal(
  input: SearchRequest,
  signal?: AbortSignal,
  userId?: string,
) {
  return callBackend<SearchResult>(
    "ask-money",
    { ...input, limit: input.limit ?? SEARCH_PAGE_SIZE },
    userId,
    signal,
  );
}
export function recentSearchContexts(signal?: AbortSignal, userId?: string) {
  return callBackend<ContextResult>(
    "ask-money",
    {
      action: "contexts",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    userId,
    signal,
  );
}
export function searchWithSql(input: { query: string; timezone: string; selected_range: { start_date: string; end_date: string } }, signal?: AbortSignal, userId?: string) {
  return callBackend<SearchResult>("ask-sql", input, userId, signal);
}
export function sqlSourcePage(sessionId: string, revision: string, cursor: NonNullable<SearchResult["next_cursor"]>, signal?: AbortSignal, userId?: string) {
  return callBackend<SearchResult>("ask-sql", { action: "page", session_id: sessionId, revision, cursor }, userId, signal);
}
export function explainSearch(input: { filters: SearchResult["applied_filters"]; revision: string } | { session_id: string; revision: string }, signal?: AbortSignal, userId?: string) {
  return callBackend<{ explanation?: string; stale?: boolean }>("session_id" in input ? "ask-sql" : "ask-money", { action: "explain", ...input }, userId, signal);
}
