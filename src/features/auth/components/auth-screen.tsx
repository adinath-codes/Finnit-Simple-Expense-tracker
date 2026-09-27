import * as AppleAuthentication from "expo-apple-authentication";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { Button } from "@/components/ui/button";
import { CustomToast, type CustomToastState } from "@/components/ui/custom-toast";
import { Icon } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import { AppleMark, GoogleMark } from "@/features/auth/components/provider-marks";
import {
  requestEmailOtp,
  signInWithNativeApple,
  signInWithSocialProvider,
  verifyEmailOtp,
} from "@/features/auth/services/auth-service";
import {
  ANALYTICS_EVENTS,
  captureAnalytics,
} from "@/lib/analytics/analytics";

const LEFT_PEEK = require("@/assets/images/auth/finn-peek-left.webp");
const RIGHT_PEEK = require("@/assets/images/auth/finn-peek-right.webp");

function messageFor(error: unknown) {
  const message = error instanceof Error ? error.message : "Please try again.";
  if (/token.*expired|expired.*token|invalid.*(otp|token)|otp.*invalid/i.test(message))
    return "That code is incorrect or expired. Check it and try again.";
  if (/rate limit|security purposes|seconds/i.test(message))
    return "Please wait a moment before requesting another code.";
  if (/error sending|unable to send|email.*not.*sent/i.test(message))
    return "Finn couldn’t send the code. Check the email setup and try again.";
  if (/provider is not enabled/i.test(message))
    return "This sign-in provider still needs to be enabled in Finn’s Supabase project.";
  return message;
}

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    id: number;
    mess: string;
    highlighted?: string;
    state: CustomToastState;
  } | null>(null);
  const toastId = useRef(0);

  const showToast = (mess: string, state: CustomToastState, highlighted?: string) => {
    setToast({ id: ++toastId.current, mess, highlighted, state });
  };

  useEffect(() => {
    if (!toast) return;
    const id = toast.id;
    const timeout = setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 4000);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timeout = setTimeout(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearTimeout(timeout);
  }, [resendSeconds]);

  const warnForConsent = () => {
    captureAnalytics(ANALYTICS_EVENTS.signInBlocked, {
      reason: "legal_consent_required",
    });
    showToast("To continue with Finn,", "warning", "Agree to the Privacy Policy and Terms.");
  };

  const run = async (key: string, action: () => Promise<unknown>) => {
    if (busy) return;
    const signInMethod = ["email", "apple", "google"].includes(key) ? key : null;
    setBusy(key);
    setToast(null);
    if (signInMethod) {
      captureAnalytics(ANALYTICS_EVENTS.signInStarted, { method: signInMethod });
    }
    try {
      const result = await action();
      if (signInMethod) {
        captureAnalytics(
          result
            ? ANALYTICS_EVENTS.signInCompleted
            : ANALYTICS_EVENTS.signInCancelled,
          { method: signInMethod },
        );
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      if (signInMethod) {
        captureAnalytics(ANALYTICS_EVENTS.signInFailed, {
          method: signInMethod,
          failure_type: /valid|characters/i.test(messageFor(caught))
            ? "validation"
            : "provider",
        });
      }
      showToast(messageFor(caught), "error");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(null);
    }
  };

  const recordEmailFailure = (caught: unknown) => {
    captureAnalytics(ANALYTICS_EVENTS.signInFailed, {
      method: "email",
      failure_type: /valid|characters|code/i.test(messageFor(caught))
        ? "validation"
        : "provider",
    });
    showToast(messageFor(caught), "error");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  const sendEmailCode = async (resend = false) => {
    if (!agreed) {
      warnForConsent();
      return;
    }
    if (busy || (resend && resendSeconds > 0)) return;

    setBusy(resend ? "email-resend" : "email-send");
    setToast(null);
    if (!resend) {
      captureAnalytics(ANALYTICS_EVENTS.signInStarted, { method: "email" });
    }
    try {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
        throw new Error("Enter a valid email address.");
      }
      const normalizedEmail = await requestEmailOtp(email);
      setPendingEmail(normalizedEmail);
      setOtp("");
      setResendSeconds(60);
      showToast(
        resend ? "A fresh code is on its way." : "We sent your secure sign-in code.",
        "info",
        "Check your inbox.",
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      recordEmailFailure(caught);
    } finally {
      setBusy(null);
    }
  };

  const verifyEmailCode = async () => {
    if (!pendingEmail || busy) return;
    setBusy("email-verify");
    setToast(null);
    try {
      if (!/^\d{6,8}$/.test(otp)) {
        throw new Error("Enter the verification code from your email.");
      }
      await verifyEmailOtp(pendingEmail, otp);
      captureAnalytics(ANALYTICS_EVENTS.signInCompleted, { method: "email" });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      recordEmailFailure(caught);
    } finally {
      setBusy(null);
    }
  };

  const changeEmail = () => {
    if (busy) return;
    setPendingEmail(null);
    setOtp("");
    setResendSeconds(0);
    setToast(null);
  };

  const consentGated = !agreed;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <BackgroundCharacters />
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
              <View style={styles.brandLockup}>
                <View style={styles.brandDot} />
                <Text style={styles.brandName}>FINN</Text>
              </View>
              <Text style={styles.title}>Welcome back.</Text>
              <Text style={styles.subtitle}>
                Your private money journal is right where you left it.
              </Text>
            </View>

            <View style={styles.card}>
              <AppleSignInButton
                busy={busy === "apple"}
                disabled={!!busy}
                consentGated={consentGated}
                onBlocked={warnForConsent}
                onPress={() => {
                  if (consentGated) return warnForConsent();
                  return run("apple", () =>
                    Platform.OS === "ios"
                      ? signInWithNativeApple()
                      : signInWithSocialProvider("apple"),
                  );
                }}
              />

              <View style={consentGated && styles.disabledButton}>
                <SocialButton
                  label="Continue with Google"
                  busy={busy === "google"}
                  disabled={!!busy}
                  onPress={() => {
                    if (consentGated) return warnForConsent();
                    return run("google", () => signInWithSocialProvider("google"));
                  }}
                />
              </View>

              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or use email</Text>
                <View style={styles.divider} />
              </View>

              {pendingEmail ? (
                <>
                  <View style={styles.codeIntro}>
                    <Text style={styles.codeTitle}>Check your email</Text>
                    <Text style={styles.codeMessage}>
                      Enter the verification code sent to {pendingEmail}.
                    </Text>
                  </View>
                  <TextInput
                    autoFocus
                    autoComplete="one-time-code"
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    placeholder="Verification code"
                    placeholderTextColor={Finn.muted}
                    value={otp}
                    onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 8))}
                    editable={!busy}
                    maxLength={8}
                    style={[styles.input, styles.codeInput]}
                    accessibilityLabel="Email verification code"
                    returnKeyType="done"
                    onSubmitEditing={verifyEmailCode}
                  />
                  <Button
                    label="Verify email and continue"
                    onPress={verifyEmailCode}
                    disabled={!!busy}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>
                      {busy === "email-verify" ? "Verifying…" : "Verify and continue"}
                    </Text>
                  </Button>
                  <View style={styles.emailActions}>
                    <Button
                      label={resendSeconds > 0 ? `Resend code in ${resendSeconds} seconds` : "Resend code"}
                      onPress={() => void sendEmailCode(true)}
                      disabled={!!busy || resendSeconds > 0}
                      style={styles.textButton}
                    >
                      <Text style={styles.emailActionText}>
                        {busy === "email-resend"
                          ? "Sending…"
                          : resendSeconds > 0
                            ? `Resend in ${resendSeconds}s`
                            : "Resend code"}
                      </Text>
                    </Button>
                    <Button
                      label="Use a different email"
                      onPress={changeEmail}
                      disabled={!!busy}
                      style={styles.textButton}
                    >
                      <Text style={styles.emailActionText}>Change email</Text>
                    </Button>
                  </View>
                </>
              ) : (
                <>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    placeholder="Email address"
                    placeholderTextColor={Finn.muted}
                    value={email}
                    onChangeText={setEmail}
                    editable={!busy}
                    style={styles.input}
                    accessibilityLabel="Email address"
                    returnKeyType="done"
                    onSubmitEditing={() => void sendEmailCode()}
                  />
                  <Text style={styles.emailHint}>
                    We’ll email a one-time code. New accounts become active only after verification.
                  </Text>
                  <View style={consentGated && styles.disabledButton}>
                    <Button
                      label="Continue with email"
                      onPress={() => void sendEmailCode()}
                      disabled={!!busy}
                      style={styles.primaryButton}
                    >
                      <Text style={styles.primaryButtonText}>
                        {busy === "email-send" ? "Sending code…" : "Continue with email"}
                      </Text>
                    </Button>
                  </View>
                </>
              )}

            </View>

            <View style={styles.consentRow}>
              <Button
                label={agreed ? "Withdraw agreement" : "Agree to the privacy policy and terms"}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreed }}
                disabled={!!busy}
                onPress={() => {
                  setAgreed((value) => !value);
                  setToast(null);
                }}
                style={[styles.checkbox, agreed && styles.checkboxChecked]}
              >
                {agreed ? <Icon name="check" size={14} color="#FFFFFF" animation={false} /> : null}
              </Button>
              <Text style={styles.consentText}>
                I agree to Finn’s{" "}
                <Text
                  accessibilityRole="link"
                  onPress={() => router.push("/legal/privacy")}
                  style={styles.legalLink}
                >
                  Privacy Policy
                </Text>{" "}
                and{" "}
                <Text
                  accessibilityRole="link"
                  onPress={() => router.push("/legal/terms")}
                  style={styles.legalLink}
                >
                  Terms of Service
                </Text>
                .
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <View pointerEvents="box-none" style={[styles.toastHost, { top: insets.top + 8 }]}>
          {toast ? (
            <CustomToast
              key={toast.id}
              mess={toast.mess}
              highlighted={toast.highlighted}
              state={toast.state}
            />
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

function BackgroundCharacters() {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.background}
    >
      <View style={styles.greenWash} />
      <BackgroundDoodles />
      <View style={styles.greenDot} />
      <View style={styles.amberDot} />
      <View style={styles.blueDot} />
      <Image source={LEFT_PEEK} contentFit="contain" style={styles.leftCharacter} />
      <Image source={RIGHT_PEEK} contentFit="contain" style={styles.rightCharacter} />
    </View>
  );
}

