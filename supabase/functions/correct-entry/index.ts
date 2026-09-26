import { ApiError, capture, extraction, object, text, uuid } from "../_shared/validation.ts";
import { normalize } from "../_shared/text.ts";
import {
  enrich,
  correctionInputHash,
  EXTRACTION_PROMPT_VERSION,
  EXTRACTION_SCHEMA_VERSION,
  extractionInputHash,
  geminiModel,
  resolveRelativeAmountCorrection,
} from "../_shared/gemini.ts";
import { withApproximatePlace } from "../_shared/entry-context.ts";
import { CURRENCIES } from "../_shared/contracts.ts";
import type { SavedEntry } from "../_shared/contracts.ts";
import { reconcileReceiptCorrection, validateReceiptCorrectionLines } from "../_shared/receipt.ts";
import { catalog, metric, requireQuota, rpc, serve } from "../_shared/runtime.ts";

serve(async (body, ctx) => {
  const operationId = uuid(body.operation_id);
  const revision = body.expected_revision;
  if (
    body.action !== "create_receipt_manual" &&
    (!Number.isInteger(revision) || Number(revision) < 1)
  ) {
    throw new ApiError(400, "invalid_revision");
  }
  if (body.action === "reparse") {
    const input = capture(body.input);
    if (uuid(body.id) !== input.id) throw new ApiError(400, "invalid_id");
    const previous = await rpc<{
      request: { input?: Record<string, unknown>; revision?: number };
    } | null>(ctx.admin, "finn_mutation_document", {
      p_user: ctx.userId,
      p_operation_id: operationId,
    });
    if (previous) {
      const saved = previous.request.input && capture(previous.request.input);
      const sameInput = saved &&
        Object.keys(input).every((key) =>
          input[key as keyof typeof input] === saved[key as keyof typeof saved]
        ) &&
        Object.keys(saved).every((key) =>
          input[key as keyof typeof input] === saved[key as keyof typeof saved]
        );
      if (
        previous.request.revision !== revision ||
        !sameInput
      ) throw new ApiError(409, "revision_or_idempotency_conflict");
      return {
        entry: await rpc<SavedEntry>(ctx.admin, "finn_entry_document", {
          p_user: ctx.userId,
          p_id: input.id,
        }),
        cached: true,
      };
    }
    await requireQuota(ctx);
    const { data: current, error } = await ctx.db.from("journal_entries")
      .select("original_text,revision,capture_request")
      .eq("id", input.id).maybeSingle();
    if (error) throw new ApiError(503, "database_unavailable");
    if (!current || current.original_text === null)
      throw new ApiError(404, "text_entry_not_found");
    if (current.revision !== revision)
      throw new ApiError(409, "revision_or_idempotency_conflict");
    const original = capture(current.capture_request);
    if (
      original.id !== input.id ||
      original.captured_at !== input.captured_at ||
      original.timezone !== input.timezone ||
      original.currency !== input.currency ||
      original.selected_date !== input.selected_date ||
      original.approximate_place !== input.approximate_place
    ) throw new ApiError(400, "invalid_capture_metadata");
    const inputHash = await extractionInputHash(input);
    const model = geminiModel("extraction");
    const claim = await rpc<string>(ctx.admin, "finn_claim_ai_operation", {
      p_user: ctx.userId,
      p_operation_id: operationId,
      p_task: "entry_reparse",
      p_entry_id: input.id,
      p_entry_revision: revision,
      p_input_hash: inputHash,
      p_schema_version: EXTRACTION_SCHEMA_VERSION,
      p_prompt_version: EXTRACTION_PROMPT_VERSION,
      p_model_version: model,
    });
    if (claim === "in_progress") throw new ApiError(503, "ai_in_progress");
    if (claim === "complete") {
      return {
        entry: await rpc<SavedEntry>(ctx.admin, "finn_entry_document", {
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
        candidates.categories.map((category) => category.id),
        candidates.merchants.map((merchant) => merchant.id),
      );
      const entry = await rpc<SavedEntry>(ctx.admin, "finn_commit_entry", {
        p_user: ctx.userId,
        p_input: input,
        p_extraction: interpreted,
        p_expected_revision: revision,
        p_operation_id: operationId,
        p_audit: {
          event: "gemini_reparse",
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
        p_operation_id: operationId,
        p_status: "complete",
        p_validation_code: null,
      });
      await metric(ctx, "gemini_reparse_saved");
      return { entry, cached: false };
    } catch (error) {
      await rpc(ctx.admin, "finn_finish_ai_operation", {
        p_user: ctx.userId,
        p_operation_id: operationId,
        p_status: "failed",
        p_validation_code: error instanceof ApiError ? error.code : "unknown",
      }).catch(() => undefined);
      throw error;
    }
  }
  if (body.action === "ai_correct") {
    const id = uuid(body.id);
    const instruction = text(body.instruction, 500).trim();
    const inputHash = await correctionInputHash({
      id,
      expectedRevision: Number(revision),
      instruction,
    });
    const model = geminiModel("extraction");
    const claim = await rpc<string>(ctx.admin, "finn_claim_ai_operation", {
      p_user: ctx.userId,
      p_operation_id: operationId,
      p_task: "entry_ai_correction",
      p_entry_id: id,
      p_entry_revision: revision,
      p_input_hash: inputHash,
      p_schema_version: EXTRACTION_SCHEMA_VERSION,
      p_prompt_version: EXTRACTION_PROMPT_VERSION,
      p_model_version: model,
    });
    if (claim === "in_progress") throw new ApiError(503, "ai_in_progress");
    if (claim === "complete") {
      return {
        entry: await rpc<SavedEntry>(ctx.admin, "finn_entry_document", {
          p_user: ctx.userId,
          p_id: id,
        }),
        cached: true,
      };
    }
    try {
      await requireQuota(ctx);
      const { data: current, error } = await ctx.db.from("journal_entries")
        .select("source_type,raw_text,revision,capture_request,extraction")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new ApiError(503, "database_unavailable");
      if (!current || current.source_type !== "text" || current.raw_text === null) {
        throw new ApiError(404, "text_entry_not_found");
      }
      if (current.revision !== revision) {
        throw new ApiError(409, "revision_or_idempotency_conflict");
      }
      const originalInput = capture(current.capture_request);
      const candidates = await catalog(ctx);
      const currentExtraction = extraction(
        current.extraction,
        candidates.categories.map((category) => category.id),
        candidates.merchants.map((merchant) => merchant.id),
      );
      const relativeAmount = resolveRelativeAmountCorrection(
        instruction,
        currentExtraction,
      );
      const correctionInput = {
        ...originalInput,
        raw_text: [
          current.raw_text,
          `User correction: ${instruction}`,
          relativeAmount?.evidence,
        ].filter(Boolean).join("\n"),
      };
      const { result, modelResult } = await enrich(
        ctx,
        correctionInput,
        candidates,
        {
          correctionInstruction: instruction,
          currentExtraction,
        },
      );
      const interpreted = extraction(
        withApproximatePlace(result, originalInput.approximate_place),
        candidates.categories.map((category) => category.id),
        candidates.merchants.map((merchant) => merchant.id),
      );
      for (const transaction of interpreted.transactions) {
        transaction.category_source = "user_correction";
      }
      const entry = await rpc<SavedEntry>(ctx.admin, "finn_commit_entry", {
        p_user: ctx.userId,
        // Keeping this input untouched preserves both the visible note and the
        // original source while the structured extraction is replaced.
        p_input: { ...originalInput, raw_text: current.raw_text },
        p_extraction: interpreted,
        p_expected_revision: revision,
        p_operation_id: operationId,
        p_audit: {
          event: "gemini_correction",
          model,
          model_role: "extraction",
          schema_version: EXTRACTION_SCHEMA_VERSION,
          prompt_version: EXTRACTION_PROMPT_VERSION,
          input_hash: inputHash,
          instruction,
          model_result: modelResult,
          validated_result: interpreted,
        },
      });
      await rpc(ctx.admin, "finn_finish_ai_operation", {
        p_user: ctx.userId,
        p_operation_id: operationId,
        p_status: "complete",
        p_validation_code: null,
      });
      await metric(ctx, "gemini_correction_saved");
      return { entry, cached: false };
    } catch (error) {
      await rpc(ctx.admin, "finn_finish_ai_operation", {
        p_user: ctx.userId,
        p_operation_id: operationId,
        p_status: "failed",
        p_validation_code: error instanceof ApiError ? error.code : "unknown",
      }).catch(() => undefined);
      throw error;
    }
  }
  await requireQuota(ctx);
  if (body.action === "create_receipt_manual") {
    const request = object(body.request);
    const entryId = uuid(request.entry_id);
    const attachmentId = uuid(request.attachment_id);
    if (uuid(body.id) !== entryId) throw new ApiError(400, "invalid_id");
    const capturedAt = text(request.captured_at, 40);
    if (!Number.isFinite(Date.parse(capturedAt))) throw new ApiError(400, "invalid_timestamp");
    const selectedDate = text(request.selected_date, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) throw new ApiError(400, "invalid_date");
    const timezone = text(request.timezone, 80);
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    } catch {
      throw new ApiError(400, "invalid_timezone");
    }
    const currency = text(body.currency, 3).toUpperCase();
    if (!Object.hasOwn(CURRENCIES, currency)) throw new ApiError(400, "unsupported_currency");
    const candidates = await catalog(ctx);
    const lines = validateReceiptCorrectionLines(
      body.lines,
      currency,
      candidates.categories.map((category) => category.id),
    );
    const total = body.printed_total_minor === null ? null : text(body.printed_total_minor, 16);
    if (total !== null && (!/^\d+$/.test(total) || BigInt(total) > 9007199254740991n)) {
      throw new ApiError(400, "invalid_receipt_total");
    }
    const reconciled = reconcileReceiptCorrection(lines, total, currency, selectedDate);
    const needsReview = lines.some((line) => line.needs_review) || !reconciled.reconciled;
    const entry = await rpc(ctx.admin, "finn_commit_receipt", {
      p_user: ctx.userId,
      p_request: {
        entry_id: entryId,
        attachment_id: attachmentId,
        captured_at: new Date(capturedAt).toISOString(),
        timezone,
        selected_date: selectedDate,
        default_currency: currency,
      },
      p_receipt: {
        status: needsReview ? "needs_review" : "complete",
        merchant_name: body.merchant_name === null
          ? null
          : text(body.merchant_name, 160).trim() || null,
        purchase_date_text: body.purchase_date_text === null
          ? null
          : text(body.purchase_date_text, 100).trim() || null,
        printed_subtotal_minor: body.printed_subtotal_minor,
        printed_total_minor: total,
        currency,
        confidence: 1,
        needs_review: needsReview,
        truncated: false,
        model: "manual",
      },
      p_lines: lines,
      p_extraction: reconciled.extraction,
      p_audit: { event: "manual_receipt", reconciled: reconciled.reconciled },
    });
    await metric(ctx, "manual_receipt", { metadata: { line_count: lines.length } });
    return { entry };
  }
  if (body.action === "delete") {
    return {
      entry: await rpc(ctx.admin, "finn_delete_entry", {
        p_user: ctx.userId,
        p_id: uuid(body.id),
        p_revision: revision,
        p_operation_id: operationId,
      }),
    };
  }
  if (body.action === "correct_receipt") {
    const id = uuid(body.id);
    const candidates = await catalog(ctx);
    const currency = text(body.currency, 3).toUpperCase();
    if (!Object.hasOwn(CURRENCIES, currency)) {
      throw new ApiError(400, "unsupported_currency");
    }
    const normalized = (value: unknown) => {
      if (value === null) return null;
      if (
        typeof value !== "string" || !/^\d{1,16}$/.test(value) || BigInt(value) > 9007199254740991n
      ) {
        throw new ApiError(400, "invalid_receipt_total");
      }
      return BigInt(value).toString();
    };
    const merchantName = body.merchant_name === null
      ? null
      : text(body.merchant_name, 160).trim() || null;
    const purchaseDate = body.purchase_date_text === null
      ? null
      : text(body.purchase_date_text, 100).trim() || null;
    const subtotal = normalized(body.printed_subtotal_minor);
    const total = normalized(body.printed_total_minor);
    const lines = validateReceiptCorrectionLines(
      body.lines,
      currency,
      candidates.categories.map((category) => category.id),
    );
    const { data: current, error } = await ctx.db.from("journal_entries")
      .select("source_type,occurred_on").eq("id", id).maybeSingle();
    if (error) throw new ApiError(503, "database_unavailable");
    if (!current || current.source_type !== "receipt") {
      throw new ApiError(404, "receipt_not_found");
    }
    const reconciled = reconcileReceiptCorrection(
      lines,
      total,
      currency,
      current.occurred_on,
    );
    const needsReview = lines.some((line) => line.needs_review) || !reconciled.reconciled;
    const entry = await rpc(ctx.admin, "finn_correct_receipt", {
      p_user: ctx.userId,
      p_id: id,
      p_revision: revision,
      p_operation_id: operationId,
      p_attachment: {
        merchant_name: merchantName,
        purchase_date_text: purchaseDate,
        printed_subtotal_minor: subtotal,
        printed_total_minor: total,
        currency,
        status: needsReview ? "needs_review" : "complete",
        needs_review: needsReview,
      },
      p_lines: lines,
      p_extraction: reconciled.extraction,
    });
    await metric(ctx, "receipt_correction", {
      metadata: { line_count: lines.length, reconciled: reconciled.reconciled },
    });
    return { entry };
  }
  if (body.action !== "correct") throw new ApiError(400, "invalid_action");
  const input = capture(body.input);
  const candidates = await catalog(ctx);
  const result = extraction(
    body.extraction,
    candidates.categories.map((c) => c.id),
    candidates.merchants.map((m) => m.id),
  );
  for (const transaction of result.transactions) {
    transaction.category_source = "user_correction";
    transaction.evidence = null;
    if (transaction.person && !result.people.includes(transaction.person)) {
      throw new ApiError(400, "person_not_linked");
    }
  }
  let rule: { merchant_key: string; category_id: string } | null = null;
  if (body.remember_rule) {
    const r = object(body.remember_rule);
    const merchantKey = normalize(text(r.merchant_key, 100));
    const categoryId = text(r.category_id, 50);
    if (
      !merchantKey ||
      !candidates.categories.some((c) => c.id === categoryId) ||
      !result.transactions.some((t) => t.category_id === categoryId)
    ) {
      throw new ApiError(400, "invalid_rule");
    }
    rule = { merchant_key: merchantKey, category_id: categoryId };
  }
  const entry = await rpc(ctx.admin, "finn_commit_entry", {
    p_user: ctx.userId,
    p_input: input,
    p_extraction: result,
    p_expected_revision: revision,
    p_operation_id: operationId,
    p_rule: rule,
    p_audit: { event: "user_correction", result, rule },
  });
  await metric(ctx, "user_correction", { metadata: { category_rule: !!rule } });
  return { entry };
});
