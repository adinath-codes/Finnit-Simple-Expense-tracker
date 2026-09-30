import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import Purchases, { type CustomerInfo } from "react-native-purchases";
import { useSession } from "@/features/auth/providers/session-provider";
import {
  cancelTrialExpiryReminder,
  syncTrialExpiryReminder,
} from "@/features/notifications/services/notification-service";
import {
  activePremiumEntitlement,
  clearRevenueCatUser,
  configureRevenueCat,
  loadSubscriptionProducts,
  presentOfferCodeRedemption,
  purchaseSubscription,
  reconcileSubscriptionEntitlement,
  restoreSubscription,
  revenueCatConfigurationError,
  showSubscriptionManagement,
  subscriptionErrorMessage,
} from "@/features/paywall/services/subscription-service";
import type {
  SubscriptionContextValue,
  SubscriptionPlan,
  SubscriptionSnapshot,
} from "@/features/paywall/types/subscription.types";
import {
  loadSubscriptionEntitlementCache,
  saveSubscriptionEntitlementCache,
} from "@/features/paywall/services/subscription-cache";
import {
  OFFLINE_RENEWAL_GRACE_MS,
  usableCachedEntitlement,
} from "@/features/paywall/services/subscription-cache-policy";

const initialSnapshot: SubscriptionSnapshot = {
  state: "signed-out",
  customerInfo: null,
  entitlement: null,
  offering: null,
  plans: [],
  error: null,
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

function reconcileInBackground(userId: string | null) {
  if (!userId) return;
  void reconcileSubscriptionEntitlement(userId).catch(() => undefined);
}

export function SubscriptionProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const [snapshot, setSnapshot] = useState<SubscriptionSnapshot>(initialSnapshot);
  const [isBusy, setIsBusy] = useState(false);
  const mounted = useRef(true);
  const activeUserId = useRef<string | null>(userId);

  const applyCustomerInfo = useCallback((customerInfo: CustomerInfo) => {
    if (!mounted.current) return false;
    const entitlement = activePremiumEntitlement(customerInfo);
    if (userId) {
      void saveSubscriptionEntitlementCache(userId, entitlement)
        .catch(() => undefined);
    }
    setSnapshot((current) => ({
      ...current,
      state: entitlement ? "active" : "inactive",
      customerInfo,
      entitlement,
      error: null,
    }));
    return !!entitlement;
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const configurationError = revenueCatConfigurationError();
    if (configurationError) {
      setSnapshot((current) => ({
        ...current,
        state: "configuration-error",
        error: configurationError,
      }));
      return;
    }

    setIsBusy(true);
    try {
      await configureRevenueCat(userId);
      const customerInfo = await Purchases.getCustomerInfo();
      if (!mounted.current || activeUserId.current !== userId) return;
      void syncTrialExpiryReminder(
        activePremiumEntitlement(customerInfo),
      ).catch(() => undefined);
      const isActive = applyCustomerInfo(customerInfo);
      if (isActive) reconcileInBackground(userId);
      else {
        const products = await loadSubscriptionProducts();
        if (!mounted.current || activeUserId.current !== userId) return;
        setSnapshot((current) => ({ ...current, ...products }));
      }
    } catch (error) {
      if (!mounted.current || activeUserId.current !== userId) return;
      setSnapshot((current) => ({
        ...current,
        state: current.entitlement ? "active" : "error",
        error: subscriptionErrorMessage(error),
      }));
    } finally {
      if (mounted.current) setIsBusy(false);
    }
  }, [applyCustomerInfo, userId]);

  useEffect(() => {
    mounted.current = true;
    activeUserId.current = userId;
    if (!userId) {
      setSnapshot(initialSnapshot);
      void clearRevenueCatUser();
      void cancelTrialExpiryReminder().catch(() => undefined);
      return () => {
        mounted.current = false;
        activeUserId.current = null;
      };
    }

    const listener = (customerInfo: CustomerInfo) => {
      void syncTrialExpiryReminder(
        activePremiumEntitlement(customerInfo),
      ).catch(() => undefined);
      const isActive = applyCustomerInfo(customerInfo);
      if (!isActive) {
        void loadSubscriptionProducts()
          .then((products) => {
            if (!mounted.current || activeUserId.current !== userId) return;
            setSnapshot((current) => ({ ...current, ...products }));
          })
          .catch(() => undefined);
      }
    };
    let cancelled = false;
    let listening = false;
    const bootstrap = async () => {
      const cached = await loadSubscriptionEntitlementCache(userId)
        .catch(() => null);
      if (cancelled || activeUserId.current !== userId) return;
      const cachedEntitlement = usableCachedEntitlement(cached);
      setSnapshot({
        ...initialSnapshot,
        state: cachedEntitlement ? "active" : "loading",
        entitlement: cachedEntitlement,
      });

      const configurationError = revenueCatConfigurationError();
      if (configurationError) {
        if (!cachedEntitlement) {
          setSnapshot((current) => ({
            ...current,
            state: "configuration-error",
            error: configurationError,
          }));
        }
        return;
      }

      try {
        await configureRevenueCat(userId);
        if (cancelled || activeUserId.current !== userId) return;
        Purchases.addCustomerInfoUpdateListener(listener);
        listening = true;
        const customerInfo = await Purchases.getCustomerInfo();
        if (cancelled || activeUserId.current !== userId) return;
        void syncTrialExpiryReminder(
          activePremiumEntitlement(customerInfo),
        ).catch(() => undefined);
        const isActive = applyCustomerInfo(customerInfo);
        if (!isActive) {
          const products = await loadSubscriptionProducts();
          if (cancelled || activeUserId.current !== userId) return;
          setSnapshot((current) => ({ ...current, ...products }));
        }
      } catch (error) {
        if (cancelled || activeUserId.current !== userId) return;
        setSnapshot((current) => ({
          ...current,
          state: current.entitlement ? "active" : "error",
          error: current.entitlement ? null : subscriptionErrorMessage(error),
        }));
      }
    };
    void bootstrap();
    return () => {
      cancelled = true;
      mounted.current = false;
      if (activeUserId.current === userId) activeUserId.current = null;
      if (listening) Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [applyCustomerInfo, userId]);

  useEffect(() => {
    const expiresAt = snapshot.entitlement?.expirationDateMillis;
    if (!expiresAt) return;

    const deadline = snapshot.entitlement?.willRenew
      ? expiresAt + OFFLINE_RENEWAL_GRACE_MS
      : expiresAt;
    let timer: ReturnType<typeof setTimeout>;
    const expire = () => {
      setSnapshot((current) => ({
        ...current,
        state: "inactive",
        entitlement: null,
      }));
      void Purchases.invalidateCustomerInfoCache()
        .then(refresh)
        .catch(() => undefined);
    };
    const schedule = () => {
      const remaining = deadline - Date.now() + 1_000;
      if (remaining > 2_147_483_647) {
        timer = setTimeout(schedule, 2_147_483_647);
      } else {
        timer = setTimeout(expire, Math.max(0, remaining));
      }
    };
    schedule();
    return () => clearTimeout(timer);
  }, [
    refresh,
    snapshot.entitlement?.expirationDateMillis,
    snapshot.entitlement?.willRenew,
  ]);

  const purchase = useCallback(async (plan: SubscriptionPlan) => {
    setIsBusy(true);
    setSnapshot((current) => ({ ...current, error: null }));
    try {
      const result = await purchaseSubscription(plan);
      await syncTrialExpiryReminder(
        activePremiumEntitlement(result.customerInfo),
        true,
      ).catch(() => false);
      const isActive = applyCustomerInfo(result.customerInfo);
      reconcileInBackground(userId);
      return isActive;
    } catch (error) {
      const message = subscriptionErrorMessage(error);
      if (message && mounted.current) {
        setSnapshot((current) => ({ ...current, error: message }));
      }
      return false;
    } finally {
      if (mounted.current) setIsBusy(false);
    }
  }, [applyCustomerInfo, userId]);

  const restore = useCallback(async () => {
    setIsBusy(true);
    setSnapshot((current) => ({ ...current, error: null }));
    try {
      if (userId) await configureRevenueCat(userId);
      const customerInfo = await restoreSubscription();
      void syncTrialExpiryReminder(
        activePremiumEntitlement(customerInfo),
      ).catch(() => undefined);
      const isActive = applyCustomerInfo(customerInfo);
      reconcileInBackground(userId);
      if (!isActive && mounted.current) {
        setSnapshot((current) => ({
          ...current,
          error: "No active App Store purchases were found for this Apple ID.",
        }));
      }
      return isActive;
    } catch (error) {
      if (mounted.current) {
        setSnapshot((current) => ({
          ...current,
          error: subscriptionErrorMessage(error),
        }));
      }
      return false;
    } finally {
      if (mounted.current) setIsBusy(false);
    }
  }, [applyCustomerInfo, userId]);

  const redeemOfferCode = useCallback(async () => {
    setIsBusy(true);
    setSnapshot((current) => ({ ...current, error: null }));
    try {
      if (userId) await configureRevenueCat(userId);
      const customerInfo = await presentOfferCodeRedemption();
      void syncTrialExpiryReminder(
        activePremiumEntitlement(customerInfo),
      ).catch(() => undefined);
      if (userId) await reconcileSubscriptionEntitlement(userId);
      return applyCustomerInfo(customerInfo);
    } catch (error) {
      if (mounted.current) {
        setSnapshot((current) => ({
          ...current,
          error: subscriptionErrorMessage(error),
        }));
      }
      return false;
    } finally {
      if (mounted.current) setIsBusy(false);
    }
  }, [applyCustomerInfo, userId]);

  const value = useMemo<SubscriptionContextValue>(() => ({
    ...snapshot,
    isActive: snapshot.state === "active",
    isBusy,
    refresh,
    purchase,
    restore,
    redeemOfferCode,
    manage: showSubscriptionManagement,
  }), [
    isBusy,
    purchase,
    redeemOfferCode,
    refresh,
    restore,
    snapshot,
  ]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const value = useContext(SubscriptionContext);
  if (!value) {
    throw new Error("useSubscription must be used within SubscriptionProvider");
  }
  return value;
}
