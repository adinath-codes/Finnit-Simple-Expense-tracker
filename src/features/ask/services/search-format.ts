import { CURRENCIES } from "../../../../supabase/functions/_shared/contracts.ts";
import { displayDay } from "../../../utils/dates.ts";
/** Split arbitrary SQL sums exactly, without coercing large minor units to Number. */
export function exactMoneyParts(minor: string, currency: string) {
  const digits = CURRENCIES[currency] ?? 2;
  const amount = BigInt(minor),
    negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const scale = 10n ** BigInt(digits);
  const wholeDigits = (absolute / scale).toString();
  const head = wholeDigits.slice(0, -3);
  const whole = head
    ? `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${wholeDigits.slice(-3)}`
    : wholeDigits;
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
  const sign = negative ? "-" : "";
  return {
    label: `${sign}${symbol}${formatted}`,
    sign,
    symbol,
    value: formatted,
  };
}

/** Format arbitrary SQL sums exactly, without coercing large minor units to Number. */
export function exactMoney(minor: string, currency: string) {
  return exactMoneyParts(minor, currency).label;
}
export { displayDay };
export function timelineDateParts(day: string) {
  const [year, , date] = day.split("-").map(Number);
  const monthLabel = shortMonth.format(new Date(`${day}T12:00:00Z`)).toUpperCase();
  return {
    day: String(date),
    label: displayDay(day),
    month: monthLabel,
    year: String(year),
  };
}
export function periodLabel(start: string, end: string) {
  return `${displayDay(start)} – ${displayDay(inclusiveEndDate(end))}`;
}

const shortMonth = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

function dateParts(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return { year, month, date };
}

/** Compact visible label for the Ask Finn date trigger. */
export function compactPeriodLabel(
  start: string,
  exclusiveEnd: string,
  currentDay: string,
) {
  const end = inclusiveEndDate(exclusiveEnd);
  const first = dateParts(start);
  const last = dateParts(end);
  const currentYear = dateParts(currentDay).year;
  const firstMonth = shortMonth.format(new Date(`${start}T12:00:00Z`));
  const lastMonth = shortMonth.format(new Date(`${end}T12:00:00Z`));

  if (first.year === last.year && first.month === last.month) {
    const year = first.year === currentYear ? "" : `, ${first.year}`;
    return `${firstMonth} ${first.date}–${last.date}${year}`;
  }
  if (first.year === last.year) {
    const year = first.year === currentYear ? "" : `, ${first.year}`;
    return `${firstMonth} ${first.date}–${lastMonth} ${last.date}${year}`;
  }
  return `${firstMonth} ${first.date}, ${first.year}–${lastMonth} ${last.date}, ${last.year}`;
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

export function inclusiveEndDate(exclusiveEnd: string) {
  return offsetDay(exclusiveEnd, -1);
}

export function exclusiveEndDate(inclusiveEnd: string) {
  return offsetDay(inclusiveEnd, 1);
}
