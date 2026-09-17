import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Finn, JournalType } from "@/constants/theme";
import { useJournal } from "@/providers/app-providers";
import type { Goal } from "@/types/domain";
import { entryTotal } from "@/utils/amounts";
import { money } from "@/utils/currency";
import {
  JournalGlyph,
  type JournalGlyphName,
} from "@/features/journal/components/journal-glyph";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const LIQUID_ENTER_DURATION = 400;
const LIQUID_EXIT_DURATION = 300;
const BAR_DURATION = 620;

export function SpendingBreakdownCard({ visible }: { visible: boolean }) {
  const { entries, goals, selectedDate, settings } = useJournal();
  const reducedMotion = useReducedMotion();
  const reveal = useSharedValue(0);
  const dayEntries = entries.filter((entry) => entry.date === selectedDate);
  const total = dayEntries.reduce((sum, entry) => sum + entryTotal(entry), 0);

  useEffect(() => {
    cancelAnimation(reveal);
    if (reducedMotion) {
      reveal.set(
        withTiming(visible ? 1 : 0, {
          duration: 120,
          easing: EASE_OUT,
          reduceMotion: ReduceMotion.Never,
        }),
      );
      return;
    }

    reveal.set(
      visible
        ? withSpring(1, {
            duration: LIQUID_ENTER_DURATION,
            dampingRatio: 1,
            reduceMotion: ReduceMotion.Never,
          })
        : withSpring(0, {
            duration: LIQUID_EXIT_DURATION,
            dampingRatio: 0.8,
            overshootClamping: true,
            reduceMotion: ReduceMotion.Never,
          }),
    );
  }, [reducedMotion, reveal, visible]);

  const liquidSurfaceStyle = useAnimatedStyle(() => {
    const progress = reveal.get();
    if (reducedMotion) return { opacity: progress };

    return {
      opacity: interpolate(progress, [0, 0.08, 1], [0, 1, 1]),
      borderRadius: interpolate(
        progress,
        [0, 0.58, 1],
        [90, 44, 27],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateX: interpolate(
            progress,
            [0, 0.3, 0.62, 0.82, 1],
            [0, -3, 4, -1, 0],
            Extrapolation.CLAMP,
          ),
        },
        {
          scaleX: interpolate(
            progress,
            [0, 0.22, 0.55, 0.84, 1],
            [0.18, 0.22, 0.5, 1.02, 1],
            Extrapolation.CLAMP,
          ),
        },
        {
          scaleY: interpolate(
            progress,
            [0, 0.22, 0.55, 0.84, 1],
            [0.12, 0.44, 0.86, 1.025, 1],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const liquidTailStyle = useAnimatedStyle(() => {
    const progress = reveal.get();
    if (reducedMotion) return { opacity: 0 };

    return {
      opacity: interpolate(
        progress,
        [0, 0.08, 0.56, 0.78],
        [0, 1, 0.85, 0],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateY: interpolate(
            progress,
            [0, 0.5, 0.78],
            [14, 1, -5],
            Extrapolation.CLAMP,
          ),
        },
        {
          scaleX: interpolate(
            progress,
            [0, 0.42, 0.78],
            [0.68, 1.12, 0.72],
            Extrapolation.CLAMP,
          ),
        },
        {
          scaleY: interpolate(
            progress,
            [0, 0.42, 0.78],
            [0.72, 1.08, 0.62],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const contentStyle = useAnimatedStyle(() => {
    const progress = reveal.get();
    return {
      opacity: reducedMotion
        ? progress
        : visible
          ? interpolate(
              progress,
              [0.5, 0.78],
              [0, 1],
              Extrapolation.CLAMP,
            )
          : interpolate(
              progress,
              [0.72, 1],
              [0, 1],
              Extrapolation.CLAMP,
            ),
      transform: reducedMotion
        ? []
        : [
            {
              translateY: interpolate(
                progress,
                [0.5, 0.82],
                [10, 0],
                Extrapolation.CLAMP,
              ),
            },
          ],
    };
  });

  return (
    <Animated.View
      accessibilityElementsHidden={!visible}
      accessibilityLiveRegion="polite"
      importantForAccessibility={visible ? "yes" : "no-hide-descendants"}
      pointerEvents={visible ? "auto" : "none"}
      style={styles.card}
    >
      <Animated.View
        aria-hidden
        style={[styles.liquidTail, liquidTailStyle]}
      />
      <Animated.View
        aria-hidden
        style={[styles.liquidSurface, liquidSurfaceStyle]}
      />
      <Animated.View style={[styles.content, contentStyle]}>
        <Text accessibilityRole="header" style={styles.title}>
          Goals
        </Text>
        {goals.map((goal, index) => {
          const value =
            goal.id === "daily"
              ? total
              : dayEntries.reduce(
                  (sum, entry) =>
                    sum +
                    entry.items
                      .filter((item) => item.category === goal.id)
                      .reduce(
                        (itemTotal, item) =>
                          itemTotal + item.amountMinor * item.quantity,
                        0,
                      ),
                  0,
                );

          return (
            <GoalRow
              key={goal.id}
              currency={settings.currency}
              goal={goal}
              index={index}
              value={value}
              visible={visible}
            />
          );
        })}
      </Animated.View>
    </Animated.View>
  );
}

function GoalRow({
  currency,
  goal,
  index,
  value,
  visible,
}: {
  currency: string;
  goal: Goal;
  index: number;
  value: number;
  visible: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const fill = useSharedValue(0);
  const ratio = Math.min(1, value / Math.max(goal.limit, 1));

  useEffect(() => {
    cancelAnimation(fill);
    if (!visible) return;

    fill.set(0);
    if (reducedMotion) {
      fill.set(ratio);
      return;
    }

    fill.set(
      withDelay(
        220 + index * 65,
        withTiming(ratio, {
          duration: BAR_DURATION,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.Never,
        }),
        ReduceMotion.Never,
      ),
    );
  }, [fill, index, ratio, reducedMotion, visible]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.get() * 100}%`,
  }));

  return (
    <View style={styles.goal}>
      <View style={styles.goalHeading}>
        <JournalGlyph
          color={goal.color}
          name={goal.icon as JournalGlyphName}
          size={15}
        />
        <Text numberOfLines={1} style={styles.goalLabel}>
          {goal.label}
        </Text>
        <Text style={styles.goalValue}>
          {money(value, currency)}
          <Text style={styles.goalLimit}> / {money(goal.limit, currency)}</Text>
        </Text>
      </View>
      <View
        accessibilityLabel={goal.label}
        accessibilityRole="progressbar"
        accessibilityValue={{
          max: goal.limit,
          min: 0,
          now: Math.min(value, goal.limit),
          text: `${money(value, currency)} of ${money(goal.limit, currency)}`,
        }}
        style={styles.track}
      >
        <Animated.View
          style={[styles.fill, { backgroundColor: goal.color }, fillStyle]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    zIndex: 20,
    left: 36,
    right: 36,
    bottom: 76,
  },
  liquidSurface: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    transformOrigin: "bottom center",
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.98)",
    boxShadow: "0px 14px 36px rgba(113, 83, 64, 0.17)",
  },
  liquidTail: {
    position: "absolute",
    zIndex: -1,
    left: "50%",
    bottom: -11,
    width: 82,
    height: 32,
    marginLeft: -41,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.97)",
    boxShadow: "0px 8px 18px rgba(113, 83, 64, 0.08)",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 9,
  },
  title: {
    marginBottom: 8,
    fontFamily: JournalType.bold,
    fontSize: 17,
    fontWeight: "700",
    color: Finn.ink,
    includeFontPadding: false,
  },
  goal: { marginBottom: 10 },
  goalHeading: {
    minHeight: 26,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  goalLabel: {
    flex: 1,
    fontFamily: JournalType.regular,
    fontSize: 14,
    color: Finn.secondary,
    includeFontPadding: false,
  },
  goalValue: {
    fontFamily: JournalType.bold,
    fontSize: 13,
    fontWeight: "700",
    color: Finn.ink,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
  goalLimit: { color: "#3E3A3A" },
  track: {
    height: 7,
    marginTop: 1,
    borderRadius: 7,
    overflow: "hidden",
    backgroundColor: "#EEEAE8",
  },
  fill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 7,
  },
});
