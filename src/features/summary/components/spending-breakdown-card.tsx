import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
     useAnimatedStyle,
     useReducedMotion,
     useSharedValue,
     withSpring,
     withTiming,
} from "react-native-reanimated";
import Svg, {
     Defs,
     G,
     LinearGradient,
     Path,
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
import { currencySymbol, moneyValue } from "@/utils/currency";
import { cachedDayBreakdown } from "../services/summary-service";
import {
     allocateSpendingCoins,
     SPENDING_COIN_TOTAL,
     type SpendingCoinAllocation,
} from "../services/spending-coin-allocation";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
const LIQUID_ENTER_DURATION = 400;
const LIQUID_EXIT_DURATION = 300;
const COIN_STAGE_WIDTH = 252;
const COIN_STAGE_HEIGHT = 176;
const COIN_WIDTH = 142;
const COIN_LEFT = (COIN_STAGE_WIDTH - COIN_WIDTH) / 2;
const COIN_RIGHT = COIN_LEFT + COIN_WIDTH;
const COIN_SHOULDER = 20;
const COIN_TOP_HEIGHT = 24;
const COIN_DEPTH = 10;
const COIN_STEP = 14;
const COIN_TOP_OFFSET = 12;
const CATEGORY_CONTROL_SIZE = 44;
const ODOMETER_DIGIT_HEIGHT = 38;
const ODOMETER_DIGIT_WIDTH = 19;
const ODOMETER_DIGITS = Array.from({ length: 60 }, (_, index) => index % 10);

const CATEGORY_ICONS: Record<Category, IconName> = {
     food: "food",
     transport: "car",
     shopping: "bag",
     other: "note",
};

type CoinGroup = SpendingCoinAllocation & {
     endIndex: number;
     iconSide: "left" | "right";
     iconTop: number;
     startIndex: number;
};

export function SpendingBreakdownCard({ visible }: { visible: boolean }) {
     const { entries, selectedDate, settings, cacheAccountId, contentVersion } =
          useJournal();
     const reducedMotion = useReducedMotion();
     const reveal = useSharedValue(0);
     const selectionReveal = useSharedValue(0);
     const [selectedCategory, setSelectedCategory] = useState<Category | null>(
          null,
     );
     const { total, categoryValues } = cachedDayBreakdown({
          accountId: cacheAccountId,
          contentVersion,
          currency: settings.currency,
          selectedDate,
          entries,
     });
     const allocations = useMemo(
          () => allocateSpendingCoins(categoryValues),
          [categoryValues],
     );
     const coinGroups = useMemo(() => makeCoinGroups(allocations), [allocations]);
     const coinSlots = useMemo(
          () =>
               coinGroups.flatMap(({ category, count, startIndex }) =>
                    Array.from({ length: count }, (_, offset) => ({
                         category,
                         index: startIndex + offset,
                    })),
               ),
          [coinGroups],
     );
     const activeCategory =
          selectedCategory &&
          coinGroups.some(({ category }) => category === selectedCategory)
               ? selectedCategory
               : null;
     const centerValue = activeCategory
          ? categoryValues[activeCategory]
          : total;
     const centerLabel = activeCategory
          ? Categories[activeCategory].label
          : "Total spent";

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
          if (selectedCategory && !activeCategory) setSelectedCategory(null);
     }, [activeCategory, selectedCategory]);

     useEffect(() => {
          cancelAnimation(selectionReveal);
          if (!activeCategory) {
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
     }, [activeCategory, reducedMotion, selectionReveal]);

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

     const selectedIconStyle = useAnimatedStyle(() => ({
          opacity: interpolate(selectionReveal.get(), [0, 1], [0.72, 1]),
          transform: [
               {
                    scale: interpolate(
                         selectionReveal.get(),
                         [0, 1],
                         [0.88, 1],
                    ),
               },
          ],
     }));

     const toggleCategory = (category: Category) => {
          setSelectedCategory((current) =>
               current === category ? null : category,
          );
     };

     return (
          <Animated.View
               accessibilityElementsHidden={!visible}
               accessibilityLiveRegion="polite"
               importantForAccessibility={
                    visible ? "yes" : "no-hide-descendants"
               }
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
                    <View style={styles.coinStage}>
                         {coinGroups.length > 0 ? (
                              <>
                                   <Svg
                                        accessibilityLabel="Spending by category shown as ten coins"
                                        height={COIN_STAGE_HEIGHT}
                                        style={styles.coinSvg}
                                        viewBox={`0 0 ${COIN_STAGE_WIDTH} ${COIN_STAGE_HEIGHT}`}
                                        width={COIN_STAGE_WIDTH}
                                   >
                                        <Defs>
                                             {GoalRingPalette.map((palette) => (
                                                  <G key={palette.category}>
                                                       <LinearGradient
                                                            id={`coin-top-${palette.category}`}
                                                            x1="0"
                                                            x2="1"
                                                            y1="0"
                                                            y2="1"
                                                       >
                                                            <Stop
                                                                 offset="0"
                                                                 stopColor={
                                                                      palette.end
                                                                 }
                                                            />
                                                            <Stop
                                                                 offset="1"
                                                                 stopColor={
                                                                      palette.start
                                                                 }
                                                            />
                                                       </LinearGradient>
                                                       <LinearGradient
                                                            id={`coin-face-${palette.category}`}
                                                            x1="0"
                                                            x2="0"
                                                            y1="0"
                                                            y2="1"
                                                       >
                                                            <Stop
                                                                 offset="0"
                                                                 stopColor={
                                                                      palette.start
                                                                 }
                                                            />
                                                            <Stop
                                                                 offset="1"
                                                                 stopColor={
                                                                      palette.end
                                                                 }
                                                            />
                                                       </LinearGradient>
                                                       <LinearGradient
                                                            id={`coin-top-active-${palette.category}`}
                                                            x1="0"
                                                            x2="1"
                                                            y1="0"
                                                            y2="1"
                                                       >
                                                            <Stop
                                                                 offset="0"
                                                                 stopColor={
                                                                      palette.activeEnd
                                                                 }
                                                            />
                                                            <Stop
                                                                 offset="1"
                                                                 stopColor={
                                                                      palette.activeStart
                                                                 }
                                                            />
                                                       </LinearGradient>
                                                       <LinearGradient
                                                            id={`coin-face-active-${palette.category}`}
                                                            x1="0"
                                                            x2="0"
                                                            y1="0"
                                                            y2="1"
                                                       >
                                                            <Stop
                                                                 offset="0"
                                                                 stopColor={
                                                                      palette.activeStart
                                                                 }
                                                            />
                                                            <Stop
                                                                 offset="1"
                                                                 stopColor={
                                                                      palette.activeEnd
                                                                 }
                                                            />
                                                       </LinearGradient>
                                                  </G>
                                             ))}
                                        </Defs>
                                        {[...coinSlots]
                                             .reverse()
                                             .map((coin) => {
                                                  const palette =
                                                       GoalRingPalette.find(
                                                            ({ category }) =>
                                                                 category ===
                                                                 coin.category,
                                                       );
                                                  if (!palette) return null;

                                                  const geometry =
                                                       makeCoinGeometry(
                                                            coin.index,
                                                       );
                                                  const selected =
                                                       activeCategory ===
                                                       coin.category;
                                                  const topFill = selected
                                                       ? `url(#coin-top-active-${coin.category})`
                                                       : `url(#coin-top-${coin.category})`;
                                                  const faceFill = selected
                                                       ? `url(#coin-face-active-${coin.category})`
                                                       : `url(#coin-face-${coin.category})`;
                                                  const stroke = selected
                                                       ? palette.activeIcon
                                                       : palette.icon;

                                                  return (
                                                       <G
                                                            key={`${coin.category}-${coin.index}`}
                                                            onPress={() =>
                                                                 toggleCategory(
                                                                      coin.category,
                                                                 )
                                                            }
                                                       >
                                                            <Path
                                                                 d={
                                                                      geometry.leftFace
                                                                 }
                                                                 fill={
                                                                      selected
                                                                           ? palette.activeStart
                                                                           : palette.start
                                                                 }
                                                                 fillOpacity={0.88}
                                                                 stroke={stroke}
                                                                 strokeOpacity={0.24}
                                                                 strokeWidth={1}
                                                            />
                                                            <Path
                                                                 d={
                                                                      geometry.frontFace
                                                                 }
                                                                 fill={faceFill}
                                                                 stroke={stroke}
                                                                 strokeOpacity={0.24}
                                                                 strokeWidth={1}
                                                            />
                                                            <Path
                                                                 d={
                                                                      geometry.rightFace
                                                                 }
                                                                 fill={
                                                                      selected
                                                                           ? palette.activeEnd
                                                                           : palette.end
                                                                 }
                                                                 fillOpacity={0.92}
                                                                 stroke={stroke}
                                                                 strokeOpacity={0.24}
                                                                 strokeWidth={1}
                                                            />
                                                            <Path
                                                                 d={geometry.top}
                                                                 fill={topFill}
                                                                 stroke={stroke}
                                                                 strokeOpacity={0.28}
                                                                 strokeLinejoin="round"
                                                                 strokeWidth={1.2}
                                                            />
                                                            <Path
                                                                 d={
                                                                      geometry.highlight
                                                                 }
                                                                 fill="none"
                                                                 pointerEvents="none"
                                                                 stroke="#FFFFFF"
                                                                 strokeLinecap="round"
                                                                 strokeOpacity={0.42}
                                                                 strokeWidth={1.2}
                                                            />
                                                       </G>
                                                  );
                                             })}
                                   </Svg>
                                   {coinGroups.map((group) => {
                                        const palette = GoalRingPalette.find(
                                             ({ category }) =>
                                                  category === group.category,
                                        );
                                        const selected =
                                             activeCategory === group.category;
                                        const accessibilityLabel = `${Categories[group.category].label}, ${currencySymbol(settings.currency)}${moneyValue(group.value)}, ${group.count} of ${SPENDING_COIN_TOTAL} coins`;

                                        return (
                                             <Animated.View
                                                  key={group.category}
                                                  style={[
                                                       styles.categoryControl,
                                                       {
                                                            top: group.iconTop,
                                                            [group.iconSide]: 0,
                                                       },
                                                       selected &&
                                                            selectedIconStyle,
                                                  ]}
                                             >
                                                  <Pressable
                                                       accessibilityLabel={
                                                            accessibilityLabel
                                                       }
                                                       accessibilityRole="button"
                                                       accessibilityState={{
                                                            selected,
                                                       }}
                                                       hitSlop={4}
                                                       onPress={() =>
                                                            toggleCategory(
                                                                 group.category,
                                                            )
                                                       }
                                                       style={({ pressed }) => [
                                                            styles.categoryButton,
                                                            {
                                                                 backgroundColor:
                                                                      selected
                                                                           ? palette?.activeEnd
                                                                           : "rgba(255,255,255,0.94)",
                                                                 borderColor:
                                                                      selected
                                                                           ? palette?.activeStart
                                                                           : palette?.end,
                                                                 opacity: pressed
                                                                      ? 0.72
                                                                      : 1,
                                                            },
                                                       ]}
                                                  >
                                                       <Icon
                                                            animation={false}
                                                            color={
                                                                 selected
                                                                      ? palette?.activeIcon
                                                                      : (palette?.icon ??
                                                                        Finn.ink)
                                                            }
                                                            name={
                                                                 CATEGORY_ICONS[
                                                                      group.category
                                                                 ]
                                                            }
                                                            size={22}
                                                       />
                                                  </Pressable>
                                             </Animated.View>
                                        );
                                   })}
                              </>
                         ) : (
                              <View style={styles.emptyState}>
                                   <Text style={styles.emptyText}>
                                        No spending yet
                                   </Text>
                              </View>
                         )}
                    </View>
                    <View
                         accessibilityLiveRegion="polite"
                         pointerEvents="none"
                         style={styles.amountBlock}
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
                              style={styles.amountLabel}
                         >
                              {centerLabel}
                         </Animated.Text>
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
     const digitPlaces: (number | null)[] = Array(characters.length).fill(
          null,
     );
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
                              ? LinearTransition.duration(240).easing(
                                     EASE_IN_OUT,
                                )
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
                                        ? FadeInDown.duration(180).easing(
                                               EASE_OUT,
                                          )
                                        : undefined
                              }
                              exiting={
                                   animate
                                        ? FadeOutUp.duration(160).easing(
                                               EASE_OUT,
                                          )
                                        : undefined
                              }
                              key={`separator-${characters.length - index}`}
                              layout={
                                   animate
                                        ? LinearTransition.duration(240).easing(
                                               EASE_IN_OUT,
                                          )
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
          transform: [{ translateY: -position.get() * ODOMETER_DIGIT_HEIGHT }],
     }));

     return (
          <Animated.View
               accessible={false}
               collapsable={false}
               entering={
                    animateEntry
                         ? FadeInDown.duration(180).easing(EASE_OUT)
                         : undefined
               }
               exiting={
                    animate
                         ? FadeOutUp.duration(160).easing(EASE_OUT)
                         : undefined
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

function makeCoinGroups(
     allocations: SpendingCoinAllocation[],
): CoinGroup[] {
     let cursor = 0;

     return allocations.map((allocation, visibleIndex) => {
          const startIndex = cursor;
          const endIndex = cursor + allocation.count - 1;
          const iconCenter =
               COIN_TOP_OFFSET +
               ((startIndex + endIndex) / 2) * COIN_STEP +
               COIN_TOP_HEIGHT / 2 +
               COIN_DEPTH / 2;
          cursor = endIndex + 1;

          return {
               ...allocation,
               endIndex,
               iconSide: visibleIndex % 2 === 0 ? "left" : "right",
               iconTop: Math.max(
                    0,
                    Math.min(
                         COIN_STAGE_HEIGHT - CATEGORY_CONTROL_SIZE,
                         iconCenter - CATEGORY_CONTROL_SIZE / 2,
                    ),
               ),
               startIndex,
          };
     });
}

function makeCoinGeometry(index: number) {
     const top = COIN_TOP_OFFSET + index * COIN_STEP;
     const middle = top + COIN_TOP_HEIGHT / 2;
     const bottom = top + COIN_TOP_HEIGHT;
     const leftShoulder = COIN_LEFT + COIN_SHOULDER;
     const rightShoulder = COIN_RIGHT - COIN_SHOULDER;

     return {
          top: [
               `M ${COIN_LEFT} ${middle}`,
               `L ${leftShoulder} ${top}`,
               `L ${rightShoulder} ${top}`,
               `L ${COIN_RIGHT} ${middle}`,
               `L ${rightShoulder} ${bottom}`,
               `L ${leftShoulder} ${bottom}`,
               "Z",
          ].join(" "),
          leftFace: [
               `M ${COIN_LEFT} ${middle}`,
               `L ${leftShoulder} ${bottom}`,
               `L ${leftShoulder} ${bottom + COIN_DEPTH}`,
               `L ${COIN_LEFT} ${middle + COIN_DEPTH}`,
               "Z",
          ].join(" "),
          frontFace: [
               `M ${leftShoulder} ${bottom}`,
               `L ${rightShoulder} ${bottom}`,
               `L ${rightShoulder} ${bottom + COIN_DEPTH}`,
               `L ${leftShoulder} ${bottom + COIN_DEPTH}`,
               "Z",
          ].join(" "),
          rightFace: [
               `M ${rightShoulder} ${bottom}`,
               `L ${COIN_RIGHT} ${middle}`,
               `L ${COIN_RIGHT} ${middle + COIN_DEPTH}`,
               `L ${rightShoulder} ${bottom + COIN_DEPTH}`,
               "Z",
          ].join(" "),
          highlight: `M ${leftShoulder + 8} ${top + 3} L ${rightShoulder - 8} ${top + 3}`,
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
          paddingTop: 14,
          paddingBottom: 16,
     },
     coinStage: {
          width: COIN_STAGE_WIDTH,
          height: COIN_STAGE_HEIGHT,
          alignSelf: "center",
          position: "relative",
     },
     coinSvg: {
          position: "absolute",
          top: 0,
          left: 0,
     },
     categoryControl: {
          position: "absolute",
          width: CATEGORY_CONTROL_SIZE,
          height: CATEGORY_CONTROL_SIZE,
     },
     categoryButton: {
          width: CATEGORY_CONTROL_SIZE,
          height: CATEGORY_CONTROL_SIZE,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: CATEGORY_CONTROL_SIZE / 2,
          borderWidth: 1,
          boxShadow: "0px 5px 14px rgba(89, 68, 56, 0.12)",
     },
     emptyState: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
     },
     emptyText: {
          fontFamily: JournalType.medium,
          fontSize: 15,
          color: Finn.secondary,
          includeFontPadding: false,
     },
     amountBlock: {
          alignItems: "center",
          justifyContent: "center",
          marginTop: 8,
     },
     amountRow: {
          minHeight: ODOMETER_DIGIT_HEIGHT,
          maxWidth: 200,
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
     amountLabel: {
          maxWidth: 180,
          marginTop: 7,
          textAlign: "center",
          fontFamily: JournalType.medium,
          fontSize: 14,
          color: "#3F3B3A",
          includeFontPadding: false,
     },
});
