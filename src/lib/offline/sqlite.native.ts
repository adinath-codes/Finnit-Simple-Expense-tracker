import * as SQLite from "expo-sqlite";

const DATABASE_VERSION = 1;
let database: Promise<SQLite.SQLiteDatabase> | null = null;

async function open() {
  const db = await SQLite.openDatabaseAsync("finn-offline.db");
  await db.execAsync("PRAGMA journal_mode = WAL");
  await db.execAsync("PRAGMA foreign_keys = ON");
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const version = row?.user_version ?? 0;
  if (version > DATABASE_VERSION) throw new Error("Offline database is newer than this app.");
  if (version < 1) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(`
        CREATE TABLE IF NOT EXISTS account_state (
          user_id TEXT PRIMARY KEY NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS journal_entries (
          user_id TEXT NOT NULL,
          id TEXT NOT NULL,
          captured_at TEXT NOT NULL,
          payload TEXT NOT NULL,
          PRIMARY KEY(user_id,id)
        );
        CREATE INDEX IF NOT EXISTS journal_entries_capture_idx
          ON journal_entries(user_id,captured_at DESC,id);
        CREATE TABLE IF NOT EXISTS receipts (
          user_id TEXT NOT NULL,
          entry_id TEXT NOT NULL,
          captured_at TEXT NOT NULL,
          payload TEXT NOT NULL,
          PRIMARY KEY(user_id,entry_id)
        );
        CREATE TABLE IF NOT EXISTS receipt_lines (
          user_id TEXT NOT NULL,
          entry_id TEXT NOT NULL,
          ordinal INTEGER NOT NULL,
          payload TEXT NOT NULL,
          PRIMARY KEY(user_id,entry_id,ordinal),
          FOREIGN KEY(user_id,entry_id) REFERENCES receipts(user_id,entry_id)
            ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS outbox_jobs (
          user_id TEXT NOT NULL,
          id TEXT NOT NULL,
          entry_id TEXT NOT NULL,
          next_attempt_at INTEGER NOT NULL,
          payload TEXT NOT NULL,
          PRIMARY KEY(user_id,id)
        );
        CREATE INDEX IF NOT EXISTS outbox_ready_idx
          ON outbox_jobs(user_id,next_attempt_at,id);
        CREATE TABLE IF NOT EXISTS settings (
          user_id TEXT PRIMARY KEY NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS presets (
          user_id TEXT NOT NULL,
          id TEXT NOT NULL,
          payload TEXT NOT NULL,
          PRIMARY KEY(user_id,id)
        );
        CREATE TABLE IF NOT EXISTS goals (
          user_id TEXT NOT NULL,
          id TEXT NOT NULL,
          payload TEXT NOT NULL,
          PRIMARY KEY(user_id,id)
        );
        CREATE TABLE IF NOT EXISTS ask_result_cache (
          user_id TEXT NOT NULL,
          cache_key TEXT NOT NULL,
          revision TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          last_accessed_at INTEGER NOT NULL,
          PRIMARY KEY(user_id,cache_key)
        );
        CREATE INDEX IF NOT EXISTS ask_result_lru_idx
          ON ask_result_cache(user_id,last_accessed_at);
        CREATE TABLE IF NOT EXISTS cache_metric_buffer (
          user_id TEXT NOT NULL,
          cache_name TEXT NOT NULL,
          payload TEXT NOT NULL,
          PRIMARY KEY(user_id,cache_name)
        );
      `);
      await transaction.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
    });
  }
  return db;
}

export function getOfflineDatabase() {
  if (!database) {
    database = open().catch((error) => {
      // A transient open or schema error must not poison every future retry.
      database = null;
      throw error;
    });
  }
  return database;
}

export const OFFLINE_SQLITE_VERSION = DATABASE_VERSION;
