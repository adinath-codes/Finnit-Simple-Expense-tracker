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
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CustomToast,
  type CustomToastState,
} from "@/components/ui/custom-toast";

type ToastAction = {
  label: string;
  onPress: () => void;
};

export type AppToast = {
  id?: string;
  message: string;
  highlighted?: string;
  state?: CustomToastState;
  action?: ToastAction;
  durationMs?: number;
  onClose?: () => void;
};

type QueuedToast = AppToast & { id: string };

type ToastContextValue = {
  showToast: (toast: AppToast) => string;
  dismissToast: (id?: string) => void;
  setToastPresentationPaused: (paused: boolean) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState<QueuedToast | null>(null);
  const [presentationPaused, setToastPresentationPaused] = useState(false);
  const activeRef = useRef<QueuedToast | null>(null);
  const queue = useRef<QueuedToast[]>([]);
  const sequence = useRef(0);
  const transitioning = useRef(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const presentNext = useCallback(() => {
    if (transitioning.current || activeRef.current || queue.current.length === 0) return;
    const next = queue.current.shift() ?? null;
    activeRef.current = next;
    setActive(next);
  }, []);

  const dismissToast = useCallback((id?: string) => {
    const current = activeRef.current;
    if (!current || (id && current.id !== id)) {
      if (id) queue.current = queue.current.filter((toast) => toast.id !== id);
      return;
    }

    activeRef.current = null;
    setActive(null);
    current.onClose?.();
    transitioning.current = true;
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(() => {
      transitioning.current = false;
      presentNext();
    }, 200);
  }, [presentNext]);

  const showToast = useCallback((toast: AppToast) => {
    const id = toast.id ?? `toast-${++sequence.current}`;
    if (
      activeRef.current?.id === id ||
      queue.current.some((queued) => queued.id === id)
    ) return id;

    queue.current.push({ ...toast, id });
    presentNext();
    return id;
  }, [presentNext]);

  useEffect(() => {
    if (!active || presentationPaused) return;
    const timeout = setTimeout(
      () => dismissToast(active.id),
      active.durationMs ?? (active.action ? 10_000 : 6_500),
    );
    return () => clearTimeout(timeout);
  }, [active, dismissToast, presentationPaused]);

  useEffect(() => () => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
  }, []);

  const value = useMemo(
    () => ({ showToast, dismissToast, setToastPresentationPaused }),
    [dismissToast, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        pointerEvents="box-none"
        style={[styles.host, { paddingTop: insets.top + 8 }]}
      >
        {active && !presentationPaused ? (
          <CustomToast
            key={active.id}
            mess={active.message}
            highlighted={active.highlighted}
            state={active.state ?? "info"}
            actionLabel={active.action?.label}
            onAction={active.action ? () => {
              active.action?.onPress();
              dismissToast(active.id);
            } : undefined}
            onDismiss={() => dismissToast(active.id)}
          />
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useAppToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useAppToast must be used within ToastProvider");
  return value;
}

const styles = StyleSheet.create({
  host: {
    left: 14,
    position: "absolute",
    right: 14,
    top: 0,
    zIndex: 1000,
  },
});
