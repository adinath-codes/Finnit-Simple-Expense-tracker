import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  FINN_ONBOARDING_FLOW_VERSION,
  type OnboardingAnswers,
  type OnboardingSnapshot,
} from "@/features/onboarding/types/onboarding.types";

const ONBOARDING_STORAGE_KEY = "@finn/onboarding/v1";

export function createEmptyOnboardingSnapshot(): OnboardingSnapshot {
  return {
    flowVersion: FINN_ONBOARDING_FLOW_VERSION,
    stepIndex: 0,
    answers: {},
    completedAt: null,
    remoteSynced: false,
  };
}

function validAnswers(value: unknown): OnboardingAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const answers: OnboardingAnswers = {};
  if (typeof source.goal === "string") answers.goal = source.goal;
  if (typeof source.friction === "string") answers.friction = source.friction;
  if (typeof source.currency === "string") answers.currency = source.currency;
  return answers;
}

export async function loadOnboardingSnapshot(): Promise<OnboardingSnapshot> {
  const raw = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
  if (!raw) return createEmptyOnboardingSnapshot();

  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingSnapshot>;
    if (parsed.flowVersion !== FINN_ONBOARDING_FLOW_VERSION) {
      return createEmptyOnboardingSnapshot();
    }
    return {
      flowVersion: FINN_ONBOARDING_FLOW_VERSION,
      stepIndex:
        typeof parsed.stepIndex === "number" && Number.isInteger(parsed.stepIndex)
          ? Math.max(0, parsed.stepIndex)
          : 0,
      answers: validAnswers(parsed.answers),
      completedAt:
        typeof parsed.completedAt === "string" ? parsed.completedAt : null,
      remoteSynced: parsed.remoteSynced === true,
    };
  } catch {
    return createEmptyOnboardingSnapshot();
  }
}

export async function saveOnboardingSnapshot(snapshot: OnboardingSnapshot) {
  await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(snapshot));
}

export async function clearOnboardingSnapshot() {
  await AsyncStorage.removeItem(ONBOARDING_STORAGE_KEY);
}

export async function hasCompletedOnboarding() {
  const snapshot = await loadOnboardingSnapshot();
  return snapshot.completedAt !== null;
}
