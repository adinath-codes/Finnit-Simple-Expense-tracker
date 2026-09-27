import { Platform } from "react-native";
import Purchases, {
  INTRO_ELIGIBILITY_STATUS,
  LOG_LEVEL,
  PACKAGE_TYPE,
  type CustomerInfo,
  type IntroEligibility,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";
import { callBackend } from "@/lib/ai/api";
import type {
  SubscriptionPlan,
  TrialEligibility,
} from "@/features/paywall/types/subscription.types";

export const PREMIUM_ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim() || "finn_it_pro";

const preferredOfferingId =
  process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID?.trim() || "default";

let configuredUserId: string | null = null;

function platformApiKey() {
  // iOS development builds must talk to Apple's sandbox so StoreKit can load
  // the real products and apply introductory-offer eligibility. Keep Android's
  // existing Test Store-first development behavior unchanged.
  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();
  }

  const testStoreApiKey =
    process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY?.trim();
  if (__DEV__ && !isPlaceholder(testStoreApiKey)) return testStoreApiKey;

  if (Platform.OS === "android") {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim();
  }
  return process.env.EXPO_PUBLIC_REVENUECAT_WEB_API_KEY?.trim();
}

export function isRevenueCatTestStore() {
  return platformApiKey()?.startsWith("test_") === true;
}

function isPlaceholder(value: string | undefined) {
  if (!value) return true;
  const normalized = value.toLowerCase();
  return (
    normalized.includes("your-") ||
    normalized.includes("replace-me") ||
    normalized.includes("placeholder")
  );
}

export function revenueCatConfigurationError() {
  const apiKey = platformApiKey();
  if (isPlaceholder(apiKey)) {
    return `Add the ${Platform.OS} RevenueCat public SDK key to the Expo environment.`;
  }
  if (!__DEV__ && apiKey?.startsWith("test_")) {
    return "A release build cannot use a RevenueCat Test Store key.";
  }
  return null;
}

export async function configureRevenueCat(appUserId: string) {
  const apiKey = platformApiKey();
  if (isPlaceholder(apiKey) || !apiKey) {
    throw new Error(revenueCatConfigurationError() ?? "RevenueCat is not configured.");
  }

  const configured = await Purchases.isConfigured();
  if (!configured) {
    Purchases.configure({ apiKey, appUserID: appUserId });
    configuredUserId = appUserId;
    await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    return;
  }

  const currentUserId = await Purchases.getAppUserID();
  if (currentUserId !== appUserId) {
    await Purchases.logIn(appUserId);
  }
  configuredUserId = appUserId;
}

export async function clearRevenueCatUser() {
  if (!configuredUserId || !(await Purchases.isConfigured())) return;
  try {
    if (!(await Purchases.isAnonymous())) await Purchases.logOut();
  } finally {
    configuredUserId = null;
  }
}

export function activePremiumEntitlement(customerInfo: CustomerInfo) {
  const entitlement = customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];
  return entitlement?.isActive ? entitlement : null;
}

export async function loadSubscriptionProducts() {
  const offerings = await Purchases.getOfferings();
  const offering =
    offerings.all[preferredOfferingId] ?? offerings.current ?? null;
  const packages = offering?.availablePackages ?? [];
  const identifiers = packages.map((item) => item.product.identifier);
  let eligibility: Record<string, IntroEligibility> = {};

  if (Platform.OS === "ios" && identifiers.length > 0) {
    try {
      eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility(
        identifiers,
      );
    } catch {
      // StoreKit applies the correct offer at checkout. Unknown eligibility is
      // presented conservatively in the custom paywall copy.
    }
  }

  return {
    offering,
    plans: packages.map((item) => planFromPackage(item, eligibility)),
  };
}

export async function loadSubscriptionSnapshot() {
  const [customerInfo, products] = await Promise.all([
    Purchases.getCustomerInfo(),
    loadSubscriptionProducts(),
  ]);
  return { customerInfo, ...products };
}

/** Refresh the server snapshot outside capture's latency-sensitive path. */
export async function reconcileSubscriptionEntitlement(userId: string) {
  return callBackend<{
    entitlement: { active: boolean; expires_at: string | null };
  }>("refresh-entitlement", {}, userId);
}

