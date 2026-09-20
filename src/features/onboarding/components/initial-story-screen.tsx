import { Icon, type IconName } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import type {
  InitialStoryStep,
  InitialStoryVariant,
} from "@/features/onboarding/types/onboarding.types";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  ReduceMotion,
} from "react-native-reanimated";

const CHARACTER_ATLAS = require("@/assets/images/onboarding/initial-story-character-atlas.png");
const ATLAS_COLUMNS = 4;
const ATLAS_ROWS = 2;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

const reveal = (delay = 0) =>
  FadeInDown.duration(320)
    .delay(delay)
    .easing(EASE_OUT)
    .reduceMotion(ReduceMotion.System);

export function InitialStoryScreen({
  step,
  onBack,
}: {
  step: InitialStoryStep;
  onBack?: () => void;
}) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <StoryTopBar onBack={onBack} />
      <Animated.View entering={reveal(20)} style={styles.copy}>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.subtitle}>{step.subtitle}</Text>
      </Animated.View>
      <StoryVisual variant={step.variant} />
    </ScrollView>
  );
}

function StoryTopBar({ onBack }: { onBack?: () => void }) {
  return (
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
        <View style={styles.brandDot} />
        <Text style={styles.brandText}>FINN</Text>
      </View>
      <View style={styles.topBarSpacer} />
    </View>
  );
}

function StoryVisual({ variant }: { variant: InitialStoryVariant }) {
  switch (variant) {
    case "life":
      return <LifeVisual />;
    case "overwhelm":
      return <OverwhelmVisual />;
    case "forgotten":
      return <ForgottenVisual />;
    case "natural-note":
      return <NaturalNoteVisual />;
    case "organized":
      return <OrganizedVisual />;
    case "journal":
      return <JournalVisual />;
    case "ask":
      return <AskVisual />;
    case "handoff":
      return <HandoffVisual />;
  }
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
      style={[styles.characterViewport, { width: size, height: size }, style]}
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
    <Animated.View entering={reveal(delay)} style={[styles.expenseBubble, style]}>
      <View style={styles.expenseIcon}>
        <Icon name={icon} size={15} color={Finn.ink} animation={false} />
      </View>
      <View>
        <Text style={styles.expenseLabel}>{label}</Text>
        <Text style={styles.expenseAmount}>{amount}</Text>
      </View>
    </Animated.View>
  );
}

function LifeVisual() {
  return (
    <View style={styles.stage}>
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
    <View style={styles.stage}>
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
      <Animated.Text entering={FadeIn.delay(360).duration(180)} style={styles.overwhelmMark}>
        !
      </Animated.Text>
    </View>
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
    <View style={styles.stage}>
      <Animated.View
        entering={FadeIn.duration(500).easing(EASE_OUT)}
        pointerEvents="none"
        style={styles.cloudContainer}
      >
        <View style={styles.blurredExpenseCloud}>
          {forgottenExpenses.map((item) => (
            <View key={item.label} style={[styles.expenseBubble, item.style]}>
              <View style={styles.expenseIcon}>
                <Icon name={item.icon} size={15} color={Finn.ink} animation={false} />
              </View>
              <View>
                <Text style={styles.expenseLabel}>{item.label}</Text>
                <Text style={styles.expenseAmount}>{item.amount}</Text>
              </View>
            </View>
          ))}
        </View>
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
    <View style={styles.stage}>
      <CharacterPose frame={3} size={210} style={styles.noteCharacter} />
      <Animated.View entering={reveal(160)} style={styles.paperCard}>
        <View style={styles.paperBinding} />
        <Text style={styles.paperText}>Lunch with Sam $34</Text>
        <Animated.Text
          entering={FadeInRight.duration(300)
            .delay(340)
            .easing(EASE_OUT)
            .reduceMotion(ReduceMotion.System)}
          style={styles.paperText}
        >
          and Uber home $28
        </Animated.Text>
        <Animated.View entering={FadeIn.delay(560).duration(160)} style={styles.paperUnderline} />
      </Animated.View>
    </View>
  );
}

function OrganizedVisual() {
  return (
    <View style={styles.stage}>
      <Animated.View entering={reveal(80)} style={styles.originalNoteChip}>
        <Text style={styles.originalNoteText}>
          Lunch with Sam $34 and Uber home $28
        </Text>
      </Animated.View>
      <Animated.Text entering={FadeIn.delay(220)} style={styles.organizedArrow}>
        ↓
      </Animated.Text>
      <Animated.View entering={reveal(280)} style={styles.resultCard}>
        <ResultRow icon="food" label="Lunch with Sam" amount="$34" />
        <View style={styles.resultDivider} />
        <ResultRow icon="car" label="Uber home" amount="$28" />
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

function ResultRow({
  icon,
  label,
  amount,
}: {
  icon: IconName;
  label: string;
  amount: string;
}) {
  return (
    <View style={styles.resultRow}>
      <View style={styles.resultIcon}>
        <Icon name={icon} size={17} color={Finn.ink} animation={false} />
      </View>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultAmount}>{amount}</Text>
    </View>
  );
}

const journalRows = [
  { icon: "note" as const, label: "Coffee before class", amount: "$6", detail: "Quick reset" },
  { icon: "food" as const, label: "Dinner with Sam and Maya", amount: "$82", detail: "Great catch-up" },
  { icon: "bag" as const, label: "Domain for my project", amount: "$12", detail: "Small step, big idea" },
];

function JournalVisual() {
  return (
    <View style={styles.stage}>
      <CharacterPose frame={5} size={220} style={styles.journalCharacter} />
      <View style={styles.timeline}>
        <Animated.View entering={FadeIn.duration(320)} style={styles.timelineLine} />
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

function AskVisual() {
  return (
    <View style={styles.stage}>
      <Animated.View entering={reveal(80)} style={styles.searchCard}>
        <Icon name="search" size={19} color={Finn.ink} animation={false} />
        <Text style={styles.searchText}>What did I spend eating out this month?</Text>
      </Animated.View>
      <Animated.View entering={reveal(280)} style={styles.answerCard}>
        <Text style={styles.answerAmount}>$468</Text>
        <Text style={styles.answerSource}>Based on 12 journal notes</Text>
        <View style={styles.sourceRow}>
          <SourceChip label="Lunch with Sam" amount="$34" />
          <SourceChip label="Dinner with Maya" amount="$82" />
        </View>
      </Animated.View>
      <CharacterPose frame={6} size={164} delay={380} style={styles.askCharacter} />
    </View>
  );
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
    <View style={styles.stage}>
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

const styles = StyleSheet.create({
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
  copy: { alignItems: "center", paddingHorizontal: 4, paddingTop: 4 },
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
  characterViewport: { position: "absolute", overflow: "hidden" },
  expenseBubble: {
    position: "absolute",
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
  paperUnderline: {
    width: "72%",
    height: 4,
    marginTop: 16,
    borderRadius: 2,
    backgroundColor: Finn.primary,
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
  organizedArrow: {
    position: "absolute",
    top: 80,
    alignSelf: "center",
    color: Finn.primary,
    fontFamily: JournalType.black,
    fontSize: 28,
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
    ...Finn.shadow,
  },
  searchText: {
    flex: 1,
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  answerCard: {
    position: "absolute",
    top: 112,
    left: "22%",
    right: 0,
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
