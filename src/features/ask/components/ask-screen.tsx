import { useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { router, useIsFocused } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoadingState } from "@/components/common/loading-state";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ContentFade, MotionLayout } from "@/components/ui/motion";
import { Finn, JournalType } from "@/constants/theme";
import type { SearchPlan } from "@/lib/supabase/database.types";
import { useJournal } from "@/providers/app-providers";
import { useSearch } from "../hooks/use-search";
import {
  compactPeriodLabel,
  monthRange,
} from "../services/search-format";
import type { ActiveContext, SearchItem } from "../types/ask.types";
import { AskDateRangePopover } from "./ask-date-range-popover";
import { AskMoneyAmount, SourceTransactionRow } from "./source-entry-list";

const suggestions = [
  "Spending this month",
  "Food spending",
  "Most expensive purchase",
  "Who owes me?",
];

const finnPaperwork = require("../../../../assets/images/character/header/finn-paperwork.png");
const finnLaptop = require("../../../../assets/images/character/header/finn-laptop.png");

function MoneyBagIcon({ size = 43 }: { size?: number }) {
  return (
    <Svg
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      height={size}
      viewBox="0 0 48 48"
      width={size}
    >
      <Path
        d="M17 6h14l-3.2 7.1c5.6 3.1 10.2 9.6 10.2 17.2C38 38.4 32.2 43 24 43S10 38.4 10 30.3c0-7.6 4.6-14.1 10.2-17.2L17 6Zm3.9 8.6h6.2M24 19v17m5-13.1c-1.2-1.1-2.9-1.7-5-1.7-2.8 0-4.8 1.4-4.8 3.5 0 5 9.6 2.1 9.6 7 0 2.1-2 3.6-4.8 3.6-2.2 0-4.1-.7-5.4-2"
        fill="none"
        stroke={Finn.ink}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.6}
      />
    </Svg>
  );
}

function AskHero() {
  return (
    <View style={styles.hero}>
      <Text accessibilityRole="header" style={styles.accessibleHeading}>
        Ask Finn about your money.
      </Text>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.heroLine}>
        <Text style={styles.heroTitle}>Ask</Text>
        <Image contentFit="contain" source={finnPaperwork} style={styles.finnArtwork} />
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.heroLine}>
        <Text style={styles.heroTitle}>about your</Text>
        <MoneyBagIcon />
      </View>
    </View>
  );
}

function answerLabelFor(plan?: SearchPlan) {
  switch (plan?.metric) {
    case "group_total": return "The group total was";
    case "gross_spend": return "The full transaction cost was";
    case "paid_by_user": return "You paid";
    case "owed_to_user": return "Owed to you";
    case "user_owes": return "You owe";
    case "reimbursed": return "Reimbursed";
  }
  if (plan?.direction === "expense") return "You spent";
  if (plan?.direction === "income") return "You received";
  return "Recorded money";
}

function finnThinkingLabel(message: string) {
  const copy = message.trim();
  return `Finn thinks that ${copy}${/[.!?]$/.test(copy) ? "" : "."}`;
}

