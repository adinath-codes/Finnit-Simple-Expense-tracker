import { Platform } from "react-native";
import * as Sentry from "@sentry/react-native";

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
const isDevelopment =
  typeof __DEV__ !== "undefined"
    ? __DEV__
    : process.env.NODE_ENV !== "production";

function sampleRate(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : fallback;
}

function isConfiguredDsn(value: string | undefined) {
  return !!value &&
    /^https?:\/\//.test(value) &&
    !/(example|placeholder|replace-me|your-)/i.test(value);
}

function sanitizedLocation(value: string | undefined) {
  if (!value) return value;
  const withoutQuery = value.split(/[?#]/, 1)[0];
  return withoutQuery
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      ":id",
    )
    .replace(/\b\d{7,}\b/g, ":id");
}

function sanitizedBreadcrumb(
  breadcrumb: Sentry.Breadcrumb,
): Sentry.Breadcrumb | null {
  const category = breadcrumb.category ?? "";

  // Console arguments can contain journal text, receipt data, tokens, or email.
  if (category === "console") return null;

  if (
    category.includes("http") ||
    category.includes("fetch") ||
    category.includes("xhr")
  ) {
    const data = breadcrumb.data ?? {};
    return {
      ...breadcrumb,
      message: sanitizedLocation(breadcrumb.message),
      data: {
        method: data.method,
        status_code: data.status_code,
        url: sanitizedLocation(
          typeof data.url === "string" ? data.url : undefined,
        ),
      },
    };
  }

  if (category.startsWith("ui.")) {
    return { ...breadcrumb, message: undefined, data: undefined };
  }

  if (category === "navigation") {
    return {
      ...breadcrumb,
      message: sanitizedLocation(breadcrumb.message),
      data: undefined,
    };
  }

  if (category.startsWith("finn.")) return breadcrumb;

  return { ...breadcrumb, data: undefined };
}

function sanitizedEvent<T extends Sentry.Event>(event: T): T {
  if (event.user?.id) event.user = { id: String(event.user.id) };
  else event.user = undefined;

  if (event.request) {
    event.request = {
      method: event.request.method,
      url: sanitizedLocation(event.request.url),
    };
  }

  event.breadcrumbs = event.breadcrumbs
    ?.map(sanitizedBreadcrumb)
    .filter((breadcrumb): breadcrumb is Sentry.Breadcrumb => breadcrumb !== null);

  // Operational metadata belongs in controlled tags and breadcrumbs. Arbitrary
  // extras are removed so financial content cannot be attached accidentally.
  event.extra = undefined;
  return event;
}

export const sentryNavigationIntegration =
  Sentry.reactNavigationIntegration({
    enableTimeToInitialDisplay: true,
    enableTimeToInitialDisplayForPreloadedRoutes: true,
    useFullPathsForNavigationRoutes: true,
    useDispatchedActionData: false,
  });

export const isSentryEnabled =
  !isDevelopment && isConfiguredDsn(sentryDsn);

Sentry.init({
  dsn: sentryDsn,
  enabled: isSentryEnabled,
  environment:
    process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ??
    (isDevelopment ? "development" : "production"),
  debug: false,
  sendDefaultPii: false,
  enableLogs: false,
  attachScreenshot: false,
  attachViewHierarchy: false,
  attachStacktrace: true,
  enableAutoSessionTracking: true,
  enableCaptureFailedRequests: true,
  enableUserInteractionTracing: true,
  tracesSampleRate: sampleRate(
    process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    0.15,
  ),
  replaysSessionSampleRate: sampleRate(
    process.env.EXPO_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
    0,
  ),
  replaysOnErrorSampleRate: sampleRate(
    process.env.EXPO_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
    1,
  ),
  replaysSessionQuality: "low",
  maxBreadcrumbs: 75,
  maxValueLength: 250,
  integrations: [
    sentryNavigationIntegration,
    ...(Platform.OS === "web"
      ? []
      : [
          Sentry.mobileReplayIntegration({
            maskAllText: true,
            maskAllImages: true,
            maskAllVectors: true,
            screenshotStrategy: "canvas",
          }),
        ]),
  ],
  beforeBreadcrumb: sanitizedBreadcrumb,
  beforeSend: sanitizedEvent,
  beforeSendTransaction(event) {
    event.transaction = sanitizedLocation(event.transaction);
    event.spans = event.spans?.map((span) => ({
      ...span,
      description: sanitizedLocation(span.description),
      data: {},
    }));
    return event;
  },
});

type OperationalErrorContext = {
  operation: string;
  level?: "warning" | "error" | "fatal";
  tags?: Record<string, string | number | boolean | undefined>;
};

export function recordOperation(
  operation: string,
  outcome: "started" | "succeeded" | "failed" | "deferred",
  data?: Record<string, string | number | boolean | undefined>,
) {
  Sentry.addBreadcrumb({
    category: "finn.operation",
    message: `${operation}.${outcome}`,
    level: outcome === "failed" ? "warning" : "info",
    data,
  });
}

export function captureOperationalError(
  error: unknown,
  context: OperationalErrorContext,
) {
  Sentry.withScope((scope) => {
    scope.setLevel(context.level ?? "error");
    scope.setTag("operation", context.operation);
    for (const [key, value] of Object.entries(context.tags ?? {})) {
      if (value !== undefined) scope.setTag(key, String(value));
    }
    Sentry.captureException(error);
  });
}

export function setObservabilityUser(userId: string | null) {
  Sentry.setUser(userId ? { id: userId } : null);
  Sentry.setTag("auth.state", userId ? "authenticated" : "anonymous");
}

export function setObservabilityTag(key: string, value: string | boolean) {
  Sentry.setTag(key, String(value));
}

export { Sentry };
