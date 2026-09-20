import type { IconName } from "@/components/ui/icon";
import type { CharacterAnimationType } from "@/components/character/character-animations";

export const FINN_ONBOARDING_FLOW_VERSION = "2026-09-20.4";

export type OnboardingQuestionId =
  | "desiredOutcome"
  | "blindSpot"
  | "futureQuestion"
  | "memoryContext"
  | "captureStyle"
  | "currency";

export type OnboardingAnswers = Partial<
  Record<OnboardingQuestionId, string>
>;

export type OnboardingOption = {
  id: string;
  label: string;
  description: string;
  icon: IconName;
};

type SharedStep = {
  id: string;
  eyebrow?: string;
  title: string;
  subtitle: string;
};

export type WelcomeStep = SharedStep & {
  kind: "welcome";
  continueLabel: string;
};

export type InitialStoryVariant =
  | "life"
  | "overwhelm"
  | "forgotten"
  | "natural-note"
  | "organized"
  | "journal"
  | "ask"
  | "handoff";

export type InitialStoryStep = SharedStep & {
  kind: "story";
  variant: InitialStoryVariant;
  continueLabel: string;
};

export type ConversationStep = {
  id: string;
  kind: "conversation";
  lines: readonly [string, string, string];
  continueLabel: string;
};

export type QuestionStep = SharedStep & {
  kind: "question";
  questionId: OnboardingQuestionId;
  animType: CharacterAnimationType;
  options: OnboardingOption[];
};

export type EducationStep = SharedStep & {
  kind: "education";
  variant: "capture" | "remember";
  continueLabel: string;
};

export type OnboardingStep =
  | WelcomeStep
  | InitialStoryStep
  | ConversationStep
  | QuestionStep
  | EducationStep;

export type OnboardingSnapshot = {
  flowVersion: string;
  stepIndex: number;
  answers: OnboardingAnswers;
  completedAt: string | null;
  remoteSynced: boolean;
  /** Set once an authenticated account claims this local pre-sign-in draft. */
  accountId: string | null;
};
