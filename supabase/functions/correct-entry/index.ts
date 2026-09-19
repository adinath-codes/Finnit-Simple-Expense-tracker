import {
  capture,
  extraction,
  object,
  text,
  uuid,
  ApiError,
} from "../_shared/validation.ts";
import { normalize } from "../_shared/parser.ts";
import {
  catalog,
  metric,
  requireQuota,
  rpc,
  serve,
} from "../_shared/runtime.ts";

serve(async (body, ctx) => {
  const operationId = uuid(body.operation_id);
  const revision = body.expected_revision;
  if (!Number.isInteger(revision) || Number(revision) < 1)
    throw new ApiError(400, "invalid_revision");
  await requireQuota(ctx);
  if (body.action === "delete")
    return {
      entry: await rpc(ctx.admin, "finn_delete_entry", {
        p_user: ctx.userId,
        p_id: uuid(body.id),
        p_revision: revision,
        p_operation_id: operationId,
      }),
    };
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
    if (transaction.person && !result.people.includes(transaction.person))
      throw new ApiError(400, "person_not_linked");
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
    )
      throw new ApiError(400, "invalid_rule");
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
