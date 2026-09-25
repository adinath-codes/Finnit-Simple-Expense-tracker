import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Finn, JournalType } from "@/constants/theme";

export function TransactionCard({
  amount,
  amountNeedsReview = false,
  children,
  date,
  footer,
  message,
  messageLines,
}: {
  amount: string;
  amountNeedsReview?: boolean;
  children?: ReactNode;
  date: string;
  footer?: ReactNode;
  message: string;
  messageLines?: number;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.date}>{date}</Text>
        <Text
          style={[
            styles.amount,
            amountNeedsReview && styles.reviewAmount,
          ]}
        >
          {amount}
        </Text>
      </View>
      <Text
        numberOfLines={messageLines}
        style={styles.message}
      >
        {message}
      </Text>
      {children}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Finn.surface,
    borderRadius: 22,
    padding: 18,
    marginBottom: 12,
    ...Finn.shadow,
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  date: {
    fontFamily: JournalType.medium,
    fontSize: 12,
    color: Finn.secondary,
  },
  amount: {
    flexShrink: 1,
    fontFamily: JournalType.bold,
    fontSize: 20,
    color: Finn.ink,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  reviewAmount: {
    color: "#98672B",
    fontFamily: JournalType.regular,
    fontSize: 12,
  },
  message: {
    fontFamily: JournalType.medium,
    fontSize: 16,
    lineHeight: 23,
    color: Finn.ink,
    marginBottom: 6,
  },
});
