// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import test from "node:test";
import { FINN_WEBSITE_URLS } from "../../src/constants/website-links.ts";

test("settings links use the canonical Finn HTTPS website routes", () => {
  assert.deepEqual(FINN_WEBSITE_URLS, {
    termsOfService: "https://www.finn-it.app/terms",
    privacyPolicy: "https://www.finn-it.app/privacy/",
    aiPolicy: "https://www.finn-it.app/ai-policy/",
    privacyChoices: "https://www.finn-it.app/privacy-choices/",
    support: "https://www.finn-it.app/support/",
    deleteAccount: "https://www.finn-it.app/delete-account/",
    acknowledgement: "https://www.finn-it.app/acknowledgement/",
  });
  for (const url of Object.values(FINN_WEBSITE_URLS)) {
    assert.equal(new URL(url).protocol, "https:");
    assert.equal(new URL(url).hostname, "www.finn-it.app");
  }
});
