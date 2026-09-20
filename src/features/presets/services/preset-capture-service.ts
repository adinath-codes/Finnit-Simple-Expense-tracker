import {
  captureJournalNote,
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
    presetCaptureText(preset),
    currency,
    selectedDate,
  );
  await captureJournalNote(input);
  return input.id;
}
