// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import test from "node:test";
import { buildCalendarCategoryItems } from "../../src/features/calendar/services/calendar-category-items.ts";

function entry(id, date, note, items) {
  return {
    id,
    date,
    note,
    merchant: "",
    category: items[0]?.category ?? "other",
    status: "ready",
    time: "12:00",
    items,
    thought: "",
    sources: [],
  };
}

function item(id, category, amountMinor, overrides = {}) {
  return {
    id,
    name: id,
    quantity: 1,
    amountMinor,
    category,
    ...overrides,
  };
}

const entries = [
  entry("older", "2026-09-12", "Lunch and snacks", [
    item("lunch", "food", 1_000, { accountingAmountMinor: 600 }),
    item("snack", "food", 200),
    item("ride", "transport", 300),
  ]),
  entry("newer", "2026-09-20", "Dinner with friends", [
    item("dinner", "food", 2_000, {
      accountingAmountMinor: null,
      amountMissing: true,
    }),
  ]),
  entry("same-day", "2026-09-20", "Morning coffee", [
    item("coffee", "food", 180),
  ]),
  entry("future", "2026-09-25", "Future meal", [
    item("future-food", "food", 400),
  ]),
  entry("other-month", "2026-10-01", "October meal", [
    item("october-food", "food", 500),
  ]),
];

test("returns one stable row per matching item in newest-first order", () => {
  const rows = buildCalendarCategoryItems({
    category: "food",
    entries,
    month: new Date(2026, 8, 1, 12),
    today: "2026-09-22",
  });

  assert.deepEqual(
    rows.map((row) => row.id),
    [
      "newer:dinner",
      "same-day:coffee",
      "older:lunch",
      "older:snack",
    ],
  );
  assert.equal(rows[0].message, "Dinner with friends");
  assert.equal(rows[0].date, "2026-09-20");
  assert.equal(rows[2].entryId, "older");
});

test("uses accounting amounts and marks excluded unknown amounts for review", () => {
  const rows = buildCalendarCategoryItems({
    category: "food",
    entries,
    month: new Date(2026, 8, 1, 12),
    today: "2026-09-22",
  });

  assert.equal(rows[0].amountMinor, 0);
  assert.equal(rows[0].amountNeedsReview, true);
  assert.equal(rows[2].amountMinor, 600);
  assert.equal(rows[2].amountNeedsReview, false);
});

test("filters other categories, months, and future dates", () => {
  const rows = buildCalendarCategoryItems({
    category: "transport",
    entries,
    month: new Date(2026, 8, 1, 12),
    today: "2026-09-22",
  });

  assert.deepEqual(rows.map((row) => row.id), ["older:ride"]);
});
