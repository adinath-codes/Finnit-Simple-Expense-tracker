type BackendFailure = {
  code?: unknown;
  status?: unknown;
  retryable?: unknown;
};

function backendFailure(error: unknown): BackendFailure | null {
  return typeof error === "object" && error !== null ? error as BackendFailure : null;
}

export function searchError(error: unknown) {
  const failure = backendFailure(error);
  if (failure?.code === "ai_consent_required") {
    return "Google Gemini is off. Allow AI data sharing in Settings to use this question.";
  }
  if (failure?.status === 401) return "Sign in to search your synced journal.";
  if (failure?.status === 429)
    return "Search is busy right now. Please try again shortly.";
  return "Couldn’t reach your journal. Check your connection and try again.";
}

export function isRetryableSearchError(error: unknown) {
  const failure = backendFailure(error);
  return failure?.retryable === true ||
    (typeof failure?.status === "number" && (failure.status === 429 || failure.status >= 500));
}
