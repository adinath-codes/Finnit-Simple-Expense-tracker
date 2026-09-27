import { useCallback, useEffect, useRef, useState } from "react";
import { BackendError } from "@/lib/ai/api";
import { getSupabase, isBackendConfigured } from "@/lib/supabase/client";
import type { SearchPlan } from "@/lib/supabase/database.types";
import { changeJournalCache, readJournalCache } from "@/lib/offline/database";
import { explainSearch, recentSearchContexts, searchJournal, sqlSourcePage } from "../services/ask-service";
import type { ContextResult, SearchResult } from "../types/ask.types";
import {
  askCacheKey,
  readAskResultCache,
  writeAskResultCache,
} from "../services/ask-result-cache";
import { currentJournalRevision } from "../services/journal-revision-service";
import { recordCacheMetric } from "@/lib/offline/cache-metrics";
import { canReuseAskResult, canStoreAskResult } from "../services/ask-cache-policy";
import { searchError } from "../services/ask-error";
import {
  ANALYTICS_EVENTS,
  captureAnalytics,
} from "@/lib/analytics/analytics";

function referenceDay(timezone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

type SearchInput =
  | { query: string; range: { start_date: string; end_date: string }; currency: string }
  | { filters: SearchPlan };
export function useSearch() {
  const [contexts, setContexts] = useState<ContextResult | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loadingContexts, setLoadingContexts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [retryContext, setRetryContext] = useState(0);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const resultRef = useRef(result);
  resultRef.current = result;
  const moreBusy = useRef(false);
  const lastInput = useRef<SearchInput | null>(null);
  const lastCacheKey = useRef<string | null>(null);
  const account = useRef<string | null>(null);

  useEffect(() => {
    if (!isBackendConfigured()) {
      setContextError(
        "Your synced journal will be available once Finn is connected.",
      );
      setLoadingContexts(false);
      return;
    }
    let alive = true;
    let db: ReturnType<typeof getSupabase>;
    try {
      db = getSupabase();
    } catch {
      setContextError("Finn’s journal connection needs to be configured.");
      setLoadingContexts(false);
      return;
    }
    let authEventReceived = false;
    const acceptSession = (id: string | null) => {
      if (!alive) return;
      if (account.current !== id) {
        request.current?.abort();
        generation.current += 1;
        account.current = id;
        lastInput.current = null;
        lastCacheKey.current = null;
        setResult(null);
        resultRef.current = null;
        setContexts(null);
        setLoading(false);
        setLoadingMore(false);
        setLoadingExplanation(false);
        moreBusy.current = false;
        setError(null);
        setPageError(null);
      }
      setUserId(id);
      if (!id) {
        setContextError("Sign in to search your synced journal.");
        setLoadingContexts(false);
      }
    };
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_event, session) => {
      authEventReceived = true;
      acceptSession(session?.user.id ?? null);
    });
    void db.auth
      .getSession()
      .then(({ data, error }) => {
        if (!alive || authEventReceived) return;
        if (error) throw error;
        acceptSession(data.session?.user.id ?? null);
      })
      .catch(() => {
        if (alive && !authEventReceived) {
          setContextError("Couldn’t open your journal. Try again.");
          setLoadingContexts(false);
        }
      });
    return () => {
      alive = false;
      subscription.unsubscribe();
      request.current?.abort();
      generation.current += 1;
    };
  }, [retryContext]);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    setLoadingContexts(true);
    setContextError(null);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    void (async () => {
      const startedAt = Date.now();
      const revision = await currentJournalRevision(userId);
      const key = await askCacheKey({
        kind: "context_cards", timezone, reference_day: referenceDay(timezone), version: 1,
      });
      let cached: ContextResult | null = null;
      try {
        cached = await readAskResultCache<ContextResult>(userId, key, revision);
      } catch { /* A cache failure must not hide fresh context cards. */ }
      if (cached) {
        void changeJournalCache(userId, (cache) => {
          cache.metadata.validatedAt.contexts = Date.now();
        }).catch(() => undefined);
        recordCacheMetric(userId, "ask_result", {
          hit: true, durationMs: Date.now() - startedAt,
          rows: cached.contexts.length, bytes: JSON.stringify(cached).length,
        });
        return cached;
      }
      const data = await recentSearchContexts(controller.signal, userId);
      try {
        await writeAskResultCache(userId, key, revision, data, 5 * 60_000);
      } catch { /* Fresh data remains authoritative. */ }
      void changeJournalCache(userId, (cache) => {
        cache.metadata.validatedAt.contexts = Date.now();
      }).catch(() => undefined);
      recordCacheMetric(userId, "ask_result", {
        hit: false, durationMs: Date.now() - startedAt,
        rows: data.contexts.length, bytes: JSON.stringify(data).length,
      });
      return data;
    })()
      .then((data) => {
        if (!controller.signal.aborted) setContexts(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setContextError(searchError(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingContexts(false);
      });
    return () => controller.abort();
  }, [userId, retryContext]);

  const reset = useCallback(() => {
    request.current?.abort();
    generation.current += 1;
    setResult(null);
    resultRef.current = null;
    setError(null);
    setPageError(null);
    setLoading(false);
    setLoadingMore(false);
    setLoadingExplanation(false);
    moreBusy.current = false;
    lastCacheKey.current = null;
  }, []);
  const run = useCallback(
    async (input: SearchInput) => {
      const analyticsStartedAt = Date.now();
      const inputMode = "filters" in input ? "explicit_filters" : "natural_language";
      captureAnalytics(ANALYTICS_EVENTS.askQuerySubmitted, {
        input_mode: inputMode,
      });
      // Keep an existing answer visible only when refreshing the same request.
      // A different question must never display the previous question's totals.
      const sameRequest = JSON.stringify(lastInput.current) === JSON.stringify(input);
      const sameFilters = "filters" in input &&
        JSON.stringify(resultRef.current?.applied_filters) === JSON.stringify(input.filters);
      const previous = sameRequest || sameFilters ? resultRef.current : null;
      reset();
      if (previous) {
        const retained = previous;
        setResult(retained);
        resultRef.current = retained;
      }
      lastInput.current = input;
      if (!isBackendConfigured()) {
        captureAnalytics(ANALYTICS_EVENTS.askQueryFailed, {
          input_mode: inputMode,
          failure_type: "backend_not_configured",
          duration_ms: Date.now() - analyticsStartedAt,
        });
        setError(
          "Your synced journal will be available once Finn is connected.",
        );
        return;
      }
      if (!userId) {
        captureAnalytics(ANALYTICS_EVENTS.askQueryFailed, {
          input_mode: inputMode,
          failure_type: "not_authenticated",
          duration_ms: Date.now() - analyticsStartedAt,
        });
        setError("Sign in to search your synced journal.");
        return;
      }
      const controller = new AbortController();
      request.current = controller;
      const version = generation.current;
      setLoading(true);
      try {
        const startedAt = Date.now();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const [serverRevision, localCache] = await Promise.all([
          currentJournalRevision(userId),
          readJournalCache(userId),
        ]);
        const cacheKey = await askCacheKey({
          input,
          timezone,
          reference_day: referenceDay(timezone),
          local_content_version: localCache.metadata.contentVersion,
          version: 4,
        });
        lastCacheKey.current = cacheKey;
        let cached: SearchResult | null = null;
        try {
          cached = await readAskResultCache<SearchResult>(
            userId,
            cacheKey,
            serverRevision,
          );
        } catch { /* Execute the authoritative request on cache failure. */ }
        if (canReuseAskResult(cached, serverRevision)) {
          recordCacheMetric(userId, "ask_result", {
            hit: true, durationMs: Date.now() - startedAt,
            rows: cached.transactions?.length ?? 0,
            bytes: JSON.stringify(cached).length,
          });
          if (version === generation.current && !controller.signal.aborted) {
            setResult(cached);
            resultRef.current = cached;
            captureAnalytics(ANALYTICS_EVENTS.askQueryCompleted, {
              input_mode: inputMode,
              cache_hit: true,
              interpretation: cached.interpretation ?? "unknown",
              advanced: !!cached.sql_session_id,
              matching_count: cached.matching_count ?? 0,
              result_count: cached.transactions?.length ?? 0,
              duration_ms: Date.now() - analyticsStartedAt,
            });
          }
          return;
        }
        let data = await searchJournal(
          "filters" in input
            ? { filters: input.filters }
            : {
                query: input.query,
                timezone,
                selected_range: input.range,
                default_currency: input.currency,
              },
          controller.signal,
          userId,
        );
        if (version === generation.current && !controller.signal.aborted) {
          recordCacheMetric(userId, "ask_result", {
            hit: false, durationMs: Date.now() - startedAt,
            rows: data.transactions?.length ?? 0,
            bytes: JSON.stringify(data).length,
          });
          setResult(data);
          resultRef.current = data;
          captureAnalytics(ANALYTICS_EVENTS.askQueryCompleted, {
            input_mode: inputMode,
            cache_hit: false,
            interpretation: data.interpretation ?? "unknown",
            advanced: !!data.sql_session_id,
            matching_count: data.matching_count ?? 0,
            result_count: data.transactions?.length ?? 0,
            needs_filters: !!data.needs_filters,
            duration_ms: Date.now() - analyticsStartedAt,
          });
          if (canStoreAskResult(data)) {
            void writeAskResultCache(
              userId,
              cacheKey,
              data.revision,
              data,
              data.sql_session_id ? 14 * 60 * 1000 : undefined,
            ).catch(() => undefined);
          }
          if (data.revision && (data.sql_session_id || data.applied_filters)) {
            setLoadingExplanation(true);
            void explainSearch(data.sql_session_id
              ? { session_id: data.sql_session_id, revision: data.revision }
              : { filters: data.applied_filters, revision: data.revision },
              controller.signal, userId)
              .then((answer) => {
                if (version !== generation.current || controller.signal.aborted) return;
                if (answer.stale) {
                  setResult((current) => current ? { ...current, stale: true, has_more: false } : current);
                } else if (answer.explanation) {
                  setResult((current) => {
                    if (!current) return current;
                    const next = { ...current, explanation: answer.explanation };
                    resultRef.current = next;
                    if (canStoreAskResult(next)) {
                      void writeAskResultCache(
                        userId,
                        cacheKey,
                        next.revision,
                        next,
                        next.sql_session_id ? 14 * 60 * 1000 : undefined,
                      ).catch(() => undefined);
                    }
                    return next;
                  });
                }
              })
              .catch(() => { /* The screen has a factual fixed-text fallback. */ })
              .finally(() => {
                if (version === generation.current && !controller.signal.aborted) setLoadingExplanation(false);
              });
          }
        }
      } catch (err) {
        if (version === generation.current && !controller.signal.aborted) {
          captureAnalytics(ANALYTICS_EVENTS.askQueryFailed, {
            input_mode: inputMode,
            failure_type:
              err instanceof BackendError ? `http_${err.status}` : "unexpected",
            duration_ms: Date.now() - analyticsStartedAt,
          });
          setError(searchError(err));
        }
      } finally {
        if (version === generation.current && !controller.signal.aborted)
          setLoading(false);
      }
    },
    [userId, reset],
  );

  const more = useCallback(async () => {
    const current = resultRef.current;
    if (
      moreBusy.current ||
      current?.stale ||
      loading ||
      !current?.next_cursor ||
      (!current.applied_filters && !current.sql_session_id) ||
      !current.revision ||
      !userId
    )
      return;
    const controller = new AbortController();
    request.current = controller;
    const version = generation.current;
    moreBusy.current = true;
    setLoadingMore(true);
    setPageError(null);
    try {
      const page = current.sql_session_id
        ? await sqlSourcePage(current.sql_session_id, current.revision, current.next_cursor, controller.signal, userId)
        : await searchJournal({ filters: current.applied_filters!, cursor: current.next_cursor, revision: current.revision }, controller.signal, userId);
      if (version !== generation.current || controller.signal.aborted) return;
      if (page.stale) {
        setResult({ ...current, stale: true, has_more: false });
        return;
      }
      const ids = new Set(current.transactions?.map((t) => t.id));
      const next = {
        ...current,
        next_cursor: page.next_cursor,
        has_more: page.has_more,
        transactions: [
          ...(current.transactions ?? []),
          ...(page.transactions ?? []).filter((t) => !ids.has(t.id)),
        ],
      };
      setResult(next);
      resultRef.current = next;
      if (lastCacheKey.current && canStoreAskResult(next)) {
        void writeAskResultCache(
          userId,
          lastCacheKey.current,
          current.revision,
          next,
          next.sql_session_id ? 14 * 60 * 1000 : undefined,
        ).catch(() => undefined);
      }
    } catch (err) {
      if (version === generation.current && !controller.signal.aborted)
        setPageError(searchError(err));
    } finally {
      if (version === generation.current) {
        setLoadingMore(false);
        moreBusy.current = false;
      }
    }
  }, [userId, loading]);
  return {
    contexts,
    result,
    loadingContexts,
    loading,
    loadingMore,
    loadingExplanation,
    error,
    contextError,
    pageError,
    run,
    retry: () => {
      if (lastInput.current) void run(lastInput.current);
    },
    more,
    reset,
    reloadContexts: () => setRetryContext((n) => n + 1),
  };
}
