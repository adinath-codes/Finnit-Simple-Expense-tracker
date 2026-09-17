/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import "@/global.css";

import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#000000",
    background: "#ffffff",
    backgroundElement: "#F0F0F3",
    backgroundSelected: "#E0E1E6",
    textSecondary: "#60646C",
  },
  dark: {
    text: "#ffffff",
    background: "#000000",
    backgroundElement: "#212225",
    backgroundSelected: "#2E3135",
    textSecondary: "#B0B4BA",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/** Reference-matched Finn UI tokens. */
export const Finn = {
  canvas: "#FFF8F5",
  surface: "#FFFFFF",
  ink: "#171717",
  secondary: "#979394",
  muted: "#A9A19D",
  line: "#EEE8E4",
  purple: "#A482DF",
  purpleSoft: "#F1EAFB",
  blue: "#0099F5",
  amber: "#FFAC36",
  green: "#36B779",
  pink: "#EE849A",
  danger: "#CA5C60",
  wash: "#F6F1ED",
  radius: 22,
  shadow: { boxShadow: "0px 4px 14px rgba(169, 148, 130, 0.09)" },
} as const;
/** Explicit faces avoid Android synthesizing SF Pro weights from Roboto. */
export const JournalType = {
  regular: Platform.OS === "ios" ? "System" : "SFProDisplay-Regular",
  medium: Platform.OS === "ios" ? "System" : "SFProDisplay-Medium",
  bold: Platform.OS === "ios" ? "System" : "SFProDisplay-Bold",
} as const;

export const JournalPaper = {
  experimental_backgroundImage:
    "linear-gradient(160deg, #FFF9F2 0%, #FFF7F7 45%, #FCF5FF 100%)",
} as const;
export const Categories = {
  food: { label: "Food & drinks", color: Finn.pink, icon: "food" },
  transport: { label: "Transport", color: Finn.purple, icon: "car" },
  shopping: { label: "Shopping", color: "#74BA98", icon: "bag" },
  other: { label: "Other", color: Finn.amber, icon: "note" },
} as const;
