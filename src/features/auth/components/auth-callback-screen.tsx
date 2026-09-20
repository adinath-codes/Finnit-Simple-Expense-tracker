import * as Linking from "expo-linking";
import { type Href, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Finn, JournalType } from "@/constants/theme";
import { finishAuthRedirect } from "@/features/auth/services/auth-service";

export default function AuthCallbackScreen() {
  const url = Linking.useURL();
  const params = useLocalSearchParams<{
    code?: string | string[];
    error?: string | string[];
    error_description?: string | string[];
  }>();
  const handledUrl = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const callbackUrl = useMemo(() => {
    const query = new URLSearchParams();
    const code = first(params.code);
    const oauthError = first(params.error);
    const description = first(params.error_description);
    if (code) query.set("code", code);
    if (oauthError) query.set("error", oauthError);
    if (description) query.set("error_description", description);
    return query.size ? Linking.createURL(`auth/callback?${query}`) : url;
  }, [params.code, params.error, params.error_description, url]);

  useEffect(() => {
    if (!callbackUrl || handledUrl.current === callbackUrl) return;
    handledUrl.current = callbackUrl;
    const timeout = setTimeout(() => {
      setError("Sign in is taking too long. Check your connection and try again.");
    }, 20000);
    void finishAuthRedirect(callbackUrl)
      .then((session) => {
        if (!session) throw new Error("The sign-in link is incomplete or expired.");
        router.replace("/" as Href);
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "Sign in could not be completed.");
      })
      .finally(() => clearTimeout(timeout));
  }, [callbackUrl]);

  return (
    <View style={styles.root}>
      {error ? (
        <>
          <Text style={styles.title}>We couldn’t finish signing in.</Text>
          <Text style={styles.message}>{error}</Text>
        </>
      ) : (
        <>
          <ActivityIndicator color={Finn.primary} />
          <Text style={styles.message}>Finishing your secure sign in…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: Finn.canvas },
  title: { fontFamily: JournalType.bold, color: Finn.ink, fontSize: 22, textAlign: "center" },
  message: { fontFamily: JournalType.regular, color: Finn.secondary, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 14 },
});
