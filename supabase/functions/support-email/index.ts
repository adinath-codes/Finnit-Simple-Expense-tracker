import { sendSupportEmail } from "../_shared/support-email.ts";
import { metric, requireQuota, serve } from "../_shared/runtime.ts";
import { ApiError } from "../_shared/validation.ts";

serve(async (body, ctx) => {
  if (body.kind !== "contact_us" && body.kind !== "error_report")
    throw new ApiError(400, "invalid_support_kind");
  if (body.event_id !== undefined && typeof body.event_id !== "string")
    throw new ApiError(400, "invalid_event_id");

  await requireQuota(ctx);
  await sendSupportEmail(ctx, body.kind, {
    eventId: body.kind === "error_report" ? body.event_id : undefined,
  });
  await metric(ctx, "support_email_sent", {
    metadata: {
      kind: body.kind,
      associated_with_error: body.kind === "error_report" && !!body.event_id,
    },
  });
  return { sent: true };
}, { requiresPremium: false });
