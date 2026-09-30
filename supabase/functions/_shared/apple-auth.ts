import { env } from "./runtime.ts";
import { ApiError } from "./validation.ts";

type Fetcher = typeof fetch;

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function encodeJson(value: Record<string, unknown>) {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJwtPayload(token: string) {
  const part = token.split(".")[1];
  if (!part) throw new ApiError(503, "apple_token_exchange_failed");
  try {
    const padded = part.replace(/-/g, "+").replace(/_/g, "/")
      .padEnd(Math.ceil(part.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    throw new ApiError(503, "apple_token_exchange_failed");
  }
}

function privateKeyBytes(pem: string) {
  const normalized = pem.replace(/\\n/g, "\n");
  const encoded = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  try {
    return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  } catch {
    throw new ApiError(503, "invalid_apple_private_key");
  }
}

async function clientSecret(now = Math.floor(Date.now() / 1_000)) {
  const teamId = env("APPLE_TEAM_ID");
  const keyId = env("APPLE_KEY_ID");
  const clientId = env("APPLE_CLIENT_ID");
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "pkcs8",
      privateKeyBytes(env("APPLE_PRIVATE_KEY")),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "invalid_apple_private_key");
  }

  const header = encodeJson({ alg: "ES256", kid: keyId, typ: "JWT" });
  const payload = encodeJson({
    iss: teamId,
    iat: now,
    exp: now + 300,
    aud: "https://appleid.apple.com",
    sub: clientId,
  });
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

async function appleRequest(
  path: "token" | "revoke",
  body: URLSearchParams,
  fetcher: Fetcher,
) {
  let response: Response;
  try {
    response = await fetcher(`https://appleid.apple.com/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    throw new ApiError(
      503,
      path === "token" ? "apple_token_exchange_failed" : "apple_token_revocation_failed",
    );
  }
  if (!response.ok) {
    throw new ApiError(
      503,
      path === "token" ? "apple_token_exchange_failed" : "apple_token_revocation_failed",
    );
  }
  return response;
}

/** Exchange a fresh Apple authorization code and revoke the resulting token. */
export async function revokeAppleAuthorization(
  authorizationCode: string,
  expectedSubjects: string[],
  fetcher: Fetcher = fetch,
) {
  if (!expectedSubjects.length) {
    throw new ApiError(503, "apple_identity_unavailable");
  }
  const clientId = env("APPLE_CLIENT_ID");
  const secret = await clientSecret();
  const tokenResponse = await appleRequest(
    "token",
    new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      code: authorizationCode,
      grant_type: "authorization_code",
    }),
    fetcher,
  );
  let token: Record<string, unknown>;
  try {
    token = await tokenResponse.json() as Record<string, unknown>;
  } catch {
    throw new ApiError(503, "apple_token_exchange_failed");
  }
  const identityToken = typeof token.id_token === "string" ? token.id_token : "";
  const claims = decodeJwtPayload(identityToken);
  if (
    typeof claims.sub !== "string" ||
    !expectedSubjects.includes(claims.sub) ||
    claims.aud !== clientId
  ) {
    throw new ApiError(403, "apple_identity_mismatch");
  }

  const refreshToken = typeof token.refresh_token === "string"
    ? token.refresh_token
    : null;
  const accessToken = typeof token.access_token === "string"
    ? token.access_token
    : null;
  const revocationToken = refreshToken ?? accessToken;
  if (!revocationToken) throw new ApiError(503, "apple_token_exchange_failed");

  await appleRequest(
    "revoke",
    new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      token: revocationToken,
      token_type_hint: refreshToken ? "refresh_token" : "access_token",
    }),
    fetcher,
  );
}
