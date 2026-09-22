import { Link, type Href } from "expo-router";
import { cloneElement, type ReactElement } from "react";
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useMotionPreference } from "@/hooks/use-motion-preference";

/** The child must forward its ref and press props to one native pressable. */
export function ZoomLink({ href, children }: { href: Href; children: ReactElement<{ style?: StyleProp<ViewStyle> }> }) {
  const reduced = useMotionPreference();
  const zoom = Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) >= 18 && !reduced;
  // Router's React Native Slot rejects array styles when `asChild` is enabled.
  const child = cloneElement(children, { style: StyleSheet.flatten(children.props.style) });
  return (
    <Link href={href} asChild>
      {zoom ? <Link.AppleZoom>{child}</Link.AppleZoom> : child}
    </Link>
  );
}
