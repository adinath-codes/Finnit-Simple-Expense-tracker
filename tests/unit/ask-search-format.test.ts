// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import test from "node:test";
import {
  compactPeriodLabel,
  exactMoney,
  exactMoneyParts,
  exclusiveEndDate,
  inclusiveEndDate,
  timelineDateParts,
} from "../../src/features/ask/services/search-format.ts";

const currentDay = "2026-09-24";

test("compact Ask range omits repeated current month and year", () => {
  assert.equal(
    compactPeriodLabel("2026-09-01", "2026-10-01", currentDay),
    "Sep 1–30",
  );
});

test("compact Ask range includes both months when the range crosses a month", () => {
  assert.equal(
    compactPeriodLabel("2026-08-28", "2026-09-05", currentDay),
    "Aug 28–Sep 4",
  );
});

test("compact Ask range includes both years when the range crosses a year", () => {
  assert.equal(
    compactPeriodLabel("2025-12-28", "2026-01-04", currentDay),
    "Dec 28, 2025–Jan 3, 2026",
  );
});

test("compact Ask range keeps the year for an unambiguous historical month", () => {
  assert.equal(
    compactPeriodLabel("2025-09-01", "2025-10-01", currentDay),
    "Sep 1–30, 2025",
  );
});

test("inclusive and exclusive end dates round trip", () => {
  assert.equal(inclusiveEndDate("2026-10-01"), "2026-09-30");
  assert.equal(exclusiveEndDate("2026-09-30"), "2026-10-01");
  assert.equal(exclusiveEndDate(inclusiveEndDate("2026-01-01")), "2026-01-01");
});

test("exact money parts preserve sign, symbol, and large integer precision", () => {
  assert.deepEqual(exactMoneyParts("123456789012345", "INR"), {
    label: "₹12,34,56,78,90,123.45",
    sign: "",
    symbol: "₹",
    value: "12,34,56,78,90,123.45",
  });
  assert.deepEqual(exactMoneyParts("-1250", "USD"), {
    label: "-$12.50",
    sign: "-",
    symbol: "$",
    value: "12.50",
  });
  assert.deepEqual(exactMoneyParts("5000", "JPY"), {
    label: "JP¥5,000",
    sign: "",
    symbol: "JP¥",
    value: "5,000",
  });
  assert.equal(exactMoney("-1250", "USD"), "-$12.50");
});

test("timeline date parts provide a compact node and full accessible label", () => {
  assert.deepEqual(timelineDateParts("2026-09-21"), {
    day: "21",
    label: "21 Sept 2026",
    month: "SEP",
    year: "2026",
  });
});
