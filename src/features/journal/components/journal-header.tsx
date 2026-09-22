import { MaskedView } from "@expo/ui/community/masked-view";
import { ZoomLink } from "@/components/navigation/zoom-link";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Button } from "@/components/ui/button";
import { Finn, JournalType } from "@/constants/theme";
import { JournalGlyph } from "./journal-glyph";
import { useJournal } from "@/providers/app-providers";
import { dayLabel } from "@/utils/dates";

const ASK_GRADIENT_ID = "ask-finn-blue";

function AskFinnLabel() {
  const label = (
    <View pointerEvents="none" style={styles.askLabel}>
      <JournalGlyph name="sparkle" size={13} color="#000000" />
      <Text maxFontSizeMultiplier={1.3} style={styles.askText}>
        Ask Finn
      </Text>
    </View>
  );

  return Platform.OS === "web" ? (
    <View pointerEvents="none" style={styles.askLabel}>
      <JournalGlyph
        name="sparkle"
        size={13}
        colors={[Finn.blueSparkleStart, Finn.blueSparkleEnd]}
      />
      <Text style={[styles.askText, styles.askTextWeb]}>Ask Finn</Text>
    </View>
  ) : (
    <MaskedView pointerEvents="none" maskElement={label} style={styles.askLabelMask}>
      <Svg height="100%" width="100%">
        <Defs>
          <LinearGradient
            id={ASK_GRADIENT_ID}
            x1="0%"
            x2="100%"
            y1="0%"
            y2="0%"
          >
            <Stop offset="0" stopColor={Finn.blueSparkleStart} />
            <Stop offset="1" stopColor={Finn.blueSparkleEnd} />
          </LinearGradient>
        </Defs>
        <Rect
          fill={`url(#${ASK_GRADIENT_ID})`}
          height="100%"
          width="100%"
        />
      </Svg>
    </MaskedView>
  );
}

export function JournalHeader() {
  const { selectedDate, today } = useJournal();
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        <View accessible accessibilityLabel="Finn" style={styles.mark}>
          <Image
            source={require("../../../../assets/logo/short-light-bg.png")}
            style={styles.logo}
            contentFit="contain"
          />
        </View>
      </View>
      <ZoomLink href="/calendar"><Button
        label="Choose journal date"
        style={styles.today}
      >
        <Text style={styles.todayText}>{dayLabel(selectedDate, today)}</Text>
      </Button></ZoomLink>
      <View style={[styles.side, styles.actions]}>
        <Button
          label="Ask Finn"
          onPress={() => router.push("/search")}
          style={[styles.settings, styles.askButton]}
        >
          <AskFinnLabel />
        </Button>
        <ZoomLink href="/settings"><Button
          label="Open settings"
          style={styles.settings}
        >
          <JournalGlyph name="settings" size={18} />
        </Button></ZoomLink>
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
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 4 },
  mark: {
    width: 108,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 108,
    height: 48,
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
  todayText: {
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: -0.25,
    includeFontPadding: false,
  },
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
  askButton: { paddingHorizontal: 4 },
  askLabel: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3,
  },
  askLabelMask: {
    height: 20,
    width: 58,
  },
  askText: {
    color: "#000000",
    fontFamily: JournalType.medium,
    fontSize: 11,
    includeFontPadding: false,
    lineHeight: 20,
  },
  askTextWeb: { color: Finn.blueSparkleStart },
  placeholder: {
    fontFamily: JournalType.medium,
    fontSize: 14,
    fontWeight: "500",
    color: "#4F85D5",
    includeFontPadding: false,
    fontVariant: ["tabular-nums"],
  },
});
