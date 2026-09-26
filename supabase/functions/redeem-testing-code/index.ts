import { grantRevenueCatEntitlement, refreshRevenueCatEntitlement } from "../_shared/revenuecat.ts";
import { ApiError } from "../_shared/validation.ts";
import { serve } from "../_shared/runtime.ts";
import { completeTestingAccessCode, reserveTestingAccessCode } from "../_shared/testing-access.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

serve(async (input, ctx) => {
  const reservation = await reserveTestingAccessCode(
    ctx.admin,
    ctx.userId,
    input.code,
  );
  if (reservation.result === "invalid") {
    throw new ApiError(400, "invalid_testing_code");
  }
  if (reservation.result === "full") {
    throw new ApiError(409, "testing_code_full");
  }
  if (reservation.result === "already_granted") {
    if (Date.parse(reservation.premiumExpiresAt) <= Date.now()) {
      throw new ApiError(409, "testing_code_already_redeemed");
    }
    const entitlement = await refreshRevenueCatEntitlement(
      ctx.userId,
      ctx.admin,
      "reconciliation",
    );
    if (!entitlement.active) {
      throw new ApiError(503, "subscription_grant_unavailable");
    }
    return { entitlement, redeemed: true };
  }

  const requestedExpiration = Date.now() + reservation.premiumDays * DAY_MS;
  await grantRevenueCatEntitlement(ctx.userId, requestedExpiration);
  const entitlement = await refreshRevenueCatEntitlement(
    ctx.userId,
    ctx.admin,
    "reconciliation",
  );
  if (!entitlement.active) {
    throw new ApiError(503, "subscription_grant_unavailable");
  }

  await completeTestingAccessCode(
    ctx.admin,
    ctx.userId,
    reservation.codeId,
    new Date(requestedExpiration).toISOString(),
  );
  return { entitlement, redeemed: true };
}, { requiresPremium: false });
