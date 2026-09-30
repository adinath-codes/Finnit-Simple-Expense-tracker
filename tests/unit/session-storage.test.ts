// @ts-nocheck -- Executed directly by Node's type-stripping test runner.
import assert from "node:assert/strict";
import test from "node:test";
import { createMigratingSessionStorage } from "../../src/lib/supabase/session-storage-migration.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const calls = { get: [] as string[], set: [] as string[], remove: [] as string[] };
  let setError: Error | null = null;
  let removeError: Error | null = null;
  return {
    calls,
    values,
    failSet(error: Error) { setError = error; },
    failRemove(error: Error) { removeError = error; },
    storage: {
      async getItem(key: string) {
        calls.get.push(key);
        return values.get(key) ?? null;
      },
      async setItem(key: string, value: string) {
        calls.set.push(key);
        if (setError) throw setError;
        values.set(key, value);
      },
      async removeItem(key: string) {
        calls.remove.push(key);
        if (removeError) throw removeError;
        values.delete(key);
      },
    },
  };
}

test("native session read migrates plaintext only after the secure write succeeds", async () => {
  const secure = memoryStorage();
  const legacy = memoryStorage({ "sb-project-auth-token": "session-json" });
  const storage = createMigratingSessionStorage(secure.storage, legacy.storage);

  assert.equal(await storage.getItem("sb-project-auth-token"), "session-json");
  assert.equal(secure.values.get("sb-project-auth-token"), "session-json");
  assert.equal(legacy.values.has("sb-project-auth-token"), false);
});

test("failed secure migration retains the only session copy", async () => {
  const secure = memoryStorage();
  secure.failSet(new Error("keychain unavailable"));
  const legacy = memoryStorage({ "sb-project-auth-token": "session-json" });
  const storage = createMigratingSessionStorage(secure.storage, legacy.storage);

  await assert.rejects(storage.getItem("sb-project-auth-token"), /keychain unavailable/);
  assert.equal(legacy.values.get("sb-project-auth-token"), "session-json");
  assert.deepEqual(legacy.calls.remove, []);
});

test("secure sessions win and any duplicate plaintext copy is deleted", async () => {
  const secure = memoryStorage({ "sb-project-auth-token": "secure-session" });
  const legacy = memoryStorage({ "sb-project-auth-token": "stale-session" });
  const storage = createMigratingSessionStorage(secure.storage, legacy.storage);

  assert.equal(await storage.getItem("sb-project-auth-token"), "secure-session");
  assert.equal(legacy.values.has("sb-project-auth-token"), false);
});

test("new sessions are secure-first and sign-out attempts both removals", async () => {
  const secure = memoryStorage();
  const legacy = memoryStorage({ "sb-project-auth-token": "old-session" });
  const storage = createMigratingSessionStorage(secure.storage, legacy.storage);

  await storage.setItem("sb-project-auth-token", "new-session");
  assert.equal(secure.values.get("sb-project-auth-token"), "new-session");
  assert.equal(legacy.values.has("sb-project-auth-token"), false);

  secure.failRemove(new Error("keychain delete failed"));
  legacy.values.set("sb-project-auth-token", "unexpected-copy");
  await assert.rejects(storage.removeItem("sb-project-auth-token"), /keychain delete failed/);
  assert.equal(legacy.values.has("sb-project-auth-token"), false);
});
