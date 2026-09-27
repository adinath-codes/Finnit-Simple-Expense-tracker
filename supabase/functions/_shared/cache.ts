/** Stable-enough cache hashing for JSON values whose property order is fixed by callers. */
export async function cacheHash(value: unknown) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const EXPLANATION_CACHE_VERSION = 3;
export const ASK_SQL_PLAN_CACHE_VERSION = 2;

export function safeCacheableExplanation(value: unknown) {
  return typeof value === "string" &&
    value.length >= 1 && value.length <= 700 &&
    !/[0-9\p{Sc}]/u.test(value);
}
