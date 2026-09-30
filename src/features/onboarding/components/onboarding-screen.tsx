import { LoadingState } from "@/components/common/loading-state";
import { CharSpriteAnim } from "@/components/character/char-sprite-anim";
import { Icon } from "@/components/ui/icon";
import { ContentFade } from "@/components/ui/motion";
import { Finn, JournalType } from "@/constants/theme";
import { InitialStoryScreen } from "@/features/onboarding/components/initial-story-screen";
import {
  ONBOARDING_CHAPTER_COUNT,
  onboardingSteps,
} from "@/features/onboarding/data/onboarding-steps";
import {
  completeOnboarding,
  restoreOnboarding,
  saveOnboardingProgress,
  skipOnboardingForExistingAccount,
} from "@/features/onboarding/services/onboarding-service";
import { sanitizeOnboardingName } from "@/features/onboarding/services/onboarding-validation";
import {
  FINN_ONBOARDING_FLOW_VERSION,
  type InviteStep,
  type OnboardingAnswers,
  type OnboardingOption,
  type QuestionStep,
} from "@/features/onboarding/types/onboarding.types";
import { useSession } from "@/features/auth/providers/session-provider";
import { ANALYTICS_EVENTS, captureAnalytics } from "@/lib/analytics/analytics";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { useJournalActions } from "@/providers/app-providers";
import { currencySymbol } from "@/utils/currency";
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
  cancelAnimation,
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
import {
  getCurrency,
  searchCurrencies,
  type CurrencyDefinition,
} from "../../../../supabase/functions/_shared/currencies.ts";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const QUICK_CURRENCY_CODES = new Set(["USD", "EUR", "CAD", "INR"]);

