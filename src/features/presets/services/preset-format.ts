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
