import { CURRENCIES } from "../../../../supabase/functions/_shared/contracts";
/** Format arbitrary SQL sums exactly, without coercing large minor units to Number. */
export function exactMoney(minor: string, currency: string) {
  const digits = CURRENCIES[currency] ?? 2;
  const amount = BigInt(minor),
    negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const scale = 10n ** BigInt(digits);
  const whole = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(absolute / scale);
  const fraction = (absolute % scale).toString().padStart(digits, "0");
  const formatted =
    whole + (digits && absolute % scale !== 0n ? `.${fraction}` : "");
  const symbol =
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
    })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? currency;
  return `${negative ? "-" : ""}${symbol}${formatted}`;
}
export function displayDay(day: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}
export function periodLabel(start: string, end: string) {
  const last = new Date(`${end}T12:00:00Z`);
  last.setUTCDate(last.getUTCDate() - 1);
  return `${displayDay(start)} – ${displayDay(last.toISOString().slice(0, 10))}`;
}
export function monthRange(day: string, offset = 0) {
  const start = new Date(`${day.slice(0, 7)}-01T12:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() + offset);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return {
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  };
}

export function offsetDay(day: string, offset: number) {
  const value = new Date(`${day}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}
