import { ContentFade } from "@/components/ui/motion";
import { Motion } from "@/constants/motion";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { TransactionCard } from "@/components/common/transaction-card";
import {
  AppSheet,
  closeSheet,
  sheetStyles as shared,
} from "@/components/sheets/app-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Categories, Finn, JournalType } from "@/constants/theme";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import {
  useJournalActions,
  useJournalData,
} from "@/providers/app-providers";
import type { Category } from "@/types/domain";
import { money } from "@/utils/currency";
import { displayDay } from "@/utils/dates";
import { CalendarGrid } from "./calendar-grid";
import { CalendarMonthSearch } from "./calendar-month-search";
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
    selectedDate, today, entries, settings, cacheAccountId, contentVersion,
  } = useJournalData();
  const { setSelectedDate, loadJournalRange } = useJournalActions();
  const [month, setMonth] = useState(() => monthStart(selectedDate));
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [visibleItemCount, setVisibleItemCount] = useState(5);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInput = useRef<TextInput>(null);
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
  const monthStartDay = [
    month.getFullYear(), String(month.getMonth() + 1).padStart(2, "0"), "01",
  ].join("-");
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12);
  const monthEndDay = [
    monthEnd.getFullYear(), String(monthEnd.getMonth() + 1).padStart(2, "0"),
    String(monthEnd.getDate()).padStart(2, "0"),
  ].join("-");
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

  useEffect(() => {
    void loadJournalRange(monthStartDay, monthEndDay).catch(() => undefined);
  }, [loadJournalRange, monthEndDay, monthStartDay]);

  useFocusEffect(useCallback(() => {
    if (!searchOpen) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        Keyboard.dismiss();
        setSearchQuery("");
        setSearchOpen(false);
        return true;
      },
    );
    return () => subscription.remove();
  }, [searchOpen]));

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

  const openSearch = () => {
    setSearchOpen(true);
    requestAnimationFrame(() => searchInput.current?.focus());
  };

  const closeSearch = () => {
    Keyboard.dismiss();
    setSearchQuery("");
    setSearchOpen(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <AppSheet
        bodyStyle={searchOpen ? styles.searchBody : undefined}
        customHeader={(
          <CalendarSheetHeader
            active={searchOpen}
            inputRef={searchInput}
            monthLabel={calendar.label}
            onCancel={closeSearch}
            onOpen={openSearch}
            onQueryChange={setSearchQuery}
            query={searchQuery}
          />
        )}
        title="Your journal"
      >
        {searchOpen ? (
          <ContentFade key="month-search" style={styles.searchContent}>
            <CalendarMonthSearch
              currency={settings.currency}
              entries={entries}
              month={month}
              query={searchQuery}
              today={today}
            />
          </ContentFade>
        ) : (
          <ContentFade key="calendar-content">
            <View style={styles.monthHeader}>
              <IconButton
                name="back"
                label="Previous month"
                onPress={() => changeMonth(-1)}
              />
              <ContentFade key={calendar.label} duration={Motion.month}>
                <Text style={styles.month}>{calendar.label}</Text>
              </ContentFade>
              <IconButton
                name="chevron"
                label="Next month"
                disabled={viewingCurrentMonth}
                color={viewingCurrentMonth ? Finn.muted : Finn.ink}
                onPress={() => changeMonth(1)}
              />
            </View>
            <ContentFade
              key={calendar.label}
              duration={Motion.month}
              style={[shared.card, styles.calendarCard]}
            >
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
          </ContentFade>
        )}
      </AppSheet>
    </SafeAreaView>
  );
}

