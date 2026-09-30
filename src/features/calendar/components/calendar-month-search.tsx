import { Image } from "expo-image";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { ZoomLink } from "@/components/navigation/zoom-link";
import { Button } from "@/components/ui/button";
import { Motion } from "@/constants/motion";
import { Finn, JournalType } from "@/constants/theme";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import type { JournalEntry } from "@/types/domain";
import { entryDisplayAmount } from "@/utils/amounts";
import { money } from "@/utils/currency";
import { displayDay } from "@/utils/dates";
import { searchCalendarMonth } from "../services/calendar-search";

const FINN_SEARCHING = require("../../../../assets/images/character/header/finn-laptop.webp");

export function CalendarMonthSearch({
  currency,
  entries,
  month,
  query,
  today,
}: {
  currency: string;
  entries: JournalEntry[];
  month: Date;
  query: string;
  today: string;
}) {
  const monthLabel = month.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const trimmedQuery = query.trim();
  const results = useMemo(
    () => searchCalendarMonth({ entries, month, query, today }),
    [entries, month, query, today],
  );

  if (!trimmedQuery) {
    return (
      <SearchEmptyState
        body={`Look through ${monthLabel} by shop, item, category, or note.`}
        title={`Search ${monthLabel}`}
      />
    );
  }

  if (!results.length) {
    return (
      <SearchEmptyState
        body={`Finn couldn’t find “${trimmedQuery}” in this month’s entries.`}
        title={`Nothing in ${monthLabel}`}
      />
    );
  }

  return (
    <View accessibilityLiveRegion="polite" style={styles.results}>
      <View style={styles.resultsHeading}>
        <Text accessibilityRole="header" style={styles.resultsTitle}>
          {monthLabel}
        </Text>
        <Text style={styles.resultsCount}>
          {results.length} {results.length === 1 ? "match" : "matches"}
        </Text>
      </View>
      {results.map((entry, index) => (
        <SearchResult
          currency={currency}
          entry={entry}
          index={index}
          key={entry.id}
        />
      ))}
    </View>
  );
}

function SearchEmptyState({ body, title }: { body: string; title: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.emptyState}>
      <Image
        accessibilityIgnoresInvertColors
        contentFit="contain"
        source={FINN_SEARCHING}
        style={styles.mascot}
      />
      <Text accessibilityRole="header" style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function SearchResult({
  currency,
  entry,
  index,
}: {
  currency: string;
  entry: JournalEntry;
  index: number;
}) {
  const reduced = useMotionPreference();
  const amount = entryDisplayAmount(entry, currency);
  const amountText = amount && !amount.needsReview
    ? money(amount.amountMinor, amount.currency)
    : "Needs review";
  const entering = useMemo(
    () => reduced
      ? FadeIn.duration(Motion.fade)
      : FadeInDown
          .duration(Motion.panelEnter)
          .delay(Math.min(index, 8) * 45)
          .easing(Motion.easeOut),
    [index, reduced],
  );

  return (
    <Animated.View entering={entering}>
      <ZoomLink href={{ pathname: "/entries/[entryId]", params: { entryId: entry.id } }}>
        <Button
          accessibilityHint="Opens this entry in the details bottom sheet"
          label={`Open ${entry.note}, ${displayDay(entry.date)}, ${amountText}`}
          style={styles.resultCard}
        >
          <View style={styles.resultMeta}>
            <Text style={styles.resultDate}>{displayDay(entry.date)}</Text>
            <Text
              numberOfLines={1}
              style={[styles.resultAmount, (!amount || amount.needsReview) && styles.reviewAmount]}
            >
              {amountText}
            </Text>
          </View>
          <Text numberOfLines={3} style={styles.resultNote}>{entry.note}</Text>
          {entry.merchant ? (
            <Text numberOfLines={1} style={styles.resultMerchant}>{entry.merchant}</Text>
          ) : null}
        </Button>
      </ZoomLink>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    flex: 1,
    minHeight: 420,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingBottom: 50,
  },
  mascot: { width: 142, height: 142, marginBottom: 18 },
  emptyTitle: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 20,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  emptyBody: {
    maxWidth: 280,
    marginTop: 8,
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  results: { paddingTop: 8 },
  resultsHeading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
    paddingHorizontal: 3,
  },
  resultsTitle: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 18,
    letterSpacing: -0.3,
  },
  resultsCount: {
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 12,
  },
  resultCard: {
    alignItems: "stretch",
    minHeight: 0,
    marginBottom: 12,
    padding: 18,
    borderRadius: 22,
    backgroundColor: Finn.surface,
    ...Finn.shadow,
  },
  resultMeta: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  resultDate: {
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 12,
  },
  resultAmount: {
    flexShrink: 1,
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 17,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  reviewAmount: { color: "#98672B", fontFamily: JournalType.regular, fontSize: 12 },
  resultNote: {
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 16,
    lineHeight: 23,
  },
  resultMerchant: {
    marginTop: 7,
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 12,
  },
});
