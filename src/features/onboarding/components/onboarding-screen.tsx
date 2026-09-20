import { LoadingState } from "@/components/common/loading-state";
import { ContentFade } from "@/components/ui/motion";
import { CharSpriteAnim } from "@/components/character/char-sprite-anim";
import { InitialStoryScreen } from "@/features/onboarding/components/initial-story-screen";
import * as Haptics from "expo-haptics";
import { type Href, router, useIsFocused } from "expo-router";
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
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
  FadeOutRight,
  ReduceMotion,
  interpolate,
  interpolateColor,
  type SharedValue,
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
  skipOnboardingForExistingAccount,
} from "@/features/onboarding/services/onboarding-service";
import type {
  ConversationStep,
  EducationStep,
  OnboardingAnswers,
  OnboardingOption,
  QuestionStep,
} from "@/features/onboarding/types/onboarding.types";
import { useJournal } from "@/providers/app-providers";
import { useSession } from "@/features/auth/providers/session-provider";
import { currencySymbol } from "@/utils/currency";
import {
  getCurrency,
  searchCurrencies,
  type CurrencyDefinition,
} from "../../../../supabase/functions/_shared/currencies.ts";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const QUICK_CURRENCY_CODES = new Set(["USD", "EUR", "CAD", "INR"]);

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
  const [currencySearchOpen, setCurrencySearchOpen] = useState(false);

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
    if (currencySearchOpen && currentStep.kind === "question" && currentStep.questionId === "currency") {
      Keyboard.dismiss();
      setCurrencySearchOpen(false);
      return;
    }
    if (stepIndex === 0 || saving) return;
    setError(null);
    setDirection(-1);
    const nextIndex = stepIndex - 1;
    setStepIndex(nextIndex);
    void saveOnboardingProgress(nextIndex, answers).catch(() => undefined);
  }, [answers, currencySearchOpen, currentStep, saving, stepIndex]);

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
        if (answers.currency) {
          await updateSettings({ currency: answers.currency });
        }
        await completeOnboarding(answers);
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

  const goToSignIn = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await skipOnboardingForExistingAccount();
      setOnboardingComplete(true);
      router.replace((session ? "/" : "/sign-in") as Href);
    } catch {
      setError("Finn could not save that yet. Please try once more.");
    } finally {
      setSaving(false);
    }
  };

  const chooseOption = (questionId: QuestionStep["questionId"], id: string) => {
    setError(null);
    const nextAnswers = { ...answers, [questionId]: id };
    setAnswers(nextAnswers);
    void saveOnboardingProgress(stepIndex, nextAnswers).catch(() => {
      setError("Finn could not save that choice yet. Please try once more.");
    });
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

  if (!ready) return <LoadingState variant="onboarding" label="Getting Finn ready…" />;

  const progressIndex = progressStepIds.indexOf(currentStep.id);
  const showQuestionChrome =
    currentStep.kind === "question" || currentStep.kind === "education";
  const showStoryFooter = currentStep.kind === "story";
  const isQuestionStep = currentStep.kind === "question";

  return (
    <ContentFade
      style={[styles.root, isQuestionStep && styles.questionCanvas]}
    >
      <StatusBar style="dark" />
      <Animated.View
        key={currentStep.id}
        entering={transition.entering}
        exiting={transition.exiting}
        style={[StyleSheet.absoluteFill, isQuestionStep && styles.questionCanvas]}
      >
        <SafeAreaView
          style={[styles.safeArea, isQuestionStep && styles.questionCanvas]}
        >
          {currentStep.kind === "story" ? (
            <InitialStoryScreen
              step={currentStep}
              onBack={stepIndex > 0 ? goBack : undefined}
            />
          ) : currentStep.kind === "welcome" ? (
            <WelcomeStep />
          ) : currentStep.kind === "conversation" ? (
            <ConversationContent
              step={currentStep}
              saving={saving}
              error={error}
              onBack={goBack}
              onContinue={goForward}
            />
          ) : currentStep.kind === "question" ? (
            <QuestionContent
              step={currentStep}
              selected={selected}
              currencySearchOpen={currencySearchOpen}
              onCurrencySearchChange={setCurrencySearchOpen}
              onSelect={(id) => {
                chooseOption(currentStep.questionId, id);
                if (currentStep.questionId === "currency") {
                  Keyboard.dismiss();
                  setCurrencySearchOpen(false);
                }
              }}
            />
          ) : (
            <EducationContent step={currentStep} goal={answers.desiredOutcome} />
          )}
        </SafeAreaView>
      </Animated.View>

      {showQuestionChrome ? (
        <SafeAreaView pointerEvents="box-none" style={styles.chromeOverlay}>
          <QuestionHeader
            activeIndex={progressIndex}
            showBack={stepIndex > 0}
            onBack={goBack}
          />
          <View style={styles.chromeSpacer} />
          <Footer
            label={
              currentStep.kind === "education"
                ? currentStep.continueLabel
                : "Continue"
            }
            disabled={
              saving ||
              currencySearchOpen ||
              (currentStep.kind === "question" && !selected)
            }
            onContinue={goForward}
            error={error}
            whiteBackground={isQuestionStep}
          />
        </SafeAreaView>
      ) : showStoryFooter ? (
        <SafeAreaView edges={["bottom"]} style={styles.welcomeFooter}>
          <PrimaryButton
            label={currentStep.continueLabel}
            disabled={saving}
            onPress={goForward}
          />
          {stepIndex === 0 ? (
            <ScalePressable
              accessibilityLabel="Already have an account? Sign in"
              disabled={saving}
              onPress={goToSignIn}
            >
              <Text style={styles.existingAccountText}>
                Already have an account?{" "}
                <Text style={styles.existingAccountLink}>Sign in</Text>
              </Text>
            </ScalePressable>
          ) : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </SafeAreaView>
      ) : currentStep.kind === "conversation" ? null : (
        <SafeAreaView edges={["bottom"]} style={styles.welcomeFooter}>
          <PrimaryButton
            label={currentStep.continueLabel}
            disabled={saving}
            onPress={goForward}
          />
          <ScalePressable
            accessibilityLabel="Already have an account? Sign in"
            disabled={saving}
            onPress={goToSignIn}
          >
            <Text style={styles.existingAccountText}>
              Already have an account?{" "}
              <Text style={styles.existingAccountLink}>Sign in</Text>
            </Text>
          </ScalePressable>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </SafeAreaView>
      )}
    </ContentFade>
  );
}

function ConversationContent({
  step,
  saving,
  error,
  onBack,
  onContinue,
}: {
  step: ConversationStep;
  saving: boolean;
  error: string | null;
  onBack: () => void;
  onContinue: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [readyToContinue, setReadyToContinue] = useState(reduceMotion);
  const activeLine = useSharedValue(reduceMotion ? step.lines.length - 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      activeLine.set(step.lines.length - 1);
      setReadyToContinue(true);
      return;
    }

    activeLine.set(0);
    setReadyToContinue(false);
    const secondLineTimeout = setTimeout(() => {
      activeLine.set(withTiming(1, { duration: 520, easing: EASE_OUT }));
    }, 1250);
    const thirdLineTimeout = setTimeout(() => {
      activeLine.set(withTiming(2, { duration: 520, easing: EASE_OUT }));
    }, 2500);
    const continueTimeout = setTimeout(() => setReadyToContinue(true), 3200);

    return () => {
      clearTimeout(secondLineTimeout);
      clearTimeout(thirdLineTimeout);
      clearTimeout(continueTimeout);
    };
  }, [activeLine, reduceMotion, step.lines.length]);

  return (
    <View style={styles.conversationContent}>
      <View style={styles.conversationBack}>
        <BackButton onPress={onBack} />
      </View>

      <View style={styles.conversationCopy}>
        {reduceMotion ? (
          <View style={styles.conversationStaticCopy}>
            {step.lines.map((line, index) => (
              <Text
                key={line}
                style={[
                  styles.conversationLine,
                  index === step.lines.length - 1 && styles.conversationFinalLine,
                ]}
              >
                {line}
              </Text>
            ))}
          </View>
        ) : (
          step.lines.map((line, index) => (
            <ConversationLine
              key={line}
              line={line}
              index={index}
              activeLine={activeLine}
            />
          ))
        )}
      </View>

      <Animated.View
        entering={
          reduceMotion
            ? undefined
            : FadeIn.duration(260).delay(3100).easing(EASE_OUT)
        }
        style={styles.conversationFooter}
      >
        <PrimaryButton
          label={step.continueLabel}
          disabled={saving || !readyToContinue}
          onPress={onContinue}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </Animated.View>
    </View>
  );
}

