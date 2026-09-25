import {
  ANALYTICS_EVENTS,
  captureAnalytics,
} from "@/lib/analytics/analytics";

type QuotaListener = () => void;

const listeners = new Set<QuotaListener>();
let lastNoticeAt = 0;

export function notifyAiQuotaReached() {
  const now = Date.now();
  if (now - lastNoticeAt < 60000) return;
  lastNoticeAt = now;
  captureAnalytics(ANALYTICS_EVENTS.aiQuotaReached);
  listeners.forEach((listener) => listener());
}

export function subscribeAiQuotaReached(listener: QuotaListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
