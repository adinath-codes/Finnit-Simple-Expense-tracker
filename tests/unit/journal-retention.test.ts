// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import test from "node:test";
import {
  previousLocalDay,
  retainOfflineJournalWindow,
} from "../../src/lib/offline/journal-retention.ts";
import { emptyJournalCache } from "../../src/lib/offline/cache-schema.ts";

const TODAY = "2026-09-25";
const YESTERDAY = previousLocalDay(TODAY);

function remote(id: string, day: string) {
  return {
    id,
    raw_text: `note ${id}`,
    original_text: `note ${id}`,
    captured_at: `${day}T10:00:00.000Z`,
    occurred_on: day,
    timezone: "Asia/Kolkata",
    currency: "INR",
    revision: 1,
    deleted_at: null,
    extraction: { transactions: [], people: [], contexts: [], unresolved: [] },
  };
}

function textEntry(id: string, day: string, sync: "pending" | "synced" | "blocked" = "synced") {
  return {
    input: {
      id,
      raw_text: `note ${id}`,
      captured_at: `${day}T10:00:00.000Z`,
      timezone: "Asia/Kolkata",
      currency: "INR",
      selected_date: day,
    },
    extraction: {
      transactions: [{ occurred_on: day }],
      people: [], contexts: [], unresolved: [],
    },
    ...(sync === "synced" ? { remote: remote(id, day) } : {}),
    sync,
  };
}

function receipt(id: string, day: string, synced = true) {
  const saved = remote(id, day);
  return {
    request: {
      entry_id: id,
      attachment_id: `${id}-attachment`,
      captured_at: `${day}T11:00:00.000Z`,
      timezone: "Asia/Kolkata",
      selected_date: day,
      default_currency: "INR",
    },
    width: 100,
    height: 200,
    prepared: true,
    status: synced ? "complete" : "queued",
    lines: [{ ordinal: 0, description: "Coffee", amount_minor: "180" }],
    ...(synced ? { remote: saved, attachment: { lines: [] } } : {}),
  };
}

test("native retention keeps complete details for today and yesterday only", () => {
  const cache = emptyJournalCache();
  cache.entries.today = textEntry("today", TODAY);
  cache.entries.yesterday = textEntry("yesterday", YESTERDAY);
  cache.entries.old = textEntry("old", "2026-09-20");
  cache.receipts.todayReceipt = receipt("todayReceipt", TODAY);
  cache.receipts.oldReceipt = receipt("oldReceipt", "2026-09-20");

  const retained = retainOfflineJournalWindow(cache, TODAY);

  assert.deepEqual(Object.keys(retained.entries).sort(), ["today", "yesterday"]);
  assert.deepEqual(Object.keys(retained.receipts), ["todayReceipt"]);
  assert.equal(retained.receipts.todayReceipt.lines[0].description, "Coffee");
});

test("pending jobs, failed receipts and conflict shadows are never pruned", () => {
  const cache = emptyJournalCache();
  cache.entries.pending = textEntry("pending", "2026-09-01", "pending");
  cache.entries.conflict = {
    ...textEntry("conflict", "2026-09-02", "blocked"),
    remoteShadow: remote("conflict", "2026-09-02"),
  };
  cache.receipts.failed = {
    ...receipt("failed", "2026-09-03", false),
    status: "failed",
    localUri: "file:///pending-receipt.jpg",
  };
  cache.jobs.push({
    id: "pending-job",
    userId: "account-a",
    entryId: "pending",
    endpoint: "parse-entry",
    payload: cache.entries.pending.input,
    state: "pending",
    attempts: 0,
    nextAttemptAt: 0,
  });

  const retained = retainOfflineJournalWindow(cache, TODAY);

  assert.ok(retained.entries.pending);
  assert.ok(retained.entries.conflict);
  assert.equal(retained.entries.conflict.remoteShadow.revision, 1);
  assert.equal(retained.receipts.failed.localUri, "file:///pending-receipt.jpg");
  assert.equal(retained.jobs.length, 1);
});

