import { useEffect } from "react";
import {
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
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Icon } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import type { EntrySource } from "@/types/domain";
import type {
  EntryProcessingPhase,
  PendingEntryResult,
} from "../hooks/use-journal-entry-processing";
import { JournalGlyph } from "./journal-glyph";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const STATUS_DURATION = 300;
const REDUCED_DURATION = 120;
const SETTLE_DURATION = 450;
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

const statusPhases = [
  "thinking",
  "reading",
  "organizing",
  "sources",
  "calculating",
  "result",
] as const;

type VisiblePhase = (typeof statusPhases)[number];

const labels: Partial<Record<VisiblePhase, string>> = {
  thinking: "Thinking",
  reading: "Reading",
  organizing: "Organizing",
  calculating: "Calculating",
};

export function JournalProcessingStatus({
  phase,
  result,
}: {
  phase: Exclude<EntryProcessingPhase, "typing">;
  result: PendingEntryResult | null;
}) {
  const reducedMotion = useReducedMotion();
  const position = useSharedValue(-1);
  const lineHeight = useSharedValue(FALLBACK_LINE_HEIGHT);
  const settleProgress = useSharedValue(0);
  const shimmerOffset = useSharedValue(SHIMMER_START);
  const visiblePhase = phase === "settling" ? "result" : phase;
  const phaseIndex = statusPhases.indexOf(visiblePhase);

  useEffect(() => {
    cancelAnimation(position);
    position.set(
      withTiming(phaseIndex, {
        duration: reducedMotion ? REDUCED_DURATION : STATUS_DURATION,
        easing: EASE_OUT,
      }),
    );
  }, [phaseIndex, position, reducedMotion, visiblePhase]);

  useEffect(() => {
    cancelAnimation(settleProgress);
    settleProgress.set(
      phase === "settling"
        ? withTiming(1, {
            duration: reducedMotion ? REDUCED_DURATION : SETTLE_DURATION,
            easing: EASE_OUT,
          })
        : 0,
    );
  }, [phase, reducedMotion, settleProgress]);

  useEffect(() => {
    cancelAnimation(shimmerOffset);
    shimmerOffset.set(SHIMMER_START);
    if (!reducedMotion) {
      shimmerOffset.set(
        withRepeat(
          withTiming(SHIMMER_END, {
            duration: 1_400,
            easing: Easing.linear,
          }),
          -1,
          false,
        ),
      );
    }
    return () => cancelAnimation(shimmerOffset);
  }, [reducedMotion, shimmerOffset]);

  const handleMeasure = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.height;
    if (measured > 0) lineHeight.set(measured);
  };

  const accessibilityLabel =
    visiblePhase === "sources"
      ? `${result?.sourceCount ?? 1} ${pluralize("source", result?.sourceCount ?? 1)}`
      : visiblePhase === "result"
        ? result?.resultLabel ?? "Entry ready"
        : labels[visiblePhase] ?? "Processing entry";

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      accessibilityRole={visiblePhase === "result" ? "text" : "progressbar"}
      style={styles.viewport}
    >
      <Text
        aria-hidden
        onLayout={handleMeasure}
        style={[styles.statusText, styles.measure]}
      >
        Calculating
      </Text>
      {statusPhases.map((item, index) => (
        <StatusLayer
          key={item}
          index={index}
          lineHeight={lineHeight}
          phase={item}
          position={position}
          reducedMotion={reducedMotion}
          result={result}
          settleProgress={settleProgress}
          shimmerOffset={shimmerOffset}
        />
      ))}
    </View>
  );
}

