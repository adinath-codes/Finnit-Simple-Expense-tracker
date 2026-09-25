import type {
  CustomerInfo,
  PurchasesEntitlementInfo,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";

export type SubscriptionAccessState =
  | "signed-out"
  | "loading"
  | "active"
  | "inactive"
  | "configuration-error"
  | "error";

export type TrialEligibility = "eligible" | "ineligible" | "unknown" | "none";

export type SubscriptionPlan = {
  id: string;
  package: PurchasesPackage;
  name: string;
  durationLabel: string;
  renewalPeriodLabel: string;
  fullPrice: string;
  monthlyEquivalent: string | null;
  hasRequiredThreeDayTrial: boolean;
  trialEligibility: TrialEligibility;
};

export type SubscriptionSnapshot = {
  state: SubscriptionAccessState;
  customerInfo: CustomerInfo | null;
  entitlement: PurchasesEntitlementInfo | null;
  offering: PurchasesOffering | null;
  plans: SubscriptionPlan[];
  error: string | null;
};

export type SubscriptionContextValue = SubscriptionSnapshot & {
  isActive: boolean;
  isBusy: boolean;
  refresh: () => Promise<void>;
  purchase: (plan: SubscriptionPlan) => Promise<boolean>;
  restore: () => Promise<boolean>;
  redeemOfferCode: () => Promise<boolean>;
  manage: () => Promise<void>;
};
