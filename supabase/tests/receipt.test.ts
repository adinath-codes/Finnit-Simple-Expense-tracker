import assert from "node:assert/strict";
import test from "node:test";
import {
  completedReceiptLineJson,
  receiptMoney,
  reconcileReceiptCorrection,
  validateReceiptCorrectionLines,
  validateReceiptModel,
} from "../functions/_shared/receipt.ts";
import type { ReceiptScanRequest } from "../functions/_shared/contracts.ts";

const request: ReceiptScanRequest = {
  entry_id: "00000000-0000-4000-8000-000000000001",
  attachment_id: "00000000-0000-4000-8000-000000000002",
  captured_at: "2026-09-19T10:00:00.000Z",
  timezone: "Asia/Kolkata",
  selected_date: "2026-09-18",
  default_currency: "INR",
};

function line(overrides: Record<string, unknown> = {}) {
  return {
    kind: "item",
    description: "Coffee",
    quantity: 2,
    unit_price_text: "60.00",
    amount_text: "120.00",
    category_id: "food",
    confidence: 0.96,
    uncertain: false,
    evidence_text: "Coffee 2 x 60.00 120.00",
    ...overrides,
  };
}

function model(overrides: Record<string, unknown> = {}) {
  return {
    line_items: [line()],
    merchant_name: "Cafe",
    purchase_date_text: "17/09/2026",
    currency_code: "INR",
    subtotal_text: "120.00",
    total_text: "120.00",
    truncated: false,
    ...overrides,
  };
}

test("money parsing is deterministic and discounts retain a negative sign", () => {
  assert.equal(receiptMoney("₹1,234.50", "INR"), "123450");
  assert.equal(receiptMoney("(12.30)", "INR"), "-1230");
  assert.equal(receiptMoney("120", "JPY"), "120");
  assert.throws(() => receiptMoney("12,50", "INR"));
  assert.throws(() => receiptMoney("1.234", "INR"));
});

test("complete objects stream exactly once across arbitrary chunk boundaries", () => {
  const document = JSON.stringify(model({
    line_items: [
      line(),
      line({
        description: "Tax",
        kind: "tax",
        quantity: null,
        unit_price_text: null,
        amount_text: "5.00",
        evidence_text: "Tax 5.00",
      }),
    ],
  }));
  const seen = new Set<string>();
  let partial = "";
  for (let index = 0; index < document.length; index += (index % 7) + 1) {
    partial += document.slice(index, index + (index % 7) + 1);
    for (const object of completedReceiptLineJson(partial)) seen.add(object);
  }
  assert.equal(seen.size, 2);
  assert.equal(JSON.parse([...seen][1]).kind, "tax");
});

test("exact printed rows reconcile and selected journal date is retained", () => {
  const receipt = validateReceiptModel(model(), request, ["food", "other"]);
  assert.equal(receipt.reconciled, true);
  assert.equal(receipt.status, "complete");
  assert.equal(receipt.extraction.transactions[0].occurred_on, "2026-09-18");
  assert.equal(receipt.extraction.transactions[0].amount_minor, "12000");
});

test("explicit discounts reconcile as negative rows", () => {
  const receipt = validateReceiptModel(
    model({
      line_items: [
        line(),
        line({
          kind: "discount",
          description: "Coupon",
          quantity: null,
          unit_price_text: null,
          amount_text: "20.00",
          evidence_text: "Coupon 20.00",
        }),
      ],
      subtotal_text: "120.00",
      total_text: "100.00",
    }),
    request,
    ["food", "other"],
  );
  assert.equal(receipt.lines[1].amount_minor, "-2000");
  assert.equal(receipt.reconciled, true);
  assert.equal(receipt.extraction.transactions.length, 2);
});

test("a mismatch uses one printed-total transaction without inventing a row", () => {
  const receipt = validateReceiptModel(model({ total_text: "125.00" }), request, ["food", "other"]);
  assert.equal(receipt.status, "needs_review");
  assert.equal(receipt.lines.length, 1);
  assert.deepEqual(receipt.extraction.transactions.map((value) => value.description), [
    "Receipt total",
  ]);
  assert.equal(receipt.extraction.transactions[0].amount_minor, "12500");
});

test("low-confidence and missing-total lines are saved but excluded for review", () => {
  const receipt = validateReceiptModel(
    model({
      line_items: [line({ confidence: 0.6, uncertain: true })],
      subtotal_text: null,
      total_text: null,
    }),
    request,
    ["food", "other"],
  );
  assert.equal(receipt.lines[0].needs_review, true);
  assert.equal(receipt.extraction.transactions[0].needs_review, true);
  assert.equal(receipt.status, "needs_review");
});

test("missing totals keep reliable printed lines as the temporary aggregate", () => {
  const receipt = validateReceiptModel(
    model({ subtotal_text: null, total_text: null }),
    request,
    ["food", "other"],
  );
  assert.equal(receipt.status, "needs_review");
  assert.equal(receipt.reconciled, false);
  assert.equal(receipt.extraction.transactions[0].amount_minor, "12000");
  assert.equal(receipt.extraction.transactions[0].needs_review, false);
});

test("strict validation rejects ungrounded, malformed, unknown, and oversized output", () => {
  assert.throws(() =>
    validateReceiptModel(
      model({
        line_items: [line({ evidence_text: "unrelated" })],
      }),
      request,
      ["food", "other"],
    )
  );
  assert.throws(() =>
    validateReceiptModel(
      model({
        line_items: [line({ category_id: "invented" })],
      }),
      request,
      ["food", "other"],
    )
  );
  assert.throws(() =>
    validateReceiptModel({ ...model(), surprise: true }, request, ["food", "other"])
  );
  assert.throws(() => validateReceiptModel(model({ line_items: [] }), request, ["food"]));
  assert.throws(() =>
    validateReceiptModel(
      model({
        line_items: Array.from({ length: 101 }, () => line()),
      }),
      request,
      ["food"],
    )
  );
});

test("human line corrections renumber rows and recompute reconciliation", () => {
  const lines = validateReceiptCorrectionLines(
    [
      {
        ordinal: 9,
        kind: "item",
        description: "Tea",
        quantity: 1,
        unit_price_minor: "5000",
        amount_minor: "5000",
        currency: "INR",
        category_id: "food",
        confidence: 1,
        needs_review: false,
        evidence_text: "manually corrected",
        provisional: false,
      },
      {
        ordinal: 12,
        kind: "discount",
        description: "Coupon",
        quantity: null,
        unit_price_minor: null,
        amount_minor: "500",
        currency: "INR",
        category_id: "other",
        confidence: 1,
        needs_review: false,
        evidence_text: "manually corrected",
        provisional: false,
      },
    ],
    "INR",
    ["food", "other"],
  );
  assert.deepEqual(lines.map((value) => value.ordinal), [0, 1]);
  assert.equal(lines[1].amount_minor, "-500");
  const result = reconcileReceiptCorrection(lines, "4500", "INR", "2026-09-18");
  assert.equal(result.reconciled, true);
  assert.equal(result.extraction.transactions.length, 2);
  assert.equal(result.extraction.transactions[0].category_source, "user_correction");
});
