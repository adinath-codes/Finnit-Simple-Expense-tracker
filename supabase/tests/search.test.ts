import assert from "node:assert/strict";
import test from "node:test";
import type { Catalog } from "../functions/_shared/contracts.ts";
import { parseSearch, validatePlan } from "../functions/_shared/search.ts";

const catalog: Catalog = {
  categories: [
    { id: "food", name: "Food & Drinks", parent_id: null },
    { id: "food.dining", name: "Dining out", parent_id: "food" },
    { id: "food.groceries", name: "Groceries", parent_id: "food" },
    { id: "food.delivery", name: "Food delivery", parent_id: "food" },
    { id: "transport", name: "Transport", parent_id: null },
    {
      id: "transport.ride_hailing",
      name: "Ride hailing",
      parent_id: "transport",
    },
    {
      id: "transport.public",
      name: "Public transport",
      parent_id: "transport",
    },
    { id: "transport.fuel", name: "Fuel", parent_id: "transport" },
    { id: "shopping", name: "Shopping", parent_id: null },
    { id: "shopping.clothing", name: "Clothing", parent_id: "shopping" },
    { id: "shopping.electronics", name: "Electronics", parent_id: "shopping" },
    { id: "shopping.household", name: "Household", parent_id: "shopping" },
    { id: "bills", name: "Bills", parent_id: null },
    { id: "bills.utilities", name: "Utilities", parent_id: "bills" },
    { id: "bills.rent", name: "Rent", parent_id: "bills" },
    { id: "entertainment", name: "Entertainment", parent_id: null },
    { id: "health", name: "Health", parent_id: null },
    { id: "health.medicine", name: "Medicine", parent_id: "health" },
    { id: "health.care", name: "Healthcare", parent_id: "health" },
    { id: "education", name: "Education", parent_id: null },
    { id: "travel", name: "Travel", parent_id: null },
    { id: "travel.lodging", name: "Lodging", parent_id: "travel" },
    { id: "travel.transit", name: "Travel transport", parent_id: "travel" },
    { id: "software", name: "Software", parent_id: null },
    { id: "subscriptions", name: "Subscriptions", parent_id: null },
    { id: "work", name: "Work / Projects", parent_id: null },
    { id: "work.software", name: "Work software", parent_id: "work" },
    { id: "work.supplies", name: "Work supplies", parent_id: "work" },
    { id: "income", name: "Income", parent_id: null },
    { id: "transfer", name: "Transfer", parent_id: null },
    { id: "debt", name: "Debt / Repayment", parent_id: null },
    { id: "other", name: "Other", parent_id: null },
  ],
  merchants: [{
    id: "00000000-0000-4000-8000-000000000001",
    canonical_name: "Uber",
    default_category_id: "transport.ride_hailing",
    user_id: null,
  }, {
    id: "00000000-0000-4000-8000-000000000002",
    canonical_name: "Amazon",
    default_category_id: "shopping",
    user_id: null,
  }],
  aliases: [{
    alias: "uber",
    merchant_id: "00000000-0000-4000-8000-000000000001",
    user_id: null,
  }],
  rules: [],
  people: [{ name: "Chris" }, { name: "Maya" }],
  contexts: [{ name: "Friends" }, { name: "Work" }],
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
  assert.throws(() =>
    validatePlan({
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
    }, catalog)
  );
});

test("obvious analytical questions produce deterministic operations without residual text", () => {
  const cases = [
    ["Spending this month", "sum", undefined],
    ["Show purchases this month", "list", undefined],
    ["Most expensive purchase", "rank", "entry"],
    ["Single most expensive purchase", "rank", "entry"],
    ["Highest spending category", "rank", "category"],
    ["How many purchases this month?", "count", undefined],
    ["Most expensive week", "rank", "week"],
    ["Average purchase", "average", undefined],
    ["Where did I spend most?", "rank", "category"],
    ["Breakdown by merchant", "breakdown", "merchant"],
  ] as const;
  for (const [query, operation, grouping] of cases) {
    const parsed = parseSearch(query, "2026-09-22", catalog);
    assert.equal(parsed.plan.operation, operation, query);
    assert.equal(parsed.plan.text, null, query);
    if (grouping) assert.deepEqual(parsed.plan.group_by, [grouping], query);
    assert.equal(parsed.complex, false, query);
  }
});

