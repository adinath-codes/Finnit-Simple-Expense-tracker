// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import test from "node:test";
import {
  OFFLINE_RENEWAL_GRACE_MS,
  usableCachedEntitlement,
} from "../../src/features/paywall/services/subscription-cache-policy.ts";

const NOW = Date.parse("2026-09-29T12:00:00.000Z");

function cache(expirationDateMillis: number | null, willRenew = true) {
  return {
    version: 1,
    cachedAt: NOW - 60_000,
    entitlement: {
      identifier: "finn_it_pro",
      isActive: true,
      willRenew,
      expirationDateMillis,
      expirationDate: expirationDateMillis === null
        ? null
        : new Date(expirationDateMillis).toISOString(),
      periodType: "NORMAL",
    },
  };
}

test("an unexpired cached entitlement opens the offline journal", () => {
  assert.ok(usableCachedEntitlement(cache(NOW + 60_000), NOW));
});

test("a renewing entitlement receives only the bounded offline grace", () => {
  assert.ok(usableCachedEntitlement(cache(NOW - 60_000), NOW));
  assert.equal(
    usableCachedEntitlement(
      cache(NOW - OFFLINE_RENEWAL_GRACE_MS - 1),
      NOW,
    ),
    null,
  );
});

test("cancelled and inactive entitlements are not extended offline", () => {
  assert.equal(usableCachedEntitlement(cache(NOW - 1, false), NOW), null);
  assert.equal(
    usableCachedEntitlement({
      ...cache(NOW + 60_000),
      entitlement: { ...cache(NOW + 60_000).entitlement, isActive: false },
    }, NOW),
    null,
  );
});

test("lifetime access remains available offline", () => {
  assert.ok(usableCachedEntitlement(cache(null), NOW));
});