export default function OnboardingScreen() {
  const { updateSettings } = useJournalActions();
  const { session, setOnboardingComplete } = useSession();
  const reduceMotion = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [direction, setDirection] = useState<1 | -1>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currencySearchOpen, setCurrencySearchOpen] = useState(false);
  const [storyReady, setStoryReady] = useState(false);
  const [storyReadyDelay, setStoryReadyDelay] = useState(0);
  const [storyReadyCycle, setStoryReadyCycle] = useState(0);

  const handleStoryReadyChange = useCallback(
    (nextReady: boolean, delayMs: number) => {
      setStoryReady(nextReady);
      setStoryReadyDelay(delayMs);
      if (!nextReady) setStoryReadyCycle((cycle) => cycle + 1);
    },
    [],
  );

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
        captureAnalytics(ANALYTICS_EVENTS.onboardingStarted, {
          flow_version: FINN_ONBOARDING_FLOW_VERSION,
          resumed: snapshot.stepIndex > 0,
          starting_step_index: snapshot.stepIndex,
        });
      })
      .catch(() => {
        if (!active) return;
        setError(
          "Finn could not restore your setup. You can still start again.",
        );
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

  useEffect(() => {
    if (!ready) return;
    captureAnalytics(ANALYTICS_EVENTS.onboardingStepViewed, {
      flow_version: FINN_ONBOARDING_FLOW_VERSION,
      step_id: currentStep.id,
      step_kind: currentStep.kind,
      step_index: stepIndex,
      total_steps: onboardingSteps.length,
    });
  }, [currentStep.id, currentStep.kind, ready, stepIndex]);

  const goBack = useCallback(() => {
    if (
      currencySearchOpen &&
      currentStep.kind === "question" &&
      currentStep.questionId === "currency"
    ) {
      Keyboard.dismiss();
      setCurrencySearchOpen(false);
      return;
    }
    if (stepIndex === 0 || saving) return;
    Keyboard.dismiss();
    setError(null);
    setDirection(-1);
    const nextIndex = stepIndex - 1;
    if (onboardingSteps[nextIndex]?.kind === "story") setStoryReady(false);
    setStepIndex(nextIndex);
    void saveOnboardingProgress(nextIndex, answers).catch(() => undefined);
  }, [answers, currencySearchOpen, currentStep, saving, stepIndex]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (stepIndex === 0) return false;
        goBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [goBack, stepIndex]);

  const goForward = async () => {
    if (saving) return;

    let nextAnswers = answers;
    if (currentStep.kind === "question") {
      if (currentStep.responseType === "name") {
        const name = sanitizeOnboardingName(selected);
        if (!name) {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning,
          );
          setError("Tell Finn what you would like to be called.");
          return;
        }
        nextAnswers = { ...answers, name };
        setAnswers(nextAnswers);
      } else if (!selected) {
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        );
        setError("Choose one answer to continue.");
        return;
      }
    }

    setSaving(true);
    setError(null);
    Keyboard.dismiss();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const isLast = stepIndex === onboardingSteps.length - 1;
      if (isLast) {
        if (nextAnswers.currency) {
          await updateSettings({ currency: nextAnswers.currency });
        }
        await completeOnboarding(nextAnswers);
        captureAnalytics(ANALYTICS_EVENTS.onboardingCompleted, {
          flow_version: FINN_ONBOARDING_FLOW_VERSION,
          answered_questions: Object.keys(nextAnswers).length,
          total_questions: onboardingSteps.filter(
            (step) => step.kind === "question",
          ).length,
        });
        setOnboardingComplete(true);
        router.replace((session ? "/" : "/sign-in") as Href);
        return;
      }

      const nextIndex = stepIndex + 1;
      await saveOnboardingProgress(nextIndex, nextAnswers);
      captureAnalytics(ANALYTICS_EVENTS.onboardingStepCompleted, {
        flow_version: FINN_ONBOARDING_FLOW_VERSION,
        step_id: currentStep.id,
        step_kind: currentStep.kind,
        step_index: stepIndex,
      });
      setDirection(1);
      if (onboardingSteps[nextIndex]?.kind === "story") setStoryReady(false);
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
      captureAnalytics(ANALYTICS_EVENTS.onboardingSkipped, {
        flow_version: FINN_ONBOARDING_FLOW_VERSION,
        step_index: stepIndex,
      });
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
    captureAnalytics(ANALYTICS_EVENTS.onboardingOptionSelected, {
      flow_version: FINN_ONBOARDING_FLOW_VERSION,
      question_id: questionId,
      option_id: id,
      step_index: stepIndex,
      changed: answers[questionId] !== undefined && answers[questionId] !== id,
    });
    void saveOnboardingProgress(stepIndex, nextAnswers).catch(() => {
      setError("Finn could not save that choice yet. Please try once more.");
    });
    void Haptics.selectionAsync();
  };

  const updateName = (name: string) => {
    setError(null);
    setAnswers((current) => ({ ...current, name }));
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
          entering: FadeInRight.duration(300).easing(EASE_OUT),
          exiting: FadeOutLeft.duration(200).easing(EASE_OUT),
        }
      : {
          entering: FadeInLeft.duration(300).easing(EASE_OUT),
          exiting: FadeOutRight.duration(200).easing(EASE_OUT),
        };
  }, [direction, reduceMotion]);

  if (!ready) {
    return <LoadingState variant="onboarding" label="Getting Finn ready…" />;
  }

  const questionLike =
    currentStep.kind === "question" || currentStep.kind === "invite";
  const canContinueQuestion =
    currentStep.kind !== "question" ||
    (currentStep.responseType === "name"
      ? !!sanitizeOnboardingName(selected)
      : !!selected);

  return (
    <ContentFade style={[styles.root, questionLike && styles.questionCanvas]}>
      <StatusBar style="dark" />
      <Animated.View
        key={currentStep.id}
        entering={transition.entering}
        exiting={transition.exiting}
        style={[StyleSheet.absoluteFill, questionLike && styles.questionCanvas]}
      >
        <SafeAreaView
          style={[styles.safeArea, questionLike && styles.questionCanvas]}
        >
          {currentStep.kind === "story" ? (
            <InitialStoryScreen
              answers={answers}
              step={currentStep}
              onReadyChange={handleStoryReadyChange}
            />
          ) : currentStep.kind === "question" ? (
            <QuestionContent
              currencySearchOpen={currencySearchOpen}
              selected={selected}
              step={currentStep}
              onCurrencySearchChange={setCurrencySearchOpen}
              onNameChange={updateName}
              onSelect={(id) => {
                chooseOption(currentStep.questionId, id);
                if (currentStep.questionId === "currency") {
                  Keyboard.dismiss();
                  setCurrencySearchOpen(false);
                }
              }}
              onSubmitName={goForward}
            />
          ) : (
            <InviteContent step={currentStep} />
          )}
        </SafeAreaView>
      </Animated.View>

      <SafeAreaView pointerEvents="box-none" style={styles.chromeOverlay}>
        <ConversationHeader
          chapter={currentStep.chapter}
          showBack={stepIndex > 0}
          onBack={goBack}
        />
        <View style={styles.chromeSpacer} />
        {currentStep.kind === "story" ? (
          <StoryFooter
            buttonLabel={currentStep.continueLabel}
            error={error}
            progressKey={`${currentStep.id}:${storyReadyCycle}`}
            ready={storyReady}
            readyDelay={storyReadyDelay}
            saving={saving}
            showSignIn={stepIndex === 0}
            onContinue={goForward}
            onSignIn={goToSignIn}
          />
        ) : (
          <Footer
            disabled={saving || currencySearchOpen || !canContinueQuestion}
            error={error}
            label={
              currentStep.kind === "invite"
                ? currentStep.continueLabel
                : "Continue"
            }
            onContinue={goForward}
          />
        )}
      </SafeAreaView>
    </ContentFade>
  );
}

