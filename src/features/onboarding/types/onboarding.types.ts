import type { IconName } from "@/components/ui/icon";
import type { CharacterAnimationType } from "@/components/character/character-animations";

export const FINN_ONBOARDING_FLOW_VERSION = "2026-09-26.5";

export type OnboardingQuestionId =
  | "name"
  | "worryTiming"
  | "painPoint"
  | "captureStyle"
  | "currency"
  | "futureQuestion";

export type OnboardingAnswers = Partial<Record<OnboardingQuestionId, string>>;

export type OnboardingOption = {
  id: string;
  label: string;
  description: string;
  icon: IconName;
};

export type StorySceneId =
  | "hello"
  | "worry"
  | "busy-day"
  | "natural-note"
  | "receipt-scan"
  | "month-end"
  | "relief";

type SharedStep = {
  id: string;
  chapter: number;
};

export type InitialStoryStep = SharedStep & {
  kind: "story";
  scene: StorySceneId;
  copy: string;
  highlightedWords: readonly string[];
  continueLabel: string;
};

export type QuestionStep = SharedStep & {
  kind: "question";
  questionId: OnboardingQuestionId;
  animType: CharacterAnimationType;
  responseType: "name" | "choice" | "currency";
  title: string;
  subtitle: string;
  options: OnboardingOption[];
};

export type InviteStep = SharedStep & {
  kind: "invite";
  title: string;
  subtitle: string;
  continueLabel: string;
};

export type OnboardingStep = InitialStoryStep | QuestionStep | InviteStep;

export type OnboardingSnapshot = {
  flowVersion: string;
  stepIndex: number;
  answers: OnboardingAnswers;
  completedAt: string | null;
  remoteSynced: boolean;
  /** Set once an authenticated account claims this local pre-sign-in draft. */
  accountId: string | null;
};
