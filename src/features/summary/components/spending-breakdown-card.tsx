import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeOutUp,
  interpolate,
  LinearTransition,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Mask,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { Icon, type IconName } from "@/components/ui/icon";
import {
  Categories,
  Finn,
  GoalRingPalette,
  JournalType,
} from "@/constants/theme";
import { useJournal } from "@/providers/app-providers";
import type { Category } from "@/types/domain";
import { entryTotal } from "@/utils/amounts";
import { currencySymbol, moneyValue } from "@/utils/currency";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
const LIQUID_ENTER_DURATION = 400;
const LIQUID_EXIT_DURATION = 300;
const CHART_SIZE = 278;
const CHART_CENTER = CHART_SIZE / 2;
const OUTER_RADIUS = 126;
const INNER_RADIUS = 82;
const SEGMENT_GAP = 7;
const MIN_SEGMENT_ANGLE = 34;
const SEGMENT_CORNER_RADIUS = 9;
const RING_MASK_RADIUS = (OUTER_RADIUS + INNER_RADIUS) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_MASK_RADIUS;
const RING_REVEAL_DURATION = 1100;
const ODOMETER_DIGIT_HEIGHT = 38;
const ODOMETER_DIGIT_WIDTH = 19;
const ODOMETER_DIGITS = Array.from({ length: 60 }, (_, index) => index % 10);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const CATEGORY_ICONS: Record<Category, IconName> = {
  food: "food",
  transport: "car",
  shopping: "bag",
  other: "note",
};

type RingSegment = {
  category: Category;
  iconAngle: number;
  path: string;
  value: number;
};

