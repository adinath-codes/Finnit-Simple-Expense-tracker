import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppSheet } from "@/components/sheets/app-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import type { FinnWebsiteUrl } from "@/constants/website-links";

export function LegalWebsiteRedirectScreen({
  title,
  url,
}: {
  title: string;
  url: FinnWebsiteUrl;
}) {
  const [error, setError] = useState<string | null>(null);
  const open = useCallback(async () => {
    setError(null);
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      setError("Couldn’t open the webpage. Check your connection and try again.");
    }
  }, [url]);

  useEffect(() => {
    void open();
  }, [open]);

  return (
    <AppSheet title={title} bodyStyle={styles.body}>
      <View style={styles.icon}>
        <Icon name="globe" size={24} color={Finn.primary} animation={false} />
      </View>
      <Text style={styles.title}>The current {title.toLowerCase()} lives on finn-it.app.</Text>
      <Text style={styles.bodyCopy}>
        Finnit opens the canonical web document so the policy you read is the
        same version linked from the App Store and support pages.
      </Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Button label={`Open ${title}`} onPress={() => void open()} style={styles.button}>
        <Text style={styles.buttonText}>Open {title}</Text>
      </Button>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: "center", paddingTop: 28, paddingBottom: 30 },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Finn.primarySoft,
    marginBottom: 18,
  },
  title: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 20,
    lineHeight: 27,
    textAlign: "center",
  },
  bodyCopy: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
  },
  error: {
    color: Finn.danger,
    fontFamily: JournalType.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 14,
  },
  button: {
    alignSelf: "stretch",
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: Finn.ink,
    marginTop: 22,
  },
  buttonText: { color: Finn.surface, fontFamily: JournalType.medium, fontSize: 14 },
});