function StatusLayer({
  index,
  lineHeight,
  phase,
  position,
  reducedMotion,
  result,
  settleProgress,
  shimmerOffset,
}: {
  index: number;
  lineHeight: SharedValue<number>;
  phase: VisiblePhase;
  position: SharedValue<number>;
  reducedMotion: boolean;
  result: PendingEntryResult | null;
  settleProgress: SharedValue<number>;
  shimmerOffset: SharedValue<number>;
}) {
  const layerStyle = useAnimatedStyle(() => {
    const distance = index - position.get();
    return {
      opacity: interpolate(
        Math.abs(distance),
        [0, 1],
        [1, 0],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateY: reducedMotion ? 0 : -distance * lineHeight.get(),
        },
      ],
    };
  });
  const emphasizedResultStyle = useAnimatedStyle(() => ({
    opacity: 1 - settleProgress.get(),
  }));
  const settledResultStyle = useAnimatedStyle(() => ({
    opacity: settleProgress.get(),
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.layer, layerStyle]}>
      {phase === "sources" ? (
        <SourceStatus
          count={result?.sourceCount ?? 1}
          reducedMotion={reducedMotion}
          shimmerOffset={shimmerOffset}
          sources={result?.entry.sources ?? []}
        />
      ) : phase === "result" ? (
        <View style={styles.resultStack}>
          <Animated.View
            style={[styles.resultRow, styles.resultLayer, emphasizedResultStyle]}
          >
            <JournalGlyph
              name="sparkle"
              size={13}
              color={result?.review ? Finn.amber : Finn.blue}
              colors={
                result?.review ? undefined : ["#3378DE", "#77B4F4"]
              }
            />
            <Text
              numberOfLines={1}
              style={[
                styles.resultText,
                { color: result?.review ? Finn.amber : Finn.blue },
              ]}
            >
              {result?.resultLabel ?? ""}
            </Text>
          </Animated.View>
          <Animated.View
            style={[styles.resultRow, styles.resultLayer, settledResultStyle]}
          >
            {result?.review && (
              <JournalGlyph name="sparkle" size={11} color={Finn.amber} />
            )}
            <Text numberOfLines={1} style={styles.settledResultText}>
              {result?.resultLabel ?? ""}
            </Text>
          </Animated.View>
        </View>
      ) : (
        <ShimmerText
          reducedMotion={reducedMotion}
          shimmerOffset={shimmerOffset}
          text={labels[phase] ?? ""}
        />
      )}
    </Animated.View>
  );
}

function SourceStatus({
  count,
  reducedMotion,
  shimmerOffset,
  sources,
}: {
  count: number;
  reducedMotion: boolean;
  shimmerOffset: SharedValue<number>;
  sources: EntrySource[];
}) {
  const badges = Math.min(Math.max(count, 1), 3);
  return (
    <View style={styles.sourceRow}>
      <View style={styles.badges}>
        {Array.from({ length: badges }, (_, index) => (
          <View
            key={index}
            style={[
              styles.badge,
              index > 0 && styles.overlappingBadge,
              { backgroundColor: ["#EDB16D", "#EBC64F", Finn.purple][index] },
            ]}
          >
            <Icon
              name={sources[index]?.icon ?? "note"}
              size={8}
              color="#FFFDF9"
            />
          </View>
        ))}
      </View>
      <ShimmerText
        compact
        reducedMotion={reducedMotion}
        shimmerOffset={shimmerOffset}
        text={`${count} ${pluralize("source", count)}`}
      />
    </View>
  );
}

function ShimmerText({
  compact = false,
  reducedMotion,
  shimmerOffset,
  text,
}: {
  compact?: boolean;
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
      style={[styles.shimmerMask, compact && styles.compactShimmerMask]}
    >
      <View style={styles.shimmerBase} />
      {!reducedMotion && (
        <Animated.View style={[styles.shimmerHighlight, highlightStyle]} />
      )}
    </MaskedView>
  );
}

export function JournalProcessingDots() {
  const reducedMotion = useReducedMotion();
  return (
    <View
      accessibilityLabel="Waiting to process entry"
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={styles.dots}
    >
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

function pluralize(word: string, count: number) {
  return count === 1 ? word : `${word}s`;
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
  compactShimmerMask: {
    width: 72,
  },
  shimmerHighlight: {
    bottom: 0,
    experimental_backgroundImage:
      "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,250,249,0.92) 50%, rgba(255,255,255,0) 100%)",
    position: "absolute",
    top: 0,
    width: 64,
  },
  sourceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    justifyContent: "flex-end",
  },
  badges: {
    alignItems: "center",
    flexDirection: "row",
  },
  badge: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.9)",
    borderRadius: 7,
    borderWidth: 1,
    height: 14,
    justifyContent: "center",
    width: 14,
  },
  overlappingBadge: {
    marginLeft: -4,
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
    gap: 5,
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
    fontSize: 13,
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
    backgroundColor: Finn.purple,
    borderRadius: 3,
    height: 5,
    width: 5,
  },
  reducedDot: {
    opacity: 0.5,
  },
});
