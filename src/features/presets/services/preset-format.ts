import type { Category, Preset } from "../../../types/domain.ts";

const CATEGORY_CONTEXT: Record<Category, string> = {
  food: "food",
  transport: "transport",
  shopping: "shopping",
  other: "other expense",
};

export function presetCaptureText(preset: Preset) {
  const amount = (preset.amountMinor / 100).toFixed(
    preset.amountMinor % 100 === 0 ? 0 : 2,
  );
  const note = preset.note.trim() || preset.name.trim();
  return `${note} · ${amount} ${CATEGORY_CONTEXT[preset.category]}`;
}
