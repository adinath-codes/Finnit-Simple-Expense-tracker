import { useEffect } from "react";
import { useSession } from "@/features/auth/providers/session-provider";
import {
  recordOperation,
  setObservabilityTag,
  setObservabilityUser,
} from "./sentry";

export function SentryUserContext() {
  const { session, loading, onboardingComplete } = useSession();
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (loading) return;
    setObservabilityUser(userId);
    setObservabilityTag("onboarding.complete", onboardingComplete);
    recordOperation("auth.session", userId ? "succeeded" : "deferred", {
      authenticated: !!userId,
      onboardingComplete,
    });
  }, [loading, onboardingComplete, userId]);

  return null;
}
