import * as Haptics from "expo-haptics";
import { type Href, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
  FadeOutRight,
  ReduceMotion,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Icon } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import {
  onboardingSteps,
  progressStepIds,
} from "@/features/onboarding/data/onboarding-steps";
import {
  completeOnboarding,
  restoreOnboarding,
  saveOnboardingProgress,
} from "@/features/onboarding/services/onboarding-service";
import type {
  EducationStep,
  OnboardingAnswers,
  OnboardingOption,
  QuestionStep,
} from "@/features/onboarding/types/onboarding.types";
import { useJournal } from "@/providers/app-providers";
import { useSession } from "@/features/auth/providers/session-provider";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export default function OnboardingScreen() {
  const { updateSettings } = useJournal();
  const { session, setOnboardingComplete } = useSession();
  const reduceMotion = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [direction, setDirection] = useState<1 | -1>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void restoreOnboarding()
      .then((snapshot) => {
        if (!active) return;
        if (snapshot.completedAt) {
          router.replace("/" as Href);
          return;
        }
        setStepIndex(snapshot.stepIndex);
        setAnswers(snapshot.answers);
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        setError("Finn could not restore your setup. You can still start again.");
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const currentStep = onboardingSteps[stepIndex] ?? onboardingSteps[0];
  const selected =
    currentStep.kind === "question"
      ? answers[currentStep.questionId]
      : undefined;

  const goBack = useCallback(() => {
    if (stepIndex === 0 || saving) return;
    setError(null);
    setDirection(-1);
    const nextIndex = stepIndex - 1;
    setStepIndex(nextIndex);
    void saveOnboardingProgress(nextIndex, answers).catch(() => undefined);
  }, [answers, saving, stepIndex]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (stepIndex === 0) return false;
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack, stepIndex]);

  const goForward = async () => {
    if (saving) return;
    if (currentStep.kind === "question" && !selected) {
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Warning,
      );
      setError("Choose one option to continue.");
      return;
    }

    setSaving(true);
    setError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const isLast = stepIndex === onboardingSteps.length - 1;
      if (isLast) {
        await completeOnboarding(answers);
        if (answers.currency) updateSettings({ currency: answers.currency });
        setOnboardingComplete(true);
        router.replace((session ? "/" : "/sign-in") as Href);
        return;
      }

      const nextIndex = stepIndex + 1;
      await saveOnboardingProgress(nextIndex, answers);
      setDirection(1);
      setStepIndex(nextIndex);
    } catch {
      setError("Finn could not save that yet. Please try once more.");
    } finally {
      setSaving(false);
    }
  };

  const chooseOption = (questionId: QuestionStep["questionId"], id: string) => {
    setError(null);
    setAnswers((current) => ({ ...current, [questionId]: id }));
    void Haptics.selectionAsync();
  };

  const transition = useMemo(() => {
    if (reduceMotion) {
      return {
        entering: FadeIn.duration(150),
        exiting: FadeOut.duration(120),
      };
    }
    return direction === 1
      ? {
          entering: FadeInRight.duration(320).easing(EASE_OUT),
          exiting: FadeOutLeft.duration(220).easing(EASE_OUT),
        }
      : {
          entering: FadeInLeft.duration(320).easing(EASE_OUT),
          exiting: FadeOutRight.duration(220).easing(EASE_OUT),
        };
  }, [direction, reduceMotion]);

  if (!ready) return <View style={styles.loadingCanvas} />;

  const progressIndex = progressStepIds.indexOf(currentStep.id);
  const showChrome = currentStep.kind !== "welcome";

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Animated.View
        key={currentStep.id}
        entering={transition.entering}
        exiting={transition.exiting}
        style={StyleSheet.absoluteFill}
      >
        <SafeAreaView style={styles.safeArea}>
          {currentStep.kind === "welcome" ? (
            <WelcomeStep />
          ) : currentStep.kind === "question" ? (
            <QuestionContent
              step={currentStep}
              selected={selected}
              onSelect={(id) => chooseOption(currentStep.questionId, id)}
            />
          ) : (
            <EducationContent step={currentStep} goal={answers.goal} />
          )}
        </SafeAreaView>
      </Animated.View>

      {showChrome ? (
        <SafeAreaView pointerEvents="box-none" style={styles.chromeOverlay}>
          <ProgressDots activeIndex={progressIndex} />
          <View style={styles.chromeSpacer} />
          <Footer
            showBack={stepIndex > 0}
            label={
              currentStep.kind === "education"
                ? currentStep.continueLabel
                : "Continue"
            }
            disabled={saving || (currentStep.kind === "question" && !selected)}
            onBack={goBack}
            onContinue={goForward}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </SafeAreaView>
      ) : (
        <SafeAreaView edges={["bottom"]} style={styles.welcomeFooter}>
          <PrimaryButton
            label={currentStep.continueLabel}
            disabled={saving}
            onPress={goForward}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </SafeAreaView>
      )}
    </View>
  );
}

