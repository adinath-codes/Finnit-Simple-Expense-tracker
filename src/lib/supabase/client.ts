import "react-native-url-polyfill/auto";
import * as ExpoCrypto from "expo-crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sessionStorage } from "./session-storage";

let client: SupabaseClient | undefined;

/**
 * Supabase PKCE needs `crypto.subtle.digest`. React Native does not supply the
 * WebCrypto global, but Expo Crypto exposes the same native SHA-256 primitive.
 * Install only the two WebCrypto members Supabase uses and preserve a browser's
 * native implementation when one is available.
 */
function installPkceCrypto() {
  if (globalThis.crypto?.subtle) return;

  const nativeCrypto = globalThis.crypto;
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      getRandomValues:
        nativeCrypto?.getRandomValues?.bind(nativeCrypto) ??
        ExpoCrypto.getRandomValues,
      subtle: {
        async digest(algorithm: AlgorithmIdentifier, data: BufferSource) {
          const name = typeof algorithm === "string" ? algorithm : algorithm.name;
          if (name !== "SHA-256") {
            throw new Error(`Unsupported PKCE digest algorithm: ${name}`);
          }
          return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data);
        },
      },
    },
  });
}

installPkceCrypto();

export function isBackendConfigured() {
  return !!(
    process.env.EXPO_PUBLIC_SUPABASE_URL &&
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
/** Only public configuration can enter the Expo bundle. */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      "Configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  if (!key.startsWith("sb_publishable_"))
    throw new Error("Use a modern public sb_publishable_ key.");
  client = createClient(url, key, {
    auth: {
      storage: sessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  });
  return client;
}

/** Explicit opt-in only; configure anonymous sign-in and abuse protection in Supabase. */
export async function startAnonymousJournal() {
  const db = getSupabase();
  const { data: existing, error: sessionError } = await db.auth.getSession();
  if (sessionError) throw sessionError;
  if (existing.session) return existing.session;
  if (process.env.EXPO_PUBLIC_FINN_ANONYMOUS_AUTH !== "true")
    throw new Error("Sign in before syncing your journal.");
  const { data, error } = await db.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}
export async function currentUserId(): Promise<string> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  if (!data.session)
    throw new Error("Sign in before opening your private journal.");
  return data.session.user.id;
}
