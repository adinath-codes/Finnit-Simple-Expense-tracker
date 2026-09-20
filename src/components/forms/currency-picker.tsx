import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import { currencySymbol } from "@/utils/currency";
import {
  CURRENCY_CATALOG,
  getCurrency,
  searchCurrencies,
  type CurrencyDefinition,
} from "../../../supabase/functions/_shared/currencies.ts";
import { useMemo, useState } from "react";
import { Keyboard, StyleSheet, Text, TextInput, View } from "react-native";

const QUICK_CODES = ["USD", "EUR", "CAD", "INR"] as const;

export function CurrencyPicker({
  selected,
  onSelect,
  autoFocus = true,
}: {
  selected?: string;
  onSelect: (currency: string) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const currencies = useMemo(() => {
    if (query.trim()) return searchCurrencies(query);
    const codes = new Set([selected, ...QUICK_CODES].filter(Boolean));
    return CURRENCY_CATALOG.filter(({ code }) => codes.has(code));
  }, [query, selected]);

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Icon name="search" size={16} color={Finn.muted} animation={false} />
        <TextInput
          accessibilityLabel="Search currencies"
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus={autoFocus}
          placeholder="Search by currency, code, or country"
          placeholderTextColor={Finn.muted}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
        />
        {query ? (
          <Button label="Clear currency search" onPress={() => setQuery("")}>
            <Icon name="close" size={14} color={Finn.muted} animation={false} />
          </Button>
        ) : null}
      </View>

      {currencies.length ? (
        currencies.map((currency) => (
          <CurrencyPickerRow
            key={currency.code}
            currency={currency}
            selected={selected === currency.code}
            onPress={() => {
              Keyboard.dismiss();
              onSelect(currency.code);
            }}
          />
        ))
      ) : (
        <Text accessibilityLiveRegion="polite" style={styles.emptyText}>
          No currencies found.
        </Text>
      )}
    </View>
  );
}

function CurrencyPickerRow({
  currency,
  selected,
  onPress,
}: {
  currency: CurrencyDefinition;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      label={`${currency.name}, ${currency.code}`}
      onPress={onPress}
      style={styles.option}
    >
      <View style={styles.optionCopy}>
        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
          {currency.name}
        </Text>
        <Text style={styles.optionDetail}>
          {currency.code} · {currencySymbol(currency.code)}
        </Text>
      </View>
      {selected ? <Icon name="check" color={Finn.primary} size={15} /> : null}
    </Button>
  );
}

export function currencyDisplay(code: string) {
  const currency = getCurrency(code);
  return currency ? `${currency.code} ${currencySymbol(currency.code)}` : code;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingBottom: 9,
    backgroundColor: "#FEFCFB",
  },
  searchBox: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Finn.line,
    backgroundColor: Finn.surface,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: Finn.ink,
    fontFamily: JournalType.regular,
    fontSize: 13,
  },
  option: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#EFEAE7",
  },
  optionCopy: { flex: 1, minWidth: 0 },
  optionLabel: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 13,
  },
  optionLabelSelected: {
    color: Finn.primary,
    fontFamily: JournalType.medium,
  },
  optionDetail: {
    marginTop: 2,
    color: Finn.muted,
    fontFamily: JournalType.regular,
    fontSize: 10,
  },
  emptyText: {
    paddingVertical: 18,
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 13,
    textAlign: "center",
  },
});
