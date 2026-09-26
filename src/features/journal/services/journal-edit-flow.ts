import type { CachedEntry } from "@/types/sync";

export type EntryTextSaveMode = "recalculate" | "preserve";
export type JournalEditChange = "unchanged" | "delete" | "changed";

export function classifyJournalEdit(
  originalNote: string,
  draft: string,
): JournalEditChange {
  const note = draft.trim();
  if (!note) return "delete";
  return note === originalNote.trim() ? "unchanged" : "changed";
}

export function planEntryTextSave(
  entry: CachedEntry,
  draft: string,
  mode: EntryTextSaveMode,
) {
  const input = { ...entry.input, raw_text: draft.trim() };
  return mode === "preserve"
    ? { input, extraction: entry.extraction }
    : { input, extraction: undefined };
}
