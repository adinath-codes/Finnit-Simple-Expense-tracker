import { ApiError, capture, extraction } from "../_shared/validation.ts";
import { parseNote } from "../_shared/parser.ts";
import { enrich } from "../_shared/gemini.ts";
import {
  catalog,
  metric,
  requireQuota,
  rpc,
  serve,
} from "../_shared/runtime.ts";
import type { SavedEntry } from "../_shared/contracts.ts";

function withApproximatePlace<T extends { contexts: string[] }>(
  value: T,
  approximatePlace?: string,
) {
  if (!approximatePlace || value.contexts.includes(approximatePlace)) return value;
  return { ...value, contexts: [...value.contexts.slice(0, 19), approximatePlace] };
}

serve(async (body, ctx) => {
  const input = capture(body);
  await requireQuota(ctx);
  // Idempotent retries return persisted interpretation without another model call.
  const { data: existing, error } = await ctx.db
    .from("journal_entries")
    .select("capture_request")
    .eq("id", input.id)
    .maybeSingle();
  if (error) throw error;
  if (existing) {
    const original = capture(existing.capture_request);
    const same =
      Object.keys(input).every(
        (key) =>
          input[key as keyof typeof input] ===
          original[key as keyof typeof original],
      ) &&
      Object.keys(original).every(
        (key) =>
          input[key as keyof typeof input] ===
          original[key as keyof typeof original],
      );
    if (!same) {
      throw new ApiError(409, "idempotency_conflict");
    }
    return {
      entry: await rpc(ctx.admin, "finn_entry_document", {
        p_user: ctx.userId,
        p_id: input.id,
      }),
      cached: true,
    };
  }
  const candidates = await catalog(ctx);
  const parsed = extraction(
    withApproximatePlace(parseNote(input, candidates), input.approximate_place),
    candidates.categories.map((c) => c.id),
    candidates.merchants.map((m) => m.id),
  );
  let entry = await rpc<SavedEntry>(ctx.admin, "finn_commit_entry", {
    p_user: ctx.userId,
    p_input: input,
    p_extraction: parsed,
    p_audit: {
      event: "deterministic_extraction",
      parser_version: 1,
      result: parsed,
    },
  });
  const difficult =
    parsed.unresolved.length > 0 ||
    parsed.transactions.some(
      (t) => t.confidence < 0.85 || t.unresolved.some((f) => f !== "amount"),
    );
  await metric(ctx, difficult ? "parser_needs_help" : "parser_success");
  if (!difficult || entry.revision !== 1 || entry.deleted_at)
    return { entry, cached: false };
  const claimed = await rpc<boolean>(ctx.admin, "finn_claim_enrichment", {
    p_user: ctx.userId,
    p_id: input.id,
    p_revision: 1,
  });
  if (!claimed) return { entry, cached: true };
  try {
    const { result, modelResult } = await enrich(ctx, input, candidates);
    const resultWithPlace = withApproximatePlace(result, input.approximate_place);
    entry = await rpc(ctx.admin, "finn_commit_entry", {
      p_user: ctx.userId,
      p_input: input,
      p_extraction: resultWithPlace,
      p_expected_revision: 1,
      p_audit: {
        event: "llm_extraction",
        parser_result: parsed,
        llm_result: modelResult,
        validated_result: resultWithPlace,
        model: Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash",
      },
    });
    return { entry, cached: false };
  } catch (error) {
    // Capture is already durable. A provider outage, invalid output or exhausted
    // quota can never roll back the raw note or replace it with guessed amounts.
    await metric(ctx, "enrichment_deferred");
    entry = await rpc(ctx.admin, "finn_entry_document", {
      p_user: ctx.userId,
      p_id: input.id,
    });
    return {
      entry,
      cached: false,
      warning:
        error instanceof ApiError && error.code === "ai_quota_exhausted"
          ? "ai_quota_exhausted"
          : "saved_with_deterministic_result",
    };
  }
});
