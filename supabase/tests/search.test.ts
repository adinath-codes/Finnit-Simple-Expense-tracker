import assert from "node:assert/strict";
import test from "node:test";
import type { Catalog } from "../functions/_shared/contracts.ts";
import { parseSearch, validatePlan } from "../functions/_shared/search.ts";

const catalog: Catalog = {
  categories: [
    { id: "transport", name: "Transport", parent_id: null },
    { id: "transport.ride_hailing", name: "Ride hailing", parent_id: "transport" },
  ],
  merchants: [{
    id: "00000000-0000-4000-8000-000000000001",
    canonical_name: "Uber",
    default_category_id: "transport.ride_hailing",
    user_id: null,
  }],
  aliases: [{
    alias: "uber",
    merchant_id: "00000000-0000-4000-8000-000000000001",
    user_id: null,
  }],
  rules: [],
  people: [],
  contexts: [{ name: "Friends" }],
};

test("deterministic search distinguishes a group total from personal spend", () => {
  const parsed = parseSearch(
    "What was the group total on Uber with friends this month and show the split?",
    "2026-09-22",
    catalog,
  );
  assert.equal(parsed.plan.metric, "group_total");
  assert.equal(parsed.plan.merchant_id, catalog.merchants[0].id);
  assert.equal(parsed.plan.context, "Friends");
  assert.equal(parsed.plan.participant_scope, "with_others");
  assert.equal(parsed.plan.split_view, "self_vs_others");
  assert.equal(parsed.plan.text, null);
});

test("validated legacy filters default to user-share accounting", () => {
  const plan = validatePlan({
    operation: "sum",
    direction: "expense",
    start_date: "2026-09-01",
    end_date: "2026-10-01",
    merchant_id: null,
    category_id: null,
    person: null,
    context: null,
    text: null,
    currency: "INR",
  }, catalog);
  assert.equal(plan.metric, "user_share");
  assert.equal(plan.participant_scope, "any");
  assert.equal(plan.review_policy, "exclude_unconfirmed");
});

test("unsupported metrics are rejected before reaching SQL", () => {
  assert.throws(() => validatePlan({
    operation: "sum",
    direction: "expense",
    start_date: "2026-09-01",
    end_date: "2026-10-01",
    merchant_id: null,
    category_id: null,
    person: null,
    context: null,
    text: null,
    currency: null,
    metric: "made_up_total",
  }, catalog));
});
