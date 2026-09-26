import { assertEquals } from "jsr:@std/assert@1.0.14";
import {
  correctionEntryContext,
  deriveAmountPreview,
  reconcileAnonymousParticipantCount,
  reconcileSingleAmountToken,
  resolveRelativeAmountCorrection,
} from "../functions/_shared/gemini.ts";
import type { CaptureInput, Extraction } from "../functions/_shared/contracts.ts";

function input(raw_text: string, currency = "INR"): CaptureInput {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    raw_text,
    captured_at: "2026-09-26T10:00:00.000Z",
    timezone: "Asia/Kolkata",
    currency,
    selected_date: "2026-09-26",
  };
}

function plan(overrides: Record<string, unknown> = {}) {
  return {
    transaction_ordinal: 0,
    description: "Coffee 120",
    amount_token: 0,
    quantity: null,
    quantity_evidence: null,
    quantity_unit: null,
    per_unit: false,
    estimated: false,
    confidence: 0.97,
    ambiguous: false,
    amount_role: "personal_total",
    group_total_token: null,
    user_share_token: null,
    paid_by_user_token: null,
    split_method: "not_applicable",
    split_evidence: null,
    participant_count: 1,
    components: [],
    ...overrides,
  };
}

Deno.test("personal and same-currency plans produce exact early totals", () => {
  assertEquals(deriveAmountPreview([plan()], input("Coffee 120")), {
    amount_minor: "12000",
    currency: "INR",
    scope: "personal_total",
    estimated: true,
    needs_review: false,
  });
  assertEquals(deriveAmountPreview([
    plan({ description: "Coffee 100", amount_token: 0 }),
    plan({ transaction_ordinal: 1, description: "Bus 50", amount_token: 1 }),
  ], input("Coffee 100 and Bus 50"))?.amount_minor, "15000");
  assertEquals(deriveAmountPreview([
    plan({ transaction_ordinal: 1, description: "Coffee 100", amount_token: 0 }),
    plan({ transaction_ordinal: 2, description: "Bus 50", amount_token: 1 }),
  ], input("Coffee 100 and Bus 50"))?.amount_minor, "15000");
});

Deno.test("quantity, components and equal split use exact server arithmetic", () => {
  assertEquals(deriveAmountPreview([
    plan({
      description: "₹100 each for 3 coffees",
      quantity: 3,
      quantity_evidence: "3",
      quantity_unit: "coffees",
      per_unit: true,
    }),
  ], input("₹100 each for 3 coffees"))?.amount_minor, "30000");

  assertEquals(deriveAmountPreview([
    plan({
      description: "2*100 + 1*20",
      amount_token: null,
      participant_count: 1,
      components: [{
        label: null,
        quantity: 2,
        quantity_evidence: "2",
        unit_amount_token: 0,
        semantic_role: "item",
        evidence: "2*100",
        confidence: 1,
        uncertain: false,
      }, {
        label: null,
        quantity: 1,
        quantity_evidence: "1",
        unit_amount_token: 1,
        semantic_role: "item",
        evidence: "1*20",
        confidence: 1,
        uncertain: false,
      }],
    }),
  ], input("2*100 + 1*20"))?.amount_minor, "22000");

  assertEquals(deriveAmountPreview([
    plan({
      description: "Dinner 1200 split equally with 3 people",
      amount_role: "group_total",
      group_total_token: 0,
      split_method: "equal",
      split_evidence: "split equally",
      participant_count: 3,
    }),
  ], input("Dinner 1200 split equally with 3 people"))?.scope, "user_share");
  assertEquals(deriveAmountPreview([
    plan({
      description: "Dinner 1200 split equally with 3 people",
      amount_role: "group_total",
      group_total_token: 0,
      split_method: "equal",
      split_evidence: "split equally",
      participant_count: 3,
    }),
  ], input("Dinner 1200 split equally with 3 people"))?.amount_minor, "40000");
});

Deno.test("group-only plans are labeled and unsafe combinations stay hidden", () => {
  assertEquals(deriveAmountPreview([
    plan({
      description: "Dinner group total 1200",
      amount_role: "group_total",
      group_total_token: 0,
      participant_count: null,
    }),
  ], input("Dinner group total 1200"))?.scope, "group_total");
  assertEquals(deriveAmountPreview([
    plan({ description: "Coffee", amount_token: null, amount_role: "unknown" }),
  ], input("Coffee")), null);
  assertEquals(deriveAmountPreview([
    plan({ description: "Coffee $10", amount_token: 0 }),
    plan({ transaction_ordinal: 1, description: "Taxi ₹20", amount_token: 1 }),
  ], input("Coffee $10 and Taxi ₹20")), null);
  assertEquals(deriveAmountPreview([
    plan({ description: "Personal 100", amount_token: 0 }),
    plan({
      transaction_ordinal: 1,
      description: "Group total 200",
      amount_token: 1,
      amount_role: "group_total",
      group_total_token: 1,
      participant_count: null,
    }),
  ], input("Personal 100 and Group total 200")), null);
});

Deno.test("anonymous participant totals are reconciled to the amount plan", () => {
  const participants = [{
    transaction_ordinal: 0,
    party_kind: "anonymous_group",
    participant_count: 3,
    uncertain: false,
  }, {
    transaction_ordinal: 0,
    party_kind: "self",
    participant_count: 1,
    uncertain: false,
  }];

  assertEquals(reconcileAnonymousParticipantCount(participants, 0, 3), [{
    transaction_ordinal: 0,
    party_kind: "anonymous_group",
    participant_count: 2,
    uncertain: true,
  }, participants[1]]);
});

