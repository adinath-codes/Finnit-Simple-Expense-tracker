// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import test from "node:test";
import {
  currentPreferences,
  journalCacheKey,
  normalizeJournalCache,
} from "../../src/lib/offline/cache-schema.ts";
import {
  correctedTextExtraction,
  journalEntriesFromCache,
  receiptDisplayTotal,
  receiptJournalEntry,
  receiptJournalText,
} from "../../src/features/journal/services/journal-adapter.ts";
import { entryTotal } from "../../src/utils/amounts.ts";
import {
  presetCaptureText,
  presetNameFromEntry,
} from "../../src/features/presets/services/preset-format.ts";
import {
  amountBreakdownText,
  deriveAmountBreakdown,
  deriveAllocationRows,
  deriveReceiptAmountBreakdown,
} from "../../src/features/entries/services/breakdown-service.ts";
import type { CachedEntry, JournalCache } from "../../src/types/sync.ts";
import { targetedCacheCopy } from "../../src/lib/offline/cache-mutation.ts";
import {
  applyJournalEntryDeletion,
  classifyJournalEdit,
  followDeletedEntryAfterSync,
  planEntryTextSave,
} from "../../src/features/journal/services/journal-edit-flow.ts";
import {
  exhaustedAiValidationRetries,
  MAX_AUTOMATIC_AI_VALIDATION_ATTEMPTS,
} from "../../src/lib/offline/sync-retry-policy.ts";
import { presetExtraction } from "../../supabase/functions/_shared/preset.ts";

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

test("repeated AI validation failures stop while connectivity failures stay deferred", () => {
  const job = {
    id: "operation-1",
    userId: "account-a",
    entryId: cachedEntry.input.id,
    endpoint: "correct-entry" as const,
    payload: {
      action: "ai_correct" as const,
      operation_id: "operation-1",
      id: cachedEntry.input.id,
      expected_revision: 1,
      instruction: "change amount to 6",
    },
    state: "pending" as const,
    attempts: 0,
    nextAttemptAt: 0,
  };

  assert.equal(exhaustedAiValidationRetries(
    job,
    "ungrounded_amount",
    MAX_AUTOMATIC_AI_VALIDATION_ATTEMPTS - 1,
  ), false);
  assert.equal(exhaustedAiValidationRetries(
    job,
    "ungrounded_amount",
    MAX_AUTOMATIC_AI_VALIDATION_ATTEMPTS,
  ), true);
  assert.equal(exhaustedAiValidationRetries(job, "ai_unavailable", 20), false);
  assert.equal(exhaustedAiValidationRetries(job, "connection_unavailable", 20), false);
});

test("journal text edits distinguish unchanged, deleted, and changed drafts", () => {
  assert.equal(classifyJournalEdit("Coffee 120", " Coffee 120 "), "unchanged");
  assert.equal(classifyJournalEdit("Coffee 120", "   "), "delete");
  assert.equal(classifyJournalEdit("Coffee 120", "Coffee with Sam 120"), "changed");
});

test("preserved text edits retain extraction while recalculation omits it", () => {
  const preserved = planEntryTextSave(cachedEntry, " Coffee with Sam 120 ", "preserve");
  assert.equal(preserved.input.raw_text, "Coffee with Sam 120");
  assert.equal(preserved.extraction, cachedEntry.extraction);

  const recalculated = planEntryTextSave(cachedEntry, "Coffee with Sam 140", "recalculate");
  assert.equal(recalculated.input.raw_text, "Coffee with Sam 140");
  assert.equal(recalculated.extraction, undefined);
});

test("deleting a retry-queued local entry hides it and preserves only uncertain work", () => {
  const id = cachedEntry.input.id;
  const cache = normalizeJournalCache({
    version: 3,
    entries: { [id]: { ...cachedEntry } },
    jobs: [{
      id,
      userId: "account-a",
      entryId: id,
      endpoint: "parse-entry",
      payload: cachedEntry.input,
      state: "pending",
      attempts: 2,
      nextAttemptAt: Date.now() + 30_000,
    }],
  });

  applyJournalEntryDeletion(cache, id, "account-a", "delete-operation");

  assert.equal(cache.entries[id].deleted, true);
  assert.equal(journalEntriesFromCache(cache).length, 0);
  assert.equal(cache.jobs.length, 1);
  assert.equal(cache.jobs[0].endpoint, "parse-entry");
});

