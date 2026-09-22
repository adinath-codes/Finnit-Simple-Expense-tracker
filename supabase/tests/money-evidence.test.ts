import assert from "node:assert/strict";
import test from "node:test";
import {
  componentLineTotal,
  decimalMinor,
  moneyTokens,
} from "../functions/_shared/money-evidence.ts";
import { pendingExtraction } from "../functions/_shared/pending-entry.ts";
import { equalShares, inferEqualSplits } from "../functions/_shared/breakdown.ts";

test("quantity multipliers are excluded from price evidence", () => {
  const tokens = moneyTokens("2 × 100 + 1 × 20", "INR");
  assert.deepEqual(tokens.map((token) => token.minor), ["10000", "2000"]);
});

test("component expressions use exact server-side integer arithmetic", () => {
  const terms = [
    componentLineTotal("10000", 1, "item"),
    componentLineTotal("10000", 1, "item"),
    componentLineTotal("20000", 3, "item"),
  ];
  assert.deepEqual(terms, ["10000", "10000", "60000"]);
  assert.equal(terms.reduce((sum, value) => sum + BigInt(value), 0n), 80000n);
  assert.equal(componentLineTotal("500", 1, "discount"), "-500");
  assert.throws(() => componentLineTotal("9007199254740991", 2, "item"));
});

test("natural-language counts are excluded from price evidence", () => {
  const tokens = moneyTokens(
    "2 uber rides along with my 3 friends costing 1000 in total",
    "INR",
  );
  assert.deepEqual(tokens.map((token) => token.minor), ["100000"]);
});

test("mixed currencies stay as separate grounded evidence", () => {
  const tokens = moneyTokens("2 × $10 + 1 × ₹20", "INR");
  assert.deepEqual(
    tokens.map(({ minor, currency }) => ({ minor, currency })),
    [{ minor: "1000", currency: "USD" }, { minor: "2000", currency: "INR" }],
  );
});

test("decimal conversion uses exact minor units", () => {
  assert.equal(decimalMinor("1,234.50", "INR"), "123450");
  assert.equal(decimalMinor("12.345", "INR"), null);
});

test("local pending entries contain no financial interpretation", () => {
  const pending = pendingExtraction({
    id: "00000000-0000-4000-8000-000000000001",
    raw_text: "2 × 100 + 1 × 20",
    captured_at: "2026-09-22T00:00:00.000Z",
    timezone: "Asia/Kolkata",
    currency: "INR",
    selected_date: "2026-09-22",
  });
  assert.equal(pending.transactions[0].amount_minor, null);
  assert.equal(pending.transactions[0].category_id, "other");
  assert.deepEqual(pending.unresolved, ["gemini_pending"]);
});

test("whole-unit equal splits put the deterministic remainder on self", () => {
  assert.deepEqual(equalShares("100000", "INR", 3), {
    otherShareMinor: "33300",
    selfShareMinor: "33400",
    approximate: true,
  });
  assert.deepEqual(equalShares("1001", "BHD", 2), {
    otherShareMinor: "500",
    selfShareMinor: "501",
    approximate: true,
  });
  assert.deepEqual(equalShares("100", "JPY", 4), {
    otherShareMinor: "25",
    selfShareMinor: "25",
    approximate: false,
  });
});

test("inferred group split expands anonymous people and preserves confirmed total", () => {
  const extraction = inferEqualSplits({
    transactions: [{
      description: "2 uber rides along with 3 friends costing 1000 in total",
      amount_minor: "100000",
      currency: "INR",
      direction: "expense",
      cash_flow: "out",
      amount_status: "confirmed",
      category_id: "transport",
      category_source: "llm_fallback",
      merchant_id: null,
      occurred_on: "2026-09-22",
      quantity: 2,
      unit_price_minor: null,
      confidence: 0.95,
      needs_review: true,
      unresolved: ["user_share"],
      person: null,
      evidence: "1000",
      primary_amount_role: "group_total",
      group_total_minor: "100000",
      user_share_minor: null,
      paid_by_user_minor: null,
      split_method: "unknown",
      participant_count: 3,
    }],
    people: [], contexts: [], unresolved: [],
    participants: [{
      transaction_ordinal: 0,
      party_kind: "anonymous_group",
      display_name: null,
      participant_count: 2,
      role: "participant",
      share_minor: null,
      share_percentage: null,
      split_method: "unknown",
      confidence: 0.9,
      evidence: null,
      needs_review: false,
    }, {
      transaction_ordinal: 0,
      party_kind: "self",
      display_name: null,
      participant_count: 1,
      role: "participant",
      share_minor: null,
      share_percentage: null,
      split_method: "unknown",
      confidence: 0.9,
      evidence: null,
      needs_review: false,
    }],
  });
  const transaction = extraction.transactions[0];
  assert.equal(transaction.amount_minor, "100000");
  assert.equal(transaction.amount_status, "confirmed");
  assert.equal(transaction.user_share_minor, "33400");
  assert.equal(transaction.breakdown_approximate, true);
  assert.deepEqual(extraction.participants?.map((person) => [person.party_kind, person.participant_count, person.share_minor]), [
    ["anonymous_group", 2, "66600"],
    ["self", 1, "33400"],
  ]);
});
