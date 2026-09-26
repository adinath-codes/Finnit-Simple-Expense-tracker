import { Icon, type IconName } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import type {
  InitialStoryStep,
  InitialStoryVariant,
} from "@/features/onboarding/types/onboarding.types";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useIsFocused } from "expo-router";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  interpolate,
  ReduceMotion,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

const CHARACTER_ATLAS = require("@/assets/images/onboarding/initial-story-character-atlas.png");
const ATLAS_COLUMNS = 4;
const ATLAS_ROWS = 2;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const chapterLabels: Record<InitialStoryVariant, string> = {
  life: "LIFE MOVES",
  overwhelm: "THE FRICTION",
  forgotten: "THE GAP",
  "natural-note": "CAPTURE",
  organized: "UNDERSTAND",
  journal: "REMEMBER",
  ask: "ASK",
  handoff: "BEGIN",
};

const storyPaths: Record<InitialStoryVariant, string> = {
  life: "M18 88 C86 18 124 142 205 82 C278 28 312 45 374 120",
  overwhelm: "M16 62 C92 142 93 5 176 74 C248 134 291 39 376 91",
  forgotten: "M12 42 C108 8 102 165 196 112 C276 66 286 188 378 130",
  "natural-note": "M28 65 C95 26 149 57 179 119 C215 194 292 172 366 226",
  organized: "M25 54 C116 24 161 81 194 130 C229 183 285 219 365 248",
  journal: "M17 302 C87 259 86 167 150 132 C229 89 273 168 373 72",
  ask: "M18 78 C95 23 154 54 198 113 C249 180 285 227 373 188",
  handoff: "M18 245 C98 333 183 301 215 217 C246 135 303 92 376 128",
};

type StoryMotionState = {
  drift: SharedValue<number>;
  pulse: SharedValue<number>;
  reduced: boolean;
};

const StoryMotionContext = createContext<StoryMotionState | null>(null);

function useStoryMotion() {
  const motion = useContext(StoryMotionContext);
  if (!motion) throw new Error("Story motion must be used inside InitialStoryScreen.");
  return motion;
}

const reveal = (delay = 0) =>
  FadeInDown.duration(320)
    .delay(delay)
    .easing(EASE_OUT)
    .reduceMotion(ReduceMotion.System);

export function InitialStoryScreen({
  step,
  onBack,
  storyIndex,
  storyCount,
}: {
  step: InitialStoryStep;
  onBack?: () => void;
  storyIndex: number;
  storyCount: number;
}) {
  const reduced = useMotionPreference();
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const drift = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    cancelAnimation(drift);
    cancelAnimation(pulse);

    if (reduced || !focused || !foreground) {
      drift.set(0.35);
      pulse.set(0);
      return;
    }

    drift.set(0);
    pulse.set(0);
    drift.set(
      withRepeat(
        withTiming(1, { duration: 6400, easing: EASE_IN_OUT }),
        -1,
        true,
      ),
    );
    pulse.set(
      withDelay(
        240,
        withRepeat(
          withTiming(1, { duration: 1800, easing: Easing.linear }),
          -1,
          false,
        ),
      ),
    );

    return () => {
      cancelAnimation(drift);
      cancelAnimation(pulse);
    };
  }, [drift, focused, foreground, pulse, reduced]);

  const motion = useMemo(
    () => ({ drift, pulse, reduced }),
    [drift, pulse, reduced],
  );

  return (
    <StoryMotionContext.Provider value={motion}>
      <View style={styles.screen}>
        <LiquidBackdrop variant={step.variant} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <StoryTopBar
            onBack={onBack}
            storyIndex={storyIndex}
            storyCount={storyCount}
          />
          <View style={styles.copy}>
            <Animated.Text entering={reveal(10)} style={styles.chapterLabel}>
              {chapterLabels[step.variant]}
            </Animated.Text>
            <Animated.Text entering={reveal(55)} style={styles.title}>
              {step.title}
            </Animated.Text>
            <Animated.Text entering={reveal(125)} style={styles.subtitle}>
              {step.subtitle}
            </Animated.Text>
          </View>
          <StoryVisual variant={step.variant} />
        </ScrollView>
      </View>
    </StoryMotionContext.Provider>
  );
}

