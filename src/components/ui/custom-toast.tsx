import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, Keyframe } from "react-native-reanimated";
import { Button } from "@/components/ui/button";
import { Finn, JournalType } from "@/constants/theme";
import { useMotionPreference } from "@/hooks/use-motion-preference";

export type CustomToastState = "error" | "warning" | "info";

export type CustomToastProps = {
  mess: string;
  highlighted?: string;
  state: CustomToastState;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
};

const presentation = {
  error: {
    image: require("@/assets/images/character/toast/error.webp"),
    color: Finn.danger,
  },
  warning: {
    image: require("@/assets/images/character/toast/warning.webp"),
    color: "#A66A16",
  },
  info: {
    image: require("@/assets/images/character/toast/info.webp"),
    color: Finn.blue,
  },
} as const;

const enter = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -10 }, { scale: 0.96 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
}).duration(240);
const exit = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  100: { opacity: 0, transform: [{ translateY: -7 }, { scale: 0.98 }] },
}).duration(180);

export function CustomToast({
  mess,
  highlighted,
  state,
  actionLabel,
  onAction,
  onDismiss,
}: CustomToastProps) {
  const reduced = useMotionPreference();
  const { image, color } = presentation[state];

  return (
    <Animated.View
      accessible={!onAction && !onDismiss}
      accessibilityRole="alert"
      accessibilityLabel={[mess, highlighted].filter(Boolean).join(" ")}
      accessibilityLiveRegion={state === "info" ? "polite" : "assertive"}
      entering={reduced ? FadeIn.duration(150) : enter}
      exiting={reduced ? FadeOut.duration(150) : exit}
      style={styles.toast}
    >
      <Image
        source={image}
        contentFit="contain"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.character}
      />
      <View style={styles.copy}>
        <Text style={styles.message}>{mess}</Text>
        {highlighted ? (
          <Text style={[styles.highlighted, { color }]}>{highlighted}</Text>
        ) : null}
        {actionLabel && onAction ? (
          <Button
            label={actionLabel}
            onPress={onAction}
            style={styles.actionButton}
          >
            <Text style={[styles.actionLabel, { color }]}>{actionLabel}</Text>
          </Button>
        ) : null}
      </View>
      {onDismiss ? (
        <Button label="Dismiss message" onPress={onDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissLabel}>×</Text>
        </Button>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 420,
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Finn.line,
    backgroundColor: "#FFFFFF",
    boxShadow: "0px 6px 18px rgba(78, 65, 59, 0.14)",
  },
  character: { width: 46, height: 46 },
  copy: { flex: 1, gap: 2 },
  message: {
    color: Finn.ink,
    fontFamily: JournalType.regular,
    fontSize: 13,
    lineHeight: 17,
  },
  highlighted: {
    fontFamily: JournalType.medium,
    fontSize: 13,
    lineHeight: 17,
  },
  actionButton: {
    alignSelf: "flex-start",
    minHeight: 30,
    justifyContent: "center",
    marginTop: 2,
  },
  actionLabel: {
    fontFamily: JournalType.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  dismissButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: 32,
    minWidth: 32,
  },
  dismissLabel: {
    color: Finn.muted,
    fontFamily: JournalType.regular,
    fontSize: 22,
    lineHeight: 24,
  },
});
