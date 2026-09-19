import type { ColorValue, StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { Finn } from "@/constants/theme";

const TICK_WIDTH = 3;
const TICK_STEP = 5;
const MAX_TICK_HEIGHT = 24;
const EDGE_FADE_OPACITIES = [0.9, 0.68, 0.44, 0.22, 0] as const;

const WAVEFORM_PATTERN = [
     4, 5, 5, 6, 7, 8, 10, 12, 15, 18, 21, 18, 15, 12, 9, 7, 6, 5, 6,
     8, 11, 14, 17, 20, 23, 19, 15, 11, 8, 6, 5, 4, 5, 7, 9, 13, 17, 20,
     18, 14, 11, 9, 7, 6, 8, 11, 15, 19, 22, 18, 14, 10, 8, 7, 6, 5, 7,
     10, 13, 16, 14, 11, 8, 6, 5, 4, 4, 4,
] as const;

const PATTERN_WIDTH = WAVEFORM_PATTERN.length * TICK_STEP;

const HORIZONTAL_TRAVEL_KEYFRAMES = {
     "0%": { transform: [{ translateX: 0 }] },
     "100%": { transform: [{ translateX: -PATTERN_WIDTH }] },
} as const;

const PREVIEW_ACTIVITY_KEYFRAMES = {
     "0%": { transform: [{ scaleY: 0.48 }] },
     "16%": { transform: [{ scaleY: 0.82 }] },
     "31%": { transform: [{ scaleY: 0.62 }] },
     "48%": { transform: [{ scaleY: 1 }] },
     "66%": { transform: [{ scaleY: 0.7 }] },
     "82%": { transform: [{ scaleY: 0.9 }] },
     "100%": { transform: [{ scaleY: 0.56 }] },
} as const;

const TICK_ACTIVITY_KEYFRAMES = {
     "0%": { opacity: 0.64, transform: [{ scaleY: 0.72 }] },
     "48%": { opacity: 1, transform: [{ scaleY: 1 }] },
     "100%": { opacity: 0.72, transform: [{ scaleY: 0.8 }] },
} as const;

export type VoiceRecordingWaveformProps = {
     /** Normalized speech energy from 0 to 1. Omit it for the preview envelope. */
     amplitude?: number;
     accessibilityLabel?: string;
     accessibilityValueText?: string;
     active?: boolean;
     barColor?: ColorValue;
     fadeColor?: ColorValue;
     style?: StyleProp<ViewStyle>;
};

export function VoiceRecordingWaveform({
     amplitude,
     accessibilityLabel = "Voice recording waveform",
     accessibilityValueText,
     active = true,
     barColor = Finn.ink,
     fadeColor = "#FFFFFF",
     style,
}: VoiceRecordingWaveformProps) {
     const reducedMotion = useReducedMotion();
     const hasLiveAmplitude = typeof amplitude === "number";
     const normalizedAmplitude = hasLiveAmplitude
          ? Math.min(1, Math.max(0, amplitude))
          : 0.68;
     const liveScale = active ? 0.38 + normalizedAmplitude * 0.62 : 0.38;
     const motionEnabled = active && !reducedMotion;

     return (
          <View
               accessible
               accessibilityLabel={accessibilityLabel}
               accessibilityRole="progressbar"
               accessibilityValue={{
                    text:
                         accessibilityValueText ??
                         (active ? "Recording in progress" : "Recording paused"),
               }}
               style={[styles.container, style]}
          >
               <View style={styles.viewport}>
                    <Animated.View
                         style={[
                              styles.activityLayer,
                              hasLiveAmplitude
                                   ? {
                                          transform: [{ scaleY: liveScale }],
                                          transitionDuration: reducedMotion
                                               ? "0ms"
                                               : "110ms",
                                          transitionProperty: "transform",
                                          transitionTimingFunction: "ease-out",
                                     }
                                   : motionEnabled
                                     ? {
                                            animationDuration: "1850ms",
                                            animationIterationCount: "infinite",
                                            animationName:
                                                 PREVIEW_ACTIVITY_KEYFRAMES,
                                            animationTimingFunction:
                                                 "ease-in-out",
                                       }
                                     : styles.restingActivity,
                         ]}
                    >
                         <Animated.View
                              style={[
                                   styles.track,
                                   motionEnabled && {
                                        animationDuration: "5200ms",
                                        animationIterationCount: "infinite",
                                        animationName:
                                             HORIZONTAL_TRAVEL_KEYFRAMES,
                                        animationTimingFunction: "linear",
                                   },
                              ]}
                         >
                              <WaveformPattern
                                   animated={motionEnabled}
                                   barColor={barColor}
                              />
                              <WaveformPattern
                                   animated={motionEnabled}
                                   barColor={barColor}
                              />
                         </Animated.View>
                    </Animated.View>
               </View>
               <EdgeFade color={fadeColor} side="left" />
               <EdgeFade color={fadeColor} side="right" />
          </View>
     );
}

function WaveformPattern({
     animated,
     barColor,
}: {
     animated: boolean;
     barColor: ColorValue;
}) {
     return (
          <View style={styles.pattern}>
               {WAVEFORM_PATTERN.map((height, index) => (
                    <View key={`${height}-${index}`} style={styles.tickSlot}>
                         <Animated.View
                              style={[
                                   styles.tick,
                                   {
                                        backgroundColor: barColor,
                                        height,
                                   },
                                   animated && {
                                        animationDelay: `-${
                                             (index * 89) % 920
                                        }ms`,
                                        animationDuration: `${
                                             680 + (index % 6) * 48
                                        }ms`,
                                        animationIterationCount: "infinite",
                                        animationName:
                                             TICK_ACTIVITY_KEYFRAMES,
                                        animationTimingFunction:
                                             "ease-in-out",
                                   },
                              ]}
                         />
                    </View>
               ))}
          </View>
     );
}

function EdgeFade({
     color,
     side,
}: {
     color: ColorValue;
     side: "left" | "right";
}) {
     const opacities =
          side === "left"
               ? EDGE_FADE_OPACITIES
               : [...EDGE_FADE_OPACITIES].reverse();

     return (
          <View
               pointerEvents="none"
               style={[
                    styles.edgeFade,
                    side === "left" ? styles.edgeFadeLeft : styles.edgeFadeRight,
               ]}
          >
               {opacities.map((opacity, index) => (
                    <View
                         key={`${side}-${index}`}
                         style={{
                              backgroundColor: color,
                              flex: 1,
                              opacity,
                         }}
                    />
               ))}
          </View>
     );
}

const styles = StyleSheet.create({
     container: {
          justifyContent: "center",
          overflow: "hidden",
     },
     viewport: {
          height: MAX_TICK_HEIGHT,
          justifyContent: "center",
          overflow: "hidden",
          width: "100%",
     },
     activityLayer: {
          height: MAX_TICK_HEIGHT,
          justifyContent: "center",
          width: "100%",
     },
     restingActivity: {
          opacity: 0.72,
          transform: [{ scaleY: 0.58 }],
     },
     track: {
          alignItems: "center",
          flexDirection: "row",
          height: MAX_TICK_HEIGHT,
          width: PATTERN_WIDTH * 2,
     },
     pattern: {
          alignItems: "center",
          flexDirection: "row",
          height: MAX_TICK_HEIGHT,
          width: PATTERN_WIDTH,
     },
     tickSlot: {
          alignItems: "center",
          height: MAX_TICK_HEIGHT,
          justifyContent: "center",
          width: TICK_STEP,
     },
     tick: {
          borderRadius: TICK_WIDTH / 2,
          width: TICK_WIDTH,
     },
     edgeFade: {
          bottom: 0,
          flexDirection: "row",
          position: "absolute",
          top: 0,
          width: 25,
     },
     edgeFadeLeft: {
          left: 0,
     },
     edgeFadeRight: {
          right: 0,
     },
});
