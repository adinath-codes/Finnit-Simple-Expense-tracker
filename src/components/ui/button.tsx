import { forwardRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type View, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { Motion } from "@/constants/motion";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { SymbolAnimationContext } from "./icon";

export type ButtonProps = Omit<PressableProps, "children" | "style" | "accessibilityLabel"> & {
  children: ReactNode;
  label: string;
  style?: StyleProp<ViewStyle>;
};

export const Button = forwardRef<View, ButtonProps>(function Button({
  children, onPress, onPressIn, onPressOut, label, style,
  disabled = false, hitSlop = 3, accessibilityState, ...props
}, ref) {
  const [pressed, setPressed] = useState(false);
  const [symbolAnimationTrigger, setSymbolAnimationTrigger] = useState(0);
  const reduced = useMotionPreference();
  return (
    <Pressable
      {...props}
      ref={ref}
      accessibilityRole={props.accessibilityRole ?? "button"}
      accessibilityLabel={label}
      disabled={!!disabled}
      accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
      onPress={(event) => {
        onPress?.(event);
        // Router links may prevent the default event while successfully navigating.
        if (!reduced) setSymbolAnimationTrigger((trigger) => trigger + 1);
      }}
      onPressIn={(event) => { setPressed(true); onPressIn?.(event); }}
      onPressOut={(event) => { setPressed(false); onPressOut?.(event); }}
      style={{ opacity: disabled ? 0.4 : 1 }}
      hitSlop={hitSlop}
      pressRetentionOffset={props.pressRetentionOffset ?? 16}
    >
      <Animated.View style={[styles.base, style, {
        opacity: pressed && !disabled ? 0.7 : 1,
        transform: [{ scale: pressed && !disabled && !reduced ? 0.97 : 1 }],
        transitionProperty: ["transform", "opacity"],
        transitionDuration: Motion.press,
        transitionTimingFunction: Motion.cssEaseOut,
      }]}>
        <SymbolAnimationContext.Provider value={{ reduceMotion: reduced, trigger: symbolAnimationTrigger }}>
          {children}
        </SymbolAnimationContext.Provider>
      </Animated.View>
    </Pressable>
  );
});
const styles = StyleSheet.create({
  base: {
    minHeight: 44, justifyContent: "center", alignItems: "center",
  },
});
