import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { Motion } from "@/constants/motion";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { Icon } from "./icon";

export function MotionLayout({ children, style, animate = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; animate?: boolean }) {
  const reduced = useMotionPreference();
  return <Animated.View collapsable={false} style={style}
    layout={reduced || !animate ? undefined : LinearTransition.duration(Motion.layout).easing(Motion.easeOut)}>
    {children}
  </Animated.View>;
}

/** Mount only at meaningful state boundaries, never key this by typed input. */
export function ContentFade({ children, style, duration = Motion.content }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; duration?: number;
}) {
  return <Animated.View style={style} entering={FadeIn.duration(duration)}>{children}</Animated.View>;
}

export function Reveal({ open, children, style }: {
  open: boolean; children: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return <MotionLayout>
    {open && <Animated.View style={style} entering={FadeIn.duration(Motion.fade)}
      exiting={FadeOut.duration(Motion.fade)}>{children}</Animated.View>}
  </MotionLayout>;
}

export function DisclosureChevron({ expanded, size = 13, color }: {
  expanded: boolean; size?: number; color?: string;
}) {
  const reduced = useMotionPreference();
  return <Animated.View style={{
    transform: [{ rotate: expanded ? "180deg" : "0deg" }],
    transitionProperty: "transform", transitionDuration: reduced ? 0 : Motion.layout,
    transitionTimingFunction: Motion.cssEaseOut,
  }}><Icon name="down" size={size} color={color} animation={false} /></Animated.View>;
}
