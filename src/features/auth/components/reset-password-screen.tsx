import * as Linking from "expo-linking";
import { type Href, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Finn, JournalType } from "@/constants/theme";
import {
  finishAuthRedirect,
  updatePassword,
} from "@/features/auth/services/auth-service";

export default function ResetPasswordScreen() {
  const url = Linking.useURL();
  const handledUrl = useRef<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url || handledUrl.current === url) return;
    handledUrl.current = url;
    void finishAuthRedirect(url)
      .then(() => setReady(true))
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "This reset link is no longer valid.");
      });
  }, [url]);

  const save = async () => {
    if (busy) return;
    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      router.replace("/" as Href);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your password could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.content}
        >
          <Text style={styles.eyebrow}>ACCOUNT RECOVERY</Text>
          <Text style={styles.title}>Choose a new password.</Text>
          <Text style={styles.subtitle}>
            Use a password you don’t use for another account.
          </Text>
          <TextInput
            accessibilityLabel="New password"
            autoComplete="new-password"
            secureTextEntry
            placeholder="New password"
            placeholderTextColor={Finn.muted}
            value={password}
            onChangeText={setPassword}
            editable={ready && !busy}
            style={styles.input}
          />
          <TextInput
            accessibilityLabel="Confirm new password"
            autoComplete="new-password"
            secureTextEntry
            placeholder="Confirm new password"
            placeholderTextColor={Finn.muted}
            value={confirm}
            onChangeText={setConfirm}
            editable={ready && !busy}
            onSubmitEditing={save}
            style={styles.input}
          />
          <Button
            label="Save new password"
            onPress={save}
            disabled={!ready || busy}
            style={styles.button}
          >
            <Text style={styles.buttonText}>{busy ? "Saving…" : ready ? "Save new password" : "Verifying link…"}</Text>
          </Button>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Finn.canvas },
  safeArea: { flex: 1 },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: 26, gap: 13, maxWidth: 500, width: "100%", alignSelf: "center" },
  eyebrow: { fontFamily: JournalType.medium, fontSize: 11, letterSpacing: 1.2, color: Finn.primary },
  title: { fontFamily: JournalType.bold, fontSize: 30, lineHeight: 35, letterSpacing: -0.7, color: Finn.ink },
  subtitle: { fontFamily: JournalType.regular, fontSize: 14, lineHeight: 21, color: Finn.secondary, marginBottom: 12 },
  input: { minHeight: 56, borderRadius: 18, borderWidth: 1, borderColor: Finn.line, backgroundColor: Finn.surface, paddingHorizontal: 17, fontFamily: JournalType.regular, fontSize: 16, color: Finn.ink },
  button: { minHeight: 56, borderRadius: 18, backgroundColor: Finn.primary, marginTop: 4 },
  buttonText: { fontFamily: JournalType.bold, fontSize: 15, color: "#FFFFFF" },
  error: { fontFamily: JournalType.regular, fontSize: 12, lineHeight: 18, color: Finn.danger, textAlign: "center" },
});