export function planFromPackage(
  item: PurchasesPackage,
  eligibility: Record<string, IntroEligibility> = {},
): SubscriptionPlan {
  const product = item.product;
  const hasRequiredThreeDayTrial = hasThreeDayFreeTrial(item);
  const eligibilityStatus = eligibility[product.identifier]?.status;
  let trialEligibility: TrialEligibility = "none";

  if (hasRequiredThreeDayTrial) {
    if (Platform.OS === "android") trialEligibility = "eligible";
    else if (
      eligibilityStatus ===
      INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE
    ) {
      trialEligibility = "eligible";
    } else if (
      eligibilityStatus ===
      INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE
    ) {
      trialEligibility = "ineligible";
    } else {
      trialEligibility = "unknown";
    }
  }

  return {
    id: item.identifier,
    package: item,
    name: planName(item),
    durationLabel: durationLabel(item),
    renewalPeriodLabel: renewalPeriodLabel(item),
    fullPrice: product.priceString,
    monthlyEquivalent:
      item.packageType === PACKAGE_TYPE.ANNUAL
        ? product.pricePerMonthString
        : null,
    hasRequiredThreeDayTrial,
    trialEligibility,
  };
}

function hasThreeDayFreeTrial(item: PurchasesPackage) {
  const intro = item.product.introPrice;
  if (
    intro?.price === 0 &&
    intro.periodUnit.toUpperCase() === "DAY" &&
    intro.periodNumberOfUnits === 3
  ) {
    return true;
  }

  const freePhase = item.product.defaultOption?.freePhase;
  return (
    freePhase?.price.amountMicros === 0 &&
    freePhase.billingPeriod.unit === "DAY" &&
    freePhase.billingPeriod.value === 3
  );
}

function planName(item: PurchasesPackage) {
  switch (item.packageType) {
    case PACKAGE_TYPE.ANNUAL:
      return "Finn Premium Annual";
    case PACKAGE_TYPE.SIX_MONTH:
      return "Finn Premium — 6 months";
    case PACKAGE_TYPE.THREE_MONTH:
      return "Finn Premium — 3 months";
    case PACKAGE_TYPE.TWO_MONTH:
      return "Finn Premium — 2 months";
    case PACKAGE_TYPE.MONTHLY:
      return "Finn Premium Monthly";
    case PACKAGE_TYPE.WEEKLY:
      return "Finn Premium Weekly";
    default:
      return item.product.title || "Finn Premium";
  }
}

function durationLabel(item: PurchasesPackage) {
  switch (item.packageType) {
    case PACKAGE_TYPE.ANNUAL:
      return "1 year";
    case PACKAGE_TYPE.SIX_MONTH:
      return "6 months";
    case PACKAGE_TYPE.THREE_MONTH:
      return "3 months";
    case PACKAGE_TYPE.TWO_MONTH:
      return "2 months";
    case PACKAGE_TYPE.MONTHLY:
      return "1 month";
    case PACKAGE_TYPE.WEEKLY:
      return "1 week";
    default:
      return readableIsoPeriod(item.product.subscriptionPeriod);
  }
}

function renewalPeriodLabel(item: PurchasesPackage) {
  switch (item.packageType) {
    case PACKAGE_TYPE.ANNUAL:
      return "year";
    case PACKAGE_TYPE.SIX_MONTH:
      return "6 months";
    case PACKAGE_TYPE.THREE_MONTH:
      return "3 months";
    case PACKAGE_TYPE.TWO_MONTH:
      return "2 months";
    case PACKAGE_TYPE.MONTHLY:
      return "month";
    case PACKAGE_TYPE.WEEKLY:
      return "week";
    default:
      return readableIsoPeriod(item.product.subscriptionPeriod).toLowerCase();
  }
}

function readableIsoPeriod(period: string | null) {
  if (!period) return "Subscription";
  const match = /^P(\d+)([DWMY])$/.exec(period);
  if (!match) return "Subscription";
  const count = Number(match[1]);
  const unit = { D: "day", W: "week", M: "month", Y: "year" }[match[2]];
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

export function subscriptionErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "userCancelled" in error) {
    if ((error as { userCancelled?: boolean }).userCancelled) return null;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Finn couldn’t reach the App Store. Check your connection and try again.";
}

export async function purchaseSubscription(plan: SubscriptionPlan) {
  return Purchases.purchasePackage(plan.package);
}

export async function restoreSubscription() {
  return Purchases.restorePurchases();
}

export async function presentOfferCodeRedemption() {
  if (Platform.OS !== "ios") {
    throw new Error("Offer-code redemption is available in the iOS app.");
  }
  await Purchases.presentCodeRedemptionSheet();
  await Purchases.invalidateCustomerInfoCache();
  return Purchases.getCustomerInfo();
}

export async function showSubscriptionManagement() {
  await Purchases.showManageSubscriptions();
}

export async function trackPaywallImpression(offering: PurchasesOffering | null) {
  if (!(await Purchases.isConfigured())) return;
  await Purchases.trackCustomPaywallImpression({ offering });
}
