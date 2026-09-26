import { useEffect, useState } from "react";
import {
  AppState,
  Platform,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { MaskedView } from "@expo/ui/community/masked-view";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Motion } from "@/constants/motion";
import { Finn, JournalType } from "@/constants/theme";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { JournalGlyph } from "./journal-glyph";

type EntryProcessingPhase =
  | "typing" | "thinking" | "reading" | "organizing"
  | "sources" | "calculating" | "preview" | "result" | "settling";
type PendingEntryResult = {
  resultLabel: string;
  review: boolean;
  provisional?: boolean;
  accessibilityLabel?: string;
};

const REDUCED_DURATION = 120;
const FALLBACK_LINE_HEIGHT = 25;
const SHIMMER_START = -70;
const SHIMMER_END = 180;

const BOUNCE_KEYFRAMES = {
  "0%": { opacity: 0.32, transform: [{ translateY: 0 }] },
  "30%": { opacity: 1, transform: [{ translateY: -3 }] },
  "60%": { opacity: 0.46, transform: [{ translateY: 0 }] },
  "100%": { opacity: 0.32, transform: [{ translateY: 0 }] },
} as const;

const WEB_SHIMMER_KEYFRAMES = {
  "0%": { opacity: 0.56 },
  "50%": { opacity: 0.92 },
  "100%": { opacity: 0.56 },
} as const;

const loopingPhases = [
  { key: "thinking-start", phase: "thinking" },
  { key: "searching", phase: "searching" },
  { key: "reading", phase: "reading" },
  { key: "calculating", phase: "calculating" },
  // The duplicate makes the repeated 4 -> 0 reset visually seamless.
  { key: "thinking-loop", phase: "thinking" },
] as const;

type LoadingPhase = (typeof loopingPhases)[number]["phase"];
type ProcessingVariant = "text" | "receipt";

const labels: Record<ProcessingVariant, Record<LoadingPhase, string>> = {
  text: {
    thinking: "Thinking",
    searching: "Searching",
    reading: "Reading",
    calculating: "Calculating",
  },
  receipt: {
    thinking: "Thinking",
    searching: "Scanning",
    reading: "Reading",
    calculating: "Calculating",
  },
};

export function JournalProcessingStatus({
  phase,
  result,
  variant = "text",
}: {
  phase: Exclude<EntryProcessingPhase, "typing">;
  result: PendingEntryResult | null;
  variant?: ProcessingVariant;
}) {
  const reducedMotion = useMotionPreference();
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const position = useSharedValue(0);
  const lineHeight = useSharedValue(FALLBACK_LINE_HEIGHT);
  const resultProgress = useSharedValue(0);
  const settleProgress = useSharedValue(0);
  const shimmerOffset = useSharedValue(SHIMMER_START);
  const resultVisible = phase === "preview" || phase === "result" || phase === "settling";
  const processing = !resultVisible;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    cancelAnimation(position);
    if (processing && foreground) {
      position.set(0);
      const transition = (next: number) => withDelay(
        Motion.statusHold,
        withTiming(next, {
          duration: reducedMotion ? 0 : Motion.statusTransition,
          easing: Motion.easeOut,
        }),
      );
      position.set(withRepeat(withSequence(
        transition(1),
        transition(2),
        transition(3),
        transition(4),
      ), -1, false));
    }
    return () => cancelAnimation(position);
  }, [foreground, position, processing, reducedMotion]);

  useEffect(() => {
    cancelAnimation(resultProgress);
    resultProgress.set(resultVisible
      ? withTiming(1, {
          duration: reducedMotion ? REDUCED_DURATION : Motion.statusTransition,
          easing: Motion.easeOut,
        })
      : 0);
    return () => cancelAnimation(resultProgress);
  }, [reducedMotion, resultProgress, resultVisible]);

  useEffect(() => {
    cancelAnimation(settleProgress);
    settleProgress.set(
      phase === "settling"
        ? withTiming(1, {
            duration: reducedMotion ? REDUCED_DURATION : Motion.resultSettle,
            easing: Motion.easeOut,
          })
        : 0,
    );
    return () => cancelAnimation(settleProgress);
  }, [phase, reducedMotion, settleProgress]);

  useEffect(() => {
    cancelAnimation(shimmerOffset);
    shimmerOffset.set(SHIMMER_START);
    if (!reducedMotion && foreground && !resultVisible) {
      shimmerOffset.set(
        withRepeat(
          withTiming(SHIMMER_END, {
            duration: Motion.statusHold + Motion.statusTransition,
            easing: Easing.linear,
          }),
          -1,
          false,
        ),
      );
    }
    return () => cancelAnimation(shimmerOffset);
  }, [foreground, reducedMotion, resultVisible, shimmerOffset]);

  const handleMeasure = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.height;
    if (measured > 0) lineHeight.set(measured);
  };

  const accessibilityLabel = resultVisible
    ? result?.accessibilityLabel ?? result?.resultLabel ?? "Entry ready"
    : variant === "receipt"
      ? "Finn is thinking, scanning, reading, and calculating"
      : "Finn is thinking, searching, reading, and calculating";

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      accessibilityRole={resultVisible ? "text" : "progressbar"}
      style={styles.viewport}
    >
      <Text
        aria-hidden
        onLayout={handleMeasure}
        style={[styles.statusText, styles.measure]}
      >
        Calculating
      </Text>
      {loopingPhases.map((item, index) => (
        <StatusLayer
          key={item.key}
          index={index}
          lineHeight={lineHeight}
          phase={item.phase}
          position={position}
          reducedMotion={reducedMotion}
          resultProgress={resultProgress}
          shimmerOffset={shimmerOffset}
          variant={variant}
        />
      ))}
      <ResultStatus
            lineHeight={lineHeight}
            reducedMotion={reducedMotion}
            result={result}
            resultProgress={resultProgress}
            settleProgress={settleProgress}
      />
    </View>
  );
}

