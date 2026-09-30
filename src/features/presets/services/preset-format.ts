import type { Preset } from "../../../types/domain.ts";
import { presetCaptureText as sharedPresetCaptureText } from "../../../../supabase/functions/_shared/preset.ts";

export function presetCaptureText(preset: Preset, currency = "INR") {
  return sharedPresetCaptureText({
    id: preset.id,
    name: preset.name,
    note: preset.note,
    amount_minor: String(preset.amountMinor),
    category_id: preset.category,
  }, currency);
}

const TRAILING_AMOUNT = new RegExp(
  String.raw`\s*(?:(?:for|at|costs?|paid)\s+)?(?:(?:₹|\$|€|£|¥|₩|[A-Z]{3}|Rs\.?)\s*)?\d+(?:[,.]\d+)*(?:\s*(?:[kK]|[A-Z]{3}|rs))?\s*$`,
  "iu",
);

/** Preset cards display amount separately, so remove only a trailing price
 * phrase from an entry-derived title. Internal numbers such as "Bus 42" stay
 * intact when a later explicit price is present. */
export function presetNameFromEntry(value: string) {
  const firstLine = value.split("\n")[0].trim();
  const withoutAmount = firstLine
    .replace(TRAILING_AMOUNT, "")
    .replace(/[\s·,:-]+$/u, "")
    .trim();
  return (withoutAmount || "Saved expense").slice(0, 100);
}
