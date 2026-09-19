import type { IconName } from "@/components/ui/icon";

export const FINN_ONBOARDING_FLOW_VERSION = "2026-09-19.1";

export type OnboardingQuestionId = "goal" | "friction" | "currency";

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

export type QuestionStep = SharedStep & {
  kind: "question";
  questionId: OnboardingQuestionId;
  options: OnboardingOption[];
};

export type EducationStep = SharedStep & {
  kind: "education";
  variant: "capture" | "remember";
  continueLabel: string;
};

export type OnboardingStep = WelcomeStep | QuestionStep | EducationStep;

export type OnboardingSnapshot = {
  flowVersion: string;
  stepIndex: number;
  answers: OnboardingAnswers;
  completedAt: string | null;
  remoteSynced: boolean;
};
