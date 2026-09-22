import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ZoomLink } from "@/components/navigation/zoom-link";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import type { SearchItem } from "../types/ask.types";
import { displayDay, exactMoney } from "../services/search-format";

/** One evidence card per matching transaction, even when a note contains several. */
export function SourceTransactionCard({ item }: { item: SearchItem }) {
  const [expanded, setExpanded] = useState(false);
  const amount = item.metric_confirmed === false || item.metric_minor == null
    ? "Needs review"
    : exactMoney(item.metric_minor, item.currency);
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.date}>{displayDay(item.occurred_on)}</Text>
        <Text style={[styles.amount, item.metric_confirmed === false && styles.review]}>{amount}</Text>
      </View>
      <Text style={styles.note} numberOfLines={expanded ? undefined : 3}>{item.raw_text}</Text>
      <Text style={styles.description}>{item.description}</Text>
      {!!(item.merchant_name || item.category_name) && (
        <Text style={styles.meta}>{[item.merchant_name, item.category_name].filter(Boolean).join(" · ")}</Text>
      )}
      {expanded && (
        <View style={styles.details}>
          {item.quantity && <Text style={styles.meta}>Quantity: {item.quantity} {item.quantity_unit ?? "items"}</Text>}
          {item.unit_price_minor != null && <Text style={styles.meta}>{exactMoney(item.unit_price_minor, item.currency)} each</Text>}
          {item.direction !== "expense" && <Text style={styles.meta}>{item.direction} · {item.cash_flow}</Text>}
          {(item.group_total_minor != null || item.user_share_minor != null) && (
            <Text style={styles.meta}>Group total: {item.group_total_minor == null ? "not recorded" : exactMoney(item.group_total_minor, item.currency)} · Your share: {item.user_share_minor == null ? "not recorded" : exactMoney(item.user_share_minor, item.currency)}</Text>
          )}
          {!!item.amount_components?.length && (
            <View style={styles.details}>
              {item.amount_components.map((component) => (
                <Text key={component.ordinal} style={styles.meta}>
                  {component.label} · {component.quantity} × {exactMoney(component.unit_price_minor, item.currency)} = {exactMoney(component.line_total_minor, item.currency)}
                </Text>
              ))}
            </View>
          )}
          {item.metric_confirmed === false && <Text style={styles.review}>Excluded from the calculated answer</Text>}
        </View>
      )}
      <View style={styles.actions}>
        <Button label={expanded ? "Hide transaction details" : "Show transaction details"} onPress={() => setExpanded((value) => !value)} style={styles.action}>
          <Text style={styles.actionText}>{expanded ? "Less detail" : "Details"}</Text>
          <Icon name={expanded ? "up" : "down"} size={12} color={Finn.muted} />
        </Button>
        <ZoomLink href={{ pathname: "/entries/[entryId]", params: { entryId: item.entry_id } }}>
          <Button label={`Open journal entry from ${displayDay(item.occurred_on)}`} style={styles.action}>
            <Text style={[styles.actionText, { color: Finn.primary }]}>Open entry</Text>
            <Icon name="arrow" size={12} color={Finn.primary} />
          </Button>
        </ZoomLink>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Finn.surface, borderRadius: 22, padding: 18, marginBottom: 12, ...Finn.shadow },
  top: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 },
  date: { fontFamily: JournalType.medium, fontSize: 12, color: Finn.secondary },
  amount: { fontFamily: JournalType.bold, fontSize: 20, color: Finn.ink, fontVariant: ["tabular-nums"], textAlign: "right", flexShrink: 1 },
  review: { color: "#98672B", fontFamily: JournalType.regular, fontSize: 12 },
  note: { fontFamily: JournalType.medium, fontSize: 16, lineHeight: 23, color: Finn.ink, marginBottom: 6 },
  description: { fontFamily: JournalType.regular, fontSize: 14, lineHeight: 20, color: Finn.ink },
  meta: { fontFamily: JournalType.regular, fontSize: 12, lineHeight: 18, color: Finn.secondary },
  details: { paddingTop: 10, gap: 3 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 14 },
  action: { flexDirection: "row", gap: 6, minHeight: 40 },
  actionText: { fontFamily: JournalType.medium, fontSize: 12, color: Finn.secondary },
});