test("a legacy deleted tombstone stays hidden even when its old job is blocked", () => {
  const id = cachedEntry.input.id;
  const cache = normalizeJournalCache({
    version: 3,
    entries: { [id]: { ...cachedEntry, deleted: true, sync: "blocked" } },
    jobs: [{
      id,
      userId: "account-a",
      entryId: id,
      endpoint: "parse-entry",
      payload: cachedEntry.input,
      state: "blocked",
      attempts: 4,
      nextAttemptAt: 0,
      error: "ungrounded_equal_split",
    }],
  });

  assert.equal(journalEntriesFromCache(cache).length, 0);
  assert.equal(cache.jobs.length, 1);
});

test("deleting an unsent local entry cancels its work and removes it", () => {
  const id = cachedEntry.input.id;
  const cache = normalizeJournalCache({
    version: 3,
    entries: { [id]: { ...cachedEntry } },
    jobs: [{
      id,
      userId: "account-a",
      entryId: id,
      endpoint: "parse-entry",
      payload: cachedEntry.input,
      state: "pending",
      attempts: 0,
      nextAttemptAt: 0,
    }],
  });

  applyJournalEntryDeletion(cache, id, "account-a", "delete-operation");

  assert.equal(cache.entries[id], undefined);
  assert.equal(cache.jobs.length, 0);
});

test("a deleted retry queues the remote delete after its in-flight result lands", () => {
  const id = cachedEntry.input.id;
  const cache = normalizeJournalCache({
    version: 3,
    entries: { [id]: { ...cachedEntry, deleted: true } },
    jobs: [],
  });
  const remote = {
    id,
    raw_text: cachedEntry.input.raw_text,
    original_text: cachedEntry.input.raw_text,
    captured_at: cachedEntry.input.captured_at,
    occurred_on: cachedEntry.input.selected_date,
    timezone: cachedEntry.input.timezone,
    currency: cachedEntry.input.currency,
    revision: 4,
    extraction: cachedEntry.extraction,
    deleted_at: null,
    capture_request: cachedEntry.input,
  };

  assert.equal(followDeletedEntryAfterSync(
    cache,
    id,
    "account-a",
    remote,
    "delete-operation",
  ), true);
  assert.equal(cache.entries[id].deleted, true);
  assert.equal(cache.jobs.length, 1);
  assert.equal(cache.jobs[0].payload.action, "delete");
  assert.equal(cache.jobs[0].payload.expected_revision, 4);
});

test("targeted cache copies preserve untouched entity references", () => {
  const other = {
    ...cachedEntry,
    input: { ...cachedEntry.input, id: "44444444-4444-4444-8444-444444444444" },
  };
  const cache = normalizeJournalCache({
    version: 3,
    entries: { [cachedEntry.input.id]: cachedEntry, [other.input.id]: other },
    jobs: [],
  });
  const next = targetedCacheCopy(cache, {
    entryIds: [cachedEntry.input.id],
    jobs: true,
    affectsContent: true,
  });
  assert.notEqual(next, cache);
  assert.notEqual(next.entries, cache.entries);
  assert.notEqual(next.entries[cachedEntry.input.id], cache.entries[cachedEntry.input.id]);
  assert.equal(next.entries[other.input.id], cache.entries[other.input.id]);
  assert.notEqual(next.jobs, cache.jobs);
  assert.equal(next.receipts, cache.receipts);
  assert.equal(next.local, cache.local);
});

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
  assert.equal(migrated.version, 3);
  assert.equal(migrated.entries[cachedEntry.input.id].input.raw_text, "rent 1200");
  assert.equal(migrated.jobs.length, 1);
  assert.deepEqual(migrated.local.presets, []);
  assert.equal(migrated.local.settings.currency, "INR");
});

