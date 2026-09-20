import { isSupportedCurrency } from "../../../../supabase/functions/_shared/currencies.ts";
import type { OnboardingAnswers } from "@/features/onboarding/types/onboarding.types";

const allowedAnswers = {
  desiredOutcome: new Set([
    "clear-weeks",
    "fast-notes",
    "fewer-leaks",
    "better-recall",
  ]),
  blindSpot: new Set(["busy-days", "cash-runs", "group-plans", "work-costs"]),
  futureQuestion: new Set([
    "trip-total",
    "friend-splits",
    "quiet-leaks",
    "work-spend",
  ]),
  memoryContext: new Set(["people", "places", "reasons", "moments"]),
  captureStyle: new Set([
    "one-line",
    "receipt-snap",
    "later-catch-up",
    "repeat-tap",
  ]),
};

export function sanitizeOnboardingAnswers(
  answers: OnboardingAnswers,
): OnboardingAnswers {
  return {
    desiredOutcome:
      answers.desiredOutcome && allowedAnswers.desiredOutcome.has(answers.desiredOutcome)
        ? answers.desiredOutcome
        : undefined,
    blindSpot:
      answers.blindSpot && allowedAnswers.blindSpot.has(answers.blindSpot)
        ? answers.blindSpot
        : undefined,
    futureQuestion:
      answers.futureQuestion && allowedAnswers.futureQuestion.has(answers.futureQuestion)
        ? answers.futureQuestion
        : undefined,
    memoryContext:
      answers.memoryContext && allowedAnswers.memoryContext.has(answers.memoryContext)
        ? answers.memoryContext
        : undefined,
    captureStyle:
      answers.captureStyle && allowedAnswers.captureStyle.has(answers.captureStyle)
        ? answers.captureStyle
        : undefined,
    currency: isSupportedCurrency(answers.currency) ? answers.currency : undefined,
  };
}