Deno.test("participant reconciliation leaves named or ambiguous groups untouched", () => {
  const participants = [{
    transaction_ordinal: 1,
    party_kind: "known_person",
    participant_count: 1,
  }, {
    transaction_ordinal: 1,
    party_kind: "self",
    participant_count: 1,
  }];

  assertEquals(
    reconcileAnonymousParticipantCount(participants, 1, 3),
    participants,
  );
});

Deno.test("one grounded amount repairs only the authoritative plan token", () => {
  assertEquals(reconcileSingleAmountToken({
    amount_role: "group_total",
    amount_token: 1200,
    group_total_token: null,
    user_share_token: null,
    paid_by_user_token: null,
  }, 1, 1), {
    amount_role: "group_total",
    amount_token: null,
    group_total_token: 0,
    user_share_token: null,
    paid_by_user_token: null,
  });
});

Deno.test("single-amount repair does not guess across multiple transactions", () => {
  const plan = {
    amount_role: "group_total",
    amount_token: 1200,
    group_total_token: null,
    user_share_token: null,
    paid_by_user_token: null,
  };
  assertEquals(reconcileSingleAmountToken(plan, 2, 1), plan);
});

Deno.test("invalid indices, duplicate ownership and unsafe arithmetic emit no preview", () => {
  assertEquals(deriveAmountPreview([
    plan({ amount_token: 9 }),
  ], input("Coffee 120")), null);
  assertEquals(deriveAmountPreview([
    plan({ description: "Coffee 120" }),
    plan({ transaction_ordinal: 1, description: "120", amount_token: 0 }),
  ], input("Coffee 120")), null);
  assertEquals(deriveAmountPreview([
    plan({
      description: "100000*999999999",
      amount_token: null,
      participant_count: 1,
      components: [{
        label: null,
        quantity: 100000,
        quantity_evidence: "100000",
        unit_amount_token: 0,
        semantic_role: "item",
        evidence: "100000*999999999",
        confidence: 1,
        uncertain: false,
      }],
    }),
  ], input("100000*999999999")), null);
});

Deno.test("AI correction context includes the current amount and complete breakdown", () => {
  const current: Extraction = {
    transactions: [{
      description: "Dinner",
      amount_minor: "120000",
      currency: "INR",
      direction: "expense",
      cash_flow: "out",
      amount_status: "confirmed",
      category_id: "food.dining",
      category_source: "llm_fallback",
      merchant_id: null,
      occurred_on: "2026-09-26",
      quantity: 1,
      unit_price_minor: "120000",
      confidence: 1,
      needs_review: false,
      unresolved: [],
      person: null,
      evidence: "Dinner 1200",
      primary_amount_role: "group_total",
      group_total_minor: "120000",
      user_share_minor: "40000",
      paid_by_user_minor: "120000",
      split_method: "equal",
      participant_count: 3,
      quantity_unit: null,
      breakdown_approximate: true,
    }],
    people: [],
    contexts: [],
    unresolved: [],
    amount_components: [{
      transaction_ordinal: 0,
      ordinal: 0,
      label: "Dinner",
      quantity: 3,
      unit_price_minor: "40000",
      line_total_minor: "120000",
      semantic_role: "item",
      confidence: 1,
      evidence: { text: "Dinner 1200", start: 0, end: 11 },
      needs_review: false,
    }],
    participants: [{
      transaction_ordinal: 0,
      party_kind: "self",
      display_name: null,
      participant_count: 1,
      role: "participant",
      share_minor: "40000",
      share_percentage: null,
      split_method: "equal",
      confidence: 1,
      evidence: null,
      needs_review: false,
    }],
    allocations: [{
      transaction_ordinal: 0,
      participant_ordinal: 0,
      allocation_type: "share",
      amount_minor: "40000",
      confidence: 1,
      evidence: null,
      needs_review: false,
    }],
    interpretation_summary: "Dinner split equally among three people.",
  };

  const context = correctionEntryContext(current);
  assertEquals(context.transactions[0].amount_minor, "120000");
  assertEquals(context.transactions[0].user_share_minor, "40000");
  assertEquals(context.amount_components, current.amount_components);
  assertEquals(context.participants, current.participants);
  assertEquals(context.allocations, current.allocations);
  assertEquals(context.interpretation_summary, current.interpretation_summary);
});

Deno.test("relative percentage corrections resolve from the current saved amount", () => {
  const current: Extraction = {
    transactions: [{
      description: "Coffee",
      amount_minor: "25000",
      currency: "INR",
      direction: "expense",
      cash_flow: "out",
      amount_status: "confirmed",
      category_id: "food",
      category_source: "llm_fallback",
      merchant_id: null,
      occurred_on: "2026-09-26",
      quantity: 1,
      unit_price_minor: "25000",
      confidence: 1,
      needs_review: false,
      unresolved: [],
      person: null,
      evidence: "Coffee 250",
    }],
    people: [],
    contexts: [],
    unresolved: [],
  };

  assertEquals(
    resolveRelativeAmountCorrection("Increase the amount by 200%", current),
    {
      currency: "INR",
      targetMinor: "75000",
      evidence: "Server-resolved target amount: INR 750.00",
    },
  );
  assertEquals(
    resolveRelativeAmountCorrection("reduce it by 20%", current)?.targetMinor,
    "20000",
  );
});