function StoryTopBar({
  onBack,
  storyIndex,
  storyCount,
}: {
  onBack?: () => void;
  storyIndex: number;
  storyCount: number;
}) {
  return (
    <View>
      <View style={styles.topBar}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onBack();
            }}
            style={({ pressed }) => [
              styles.storyBackButton,
              pressed && styles.storyBackButtonPressed,
            ]}
          >
            <Icon name="back" size={17} color={Finn.ink} animation={false} />
          </Pressable>
        ) : (
          <View style={styles.topBarSpacer} />
        )}
        <View style={styles.brand}>
          <BrandDot />
          <Text style={styles.brandText}>FINN</Text>
        </View>
        <Text style={styles.storyCounter}>
          {String(storyIndex + 1).padStart(2, "0")} / {String(storyCount).padStart(2, "0")}
        </Text>
      </View>
      <View style={styles.storyProgress} accessibilityElementsHidden>
        {Array.from({ length: storyCount }, (_, index) => (
          <View key={index} style={styles.storyProgressTrack}>
            <View
              style={[
                styles.storyProgressFill,
                index > storyIndex && styles.storyProgressPending,
                index === storyIndex && styles.storyProgressCurrent,
              ]}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function BrandDot() {
  const { pulse, reduced } = useStoryMotion();
  const animatedStyle = useAnimatedStyle(() => {
    const wave = reduced ? 0 : Math.sin(pulse.get() * Math.PI * 2);
    return {
      opacity: reduced ? 1 : 0.82 + wave * 0.18,
      transform: [{ scale: reduced ? 1 : 1 + wave * 0.16 }],
    };
  });
  return <Animated.View style={[styles.brandDot, animatedStyle]} />;
}

function LiquidBackdrop({ variant }: { variant: InitialStoryVariant }) {
  const { drift, pulse, reduced } = useStoryMotion();
  const driftOne = useAnimatedStyle(() => {
    const t = reduced ? 0.35 : drift.get();
    return {
      transform: [
        { translateX: interpolate(t, [0, 1], [-26, 34]) },
        { translateY: interpolate(t, [0, 1], [18, -28]) },
        { rotate: `${interpolate(t, [0, 1], [-8, 12])}deg` },
        { scaleX: interpolate(t, [0, 1], [0.92, 1.08]) },
        { scaleY: interpolate(t, [0, 1], [1.08, 0.94]) },
      ],
    };
  });
  const driftTwo = useAnimatedStyle(() => {
    const t = reduced ? 0.35 : drift.get();
    return {
      transform: [
        { translateX: interpolate(t, [0, 1], [30, -24]) },
        { translateY: interpolate(t, [0, 1], [-22, 30]) },
        { rotate: `${interpolate(t, [0, 1], [10, -14])}deg` },
        { scaleX: interpolate(t, [0, 1], [1.08, 0.94]) },
        { scaleY: interpolate(t, [0, 1], [0.94, 1.1]) },
      ],
    };
  });
  const haloStyle = useAnimatedStyle(() => {
    const wave = reduced ? 0 : Math.sin(pulse.get() * Math.PI * 2);
    return {
      opacity: reduced ? 0.28 : 0.2 + (wave + 1) * 0.06,
      transform: [{ scale: reduced ? 1 : 1 + wave * 0.035 }],
    };
  });

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      style={styles.liquidBackdrop}
    >
      <Animated.View
        style={[
          styles.liquidBlob,
          styles.liquidBlobOne,
          variant === "forgotten" && styles.liquidBlobMuted,
          driftOne,
        ]}
      />
      <Animated.View
        style={[styles.liquidBlob, styles.liquidBlobTwo, driftTwo]}
      />
      <Animated.View style={[styles.liquidHalo, haloStyle]} />
    </View>
  );
}

function StoryVisual({ variant }: { variant: InitialStoryVariant }) {
  return (
    <View style={styles.stage}>
      <StoryThread variant={variant} />
      {variant === "life" ? <LifeVisual /> : null}
      {variant === "overwhelm" ? <OverwhelmVisual /> : null}
      {variant === "forgotten" ? <ForgottenVisual /> : null}
      {variant === "natural-note" ? <NaturalNoteVisual /> : null}
      {variant === "organized" ? <OrganizedVisual /> : null}
      {variant === "journal" ? <JournalVisual /> : null}
      {variant === "ask" ? <AskVisual /> : null}
      {variant === "handoff" ? <HandoffVisual /> : null}
    </View>
  );
}

function StoryThread({ variant }: { variant: InitialStoryVariant }) {
  const { reduced } = useStoryMotion();
  const dashOffset = useSharedValue(reduced ? 0 : 760);

  useEffect(() => {
    dashOffset.set(reduced ? 0 : 760);
    if (!reduced) {
      dashOffset.set(withTiming(0, { duration: 820, easing: EASE_OUT }));
    }
  }, [dashOffset, reduced, variant]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.get(),
  }));

  return (
    <Svg
      pointerEvents="none"
      accessibilityElementsHidden
      viewBox="0 0 390 390"
      style={styles.storyThread}
    >
      <Path
        d={storyPaths[variant]}
        fill="none"
        stroke={Finn.primary}
        strokeLinecap="round"
        strokeWidth={16}
        opacity={0.08}
      />
      <AnimatedPath
        animatedProps={animatedProps}
        d={storyPaths[variant]}
        fill="none"
        stroke={Finn.primary}
        strokeDasharray="760 760"
        strokeLinecap="round"
        strokeWidth={3}
        opacity={0.62}
      />
    </Svg>
  );
}

