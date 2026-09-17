import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Finn, Categories, JournalType } from "@/constants/theme";
import { sheetStyles as shared } from "@/components/sheets/app-sheet";
import type { Category, JournalEntry } from "@/types/domain";
import { money } from "@/utils/currency";
export function TransactionBreakdown({
  entry,
  onChange,
}: {
  entry: JournalEntry;
  onChange: (entry: JournalEntry) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [category, setCategory] = useState<Category>("other");
  const valid =
    /^\d+(\.\d{1,2})?$/.test(amount) &&
    Number(amount) >= 0 &&
    Number.isSafeInteger(Number(quantity)) &&
    Number(quantity) > 0 &&
    Number(quantity) <= 999;
  return (
    <View style={{ gap: 9 }}>
      {entry.items.map((item) => (
        <View key={item.id} style={styles.card}>
          <Button
            label={`Expand ${item.name}`}
            onPress={() => setExpanded(expanded === item.id ? null : item.id)}
            style={styles.row}
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.amount}>
              {money(item.amountMinor * item.quantity)}
            </Text>
            <Icon
              name="down"
              size={12}
              color={Finn.muted}
            />
          </Button>
          {expanded === item.id && (
            <>
              <View style={styles.metadata}>
                <View>
                  <Text style={styles.value}>{item.quantity}</Text>
                  <Text style={styles.label}>Quantity</Text>
                </View>
                <View>
                  <Text style={styles.value}>{money(item.amountMinor)}</Text>
                  <Text style={styles.label}>Per item</Text>
                </View>
                <View>
                  <Text
                    style={[
                      styles.value,
                      { color: Categories[item.category].color },
                    ]}
                  >
                    {Categories[item.category].label}
                  </Text>
                  <Text style={styles.label}>Category</Text>
                </View>
              </View>
              {editing === item.id ? (
                <View style={{ padding: 14, gap: 10 }}>
                  <View style={shared.row}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.fieldLabel}>Amount per item</Text>
                      <TextInput
                        accessibilityLabel="Amount per item"
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
                        onPress={() => setCategory(key)}
                        style={[
                          styles.category,
                          category === key && {
                            backgroundColor: Finn.purpleSoft,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            color:
                              category === key ? Finn.purple : Finn.secondary,
                          }}
                        >
                          {Categories[key].label}
                        </Text>
                      </Button>
                    ))}
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "flex-end",
                      gap: 20,
                    }}
                  >
                    <Button
                      label="Cancel item changes"
                      onPress={() => setEditing(null)}
                    >
                      <Text style={shared.subtle}>Cancel</Text>
                    </Button>
                    <Button
                      label="Save item changes"
                      disabled={!valid}
                      onPress={() => {
                        onChange({
                          ...entry,
                          status: "ready",
                          category: entry.items.every(current => current.id === item.id || current.category === category) ? category : "other",
                          items: entry.items.map((current) =>
                            current.id === item.id
                              ? {
                                  ...current,
                                  quantity: Number(quantity),
                                  amountMinor: Math.round(Number(amount) * 100),
                                  category,
                                }
                              : current,
                          ),
                          thought:
                            "You updated this entry. The total now reflects your amounts and quantities; your original note is preserved.",
                        });
                        setEditing(null);
                      }}
                    >
                      <Text style={{ color: Finn.purple, fontWeight: "600" }}>
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
                    setAmount(String(item.amountMinor / 100));
                    setQuantity(String(item.quantity));
                    setCategory(item.category);
                  }}
                  style={styles.edit}
                >
                  <Text style={{ fontSize: 11, color: Finn.purple }}>
                    Edit amount or category
                  </Text>
                </Button>
              )}
            </>
          )}
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { borderRadius: 17, backgroundColor: Finn.surface, ...Finn.shadow },
  row: {
    minHeight: 52,
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
    justifyContent: "space-around",
    paddingBottom: 12,
  },
  value: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    color: Finn.ink,
  },
  label: {
    fontSize: 9,
    color: Finn.secondary,
    textAlign: "center",
    marginTop: 4,
  },
  edit: { minHeight: 34, borderTopWidth: 1, borderColor: "#F8F4F1" },
  fieldLabel: { fontSize: 10, color: Finn.secondary, marginBottom: 6 },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  category: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: Finn.wash,
  },
});
