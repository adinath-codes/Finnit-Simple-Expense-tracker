import type { PurchasesEntitlementInfo } from "react-native-purchases";

export const OFFLINE_RENEWAL_GRACE_MS = 3 * 24 * 60 * 60 * 1_000;

export type CachedSubscriptionEntitlement = {
  version: 1;
  cachedAt: number;
  entitlement: PurchasesEntitlementInfo | null;
};

/**
 * Mirror RevenueCat's bounded offline-entitlement behavior without requiring
 * the SDK/network before the local journal can open. A known cancellation is
 * never extended beyond its store expiration; an expected renewal gets the
 * same three-day offline grace window documented by RevenueCat.
 */
export function usableCachedEntitlement(
  cache: CachedSubscriptionEntitlement | null,
  now = Date.now(),
) {
  const entitlement = cache?.entitlement;
  if (!entitlement?.isActive) return null;
  if (entitlement.expirationDateMillis === null) return entitlement;
  if (entitlement.expirationDateMillis > now) return entitlement;
  if (
    entitlement.willRenew &&
    entitlement.expirationDateMillis + OFFLINE_RENEWAL_GRACE_MS > now
  ) {
    return entitlement;
  }
  return null;
}