export function SpendingBreakdownCard({ visible }: { visible: boolean }) {
  const { entries, selectedDate, settings } = useJournal();
  const reducedMotion = useReducedMotion();
  const reveal = useSharedValue(0);
  const ringReveal = useSharedValue(0);
  const selectionReveal = useSharedValue(0);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const dayEntries = useMemo(
    () => entries.filter((entry) => entry.date === selectedDate),
    [entries, selectedDate],
  );
  const total = dayEntries.reduce((sum, entry) => sum + entryTotal(entry), 0);
  const categoryValues = useMemo(
    () =>
      Object.fromEntries(
        GoalRingPalette.map(({ category }) => [
          category,
          dayEntries.reduce(
            (entrySum, entry) =>
              entrySum +
              entry.items
                .filter((item) => item.category === category)
                .reduce(
                  (itemSum, item) =>
                    itemSum + item.amountMinor,
                  0,
                ),
            0,
          ),
        ]),
      ) as Record<Category, number>,
    [dayEntries],
  );
  const segments = useMemo(
    () => makeRingSegments(categoryValues),
    [categoryValues],
  );
  const centerValue = selectedCategory
    ? categoryValues[selectedCategory]
    : total;
  const centerLabel = selectedCategory
    ? Categories[selectedCategory].label
    : "Total spent";
  const selectedSegment = selectedCategory
    ? segments.find((segment) => segment.category === selectedCategory)
    : undefined;
  const selectedPalette = selectedCategory
    ? GoalRingPalette.find(
        ({ category }) => category === selectedCategory,
      )
    : undefined;

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

  useEffect(() => {
    if (!visible) setSelectedCategory(null);
  }, [visible]);

  useEffect(() => {
    cancelAnimation(ringReveal);
    if (!visible) {
      ringReveal.set(0);
      return;
    }

    if (reducedMotion) {
      ringReveal.set(1);
      return;
    }

    ringReveal.set(0);
    ringReveal.set(
      withDelay(
        140,
        withTiming(1, {
          duration: RING_REVEAL_DURATION,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.Never,
        }),
        ReduceMotion.Never,
      ),
    );
  }, [reducedMotion, ringReveal, visible]);

  useEffect(() => {
    cancelAnimation(selectionReveal);
    if (!selectedCategory) {
      selectionReveal.set(0);
      return;
    }

    selectionReveal.set(0);
    selectionReveal.set(
      reducedMotion
        ? 1
        : withSpring(1, {
            duration: 240,
            dampingRatio: 1,
            reduceMotion: ReduceMotion.Never,
          }),
    );
  }, [reducedMotion, selectedCategory, selectionReveal]);

  const ringMaskProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUMFERENCE * (1 - ringReveal.get()),
  }));

  const selectedFillProps = useAnimatedProps(() => ({
    opacity: selectionReveal.get(),
  }));

  const selectedGlowProps = useAnimatedProps(() => ({
    opacity: interpolate(selectionReveal.get(), [0, 1], [0, 0.32]),
    strokeWidth: interpolate(selectionReveal.get(), [0, 1], [4, 12]),
  }));

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

  const iconLayerStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion
      ? 1
      : interpolate(
          ringReveal.get(),
          [0.72, 1],
          [0, 1],
          Extrapolation.CLAMP,
        ),
  }));

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
        <View style={styles.chart}>
          <Svg
            accessibilityLabel="Spending by category"
            height={CHART_SIZE}
            viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
            width={CHART_SIZE}
          >
            <Defs>
              {GoalRingPalette.map((palette) => (
                <G key={palette.category}>
                  <LinearGradient
                    id={`goal-ring-${palette.category}`}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <Stop offset="0" stopColor={palette.start} />
                    <Stop offset="1" stopColor={palette.end} />
                  </LinearGradient>
                  <LinearGradient
                    id={`goal-ring-active-${palette.category}`}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <Stop offset="0" stopColor={palette.activeStart} />
                    <Stop offset="1" stopColor={palette.activeEnd} />
                  </LinearGradient>
                </G>
              ))}
              <Mask
                height={CHART_SIZE}
                id="goal-ring-reveal"
                maskUnits="userSpaceOnUse"
                width={CHART_SIZE}
                x={0}
                y={0}
              >
                <Rect
                  fill="#000"
                  height={CHART_SIZE}
                  width={CHART_SIZE}
                  x={0}
                  y={0}
                />
                <AnimatedCircle
                  animatedProps={ringMaskProps}
                  cx={CHART_CENTER}
                  cy={CHART_CENTER}
                  fill="none"
                  r={RING_MASK_RADIUS}
                  rotation={-90}
                  origin={`${CHART_CENTER}, ${CHART_CENTER}`}
                  stroke="#FFF"
                  strokeDasharray={[RING_CIRCUMFERENCE, RING_CIRCUMFERENCE]}
                  strokeLinecap="butt"
                  strokeWidth={OUTER_RADIUS - INNER_RADIUS + 16}
                />
              </Mask>
            </Defs>
            <G mask="url(#goal-ring-reveal)">
              {segments.map((segment) => (
                <Path
                  accessibilityLabel={`${Categories[segment.category].label}, ${currencySymbol(settings.currency)}${moneyValue(segment.value)}`}
                  d={segment.path}
                  fill={`url(#goal-ring-${segment.category})`}
                  key={segment.category}
                  onPress={() =>
                    setSelectedCategory((current) =>
                      current === segment.category ? null : segment.category,
                    )
                  }
                  stroke={`url(#goal-ring-${segment.category})`}
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              ))}
              {selectedSegment && selectedPalette ? (
                <>
                  <AnimatedPath
                    animatedProps={selectedGlowProps}
                    d={selectedSegment.path}
                    fill="none"
                    pointerEvents="none"
                    stroke={selectedPalette.activeStart}
                    strokeLinejoin="round"
                  />
                  <AnimatedPath
                    animatedProps={selectedFillProps}
                    d={selectedSegment.path}
                    fill={`url(#goal-ring-active-${selectedCategory})`}
                    pointerEvents="none"
                    stroke={`url(#goal-ring-active-${selectedCategory})`}
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </>
              ) : null}
            </G>
          </Svg>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, iconLayerStyle]}
          >
            {segments.map((segment) => {
              const palette = GoalRingPalette.find(
                ({ category }) => category === segment.category,
              );
              const iconPosition = polarPoint(
                CHART_CENTER,
                CHART_CENTER,
                (OUTER_RADIUS + INNER_RADIUS) / 2,
                segment.iconAngle,
              );
              return (
                <View
                  key={segment.category}
                  style={[
                    styles.segmentIcon,
                    {
                      left: iconPosition.x - 11,
                      top: iconPosition.y - 11,
                    },
                  ]}
                >
                  <Icon
                    animation={false}
                    color={
                      selectedCategory === segment.category
                        ? palette?.activeIcon
                        : palette?.icon ?? Finn.ink
                    }
                    name={CATEGORY_ICONS[segment.category]}
                    size={22}
                  />
                </View>
              );
            })}
          </Animated.View>
          <View
            accessibilityLiveRegion="polite"
            pointerEvents="none"
            style={styles.chartCenter}
          >
            <RollingAmount
              animate={!reducedMotion}
              amountMinor={centerValue}
              currency={settings.currency}
            />
            <Animated.Text
              entering={
                reducedMotion
                  ? undefined
                  : FadeIn.duration(280).easing(EASE_OUT)
              }
              key={centerLabel}
              numberOfLines={1}
              style={styles.centerLabel}
            >
              {centerLabel}
            </Animated.Text>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function RollingAmount({
  amountMinor,
  animate,
  currency,
}: {
  amountMinor: number;
  animate: boolean;
  currency: string;
}) {
  const formatted = moneyValue(amountMinor);
  const characters = [...formatted];
  const digitPlaces: Array<number | null> = Array(characters.length).fill(null);
  const [hasMounted, setHasMounted] = useState(false);
  let place = 0;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  for (let index = characters.length - 1; index >= 0; index -= 1) {
    if (/\d/.test(characters[index])) {
      digitPlaces[index] = place;
      place += 1;
    }
  }

  return (
    <Animated.View
      accessibilityLabel={`${currencySymbol(currency)}${formatted}`}
      accessible
      collapsable={false}
      style={styles.amountRow}
    >
      <Animated.Text
        accessible={false}
        layout={
          animate
            ? LinearTransition.duration(240).easing(EASE_IN_OUT)
            : undefined
        }
        style={styles.centerCurrency}
      >
        {currencySymbol(currency)}
      </Animated.Text>
      {characters.map((character, index) =>
        /\d/.test(character) ? (
          <RollingDigit
            animate={animate}
            animateEntry={animate && hasMounted}
            digit={Number(character)}
            key={`digit-${digitPlaces[index]}`}
          />
        ) : (
          <Animated.Text
            accessible={false}
            entering={
              animate && hasMounted
                ? FadeInDown.duration(180).easing(EASE_OUT)
                : undefined
            }
            exiting={
              animate ? FadeOutUp.duration(160).easing(EASE_OUT) : undefined
            }
            key={`separator-${characters.length - index}`}
            layout={
              animate
                ? LinearTransition.duration(240).easing(EASE_IN_OUT)
                : undefined
            }
            style={styles.amountSeparator}
          >
            {character}
          </Animated.Text>
        ),
      )}
    </Animated.View>
  );
}

