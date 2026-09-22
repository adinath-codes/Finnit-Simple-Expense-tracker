import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useIsFocused } from "expo-router";
import { LoadingState } from "@/components/common/loading-state";
import { ContentFade, Reveal, DisclosureChevron, MotionLayout } from "@/components/ui/motion";
import { SafeAreaView } from "react-native-safe-area-context";
import { Screen } from "@/components/common/screen";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Finn, JournalType } from "@/constants/theme";
import { useJournal } from "@/providers/app-providers";
import type { SearchPlan } from "@/lib/supabase/database.types";
import { useSearch } from "../hooks/use-search";
import {
  exactMoney,
  monthRange,
  offsetDay,
  periodLabel,
} from "../services/search-format";
import { SourceTransactionCard } from "./source-entry-list";
import type { ActiveContext } from "../types/ask.types";
import { date as validateDate } from "../../../../supabase/functions/_shared/validation";

const suggestions = [
  "How much did I spend on Uber this month?",
  "How much did I spend on food last week?",
  "Show my transport spending this month",
];

function answerLabelFor(plan?: SearchPlan) {
  switch (plan?.metric) {
    case "group_total":
      return "The group total was";
    case "gross_spend":
      return "The full transaction cost was";
    case "paid_by_user":
      return "You paid";
    case "owed_to_user":
      return "Owed to you";
    case "user_owes":
      return "You owe";
    case "reimbursed":
      return "Reimbursed";
  }
  if (plan?.direction === "expense") return "You spent";
  if (plan?.direction === "income") return "You received";
  return "Recorded money";
}

function metricLabelFor(plan?: SearchPlan) {
  switch (plan?.metric) {
    case "group_total":
      return "Group total";
    case "paid_by_user":
      return "Paid by you";
    case "owed_to_user":
      return "Owed to you";
    case "user_owes":
      return "You owe";
    case "reimbursed":
      return "Reimbursed";
    case "gross_spend":
      return "Full transaction cost";
    case "user_share":
      return "Your recorded share";
    default:
      return "Recorded amount";
  }
}

