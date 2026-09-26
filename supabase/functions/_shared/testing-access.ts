import type { SupabaseClient } from "npm:@supabase/supabase-js@2.116.0";
import { ApiError, object } from "./validation.ts";
import { rpc } from "./runtime.ts";

type TestingAccessReservation =
  | { result: "invalid" | "full" }
  | {
    result: "reserved";
    codeId: string;
    premiumDays: number;
  }
  | {
    result: "already_granted";
    codeId: string;
    premiumDays: number;
    premiumExpiresAt: string;
  };

export function normalizeTestingAccessCode(value: unknown) {
  if (typeof value !== "string" || value.length > 80) {
    throw new ApiError(400, "invalid_testing_code");
  }
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "");
  if (!/^[A-Z0-9]{8,48}$/.test(normalized)) {
    throw new ApiError(400, "invalid_testing_code");
  }
  return normalized;
}

export async function testingAccessCodeHash(value: unknown) {
  const normalized = normalizeTestingAccessCode(value);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function parseTestingAccessReservation(
  value: unknown,
): TestingAccessReservation {
  const reservation = object(value);
  if (reservation.result === "invalid" || reservation.result === "full") {
    return { result: reservation.result };
  }
  if (
    reservation.result !== "reserved" &&
    reservation.result !== "already_granted"
  ) {
    throw new ApiError(503, "database_unavailable");
  }
  if (
    typeof reservation.code_id !== "string" ||
    !/^[a-z0-9][a-z0-9-]{2,63}$/.test(reservation.code_id) ||
    !Number.isInteger(reservation.premium_days) ||
    Number(reservation.premium_days) < 1 ||
    Number(reservation.premium_days) > 3650
  ) {
    throw new ApiError(503, "database_unavailable");
  }

  const shared = {
    codeId: reservation.code_id,
    premiumDays: Number(reservation.premium_days),
  };
  if (reservation.result === "reserved") {
    return { result: "reserved", ...shared };
  }
  if (
    typeof reservation.premium_expires_at !== "string" ||
    !Number.isFinite(Date.parse(reservation.premium_expires_at))
  ) {
    throw new ApiError(503, "database_unavailable");
  }
  return {
    result: "already_granted",
    ...shared,
    premiumExpiresAt: new Date(reservation.premium_expires_at).toISOString(),
  };
}

export async function reserveTestingAccessCode(
  admin: SupabaseClient,
  userId: string,
  code: unknown,
) {
  const value = await rpc<unknown>(admin, "finn_reserve_testing_access_code", {
    p_user: userId,
    p_code_hash: await testingAccessCodeHash(code),
  });
  return parseTestingAccessReservation(value);
}

export async function completeTestingAccessCode(
  admin: SupabaseClient,
  userId: string,
  codeId: string,
  premiumExpiresAt: string,
) {
  await rpc<void>(admin, "finn_complete_testing_access_code", {
    p_user: userId,
    p_code_id: codeId,
    p_premium_expires_at: premiumExpiresAt,
  });
}
