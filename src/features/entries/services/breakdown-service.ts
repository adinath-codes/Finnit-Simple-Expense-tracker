import type { Extraction } from "../../../lib/supabase/database.types.ts";
import type { ReceiptLine } from "../../../lib/supabase/database.types.ts";
import type { EntryAllocationRow, EntryAmountTerm } from "../../../types/domain.ts";
import { CURRENCIES } from "../../../../supabase/functions/_shared/contracts.ts";
import { currencySymbol, moneyValue } from "../../../utils/currency.ts";

function displayUnit(totalMinor: number, currency: string, divisor: number) {
  const scale = 10 ** (CURRENCIES[currency] ?? 2);
  if (totalMinor % scale === 0 && totalMinor / scale >= divisor) {
    return Math.floor(totalMinor / scale / divisor) * scale;
  }
  return Math.floor(totalMinor / divisor);
}

export function deriveAmountBreakdown(
  extraction: Extraction,
  entryId: string,
): EntryAmountTerm[] {
  const components = extraction.amount_components ?? [];
  return extraction.transactions.flatMap((transaction, transactionOrdinal) => {
    const transactionComponents = components
      .filter((component) => component.transaction_ordinal === transactionOrdinal)
      .sort((a, b) => a.ordinal - b.ordinal);
    if (transactionComponents.length) {
      return transactionComponents.map((component) => ({
        id: `${entryId}-${transactionOrdinal}-component-${component.ordinal}`,
        factors: [component.quantity],
        unitAmountMinor: Number(component.unit_price_minor),
        currency: transaction.currency,
        approximate: false,
      }));
    }

    const total = Number(
      transaction.group_total_minor ?? transaction.amount_minor ?? 0,
    );
    const factors = [
      transaction.quantity && transaction.quantity > 1 ? transaction.quantity : null,
      transaction.participant_count && transaction.participant_count > 1
        ? transaction.participant_count
        : null,
    ].filter((value): value is number => value !== null);
    if (!factors.length) factors.push(1);
    const divisor = factors.reduce((product, factor) => product * factor, 1);
    const unitAmountMinor = displayUnit(total, transaction.currency, divisor);
    return [{
      id: `${entryId}-${transactionOrdinal}-amount`,
      factors,
      unitAmountMinor,
      currency: transaction.currency,
      approximate: transaction.breakdown_approximate === true ||
        unitAmountMinor * divisor !== total,
    }];
  });
}

/** Build receipt arithmetic only from normalized printed rows. */
export function deriveReceiptAmountBreakdown(
  lines: ReceiptLine[],
  entryId: string,
): EntryAmountTerm[] {
  return lines.map((line) => {
    const quantity = line.quantity ?? 1;
    const amountMinor = Number(line.amount_minor);
    const unitPriceMinor = line.unit_price_minor === null
      ? null
      : Number(line.unit_price_minor);
    const hasExactUnitPrice = line.kind !== "discount" &&
      line.quantity !== null &&
      unitPriceMinor !== null &&
      unitPriceMinor * quantity === amountMinor;

    return {
      id: `${entryId}-receipt-${line.id ?? line.ordinal}`,
      factors: [hasExactUnitPrice ? quantity : 1],
      unitAmountMinor: hasExactUnitPrice ? unitPriceMinor : amountMinor,
      currency: line.currency,
      approximate: line.needs_review || line.provisional,
    };
  });
}

export function amountBreakdownText(terms: EntryAmountTerm[]) {
  return terms.map((term) =>
    `${term.factors.join(" * ")} * ${currencySymbol(term.currency)}${moneyValue(term.unitAmountMinor, term.currency)}`
  ).join(" + ");
}

export function deriveAllocationRows(
  extraction: Extraction,
  entryId: string,
): EntryAllocationRow[] {
  const participants = extraction.participants ?? [];
  const rows: EntryAllocationRow[] = [];
  extraction.transactions.forEach((transaction, transactionOrdinal) => {
    if ((transaction.participant_count ?? 0) < 2) return;
    let friendNumber = 0;
    participants.forEach((participant, participantOrdinal) => {
      if (participant.transaction_ordinal !== transactionOrdinal || participant.share_minor === null) {
        return;
      }
      const transactionId = transaction.id ?? `${entryId}-${transactionOrdinal}`;
      if (participant.party_kind === "anonymous_group") {
        const count = participant.participant_count;
        const total = Number(participant.share_minor);
        const each = Math.floor(total / count);
        for (let index = 0; index < count; index += 1) {
          friendNumber += 1;
          rows.push({
            id: `${entryId}-${transactionOrdinal}-${participantOrdinal}-${index}`,
            transactionId,
            label: `Friend ${friendNumber}`,
            partyKind: "anonymous",
            amountMinor: index === count - 1 ? total - each * (count - 1) : each,
            currency: transaction.currency,
          });
        }
        return;
      }
      rows.push({
        id: `${entryId}-${transactionOrdinal}-${participantOrdinal}`,
        transactionId,
        label: participant.party_kind === "self"
          ? "You"
          : participant.display_name ?? `Friend ${++friendNumber}`,
        partyKind: participant.party_kind === "self" ? "self" : "known_person",
        amountMinor: Number(participant.share_minor),
        currency: transaction.currency,
      });
    });
  });
  return rows.sort((a, b) => Number(a.partyKind === "self") - Number(b.partyKind === "self"));
}
