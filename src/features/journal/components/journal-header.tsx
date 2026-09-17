import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Button } from "@/components/ui/button";
import { BLUE_SPARKLE_COLORS } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import { JournalGlyph } from "./journal-glyph";
import { useJournal } from "@/providers/app-providers";
import { dayLabel } from "@/utils/dates";
export function JournalHeader() {
  const { selectedDate, today } = useJournal();
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        <View
          accessible
          accessibilityLabel="Finn"
          style={styles.mark}
        >
          <Image source={require("../../../../assets/images/journal/finn-mark.svg")} style={{ width: 40, height: 40 }} contentFit="contain" />
        </View>
      </View>
      <Button
        label="Choose journal date"
        onPress={() => router.push("/calendar")}
        style={styles.today}
      >
        <Text style={styles.todayText}>{dayLabel(selectedDate, today)}</Text>
      </Button>
      <View style={[styles.side, { alignItems: "flex-end" }]}>
        <Button
          label="Open settings, 785 calories placeholder"
          onPress={() => router.push("/settings")}
          style={styles.settings}
        >
          <JournalGlyph
            name="sparkle"
            size={14}
            colors={BLUE_SPARKLE_COLORS}
          />
          <Text style={styles.placeholder}>785 cal</Text>
          <JournalGlyph name="settings" size={18} />
        </Button>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 32,
  },
  side: { width: 112 },
  mark: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  today: {
    paddingHorizontal: 24,
    minHeight: 40,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.96)",
    boxShadow: "0px 5px 20px rgba(161, 125, 75, 0.10)",
  },
  todayText: { color: Finn.ink, fontFamily: JournalType.medium, fontSize: 16, fontWeight: "500", letterSpacing: -0.25, includeFontPadding: false },
  settings: {
    minHeight: 40,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.96)",
    boxShadow: "0px 5px 20px rgba(161, 125, 75, 0.10)",
  },
  placeholder: {
    fontFamily: JournalType.medium,
    fontSize: 14,
    fontWeight: "500",
    color: "#4F85D5",
    includeFontPadding: false,
    fontVariant: ["tabular-nums"],
  },
});
