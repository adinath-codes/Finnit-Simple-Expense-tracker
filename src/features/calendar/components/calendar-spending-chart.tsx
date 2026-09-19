import {
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Categories,
  Finn,
  GoalRingPalette,
  JournalType,
} from "@/constants/theme";
import type { Category } from "@/types/domain";
import { money } from "@/utils/currency";
import { compactMoney } from "../services/calendar-service";

const CATEGORY_ORDER: Category[] = [
  "food",
  "transport",
  "shopping",
  "other",
];

const CATEGORY_EMOJIS: Record<Category, string> = {
  food: "🍔",
  transport: "🚗",
  shopping: "🛒",
  other: "🧾",
};

const CATEGORY_LABELS: Record<Category, string> = {
  food: "Food",
  transport: "Transport",
  shopping: "Shopping",
  other: "Other",
};

export function CalendarSpendingChart({
  categoryTotals,
  currency,
  monthLabel,
  totalMinor,
}: {
  categoryTotals: Record<Category, number>;
  currency: string;
  monthLabel: string;
  totalMinor: number;
}) {
  const largestTotal = Math.max(
    0,
    ...CATEGORY_ORDER.map((category) => categoryTotals[category]),
  );

  return (
    <View style={styles.card}>
      <View style={styles.totalRow}>
        <View>
          <Text style={styles.totalLabel}>Total spent</Text>
          <Text style={styles.totalMonth}>{monthLabel}</Text>
        </View>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          numberOfLines={1}
          style={styles.totalAmount}
        >
          {money(totalMinor, currency)}
        </Text>
      </View>
      <View style={styles.divider} />
      <Text accessibilityRole="header" style={styles.title}>
        By category
      </Text>
      <Text style={styles.subtitle}>Relative spending</Text>
      <View style={styles.chart}>
        {CATEGORY_ORDER.map((category) => {
          const amount = categoryTotals[category];
          const palette = GoalRingPalette.find(
            (item) => item.category === category,
          )!;
          const barHeight =
            amount > 0 && largestTotal > 0
              ? Math.max(32, (amount / largestTotal) * 150)
              : 0;

          return (
            <View
              accessible
              accessibilityLabel={`${Categories[category].label}, ${money(amount, currency)}`}
              key={category}
              style={styles.column}
            >
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                numberOfLines={1}
                style={styles.amount}
              >
                {compactMoney(amount, currency)}
              </Text>
              <View style={styles.barSlot}>
                {amount > 0 ? (
                  <View
                    style={[
                      styles.bar,
                      {
                        backgroundColor: palette.start,
                        height: barHeight,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.emojiBackdrop,
                        { backgroundColor: palette.end },
                      ]}
                    >
                      <Text style={styles.emoji}>
                        {CATEGORY_EMOJIS[category]}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.zeroMarker,
                      { backgroundColor: palette.end },
                    ]}
                  >
                    <Text style={styles.emoji}>
                      {CATEGORY_EMOJIS[category]}
                    </Text>
                  </View>
                )}
              </View>
              <Text numberOfLines={1} style={styles.label}>
                {CATEGORY_LABELS[category]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    padding: 18,
    borderRadius: 20,
    backgroundColor: Finn.surface,
    ...Finn.shadow,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  totalLabel: {
    fontFamily: JournalType.medium,
    fontSize: 11,
    color: Finn.secondary,
  },
  totalMonth: {
    marginTop: 4,
    fontFamily: JournalType.medium,
    fontSize: 14,
    color: Finn.ink,
  },
  totalAmount: {
    flexShrink: 1,
    fontFamily: JournalType.bold,
    fontSize: 22,
    color: Finn.primary,
    letterSpacing: -0.65,
    fontVariant: ["tabular-nums"],
  },
  divider: {
    height: 1,
    marginVertical: 18,
    backgroundColor: Finn.line,
  },
  title: {
    fontFamily: JournalType.bold,
    fontSize: 16,
    color: Finn.ink,
    letterSpacing: -0.25,
  },
  subtitle: {
    marginTop: 3,
    fontFamily: JournalType.regular,
    fontSize: 11,
    color: Finn.secondary,
  },
  chart: {
    height: 226,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 9,
  },
  column: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },
  amount: {
    width: "100%",
    minHeight: 18,
    marginBottom: 8,
    textAlign: "center",
    fontFamily: JournalType.medium,
    fontSize: 11,
    color: Finn.ink,
    fontVariant: ["tabular-nums"],
  },
  barSlot: {
    width: "100%",
    maxWidth: 58,
    height: 160,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bar: {
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
    borderRadius: 17,
  },
  emojiBackdrop: {
    width: 26,
    height: 26,
    marginBottom: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  zeroMarker: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  emoji: {
    fontSize: 15,
  },
  label: {
    width: "100%",
    marginTop: 9,
    textAlign: "center",
    fontFamily: JournalType.medium,
    fontSize: 11,
    color: Finn.ink,
  },
});
