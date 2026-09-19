import { onboardingSteps } from "@/features/onboarding/data/onboarding-steps";
import type {
  OnboardingAnswers,
  OnboardingSnapshot,
} from "@/features/onboarding/types/onboarding.types";
import {
  createEmptyOnboardingSnapshot,
  loadOnboardingSnapshot,
  saveOnboardingSnapshot,
} from "@/storage/onboarding-repository";
import {
  getSupabase,
  isBackendConfigured,
} from "@/lib/supabase/client";

const allowedAnswers = {
  goal: new Set(["remember", "effortless", "patterns", "context"]),
  friction: new Set([
    "too-many-fields",
    "forget",
    "missing-context",
    "feels-like-work",
  ]),
  currency: new Set(["INR", "USD", "EUR", "GBP", "AED"]),
};

function sanitizeAnswers(answers: OnboardingAnswers): OnboardingAnswers {
  return {
    goal:
      answers.goal && allowedAnswers.goal.has(answers.goal)
        ? answers.goal
        : undefined,
    friction:
      answers.friction && allowedAnswers.friction.has(answers.friction)
        ? answers.friction
        : undefined,
    currency:
      answers.currency && allowedAnswers.currency.has(answers.currency)
        ? answers.currency
        : undefined,
  };
}

async function syncSnapshot(snapshot: OnboardingSnapshot): Promise<boolean> {
  if (!isBackendConfigured()) return false;

  try {
    const db = getSupabase();
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    const session = data.session;
    if (!session) return false;

    const answers = sanitizeAnswers(snapshot.answers);
    const currentStep = onboardingSteps[snapshot.stepIndex] ?? onboardingSteps[0];
    const { error: upsertError } = await db.from("user_onboarding").upsert(
      {
        user_id: session.user.id,
        flow_version: snapshot.flowVersion,
        status: snapshot.completedAt ? "completed" : "in_progress",
        current_step_id: currentStep.id,
        answers,
        primary_goal: answers.goal ?? null,
        tracking_friction: answers.friction ?? null,
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

export async function syncCompletedOnboarding() {
  const snapshot = await loadOnboardingSnapshot();
  if (!snapshot.completedAt || snapshot.remoteSynced) return;
  const remoteSynced = await syncSnapshot(snapshot);
  if (!remoteSynced) return;
  const latest = await loadOnboardingSnapshot();
  if (latest.completedAt === snapshot.completedAt) {
    await saveOnboardingSnapshot({ ...latest, remoteSynced: true });
  }
}

export async function restoreOnboarding() {
  const local = await loadOnboardingSnapshot();
  if (local.completedAt) return local;

  if (isBackendConfigured()) {
    try {
      const db = getSupabase();
      const { data: sessionData, error: sessionError } =
        await db.auth.getSession();
      if (sessionError) throw sessionError;
      if (sessionData.session) {
        const { data, error } = await db
          .from("user_onboarding")
          .select(
            "flow_version,status,current_step_id,answers,completed_at,updated_at",
          )
          .eq("user_id", sessionData.session.user.id)
          .maybeSingle();
        if (error) throw error;
        if (data?.flow_version === local.flowVersion) {
          const remoteStep = onboardingSteps.findIndex(
            (step) => step.id === data.current_step_id,
          );
          const remote: OnboardingSnapshot = {
            flowVersion: local.flowVersion,
            stepIndex: remoteStep >= 0 ? remoteStep : 0,
            answers: sanitizeAnswers(data.answers as OnboardingAnswers),
            completedAt:
              data.status === "completed" && typeof data.completed_at === "string"
                ? data.completed_at
                : null,
            remoteSynced: true,
          };
          await saveOnboardingSnapshot(remote);
          return remote;
        }
      }
    } catch (error) {
      console.warn("[Finn onboarding] Supabase restore deferred:", error);
    }
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
  const current = await loadOnboardingSnapshot();
  const snapshot: OnboardingSnapshot = {
    ...current,
    stepIndex,
    answers: sanitizeAnswers(answers),
    completedAt: null,
    remoteSynced: false,
  };
  await saveOnboardingSnapshot(snapshot);
}

export async function completeOnboarding(answers: OnboardingAnswers) {
  const completedAt = new Date().toISOString();
  const snapshot: OnboardingSnapshot = {
    ...createEmptyOnboardingSnapshot(),
    stepIndex: onboardingSteps.length - 1,
    answers: sanitizeAnswers(answers),
    completedAt,
    remoteSynced: false,
  };

  // Completion is durable locally before any network request.
  await saveOnboardingSnapshot(snapshot);
  void syncSnapshot(snapshot).then(async (remoteSynced) => {
    if (!remoteSynced) return;
    const latest = await loadOnboardingSnapshot();
    if (latest.completedAt === completedAt) {
      await saveOnboardingSnapshot({ ...latest, remoteSynced: true });
    }
  });
  return snapshot;
}
