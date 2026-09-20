import { useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

let reduced: boolean | undefined;
let generation = 0;
let subscription: ReturnType<typeof AccessibilityInfo.addEventListener> | undefined;
const listeners = new Set<() => void>();
function publish(value: boolean) {
  reduced = value;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    const requestGeneration = ++generation;
    let changed = false;
    subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      changed = true;
      publish(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (requestGeneration === generation && !changed) publish(value);
    }).catch(() => undefined);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { generation++; subscription?.remove(); subscription = undefined; }
  };
}
/** One native subscription for all controls; changes apply while Finn is open. */
export function useMotionPreference() {
  const initial = useReducedMotion();
  return useSyncExternalStore(subscribe, () => reduced ?? initial, () => initial);
}
