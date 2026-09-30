import { Platform } from "react-native";
import PostHog from "posthog-react-native";
import type { PostHogEventProperties } from "@posthog/core";
import { sanitizeAnalyticsProperties } from "@/lib/analytics/analytics-sanitization";

type Primitive = string | number | boolean | null | undefined;

export const ANALYTICS_EVENTS = {
  appOpened: "app opened",
  onboardingStarted: "onboarding started",
  onboardingStepViewed: "onboarding step viewed",
  onboardingOptionSelected: "onboarding option selected",
  onboardingStepCompleted: "onboarding step completed",
  onboardingCompleted: "onboarding completed",
  onboardingSkipped: "onboarding skipped",
  signInStarted: "sign in started",
  signInCompleted: "sign in completed",
  signInFailed: "sign in failed",
  signInCancelled: "sign in cancelled",
  signInBlocked: "sign in blocked",
  passwordResetRequested: "password reset requested",
  accountSignedOut: "account signed out",
  accountDeleted: "account deleted",
  accountDeletionScheduled: "account deletion scheduled",
  journalEntryCreated: "journal entry created",
  journalEntryUpdated: "journal entry updated",
  journalEntryDeleted: "journal entry deleted",
  presetApplied: "preset applied",
  presetSaved: "preset saved",
  presetDeleted: "preset deleted",
  aiCorrectionCompleted: "ai correction completed",
  settingsUpdated: "settings updated",
  goalUpdated: "goal updated",
  syncRetried: "sync retried",
  syncConflictResolved: "sync conflict resolved",
  syncJobCompleted: "sync job completed",
  syncJobFailed: "sync job failed",
  syncJobDeferred: "sync job deferred",
  productOperationCompleted: "product operation completed",
  productOperationFailed: "product operation failed",
  receiptCaptureStarted: "receipt capture started",
  receiptImageSelected: "receipt image selected",
  receiptSubmitted: "receipt submitted",
  receiptCaptureCancelled: "receipt capture cancelled",
  askQuerySubmitted: "ask query submitted",
  askQueryCompleted: "ask query completed",
  askQueryFailed: "ask query failed",
  calendarMonthChanged: "calendar month changed",
  calendarDateSelected: "calendar date selected",
  entryDetailViewed: "entry detail viewed",
  analyticsPreferenceChanged: "analytics preference changed",
  aiQuotaReached: "ai quota reached",
  quotaReviewRequested: "quota review requested",
  errorRecoveryShown: "error recovery shown",
  errorRecoveryAttempted: "error recovery attempted",
  errorComplaintSubmitted: "error complaint submitted",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
export type AnalyticsProperties = Record<string, Primitive>;

const operationEvents: Record<
  string,
  { event: AnalyticsEventName; feature: string; action: string }
> = {
  "journal.capture_note": {
    event: ANALYTICS_EVENTS.journalEntryCreated,
    feature: "journal",
    action: "capture_note",
  },
  "journal.capture_preset": {
    event: ANALYTICS_EVENTS.presetApplied,
    feature: "presets",
    action: "apply",
  },
  "journal.update_entry": {
    event: ANALYTICS_EVENTS.journalEntryUpdated,
    feature: "entry_details",
    action: "update",
  },
  "journal.delete_entry": {
    event: ANALYTICS_EVENTS.journalEntryDeleted,
    feature: "entry_details",
    action: "delete",
  },
  "journal.ai_correction": {
    event: ANALYTICS_EVENTS.aiCorrectionCompleted,
    feature: "ai_correction",
    action: "complete",
  },
  "preset.save": {
    event: ANALYTICS_EVENTS.presetSaved,
    feature: "presets",
    action: "save",
  },
  "preset.delete": {
    event: ANALYTICS_EVENTS.presetDeleted,
    feature: "presets",
    action: "delete",
  },
  "settings.update": {
    event: ANALYTICS_EVENTS.settingsUpdated,
    feature: "settings",
    action: "update",
  },
  "goal.update": {
    event: ANALYTICS_EVENTS.goalUpdated,
    feature: "goals",
    action: "update",
  },
  "sync.retry": {
    event: ANALYTICS_EVENTS.syncRetried,
    feature: "sync_recovery",
    action: "retry",
  },
  "sync.keep_local": {
    event: ANALYTICS_EVENTS.syncConflictResolved,
    feature: "sync_recovery",
    action: "keep_local",
  },
  "sync.accept_remote": {
    event: ANALYTICS_EVENTS.syncConflictResolved,
    feature: "sync_recovery",
    action: "accept_remote",
  },
};

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim() ?? "";
const host =
  process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";
const explicitlyEnabled = process.env.EXPO_PUBLIC_POSTHOG_ENABLED !== "false";

function isConfiguredKey(value: string) {
  return value.startsWith("phc_") && !/(placeholder|replace-me|your-)/i.test(value);
}

function sampleRate(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : fallback;
}

const sessionReplaySampleRate = sampleRate(
  process.env.EXPO_PUBLIC_POSTHOG_SESSION_REPLAY_SAMPLE_RATE,
  0.1,
);

export const isAnalyticsConfigured = explicitlyEnabled && isConfiguredKey(apiKey);

function sanitizePostHogProperties(properties: Record<string, unknown> | undefined) {
  return sanitizeAnalyticsProperties(properties) as PostHogEventProperties;
}

export const analyticsClient = new PostHog(apiKey || "phc_disabled", {
  host,
  disabled: !isAnalyticsConfigured,
  persistence: "file",
  captureAppLifecycleEvents: true,
  capturePushNotificationOpened: false,
  capturePushNotificationSubscriptions: false,
  defaultOptIn: true,
  disableGeoip: true,
  enablePersistSessionIdAcrossRestart: false,
  personProfiles: "identified_only",
  disableRemoteFeatureFlags: true,
  flushAt: 15,
  flushInterval: 10_000,
  enableSessionReplay:
    Platform.OS !== "web" && sessionReplaySampleRate > 0,
  sessionReplayConfig: {
    captureTouches: false,
    maskAllTextInputs: true,
    maskAllImages: true,
    maskAllSandboxedViews: true,
    captureLog: false,
    captureNetworkTelemetry: false,
    sampleRate: sessionReplaySampleRate,
    throttleDelayMs: 1_500,
    screenshotScale: 0.75,
    screenshotCompressionQuality: 25,
  },
  rageClickConfig: { enabled: false },
  before_send(event) {
    if (!event) return null;
    return {
      ...event,
      properties: sanitizePostHogProperties(event.properties),
      $set: sanitizePostHogProperties(event.$set),
      $set_once: sanitizePostHogProperties(event.$set_once),
    };
  },
});

export function captureAnalytics(
  event: AnalyticsEventName,
  properties: AnalyticsProperties = {},
) {
  if (!isAnalyticsConfigured) return;
  analyticsClient.capture(event, sanitizePostHogProperties(properties));
}

export function captureScreen(screenName: string, route: string) {
  if (!isAnalyticsConfigured) return;
  analyticsClient.screen(screenName, { route });
}

export function trackProductOperation(
  operation: string,
  outcome: "succeeded" | "failed",
  durationMs: number,
) {
  const definition = operationEvents[operation];
  const feature = definition?.feature ?? operation.split(".", 1)[0] ?? "unknown";
  const action = definition?.action ?? operation.split(".").slice(1).join("_");
  const properties = {
    operation,
    feature,
    action,
    outcome,
    duration_ms: Math.max(0, Math.round(durationMs)),
  };

  captureAnalytics(
    outcome === "succeeded"
      ? ANALYTICS_EVENTS.productOperationCompleted
      : ANALYTICS_EVENTS.productOperationFailed,
    properties,
  );
  if (outcome === "succeeded" && definition) {
    captureAnalytics(definition.event, { feature, action });
  }
}
