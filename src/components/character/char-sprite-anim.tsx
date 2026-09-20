import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { AppState, StyleSheet, View, type ViewStyle } from "react-native";
import Animated, { steps, type CSSAnimationKeyframes } from "react-native-reanimated";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import {
  characterAnimations,
  type CharacterAnimationType,
} from "./character-animations";

export type CharSpriteAnimProps = {
  animType: CharacterAnimationType;
  /** Square frame size in logical pixels, including the illustration's clear gutter. */
  size?: number;
  /** The owner passes screen/step visibility. App backgrounding is handled internally. */
  active?: boolean;
};

/** A flipbook: one decoded atlas, hard frame cuts on the UI thread, no JS frame timer. */
export function CharSpriteAnim({ animType, size = 180, active = true }: CharSpriteAnimProps) {
  const animation = characterAnimations[animType];
  const reduced = useMotionPreference();
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [loadedSource, setLoadedSource] = useState<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
    });
    return () => subscription.remove();
  }, []);

  const { keyframes, duration } = useMemo(() => {
    const duration = animation.sequence.reduce((total, pose) => total + pose.duration, 0);
    const keyframes: CSSAnimationKeyframes<ViewStyle> = {};
    let elapsed = 0;
    const transformFor = (frame: number) => [
      { translateX: -(frame % animation.columns) * size },
      { translateY: -Math.floor(frame / animation.columns) * size },
    ];
    for (const pose of animation.sequence) {
      keyframes[`${(elapsed / duration) * 100}%`] = { transform: transformFor(pose.frame) };
      elapsed += pose.duration;
    }
    keyframes["100%"] = { transform: transformFor(animation.sequence[0].frame) };
    return { keyframes, duration };
  }, [animation, size]);

  const playing = active && foreground && loadedSource === animation.source;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.viewport, { width: size, height: size }]}
    >
      <Animated.View
        key={animType}
        style={{
          width: size * animation.columns,
          height: size * animation.rows,
          animationName: reduced ? "none" : keyframes,
          animationDuration: duration,
          animationTimingFunction: steps(1, "end"),
          animationIterationCount: "infinite",
          animationPlayState: playing ? "running" : "paused",
        }}
      >
        <Image
          source={animation.source}
          style={StyleSheet.absoluteFill}
          contentFit="fill"
          transition={0}
          accessible={false}
          onLoad={() => setLoadedSource(animation.source)}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { overflow: "hidden", alignSelf: "center" },
});
