import { Finn, JournalType } from "@/constants/theme";
import type {
  InitialStoryStep,
  OnboardingAnswers,
  StorySceneId,
} from "@/features/onboarding/types/onboarding.types";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { Image } from "expo-image";
import { useIsFocused } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const CHARACTER_REVEAL_MS = 17;
const READY_PAUSE_MS = 700;
const REDUCED_READY_PAUSE_MS = 250;

const STORY_SCENES: Record<StorySceneId, number> = {
  hello: require("@/assets/images/onboarding/conversation-scenes/01-hello.webp"),
  worry: require("@/assets/images/onboarding/conversation-scenes/02-worry.webp"),
  "busy-day": require("@/assets/images/onboarding/conversation-scenes/03-busy-day.webp"),
  "natural-note": require("@/assets/images/onboarding/conversation-scenes/04-natural-note.webp"),
  "receipt-scan": require("@/assets/images/onboarding/conversation-scenes/05-receipt-scan.webp"),
  "month-end": require("@/assets/images/onboarding/conversation-scenes/06-month-end.webp"),
  relief: require("@/assets/images/onboarding/conversation-scenes/07-relief.webp"),
};

export function InitialStoryScreen({
  step,
  answers,
  onReadyChange,
}: {
  step: InitialStoryStep;
  answers: OnboardingAnswers;
  onReadyChange: (ready: boolean, delayMs: number) => void;
}) {
  const reduced = useMotionPreference();
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const copy = useMemo(
    () => resolveStoryCopy(step.copy, answers.name),
    [answers.name, step.copy],
  );
  const words = useMemo(() => splitWords(copy), [copy]);
  const characterCount = useMemo(
    () => words.reduce((total, word) => total + word.text.length + 1, 0),
    [words],
  );
  const sceneProgress = useSharedValue(reduced ? 1 : 0);
  const characterProgress = useSharedValue(reduced ? characterCount : 0);

  const sceneStyle = useAnimatedStyle(() => {
    const progress = sceneProgress.get();
    return {
      opacity: progress,
      transform: [
        {
          translateY: interpolate(
            progress,
            [0, 1],
            [8, 0],
            Extrapolation.CLAMP,
          ),
        },
        {
          scale: interpolate(progress, [0, 1], [0.97, 1], Extrapolation.CLAMP),
        },
      ],
    };
  });

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    cancelAnimation(sceneProgress);
    cancelAnimation(characterProgress);

    const typingDuration = reduced
      ? 0
      : Math.max(450, characterCount * CHARACTER_REVEAL_MS);
    const readyDelay =
      typingDuration + (reduced ? REDUCED_READY_PAUSE_MS : READY_PAUSE_MS);

    onReadyChange(false, readyDelay);

    if (!focused || !foreground) return;

    if (reduced) {
      sceneProgress.set(1);
      characterProgress.set(characterCount);
    } else {
      sceneProgress.set(0);
      characterProgress.set(0);
      sceneProgress.set(
        withTiming(1, {
          duration: 160,
          easing: EASE_OUT,
        }),
      );
      characterProgress.set(
        withTiming(characterCount, {
          duration: typingDuration,
          easing: Easing.linear,
        }),
      );
    }

    const readyTimeout = setTimeout(
      () => onReadyChange(true, readyDelay),
      readyDelay,
    );
    return () => clearTimeout(readyTimeout);
  }, [
    focused,
    foreground,
    onReadyChange,
    reduced,
    sceneProgress,
    step.id,
    characterCount,
    characterProgress,
  ]);

  return (
    <View style={styles.screen}>
      <View
        accessible
        accessibilityLabel={copy}
        accessibilityLiveRegion="polite"
        accessibilityRole="text"
        style={styles.storyBody}
      >
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.sceneFrame, sceneStyle]}
        >
          <View style={styles.sceneHalo} />
          <Image
            accessible={false}
            cachePolicy="memory-disk"
            contentFit="contain"
            source={STORY_SCENES[step.scene]}
            style={styles.sceneImage}
            transition={0}
          />
        </Animated.View>

        <MagicStoryCopy
          highlightedWords={step.highlightedWords}
          reduced={reduced}
          words={words}
          characterProgress={characterProgress}
        />
      </View>
    </View>
  );
}

