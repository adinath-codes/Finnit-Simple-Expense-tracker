import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { router } from "expo-router";
import { ZoomLink } from "@/components/navigation/zoom-link";
import { Button } from "@/components/ui/button";
import { Finn, JournalType } from "@/constants/theme";
import { useJournalActions } from "@/providers/app-providers";
import type { SearchItem } from "../types/ask.types";
import {
  exactMoney,
  exactMoneyParts,
  timelineDateParts,
} from "../services/search-format";

export function AskMoneyAmount({
  accessible = true,
  currency,
  displayCurrency = currency,
  minor,
  style,
}: {
  accessible?: boolean;
  currency: string;
  displayCurrency?: string;
  minor: string;
  style?: StyleProp<TextStyle>;
}) {
  const amount = exactMoneyParts(minor, currency, displayCurrency);
  return (
    <Text
      accessibilityLabel={amount.label}
      accessible={accessible}
      numberOfLines={1}
      style={style}
    >
      {amount.sign}
      <Text style={styles.moneySymbol}>{amount.symbol}</Text>
      {amount.value}
    </Text>
  );
}

/** One chronological evidence node. Content opens details; its date returns to that journal day. */
export function SourceTransactionRow({
  displayCurrency,
  item,
}: {
  displayCurrency: string;
  item: SearchItem;
}) {
  const { setSelectedDate } = useJournalActions();
  const date = timelineDateParts(item.occurred_on);
  const amountNeedsReview = item.metric_confirmed === false || item.metric_minor == null;
  const amountLabel = amountNeedsReview
    ? "Needs review"
    : exactMoney(item.metric_minor!, item.currency, displayCurrency);

  const openJournalDay = () => {
    setSelectedDate(item.occurred_on);
    router.dismissTo("/");
  };

  return (
    <View style={styles.timelineItem}>
      <View pointerEvents="none" style={styles.rail} />

      <Button
        accessibilityHint="Returns to the journal on this date"
        label={`Open journal for ${date.label}`}
        onPress={openJournalDay}
        style={styles.dateNode}
      >
        <Text style={styles.dateMonth}>{date.month}</Text>
        <Text style={styles.dateDay}>{date.day}</Text>
      </Button>

      <View style={styles.transactionLink}>
        <ZoomLink href={{ pathname: "/entries/[entryId]", params: { entryId: item.entry_id } }}>
          <Button
            accessibilityHint="Opens this transaction in the entry details bottom sheet"
            label={`Open ${item.description}, ${date.label}, ${amountLabel}`}
            style={styles.transaction}
          >
            <Text ellipsizeMode="tail" numberOfLines={1} style={styles.description}>
              {item.description}
            </Text>
            {amountNeedsReview ? (
              <Text numberOfLines={1} style={styles.reviewAmount}>Needs review</Text>
            ) : (
              <AskMoneyAmount
                accessible={false}
                currency={item.currency}
                displayCurrency={displayCurrency}
                minor={item.metric_minor!}
                style={styles.amount}
              />
            )}
          </Button>
        </ZoomLink>
      </View>
    </View>
  );
}

const NODE_SIZE = 58;

const styles = StyleSheet.create({
  timelineItem: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    position: "relative",
  },
  rail: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: NODE_SIZE / 2 - 1,
    width: 2,
    backgroundColor: Finn.line,
  },
  dateNode: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    minHeight: NODE_SIZE,
    flexShrink: 0,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 1,
    borderColor: Finn.line,
    backgroundColor: Finn.surface,
    ...Finn.shadow,
  },
  dateMonth: {
    color: Finn.secondary,
    fontFamily: JournalType.bold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.7,
  },
  dateDay: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 18,
    lineHeight: 21,
    fontVariant: ["tabular-nums"],
  },
  transactionLink: { minWidth: 0, flex: 1 },
  transaction: {
    minWidth: 0,
    flex: 1,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  description: {
    minWidth: 0,
    flex: 1,
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  amount: {
    flexShrink: 0,
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  moneySymbol: { color: Finn.primary },
  reviewAmount: {
    flexShrink: 0,
    color: "#98672B",
    fontFamily: JournalType.medium,
    fontSize: 11,
    textAlign: "right",
  },
});
