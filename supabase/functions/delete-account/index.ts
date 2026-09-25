import { ApiError } from "../_shared/validation.ts";
import { rpc, serve } from "../_shared/runtime.ts";

serve(async (body, ctx) => {
  if (body.action === "cancel_deletion") {
    const status = await rpc<"none" | "cancelled" | "expired">(
      ctx.admin,
      "finn_cancel_account_deletion",
      { p_user: ctx.userId },
    );
    if (status !== "expired") return { status };

    const { error } = await ctx.admin.auth.admin.deleteUser(ctx.userId);
    if (error) throw new ApiError(503, "account_deletion_failed");
    return { status: "expired" };
  }

  if (body.action !== "request_deletion" || body.confirmation !== "DELETE") {
    throw new ApiError(400, "deletion_confirmation_required");
  }

  const scheduledFor = await rpc<string>(
    ctx.admin,
    "finn_request_account_deletion",
    { p_user: ctx.userId },
  );
  return { status: "scheduled", scheduled_for: scheduledFor };
}, { requiresPremium: false });
