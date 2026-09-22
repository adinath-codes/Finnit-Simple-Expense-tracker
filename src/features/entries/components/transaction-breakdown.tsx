import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Finn, Categories, JournalType } from "@/constants/theme";
import { sheetStyles as shared } from "@/components/sheets/app-sheet";
import type { Category, EntryItem, JournalEntry } from "@/types/domain";
import { money } from "@/utils/currency";
export function TransactionBreakdown({
  entry,
  onChange,
}: {
  entry: JournalEntry;
  onChange: (entry: JournalEntry) => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [category, setCategory] = useState<Category>("other");
  const [categoryChanged, setCategoryChanged] = useState(false);
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<NonNullable<EntryItem["kind"]>>("item");
  const [pendingItem, setPendingItem] = useState<EntryItem | null>(null);
  const visibleItems = pendingItem ? [...entry.items, pendingItem] : entry.items;
  const valid =
    /^\d+(\.\d{1,2})?$/.test(amount) &&
    Number(amount) >= 0 &&
    Number.isSafeInteger(Number(quantity)) &&
    Number(quantity) > 0 &&
    Number(quantity) <= 999 && description.trim().length > 0;
  return (
    <View style={{ gap: 9 }}>
      {visibleItems.map((item) => (
        <View key={item.id} style={styles.card}>
          <Button
            label={`Expand ${item.name}`}
            onPress={() => setExpanded(expanded === item.id ? null : item.id)}
            style={styles.row}
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.amount}>
              {money(item.amountMinor)}
            </Text>
            <Icon
              name={expanded === item.id ? "up" : "down"}
              size={12}
              color={Finn.muted}
            />
          </Button>
          {expanded === item.id && (
            <>
              <View style={styles.metadata}>
                <ItemMetric
                  accent="#F5B82D"
                  icon="quantity"
                  label="Quantity"
                  value={String(item.quantity)}
                />
                <ItemMetric
                  accent="#F77B96"
                  icon="wallet"
                  label="Total"
                  value={money(item.amountMinor)}
                />
                {item.unitPriceMinor !== null && item.unitPriceMinor !== undefined && (
                  <ItemMetric
                    accent="#F77B96"
                    icon="wallet"
                    label="Per item"
                    value={money(item.unitPriceMinor)}
                  />
                )}
                <ItemMetric
                  accent={Categories[item.category].color}
                  icon={Categories[item.category].icon}
                  label="Category"
                  value={Categories[item.category].label}
                />
              </View>
              {editing === item.id ? (
                <View style={{ padding: 14, gap: 10 }}>
                  <View>
                    <Text style={styles.fieldLabel}>Description</Text>
                    <TextInput
                      accessibilityLabel="Line description"
                      value={description}
                      onChangeText={setDescription}
                      style={shared.input}
                    />
                  </View>
                  <View style={shared.row}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.fieldLabel}>Total amount</Text>
                      <TextInput
                        accessibilityLabel="Total amount"
                        keyboardType="decimal-pad"
                        value={amount}
                        onChangeText={setAmount}
                        style={shared.input}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Quantity</Text>
                      <TextInput
                        accessibilityLabel="Item quantity"
                        keyboardType="number-pad"
                        value={quantity}
                        onChangeText={setQuantity}
                        style={shared.input}
                      />
                    </View>
                  </View>
                  <View style={styles.categories}>
                    {(Object.keys(Categories) as Category[]).map((key) => (
                      <Button
                        key={key}
                        label={`Set category to ${Categories[key].label}`}
                        onPress={() => {
                          setCategory(key);
                          setCategoryChanged(true);
                        }}
                        style={[
                          styles.category,
                          category === key && {
                            backgroundColor: Finn.primarySoft,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            color:
                              category === key ? Finn.primary : Finn.secondary,
                          }}
                        >
                          {Categories[key].label}
                        </Text>
                      </Button>
                    ))}
                  </View>
                  {entry.receipt && (
                    <View style={styles.categories}>
                      {(["item", "tax", "tip", "fee", "discount"] as const).map((value) => (
                        <Button
                          key={value}
                          label={`Set line type to ${value}`}
                          onPress={() => setKind(value)}
                          style={[styles.category, kind === value && { backgroundColor: Finn.primarySoft }]}
                        >
                          <Text style={{ fontSize: 11, color: kind === value ? Finn.primary : Finn.secondary }}>
                            {value[0].toUpperCase() + value.slice(1)}
                          </Text>
                        </Button>
                      ))}
                    </View>
                  )}
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "flex-end",
                      gap: 20,
                    }}
                  >
                    <Button
                      label="Cancel item changes"
                      onPress={async () => {
                        if (pendingItem?.id === item.id) setPendingItem(null);
                        setEditing(null);
                      }}
                    >
                      <Text style={shared.subtle}>Cancel</Text>
                    </Button>
                    <Button
                      label="Save item changes"
                      disabled={!valid}
                      onPress={async () => {
                        const updated = {
                          ...item,
                          name: description.trim(),
                          quantity: Number(quantity),
                          amountMinor: (kind === "discount" ? -1 : 1) * Math.round(Number(amount) * 100),
                          unitPriceMinor: null,
                          category,
                          categoryId: categoryChanged ? category : item.categoryId,
                          kind,
                          amountMissing: false,
                        };
                        try {
                          await onChange({
                            ...entry,
                            status: "ready",
                            category: entry.items.every(current => current.id === item.id || current.category === category) ? category : "other",
                            items: pendingItem?.id === item.id
                              ? [...entry.items, updated]
                              : entry.items.map((current) => current.id === item.id ? updated : current),
                            thought:
                              "You updated this entry. The total now reflects your line amounts; your original note is preserved.",
                          });
                        } catch { return; }
                        if (pendingItem?.id === item.id) setPendingItem(null);
                        setEditing(null);
                      }}
                    >
                      <Text style={{ color: Finn.primary, fontWeight: "600" }}>
                        Save changes
                      </Text>
                    </Button>
                  </View>
                </View>
              ) : (
                <Button
                  label={`Edit ${item.name}`}
                  onPress={() => {
                    setEditing(item.id);
                    setDescription(item.name);
                    setAmount(String(Math.abs(item.amountMinor) / 100));
                    setQuantity(String(item.quantity));
                    setCategory(item.category);
                    setCategoryChanged(false);
                    setKind(item.kind ?? "item");
                  }}
                  style={styles.edit}
                >
                  <Text style={styles.editText}>
                    Edit line details
                  </Text>
                </Button>
              )}
              {entry.receipt && entry.items.length > 1 && pendingItem?.id !== item.id && (
                <Button
                  label={`Remove ${item.name}`}
                onPress={() => {
                  void Promise.resolve(onChange({
                    ...entry,
                    items: entry.items.filter((current) => current.id !== item.id),
                  })).catch(() => undefined);
                }}
                  style={styles.remove}
                >
                  <Text style={styles.removeText}>Remove line</Text>
                </Button>
              )}
            </>
          )}
        </View>
      ))}
      {entry.receipt && entry.items.length < 100 && pendingItem === null && (
        <Button
          label="Add receipt line"
          onPress={() => {
            const id = `${entry.id}-manual-${entry.items.length}`;
            setPendingItem({
              id,
              name: "New receipt line",
              quantity: 1,
              amountMinor: 0,
              category: "other",
              kind: "item",
              confidence: 1,
              needsReview: false,
              provisional: false,
            });
            setExpanded(id);
            setEditing(id);
            setDescription("New receipt line");
            setAmount("0");
            setQuantity("1");
            setCategory("other");
            setCategoryChanged(false);
            setKind("item");
          }}
          style={styles.addLine}
        >
          <Icon name="plus" size={14} color={Finn.primary} />
          <Text style={styles.addLineText}>Add line</Text>
        </Button>
      )}
    </View>
  );
}