function AmbientMotion({
  children,
  style,
  distance = 5,
  sway = 3,
  rotate = 0.7,
  phase = 0,
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  distance?: number;
  sway?: number;
  rotate?: number;
  phase?: number;
}>) {
  const { drift, reduced } = useStoryMotion();
  const animatedStyle = useAnimatedStyle(() => {
    if (reduced) {
      return { transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: "0deg" }] };
    }
    const angle = (drift.get() + phase) * Math.PI * 2;
    return {
      transform: [
        { translateX: Math.cos(angle) * sway },
        { translateY: Math.sin(angle) * distance },
        { rotate: `${Math.sin(angle) * rotate}deg` },
      ],
    };
  });
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

function CharacterPose({
  frame,
  size,
  delay = 80,
  style,
}: {
  frame: number;
  size: number;
  delay?: number;
  style?: object;
}) {
  const column = frame % ATLAS_COLUMNS;
  const row = Math.floor(frame / ATLAS_COLUMNS);
  return (
    <Animated.View
      entering={reveal(delay)}
      pointerEvents="none"
      accessible={false}
      style={[styles.characterAnchor, { width: size, height: size }, style]}
    >
      <AmbientMotion
        distance={frame === 0 ? 7 : 5}
        sway={frame === 0 ? 5 : 3}
        phase={frame * 0.09}
        style={[styles.characterViewport, { width: size, height: size }]}
      >
        <Image
          source={CHARACTER_ATLAS}
          contentFit="fill"
          transition={0}
          accessible={false}
          style={{
            width: size * ATLAS_COLUMNS,
            height: size * ATLAS_ROWS,
            transform: [
              { translateX: -column * size },
              { translateY: -row * size },
            ],
          }}
        />
      </AmbientMotion>
    </Animated.View>
  );
}

function ExpenseBubble({
  icon,
  label,
  amount,
  delay,
  style,
}: {
  icon: IconName;
  label: string;
  amount: string;
  delay: number;
  style?: object;
}) {
  return (
    <Animated.View entering={reveal(delay)} style={[styles.expenseAnchor, style]}>
      <AmbientMotion
        distance={4}
        sway={2.5}
        rotate={0.9}
        phase={delay / 900}
        style={styles.expenseBubble}
      >
        <View style={styles.expenseIcon}>
          <Icon name={icon} size={15} color={Finn.ink} animation={false} />
        </View>
        <View>
          <Text style={styles.expenseLabel}>{label}</Text>
          <Text style={styles.expenseAmount}>{amount}</Text>
        </View>
      </AmbientMotion>
    </Animated.View>
  );
}

function LifeVisual() {
  return (
    <View style={styles.scene}>
      <CharacterPose frame={0} size={278} style={styles.lifeCharacter} />
      <ExpenseBubble
        icon="note"
        label="coffee"
        amount="$6"
        delay={170}
        style={styles.lifeBubbleOne}
      />
      <ExpenseBubble
        icon="food"
        label="lunch with Sam"
        amount="$34"
        delay={260}
        style={styles.lifeBubbleTwo}
      />
      <ExpenseBubble
        icon="car"
        label="Uber home"
        amount="$28"
        delay={350}
        style={styles.lifeBubbleThree}
      />
    </View>
  );
}

function OverwhelmVisual() {
  return (
    <View style={styles.scene}>
      <CharacterPose frame={1} size={286} style={styles.overwhelmCharacter} />
      <ExpenseBubble
        icon="food"
        label="team snacks"
        amount="$22"
        delay={100}
        style={styles.overwhelmBubbleOne}
      />
      <ExpenseBubble
        icon="bag"
        label="something small"
        amount="$19"
        delay={160}
        style={styles.overwhelmBubbleTwo}
      />
      <ExpenseBubble
        icon="wallet"
        label="paid Alex back"
        amount="$40"
        delay={220}
        style={styles.overwhelmBubbleThree}
      />
      <ExpenseBubble
        icon="car"
        label="Uber home"
        amount="$28"
        delay={280}
        style={styles.overwhelmBubbleFour}
      />
      <MotionMark />
    </View>
  );
}

