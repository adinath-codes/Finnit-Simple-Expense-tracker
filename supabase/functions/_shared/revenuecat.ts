import type { SupabaseClient } from "npm:@supabase/supabase-js@2.116.0";
import { ApiError, object } from "./validation.ts";
import { env, rpc } from "./runtime.ts";

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RefreshSource = "reconciliation" | "webhook";

type EntitlementSnapshot = {
  active: boolean;
  expiresAt: string | null;
};

function revenueCatHeaders() {
  return {
    Authorization: `Bearer ${env("REVENUECAT_SECRET_API_KEY")}`,
    Accept: "application/json",
  };
}

function parsedV2Expiration(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return undefined;
  }
  return value;
}

/** Parse RevenueCat's v2 active-entitlements response without trusting its shape. */
export function revenueCatEntitlementSnapshot(
  payload: Record<string, unknown>,
  entitlementResourceId: string,
  now = Date.now(),
): EntitlementSnapshot {
  if (!Array.isArray(payload.items)) {
    throw new ApiError(503, "subscription_verification_unavailable");
  }
  const matching = payload.items
    .filter((candidate) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        throw new ApiError(503, "subscription_verification_unavailable");
      }
      return object(candidate).entitlement_id === entitlementResourceId;
    })
    .map((candidate) => {
      const expiration = parsedV2Expiration(object(candidate).expires_at);
      if (expiration === undefined) {
        throw new ApiError(503, "subscription_verification_unavailable");
      }
      return expiration;
    });
  if (!matching.length) {
    return { active: false, expiresAt: new Date(0).toISOString() };
  }
  if (matching.includes(null)) return { active: true, expiresAt: null };
  const expiration = Math.max(...(matching as number[]));
  return {
    active: expiration > now,
    expiresAt: new Date(expiration).toISOString(),
  };
}

export function revenueCatWebhookUserIds(event: Record<string, unknown>) {
  const candidates: unknown[] = [
    event.app_user_id,
    event.original_app_user_id,
    ...(Array.isArray(event.aliases) ? event.aliases : []),
    ...(Array.isArray(event.transferred_from) ? event.transferred_from : []),
    ...(Array.isArray(event.transferred_to) ? event.transferred_to : []),
  ];
  return [
    ...new Set(candidates.filter(
      (candidate): candidate is string => typeof candidate === "string" && USER_ID.test(candidate),
    )),
  ].slice(0, 10);
}

export async function refreshRevenueCatEntitlement(
  userId: string,
  admin: SupabaseClient,
  source: RefreshSource,
  eventId?: string,
) {
  if (!USER_ID.test(userId)) throw new ApiError(400, "invalid_user_id");
  const entitlementId = env("REVENUECAT_ENTITLEMENT_ID", "finn_it_pro");
  const entitlementResourceId = env("REVENUECAT_ENTITLEMENT_RESOURCE_ID");
  const projectId = env("REVENUECAT_PROJECT_ID");
  let response: Response;
  try {
    response = await fetch(
      `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}` +
        `/customers/${encodeURIComponent(userId)}/active_entitlements`,
      {
        headers: {
          ...revenueCatHeaders(),
        },
        signal: AbortSignal.timeout(5_000),
      },
    );
  } catch {
    throw new ApiError(503, "subscription_verification_unavailable");
  }

  let snapshot: EntitlementSnapshot = {
    active: false,
    expiresAt: new Date(0).toISOString(),
  };
  if (response.ok) {
    let payload: Record<string, unknown>;
    try {
      payload = object(await response.json());
    } catch {
      throw new ApiError(503, "subscription_verification_unavailable");
    }
    snapshot = revenueCatEntitlementSnapshot(payload, entitlementResourceId);
  } else if (response.status !== 404) {
    throw new ApiError(503, "subscription_verification_unavailable");
  }

  await rpc(admin, "finn_set_revenuecat_entitlement", {
    p_user: userId,
    p_entitlement_id: entitlementId,
    p_active: snapshot.active,
    p_expires_at: snapshot.expiresAt,
    p_source: source,
    p_event_id: eventId ?? null,
  });
  return { active: snapshot.active, expires_at: snapshot.expiresAt };
}

/** Grant time-bounded Premium through RevenueCat's server-only v2 API. */
export async function grantRevenueCatEntitlement(
  userId: string,
  expiresAt: number,
) {
  if (!USER_ID.test(userId) || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
    throw new ApiError(400, "invalid_testing_code_grant");
  }
  const projectId = env("REVENUECAT_PROJECT_ID");
  const entitlementResourceId = env("REVENUECAT_ENTITLEMENT_RESOURCE_ID");
  let response: Response;
  try {
    response = await fetch(
      `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}` +
        `/customers/${encodeURIComponent(userId)}/actions/grant_entitlement`,
      {
        method: "POST",
        headers: {
          ...revenueCatHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entitlement_id: entitlementResourceId,
          expires_at: expiresAt,
        }),
        signal: AbortSignal.timeout(5_000),
      },
    );
  } catch {
    throw new ApiError(503, "subscription_grant_unavailable");
  }

  // Concurrent retries can race after the first request has already created
  // the promotional subscription. Reconciliation below decides whether that
  // conflict represents active access instead of trusting the status alone.
  if (!response.ok && response.status !== 409) {
    throw new ApiError(503, "subscription_grant_unavailable");
  }
}
