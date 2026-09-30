export const AI_CONSENT_POLICY_VERSION = "2026-09-28";
export const AI_CONSENT_PROVIDER = "Google Gemini";
export const AI_CONSENT_DATA_CATEGORIES = [
  "financial notes",
  "receipt images",
  "financial context",
] as const;

export type AiConsentDecision = "granted" | "declined";
