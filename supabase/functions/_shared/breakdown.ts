import { CURRENCIES, type Extraction, type TransactionParticipant } from "./contracts.ts";

export type EqualShareResult = {
  otherShareMinor: string;
  selfShareMinor: string;
  approximate: boolean;
};

/** Split a group total without floating point. Whole major-unit totals stay in
 * whole major units where possible; any remainder belongs to the user. */
export function equalShares(
  totalMinor: string,
  currency: string,
  participantCount: number,
): EqualShareResult {
  if (!Number.isInteger(participantCount) || participantCount < 2) {
    throw new Error("invalid_participant_count");
  }
  const total = BigInt(totalMinor);
  const scale = 10n ** BigInt(CURRENCIES[currency] ?? 2);
  const useMajorUnits = total % scale === 0n && total / scale >= BigInt(participantCount);
  const divisor = BigInt(participantCount);
  const base = useMajorUnits
    ? total / scale / divisor * scale
    : total / divisor;
  const self = total - base * BigInt(participantCount - 1);
  return {
    otherShareMinor: base.toString(),
    selfShareMinor: self.toString(),
    approximate: base * divisor !== total,
  };
}

/** Applies the product decision that a bare group total plus a participant
 * count means an inferred equal split. This operates only on already-grounded
 * money and leaves the stated amount confirmed. */
export function inferEqualSplits(value: Extraction): Extraction {
  const oldParticipants = value.participants ?? [];
  const oldAllocations = value.allocations ?? [];
  const participants: NonNullable<Extraction["participants"]> = [];
  const allocations: NonNullable<Extraction["allocations"]> = [];

  value.transactions.forEach((transaction, transactionOrdinal) => {
    const count = transaction.participant_count ?? 0;
    const total = transaction.group_total_minor ??
      (transaction.primary_amount_role === "group_total" ? transaction.amount_minor : null);
    const inferred = count > 1 && total !== null &&
      (transaction.user_share_minor === null || transaction.user_share_minor === undefined) &&
      ["equal", "unknown", "not_applicable", undefined].includes(transaction.split_method);
    const sourceParticipants = oldParticipants
      .map((participant, index) => ({ participant, index }))
      .filter(({ participant }) => participant.transaction_ordinal === transactionOrdinal);

    if (!inferred) {
      const ordinalMap = new Map<number, number>();
      for (const { participant, index } of sourceParticipants) {
        ordinalMap.set(index, participants.length);
        participants.push(participant);
      }
      for (const allocation of oldAllocations.filter(
        (candidate) => candidate.transaction_ordinal === transactionOrdinal,
      )) {
        allocations.push({
          ...allocation,
          participant_ordinal: allocation.participant_ordinal === null
            ? null
            : ordinalMap.get(allocation.participant_ordinal) ?? null,
        });
      }
      return;
    }

    const shares = equalShares(total, transaction.currency, count);
    const splitWasInferred = transaction.split_method !== "equal";
    transaction.split_method = "equal";
    transaction.user_share_minor = shares.selfShareMinor;
    transaction.breakdown_approximate = splitWasInferred || shares.approximate;
    transaction.allocation_status = "complete";
    transaction.unresolved = transaction.unresolved.filter(
      (item) => item !== "user_share" && item !== "split_rounding",
    );
    transaction.needs_review = transaction.unresolved.length > 0 ||
      transaction.amount_status === "estimated";

    const known = sourceParticipants.filter(({ participant }) =>
      participant.party_kind === "known_person"
    ).slice(0, count - 1);
    const anonymousCount = Math.max(0, count - 1 - known.length);
    const inferredParticipants: TransactionParticipant[] = [
      ...known.map(({ participant }) => ({
        ...participant,
        participant_count: 1,
        role: "participant" as const,
        share_minor: shares.otherShareMinor,
        split_method: "equal" as const,
        needs_review: false,
      })),
      ...(anonymousCount > 0
        ? [{
            transaction_ordinal: transactionOrdinal,
            party_kind: "anonymous_group" as const,
            display_name: null,
            participant_count: anonymousCount,
            role: "participant" as const,
            share_minor: (BigInt(shares.otherShareMinor) * BigInt(anonymousCount)).toString(),
            share_percentage: null,
            split_method: "equal" as const,
            confidence: transaction.field_confidence?.participants ?? transaction.confidence,
            evidence: sourceParticipants.find(({ participant }) =>
              participant.party_kind === "anonymous_group"
            )?.participant.evidence ?? null,
            needs_review: false,
          }]
        : []),
      {
        transaction_ordinal: transactionOrdinal,
        party_kind: "self",
        display_name: null,
        participant_count: 1,
        role: "participant",
        share_minor: shares.selfShareMinor,
        share_percentage: null,
        split_method: "equal",
        confidence: transaction.field_confidence?.split ?? transaction.confidence,
        evidence: null,
        needs_review: false,
      },
    ];
    for (const participant of inferredParticipants) {
      const participantOrdinal = participants.length;
      participants.push(participant);
      allocations.push({
        transaction_ordinal: transactionOrdinal,
        participant_ordinal: participantOrdinal,
        allocation_type: "share",
        amount_minor: participant.share_minor!,
        confidence: participant.confidence,
        evidence: participant.evidence,
        needs_review: false,
      });
    }
    for (const allocation of oldAllocations.filter((candidate) =>
      candidate.transaction_ordinal === transactionOrdinal && candidate.allocation_type !== "share"
    )) {
      allocations.push({ ...allocation, participant_ordinal: null });
    }
  });

  return { ...value, participants, allocations };
}
