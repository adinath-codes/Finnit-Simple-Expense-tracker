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
     /** Dollar-bill green: the single, everyday interactive accent. */
     primary: "#20C878",
     primarySoft: "#EAF8EF",
     blue: "#0099F5",
     amber: "#FFAC36",
     /** Reserved for the occasional blue sparkle/celebration treatment. */
     blueSparkleStart: "#3378DE",
     blueSparkleEnd: "#77B4F4",
     pink: "#EE849A",
     danger: "#CA5C60",
     wash: "#F6F1ED",
     radius: 22,
     shadow: { boxShadow: "0px 4px 14px rgba(169, 148, 130, 0.09)" },
} as const;

/** Soft Finn-tinted gradients for the Goals chart, ordered by category. */
export const GoalRingPalette = [
     {
          category: "food",
          start: "#F29AB0",
          end: "#F8CCD5",
          icon: "#A44B64",
          activeStart: "#EC6F92",
          activeEnd: "#F4A6B8",
          activeIcon: "#87364F",
     },
     {
          category: "transport",
          start: "#86D9AF",
          end: "#CBEFD9",
          icon: "#28734D",
          activeStart: "#3BCB80",
          activeEnd: "#9DE0B9",
          activeIcon: "#155A36",
     },
     {
          category: "shopping",
          start: "#7FC1A2",
          end: "#C1E0D1",
          icon: "#3F7C61",
          activeStart: "#5EAF88",
          activeEnd: "#98CFB4",
          activeIcon: "#28664A",
     },
     {
          category: "other",
          start: "#F0BB6B",
          end: "#F8DEAD",
          icon: "#956725",
          activeStart: "#E9A13B",
          activeEnd: "#F2C270",
          activeIcon: "#774B12",
     },
] as const;

/** Explicit faces avoid Android synthesizing SF Pro weights from Roboto. */
export const JournalType = {
     regular: Platform.OS === "ios" ? "System" : "SFProDisplay-Regular",
     medium: Platform.OS === "ios" ? "System" : "SFProDisplay-Medium",
     bold: Platform.OS === "ios" ? "System" : "SFProDisplay-Bold",
     black: Platform.OS === "ios" ? "System" : "SFProDisplay-Black",
} as const;

export const JournalPaper = {
     experimental_backgroundImage:
          "linear-gradient(160deg, #FFF9F2 0%, #FFF7F7 45%, #FCF5FF 100%)",
} as const;
export const Categories = {
     food: { label: "Food & drinks", color: Finn.pink, icon: "food" },
     transport: { label: "Transport", color: Finn.primary, icon: "car" },
     shopping: { label: "Shopping", color: "#74BA98", icon: "bag" },
     other: { label: "Other", color: Finn.amber, icon: "note" },
} as const;
