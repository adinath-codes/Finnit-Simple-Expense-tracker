import { CURRENCIES } from "../../supabase/functions/_shared/contracts.ts";

export function money(amountMinor: number, currency = "INR") {
  const digits = CURRENCIES[currency] ?? 2;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(amountMinor / 10 ** digits);
}

export function currencySymbol(currency = "INR") {
  return (
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency
  );
}

export function moneyValue(amountMinor: number, currency = "INR") {
  const digits = CURRENCIES[currency] ?? 2;
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: digits,
  }).format(amountMinor / 10 ** digits);
}
