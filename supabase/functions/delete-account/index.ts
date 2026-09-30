import { ApiError } from "../_shared/validation.ts";
import { rpc, serve, type Context } from "../_shared/runtime.ts";
import { revokeAppleAuthorization } from "../_shared/apple-auth.ts";

async function revokeAppleIfNeeded(
  body: Record<string, unknown>,
  ctx: Context,
) {
  const { data, error } = await ctx.admin.auth.admin.getUserById(ctx.userId);
  if (error || !data.user) throw new ApiError(503, "account_lookup_failed");
  const appleIdentities = (data.user.identities ?? [])
    .filter((identity) => identity.provider === "apple");
  if (!appleIdentities.length) return false;

  const authorizationCode = body.apple_authorization_code;
  if (typeof authorizationCode !== "string" || !authorizationCode.trim()) {
    throw new ApiError(428, "apple_reauthorization_required");
  }
  const subjects = appleIdentities.flatMap((identity) => {
    const subject = identity.identity_data?.sub;
    return [
      ...(typeof subject === "string" ? [subject] : []),
      ...(typeof identity.id === "string" ? [identity.id] : []),
    ];
  });
  await revokeAppleAuthorization(authorizationCode.trim(), [...new Set(subjects)]);
  return true;
}

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

  if (
    !["request_deletion", "delete_immediately"].includes(body.action as string) ||
    body.confirmation !== "DELETE"
  ) {
    throw new ApiError(400, "deletion_confirmation_required");
  }

  const appleRevoked = await revokeAppleIfNeeded(body, ctx);
  if (body.action === "delete_immediately") {
    const { error } = await ctx.admin.auth.admin.deleteUser(ctx.userId);
    if (error) throw new ApiError(503, "account_deletion_failed");
    return { status: "deleted", apple_revoked: appleRevoked };
  }

  const scheduledFor = await rpc<string>(
    ctx.admin,
    "finn_request_account_deletion",
    { p_user: ctx.userId },
  );
  return {
    status: "scheduled",
    scheduled_for: scheduledFor,
    apple_revoked: appleRevoked,
  };
}, { requiresPremium: false });