function MagicStoryCopy({
  characterProgress,
  highlightedWords,
  reduced,
  words,
}: {
  characterProgress: SharedValue<number>;
  highlightedWords: readonly string[];
  reduced: boolean;
  words: readonly StoryWord[];
}) {
  return (
    <View style={styles.textStage}>
      <View style={styles.wordRow}>
        {words.map((word, index) => (
          <MagicWord
            key={`${index}-${word.text}`}
            characterProgress={characterProgress}
            highlighted={highlightedWords.some((candidate) =>
              normalizedWord(word.text).includes(normalizedWord(candidate)),
            )}
            quote={word.quote}
            reduced={reduced}
            word={word}
          />
        ))}
      </View>
    </View>
  );
}

function MagicWord({
  characterProgress,
  highlighted,
  quote,
  reduced,
  word,
}: {
  characterProgress: SharedValue<number>;
  highlighted: boolean;
  quote: boolean;
  reduced: boolean;
  word: StoryWord;
}) {
  return (
    <View style={styles.magicWord}>
      {Array.from(word.text).map((character, index) => (
        <MagicCharacter
          key={`${index}-${character}`}
          character={character}
          characterProgress={characterProgress}
          highlighted={highlighted}
          index={word.characterOffset + index}
          quote={quote}
          reduced={reduced}
        />
      ))}
    </View>
  );
}

function MagicCharacter({
  character,
  characterProgress,
  highlighted,
  index,
  quote,
  reduced,
}: {
  character: string;
  characterProgress: SharedValue<number>;
  highlighted: boolean;
  index: number;
  quote: boolean;
  reduced: boolean;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reduced
      ? 1
      : interpolate(
          characterProgress.get(),
          [index, index + 2.2],
          [0, 1],
          Extrapolation.CLAMP,
        ),
  }));

  return (
    <Animated.Text
      style={[
        styles.word,
        quote && styles.quoteWord,
        highlighted && styles.highlightedWord,
        animatedStyle,
      ]}
    >
      {character}
    </Animated.Text>
  );
}

type StoryWord = { text: string; quote: boolean; characterOffset: number };

function splitWords(copy: string): StoryWord[] {
  let insideQuote = false;
  let characterOffset = 0;
  return copy
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((text) => {
      const startsQuote = text.includes("“");
      const endsQuote = text.includes("”");
      if (startsQuote) insideQuote = true;
      const word = { text, quote: insideQuote, characterOffset };
      characterOffset += text.length + 1;
      if (endsQuote) insideQuote = false;
      return word;
    });
}

function normalizedWord(word: string) {
  return word.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function resolveStoryCopy(copy: string, name?: string) {
  const safeName = name?.trim() || "friend";
  return copy.replaceAll("{name}", safeName);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: "hidden",
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 112,
    backgroundColor: Finn.canvas,
  },
  storyBody: {
    flex: 1,
    width: "100%",
    maxWidth: 470,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  sceneFrame: {
    flex: 1,
    width: "100%",
    minHeight: 245,
    maxHeight: 370,
    alignItems: "center",
    justifyContent: "center",
  },
  sceneHalo: {
    position: "absolute",
    width: 278,
    height: 278,
    borderRadius: 139,
    backgroundColor: Finn.primarySoft,
    opacity: 0.72,
    transform: [{ scaleX: 1.06 }],
  },
  sceneImage: { width: "100%", height: "100%" },
  textStage: {
    width: "100%",
    minHeight: 164,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 2,
    paddingTop: 12,
  },
  wordRow: {
    maxWidth: 430,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "center",
    columnGap: 6,
    rowGap: 2,
  },
  magicWord: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  word: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 25,
    lineHeight: 31,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  quoteWord: {
    fontFamily: JournalType.expressive,
    fontSize: 29,
    lineHeight: 32,
    letterSpacing: 0,
  },
  highlightedWord: { color: Finn.primary },
});
