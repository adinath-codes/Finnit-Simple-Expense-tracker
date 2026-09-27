import { isSupportedCurrency } from "../../../../supabase/functions/_shared/currencies.ts";
import type { OnboardingAnswers } from "@/features/onboarding/types/onboarding.types";

const allowedAnswers = {
  worryTiming: new Set([
    "right-after",
    "end-of-day",
    "balance-surprise",
    "month-end",
  ]),
  painPoint: new Set([
    "forget-details",
    "totals-no-story",
    "splits-messy",
    "tracking-homework",
  ]),
  captureStyle: new Set([
    "one-line",
    "receipt-snap",
    "mix-both",
    "later-catch-up",
  ]),
  futureQuestion: new Set([
    "where-money-went",
    "what-changed",
    "friend-splits",
    "quiet-leaks",
  ]),
};

export function sanitizeOnboardingName(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .trim()
    .replace(/\s+/g, " ");
  if (!normalized) return undefined;
  return Array.from(normalized).slice(0, 40).join("");
}

export function sanitizeOnboardingAnswers(
  answers: OnboardingAnswers,
): OnboardingAnswers {
  return {
    name: sanitizeOnboardingName(answers.name),
    worryTiming:
      answers.worryTiming && allowedAnswers.worryTiming.has(answers.worryTiming)
        ? answers.worryTiming
        : undefined,
    painPoint:
      answers.painPoint && allowedAnswers.painPoint.has(answers.painPoint)
        ? answers.painPoint
        : undefined,
    captureStyle:
      answers.captureStyle && allowedAnswers.captureStyle.has(answers.captureStyle)
        ? answers.captureStyle
        : undefined,
    currency: isSupportedCurrency(answers.currency) ? answers.currency : undefined,
    futureQuestion:
      answers.futureQuestion &&
      allowedAnswers.futureQuestion.has(answers.futureQuestion)
        ? answers.futureQuestion
        : undefined,
  };
}