function MotionMark() {
  const { pulse, reduced } = useStoryMotion();
  const animatedStyle = useAnimatedStyle(() => {
    const wave = reduced ? 0 : Math.sin(pulse.get() * Math.PI * 2);
    return {
      opacity: reduced ? 1 : 0.78 + (wave + 1) * 0.11,
      transform: [
        { translateY: reduced ? 0 : wave * -3 },
        { scale: reduced ? 1 : 1 + wave * 0.08 },
        { rotate: `${reduced ? 0 : wave * 4}deg` },
      ],
    };
  });
  return (
    <Animated.Text
      entering={FadeIn.delay(360).duration(180)}
      style={[styles.overwhelmMark, animatedStyle]}
    >
      !
    </Animated.Text>
  );
}

function ForgottenVisual() {
  const forgottenExpenses = [
    { icon: "note" as const, label: "coffee", amount: "$6", style: styles.forgottenOne },
    { icon: "food" as const, label: "team snacks", amount: "$22", style: styles.forgottenTwo },
    { icon: "car" as const, label: "Uber home", amount: "$28", style: styles.forgottenThree },
    { icon: "food" as const, label: "lunch with Sam", amount: "$34", style: styles.forgottenFour },
  ];
  return (
    <View style={styles.scene}>
      <Animated.View
        entering={FadeIn.duration(500).easing(EASE_OUT)}
        pointerEvents="none"
        accessible={false}
        style={styles.cloudContainer}
      >
        <AmbientMotion
          distance={9}
          sway={10}
          rotate={1.4}
          phase={0.62}
          style={styles.blurredExpenseCloud}
        >
          {forgottenExpenses.map((item) => (
            <View
              key={item.label}
              style={[styles.expenseBubble, styles.cloudExpenseBubble, item.style]}
            >
              <View style={styles.expenseIcon}>
                <Icon name={item.icon} size={15} color={Finn.ink} animation={false} />
              </View>
              <View>
                <Text style={styles.expenseLabel}>{item.label}</Text>
                <Text style={styles.expenseAmount}>{item.amount}</Text>
              </View>
            </View>
          ))}
        </AmbientMotion>
      </Animated.View>
      <Animated.View entering={reveal(180)} style={styles.thoughtBubble}>
        <Text style={styles.thoughtText}>Wait… where did it all go?</Text>
      </Animated.View>
      <CharacterPose frame={2} size={274} delay={260} style={styles.forgottenCharacter} />
    </View>
  );
}

function NaturalNoteVisual() {
  return (
    <View style={styles.scene}>
      <CharacterPose frame={3} size={210} style={styles.noteCharacter} />
      <Animated.View entering={reveal(160)} style={styles.paperCard}>
        <View style={styles.paperBinding} />
        <View style={styles.paperLine}>
          <Text style={styles.paperText}>Lunch with Sam $34</Text>
          <BlinkingCaret />
        </View>
        <Animated.Text
          entering={FadeInRight.duration(300)
            .delay(340)
            .easing(EASE_OUT)
            .reduceMotion(ReduceMotion.System)}
          style={styles.paperText}
        >
          and Uber home $28
        </Animated.Text>
        <DrawnUnderline />
      </Animated.View>
    </View>
  );
}

function BlinkingCaret() {
  const { pulse, reduced } = useStoryMotion();
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reduced
      ? 1
      : interpolate(
          Math.sin(pulse.get() * Math.PI * 2),
          [-1, -0.15, 0.15, 1],
          [0.2, 0.2, 1, 1],
        ),
  }));
  return <Animated.View style={[styles.paperCaret, animatedStyle]} />;
}

function DrawnUnderline() {
  const { reduced } = useStoryMotion();
  const progress = useSharedValue(reduced ? 1 : 0.08);
  useEffect(() => {
    progress.set(reduced ? 1 : 0.08);
    if (!reduced) {
      progress.set(withDelay(520, withTiming(1, { duration: 420, easing: EASE_OUT })));
    }
  }, [progress, reduced]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scaleX: progress.get() }],
  }));
  return <Animated.View style={[styles.paperUnderline, animatedStyle]} />;
}

