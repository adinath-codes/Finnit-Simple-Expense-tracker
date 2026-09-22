// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import test from "node:test";
import { emptyJournalCache } from "../../src/lib/offline/cache-schema.ts";
import { mergeRemoteEntry } from "../../src/features/journal/services/journal-sync-merge.ts";
import type { SavedEntry } from "../../supabase/functions/_shared/contracts.ts";

const id = "123e4567-e89b-42d3-a456-426614174000";
const account = "123e4567-e89b-42d3-a456-426614174001";
const capture = {
  id,
  raw_text: "Coffee 180.50",
  captured_at: "2026-09-22T10:00:00.000Z",
  timezone: "Asia/Kolkata",
  currency: "INR",
  selected_date: "2026-09-22",
};
const extraction: SavedEntry["extraction"] = {
  transactions: [], people: [], contexts: [], unresolved: [],
};

function remote(revision: number, overrides: Partial<SavedEntry> = {}): SavedEntry {
  return {
    ...capture,
    source_type: "text",
    original_text: capture.raw_text,
    occurred_on: "2026-09-22",
    revision,
    deleted_at: null,
    extraction,
    capture_request: capture,
    ...overrides,
  };
}

test("newer and repeated documents merge without downgrading a local entry", () => {
  const cache = emptyJournalCache();
  mergeRemoteEntry(cache, remote(2));
  mergeRemoteEntry(cache, remote(3, { raw_text: "Coffee 190.00" }));
  mergeRemoteEntry(cache, remote(2));
  assert.equal(cache.entries[id].remote?.revision, 3);
  assert.equal(cache.entries[id].input.raw_text, "Coffee 190.00");
});

test("a tombstone remains visible as deleted with its full saved facts", () => {
  const cache = emptyJournalCache();
  mergeRemoteEntry(cache, remote(1));
  mergeRemoteEntry(cache, remote(2, {
    deleted_at: "2026-09-22T11:00:00.000Z",
  }));
  assert.equal(cache.entries[id].deleted, true);
  assert.equal(cache.entries[id].input.raw_text, capture.raw_text);
  assert.equal(cache.entries[id].remote?.revision, 2);
});

test("pending local edits retain their mutation and the incoming remote shadow", () => {
  const cache = emptyJournalCache();
  mergeRemoteEntry(cache, remote(1));
  cache.entries[id].input.raw_text = "My offline correction";
  cache.entries[id].sync = "pending";
  cache.jobs.push({
    id,
    userId: account,
    entryId: id,
    endpoint: "correct-entry",
    payload: { action: "delete", operation_id: id, id, expected_revision: 1 },
    state: "pending",
    attempts: 0,
    nextAttemptAt: 0,
  });
  mergeRemoteEntry(cache, remote(2, { raw_text: "Other device edit" }));
  assert.equal(cache.entries[id].input.raw_text, "My offline correction");
  assert.equal(cache.entries[id].remote?.revision, 1);
  assert.equal(cache.entries[id].remoteShadow?.revision, 2);
  assert.equal(cache.entries[id].remoteShadow?.raw_text, "Other device edit");
  assert.equal(cache.jobs.length, 1);
});

test("receipt sync retains every stored line and a pending conflict shadow", () => {
  const cache = emptyJournalCache();
  const request = {
    entry_id: id,
    attachment_id: "123e4567-e89b-42d3-a456-426614174002",
    captured_at: capture.captured_at,
    timezone: capture.timezone,
    selected_date: capture.selected_date,
    default_currency: "INR",
  };
  const lines = [0, 1, 2].map((ordinal) => ({
    id: `line-${ordinal}`,
    ordinal,
    kind: "item" as const,
    description: `Item ${ordinal}`,
    quantity: 1,
    unit_price_minor: "100",
    amount_minor: "100",
    currency: "INR",
    category_id: "food",
    confidence: 1,
    needs_review: false,
    evidence_text: `Item ${ordinal}`,
    provisional: false,
  }));
  const attachment = {
    id: request.attachment_id,
    status: "complete" as const,
    merchant_name: "Cafe",
    purchase_date_text: "2026-09-22",
    printed_subtotal_minor: "300",
    printed_total_minor: "300",
    currency: "INR",
    confidence: 1,
    needs_review: false,
    truncated: false,
    model: "fixture",
    lines,
  };
  const document = remote(1, {
    source_type: "receipt", raw_text: null, original_text: null,
    capture_request: request, receipt: attachment,
  });
  mergeRemoteEntry(cache, document);
  assert.deepEqual(cache.receipts[id].lines, lines);
  cache.jobs.push({
    id,
    userId: account,
    entryId: id,
    endpoint: "scan-receipt",
    payload: request,
    state: "pending",
    attempts: 0,
    nextAttemptAt: 0,
  });
  mergeRemoteEntry(cache, { ...document, revision: 2 });
  assert.equal(cache.receipts[id].remote?.revision, 1);
  assert.equal(cache.receipts[id].remoteShadow?.revision, 2);
  assert.deepEqual(cache.receipts[id].lines, lines);
});
