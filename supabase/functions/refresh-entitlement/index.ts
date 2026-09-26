import { refreshRevenueCatEntitlement } from "../_shared/revenuecat.ts";
import { serve } from "../_shared/runtime.ts";

serve(async (_body, ctx) => ({
  entitlement: await refreshRevenueCatEntitlement(
    ctx.userId,
    ctx.admin,
    "reconciliation",
  ),
}), { requiresPremium: false });
