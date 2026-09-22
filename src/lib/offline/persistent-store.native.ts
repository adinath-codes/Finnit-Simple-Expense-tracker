import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SQLiteDatabase } from "expo-sqlite";
import type { CachedReceipt, JournalCache } from "@/types/sync";
import {
  emptyJournalCache,
  journalCacheKey,
  legacyJournalCacheKey,
  normalizeJournalCache,
  previousJournalCacheKey,
} from "./cache-schema";
import { getOfflineDatabase, OFFLINE_SQLITE_VERSION } from "./sqlite.native";
import type { PersistentCacheStore } from "./persistent-store.types";

type PayloadRow = { id: string; payload: string };
type ReceiptLineRow = { entry_id: string; payload: string };

function encoded(value: unknown) {
  return JSON.stringify(value);
}

function statePayload(cache: JournalCache) {
  return {
    version: cache.version,
    metadata: {
      ...cache.metadata,
      sqliteMigrationVersion: OFFLINE_SQLITE_VERSION,
    },
    catalog: cache.catalog,
    settingsInitialized: cache.local.settingsInitialized,
    legacyPreferencesImported: cache.local.legacyPreferencesImported,
  };
}

function receiptWithoutLines(receipt: CachedReceipt) {
  return {
    ...receipt,
    lines: [],
    ...(receipt.attachment
      ? { attachment: { ...receipt.attachment, lines: [] } }
      : {}),
  };
}

function rowMap<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item]));
}

async function syncPayloadRows(
  db: SQLiteDatabase,
  table: "journal_entries" | "presets" | "goals",
  userId: string,
  previous: Map<string, unknown>,
  next: Map<string, unknown>,
  capturedAt?: (value: unknown) => string,
) {
  for (const id of previous.keys()) {
    if (!next.has(id)) {
      await db.runAsync(`DELETE FROM ${table} WHERE user_id=? AND id=?`, userId, id);
    }
  }
  for (const [id, value] of next) {
    if (previous.has(id) && encoded(previous.get(id)) === encoded(value)) continue;
    if (capturedAt) {
      await db.runAsync(
        `INSERT INTO ${table}(user_id,id,captured_at,payload) VALUES(?,?,?,?)
         ON CONFLICT(user_id,id) DO UPDATE SET
           captured_at=excluded.captured_at,payload=excluded.payload`,
        userId, id, capturedAt(value), encoded(value),
      );
    } else {
      await db.runAsync(
        `INSERT INTO ${table}(user_id,id,payload) VALUES(?,?,?)
         ON CONFLICT(user_id,id) DO UPDATE SET payload=excluded.payload`,
        userId, id, encoded(value),
      );
    }
  }
}

async function writeCache(
  db: SQLiteDatabase,
  userId: string,
  previous: JournalCache | null,
  next: JournalCache,
  verifyMigration = false,
) {
  const empty = emptyJournalCache();
  const before = previous ?? empty;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    if (verifyMigration) {
      // A prior interrupted development build may have written rows without
      // the completion marker. Clear only this account inside the transaction.
      for (const table of [
        "ask_result_cache", "cache_metric_buffer", "outbox_jobs",
        "receipt_lines", "receipts", "journal_entries",
        "presets", "goals", "settings", "account_state",
      ]) {
        await transaction.runAsync(`DELETE FROM ${table} WHERE user_id=?`, userId);
      }
    }
    await syncPayloadRows(
      transaction,
      "journal_entries",
      userId,
      new Map(Object.entries(before.entries)),
      new Map(Object.entries(next.entries)),
      (value) => (value as JournalCache["entries"][string]).input.captured_at,
    );

    const beforeReceipts = new Map(Object.entries(before.receipts));
    const nextReceipts = new Map(Object.entries(next.receipts));
    for (const id of beforeReceipts.keys()) {
      if (!nextReceipts.has(id)) {
        await transaction.runAsync(
          "DELETE FROM receipts WHERE user_id=? AND entry_id=?",
          userId, id,
        );
      }
    }
    for (const [id, receipt] of nextReceipts) {
      const previousReceipt = beforeReceipts.get(id);
      if (previousReceipt && encoded(previousReceipt) === encoded(receipt)) continue;
      await transaction.runAsync(
        `INSERT INTO receipts(user_id,entry_id,captured_at,payload) VALUES(?,?,?,?)
         ON CONFLICT(user_id,entry_id) DO UPDATE SET
           captured_at=excluded.captured_at,payload=excluded.payload`,
        userId, id, receipt.request.captured_at,
        encoded(receiptWithoutLines(receipt)),
      );
      await transaction.runAsync(
        "DELETE FROM receipt_lines WHERE user_id=? AND entry_id=?",
        userId, id,
      );
      for (const line of receipt.lines) {
        await transaction.runAsync(
          "INSERT INTO receipt_lines(user_id,entry_id,ordinal,payload) VALUES(?,?,?,?)",
          userId, id, line.ordinal, encoded(line),
        );
      }
    }

    const beforeJobs = new Map(before.jobs.map((job) => [job.id, job]));
    const nextJobs = new Map(next.jobs.map((job) => [job.id, job]));
    for (const id of beforeJobs.keys()) {
      if (!nextJobs.has(id)) {
        await transaction.runAsync(
          "DELETE FROM outbox_jobs WHERE user_id=? AND id=?", userId, id,
        );
      }
    }
    for (const [id, job] of nextJobs) {
      if (beforeJobs.has(id) && encoded(beforeJobs.get(id)) === encoded(job)) continue;
      await transaction.runAsync(
        `INSERT INTO outbox_jobs(user_id,id,entry_id,next_attempt_at,payload)
         VALUES(?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET
           entry_id=excluded.entry_id,next_attempt_at=excluded.next_attempt_at,
           payload=excluded.payload`,
        userId, id, job.entryId, job.nextAttemptAt, encoded(job),
      );
    }

    await syncPayloadRows(
      transaction, "presets", userId,
      rowMap(before.local.presets), rowMap(next.local.presets),
    );
    await syncPayloadRows(
      transaction, "goals", userId,
      rowMap(before.local.goals), rowMap(next.local.goals),
    );
    if (encoded(before.local.settings) !== encoded(next.local.settings) || !previous) {
      await transaction.runAsync(
        `INSERT INTO settings(user_id,payload) VALUES(?,?)
         ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload`,
        userId, encoded(next.local.settings),
      );
    }
    if (verifyMigration) await verifyMigrationRows(transaction, userId, next);
    await transaction.runAsync(
      `INSERT INTO account_state(user_id,payload) VALUES(?,?)
       ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload`,
      userId, encoded(statePayload(next)),
    );
  });
}

