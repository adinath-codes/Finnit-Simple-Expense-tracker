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
  cors,
  metric,
  requireQuota,
  rpc,
  serve,
  type Context,
} from "../_shared/runtime.ts";
import type {
  EntryAmountPreview,
  EntryParseEvent,
  SavedEntry,
} from "../_shared/contracts.ts";

type ParseResult = { entry: SavedEntry; cached: boolean };
type StreamCallbacks = {
  onAmountPreview?: (preview: EntryAmountPreview) => void | Promise<void>;
  onFirstOutput?: () => void | Promise<void>;
};

async function parseEntry(
  body: Record<string, unknown>,
  ctx: Context,
  callbacks: StreamCallbacks = {},
): Promise<ParseResult> {
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
    if (!same) throw new ApiError(409, "idempotency_conflict");
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
    const { result, modelResult } = await enrich(ctx, input, candidates, callbacks);
    const interpreted = extraction(
      withApproximatePlace(result, input.approximate_place),
      candidates.categories.map((category) => category.id),
      candidates.merchants.map((merchant) => merchant.id),
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
}

serve(async (body, ctx, request) => {
  if (!request.headers.get("accept")?.includes("application/x-ndjson")) {
    return parseEntry(body, ctx);
  }

  const startedAt = Date.now();
  const encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: EntryParseEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      let previewEmitted = false;
      try {
        const input = capture(body);
        const result = await parseEntry(body, ctx, {
          onFirstOutput: () => {
            metric(ctx, "entry_stream_first_output", {
              metadata: { duration_ms: Date.now() - startedAt },
            });
          },
          onAmountPreview: (preview) => {
            previewEmitted = true;
            emit({ type: "amount_preview", entry_id: input.id, preview });
            metric(ctx, "entry_stream_amount_preview", {
              metadata: { duration_ms: Date.now() - startedAt },
            });
          },
        });
        emit({ type: "final", ...result });
        metric(ctx, "entry_stream_final", {
          metadata: {
            duration_ms: Date.now() - startedAt,
            preview_emitted: previewEmitted,
          },
        });
      } catch (error) {
        const known = error instanceof ApiError;
        const status = known ? error.status : 500;
        const code = known ? error.code : "backend_unavailable";
        emit({
          type: "warning",
          code,
          retryable: code !== "ai_quota_exhausted" &&
            (status === 429 || status >= 500),
        });
        console.error(JSON.stringify({ event: "entry_stream_failed", code, status }));
      } finally {
        controller.close();
      }
    },
  }), {
    headers: {
      ...cors,
      "Cache-Control": "no-store",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
