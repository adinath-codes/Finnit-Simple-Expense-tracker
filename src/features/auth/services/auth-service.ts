import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import type { Provider, Session } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { getSupabase, isBackendConfigured } from "@/lib/supabase/client";
import { deleteJournalCache } from "@/lib/offline/database";
import { deleteJournalDrafts } from "@/features/journal/store/journal-draft-store";
import { clearSeenGuidance } from "@/features/guidance/services/guidance-service";
import {
  ANALYTICS_EVENTS,
  analyticsClient,
  captureAnalytics,
} from "@/lib/analytics/analytics";

WebBrowser.maybeCompleteAuthSession();

export type SocialProvider = Extract<Provider, "apple" | "google">;

let redirectAttempt:
  | { key: string; promise: Promise<Session | null> }
  | null = null;

function requireBackend() {
  if (!isBackendConfigured()) {
    throw new Error("Finnit’s secure account connection is not configured yet.");
  }
  return getSupabase();
}

function valueFromRedirect(url: string, key: string) {
  const parsed = new URL(url);
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  return parsed.searchParams.get(key) ?? fragment.get(key);
}

export function hasAuthRedirectData(url: string) {
  try {
    return !!(
      valueFromRedirect(url, "code") ||
      valueFromRedirect(url, "access_token") ||
      valueFromRedirect(url, "refresh_token") ||
      valueFromRedirect(url, "error") ||
      valueFromRedirect(url, "error_description")
    );
  } catch {
    return false;
  }
}

function redirectAttemptKey(url: string) {
  return (
    valueFromRedirect(url, "code") ??
    valueFromRedirect(url, "access_token") ??
    url
  );
}

async function exchangeAuthRedirect(url: string): Promise<Session | null> {
  const db = requireBackend();
  const errorDescription = valueFromRedirect(url, "error_description");
  const oauthError = valueFromRedirect(url, "error");
  if (errorDescription || oauthError) {
    throw new Error(errorDescription ?? oauthError ?? "Sign in could not be completed.");
  }

  const code = valueFromRedirect(url, "code");
  if (code) {
    const { data, error } = await db.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  }

  const accessToken = valueFromRedirect(url, "access_token");
  const refreshToken = valueFromRedirect(url, "refresh_token");
  if (!accessToken || !refreshToken) return null;
  const { data, error } = await db.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
  return data.session;
}

export function finishAuthRedirect(url: string): Promise<Session | null> {
  if (!hasAuthRedirectData(url)) return Promise.resolve(null);

  const key = redirectAttemptKey(url);
  if (redirectAttempt?.key === key) return redirectAttempt.promise;

  const promise = exchangeAuthRedirect(url);
  redirectAttempt = { key, promise };
  return promise;
}

export async function signInWithSocialProvider(provider: SocialProvider) {
  const db = requireBackend();
  redirectAttempt = null;
  const redirectTo = Linking.createURL("auth/callback");
  const { data, error } = await db.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error(`Could not start ${provider} sign in.`);

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
    showInRecents: false,
  });
  if (result.type !== "success") return null;
  return finishAuthRedirect(result.url);
}

export async function signInWithNativeApple() {
  const db = requireBackend();
  const nonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    nonce,
  );
  const credential = await AppleAuthentication.signInAsync({
    nonce: hashedNonce,
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) {
    throw new Error("Apple did not return a valid identity token.");
  }
  const { data, error } = await db.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce,
  });
  if (error) throw error;

  const givenName = credential.fullName?.givenName;
  const familyName = credential.fullName?.familyName;
  if (givenName || familyName) {
    await db.auth.updateUser({
      data: {
        full_name: [givenName, familyName].filter(Boolean).join(" "),
        given_name: givenName,
        family_name: familyName,
      },
    });
  }
  return data.session;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await requireBackend().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  return data.session;
}

export async function requestEmailOtp(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const { error } = await requireBackend().auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
  return normalizedEmail;
}

export async function verifyEmailOtp(email: string, token: string) {
  const { data, error } = await requireBackend().auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: "email",
  });
  if (error) throw error;
  if (!data.session) {
    throw new Error("Finnit couldn’t create a secure session from that code.");
  }
  return data.session;
}

