import { onboardingSteps } from "@/features/onboarding/data/onboarding-steps";
import {
  FINN_ONBOARDING_FLOW_VERSION,
  type OnboardingAnswers,
  type OnboardingSnapshot,
} from "@/features/onboarding/types/onboarding.types";
import {
  clearOnboardingDraft,
  createEmptyOnboardingSnapshot,
  loadOnboardingDraftSnapshot,
  loadOnboardingSnapshot,
  saveOnboardingSnapshot,
} from "@/storage/onboarding-repository";
import {
  getSupabase,
  isBackendConfigured,
} from "@/lib/supabase/client";
import { sanitizeOnboardingAnswers } from "@/features/onboarding/services/onboarding-validation";

let persistenceQueue: Promise<void> = Promise.resolve();

function queuePersistence<T>(operation: () => Promise<T>): Promise<T> {
  const result = persistenceQueue.then(operation, operation);
  persistenceQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function syncSnapshot(snapshot: OnboardingSnapshot): Promise<boolean> {
  if (!isBackendConfigured()) return false;

  try {
    const db = getSupabase();
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    const session = data.session;
    if (!session) return false;
    if (snapshot.accountId && snapshot.accountId !== session.user.id) {
      return false;
    }

    const answers = sanitizeOnboardingAnswers(snapshot.answers);
    const currentStep = onboardingSteps[snapshot.stepIndex] ?? onboardingSteps[0];
    const { error: upsertError } = await db.from("user_onboarding").upsert(
      {
        user_id: session.user.id,
        flow_version: snapshot.flowVersion,
        status: snapshot.completedAt ? "completed" : "in_progress",
        current_step_id: currentStep.id,
        answers,
        primary_goal: null,
        tracking_friction: null,
        base_currency: answers.currency ?? null,
        completed_at: snapshot.completedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (upsertError) throw upsertError;
    return true;
  } catch (error) {
    console.warn("[Finn onboarding] Supabase sync deferred:", error);
    return false;
  }
}

async function loadRemoteSnapshot(userId: string): Promise<OnboardingSnapshot | null> {
  if (!isBackendConfigured()) return null;
  const db = getSupabase();
  const { data, error } = await db
    .from("user_onboarding")
    .select("flow_version,status,current_step_id,answers,completed_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const completedAt =
    data.status === "completed" && typeof data.completed_at === "string"
      ? data.completed_at
      : null;
  // A completed prior flow remains complete. Only unfinished legacy drafts need
  // to restart because their numerical step indexes no longer match this flow.
  if (completedAt && data.flow_version !== FINN_ONBOARDING_FLOW_VERSION) {
    return {
      ...createEmptyOnboardingSnapshot(),
      stepIndex: onboardingSteps.length - 1,
      completedAt,
      remoteSynced: true,
      accountId: userId,
    };
  }
  if (data.flow_version !== FINN_ONBOARDING_FLOW_VERSION) return null;

  const remoteStep = onboardingSteps.findIndex(
    (step) => step.id === data.current_step_id,
  );
  return {
    flowVersion: FINN_ONBOARDING_FLOW_VERSION,
    stepIndex: remoteStep >= 0 ? remoteStep : 0,
    answers: sanitizeOnboardingAnswers(data.answers as OnboardingAnswers),
    completedAt,
    remoteSynced: true,
    accountId: userId,
  };
}

export async function syncCompletedOnboarding() {
  try {
    await persistenceQueue;
    if (!isBackendConfigured()) return false;
    const { data, error } = await getSupabase().auth.getSession();
    if (error || !data.session) return false;

    const snapshot = await loadOnboardingDraftSnapshot();
    if (!snapshot?.completedAt || (snapshot.accountId && snapshot.accountId !== data.session.user.id)) {
      return false;
    }

    const claimedSnapshot: OnboardingSnapshot = {
      ...snapshot,
      accountId: data.session.user.id,
      remoteSynced: false,
    };
    await queuePersistence(async () => {
      const latest = await loadOnboardingDraftSnapshot();
      if (latest?.completedAt === snapshot.completedAt && (!latest.accountId || latest.accountId === data.session.user.id)) {
        await saveOnboardingSnapshot(claimedSnapshot);
      }
    });

    const remoteSynced = await syncSnapshot(claimedSnapshot);
    if (!remoteSynced) return false;

    await queuePersistence(async () => {
      const latest = await loadOnboardingDraftSnapshot();
      if (
        latest?.completedAt === snapshot.completedAt &&
        latest.accountId === data.session.user.id
      ) {
        await clearOnboardingDraft();
      }
    });
    return true;
  } catch (error) {
    console.warn("[Finn onboarding] Local cleanup deferred:", error);
    return false;
  }
}

export async function restoreOnboarding() {
  await persistenceQueue;
  const local = await loadOnboardingSnapshot();

  if (isBackendConfigured()) {
    try {
      const db = getSupabase();
      const { data: sessionData, error: sessionError } =
        await db.auth.getSession();
      if (sessionError) throw sessionError;
      if (sessionData.session) {
        const accountId = sessionData.session.user.id;
        const remote = await loadRemoteSnapshot(accountId);
        if (remote?.completedAt) {
          await queuePersistence(async () => {
            await clearOnboardingDraft();
          });
          return remote;
        }

        if (local.accountId && local.accountId !== accountId) {
          await queuePersistence(() => clearOnboardingDraft());
          return createEmptyOnboardingSnapshot();
        }

        if (local.completedAt) {
          const synced = await syncCompletedOnboarding();
          if (synced) {
            return {
              ...local,
              accountId,
              remoteSynced: true,
            };
          }
        }

        const scopedDraft = remote ?? { ...local, accountId };
        await queuePersistence(() => saveOnboardingSnapshot(scopedDraft));
        return scopedDraft;
      }
    } catch (error) {
      console.warn("[Finn onboarding] Supabase restore deferred:", error);
    }
  }

  // A draft already claimed by an account must never be visible before another
  // account signs in on this device.
  if (local.accountId) {
    await queuePersistence(() => clearOnboardingDraft());
    return createEmptyOnboardingSnapshot();
  }

  if (local.stepIndex >= onboardingSteps.length) {
    return { ...local, stepIndex: 0 };
  }
  return local;
}

export async function saveOnboardingProgress(
  stepIndex: number,
  answers: OnboardingAnswers,
) {
  return queuePersistence(async () => {
    const current = await loadOnboardingSnapshot();
    const snapshot: OnboardingSnapshot = {
      ...current,
      stepIndex,
      answers: sanitizeOnboardingAnswers(answers),
      completedAt: null,
      remoteSynced: false,
    };
    await saveOnboardingSnapshot(snapshot);
    return snapshot;
  });
}

export async function completeOnboarding(answers: OnboardingAnswers) {
  const completedAt = new Date().toISOString();
  const snapshot: OnboardingSnapshot = {
    ...createEmptyOnboardingSnapshot(),
    stepIndex: onboardingSteps.length - 1,
    answers: sanitizeOnboardingAnswers(answers),
    completedAt,
    remoteSynced: false,
  };

  // Completion is durable locally before any network request.
  await queuePersistence(() => saveOnboardingSnapshot(snapshot));
  // Authentication can happen now or later. Failed uploads deliberately leave
  // the draft intact so SessionProvider can retry after the next authenticated start.
  void syncCompletedOnboarding();
  return snapshot;
}

/** Existing-account sign-in is only a route transition. The account's remote
 * record decides whether it needs questions after authentication. */
export async function skipOnboardingForExistingAccount() {
  await queuePersistence(() => clearOnboardingDraft());
  return createEmptyOnboardingSnapshot();
}
