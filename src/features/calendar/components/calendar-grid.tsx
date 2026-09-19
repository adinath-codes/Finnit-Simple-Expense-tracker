import { StyleSheet, Text, View } from "react-native";
import { Finn, JournalType } from "@/constants/theme";
import type { CalendarMonth } from "../types/calendar.types";
import { CalendarDayCell } from "./calendar-day-cell";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function CalendarGrid({
  calendar,
  currency,
  onSelect,
}: {
  calendar: CalendarMonth;
  currency: string;
  onSelect: (date: string) => void;
}) {
  return (
    <View style={styles.grid}>
      {WEEKDAYS.map((weekday, index) => (
        <View key={`${weekday}-${index}`} style={styles.weekdayCell}>
          <Text style={styles.weekday}>{weekday}</Text>
        </View>
      ))}
      {Array.from({ length: calendar.leadingBlankCount }, (_, index) => (
        <View key={`blank-${index}`} style={styles.dayCell} />
      ))}
      {calendar.days.map((day) => (
        <View key={day.date} style={styles.dayCell}>
          <CalendarDayCell day={day} currency={currency} onSelect={onSelect} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  weekdayCell: {
    width: `${100 / 7}%`,
    height: 27,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  weekday: {
    color: Finn.muted,
    fontFamily: JournalType.medium,
    fontSize: 10,
  },
  dayCell: {
    width: `${100 / 7}%`,
    minHeight: 62,
    padding: 2,
  },
});
