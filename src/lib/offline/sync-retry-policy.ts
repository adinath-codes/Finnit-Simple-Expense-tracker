import type { SyncJob } from "@/types/sync";

export const MAX_AUTOMATIC_AI_VALIDATION_ATTEMPTS = 3;

const AI_VALIDATION_FAILURES = new Set([
  "ai_incomplete",
  "ai_invalid_json",
  "ai_invalid_output",
  "ai_invalid_stream",
  "component_token_reused_as_total",
  "correction_amount_mismatch",
  "duplicate_amount",
  "invalid_amount_components",
  "invalid_component_confidence",
  "invalid_component_role",
  "invalid_component_total",
  "invalid_equal_split",
  "invalid_field_confidence",
  "invalid_ignored_amounts",
  "invalid_model_transactions",
  "invalid_participant_count",
  "invalid_participants",
  "invalid_transaction_contexts",
  "invalid_transaction_ordinal",
  "mixed_component_currency",
  "participant_count_mismatch",
  "unexpected_split_evidence",
  "ungrounded_amount",
  "ungrounded_component",
  "ungrounded_component_amount",
  "ungrounded_component_label",
  "ungrounded_component_quantity",
  "ungrounded_context",
  "ungrounded_counterparty",
  "ungrounded_date",
  "ungrounded_description",
  "ungrounded_equal_split",
  "ungrounded_evidence",
  "ungrounded_merchant",
  "ungrounded_participant",
  "ungrounded_quantity",
  "ungrounded_quantity_unit",
  "ungrounded_unit_price",
  "unreconciled_amounts",
]);

export function jobRequiresAi(job: SyncJob) {
  if (job.endpoint === "parse-entry" || job.endpoint === "scan-receipt") return true;
  if (job.endpoint !== "correct-entry") return false;
  const action = (job.payload as { action?: unknown }).action;
  return action === "reparse" || action === "ai_correct";
}

/** Provider/network failures remain deferred indefinitely. Repeated, fully
 * formed model responses that fail the same safety boundary become an
 * explicit retry state instead of leaving an entry "processing" forever. */
export function exhaustedAiValidationRetries(
  job: SyncJob,
  errorCode: string,
  attemptsAfterFailure: number,
) {
  return jobRequiresAi(job) &&
    AI_VALIDATION_FAILURES.has(errorCode) &&
    attemptsAfterFailure >= MAX_AUTOMATIC_AI_VALIDATION_ATTEMPTS;
}
