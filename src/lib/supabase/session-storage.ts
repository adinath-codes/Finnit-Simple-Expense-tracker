// TypeScript/non-native fallback. Metro resolves session-storage.native.ts on
// iOS/Android and session-storage.web.ts for the web bundle.
export { sessionStorage } from "./session-storage.web";
