import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { Finn, JournalType } from "@/constants/theme";

const PHRASES = [
  "Write what you spent…",
  "2 coffees from Starbucks, ₹360",
  "Uber back home, split ₹432 with Aswin",
];

const TYPE_DELAY = 55;
const DELETE_DELAY = 30;
const HOLD_DELAY = 2500;

export function JournalEmptyPrompt({ onPress }: { onPress: () => void }) {
  const reducedMotion = useReducedMotion();
  const [visibleText, setVisibleText] = useState(
    reducedMotion ? PHRASES[0] : "",
  );

  useEffect(() => {
    if (reducedMotion) {
      setVisibleText(PHRASES[0]);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let phraseIndex = 0;
    let characterIndex = 0;
    let deleting = false;

    const schedule = (delay: number) => {
      timer = setTimeout(tick, delay);
    };

    const tick = () => {
      if (cancelled) return;

      const phrase = PHRASES[phraseIndex];
      if (!deleting) {
        characterIndex += 1;
        setVisibleText(phrase.slice(0, characterIndex));

        if (characterIndex === phrase.length) {
          deleting = true;
          schedule(HOLD_DELAY);
        } else {
          schedule(TYPE_DELAY);
        }
        return;
      }

      characterIndex -= 1;
      setVisibleText(phrase.slice(0, characterIndex));
      if (characterIndex === 0) {
        phraseIndex = (phraseIndex + 1) % PHRASES.length;
        deleting = false;
        schedule(TYPE_DELAY);
      } else {
        schedule(DELETE_DELAY);
      }
    };

    setVisibleText("");
    schedule(TYPE_DELAY);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [reducedMotion]);

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
