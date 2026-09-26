import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import {
  refreshRevenueCatEntitlement,
  revenueCatWebhookUserIds,
} from "../_shared/revenuecat.ts";
import { env } from "../_shared/runtime.ts";
import { object } from "../_shared/validation.ts";

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") return new Response(null, { status: 405 });
    const supplied = request.headers.get("Authorization") ?? "";
    const expected = env("REVENUECAT_WEBHOOK_AUTHORIZATION");
    if (!supplied || await digest(supplied) !== await digest(expected)) {
      return new Response(null, { status: 401 });
    }

    const payload = object(await request.json());
    const event = object(payload.event);
    const eventId = typeof event.id === "string" ? event.id.slice(0, 200) : undefined;
    const userIds = revenueCatWebhookUserIds(event);
    if (!userIds.length) return new Response(null, { status: 204 });

    const url = env("SUPABASE_URL");
    const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
    const serviceKey = keys
      ? object(JSON.parse(keys)).default as string
      : env("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await Promise.all(userIds.map((userId) =>
      refreshRevenueCatEntitlement(userId, admin, "webhook", eventId)
    ));
    return new Response(null, { status: 204 });
  } catch {
    // RevenueCat retries non-2xx responses. Never log webhook bodies or IDs.
    return new Response(null, { status: 503 });
  }
});