function WelcomeStep() {
  return (
    <ScrollView
      contentContainerStyle={styles.welcomeContent}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeIn.duration(260)} style={styles.brandPill}>
        <View style={styles.brandMark}>
          <Icon name="wallet" size={18} color={Finn.primary} animation={false} />
        </View>
        <Text style={styles.brandText}>FINN</Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(360)
          .delay(50)
          .easing(EASE_OUT)
          .reduceMotion(ReduceMotion.System)}
        style={styles.welcomePreview}
      >
        <View style={styles.previewTopRow}>
          <Text style={styles.previewDate}>Today</Text>
          <View style={styles.previewStatus}>
            <View style={styles.previewStatusDot} />
            <Text style={styles.previewStatusText}>Organized</Text>
          </View>
        </View>
        <Text style={styles.previewNote}>
          lunch with friends 640 and uber home 220
        </Text>
        <View style={styles.previewDivider} />
        <PreviewResult icon="food" label="Food & drinks" amount="₹640" />
        <PreviewResult icon="car" label="Transport" amount="₹220" />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(360)
          .delay(120)
          .easing(EASE_OUT)
          .reduceMotion(ReduceMotion.System)}
        style={styles.welcomeCopy}
      >
        <Text style={styles.welcomeTitle}>Your money,{"\n"}made simple.</Text>
        <Text style={styles.welcomeSubtitle}>
          Like Notes, but it remembers the numbers.
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

function PreviewResult({
  icon,
  label,
  amount,
}: {
  icon: "food" | "car";
  label: string;
  amount: string;
}) {
  return (
    <View style={styles.previewResult}>
      <View style={styles.previewResultIcon}>
        <Icon name={icon} size={16} color={Finn.primary} animation={false} />
      </View>
      <Text style={styles.previewResultLabel}>{label}</Text>
      <Text style={styles.previewResultAmount}>{amount}</Text>
    </View>
  );
}

