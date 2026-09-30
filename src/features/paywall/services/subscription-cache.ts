import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PurchasesEntitlementInfo } from "react-native-purchases";
import {
  type CachedSubscriptionEntitlement,
} from "./subscription-cache-policy";

const CACHE_VERSION = 1;

function storageKey(userId: string) {
  return `@finnit/subscription-entitlement/v${CACHE_VERSION}/${userId}`;
}

function isCachedEntitlement(value: unknown): value is PurchasesEntitlementInfo {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PurchasesEntitlementInfo>;
  return (
    typeof candidate.identifier === "string" &&
    typeof candidate.isActive === "boolean" &&
    typeof candidate.willRenew === "boolean" &&
    typeof candidate.periodType === "string" &&
    (candidate.expirationDate === null ||
      typeof candidate.expirationDate === "string") &&
    (candidate.expirationDateMillis === null ||
      (typeof candidate.expirationDateMillis === "number" &&
        Number.isFinite(candidate.expirationDateMillis)))
  );
}

function parseCache(raw: string | null): CachedSubscriptionEntitlement | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CachedSubscriptionEntitlement>;
    if (
      value.version !== CACHE_VERSION ||
      typeof value.cachedAt !== "number" ||
      !Number.isFinite(value.cachedAt) ||
      (value.entitlement !== null && !isCachedEntitlement(value.entitlement))
    ) {
      return null;
    }
    return value as CachedSubscriptionEntitlement;
  } catch {
    return null;
  }
}

export async function loadSubscriptionEntitlementCache(userId: string) {
  return parseCache(await AsyncStorage.getItem(storageKey(userId)));
}

export async function saveSubscriptionEntitlementCache(
  userId: string,
  entitlement: PurchasesEntitlementInfo | null,
) {
  const value: CachedSubscriptionEntitlement = {
    version: CACHE_VERSION,
    cachedAt: Date.now(),
    entitlement,
  };
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(value));
}
