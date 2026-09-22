import assert from "node:assert/strict";
import test from "node:test";
import { safeCacheableExplanation } from "../functions/_shared/cache.ts";
import {
  formatPresetAmount,
  presetCaptureText,
  presetExtraction,
} from "../functions/_shared/preset.ts";
import type { CaptureInput, PresetSnapshot } from "../functions/_shared/contracts.ts";

const capture: CaptureInput = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  raw_text: "Lunch · 12.34 food",
  captured_at: "2026-09-22T10:00:00.000Z",
  timezone: "Asia/Kolkata",
  currency: "INR",
  selected_date: "2026-09-22",
};

test("preset amounts preserve zero, two and three-decimal currency scales", () => {
  assert.equal(formatPresetAmount("1234", "JPY"), "1234");
  assert.equal(formatPresetAmount("1234", "INR"), "12.34");
  assert.equal(formatPresetAmount("1234", "BHD"), "1.234");
  assert.equal(formatPresetAmount("18050", "INR"), "180.50");
});

test("preset capture uses the immutable approved values without AI", () => {
  const preset: PresetSnapshot = {
    id: "lunch",
    name: "Lunch",
    note: "Cafe lunch",
    amount_minor: "1234",
    category_id: "food",
  };
  assert.equal(presetCaptureText(preset, "INR"), "Cafe lunch · 12.34 food");
  const result = presetExtraction(preset, capture);
  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].amount_minor, "1234");
  assert.equal(result.transactions[0].currency, "INR");
  assert.equal(result.transactions[0].category_id, "food");
  assert.equal(result.transactions[0].category_source, "user_correction");
  assert.equal(result.transactions[0].occurred_on, "2026-09-22");
  assert.equal(result.transactions[0].needs_review, false);
});

test("only digit-free and currency-symbol-free explanations are cacheable", () => {
  assert.equal(safeCacheableExplanation("Spending was concentrated in the selected period."), true);
  assert.equal(safeCacheableExplanation("There were 2 matching entries."), false);
  assert.equal(safeCacheableExplanation("The result was ₹ higher."), false);
  assert.equal(safeCacheableExplanation("The result was ₽ higher."), false);
});
