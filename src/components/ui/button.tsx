import { useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { SymbolAnimationContext } from "./icon";

export function Button({
  children,
  onPress,
  label,
  style,
  disabled = false,
  accessibilityHint,
  hitSlop = 3,
}: {
  children: ReactNode;
  onPress: () => void;
  label: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityHint?: string;
  hitSlop?: number;
}) {
  const [pressed, setPressed] = useState(false);
  const [symbolAnimationTrigger, setSymbolAnimationTrigger] = useState(0);
  const reduced = useReducedMotion();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      onPressIn={() => {
        setPressed(true);
        if (!reduced) {
          setSymbolAnimationTrigger((trigger) => trigger + 1);
        }
      }}
      onPressOut={() => setPressed(false)}
      style={{ opacity: disabled ? 0.4 : 1 }}
      hitSlop={hitSlop}
      pressRetentionOffset={16}
    >
      <Animated.View
        style={[
          styles.base,
          style,
          {
            opacity: pressed ? 0.7 : 1,
            transform: [{ scale: pressed && !reduced ? 0.97 : 1 }],
            transitionDuration: 120,
          },
        ]}
      >
        <SymbolAnimationContext.Provider
          value={{
            reduceMotion: reduced,
            trigger: symbolAnimationTrigger,
          }}
        >
          {children}
        </SymbolAnimationContext.Provider>
      </Animated.View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    transitionProperty: ["transform", "opacity"],
    transitionTimingFunction: "ease-out",
  },
});
