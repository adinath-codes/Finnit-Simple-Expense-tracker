import { ContentFade } from "@/components/ui/motion";
import { Motion } from "@/constants/motion";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TransactionCard } from "@/components/common/transaction-card";
import { AppSheet, sheetStyles as shared } from "@/components/sheets/app-sheet";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Categories, Finn, JournalType } from "@/constants/theme";
import { useJournal } from "@/providers/app-providers";
import type { Category } from "@/types/domain";
import { money } from "@/utils/currency";
import { displayDay } from "@/utils/dates";
import { CalendarGrid } from "./calendar-grid";
import { CalendarSpendingChart } from "./calendar-spending-chart";
import { buildCalendarCategoryItems } from "../services/calendar-category-items";
import {
  cachedCalendarMonth,
  isCurrentMonth,
  monthStart,
  moveMonth,
} from "../services/calendar-service";
import {
  ANALYTICS_EVENTS,
  captureAnalytics,
} from "@/lib/analytics/analytics";

export default function CalendarScreen() {
  const {
    selectedDate, setSelectedDate, today, entries, settings,
    cacheAccountId, contentVersion,
  } = useJournal();
  const [month, setMonth] = useState(() => monthStart(selectedDate));
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [visibleItemCount, setVisibleItemCount] = useState(5);
  const calendar = cachedCalendarMonth({
    accountId: cacheAccountId,
    contentVersion,
    currency: settings.currency,
    month,
    entries,
    selectedDate,
    today,
  });
  const viewingCurrentMonth = isCurrentMonth(month, today);
  const monthKey = `${month.getFullYear()}-${month.getMonth()}`;
  const categoryItems = useMemo(
    () => selectedCategory
      ? buildCalendarCategoryItems({
          category: selectedCategory,
          entries,
          month,
          today,
        })
      : [],
    [entries, month, selectedCategory, today],
  );
  const visibleItems = categoryItems.slice(0, visibleItemCount);
  const remainingItemCount = Math.max(
    0,
    categoryItems.length - visibleItemCount,
  );

  useEffect(() => {
    setVisibleItemCount(5);
  }, [monthKey, selectedCategory]);

  const selectCategory = (category: Category) => {
    setSelectedCategory((current) => current === category ? null : category);
  };

  const changeMonth = (direction: -1 | 1) => {
    captureAnalytics(ANALYTICS_EVENTS.calendarMonthChanged, {
      direction: direction === -1 ? "previous" : "next",
    });
    setMonth((current) => moveMonth(current, direction));
  };

  const selectDate = (date: string) => {
    captureAnalytics(ANALYTICS_EVENTS.calendarDateSelected, {
      day_relation: date === today ? "today" : "past",
    });
    setSelectedDate(date);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <AppSheet title="Your journal">
        <View style={styles.monthHeader}>
          <IconButton
            name="back"
            label="Previous month"
            onPress={() => changeMonth(-1)}
          />
          <ContentFade key={calendar.label} duration={Motion.month}><Text style={styles.month}>{calendar.label}</Text></ContentFade>
          <IconButton
            name="chevron"
            label="Next month"
            disabled={viewingCurrentMonth}
            color={viewingCurrentMonth ? Finn.muted : Finn.ink}
            onPress={() => changeMonth(1)}
          />
        </View>
        <ContentFade key={calendar.label} duration={Motion.month} style={[shared.card, styles.calendarCard]}>
          <CalendarGrid
            calendar={calendar}
            currency={settings.currency}
            onSelect={selectDate}
          />
        </ContentFade>
        <CalendarSpendingChart
          categoryTotals={calendar.categoryTotals}
          currency={settings.currency}
          monthLabel={calendar.label}
          onSelectCategory={selectCategory}
          selectedCategory={selectedCategory}
          totalMinor={calendar.totalMinor}
        />
        {selectedCategory && (
          <View
            accessibilityLiveRegion="polite"
            style={styles.categoryResults}
          >
            <View style={styles.resultsHeader}>
              <Text accessibilityRole="header" style={styles.resultsTitle}>
                {Categories[selectedCategory].label}
              </Text>
              <Text style={styles.resultsCount}>
                {categoryItems.length} {categoryItems.length === 1 ? "item" : "items"}
              </Text>
            </View>
            {categoryItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  No {Categories[selectedCategory].label.toLocaleLowerCase()} items in {calendar.label}.
                </Text>
              </View>
            ) : (
              visibleItems.map((item) => (
                <TransactionCard
                  amount={item.amountNeedsReview
                    ? "Needs review"
                    : money(item.amountMinor, settings.currency)}
                  amountNeedsReview={item.amountNeedsReview}
                  date={displayDay(item.date)}
                  key={item.id}
                  message={item.message}
                />
              ))
            )}
            {remainingItemCount > 0 && (
              <Button
                label={`Show ${Math.min(5, remainingItemCount)} more ${Categories[selectedCategory].label} items`}
                onPress={() => setVisibleItemCount((count) => count + 5)}
                style={styles.showMore}
              >
                <Text style={styles.showMoreText}>Show more</Text>
              </Button>
            )}
          </View>
        )}
      </AppSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Finn.canvas,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
    marginTop: 10,
  },
  month: {
    fontSize: 20,
    fontFamily: JournalType.medium,
    color: Finn.ink,
    letterSpacing: -0.5,
  },
  calendarCard: {
    paddingHorizontal: 8,
    paddingTop: 13,
    paddingBottom: 11,
  },
  categoryResults: {
    marginTop: 22,
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
    paddingHorizontal: 3,
  },
  resultsTitle: {
    flexShrink: 1,
    fontFamily: JournalType.bold,
    fontSize: 17,
    color: Finn.ink,
    letterSpacing: -0.25,
  },
  resultsCount: {
    fontFamily: JournalType.medium,
    fontSize: 12,
    color: Finn.secondary,
  },
  emptyState: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderRadius: 20,
    backgroundColor: Finn.surface,
    ...Finn.shadow,
  },
  emptyText: {
    fontFamily: JournalType.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Finn.secondary,
  },
  showMore: {
    minHeight: 46,
    borderRadius: 23,
    backgroundColor: Finn.primarySoft,
  },
  showMoreText: {
    fontFamily: JournalType.bold,
    fontSize: 13,
    color: Finn.primary,
  },
});
