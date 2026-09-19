import { ApiError } from "../_shared/validation.ts";
import { serve } from "../_shared/runtime.ts";

serve(async (body, ctx) => {
  if (body.action !== "delete_account" || body.confirmation !== "DELETE") {
    throw new ApiError(400, "deletion_confirmation_required");
  }

  const { error } = await ctx.admin.auth.admin.deleteUser(ctx.userId);
  if (error) throw new ApiError(503, "account_deletion_failed");
  return { deleted: true };
});
