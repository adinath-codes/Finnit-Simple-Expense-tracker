// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeAnalyticsProperties } from "../../src/lib/analytics/analytics-sanitization.ts";

test("analytics sanitizer removes financial and identity-bearing properties", () => {
  const result = sanitizeAnalyticsProperties({
    feature: "journal",
    raw_note: "Coffee with Alice for 500",
    amount_minor: 50000,
    receipt_image_uri: "file:///private/receipt.jpg",
    email: "person@example.com",
    route: "/entries/018f6e0d-8c3a-4a90-8cd4-a86dc34d3c18",
  });

  assert.deepEqual(result, {
    feature: "journal",
    route: "/entries/:id",
  });
});

test("analytics sanitizer drops URLs and arbitrary nested custom data", () => {
  const result = sanitizeAnalyticsProperties({
    current_url: "https://example.com/private?token=abc",
    safe_flag: true,
    nested: { private: "value" },
    $feature_flag_payloads: { safe: true },
  });

  assert.deepEqual(result, {
    safe_flag: true,
    $feature_flag_payloads: { safe: true },
  });
});
