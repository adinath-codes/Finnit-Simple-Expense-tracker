import * as Linking from "expo-linking";
import { type Href, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Finn, JournalType } from "@/constants/theme";
import { finishAuthRedirect } from "@/features/auth/services/auth-service";

export default function AuthCallbackScreen() {
  const url = Linking.useURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    void finishAuthRedirect(url)
      .then((session) => {
        if (!session) throw new Error("The sign-in link is incomplete or expired.");
        router.replace("/" as Href);
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "Sign in could not be completed.");
      });
  }, [url]);

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
