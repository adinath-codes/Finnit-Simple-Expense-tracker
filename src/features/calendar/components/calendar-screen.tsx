import { ContentFade } from "@/components/ui/motion";
import { Motion } from "@/constants/motion";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppSheet, sheetStyles as shared } from "@/components/sheets/app-sheet";
import { IconButton } from "@/components/ui/icon-button";
import { Finn, JournalType } from "@/constants/theme";
import { useJournal } from "@/providers/app-providers";
import { CalendarGrid } from "./calendar-grid";
import { CalendarSpendingChart } from "./calendar-spending-chart";
import {
  cachedCalendarMonth,
  isCurrentMonth,
  monthStart,
  moveMonth,
} from "../services/calendar-service";

export default function CalendarScreen() {
  const {
    selectedDate, setSelectedDate, today, entries, settings,
    cacheAccountId, contentVersion,
  } = useJournal();
  const [month, setMonth] = useState(() => monthStart(selectedDate));
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

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <AppSheet title="Your journal">
        <View style={styles.monthHeader}>
          <IconButton
            name="back"
            label="Previous month"
            onPress={() => setMonth((current) => moveMonth(current, -1))}
          />
          <ContentFade key={calendar.label} duration={Motion.month}><Text style={styles.month}>{calendar.label}</Text></ContentFade>
          <IconButton
            name="chevron"
            label="Next month"
            disabled={viewingCurrentMonth}
            color={viewingCurrentMonth ? Finn.muted : Finn.ink}
            onPress={() => setMonth((current) => moveMonth(current, 1))}
          />
        </View>
        <ContentFade key={calendar.label} duration={Motion.month} style={[shared.card, styles.calendarCard]}>
          <CalendarGrid
            calendar={calendar}
            currency={settings.currency}
            onSelect={setSelectedDate}
          />
        </ContentFade>
        <CalendarSpendingChart
          categoryTotals={calendar.categoryTotals}
          currency={settings.currency}
          monthLabel={calendar.label}
          totalMinor={calendar.totalMinor}
        />
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
});