export async function createAccountWithEmail(
  email: string,
  password: string,
) {
  const { data, error } = await requireBackend().auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { emailRedirectTo: Linking.createURL("auth/callback") },
  });
  if (error) throw error;
  return data;
}

export async function sendPasswordReset(email: string) {
  const { error } = await requireBackend().auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: Linking.createURL("reset-password") },
  );
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await requireBackend().auth.updateUser({ password });
  if (error) throw error;
}

export async function signOutCurrentDevice() {
  captureAnalytics(ANALYTICS_EVENTS.accountSignedOut, { scope: "local" });
  await analyticsClient.flush().catch(() => undefined);
  const { error } = await requireBackend().auth.signOut({ scope: "local" });
  if (error) throw error;
}

export type AccountDeletionRestoreStatus = "none" | "cancelled" | "expired";

export async function cancelPendingAccountDeletion(): Promise<AccountDeletionRestoreStatus> {
  const db = requireBackend();
  const { data, error } = await db.functions.invoke("delete-account", {
    body: { action: "cancel_deletion" },
  });
  if (error) throw error;
  const status = (data as { status?: AccountDeletionRestoreStatus } | null)?.status;
  if (status !== "none" && status !== "cancelled" && status !== "expired") {
    throw new Error("Finnit couldn’t verify your account status.");
  }
  if (status === "expired") {
    await db.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
  return status;
}

export type AccountDeletionTiming = "immediate" | "scheduled";

function appleIdentityUser(session: Session) {
  const identity = session.user.identities?.find(
    (candidate) => candidate.provider === "apple",
  );
  const subject = identity?.identity_data?.sub;
  if (typeof subject === "string" && subject) return subject;
  return typeof identity?.id === "string" && identity.id ? identity.id : null;
}

async function appleAuthorizationCodeForDeletion(session: Session) {
  const appleUser = appleIdentityUser(session);
  const providers = session.user.app_metadata.providers;
  const usesApple = !!appleUser ||
    (Array.isArray(providers) && providers.includes("apple")) ||
    session.user.app_metadata.provider === "apple";
  if (!usesApple) return undefined;
  if (Platform.OS !== "ios") {
    throw new Error(
      "Open Finnit on your iPhone or iPad to verify Sign in with Apple before deleting this account.",
    );
  }

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = appleUser
      ? await AppleAuthentication.refreshAsync({ user: appleUser })
      : await AppleAuthentication.signInAsync();
  } catch (error) {
    if (
      error && typeof error === "object" && "code" in error &&
      error.code === "ERR_REQUEST_CANCELED"
    ) {
      throw new Error("Apple verification was canceled. Your account was not deleted.");
    }
    throw error;
  }
  if (!credential.authorizationCode) {
    throw new Error("Apple couldn’t verify this deletion. Please try again.");
  }
  return credential.authorizationCode;
}

export async function deleteCurrentAccount(timing: AccountDeletionTiming) {
  const db = requireBackend();
  const { data, error: sessionError } = await db.auth.getSession();
  if (sessionError) throw sessionError;
  if (!data.session) throw new Error("Sign in again before deleting your account.");

  const userId = data.session.user.id;
  const appleAuthorizationCode = await appleAuthorizationCodeForDeletion(data.session);
  const { data: result, error } = await db.functions.invoke("delete-account", {
    body: {
      action: timing === "immediate" ? "delete_immediately" : "request_deletion",
      confirmation: "DELETE",
      ...(appleAuthorizationCode
        ? { apple_authorization_code: appleAuthorizationCode }
        : {}),
    },
  });
  if (error) throw error;

  captureAnalytics(
    timing === "immediate"
      ? ANALYTICS_EVENTS.accountDeleted
      : ANALYTICS_EVENTS.accountDeletionScheduled,
    { recovery_days: timing === "immediate" ? 0 : 30 },
  );
  await analyticsClient.flush().catch(() => undefined);

  await Promise.allSettled([
    deleteJournalCache(userId),
    deleteJournalDrafts(userId),
    clearSeenGuidance(userId),
  ]);
  const { error: signOutError } = await db.auth.signOut({ scope: "global" });
  if (signOutError) {
    await db.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
  return result as
    | { status: "deleted"; apple_revoked: boolean }
    | { status: "scheduled"; scheduled_for: string; apple_revoked: boolean };
}
