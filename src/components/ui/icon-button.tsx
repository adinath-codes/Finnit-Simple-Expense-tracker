import { forwardRef } from "react";
import type { View } from "react-native";
import { Finn } from "@/constants/theme";
import { Button, type ButtonProps } from "./button";
import { Icon, type IconName } from "./icon";
import type { AnimationSpec } from "expo-symbols";

export const IconButton = forwardRef<View, Omit<ButtonProps, "children"> & {
  name: IconName; color?: string; filled?: boolean;
  animation?: NonNullable<AnimationSpec["effect"]>["type"] | false;
  animationTrigger?: number;
}>(function IconButton({ name, color = Finn.ink, filled = false, style, animation, animationTrigger, ...props }, ref) {
  return <Button {...props} ref={ref} style={[{
    width: 44, height: 44, borderRadius: 24,
    backgroundColor: filled ? Finn.primary : Finn.surface, ...Finn.shadow,
  }, style]}>
    <Icon name={name} color={filled ? "#fff" : color} size={19}
      animation={animation} animationTrigger={animationTrigger} />
  </Button>;
});
