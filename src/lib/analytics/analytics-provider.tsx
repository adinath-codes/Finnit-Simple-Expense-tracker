import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { usePathname } from "expo-router";
import { PostHogProvider } from "posthog-react-native";
import { useSession } from "@/features/auth/providers/session-provider";
import {
  useJournalData,
  useJournalStatus,
} from "@/providers/app-providers";
import {
  ANALYTICS_EVENTS,
  analyticsClient,
  captureAnalytics,
  captureScreen,
  isAnalyticsConfigured,
} from "@/lib/analytics/analytics";

const SCREEN_NAMES: Record<string, string> = {
  "/": "Journal",
  "/onboarding": "Onboarding",
  "/onboarding/index": "Onboarding",
  "/sign-in": "Sign in",
  "/reset-password": "Reset password",
  "/auth/callback": "Auth callback",
  "/search": "Ask Finn",
  "/calendar": "Calendar",
  "/settings": "Settings",
  "/settings/index": "Settings",
  "/settings/presets": "Saved entries",
  "/legal/privacy": "Privacy policy",
  "/legal/terms": "Terms of service",
  "/quick-add": "Quick add",
};

function normalizedRoute(pathname: string) {
  if (/^\/entries\/[^/]+$/.test(pathname)) return "/entries/:entryId";
  return pathname;
}

function screenName(pathname: string) {
  const route = normalizedRoute(pathname);
  if (route === "/entries/:entryId") return "Entry details";
  return SCREEN_NAMES[route] ?? "Unknown screen";
}

export function AnalyticsProvider({ children }: PropsWithChildren) {
  return (
    <PostHogProvider
      client={analyticsClient}
      autocapture={{ captureScreens: false, captureTouches: false }}
    >
      {children}
    </PostHogProvider>
  );
}

export function AnalyticsRuntime() {
  const pathname = usePathname();
  const { session, onboardingComplete } = useSession();
  const { settings } = useJournalData();
  const { settingsReady } = useJournalStatus();
  const previousUserId = useRef<string | null>(null);
  const appOpened = useRef(false);
  const [runtimeReady, setRuntimeReady] = useState(false);

  useEffect(() => {
    setRuntimeReady(false);
    if (!isAnalyticsConfigured || !settingsReady) return;
    let active = true;
    const sync = async () => {
      await analyticsClient.ready();
      if (!active) return;
      if (!settings.analyticsEnabled) {
        await analyticsClient.optOut();
        return;
      }

      await analyticsClient.optIn();
      if (!active) return;

      const userId = session?.user.id ?? null;
      if (
        previousUserId.current &&
        previousUserId.current !== userId
      ) {
        analyticsClient.reset();
        await analyticsClient.optIn();
      }
      previousUserId.current = userId;

      if (userId) {
        analyticsClient.identify(userId, {
          account_state: "authenticated",
          onboarding_completed: onboardingComplete,
        });
      }

      if (!appOpened.current) {
        appOpened.current = true;
        captureAnalytics(ANALYTICS_EVENTS.appOpened, {
          authenticated: !!userId,
          onboarding_completed: onboardingComplete,
        });
      }
      if (active) setRuntimeReady(true);
    };
    void sync().catch(() => {
      if (active) setRuntimeReady(false);
    });
    return () => {
      active = false;
    };
  }, [onboardingComplete, session?.user.id, settings.analyticsEnabled, settingsReady]);

  useEffect(() => {
    if (!runtimeReady || !settingsReady || !settings.analyticsEnabled) return;
    const route = normalizedRoute(pathname);
    captureScreen(screenName(pathname), route);
  }, [pathname, runtimeReady, settings.analyticsEnabled, settingsReady]);

  return null;
}
