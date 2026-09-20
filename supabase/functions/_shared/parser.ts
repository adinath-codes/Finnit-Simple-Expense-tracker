import {
  CURRENCIES,
  type CaptureInput,
  type Catalog,
  type Extraction,
  type Transaction,
} from "./contracts.ts";
import { localDay, parseDate } from "./dates.ts";

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
const UNITS =
  /^(?:\s*(?:coffees?|notebooks?|tickets?|items?|people|persons?|friends|days?|months?|years?|hours?|minutes?|km|kilometres?|litres?|kg|shirts?|books?|sandwiches?|bottles?|meals?)\b)/i;
export type MoneyToken = {
  index: number;
  end: number;
  evidence: string;
  minor: string;
  currency: string;
  explicit: boolean;
};

/** Strict grouping; ambiguous comma decimals are left for user correction. */
export function decimalMinor(
  raw: string,
  currency: string,
  thousands = false,
): string | null {
  if (!(currency in CURRENCIES)) return null;
  if (
    raw.includes(",") &&
    !/^(?:\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d+)?$/.test(raw)
  )
    return null;
  const normalized = raw.replaceAll(",", "");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const scale = CURRENCIES[currency] + (thousands ? 3 : 0);
  if (fraction.length > scale && /[1-9]/.test(fraction.slice(scale)))
    return null;
  const result =
    BigInt(whole) * 10n ** BigInt(scale) +
    BigInt(fraction.slice(0, scale).padEnd(scale, "0") || "0");
  return result <= 9007199254740991n ? result.toString() : null;
}
export function moneyTokens(
  note: string,
  defaultCurrency: string,
): MoneyToken[] {
  const out: MoneyToken[] = [];
  for (const m of note.matchAll(AMOUNT)) {
    if (m[2].length > 60) continue;
    const index = m.index!;
    const evidence = m[0].trim();
    const end = index + evidence.length;
    const before = note.slice(0, index);
    const after = note.slice(end);
    // Dates, ordinals, card/account numbers, phone numbers, versions and quantities are not money.
    if (/[\d\w/.:+-]$/.test(before) || /^[\p{L}\p{N}/:%.-]/u.test(after))
      continue;
    if (!m[1] && /\p{Sc}\s*$/u.test(before)) continue;
    // Unsupported explicit currency codes must never inherit the base currency.
    const codeBefore = before.match(/\b([A-Z]{3})\s+$/)?.[1];
    const codeAfter = after.match(/^\s+([A-Z]{3})\b/)?.[1];
    if (
      !m[1] &&
      !m[4] &&
      ((codeBefore && !(codeBefore in CURRENCIES)) ||
        (codeAfter && !(codeAfter in CURRENCIES)))
    )
      continue;
    if (
      /\b(?:on|at|card|account|phone|order|invoice|ref|reference|id)\s*#?\s*$/i.test(
        before,
      )
    )
      continue;
    if (!m[1] && !m[4] && UNITS.test(after)) continue;
    if (!m[1] && !m[4] && !m[3] && m[2].replaceAll(",", "").length > 9)
      continue;
    const marker = (m[1] || m[4] || "").replace(".", "").toLowerCase();
    const currency =
      marker === "$" &&
      ["USD", "CAD", "AUD", "SGD", "HKD", "NZD"].includes(defaultCurrency)
        ? defaultCurrency
        : marker === "¥" && defaultCurrency === "CNY"
          ? "CNY"
          : (SYMBOLS[marker] ??
            (marker ? marker.toUpperCase() : defaultCurrency));
    const amount = decimalMinor(m[2], currency, !!m[3]);
    if (amount !== null)
      out.push({
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
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function uncertainIntent(note: string) {
  return /\b(did not|didn't|not paid|not yet|will|planning|plan to|want to|budget|would|could|maybe|if|costs|price)\b/i.test(note);
}
export function contains(haystack: string, needle: string) {
  return ` ${normalize(haystack)} `.includes(` ${normalize(needle)} `);
}
export function categorize(note: string, catalog: Catalog) {
  const userRule = [...catalog.rules]
    .sort((a, b) => b.merchant_key.length - a.merchant_key.length)
    .find((r) => contains(note, r.merchant_key));
  const aliases = [
    ...catalog.aliases,
    ...catalog.merchants.map((m) => ({
      alias: m.canonical_name,
      merchant_id: m.id,
      user_id: m.user_id,
    })),
  ].sort(
    (a, b) =>
      Number(!!b.user_id) - Number(!!a.user_id) ||
      b.alias.length - a.alias.length,
  );
  const alias = aliases.find((a) => contains(note, a.alias));
  const merchant = catalog.merchants.find((m) => m.id === alias?.merchant_id);
  if (userRule)
    return {
      category_id: userRule.category_id,
      merchant_id: merchant?.id ?? null,
      category_source: "user_correction" as const,
      confidence: 1,
    };
  if (merchant)
    return {
      category_id: merchant.default_category_id,
      merchant_id: merchant.id,
      category_source: "merchant_rule" as const,
      confidence: 0.98,
    };
  const keywords: [string, RegExp][] = [
    [
      "food",
      /\b(coffees?|lunch|dinner|breakfast|groceries|food|restaurant|sandwich|tea|swiggy|zomato|starbucks)\b/i,
    ],
    [
      "transport",
      /\b(metro|cab|petrol|parking|bus|taxi|fuel|train|uber|ola|rapido)\b/i,
    ],
    [
      "bills",
      /\b(rent|wi[ -]?fi|electricity|water bill|internet bill|utilities)\b/i,
    ],
    ["shopping", /\b(shoes|clothes|keyboard|notebooks?|shopping)\b/i],
    ["software", /\b(domain|hosting|software|api credits)\b/i],
    ["health", /\b(medicine|doctor|hospital|pharmacy|dentist)\b/i],
    ["education", /\b(tuition|course|school fees|textbook)\b/i],
    ["travel", /\b(hotel|flight|airbnb|resort)\b/i],
    ["entertainment", /\b(movie|cinema|concert|game)\b/i],
    ["subscriptions", /\b(subscription|renewed|membership|netflix|spotify)\b/i],
  ];
  const category =
    keywords.find(([, pattern]) => pattern.test(note))?.[0] ?? "other";
  return {
    category_id: category,
    merchant_id: null,
    category_source:
      category === "other"
        ? ("unresolved" as const)
        : ("keyword_rule" as const),
    confidence: category === "other" ? 0.4 : 0.9,
  };
}
function direction(note: string): Pick<Transaction, "direction" | "cash_flow"> {
  if (/\b(paid\b.{0,70}\bback|repaid|repayment|reimbursed)\b/i.test(note)) {
    const incoming =
      /\b(?:\w+ paid me back|got paid back|received repayment|reimbursed me)\b/i.test(
        note,
      );
    const outgoing =
      /\b(?:i paid|paid \w+ .*back|paid back|i repaid|repaid)\b/i.test(note);
    return {
      direction: "repayment",
      cash_flow: incoming ? "in" : outgoing ? "out" : "unknown",
    };
  }
  if (/\b(lent|loaned|owes me)\b/i.test(note))
    return { direction: "lent", cash_flow: "out" };
  if (/\b(borrowed|i owe)\b/i.test(note))
    return { direction: "borrowed", cash_flow: "in" };
  if (/\b(moved|transferred|transfer)\b/i.test(note))
    return { direction: "transfer", cash_flow: "internal" };
  if (
    /\b(salary|got paid|client paid|received|refund|earned|income)\b/i.test(
      note,
    )
  )
    return { direction: "income", cash_flow: "in" };
  return { direction: "expense", cash_flow: "out" };
}
export function extractPeople(note: string, catalog: Catalog): string[] {
  const known = catalog.people
    .filter((p) => contains(note, p.name))
    .map((p) => p.name);
  const withPeople = note.match(
    /\bwith\s+([\p{L}]+(?:\s+and\s+[\p{L}]+)*)(?=\s+(?:for\b|at\b|\d)|[,.;]|$)/iu,
  );
  if (withPeople) known.push(...withPeople[1].split(/\s+and\s+/i));
  const debtor = note.match(
    /\b(?:lent|borrowed from|paid|repaid)\s+([A-Z][\p{L}]+)\b/u,
  );
  if (debtor) known.push(debtor[1]);
  return [...new Set(known)]
    .filter((x) => !/^(friends|people|family|cash|back)$/i.test(x))
    .slice(0, 20);
}
export function parseNote(input: CaptureInput, catalog: Catalog): Extraction {
  const reference =
    input.selected_date ?? localDay(input.captured_at, input.timezone);
  const overallDate = parseDate(input.raw_text, reference);
  const people = extractPeople(input.raw_text, catalog);
  const contexts = catalog.contexts
    .filter((c) => contains(input.raw_text, c.name))
    .map((c) => c.name);
  const context = input.raw_text.match(
    /\b([\p{L}]+(?:\s+[\p{L}]+)?\s+(?:trip|project))\b/iu,
  );
  if (context) contexts.push(context[1]);
  // Split a conjunction only after its left side has an amount; names remain together.
  const chunks: string[] = [];
  let start = 0;
  for (const separator of input.raw_text.matchAll(
    /\s+(?:and|then)\s+|[,;]\s+(?=\D)|\n+/gi,
  )) {
    const left = input.raw_text.slice(start, separator.index);
    if (moneyTokens(left, input.currency).length) {
      chunks.push(left);
      start = separator.index! + separator[0].length;
    }
  }
  chunks.push(input.raw_text.slice(start));
  if (chunks.length > 30) chunks.splice(0, chunks.length, input.raw_text);
  const overallUnresolved: string[] = [];
  const hasBreakdown =
    /\b(total|of which|including|split|my share|discount|tax|tip|balance|remaining)\b/i.test(
      input.raw_text,
    ) ||
    (moneyTokens(input.raw_text, input.currency).length > 1 &&
      /\b(?:was shoes|was food|was for)\b/i.test(input.raw_text));
  if (hasBreakdown) overallUnresolved.push("amount_relationship");
  const transactions = chunks
    .filter((s) => s.trim())
    .map((chunk): Transaction => {
      const tokens = moneyTokens(chunk, input.currency);
      const t = tokens.length === 1 ? tokens[0] : null;
      const category = categorize(chunk, catalog);
      const kind = direction(chunk);
      if (
        category.category_source !== "user_correction" &&
        kind.direction !== "expense"
      ) {
        category.category_id =
          kind.direction === "income"
            ? "income"
            : kind.direction === "transfer"
              ? "transfer"
              : "debt";
        category.category_source = "keyword_rule";
        category.confidence = 0.95;
      }
      // Every relative phrase resolves against the original capture reference,
      // never against an already-shifted entry day (which would shift twice).
      const chunkDate = parseDate(chunk, reference);
      const when =
        chunkDate.specified || chunkDate.unresolved ? chunkDate : overallDate;
      const unresolved: string[] = [];
      if (uncertainIntent(input.raw_text)) unresolved.push("transaction_intent");
      if (tokens.length > 1) unresolved.push("multiple_amounts");
      if (when.unresolved || overallDate.unresolved) unresolved.push("date");
      if (hasBreakdown) unresolved.push("amount_relationship");
      if (category.category_id === "other") unresolved.push("category");
      if (kind.cash_flow === "unknown") unresolved.push("repayment_direction");
      if (
        kind.direction === "transfer" &&
        !/\b(my|between|own|savings|checking)\b/i.test(chunk)
      )
        unresolved.push("transfer_ownership");
      if (/\b(owes me|i owe)\b/i.test(chunk))
        unresolved.push("balance_or_new_loan");
      if (/\b(owe|lent|borrowed|repay|back)\b/i.test(chunk) && !people.length)
        unresolved.push("counterparty");
      const q = chunk.match(
        /\b(\d+)\s+(coffees?|notebooks?|tickets?|items?|shirts?|books?|sandwiches?|bottles?|meals?)\b/i,
      );
      const quantity =
        q && Number(q[1]) >= 1 && Number(q[1]) <= 100000 ? Number(q[1]) : null;
      const each = /\beach\b|per (?:item|ticket|coffee|notebook)\b/i.test(
        chunk,
      );
      if (each && !quantity) unresolved.push("quantity");
      let amount = t?.minor ?? null;
      const unit = each && quantity && amount ? amount : null;
      if (unit && quantity)
        amount = (BigInt(unit) * BigInt(quantity)).toString();
      if (amount && BigInt(amount) > 9007199254740991n) {
        amount = null;
        unresolved.push("amount_overflow");
      }
      if (hasBreakdown || tokens.length > 1 || (each && !quantity))
        amount = null;
      const approximate =
        /\b(around|about|approx(?:imately)?|roughly|estimate)\b/i.test(chunk);
      // Unsupported numeric formats must be visible, not silently mistaken for a zero.
      if (!amount) unresolved.push("amount");
      const categoryId =
        kind.direction === "income"
          ? "income"
          : kind.direction === "transfer"
            ? "transfer"
            : ["lent", "borrowed", "repayment"].includes(kind.direction)
              ? "debt"
              : category.category_id;
      return {
        description: chunk.trim(),
        amount_minor: amount,
        currency: t?.currency ?? input.currency,
        ...kind,
        amount_status:
          amount === null ? "missing" : approximate ? "estimated" : "confirmed",
        ...category,
        category_id:
          category.category_source === "user_correction"
            ? category.category_id
            : categoryId,
        occurred_on: when.day,
        quantity,
        unit_price_minor: amount === null ? null : unit,
        confidence: unresolved.length ? 0.4 : category.confidence,
        needs_review: unresolved.length > 0 || approximate,
        unresolved,
        person:
          ["lent", "borrowed", "repayment"].includes(kind.direction) &&
          people.length === 1
            ? people[0]
            : null,
        evidence: amount === null ? null : t!.evidence,
      };
    });
  return {
    transactions,
    people,
    contexts: [...new Set(contexts)].slice(0, 20),
    unresolved: overallUnresolved,
  };
}