function RollingDigit({
  digit,
  animate,
  animateEntry,
}: {
  digit: number;
  animate: boolean;
  animateEntry: boolean;
}) {
  const initialPosition = 20 + digit;
  const position = useSharedValue(initialPosition);
  const positionRef = useRef(initialPosition);
  const previousDigitRef = useRef(digit);

  useEffect(() => {
    cancelAnimation(position);
    const previousDigit = previousDigitRef.current;

    if (!animate) {
      const nextPosition = 20 + digit;
      position.set(nextPosition);
      positionRef.current = nextPosition;
      previousDigitRef.current = digit;
      return;
    }

    if (previousDigit === digit) return;

    let currentPosition = positionRef.current;
    if (currentPosition > 48) {
      currentPosition = 20 + previousDigit;
      position.set(currentPosition);
    }

    const steps = (digit - previousDigit + 10) % 10;
    const nextPosition = currentPosition + steps;
    positionRef.current = nextPosition;
    previousDigitRef.current = digit;
    position.set(
      withTiming(nextPosition, {
        duration: 520,
        easing: EASE_IN_OUT,
        reduceMotion: ReduceMotion.Never,
      }),
    );
  }, [animate, digit, position]);

  const reelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -position.get() * ODOMETER_DIGIT_HEIGHT },
    ],
  }));

  return (
    <Animated.View
      accessible={false}
      collapsable={false}
      entering={
        animateEntry ? FadeInDown.duration(180).easing(EASE_OUT) : undefined
      }
      exiting={
        animate ? FadeOutUp.duration(160).easing(EASE_OUT) : undefined
      }
      layout={
        animate
          ? LinearTransition.duration(240).easing(EASE_IN_OUT)
          : undefined
      }
      style={styles.digitWindow}
    >
      <Animated.View style={[styles.digitReel, reelStyle]}>
        {ODOMETER_DIGITS.map((value, index) => (
          <Text
            accessible={false}
            key={`${index}-${value}`}
            style={styles.digitText}
          >
            {value}
          </Text>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

function makeRingSegments(
  categoryValues: Record<Category, number>,
): RingSegment[] {
  const usableAngle = 360 - GoalRingPalette.length * SEGMENT_GAP;
  const flexibleAngle = usableAngle - GoalRingPalette.length * MIN_SEGMENT_ANGLE;
  const total = GoalRingPalette.reduce(
    (sum, palette) => sum + categoryValues[palette.category],
    0,
  );
  let cursor = 112;

  return GoalRingPalette.map(({ category }) => {
    const share = total > 0 ? categoryValues[category] / total : 0.25;
    const sweep = MIN_SEGMENT_ANGLE + flexibleAngle * share;
    const startAngle = cursor;
    const endAngle = startAngle + sweep;
    cursor = endAngle + SEGMENT_GAP;
    return {
      category,
      iconAngle: startAngle + sweep / 2,
      path: annularSectorPath(startAngle, endAngle),
      value: categoryValues[category],
    };
  });
}

function annularSectorPath(startAngle: number, endAngle: number) {
  const outerCornerAngle = radiansToDegrees(
    SEGMENT_CORNER_RADIUS / OUTER_RADIUS,
  );
  const innerCornerAngle = radiansToDegrees(
    SEGMENT_CORNER_RADIUS / INNER_RADIUS,
  );
  const outerStart = polarPoint(
    CHART_CENTER,
    CHART_CENTER,
    OUTER_RADIUS - SEGMENT_CORNER_RADIUS,
    startAngle,
  );
  const outerArcStart = polarPoint(
    CHART_CENTER,
    CHART_CENTER,
    OUTER_RADIUS,
    startAngle + outerCornerAngle,
  );
  const outerStartCorner = polarPoint(
    CHART_CENTER,
    CHART_CENTER,
    OUTER_RADIUS,
    startAngle,
  );
  const outerArcEnd = polarPoint(
    CHART_CENTER,
    CHART_CENTER,
    OUTER_RADIUS,
    endAngle - outerCornerAngle,
  );
  const outerEndCorner = polarPoint(
    CHART_CENTER,
    CHART_CENTER,
    OUTER_RADIUS,
    endAngle,
  );
  const outerEnd = polarPoint(
    CHART_CENTER,
    CHART_CENTER,
    OUTER_RADIUS - SEGMENT_CORNER_RADIUS,
    endAngle,
  );
  const innerEnd = polarPoint(
    CHART_CENTER,
    CHART_CENTER,
    INNER_RADIUS + SEGMENT_CORNER_RADIUS,
    endAngle,
  );
  const innerEndCorner = polarPoint(
    CHART_CENTER,
    CHART_CENTER,
    INNER_RADIUS,
    endAngle,
  );
  const innerArcEnd = polarPoint(
    CHART_CENTER,
    CHART_CENTER,
    INNER_RADIUS,
    endAngle - innerCornerAngle,
  );
  const innerArcStart = polarPoint(
    CHART_CENTER,
    CHART_CENTER,
    INNER_RADIUS,
    startAngle + innerCornerAngle,
  );
  const innerStartCorner = polarPoint(
    CHART_CENTER,
    CHART_CENTER,
    INNER_RADIUS,
    startAngle,
  );
  const innerStart = polarPoint(
    CHART_CENTER,
    CHART_CENTER,
    INNER_RADIUS + SEGMENT_CORNER_RADIUS,
    startAngle,
  );
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `Q ${outerStartCorner.x} ${outerStartCorner.y} ${outerArcStart.x} ${outerArcStart.y}`,
    `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 ${largeArc} 1 ${outerArcEnd.x} ${outerArcEnd.y}`,
    `Q ${outerEndCorner.x} ${outerEndCorner.y} ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `Q ${innerEndCorner.x} ${innerEndCorner.y} ${innerArcEnd.x} ${innerArcEnd.y}`,
    `A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${largeArc} 0 ${innerArcStart.x} ${innerArcStart.y}`,
    `Q ${innerStartCorner.x} ${innerStartCorner.y} ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function radiansToDegrees(radians: number) {
  return (radians * 180) / Math.PI;
}

function polarPoint(
  centerX: number,
  centerY: number,
  radius: number,
  angle: number,
) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(radians),
    y: centerY + radius * Math.sin(radians),
  };
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
    paddingBottom: 15,
  },
  title: {
    marginBottom: 2,
    fontFamily: JournalType.bold,
    fontSize: 17,
    fontWeight: "700",
    color: Finn.ink,
    includeFontPadding: false,
  },
  chart: {
    width: CHART_SIZE,
    height: CHART_SIZE,
    alignSelf: "center",
    position: "relative",
  },
  chartCenter: {
    position: "absolute",
    left: 61,
    right: 61,
    top: 102,
    bottom: 101,
    justifyContent: "center",
    alignItems: "center",
  },
  amountRow: {
    minHeight: ODOMETER_DIGIT_HEIGHT,
    maxWidth: 158,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  centerCurrency: {
    fontFamily: JournalType.medium,
    fontSize: 30,
    lineHeight: ODOMETER_DIGIT_HEIGHT,
    letterSpacing: -1.1,
    color: Finn.primary,
    includeFontPadding: false,
  },
  digitWindow: {
    width: ODOMETER_DIGIT_WIDTH,
    height: ODOMETER_DIGIT_HEIGHT,
    overflow: "hidden",
  },
  digitReel: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  digitText: {
    width: ODOMETER_DIGIT_WIDTH,
    height: ODOMETER_DIGIT_HEIGHT,
    textAlign: "center",
    fontFamily: JournalType.medium,
    fontSize: 30,
    lineHeight: ODOMETER_DIGIT_HEIGHT,
    letterSpacing: -1.1,
    color: Finn.ink,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
  amountSeparator: {
    minWidth: 9,
    height: ODOMETER_DIGIT_HEIGHT,
    textAlign: "center",
    fontFamily: JournalType.medium,
    fontSize: 30,
    lineHeight: ODOMETER_DIGIT_HEIGHT,
    letterSpacing: -1.1,
    color: Finn.ink,
    includeFontPadding: false,
  },
  centerLabel: {
    maxWidth: 140,
    marginTop: 7,
    textAlign: "center",
    fontFamily: JournalType.medium,
    fontSize: 14,
    color: "#3F3B3A",
    includeFontPadding: false,
  },
  segmentIcon: {
    position: "absolute",
    width: 22,
    height: 22,
  },
});