function OrganizedVisual() {
  return (
    <View style={styles.scene}>
      <Animated.View entering={reveal(80)} style={styles.originalNoteChip}>
        <Text style={styles.originalNoteText}>
          Lunch with Sam $34 and Uber home $28
        </Text>
      </Animated.View>
      <FlowIndicator />
      <Animated.View entering={reveal(280)} style={styles.resultCard}>
        <ResultRow icon="food" label="Lunch with Sam" amount="$34" delay={390} />
        <View style={styles.resultDivider} />
        <ResultRow icon="car" label="Uber home" amount="$28" delay={470} />
        <View style={styles.resultDivider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Today</Text>
          <Text style={styles.totalAmount}>$62</Text>
        </View>
      </Animated.View>
      <CharacterPose frame={4} size={96} delay={480} style={styles.organizedCharacter} />
    </View>
  );
}

function FlowIndicator() {
  const { pulse, reduced } = useStoryMotion();
  const animatedStyle = useAnimatedStyle(() => {
    const wave = reduced ? 0 : Math.sin(pulse.get() * Math.PI * 2);
    return {
      opacity: reduced ? 1 : 0.6 + (wave + 1) * 0.2,
      transform: [{ translateY: reduced ? 0 : wave * 5 }],
    };
  });
  return (
    <Animated.View
      entering={FadeIn.delay(220).duration(180)}
      style={[styles.organizedFlow, animatedStyle]}
    >
      <View style={styles.organizedFlowDot} />
      <View style={styles.organizedFlowLine} />
      <Text style={styles.organizedArrow}>↓</Text>
    </Animated.View>
  );
}

function ResultRow({
  icon,
  label,
  amount,
  delay = 0,
}: {
  icon: IconName;
  label: string;
  amount: string;
  delay?: number;
}) {
  return (
    <Animated.View
      entering={FadeInRight.duration(260)
        .delay(delay)
        .easing(EASE_OUT)
        .reduceMotion(ReduceMotion.System)}
      style={styles.resultRow}
    >
      <View style={styles.resultIcon}>
        <Icon name={icon} size={17} color={Finn.ink} animation={false} />
      </View>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultAmount}>{amount}</Text>
    </Animated.View>
  );
}

const journalRows = [
  { icon: "note" as const, label: "Coffee before class", amount: "$6", detail: "Quick reset" },
  { icon: "food" as const, label: "Dinner with Sam and Maya", amount: "$82", detail: "Great catch-up" },
  { icon: "bag" as const, label: "Domain for my project", amount: "$12", detail: "Small step, big idea" },
];

