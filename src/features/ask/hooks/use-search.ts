import { useCallback, useEffect, useRef, useState } from "react";
import { BackendError } from "@/lib/ai/api";
import { getSupabase, isBackendConfigured } from "@/lib/supabase/client";
import type { SearchPlan } from "@/lib/supabase/database.types";
import { recentSearchContexts, searchJournal } from "../services/ask-service";
import type { ContextResult, SearchResult } from "../types/ask.types";

export function searchError(error: unknown) {
  if (error instanceof BackendError) {
    if (error.status === 401) return "Sign in to search your synced journal.";
    if (error.status === 429)
      return "Search is busy right now. Please try again shortly.";
  }
  return "Couldn’t reach your journal. Check your connection and try again.";
}
type SearchInput =
  | { query: string; range: { start_date: string; end_date: string } }
  | { filters: SearchPlan };
export function useSearch() {
  const [contexts, setContexts] = useState<ContextResult | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loadingContexts, setLoadingContexts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
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
        setResult(null);
        resultRef.current = null;
        setContexts(null);
        setLoading(false);
        setLoadingMore(false);
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
    void recentSearchContexts(controller.signal, userId)
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
    moreBusy.current = false;
  }, []);
  const run = useCallback(
    async (input: SearchInput) => {
      reset();
      lastInput.current = input;
      if (!isBackendConfigured()) {
        setError(
          "Your synced journal will be available once Finn is connected.",
        );
        return;
      }
      if (!userId) {
        setError("Sign in to search your synced journal.");
        return;
      }
      const controller = new AbortController();
      request.current = controller;
      const version = generation.current;
      setLoading(true);
      try {
        const data = await searchJournal(
          "filters" in input
            ? { filters: input.filters }
            : {
                query: input.query,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                selected_range: input.range,
              },
          controller.signal,
          userId,
        );
        if (version === generation.current && !controller.signal.aborted)
          setResult(data);
      } catch (err) {
        if (version === generation.current && !controller.signal.aborted)
          setError(searchError(err));
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
      !current?.next_cursor ||
      !current.applied_filters ||
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
      const page = await searchJournal(
        {
          filters: current.applied_filters,
          cursor: current.next_cursor,
          revision: current.revision,
        },
        controller.signal,
        userId,
      );
      if (version !== generation.current || controller.signal.aborted) return;
      if (page.stale) {
        setResult({ ...current, stale: true, has_more: false });
        return;
      }
      const ids = new Set(current.transactions?.map((t) => t.id));
      setResult({
        ...current,
        next_cursor: page.next_cursor,
        has_more: page.has_more,
        transactions: [
          ...(current.transactions ?? []),
          ...(page.transactions ?? []).filter((t) => !ids.has(t.id)),
        ],
      });
    } catch (err) {
      if (version === generation.current && !controller.signal.aborted)
        setPageError(searchError(err));
    } finally {
      if (version === generation.current) {
        setLoadingMore(false);
        moreBusy.current = false;
      }
    }
  }, [userId]);
  return {
    contexts,
    result,
    loadingContexts,
    loading,
    loadingMore,
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
