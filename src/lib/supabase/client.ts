import "react-native-url-polyfill/auto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sessionStorage } from "./session-storage";

let client: SupabaseClient | undefined;
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
