import { useMemo, useState } from "react";
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
import { ZoomLink } from "@/components/navigation/zoom-link";
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
  displayDay,
  exactMoney,
  monthRange,
  offsetDay,
  periodLabel,
} from "../services/search-format";
import { groupSources, SourceEntryCard } from "./source-entry-list";
import type { ActiveContext } from "../types/ask.types";
import { date as validateDate } from "../../../../supabase/functions/_shared/validation";

const suggestions = [
  "What is the Uber spend this month?",
  "Food last week",
  "Transport this month",
];
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
  const groups = useMemo(
    () => groupSources(result?.transactions ?? []),
    [result?.transactions],
  );
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
  const activeRange = plan
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
  const answerLabel =
    plan?.direction === "expense"
      ? "You spent"
      : plan?.direction === "income"
        ? "You received"
        : "Recorded money";
  const scopedTo =
    result?.filter_labels?.merchant ??
    result?.filter_labels?.category ??
    plan?.context ??
    null;
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
            Search
          </Text>
          <ZoomLink href="/settings"><IconButton
            name="settings"
            label="Open settings"
          /></ZoomLink>
        </View>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <FlatList
            data={groups}
            keyExtractor={(group) => group.key}
            renderItem={({ item }) => <SourceEntryCard group={item} />}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={7}
            ListHeaderComponent={
              <MotionLayout>
                <Text style={styles.eyebrow}>YOUR FINANCIAL MEMORY</Text>
                <Text style={styles.title}>Find a little clarity.</Text>
                <Text style={styles.subtitle}>
                  Trips, coffees, the ride home. It’s all in your journal.
                </Text>
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
                    placeholder="What would you like to remember?"
                    placeholderTextColor={Finn.muted}
                    accessibilityLabel="Search your financial journal"
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
                    label="Search journal"
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
                  <LoadingState variant="results" label="Looking through your journal…" active={screenActive} />
                )}
                {search.loading && !!result && <Text accessibilityLiveRegion="polite" style={styles.small}>Updating your answer…</Text>}
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
                  <>
                    <View style={styles.sectionHeading}>
                      <Text style={styles.sectionTitle}>
                        In your life lately
                      </Text>
                      <Text style={styles.small}>Last 90 days</Text>
                    </View>
                    {search.loadingContexts && !search.contexts ? (
                      <LoadingState variant="contexts" label="Finding your recent contexts…" active={screenActive} />
                    ) : search.contextError ? (
                      <View style={styles.card}>
                        <Icon
                          name="bookmark"
                          size={23}
                          color={Finn.primary}
                          animation={false}
                        />
                        <Text style={styles.body}>{search.contextError}</Text>
                        <Button
                          label="Retry recent contexts"
                          onPress={search.reloadContexts}
                        >
                          <Text style={styles.action}>Try again</Text>
                        </Button>
                      </View>
                    ) : search.contexts?.contexts.length ? (
                      <ContentFade>{search.contexts.contexts.map((context, index) => (
                        <Button
                          key={context.id}
                          label={`See ${context.name} spending`}
                          onPress={() => openContext(context)}
                          style={[
                            styles.contextCard,
                            {
                              backgroundColor:
                                index % 2 ? "#FFF2E5" : Finn.primarySoft,
                            },
                          ]}
                        >
                          <View style={styles.contextTop}>
                            <View style={styles.contextIcon}>
                              <Icon
                                name={
                                  /trip|travel/i.test(context.name)
                                    ? "globe"
                                    : "bookmark"
                                }
                                size={19}
                                color="#397456"
                                animation={false}
                              />
                            </View>
                            <View style={styles.grow}>
                              <Text style={styles.contextName}>
                                {context.name}
                              </Text>
                              <Text style={styles.small}>
                                {context.entry_count} note
                                {context.entry_count === 1 ? "" : "s"} · Last
                                entry {displayDay(context.last_activity)}
                              </Text>
                            </View>
                            <Icon name="arrow" size={16} color="#6B8274" />
                          </View>
                          {context.totals.map((total) => (
                            <Text
                              key={total.currency}
                              style={styles.contextAmount}
                            >
                              {total.confirmed_count > 0
                                ? exactMoney(total.total_minor, total.currency)
                                : `${total.currency} · Needs review`}
                              {total.confirmed_count > 0 && (
                                <Text style={styles.contextSpent}> spent</Text>
                              )}
                            </Text>
                          ))}
                          {context.totals.some((t) => t.review_count > 0) && (
                            <Text style={styles.small}>
                              Amounts needing review are excluded.
                            </Text>
                          )}
                        </Button>
                      ))}</ContentFade>
                    ) : (
                      <View style={styles.card}>
                        <Icon
                          name="bookmark"
                          size={23}
                          color={Finn.primary}
                          animation={false}
                        />
                        <Text style={styles.body}>
                          Your stories will collect here.
                        </Text>
                        <Text style={styles.small}>
                          Mention a trip or project in a note. Its recent
                          spending will be easy to find here.
                        </Text>
                      </View>
                    )}
                    <Text
                      style={[
                        styles.sectionTitle,
                        { marginTop: 28, marginBottom: 12 },
                      ]}
                    >
                      Start with a question
                    </Text>
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
                    <Text style={styles.footnote}>
                      Answers come from your synced journal. Notes still waiting
                      to sync won’t appear yet.
                    </Text>
                  </>
                )}
                {result?.needs_filters && (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>
                      Let’s narrow it down.
                    </Text>
                    <Text style={styles.body}>
                      Try a merchant, category or named trip with a period, such
                      as “Uber this month”.
                    </Text>
                    <Text style={styles.small}>
                      No total is shown until the question is clear.
                    </Text>
                  </View>
                )}
                {plan && (
                  <ContentFade>
                    <View style={styles.chips}>
                      {filterChips.map(([key, label]) => (
                        <Button
                          key={key}
                          label={`Remove ${label} filter`}
                          onPress={() => applyFilters({ ...plan, [key]: null })}
                          style={styles.chip}
                        >
                          <Text style={styles.chipText}>{label}</Text>
                          <Icon name="close" size={10} color="#527661" />
                        </Button>
                      ))}
                    </View>
                    <View
                      style={styles.answer}
                      accessibilityLiveRegion="polite"
                    >
                      <Text style={styles.eyebrow}>
                        {result?.interpretation === "structured_model" ||
                        result?.interpretation === "cached_model"
                          ? "FROM YOUR QUESTION"
                          : "FROM YOUR JOURNAL"}
                      </Text>
                      {result?.stale ? (
                        <>
                          <Text style={styles.answerTitle}>
                            Your journal has changed.
                          </Text>
                          <Text style={styles.body}>
                            Refresh to see an answer and entries that agree.
                          </Text>
                          <Button
                            label="Refresh search results"
                            onPress={() => applyFilters(plan)}
                          >
                            <Text style={styles.action}>Refresh answer</Text>
                          </Button>
                        </>
                      ) : (
                        <>
                          <Text style={styles.answerTitle}>
                            {result?.matching_count === 0
                              ? "No matching entries yet."
                              : confirmedCount === 0
                                ? "These amounts need a look."
                                : `${answerLabel}${scopedTo ? ` on ${scopedTo}` : ""}`}
                          </Text>
                          {confirmedCount > 0 &&
                            totals
                              .filter((total) => total.confirmed_count > 0)
                              .map((total) => (
                                <Text
                                  key={total.currency}
                                  style={styles.answerAmount}
                                >
                                  {exactMoney(
                                    total.total_minor,
                                    total.currency,
                                  )}
                                </Text>
                              ))}
                          <Text style={styles.small}>
                            {periodLabel(plan.start_date, plan.end_date)}
                          </Text>
                          <Text style={styles.answerDetail}>
                            {result?.matching_count === 0
                              ? "Try another period or remove a filter."
                              : `${confirmedCount} confirmed item${confirmedCount === 1 ? "" : "s"}${reviewCount ? ` · ${reviewCount} needing review excluded` : ""}.`}
                          </Text>
                          {totals.length > 1 && (
                            <Text style={styles.small}>
                              Each currency is shown separately.
                            </Text>
                          )}
                          {plan.direction === null && (
                            <Text style={styles.small}>
                              Amounts are added across all money types.
                            </Text>
                          )}
                          {(plan.context || plan.text) && (
                            <Text style={styles.small}>
                              Includes matching items from notes linked to these
                              filters.
                            </Text>
                          )}
                          {plan.person && (
                            <Text style={styles.small}>
                              Includes items in notes mentioning {plan.person}.
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                    {!!result?.matching_count && (
                      <View style={styles.sectionHeading}>
                        <Text style={styles.sectionTitle}>
                          The notes behind it
                        </Text>
                        <Text style={styles.small}>
                          {result?.transactions?.length ?? 0} of{" "}
                          {result?.matching_count} items
                        </Text>
                      </View>
                    )}
                  </ContentFade>
                )}
              </MotionLayout>
            }
            ListFooterComponent={
              plan ? (
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
                  {!!groups.length && (
                    <Text style={styles.footnote}>
                      {result?.stale
                        ? "Refresh to reload these entries."
                        : result?.has_more
                          ? "20 items at a time. The answer above already includes all matches."
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
    paddingBottom: 22,
  },
  headerTitle: {
    fontFamily: JournalType.medium,
    fontSize: 17,
    color: Finn.ink,
  },
  content: { paddingHorizontal: 22, paddingBottom: 32 },
  eyebrow: {
    fontFamily: JournalType.medium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: "#817875",
    marginBottom: 12,
  },
  title: {
    fontFamily: JournalType.medium,
    fontSize: 32,
    letterSpacing: -1.1,
    color: Finn.ink,
  },
  subtitle: {
    fontFamily: JournalType.regular,
    fontSize: 15,
    lineHeight: 22,
    color: "#8B8380",
    marginTop: 8,
    marginBottom: 24,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 16,
    paddingRight: 7,
    backgroundColor: Finn.surface,
    borderRadius: 25,
    minHeight: 58,
    borderWidth: 1,
    borderColor: "#F2EAE4",
    ...Finn.shadow,
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
    marginBottom: 20,
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
    backgroundColor: "rgba(255,255,255,0.78)",
    padding: 22,
    borderRadius: 22,
    gap: 12,
    marginBottom: 12,
  },
  loading: { alignItems: "center", gap: 12, paddingVertical: 40 },
  action: { fontFamily: JournalType.medium, fontSize: 14, color: "#238655" },
  contextCard: {
    alignItems: "stretch",
    padding: 20,
    borderRadius: 24,
    marginBottom: 12,
    gap: 12,
  },
  contextTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  contextIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  grow: { flex: 1, gap: 3 },
  contextName: {
    fontFamily: JournalType.medium,
    fontSize: 17,
    color: Finn.ink,
  },
  contextAmount: {
    fontFamily: JournalType.medium,
    fontSize: 25,
    letterSpacing: -0.5,
    color: "#244632",
  },
  contextSpent: {
    fontFamily: JournalType.regular,
    fontSize: 14,
    color: "#6E8878",
  },
  suggestion: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 16,
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
    borderRadius: 26,
    backgroundColor: Finn.surface,
    padding: 24,
    marginBottom: 12,
    ...Finn.shadow,
  },
  answerTitle: {
    fontFamily: JournalType.medium,
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.5,
    color: Finn.ink,
    marginBottom: 10,
  },
  answerAmount: {
    fontFamily: JournalType.medium,
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -1.2,
    color: "#258557",
    marginBottom: 8,
    fontVariant: ["tabular-nums"],
  },
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
