// @ts-nocheck -- Node's built-in SQLite validates the native schema without ADB.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const nativeSource = readFileSync(
  new URL("../../src/lib/offline/sqlite.native.ts", import.meta.url),
  "utf8",
);
const schema = nativeSource.match(/await transaction\.execAsync\(`([\s\S]*?)`\);/)?.[1];
assert.ok(schema, "the native SQLite schema must remain testable");

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(schema);
  return db;
}

test("native SQLite schema supports every normalized account resource", () => {
  const db = database();
  try {
    for (const table of [
      "account_state", "journal_entries", "receipts", "receipt_lines",
      "outbox_jobs", "settings", "presets", "goals", "ask_result_cache",
      "cache_metric_buffer",
    ]) {
      assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name=?")
        .get(table), table);
    }
    db.prepare("INSERT INTO receipts VALUES(?,?,?,?)")
      .run("account-a", "receipt-1", "2026-09-22", "{}");
    db.prepare("INSERT INTO receipt_lines VALUES(?,?,?,?)")
      .run("account-a", "receipt-1", 0, "{\"description\":\"coffee\"}");
    assert.throws(() => db.prepare("INSERT INTO receipt_lines VALUES(?,?,?,?)")
      .run("account-b", "receipt-1", 0, "{}"), /FOREIGN KEY/);
    db.prepare("DELETE FROM receipts WHERE user_id=? AND entry_id=?")
      .run("account-a", "receipt-1");
    assert.equal(db.prepare("SELECT count(*) count FROM receipt_lines").get().count, 0);
  } finally {
    db.close();
  }
});

test("entry and outbox transaction rolls back together and accounts stay isolated", () => {
  const db = database();
  try {
    db.exec("BEGIN IMMEDIATE");
    db.prepare("INSERT INTO journal_entries VALUES(?,?,?,?)")
      .run("account-a", "entry-1", "2026-09-22", "{\"note\":\"private\"}");
    db.prepare("INSERT INTO outbox_jobs VALUES(?,?,?,?,?)")
      .run("account-a", "job-1", "entry-1", 0, "{\"pending\":true}");
    db.exec("ROLLBACK");
    assert.equal(db.prepare("SELECT count(*) count FROM journal_entries").get().count, 0);
    assert.equal(db.prepare("SELECT count(*) count FROM outbox_jobs").get().count, 0);

    db.exec("BEGIN IMMEDIATE");
    db.prepare("INSERT INTO journal_entries VALUES(?,?,?,?)")
      .run("account-a", "entry-1", "2026-09-22", "{\"note\":\"private\"}");
    db.prepare("INSERT INTO outbox_jobs VALUES(?,?,?,?,?)")
      .run("account-a", "job-1", "entry-1", 0, "{\"pending\":true}");
    db.exec("COMMIT");
    assert.equal(db.prepare("SELECT count(*) count FROM journal_entries WHERE user_id=?")
      .get("account-a").count, 1);
    assert.equal(db.prepare("SELECT count(*) count FROM journal_entries WHERE user_id=?")
      .get("account-b").count, 0);
    assert.equal(db.prepare("SELECT count(*) count FROM outbox_jobs WHERE user_id=?")
      .get("account-b").count, 0);
  } finally {
    db.close();
  }
});