test("comparison preserves the selected primary period and uses last month as baseline", () => {
  const parsed = parseSearch(
    "Compare spending to last month",
    "2026-09-22",
    catalog,
    {
      start_date: "2026-09-01",
      end_date: "2026-10-01",
    },
  );
  assert.equal(parsed.plan.operation, "compare");
  assert.equal(parsed.plan.start_date, "2026-09-01");
  assert.equal(parsed.plan.end_date, "2026-10-01");
  assert.equal(parsed.plan.comparison_start_date, "2026-08-01");
  assert.equal(parsed.plan.comparison_end_date, "2026-09-01");
  assert.equal(parsed.plan.text, null);
});

test("debt questions select allocation metrics without an expense direction", () => {
  const owed = parseSearch("Who owes me?", "2026-09-22", catalog);
  assert.equal(owed.plan.operation, "breakdown");
  assert.equal(owed.plan.metric, "owed_to_user");
  assert.equal(owed.plan.direction, null);
  assert.deepEqual(owed.plan.group_by, ["participant"]);
  assert.equal(owed.complex, false);
});

test("all stored category labels resolve to their exact IDs without broadening children to parents", () => {
  for (const category of catalog.categories) {
    const parsed = parseSearch(
      `${category.name} spending`,
      "2026-09-22",
      catalog,
    );
    assert.equal(parsed.plan.category_id, category.id, category.name);
    assert.deepEqual(parsed.plan.category_ids, [category.id], category.name);
    assert.equal(parsed.plan.text, null, category.name);
  }
});

test("explicit periods override the visible range while an unspecified period keeps it", () => {
  const visible = { start_date: "2026-01-01", end_date: "2026-02-01" };
  const explicit = parseSearch(
    "Spending this month",
    "2026-09-22",
    catalog,
    visible,
  );
  assert.equal(explicit.plan.start_date, "2026-09-01");
  assert.equal(explicit.plan.end_date, "2026-10-01");
  assert.equal(explicit.periodRecognized, true);
  const inherited = parseSearch(
    "Food spending",
    "2026-09-22",
    catalog,
    visible,
  );
  assert.equal(inherited.plan.start_date, visible.start_date);
  assert.equal(inherited.plan.end_date, visible.end_date);
});

test("every financial metric and grouping is accepted by the validator", () => {
  const metrics = [
    "stated_amount",
    "user_share",
    "group_total",
    "paid_by_user",
    "owed_to_user",
    "user_owes",
    "reimbursed",
    "gross_spend",
  ];
  const groupings = [
    "entry",
    "day",
    "week",
    "month",
    "category",
    "merchant",
    "context",
    "participant",
  ];
  for (const metric of metrics) {
    for (const grouping of groupings) {
      const validated = validatePlan({
        ...parseSearch("Spending", "2026-09-22", catalog).plan,
        operation: "breakdown",
        metric,
        group_by: [grouping],
      }, catalog);
      assert.equal(validated.metric, metric);
      assert.deepEqual(validated.group_by, [grouping]);
    }
  }
});

test("multi-entity includes, exclusions, and any/all matching survive validation", () => {
  const parsed = parseSearch(
    "Shopping except Amazon with Chris and Maya",
    "2026-09-22",
    catalog,
  );
  assert.deepEqual(parsed.plan.category_ids, ["shopping"]);
  assert.deepEqual(parsed.plan.exclude_merchant_ids, [catalog.merchants[1].id]);
  assert.deepEqual(parsed.plan.people, ["Chris", "Maya"]);
  const validated = validatePlan(
    { ...parsed.plan, people_match: "all" },
    catalog,
  );
  assert.equal(validated.people_match, "all");
  assert.deepEqual(validated.people, ["Chris", "Maya"]);
  const contexts = parseSearch(
    "Spending for both Friends and Work this month",
    "2026-09-22",
    catalog,
  );
  assert.deepEqual(contexts.plan.contexts, ["Friends", "Work"]);
  assert.equal(contexts.plan.contexts_match, "all");
});

test("unsupported fact types return bounded reasons rather than guessed answers", () => {
  assert.equal(
    parseSearch(
      "Which subscriptions are currently active?",
      "2026-09-22",
      catalog,
    )
      .unsupportedReason,
    "recurrence_status",
  );
  assert.equal(
    parseSearch("Why did I spend more?", "2026-09-22", catalog)
      .unsupportedReason,
    "causal_inference",
  );
  assert.equal(
    parseSearch("Predict next month's spend", "2026-09-22", catalog)
      .unsupportedReason,
    "prediction",
  );
});
