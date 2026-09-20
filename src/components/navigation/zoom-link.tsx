import { Link, type Href } from "expo-router";
import { Platform } from "react-native";
import type { ReactElement } from "react";
import { useMotionPreference } from "@/hooks/use-motion-preference";

/** The child must forward its ref and press props to one native pressable. */
export function ZoomLink({ href, children }: { href: Href; children: ReactElement }) {
  const reduced = useMotionPreference();
  const zoom = Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) >= 18 && !reduced;
  return (
    <Link href={href} asChild>
      {zoom ? <Link.AppleZoom>{children}</Link.AppleZoom> : children}
    </Link>
  );
}