function ConversationLine({
  line,
  index,
  activeLine,
}: {
  line: string;
  index: number;
  activeLine: SharedValue<number>;
}) {
  const frameStyle = useAnimatedStyle(() => {
    const distance = Math.abs(index - activeLine.get());
    return {
      opacity: interpolate(
        distance,
        [0, 1, 2],
        [1, 0.38, 0.12],
        Extrapolation.CLAMP,
      ),
      transform: [
        { translateY: (index - activeLine.get()) * 108 },
        {
          scale: interpolate(
            distance,
            [0, 1],
            [1, 0.94],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      Math.min(Math.abs(index - activeLine.get()), 1),
      [0, 1],
      [Finn.ink, Finn.secondary],
    ),
  }));

  return (
    <Animated.View style={[styles.lyricLineFrame, frameStyle]}>
      <Animated.Text style={[styles.conversationLine, textStyle]}>
        {line}
      </Animated.Text>
    </Animated.View>
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
        <View style={styles.mockupPlaceholder}>
          <Text style={styles.mockupPlaceholderText}>APP MOCKUP</Text>
        </View>
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
  currencySearchOpen,
  onCurrencySearchChange,
  onSelect,
}: {
  step: QuestionStep;
  selected?: string;
  currencySearchOpen: boolean;
  onCurrencySearchChange: (open: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const focused = useIsFocused();

  if (step.questionId === "currency") {
    return (
      <CurrencyQuestionContent
        step={step}
        selected={selected}
        searchOpen={currencySearchOpen}
        active={focused}
        onSearchOpen={() => onCurrencySearchChange(true)}
        onSelect={onSelect}
      />
    );
  }

  return (
    <ScrollView
      style={styles.questionScroll}
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <CharSpriteAnim animType={step.animType} active={focused} size={180} />
      <View style={styles.questionCopy}>
        <Text style={styles.questionTitle}>{step.title}</Text>
        <Text style={styles.questionSubtitle}>{step.subtitle}</Text>
      </View>
      <View style={styles.optionsContent}>
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
      </View>
    </ScrollView>
  );
}

function CurrencyQuestionContent({
  step,
  selected,
  searchOpen,
  active,
  onSearchOpen,
  onSelect,
}: {
  step: QuestionStep;
  selected?: string;
  searchOpen: boolean;
  active: boolean;
  onSearchOpen: () => void;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const currencies = useMemo(() => searchCurrencies(query), [query]);
  const selectedCurrency = getCurrency(selected);

  useEffect(() => {
    if (!searchOpen) setQuery("");
  }, [searchOpen]);

  if (searchOpen) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.currencySearchFrame}
      >
        <FlatList
          data={currencies}
          keyExtractor={({ code }) => code}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          initialNumToRender={14}
          maxToRenderPerBatch={12}
          windowSize={7}
          style={styles.currencySearchList}
          contentContainerStyle={styles.currencySearchContent}
          ListHeaderComponent={
            <View style={styles.currencySearchHeader}>
              <View style={styles.currencySearchQuestionCopy}>
                <Text style={styles.questionTitle}>Choose your currency</Text>
                <Text style={styles.questionSubtitle}>
                  Search by currency name, ISO code, or country.
                </Text>
              </View>
              <View style={styles.currencySearchBox}>
                <Icon
                  name="search"
                  size={18}
                  color={Finn.muted}
                  animation={false}
                />
                <TextInput
                  accessibilityLabel="Search currencies"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                  placeholder="Try yen, JPY, or Japan"
                  placeholderTextColor={Finn.muted}
                  returnKeyType="search"
                  style={styles.currencySearchInput}
                  value={query}
                  onChangeText={setQuery}
                />
                {query ? (
                  <ScalePressable
                    accessibilityLabel="Clear currency search"
                    onPress={() => setQuery("")}
                  >
                    <View style={styles.currencySearchClear}>
                      <Icon
                        name="close"
                        size={14}
                        color={Finn.muted}
                        animation={false}
                      />
                    </View>
                  </ScalePressable>
                ) : null}
              </View>
            </View>
          }
          ListEmptyComponent={
            <Text accessibilityLiveRegion="polite" style={styles.currencyEmpty}>
              No currencies found.
            </Text>
          }
          ItemSeparatorComponent={() => <View style={styles.currencyResultGap} />}
          renderItem={({ item }) => (
            <CurrencyResultRow
              currency={item}
              selected={selected === item.code}
              onPress={() => onSelect(item.code)}
            />
          )}
        />
      </KeyboardAvoidingView>
    );
  }

  return (
    <ScrollView
      style={styles.questionScroll}
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <CharSpriteAnim animType={step.animType} active={active} size={180} />
      <View style={styles.questionCopy}>
        <Text style={styles.questionTitle}>{step.title}</Text>
        <Text style={styles.questionSubtitle}>{step.subtitle}</Text>
      </View>
      <View style={styles.optionsContent}>
        {step.options.map((option, index) => {
          const other = option.id === "other";
          const searchedCurrencySelected =
            other && !!selected && !QUICK_CURRENCY_CODES.has(selected);
          const visibleOption = searchedCurrencySelected && selectedCurrency
            ? {
                ...option,
                description: `${selectedCurrency.name} · ${selectedCurrency.code} · ${currencySymbol(selectedCurrency.code)}`,
              }
            : option;
          return (
            <Animated.View
              key={option.id}
              entering={FadeInDown.duration(260)
                .delay(35 + index * 45)
                .easing(EASE_OUT)
                .reduceMotion(ReduceMotion.System)}
            >
              <OptionRow
                option={visibleOption}
                selected={
                  other ? searchedCurrencySelected : selected === option.id
                }
                onPress={other ? onSearchOpen : () => onSelect(option.id)}
              />
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function CurrencyResultRow({
  currency,
  selected,
  onPress,
}: {
  currency: CurrencyDefinition;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <OptionRow
      option={{
        id: currency.code,
        label: currency.name,
        description: `${currency.code} · ${currencySymbol(currency.code)}`,
        icon: "wallet",
      }}
      selected={selected}
      onPress={onPress}
    />
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
    borderColor: interpolateColor(
      progress.get(),
      [0, 1],
      [Finn.line, Finn.primary],
    ),
    transform: [{ scale: scale.get() }],
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
            size={20}
            color={selected ? Finn.primary : Finn.secondary}
            animation={false}
          />
        </View>
        <View style={styles.optionCopy}>
          <Text style={styles.optionLabel}>{option.label}</Text>
          <Text style={styles.optionDescription}>{option.description}</Text>
        </View>
        {selected ? (
          <Animated.View
            entering={FadeIn.duration(120)}
            style={styles.optionIndicator}
          >
            <Icon name="check" size={10} color="#FFFFFF" animation={false} />
          </Animated.View>
        ) : (
          <View style={styles.optionIndicatorSpacer} />
        )}
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

function QuestionHeader({
  activeIndex,
  showBack,
  onBack,
}: {
  activeIndex: number;
  showBack: boolean;
  onBack: () => void;
}) {
  const current = Math.min(
    progressStepIds.length,
    Math.max(1, activeIndex + 1),
  );
  const progressWidth = `${(current / progressStepIds.length) * 100}%` as const;

  return (
    <View style={styles.questionHeader}>
      {showBack ? <BackButton onPress={onBack} /> : <View style={styles.backSpacer} />}
      <View
        style={styles.progressTrack}
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 1,
          max: progressStepIds.length,
          now: current,
        }}
      >
        <View style={[styles.progressFill, { width: progressWidth }]} />
      </View>
    </View>
  );
}

function Footer({
  label,
  disabled,
  onContinue,
  error,
  whiteBackground = false,
}: {
  label: string;
  disabled: boolean;
  onContinue: () => void;
  error: string | null;
  whiteBackground?: boolean;
}) {
  return (
    <View style={[styles.footer, whiteBackground && styles.questionCanvas]}>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.primaryButtonGrow}>
        <PrimaryButton
          label={label}
          disabled={disabled}
          onPress={onContinue}
          compact
        />
      </View>
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <ScalePressable
      accessibilityLabel="Go back"
      hitSlop={6}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <View style={styles.backButton}>
        <Icon name="back" size={16} color={Finn.secondary} animation={false} />
      </View>
    </ScalePressable>
  );
}

function PrimaryButton({
  label,
  disabled,
  onPress,
  compact = false,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <ScalePressable
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
    >
      <View
        style={[
          styles.primaryButton,
          compact && styles.questionPrimaryButton,
          disabled && styles.primaryButtonDisabled,
        ]}
      >
        <Text
          style={[
            styles.primaryButtonText,
            compact && styles.questionPrimaryButtonText,
          ]}
        >
          {label}
        </Text>
        {!compact ? (
          <Icon name="chevron" size={18} color="#FFFFFF" animation={false} />
        ) : null}
      </View>
    </ScalePressable>
  );
}

function ScalePressable({
  children,
  accessibilityLabel,
  disabled = false,
  hitSlop,
  onPress,
}: PropsWithChildren<{
  accessibilityLabel: string;
  disabled?: boolean;
  hitSlop?: number;
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
      hitSlop={hitSlop}
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
  questionCanvas: { backgroundColor: "#FFFFFF" },
  conversationContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 14,
  },
  conversationBack: { alignSelf: "flex-start" },
  conversationCopy: {
    flex: 1,
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    overflow: "hidden",
  },
  conversationStaticCopy: { alignItems: "center", gap: 24 },
  conversationLine: {
    maxWidth: 390,
    color: Finn.secondary,
    fontFamily: JournalType.bold,
    fontSize: 29,
    lineHeight: 35,
    letterSpacing: -0.65,
    textAlign: "center",
  },
  lyricLineFrame: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  conversationFinalLine: { color: Finn.ink },
  conversationFooter: { width: "100%" },
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
    padding: 12,
    ...Finn.shadow,
  },
  mockupPlaceholder: {
    minHeight: 330,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Finn.line,
    backgroundColor: Finn.wash,
    alignItems: "center",
    justifyContent: "center",
  },
  mockupPlaceholderText: {
    color: Finn.muted,
    fontFamily: JournalType.medium,
    fontSize: 11,
    letterSpacing: 1.5,
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
  existingAccountText: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    paddingVertical: 4,
  },
  existingAccountLink: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
  },
  chromeOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 5,
    pointerEvents: "box-none",
  },
  questionHeader: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 10,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    overflow: "hidden",
    borderRadius: 2,
    backgroundColor: "#E4DEDA",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: Finn.ink,
  },
  chromeSpacer: { flex: 1 },
  footer: {
    alignItems: "stretch",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: Finn.canvas,
  },
  backSpacer: { width: 34, height: 34 },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Finn.surface,
    borderWidth: 1,
    borderColor: Finn.line,
    boxShadow: "0px 2px 8px rgba(104, 92, 84, 0.08)",
  },
  primaryButtonGrow: { width: "100%" },
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
  questionPrimaryButton: { width: "100%", minHeight: 54, borderRadius: 27 },
  primaryButtonDisabled: { opacity: 0.36 },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: JournalType.bold,
    fontSize: 17,
  },
  questionPrimaryButtonText: { fontSize: 15 },
  errorText: {
    color: Finn.danger,
    fontFamily: JournalType.medium,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  questionScroll: { flex: 1, marginTop: 54, marginBottom: 82 },
  currencySearchFrame: {
    flex: 1,
    marginTop: 54,
    marginBottom: 82,
  },
  currencySearchList: { flex: 1 },
  currencySearchContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
  },
  currencySearchHeader: { paddingBottom: 16 },
  currencySearchQuestionCopy: { paddingTop: 12 },
  currencySearchBox: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Finn.line,
    borderRadius: 18,
    backgroundColor: Finn.surface,
  },
  currencySearchInput: {
    flex: 1,
    minWidth: 0,
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 14,
  },
  currencySearchClear: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  currencyResultGap: { height: 10 },
  currencyEmpty: {
    paddingVertical: 30,
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 13,
    textAlign: "center",
  },
  stepContent: { flexGrow: 1, paddingTop: 6, paddingBottom: 20 },
  questionCopy: { paddingHorizontal: 24, paddingTop: 12 },
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
    fontFamily: JournalType.black,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.35,
  },
  questionSubtitle: {
    maxWidth: 450,
    marginTop: 6,
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  optionsContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 10,
  },
  optionRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 18,
    backgroundColor: Finn.surface,
  },
  optionIcon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  optionCopy: { flex: 1, gap: 2 },
  optionLabel: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 15,
    lineHeight: 18,
  },
  optionDescription: {
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  optionIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Finn.primary,
  },
  optionIndicatorSpacer: { width: 18, height: 18 },
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
