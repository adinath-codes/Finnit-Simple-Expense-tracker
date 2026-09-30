// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_CONSENT_DATA_CATEGORIES,
  AI_CONSENT_POLICY_VERSION,
  AI_CONSENT_PROVIDER,
} from "../../supabase/functions/_shared/ai-consent-contract.ts";

test("AI consent contract names Gemini and every disclosed data class", () => {
  assert.equal(AI_CONSENT_PROVIDER, "Google Gemini");
  assert.match(AI_CONSENT_POLICY_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual([...AI_CONSENT_DATA_CATEGORIES], [
    "financial notes",
    "receipt images",
    "financial context",
  ]);
});