function JournalVisual() {
  return (
    <View style={styles.scene}>
      <CharacterPose frame={5} size={220} style={styles.journalCharacter} />
      <View style={styles.timeline}>
        <GrowingTimeline />
        {journalRows.map((row, index) => (
          <Animated.View
            key={row.label}
            entering={FadeInRight.duration(300)
              .delay(120 + index * 90)
              .easing(EASE_OUT)
              .reduceMotion(ReduceMotion.System)}
            style={styles.timelineRow}
          >
            <View style={styles.timelineDot} />
            <View style={styles.timelineCard}>
              <View style={styles.timelineIcon}>
                <Icon name={row.icon} size={15} color={Finn.ink} animation={false} />
              </View>
              <View style={styles.timelineCopy}>
                <Text style={styles.timelineLabel}>{row.label}</Text>
                <Text style={styles.timelineDetail}>{row.detail}</Text>
              </View>
              <Text style={styles.timelineAmount}>{row.amount}</Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

function GrowingTimeline() {
  const { reduced } = useStoryMotion();
  const progress = useSharedValue(reduced ? 1 : 0.06);
  useEffect(() => {
    progress.set(reduced ? 1 : 0.06);
    if (!reduced) {
      progress.set(withTiming(1, { duration: 620, easing: EASE_OUT }));
    }
  }, [progress, reduced]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scaleY: progress.get() }],
  }));
  return <Animated.View style={[styles.timelineLine, animatedStyle]} />;
}

function AskVisual() {
  return (
    <View style={styles.scene}>
      <Animated.View entering={reveal(80)} style={styles.searchCard}>
        <Icon name="search" size={19} color={Finn.ink} animation={false} />
        <Text style={styles.searchText}>What did I spend eating out this month?</Text>
        <SearchSweep />
      </Animated.View>
      <Animated.View entering={reveal(280)} style={styles.answerAnchor}>
        <AmbientMotion distance={3} sway={2} phase={0.35} style={styles.answerCard}>
          <Text style={styles.answerAmount}>$468</Text>
          <Text style={styles.answerSource}>Based on 12 journal notes</Text>
          <View style={styles.sourceRow}>
            <SourceChip label="Lunch with Sam" amount="$34" />
            <SourceChip label="Dinner with Maya" amount="$82" />
          </View>
        </AmbientMotion>
      </Animated.View>
      <CharacterPose frame={6} size={164} delay={380} style={styles.askCharacter} />
    </View>
  );
}

function SearchSweep() {
  const { pulse, reduced } = useStoryMotion();
  const animatedStyle = useAnimatedStyle(() => {
    if (reduced) return { opacity: 0 };
    const t = pulse.get();
    return {
      opacity: interpolate(t, [0, 0.12, 0.82, 1], [0, 0.65, 0.65, 0]),
      transform: [{ translateX: interpolate(t, [0, 1], [-70, 350]) }],
    };
  });
  return <Animated.View style={[styles.searchSweep, animatedStyle]} />;
}

function SourceChip({ label, amount }: { label: string; amount: string }) {
  return (
    <View style={styles.sourceChip}>
      <Text numberOfLines={1} style={styles.sourceLabel}>{label}</Text>
      <Text style={styles.sourceAmount}>{amount}</Text>
    </View>
  );
}

function HandoffVisual() {
  return (
    <View style={styles.scene}>
      <OrbitRings />
      <CharacterPose frame={7} size={294} style={styles.handoffCharacter} />
      <Animated.View
        entering={FadeInLeft.duration(320)
          .delay(260)
          .easing(EASE_OUT)
          .reduceMotion(ReduceMotion.System)}
        style={styles.handoffPill}
      >
        <View style={styles.handoffDot} />
        <Text style={styles.handoffText}>Same you. More clarity.</Text>
      </Animated.View>
    </View>
  );
}

function OrbitRings() {
  const { drift, pulse, reduced } = useStoryMotion();
  const orbitStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${reduced ? 0 : drift.get() * 92}deg` },
      {
        scale: reduced
          ? 1
          : 1 + Math.sin(pulse.get() * Math.PI * 2) * 0.025,
      },
    ],
  }));
  return (
    <Animated.View style={[styles.orbit, orbitStyle]}>
      <View style={styles.orbitRingOuter} />
      <View style={styles.orbitRingInner} />
      <View style={[styles.orbitSpark, styles.orbitSparkOne]} />
      <View style={[styles.orbitSpark, styles.orbitSparkTwo]} />
      <View style={[styles.orbitSpark, styles.orbitSparkThree]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden" },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 108,
  },
  topBar: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarSpacer: { width: 38, height: 38 },
  storyBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Finn.line,
    backgroundColor: Finn.surface,
  },
  storyBackButtonPressed: { opacity: 0.65 },
  brand: { flexDirection: "row", alignItems: "center", gap: 7 },
  brandDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Finn.primary },
  brandText: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 12,
    letterSpacing: 2.1,
  },
  storyCounter: {
    width: 48,
    color: Finn.secondary,
    fontFamily: JournalType.bold,
    fontSize: 10,
    letterSpacing: 0.7,
    textAlign: "right",
  },
  storyProgress: {
    height: 4,
    flexDirection: "row",
    gap: 4,
    marginHorizontal: 2,
    marginTop: 1,
    marginBottom: 8,
  },
  storyProgressTrack: {
    flex: 1,
    height: 3,
    overflow: "hidden",
    borderRadius: 2,
    backgroundColor: "#E8E0DC",
  },
  storyProgressFill: {
    width: "100%",
    height: "100%",
    borderRadius: 2,
    backgroundColor: Finn.primary,
  },
  storyProgressCurrent: { opacity: 1 },
  storyProgressPending: { opacity: 0 },
  copy: { alignItems: "center", paddingHorizontal: 4, paddingTop: 2 },
  chapterLabel: {
    marginBottom: 7,
    color: Finn.primary,
    fontFamily: JournalType.bold,
    fontSize: 10,
    letterSpacing: 2.2,
    textAlign: "center",
  },
  title: {
    maxWidth: 420,
    color: Finn.ink,
    fontFamily: JournalType.black,
    fontSize: 37,
    lineHeight: 39,
    letterSpacing: -1.15,
    textAlign: "center",
  },
  subtitle: {
    maxWidth: 390,
    marginTop: 9,
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  stage: {
    width: "100%",
    maxWidth: 430,
    minHeight: 390,
    alignSelf: "center",
    position: "relative",
    marginTop: 6,
  },
  scene: { flex: 1, minHeight: 390, position: "relative" },
  storyThread: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  liquidBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
  },
  liquidBlob: {
    position: "absolute",
    borderRadius: 999,
  },
  liquidBlobOne: {
    width: 310,
    height: 230,
    top: 152,
    right: -168,
    backgroundColor: "#DDF8E8",
    opacity: 0.58,
  },
  liquidBlobTwo: {
    width: 255,
    height: 330,
    left: -162,
    bottom: 42,
    backgroundColor: "#F9E6DD",
    opacity: 0.56,
  },
  liquidBlobMuted: { opacity: 0.25 },
  liquidHalo: {
    position: "absolute",
    width: 370,
    height: 370,
    right: -192,
    bottom: -108,
    borderRadius: 190,
    borderWidth: 42,
    borderColor: Finn.primarySoft,
  },
  characterAnchor: { position: "absolute" },
  characterViewport: { overflow: "hidden" },
  expenseAnchor: { position: "absolute" },
  expenseBubble: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Finn.line,
    backgroundColor: Finn.surface,
    ...Finn.shadow,
  },
  cloudExpenseBubble: { position: "absolute" },
  expenseIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Finn.primarySoft,
  },
  expenseLabel: {
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 12,
    lineHeight: 14,
  },
  expenseAmount: {
    marginTop: 1,
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 14,
    lineHeight: 16,
  },
  lifeCharacter: { left: "14%", bottom: 0 },
  lifeBubbleOne: { left: 0, top: 38 },
  lifeBubbleTwo: { right: 0, top: 72 },
  lifeBubbleThree: { right: 4, bottom: 28 },
  overwhelmCharacter: { left: "14%", bottom: -4 },
  overwhelmBubbleOne: { left: 0, top: 26 },
  overwhelmBubbleTwo: { right: 0, top: 22 },
  overwhelmBubbleThree: { left: 0, bottom: 24 },
  overwhelmBubbleFour: { right: 0, bottom: 18 },
  overwhelmMark: {
    position: "absolute",
    right: "8%",
    top: 128,
    color: Finn.primary,
    fontFamily: JournalType.black,
    fontSize: 30,
  },
  cloudContainer: {
    position: "absolute",
    inset: 0,
  },
  blurredExpenseCloud: {
    flex: 1,
    opacity: 0.3,
    filter: [{ blur: 3 }],
  },
  forgottenOne: { left: 8, top: 26 },
  forgottenTwo: { right: 6, top: 16 },
  forgottenThree: { left: 22, top: 136 },
  forgottenFour: { right: 16, top: 130 },
  thoughtBubble: {
    position: "absolute",
    zIndex: 2,
    top: 54,
    left: "18%",
    right: "18%",
    minHeight: 74,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Finn.ink,
    backgroundColor: Finn.surface,
  },
  thoughtText: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 18,
    lineHeight: 23,
    textAlign: "center",
  },
  forgottenCharacter: { left: "18%", bottom: -4 },
  noteCharacter: { right: 0, top: 4 },
  paperCard: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 10,
    minHeight: 190,
    paddingHorizontal: 30,
    paddingVertical: 30,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#DED5CC",
    backgroundColor: "#FFFDF8",
    overflow: "hidden",
    ...Finn.shadow,
  },
  paperBinding: {
    position: "absolute",
    left: 12,
    top: 18,
    bottom: 18,
    width: 4,
    borderRadius: 2,
    backgroundColor: Finn.primary,
    opacity: 0.5,
  },
  paperText: {
    color: Finn.ink,
    fontFamily: JournalType.regular,
    fontSize: 23,
    lineHeight: 34,
  },
  paperLine: { flexDirection: "row", alignItems: "center" },
  paperCaret: {
    width: 2,
    height: 25,
    marginLeft: 3,
    borderRadius: 1,
    backgroundColor: Finn.primary,
  },
  paperUnderline: {
    width: "72%",
    height: 4,
    marginTop: 16,
    borderRadius: 2,
    backgroundColor: Finn.primary,
    transformOrigin: "left center",
  },
  originalNoteChip: {
    position: "absolute",
    top: 18,
    left: 12,
    right: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: Finn.line,
    backgroundColor: Finn.wash,
  },
  originalNoteText: {
    color: Finn.ink,
    fontFamily: JournalType.regular,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  organizedFlow: {
    position: "absolute",
    top: 78,
    alignSelf: "center",
    alignItems: "center",
  },
  organizedFlowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Finn.primary,
  },
  organizedFlowLine: {
    width: 2,
    height: 10,
    marginTop: 1,
    borderRadius: 1,
    backgroundColor: Finn.primary,
  },
  organizedArrow: {
    color: Finn.primary,
    fontFamily: JournalType.black,
    fontSize: 20,
    lineHeight: 18,
  },
  resultCard: {
    position: "absolute",
    top: 118,
    left: 12,
    right: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Finn.line,
    backgroundColor: Finn.surface,
    ...Finn.shadow,
  },
  resultRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 10 },
  resultIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Finn.primarySoft,
  },
  resultLabel: {
    flex: 1,
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 14,
  },
  resultAmount: { color: Finn.ink, fontFamily: JournalType.bold, fontSize: 16 },
  resultDivider: { height: 1, backgroundColor: Finn.line },
  totalRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalLabel: { color: Finn.ink, fontFamily: JournalType.bold, fontSize: 18 },
  totalAmount: { color: Finn.ink, fontFamily: JournalType.black, fontSize: 25 },
  organizedCharacter: { left: 2, bottom: -10 },
  journalCharacter: { left: -28, bottom: -8 },
  timeline: { position: "absolute", left: "37%", right: 0, top: 18, bottom: 8 },
  timelineLine: {
    position: "absolute",
    left: 7,
    top: 24,
    bottom: 30,
    width: 2,
    backgroundColor: Finn.primary,
    transformOrigin: "top center",
  },
  timelineRow: { flex: 1, flexDirection: "row", alignItems: "center" },
  timelineDot: {
    zIndex: 1,
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: Finn.canvas,
    backgroundColor: Finn.primary,
  },
  timelineCard: {
    flex: 1,
    minHeight: 76,
    marginLeft: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: Finn.line,
    backgroundColor: Finn.surface,
  },
  timelineIcon: {
    width: 29,
    height: 29,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Finn.primarySoft,
  },
  timelineCopy: { flex: 1 },
  timelineLabel: {
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 11,
    lineHeight: 14,
  },
  timelineDetail: {
    marginTop: 2,
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 9,
    lineHeight: 11,
  },
  timelineAmount: { color: Finn.ink, fontFamily: JournalType.bold, fontSize: 13 },
  searchCard: {
    position: "absolute",
    left: 6,
    right: 6,
    top: 22,
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 15,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: Finn.line,
    backgroundColor: Finn.surface,
    overflow: "hidden",
    ...Finn.shadow,
  },
  searchSweep: {
    position: "absolute",
    top: -22,
    bottom: -22,
    width: 42,
    backgroundColor: Finn.primarySoft,
    transform: [{ rotate: "14deg" }],
  },
  searchText: {
    flex: 1,
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  answerAnchor: {
    position: "absolute",
    top: 112,
    left: "22%",
    right: 0,
  },
  answerCard: {
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Finn.line,
    backgroundColor: Finn.surface,
  },
  answerAmount: {
    color: Finn.ink,
    fontFamily: JournalType.black,
    fontSize: 44,
    lineHeight: 49,
    textAlign: "center",
    letterSpacing: -1.2,
  },
  answerSource: {
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 11,
    textAlign: "center",
  },
  sourceRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  sourceChip: {
    flex: 1,
    paddingHorizontal: 9,
    paddingVertical: 9,
    borderRadius: 13,
    backgroundColor: Finn.wash,
  },
  sourceLabel: { color: Finn.secondary, fontFamily: JournalType.medium, fontSize: 9 },
  sourceAmount: { marginTop: 3, color: Finn.ink, fontFamily: JournalType.bold, fontSize: 13 },
  askCharacter: { left: -20, bottom: -8 },
  handoffCharacter: { left: "12%", bottom: -6 },
  orbit: {
    position: "absolute",
    width: 284,
    height: 284,
    left: "14%",
    top: 45,
  },
  orbitRingOuter: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 142,
    borderWidth: 1,
    borderColor: "#BCEFD2",
  },
  orbitRingInner: {
    position: "absolute",
    left: 30,
    right: 30,
    top: 30,
    bottom: 30,
    borderRadius: 112,
    borderWidth: 1,
    borderColor: "#D5F5E3",
  },
  orbitSpark: {
    position: "absolute",
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Finn.primary,
  },
  orbitSparkOne: { left: 18, top: 48 },
  orbitSparkTwo: { right: 2, top: 138, width: 6, height: 6 },
  orbitSparkThree: { left: 74, bottom: -3, width: 5, height: 5 },
  handoffPill: {
    position: "absolute",
    left: "20%",
    right: "20%",
    bottom: 8,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#CDEEDC",
    backgroundColor: Finn.primarySoft,
  },
  handoffDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Finn.primary },
  handoffText: { color: Finn.ink, fontFamily: JournalType.bold, fontSize: 14 },
});
