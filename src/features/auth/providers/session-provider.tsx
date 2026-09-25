import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { useAppToast } from "@/components/ui/toast-provider";
import { cancelPendingAccountDeletion } from "@/features/auth/services/auth-service";
import { getSupabase, isBackendConfigured } from "@/lib/supabase/client";
import { restoreOnboarding } from "@/features/onboarding/services/onboarding-service";
import {
  captureOperationalError,
  recordOperation,
} from "@/lib/observability/sentry";

type SessionContextValue = {
  session: Session | null;
  loading: boolean;
  onboardingComplete: boolean;
  setOnboardingComplete: (complete: boolean) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const { showToast } = useAppToast();
  const [session, setSession] = useState<Session | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;

    void (isBackendConfigured()
      ? getSupabase().auth.getSession()
      : Promise.resolve({ data: { session: null }, error: null })
    )
      .then(async (auth) => {
        if (!active) return;
        if (auth.error) throw auth.error;
        const onboarding = await restoreOnboarding();
        if (!active) return;
        setOnboardingComplete(onboarding.completedAt !== null);
        setSession(auth.data.session);
      })
      .catch((error) => {
        recordOperation("auth.restore_session", "failed");
        captureOperationalError(error, {
          operation: "auth.restore_session",
          tags: { surface: "auth" },
        });
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    if (isBackendConfigured()) {
      const { data } = getSupabase().auth.onAuthStateChange((event, next) => {
        if (!active) return;
        recordOperation("auth.state_change", "succeeded", {
          event,
          authenticated: !!next,
        });
        setSession(next);
        if (next) {
          if (event === "SIGNED_IN") {
            void cancelPendingAccountDeletion().then((status) => {
              if (!active) return;
              if (status === "cancelled") {
                showToast({
                  id: `account-restored:${next.user.id}`,
                  message: "Your deletion request was cancelled.",
                  highlighted: "Your account and journal are staying with you.",
                  state: "info",
                });
              } else if (status === "expired") {
                showToast({
                  id: `account-expired:${next.user.id}`,
                  message: "The 30-day recovery period has ended.",
                  highlighted: "That account has now been deleted.",
                  state: "warning",
                });
              }
            }).catch((error) => {
              captureOperationalError(error, {
                operation: "auth.cancel_pending_deletion",
                level: "warning",
                tags: { surface: "auth" },
              });
            });
          }
          setOnboardingComplete(false);
          void restoreOnboarding().then((onboarding) => {
            if (active) setOnboardingComplete(onboarding.completedAt !== null);
          });
        } else {
          void restoreOnboarding().then((onboarding) => {
            if (active) setOnboardingComplete(onboarding.completedAt !== null);
          });
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, [showToast]);

  const markOnboarding = useCallback((complete: boolean) => {
    setOnboardingComplete(complete);
  }, []);
  const value = useMemo(
    () => ({
      session,
      loading,
      onboardingComplete,
      setOnboardingComplete: markOnboarding,
    }),
    [loading, markOnboarding, onboardingComplete, session],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used within SessionProvider");
  return value;
}
