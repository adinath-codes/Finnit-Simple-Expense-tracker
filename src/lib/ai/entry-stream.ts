import type {
  EntryParseEvent,
  SavedEntry,
} from "@/lib/supabase/database.types";

export function parseEntryEventLine(line: string): EntryParseEvent | null {
  if (!line.trim()) return null;
  let value: unknown;
  try { value = JSON.parse(line); }
  catch { throw new Error("invalid_entry_stream"); }
  if (!value || typeof value !== "object") throw new Error("invalid_entry_stream");
  const event = value as Record<string, unknown>;
  if (event.type === "amount_preview") {
    const preview = event.preview as Record<string, unknown> | undefined;
    if (
      typeof event.entry_id !== "string" || !preview ||
      typeof preview.amount_minor !== "string" ||
      !/^\d{1,16}$/.test(preview.amount_minor) ||
      typeof preview.currency !== "string" ||
      !["personal_total", "user_share", "group_total"].includes(String(preview.scope)) ||
      typeof preview.estimated !== "boolean" ||
      typeof preview.needs_review !== "boolean"
    ) throw new Error("invalid_entry_stream");
  } else if (event.type === "final") {
    if (!event.entry || typeof event.entry !== "object" ||
        typeof (event.entry as Record<string, unknown>).id !== "string" ||
        typeof event.cached !== "boolean") {
      throw new Error("invalid_entry_stream");
    }
  } else if (event.type === "warning") {
    if (typeof event.code !== "string" || typeof event.retryable !== "boolean") {
      throw new Error("invalid_entry_stream");
    }
  } else {
    throw new Error("invalid_entry_stream");
  }
  return event as EntryParseEvent;
}

export class EntryEventDecoder {
  private remainder = "";

  push(chunk: string, flush = false): EntryParseEvent[] {
    this.remainder += chunk;
    const lines = this.remainder.split("\n");
    this.remainder = flush ? "" : lines.pop() ?? "";
    if (flush && this.remainder) lines.push(this.remainder);
    return lines.flatMap((line) => {
      const event = parseEntryEventLine(line);
      return event ? [event] : [];
    });
  }
}

export function legacyEntryResponse(value: unknown, entryId: string): SavedEntry {
  if (!value || typeof value !== "object") throw new Error("invalid_backend_response");
  const entry = (value as { entry?: SavedEntry }).entry;
  if (!entry || entry.id !== entryId) throw new Error("invalid_backend_response");
  return entry;
}
