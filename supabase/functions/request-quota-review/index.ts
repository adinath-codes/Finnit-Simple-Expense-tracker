import { ApiError } from "../_shared/validation.ts";
import { metric, requireQuota, rpc, serve } from "../_shared/runtime.ts";
import { sendSupportEmail } from "../_shared/support-email.ts";

serve(async (body, ctx) => {
  if (body.action !== "request_review")
    throw new ApiError(400, "invalid_action");
  await requireQuota(ctx);

  const requestId = await rpc<string>(
    ctx.admin,
    "finn_request_ai_quota_review",
    { p_user: ctx.userId },
  );
  await sendSupportEmail(ctx, "quota_review", { requestId });
  await metric(ctx, "ai_quota_review_requested", {
    metadata: { request_id: requestId },
  });
  return { requested: true, emailed: true, request_id: requestId };
});
