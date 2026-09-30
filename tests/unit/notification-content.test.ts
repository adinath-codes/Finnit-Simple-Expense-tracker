// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import test from "node:test";
import {
  journalReminderCopy,
  nextJournalReminderDates,
  parseReminderTime,
  trialExpiryReminderDate,
} from "../../src/features/notifications/services/notification-content.ts";

test("reminder copy rotates and always speaks as Finn", () => {
  assert.deepEqual(journalReminderCopy(0), journalReminderCopy(7));
  for (let index = 0; index < 7; index += 1) {
    const copy = journalReminderCopy(index);
    assert.match(`${copy.title} ${copy.body}`, /\bI(?:’m|’ll|’ve| can| kept| noticed)|\bme\b/i);
  }
});

test("reminder time parser handles 12-hour clock and safe fallback", () => {
  assert.deepEqual(parseReminderTime("9:00 PM"), { hour: 21, minute: 0 });
  assert.deepEqual(parseReminderTime("12:15 AM"), { hour: 0, minute: 15 });
  assert.deepEqual(parseReminderTime("nonsense"), { hour: 21, minute: 0 });
});

test("a logged day starts reminders tomorrow", () => {
  const now = new Date(2026, 8, 26, 12, 0, 0);
  const dates = nextJournalReminderDates("9:00 PM", now, true, 2);
  assert.equal(dates[0].getDate(), 27);
  assert.equal(dates[0].getHours(), 21);
  assert.equal(dates[1].getDate(), 28);
});

test("an unlogged day can still receive tonight's reminder", () => {
  const now = new Date(2026, 8, 26, 12, 0, 0);
  const [date] = nextJournalReminderDates("9:00 PM", now, false, 1);
  assert.equal(date.getDate(), 26);
  assert.equal(date.getHours(), 21);
});

test("a trial reminder is scheduled 24 hours before the verified expiry", () => {
  const now = new Date("2026-09-29T12:00:00.000Z");
  const expiry = new Date("2026-10-02T12:00:00.000Z");
  const reminder = trialExpiryReminderDate({
    isActive: true,
    periodType: "TRIAL",
    expirationDateMillis: expiry.getTime(),
  }, now);

  assert.equal(reminder?.toISOString(), "2026-10-01T12:00:00.000Z");
});

test("accelerated store trials still get a reminder before expiry", () => {
  const now = new Date("2026-09-29T12:00:00.000Z");
  const expiry = new Date("2026-09-29T12:06:00.000Z");
  const reminder = trialExpiryReminderDate({
    isActive: true,
    periodType: "trial",
    expirationDateMillis: expiry.getTime(),
  }, now);

  assert.equal(reminder?.toISOString(), "2026-09-29T12:03:00.000Z");
});

test("normal, inactive, and expired entitlements do not schedule trial reminders", () => {
  const now = new Date("2026-09-29T12:00:00.000Z");
  const future = new Date("2026-10-02T12:00:00.000Z").getTime();

  assert.equal(trialExpiryReminderDate({
    isActive: true,
    periodType: "NORMAL",
    expirationDateMillis: future,
  }, now), null);
  assert.equal(trialExpiryReminderDate({
    isActive: false,
    periodType: "TRIAL",
    expirationDateMillis: future,
  }, now), null);
  assert.equal(trialExpiryReminderDate({
    isActive: true,
    periodType: "TRIAL",
    expirationDateMillis: now.getTime(),
  }, now), null);
});
