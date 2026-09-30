// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import test from "node:test";
import {
  billingDisclosure,
  checkoutCtaLabel,
  introductoryOfferConfirmation,
  planPageTitle,
  trialTimelineCopy,
} from "../../src/features/paywall/services/paywall-copy.ts";

function plan(trialEligibility: "eligible" | "ineligible" | "unknown" | "none") {
  return {
    fullPrice: "₹499",
    hasRequiredThreeDayTrial: trialEligibility !== "none",
    renewalPeriodLabel: "month",
    trialEligibility,
  };
}

test("unknown eligibility never promises a free trial", () => {
  const unknown = plan("unknown");

  assert.equal(checkoutCtaLabel(unknown), "Continue to subscription options");
  assert.equal(planPageTitle(unknown), "See your subscription options.");
  assert.deepEqual(trialTimelineCopy(unknown, "App Store"), {
    title: "See your subscription options",
    items: [
      { label: "Plans", body: "Choose your plan" },
      { label: "Pricing", body: "Review plans and pricing" },
      {
        label: "Offer",
        body: "Apple will confirm any available introductory offer before purchase.",
      },
    ],
  });
  assert.equal(
    introductoryOfferConfirmation("App Store"),
    "Apple will confirm any available introductory offer before purchase.",
  );
  assert.doesNotMatch(
    billingDisclosure(unknown),
    /get 3 days free|free trial/i,
  );
});

test("confirmed eligibility uses the correct checkout CTA", () => {
  assert.equal(
    checkoutCtaLabel(plan("eligible")),
    "Start your 3-day free trial",
  );
  assert.equal(
    checkoutCtaLabel(plan("ineligible")),
    "Subscribe for ₹499/month",
  );
  assert.equal(
    checkoutCtaLabel(plan("none")),
    "Subscribe for ₹499/month",
  );
});

test("trial timeline appears only after eligibility is confirmed", () => {
  const eligible = trialTimelineCopy(plan("eligible"), "App Store");
  assert.equal(eligible.title, "How your 3-day free trial works");
  assert.match(eligible.items[1].body, /allow notifications after checkout/i);
  assert.equal(
    trialTimelineCopy(plan("ineligible"), "App Store").title,
    "Start with Finnit Premium",
  );
});
