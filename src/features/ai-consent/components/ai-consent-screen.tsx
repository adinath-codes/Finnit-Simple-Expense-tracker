import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { FINN_WEBSITE_URLS } from "@/constants/website-links";
import { Finn, JournalType } from "@/constants/theme";
import { useAiConsent } from "../providers/ai-consent-provider";
import {
  AI_CONSENT_POLICY_VERSION,
  AI_CONSENT_PROVIDER,
} from "../services/ai-consent-service";

const disclosures = [
  {
    title: "Financial notes",
    body: "Text you ask Finnit to organize or revise may be sent to Google Gemini.",
    icon: "note" as const,
  },
  {
    title: "Receipt images",
    body: "A receipt photo may be sent transiently to Google Gemini for extraction.",
    icon: "camera" as const,
  },
  {
    title: "Financial context",
    body: "Relevant categories, merchants, dates, and journal context may be sent when an AI answer needs them.",
    icon: "wallet" as const,
  },
];

export default function AiConsentScreen() {
  const { saving, grant, decline } = useAiConsent();
  const [error, setError] = useState<string | null>(null);

  const consent = async () => {
    if (saving) return;
    setError(null);
    try {
      await grant();
      router.replace("/");
    } catch {
      setError("Couldn’t save your consent. Please try again.");
    }
  };

  const continueWithoutAi = async () => {
    if (saving) return;
    setError(null);
    try {
      await decline();
      router.replace("/");
    } catch {
      setError("Couldn’t save your choice. Please try again.");
    }
  };

  const openPolicy = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      setError("Couldn’t open that webpage. Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badge}>
          <Icon name="sparkle" size={22} color={Finn.primary} animation={false} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          Allow AI to organize your money
        </Text>
        <Text style={styles.lede}>
          Choose whether Finnit may send the following information to {AI_CONSENT_PROVIDER}.
          You can keep using your paid journal with manual entry if you choose Not now.
        </Text>

        <View style={styles.card}>
          {disclosures.map((item, index) => (
            <View key={item.title}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.disclosure}>
                <View style={styles.iconSlot}>
                  <Icon name={item.icon} size={19} color={Finn.primary} animation={false} />
                </View>
                <View style={styles.disclosureCopy}>
                  <Text style={styles.disclosureTitle}>{item.title}</Text>
                  <Text style={styles.disclosureBody}>{item.body}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.choiceNote}>
          <Icon name="lock" size={18} color="#5F6D66" animation={false} />
          <Text style={styles.choiceText}>
            Your information is sent only when you use an AI feature. We do not
            use it for advertising. You can change this choice at any time in
            Settings; turning AI off keeps manual journal entry available.
          </Text>
        </View>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

        <Button
          label="Consent to Google Gemini data sharing and continue"
          disabled={saving}
          onPress={() => void consent()}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>
            {saving ? "Saving consent…" : "I agree and continue"}
          </Text>
        </Button>

        <Button
          label="Continue without AI"
          disabled={saving}
          onPress={() => void continueWithoutAi()}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>Not now — use manual journal</Text>
        </Button>

        <View style={styles.links}>
          <Button
            label="Read the AI Policy"
            onPress={() => void openPolicy(FINN_WEBSITE_URLS.aiPolicy)}
          >
            <Text style={styles.link}>AI Policy</Text>
          </Button>
          <Text style={styles.linkSeparator}>•</Text>
          <Button
            label="Read the Privacy Policy"
            onPress={() => void openPolicy(FINN_WEBSITE_URLS.privacyPolicy)}
          >
            <Text style={styles.link}>Privacy Policy</Text>
          </Button>
        </View>
        <Text style={styles.version}>AI consent policy {AI_CONSENT_POLICY_VERSION}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Finn.canvas },
  content: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Finn.primarySoft,
    marginBottom: 18,
  },
  title: {
    color: Finn.ink,
    fontFamily: JournalType.bold,
    fontSize: 34,
    lineHeight: 39,
    letterSpacing: -1.2,
  },
  lede: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 24,
  },
  card: {
    backgroundColor: Finn.surface,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Finn.line,
    paddingHorizontal: 18,
  },
  disclosure: { flexDirection: "row", gap: 14, paddingVertical: 18 },
  iconSlot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Finn.primarySoft,
  },
  disclosureCopy: { flex: 1 },
  disclosureTitle: {
    color: Finn.ink,
    fontFamily: JournalType.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  disclosureBody: {
    color: Finn.secondary,
    fontFamily: JournalType.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Finn.line, marginLeft: 50 },
  choiceNote: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#EEF3F0",
  },
  choiceText: {
    flex: 1,
    color: "#5F6D66",
    fontFamily: JournalType.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  error: {
    color: Finn.danger,
    fontFamily: JournalType.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 12,
  },
  secondary: {
    alignSelf: "center",
    marginTop: 14,
    minHeight: 44,
    paddingHorizontal: 18,
  },
  secondaryText: {
    color: Finn.primary,
    fontFamily: JournalType.medium,
    fontSize: 15,
  },
  primary: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: Finn.ink,
    marginTop: 20,
  },
  primaryText: { color: Finn.surface, fontFamily: JournalType.medium, fontSize: 15 },
  links: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 22,
  },
  link: { color: Finn.primary, fontFamily: JournalType.medium, fontSize: 13 },
  linkSeparator: { color: Finn.muted, fontSize: 12 },
  version: {
    color: Finn.muted,
    fontFamily: JournalType.regular,
    fontSize: 10,
    textAlign: "center",
    marginTop: 12,
  },
});
