import type { SubscriptionPlan } from "@/features/paywall/types/subscription.types";

type PaywallCopyPlan = Pick<
  SubscriptionPlan,
  | "fullPrice"
  | "hasRequiredThreeDayTrial"
  | "renewalPeriodLabel"
  | "trialEligibility"
>;

export type TrialOfferStatus = "eligible" | "ineligible" | "unknown";

export function trialOfferStatus(
  plan: PaywallCopyPlan | null,
): TrialOfferStatus {
  if (!plan) return "unknown";
  if (
    plan.hasRequiredThreeDayTrial &&
    plan.trialEligibility === "eligible"
  ) {
    return "eligible";
  }
  if (
    plan.hasRequiredThreeDayTrial &&
    plan.trialEligibility === "unknown"
  ) {
    return "unknown";
  }
  return "ineligible";
}

export function introductoryOfferConfirmation(storeName: string) {
  const provider = storeName === "App Store" ? "Apple" : storeName;
  return `${provider} will confirm any available introductory offer before purchase.`;
}

export function checkoutCtaLabel(
  plan: PaywallCopyPlan | null,
  testStore = false,
) {
  if (!plan) return "Store plans unavailable";
  if (testStore) return "Run Test Store purchase";

  switch (trialOfferStatus(plan)) {
    case "eligible":
      return "Start your 3-day free trial";
    case "ineligible":
      return `Subscribe for ${plan.fullPrice}/${plan.renewalPeriodLabel}`;
    case "unknown":
      return "Continue to subscription options";
  }
}

export const PAYWALL_NAVIGATION_LABELS = [
  "Choose your plan",
  "Start with Finnit Premium",
  "Review plans and pricing",
] as const;

export function trialTimelineCopy(
  plan: PaywallCopyPlan | null,
  storeName: string,
) {
  switch (trialOfferStatus(plan)) {
    case "eligible":
      return {
        title: "How your 3-day free trial works",
        items: [
          {
            label: "Today",
            body: "Unlock full access to all Finnit Premium features",
          },
          {
            label: "Day 2",
            body: "Allow notifications after checkout to get reminded before your 3-day free trial ends",
          },
          {
            label: "Day 3",
            body: "Your selected plan begins. Cancel before the trial ends to avoid a charge",
          },
        ],
      };
    case "ineligible":
      return {
        title: "Start with Finnit Premium",
        items: [
          {
            label: "Plans",
            body: "Choose the Premium plan that fits",
          },
          {
            label: "Pricing",
            body: `${storeName} shows the exact price before confirmation`,
          },
          {
            label: "Subscription",
            body: "Your selected plan starts after confirmation and renews until cancelled",
          },
        ],
      };
    case "unknown":
      return {
        title: "See your subscription options",
        items: [
          { label: "Plans", body: "Choose your plan" },
          { label: "Pricing", body: "Review plans and pricing" },
          {
            label: "Offer",
            body: introductoryOfferConfirmation(storeName),
          },
        ],
      };
  }
}

export function planPageTitle(
  plan: PaywallCopyPlan | null,
  testStore = false,
) {
  if (testStore) return "Choose a Test Store plan.";
  switch (trialOfferStatus(plan)) {
    case "eligible":
      return "Choose what happens after your 3-day free trial.";
    case "ineligible":
      return "Choose the Premium plan that fits.";
    case "unknown":
      return "See your subscription options.";
  }
}

export function pageReassurance(
  page: number,
  plan: PaywallCopyPlan | null,
  storeName: string,
) {
  if (page === 0) {
    return "A clearer money picture begins with one honest note.";
  }
  if (page === 1) {
    return "Keep the habit human. Let Finnit handle the structure.";
  }
  switch (trialOfferStatus(plan)) {
    case "eligible":
      return "No charge today. Cancel before the 3-day trial ends to avoid a charge.";
    case "ineligible":
      return `You'll see the exact price before ${storeName} asks you to confirm.`;
    case "unknown":
      return introductoryOfferConfirmation(storeName);
  }
}

export function billingDisclosure(
  plan: PaywallCopyPlan,
  testStore = false,
) {
  if (testStore) {
    return "RevenueCat Test Store simulates checkout and entitlement access; verify the 3-day trial in each store sandbox.";
  }
  switch (trialOfferStatus(plan)) {
    case "eligible":
      return `Free for 3 days, then ${plan.fullPrice} every ${plan.renewalPeriodLabel}. Auto-renews until cancelled.`;
    case "ineligible":
      return `${plan.fullPrice} is charged on confirmation and renews every ${plan.renewalPeriodLabel} until cancelled.`;
    case "unknown":
      return `Standard price: ${plan.fullPrice} every ${plan.renewalPeriodLabel}, auto-renewing until cancelled.`;
  }
}
