import { StyleSheet, Text } from "react-native";
import { Button } from "@/components/ui/button";
import { Finn, JournalType } from "@/constants/theme";
import type { CalendarDay } from "../types/calendar.types";
import { compactMoney } from "../services/calendar-service";

export function CalendarDayCell({
  day,
  currency,
  onSelect,
}: {
  day: CalendarDay;
  currency: string;
  onSelect: (date: string) => void;
}) {
  const amountLabel = compactMoney(day.totalMinor, currency);
  const accessibilityLabel = day.isFuture
    ? `${day.date}, future date`
    : `${day.date}, ${amountLabel} spent${day.isSelected ? ", selected" : ""}`;

  return (
    <Button
      label={accessibilityLabel}
      accessibilityHint={
        day.isFuture ? undefined : "Shows this date in the journal behind the calendar."
      }
      disabled={day.isFuture}
      onPress={() => onSelect(day.date)}
      hitSlop={1}
      style={[
        styles.tile,
        day.isToday && styles.today,
        day.isSelected && styles.selected,
        day.isFuture && styles.future,
      ]}
    >
      <Text
        style={[
          styles.dayNumber,
          day.isToday && styles.todayNumber,
          day.isFuture && styles.futureText,
        ]}
      >
        {day.dayNumber}
      </Text>
      {!day.isFuture && (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
          style={[
            styles.amount,
            day.totalMinor === 0 && styles.zeroAmount,
          ]}
        >
          {amountLabel}
        </Text>
      )}
    </Button>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: "100%",
    height: 58,
    borderRadius: 11,
    backgroundColor: Finn.surface,
    borderWidth: 1,
    borderColor: Finn.line,
    paddingHorizontal: 4,
    paddingVertical: 5,
  },
  today: {
    borderColor: Finn.primary,
  },
  selected: {
    backgroundColor: Finn.primarySoft,
    borderColor: Finn.primary,
    borderWidth: 1.5,
  },
  future: {
    backgroundColor: Finn.wash,
    borderColor: "transparent",
  },
  dayNumber: {
    position: "absolute",
    left: 6,
    top: 5,
    fontFamily: JournalType.medium,
    fontSize: 9,
    color: Finn.secondary,
    fontVariant: ["tabular-nums"],
  },
  todayNumber: {
    color: Finn.primary,
  },
  futureText: {
    color: Finn.muted,
  },
  amount: {
    maxWidth: "100%",
    paddingHorizontal: 1,
    paddingTop: 9,
    fontFamily: JournalType.bold,
    fontSize: 11,
    color: Finn.primary,
    letterSpacing: -0.35,
    fontVariant: ["tabular-nums"],
  },
  zeroAmount: {
    color: Finn.muted,
  },
});
