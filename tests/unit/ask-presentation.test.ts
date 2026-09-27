// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import test from "node:test";
import {
  ASK_FINN_AI_NOTICE,
  buildAnswerRows,
  conversationalFinnCopy,
  entityFilterChips,
  factualFallbackExplanation,
  sourceEvidenceCount,
  unsupportedCopy,
  withoutEntityFilter,
} from "../../src/features/ask/services/ask-presentation.ts";
import {
  isRetryableSearchError,
  searchError,
} from "../../src/features/ask/services/ask-error.ts";

const emptyTotals = [];
const advanced = (kind, rows) => ({
  kind,
  label: kind,
  rows,
  start_date: "2026-09-01",
  end_date: "2026-10-01",
});

const plan = {
  operation: "breakdown",
  direction: "expense",
  start_date: "2026-09-01",
  end_date: "2026-10-01",
  merchant_id: "m1",
  merchant_ids: ["m1", "m2"],
  category_id: "food",
  category_ids: ["food", "transport"],
  person: "Chris",
  people: ["Chris", "Sam"],
  context: "Trip",
  contexts: ["Trip", "Work"],
  text: null,
  currency: "USD",
};

test("ranking and breakdown rows preserve server currency and labels", () => {
  const rows = buildAnswerRows(advanced("rank", [
    { label: "Laptop", currency: "USD", value_minor: "140000", value_date: "2026-09-20" },
    { label: "Phone", currency: "USD", value_minor: "90000" },
  ]), emptyTotals);
  assert.deepEqual(rows[0].money, { minor: "140000", currency: "USD" });
  assert.match(rows[0].caption, /Laptop/);
  assert.match(rows[0].caption, /USD/);
  assert.equal(rows.some((row) => row.money?.currency !== "USD"), false);
});

test("count, date, and average answer shapes render their exact typed values", () => {
  assert.equal(buildAnswerRows(advanced("count", [{ label: "Purchases", value_count: 7 }]), emptyTotals)[0].value, "7");
  assert.match(buildAnswerRows(advanced("rank", [{ label: "Week", value_date: "2026-09-14" }]), emptyTotals)[0].value, /2026/);
  const average = buildAnswerRows(advanced("average", [
    { label: "Average purchase", currency: "USD", value_minor: "1234", rounded: true },
  ]), emptyTotals)[0];
  assert.deepEqual(average.money, { minor: "1234", currency: "USD" });
  assert.match(average.caption, /rounded/);
});

test("comparison rows retain both periods, exact delta, and percentage", () => {
  const row = buildAnswerRows(advanced("comparison", [{
    label: "Compared period",
    currency: "USD",
    primary_minor: "5000",
    comparison_minor: "4000",
    delta_minor: "1000",
    change_percent: 25,
  }]), emptyTotals)[0];
  assert.deepEqual(row.comparison, {
    currency: "USD", primary: "5000", previous: "4000", delta: "1000", percent: 25,
  });
  assert.match(row.caption, /\+25%/);
});

test("legacy totals are never relabeled as the settings currency", () => {
  const rows = buildAnswerRows(undefined, [
    { currency: "EUR", total_minor: "100", confirmed_count: 1, review_count: 0 },
  ]);
  assert.deepEqual(rows[0].money, { minor: "100", currency: "EUR" });
});

test("removable entity chips expose all normalized filters", () => {
  const chips = entityFilterChips(plan, {
    merchant: "One", category: "Food",
    merchants: [{ id: "m1", label: "One" }, { id: "m2", label: "Two" }],
    categories: [{ id: "food", label: "Food" }, { id: "transport", label: "Transport" }],
  });
  assert.deepEqual(chips.map((chip) => chip.label), ["One", "Two", "Food", "Transport", "Chris", "Sam", "Trip", "Work"]);
});

test("removing a filter updates plural and legacy singular fields without reinterpretation", () => {
  assert.deepEqual(withoutEntityFilter(plan, "merchant", "m1").merchant_ids, ["m2"]);
  assert.equal(withoutEntityFilter(plan, "merchant", "m1").merchant_id, "m2");
  assert.deepEqual(withoutEntityFilter(plan, "category", "food").category_ids, ["transport"]);
  assert.equal(withoutEntityFilter(plan, "person", "Chris").person, "Sam");
  assert.equal(withoutEntityFilter(plan, "context", "Trip").context, "Work");
});

test("unsupported states offer reason-specific, fact-safe alternatives", () => {
  assert.match(unsupportedCopy("recurrence_status"), /subscription spending this month/i);
  assert.match(unsupportedCopy("missing_values"), /will not estimate/i);
  assert.match(unsupportedCopy("external_data"), /exchange rates/i);
  assert.match(unsupportedCopy("causal_inference"), /cannot establish why/i);
});

test("fixed explanations describe the requested calculation instead of inventing facts", () => {
  assert.match(factualFallbackExplanation({ matching_count: 2, advanced_answer: advanced("rank", []) }), /I ranked the confirmed/i);
  assert.match(factualFallbackExplanation({ matching_count: 2, advanced_answer: advanced("comparison", []) }), /selected period minus/i);
  assert.match(factualFallbackExplanation({ matching_count: 0, advanced_answer: advanced("count", []) }), /I couldn’t find/i);
});

test("Finn presents generated context conversationally without another model request", () => {
  assert.equal(
    conversationalFinnCopy("The answer uses confirmed journal entries"),
    "Here’s what I found. The answer uses confirmed journal entries.",
  );
  assert.equal(
    conversationalFinnCopy("I found a useful pattern."),
    "I found a useful pattern.",
  );
});

test("Ask Finn disclosure identifies interpretation risk and points to verifiable sources", () => {
  assert.match(ASK_FINN_AI_NOTICE, /AI may misinterpret questions/i);
  assert.match(ASK_FINN_AI_NOTICE, /filters and source entries/i);
});

test("evidence labels use contributor count rather than all matching rows", () => {
  assert.equal(sourceEvidenceCount({ evidence_count: 1, matching_count: 18 }), 1);
  assert.equal(sourceEvidenceCount({ matching_count: 18 }), 18);
});

test("retryable backend failures keep an explicit retry path", () => {
  assert.equal(isRetryableSearchError({ status: 503, retryable: true }), true);
  assert.equal(isRetryableSearchError({ status: 400, retryable: false }), false);
  assert.match(searchError({ status: 429, retryable: true }), /try again/i);
  assert.match(searchError({ status: 401, retryable: false }), /Sign in/i);
});
