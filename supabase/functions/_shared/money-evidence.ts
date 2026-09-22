import { CURRENCIES } from "./contracts.ts";

const SYMBOLS: Record<string, string> = {
  "₹": "INR",
  rs: "INR",
  inr: "INR",
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "₩": "KRW",
};
const CURRENCY_CODE_PATTERN = Object.keys(CURRENCIES).join("|");
const AMOUNT = new RegExp(
  `(?:(₹|\\$|€|£|¥|₩|\\b(?:${CURRENCY_CODE_PATTERN}|Rs)\\.?)\\s*)?` +
    `(\\d+(?:[,.]\\d+)*)(?:[ \\t]*([kK])\\b)?\\s*` +
    `(${CURRENCY_CODE_PATTERN}|rs)?`,
  "gi",
);
const QUANTITY_UNITS =
  /^(?:\s*(?:[\p{L}-]+\s+){0,2}(?:coffees?|notebooks?|tickets?|items?|people|persons?|friends|rides?|trips?|days?|months?|years?|hours?|minutes?|km|kilometres?|litres?|kg|shirts?|books?|sandwiches?|bottles?|meals?)\b)/iu;

export type MoneyToken = {
  index: number;
  end: number;
  evidence: string;
  minor: string;
  currency: string;
  explicit: boolean;
};

/** Authoritative component arithmetic; the model supplies grounded operands only. */
export function componentLineTotal(
  unitMinor: string,
  quantity: number,
  role: "item" | "tax" | "tip" | "fee" | "discount",
) {
  if (!/^\d+$/.test(unitMinor) || !Number.isInteger(quantity) || quantity < 1)
    throw new RangeError("invalid_component_operand");
  const total = BigInt(unitMinor) * BigInt(quantity) *
    (role === "discount" ? -1n : 1n);
  if (total < -9007199254740991n || total > 9007199254740991n)
    throw new RangeError("component_total_out_of_range");
  return total.toString();
}

/** Convert grounded decimal evidence to exact integer minor units. */
export function decimalMinor(
  raw: string,
  currency: string,
  thousands = false,
): string | null {
  if (!(currency in CURRENCIES)) return null;
  if (
    raw.includes(",") &&
    !/^(?:\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d+)?$/.test(raw)
  ) return null;
  const normalized = raw.replaceAll(",", "");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const scale = CURRENCIES[currency] + (thousands ? 3 : 0);
  if (fraction.length > scale && /[1-9]/.test(fraction.slice(scale))) return null;
  const result = BigInt(whole) * 10n ** BigInt(scale) +
    BigInt(fraction.slice(0, scale).padEnd(scale, "0") || "0");
  return result <= 9007199254740991n ? result.toString() : null;
}

/** Locate possible price evidence. Gemini chooses which evidence belongs to
 * each transaction; this function does not infer categories or transactions. */
export function moneyTokens(note: string, defaultCurrency: string): MoneyToken[] {
  const out: MoneyToken[] = [];
  for (const match of note.matchAll(AMOUNT)) {
    if (match[2].length > 60) continue;
    const index = match.index!;
    const evidence = match[0].trim();
    const end = index + evidence.length;
    const before = note.slice(0, index);
    const after = note.slice(end);
    if (/[\d\w/.:+-]$/.test(before) || /^[\p{L}\p{N}/:%.-]/u.test(after)) continue;
    if (!match[1] && /\p{Sc}\s*$/u.test(before)) continue;
    const codeBefore = before.match(/\b([A-Z]{3})\s+$/)?.[1];
    const codeAfter = after.match(/^\s+([A-Z]{3})\b/)?.[1];
    if (
      !match[1] && !match[4] &&
      ((codeBefore && !(codeBefore in CURRENCIES)) ||
        (codeAfter && !(codeAfter in CURRENCIES)))
    ) continue;
    if (/\b(?:on|at|card|account|phone|order|invoice|ref|reference|id)\s*#?\s*$/i.test(before)) continue;
    if (!match[1] && !match[4] && QUANTITY_UNITS.test(after)) continue;
    if (
      !match[1] && !match[4] &&
      /^\s*[*×x]\s*(?:(?:₹|\$|€|£|¥|₩|\b[A-Z]{3}\b)\s*)?\d/iu.test(after)
    ) continue;
    if (!match[1] && !match[4] && !match[3] && match[2].replaceAll(",", "").length > 9) continue;
    const marker = (match[1] || match[4] || "").replace(".", "").toLowerCase();
    const currency = marker === "$" &&
        ["USD", "CAD", "AUD", "SGD", "HKD", "NZD"].includes(defaultCurrency)
      ? defaultCurrency
      : marker === "¥" && defaultCurrency === "CNY"
        ? "CNY"
        : (SYMBOLS[marker] ?? (marker ? marker.toUpperCase() : defaultCurrency));
    const amount = decimalMinor(match[2], currency, !!match[3]);
    if (amount !== null) out.push({
      index,
      end,
      evidence,
      minor: amount,
      currency,
      explicit: !!marker,
    });
  }
  return out;
}
