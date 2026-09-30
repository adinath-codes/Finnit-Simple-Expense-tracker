import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.14";
import { ApiError } from "../functions/_shared/validation.ts";
import { revokeAppleAuthorization } from "../functions/_shared/apple-auth.ts";

function base64UrlJson(value: Record<string, unknown>) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fakeIdentityToken(subject: string) {
  return `header.${base64UrlJson({ sub: subject, aud: "com.finnit.app" })}.signature`;
}

async function configureAppleSecrets() {
  const keys = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keys.privateKey));
  let encoded = "";
  for (const byte of pkcs8) encoded += String.fromCharCode(byte);
  Deno.env.set("APPLE_TEAM_ID", "TEAM123456");
  Deno.env.set("APPLE_KEY_ID", "KEY123456");
  Deno.env.set("APPLE_CLIENT_ID", "com.finnit.app");
  Deno.env.set(
    "APPLE_PRIVATE_KEY",
    `-----BEGIN PRIVATE KEY-----\n${btoa(encoded)}\n-----END PRIVATE KEY-----`,
  );
}

Deno.test("Apple authorization code is exchanged and its refresh token is revoked", async () => {
  await configureAppleSecrets();
  const requests: Array<{ url: string; body: URLSearchParams }> = [];
  const fetcher = (async (input: URL | Request | string, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body as URLSearchParams;
    requests.push({ url, body });
    if (url.endsWith("/auth/token")) {
      return Response.json({
        id_token: fakeIdentityToken("apple-user-1"),
        refresh_token: "apple-refresh-token",
        access_token: "apple-access-token",
      });
    }
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  await revokeAppleAuthorization("fresh-code", ["apple-user-1"], fetcher);

  assertEquals(requests.length, 2);
  assertEquals(requests[0].url, "https://appleid.apple.com/auth/token");
  assertEquals(requests[0].body.get("code"), "fresh-code");
  assertEquals(requests[1].url, "https://appleid.apple.com/auth/revoke");
  assertEquals(requests[1].body.get("token"), "apple-refresh-token");
  assertEquals(requests[1].body.get("token_type_hint"), "refresh_token");
});

Deno.test("Apple token exchange cannot revoke a different account", async () => {
  await configureAppleSecrets();
  let requestCount = 0;
  const fetcher = (async () => {
    requestCount += 1;
    return Response.json({
      id_token: fakeIdentityToken("different-apple-user"),
      refresh_token: "do-not-revoke",
    });
  }) as typeof fetch;

  await assertRejects(
    () => revokeAppleAuthorization("fresh-code", ["expected-user"], fetcher),
    ApiError,
    "apple_identity_mismatch",
  );
  assertEquals(requestCount, 1);
});
