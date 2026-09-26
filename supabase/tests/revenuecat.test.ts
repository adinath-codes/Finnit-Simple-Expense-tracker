import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.14";
import { revenueCatEntitlementSnapshot } from "../functions/_shared/revenuecat.ts";
import {
  normalizeTestingAccessCode,
  parseTestingAccessReservation,
  testingAccessCodeHash,
} from "../functions/_shared/testing-access.ts";

const ENTITLEMENT = "entl_finn";
const NOW = 1_790_000_000_000;

Deno.test("RevenueCat v2 active entitlement becomes an expiring snapshot", () => {
  const expires = NOW + 60_000;
  assertEquals(
    revenueCatEntitlementSnapshot(
      {
        object: "list",
        items: [{
          object: "customer.active_entitlement",
          entitlement_id: ENTITLEMENT,
          expires_at: expires,
        }],
      },
      ENTITLEMENT,
      NOW,
    ),
    {
      active: true,
      expiresAt: new Date(expires).toISOString(),
    },
  );
});

Deno.test("RevenueCat lifetime and absent entitlements are handled explicitly", () => {
  assertEquals(
    revenueCatEntitlementSnapshot(
      {
        items: [{ entitlement_id: ENTITLEMENT, expires_at: null }],
      },
      ENTITLEMENT,
      NOW,
    ),
    { active: true, expiresAt: null },
  );

  assertEquals(
    revenueCatEntitlementSnapshot(
      {
        items: [{ entitlement_id: "entl_other", expires_at: NOW + 60_000 }],
      },
      ENTITLEMENT,
      NOW,
    ),
    {
      active: false,
      expiresAt: new Date(0).toISOString(),
    },
  );
});

Deno.test("RevenueCat malformed and expired entitlement data never grants access", () => {
  assertEquals(
    revenueCatEntitlementSnapshot(
      {
        items: [{ entitlement_id: ENTITLEMENT, expires_at: NOW - 1 }],
      },
      ENTITLEMENT,
      NOW,
    ).active,
    false,
  );

  assertThrows(() => revenueCatEntitlementSnapshot({ items: null }, ENTITLEMENT, NOW));
  assertThrows(() =>
    revenueCatEntitlementSnapshot(
      {
        items: [{ entitlement_id: ENTITLEMENT, expires_at: "tomorrow" }],
      },
      ENTITLEMENT,
      NOW,
    )
  );
});

Deno.test("tester codes normalize formatting before hashing", async () => {
  assertEquals(
    normalizeTestingAccessCode("  finn-test-6d1773036ecd "),
    "FINNTEST6D1773036ECD",
  );
  assertEquals(
    await testingAccessCodeHash("finn test 6d1773036ecd"),
    "4f547e1d4c31d63082cb49a2eb584868398a9d9d84085214d192a4b45fb5fa6a",
  );
  assertThrows(() => normalizeTestingAccessCode("short"));
  assertThrows(() => normalizeTestingAccessCode("FINN_TEST_NOT_ALLOWED"));
});

Deno.test("tester-code reservation responses are parsed defensively", () => {
  assertEquals(parseTestingAccessReservation({ result: "invalid" }), {
    result: "invalid",
  });
  assertEquals(
    parseTestingAccessReservation({
      result: "reserved",
      code_id: "early-testers-2026",
      premium_days: 30,
    }),
    {
      result: "reserved",
      codeId: "early-testers-2026",
      premiumDays: 30,
    },
  );
  assertThrows(() =>
    parseTestingAccessReservation({
      result: "reserved",
      code_id: "EARLY TESTERS",
      premium_days: 30,
    })
  );
});