function BackgroundDoodles() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 390 844"
      preserveAspectRatio="xMidYMid slice"
      style={styles.doodleCanvas}
    >
      <Path
        d="M-42 623 C 44 567, 75 676, 156 632 S 289 582, 430 648"
        fill="none"
        stroke="#20C878"
        strokeWidth="1.5"
        strokeDasharray="5 9"
        strokeLinecap="round"
        opacity={0.16}
      />

      <Path
        d="M8 382 L52 372 L60 454 L49 447 L40 456 L30 449 L20 458 Z"
        fill="#FFFFFF"
        fillOpacity={0.34}
        stroke="#20C878"
        strokeWidth="1.8"
        strokeLinejoin="round"
        opacity={0.2}
      />
      <Line x1="22" y1="399" x2="47" y2="394" stroke="#20C878" strokeWidth="1.5" opacity={0.18} />
      <Line x1="24" y1="412" x2="49" y2="407" stroke="#20C878" strokeWidth="1.5" opacity={0.15} />
      <Line x1="27" y1="425" x2="43" y2="422" stroke="#20C878" strokeWidth="1.5" opacity={0.13} />

      <Circle cx="376" cy="505" r="27" fill="#FFF8F5" stroke="#F2B85D" strokeWidth="2" opacity={0.22} />
      <Circle cx="376" cy="505" r="19" fill="none" stroke="#F2B85D" strokeWidth="1.4" opacity={0.18} />
      <Path
        d="M368 507 C371 500, 381 499, 384 505 C387 512, 378 517, 371 513"
        fill="none"
        stroke="#F2B85D"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity={0.2}
      />

      <Rect
        x="302"
        y="735"
        width="72"
        height="54"
        rx="11"
        fill="#FFFFFF"
        fillOpacity={0.28}
        stroke="#62B9EC"
        strokeWidth="1.6"
        transform="rotate(-6 338 762)"
        opacity={0.17}
      />
      <Line x1="315" y1="752" x2="359" y2="747" stroke="#62B9EC" strokeWidth="1.4" opacity={0.14} />
      <Line x1="317" y1="764" x2="348" y2="760" stroke="#62B9EC" strokeWidth="1.4" opacity={0.12} />

      <Path d="M29 708 L29 726 M20 717 L38 717" stroke="#20C878" strokeWidth="2" strokeLinecap="round" opacity={0.18} />
      <Path d="M347 321 L347 335 M340 328 L354 328" stroke="#20C878" strokeWidth="1.8" strokeLinecap="round" opacity={0.14} />
      <Circle cx="54" cy="742" r="3" fill="#20C878" opacity={0.16} />
      <Circle cx="65" cy="729" r="2" fill="#20C878" opacity={0.13} />
      <Circle cx="335" cy="300" r="3" fill="#F2B85D" opacity={0.16} />
    </Svg>
  );
}

