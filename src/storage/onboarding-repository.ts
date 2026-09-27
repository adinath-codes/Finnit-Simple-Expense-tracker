import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  FINN_ONBOARDING_FLOW_VERSION,
  type OnboardingAnswers,
  type OnboardingSnapshot,
} from "@/features/onboarding/types/onboarding.types";

const ONBOARDING_STORAGE_KEY = "@finn/onboarding/v1";
// Kept only so account deletion can remove completion markers written by older
// versions. New onboarding state is never used as a device-wide completion gate.
const ONBOARDING_COMPLETION_KEY = "@finn/onboarding/completion/v1";

export function createEmptyOnboardingSnapshot(): OnboardingSnapshot {
  return {
    flowVersion: FINN_ONBOARDING_FLOW_VERSION,
    stepIndex: 0,
    answers: {},
    completedAt: null,
    remoteSynced: false,
    accountId: null,
  };
}

function validAnswers(value: unknown): OnboardingAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const answers: OnboardingAnswers = {};
  if (typeof source.name === "string") answers.name = source.name;
  if (typeof source.worryTiming === "string") {
    answers.worryTiming = source.worryTiming;
  }
  if (typeof source.painPoint === "string") {
    answers.painPoint = source.painPoint;
  }
  if (typeof source.futureQuestion === "string") {
    answers.futureQuestion = source.futureQuestion;
  }
  if (typeof source.captureStyle === "string") {
    answers.captureStyle = source.captureStyle;
  }
  if (typeof source.currency === "string") answers.currency = source.currency;
  return answers;
}

function parseSnapshot(raw: string | null): OnboardingSnapshot | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingSnapshot>;
    const completedAt =
      typeof parsed.completedAt === "string" ? parsed.completedAt : null;
    // Keep established users out of a revised questionnaire, but intentionally
    // discard unfinished old drafts whose step indexes are no longer reliable.
    if (parsed.flowVersion !== FINN_ONBOARDING_FLOW_VERSION) {
      if (!completedAt) return null;
      return {
        ...createEmptyOnboardingSnapshot(),
        stepIndex: 0,
        completedAt,
        remoteSynced: true,
        accountId: typeof parsed.accountId === "string" ? parsed.accountId : null,
      };
    }
    return {
      flowVersion: FINN_ONBOARDING_FLOW_VERSION,
      stepIndex:
        typeof parsed.stepIndex === "number" && Number.isInteger(parsed.stepIndex)
          ? Math.max(0, parsed.stepIndex)
          : 0,
      answers: validAnswers(parsed.answers),
      completedAt,
      remoteSynced: parsed.remoteSynced === true,
      accountId: typeof parsed.accountId === "string" ? parsed.accountId : null,
    };
  } catch {
    return null;
  }
}

export async function loadOnboardingDraftSnapshot() {
  const raw = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
  return parseSnapshot(raw);
}

export async function loadOnboardingSnapshot(): Promise<OnboardingSnapshot> {
  return (await loadOnboardingDraftSnapshot()) ?? createEmptyOnboardingSnapshot();
}

export async function saveOnboardingSnapshot(snapshot: OnboardingSnapshot) {
  await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(snapshot));
}

/** Removes every locally held answer and progress value after the account owns it. */
export async function clearOnboardingDraft() {
  await AsyncStorage.removeItem(ONBOARDING_STORAGE_KEY);
}

export async function clearOnboardingSnapshot() {
  await AsyncStorage.multiRemove([
    ONBOARDING_STORAGE_KEY,
    ONBOARDING_COMPLETION_KEY,
  ]);
}

export async function hasCompletedOnboarding() {
  const snapshot = await loadOnboardingSnapshot();
  return snapshot.completedAt !== null;
}
