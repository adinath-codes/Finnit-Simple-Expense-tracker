import { ApiError, capture, extraction } from "../_shared/validation.ts";
import {
  enrich,
  EXTRACTION_PROMPT_VERSION,
  EXTRACTION_SCHEMA_VERSION,
  extractionInputHash,
  geminiModel,
} from "../_shared/gemini.ts";
import { withApproximatePlace } from "../_shared/entry-context.ts";
import {
  catalog,
  metric,
  requireQuota,
  rpc,
  serve,
} from "../_shared/runtime.ts";
import type { SavedEntry } from "../_shared/contracts.ts";

serve(async (body, ctx) => {
  const input = capture(body);
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
  await requireQuota(ctx);
  const inputHash = await extractionInputHash(input);
  const model = geminiModel("extraction");
  const claim = await rpc<string>(ctx.admin, "finn_claim_ai_operation", {
    p_user: ctx.userId,
    p_operation_id: input.id,
    p_task: "entry_extraction",
    p_entry_id: input.id,
    p_entry_revision: 0,
    p_input_hash: inputHash,
    p_schema_version: EXTRACTION_SCHEMA_VERSION,
    p_prompt_version: EXTRACTION_PROMPT_VERSION,
    p_model_version: model,
  });
  if (claim === "in_progress") throw new ApiError(503, "ai_in_progress");
  if (claim === "complete") {
    return {
      entry: await rpc(ctx.admin, "finn_entry_document", {
        p_user: ctx.userId,
        p_id: input.id,
      }),
      cached: true,
    };
  }
  try {
    const candidates = await catalog(ctx);
    const { result, modelResult } = await enrich(ctx, input, candidates);
    const interpreted = extraction(
      withApproximatePlace(result, input.approximate_place),
      candidates.categories.map((c) => c.id),
      candidates.merchants.map((m) => m.id),
    );
    const entry = await rpc<SavedEntry>(ctx.admin, "finn_commit_entry", {
      p_user: ctx.userId,
      p_input: input,
      p_extraction: interpreted,
      p_audit: {
        event: "gemini_extraction",
        model,
        model_role: "extraction",
        schema_version: EXTRACTION_SCHEMA_VERSION,
        prompt_version: EXTRACTION_PROMPT_VERSION,
        input_hash: inputHash,
        model_result: modelResult,
        validated_result: interpreted,
      },
    });
    await rpc(ctx.admin, "finn_finish_ai_operation", {
      p_user: ctx.userId,
      p_operation_id: input.id,
      p_status: "complete",
      p_validation_code: null,
    });
    await metric(ctx, "gemini_interpretation_saved");
    return { entry, cached: false };
  } catch (error) {
    await rpc(ctx.admin, "finn_finish_ai_operation", {
      p_user: ctx.userId,
      p_operation_id: input.id,
      p_status: "failed",
      p_validation_code: error instanceof ApiError ? error.code : "unknown",
    }).catch(() => undefined);
    throw error;
  }
});
