import type { PresetSnapshot, SavedEntry } from "../_shared/contracts.ts";
import {
  legacyPresetCaptureText,
  presetCaptureText,
  presetExtraction,
} from "../_shared/preset.ts";
import { metric, requireQuota, rpc, serve } from "../_shared/runtime.ts";
import {
  ApiError,
  capture,
  extraction,
  minor,
  object,
  text,
} from "../_shared/validation.ts";
const CATEGORIES = ["food", "transport", "shopping", "other"] as const;

function presetId(value: unknown) {
  const id = text(value, 100).trim();
  if (id.length > 100) throw new ApiError(400, "invalid_preset");
  return id;
}

serve(async (body, ctx) => {
  await requireQuota(ctx);
  const rawPreset = object(body.preset);
  const amountMinor = minor(rawPreset.amount_minor);
  if (!amountMinor || BigInt(amountMinor) < 1n)
    throw new ApiError(400, "invalid_amount");
  const preset: PresetSnapshot = {
    id: presetId(rawPreset.id),
    name: text(rawPreset.name, 100).trim(),
    note: typeof rawPreset.note === "string" && rawPreset.note.trim()
      ? text(rawPreset.note, 4000).trim()
      : "",
    amount_minor: amountMinor,
    category_id: text(rawPreset.category_id, 20) as PresetSnapshot["category_id"],
  };
  if (!CATEGORIES.includes(preset.category_id))
    throw new ApiError(400, "invalid_category");

  const input = capture(body.input);
  const source = body.source === "manual" ? "manual" : "preset";
  const expectedText = presetCaptureText(preset, input.currency);
  const legacyText = legacyPresetCaptureText(preset, input.currency);
  if (input.raw_text !== expectedText && input.raw_text !== legacyText)
    throw new ApiError(409, "preset_snapshot_conflict");
  const result = extraction(presetExtraction(preset, input, source), [...CATEGORIES], []);

  const entry = await rpc<SavedEntry>(ctx.admin, "finn_commit_entry", {
    p_user: ctx.userId,
    p_input: input,
    p_extraction: result,
    p_audit: {
      event: source === "manual" ? "manual_capture" : "preset_capture",
      preset_id: preset.id,
      preset_snapshot: preset,
      validated_result: result,
    },
  });
  await metric(ctx, source === "manual" ? "manual_capture_saved" : "preset_capture_saved", {
    metadata: { category_id: preset.category_id },
  });
  return { entry, cached: true };
});