function AppleSignInButton({
  busy,
  disabled,
  consentGated,
  onBlocked,
  onPress,
}: {
  busy: boolean;
  disabled: boolean;
  consentGated: boolean;
  onBlocked: () => void;
  onPress: () => void;
}) {
  if (Platform.OS === "ios") {
    const nativeButton = (
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={16}
        onPress={onPress}
        pointerEvents={disabled || consentGated ? "none" : "auto"}
        accessibilityState={{ disabled: disabled || consentGated }}
        style={styles.nativeAppleButton}
      />
    );
    if (consentGated && !disabled) {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
          accessibilityHint="Agree to the Privacy Policy and Terms of Service first"
          onPress={onBlocked}
          style={styles.disabledButton}
        >
          {nativeButton}
        </Pressable>
      );
    }
    return <View style={disabled && styles.disabledButton}>{nativeButton}</View>;
  }

  return (
    <View style={consentGated && styles.disabledButton}>
      <Button
        label="Continue with Apple"
        onPress={onPress}
        disabled={disabled}
        style={styles.appleButton}
      >
        <AppleMark size={20} />
        <Text style={styles.appleLabel}>{busy ? "Opening…" : "Continue with Apple"}</Text>
        <View style={styles.providerSpacer} />
      </Button>
    </View>
  );
}

