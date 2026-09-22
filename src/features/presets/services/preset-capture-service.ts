import {
  capturePresetJournalNote,
  createCaptureInput,
} from "@/features/journal/services/journal-service";
import type { Preset } from "@/types/domain";
import { presetCaptureText } from "./preset-format";

/** Create a journal entry from a preset without coupling preset sync to journal sync. */
export async function capturePreset(
  preset: Preset,
  selectedDate: string,
  currency: string,
) {
  const input = createCaptureInput(
    presetCaptureText(preset, currency),
    currency,
    selectedDate,
  );
  await capturePresetJournalNote({
    input,
    preset: {
      id: preset.id,
      name: preset.name,
      note: preset.note,
      amount_minor: String(preset.amountMinor),
      category_id: preset.category,
    },
  });
  return input.id;
}