function ItemMetric({
  accent,
  icon,
  label,
  value,
}: {
  accent: string;
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metric}>
      <Text numberOfLines={1} style={styles.value}>{value}</Text>
      <View style={styles.metricLabel}>
        <Icon animation={false} color={accent} name={icon} size={11} />
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: { borderRadius: 17, backgroundColor: Finn.surface, ...Finn.shadow },
  addLine: { borderColor: Finn.line, borderRadius: 17, borderWidth: 1, flexDirection: "row", gap: 7 },
  addLineText: { color: Finn.primary, fontFamily: JournalType.medium, fontSize: 13 },
  remove: { minHeight: 36 },
  removeText: { color: Finn.danger, fontFamily: JournalType.medium, fontSize: 12 },
  row: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: "row",
    gap: 9,
  },
  name: {
    flex: 1,
    fontFamily: JournalType.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Finn.ink,
  },
  amount: {
    fontFamily: JournalType.medium,
    fontSize: 14,
    color: Finn.ink,
    fontVariant: ["tabular-nums"],
  },
  metadata: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  metric: { alignItems: "center", flex: 1, minWidth: 0 },
  value: {
    fontFamily: JournalType.bold,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    color: Finn.ink,
  },
  metricLabel: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 3 },
  label: {
    fontSize: 10,
    color: Finn.secondary,
    textAlign: "center",
  },
  edit: { minHeight: 34, borderTopWidth: 1, borderColor: "#F8F4F1" },
  editText: { color: Finn.primary, fontFamily: JournalType.medium, fontSize: 11 },
  fieldLabel: { fontSize: 10, color: Finn.secondary, marginBottom: 6 },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  category: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: Finn.wash,
  },
});
