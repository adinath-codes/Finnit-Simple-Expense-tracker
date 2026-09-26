// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import test from "node:test";
import { LEGAL_WEBSITE_URLS } from "../../src/features/legal/legal-links.ts";

test("settings legal links use the canonical HTTPS website routes", () => {
  assert.deepEqual(LEGAL_WEBSITE_URLS, {
    privacyPolicy: "https://finnit.app/privacypolicy",
    termsOfService: "https://finnit.app/termsofservice",
    acknowledgement: "https://finnit.app/acknowledgement",
  });
  for (const url of Object.values(LEGAL_WEBSITE_URLS)) {
    assert.equal(new URL(url).protocol, "https:");
    assert.equal(new URL(url).hostname, "finnit.app");
  }
});
