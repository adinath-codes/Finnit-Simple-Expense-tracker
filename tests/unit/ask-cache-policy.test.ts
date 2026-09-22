// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import test from "node:test";
import {
  canReuseAskResult,
  canStoreAskResult,
} from "../../src/features/ask/services/ask-cache-policy.ts";

const result = {
  revision: "12",
  applied_filters: { operation: "sum" },
  totals: [{ currency: "INR", total_minor: "100", confirmed_count: 1, review_count: 0 }],
};

test("cached answers require the exact current journal revision", () => {
  assert.equal(canReuseAskResult(result, "12"), true);
  assert.equal(canReuseAskResult(result, "13"), false);
  assert.equal(canReuseAskResult({ ...result, stale: true }, "12"), false);
});

test("clarifications and incomplete pages are never persisted", () => {
  assert.equal(canStoreAskResult({ needs_filters: true, revision: "12" }), false);
  assert.equal(canStoreAskResult({ revision: "12", stale: true, applied_filters: {} }), false);
  assert.equal(canStoreAskResult({ revision: "12", totals: [] }), false);
  assert.equal(canStoreAskResult(result), true);
});