function SocialButton({
  label,
  busy,
  disabled,
  onPress,
}: {
  label: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Button label={label} onPress={onPress} disabled={disabled} style={styles.socialButton}>
      <GoogleMark size={20} />
      <Text style={styles.socialLabel}>{busy ? "Opening…" : label}</Text>
      <View style={styles.providerSpacer} />
    </Button>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Finn.canvas, overflow: "hidden" },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  toastHost: {
    position: "absolute",
    left: 18,
    right: 18,
    zIndex: 10,
    alignItems: "center",
  },
  background: {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
  },
  doodleCanvas: {
    position: "absolute",
    inset: 0,
  },
  greenWash: {
    position: "absolute",
    width: 330,
    height: 330,
    borderRadius: 165,
    backgroundColor: "#E6F8ED",
    top: -176,
    alignSelf: "center",
  },
  greenDot: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#BDEDD1",
    left: 26,
    top: 238,
    transform: [{ rotate: "12deg" }],
  },
  amberDot: {
    position: "absolute",
    width: 12,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#FFD597",
    right: 31,
    top: 178,
    transform: [{ rotate: "34deg" }],
  },
  blueDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#B9E4FF",
    right: 42,
    bottom: 118,
  },
  leftCharacter: {
    position: "absolute",
    width: 128,
    height: 164,
    left: -52,
    top: 76,
    opacity: 0.94,
    transform: [{ rotate: "-4deg" }],
  },
  rightCharacter: {
    position: "absolute",
    width: 142,
    height: 142,
    right: -61,
    top: 112,
    opacity: 0.92,
    transform: [{ rotate: "3deg" }],
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 24,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  hero: {
    alignItems: "center",
    paddingHorizontal: 36,
    marginBottom: 20,
    zIndex: 1,
  },
  brandLockup: {
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#DDEFE4",
    marginBottom: 14,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Finn.primary,
  },
  brandName: {
    fontFamily: JournalType.bold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: Finn.ink,
  },
  title: {
    fontFamily: JournalType.black,
    fontSize: 34,
    lineHeight: 39,
    letterSpacing: -1,
    color: Finn.ink,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: JournalType.regular,
    fontSize: 15,
    lineHeight: 21,
    color: "#6E6968",
    textAlign: "center",
    maxWidth: 300,
    marginTop: 7,
  },
  card: {
    backgroundColor: Finn.surface,
    borderRadius: 28,
    padding: 17,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Finn.line,
    ...Finn.shadow,
    zIndex: 2,
  },
  nativeAppleButton: {
    width: "100%",
    height: 54,
  },
  disabledButton: { opacity: 0.4 },
  appleButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#000000",
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 12,
  },
  appleLabel: {
    flex: 1,
    textAlign: "center",
    fontFamily: JournalType.medium,
    fontSize: 16,
    color: "#FFFFFF",
  },
  socialButton: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDD8D4",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 12,
  },
  providerSpacer: { width: 20 },
  socialLabel: {
    flex: 1,
    textAlign: "center",
    fontFamily: JournalType.medium,
    fontSize: 16,
    color: Finn.ink,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 3,
  },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Finn.line },
  dividerText: { fontFamily: JournalType.regular, fontSize: 11, color: Finn.muted },
  input: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Finn.line,
    backgroundColor: "#FBF8F5",
    paddingHorizontal: 16,
    fontFamily: JournalType.regular,
    fontSize: 16,
    color: Finn.ink,
  },
  emailHint: {
    marginTop: -2,
    paddingHorizontal: 4,
    fontFamily: JournalType.regular,
    fontSize: 12,
    lineHeight: 17,
    color: Finn.muted,
  },
  codeIntro: { paddingHorizontal: 4, gap: 3 },
  codeTitle: {
    fontFamily: JournalType.bold,
    fontSize: 15,
    color: Finn.ink,
  },
  codeMessage: {
    fontFamily: JournalType.regular,
    fontSize: 12,
    lineHeight: 17,
    color: Finn.secondary,
  },
  codeInput: {
    textAlign: "center",
    fontFamily: JournalType.bold,
    fontSize: 21,
    letterSpacing: 5,
  },
  emailActions: {
    minHeight: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  textButton: { minHeight: 30, paddingHorizontal: 3 },
  emailActionText: {
    fontFamily: JournalType.medium,
    fontSize: 12,
    color: "#148A52",
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: Finn.primary,
    boxShadow: "0px 5px 12px rgba(32, 200, 120, 0.22)",
  },
  primaryButtonText: {
    fontFamily: JournalType.bold,
    fontSize: 16,
    color: "#FFFFFF",
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 14,
    marginTop: 16,
    gap: 11,
    zIndex: 2,
  },
  checkbox: {
    width: 24,
    minHeight: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#B9B1AC",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  checkboxChecked: {
    borderColor: Finn.primary,
    backgroundColor: Finn.primary,
  },
  consentText: {
    flex: 1,
    fontFamily: JournalType.regular,
    color: "#625D5B",
    fontSize: 12,
    lineHeight: 18,
  },
  legalLink: {
    fontFamily: JournalType.medium,
    color: "#148A52",
    textDecorationLine: "underline",
  },
});
