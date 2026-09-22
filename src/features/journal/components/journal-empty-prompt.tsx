import { Pressable, StyleSheet, Text } from "react-native";
import { Finn, JournalType } from "@/constants/theme";
import { useRotatingPlaceholder } from "@/components/ui/use-rotating-placeholder";

const PHRASES = [
  "Write what you spent…",
  "2 coffees from Starbucks, ₹360",
  "Uber back home, split ₹432 with Aswin",
];

export function JournalEmptyPrompt({ onPress }: { onPress: () => void }) {
  const visibleText = useRotatingPlaceholder(PHRASES);

  return (
    <Pressable
      accessibilityHint="Opens the keyboard so you can add a journal entry."
      accessibilityLabel={PHRASES[0]}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      pressRetentionOffset={16}
      style={({ pressed }) => [
        styles.control,
        pressed && styles.pressed,
      ]}
    >
      <Text
        accessibilityElementsHidden
        accessibilityLiveRegion="none"
        importantForAccessibility="no"
        style={styles.text}
      >
        {visibleText}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  control: {
    position: "absolute",
    zIndex: 1,
    top: 0,
    left: 0,
    right: 0,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  pressed: { opacity: 0.55 },
  text: {
    fontFamily: JournalType.medium,
    fontSize: 16,
    lineHeight: 25,
    letterSpacing: -0.2,
    color: Finn.muted,
    includeFontPadding: false,
  },
});