export default function SearchScreen() {
  const { selectedDate, today } = useJournal();
  const screenActive = useIsFocused();
  const listRef = useRef<FlatList<SearchItem>>(null);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [range, setRange] = useState(() => monthRange(selectedDate));
  const [rangeOpen, setRangeOpen] = useState(false);
  const search = useSearch();
  const result = search.result;
  const plan = result?.applied_filters;
  const advanced = result?.advanced_answer;
  const totals = result?.totals ?? [];
  const reviewCount = totals.reduce((sum, total) => sum + Number(total.review_count), 0);
  const confirmedCount = totals.reduce((sum, total) => sum + Number(total.confirmed_count), 0);

  const submit = (value = query) => {
    if (!value.trim()) return;
    Keyboard.dismiss();
    setQuery(value);
    setSubmitted(value);
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ animated: false, offset: 0 }));
    void search.run({ query: value.trim(), range });
  };
  const applyFilters = (filters: SearchPlan) => {
    Keyboard.dismiss();
    void search.run({ filters });
  };
  const changeRange = (next: typeof range) => {
    setRange(next);
    if (plan) applyFilters({ ...plan, ...next });
    else if (advanced && submitted) void search.run({ query: submitted, range: next });
    else {
      search.reset();
      setSubmitted("");
    }
  };
  const openContext = (context: ActiveContext) => {
    if (!search.contexts) return;
    const label = `${context.name} spending`;
    setQuery(label);
    setSubmitted(label);
    Keyboard.dismiss();
    applyFilters({
      operation: "sum",
      direction: "expense",
      start_date: search.contexts.start_date,
      end_date: search.contexts.end_date,
      context: context.name,
      person: null,
      merchant_id: null,
      category_id: null,
      currency: null,
      text: null,
    });
  };
  const clear = () => {
    setQuery("");
    setSubmitted("");
    search.reset();
  };
  const activeRange = advanced
    ? { start_date: advanced.start_date, end_date: advanced.end_date }
    : plan
      ? { start_date: plan.start_date, end_date: plan.end_date }
      : range;
  const answerRows = advanced?.rows.map((row, index) => {
    const money = row.value_minor != null && row.currency
      ? { minor: row.value_minor, currency: row.currency }
      : null;
    const value = money
      ? null
      : row.value_date
        ? new Date(`${row.value_date}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
        : row.value_count != null
          ? String(row.value_count)
          : row.label ?? "—";
    return {
      key: `${index}-${row.currency ?? row.label ?? ""}`,
      money,
      value,
      caption: [
        row.label,
        row.value_date && row.value_minor != null ? row.value_date : null,
        row.currency && advanced.rows.length > 1 ? row.currency : null,
      ].filter(Boolean).join(" · "),
    };
  }) ?? totals.filter((total) => total.confirmed_count > 0).map((total) => ({
    key: total.currency,
    money: { minor: total.total_minor, currency: total.currency },
    value: null,
    caption: totals.length > 1 ? total.currency : "",
  }));
  const fallbackExplanation = advanced
    ? result?.matching_count === 0
      ? "No matching transactions were found for this question and period."
      : `This answer uses ${result?.matching_count ?? 0} matching journal transaction${result?.matching_count === 1 ? "" : "s"} from the selected period.`
    : result?.matching_count === 0
      ? "No matching transactions were found. Try another period or adjust the filters."
      : `The answer uses ${confirmedCount} confirmed transaction${confirmedCount === 1 ? "" : "s"}${reviewCount ? `; ${reviewCount} unconfirmed amount${reviewCount === 1 ? " is" : "s are"} excluded from the total` : ""}.`;
  const showLanding = !submitted && !result && !search.loading && !search.error;
  const showRecommendations = showLanding && !query.trim();
  const explanation = result?.explanation ?? fallbackExplanation;

  return (
    <Screen journal>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <IconButton
            label="Back to journal"
            name="back"
            onPress={() => router.back()}
            style={styles.backButton}
          />
          <Button
            accessibilityState={{ expanded: rangeOpen }}
            label="Change search period"
            onPress={() => {
              Keyboard.dismiss();
              setRangeOpen(true);
            }}
            style={styles.rangeTrigger}
          >
            <Text style={styles.rangeTriggerText}>
              {compactPeriodLabel(activeRange.start_date, activeRange.end_date, today)}
            </Text>
            <Icon name="down" size={12} color={Finn.secondary} />
          </Button>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.safe}>
          <FlatList
            ref={listRef}
            contentContainerStyle={[styles.content, showLanding && styles.landingContent]}
            data={search.loading ? [] : result?.transactions ?? []}
            initialNumToRender={6}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.id}
            maxToRenderPerBatch={6}
            renderItem={({ item }) => <SourceTransactionRow item={item} />}
            windowSize={7}
            ListHeaderComponent={
              <MotionLayout>
                {showLanding ? (
                  <AskHero />
                ) : submitted ? (
                  <View style={styles.resultHero}>
                    <Text accessibilityRole="header" style={styles.resultQuestion}>{submitted}</Text>
                  </View>
                ) : null}
                {search.loading ? (
                  <LoadingState active={screenActive} label="Matching entries and calculating totals…" variant="results" />
                ) : null}
                {search.error ? (
                  <View style={styles.card}>
                    <Text accessibilityRole="alert" style={styles.body}>{search.error}</Text>
                    <Button label="Retry search" onPress={search.retry} style={styles.inlineAction}>
                      <Text style={styles.action}>Try again</Text>
                    </Button>
                  </View>
                ) : null}
                {result?.needs_filters ? (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Let’s narrow it down.</Text>
                    <Text style={styles.body}>Try a more specific question or period, such as “Uber this month”.</Text>
                    <Text style={styles.small}>No total is shown until the question is clear.</Text>
                  </View>
                ) : null}
                {!search.loading && (plan || advanced) ? (
                  <ContentFade>
                    <View accessibilityLiveRegion="polite" style={styles.answer}>
                      {result?.stale ? (
                        <>
                          <Text style={styles.answerTitle}>Your journal has changed.</Text>
                          <Text style={styles.body}>Refresh to see an answer and entries that agree.</Text>
                          <Button
                            label="Refresh search results"
                            onPress={() => plan ? applyFilters(plan) : void search.run({ query: submitted, range })}
                            style={styles.inlineAction}
                          >
                            <Text style={styles.action}>Refresh answer</Text>
                          </Button>
                        </>
                      ) : (
                        <>
                          {answerRows.length ? answerRows.map((row) => (
                            <View key={row.key} style={styles.answerRow}>
                              {row.money ? (
                                <AskMoneyAmount
                                  currency={row.money.currency}
                                  minor={row.money.minor}
                                  style={styles.answerAmount}
                                />
                              ) : (
                                <Text style={styles.answerAmount}>{row.value}</Text>
                              )}
                              {row.caption ? <Text style={styles.answerCaption}>{row.caption}</Text> : null}
                            </View>
                          )) : (
                            <Text style={styles.answerAmount}>{result?.matching_count === 0 ? "No matches" : "Needs review"}</Text>
                          )}
                          <Text style={styles.answerTitle}>{advanced?.label ?? answerLabelFor(plan)}</Text>
                        </>
                      )}
                    </View>
                    {!result?.stale ? (
                      search.loadingExplanation && !result?.explanation ? (
                        <LoadingState active={screenActive} label="Finn is adding context…" variant="explanation" />
                      ) : (
                        <View style={styles.explanation}>
                          <Text style={styles.accessibleCopy}>{finnThinkingLabel(explanation)}</Text>
                          <View
                            accessibilityElementsHidden
                            importantForAccessibility="no-hide-descendants"
                            style={styles.thinkingRow}
                          >
                            <Image contentFit="contain" source={finnLaptop} style={styles.thinkingFinn} />
                            <Text style={styles.thinkingText}>thinks that “{explanation}”</Text>
                          </View>
                        </View>
                      )
                    ) : null}
                    {result?.matching_count ? (
                      <View style={styles.sectionHeading}>
                        <Text style={styles.sectionTitle}>Transactions behind this answer</Text>
                        <Text style={styles.small}>{result.transactions?.length ?? 0} of {result.matching_count}</Text>
                      </View>
                    ) : null}
                  </ContentFade>
                ) : null}
              </MotionLayout>
            }
            ListFooterComponent={
              !search.loading && (plan || advanced) ? (
                <View style={styles.footer}>
                  {search.pageError ? <Text accessibilityRole="alert" style={styles.errorText}>{search.pageError}</Text> : null}
                  {search.loadingMore ? (
                    <LoadingState active={screenActive} label="Loading more matching transactions…" variant="transactions" />
                  ) : result?.has_more && !result.stale ? (
                    <Button label="Show more matching items" onPress={() => void search.more()} style={styles.showMore}>
                      <Text style={styles.action}>Show more</Text>
                      <Icon name="down" size={13} color={Finn.ink} />
                    </Button>
                  ) : null}
                  {result?.transactions?.length ? (
                    <Text style={styles.footnote}>
                      {result.stale
                        ? "Refresh to reload these entries."
                        : result.has_more
                          ? "Five transactions at a time. The answer above includes all matches."
                          : "All matching items shown."}
                    </Text>
                  ) : null}
                </View>
              ) : null
            }
          />

          <View style={styles.composerArea}>
            {showRecommendations ? (
              <ScrollView
                contentContainerStyle={styles.recommendations}
                horizontal
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
              >
                {suggestions.map((suggestion) => (
                  <Button key={suggestion} label={suggestion} onPress={() => submit(suggestion)} style={styles.suggestionChip}>
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </Button>
                ))}
                {search.contexts?.contexts.slice(0, 2).map((context) => (
                  <Button
                    key={context.id}
                    label={`Ask about ${context.name}`}
                    onPress={() => openContext(context)}
                    style={styles.suggestionChip}
                  >
                    <Text style={styles.suggestionText}>{context.name}</Text>
                  </Button>
                ))}
              </ScrollView>
            ) : null}
            <View style={styles.searchBox}>
              <TextInput
                accessibilityLabel="Ask Finn about your journal"
                autoCorrect={false}
                maxLength={500}
                onChangeText={setQuery}
                onSubmitEditing={() => submit()}
                placeholder="Ask Finn about your money…"
                placeholderTextColor={Finn.muted}
                returnKeyType="search"
                style={styles.input}
                value={query}
              />
              {query ? (
                <Button label="Clear search" onPress={clear} style={styles.clear}>
                  <Icon name="close" size={14} color={Finn.secondary} />
                </Button>
              ) : null}
              <Button disabled={!query.trim() || search.loading} label="Ask Finn" onPress={() => submit()} style={styles.submit}>
                <Icon name="send" size={20} color={Finn.surface} />
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>

        <AskDateRangePopover
          currentDay={today}
          onApply={(next) => {
            setRangeOpen(false);
            changeRange(next);
          }}
          onDismiss={() => setRangeOpen(false)}
          range={activeRange}
          visible={rangeOpen}
        />
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 6,
  },
  backButton: { borderWidth: StyleSheet.hairlineWidth, borderColor: Finn.line },
  rangeTrigger: { minHeight: 44, flexDirection: "row", gap: 5, paddingHorizontal: 4 },
  rangeTriggerText: { fontFamily: JournalType.medium, fontSize: 14, color: Finn.ink },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24 },
  landingContent: { flexGrow: 1 },
  hero: { paddingTop: 48, paddingBottom: 24, gap: 1 },
  accessibleHeading: {
    position: "absolute",
    width: 1,
    height: 1,
    color: "transparent",
    fontSize: 1,
    lineHeight: 1,
  },
  heroLine: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 58 },
  heroTitle: { fontFamily: JournalType.regular, fontSize: 43, lineHeight: 49, letterSpacing: -1.8, color: Finn.ink },
  finnArtwork: { width: 137, height: 64, marginTop: -4 },
  resultHero: { paddingTop: 26, paddingBottom: 20 },
  resultQuestion: { fontFamily: JournalType.regular, fontSize: 31, lineHeight: 36, letterSpacing: -1.1, color: Finn.ink },
  composerArea: { paddingHorizontal: 18, paddingTop: 9, paddingBottom: 6, backgroundColor: Finn.canvas },
  recommendations: { gap: 8, paddingRight: 18, paddingBottom: 10 },
  suggestionChip: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: Finn.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Finn.line,
  },
  suggestionText: { fontFamily: JournalType.medium, fontSize: 13, color: Finn.ink },
  searchBox: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 18,
    paddingRight: 8,
    borderRadius: 30,
    backgroundColor: Finn.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Finn.line,
    ...Finn.shadow,
  },
  input: { flex: 1, minWidth: 0, paddingVertical: 17, color: Finn.ink, fontFamily: JournalType.regular, fontSize: 16 },
  clear: { width: 28, minHeight: 44 },
  submit: { width: 46, height: 46, minHeight: 46, borderRadius: 23, backgroundColor: Finn.ink },
  sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 14, marginBottom: 14 },
  sectionTitle: { fontFamily: JournalType.medium, fontSize: 18, letterSpacing: -0.3, color: Finn.ink },
  small: { fontFamily: JournalType.regular, fontSize: 12, lineHeight: 18, color: Finn.secondary },
  body: { fontFamily: JournalType.regular, fontSize: 15, lineHeight: 23, color: Finn.secondary },
  card: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: Finn.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Finn.line,
    gap: 12,
    marginBottom: 12,
  },
  inlineAction: { alignSelf: "flex-start", minHeight: 40 },
  action: { fontFamily: JournalType.medium, fontSize: 14, color: Finn.ink },
  answer: {
    minHeight: 150,
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 26,
    marginBottom: 12,
    borderRadius: 28,
    backgroundColor: Finn.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Finn.line,
    ...Finn.shadow,
  },
  answerRow: { alignItems: "center", marginBottom: 8 },
  answerTitle: { marginTop: 4, color: Finn.secondary, fontFamily: JournalType.medium, fontSize: 15, lineHeight: 22, letterSpacing: -0.5, textAlign: "center" },
  answerAmount: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 36,
    lineHeight: 46,
    letterSpacing: -1.2,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  answerCaption: { color: Finn.secondary, fontFamily: JournalType.medium, fontSize: 12, lineHeight: 18, textAlign: "center" },
  explanation: {
    position: "relative",
    marginVertical: 8,
    marginBottom: 18,
  },
  accessibleCopy: { position: "absolute", width: 1, height: 1, color: "transparent", fontSize: 1, lineHeight: 1 },
  thinkingRow: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 12 },
  thinkingFinn: { width: 48, height: 51, flexShrink: 0 },
  thinkingText: { flex: 1, color: Finn.secondary, fontFamily: JournalType.regular, fontSize: 15, lineHeight: 22 },
  footer: { paddingVertical: 8, gap: 10 },
  showMore: {
    flexDirection: "row",
    gap: 10,
    minHeight: 48,
    borderRadius: 22,
    backgroundColor: Finn.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Finn.line,
  },
  footnote: { marginTop: 22, color: Finn.muted, fontFamily: JournalType.regular, fontSize: 11, lineHeight: 18, textAlign: "center" },
  errorText: { color: Finn.danger, fontFamily: JournalType.regular, fontSize: 13, lineHeight: 20 },
});
