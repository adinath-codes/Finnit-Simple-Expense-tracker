import { getSupabase } from "@/lib/supabase/client";
import { notifyAiQuotaReached } from "@/features/support/services/quota-events";
import {
  captureOperationalError,
  recordOperation,
} from "@/lib/observability/sentry";

export class BackendError extends Error {
  constructor(
    public code: string,
    public status: number,
    public retryable: boolean,
  ) {
    super(code);
  }
}
type BackendEndpoint =
  | "parse-entry"
  | "correct-entry"
  | "apply-preset"
  | "ask-money"
  | "ask-sql"
  | "refresh-entitlement"
  | "request-quota-review";

async function callBackendRequest<T>(
  endpoint: BackendEndpoint,
  payload: unknown,
  expectedUserId?: string,
  signal?: AbortSignal,
): Promise<T> {
  const db = getSupabase();
  let {
    data: { session },
    error,
  } = await db.auth.getSession();
  if (error) throw new BackendError("session_unavailable", 503, true);
  if (session && (session.expires_at ?? 0) * 1000 < Date.now() + 60000) {
    const refreshed = await db.auth.refreshSession();
    if (refreshed.error)
      throw new BackendError("session_refresh_failed", 401, true);
    session = refreshed.data.session;
  }
  if (!session || (expectedUserId && session.user.id !== expectedUserId))
    throw new BackendError("sign_in_required", 401, false);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel);
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(cancel, 45000);
  try {
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/${endpoint}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    );
    let body;
    try {
      body = await response.json();
    } catch {
      throw new BackendError("invalid_backend_response", response.status, true);
    }
    const code = body.error?.code;
    if (code === "ai_quota_exhausted" || body.warning === "ai_quota_exhausted")
      notifyAiQuotaReached();
    if (!response.ok)
      throw new BackendError(
        code ?? "backend_unavailable",
        response.status,
        body.error?.retryable ?? response.status >= 500,
      );
    return body as T;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}

export async function callBackend<T>(
  endpoint: BackendEndpoint,
  payload: unknown,
  expectedUserId?: string,
  signal?: AbortSignal,
): Promise<T> {
  const operation = `backend.${endpoint}`;
  recordOperation(operation, "started");
  try {
    const result = await callBackendRequest<T>(
      endpoint,
      payload,
      expectedUserId,
      signal,
    );
    recordOperation(operation, "succeeded");
    return result;
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    const retryable = error instanceof BackendError && error.retryable;
    recordOperation(operation, retryable || isAbort ? "deferred" : "failed", {
      status: error instanceof BackendError ? error.status : undefined,
      code: error instanceof BackendError ? error.code : undefined,
    });

    const reportableBackendError =
      error instanceof BackendError &&
      (error.status >= 500 ||
        error.code === "invalid_backend_response" ||
        error.code === "session_refresh_failed");
    const reportableUnexpectedError =
      error instanceof Error && error.name !== "AbortError" && error.name !== "TypeError";
    if (reportableBackendError || reportableUnexpectedError) {
      captureOperationalError(error, {
        operation,
        level: retryable ? "warning" : "error",
        tags: {
          surface: "backend",
          endpoint,
          status: error instanceof BackendError ? error.status : undefined,
          code: error instanceof BackendError ? error.code : undefined,
          retryable,
        },
      });
    }
    throw error;
  }
}