test("v3 normalization retains receipt lines, local images, conflicts and pending jobs", () => {
  const receiptId = "22222222-2222-4222-8222-222222222222";
  const request = {
    entry_id: receiptId,
    attachment_id: "33333333-3333-4333-8333-333333333333",
    captured_at: "2026-09-20T11:00:00.000Z",
    timezone: "Asia/Kolkata",
    selected_date: "2026-09-20",
    default_currency: "INR",
  };
  const line = { id: "line-1", ordinal: 0, kind: "item", description: "Coffee",
    amount_minor: "180", currency: "INR" };
  const shadow = { id: receiptId, revision: 3, source_type: "receipt",
    receipt: { lines: [line] } };
  const job = { id: "scan-1", userId: "account-a", entryId: receiptId,
    endpoint: "scan-receipt", payload: request, state: "pending", attempts: 0,
    nextAttemptAt: 0 };
  const migrated = normalizeJournalCache({
    version: 3, entries: {},
    receipts: { [receiptId]: {
      request, localUri: "file:///pending-receipt.jpg", width: 1200, height: 1800,
      prepared: true, status: "queued", lines: [line], remoteShadow: shadow,
    } },
    jobs: [job],
    metadata: { lastServerRevision: "12", contentVersion: 7,
      sqliteMigrationVersion: 0,
      validatedAt: { journal: 1, settings: 2, presets: 3, contexts: 4 } },
  });
  assert.equal(migrated.receipts[receiptId].localUri, "file:///pending-receipt.jpg");
  assert.deepEqual(migrated.receipts[receiptId].lines, [line]);
  assert.deepEqual(migrated.receipts[receiptId].remoteShadow, shadow);
  assert.deepEqual(migrated.jobs[0].payload, request);
  assert.equal(migrated.metadata.lastServerRevision, "12");
  assert.equal(migrated.metadata.contentVersion, 7);
});

test("journal cache keys isolate accounts", () => {
  assert.notEqual(journalCacheKey("account-a"), journalCacheKey("account-b"));
});