function StatusLayer({
  index,
  lineHeight,
  phase,
  position,
  reducedMotion,
  resultProgress,
  shimmerOffset,
  variant,
}: {
  index: number;
  lineHeight: SharedValue<number>;
  phase: LoadingPhase;
  position: SharedValue<number>;
  reducedMotion: boolean;
  resultProgress: SharedValue<number>;
  shimmerOffset: SharedValue<number>;
  variant: ProcessingVariant;
}) {
  const layerStyle = useAnimatedStyle(() => {
    const distance = index - position.get();
    return {
      opacity: interpolate(
        Math.abs(distance),
        [0, 1],
        [1 - resultProgress.get(), 0],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateY: reducedMotion
            ? 0
            : (-distance + resultProgress.get()) * lineHeight.get(),
        },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.layer, layerStyle]}>
      <ShimmerText
        reducedMotion={reducedMotion}
        shimmerOffset={shimmerOffset}
        text={labels[variant][phase]}
      />
    </Animated.View>
  );
}

function ResultStatus({
  lineHeight,
  reducedMotion,
  result,
  resultProgress,
  settleProgress,
}: {
  lineHeight: SharedValue<number>;
  reducedMotion: boolean;
  result: PendingEntryResult | null;
  resultProgress: SharedValue<number>;
  settleProgress: SharedValue<number>;
}) {
  const layerStyle = useAnimatedStyle(() => ({
    opacity: resultProgress.get(),
    transform: [{
      translateY: reducedMotion
        ? 0
        : -(1 - resultProgress.get()) * lineHeight.get(),
    }],
  }));
  const emphasizedResultStyle = useAnimatedStyle(() => ({
    opacity: 1 - settleProgress.get(),
  }));
  const settledResultStyle = useAnimatedStyle(() => ({
    opacity: settleProgress.get(),
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.layer, layerStyle]}>
      <View style={styles.resultStack}>
        <Animated.View
          style={[styles.resultRow, styles.resultLayer, emphasizedResultStyle]}
        >
          <JournalGlyph
            name="sparkle"
            size={13}
            color={result?.review ? Finn.amber : Finn.blue}
            colors={
              result?.review
                ? undefined
                : [Finn.blueSparkleStart, Finn.blueSparkleEnd]
            }
          />
          <Animated.Text
            key={`emphasized-${result?.resultLabel ?? ""}`}
            entering={FadeIn.duration(reducedMotion ? REDUCED_DURATION : Motion.statusTransition)}
            numberOfLines={1}
            style={[
              styles.resultText,
              { color: result?.review ? Finn.amber : Finn.blue },
            ]}
          >
            {result?.resultLabel ?? ""}
          </Animated.Text>
        </Animated.View>
        <Animated.View
          style={[styles.resultRow, styles.resultLayer, settledResultStyle]}
        >
          {result?.review && (
            <JournalGlyph name="sparkle" size={12} color={Finn.amber} />
          )}
          <Animated.Text
            key={`settled-${result?.resultLabel ?? ""}`}
            entering={FadeIn.duration(reducedMotion ? REDUCED_DURATION : Motion.statusTransition)}
            numberOfLines={1}
            style={styles.settledResultText}
          >
            {result?.resultLabel ?? ""}
          </Animated.Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function ShimmerText({
  reducedMotion,
  shimmerOffset,
  text,
}: {
  reducedMotion: boolean;
  shimmerOffset: SharedValue<number>;
  text: string;
}) {
  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerOffset.get() }],
  }));

  if (Platform.OS === "web") {
    return (
      <Animated.Text
        numberOfLines={1}
        style={[
          styles.statusText,
          !reducedMotion && {
            animationName: WEB_SHIMMER_KEYFRAMES,
            animationDuration: "900ms",
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
          },
        ]}
      >
        {text}
      </Animated.Text>
    );
  }

  return (
    <MaskedView
      maskElement={
        <Text numberOfLines={1} style={[styles.statusText, styles.maskText]}>
          {text}
        </Text>
      }
      style={styles.shimmerMask}
    >
      <View style={styles.shimmerBase} />
      {!reducedMotion && (
        <Animated.View style={[styles.shimmerHighlight, highlightStyle]} />
      )}
    </MaskedView>
  );
}

