import { createContext, useContext, useEffect, useId, useState } from "react";
import { AppState, StyleSheet, Text, View, type DimensionValue } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Finn } from "@/constants/theme";
import { Motion } from "@/constants/motion";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { ContentFade } from "@/components/ui/motion";

const ShimmerContext = createContext<SharedValue<number> | null>(null);
export type LoadingVariant = "startup" | "contexts" | "results" | "onboarding" | "capture";

export function SkeletonBlock({ width = "100%", height = 16, radius = 8 }: {
  width?: DimensionValue; height?: number; radius?: number;
}) {
  const phase = useContext(ShimmerContext);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const gradientId = `shimmer-${useId().replace(/:/g, "")}`;
  const style = useAnimatedStyle(() => ({
    opacity: phase && measuredWidth ? 1 : 0,
    transform: [{ translateX: (phase?.get() ?? -1) * measuredWidth }],
  }));
  return <View accessible={false} onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
    style={{ width, height, borderRadius: radius, overflow: "hidden", backgroundColor: "#E9E4DF" }}>
    {phase && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%">
        <Defs><LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient></Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>}
  </View>;
}

/** Only mount while work is pending. `active` tracks route visibility. */
export function LoadingState({ variant = "startup", label = "Loading…", active = true }: {
  variant?: LoadingVariant; label?: string; active?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const reduced = useMotionPreference();
  const phase = useSharedValue(-1);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), Motion.loadingDelay);
    const subscription = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => { clearTimeout(timer); subscription.remove(); };
  }, []);
  const animate = visible && active && foreground && !reduced;
  useEffect(() => {
    cancelAnimation(phase);
    phase.set(-1);
    if (animate) phase.set(withRepeat(withTiming(1, { duration: Motion.shimmer, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(phase);
  }, [animate, phase]);
  const fullPage = variant === "startup" || variant === "onboarding" || variant === "capture";
  return <View style={[styles.container, fullPage && styles.fullPage]} accessibilityState={{ busy: true }}>
    {visible && <ContentFade>
      <View accessible accessibilityLabel={label} accessibilityLiveRegion="polite">
        <Text style={styles.label}>{label}</Text>
      </View>
      <ShimmerContext.Provider value={animate ? phase : null}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.blocks}>
          {variant === "startup" ? <>
            <SkeletonBlock width="28%" height={22} />
            <SkeletonBlock width="66%" />
            <SkeletonBlock width="44%" />
          </> : variant === "capture" ? <>
            <SkeletonBlock width="35%" height={24} />
            <SkeletonBlock height={120} radius={18} />
            <SkeletonBlock width="35%" height={44} radius={22} />
          </> : variant === "onboarding" ? <>
            <SkeletonBlock width="30%" height={14} />
            <SkeletonBlock width="85%" height={36} />
            <SkeletonBlock height={58} radius={18} />
            <SkeletonBlock height={58} radius={18} />
            <SkeletonBlock height={48} radius={24} />
          </> : variant === "results" ? <>
            <SkeletonBlock width="38%" />
            <SkeletonBlock width="62%" height={40} />
            <SkeletonBlock height={82} radius={20} />
            <SkeletonBlock height={82} radius={20} />
          </> : <>
            <SkeletonBlock height={86} radius={20} />
            <SkeletonBlock height={86} radius={20} />
            <SkeletonBlock height={86} radius={20} />
          </>}
        </View>
      </ShimmerContext.Provider>
    </ContentFade>}
  </View>;
}
const styles = StyleSheet.create({
  container: { paddingVertical: 18, minHeight: 80 },
  fullPage: { flex: 1, justifyContent: "center", paddingHorizontal: 28, backgroundColor: Finn.canvas },
  blocks: { gap: 16 },
  label: { color: Finn.secondary, fontSize: 13, marginBottom: 18 },
});
