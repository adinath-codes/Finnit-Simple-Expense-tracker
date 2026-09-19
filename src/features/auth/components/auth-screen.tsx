import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import {
  createAccountWithEmail,
  sendPasswordReset,
  signInWithEmail,
  signInWithSocialProvider,
  type SocialProvider,
} from "@/features/auth/services/auth-service";

type EmailMode = "sign-in" | "create";

function messageFor(error: unknown) {
  const message = error instanceof Error ? error.message : "Please try again.";
  if (/invalid login credentials/i.test(message))
    return "That email or password doesn’t match. Try again.";
  if (/email not confirmed/i.test(message))
    return "Confirm your email first, then come back to sign in.";
  if (/provider is not enabled/i.test(message))
    return "This sign-in provider still needs to be enabled in Finn’s Supabase project.";
  return message;
}

export default function AuthScreen() {
  const [mode, setMode] = useState<EmailMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await action();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      setError(messageFor(caught));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(null);
    }
  };

  const social = (provider: SocialProvider) =>
    run(provider, () => signInWithSocialProvider(provider));

  const submitEmail = () =>
    run("email", async () => {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
        throw new Error("Enter a valid email address.");
      }
      if (password.length < 8) {
        throw new Error("Use at least 8 characters for your password.");
      }
      if (mode === "sign-in") {
        await signInWithEmail(email, password);
        return;
      }
      const result = await createAccountWithEmail(email, password);
      if (!result.session) {
        setNotice("Check your inbox to confirm your email, then return to Finn.");
      }
    });

  const forgotPassword = () =>
    run("reset", async () => {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
        throw new Error("Enter your email address first.");
      }
      await sendPasswordReset(email);
      setNotice("Password reset instructions are on their way.");
    });

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <View style={styles.hero}>
              <View style={styles.brandMark}>
                <Icon name="wallet" size={24} color={Finn.primary} animation={false} />
              </View>
              <Text style={styles.eyebrow}>YOUR PRIVATE JOURNAL</Text>
              <Text style={styles.title}>Save your money memories.</Text>
              <Text style={styles.subtitle}>
                Sign in to keep your notes private and available across devices.
              </Text>
            </View>

            <View style={styles.card}>
              <SocialButton
                provider="apple"
                label="Continue with Apple"
                busy={busy === "apple"}
                disabled={!!busy}
                onPress={() => social("apple")}
              />
              <SocialButton
                provider="google"
                label="Continue with Google"
                busy={busy === "google"}
                disabled={!!busy}
                onPress={() => social("google")}
              />

              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or use email</Text>
                <View style={styles.divider} />
              </View>

              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="Email address"
                placeholderTextColor="#A9A19D"
                value={email}
                onChangeText={setEmail}
                editable={!busy}
                style={styles.input}
                accessibilityLabel="Email address"
                returnKeyType="next"
              />
              <TextInput
                autoCapitalize="none"
                autoComplete={mode === "create" ? "new-password" : "current-password"}
                secureTextEntry
                textContentType={mode === "create" ? "newPassword" : "password"}
                placeholder="Password"
                placeholderTextColor="#A9A19D"
                value={password}
                onChangeText={setPassword}
                editable={!busy}
                style={styles.input}
                accessibilityLabel="Password"
                returnKeyType="done"
                onSubmitEditing={submitEmail}
              />

              {mode === "sign-in" ? (
                <Button
                  label="Forgot password"
                  onPress={forgotPassword}
                  disabled={!!busy}
                  style={styles.forgotButton}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </Button>
              ) : null}

              <Button
                label={mode === "sign-in" ? "Sign in with email" : "Create account with email"}
                onPress={submitEmail}
                disabled={!!busy}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>
                  {busy === "email"
                    ? "Please wait…"
                    : mode === "sign-in"
                      ? "Sign in"
                      : "Create account"}
                </Text>
              </Button>

              <Button
                label={mode === "sign-in" ? "Create an account" : "Sign in instead"}
                onPress={() => {
                  setMode((current) => current === "sign-in" ? "create" : "sign-in");
                  setError(null);
                  setNotice(null);
                }}
                disabled={!!busy}
                style={styles.modeButton}
              >
                <Text style={styles.modeText}>
                  {mode === "sign-in" ? "New to Finn? Create an account" : "Already have an account? Sign in"}
                </Text>
              </Button>

              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
            </View>

            <Text style={styles.legalCopy}>
              By continuing, you agree to Finn’s terms and acknowledge how your
              private journal is handled.
            </Text>
            <View style={styles.legalLinks}>
              <Button label="Open Privacy Policy" onPress={() => router.push("/legal/privacy")} style={styles.legalButton}>
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </Button>
              <Text style={styles.legalDot}>·</Text>
              <Button label="Open Terms of Service" onPress={() => router.push("/legal/terms")} style={styles.legalButton}>
                <Text style={styles.legalLink}>Terms of Service</Text>
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function SocialButton({
  provider,
  label,
  busy,
  disabled,
  onPress,
}: {
  provider: SocialProvider;
  label: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Button label={label} onPress={onPress} disabled={disabled} style={styles.socialButton}>
      <View style={[styles.providerBadge, provider === "apple" && styles.appleBadge]}>
        <Text style={[styles.providerLetter, provider === "apple" && styles.appleLetter]}>
          {provider === "apple" ? "A" : "G"}
        </Text>
      </View>
      <Text style={styles.socialLabel}>{busy ? "Opening…" : label}</Text>
      <View style={styles.providerSpacer} />
    </Button>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Finn.canvas },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  hero: { alignItems: "center", marginBottom: 26 },
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Finn.primarySoft,
    marginBottom: 20,
  },
  eyebrow: {
    fontFamily: JournalType.medium,
    fontSize: 11,
    letterSpacing: 1.3,
    color: Finn.primary,
    marginBottom: 10,
  },
  title: {
    fontFamily: JournalType.bold,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.8,
    color: Finn.ink,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: JournalType.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Finn.secondary,
    textAlign: "center",
    maxWidth: 360,
    marginTop: 10,
  },
  card: {
    backgroundColor: Finn.surface,
    borderRadius: 28,
    padding: 18,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Finn.line,
    ...Finn.shadow,
  },
  socialButton: {
    minHeight: 54,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: Finn.line,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    flexDirection: "row",
    gap: 12,
  },
  providerBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F2F1F0",
    alignItems: "center",
    justifyContent: "center",
  },
  appleBadge: { backgroundColor: Finn.ink },
  providerLetter: { fontFamily: JournalType.bold, color: "#4285F4", fontSize: 14 },
  appleLetter: { color: "#FFFFFF" },
  providerSpacer: { width: 26 },
  socialLabel: {
    flex: 1,
    textAlign: "center",
    fontFamily: JournalType.medium,
    fontSize: 15,
    color: Finn.ink,
  },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 3 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Finn.line },
  dividerText: { fontFamily: JournalType.regular, fontSize: 11, color: Finn.muted },
  input: {
    minHeight: 54,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: Finn.line,
    backgroundColor: "#FCFAF8",
    paddingHorizontal: 16,
    fontFamily: JournalType.regular,
    fontSize: 16,
    color: Finn.ink,
  },
  forgotButton: { minHeight: 28, alignSelf: "flex-end", paddingHorizontal: 3 },
  forgotText: { fontFamily: JournalType.medium, fontSize: 12, color: Finn.primary },
  primaryButton: { minHeight: 54, borderRadius: 18, backgroundColor: Finn.primary },
  primaryButtonText: { fontFamily: JournalType.bold, fontSize: 15, color: "#FFFFFF" },
  modeButton: { minHeight: 34 },
  modeText: { fontFamily: JournalType.medium, fontSize: 12, color: Finn.secondary },
  error: {
    fontFamily: JournalType.regular,
    color: Finn.danger,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  notice: {
    fontFamily: JournalType.regular,
    color: "#24764E",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  legalCopy: {
    fontFamily: JournalType.regular,
    color: Finn.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginHorizontal: 16,
    marginTop: 18,
  },
  legalLinks: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  legalButton: { minHeight: 32, paddingHorizontal: 5 },
  legalLink: { fontFamily: JournalType.medium, fontSize: 11, color: Finn.primary },
  legalDot: { color: Finn.muted },
});
