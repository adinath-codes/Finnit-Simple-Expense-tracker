// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import test from "node:test";
import {
  EntryEventDecoder,
  legacyEntryResponse,
} from "../../src/lib/ai/entry-stream.ts";

const entryId = "00000000-0000-4000-8000-000000000001";
const preview = {
  type: "amount_preview",
  entry_id: entryId,
  preview: {
    amount_minor: "12000",
    currency: "INR",
    scope: "personal_total",
    estimated: true,
    needs_review: false,
  },
};
const final = {
  type: "final",
  cached: false,
  entry: { id: entryId },
};

test("entry NDJSON accepts preview then final across arbitrary chunks", () => {
  const wire = `${JSON.stringify(preview)}\n${JSON.stringify(final)}\n`;
  for (let cut = 0; cut <= wire.length; cut += 1) {
    const decoder = new EntryEventDecoder();
    const events = [
      ...decoder.push(wire.slice(0, cut)),
      ...decoder.push(wire.slice(cut), true),
    ];
    assert.deepEqual(events, [preview, final], `cut ${cut}`);
  }
});

test("entry NDJSON preserves duplicate previews and warning sequences", () => {
  const warning = { type: "warning", code: "ai_unavailable", retryable: true };
  const decoder = new EntryEventDecoder();
  const wire = [preview, preview, warning].map((event) => JSON.stringify(event)).join("\n");
  assert.deepEqual(decoder.push(wire, true), [preview, preview, warning]);
});

test("legacy JSON fallback accepts only the matching entry", () => {
  assert.deepEqual(legacyEntryResponse({ entry: { id: entryId } }, entryId), { id: entryId });
  assert.throws(
    () => legacyEntryResponse({ entry: { id: "different" } }, entryId),
    /invalid_backend_response/,
  );
});