export function JournalProcessingDots({ decorative = false }: {
  decorative?: boolean;
}) {
  if (decorative) return <BouncingDots />;
  return (
    <View
      accessibilityLabel="Waiting to process entry"
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
    >
      <BouncingDots />
    </View>
  );
}

function BouncingDots() {
  const reducedMotion = useMotionPreference();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.dots}>
      {[0, 1, 2].map((index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            reducedMotion
              ? styles.reducedDot
              : {
                  animationName: BOUNCE_KEYFRAMES,
                  animationDuration: "600ms",
                  animationDelay: `${index * 100}ms`,
                  animationIterationCount: "infinite",
                  animationTimingFunction: "ease-in-out",
                },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    alignSelf: "flex-start",
    justifyContent: "center",
    overflow: "hidden",
    width: "100%",
  },
  measure: {
    opacity: 0,
  },
  layer: {
    alignItems: "flex-end",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  statusText: {
    color: "#C7C0C0",
    fontFamily: JournalType.regular,
    fontSize: 15,
    includeFontPadding: false,
    lineHeight: 25,
    textAlign: "right",
  },
  maskText: {
    width: "100%",
  },
  shimmerMask: {
    height: 25,
    width: "100%",
  },
  shimmerBase: {
    backgroundColor: "#C7C0C0",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  shimmerHighlight: {
    bottom: 0,
    experimental_backgroundImage:
      "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,250,249,0.92) 50%, rgba(255,255,255,0) 100%)",
    position: "absolute",
    top: 0,
    width: 64,
  },
  resultStack: {
    alignItems: "flex-end",
    height: 25,
    justifyContent: "center",
    width: "100%",
  },
  resultLayer: {
    position: "absolute",
    right: 0,
  },
  resultRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    justifyContent: "flex-end",
  },
  resultText: {
    fontFamily: JournalType.medium,
    fontSize: 15,
    includeFontPadding: false,
    lineHeight: 25,
  },
  settledResultText: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
    lineHeight: 19,
  },
  dots: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    justifyContent: "flex-end",
    minHeight: 25,
  },
  dot: {
    backgroundColor: "#C7C0C0",
    borderRadius: 3,
    height: 5,
    width: 5,
  },
  reducedDot: {
    opacity: 0.5,
  },
});