async function rowCount(db: SQLiteDatabase, table: string, userId: string) {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT count(*) count FROM ${table} WHERE user_id=?`, userId,
  );
  return row?.count ?? 0;
}

async function verifyMigrationRows(
  db: SQLiteDatabase,
  userId: string,
  expected: JournalCache,
) {
  const expectedCounts: [string, number][] = [
    ["journal_entries", Object.keys(expected.entries).length],
    ["receipts", Object.keys(expected.receipts).length],
    ["receipt_lines", Object.values(expected.receipts)
      .reduce((total, receipt) => total + receipt.lines.length, 0)],
    ["outbox_jobs", expected.jobs.length],
    ["presets", expected.local.presets.length],
    ["goals", expected.local.goals.length],
    ["settings", 1],
  ];
  for (const [table, count] of expectedCounts) {
    if (await rowCount(db, table, userId) !== count) {
      throw new Error(`Offline migration count mismatch: ${table}.`);
    }
  }

  const expectedIds: [string, string, string[]][] = [
    ["journal_entries", "id", Object.keys(expected.entries)],
    ["receipts", "entry_id", Object.keys(expected.receipts)],
    ["outbox_jobs", "id", expected.jobs.map((job) => job.id)],
    ["presets", "id", expected.local.presets.map((preset) => preset.id)],
    ["goals", "id", expected.local.goals.map((goal) => goal.id)],
  ];
  for (const [table, idColumn, ids] of expectedIds) {
    const rows = await db.getAllAsync<{ id: string }>(
      `SELECT ${idColumn} id FROM ${table} WHERE user_id=?`, userId,
    );
    const actual = rows.map((row) => row.id).sort();
    if (encoded(actual) !== encoded([...ids].sort())) {
      throw new Error(`Offline migration ID mismatch: ${table}.`);
    }
  }

  const storedJobs = await db.getAllAsync<{ payload: string }>(
    "SELECT payload FROM outbox_jobs WHERE user_id=?", userId,
  );
  for (const job of expected.jobs) {
    if (!storedJobs.some(({ payload }) => {
      const candidate = JSON.parse(payload) as typeof job;
      return candidate.id === job.id && encoded(candidate.payload) === encoded(job.payload);
    })) throw new Error("Offline outbox migration verification failed.");
  }

  // Decode representative payloads before the completion marker is written.
  for (const table of [
    "journal_entries", "receipts", "receipt_lines", "outbox_jobs",
    "presets", "goals", "settings",
  ]) {
    const row = await db.getFirstAsync<{ payload: string }>(
      `SELECT payload FROM ${table} WHERE user_id=? LIMIT 1`, userId,
    );
    if (row) JSON.parse(row.payload);
  }
}

async function readSqlite(userId: string): Promise<JournalCache | null> {
  const db = await getOfflineDatabase();
  const state = await db.getFirstAsync<{ payload: string }>(
    "SELECT payload FROM account_state WHERE user_id=?", userId,
  );
  if (!state) return null;
  const [entries, receipts, lines, jobs, settings, presets, goals] = await Promise.all([
    db.getAllAsync<PayloadRow>(
      "SELECT id,payload FROM journal_entries WHERE user_id=?", userId,
    ),
    db.getAllAsync<{ id: string; payload: string }>(
      "SELECT entry_id id,payload FROM receipts WHERE user_id=?", userId,
    ),
    db.getAllAsync<ReceiptLineRow>(
      "SELECT entry_id,payload FROM receipt_lines WHERE user_id=? ORDER BY entry_id,ordinal",
      userId,
    ),
    db.getAllAsync<{ payload: string }>(
      "SELECT payload FROM outbox_jobs WHERE user_id=? ORDER BY rowid", userId,
    ),
    db.getFirstAsync<{ payload: string }>(
      "SELECT payload FROM settings WHERE user_id=?", userId,
    ),
    db.getAllAsync<PayloadRow>(
      "SELECT id,payload FROM presets WHERE user_id=? ORDER BY rowid", userId,
    ),
    db.getAllAsync<PayloadRow>(
      "SELECT id,payload FROM goals WHERE user_id=? ORDER BY rowid", userId,
    ),
  ]);
  if (!settings) throw new Error("Offline settings are missing.");
  const metadata = JSON.parse(state.payload) as {
    version: number;
    metadata: JournalCache["metadata"];
    catalog?: JournalCache["catalog"];
    settingsInitialized: boolean;
    legacyPreferencesImported: boolean;
  };
  const receiptLines = new Map<string, CachedReceipt["lines"]>();
  for (const row of lines) {
    const list = receiptLines.get(row.entry_id) ?? [];
    list.push(JSON.parse(row.payload));
    receiptLines.set(row.entry_id, list);
  }
  const receiptRecords = Object.fromEntries(receipts.map((row) => {
    const receipt = JSON.parse(row.payload) as CachedReceipt;
    const storedLines = receiptLines.get(row.id) ?? [];
    receipt.lines = storedLines;
    if (receipt.attachment) receipt.attachment.lines = storedLines;
    return [row.id, receipt];
  }));
  return normalizeJournalCache({
    version: metadata.version,
    entries: Object.fromEntries(entries.map((row) => [row.id, JSON.parse(row.payload)])),
    receipts: receiptRecords,
    jobs: jobs.map((row) => JSON.parse(row.payload)),
    metadata: metadata.metadata,
    ...(metadata.catalog ? { catalog: metadata.catalog } : {}),
    local: {
      settings: JSON.parse(settings.payload),
      presets: presets.map((row) => JSON.parse(row.payload)),
      goals: goals.map((row) => JSON.parse(row.payload)),
      settingsInitialized: metadata.settingsInitialized,
      legacyPreferencesImported: metadata.legacyPreferencesImported,
    },
  });
}

async function readLegacy(userId: string) {
  const keys = [
    journalCacheKey(userId), previousJournalCacheKey(userId),
    legacyJournalCacheKey(userId),
  ];
  const values = await AsyncStorage.multiGet(keys);
  const source = values.find(([, value]) => value)?.[1];
  return source ? normalizeJournalCache(JSON.parse(source)) : null;
}

export const persistentCacheStore: PersistentCacheStore = {
  async read(userId) {
    const existing = await readSqlite(userId);
    if (existing) return existing;
    const legacy = await readLegacy(userId);
    if (!legacy) return emptyJournalCache();
    const db = await getOfflineDatabase();
    const migrated = {
      ...legacy,
      metadata: {
        ...legacy.metadata,
        sqliteMigrationVersion: OFFLINE_SQLITE_VERSION,
      },
    };
    // Counts, job payloads and representative decoding are verified before
    // account_state marks this transaction as a completed migration.
    await writeCache(db, userId, null, migrated, true);
    await AsyncStorage.multiRemove([
      journalCacheKey(userId), previousJournalCacheKey(userId),
      legacyJournalCacheKey(userId), `finn.ask-cache.v1.${userId}`,
    ]);
    return migrated;
  },
  async write(userId, previous, next) {
    await writeCache(await getOfflineDatabase(), userId, previous, next);
  },
  async delete(userId) {
    const db = await getOfflineDatabase();
    await db.withExclusiveTransactionAsync(async (transaction) => {
      for (const table of [
        "ask_result_cache", "cache_metric_buffer", "outbox_jobs",
        "receipt_lines", "receipts", "journal_entries", "presets", "goals",
        "settings", "account_state",
      ]) await transaction.runAsync(`DELETE FROM ${table} WHERE user_id=?`, userId);
    });
    await AsyncStorage.multiRemove([
      journalCacheKey(userId), previousJournalCacheKey(userId),
      legacyJournalCacheKey(userId), `finn.ask-cache.v1.${userId}`,
    ]);
  },
};
