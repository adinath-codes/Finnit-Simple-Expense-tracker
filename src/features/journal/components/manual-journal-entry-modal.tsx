import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Categories, Finn, JournalType } from "@/constants/theme";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import type { Category } from "@/types/domain";
import { currencySymbol } from "@/utils/currency";
import { CURRENCIES } from "../../../../supabase/functions/_shared/contracts";

export type ManualJournalEntry = {
  amountMinor: number;
  category: Category;
};

export function ManualJournalEntryModal({
  busy,
  currency,
  note,
  onDismiss,
  onSave,
}: {
  busy: boolean;
  currency: string;
  note: string | null;
  onDismiss: () => void;
  onSave: (entry: ManualJournalEntry) => void;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useMotionPreference();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("other");
  const minorDigits = CURRENCIES[currency] ?? 2;
  const amountPattern = minorDigits === 0
    ? /^\d+$/
    : new RegExp(`^\\d+(\\.\\d{1,${minorDigits}})?$`);
  const validAmount = amountPattern.test(amount) && Number(amount) > 0;

  useEffect(() => {
    if (note) {
      setAmount("");
      setCategory("other");
    }
  }, [note]);

  const close = () => {
    if (!busy) onDismiss();
  };

  return (
    <Modal
      animationType={reduced ? "none" : "fade"}
      navigationBarTranslucent
      onRequestClose={close}
      statusBarTranslucent
      transparent
      visible={note !== null}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="Cancel manual journal entry"
          accessibilityRole="button"
          disabled={busy}
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[styles.card, { marginBottom: Math.max(insets.bottom, 20) }]}
        >
          <Text accessibilityRole="header" style={styles.title}>Save manually</Text>
          <Text style={styles.body} numberOfLines={2}>{note}</Text>
          <Text style={styles.label}>Amount</Text>
          <TextInput
            accessibilityLabel={`Amount in ${currency}`}
            autoFocus
            editable={!busy}
            keyboardType="decimal-pad"
            onChangeText={setAmount}
            placeholder={`${currencySymbol(currency)}0${minorDigits ? `.${"0".repeat(minorDigits)}` : ""}`}
            placeholderTextColor={Finn.muted}
            selectionColor={Finn.primary}
            style={styles.input}
            value={amount}
          />
          <Text style={styles.label}>Category</Text>
          <View style={styles.categories}>
            {(Object.keys(Categories) as Category[]).map((value) => (
              <Button
                key={value}
                disabled={busy}
                label={`Choose ${Categories[value].label}`}
                onPress={() => setCategory(value)}
                style={[
                  styles.category,
                  category === value && styles.categorySelected,
                ]}
              >
                <Text style={[
                  styles.categoryText,
                  category === value && styles.categoryTextSelected,
                ]}>
                  {Categories[value].label}
                </Text>
              </Button>
            ))}
          </View>
          <Text style={styles.note}>
            This entry is saved deterministically. Nothing is sent to Google Gemini.
          </Text>
          <Button
            disabled={busy || !validAmount}
            label="Save manual journal entry"
            onPress={() => onSave({
              amountMinor: Math.round(Number(amount) * 10 ** minorDigits),
              category,
            })}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>{busy ? "Saving…" : "Save entry"}</Text>
          </Button>
          <Button disabled={busy} label="Cancel manual journal entry" onPress={close}>
            <Text style={styles.cancel}>Cancel</Text>
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(23, 23, 23, 0.24)",
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
  },
  card: {
    alignSelf: "center",
    backgroundColor: Finn.surface,
    borderRadius: 28,
    maxWidth: 440,
    paddingBottom: 12,
    paddingHorizontal: 24,
    paddingTop: 26,
    width: "100%",
    ...Finn.shadow,
  },
  title: { color: Finn.ink, fontFamily: JournalType.bold, fontSize: 23 },
  body: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  label: {
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 13,
    marginBottom: 7,
    marginTop: 18,
  },
  input: {
    backgroundColor: Finn.wash,
    borderColor: Finn.line,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 20,
    minHeight: 52,
    paddingHorizontal: 15,
  },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  category: {
    borderColor: Finn.line,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  categorySelected: { backgroundColor: Finn.primarySoft, borderColor: Finn.primary },
  categoryText: { color: Finn.secondary, fontFamily: JournalType.medium, fontSize: 12 },
  categoryTextSelected: { color: Finn.primary },
  note: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 18,
  },
  primary: { backgroundColor: Finn.primary, borderRadius: 16, marginTop: 18, minHeight: 50 },
  primaryText: { color: Finn.surface, fontFamily: JournalType.medium, fontSize: 15 },
  cancel: { color: Finn.secondary, fontFamily: JournalType.medium, fontSize: 14 },
});
