import { callBackend } from "@/lib/ai/api";
import type {
  ContextResult,
  SearchRequest,
  SearchResult,
} from "../types/ask.types";
export type { SearchResult } from "../types/ask.types";
export const SEARCH_PAGE_SIZE = 20;
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
