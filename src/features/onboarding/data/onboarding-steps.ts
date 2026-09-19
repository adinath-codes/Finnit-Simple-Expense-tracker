import type { OnboardingStep } from "@/features/onboarding/types/onboarding.types";

export const onboardingSteps: OnboardingStep[] = [
  {
    id: "welcome",
    kind: "welcome",
    title: "Your money,\nmade simple.",
    subtitle: "Like Notes, but it remembers the numbers.",
    continueLabel: "Get started",
  },
  {
    id: "goal",
    kind: "question",
    questionId: "goal",
    eyebrow: "START WITH YOUR WHY",
    title: "What would make Finn worth keeping?",
    subtitle: "Choose the outcome you want most. You can change course anytime.",
    options: [
      {
        id: "remember",
        label: "Remember where my money went",
        description: "Keep a reliable history without reconstructing it later.",
        icon: "note",
      },
      {
        id: "effortless",
        label: "Track without forms",
        description: "Write one natural sentence and move on with the day.",
        icon: "sparkle",
      },
      {
        id: "patterns",
        label: "See my spending patterns",
        description: "Understand the story behind everyday spending.",
        icon: "calendar",
      },
      {
        id: "context",
        label: "Keep the context, not just totals",
        description: "Remember the people, places and reasons around a purchase.",
        icon: "search",
      },
    ],
  },
  {
    id: "capture-explainer",
    kind: "education",
    variant: "capture",
    eyebrow: "YOUR MONEY. LIKE NOTES.",
    title: "Write what happened. Finn organizes the rest.",
    subtitle: "No categories, merchant forms or bookkeeping before you can save.",
    continueLabel: "Keep going",
  },
  {
    id: "friction",
    kind: "question",
    questionId: "friction",
    eyebrow: "REMOVE THE FRICTION",
    title: "What usually breaks the tracking habit?",
    subtitle: "Finn will keep this in mind when guiding you.",
    options: [
      {
        id: "too-many-fields",
        label: "Too many fields",
        description: "I do not want to fill out a transaction form.",
        icon: "quantity",
      },
      {
        id: "forget",
        label: "I forget to log things",
        description: "By the time I remember, the useful details are gone.",
        icon: "clock",
      },
      {
        id: "missing-context",
        label: "Totals lose the story",
        description: "A number alone does not tell me what actually happened.",
        icon: "wallet",
      },
      {
        id: "feels-like-work",
        label: "Finance apps feel like homework",
        description: "I want a journal, not another dashboard to maintain.",
        icon: "edit",
      },
    ],
  },
  {
    id: "currency",
    kind: "question",
    questionId: "currency",
    eyebrow: "ONE USEFUL DEFAULT",
    title: "What is your everyday currency?",
    subtitle: "Finn still preserves the original currency when you spend abroad.",
    options: [
      {
        id: "INR",
        label: "Indian rupee · ₹",
        description: "Use INR for entries without an explicit currency.",
        icon: "wallet",
      },
      {
        id: "USD",
        label: "US dollar · $",
        description: "Use USD for entries without an explicit currency.",
        icon: "wallet",
      },
      {
        id: "EUR",
        label: "Euro · €",
        description: "Use EUR for entries without an explicit currency.",
        icon: "wallet",
      },
      {
        id: "GBP",
        label: "British pound · £",
        description: "Use GBP for entries without an explicit currency.",
        icon: "wallet",
      },
      {
        id: "AED",
        label: "UAE dirham · AED",
        description: "Use AED for entries without an explicit currency.",
        icon: "wallet",
      },
    ],
  },
  {
    id: "remember-explainer",
    kind: "education",
    variant: "remember",
    eyebrow: "REMEMBER EVERYTHING",
    title: "Your financial life becomes searchable memory.",
    subtitle: "Capture freely now. Find the exact moment or pattern later.",
    continueLabel: "Start journaling",
  },
];

export const progressStepIds = onboardingSteps
  .filter((step) => step.kind !== "welcome")
  .map((step) => step.id);
