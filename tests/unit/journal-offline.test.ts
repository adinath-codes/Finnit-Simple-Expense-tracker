// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import test from "node:test";
import {
  journalCacheKey,
  normalizeJournalCache,
} from "../../src/lib/offline/cache-schema.ts";
import {
  correctedTextExtraction,
  journalEntriesFromCache,
} from "../../src/features/journal/services/journal-adapter.ts";
import { entryTotal } from "../../src/utils/amounts.ts";
import { presetCaptureText } from "../../src/features/presets/services/preset-format.ts";
import type { CachedEntry, JournalCache } from "../../src/types/sync.ts";

const transaction = {
  id: "transaction-1",
  description: "Monthly rent",
  amount_minor: "120000",
  currency: "INR",
  direction: "expense" as const,
  cash_flow: "out" as const,
  amount_status: "confirmed" as const,
  category_id: "bills",
  category_source: "keyword_rule" as const,
  merchant_id: null,
  occurred_on: "2026-09-20",
  quantity: 1,
  unit_price_minor: null,
  confidence: 0.9,
  needs_review: false,
  unresolved: [],
  person: null,
  evidence: "1200",
};

const cachedEntry: CachedEntry = {
  input: {
    id: "11111111-1111-4111-8111-111111111111",
    raw_text: "rent 1200",
    captured_at: "2026-09-20T10:00:00.000Z",
    timezone: "Asia/Kolkata",
    currency: "INR",
    selected_date: "2026-09-20",
  },
  extraction: { transactions: [transaction], people: [], contexts: [], unresolved: [] },
  sync: "pending",
};

test("v1 cache migration preserves entries and outbox", () => {
  const migrated = normalizeJournalCache({
    version: 1,
    entries: { [cachedEntry.input.id]: cachedEntry },
    jobs: [{
      id: cachedEntry.input.id,
      userId: "account-a",
      entryId: cachedEntry.input.id,
      endpoint: "parse-entry",
      payload: cachedEntry.input,
      state: "pending",
      attempts: 0,
      nextAttemptAt: 0,
    }],
  });
  assert.equal(migrated.version, 2);
  assert.equal(migrated.entries[cachedEntry.input.id].input.raw_text, "rent 1200");
  assert.equal(migrated.jobs.length, 1);
  assert.deepEqual(migrated.local.presets, []);
  assert.equal(migrated.local.settings.currency, "INR");
});

test("journal cache keys isolate accounts", () => {
  assert.notEqual(journalCacheKey("account-a"), journalCacheKey("account-b"));
});

test("metadata outbox jobs survive cache normalization", () => {
  const cache = normalizeJournalCache({
    version: 2,
    entries: {},
    jobs: [{
      id: "metadata-sync-1",
      userId: "account-a",
      entryId: "preset:coffee",
      endpoint: "sync-preset",
      payload: {
        preset: {
          id: "coffee", name: "Coffee", note: "Coffee", amountMinor: 180, category: "food",
        },
      },
      state: "pending",
      attempts: 0,
      nextAttemptAt: 0,
    }],
    local: {
      settings: {
        currency: "INR", location: false, reminders: false,
        reminderFrequency: "Every evening", reminderTime: "9:00 PM", backTapQuickAdd: false,
      },
      presets: [], goals: [], settingsInitialized: true, legacyPreferencesImported: true,
    },
  });
  assert.equal(cache.jobs[0].endpoint, "sync-preset");
  assert.equal((cache.jobs[0].payload as { preset: { name: string } }).preset.name, "Coffee");
});

test("legacy receipt cache drops backend image identifiers and cleanup jobs", () => {
  const request = {
    entry_id: "22222222-2222-4222-8222-222222222222",
    attachment_id: "33333333-3333-4333-8333-333333333333",
    object_path: "account/entry/hash.jpg",
    sha256: "a".repeat(64),
    mime_type: "image/jpeg",
    byte_size: 1024,
    width: 1200,
    height: 1800,
    captured_at: "2026-09-20T11:00:00.000Z",
    timezone: "Asia/Kolkata",
    selected_date: "2026-09-20",
    default_currency: "INR",
  };
  const cache = normalizeJournalCache({
    version: 2,
    entries: {},
    receipts: {
      [request.entry_id]: {
        request,
        localUri: "file:///receipt.jpg",
        status: "queued",
        lines: [],
        uploaded: true,
      },
    },
    jobs: [{
      id: "cleanup-1",
      userId: "account-a",
      entryId: request.entry_id,
      endpoint: "delete-receipt-image",
      payload: { object_path: request.object_path, local_uri: "file:///receipt.jpg" },
      state: "pending",
      attempts: 0,
      nextAttemptAt: 0,
    }],
  });

  assert.deepEqual(cache.receipts[request.entry_id].request, {
    entry_id: request.entry_id,
    attachment_id: request.attachment_id,
    captured_at: request.captured_at,
    timezone: request.timezone,
    selected_date: request.selected_date,
    default_currency: request.default_currency,
  });
  assert.equal(cache.receipts[request.entry_id].width, 1200);
  assert.equal(cache.receipts[request.entry_id].height, 1800);
  assert.equal(cache.receipts[request.entry_id].prepared, true);
  assert.equal(cache.jobs.length, 0);
});

