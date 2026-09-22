// TypeScript and non-native fallback. Metro selects persistent-store.native.ts
// for iOS/Android and persistent-store.web.ts for web.
export { persistentCacheStore } from "./persistent-store.web";