function QuestionContent({
  step,
  selected,
  onSelect,
}: {
  step: QuestionStep;
  selected?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <View style={styles.questionCopy}>
        <Text style={styles.eyebrow}>{step.eyebrow}</Text>
        <Text style={styles.questionTitle}>{step.title}</Text>
        <Text style={styles.questionSubtitle}>{step.subtitle}</Text>
      </View>
      <ScrollView
        style={styles.optionsScroll}
        contentContainerStyle={styles.optionsContent}
        showsVerticalScrollIndicator={false}
      >
        {step.options.map((option, index) => (
          <Animated.View
            key={option.id}
            entering={FadeInDown.duration(260)
              .delay(35 + index * 45)
              .easing(EASE_OUT)
              .reduceMotion(ReduceMotion.System)}
          >
            <OptionRow
              option={option}
              selected={selected === option.id}
              onPress={() => onSelect(option.id)}
            />
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

function OptionRow({
  option,
  selected,
  onPress,
}: {
  option: OnboardingOption;
  selected: boolean;
  onPress: () => void;
}) {
  const progress = useSharedValue(selected ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    progress.set(
      withTiming(selected ? 1 : 0, {
        duration: 180,
        easing: EASE_OUT,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [progress, selected]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.get(),
      [0, 1],
      [Finn.surface, Finn.primarySoft],
    ),
    borderColor: interpolateColor(
      progress.get(),
      [0, 1],
      [Finn.line, Finn.primary],
    ),
    transform: [{ scale: scale.get() }],
  }));

  const indicatorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.get(),
      [0, 1],
      [Finn.surface, Finn.primary],
    ),
    borderColor: interpolateColor(
      progress.get(),
      [0, 1],
      ["#D9D2CE", Finn.primary],
    ),
  }));

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${option.label}. ${option.description}`}
      onPress={onPress}
      onPressIn={() =>
        scale.set(
          withTiming(0.982, {
            duration: 90,
            reduceMotion: ReduceMotion.System,
          }),
        )
      }
      onPressOut={() =>
        scale.set(
          withSpring(1, {
            duration: 400,
            dampingRatio: 1,
            reduceMotion: ReduceMotion.System,
          }),
        )
      }
      pressRetentionOffset={16}
    >
      <Animated.View style={[styles.optionRow, animatedStyle]}>
        <View style={styles.optionIcon}>
          <Icon
            name={option.icon}
            size={21}
            color={selected ? Finn.primary : Finn.secondary}
            animation={false}
          />
        </View>
        <View style={styles.optionCopy}>
          <Text style={styles.optionLabel}>{option.label}</Text>
          {selected ? (
            <Animated.Text
              entering={FadeIn.duration(150)}
              style={styles.optionDescription}
            >
              {option.description}
            </Animated.Text>
          ) : null}
        </View>
        <Animated.View style={[styles.optionIndicator, indicatorStyle]}>
          {selected ? (
            <Animated.View entering={FadeIn.duration(120)}>
              <Icon name="check" size={14} color="#FFFFFF" animation={false} />
            </Animated.View>
          ) : null}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

function EducationContent({
  step,
  goal,
}: {
  step: EducationStep;
  goal?: string;
}) {
  const tailoredLine =
    goal === "patterns"
      ? "The pattern is calculated from your entries—not guessed by AI."
      : goal === "context"
        ? "Finn keeps the people, places and reasons beside the numbers."
        : goal === "effortless"
          ? "One sentence is enough. Structure happens quietly afterward."
          : "The original note stays with every organized entry.";

  return (
    <ScrollView
      contentContainerStyle={styles.educationContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.educationCopy}>
        <Text style={styles.eyebrow}>{step.eyebrow}</Text>
        <Text style={styles.educationTitle}>{step.title}</Text>
        <Text style={styles.educationSubtitle}>{step.subtitle}</Text>
      </View>

      {step.variant === "capture" ? (
        <View style={styles.educationCard}>
          <View style={styles.educationCardHeader}>
            <View style={styles.miniMark}>
              <Icon name="note" size={18} color={Finn.primary} animation={false} />
            </View>
            <Text style={styles.educationCardLabel}>A note becomes memory</Text>
          </View>
          <View style={styles.noteBubble}>
            <Text style={styles.noteBubbleText}>
              Lunch with Aswin 340 and Uber back home 280
            </Text>
          </View>
          <View style={styles.understoodLabelRow}>
            <Icon name="sparkle" size={15} color={Finn.primary} animation={false} />
            <Text style={styles.understoodLabel}>FINN UNDERSTOOD</Text>
          </View>
          <PreviewResult icon="food" label="Food & drinks" amount="₹340" />
          <PreviewResult icon="car" label="Transport" amount="₹280" />
          <Text style={styles.tailoredLine}>{tailoredLine}</Text>
        </View>
      ) : (
        <View style={styles.educationCard}>
          <View style={styles.searchPrompt}>
            <Icon name="search" size={19} color={Finn.secondary} animation={false} />
            <Text style={styles.searchPromptText}>
              How much did I spend eating out this month?
            </Text>
          </View>
          <View style={styles.answerBlock}>
            <Text style={styles.answerEyebrow}>THIS MONTH · FOOD & DRINKS</Text>
            <Text style={styles.answerAmount}>₹6,240</Text>
            <Text style={styles.answerDetail}>
              14 entries · exact source notes attached
            </Text>
          </View>
          <View style={styles.trustRow}>
            <Icon name="bookmark" size={17} color={Finn.primary} animation={false} />
            <Text style={styles.trustText}>
              Your notes stay yours. Totals come from structured records.
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function ProgressDots({ activeIndex }: { activeIndex: number }) {
  return (
    <View
      style={styles.progressRow}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 1,
        max: progressStepIds.length,
        now: Math.max(1, activeIndex + 1),
      }}
    >
      {progressStepIds.map((id, index) => (
        <View
          key={id}
          style={[
            styles.progressDot,
            index === activeIndex && styles.progressDotActive,
            index < activeIndex && styles.progressDotComplete,
          ]}
        />
      ))}
    </View>
  );
}

function Footer({
  showBack,
  label,
  disabled,
  onBack,
  onContinue,
}: {
  showBack: boolean;
  label: string;
  disabled: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <View style={styles.footer}>
      {showBack ? (
        <BackButton onPress={onBack} />
      ) : (
        <View style={styles.backSpacer} />
      )}
      <View style={styles.primaryButtonGrow}>
        <PrimaryButton label={label} disabled={disabled} onPress={onContinue} />
      </View>
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <ScalePressable
      accessibilityLabel="Go back"
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <View style={styles.backButton}>
        <Icon name="back" size={21} color={Finn.ink} animation={false} />
      </View>
    </ScalePressable>
  );
}

function PrimaryButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <ScalePressable
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
    >
      <View
        style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
      >
        <Text style={styles.primaryButtonText}>{label}</Text>
        <Icon name="chevron" size={18} color="#FFFFFF" animation={false} />
      </View>
    </ScalePressable>
  );
}

function ScalePressable({
  children,
  accessibilityLabel,
  disabled = false,
  onPress,
}: PropsWithChildren<{
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
}>) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() =>
        scale.set(
          withTiming(0.972, {
            duration: 100,
            reduceMotion: ReduceMotion.System,
          }),
        )
      }
      onPressOut={() =>
        scale.set(
          withSpring(1, {
            duration: 400,
            dampingRatio: 1,
            reduceMotion: ReduceMotion.System,
          }),
        )
      }
      pressRetentionOffset={16}
    >
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Finn.canvas, overflow: "hidden" },
  loadingCanvas: { flex: 1, backgroundColor: Finn.canvas },
  safeArea: { flex: 1, backgroundColor: Finn.canvas },
  welcomeContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 126,
    justifyContent: "center",
  },
  brandPill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 20,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: Finn.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 14,
    letterSpacing: 2.4,
  },
  welcomePreview: {
    width: "100%",
    maxWidth: 390,
    alignSelf: "center",
    backgroundColor: Finn.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Finn.line,
    padding: 20,
    ...Finn.shadow,
  },
  previewTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  previewDate: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 15,
  },
  previewStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Finn.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  previewStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Finn.primary,
  },
  previewStatusText: {
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 11,
  },
  previewNote: {
    color: Finn.ink,
    fontFamily: JournalType.regular,
    fontSize: 19,
    lineHeight: 27,
  },
  previewDivider: { height: 1, backgroundColor: Finn.line, marginVertical: 18 },
  previewResult: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewResultIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Finn.primarySoft,
  },
  previewResultLabel: {
    flex: 1,
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 14,
  },
  previewResultAmount: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 14,
  },
  welcomeCopy: { alignItems: "center", marginTop: 26, paddingHorizontal: 8 },
  welcomeTitle: {
    maxWidth: 430,
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 42,
    lineHeight: 45,
    letterSpacing: -1.4,
    textAlign: "center",
  },
  welcomeSubtitle: {
    marginTop: 10,
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 17,
    lineHeight: 24,
    textAlign: "center",
  },
  welcomeFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: Finn.canvas,
  },
  chromeOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 5,
    pointerEvents: "box-none",
  },
  progressRow: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  progressDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#D9D1CC",
  },
  progressDotActive: { width: 20, backgroundColor: Finn.primary },
  progressDotComplete: { backgroundColor: "#8ADAAF" },
  chromeSpacer: { flex: 1 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: Finn.canvas,
  },
  backSpacer: { width: 54 },
  backButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Finn.surface,
    borderWidth: 1,
    borderColor: Finn.line,
  },
  primaryButtonGrow: { flex: 1 },
  primaryButton: {
    minHeight: 56,
    borderRadius: 28,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: Finn.primary,
    boxShadow: "0px 8px 18px rgba(32, 200, 120, 0.22)",
  },
  primaryButtonDisabled: { opacity: 0.36 },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: JournalType.bold,
    fontSize: 17,
  },
  errorText: {
    color: Finn.danger,
    fontFamily: JournalType.medium,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    paddingHorizontal: 28,
    paddingBottom: 5,
    backgroundColor: Finn.canvas,
  },
  stepContent: { flex: 1, paddingTop: 42, paddingBottom: 82 },
  questionCopy: { paddingHorizontal: 24, paddingTop: 16 },
  eyebrow: {
    color: Finn.primary,
    fontFamily: JournalType.bold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.25,
    marginBottom: 9,
  },
  questionTitle: {
    maxWidth: 450,
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 31,
    lineHeight: 36,
    letterSpacing: -0.8,
  },
  questionSubtitle: {
    maxWidth: 450,
    marginTop: 8,
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  optionsScroll: { flex: 1, marginTop: 12 },
  optionsContent: {
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 18,
    gap: 9,
  },
  optionRow: {
    minHeight: 67,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderRadius: 18,
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Finn.wash,
  },
  optionCopy: { flex: 1, gap: 3 },
  optionLabel: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 17,
    lineHeight: 22,
  },
  optionDescription: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  optionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  educationContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 62,
    paddingBottom: 104,
    justifyContent: "center",
  },
  educationCopy: { marginBottom: 24 },
  educationTitle: {
    maxWidth: 460,
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 33,
    lineHeight: 38,
    letterSpacing: -0.9,
  },
  educationSubtitle: {
    maxWidth: 460,
    marginTop: 9,
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  educationCard: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    padding: 20,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: Finn.line,
    backgroundColor: Finn.surface,
    ...Finn.shadow,
  },
  educationCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  miniMark: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: Finn.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  educationCardLabel: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 15,
  },
  noteBubble: {
    padding: 15,
    borderRadius: 17,
    backgroundColor: Finn.wash,
  },
  noteBubbleText: {
    color: Finn.ink,
    fontFamily: JournalType.regular,
    fontSize: 17,
    lineHeight: 24,
  },
  understoodLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 18,
    marginBottom: 5,
  },
  understoodLabel: {
    color: Finn.primary,
    fontFamily: JournalType.bold,
    fontSize: 10,
    letterSpacing: 1.05,
  },
  tailoredLine: {
    marginTop: 13,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: Finn.line,
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  searchPrompt: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 18,
    backgroundColor: Finn.wash,
  },
  searchPromptText: {
    flex: 1,
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 16,
    lineHeight: 22,
  },
  answerBlock: { paddingVertical: 23, alignItems: "center" },
  answerEyebrow: {
    color: Finn.secondary,
    fontFamily: JournalType.bold,
    fontSize: 10,
    letterSpacing: 0.9,
  },
  answerAmount: {
    marginTop: 6,
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 38,
    letterSpacing: -1,
  },
  answerDetail: {
    marginTop: 4,
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 13,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Finn.line,
  },
  trustText: {
    flex: 1,
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 13,
    lineHeight: 19,
  },
});