test("retired location and Back Tap opt-ins stay off in legacy settings", () => {
  const legacy = currentPreferences({
    currency: "USD",
    location: true,
    backTapQuickAdd: true,
  });
  assert.equal(legacy.currency, "USD");
  assert.equal(legacy.location, false);
  assert.equal(legacy.backTapQuickAdd, false);

  const cache = normalizeJournalCache({
    version: 2,
    entries: {},
    jobs: [],
    local: { settings: { ...legacy, location: true, backTapQuickAdd: true } },
  });
  assert.equal(cache.local.settings.location, false);
  assert.equal(cache.local.settings.backTapQuickAdd, false);
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

test("receipt journal text prefers a trimmed merchant and never lists adjustments", () => {
  const lines = [
    { kind: "tax", description: "GST" },
    { kind: "item", description: " Coffee " },
    { kind: "discount", description: "Coupon" },
    { kind: "item", description: "bread" },
    { kind: "tip", description: "Tip" },
    { kind: "item", description: "Milk" },
    { kind: "fee", description: "Service fee" },
  ];
  assert.equal(receiptJournalText("  Cafe North  ", lines), "Purchase from Cafe North");
  assert.equal(receiptJournalText(null, lines.slice(0, 2)), "Purchased Coffee");
  assert.equal(receiptJournalText(null, lines.slice(0, 4)), "Purchased Coffee, bread");
  assert.equal(receiptJournalText(null, lines), "Purchased Coffee, bread + 1 more");
  assert.equal(receiptJournalText("  ", lines.filter((line) => line.kind !== "item")), "Scanned receipt");
  assert.equal(receiptJournalText(null, [{ kind: "item", description: "  " }]), "Scanned receipt");
});

test("receipt breakdown uses exact printed line amounts without multiplying twice", () => {
  const lines = [
    {
      ordinal: 0, kind: "item", description: "Coffee", quantity: 2,
      unit_price_minor: "6000", amount_minor: "12000", currency: "INR",
      needs_review: false, provisional: false,
    },
    {
      ordinal: 1, kind: "item", description: "Bread", quantity: 3,
      unit_price_minor: null, amount_minor: "10000", currency: "INR",
      needs_review: true, provisional: false,
    },
    {
      ordinal: 2, kind: "discount", description: "Coupon", quantity: null,
      unit_price_minor: null, amount_minor: "-2000", currency: "INR",
      needs_review: false, provisional: false,
    },
  ];
  const terms = deriveReceiptAmountBreakdown(lines, "receipt-1");
  assert.deepEqual(terms.map(({ factors, unitAmountMinor, approximate }) => ({
    factors, unitAmountMinor, approximate,
  })), [
    { factors: [2], unitAmountMinor: 6000, approximate: false },
    { factors: [1], unitAmountMinor: 10000, approximate: true },
    { factors: [1], unitAmountMinor: -2000, approximate: false },
  ]);
  assert.equal(amountBreakdownText(terms), "2 * ₹60 + 1 * ₹100 + 1 * ₹-20");
});

test("receipt display total prefers print, then lines, without relaxing accounting", () => {
  const line = (ordinal, amountMinor, needsReview = false) => ({
    ordinal, kind: "item", description: `Item ${ordinal}`, quantity: 1,
    unit_price_minor: null, amount_minor: String(amountMinor), currency: "INR",
    category_id: "food", confidence: 1, needs_review: needsReview,
    evidence_text: `Item ${ordinal} ${amountMinor}`, provisional: false,
  });
  const request = {
    entry_id: "22222222-2222-4222-8222-222222222222",
    attachment_id: "33333333-3333-4333-8333-333333333333",
    captured_at: "2026-09-20T11:00:00.000Z",
    timezone: "Asia/Kolkata",
    selected_date: "2026-09-20",
    default_currency: "INR",
  };
  const receipt = {
    request, width: 1200, height: 1800, prepared: true,
    status: "needs_review", lines: [line(0, 12000), line(1, 3000, true)],
    attachment: {
      id: request.attachment_id, status: "needs_review", merchant_name: null,
      purchase_date_text: null, printed_subtotal_minor: null,
      printed_total_minor: "17000", currency: "INR", confidence: 0.7,
      needs_review: true, truncated: false, model: "test", lines: [],
    },
    remote: {
      ...request, source_type: "receipt", raw_text: null, original_text: null,
      occurred_on: request.selected_date, currency: "INR", revision: 1,
      deleted_at: null, extraction: {
        transactions: [
          { ...transaction, amount_minor: "12000", needs_review: false },
          { ...transaction, amount_minor: "3000", needs_review: true },
        ],
        people: [], contexts: [], unresolved: [],
      },
    },
  };
  const entry = receiptJournalEntry(receipt, { syncState: "synced" });
  assert.equal(entry.note, "Purchased Item 0, Item 1");
  assert.deepEqual(receiptDisplayTotal(entry, "USD"), { amountMinor: 17000, currency: "INR" });
  assert.equal(entryTotal(entry), 12000);

  const withoutPrint = receiptJournalEntry({
    ...receipt,
    attachment: { ...receipt.attachment, printed_total_minor: null },
  }, { syncState: "synced" });
  assert.deepEqual(receiptDisplayTotal(withoutPrint, "USD"), { amountMinor: 15000, currency: "INR" });
  assert.equal(entryTotal(withoutPrint), 12000);
  assert.equal(receiptDisplayTotal({ ...entry, receipt: { ...entry.receipt, status: "scanning" } }, "INR"), null);
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

test("hierarchical categories retain their top-level journal presentation", () => {
  const categorized: CachedEntry = {
    ...cachedEntry,
    extraction: {
      ...cachedEntry.extraction,
      transactions: [{
        ...transaction,
        category_id: "transport.ride_hailing",
      }],
    },
  };
  const entry = journalEntriesFromCache(normalizeJournalCache({
    version: 3,
    entries: { [categorized.input.id]: categorized },
    jobs: [],
  }))[0];
  assert.equal(entry.category, "transport");
  assert.equal(entry.items[0].category, "transport");
  assert.equal(entry.items[0].categoryId, "transport.ride_hailing");
});

test("journal adapter never resurrects a blocked delete as a visible entry", () => {
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
  assert.equal(entries.length, 0);
  assert.equal(cache.jobs.length, 1);
  assert.equal(cache.jobs[0].error, "revision_or_idempotency_conflict");
});

test("amount breakdown uses only literal multiplication and addition", () => {
  const extraction = {
    transactions: [{ ...transaction, amount_minor: "40000" }],
    people: [], contexts: [], unresolved: [],
    amount_components: [{
      transaction_ordinal: 0, ordinal: 0, label: "ride", quantity: 1,
      unit_price_minor: "10000", line_total_minor: "10000", semantic_role: "item",
      confidence: 1, evidence: { text: "1 * 100", start: 0, end: 7 }, needs_review: false,
    }, {
      transaction_ordinal: 0, ordinal: 1, label: "snacks", quantity: 5,
      unit_price_minor: "6000", line_total_minor: "30000", semantic_role: "item",
      confidence: 1, evidence: { text: "5 * 60", start: 10, end: 16 }, needs_review: false,
    }],
  };
  const expression = amountBreakdownText(deriveAmountBreakdown(extraction, "entry"));
  assert.equal(expression, "1 * ₹100 + 5 * ₹60");
  assert.equal(expression.includes("="), false);
  assert.equal(expression.includes("×"), false);
});

test("canonical group entry derives ride/share factors and participant rows", () => {
  const extraction = {
    transactions: [{
      ...transaction,
      description: "2 uber rides along with 3 friends costing 1000 in total",
      amount_minor: "100000",
      group_total_minor: "100000",
      user_share_minor: "33400",
      quantity: 2,
      participant_count: 3,
      primary_amount_role: "group_total",
      split_method: "equal",
      breakdown_approximate: true,
    }],
    people: [], contexts: [], unresolved: [],
    participants: [{
      transaction_ordinal: 0, party_kind: "anonymous_group", display_name: null,
      participant_count: 2, role: "participant", share_minor: "66600",
      share_percentage: null, split_method: "equal", confidence: 1,
      evidence: null, needs_review: false,
    }, {
      transaction_ordinal: 0, party_kind: "self", display_name: null,
      participant_count: 1, role: "participant", share_minor: "33400",
      share_percentage: null, split_method: "equal", confidence: 1,
      evidence: null, needs_review: false,
    }],
  };
  const terms = deriveAmountBreakdown(extraction, "entry");
  assert.equal(amountBreakdownText(terms), "2 * 3 * ₹166");
  assert.equal(terms[0].approximate, true);
  assert.deepEqual(
    deriveAllocationRows(extraction, "entry").map(({ label, amountMinor }) => [label, amountMinor]),
    [["Friend 1", 33300], ["Friend 2", 33300], ["You", 33400]],
  );
});

test("AI correction jobs retain old extraction and expose pending action", () => {
  const priorSummary = "You spent 1,200 on rent.";
  const cache = normalizeJournalCache({
    version: 3,
    entries: {
      [cachedEntry.input.id]: {
        ...cachedEntry,
        extraction: {
          ...cachedEntry.extraction,
          interpretation_summary: priorSummary,
        },
      },
    },
    jobs: [{
      id: "44444444-4444-4444-8444-444444444444",
      userId: "account-a",
      entryId: cachedEntry.input.id,
      endpoint: "correct-entry",
      payload: {
        action: "ai_correct",
        operation_id: "44444444-4444-4444-8444-444444444444",
        id: cachedEntry.input.id,
        expected_revision: 2,
        instruction: "The amount was equally split",
      },
      state: "pending", attempts: 0, nextAttemptAt: 0,
    }],
  });
  const adapted = journalEntriesFromCache(cache)[0];
  assert.equal(adapted.pendingAction, "ai_correct");
  assert.equal(adapted.items[0].amountMinor, 120000);
  assert.equal(adapted.thought, priorSummary);
  assert.equal(cache.entries[cachedEntry.input.id].input.raw_text, "rent 1200");
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

test("structured arithmetic is exposed per term while totals use the user's known share", () => {
  const calculated: CachedEntry = {
    ...cachedEntry,
    sync: "synced",
    extraction: {
      ...cachedEntry.extraction,
      schema_version: 2,
      interpretation_summary: "Three grounded price terms; the user's share is explicit.",
      transactions: [{
        ...transaction,
        description: "2*100 + 1*100 + 3*200",
        amount_minor: "90000",
        primary_amount_role: "group_total",
        group_total_minor: "90000",
        user_share_minor: "30000",
        paid_by_user_minor: null,
        participant_count: 3,
        split_method: "exact",
      }],
      amount_components: [
        { transaction_ordinal: 0, ordinal: 0, label: "First", quantity: 2, unit_price_minor: "10000", line_total_minor: "20000", semantic_role: "item", confidence: 1, evidence: { text: "2*100", start: 0, end: 5 }, needs_review: false },
        { transaction_ordinal: 0, ordinal: 1, label: "Second", quantity: 1, unit_price_minor: "10000", line_total_minor: "10000", semantic_role: "item", confidence: 1, evidence: { text: "1*100", start: 8, end: 13 }, needs_review: false },
        { transaction_ordinal: 0, ordinal: 2, label: "Third", quantity: 3, unit_price_minor: "20000", line_total_minor: "60000", semantic_role: "item", confidence: 1, evidence: { text: "3*200", start: 16, end: 21 }, needs_review: false },
      ],
    },
  };
  const adapted = journalEntriesFromCache(normalizeJournalCache({
    version: 3,
    entries: { [calculated.input.id]: calculated },
    jobs: [],
  }))[0];

  assert.deepEqual(
    adapted.items[0].components?.map(({ quantity, unitPriceMinor, lineTotalMinor }) => ({
      quantity, unitPriceMinor, lineTotalMinor,
    })),
    [
      { quantity: 2, unitPriceMinor: 10000, lineTotalMinor: 20000 },
      { quantity: 1, unitPriceMinor: 10000, lineTotalMinor: 10000 },
      { quantity: 3, unitPriceMinor: 20000, lineTotalMinor: 60000 },
    ],
  );
  assert.equal(adapted.items[0].amountMinor, 90000);
  assert.equal(entryTotal(adapted), 30000);
  assert.equal(adapted.thought, calculated.extraction.interpretation_summary);
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

test("preset capture keeps a clean visible note while its snapshot owns facts", () => {
  assert.equal(presetCaptureText({
    id: "coffee",
    name: "Morning coffee",
    note: "my usual coffee",
    amountMinor: 18050,
    category: "food",
  }), "my usual coffee");
  assert.equal(presetNameFromEntry("coffee for 4.50"), "coffee");
  assert.equal(presetNameFromEntry("Bus 42 · €2.50"), "Bus 42");
  assert.equal(presetNameFromEntry("180"), "Saved expense");
});

test("manual capture records deterministic manual provenance", () => {
  const result = presetExtraction({
    id: "manual-1",
    name: "Lunch",
    note: "Lunch",
    amount_minor: "1299",
    category_id: "food",
  }, {
    id: "entry-1",
    raw_text: "Lunch",
    captured_at: "2026-09-29T12:00:00.000Z",
    timezone: "Asia/Kolkata",
    currency: "USD",
    selected_date: "2026-09-29",
  }, "manual");

  assert.equal(
    result.interpretation_summary,
    "This spending was added manually with a confirmed amount and category.",
  );
  assert.equal(result.transactions[0].amount_minor, "1299");
  assert.equal(result.transactions[0].category_source, "user_correction");
});

test("streamed amount preview survives normalization but never enters totals", () => {
  const pending: CachedEntry = {
    ...cachedEntry,
    amountPreview: {
      amount_minor: "12000",
      currency: "INR",
      scope: "personal_total",
      estimated: true,
      needs_review: false,
    },
    extraction: {
      ...cachedEntry.extraction,
      transactions: [{
        ...transaction,
        amount_minor: null,
        amount_status: "missing",
        user_share_minor: null,
        group_total_minor: null,
        needs_review: true,
        unresolved: ["gemini_pending"],
      }],
    },
  };
  const normalized = normalizeJournalCache({
    version: 3,
    entries: { [pending.input.id]: pending },
    jobs: [],
  });
  assert.deepEqual(normalized.entries[pending.input.id].amountPreview, pending.amountPreview);
  const adapted = journalEntriesFromCache(normalized)[0];
  assert.equal(adapted.amountPreview?.amountMinor, 12000);
  assert.equal(entryTotal(adapted), 0);

  const finalized = normalizeJournalCache({
    ...normalized,
    entries: {
      [pending.input.id]: {
        ...pending,
        amountPreview: undefined,
        extraction: cachedEntry.extraction,
        sync: "synced",
      },
    },
  });
  const finalEntry = journalEntriesFromCache(finalized)[0];
  assert.equal(finalEntry.amountPreview, undefined);
  assert.equal(entryTotal(finalEntry), 120000);
});
