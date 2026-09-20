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
import { getSupabase, isBackendConfigured } from "@/lib/supabase/client";
import { restoreOnboarding } from "@/features/onboarding/services/onboarding-service";

type SessionContextValue = {
  session: Session | null;
  loading: boolean;
  onboardingComplete: boolean;
  setOnboardingComplete: (complete: boolean) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
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
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    if (isBackendConfigured()) {
      const { data } = getSupabase().auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next);
        if (next) {
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
  }, []);

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
