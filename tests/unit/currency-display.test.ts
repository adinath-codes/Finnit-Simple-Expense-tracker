// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import test from "node:test";
import { money } from "../../src/utils/currency.ts";

test("display currency changes only the symbol", () => {
  assert.equal(money(1234, "USD", "INR"), "₹12.34");
  assert.equal(money(1234, "USD", "EUR"), "€12.34");
});

test("display currency does not rescale the stored amount", () => {
  assert.equal(money(1234, "JPY", "USD"), "$1,234");
  assert.equal(money(-1250, "USD", "EUR"), "-€12.5");
});
