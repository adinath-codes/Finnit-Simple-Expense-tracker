import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  AppSheet,
  closeSheet,
  SectionLabel,
  sheetStyles as shared,
} from "@/components/sheets/app-sheet";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Finn } from "@/constants/theme";
import { useJournal } from "@/providers/app-providers";
import { entryTotal } from "@/utils/amounts";
import { money } from "@/utils/currency";
export default function CalendarScreen() {
  const { selectedDate, setSelectedDate, today, entries } = useJournal();
  const [month, setMonth] = useState(
    new Date(`${selectedDate.slice(0, 7)}-01T12:00:00`),
  );
  const [selected, setSelected] = useState(selectedDate);
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const forDay = entries.filter((entry) => entry.date === selected);
  return (
    <AppSheet
      title="Your journal"
      footer={
        <Button
          label="Open selected day"
          onPress={() => {
            setSelectedDate(selected);
            closeSheet();
          }}
          style={shared.primary}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>
            Open{" "}
            {selected === today
              ? "today"
              : new Date(`${selected}T12:00:00`).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "long",
                })}
          </Text>
        </Button>
      }
    >
      <View style={styles.monthHeader}>
        <IconButton
          name="back"
          label="Previous month"
          onPress={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        />
        <Text style={styles.month}>
          {month.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </Text>
        <IconButton
          name="chevron"
          label="Next month"
          onPress={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        />
      </View>
      <View style={[shared.card, { padding: 10 }]}>
        <View style={styles.grid}>
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <View key={index} style={styles.cell}>
              <Text style={styles.weekday}>{day}</Text>
            </View>
          ))}
          {Array.from({ length: firstDay }, (_, index) => (
            <View key={`blank-${index}`} style={styles.cell} />
          ))}
          {Array.from({ length: days }, (_, index) => {
            const day = index + 1;
            const date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const active = date === selected;
            const hasEntries = entries.some((entry) => entry.date === date);
            return (
              <View key={day} style={styles.cell}>
                <Button
                  label={`Select ${date}${hasEntries ? ", has entries" : ""}`}
                  onPress={() => setSelected(date)}
                  style={[styles.day, active && styles.active]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      date === today && { color: Finn.purple },
                      active && { color: "#fff" },
                    ]}
                  >
                    {day}
                  </Text>
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: hasEntries
                          ? active
                            ? "#fff"
                            : Finn.amber
                          : "transparent",
                      },
                    ]}
                  />
                </Button>
              </View>
            );
          })}
        </View>
      </View>
      <Button
        label="Jump to today"
        onPress={() => {
          setSelected(today);
          setMonth(new Date(`${today.slice(0, 7)}-01T12:00:00`));
        }}
        style={{ marginTop: 12 }}
      >
        <Text style={{ color: Finn.purple, fontSize: 13 }}>Back to today</Text>
      </Button>
      <SectionLabel>
        {selected === today ? "Today" : selected} · {forDay.length} entries
      </SectionLabel>
      <View style={shared.card}>
        {forDay.length ? (
          forDay.map((entry) => (
            <View key={entry.id} style={styles.previewRow}>
              <Text numberOfLines={1} style={styles.previewNote}>
                {entry.note}
              </Text>
              <Text style={shared.subtle}>{money(entryTotal(entry))}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>
            Nothing written yet. A fresh page is waiting.
          </Text>
        )}
      </View>
    </AppSheet>
  );
}
const styles = StyleSheet.create({
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
    marginTop: 10,
  },
  month: {
    fontSize: 20,
    fontWeight: "600",
    color: Finn.ink,
    letterSpacing: -0.5,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: `${100 / 7}%`,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  weekday: { color: Finn.muted, fontSize: 11 },
  day: { minHeight: 43, width: 40, borderRadius: 16 },
  active: { backgroundColor: Finn.purple },
  dayText: { fontSize: 14, color: Finn.ink },
  dot: { height: 3, width: 3, borderRadius: 2, marginTop: 4 },
  previewRow: { flexDirection: "row", gap: 15, paddingVertical: 9 },
  previewNote: { flex: 1, fontSize: 13, color: Finn.ink },
  empty: { color: Finn.secondary, fontSize: 13, lineHeight: 21 },
});
