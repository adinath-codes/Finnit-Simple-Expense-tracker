import { useEffect, useState } from "react";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import {
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button } from "@/components/ui/button";
import { Finn, JournalType } from "@/constants/theme";
import { date as validateDate } from "../../../../supabase/functions/_shared/validation";
import {
  exclusiveEndDate,
  inclusiveEndDate,
  monthRange,
} from "../services/search-format";

export type AskDateRange = {
  start_date: string;
  end_date: string;
};

export type AskDateRangePopoverProps = {
  currentDay: string;
  onApply: (range: AskDateRange) => void;
  onDismiss: () => void;
  range: AskDateRange;
  visible: boolean;
};

type PickerTarget = "start" | "end" | null;

function calendarDate(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date, 12);
}

function calendarDay(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function dateButtonLabel(day: string) {
  return calendarDate(day).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AskDateRangePopover({
  currentDay,
  onApply,
  onDismiss,
  range,
  visible,
}: AskDateRangePopoverProps) {
  const [start, setStart] = useState(range.start_date);
  const [end, setEnd] = useState(inclusiveEndDate(range.end_date));
  const [error, setError] = useState<string | null>(null);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);

  useEffect(() => {
    if (!visible) return;
    setStart(range.start_date);
    setEnd(inclusiveEndDate(range.end_date));
    setError(null);
    setPickerTarget(null);
  }, [range.end_date, range.start_date, visible]);

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (pickerTarget) {
        setPickerTarget(null);
      } else {
        onDismiss();
      }
      return true;
    });
    return () => subscription.remove();
  }, [onDismiss, pickerTarget, visible]);

  if (!visible) return null;

  const setSelectedDay = (target: Exclude<PickerTarget, null>, day: string) => {
    setError(null);
    if (target === "start") {
      setStart(day);
      if (day > end) setEnd(day);
    } else {
      setEnd(day < start ? start : day);
    }
  };

  const apply = () => {
    try {
      validateDate(start);
      validateDate(end);
      if (
        end < start ||
        Date.parse(end) - Date.parse(start) >= 3660 * 86400000
      ) {
        throw Error();
      }
      onApply({
        start_date: start,
        end_date: exclusiveEndDate(end),
      });
    } catch {
      setError("Choose a valid range of up to 10 years.");
    }
  };

  const dateRow = (target: Exclude<PickerTarget, null>, label: string) => {
    const value = target === "start" ? start : end;
    if (Platform.OS === "ios") {
      return (
        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>{label}</Text>
          <DateTimePicker
            accentColor={Finn.primary}
            display="compact"
            mode="date"
            onValueChange={(_event, date) =>
              setSelectedDay(target, calendarDay(date))
            }
            presentation="inline"
            themeVariant="light"
            value={calendarDate(value)}
          />
        </View>
      );
    }
    if (Platform.OS === "web") {
      return (
        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>{label}</Text>
          <TextInput
            accessibilityLabel={`${label} date`}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={10}
            onChangeText={(day) => setSelectedDay(target, day)}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Finn.muted}
            style={styles.webDateInput}
            value={value}
          />
        </View>
      );
    }
    return (
      <Button
        label={`Choose ${label.toLowerCase()} date`}
        onPress={() => setPickerTarget(target)}
        style={styles.dateRow}
      >
        <Text style={styles.dateLabel}>{label}</Text>
        <Text style={styles.dateValue}>{dateButtonLabel(value)}</Text>
      </Button>
    );
  };

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Pressable
        accessibilityLabel="Close date range picker"
        accessibilityRole="button"
        onPress={onDismiss}
        style={styles.backdrop}
      />
      <View
        accessibilityLabel="Choose Ask Finn date range"
        accessibilityViewIsModal
        style={styles.popover}
      >
        <Text style={styles.title}>Date range</Text>
        <View style={styles.presets}>
          <Button
            label="Use this month"
            onPress={() => onApply(monthRange(currentDay))}
            style={styles.preset}
          >
            <Text style={styles.presetText}>This month</Text>
          </Button>
          <Button
            label="Use last month"
            onPress={() => onApply(monthRange(currentDay, -1))}
            style={styles.preset}
          >
            <Text style={styles.presetText}>Last month</Text>
          </Button>
        </View>
        <View style={styles.dates}>
          {dateRow("start", "Start")}
          {dateRow("end", "End")}
        </View>
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Button label="Apply date range" onPress={apply} style={styles.apply}>
          <Text style={styles.applyText}>Apply</Text>
        </Button>
      </View>
      {Platform.OS === "android" && pickerTarget ? (
        <DateTimePicker
          accentColor={Finn.primary}
          minimumDate={
            pickerTarget === "end" ? calendarDate(start) : undefined
          }
          mode="date"
          negativeButton={{ label: "Cancel" }}
          onDismiss={() => setPickerTarget(null)}
          onValueChange={(_event, date) => {
            setSelectedDay(pickerTarget, calendarDay(date));
            setPickerTarget(null);
          }}
          positiveButton={{ label: "Choose" }}
          presentation="dialog"
          value={calendarDate(pickerTarget === "start" ? start : end)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    elevation: 40,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(31, 26, 23, 0.08)",
  },
  popover: {
    position: "absolute",
    right: 18,
    top: 62,
    width: 300,
    padding: 18,
    borderRadius: 22,
    backgroundColor: Finn.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Finn.line,
    gap: 14,
    boxShadow: "0px 12px 34px rgba(73, 56, 44, 0.18)",
  },
  title: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 17,
  },
  presets: { flexDirection: "row", gap: 8 },
  preset: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: Finn.wash,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Finn.line,
  },
  presetText: {
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 12,
  },
  dates: { gap: 2 },
  dateRow: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Finn.line,
  },
  dateLabel: {
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 13,
  },
  dateValue: {
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 14,
  },
  webDateInput: {
    width: 128,
    paddingVertical: 8,
    color: Finn.ink,
    fontFamily: JournalType.regular,
    fontSize: 14,
    textAlign: "right",
  },
  error: {
    color: Finn.danger,
    fontFamily: JournalType.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  apply: {
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: Finn.ink,
  },
  applyText: {
    color: Finn.surface,
    fontFamily: JournalType.bold,
    fontSize: 14,
  },
});