function QuestionContent({
  step,
  selected,
  currencySearchOpen,
  onCurrencySearchChange,
  onNameChange,
  onSelect,
  onSubmitName,
}: {
  step: QuestionStep;
  selected?: string;
  currencySearchOpen: boolean;
  onCurrencySearchChange: (open: boolean) => void;
  onNameChange: (name: string) => void;
  onSelect: (id: string) => void;
  onSubmitName: () => void;
}) {
  const focused = useIsFocused();

  if (step.responseType === "name") {
    return (
      <NameQuestionContent
        active={focused}
        step={step}
        value={selected ?? ""}
        onChange={onNameChange}
        onSubmit={onSubmitName}
      />
    );
  }

  if (step.responseType === "currency") {
    return (
      <CurrencyQuestionContent
        active={focused}
        searchOpen={currencySearchOpen}
        selected={selected}
        step={step}
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
      <QuestionCopy step={step} />
      <View style={styles.optionsContent}>
        {step.options.map((option, index) => (
          <Animated.View
            key={option.id}
            entering={FadeInDown.duration(230)
              .delay(30 + index * 35)
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

function NameQuestionContent({
  active,
  step,
  value,
  onChange,
  onSubmit,
}: {
  active: boolean;
  step: QuestionStep;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.nameFrame}
    >
      <ScrollView
        contentContainerStyle={styles.nameContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <CharSpriteAnim animType={step.animType} active={active} size={180} />
        <QuestionCopy step={step} centered />
        <View style={styles.nameInputShell}>
          <TextInput
            accessibilityLabel="Your name"
            autoCapitalize="words"
            autoCorrect={false}
            autoFocus
            maxLength={40}
            placeholder="Type your name"
            placeholderTextColor={Finn.muted}
            returnKeyType="done"
            style={styles.nameInput}
            value={value}
            onChangeText={onChange}
            onSubmitEditing={onSubmit}
          />
          {value ? (
            <Icon
              name="sparkle"
              size={20}
              color={Finn.primary}
              animation={false}
            />
          ) : null}
        </View>
        <Text style={styles.namePrivacy}>
          Used only to make Finn feel personal.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function QuestionCopy({
  step,
  centered = false,
}: {
  step: QuestionStep;
  centered?: boolean;
}) {
  return (
    <View
      style={[styles.questionCopy, centered && styles.questionCopyCentered]}
    >
      <Text style={[styles.questionTitle, centered && styles.centeredText]}>
        {step.title}
      </Text>
      <Text style={[styles.questionSubtitle, centered && styles.centeredText]}>
        {step.subtitle}
      </Text>
    </View>
  );
}

function CurrencyQuestionContent({
  active,
  step,
  selected,
  searchOpen,
  onSearchOpen,
  onSelect,
}: {
  active: boolean;
  step: QuestionStep;
  selected?: string;
  searchOpen: boolean;
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
          ItemSeparatorComponent={() => (
            <View style={styles.currencyResultGap} />
          )}
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
      <QuestionCopy step={step} />
      <View style={styles.optionsContent}>
        {step.options.map((option, index) => {
          const other = option.id === "other";
          const searchedCurrencySelected =
            other && !!selected && !QUICK_CURRENCY_CODES.has(selected);
          const visibleOption =
            searchedCurrencySelected && selectedCurrency
              ? {
                  ...option,
                  description: `${selectedCurrency.name} · ${selectedCurrency.code} · ${currencySymbol(selectedCurrency.code)}`,
                }
              : option;
          return (
            <Animated.View
              key={option.id}
              entering={FadeInDown.duration(230)
                .delay(30 + index * 35)
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
    backgroundColor: interpolateColor(
      progress.get(),
      [0, 1],
      [Finn.surface, Finn.primarySoft],
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

function InviteContent({ step }: { step: InviteStep }) {
  return (
    <View style={styles.inviteContent}>
      <Text style={styles.inviteTitle}>{step.title}</Text>
      <Text style={styles.inviteSubtitle}>{step.subtitle}</Text>
      <View style={styles.outcomeRow}>
        {[
          ["sparkle", "Calm"],
          ["note", "Context"],
          ["bookmark", "Memory"],
        ].map(([icon, label]) => (
          <View key={label} style={styles.outcomePill}>
            <Icon
              name={icon as OnboardingOption["icon"]}
              size={16}
              color={Finn.primary}
              animation={false}
            />
            <Text style={styles.outcomeLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ConversationHeader({
  chapter,
  showBack,
  onBack,
}: {
  chapter: number;
  showBack: boolean;
  onBack: () => void;
}) {
  const progressWidth =
    `${(chapter / ONBOARDING_CHAPTER_COUNT) * 100}%` as const;
  return (
    <View style={styles.questionHeader}>
      {showBack ? (
        <BackButton onPress={onBack} />
      ) : (
        <View style={styles.backSpacer} />
      )}
      <View style={styles.headerMiddle}>
        <View
          style={styles.progressTrack}
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 1,
            max: ONBOARDING_CHAPTER_COUNT,
            now: chapter,
          }}
        >
          <View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
      </View>
    </View>
  );
}

function StoryFooter({
  buttonLabel,
  error,
  progressKey,
  ready,
  readyDelay,
  saving,
  showSignIn,
  onContinue,
  onSignIn,
}: {
  buttonLabel: string;
  error: string | null;
  progressKey: string;
  ready: boolean;
  readyDelay: number;
  saving: boolean;
  showSignIn: boolean;
  onContinue: () => void;
  onSignIn: () => void;
}) {
  return (
    <View style={styles.storyFooter}>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <StoryProgressButton
        disabled={saving}
        durationMs={readyDelay}
        label={buttonLabel}
        progressKey={progressKey}
        ready={ready}
        onPress={onContinue}
      />
      {showSignIn ? (
        <ScalePressable
          accessibilityLabel="Already have an account? Sign in"
          disabled={saving}
          onPress={onSignIn}
        >
          <Text style={styles.existingAccountText}>
            Already have an account?{" "}
            <Text style={styles.existingAccountLink}>Sign in</Text>
          </Text>
        </ScalePressable>
      ) : null}
    </View>
  );
}

function StoryProgressButton({
  disabled,
  durationMs,
  label,
  progressKey,
  ready,
  onPress,
}: {
  disabled: boolean;
  durationMs: number;
  label: string;
  progressKey: string;
  ready: boolean;
  onPress: () => void;
}) {
  const reduced = useMotionPreference();
  const buttonWidth = useSharedValue(0);
  const fillProgress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(fillProgress);
    fillProgress.set(0);
    if (!reduced && durationMs > 0) {
      fillProgress.set(
        withTiming(1, {
          duration: durationMs,
          easing: Easing.linear,
        }),
      );
    }
  }, [durationMs, fillProgress, progressKey, reduced]);

  useEffect(() => {
    if (!ready) return;
    cancelAnimation(fillProgress);
    fillProgress.set(
      withTiming(1, {
        duration: 150,
        easing: EASE_OUT,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [fillProgress, ready]);

  const fillStyle = useAnimatedStyle(() => ({
    width: buttonWidth.get() * fillProgress.get(),
  }));

  return (
    <ScalePressable
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
    >
      <View
        style={styles.storyProgressButton}
        onLayout={(event) => buttonWidth.set(event.nativeEvent.layout.width)}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.storyProgressFill, fillStyle]}
        />
        <View pointerEvents="none" style={styles.storyProgressContent}>
          <Text style={styles.storyProgressText}>{label}</Text>
          <Icon name="chevron" size={18} color={Finn.ink} animation={false} />
        </View>
      </View>
    </ScalePressable>
  );
}

function Footer({
  label,
  disabled,
  onContinue,
  error,
}: {
  label: string;
  disabled: boolean;
  onContinue: () => void;
  error: string | null;
}) {
  return (
    <View style={styles.footer}>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <PrimaryButton
        label={label}
        disabled={disabled}
        onPress={onContinue}
        compact
      />
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
        <Text style={styles.primaryButtonText}>{label}</Text>
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
  safeArea: { flex: 1, backgroundColor: Finn.canvas },
  questionCanvas: { backgroundColor: "#FFFFFF" },
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
  headerMiddle: { flex: 1 },
  progressTrack: {
    width: "100%",
    height: 3,
    overflow: "hidden",
    borderRadius: 2,
    backgroundColor: "#E4DEDA",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: Finn.primary,
  },
  chromeSpacer: { flex: 1 },
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
  storyFooter: {
    alignItems: "stretch",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: Finn.canvas,
  },
  storyProgressButton: {
    minHeight: 56,
    overflow: "hidden",
    borderRadius: 28,
    backgroundColor: Finn.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(32, 200, 120, 0.24)",
  },
  storyProgressFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: Finn.primary,
  },
  storyProgressContent: {
    minHeight: 54,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  storyProgressText: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 16,
  },
  footer: {
    alignItems: "stretch",
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
  },
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
    fontSize: 16,
  },
  existingAccountText: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    paddingVertical: 4,
  },
  existingAccountLink: { color: Finn.ink, fontFamily: JournalType.bold },
  errorText: {
    color: Finn.danger,
    fontFamily: JournalType.medium,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  questionScroll: { flex: 1, marginTop: 54, marginBottom: 78 },
  stepContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingTop: 18,
    paddingBottom: 22,
  },
  questionCopy: { paddingHorizontal: 24, paddingBottom: 4 },
  questionCopyCentered: { alignItems: "center" },
  questionTitle: {
    maxWidth: 460,
    color: Finn.ink,
    fontFamily: JournalType.black,
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.65,
  },
  questionSubtitle: {
    maxWidth: 450,
    marginTop: 8,
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  centeredText: { textAlign: "center" },
  optionsContent: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 18,
    gap: 10,
  },
  optionRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderRadius: 19,
  },
  optionIcon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  optionCopy: { flex: 1, gap: 3 },
  optionLabel: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 15,
    lineHeight: 19,
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
  nameFrame: { flex: 1, marginTop: 54, marginBottom: 78 },
  nameContent: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 44,
    paddingBottom: 32,
  },
  nameInputShell: {
    width: "100%",
    maxWidth: 430,
    minHeight: 68,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 28,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: Finn.primary,
    borderRadius: 22,
    backgroundColor: Finn.primarySoft,
  },
  nameInput: {
    flex: 1,
    minWidth: 0,
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 23,
  },
  namePrivacy: {
    marginTop: 10,
    color: Finn.muted,
    fontFamily: JournalType.medium,
    fontSize: 11,
    textAlign: "center",
  },
  currencySearchFrame: { flex: 1, marginTop: 54, marginBottom: 78 },
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
  inviteContent: {
    flex: 1,
    maxWidth: 480,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingTop: 54,
    paddingBottom: 86,
  },
  inviteTitle: {
    color: Finn.ink,
    fontFamily: JournalType.black,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1.2,
    textAlign: "center",
  },
  inviteSubtitle: {
    marginTop: 16,
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
  },
  outcomeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 28,
  },
  outcomePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Finn.primarySoft,
  },
  outcomeLabel: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 12,
  },
});