function CalendarSheetHeader({
  active,
  inputRef,
  monthLabel,
  onCancel,
  onOpen,
  onQueryChange,
  query,
}: {
  active: boolean;
  inputRef: React.RefObject<TextInput | null>;
  monthLabel: string;
  onCancel: () => void;
  onOpen: () => void;
  onQueryChange: (query: string) => void;
  query: string;
}) {
  const reduced = useMotionPreference();
  const progress = useSharedValue(active ? 1 : 0);
  const top = Platform.OS === "web" ? 25 : 16;

  useEffect(() => {
    cancelAnimation(progress);
    progress.set(withTiming(active ? 1 : 0, {
      duration: reduced
        ? Motion.fade
        : active
          ? Motion.panelEnter
          : Motion.panelExit,
      easing: Motion.easeInOut,
    }));
  }, [active, progress, reduced]);

  const baseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.get(),
      [0, 0.62],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [{
      translateX: reduced
        ? 0
        : interpolate(progress.get(), [0, 1], [0, -10], Extrapolation.CLAMP),
    }],
  }));
  const morphStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.get(),
      [0, 0.08, 1],
      [0, 1, 1],
      Extrapolation.CLAMP,
    ),
    transform: [{
      scaleX: reduced
        ? 1
        : interpolate(progress.get(), [0, 1], [0.26, 1], Extrapolation.CLAMP),
    }],
  }));
  const searchContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.get(),
      [0.28, 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View style={[styles.sheetHeader, { height: top + 66 }]}>
      <Animated.View
        accessibilityElementsHidden={active}
        importantForAccessibility={active ? "no-hide-descendants" : "yes"}
        pointerEvents={active ? "none" : "auto"}
        style={[styles.headerLayer, { top }, baseStyle]}
      >
        <Text accessibilityRole="header" style={styles.sheetTitle}>Your journal</Text>
        <View style={styles.headerActionSurface}>
          <Button label={`Search ${monthLabel}`} onPress={onOpen} style={styles.headerAction}>
            <Icon name="search" size={19} />
          </Button>
          <View style={styles.headerDivider} />
          <Button label="Close Your journal" onPress={closeSheet} style={styles.headerAction}>
            <Icon name="close" size={19} />
          </Button>
        </View>
      </Animated.View>

      <Animated.View
        accessibilityElementsHidden={!active}
        importantForAccessibility={active ? "yes" : "no-hide-descendants"}
        pointerEvents={active ? "auto" : "none"}
        style={[styles.searchHeaderLayer, { top }]}
      >
        <Animated.View style={[styles.searchMorphSurface, morphStyle]} />
        <Animated.View style={[styles.searchHeaderContent, searchContentStyle]}>
          <View style={styles.searchInputFrame}>
            <Icon animation={false} color={Finn.secondary} name="search" size={17} />
            <TextInput
              ref={inputRef}
              accessibilityLabel={`Search entries in ${monthLabel}`}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={120}
              onChangeText={onQueryChange}
              onSubmitEditing={Keyboard.dismiss}
              placeholder={`Search ${monthLabel}`}
              placeholderTextColor={Finn.muted}
              returnKeyType="search"
              selectionColor={Finn.primary}
              style={styles.searchInput}
              value={query}
            />
            {query ? (
              <Button label="Clear month search" onPress={() => onQueryChange("")} style={styles.clearSearch}>
                <Icon animation={false} color={Finn.secondary} name="close" size={13} />
              </Button>
            ) : null}
          </View>
          <Button label="Return to calendar" onPress={onCancel} style={styles.cancelSearch}>
            <Text style={styles.cancelSearchText}>Cancel</Text>
          </Button>
          <View style={styles.headerDivider} />
          <Button label="Close Your journal" onPress={closeSheet} style={styles.headerAction}>
            <Icon name="close" size={19} />
          </Button>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Finn.canvas,
  },
  sheetHeader: { position: "relative", paddingHorizontal: 20 },
  headerLayer: {
    position: "absolute",
    left: 20,
    right: 20,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  sheetTitle: {
    flex: 1,
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 18,
    letterSpacing: -0.25,
  },
  headerActionSurface: {
    width: 99,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    backgroundColor: Finn.surface,
    ...Finn.shadow,
  },
  headerAction: { width: 49, height: 44, minHeight: 44 },
  headerDivider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: Finn.line,
  },
  searchHeaderLayer: {
    position: "absolute",
    left: 20,
    right: 20,
    height: 44,
  },
  searchMorphSurface: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 24,
    backgroundColor: Finn.surface,
    transformOrigin: "right center",
    ...Finn.shadow,
  },
  searchHeaderContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  searchInputFrame: {
    minWidth: 0,
    flex: 1,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 15,
  },
  searchInput: {
    minWidth: 0,
    flex: 1,
    height: 44,
    paddingVertical: 0,
    color: Finn.ink,
    fontFamily: JournalType.regular,
    fontSize: 15,
  },
  clearSearch: { width: 34, height: 44, minHeight: 44 },
  cancelSearch: { height: 44, minHeight: 44, paddingHorizontal: 9 },
  cancelSearchText: {
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 13,
  },
  searchBody: { flexGrow: 1 },
  searchContent: { flex: 1 },
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
