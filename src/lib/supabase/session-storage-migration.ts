import type { SessionStorage } from "./session-storage.types";

type LegacySessionStorage = Pick<SessionStorage, "getItem" | "removeItem">;

/**
 * Secure-first auth storage with one-time removal of the former plaintext copy.
 * A failed secure write never falls back to legacy storage.
 */
export function createMigratingSessionStorage(
  secureStorage: SessionStorage,
  legacyStorage: LegacySessionStorage,
): SessionStorage {
  return {
    async getItem(key) {
      const secured = await secureStorage.getItem(key);
      if (secured !== null) {
        // Retry cleanup after an interrupted migration or an older app write.
        await legacyStorage.removeItem(key);
        return secured;
      }

      const legacy = await legacyStorage.getItem(key);
      if (legacy === null) return null;

      // Delete plaintext only after Keychain/Keystore persistence succeeds.
      await secureStorage.setItem(key, legacy);
      await legacyStorage.removeItem(key);
      return legacy;
    },

    async setItem(key, value) {
      await secureStorage.setItem(key, value);
      await legacyStorage.removeItem(key);
    },

    async removeItem(key) {
      // Attempt both removals so sign-out does not leave either copy behind.
      const results = await Promise.allSettled([
        secureStorage.removeItem(key),
        legacyStorage.removeItem(key),
      ]);
      const failure = results.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      if (failure) throw failure.reason;
    },
  };
}
