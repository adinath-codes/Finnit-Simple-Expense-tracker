import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import type { SearchItem } from "../types/ask.types";
import { displayDay, exactMoney } from "../services/search-format";
export type SourceGroup = {
  key: string;
  note: string;
  day: string;
  items: SearchItem[];
};
export function groupSources(items: SearchItem[]): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();
  for (const item of items) {
    const key = `${item.entry_id}:${item.occurred_on}`;
    const group = groups.get(key) ?? {
      key,
      note: item.raw_text,
      day: item.occurred_on,
      items: [],
    };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}
export function SourceEntryCard({ group }: { group: SourceGroup }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.card}>
      <View style={styles.date}>
        <Icon name="note" size={14} color={Finn.muted} animation={false} />
        <Text style={styles.meta}>{displayDay(group.day)}</Text>
      </View>
      <Text style={styles.note} numberOfLines={expanded ? undefined : 3}>
        {group.note}
      </Text>
      {group.items.map((item) => (
        <View key={item.id} style={styles.item}>
          <View style={styles.description}>
            <Text style={styles.itemName}>{item.description}</Text>
            <Text style={styles.meta}>
              {[item.merchant_name, item.category_name]
                .filter(Boolean)
                .join(" · ")}
              {item.quantity
                ? ` · ${item.quantity} item${item.quantity === 1 ? "" : "s"}`
                : ""}
            </Text>
            {(item.needs_review || item.amount_status !== "confirmed") && (
              <Text style={styles.review}>
                Excluded from total ·{" "}
                {item.amount_status === "missing"
                  ? "amount needed"
                  : item.amount_status === "estimated"
                    ? "estimated amount"
                    : "needs review"}
              </Text>
            )}
            {expanded && item.unit_price_minor !== null && (
              <Text style={styles.meta}>
                {exactMoney(item.unit_price_minor, item.currency)} each
              </Text>
            )}
            {expanded && item.direction !== "expense" && (
              <Text style={styles.meta}>
                {item.direction} · {item.cash_flow}
              </Text>
            )}
          </View>
          <Text style={styles.amount}>
            {item.amount_minor === null
              ? "—"
              : exactMoney(item.amount_minor, item.currency)}
          </Text>
        </View>
      ))}
      <Button
        label={
          expanded
            ? "Collapse full note and item details"
            : "Show full note and item details"
        }
        onPress={() => setExpanded((v) => !v)}
        style={styles.expand}
      >
        <Text style={styles.expandText}>
          {expanded ? "Less detail" : "Full note & details"}
        </Text>
        <Icon name={expanded ? "up" : "down"} size={12} color={Finn.muted} />
      </Button>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: Finn.surface,
    borderRadius: 22,
    padding: 20,
    marginBottom: 12,
    ...Finn.shadow,
  },
  date: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    marginBottom: 10,
  },
  note: {
    fontFamily: JournalType.medium,
    fontSize: 17,
    lineHeight: 24,
    color: Finn.ink,
    marginBottom: 14,
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: Finn.line,
  },
  description: { flex: 1, gap: 5 },
  itemName: {
    fontFamily: JournalType.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Finn.ink,
  },
  amount: {
    fontFamily: JournalType.medium,
    fontSize: 16,
    color: Finn.ink,
    fontVariant: ["tabular-nums"],
    maxWidth: "45%",
  },
  meta: {
    fontFamily: JournalType.regular,
    fontSize: 12,
    lineHeight: 18,
    color: "#777172",
  },
  review: {
    fontFamily: JournalType.regular,
    fontSize: 12,
    lineHeight: 18,
    color: "#98672B",
  },
  expand: { flexDirection: "row", gap: 8, alignSelf: "flex-start" },
  expandText: {
    fontFamily: JournalType.medium,
    fontSize: 12,
    color: "#777172",
  },
});