export default function SearchScreen() {
  const { selectedDate } = useJournal();
  const screenActive = useIsFocused();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [range, setRange] = useState(() => monthRange(selectedDate));
  const [custom, setCustom] = useState(false);
  const [start, setStart] = useState(range.start_date),
    [end, setEnd] = useState(offsetDay(range.end_date, -1));
  const [dateError, setDateError] = useState<string | null>(null);
  const search = useSearch();
  const result = search.result;
  const plan = result?.applied_filters;
  const advanced = result?.advanced_answer;
  const totals = result?.totals ?? [];
  const reviewCount = totals.reduce(
    (sum, total) => sum + Number(total.review_count),
    0,
  );
  const confirmedCount = totals.reduce(
    (sum, total) => sum + Number(total.confirmed_count),
    0,
  );
  const submit = (value = query) => {
    if (!value.trim()) return;
    Keyboard.dismiss();
    setQuery(value);
    setSubmitted(value);
    void search.run({ query: value.trim(), range });
  };
  const applyFilters = (filters: SearchPlan) => {
    Keyboard.dismiss();
    void search.run({ filters });
  };
  const changeRange = (next: typeof range) => {
    setRange(next);
    setStart(next.start_date);
    setEnd(offsetDay(next.end_date, -1));
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
  const filterChips = plan
    ? (
        [
          ["direction", plan.direction],
          ["merchant_id", result?.filter_labels?.merchant],
          ["category_id", result?.filter_labels?.category],
          ["person", plan.person],
          ["context", plan.context],
          ["currency", plan.currency],
          ["text", plan.text],
        ] as const
      ).filter(([, value]) => !!value)
    : [];
  const metricLabel = metricLabelFor(plan);
  const answerRows = advanced?.rows.map((row, index) => {
    const value = row.value_minor != null && row.currency
      ? exactMoney(row.value_minor, row.currency)
      : row.value_date ? new Date(`${row.value_date}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
      : row.value_count != null ? String(row.value_count)
      : row.label ?? "—";
    return { key: `${index}-${row.currency ?? row.label ?? ""}`, value, caption: [row.label, row.value_date && row.value_minor != null ? row.value_date : null, row.currency && advanced.rows.length > 1 ? row.currency : null].filter(Boolean).join(" · ") };
  }) ?? totals.filter((total) => total.confirmed_count > 0).map((total) => ({
    key: total.currency, value: exactMoney(total.total_minor, total.currency), caption: totals.length > 1 ? total.currency : "",
  }));
  const fallbackExplanation = advanced
    ? result?.matching_count === 0
      ? "No matching transactions were found for this question and period."
      : `This answer uses ${result?.matching_count ?? 0} matching journal transaction${result?.matching_count === 1 ? "" : "s"} from the selected period.`
    : result?.matching_count === 0
      ? "No matching transactions were found. Try another period or adjust the filters."
      : `The answer uses ${confirmedCount} confirmed transaction${confirmedCount === 1 ? "" : "s"}${reviewCount ? `; ${reviewCount} unconfirmed amount${reviewCount === 1 ? " is" : "s are"} excluded from the total` : ""}.`;
  const showLanding = !submitted && !result && !search.loading && !search.error;
  return (
    <Screen journal>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <IconButton
            name="back"
            label="Back to journal"
            onPress={() => router.back()}
          />
          <Text accessibilityRole="header" style={styles.headerTitle}>
            Ask Finn
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <FlatList
            data={result?.transactions ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <SourceTransactionCard item={item} />}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={7}
            ListHeaderComponent={
              <MotionLayout>
                <View style={styles.searchBox}>
                  <Icon
                    name="search"
                    size={19}
                    color={Finn.muted}
                    animation={false}
                  />
                  <TextInput
                    style={styles.input}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Ask about your journal…"
                    placeholderTextColor={Finn.muted}
                    accessibilityLabel="Ask Finn about your journal"
                    returnKeyType="search"
                    onSubmitEditing={() => submit()}
                    maxLength={500}
                    autoCorrect={false}
                  />
                  {!!query && (
                    <Button
                      label="Clear search"
                      onPress={clear}
                      style={styles.clear}
                    >
                      <Icon name="close" size={14} color={Finn.muted} />
                    </Button>
                  )}
                  <Button
                    label="Ask Finn"
                    disabled={!query.trim() || search.loading}
                    onPress={() => submit()}
                    style={styles.submit}
                  >
                    <Icon name="arrow" size={17} color="#FFFFFF" />
                  </Button>
                </View>
                <View style={styles.period}>
                  <Button
                    label="Previous month"
                    onPress={() =>
                      changeRange(monthRange(activeRange.start_date, -1))
                    }
                    style={styles.monthArrow}
                  >
                    <Icon name="back" size={13} />
                  </Button>
                  <Button
                    label="Change search date range"
                    accessibilityState={{ expanded: custom }}
                    onPress={() => {
                      setStart(activeRange.start_date);
                      setEnd(offsetDay(activeRange.end_date, -1));
                      setCustom((v) => !v);
                      setDateError(null);
                    }}
                    style={styles.periodButton}
                  >
                    <Icon name="calendar" size={13} color={Finn.secondary} />
                    <Text style={styles.periodText}>
                      {periodLabel(
                        activeRange.start_date,
                        activeRange.end_date,
                      )}
                    </Text>
                    <DisclosureChevron expanded={custom} size={10} color={Finn.secondary} />
                  </Button>
                  <Button
                    label="Next month"
                    onPress={() =>
                      changeRange(monthRange(activeRange.start_date, 1))
                    }
                    style={styles.monthArrow}
                  >
                    <Icon name="chevron" size={13} />
                  </Button>
                </View>
                <Reveal open={custom} style={styles.datePanel}>
                    <Text style={styles.small}>
                      Choose your first and last day · YYYY-MM-DD.
                    </Text>
                    <View style={styles.dateRow}>
                      <TextInput
                        accessibilityLabel="Start date"
                        value={start}
                        onChangeText={setStart}
                        placeholder="2026-09-01"
                        maxLength={10}
                        style={styles.dateInput}
                      />
                      <TextInput
                        accessibilityLabel="Last day to include"
                        value={end}
                        onChangeText={setEnd}
                        placeholder="2026-09-30"
                        maxLength={10}
                        style={styles.dateInput}
                      />
                    </View>
                    {dateError && (
                      <Text accessibilityRole="alert" style={styles.errorText}>
                        {dateError}
                      </Text>
                    )}
                    <Button
                      label="Apply date range"
                      onPress={() => {
                        try {
                          validateDate(start);
                          validateDate(end);
                          if (
                            end < start ||
                            Date.parse(end) - Date.parse(start) >=
                              3660 * 86400000
                          )
                            throw Error();
                          changeRange({
                            start_date: start,
                            end_date: offsetDay(end, 1),
                          });
                          setCustom(false);
                          setDateError(null);
                        } catch {
                          setDateError(
                            "Enter valid dates with the end on or after the start (up to 10 years).",
                          );
                        }
                      }}
                    >
                      <Text style={styles.action}>Apply dates</Text>
                    </Button>
                </Reveal>
                {search.loading && !result && (
                  <LoadingState variant="results" label="Matching entries and calculating totals…" active={screenActive} />
                )}
                {search.loading && !!result && <Text accessibilityLiveRegion="polite" style={styles.small}>Recalculating from your journal…</Text>}
                {search.error && (
                  <View style={styles.card}>
                    <Text accessibilityRole="alert" style={styles.body}>
                      {search.error}
                    </Text>
                    <Button label="Retry search" onPress={search.retry}>
                      <Text style={styles.action}>Try again</Text>
                    </Button>
                  </View>
                )}
                {showLanding && (
                  <View style={styles.landing}>
                    <Text style={styles.landingLabel}>TRY ASKING</Text>
                    {suggestions.map((suggestion) => (
                      <Button
                        key={suggestion}
                        label={suggestion}
                        onPress={() => submit(suggestion)}
                        style={styles.suggestion}
                      >
                        <Text style={styles.suggestionText}>{suggestion}</Text>
                        <Icon name="arrow" size={14} color={Finn.muted} />
                      </Button>
                    ))}
                    <Text style={styles.explainer}>
                      Finn checks your journal and shows the records behind each answer.
                    </Text>
                    {search.loadingContexts && !search.contexts ? (
                      <View style={styles.recent}>
                        <Text style={styles.landingLabel}>RECENT TOPICS</Text>
                        <LoadingState variant="contexts" label="Finding recent topics…" active={screenActive} />
                      </View>
                    ) : search.contextError ? (
                      <View style={styles.recent}>
                        <Text style={styles.small}>{search.contextError}</Text>
                        <Button label="Retry recent topics" onPress={search.reloadContexts}>
                          <Text style={styles.action}>Try again</Text>
                        </Button>
                      </View>
                    ) : search.contexts?.contexts.length ? (
                      <View style={styles.recent}>
                        <Text style={styles.landingLabel}>RECENT TOPICS</Text>
                        {search.contexts.contexts.slice(0, 3).map((context) => (
                          <Button
                            key={context.id}
                            label={`Ask about ${context.name}`}
                            onPress={() => openContext(context)}
                            style={styles.suggestion}
                          >
                            <Text style={styles.suggestionText}>{context.name}</Text>
                            <Icon name="arrow" size={14} color={Finn.muted} />
                          </Button>
                        ))}
                      </View>
                    ) : null}
                    <Text style={styles.footnote}>
                      Answers use synced notes from your journal.
                    </Text>
                  </View>
                )}
                {result?.needs_filters && (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>
                      Let’s narrow it down.
                    </Text>
                    <Text style={styles.body}>Try a more specific question or period, such as “Uber this month”.</Text>
                    <Text style={styles.small}>
                      No total is shown until the question is clear.
                    </Text>
                  </View>
                )}
                {(plan || advanced) && (
                  <ContentFade>
                    <View
                      style={styles.answer}
                      accessibilityLiveRegion="polite"
                    >
                      {result?.stale ? (
                        <>
                          <Text style={styles.answerTitle}>Your journal has changed.</Text>
                          <Text style={styles.body}>
                            Refresh to see an answer and entries that agree.
                          </Text>
                          <Button
                            label="Refresh search results"
                            onPress={() => plan ? applyFilters(plan) : void search.run({ query: submitted, range })}
                          >
                            <Text style={styles.action}>Refresh answer</Text>
                          </Button>
                        </>
                      ) : (
                        <>
                          {answerRows.length ? answerRows.map((row) => (
                            <View key={row.key} style={styles.answerRow}>
                              <Text style={styles.answerAmount}>{row.value}</Text>
                              {!!row.caption && <Text style={styles.answerScope}>{row.caption}</Text>}
                            </View>
                          )) : <Text style={styles.answerAmount}>{result?.matching_count === 0 ? "No matches" : "Needs review"}</Text>}
                          <Text style={styles.answerTitle}>{advanced?.label ?? answerLabelFor(plan)}</Text>
                          <Text style={styles.answerScope}>
                            {advanced ? periodLabel(advanced.start_date, advanced.end_date) : `${metricLabel} · ${periodLabel(plan!.start_date, plan!.end_date)}`}
                          </Text>
                        </>
                      )}
                    </View>
                    {!result?.stale && <View style={styles.explanation}>
                      <Text style={styles.sectionTitle}>Finn’s answer</Text>
                      <Text style={styles.body}>{result?.explanation ?? fallbackExplanation}</Text>
                      {search.loadingExplanation && <Text style={styles.small}>Finn is adding context…</Text>}
                    </View>}
                    {!!plan && <View style={styles.chips}>
                      {filterChips.map(([key, label]) => (
                        <Button key={key} label={`Remove ${label} filter`} onPress={() => applyFilters({ ...plan, [key]: null })} style={styles.chip}>
                          <Text style={styles.chipText}>{label}</Text>
                          <Icon name="close" size={10} color="#527661" />
                        </Button>
                      ))}
                    </View>}
                    {!!result?.matching_count && (
                      <View style={styles.sectionHeading}>
                        <Text style={styles.sectionTitle}>Transactions behind this answer</Text>
                        <Text style={styles.small}>
                          {result?.transactions?.length ?? 0} of{" "}
                          {result?.matching_count} transactions
                        </Text>
                      </View>
                    )}
                  </ContentFade>
                )}
              </MotionLayout>
            }
            ListFooterComponent={
              (plan || advanced) ? (
                <View style={styles.footer}>
                  {search.pageError && (
                    <Text accessibilityRole="alert" style={styles.errorText}>
                      {search.pageError}
                    </Text>
                  )}
                  {result?.has_more && !result.stale && (
                    <Button
                      label="Show more matching items"
                      disabled={search.loadingMore || search.loading}
                      onPress={() => void search.more()}
                      style={styles.showMore}
                    >
                      {search.loadingMore ? (
                        <ActivityIndicator color={Finn.primary} />
                      ) : (
                        <>
                          <Text style={styles.action}>Show more</Text>
                          <Icon name="down" size={13} color={Finn.primary} />
                        </>
                      )}
                    </Button>
                  )}
                  {!!result?.transactions?.length && (
                    <Text style={styles.footnote}>
                      {result?.stale
                        ? "Refresh to reload these entries."
                        : result?.has_more
                          ? "Five transactions at a time. The answer above includes all matches."
                          : "All matching items shown."}
                    </Text>
                  )}
                </View>
              ) : null
            }
          />
        </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerTitle: {
    fontFamily: JournalType.medium,
    fontSize: 17,
    color: Finn.ink,
  },
  headerSpacer: { width: 48 },
  content: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 32 },
  eyebrow: {
    fontFamily: JournalType.medium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: "#817875",
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 16,
    paddingRight: 7,
    backgroundColor: Finn.surface,
    borderRadius: 22,
    minHeight: 56,
    borderWidth: 1,
    borderColor: "#F2EAE4",
  },
  input: {
    flex: 1,
    fontFamily: JournalType.regular,
    fontSize: 15,
    color: Finn.ink,
    paddingVertical: 16,
    minWidth: 0,
  },
  clear: { width: 24, minHeight: 44 },
  submit: {
    width: 40,
    height: 40,
    minHeight: 40,
    borderRadius: 22,
    backgroundColor: Finn.ink,
  },
  period: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 12,
  },
  periodButton: { flexDirection: "row", gap: 6, paddingHorizontal: 4 },
  periodText: {
    fontFamily: JournalType.regular,
    fontSize: 11,
    color: "#817875",
  },
  monthArrow: { width: 32 },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: JournalType.medium,
    fontSize: 18,
    letterSpacing: -0.3,
    color: Finn.ink,
  },
  small: {
    fontFamily: JournalType.regular,
    fontSize: 12,
    lineHeight: 18,
    color: "#827B77",
  },
  body: {
    fontFamily: JournalType.regular,
    fontSize: 15,
    lineHeight: 23,
    color: "#635D59",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.7)",
    padding: 18,
    borderRadius: 18,
    gap: 12,
    marginBottom: 12,
  },
  action: { fontFamily: JournalType.medium, fontSize: 14, color: "#238655" },
  landing: { marginTop: 22 },
  landingLabel: {
    fontFamily: JournalType.medium,
    fontSize: 10,
    letterSpacing: 1.3,
    color: Finn.muted,
    marginBottom: 5,
  },
  explainer: {
    fontFamily: JournalType.regular,
    fontSize: 12,
    lineHeight: 18,
    color: "#817975",
    marginTop: 14,
    maxWidth: 290,
  },
  recent: { marginTop: 22, gap: 8 },
  suggestion: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Finn.line,
  },
  suggestionText: {
    flex: 1,
    fontFamily: JournalType.regular,
    fontSize: 15,
    lineHeight: 21,
    color: "#625B57",
  },
  footnote: {
    fontFamily: JournalType.regular,
    fontSize: 11,
    lineHeight: 18,
    color: "#948A83",
    textAlign: "center",
    marginTop: 22,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 13,
    minHeight: 36,
    borderRadius: 18,
    backgroundColor: Finn.primarySoft,
  },
  chipText: { fontFamily: JournalType.medium, fontSize: 12, color: "#527661" },
  answer: {
    borderRadius: 22,
    backgroundColor: Finn.surface,
    paddingHorizontal: 18,
    paddingVertical: 26,
    alignItems: "center",
    marginBottom: 12,
    minHeight: 150,
    ...Finn.shadow,
  },
  answerRow: { alignItems: "center", marginBottom: 8 },
  answerTitle: {
    fontFamily: JournalType.medium,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.5,
    color: Finn.secondary,
    textAlign: "center",
    marginTop: 4,
  },
  answerAmount: {
    fontFamily: JournalType.bold,
    fontSize: 36,
    lineHeight: 46,
    letterSpacing: -1.2,
    color: Finn.ink,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  answerScope: {
    fontFamily: JournalType.medium,
    fontSize: 12,
    lineHeight: 18,
    color: "#716B67",
    textAlign: "center",
  },
  explanation: { paddingHorizontal: 3, gap: 8, marginBottom: 10 },
  answerDetail: {
    fontFamily: JournalType.regular,
    fontSize: 13,
    lineHeight: 20,
    color: "#77716D",
    marginTop: 14,
  },
  footer: { paddingVertical: 8, gap: 10 },
  showMore: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 22,
    backgroundColor: Finn.surface,
    minHeight: 48,
    ...Finn.shadow,
  },
  errorText: {
    fontFamily: JournalType.regular,
    fontSize: 13,
    lineHeight: 20,
    color: Finn.danger,
  },
  datePanel: {
    backgroundColor: Finn.surface,
    padding: 16,
    borderRadius: 18,
    gap: 10,
    marginBottom: 16,
  },
  dateRow: { flexDirection: "row", gap: 10 },
  dateInput: {
    flex: 1,
    minHeight: 44,
    padding: 10,
    borderRadius: 10,
    backgroundColor: Finn.wash,
    fontFamily: JournalType.regular,
    color: Finn.ink,
  },
});
