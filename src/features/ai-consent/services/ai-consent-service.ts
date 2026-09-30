import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSupabase, isBackendConfigured } from "@/lib/supabase/client";
import {
  AI_CONSENT_DATA_CATEGORIES,
  AI_CONSENT_POLICY_VERSION,
  AI_CONSENT_PROVIDER,
  type AiConsentDecision,
} from "../../../../supabase/functions/_shared/ai-consent-contract";

export type AiConsentRecord = {
  decision: AiConsentDecision;
  policyVersion: string;
  decidedAt: string;
  synced: boolean;
};

function storageKey(userId: string) {
  return `@finnit/ai-consent/${userId}/${AI_CONSENT_POLICY_VERSION}`;
}

function parseLocalRecord(raw: string | null): AiConsentRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<AiConsentRecord>;
    if (
      value.policyVersion !== AI_CONSENT_POLICY_VERSION ||
      (value.decision !== "granted" && value.decision !== "declined") ||
      typeof value.decidedAt !== "string"
    ) return null;
    return {
      decision: value.decision,
      policyVersion: AI_CONSENT_POLICY_VERSION,
      decidedAt: value.decidedAt,
      synced: value.synced === true,
    };
  } catch {
    return null;
  }
}

async function writeLocalRecord(userId: string, record: AiConsentRecord) {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(record));
}

async function writeRemoteRecord(userId: string, record: AiConsentRecord) {
  const now = new Date().toISOString();
  const { error } = await getSupabase()
    .from("ai_consent_records")
    .upsert({
      user_id: userId,
      policy_version: AI_CONSENT_POLICY_VERSION,
      decision: record.decision,
      provider: AI_CONSENT_PROVIDER,
      data_categories: [...AI_CONSENT_DATA_CATEGORIES],
      decided_at: record.decidedAt,
      updated_at: now,
    }, { onConflict: "user_id,policy_version" });
  if (error) throw error;
}

export async function loadAiConsent(userId: string): Promise<AiConsentRecord | null> {
  const local = parseLocalRecord(await AsyncStorage.getItem(storageKey(userId)));
  if (!isBackendConfigured()) return local;

  if (local && !local.synced) {
    try {
      await writeRemoteRecord(userId, local);
      const synced = { ...local, synced: true };
      await writeLocalRecord(userId, synced);
      return synced;
    } catch {
      // A local withdrawal must never be replaced by an older remote grant.
      return local;
    }
  }

  try {
    const { data, error } = await getSupabase()
      .from("ai_consent_records")
      .select("decision,decided_at,provider")
      .eq("user_id", userId)
      .eq("policy_version", AI_CONSENT_POLICY_VERSION)
      .maybeSingle();
    if (error) throw error;
    if (
      data &&
      data.provider === AI_CONSENT_PROVIDER &&
      (data.decision === "granted" || data.decision === "declined")
    ) {
      const remote: AiConsentRecord = {
        decision: data.decision,
        policyVersion: AI_CONSENT_POLICY_VERSION,
        decidedAt: data.decided_at,
        synced: true,
      };
      await writeLocalRecord(userId, remote);
      return remote;
    }
    return local;
  } catch {
    return local;
  }
}

async function saveAiConsentDecision(
  userId: string,
  decision: AiConsentDecision,
): Promise<AiConsentRecord> {
  const record: AiConsentRecord = {
    decision,
    policyVersion: AI_CONSENT_POLICY_VERSION,
    decidedAt: new Date().toISOString(),
    synced: false,
  };
  await writeLocalRecord(userId, record);
  if (!isBackendConfigured()) return record;
  try {
    await writeRemoteRecord(userId, record);
    const synced = { ...record, synced: true };
    await writeLocalRecord(userId, synced);
    return synced;
  } catch {
    return record;
  }
}

export function grantAiConsent(userId: string) {
  return saveAiConsentDecision(userId, "granted");
}

export function declineAiConsent(userId: string) {
  return saveAiConsentDecision(userId, "declined");
}

export async function hasGrantedAiConsent(userId: string) {
  const record = parseLocalRecord(await AsyncStorage.getItem(storageKey(userId)));
  return record?.decision === "granted";
}

export async function requireGrantedAiConsent(userId: string) {
  if (!(await hasGrantedAiConsent(userId))) {
    throw new Error(
      "Allow Google Gemini data sharing in Settings to use this AI feature.",
    );
  }
}

export {
  AI_CONSENT_DATA_CATEGORIES,
  AI_CONSENT_POLICY_VERSION,
  AI_CONSENT_PROVIDER,
};