test("journal adapter exposes queued and blocked state without losing backend category", () => {
  const base = normalizeJournalCache({
    version: 1,
    entries: { [cachedEntry.input.id]: cachedEntry },
    jobs: [],
  });
  const pending = journalEntriesFromCache(base)[0];
  assert.equal(pending.items[0].category, "other");
  assert.equal(pending.items[0].categoryId, "bills");
  assert.equal(pending.syncState, "pending");

  const blocked: JournalCache = {
    ...base,
    jobs: [{
      id: "operation-1",
      userId: "account-a",
      entryId: cachedEntry.input.id,
      endpoint: "parse-entry",
      payload: cachedEntry.input,
      state: "blocked",
      attempts: 1,
      nextAttemptAt: 0,
      error: "invalid_backend_response",
    }],
  };
  const adapted = journalEntriesFromCache(blocked)[0];
  assert.equal(adapted.syncState, "blocked");
  assert.equal(adapted.syncIssue, "failed");
  assert.equal(adapted.syncError, "invalid_backend_response");
});

test("journal adapter classifies revision conflicts and keeps blocked deletions visible", () => {
  const cache = normalizeJournalCache({
    version: 2,
    entries: {
      [cachedEntry.input.id]: { ...cachedEntry, deleted: true, sync: "blocked" },
    },
    jobs: [{
      id: "operation-conflict",
      userId: "account-a",
      entryId: cachedEntry.input.id,
      endpoint: "correct-entry",
      payload: {
        action: "delete",
        operation_id: "operation-conflict",
        id: cachedEntry.input.id,
        expected_revision: 1,
      },
      state: "blocked",
      attempts: 1,
      nextAttemptAt: 0,
      error: "revision_or_idempotency_conflict",
    }],
  });

  const entries = journalEntriesFromCache(cache);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].syncState, "blocked");
  assert.equal(entries[0].syncIssue, "conflict");
});

test("journal adapter exposes only the saved coarse place label", () => {
  const withPlace: CachedEntry = {
    ...cachedEntry,
    input: { ...cachedEntry.input, approximate_place: "Chennai, Tamil Nadu, India" },
  };
  const cache = normalizeJournalCache({
    version: 2,
    entries: { [withPlace.input.id]: withPlace },
    jobs: [],
  });

  const entry = journalEntriesFromCache(cache)[0];
  assert.deepEqual(entry.sources[1], {
    title: "Approximate place",
    detail: "Chennai, Tamil Nadu, India",
    icon: "location",
  });
});

test("text correction matches transaction IDs and preserves collapsed categories", () => {
  const extraction = correctedTextExtraction(cachedEntry, {
    ...journalEntriesFromCache(normalizeJournalCache({
      version: 1,
      entries: { [cachedEntry.input.id]: cachedEntry },
      jobs: [],
    }))[0],
    items: [{
      id: "transaction-1",
      name: "Rent and maintenance",
      quantity: 1,
      amountMinor: 125000,
      category: "other",
      categoryId: "bills",
    }],
  });
  assert.equal(extraction.transactions[0].category_id, "bills");
  assert.equal(extraction.transactions[0].amount_minor, "125000");
  assert.equal(extraction.transactions[0].category_source, "user_correction");
});

test("quantity describes an already-total backend amount without multiplying it again", () => {
  const threeCoffees: CachedEntry = {
    ...cachedEntry,
    extraction: {
      ...cachedEntry.extraction,
      transactions: [{
        ...transaction,
        description: "3 coffees",
        amount_minor: "45000",
        quantity: 3,
        unit_price_minor: null,
      }],
    },
  };
  const entry = journalEntriesFromCache(normalizeJournalCache({
    version: 1,
    entries: { [threeCoffees.input.id]: threeCoffees },
    jobs: [],
  }))[0];

  assert.equal(entry.items[0].amountMinor, 45000);
  assert.equal(entryTotal(entry), 45000);

  const corrected = correctedTextExtraction(threeCoffees, entry);
  assert.equal(corrected.transactions[0].amount_minor, "45000");
  assert.equal(corrected.transactions[0].unit_price_minor, null);
});

test("editing note text does not turn a missing amount into a confirmed zero", () => {
  const missing = {
    ...cachedEntry,
    extraction: {
      ...cachedEntry.extraction,
      transactions: [{
        ...transaction,
        amount_minor: null,
        amount_status: "missing",
        needs_review: true,
        unresolved: ["amount"],
      }],
    },
  };
  const adapted = journalEntriesFromCache(normalizeJournalCache({
    version: 1,
    entries: { [missing.input.id]: missing },
    jobs: [],
  }))[0];
  const corrected = correctedTextExtraction(missing, {
    ...adapted,
    note: "monthly rent",
  });
  assert.equal(corrected.transactions[0].amount_minor, null);
  assert.equal(corrected.transactions[0].amount_status, "missing");
  assert.equal(corrected.transactions[0].needs_review, true);
});

test("preset capture contains its durable amount and category context", () => {
  assert.equal(presetCaptureText({
    id: "coffee",
    name: "Morning coffee",
    note: "my usual coffee",
    amountMinor: 18050,
    category: "food",
  }), "my usual coffee · 180.50 food");
});
