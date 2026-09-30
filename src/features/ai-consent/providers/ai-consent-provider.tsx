import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useSession } from "@/features/auth/providers/session-provider";
import {
  declineAiConsent,
  grantAiConsent,
  loadAiConsent,
  type AiConsentRecord,
} from "../services/ai-consent-service";
import type { AiConsentDecision } from "../../../../supabase/functions/_shared/ai-consent-contract";

export type AiConsentStatus = "loading" | "undecided" | AiConsentDecision;

type AiConsentContextValue = {
  status: AiConsentStatus;
  record: AiConsentRecord | null;
  saving: boolean;
  grant: () => Promise<AiConsentRecord>;
  decline: () => Promise<AiConsentRecord>;
  withdraw: () => Promise<AiConsentRecord>;
  refresh: () => Promise<void>;
};

const AiConsentContext = createContext<AiConsentContextValue | null>(null);

export function AiConsentProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const [record, setRecord] = useState<AiConsentRecord | null>(null);
  const [status, setStatus] = useState<AiConsentStatus>("loading");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setRecord(null);
      setStatus("undecided");
      return;
    }
    setStatus("loading");
    const next = await loadAiConsent(userId);
    setRecord(next);
    setStatus(next?.decision ?? "undecided");
  }, [userId]);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setRecord(null);
      setStatus("undecided");
      return () => { active = false; };
    }
    setStatus("loading");
    void loadAiConsent(userId).then((next) => {
      if (!active) return;
      setRecord(next);
      setStatus(next?.decision ?? "undecided");
    });
    return () => { active = false; };
  }, [userId]);

  const grant = useCallback(async () => {
    if (!userId) throw new Error("Sign in before allowing AI data sharing.");
    setSaving(true);
    try {
      const next = await grantAiConsent(userId);
      setRecord(next);
      setStatus("granted");
      const { syncJournal } = await import("@/lib/offline/sync-queue");
      void syncJournal(userId).catch(() => undefined);
      return next;
    } finally {
      setSaving(false);
    }
  }, [userId]);

  const decline = useCallback(async () => {
    if (!userId) throw new Error("Sign in before changing AI data sharing.");
    setSaving(true);
    try {
      const next = await declineAiConsent(userId);
      setRecord(next);
      setStatus("declined");
      return next;
    } finally {
      setSaving(false);
    }
  }, [userId]);

  const value = useMemo(() => ({
    status,
    record,
    saving,
    grant,
    decline,
    withdraw: decline,
    refresh,
  }), [
    decline,
    grant,
    record,
    refresh,
    saving,
    status,
  ]);
  return (
    <AiConsentContext.Provider value={value}>
      {children}
    </AiConsentContext.Provider>
  );
}

export function useAiConsent() {
  const value = useContext(AiConsentContext);
  if (!value) throw new Error("useAiConsent must be used within AiConsentProvider");
  return value;
}
