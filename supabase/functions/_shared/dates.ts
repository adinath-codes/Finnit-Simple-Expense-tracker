import { date } from "./validation.ts";

export function localDay(timestamp: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const part = (key: string) => parts.find((p) => p.type === key)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function shiftDay(day: string, amount: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export function monthStart(day: string, offset = 0): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 10);
}
export function parseDate(
  note: string,
  reference: string,
): { day: string; unresolved: boolean; specified: boolean } {
  const lower = note.toLowerCase();
  const exact = lower.match(/\b\d{4}-\d{2}-\d{2}\b/g);
  if (exact) {
    try {
      return {
        day: date(exact[0]),
        unresolved: new Set(exact).size > 1,
        specified: true,
      };
    } catch {
      return { day: reference, unresolved: true, specified: true };
    }
  }
  if (/\byesterday\b/.test(lower))
    return {
      day: shiftDay(reference, -1),
      unresolved: /\btoday\b/.test(lower),
      specified: true,
    };
  if (/\btoday\b/.test(lower))
    return { day: reference, unresolved: false, specified: true };
  const weekday = lower.match(
    /\blast (sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
  );
  if (weekday) {
    const index = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ].indexOf(weekday[1]);
    return {
      day: shiftDay(
        reference,
        -(
          (new Date(`${reference}T12:00:00Z`).getUTCDay() - index + 7) % 7 || 7
        ),
      ),
      unresolved: false,
      specified: true,
    };
  }
  const ordinal = lower.match(/\bon (?:the )?(\d{1,2})(?:st|nd|rd|th)\b/);
  if (ordinal) {
    let month = monthStart(reference);
    if (Number(ordinal[1]) > Number(reference.slice(8)))
      month = monthStart(reference, -1);
    try {
      return {
        day: date(`${month.slice(0, 8)}${ordinal[1].padStart(2, "0")}`),
        unresolved: false,
        specified: true,
      };
    } catch {
      return { day: reference, unresolved: true, specified: true };
    }
  }
  return {
    day: reference,
    specified: false,
    unresolved:
      /\b(tomorrow|ago|last|next|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b|\d{1,2}[/]\d{1,2}/i.test(
        note,
      ),
  };
}
