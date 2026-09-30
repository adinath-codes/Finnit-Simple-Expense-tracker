import type { SearchPlan } from "@/lib/supabase/database.types";
import type { MoneyTotal, SearchResult } from "../types/ask.types";

export type EntityFilterChip = {
  kind: "merchant" | "category" | "person" | "context";
  value: string;
  label: string;
};

export type AnswerRow = {
  key: string;
  money: { minor: string; currency: string } | null;
  value: string | null;
  comparison: {
    currency: string;
    primary: string;
    previous: string;
    delta: string;
    percent?: number | null;
  } | null;
  caption: string;
};

export const ASK_FINN_AI_NOTICE =
  "AI may misinterpret questions. Review the filters and source entries before relying on an answer.";

function withTerminalPunctuation(value: string) {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

export function conversationalFinnCopy(message: string) {
  const copy = message.trim();
  if (!copy) return "I’m ready to help—try asking about a total, category, person, or time period.";
  if (/^(?:I\b|I[’']|Here\b|Here[’']|Let[’']s\b|You can\b|Try\b)/i.test(copy)) {
    return withTerminalPunctuation(copy);
  }
  return `Here’s what I found. ${withTerminalPunctuation(copy)}`;
}

export function sourceEvidenceCount(result: SearchResult | null) {
  return result?.evidence_count ?? result?.matching_count ?? 0;
}

export function unsupportedCopy(reason?: SearchResult["unsupported_reason"]) {
  switch (reason) {
    case "recurrence_status":
      return "Your journal can show subscription spending, but it cannot prove whether a subscription is currently active. Try “subscription spending this month”.";
    case "prediction":
      return "Finn only answers from recorded journal facts, so it won’t predict future spending.";
    case "external_data":
      return "This needs information outside your journal. Finn does not guess exchange rates or external facts.";
    case "missing_values":
      return "Missing amounts stay excluded until you confirm them; Finn will not estimate them.";
    case "causal_inference":
      return "Your journal records what happened, but it cannot establish why it happened.";
    default:
      return "This calculation cannot be answered reliably from the stored journal facts. Try asking for a total, count, average, ranking, breakdown, or period comparison.";
  }
}

export function buildAnswerRows(
  advanced: SearchResult["advanced_answer"],
  totals: MoneyTotal[],
): AnswerRow[] {
  if (!advanced) {
    return totals.filter((total) => total.confirmed_count > 0).map((total) => ({
      key: total.currency,
      money: { minor: total.total_minor, currency: total.currency },
      value: null,
      comparison: null,
      caption: totals.length > 1 ? total.currency : "",
    }));
  }
  return advanced.rows.map((row, index) => {
    const moneyMinor = row.value_minor ?? row.delta_minor;
    const money = moneyMinor != null && row.currency
      ? { minor: moneyMinor, currency: row.currency }
      : null;
    const value = money
      ? null
      : row.value_date
        ? new Date(`${row.value_date}T12:00:00Z`).toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
          })
        : row.value_count != null
          ? String(row.value_count)
          : row.label ?? "—";
    return {
      key: `${index}-${row.currency ?? row.label ?? ""}`,
      money,
      value,
      comparison: row.primary_minor != null && row.comparison_minor != null && row.currency
        ? {
            currency: row.currency,
            primary: row.primary_minor,
            previous: row.comparison_minor,
            delta: row.delta_minor ?? "0",
            percent: row.change_percent,
          }
        : null,
      caption: [
        row.label && (advanced.rows.length > 1 || row.label !== advanced.label)
          ? row.label
          : null,
        row.value_date && row.value_minor != null ? row.value_date : null,
        row.rounded ? "rounded to the nearest minor unit" : null,
        row.change_percent != null
          ? `${row.change_percent > 0 ? "+" : ""}${row.change_percent}%`
          : null,
        row.currency && advanced.rows.length > 1 ? row.currency : null,
      ].filter(Boolean).join(" · "),
    };
  });
}

export function factualFallbackExplanation(result: SearchResult | null) {
  if (!result) return "";
  if (result.matching_count === 0)
    return "I couldn’t find a match for that period. Try widening the dates or removing a filter.";
  const reviewCount = (result.totals ?? []).reduce(
    (sum, total) => sum + Number(total.review_count), 0,
  );
  const confirmedCount = (result.totals ?? []).reduce(
    (sum, total) => sum + Number(total.confirmed_count), 0,
  );
  const reviewSuffix = reviewCount
    ? ` I left out ${reviewCount} unconfirmed amount${reviewCount === 1 ? "" : "s"} so this stays based on confirmed records.`
    : "";
  switch (result.advanced_answer?.kind) {
    case "rank":
      return `I ranked the confirmed matching purchases for you.${reviewSuffix}`;
    case "breakdown":
      return `Here’s the breakdown I found in your confirmed journal records.${reviewSuffix}`;
    case "average":
      return `I calculated this average from exact confirmed totals and counts, then rounded it once to the currency’s smallest unit.${reviewSuffix}`;
    case "count":
      return "I counted every matching purchase in the selected period, including entries whose amount still needs review.";
    case "comparison":
      return `Here’s a like-for-like comparison using the same filters for both periods. The change is the selected period minus the previous one.${reviewSuffix}`;
    case "list":
      return "I found these matching journal entries for the selected period.";
    default:
      return `I found ${confirmedCount} confirmed transaction${confirmedCount === 1 ? "" : "s"} behind this answer.${reviewSuffix}`;
  }
}

export function entityFilterChips(
  plan: SearchPlan | undefined,
  labels: SearchResult["filter_labels"],
): EntityFilterChip[] {
  if (!plan) return [];
  return [
    ...(labels?.merchants ?? (plan.merchant_id && labels?.merchant
      ? [{ id: plan.merchant_id, label: labels.merchant }] : []))
      .map((item) => ({ kind: "merchant" as const, value: item.id, label: item.label })),
    ...(labels?.categories ?? (plan.category_id && labels?.category
      ? [{ id: plan.category_id, label: labels.category }] : []))
      .map((item) => ({ kind: "category" as const, value: item.id, label: item.label })),
    ...(plan.people ?? (plan.person ? [plan.person] : []))
      .map((name) => ({ kind: "person" as const, value: name, label: name })),
    ...(plan.contexts ?? (plan.context ? [plan.context] : []))
      .map((name) => ({ kind: "context" as const, value: name, label: name })),
  ];
}

export function withoutEntityFilter(
  plan: SearchPlan,
  kind: EntityFilterChip["kind"],
  value: string,
): SearchPlan {
  if (kind === "merchant") {
    const merchantIds = (plan.merchant_ids ?? (plan.merchant_id ? [plan.merchant_id] : []))
      .filter((id) => id !== value);
    return { ...plan, merchant_ids: merchantIds, merchant_id: merchantIds[0] ?? null };
  }
  if (kind === "category") {
    const categoryIds = (plan.category_ids ?? (plan.category_id ? [plan.category_id] : []))
      .filter((id) => id !== value);
    return { ...plan, category_ids: categoryIds, category_id: categoryIds[0] ?? null };
  }
  if (kind === "person") {
    const people = (plan.people ?? (plan.person ? [plan.person] : []))
      .filter((name) => name !== value);
    return { ...plan, people, person: people[0] ?? null };
  }
  const contexts = (plan.contexts ?? (plan.context ? [plan.context] : []))
    .filter((name) => name !== value);
  return { ...plan, contexts, context: contexts[0] ?? null };
}
