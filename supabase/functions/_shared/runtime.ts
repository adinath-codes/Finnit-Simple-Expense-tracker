import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.116.0";
import { ApiError, object } from "./validation.ts";
import type { Catalog } from "./contracts.ts";

export type Context = {
  userId: string;
  db: SupabaseClient;
  admin: SupabaseClient;
};
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export function env(name: string, fallback?: string): string {
  const value = Deno.env.get(name) || fallback;
  if (!value) throw new ApiError(503, "server_configuration_missing");
  return value;
}
export function positiveEnv(
  name: string,
  fallback: number,
  maximum = 100000,
): number {
  const value = Number(Deno.env.get(name) || fallback);
  if (!Number.isInteger(value) || value < 1 || value > maximum)
    throw new ApiError(503, "invalid_server_configuration");
  return value;
}
function key(collection: string, legacy: string) {
  const keys = Deno.env.get(collection);
  return keys ? (object(JSON.parse(keys)).default as string) : env(legacy);
}
export async function authenticate(request: Request): Promise<Context> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer "))
    throw new ApiError(401, "sign_in_required");
  const url = env("SUPABASE_URL");
  const db = createClient(
    url,
    key("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"),
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  // Online verification rejects deleted/revoked users; never trust decoded claims alone.
  const { data, error } = await db.auth.getUser(authorization.slice(7));
  if (error || !data.user) throw new ApiError(401, "sign_in_required");
  return {
    db,
    userId: data.user.id,
    admin: createClient(
      url,
      key("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    ),
  };
}
async function readBody(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(415, "json_required");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "body_required");
  let bytes = 0,
    body = "";
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 65536) {
      await reader.cancel();
      throw new ApiError(413, "body_too_large");
    }
    body += decoder.decode(value, { stream: true });
  }
  try {
    return object(JSON.parse(body + decoder.decode()));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "invalid_json");
  }
}
export function serve(
  handler: (input: Record<string, unknown>, ctx: Context) => Promise<unknown>,
) {
  Deno.serve(async (request) => {
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors });
    try {
      if (request.method !== "POST") throw new ApiError(405, "post_required");
      const ctx = await authenticate(request);
      const result = await handler(await readBody(request), ctx);
      return Response.json(result, {
        headers: { ...cors, "Cache-Control": "no-store" },
      });
    } catch (error) {
      const known = error instanceof ApiError;
      const status = known ? error.status : 500;
      const code = known ? error.code : "backend_unavailable";
      // Never log notes, JWTs, provider responses, or database error details.
      console.error(JSON.stringify({ event: "request_failed", code, status }));
      return Response.json(
        {
          error: {
            code,
            retryable:
              code !== "ai_quota_exhausted" &&
              (status === 429 || status >= 500),
          },
        },
        {
          status,
          headers: {
            ...cors,
            "Cache-Control": "no-store",
            ...(status === 429 ? { "Retry-After": "60" } : {}),
          },
        },
      );
    }
  });
}
export async function rpc<T>(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    if (
      /revision_conflict|idempotency_conflict|entry_conflict/.test(
        error.message,
      )
    )
      throw new ApiError(409, "revision_or_idempotency_conflict");
    if (/entry_not_found/.test(error.message))
      throw new ApiError(404, "entry_not_found");
    throw new ApiError(503, "database_unavailable");
  }
  return data as T;
}
export async function reserve(
  ctx: Context,
  bucket: "api" | "ai",
): Promise<boolean> {
  return await rpc(ctx.admin, "finn_reserve_quota", {
    p_user: ctx.userId,
    p_bucket: bucket,
    p_minute: positiveEnv(
      bucket === "ai" ? "FINN_AI_MINUTE_LIMIT" : "FINN_API_MINUTE_LIMIT",
      bucket === "ai" ? 5 : 120,
    ),
    p_daily: positiveEnv(
      bucket === "ai" ? "FINN_AI_DAILY_LIMIT" : "FINN_API_DAILY_LIMIT",
      bucket === "ai" ? 30 : 1000,
    ),
    p_monthly: positiveEnv(
      bucket === "ai" ? "FINN_AI_MONTHLY_LIMIT" : "FINN_API_MONTHLY_LIMIT",
      bucket === "ai" ? 300 : 20000,
    ),
  });
}
export async function requireQuota(ctx: Context) {
  if (!(await reserve(ctx, "api")))
    throw new ApiError(429, "daily_request_limit");
}
export async function catalog(ctx: Context): Promise<Catalog> {
  const rows = async (table: string, columns: string, order: string) => {
    const items: Record<string, unknown>[] = [];
    for (let offset = 0; offset < 5000; offset += 500) {
      const { data, error } = await ctx.db
        .from(table)
        .select(columns)
        .order(order)
        .range(offset, offset + 499);
      if (error) throw new ApiError(503, "catalog_unavailable");
      items.push(...(data as unknown as Record<string, unknown>[]));
      if (data.length < 500) return items;
    }
    // Never silently skip a user's category override after hitting a row limit.
    throw new ApiError(422, "catalog_limit_reached");
  };
  const results = await Promise.all([
    rows("categories", "id,name,parent_id", "id"),
    rows("merchants", "id,canonical_name,default_category_id,user_id", "id"),
    rows("merchant_aliases", "alias,merchant_id,user_id", "id"),
    rows("category_rules", "merchant_key,category_id", "merchant_key"),
    rows("people", "name", "name"),
    rows("contexts", "name", "name"),
  ]);
  return {
    categories: results[0],
    merchants: results[1],
    aliases: results[2],
    rules: results[3],
    people: results[4],
    contexts: results[5],
  } as unknown as Catalog;
}
export async function metric(
  ctx: Context,
  event: string,
  extra: Record<string, unknown> = {},
) {
  const { error } = await ctx.admin
    .from("backend_events")
    .insert({ user_id: ctx.userId, event, ...extra });
  if (error) console.error(JSON.stringify({ event: "metrics_unavailable" }));
}
