// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import test from "node:test";
import {
  CURRENCIES,
  CURRENCY_CATALOG,
  isSupportedCurrency,
  searchCurrencies,
} from "../../supabase/functions/_shared/currencies.ts";
import { moneyTokens } from "../../supabase/functions/_shared/money-evidence.ts";
import { receiptMoney } from "../../supabase/functions/_shared/receipt.ts";
import { onboardingSteps } from "../../src/features/onboarding/data/onboarding-steps.ts";
import { sanitizeOnboardingAnswers } from "../../src/features/onboarding/services/onboarding-validation.ts";
import { FINN_ONBOARDING_FLOW_VERSION } from "../../src/features/onboarding/types/onboarding.types.ts";

const excluded = [
  "BOV",
  "CHE",
  "CHW",
  "CLF",
  "COU",
  "MXV",
  "USN",
  "UYI",
  "UYW",
  "XAD",
  "XAG",
  "XAU",
  "XBA",
  "XBB",
  "XBC",
  "XBD",
  "XDR",
  "XPD",
  "XPT",
  "XSU",
  "XTS",
  "XUA",
  "XXX",
];

test("currency catalog is unique, valid, and excludes non-spendable units", () => {
  assert.ok(CURRENCY_CATALOG.length > 100);
  const codes = CURRENCY_CATALOG.map(({ code }) => code);
  assert.equal(new Set(codes).size, codes.length);
  for (const { code, minorDigits, entities } of CURRENCY_CATALOG) {
    assert.match(code, /^[A-Z]{3}$/);
    assert.ok(Number.isInteger(minorDigits) && minorDigits >= 0 && minorDigits <= 3);
    assert.ok(entities.length > 0);
    assert.equal(CURRENCIES[code], minorDigits);
    assert.equal(isSupportedCurrency(code), true);
  }
  for (const code of excluded) assert.equal(isSupportedCurrency(code), false);
});

test("currency search matches name, code, and country without case or accents", () => {
  for (const query of ["yen", "jpy", "Japan"]) {
    assert.ok(searchCurrencies(query).some(({ code }) => code === "JPY"));
  }
  assert.ok(searchCurrencies("cote").some(({ code }) => code === "XOF"));
  assert.deepEqual(searchCurrencies("not-a-real-currency"), []);
});

test("onboarding shows the four quick currencies followed by Other", () => {
  const currencyStep = onboardingSteps.find((step) => step.id === "currency");
  assert.ok(currencyStep?.kind === "question");
  assert.deepEqual(
    currencyStep.options.map(({ id }) => id),
    ["USD", "EUR", "CAD", "INR", "other"],
  );
  assert.equal(FINN_ONBOARDING_FLOW_VERSION, "2026-09-20.4");
});

test("onboarding accepts every catalog currency and rejects action or unknown ids", () => {
  for (const { code } of CURRENCY_CATALOG) {
    assert.equal(sanitizeOnboardingAnswers({ currency: code }).currency, code);
  }
  assert.equal(sanitizeOnboardingAnswers({ currency: "other" }).currency, undefined);
  assert.equal(sanitizeOnboardingAnswers({ currency: "ZZZ" }).currency, undefined);
});

test("new zero-, two-, and three-decimal currencies parse exactly", () => {
  assert.equal(moneyTokens("metro JPY 120", "USD")[0]?.minor, "120");
  assert.equal(moneyTokens("train NOK 12.34", "USD")[0]?.minor, "1234");
  assert.equal(moneyTokens("taxi TND 1.234", "USD")[0]?.minor, "1234");
  assert.equal(receiptMoney("TND 1.234", "TND"), "1234");
});
