import { CURRENCIES } from "../../supabase/functions/_shared/contracts.ts";

export function money(
  amountMinor: number,
  amountCurrency = "INR",
  displayCurrency = amountCurrency,
) {
  const sign = amountMinor < 0 ? "-" : "";
  return `${sign}${currencySymbol(displayCurrency)}${moneyValue(Math.abs(amountMinor), amountCurrency)}`;
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
