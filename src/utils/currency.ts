export function money(amountMinor: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: amountMinor % 100 ? 2 : 0,
  }).format(amountMinor / 100);
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

export function moneyValue(amountMinor: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: amountMinor % 100 ? 2 : 0,
  }).format(amountMinor / 100);
}
