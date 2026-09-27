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
    setSnapshot((current) => ({
      ...current,
      state: entitlement ? "active" : "inactive",
      customerInfo,
      entitlement,
      error: null,
    }));
    return !!entitlement;
  }, []);

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
      applyCustomerInfo(customerInfo);
      reconcileInBackground(userId);
      void loadSubscriptionProducts()
        .then((products) => {
          if (!mounted.current || activeUserId.current !== userId) return;
          setSnapshot((current) => ({ ...current, ...products }));
        })
        .catch(() => undefined);
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
      return () => {
        mounted.current = false;
        activeUserId.current = null;
      };
    }

    setSnapshot((current) => ({
      ...current,
      state: "loading",
      error: null,
    }));
    void refresh();

    const listener = (customerInfo: CustomerInfo) => {
      applyCustomerInfo(customerInfo);
      reconcileInBackground(userId);
      void loadSubscriptionProducts()
        .then((products) => {
          if (!mounted.current) return;
          setSnapshot((current) => ({ ...current, ...products }));
        })
        .catch(() => undefined);
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      mounted.current = false;
      if (activeUserId.current === userId) activeUserId.current = null;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [applyCustomerInfo, refresh, userId]);

  const purchase = useCallback(async (plan: SubscriptionPlan) => {
    setIsBusy(true);
    setSnapshot((current) => ({ ...current, error: null }));
    try {
      const result = await purchaseSubscription(plan);
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
      const customerInfo = await restoreSubscription();
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
      const customerInfo = await presentOfferCodeRedemption();
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
